import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const TOKEN_KEY = 'fa_token';

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Build an authenticated file URL usable directly in <img src>.
export const fileUrl = (id) => {
  if (!id) return null;
  const token = localStorage.getItem(TOKEN_KEY) || '';
  return `${API}/files/${id}?auth=${encodeURIComponent(token)}`;
};

export const apiError = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.detail || err?.message || fallback;
