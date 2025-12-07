
import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/';

const api = axios.create({
  baseURL,
  timeout: 30000,
});

export { baseURL }; // Export for use in other files like image.js

// Attach Authorization header and Tenant Context
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  config.headers = config.headers || {};
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Send the current window host as the tenant domain identifier
  config.headers['X-Tenant-Domain'] = window.location.host;
  
  return config;
});

// Centralized response error handling: dispatch a window event so UI can show toasts
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    try {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Unknown error';
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } }));
      if (status === 401) {
        // Clear auth and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event("auth-change"));
        window.location.href = '/login';
      }
    } catch (e) {
      console.error('Error in response interceptor', e);
    }
    return Promise.reject(err);
  }
);

// Upload helper that callers can use to pass onUploadProgress
export function upload(url, formData, { onUploadProgress, headers = {}, ...opts } = {}) {
  const cfg = {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...headers,
    },
    onUploadProgress,
    ...opts,
  };
  return api.post(url, formData, cfg);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }
  window.dispatchEvent(new Event("auth-change"));
}

export default api;
