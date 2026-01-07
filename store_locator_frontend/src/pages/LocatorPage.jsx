import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

// Leaflet Icon Fix for Production
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

    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [resultsPerPage] = useState(10);

    const [selectedType, setSelectedType] = useState('');
    const [selectedRadius, setSelectedRadius] = useState(5000); // Default to Nationwide for testing
    const [openNow, setOpenNow] = useState(false);

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
                zip_code: searchInput || "USA",
                page: page,
                limit: resultsPerPage,
                filters: {
                    radius_miles: parseFloat(selectedRadius),
                    store_type: selectedType || null,
                    open_now: openNow
                }
            });

            setStores(response.data.results);
            setTotalResults(response.data.total);

            if (response.data.results.length > 0 && page === 1) {
                setCenter([response.data.results[0].latitude, response.data.results[0].longitude]);
            } else if (response.data.results.length === 0) {
                setError("No stores found. Try selecting 'Nationwide' and 'All Types'.");
            }
        } catch (err) {
            setError("Location not found. Try a zip code like 10036.");
        } finally {
            setLoading(false);
        }
    };

    const getOpenStatus = (store) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        const dayKey = `hours_${days[now.getDay()]}`;
        const hours = store[dayKey];

        if (!hours || hours.toLowerCase() === 'closed') return { text: 'CLOSED', color: 'text-red-500' };
        try {
            const [start, end] = hours.split('-');
            return (currentTime >= start.trim() && currentTime <= end.trim())
                ? { text: 'OPEN', color: 'text-green-600' }
                : { text: 'CLOSED', color: 'text-red-500' };
        } catch { return { text: 'CLOSED', color: 'text-red-500' }; }
    };

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            {/* --- BRAND TITLE & SEARCH --- */}
            <header className="p-4 border-b shadow-sm z-[1001] bg-white">
                <div className="max-w-6xl mx-auto flex flex-col gap-4">
                    <h1 className="text-2xl font-black text-blue-600 tracking-tighter">STORE LOCATOR</h1>
                    <form onSubmit={(e) => { setCurrentPage(1); performSearch(e, 1); }} className="flex gap-4 items-end w-full">
                        <div className="flex flex-col flex-1">
                            <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Enter Zip, City, or State</label>
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                                placeholder="e.g. 10036 or California"
                            />
                        </div>
                        <button type="submit" className="bg-blue-600 text-white px-10 py-2 rounded font-bold text-sm h-[42px] hover:bg-blue-700">
                            {loading ? '...' : 'FIND STORES'}
                        </button>
                    </form>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- SIDEBAR --- */}
                <div className="w-1/3 overflow-y-auto p-4 bg-gray-50 border-r flex flex-col">
                    <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Radius</label>
                                <select value={selectedRadius} onChange={(e) => { setSelectedRadius(e.target.value); setCurrentPage(1); }} className="w-full text-xs border p-2 rounded bg-gray-50">
                                    <option value="15">15 Miles</option>
                                    <option value="50">50 Miles</option>
                                    <option value="5000">Nationwide</option>
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
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={openNow} onChange={(e) => { setOpenNow(e.target.checked); setCurrentPage(1); }} className="w-4 h-4 accent-blue-600" />
                            <span className="text-[10px] font-bold text-gray-600 uppercase">Open Now</span>
                        </label>
                    </div>

                    {error && <p className="text-red-600 p-2 text-xs font-bold mb-4">{error}</p>}

                    <div className="flex-1">
                        {stores.map(store => {
                            const status = getOpenStatus(store);
                            return (
                                <div key={store.store_id} className="mb-3 p-4 bg-white border-l-4 border-blue-500 shadow-sm rounded">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-sm text-gray-800">{store.name}</h3>
                                        <span className={`text-[9px] font-black ${status.color}`}>{status.text}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-tighter">{store.address_street}</p>
                                    <div className="flex justify-between mt-3 items-center">
                                        <p className="text-xs text-blue-600 font-bold">{store.distance ? `${parseFloat(store.distance).toFixed(1)} mi` : 'N/A'}</p>
                                        <span className="text-[9px] uppercase font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{store.store_type}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {totalResults > resultsPerPage && (
                        <div className="mt-4 flex justify-between items-center bg-white p-3 rounded border">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-4 py-1 text-[10px] font-bold bg-gray-100 rounded disabled:opacity-30">PREV</button>
                            <span className="text-[10px] font-bold text-gray-400">PAGE {currentPage}</span>
                            <button disabled={currentPage * resultsPerPage >= totalResults} onClick={() => setCurrentPage(prev => prev + 1)} className="px-4 py-1 text-[10px] font-bold bg-gray-100 rounded disabled:opacity-30">NEXT</button>
                        </div>
                    )}
                </div>

                <div className="flex-1 relative z-10">
                    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapRecenter center={center} />
                        {stores.map(store => (
                            <Marker key={store.store_id} position={[store.latitude, store.longitude]}>
                                <Popup><div className="text-xs"><b>{store.name}</b><br/>{store.address_street}</div></Popup>
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
    map.flyTo(center, 12);
    return null;
}

export default LocatorPage;