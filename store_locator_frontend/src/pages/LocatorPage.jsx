import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

// --- LEAFLET ICON FIX (Required for pins to show on deployed sites) ---
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

    // Effect: Re-fetch when filters or page change
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

            // Logic for map centering
            if (data.results.length > 0 && page === 1) {
                setCenter([data.results[0].latitude, data.results[0].longitude]);
            } else if (data.results.length === 0) {
                setError(`No stores found. Try searching a wider radius or 'Nationwide'.`);
            }
        } catch (err) {
            setError("Location search failed. Try adding the city name (e.g., '10036 New York').");
        } finally {
            setLoading(false);
        }
    };

    // UI Helper: Open/Closed Badge Calculation
    const getOpenStatus = (store) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        const dayKey = `hours_${days[now.getDay()]}`;
        const hours = store[dayKey];

        if (!hours || hours.toLowerCase() === 'closed') return { text: 'CLOSED', color: 'text-red-500' };
        try {
            const [start, end] = hours.split('-');
            // Handles simple 24h format comparison
            return (currentTime >= start.trim() && currentTime <= end.trim())
                ? { text: 'OPEN NOW', color: 'text-green-600' }
                : { text: 'CLOSED', color: 'text-red-500' };
        } catch {
            return { text: 'CLOSED', color: 'text-red-500' };
        }
    };

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            {/* --- TOP BAR --- */}
            <header className="p-4 border-b shadow-sm z-[1001] bg-white">
                <form onSubmit={(e) => { setCurrentPage(1); performSearch(e, 1); }} className="flex gap-4 items-end max-w-6xl mx-auto w-full">
                    <div className="flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tighter">Enter Zip Code or City</label>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                            placeholder="e.g. 10036 or California"
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-10 py-2 rounded font-bold text-sm h-[42px] hover:bg-blue-700 active:scale-95 transition-all">
                        {loading ? '...' : 'FIND STORES'}
                    </button>
                </form>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- SIDEBAR --- */}
                <div className="w-1/3 overflow-y-auto p-4 bg-gray-100 border-r flex flex-col">

                    {/* FILTER SECTION */}
                    <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Search Radius</label>
                                <select
                                    value={selectedRadius}
                                    onChange={(e) => { setSelectedRadius(e.target.value); setCurrentPage(1); }}
                                    className="w-full text-xs border p-2 rounded bg-gray-50 cursor-pointer"
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
                                    className="w-full text-xs border p-2 rounded bg-gray-50 cursor-pointer"
                                >
                                    <option value="">All Types</option>
                                    <option value="regular">Regular</option>
                                    <option value="flagship">Flagship</option>
                                    <option value="express">Express</option>
                                    <option value="outlet">Outlet</option>
                                </select>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={openNow}
                                onChange={(e) => { setOpenNow(e.target.checked); setCurrentPage(1); }}
                                className="w-4 h-4 accent-blue-600"
                            />
                            <span className="text-[10px] font-bold text-gray-600 uppercase">Show Open Stores Only</span>
                        </label>
                    </div>

                    {error && <p className="bg-red-50 text-red-600 p-3 rounded text-xs font-bold mb-4 border border-red-100">{error}</p>}

                    {/* STORE RESULTS */}
                    <div className="flex-1">
                        {stores.map(store => {
                            const status = getOpenStatus(store);
                            return (
                                <div key={store.store_id} className="mb-3 p-4 bg-white border-l-4 border-blue-500 shadow-sm rounded hover:border-blue-700 transition-all">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-sm text-gray-800">{store.name}</h3>
                                        <span className={`text-[9px] font-black tracking-widest ${status.color}`}>{status.text}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 uppercase">{store.address_street}</p>
                                    <div className="flex justify-between mt-3 items-center">
                                        <p className="text-xs text-blue-600 font-bold">
                                            {store.distance ? `${parseFloat(store.distance).toFixed(1)} mi away` : 'Nationwide View'}
                                        </p>
                                        <span className="text-[9px] uppercase font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{store.store_type}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* PAGINATION BAR */}
                    {totalResults > resultsPerPage && (
                        <div className="mt-4 flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm sticky bottom-0">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="px-4 py-1 text-[10px] font-bold bg-gray-100 rounded disabled:opacity-30 hover:bg-gray-200"
                            >
                                PREV
                            </button>
                            <span className="text-[10px] font-bold text-gray-400">PAGE {currentPage}</span>
                            <button
                                disabled={currentPage * resultsPerPage >= totalResults}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="px-4 py-1 text-[10px] font-bold bg-gray-100 rounded disabled:opacity-30 hover:bg-gray-200"
                            >
                                NEXT
                            </button>
                        </div>
                    )}
                </div>

                {/* --- MAP SECTION --- */}
                <div className="flex-1 relative z-10">
                    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapRecenter center={center} />
                        {stores.map(store => (
                            <Marker key={store.store_id} position={[store.latitude, store.longitude]}>
                                <Popup>
                                    <div className="text-xs p-1">
                                        <b className="text-blue-600 block mb-1 uppercase tracking-tighter">{store.name}</b>
                                        <p className="text-gray-600 mb-1">{store.address_street}</p>
                                        <div className="border-t pt-1 font-bold text-gray-400">
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

// MapRecenter component to fly to coordinates smoothly
function MapRecenter({ center }) {
    const map = useMap();
    map.flyTo(center, 12, { duration: 1.5 });
    return null;
}

export default LocatorPage;