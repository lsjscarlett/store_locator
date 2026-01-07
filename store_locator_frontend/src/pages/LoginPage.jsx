import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // Note: We map password to 'role' field because of the backend schema quirk
            const response = await api.post('/auth/login', {
                email: email,
                role: password
            });

            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('refresh_token', response.data.refresh_token);

            navigate('/admin');
        } catch (err) {
            console.error(err);
            setError('Invalid email or password.');
        }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-lg shadow-lg w-96 border border-gray-100">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-blue-600">ADMIN PORTAL</h2>
                    <p className="text-xs text-gray-400 mt-1 uppercase font-bold">Authorized Personnel Only</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold p-3 rounded mb-4 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Email Address</label>
                        <input
                            type="email"
                            placeholder="admin@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            required
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white py-3 rounded font-bold text-sm hover:bg-blue-700 transition-colors mt-2">
                        SECURE LOGIN
                    </button>
                </form>

                <button onClick={() => navigate('/')} className="w-full text-center text-xs text-gray-400 mt-6 hover:text-blue-600 font-bold transition-colors">
                    &larr; Return to Public Site
                </button>
            </div>
        </div>
    );
};

export default LoginPage;