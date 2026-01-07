import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

// Pin Icon Fix
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocatorPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [stores, setStores] = useState([]);
    const [center, setCenter] = useState([40.7128, -74.0060]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Filter & Pagination States
    const [selectedType, setSelectedType] = useState('');
    const [selectedRadius, setSelectedRadius] = useState(15);
    const [selectedServices, setSelectedServices] = useState([]); // Array for multiple services
    const [openNow, setOpenNow] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);

    // Trigger search on any filter change
    useEffect(() => {
        if (stores.length > 0 || searchInput) {
            performSearch(null, currentPage);
        }
    }, [selectedType, selectedRadius, selectedServices, openNow, currentPage]);

    const handleServiceToggle = (service) => {
        setCurrentPage(1);
        setSelectedServices(prev =>
            prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
        );
    };

    const performSearch = async (e, page = 1) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('stores/search', {
                zip_code: searchInput || "New York",
                page: page,
                limit: 10,
                filters: {
                    radius_miles: parseFloat(selectedRadius),
                    store_type: selectedType || null,
                    services: selectedServices, // Sends array: ["wifi", "parking"]
                    open_now: openNow
                }
            });

            setStores(response.data.results);
            setTotalResults(response.data.total);
            if (response.data.results.length > 0 && page === 1) {
                setCenter([response.data.results[0].latitude, response.data.results[0].longitude]);
            }
        } catch (err) {
            setError("Location not found. Try a zip code.");
        } finally {
            setLoading(false);
        }
    };

    const getOpenStatus = (store) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const now = new Date();
        const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        const hours = store[`hours_${days[now.getDay()]}`];
        if (!hours || hours.toLowerCase() === 'closed') return { text: 'CLOSED', color: 'text-red-500' };
        const [start, end] = hours.split('-');
        return (time >= start && time <= end) ? { text: 'OPEN', color: 'text-green-500' } : { text: 'CLOSED', color: 'text-red-500' };
    };

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            <header className="p-4 border-b shadow-sm z-[1001] bg-white">
                <form onSubmit={(e) => { setCurrentPage(1); performSearch(e, 1); }} className="flex gap-4 items-end max-w-6xl mx-auto">
                    <div className="flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Find Store</label>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Zip code or City..."
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded font-bold text-sm h-[42px]">
                        {loading ? '...' : 'SEARCH'}
                    </button>
                </form>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 overflow-y-auto p-4 bg-gray-50 border-r">
                    {/* --- FILTER SECTION --- */}
                    <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <select value={selectedRadius} onChange={(e) => { setSelectedRadius(e.target.value); setCurrentPage(1); }} className="text-xs border p-2 rounded">
                                <option value="5">5 Miles</option>
                                <option value="15">15 Miles</option>
                                <option value="50">50 Miles</option>
                                <option value="5000">Nationwide</option>
                            </select>
                            <select value={selectedType} onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }} className="text-xs border p-2 rounded">
                                <option value="">All Types</option>
                                <option value="regular">Regular</option>
                                <option value="outlet">Outlet</option>
                                <option value="flagship">Flagship</option>
                            </select>
                        </div>

                        {/* SERVICES CHECKBOXES */}
                        <div className="border-t pt-3 mt-1">
                            <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Amenities</p>
                            <div className="flex flex-wrap gap-4">
                                {['WiFi', 'Parking', 'Wheelchair'].map(service => (
                                    <label key={service} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedServices.includes(service)}
                                            onChange={() => handleServiceToggle(service)}
                                            className="w-3 h-3 accent-blue-600"
                                        />
                                        <span className="text-[10px] font-bold text-gray-600 uppercase">{service}</span>
                                    </label>
                                ))}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={openNow}
                                        onChange={(e) => { setOpenNow(e.target.checked); setCurrentPage(1); }}
                                        className="w-3 h-3 accent-green-600"
                                    />
                                    <span className="text-[10px] font-bold text-gray-600 uppercase">Open Now</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-[10px] font-bold mb-4">{error}</p>}

                    {stores.map(store => {
                        const status = getOpenStatus(store);
                        return (
                            <div key={store.store_id} className="mb-3 p-4 bg-white border-l-4 border-blue-500 shadow-sm rounded hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-sm text-gray-800">{store.name}</h3>
                                    <span className={`text-[9px] font-black ${status.color}`}>{status.text}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{store.address_street}</p>
                                <div className="flex justify-between mt-3 items-center">
                                    <p className="text-xs text-blue-600 font-bold">{parseFloat(store.distance || 0).toFixed(1)} mi</p>
                                    <div className="flex gap-1">
                                        {store.services && store.services.split('|').map(s => (
                                            <span key={s} className="text-[8px] bg-blue-50 text-blue-500 px-1 rounded border border-blue-100">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex-1 relative z-10">
                    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapRecenter center={center} />
                        {stores.map(store => (
                            <Marker key={store.store_id} position={[store.latitude, store.longitude]}>
                                <Popup>
                                    <div className="text-xs">
                                        <b className="text-blue-600">{store.name}</b><br/>
                                        {store.address_street}<br/>
                                        <p className="mt-1 font-bold text-gray-400">Type: {store.store_type}</p>
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

function MapRecenter({ center }) {
    const map = useMap();
    map.flyTo(center, 12, { duration: 1.5 });
    return null;
}

export default LocatorPage;