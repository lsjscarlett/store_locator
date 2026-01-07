import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('stores'); // 'stores' or 'users'
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const LIMIT = 10;

    // CSV Upload State
    const [uploading, setUploading] = useState(false);

    // Create User Modal State
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', role_id: 2 }); // Default to Marketer

    const navigate = useNavigate();

    // Check Auth & Fetch Data
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        fetchData();
    }, [activeTab, page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            if (activeTab === 'users') {
                // Fetch Users (No pagination for now, usually list is small)
                const res = await api.get('/admin/users', { headers });
                setItems(res.data);
            } else {
                // Fetch Stores with Pagination
                // We use the search endpoint to "List All" by setting radius to Nationwide (5000)
                const res = await api.post('/stores/search', {
                    page: page,
                    limit: LIMIT,
                    filters: { radius_miles: 5000, store_type: null }
                });
                setItems(res.data.results);
                // Calculate total pages based on total results
                setTotalPages(Math.ceil(res.data.total / LIMIT));
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure? This cannot be undone.")) return;
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const endpoint = activeTab === 'stores' ? `/admin/stores/${id}` : `/admin/users/${id}`;

            await api.delete(endpoint, { headers });

            // Refresh Data
            fetchData();
        } catch (err) {
            alert("Failed to delete. You might not have permission.");
        }
    };

    const handleCSVUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            await api.post('/admin/stores/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            alert("Import Successful!");
            fetchData(); // Refresh list
        } catch (err) {
            alert("Import Failed. Check CSV format.");
        } finally {
            setUploading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await api.post('/admin/users', {
                email: newUser.email,
                password: newUser.password,
                role_id: parseInt(newUser.role_id),
                is_active: true
            }, { headers: { Authorization: `Bearer ${token}` } });

            setShowUserModal(false);
            setNewUser({ email: '', password: '', role_id: 2 });
            fetchData();
        } catch (err) {
            alert("Failed to create user. Email might exist.");
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 text-black font-sans">
            {/* Navbar */}
            <nav className="bg-white shadow border-b p-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 w-8 h-8 rounded flex items-center justify-center text-white font-black text-xs">AD</div>
                    <h1 className="text-lg font-black text-gray-800 tracking-tight">ADMIN DASHBOARD</h1>
                </div>
                <div className="flex gap-4 items-center">
                    <button onClick={() => navigate('/')} className="text-xs font-bold text-gray-400 hover:text-blue-600 uppercase">View Site</button>
                    <div className="h-4 w-px bg-gray-200"></div>
                    <button onClick={handleLogout} className="text-xs font-bold text-red-500 hover:text-red-700 uppercase">Logout</button>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto p-6">
                {/* Controls Header */}
                <div className="flex justify-between items-end mb-6">
                    <div className="flex gap-6 border-b border-gray-200">
                        <button
                            onClick={() => { setActiveTab('stores'); setPage(1); }}
                            className={`pb-3 text-xs font-black uppercase tracking-wide border-b-2 transition-colors ${activeTab === 'stores' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent'}`}
                        >
                            Manage Stores
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`pb-3 text-xs font-black uppercase tracking-wide border-b-2 transition-colors ${activeTab === 'users' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent'}`}
                        >
                            Manage Users
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        {activeTab === 'stores' ? (
                            <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-green-700 transition">
                                {uploading ? 'Uploading...' : 'Import CSV'}
                                <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" disabled={uploading} />
                            </label>
                        ) : (
                            <button
                                onClick={() => setShowUserModal(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700 transition"
                            >
                                + Create User
                            </button>
                        )}
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400 text-sm font-bold animate-pulse">Loading Data...</div>
                    ) : (
                        <>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-400 border-b border-gray-100">
                                    <tr>
                                        <th className="p-4 text-[10px] uppercase font-bold tracking-wider">{activeTab === 'stores' ? 'Store Name / ID' : 'Email Address'}</th>
                                        <th className="p-4 text-[10px] uppercase font-bold tracking-wider">{activeTab === 'stores' ? 'Location' : 'Role'}</th>
                                        <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Status</th>
                                        <th className="p-4 text-[10px] uppercase font-bold tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((item) => (
                                        <tr key={item.store_id || item.id} className="hover:bg-blue-50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-800">{item.name || item.email}</div>
                                                {item.store_id && <div className="text-xs text-gray-400 font-mono mt-0.5">{item.store_id}</div>}
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                {activeTab === 'stores' ? (
                                                    <>{item.address_city}, {item.address_state}</>
                                                ) : (
                                                    // Simple Role Display logic
                                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold uppercase text-gray-500">
                                                        {item.role_id === 1 ? 'Admin' : item.role_id === 2 ? 'Marketer' : 'Viewer'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${
                                                    (item.status === 'active' || item.is_active) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {item.status || (item.is_active ? 'Active' : 'Inactive')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleDelete(item.store_id || item.id)} className="text-red-400 hover:text-red-600 font-bold text-[10px] uppercase">
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination Controls (Only for Stores) */}
                            {activeTab === 'stores' && totalPages > 1 && (
                                <div className="p-4 border-t flex justify-between items-center bg-gray-50">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="px-3 py-1 bg-white border rounded text-xs font-bold disabled:opacity-50"
                                    >
                                        PREV
                                    </button>
                                    <span className="text-xs font-bold text-gray-500">Page {page} of {totalPages}</span>
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1 bg-white border rounded text-xs font-bold disabled:opacity-50"
                                    >
                                        NEXT
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* CREATE USER MODAL */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                        <h2 className="text-lg font-black text-gray-800 mb-4">Create New User</h2>
                        <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                            <input
                                type="email" placeholder="Email" required
                                className="p-2 border rounded text-sm"
                                value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                            />
                            <input
                                type="password" placeholder="Password" required
                                className="p-2 border rounded text-sm"
                                value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                            />
                            <select
                                className="p-2 border rounded