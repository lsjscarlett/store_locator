import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios';
import L from 'leaflet';

// Fix for default Leaflet icon
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
    map.flyTo(center, 13, { duration: 1.5 });
    return null;
}

const LocatorPage = () => {
    const [zipCode, setZipCode] = useState('');
    const [stores, setStores] = useState([]);
    const [center, setCenter] = useState([40.7128, -74.0060]); // Default NYC

    const handleSearch = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/stores/search', {
                zip_code: zipCode,
                filters: {
                    radius_miles: 5000.0 // Force it to find the store regardless of distance
                }
            });

            const results = response.data.results;
            setStores(results);

            if (results.length > 0) {
                // Set center to the first store found
                setCenter([results[0].latitude, results[0].longitude]);
            } else {
                alert("No stores found within 50 miles of this location.");
            }
        } catch (error) {
            console.error("Search failed:", error);
            alert("Search failed. Check your connection.");
        }
    };

    return (
        <div className="flex flex-col h-screen text-black">
            <header className="p-4 bg-white shadow-md z-[1001] flex justify-between items-center">
                <h1 className="text-xl font-bold text-blue-600">Store Locator</h1>
                <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Zip Code (e.g. 10036)"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className="border p-2 rounded w-48 bg-white text-black"
                    />
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Search</button>
                </form>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 overflow-y-auto p-4 border-r bg-gray-50">
                    {stores.length === 0 ? (
                        <p className="text-gray-500">Search to find stores nearby.</p>
                    ) : (
                        stores.map(store => (
                            <div key={store.store_id} className="mb-4 p-4 bg-white rounded shadow border-l-4 border-blue-500">
                                <h3 className="font-bold text-lg">{store.name}</h3>
                                <p className="text-sm text-gray-600">{store.address_street}</p>
                                <p className="text-xs text-blue-400 mt-2 font-semibold uppercase">{store.store_type}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex-1 relative z-10">
                    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <RecenterMap center={center} />
                        {stores.map(store => (
                            <Marker key={store.store_id} position={[store.latitude, store.longitude]}>
                                <Popup>
                                    <div className="font-sans">
                                        <b className="text-blue-600">{store.name}</b><br/>
                                        {store.address_street}
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