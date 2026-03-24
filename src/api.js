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
export const getActivePlayers = () => api.get('/players/active');
export const getLoginStats = (id) => api.get(`/players/${id}/login-stats`);
export const getStalePlayers = () => api.get('/players/stale');
export const getPlayer = (id) => api.get(`/players/${id}`);
export const createPlayer = (data) => api.post('/players', data);
export const updatePlayer = (id, data) => api.put(`/players/${id}`, data);
export const updateCredit = (id, delta, notes) => api.patch(`/players/${id}/credit`, { delta, notes });
export const setPlayerBalance = (id, balance, notes) => api.patch(`/players/${id}/balance`, { balance, notes });
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
export const changeUserRole = (username, role) => api.post('/auth/admin/change-role', { username, role });
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

export const createTransfer = (data) => api.post('/transfers', data);
export const createSettlement = (data) => api.post('/transfers/settlement', data);
export const getPendingTransfers = () => api.get('/transfers/pending');
export const getAllPending = () => api.get('/transfers/all-pending');
export const confirmTransfer = (id) => api.post(`/transfers/${id}/confirm`);
export const confirmTransaction = (id) => api.post(`/transactions/${id}/confirm`);
export const updateTransfer = (id, data) => api.put(`/transfers/${id}`, data);
export const getLastNightMtt = (date) => api.get('/transfers/last-night-mtt', { params: { date } });
export const getRecentTransactions = (days) => api.get('/transactions/recent', { params: { days } });
export const updateTransaction = (id, data) => api.put(`/transactions/${id}`, data);

export const getLessonEvent = () => api.get('/lesson/event');
export const setLessonEvent = (data) => api.post('/lesson/event', data);
export const getLessonRegistrations = () => api.get('/lesson/registrations');
export const registerLesson = (data) => api.post('/lesson/register', data);
export const unregisterLesson = () => api.delete('/lesson/register');
export const getMyPlayerInfo = () => api.get('/lesson/my-player');

export default api;
