import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/superadmin', // Adjust if backend runs on different port
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('super_admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Send context
    config.headers['X-Tenant-Domain'] = window.location.host;
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
