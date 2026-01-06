import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';
import { Link } from "react-router-dom";

// Fix for default Leaflet icon - ensures the blue pins show up
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to move the map
function RecenterMap({ center }) {
    const map = useMap();
    map.flyTo(center, 12, { duration: 1.5 });
    return null;
}

// Helper: Logic to pull today's specific hours from the store data
const getTodayHours = (store) => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = days[new Date().getDay()];
    const hoursField = `hours_${today}`;
    return store[hoursField] || "Contact for hours";
};

const LocatorPage = () => {
    // --- STATE ---
    const [zipCode, setZipCode] = useState('');
    const [stores, setStores] = useState([]);
    const [center, setCenter] = useState([40.7128, -74.0060]); // Default to NYC
    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [resultsPerPage, setResultsPerPage] = useState(10);

    // Filter State
    const [selectedType, setSelectedType] = useState('');
    const [selectedRadius, setSelectedRadius] = useState(5000); // Default high to find all data

    // --- SEARCH FUNCTION ---
    const handleSearch = async (e, page = 1, currentLimit = resultsPerPage) => {
        if (e) e.preventDefault();
        setCurrentPage(page);

        try {
            // We build the request to match your Backend StoreSearchRequest schema
            const response = await api.post('stores/search', {
                address: null,
                zip_code: zipCode || null,
                page: page,
                limit: currentLimit,
                filters: {
                    radius_miles: parseFloat(selectedRadius),
                    store_type: selectedType || null,
                    services: []
                }
            });

            console.log("Full Backend Response:", response.data);

            const results = response.data.results;
            setStores(results);
            setTotalResults(response.data.total || 0);

            // Recenter map if results are found
            if (results && results.length > 0 && page === 1) {
                setCenter([results[0].latitude, results[0].longitude]);
            }
        } catch (err) {
            console.error("Search failed:", err);
            alert("Search error. Check if backend is running or see console.");
        }
    };

    const totalPages = Math.ceil(totalResults / resultsPerPage);

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            {/* --- TOP NAVIGATION & SEARCH --- */}
            <header className="p-4 bg-white shadow-md z-[1001] flex justify-between items-center border-b">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-blue-600 tracking-tight">STORE LOCATOR</h1>
                    <Link to="/login" className="text-sm text-gray-400 hover:text-blue-600 ml-4 font-medium">
                        Admin Portal
                    </Link>
                </div>

                <form onSubmit={(e) => handleSearch(e, 1)} className="flex gap-4 items-end">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-400 mb-1">PAGE SIZE</label>
                        <select
                            value={resultsPerPage}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setResultsPerPage(val);
                                handleSearch(null, 1, val);
                            }}
                            className="border p-2 rounded text-sm bg-gray-50 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            <option value="10">10 per page</option>
                            <option value="25">25 per page</option>
                            <option value="50">50 per page</option>
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Zip Code</label>
                        <input
                            type="text"
                            value={zipCode}
                            onChange={(e) => setZipCode(e.target.value)}
                            className="border p-2 rounded w-32 bg-gray-50 focus:ring-1 focus:ring-blue-500 outline-none"
                            placeholder="e.g. 10001"
                        />
                    </div>

                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition-all shadow-sm">
                        SEARCH
                    </button>
                </form>
            </header>

            {/* --- MAIN INTERFACE --- */}
            <div className="flex flex-1 overflow-hidden">

                {/* SIDEBAR */}
                <div className="w-1/3 overflow-y-auto p-4 border-r bg-gray-50 flex flex-col">

                    {/* FILTER BOX */}
                    <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-widest">Filter Results</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-blue-600 font-bold block mb-1">STORE TYPE</label>
                                <select
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value)}
                                    className="w-full text-xs p-2 border rounded bg-white outline-none"
                                >
                                    <option value="">All Types</option>
                                    <option value="retail">Retail</option>
                                    <option value="express">Express</option>
                                    <option value="warehouse">Warehouse</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-blue-600 font-bold block mb-1">MAX RADIUS</label>
                                <select
                                    value={selectedRadius}
                                    onChange={(e) => setSelectedRadius(e.target.value)}
                                    className="w-full text-xs p-2 border rounded bg-white outline-none"
                                >
                                    <option value="10">10 Miles</option>
                                    <option value="50">50 Miles</option>
                                    <option value="100">100 Miles</option>
                                    <option value="5000">Nationwide</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* STORE LIST */}
                    <div className="flex-1">
                        {stores.length === 0 ? (
                            <div className="text-center mt-20">
                                <p className="text-gray-400 italic">No stores found. Try a different search or clear filters.</p>
                            </div>
                        ) : (
                            stores.map(store => (
                                <div key={store.store_id} className="mb-4 p-4 bg-white rounded shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-gray-800 leading-tight">{store.name}</h3>
                                        <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold uppercase tracking-tighter">
                                            {store.store_type}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{store.address_street}</p>

                                    <p className="text-xs text-blue-600 font-bold mt-2">
                                        {store.distance !== null && store.distance !== undefined
                                            ? `${parseFloat(store.distance).toFixed(1)} miles away`
                                            : 'Distance N/A'}
                                    </p>

                                    <div className="mt-3 text-xs text-gray-500 space-y-1 border-t border-gray-50 pt-3">
                                        <p className="flex items-center gap-2">
                                            <span className="text-gray-400">📞</span> {store.phone || 'N/A'}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <span className="text-gray-400">🕒</span> Today: {getTodayHours(store)}
                                        </p>
                                        {store.services && (
                                            <div className="mt-2 bg-gray-50 p-2 rounded text-[10px] italic">
                                                <span className="font-bold text-blue-400 block mb-1">SERVICES</span>
                                                {store.services}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* PAGINATION */}
                    {totalResults > resultsPerPage && (
                        <div className="mt-4 pt-4 border-t flex justify-between items-center bg-white p-2 rounded sticky bottom-0">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => handleSearch(null, currentPage - 1)}
                                className="px-4 py-1 text-sm bg-white border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50"
                            >
                                Previous
                            </button>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Page {currentPage} / {totalPages}
                            </span>
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() => handleSearch(null, currentPage + 1)}
                                className="px-4 py-1 text-sm bg-white border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

                {/* MAP AREA */}
                <div className="flex-1 relative z-10">
                    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <RecenterMap center={center} />
                        {stores.map(store => (
                            <Marker key={store.store_id} position={[store.latitude, store.longitude]}>
                                <Popup>
                                    <div className="text-xs p-1">
                                        <b className="text-blue-600 text-sm block mb-1">{store.name}</b>
                                        <span className="text-gray-600">{store.address_street}</span><br/>
                                        <div className="mt-2 border-t pt-1 border-gray-100">
                                            <p className="m-0 text-[10px]"><b>Today:</b> {getTodayHours(store)}</p>
                                            <p className="m-0 text-[10px]"><b>Phone:</b> {store.phone || 'N/A'}</p>
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

export default LocatorPage;