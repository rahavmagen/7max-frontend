import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'https://7max-tracker-production.up.railway.app/api' });

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
export const getStalePlayers = () => api.get('/players/stale');
export const getPlayer = (id) => api.get(`/players/${id}`);
export const createPlayer = (data) => api.post('/players', data);
export const updatePlayer = (id, data) => api.put(`/players/${id}`, data);
export const updateCredit = (id, delta, notes) => api.patch(`/players/${id}/credit`, { delta, notes });
export const addDeposit = (id, amount, notes) => api.post(`/players/${id}/deposit`, { amount, notes });
export const getPlayerTransactions = (id) => api.get(`/players/${id}/transactions`);
export const getPlayerResults = (id) => api.get(`/reports/player/${id}/results`);
export const addTransaction = (data) => api.post('/transactions', data);
export const uploadReport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post("/reports/upload", form, { validateStatus: s => s < 500 });
};
export const importPlayers = (file, clearExisting) => {
  const form = new FormData();
  form.append('max7', file);
  return api.post(`/import/players?clearExisting=${clearExisting}`, form);
};
export const getReports = () => api.get('/reports');
export const deleteReport = (id) => api.delete(`/reports/${id}`);
export const changePassword = (data) => api.post('/auth/change-password', data);
export const adminResetPassword = (data) => api.post('/auth/admin/reset-password', data);
export const getHandsReport = (params) => api.get('/reports/admin/hands-report', { params });
export const getIncomeReport = (params) => api.get('/reports/admin/income', { params });
export const cleanupHebrewPlayers = () => api.delete('/players/cleanup-hebrew');
export const getProfitSummary = () => api.get('/import/profit-summary');
export const resetAllData = () => api.post('/import/reset-all');
export const getGameSessions = () => api.get('/reports/sessions');
export const getSessionResults = (id) => api.get(`/reports/sessions/${id}/results`);
export const comparePlayersWithXls = (file) => {
  const form = new FormData();
  form.append('max7', file);
  return api.post('/import/compare', form);
};

export default api;
