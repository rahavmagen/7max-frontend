import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { useState, useEffect, useRef, useCallback } from 'react';

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return [theme, toggle];
}
import Dashboard from './pages/Dashboard';
import PlayerDetail from './pages/PlayerDetail';
import Upload from './pages/Upload';
import AddPlayer from './pages/AddPlayer';
import Import from './pages/Import';
import AdminReports from './pages/AdminReports';
import BalanceLog from './pages/BalanceLog';
import BalanceReport from './pages/BalanceReport';
import Transfers from './pages/Transfers';
import ClubIncome from './pages/ClubIncome';
import TotalProfit from './pages/TotalProfit';
import Games from './pages/Games';
import GameResults from './pages/GameResults';
import ActivePlayers from './pages/ActivePlayers';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Lesson from './pages/Lesson';
import League from './pages/League';
import ChipBalance from './pages/ChipBalance';
import PlayerValidation from './pages/PlayerValidation';
import AdminExpenses from './pages/AdminExpenses';
import Agents from './pages/Agents';
import AgentPortal from './pages/AgentPortal';
import BringAFriend from './pages/BringAFriend';
import Wheel from './pages/Wheel';
import CreditCompare from './pages/CreditCompare';
import BankBalance from './pages/BankBalance';
import ClubWallets from './pages/ClubWallets';
import TicketAssets from './pages/TicketAssets';
import WhatsAppMessages from './pages/WhatsAppMessages';
import './App.css';

const ACCOUNTING_PATHS = ['/club-income', '/admin-reports', '/chip-balance', '/player-validation', '/admin-expenses', '/credit-compare'];

function AccountingDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const location = useLocation();
  const isActive = ACCOUNTING_PATHS.some(p => location.pathname.startsWith(p));

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="nav-dropdown" ref={ref}>
      <span
        className={`nav-dropdown-trigger${open ? ' open' : ''}${isActive ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        Accounting ▾
      </span>
      {open && (
        <div className="nav-dropdown-menu" onClick={() => setOpen(false)}>
          <NavLink to="/club-income">Club Income</NavLink>
          <NavLink to="/admin-reports">Reports</NavLink>
          <NavLink to="/chip-balance">Balance</NavLink>
          <NavLink to="/player-validation">Validation</NavLink>
          <NavLink to="/admin-expenses">Expenses</NavLink>
          <NavLink to="/credit-compare">Credit Compare</NavLink>
        </div>
      )}
    </div>
  );
}

function PlayerDefaultRedirect({ auth }) {
  const pending = sessionStorage.getItem('redirectAfterLogin');
  if (pending) {
    sessionStorage.removeItem('redirectAfterLogin');
    return <Navigate to={pending} replace />;
  }
  return <Navigate to={auth.playerId ? `/player/${auth.playerId}` : '/games'} replace />;
}

function AppRoutes() {
  const { auth, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();

  if (!auth) {
    const path = window.location.pathname;
    if (path && path !== '/' && !sessionStorage.getItem('redirectAfterLogin')) {
      sessionStorage.setItem('redirectAfterLogin', path);
    }
    return <Login />;
  }
  if (auth.mustChangePassword) return <ChangePassword />;

  const isAdmin = auth.role === 'ADMIN' || auth.role === 'MANAGER';
  const isPlayer = auth.role === 'PLAYER';
  const isAgent = isPlayer && auth.isAgent;

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/7maxlogo.png" alt="7MAX" style={{ height: '36px', verticalAlign: 'middle' }} />
          <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>{auth.username}</span>
        </div>
        <div className="nav-links">
          {isAdmin && (
            <>
              <NavLink to="/" end>Dashboard</NavLink>
              <NavLink to="/upload">Upload Report</NavLink>
              <NavLink to="/games">Games</NavLink>
              <NavLink to="/import">Import Players</NavLink>
              <NavLink to="/add-player">Add Player</NavLink>
              <NavLink to="/bring-a-friend">Bring a Friend</NavLink>
              <NavLink to="/transfers">Transfers</NavLink>
              <NavLink to="/balance-report">התחשבנות</NavLink>
              <NavLink to="/total-profit">Total Profit</NavLink>
              <NavLink to="/bank-balance">Bank Balance</NavLink>
              <NavLink to="/club-wallets">Club Wallets</NavLink>
              <NavLink to="/ticket-assets">Tickets</NavLink>
              <AccountingDropdown />
              <NavLink to="/agents">Agents</NavLink>
              <NavLink to="/lesson">אימון קאש</NavLink>
              <NavLink to="/league">League</NavLink>
              <NavLink to="/wheel">🎡 Wheel</NavLink>
              <NavLink to="/messages">💬 WhatsApp</NavLink>
            </>
          )}
          {isPlayer && (
            <>
              {auth.playerId && <NavLink to={`/player/${auth.playerId}`}>My Profile</NavLink>}
              <NavLink to="/games">Games</NavLink>
              <NavLink to="/active-players">Players</NavLink>
              <NavLink to="/lesson">אימון קאש</NavLink>
              <NavLink to="/league">League</NavLink>
              {isAgent && <NavLink to="/agent-portal">Agents</NavLink>}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={logout}
            style={{
              background: 'none',
              border: '1px solid #334155',
              color: '#94a3b8',
              padding: '4px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            יציאה
          </button>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          {isAdmin && (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/player/:id" element={<PlayerDetail />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/add-player" element={<AddPlayer />} />
              <Route path="/import" element={<Import />} />
              <Route path="/admin-reports" element={<AdminReports />} />
              <Route path="/balance-log" element={<BalanceLog />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/balance-report" element={<BalanceReport />} />
              <Route path="/club-income" element={<ClubIncome />} />
              <Route path="/total-profit" element={<TotalProfit />} />
              <Route path="/bank-balance" element={<BankBalance />} />
              <Route path="/club-wallets" element={<ClubWallets />} />
              <Route path="/ticket-assets" element={<TicketAssets />} />
              <Route path="/messages" element={<WhatsAppMessages />} />
              <Route path="/games" element={<Games />} />
              <Route path="/game-results/:id" element={<GameResults />} />
              <Route path="/chip-balance" element={<ChipBalance />} />
              <Route path="/player-validation" element={<PlayerValidation />} />
              <Route path="/admin-expenses" element={<AdminExpenses />} />
              <Route path="/credit-compare" element={<CreditCompare />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agent-portal" element={<AgentPortal />} />
              <Route path="/bring-a-friend" element={<BringAFriend />} />
              <Route path="/lesson" element={<Lesson />} />
              <Route path="/league" element={<League />} />
              <Route path="/wheel" element={<Wheel />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
          {isPlayer && (
            <>
              <Route path="/player/:id" element={<PlayerDetail />} />
              <Route path="/games" element={<Games />} />
              <Route path="/game-results/:id" element={<GameResults />} />
              <Route path="/active-players" element={<ActivePlayers />} />
              <Route path="/lesson" element={<Lesson />} />
              <Route path="/league" element={<League />} />
              <Route path="/agent-portal" element={<AgentPortal />} />
              <Route path="*" element={<PlayerDefaultRedirect auth={auth} />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
