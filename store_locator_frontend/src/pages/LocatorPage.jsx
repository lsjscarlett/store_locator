import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';
import { Link } from "react-router-dom";

// Leaflet Icon Fix
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function RecenterMap({ center }) {
    const map = useMap();
    map.flyTo(center, 12, { duration: 1.5 });
    return null;
}

const getTodayHours = (store) => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = days[new Date().getDay()];
    return store[`hours_${today}`] || "Contact for hours";
};

const LocatorPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [stores, setStores] = useState([]);
    const [center, setCenter] = useState([40.7128, -74.0060]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [resultsPerPage, setResultsPerPage] = useState(10);
    const [selectedType, setSelectedType] = useState('');
    const [selectedRadius, setSelectedRadius] = useState(50);

    const handleSearch = async (e, page = 1, currentLimit = resultsPerPage) => {
        if (e) e.preventDefault();
        setCurrentPage(page);

        try {
            const response = await api.post('stores/search', {
                // The backend accepts 'zip_code' as a general search string
                zip_code: searchInput || "New York",
                page: page,
                limit: currentLimit,
                filters: {
                    radius_miles: parseFloat(selectedRadius),
                    store_type: selectedType || null,
                    services: []
                }
            });

            setStores(response.data.results);
            setTotalResults(response.data.total || 0);

            if (response.data.results.length > 0 && page === 1) {
                setCenter([response.data.results[0].latitude, response.data.results[0].longitude]);
            }
        } catch (err) {
            console.error("Search API Error:", err);
        }
    };

    const resetFilters = () => {
        setSearchInput('');
        setSelectedType('');
        setSelectedRadius(50);
        setStores([]);
        setTotalResults(0);
    };

    const totalPages = Math.ceil(totalResults / resultsPerPage);

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            <header className="p-4 bg-white shadow-md z-[1001] flex justify-between items-center border-b">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-blue-600">STORE LOCATOR</h1>
                    <Link to="/login" className="text-xs text-gray-400 hover:text-blue-600 font-medium">Admin Portal</Link>
                </div>

                <form onSubmit={(e) => handleSearch(e, 1)} className="flex gap-4 items-end">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Location</label>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="border p-2 rounded w-64 bg-gray-50 focus:ring-1 focus:ring-blue-500 outline-none"
                            placeholder="Zip, City, or Address..."
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition-all">
                        FIND STORES
                    </button>
                </form>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 overflow-y-auto p-4 border-r bg-gray-50 flex flex-col">
                    <div className="mb-4 flex justify-between items-center">
                        <h2 className="font-bold text-gray-700">Results ({totalResults})</h2>
                        <button onClick={resetFilters} className="text-[10px] text-blue-500 font-bold uppercase hover:underline">Clear All</button>
                    </div>

                    <div className="mb-6 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[9px] text-gray-400 font-bold block mb-1">TYPE</label>
                                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-full text-xs p-2 border rounded bg-white">
                                    <option value="">All Stores</option>
                                    <option value="retail">Retail</option>
                                    <option value="express">Express</option>
                                    <option value="outlet">Outlet</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] text-gray-400 font-bold block mb-1">RADIUS</label>
                                <select value={selectedRadius} onChange={(e) => setSelectedRadius(e.target.value)} className="w-full text-xs p-2 border rounded bg-white">
                                    <option value="10">10 Miles</option>
                                    <option value="25">25 Miles</option>
                                    <option value="50">50 Miles</option>
                                    <option value="5000">Nationwide</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1">
                        {stores.map(store => (
                            <div key={store.store_id} className="mb-4 p-4 bg-white rounded shadow-sm border-l-4 border-blue-500">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-800">{store.name}</h3>
                                    <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase">{store.store_type}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{store.address_street}</p>
                                <p className="text-xs text-blue-600 font-bold mt-1">
                                    {store.distance ? `${parseFloat(store.distance).toFixed(1)} miles away` : 'Nearby'}
                                </p>
                                <div className="mt-3 text-xs text-gray-400 pt-2 border-t border-gray-50 flex flex-col gap-1">
                                    <p>📞 {store.phone}</p>
                                    <p>🕒 {getTodayHours(store)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalResults > resultsPerPage && (
                        <div className="mt-4 pt-4 border-t flex justify-between items-center sticky bottom-0 bg-gray-50">
                            <button disabled={currentPage === 1} onClick={() => handleSearch(null, currentPage - 1)} className="px-3 py-1 bg-white border rounded shadow-sm text-xs disabled:opacity-30">Prev</button>
                            <span className="text-[10px] text-gray-400 font-bold">PAGE {currentPage} / {totalPages}</span>
                            <button disabled={currentPage >= totalPages} onClick={() => handleSearch(null, currentPage + 1)} className="px-3 py-1 bg-white border rounded shadow-sm text-xs disabled:opacity-30">Next</button>
                        </div>
                    )}
                </div>

                <div className="flex-1 relative z-10">
                    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <RecenterMap center={center} />
                        {stores.map(store => (
                            <Marker key={store.store_id} position={[store.latitude, store.longitude]}>
                                <Popup>
                                    <div className="text-xs">
                                        <b className="text-blue-600">{store.name}</b><br/>
                                        {store.address_street}<br/>
                                        <div className="mt-1 font-bold text-gray-500">{getTodayHours(store)}</div>
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

export default LocatorPage;