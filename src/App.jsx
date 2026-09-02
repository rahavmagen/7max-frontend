import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LanguageProvider, useLang } from './i18n';
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
import Rakeback from './pages/Rakeback';
import BalanceLog from './pages/BalanceLog';
import BalanceReport from './pages/BalanceReport';
import Transfers from './pages/Transfers';
import ClubIncome from './pages/ClubIncome';
import TotalProfit from './pages/TotalProfit';
import PnL from './pages/PnL';
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
import XlsCompare from './pages/XlsCompare';
import ClubWallets from './pages/ClubWallets';
import TicketAssets from './pages/TicketAssets';
import WhatsAppMessages from './pages/WhatsAppMessages';
import Deposit from './pages/Deposit';
import OpenRequests from './pages/OpenRequests';
import JoinRequest from './pages/JoinRequest';
import InactivePlayers from './pages/InactivePlayers';
import InactivePlayersBalance from './pages/InactivePlayersBalance';
import Horses from './pages/Horses';
import LiveTickets from './pages/LiveTickets';
import PlayerStats from './pages/PlayerStats';
import Privacy from './pages/Privacy';
import { getPendingKashcashDeposits, getPendingJoinRequests } from './api';
import './App.css';

const UTILS_PATHS = ['/admin-reports', '/rakeback', '/chip-balance', '/player-validation', '/tools', '/player-stats', '/inactive-players-balance', '/balance-report', '/upload', '/add-player'];

function UtilsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const location = useLocation();
  const isActive = UTILS_PATHS.some(p => location.pathname.startsWith(p));

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
        Utils ▾
      </span>
      {open && (
        <div className="nav-dropdown-menu" onClick={() => setOpen(false)}>
          <NavLink to="/admin-reports">Reports</NavLink>
          <NavLink to="/rakeback">Rakeback</NavLink>
          <NavLink to="/chip-balance">Balance</NavLink>
          <NavLink to="/player-validation">Validation</NavLink>
          <NavLink to="/tools">Tools</NavLink>
          <NavLink to="/upload">Upload Report</NavLink>
          <NavLink to="/add-player">Add Player</NavLink>
          <NavLink to="/player-stats">Player Stats</NavLink>
          <NavLink to="/inactive-players-balance">Inactive Players Balance</NavLink>
          <NavLink to="/balance-report">התחשבנות</NavLink>
        </div>
      )}
    </div>
  );
}

const ACCOUNTING_PATHS = ['/total-profit', '/pnl', '/club-income', '/admin-expenses', '/club-wallets', '/agents', '/horses', '/live-tickets'];

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
          <NavLink to="/total-profit">Balance Sheet</NavLink>
          <NavLink to="/pnl">P&amp;L</NavLink>
          <NavLink to="/club-income">Club Income</NavLink>
          <NavLink to="/admin-expenses">Club Expenses</NavLink>
          <NavLink to="/club-wallets">Club Wallets</NavLink>
          <NavLink to="/agents">Agents</NavLink>
          <NavLink to="/horses">🐎 Horses</NavLink>
          <NavLink to="/live-tickets">🎟 כרטיסים ללייב</NavLink>
        </div>
      )}
    </div>
  );
}

const UNUSED_PATHS = ['/bring-a-friend', '/import', '/lesson', '/league', '/ticket-assets'];

function UnusedDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const location = useLocation();
  const isActive = UNUSED_PATHS.some(p => location.pathname.startsWith(p));

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
        Unused ▾
      </span>
      {open && (
        <div className="nav-dropdown-menu" onClick={() => setOpen(false)}>
          <NavLink to="/bring-a-friend">Bring a Friend</NavLink>
          <NavLink to="/import">Import Players</NavLink>
          <NavLink to="/league">League</NavLink>
          <NavLink to="/ticket-assets">Tickets</NavLink>
        </div>
      )}
    </div>
  );
}

const KASHCASH_PATHS = ['/deposit', '/open-requests'];

function KashcashDropdown({ pending }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const location = useLocation();
  const isActive = KASHCASH_PATHS.some(p => location.pathname.startsWith(p));

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
        style={{ position: 'relative' }}
      >
        Deposit ▾
        {pending > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -10,
            background: '#3b82f6', color: '#fff',
            borderRadius: '50%', fontSize: '0.65rem', fontWeight: 700,
            minWidth: 16, height: 16, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>{pending}</span>
        )}
      </span>
      {open && (
        <div className="nav-dropdown-menu" onClick={() => setOpen(false)}>
          <NavLink to="/deposit">Deposit</NavLink>
          <NavLink to="/open-requests" style={{ position: 'relative' }}>
            Open Requests
            {pending > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -14,
                background: '#3b82f6', color: '#fff',
                borderRadius: '50%', fontSize: '0.65rem', fontWeight: 700,
                minWidth: 16, height: 16, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{pending}</span>
            )}
          </NavLink>
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
  return <Navigate to="/deposit" replace />;
}

