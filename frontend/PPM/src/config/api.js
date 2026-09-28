import axios from 'axios';
import { message } from 'antd';

// Central API configuration

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://172.18.100.55:8000';


const ACCESS_TOKEN_KEY = 'token';
const CURRENT_USER_KEY = 'ppm_user';

/**
 * Token and User Helper Utilities
 */
export function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
}

export function setAccessToken(token) {
    if (token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        delete axios.defaults.headers.common['Authorization'];
    }
}

export function removeAccessToken() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
}

export function getCurrentUser() {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setCurrentUser(user) {
    if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(CURRENT_USER_KEY);
    }
}

export function logout() {
    removeAccessToken();
    localStorage.removeItem(CURRENT_USER_KEY);
}

/**
 * Authenticated Fetch Wrapper Method
 */
export async function authFetch(path, options = {}) {
    const token = getAccessToken();
    if (!token && !path.includes('/login') && !path.includes('/auth/')) {
        throw new Error('Please log in before making API requests.');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const fullUrl = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

    const response = await fetch(fullUrl, {
        ...options,
        headers,
    });

    return response;
}

let lastSecurityToastTime = 0;

export function getSecurityErrorMessage(status, defaultMessage = 'An error occurred') {
    if (status === 401) {
        return 'Session expired for security purposes. Please re-authorize / log in again to continue.';
    }
    return defaultMessage;
}

export function notifySecurity401(customMsg) {
    const now = Date.now();
    if (now - lastSecurityToastTime > 4000) {
        lastSecurityToastTime = now;
        const text = customMsg || 'Session expired for security purposes. Please re-authorize / log in again to continue.';
        if (typeof message !== 'undefined' && message.error) {
            message.error({
                content: text,
                key: 'security_401_error',
                duration: 5,
            });
        }
    }
}

// Initial setup of axios default headers on load
const initialToken = getAccessToken();
if (initialToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

// Global Axios Interceptor: Automatically attach JWT Access Token & handle 401 security errors
axios.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response && error.response.status === 401 && originalRequest && !originalRequest._retry) {
            const requestUrl = originalRequest.url || '';
            if (requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers = originalRequest.headers || {};
                        originalRequest.headers['Authorization'] = `Bearer ${token}`;
                        return axios(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshRes = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
                const newToken = refreshRes.data?.access_token;
                if (newToken) {
                    setAccessToken(newToken);
                    processQueue(null, newToken);
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                    return axios(originalRequest);
                }
            } catch (refreshErr) {
                processQueue(refreshErr, null);
                logout();
                const secMsg = getSecurityErrorMessage(401);
                notifySecurity401(secMsg);
                return Promise.reject(refreshErr);
            } finally {
                isRefreshing = false;
            }
        }

        if (error.response && error.response.status === 401) {
            const secMsg = getSecurityErrorMessage(401);
            error.message = secMsg;
            notifySecurity401(secMsg);
        }
        return Promise.reject(error);
    }
);

// Global Fetch Interceptor: Automatically attach JWT Access Token & handle 401 security errors
if (typeof window !== 'undefined' && window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = async function (resource, config = {}) {
        const token = getAccessToken();
        if (token) {
            const headers = new Headers(config.headers || {});
            if (!headers.has('Authorization')) {
                headers.set('Authorization', `Bearer ${token}`);
            }
            config = { ...config, headers };
        }
        const response = await originalFetch(resource, config);
        if (response.status === 401) {
            const secMsg = getSecurityErrorMessage(401);
            notifySecurity401(secMsg);
        }
        return response;
    };
}
