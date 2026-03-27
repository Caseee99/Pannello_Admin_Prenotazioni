import axios from 'axios';

const PRODUCTION_API_URL = 'https://pannello-admin-prenotazioni.onrender.com/api';

const api = axios.create({
    baseURL: PRODUCTION_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

console.log('--- API Client Initialized with URL:', PRODUCTION_API_URL);

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, token ? '(Token present)' : '(No token)');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => {
        console.log(`[API Response] SUCCESS ${response.config.url}`, response.data);
        return response;
    },
    (error) => {
        console.error(`[API Error] FAILED ${error.config?.url}:`, error.response?.status, error.response?.data || error.message);
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('agencyName');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