function AppRoutes() {
  const { auth, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const { lang, toggleLang, t } = useLang();
  const navigate = useNavigate();
  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('redirectAfterLogin');
    logout();
    navigate('/', { replace: true });   // start fresh so re-login lands on the default page
  }, [logout, navigate]);
  const [kashcashPending, setKashcashPending] = useState(0);

  useEffect(() => {
    if (!auth || (auth.role !== 'ADMIN' && auth.role !== 'MANAGER')) return;
    const fetchPending = () =>
      Promise.all([
        getPendingKashcashDeposits().then(r => r.data.length).catch(() => 0),
        getPendingJoinRequests().then(r => r.data.length).catch(() => 0),
      ]).then(([kash, join]) => setKashcashPending(kash + join));
    fetchPending();
    const timer = setInterval(fetchPending, 30000);
    return () => clearInterval(timer);
  }, [auth]);

  if (!auth) {
    if (window.location.pathname === '/join') return <JoinRequest />;
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
  const isWorker = isPlayer && auth.isWorker;   // player who also gets the Wheel

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
              {auth.playerId && <NavLink to={`/player/${auth.playerId}`}>My Profile</NavLink>}
              <NavLink to="/games">Games</NavLink>
              <NavLink to="/transfers">Transfers</NavLink>
              <AccountingDropdown />
              <UtilsDropdown />
              <NavLink to="/inactive-players">Inactive Players</NavLink>
              <NavLink to="/wheel">🎡 Wheel</NavLink>
              <NavLink to="/messages">💬 WhatsApp</NavLink>
              <KashcashDropdown pending={kashcashPending} />
              <UnusedDropdown />
            </>
          )}
          {isPlayer && (
            <>
              <NavLink to="/deposit">{t('deposit')}</NavLink>
              {auth.playerId && <NavLink to={`/player/${auth.playerId}`}>{t('myProfile')}</NavLink>}
              <NavLink to="/active-players">{t('players')}</NavLink>
              <NavLink to="/games">{t('games')}</NavLink>
              <NavLink to="/league">{t('league')}</NavLink>
              {isAgent && <NavLink to="/agent-portal">{t('agents')}</NavLink>}
              {isWorker && <NavLink to="/wheel">🎡 Wheel</NavLink>}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="theme-toggle" onClick={toggleLang} title="Change language / שנה שפה" style={{ fontWeight: 700, fontSize: '0.8rem' }}>
            {lang === 'he' ? 'EN' : 'עב'}
          </button>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={handleLogout}
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
              <Route path="/rakeback" element={<Rakeback />} />
              <Route path="/balance-log" element={<BalanceLog />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/balance-report" element={<BalanceReport />} />
              <Route path="/club-income" element={<ClubIncome />} />
              <Route path="/total-profit" element={<TotalProfit />} />
              <Route path="/pnl" element={<PnL />} />
              <Route path="/club-wallets" element={<ClubWallets />} />
              <Route path="/ticket-assets" element={<TicketAssets />} />
              <Route path="/messages" element={<WhatsAppMessages />} />
              <Route path="/games" element={<Games />} />
              <Route path="/game-results/:id" element={<GameResults />} />
              <Route path="/chip-balance" element={<ChipBalance />} />
              <Route path="/player-validation" element={<PlayerValidation />} />
              <Route path="/admin-expenses" element={<AdminExpenses />} />
              <Route path="/tools" element={<XlsCompare />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agent-portal" element={<AgentPortal />} />
              <Route path="/bring-a-friend" element={<BringAFriend />} />
              <Route path="/lesson" element={<Lesson />} />
              <Route path="/league" element={<League />} />
              <Route path="/wheel" element={<Wheel />} />
              <Route path="/open-requests" element={<OpenRequests />} />
              <Route path="/player-stats" element={<PlayerStats />} />
              <Route path="/inactive-players" element={<InactivePlayers />} />
              <Route path="/inactive-players-balance" element={<InactivePlayersBalance />} />
              <Route path="/horses" element={<Horses />} />
              <Route path="/live-tickets" element={<LiveTickets />} />
              <Route path="/deposit" element={<Deposit />} />
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
              <Route path="/deposit" element={<Deposit />} />
              {isWorker && <Route path="/wheel" element={<Wheel />} />}
              <Route path="*" element={<PlayerDefaultRedirect auth={auth} />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  if (window.location.pathname === '/privacy') return <Privacy />;

  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}
