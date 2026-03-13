import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api' });

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const stored = localStorage.getItem('auth');
  if (stored) {
    const { token } = JSON.parse(stored);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getPlayers = () => api.get('/players');
export const getPlayer = (id) => api.get(`/players/${id}`);
export const createPlayer = (data) => api.post('/players', data);
export const updatePlayer = (id, data) => api.put(`/players/${id}`, data);
export const getPlayerTransactions = (id) => api.get(`/players/${id}/transactions`);
export const getPlayerResults = (id) => api.get(`/reports/player/${id}/results`);
export const addTransaction = (data) => api.post('/transactions', data);
export const uploadReport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/reports/upload', form);
};
export const getReports = () => api.get('/reports');
export const changePassword = (data) => api.post('/auth/change-password', data);
export const adminResetPassword = (data) => api.post('/auth/admin/reset-password', data);
export const getHandsReport = (params) => api.get('/reports/admin/hands-report', { params });
