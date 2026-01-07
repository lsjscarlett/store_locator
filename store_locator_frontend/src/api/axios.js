import axios from 'axios';

// 1. Create Instance
const api = axios.create({
    // ENSURE THIS URL MATCHES YOUR BACKEND RAILWAY URL EXACTLY
    baseURL: 'https://storelocatorbackend-production.up.railway.app/api',
    headers: { 'Content-Type': 'application/json' }
});

// 2. Request Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 3. Response Interceptor: Refresh Token Logic
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Check if error is 401 (Unauthorized) and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) throw new Error("No refresh token");

                // Call Backend to get new Access Token
                const res = await axios.post('https://storelocatorbackend-production.up.railway.app/api/auth/refresh', {
                    refresh_token: refreshToken
                });

                // Save new token
                localStorage.setItem('token', res.data.access_token);

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
                return api(originalRequest);

            } catch (refreshError) {
                // If refresh fails, logout
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;