import axios from 'axios';

const PRODUCTION_URL = 'https://pannello-admin-prenotazioni.onrender.com';
const API_URL = import.meta.env.VITE_API_URL || PRODUCTION_URL;

const api = axios.create({
    baseURL: API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

console.log('--- API Client Initialized with URL:', API_URL);

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
        return response;
    },
    async (error) => {
        const { config } = error;
        
        // Se non c'è config o abbiamo superato i 2 tentativi, falliamo definitivamente
        if (!config || (config._retryCount || 0) >= 2) {
            console.error(`[API Error] FAILED (Final) ${config?.url}:`, error.response?.status, error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                localStorage.removeItem('agencyName');
                if (!config.url?.includes('/auth/login')) {
                    window.location.href = '/login';
                }
            }
            return Promise.reject(error);
        }

        // Incrementa il contatore dei tentativi
        config._retryCount = (config._retryCount || 0) + 1;
        console.warn(`[API Retry] Tentativo ${config._retryCount} per ${config.url}`);

        // Attesa prima di riprovare (backoff esponenziale: 1s, 2s)
        await new Promise(resolve => setTimeout(resolve, config._retryCount * 1000));
        
        return api(config);
    }
);

export default api;
