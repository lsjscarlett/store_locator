import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

// --- CRITICAL FIX: PIN ICONS ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    iconRetinaUrl: iconRetina,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocatorPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [stores, setStores] = useState([]);
    const [center, setCenter] = useState([40.7128, -74.0060]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [selectedType, setSelectedType] = useState('');
    const [selectedRadius, setSelectedRadius] = useState(50);
    const [openNowFilter, setOpenNowFilter] = useState(false);

    // Helper to check if a store is open right now for the UI badge
    const getOpenStatus = (store) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const now = new Date();
        const dayName = days[now.getDay()];
        const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        const hours = store[`hours_${dayName}`];

        if (!hours || hours.toLowerCase() === 'closed') return { status: 'CLOSED', color: 'text-red-500' };
        const [open, close] = hours.split('-');
        if (currentTime >= open && currentTime <= close) return { status: 'OPEN NOW', color: 'text-green-500' };
        return { status: 'CLOSED', color: 'text-red-500' };
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        setError('');
        if (!searchInput.trim()) { setError("Please enter a location."); return; }

        setLoading(true);
        try {
            const response = await api.post('stores/search', {
                zip_code: searchInput,
                filters: {
                    radius_miles: parseFloat(selectedRadius),
                    store_type: selectedType || null,
                    open_now: openNowFilter
                }
            });

            if (response.data.results.length === 0) {
                setError("No stores found in this area.");
                setStores([]);
            } else {
                setStores(response.data.results);
                setCenter([response.data.results[0].latitude, response.data.results[0].longitude]);
            }
        } catch (err) {
            setError("Location not recognized. Try a zip code.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen text-black bg-white font-sans">
            <header className="p-4 bg-white shadow-md z-[1001] border-b">
                <form onSubmit={handleSearch} className="flex gap-4 items-end max-w-6xl mx-auto w-full">
                    <div className="flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Location (Zip, City, or State)</label>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="border p-2 rounded bg-gray-50 focus:border-blue-500 outline-none"
                            placeholder="e.g. California or 90210"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Radius</label>
                        <select value={selectedRadius} onChange={(e) => setSelectedRadius(e.target.value)} className="border p-2 rounded text-sm bg-gray-50">
                            <option value="50">50 Miles</option>
                            <option value="250">250 Miles</option>
                            <option value="5000">Nationwide</option>
                        </select>
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded font-bold hover:bg-blue-700 h-[42px]">
                        {loading ? '...' : 'SEARCH'}
                    </button>
                </form>
                {error && <p className="text-center text-red-500 text-xs font-bold mt-2">{error}</p>}
            </header>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 overflow-y-auto p-4 border-r bg-gray-50">
                    {stores.map(store => {
                        const openStatus = getOpenStatus(store);
                        return (
                            <div key={store.store_id} className="mb-4 p-4 bg-white rounded shadow-sm border-l-4 border-blue-500">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-800">{store.name}</h3>
                                    <span className="text-[9px] bg-gray-100 px-2 py-1 rounded font-bold uppercase">{store.store_type}</span>
                                </div>
                                <p className="text-sm text-gray-600">{store.address_street}</p>
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-xs text-blue-600 font-bold">{parseFloat(store.distance).toFixed(1)} miles away</p>
                                    <p className={`text-[10px] font-black ${openStatus.color}`}>{openStatus.status}</p>
                                </div>
                            </div>
                        );
                    })}
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

function RecenterMap({ center }) {
    const map = useMap();
    map.flyTo(center, 12);
    return null;
}

export default LocatorPage;