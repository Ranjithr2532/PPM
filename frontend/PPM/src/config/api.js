import axios from 'axios';
import { message } from 'antd';

// Central API configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://172.18.7.91:5001';

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

axios.interceptors.response.use(
    (response) => response,
    (error) => {
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
