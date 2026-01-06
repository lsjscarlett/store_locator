import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

const LocatorPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [stores, setStores] = useState([]);
    const [center, setCenter] = useState([40.7128, -74.0060]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [selectedType, setSelectedType] = useState('');
    const [selectedRadius, setSelectedRadius] = useState(50);
    const [openNow, setOpenNow] = useState(false);

    const validateAndSearch = async (e) => {
        if (e) e.preventDefault();
        setError('');

        const query = searchInput.trim();

        // --- EDGE CASE: Input Validation ---
        if (!query) {
            setError("Please enter a zip code or city name.");
            return;
        }

        // Check if numeric input is too short (Zip Code check)
        if (/^\d+$/.test(query) && query.length < 5) {
            setError("Zip code must be 5 digits (e.g., 10001).");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('stores/search', {
                zip_code: query,
                filters: {
                    // EDGE CASE: Ensure radius is never negative
                    radius_miles: Math.abs(parseFloat(selectedRadius)) || 50,
                    store_type: selectedType || null,
                    open_now: openNow
                }
            });

            if (response.data.results.length === 0) {
                setError(`No stores found for "${query}". Try increasing the radius.`);
                setStores([]);
            } else {
                setStores(response.data.results);
                setCenter([response.data.results[0].latitude, response.data.results[0].longitude]);
            }
        } catch (err) {
            // EDGE CASE: Typos like "New Yor" usually return a 404 or empty from geocoder
            setError("We couldn't find that location. Please check your spelling.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            <header className="p-4 bg-white shadow-md z-[1001] border-b">
                <form onSubmit={validateAndSearch} className="flex gap-4 items-end max-w-6xl mx-auto">
                    <div className="flex flex-col flex-1 relative">
                        <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Where are you?</label>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className={`border p-2 rounded bg-gray-50 outline-none transition-all ${error ? 'border-red-500 ring-1 ring-red-100' : 'focus:border-blue-500'}`}
                            placeholder="Zip code, City, or State"
                        />
                        {error && <span className="absolute -bottom-5 left-0 text-[10px] text-red-500 font-bold">{error}</span>}
                    </div>

                    <div className="flex items-center mb-2 gap-2 bg-gray-50 px-3 py-2 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                        <input
                            type="checkbox"
                            id="openNow"
                            checked={openNow}
                            onChange={(e) => setOpenNow(e.target.checked)}
                            className="w-4 h-4 accent-blue-600"
                        />
                        <label htmlFor="openNow" className="text-[10px] font-bold text-gray-600 cursor-pointer uppercase tracking-tighter">Open Now</label>
                    </div>

                    <button type="submit" disabled={loading} className="bg-blue-600 text-white px-8 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
                        {loading ? 'SEARCHING...' : 'FIND STORES'}
                    </button>
                </form>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 overflow-y-auto p-4 border-r bg-gray-50 shadow-inner">
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <select value={selectedRadius} onChange={(e) => setSelectedRadius(e.target.value)} className="text-xs p-2 border rounded shadow-sm">
                            <option value="10">10 Miles</option>
                            <option value="25">25 Miles</option>
                            <option value="5000">Nationwide</option>
                        </select>
                        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="text-xs p-2 border rounded shadow-sm">
                            <option value="">All Types</option>
                            <option value="retail">Retail</option>
                            <option value="outlet">Outlet</option>
                        </select>
                    </div>

                    {stores.map(store => (
                        <div key={store.store_id} className="mb-4 p-4 bg-white rounded border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="font-bold">{store.name}</h3>
                            <p className="text-xs text-gray-500">{store.address_street}</p>
                            <p className="text-xs text-blue-600 font-bold mt-2 italic">{parseFloat(store.distance).toFixed(1)} miles away</p>
                        </div>
                    ))}
                </div>

                <div className="flex-1 relative z-10">
                    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapRecenter center={center} />
                        {stores.map(store => (
                            <Marker key={store.store_id} position={[store.latitude, store.longitude]} />
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