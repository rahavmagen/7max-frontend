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
export const deletePlayer = (id) => api.delete(`/players/${id}`);
export const updateCredit = (id, delta, notes, noChipChange = false) => api.patch(`/players/${id}/credit`, { delta, notes, noChipChange });
export const setPlayerBalance = (id, balance, notes) => api.patch(`/players/${id}/balance`, { balance, notes });
export const renamePlayerUsername = (id, username) => api.patch(`/players/${id}/username`, { username });
export const addDeposit = (id, amount, notes) => api.post(`/players/${id}/deposit`, { amount, notes });
export const getPlayerTransactions = (id) => api.get(`/players/${id}/transactions`);
export const getPlayerResults = (id) => api.get(`/reports/player/${id}/results`);
export const addTransaction = (data) => api.post('/transactions', data);
export const uploadReport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post("/reports/upload", form, { validateStatus: s => s < 500 });
};
export const uploadExpensesOnly = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/import/expenses-only', form, { validateStatus: s => s < 500 });
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
export const getFridayRakeReport = () => api.get('/reports/admin/friday-rake');
export const backfillChipsTotal = () => api.post('/reports/admin/backfill-chips-total');
export const getChipBalance = (since) => api.get('/reports/admin/chip-balance', { params: since ? { since } : {} });
export const getPlayerValidation = (since) => api.get('/reports/admin/player-validation', { params: since ? { since } : {} });
export const addWheelExpense = (id, amount, notes) => api.post(`/players/${id}/wheel-expense`, { amount, notes });
export const getIncomeReport = (params) => api.get('/reports/admin/income', { params });
export const cleanupHebrewPlayers = () => api.delete('/players/cleanup-hebrew');
export const getProfitSummary = () => api.get('/import/profit-summary');
export const getBalanceSheet = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return api.get('/reports/balance-sheet', { params });
};
export const resetAllData = () => api.post('/import/wipe');
export const getGameSessions = () => api.get('/reports/sessions');
export const getSessionResults = (id) => api.get(`/reports/sessions/${id}/results`);
export const comparePlayersWithXls = (file) => {
  const form = new FormData();
  form.append('max7', file);
  return api.post('/import/compare', form);
};

export const getBankAccounts = () => api.get('/bank-accounts');
export const createBankAccount = (data) => api.post('/bank-accounts', data);
export const updateBankAccount = (id, data) => api.put(`/bank-accounts/${id}`, data);
export const deleteBankAccount = (id) => api.delete(`/bank-accounts/${id}`);
export const createTransfer = (data) => api.post('/transfers', data);
export const createSettlement = (data) => api.post('/transfers/settlement', data);
export const getPendingTransfers = () => api.get('/transfers/pending');
export const getAllPending = () => api.get('/transfers/all-pending');
export const confirmTransfer = (id) => api.post(`/transfers/${id}/confirm`);
export const confirmTransaction = (id) => api.post(`/transactions/${id}/confirm`);
export const updateTransfer = (id, data) => api.put(`/transfers/${id}`, data);
export const getLastNightMtt = (date) => api.get('/transfers/last-night-mtt', { params: { date } });
export const getRecentTransactions = (days) => api.get('/transactions/recent', { params: { days } });
export const getTransactionRange = (from, to) => api.get('/transactions/range', { params: { from, to } });
export const updateTransaction = (id, data) => api.put(`/transactions/${id}`, data);

export const getAdminExpenses = () => api.get('/admin-expenses');
export const getAdminUsers = () => api.get('/admin-expenses/admin-users');
export const createAdminExpense = (data) => api.post('/admin-expenses', data);
export const updateAdminExpense = (id, data) => api.put(`/admin-expenses/${id}`, data);
export const deleteAdminExpense = (id) => api.delete(`/admin-expenses/${id}`);
export const getPromotions = () => api.get('/transactions/promotions');

export const createReferral = (data) => api.post('/referrals', data);
export const getReferrals = () => api.get('/referrals');
export const deleteReferral = (id) => api.delete(`/referrals/${id}`);

export const getLessonEvent = () => api.get('/lesson/event');
export const setLessonEvent = (data) => api.post('/lesson/event', data);
export const getLessonRegistrations = () => api.get('/lesson/registrations');
export const registerLesson = (data) => api.post('/lesson/register', data);
export const unregisterLesson = () => api.delete('/lesson/register');
export const getMyPlayerInfo = () => api.get('/lesson/my-player');

export const getClubExpenses = () => api.get('/club-expenses');
export const createClubExpense = (data) => api.post('/club-expenses', data);
export const settleClubExpense = (id, data) => api.patch(`/club-expenses/${id}/settle`, data);
export const updateClubExpense = (id, data) => api.put(`/club-expenses/${id}`, data);
export const deleteClubExpense = (id) => api.delete(`/club-expenses/${id}`);
export const settleAdminExpense = (id, data) => api.patch(`/admin-expenses/${id}/settle`, data);

export default api;
