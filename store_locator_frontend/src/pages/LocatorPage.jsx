import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

// --- PIN ICON ASSET FIX ---
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
    // Search & Map State
    const [searchInput, setSearchInput] = useState('');
    const [stores, setStores] = useState([]);
    const [center, setCenter] = useState([40.7128, -74.0060]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Pagination & Filter State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [resultsPerPage] = useState(10);

    const [selectedType, setSelectedType] = useState('');
    const [selectedRadius, setSelectedRadius] = useState(5000); // Nationwide default
    const [openNow, setOpenNow] = useState(false);

    // Trigger search whenever page or filters change (except the search text itself)
    useEffect(() => {
        if (stores.length > 0) {
            handleSearch(null, currentPage);
        }
    }, [selectedType, selectedRadius, openNow, currentPage]);

    const handleSearch = async (e, page = 1) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('stores/search', {
                zip_code: searchInput || "USA",
                page: page,
                limit: resultsPerPage,
                filters: {
                    radius_miles: parseFloat(selectedRadius),
                    store_type: selectedType || null,
                    open_now: openNow
                }
            });

            const data = response.data;
            setStores(data.results);
            setTotalResults(data.total);

            if (data.results.length > 0 && page === 1) {
                setCenter([data.results[0].latitude, data.results[0].longitude]);
            } else if (data.results.length === 0) {
                setError("No stores found matching these criteria.");
            }
        } catch (err) {
            setError("Location not recognized. Try a zip code.");
        } finally {
            setLoading(false);
        }
    };

    // UI Helper: Open/Closed Badge
    const getOpenStatus = (store) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        const hours = store[`hours_${days[now.getDay()]}`];

        if (!hours || hours.toLowerCase() === 'closed') return { text: 'CLOSED', color: 'text-red-500' };
        const [start, end] = hours.split('-');
        return (currentTime >= start && currentTime <= end)
            ? { text: 'OPEN NOW', color: 'text-green-500' }
            : { text: 'CLOSED', color: 'text-red-500' };
    };

    return (
        <div className="flex flex-col h-screen text-black bg-white">
            {/* --- HEADER --- */}
            <header className="p-4 border-b shadow-sm z-[1001] bg-white">
                <form onSubmit={(e) => { setCurrentPage(1); handleSearch(e, 1); }} className="flex gap-4 items-end max-w-6xl mx-auto">
                    <div className="flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-gray-400 mb-1">LOCATION</label>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="border p-2 rounded text-sm outline-none focus:border-blue-500"
                            placeholder="Zip code, City, or State..."
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded font-bold text-sm h-[42px]">
                        {loading ? '...' : 'SEARCH'}
                    </button>
                </form>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- SIDEBAR --- */}
                <div className="w-1/3 overflow-y-auto p-4 bg-gray-50 border-r">
                    {/* FILTER CONTROLS */}
                    <div className="mb-4 bg-white p-3 rounded shadow-sm border border-gray-200">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <select
                                value={selectedType}
                                onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                                className="text-xs border p-2 rounded"
                            >
                                <option value="">All Store Types</option>
                                <option value="regular">Regular</option>
                                <option value="outlet">Outlet</option>
                                <option value="flagship">Flagship</option>
                            </select>
                            <select
                                value={selectedRadius}
                                onChange={(e) => { setSelectedRadius(e.target.value); setCurrentPage(1); }}
                                className="text-xs border p-2 rounded"
                            >
                                <option value="50">50 Miles</option>
                                <option value="250">250 Miles</option>
                                <option value="5000">Nationwide</option>
                            </select>
                        </div>
                        <label className="text-[10px] font-bold flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={openNow}
                                onChange={(e) => { setOpenNow(e.target.checked); setCurrentPage(1); }}
                                className="w-4 h-4"
                            />
                            ONLY SHOW OPEN NOW
                        </label>
                    </div>

                    {error && <p className="text-red-500 text-xs font-bold mb-4">{error}</p>}

                    {/* STORE LIST */}
                    {stores.map(store => {
                        const status = getOpenStatus(store);
                        return (
                            <div key={store.store_id} className="mb-3 p-4 bg-white border-l-4 border-blue-500 shadow-sm rounded">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-sm">{store.name}</h3>
                                    <span className={`text-[9px] font-black ${status.color}`}>{status.text}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{store.address_street}</p>
                                <div className="flex justify-between mt-2">
                                    <p className="text-xs text-blue-600 font-bold">{parseFloat(store.distance || 0).toFixed(1)} miles away</p>
                                    <span className="text-[9px] uppercase font-bold text-gray-400">{store.store_type}</span>
                                </div>
                            </div>
                        );
                    })}

                    {/* PAGINATION */}
                    {totalResults > resultsPerPage && (
                        <div className="mt-6 flex justify-between items-center bg-white p-2 rounded border">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="px-3 py-1 text-xs bg-gray-50 border rounded disabled:opacity-30"
                            >
                                Prev
                            </button>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Page {currentPage}</span>
                            <button
                                disabled={currentPage * resultsPerPage >= totalResults}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="px-3 py-1 text-xs bg-gray-50 border rounded disabled:opacity-30"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

                {/* --- MAP --- */}
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
                                        <div className="mt-1 border-t pt-1 font-bold">Today: {store.hours_mon}</div>
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