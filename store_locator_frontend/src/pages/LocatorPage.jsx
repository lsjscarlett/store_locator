import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

// --- FIXED ASSETS: Ensures pins show up on Railway ---
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
    const [center, setCenter] = useState([40.7128, -74.0060]); // Default NYC
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Pagination & Filter State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [resultsPerPage] = useState(10);

    const [selectedType, setSelectedType] = useState('');
    const [selectedRadius, setSelectedRadius] = useState(15);
    const [openNow, setOpenNow] = useState(false);

    // Effect: Automatically re-search when filters or page change
    useEffect(() => {
        if (stores.length > 0 || searchInput.trim()) {
            performSearch(null, currentPage);
        }
    }, [selectedType, selectedRadius, openNow, currentPage]);

    const performSearch = async (e, page = 1) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('stores/search', {
                zip_code: searchInput || "New York",
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

            // Move map to the first result on a new search
            if (data.results.length > 0 && page === 1) {
                setCenter([data.results[0].latitude, data.results[0].longitude]);
            } else if (data.results.length === 0) {
                setError(`No stores found. Try a larger radius.`);
            }
        } catch (err) {
            setError("Location not found. Try '10036 New York' or a city name.");
        } finally {
            setLoading(false);
        }
    };

    // UI Helper: Calculates real-time open/closed status
    const getOpenStatus = (store) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        const dayKey = `hours_${days[now.getDay()]}`;
        const hours = store[dayKey];

        if (!hours || hours.toLowerCase() === 'closed') return { text: 'CLOSED', color: 'text-red-500' };
        try {
            const [start, end] = hours.split('-');
            return (currentTime >= start && currentTime <= end)
                ? { text: 'OPEN NOW', color: 'text-green-500' }
                : { text: 'CLOSED', color: 'text-red-500' };
        } catch {
            return { text: 'CLOSED', color: 'text-red-500' };
        }
    };

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            {/* --- SEARCH HEADER --- */}
            <header className="p-4 border-b shadow-sm z-[1001] bg-white">
                <form onSubmit={(e) => { setCurrentPage(1); performSearch(e, 1); }} className="flex gap-4 items-end max-w-6xl mx-auto">
                    <div className="flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-gray-400 mb-1 tracking-widest uppercase">Location</label>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                            placeholder="Zip code, City, or State..."
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded font-bold text-sm h-[42px] hover:bg-blue-700">
                        {loading ? '...' : 'FIND STORES'}
                    </button>
                </form>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- SIDEBAR --- */}
                <div className="w-1/3 overflow-y-auto p-4 bg-gray-50 border-r flex flex-col">

                    {/* FILTER BOX */}
                    <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Radius</label>
                                <select
                                    value={selectedRadius}
                                    onChange={(e) => { setSelectedRadius(e.target.value); setCurrentPage(1); }}
                                    className="w-full text-xs border p-2 rounded bg-gray-50"
                                >
                                    <option value="5">5 Miles</option>
                                    <option value="15">15 Miles</option>
                                    <option value="50">50 Miles</option>
                                    <option value="5000">Nationwide</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Store Type</label>
                                <select
                                    value={selectedType}
                                    onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                                    className="w-full text-xs border p-2 rounded bg-gray-50"
                                >
                                    <option value="">All Types</option>
                                    <option value="regular">Regular</option>
                                    <option value="outlet">Outlet</option>
                                    <option value="flagship">Flagship</option>
                                </select>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={openNow}
                                onChange={(e) => { setOpenNow(e.target.checked); setCurrentPage(1); }}
                                className="w-4 h-4 accent-blue-600"
                            />
                            <span className="text-[10px] font-bold text-gray-600 uppercase">Only Show Open Now</span>
                        </label>
                    </div>

                    {error && <p className="bg-red-50 text-red-600 p-3 rounded text-xs font-bold mb-4 border border-red-100">{error}</p>}

                    {/* LIST OF STORES */}
                    <div className="flex-1">
                        {stores.map(store => {
                            const status = getOpenStatus(store);
                            return (
                                <div key={store.store_id} className="mb-3 p-4 bg-white border-l-4 border-blue-500 shadow-sm rounded hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-sm text-gray-800">{store.name}</h3>
                                        <span className={`text-[9px] font-black ${status.color}`}>{status.text}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{store.address_street}</p>
                                    <div className="flex justify-between mt-3 items-center">
                                        <p className="text-xs text-blue-600 font-bold">{parseFloat(store.distance || 0).toFixed(1)} miles away</p>
                                        <span className="text-[9px] uppercase font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{store.store_type}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* PAGINATION */}
                    {totalResults > resultsPerPage && (
                        <div className="mt-4 flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm sticky bottom-0">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="px-4 py-1 text-xs font-bold bg-gray-100 rounded disabled:opacity-30 hover:bg-gray-200"
                            >
                                PREV
                            </button>
                            <span className="text-[10px] font-bold text-gray-400">PAGE {currentPage}</span>
                            <button
                                disabled={currentPage * resultsPerPage >= totalResults}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="px-4 py-1 text-xs font-bold bg-gray-100 rounded disabled:opacity-30 hover:bg-gray-200"
                            >
                                NEXT
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
                                    <div className="text-xs p-1">
                                        <b className="text-blue-600 block mb-1">{store.name}</b>
                                        <p className="text-gray-600 mb-1">{store.address_street}</p>
                                        <div className="border-t pt-1 font-bold text-gray-400 italic">
                                            {store.store_type}
                                        </div>
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

// Helper to move the map
function MapRecenter({ center }) {
    const map = useMap();
    map.flyTo(center, 12, { duration: 1.5 });
    return null;
}

export default LocatorPage;