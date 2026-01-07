import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

// --- ICONS ---
import iconBlue from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: iconBlue,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

let HoverIcon = L.icon({
    iconUrl: iconBlue,
    shadowUrl: iconShadow,
    iconSize: [40, 65],
    iconAnchor: [20, 65],
    popupAnchor: [1, -34],
    className: 'hue-rotate-180'
});

L.Marker.prototype.options.icon = DefaultIcon;

// Hardcoded list of common services found in your CSV
const AVAILABLE_SERVICES = [
    'pickup', 'optical', 'garden_center', 'returns',
    'automotive', 'gift_wrapping', 'photo_printing', 'pharmacy'
];

const LocatorPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [stores, setStores] = useState([]);
    const [center, setCenter] = useState([39.8283, -98.5795]);
    const [zoom, setZoom] = useState(4);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [hoveredStoreId, setHoveredStoreId] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [resultsPerPage] = useState(10);

    // FILTERS
    const [selectedRadius, setSelectedRadius] = useState(10);
    const [selectedType, setSelectedType] = useState('');
    const [selectedServices, setSelectedServices] = useState([]); // Array of strings
    const [openNow, setOpenNow] = useState(false);

    useEffect(() => {
        if (stores.length === 0) performSearch(null, 1);
    }, [selectedRadius, selectedType, selectedServices, openNow, currentPage]);

    const performSearch = async (e, page = 1) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('stores/search', {
                zip_code: searchInput || null,
                page: page,
                limit: resultsPerPage,
                filters: {
                    radius_miles: parseFloat(selectedRadius),
                    store_type: selectedType || null,
                    services: selectedServices.length > 0 ? selectedServices : null,
                    open_now: openNow
                }
            });

            setStores(response.data.results);
            setTotalResults(response.data.total);

            if (response.data.results.length > 0 && page === 1) {
                setCenter([response.data.results[0].latitude, response.data.results[0].longitude]);
                setZoom(13);
            } else if (response.data.results.length === 0) {
                if (searchInput && !searchInput.match(/\d{5}/) && !searchInput.includes(',')) {
                    setError("Address too vague. Try adding a City or Zip Code.");
                } else {
                    setError("No stores found matching your criteria.");
                }
            }
        } catch (err) {
            setError("Search failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleServiceToggle = (service) => {
        setSelectedServices(prev => {
            if (prev.includes(service)) {
                return prev.filter(s => s !== service);
            } else {
                return [...prev, service];
            }
        });
        setCurrentPage(1); // Reset to page 1 on filter change
    };

    const getHoursDisplay = (store) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayName = days[new Date().getDay()];
        const hours = store[`hours_${dayName}`];

        if (!hours || hours.toLowerCase() === 'closed') return "Closed Today";
        return `Today: ${hours}`;
    };

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            {/* HEADER */}
            <header className="p-4 border-b shadow-sm z-[1001] bg-white">
                <div className="max-w-6xl mx-auto flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-black text-blue-600 tracking-tighter">STORE LOCATOR</h1>
                        <Link to="/login" className="text-xs font-bold text-gray-400 hover:text-blue-600 uppercase no-underline">
                            Admin Login
                        </Link>
                    </div>

                    <form onSubmit={(e) => { setCurrentPage(1); performSearch(e, 1); }} className="flex gap-4 items-end w-full">
                        <div className="flex flex-col flex-1">
                            <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Enter Zip, City, or State</label>
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                                placeholder="e.g. 198 Elm St, Jersey City OR 07305"
                            />
                        </div>
                        <button type="submit" className="bg-blue-600 text-white px-10 py-2 rounded font-bold text-sm h-[42px] hover:bg-blue-700">
                            {loading ? '...' : 'FIND'}
                        </button>
                    </form>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* SIDEBAR */}
                <div className="w-1/3 overflow-y-auto p-4 bg-gray-50 border-r flex flex-col">

                    {/* FILTERS CARD */}
                    <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        {/* Row 1: Radius & Type */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Radius</label>
                                <select value={selectedRadius} onChange={(e) => { setSelectedRadius(e.target.value); setCurrentPage(1); }} className="w-full text-xs border p-2 rounded bg-gray-50">
                                    <option value="10">10 Miles</option>
                                    <option value="25">25 Miles</option>
                                    <option value="50">50 Miles</option>
                                    <option value="100">100 Miles</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Store Type</label>
                                <select value={selectedType} onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }} className="w-full text-xs border p-2 rounded bg-gray-50">
                                    <option value="">All Types</option>
                                    <option value="regular">Regular</option>
                                    <option value="flagship">Flagship</option>
                                    <option value="express">Express</option>
                                    <option value="outlet">Outlet</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Services Filter */}
                        <div className="mb-4">
                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-2">Filter Services</label>
                            <div className="grid grid-cols-2 gap-2">
                                {AVAILABLE_SERVICES.map(service => (
                                    <label key={service} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedServices.includes(service)}
                                            onChange={() => handleServiceToggle(service)}
                                            className="w-3 h-3 accent-blue-600 rounded"
                                        />
                                        <span className="text-[10px] text-gray-600 capitalize">
                                            {service.replace(/_/g, ' ')}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Row 3: Open Now */}
                        <label className="flex items-center gap-2 cursor-pointer border-t pt-3">
                            <input type="checkbox" checked={openNow} onChange={(e) => { setOpenNow(e.target.checked); setCurrentPage(1); }} className="w-4 h-4 accent-blue-600" />
                            <span className="text-[10px] font-bold text-gray-600 uppercase">Open Now</span>
                        </label>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 rounded shadow-sm">
                            <p className="text-red-700 text-xs font-bold">{error}</p>
                        </div>
                    )}

                    {/* LIST OF STORES */}
                    <div className="flex-1">
                        {stores.map(store => (
                            <div
                                key={store.store_id}
                                onMouseEnter={() => setHoveredStoreId(store.store_id)}
                                onMouseLeave={() => setHoveredStoreId(null)}
                                className={`mb-3 p-4 bg-white border-l-4 shadow-sm rounded cursor-pointer transition-all ${
                                    hoveredStoreId === store.store_id
                                        ? 'border-red-500 shadow-md bg-blue-50 transform scale-[1.02]'
                                        : 'border-blue-500'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-sm text-gray-800">{store.name}</h3>
                                    <span className={`text-[9px] font-black ${store.is_open ? 'text-green-600' : 'text-red-500'}`}>
                                        {store.is_open ? 'OPEN' : 'CLOSED'}
                                    </span>
                                </div>

                                <p className="text-xs text-gray-500 mt-1">
                                    {store.address_street}<br/>
                                    {store.address_city}, {store.address_state} {store.address_postal_code}
                                </p>

                                {/* SERVICE BADGES */}
                                {store.services && store.services.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {store.services.map((svc, idx) => (
                                            <span key={idx} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 capitalize">
                                                {svc.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2">
                                    <div className="text-[10px] text-gray-600">
                                        <span className="font-bold block text-gray-400 uppercase">Phone</span>
                                        {store.phone || "N/A"}
                                    </div>
                                    <div className="text-[10px] text-gray-600 text-right">
                                        <span className="font-bold block text-gray-400 uppercase">Hours</span>
                                        {getHoursDisplay(store)}
                                    </div>
                                </div>

                                <div className="flex justify-between mt-3 items-center">
                                    <p className="text-xs text-blue-600 font-bold">
                                        {store.distance !== null ? `${parseFloat(store.distance).toFixed(1)} mi` : ''}
                                    </p>
                                    <span className="text-[9px] uppercase font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{store.store_type}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalResults > resultsPerPage && (
                        <div className="mt-4 flex justify-between items-center bg-white p-3 rounded border">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-4 py-1 text-[10px] font-bold bg-gray-100 rounded disabled:opacity-30">PREV</button>
                            <span className="text-[10px] font-bold text-gray-400">PAGE {currentPage}</span>
                            <button disabled={currentPage * resultsPerPage >= totalResults} onClick={() => setCurrentPage(prev => prev + 1)} className="px-4 py-1 text-[10px] font-bold bg-gray-100 rounded disabled:opacity-30">NEXT</button>
                        </div>
                    )}
                </div>

                {/* MAP */}
                <div className="flex-1 relative z-10">
                    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapRecenter center={center} zoom={zoom} />
                        {stores.map(store => (
                            <Marker
                                key={store.store_id}
                                position={[store.latitude, store.longitude]}
                                icon={hoveredStoreId === store.store_id ? HoverIcon : DefaultIcon}
                                zIndexOffset={hoveredStoreId === store.store_id ? 1000 : 0}
                            >
                                <Popup>
                                    <div className="text-xs">
                                        <b className="uppercase text-blue-600">{store.name}</b><br/>
                                        {store.address_street}<br/>
                                        <span className="text-gray-500">{store.phone}</span>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

function MapRecenter({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom);
    }, [center, zoom, map]);
    return null;
}

export default LocatorPage;