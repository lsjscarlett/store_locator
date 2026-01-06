import { createContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [loading, setLoading] = useState(false);

    const login = async (email, password) => {
        setLoading(true);
        try {
            // Note: Backend schema uses 'role' for password input
            const response = await api.post("/auth/login", {
                email: email,
                role: password
            });
            const { access_token } = response.data;

            setToken(access_token);
            localStorage.setItem("token", access_token);
            setUser({ email });
            return true;
        } catch (error) {
            console.error("Login failed:", error.response?.data || error.message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
    };

    // Keep user logged in on refresh
    useEffect(() => {
        if (token) {
            // Optional: You could fetch user profile here from backend
            setUser({ email: "admin@test.com" });
        }
    }, [token]);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;