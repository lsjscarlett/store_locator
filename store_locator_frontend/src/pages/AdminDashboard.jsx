import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('stores');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const LIMIT = 10;

    // CSV Upload
    const [uploading, setUploading] = useState(false);

    // Modals
    const [showUserModal, setShowUserModal] = useState(false);
    const [showStoreModal, setShowStoreModal] = useState(false);

    // Form States
    const [newUser, setNewUser] = useState({ email: '', password: '', role_id: 2 });
    const [newStore, setNewStore] = useState({
        store_id: '',
        name: '',
        store_type: 'regular',
        address_street: '',
        address_city: '',
        address_state: '',
        address_postal_code: '',
        phone: '',
        services: '', // Comma separated string for input
        status: 'active'
    });

    const navigate = useNavigate();

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
            if (activeTab === 'users') {
                const res = await api.get('/admin/users');
                setItems(res.data);
            } else {
                const res = await api.post('/stores/search', {
                    page: page,
                    limit: LIMIT,
                    filters: { radius_miles: 5000, store_type: null }
                });
                setItems(res.data.results);
                setTotalPages(Math.ceil(res.data.total / LIMIT));
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure? This cannot be undone.")) return;
        try {
            const endpoint = activeTab === 'stores' ? `/admin/stores/${id}` : `/admin/users/${id}`;
            await api.delete(endpoint);
            fetchData();
        } catch (err) {
            alert("Failed to delete. Check permissions.");
        }
    };

    const handleCSVUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post('/admin/stores/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("Import Successful!");
            fetchData();
        } catch (err) {
            alert("Import Failed. Check CSV format.");
        } finally {
            setUploading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/users', {
                email: newUser.email,
                password: newUser.password,
                role_id: parseInt(newUser.role_id),
                is_active: true
            });
            setShowUserModal(false);
            setNewUser({ email: '', password: '', role_id: 2 });
            fetchData();
        } catch (err) {
            alert("Failed to create user. Email might exist.");
        }
    };

    const handleCreateStore = async (e) => {
        e.preventDefault();
        try {
            // Convert comma-separated services string to array
            const servicesArray = newStore.services.split(',').map(s => s.trim()).filter(s => s !== '');

            await api.post('/admin/stores', {
                ...newStore,
                services: servicesArray
            });

            setShowStoreModal(false);
            // Reset form
            setNewStore({
                store_id: '', name: '', store_type: 'regular',
                address_street: '', address_city: '', address_state: '', address_postal_code: '',
                phone: '', services: '', status: 'active'
            });
            fetchData();
            alert("Store Created Successfully!");
        } catch (err) {
            alert("Failed to create store. Store ID might already exist.");
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
                {/* Controls */}
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

                    <div className="flex gap-2">
                        {activeTab === 'stores' ? (
                            <>
                                <button
                                    onClick={() => setShowStoreModal(true)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700 transition"
                                >
                                    + Create Store
                                </button>
                                <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-green-700 transition flex items-center">
                                    {uploading ? 'Uploading...' : 'Import CSV'}
                                    <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" disabled={uploading} />
                                </label>
                            </>
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

                {/* Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400 text-sm font-bold animate-pulse">Loading Data...</div>
                    ) : (
                        <>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-400 border-b border-gray-100">
                                    <tr>
                                        <th className="p-4 text-[10px] uppercase font-bold tracking-wider">{activeTab === 'stores' ? 'Name / ID' : 'Email'}</th>
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
                            {/* Pagination Controls */}
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

            {/* MODALS */}

            {/* 1. CREATE USER MODAL */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                        <h2 className="text-lg font-black text-gray-800 mb-4">Create New User</h2>
                        <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                            <input
                                type="email" placeholder="Email" required
                                className="p-2 border rounded text-sm w-full"
                                value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                            />
                            <input
                                type="password" placeholder="Password" required
                                className="p-2 border rounded text-sm w-full"
                                value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                            />
                            <select
                                className="p-2 border rounded text-sm bg-white w-full"
                                value={newUser.role_id}
                                onChange={e => setNewUser({...newUser, role_id: e.target.value})}
                            >
                                <option value="1">Admin</option>
                                <option value="2">Marketer</option>
                                <option value="3">Viewer</option>
                            </select>
                            <div className="flex gap-2 mt-2">
                                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 p-2 bg-gray-200 rounded font-bold text-xs">Cancel</button>
                                <button type="submit" className="flex-1 p-2 bg-blue-600 text-white rounded font-bold text-xs">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. CREATE STORE MODAL */}
            {showStoreModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-black text-gray-800 mb-4">Add New Store</h2>
                        <form onSubmit={handleCreateStore} className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Store ID (e.g. S1001)</label>
                                    <input required type="text" className="p-2 border rounded text-sm w-full"
                                        value={newStore.store_id} onChange={e => setNewStore({...newStore, store_id: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Store Type</label>
                                    <select className="p-2 border rounded text-sm w-full bg-white"
                                        value={newStore.store_type} onChange={e => setNewStore({...newStore, store_type: e.target.value})}>
                                        <option value="regular">Regular</option>
                                        <option value="flagship">Flagship</option>
                                        <option value="express">Express</option>
                                        <option value="outlet">Outlet</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Store Name</label>
                                <input required type="text" className="p-2 border rounded text-sm w-full"
                                    value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value})} />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Street Address</label>
                                <input required type="text" className="p-2 border rounded text-sm w-full"
                                    value={newStore.address_street} onChange={e => setNewStore({...newStore, address_street: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">City</label>
                                    <input required type="text" className="p-2 border rounded text-sm w-full"
                                        value={newStore.address_city} onChange={e => setNewStore({...newStore, address_city: e.target.value})} />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">State</label>
                                    <input required type="text" className="p-2 border rounded text-sm w-full" placeholder="e.g. NY"
                                        value={newStore.address_state} onChange={e => setNewStore({...newStore, address_state: e.target.value})} />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Zip</label>
                                    <input required type="text" className="p-2 border rounded text-sm w-full"
                                        value={newStore.address_postal_code} onChange={e => setNewStore({...newStore, address_postal_code: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Phone (Optional)</label>
                                    <input type="text" className="p-2 border rounded text-sm w-full"
                                        value={newStore.phone} onChange={e => setNewStore({...newStore, phone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Status</label>
                                    <select className="p-2 border rounded text-sm w-full bg-white"
                                        value={newStore.status} onChange={e => setNewStore({...newStore, status: e.target.value})}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Services (Comma Separated)</label>
                                <input type="text" placeholder="WiFi, Parking, Wheelchair Access" className="p-2 border rounded text-sm w-full"
                                    value={newStore.services} onChange={e => setNewStore({...newStore, services: e.target.value})} />
                            </div>

                            <div className="flex gap-2 mt-4 pt-4 border-t">
                                <button type="button" onClick={() => setShowStoreModal(false)} className="flex-1 p-2 bg-gray-200 rounded font-bold text-xs">Cancel</button>
                                <button type="submit" className="flex-1 p-2 bg-blue-600 text-white rounded font-bold text-xs">Create Store</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;