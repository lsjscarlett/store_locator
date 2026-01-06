import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const AdminDashboard = () => {
    const { logout } = useContext(AuthContext);
    const [file, setFile] = useState(null);
    const [stores, setStores] = useState([]);
    const [message, setMessage] = useState('');

    // Fetch stores to show in a list
    const fetchStores = async () => {
        try {
            // We use the search endpoint with a wide radius to list everything for the admin
            const res = await api.post('/stores/search', {
                zip_code: "10001",
                filters: { radius_miles: 5000 }
            });
            setStores(res.data.results);
        } catch (err) {
            console.error("Failed to fetch stores");
        }
    };

    useEffect(() => { fetchStores(); }, []);

    const handleImport = async (e) => {
        e.preventDefault();
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/admin/stores/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage(`Success! Created: ${res.data.stats.created}, Errors: ${res.data.stats.errors}`);
            fetchStores(); // Refresh list
        } catch (err) {
            setMessage("Import failed. Check CSV format.");
        }
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
                <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
            </div>

            {/* CSV Import Section */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">Import Stores (CSV)</h2>
                <form onSubmit={handleImport} className="flex items-center gap-4">
                    <input
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="border p-2 rounded w-full"
                        accept=".csv"
                    />
                    <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded font-bold">Upload</button>
                </form>
                {message && <p className="mt-4 text-blue-600 font-medium">{message}</p>}
            </div>

            {/* Store List Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 border-b">
                        <tr>
                            <th className="p-4">Store Name</th>
                            <th className="p-4">Location</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stores.map(store => (
                            <tr key={store.store_id} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-medium">{store.name}</td>
                                <td className="p-4 text-gray-600">{store.address_city}, {store.address_state}</td>
                                <td className="p-4 italic">{store.store_type}</td>
                                <td className="p-4">
                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminDashboard;