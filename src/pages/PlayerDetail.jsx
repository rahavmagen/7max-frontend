import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlayer, getActivePlayers, getPlayerTransactions, getPlayerResults, adminResetPassword, getLoginStats, changeUserRole, updatePlayer, setPlayerBalance, renamePlayerUsername, deletePlayer, updatePaymentMethods, getAgents, setPlayerAgent, getPlayerNameHistory, getPlayerRakeback, addPlayerRakeback, updatePlayerRakeback, deletePlayerRakeback } from '../api';

const RB_GAME_TYPES = ['NLH', 'PLO', 'PLO5', 'PLO6', 'MTT', 'SNG', 'AoF', 'SPIN_GOLD'];
import { useAuth } from '../auth/AuthContext';
import { getTransactionLabel } from '../utils/transactionLabel';
import DateInput from '../components/DateInput';
import { fmtDateTime } from '../utils/dates';

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'MANAGER';
  const [player, setPlayer] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState('results');
  const [showResetPass, setShowResetPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  // Per-game-type rakeback deals
  const [rakebackDeals, setRakebackDeals] = useState([]);
  const [newDealType, setNewDealType] = useState('NLH');
  const [newDealPct, setNewDealPct] = useState('');
  const [newDealDate, setNewDealDate] = useState('');
  const loadDeals = () => getPlayerRakeback(id).then(r => setRakebackDeals(r.data || [])).catch(() => {});
  useEffect(() => { loadDeals(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  const addDeal = async () => {
    if (!newDealType || newDealPct === '' || newDealPct == null) return;
    await addPlayerRakeback(id, {
      gameType: newDealType,
      percentage: parseFloat((Number(newDealPct) / 100).toFixed(4)),
      startDate: newDealDate || null,
    });
    setNewDealPct(''); setNewDealDate('');
    loadDeals();
  };
  const removeDeal = async (dealId) => { await deletePlayerRakeback(id, dealId); loadDeals(); };
  const [editDealId, setEditDealId] = useState(null);
  const [editDeal, setEditDeal] = useState({ gameType: 'NLH', pct: '', startDate: '' });
  const startEditDeal = (d) => { setEditDealId(d.id); setEditDeal({ gameType: d.gameType, pct: Math.round(d.percentage * 100), startDate: d.startDate || '' }); };
  const cancelEditDeal = () => { setEditDealId(null); };
  const saveEditDeal = async (dealId) => {
    if (editDeal.pct === '' || editDeal.pct == null) return;
    await updatePlayerRakeback(id, dealId, {
      gameType: editDeal.gameType,
      percentage: parseFloat((Number(editDeal.pct) / 100).toFixed(4)),
      startDate: editDeal.startDate || null,
    });
    setEditDealId(null);
    loadDeals();
  };
  const [showNewPass, setShowNewPass] = useState(false);
  const [loginStats, setLoginStats] = useState(null);
  const [nameHistory, setNameHistory] = useState([]);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editData, setEditData] = useState({});
  const [agents, setAgents] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showSetBalance, setShowSetBalance] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [balanceNotes, setBalanceNotes] = useState('');
  const [msg, setMsg] = useState(null);
  const defaultDateFrom = !isAdmin
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
    : '';
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState('');
  const [resultsSort, setResultsSort] = useState({ col: 'date', dir: -1 });

  const load = () => {
    setLoadError(false);
    getPlayer(id).then(r => setPlayer(r.data)).catch(() => setLoadError(true));
    getPlayerTransactions(id).then(r => setTransactions(r.data)).catch(() => {});
    getPlayerResults(id).then(r => setResults(r.data)).catch(() => {});
    if (isAdmin) getLoginStats(id).then(r => setLoginStats(r.data)).catch(() => {});
    if (isAdmin) getPlayerNameHistory(id).then(r => setNameHistory(r.data || [])).catch(() => {});
    if (isAdmin) getAgents().then(r => setAgents(r.data || [])).catch(() => {});
    getActivePlayers().then(r => setAllPlayers(r.data || [])).catch(() => {});
  };

  useEffect(() => { load(); }, [id]);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '₪' + abs;
  };

  const balanceClass = (b) => b > 0 ? 'positive' : b < 0 ? 'negative' : 'zero';




  const handleChangeRole = async (e) => {
    e.preventDefault();
    try {
      await changeUserRole(player.username, newRole);
      setMsg({ type: 'success', text: `Role changed to ${newRole} for ${player.username}` });
      setShowRoleForm(false);
      setNewRole('');
    } catch {
      setMsg({ type: 'error', text: 'Failed to change role' });
    }
  };

  const handleEditInfo = async (e) => {
    e.preventDefault();
    try {
      const usernameChanged = editUsername.trim() && editUsername.trim() !== player.username;
      if (usernameChanged) {
        const renamed = await renamePlayerUsername(id, editUsername.trim());
        setPlayer(p => ({ ...p, username: renamed.data.username }));
      }
      await updatePlayer(id, {
        ...player,
        fullName: editName,
        phone: editPhone,
        isAgent: editData.isAgent,
        agentRakePercentage: editData.isAgent && editData.agentRakePercentage !== ''
          ? parseFloat((Number(editData.agentRakePercentage) / 100).toFixed(4))
          : null,
        // Rakeback is now managed as per-game-type deals via separate endpoints, not here.
        seeRakeback: editData.seeRakeback || false,
        satelliteBacked: editData.satelliteBacked || false,
        satelliteBackedSince: editData.satelliteBackedSince || null,
      });
      const originalAgentId = player.agentId || '';
      if (String(editData.agentId) !== String(originalAgentId)) {
        await setPlayerAgent(id, editData.agentId || null);
      }
      setPlayer(p => ({ ...p, fullName: editName, phone: editPhone }));
      setMsg({ type: 'success', text: 'פרטי השחקן עודכנו' });
      setShowEditInfo(false);
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'שגיאה בעדכון הפרטים' });
    }
  };

  const handleSetBalance = async (e) => {
    e.preventDefault();
    try {
      const updated = await setPlayerBalance(id, parseFloat(newBalance), balanceNotes);
      setPlayer(updated.data);
      setMsg({ type: 'success', text: `Balance updated to ${fmt(parseFloat(newBalance))}` });
      setShowSetBalance(false);
      setNewBalance('');
      setBalanceNotes('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update balance' });
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await adminResetPassword({ username: player.username, newPassword: newPass });
      setMsg({ type: 'success', text: `הסיסמא של ${player.username} אופסה בהצלחה` });
      setShowResetPass(false);
      setNewPass('');
    } catch {
      setMsg({ type: 'error', text: 'שגיאה באיפוס הסיסמא' });
    }
  };

  const handleDeletePlayer = async () => {
    if (!window.confirm(`Delete player "${player.username}" and ALL their data (transactions, game results, transfers)? This cannot be undone.`)) return;
    try {
      await deletePlayer(id);
      navigate('/');
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete player' });
    }
  };

  if (loadError) return <div style={{ padding: '2rem', color: '#ef4444' }}>Could not load player data. Please try again.</div>;
  if (!player) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  const gameTypes = [...new Set(results.filter(r => r.session?.gameType).map(r => r.session.gameType))].sort();

  const filteredResults = (() => {
    let list = results.filter(r => {
      if (!r.session) return false;
      if (!r.session?.startTime) return false;
      const d = r.session.startTime.substring(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (gameTypeFilter && r.session.gameType !== gameTypeFilter) return false;
      return true;
    });
    const isTournament = (r) => r.session && ['MTT', 'SNG', 'AoF', 'SPIN_GOLD'].includes(r.session.gameType);
    const getPnl = (r) => isTournament(r) ? ((r.resultAmount || 0) - (r.buyIn || 0)) : (r.resultAmount || 0);
    list = [...list].sort((a, b) => {
      const { col, dir } = resultsSort;
      if (col === 'date') return (a.session?.startTime || '').localeCompare(b.session?.startTime || '') * dir;
      if (col === 'table') return (a.session?.tableName || '').localeCompare(b.session?.tableName || '') * dir;
      if (col === 'game') return (a.session?.gameType || '').localeCompare(b.session?.gameType || '') * dir;
      if (col === 'buyin') return ((a.buyIn || 0) - (b.buyIn || 0)) * dir;
      if (col === 'prize') return ((a.resultAmount || 0) - (b.resultAmount || 0)) * dir;
      if (col === 'hands') return ((a.handsPlayed || 0) - (b.handsPlayed || 0)) * dir;
      if (col === 'rake') return ((a.rakePaid || 0) - (b.rakePaid || 0)) * dir;
      if (col === 'pnl') return (getPnl(a) - getPnl(b)) * dir;
      return 0;
    });
    return list;
  })();

  const toggleResultsSort = (col) => setResultsSort(s => s.col === col ? { col, dir: s.dir * -1 } : { col, dir: -1 });
  const sortArrow = (col) => resultsSort.col === col ? (resultsSort.dir === 1 ? ' ↑' : ' ↓') : ' ↕';
  const thSort = (col, label, style = {}) => (
    <th onClick={() => toggleResultsSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}>
      {label}<span style={{ opacity: 0.45, fontSize: '0.75em' }}>{sortArrow(col)}</span>
    </th>
  );

  const totalPnl = filteredResults.reduce((s, r) => {
    const isTournament = r.session && ['MTT', 'SNG', 'AoF', 'SPIN_GOLD'].includes(r.session.gameType);
    return s + (isTournament ? ((r.resultAmount || 0) - (r.buyIn || 0)) : (r.resultAmount || 0));
  }, 0);
  const totalHands = filteredResults.reduce((s, r) => s + (r.handsPlayed || 0), 0);
  const totalRake = filteredResults.reduce((s, r) => s + (r.rakePaid || 0), 0);

  const playerSearchResults = isAdmin && playerSearch.length >= 1
    ? allPlayers
        .filter(p => String(p.id) !== String(id))
        .filter(p =>
          p.username.toLowerCase().includes(playerSearch.toLowerCase()) ||
          (p.fullName && p.fullName.toLowerCase().includes(playerSearch.toLowerCase()))
        )
        .slice(0, 8)
    : [];

  const shabbatRake = results.reduce((s, r) => {
    if (!r.session?.startTime) return s;
    const dt = new Date(r.session.startTime);
    const day = dt.getDay();
    const hour = dt.getHours();
    const isShabbat = (day === 5 && hour >= 18) || day === 6; // Friday 18:00+ or Saturday
    return isShabbat ? s + (r.rakePaid || 0) : s;
  }, 0);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isAdmin && <button className="back-btn" onClick={() => navigate('/')}>← Back to Dashboard</button>}
          {isAdmin && (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Jump to player..."
                value={playerSearch}
                onChange={e => { setPlayerSearch(e.target.value); setShowPlayerDropdown(true); }}
                onFocus={() => { if (playerSearch) setShowPlayerDropdown(true); }}
                onBlur={() => setTimeout(() => setShowPlayerDropdown(false), 150)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #2d3148', background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', width: '200px' }}
              />
              {showPlayerDropdown && playerSearch && playerSearchResults.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#1e293b', border: '1px solid #2d3148', borderRadius: '6px', zIndex: 100, minWidth: '220px', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {playerSearchResults.map(p => (
                    <div key={p.id}
                      onMouseDown={() => { navigate(`/player/${p.id}`); setPlayerSearch(''); setShowPlayerDropdown(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #2d3148', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600 }}>{p.username}</span>
                      {p.fullName && <span style={{ color: '#94a3b8', marginLeft: '8px', fontSize: '0.8rem' }}>{p.fullName}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href="/takanon.docx" download className="btn btn-secondary" style={{ textDecoration: 'none' }}>📄 תקנון המועדון</a>
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={() => { setShowEditInfo(!showEditInfo); setEditName(player.fullName || ''); setEditPhone(player.phone || ''); setEditUsername(player.username || ''); setEditData({ isAgent: player.isAgent || false, agentRakePercentage: player.agentRakePercentage != null ? Math.round(player.agentRakePercentage * 100) : '', agentId: player.agentId || '', rakebackPercentage: player.rakebackPercentage != null ? Math.round(player.rakebackPercentage * 100) : '', rakebackSince: player.rakebackSince || '', seeRakeback: player.seeRakeback || false, satelliteBacked: player.satelliteBacked || false, satelliteBackedSince: player.satelliteBackedSince || '' }); }}>
                ✏️ Edit Info
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowSetBalance(!showSetBalance); setNewBalance(player.balance != null ? player.balance : ''); setBalanceNotes(''); }}>
                ⚖️ Set Balance
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowResetPass(!showResetPass); setNewPass(''); }}>
                🔑 Reset Pass
              </button>
              {auth?.role === 'ADMIN' && (
                <>
                  <button className="btn btn-secondary" onClick={() => { setShowRoleForm(!showRoleForm); setNewRole(''); }}>
                    👑 Change Role
                  </button>
                  <button className="btn btn-danger" onClick={handleDeletePlayer}>
                    🗑️ Delete Player
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showResetPass && isAdmin && (
        <div className="card">
          <h2>איפוס סיסמא — {player.username}</h2>
          <form onSubmit={handleResetPassword}>
            <div className="form-row">
              <div className="form-group">
                <label>סיסמא חדשה</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    placeholder="לפחות 4 תווים"
                    style={{ paddingRight: '2.5rem', width: '100%', boxSizing: 'border-box' }}
                  />
                  <button type="button" onClick={() => setShowNewPass(v => !v)}
                    style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                    {showNewPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-success">אפס סיסמא</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowResetPass(false)}>ביטול</button>
            </div>
          </form>
        </div>
      )}

      {showRoleForm && auth?.role === 'ADMIN' && (
        <div className="card">
          <h2>Change Role — {player.username}</h2>
          <form onSubmit={handleChangeRole}>
            <div className="form-row">
              <div className="form-group">
                <label>New Role</label>
                <select required value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="">Select role...</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="PLAYER">PLAYER</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-success" disabled={!newRole}>Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowRoleForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}



      {showEditInfo && isAdmin && (
        <div className="card">
          <h2>עריכת פרטים — {player.username}</h2>
          <form onSubmit={handleEditInfo}>
            <div className="form-row">
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} placeholder="Username" />
              </div>
              <div className="form-group">
                <label>שם מלא</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="שם מלא" />
              </div>
              <div className="form-group">
                <label>טלפון</label>
                <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="מספר טלפון" />
              </div>
            </div>
            {isAdmin && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '1rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editData.isAgent || false}
                      onChange={e => setEditData(d => ({ ...d, isAgent: e.target.checked }))}
                    />
                    <span>This player is an agent</span>
                  </label>
                </div>
                {editData.isAgent && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '4px' }}>
                      Agent rake %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={editData.agentRakePercentage}
                      onChange={e => setEditData(d => ({ ...d, agentRakePercentage: e.target.value }))}
                      style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #2d3148', background: '#0f172a', color: '#e2e8f0' }}
                    />
                    <span style={{ marginLeft: '4px', color: '#94a3b8' }}>%</span>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '4px' }}>
                    Assigned agent
                  </label>
                  <select
                    value={editData.agentId || ''}
                    onChange={e => setEditData(d => ({ ...d, agentId: e.target.value }))}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #2d3148', background: '#0f172a', color: '#e2e8f0' }}
                  >
                    <option value="">None</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.username}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 600 }}>Rakeback deals (per game type)</div>
                  {rakebackDeals.length === 0 && (
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>No deals yet.</div>
                  )}
                  {rakebackDeals.map(d => (
                    editDealId === d.id ? (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <select value={editDeal.gameType} onChange={e => setEditDeal(s => ({ ...s, gameType: e.target.value }))}
                          style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #2d3148', background: '#0f172a', color: '#e2e8f0' }}>
                          {RB_GAME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="number" min="0" max="100" step="1" value={editDeal.pct}
                          onChange={e => setEditDeal(s => ({ ...s, pct: e.target.value }))}
                          style={{ width: '60px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #2d3148', background: '#0f172a', color: '#e2e8f0' }} />
                        <span style={{ color: '#94a3b8' }}>%</span>
                        <DateInput value={editDeal.startDate} onChange={v => setEditDeal(s => ({ ...s, startDate: v }))} />
                        <button type="button" onClick={() => saveEditDeal(d.id)}
                          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Save</button>
                        <button type="button" onClick={cancelEditDeal}
                          style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #2d3148', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                      </div>
                    ) : (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                        <span style={{ background: '#1e293b', border: '1px solid #334155', padding: '1px 8px', borderRadius: '10px', color: '#a5b4fc', fontSize: '0.8rem' }}>{d.gameType}</span>
                        <span style={{ color: '#34d399', fontWeight: 600 }}>{Math.round(d.percentage * 100)}%</span>
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>since {d.startDate || '—'}</span>
                        <button type="button" onClick={() => startEditDeal(d)}
                          style={{ marginLeft: '0.5rem', background: 'transparent', color: '#a5b4fc', border: '1px solid #334155', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>✎ Edit</button>
                        <button type="button" onClick={() => removeDeal(d.id)}
                          style={{ background: 'transparent', color: '#fca5a5', border: '1px solid #7f1d1d', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                      </div>
                    )
                  ))}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>Game type</label>
                      <select value={newDealType} onChange={e => setNewDealType(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #2d3148', background: '#0f172a', color: '#e2e8f0' }}>
                        {RB_GAME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>%</label>
                      <input type="number" min="0" max="100" step="1" value={newDealPct}
                        onChange={e => setNewDealPct(e.target.value)} placeholder="0"
                        style={{ width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #2d3148', background: '#0f172a', color: '#e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>Start date</label>
                      <DateInput value={newDealDate} onChange={setNewDealDate} />
                    </div>
                    <button type="button" onClick={addDeal}
                      style={{ background: 'var(--accent, #eab308)', color: '#0f172a', border: 'none', borderRadius: '4px', padding: '6px 16px', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={editData.seeRakeback || false}
                      onChange={e => setEditData(d => ({ ...d, seeRakeback: e.target.checked }))}
                    />
                    <span>Player can see their own rakeback</span>
                  </label>
                </div>
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 600 }}>Satellite Backing (PROTOTYPE)</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={editData.satelliteBacked || false}
                      onChange={e => setEditData(d => ({ ...d, satelliteBacked: e.target.checked }))}
                    />
                    <span>Club backs this player's satellites</span>
                  </label>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '4px' }}>
                      Backed since
                    </label>
                    <DateInput
                      value={editData.satelliteBackedSince}
                      onChange={v => setEditData(d => ({ ...d, satelliteBackedSince: v }))}
                    />
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-success">שמור</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditInfo(false)}>ביטול</button>
            </div>
          </form>
        </div>
      )}

      {showSetBalance && isAdmin && (
        <div className="card" style={{ borderTop: '2px solid #ef4444' }}>
          <h2>⚖️ Set Balance — {player.username}</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Current balance: <strong className={balanceClass(player.balance)}>{fmt(player.balance)}</strong>. This directly overwrites the balance (use only to fix errors).
          </p>
          <form onSubmit={handleSetBalance}>
            <div className="form-row">
              <div className="form-group">
                <label>New Balance (₪)</label>
                <input type="number" step="0.01" required value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="e.g. -1500" />
              </div>
              <div className="form-group">
                <label>Reason / Notes</label>
                <input type="text" value={balanceNotes} onChange={e => setBalanceNotes(e.target.value)} placeholder="Why are you adjusting?" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-danger">Set Balance</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSetBalance(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {msg && (
        <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}


      <div className="player-balance-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderTopColor: '#4a5568' }}>
          <h2>Player Info</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div>
              <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>USERNAME</div>
              <div style={{ fontWeight: 600 }}>{player.username}</div>
            </div>
            <div>
              <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>FULL NAME</div>
              <div>{player.fullName || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>PHONE</div>
              <div>{player.phone || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>CLUB ID</div>
              <div style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{player.clubPlayerId || '—'}</div>
            </div>
            {isAdmin && nameHistory.length > 0 && (
              <div>
                <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>PREVIOUS NAMES</div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  {nameHistory.map(h => (
                    <div key={h.id} title={h.source || ''}>
                      {h.oldUsername} <span style={{ color: '#475569' }}>→ {h.newUsername}</span>
                      <span style={{ color: '#64748b', marginLeft: '0.4rem', fontSize: '0.75rem' }}>{fmtDateTime(h.changedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(() => {
              const agentName = player.agentId
                ? (allPlayers.find(p => Number(p.id) === Number(player.agentId))?.username || `#${player.agentId}`)
                : null;
              return agentName ? (
                <div>
                  <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>AGENT</div>
                  <div style={{ color: '#34d399' }}>{agentName}</div>
                </div>
              ) : null;
            })()}
            {player.isAgent && (
              <div>
                <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>ROLE</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ background: '#7c3aed', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.5px' }}>AGENT</span>
                  {player.clubManaged && <span style={{ background: '#14532d', color: '#4ade80', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px' }}>club-managed</span>}
                </div>
              </div>
            )}
            {rakebackDeals.length > 0 && (isAdmin || player.seeRakeback) && (
              <div>
                <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>RAKEBACK</div>
                {rakebackDeals.map(d => (
                  <div key={d.id} style={{ color: '#34d399' }}>
                    <span style={{ color: '#a5b4fc' }}>{d.gameType}</span> {Math.round(d.percentage * 100)}%
                    {d.startDate && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.4rem' }}>since {d.startDate}</span>}
                  </div>
                ))}
              </div>
            )}
            {isAdmin && loginStats && (
              <div>
                <div style={{ color: '#7a8499', fontSize: '0.72rem', letterSpacing: '1.1px' }}>SITE LOGINS</div>
                <div style={{ color: '#94a3b8' }}>
                  {loginStats.loginCount || 0} times
                  {loginStats.lastLoginAt && (
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: '#64748b' }}>
                      (last: {fmtDateTime(loginStats.lastLoginAt)})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderTopColor: player.balance > 0 ? '#22c55e' : player.balance < 0 ? '#ef4444' : '#64748b' }}>
          <div style={{ color: '#7a8499', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1.2px' }}>Current Balance</div>
          <div className={balanceClass(player.balance)} style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', fontWeight: 700, margin: '0.5rem 0' }}>
            {fmt(player.balance)}
          </div>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#7a8499', fontSize: '0.7rem', letterSpacing: '1px' }}>CURRENT CHIPS{player.chipsAsOf ? ` · ${player.chipsAsOf} 00:00` : ''}</div>
              <div style={{ fontWeight: 600 }}>{fmt(player.currentChips)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#7a8499', fontSize: '0.7rem', letterSpacing: '1px' }}>CREDIT GIVEN</div>
              <div style={{ fontWeight: 600, color: player.creditTotal > 0 ? '#f59e0b' : '#94a3b8' }}>{fmt(player.creditTotal)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Payment Methods</h2>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'bit',          label: 'Bit',            field: 'bitEnabled'          },
            { key: 'paybox',       label: 'Paybox',         field: 'payboxEnabled'       },
            { key: 'kashcash',     label: 'Kashcash',       field: 'kashcashEnabled'     },
            { key: 'bankTransfer', label: 'Bank Transfer',  field: 'bankTransferEnabled' },
          ].map(({ key, label, field }) => {
            const enabled = player[field] === true;
            return (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={async () => {
                    const updated = { ...player, [field]: !enabled };
                    setPlayer(updated);
                    try {
                      await updatePaymentMethods(id, { [key]: !enabled });
                    } catch {
                      setPlayer(p => ({ ...p, [field]: enabled }));
                      setMsg({ type: 'error', text: 'Failed to update payment method' });
                    }
                  }}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.9rem' }}>
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #2d3148', paddingBottom: '1rem', flexWrap: 'wrap' }}>
          {['transactions', 'results'].map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(t)}>
              {t === 'transactions'
                ? `Transactions${transactions.length ? ` (${transactions.length})` : ''}`
                : `Game Results${filteredResults.length ? ` (${filteredResults.length})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'transactions' && (
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Method</th>
                <th>By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => {
                const isTransfer = t.sourceRef && (t.sourceRef.startsWith('TRANSFER:') || t.sourceRef.startsWith('SETTLEMENT:') || t.sourceRef.startsWith('PAYMENT:'));
                const isOutgoing = isTransfer && t.notes && /^(Payment to|Transfer to|Settlement payment to)/i.test(t.notes);
                const isIncoming = isTransfer && t.notes && /^(Received from|Cashout from|Transfer from|Settlement received from)/i.test(t.notes);
                const amountClass = isTransfer
                  ? (isOutgoing ? 'negative' : isIncoming ? 'positive' : (t.type === 'DEPOSIT' || t.type === 'PAYMENT' ? 'positive' : 'negative'))
                  : (t.type === 'DEPOSIT' || t.type === 'PAYMENT' ? 'positive' : 'negative');
                const isNegative = isOutgoing || t.type === 'WITHDRAWAL';
                const displayAmount = isNegative ? fmt(-t.amount) : fmt(t.amount);
                return (
                <tr key={t.id}>
                  <td>{t.createdAt ? fmtDateTime(t.createdAt) : t.transactionDate || '—'}</td>
                  <td>
                    <span className={`badge ${t.type === 'DEPOSIT' ? 'deposit' : t.type === 'CREDIT' ? 'credit' : t.type === 'PAYMENT' ? 'payment' : 'withdrawal'}`}>
                      {getTransactionLabel(t.type, t.sourceRef)}
                    </span>
                  </td>
                  <td className={amountClass}>{displayAmount}</td>
                  <td>{t.method || '—'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{t.createdByUsername || '—'}</td>
                  <td style={{ color: '#64748b' }}>{t.notes || '—'}</td>
                </tr>
                );
              })}
            </tbody>
          </table></div>
        )}

        {tab === 'results' && (
          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ color: '#64748b', fontSize: '0.85rem' }}>From:</label>
              <DateInput value={dateFrom} onChange={setDateFrom} />
              <label style={{ color: '#64748b', fontSize: '0.85rem' }}>To:</label>
              <DateInput value={dateTo} onChange={setDateTo} />
              {(dateFrom || dateTo || gameTypeFilter) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setGameTypeFilter(''); }}
                  style={{ background: 'none', border: '1px solid #2d3148', color: '#94a3b8', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Clear
                </button>
              )}
            </div>
            {gameTypes.length > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button onClick={() => setGameTypeFilter('')}
                  style={{ background: gameTypeFilter === '' ? '#6366f1' : '#1a1d2e', border: '1px solid #2d3148', color: gameTypeFilter === '' ? '#fff' : '#94a3b8', padding: '3px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem' }}>
                  All
                </button>
                {gameTypes.map(gt => (
                  <button key={gt} onClick={() => setGameTypeFilter(gt === gameTypeFilter ? '' : gt)}
                    style={{ background: gameTypeFilter === gt ? '#6366f1' : '#1a1d2e', border: '1px solid #2d3148', color: gameTypeFilter === gt ? '#fff' : '#94a3b8', padding: '3px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    {gt}
                  </button>
                ))}
              </div>
            )}
            {filteredResults.length > 0 && (
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#1a1d2e', borderRadius: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Sessions: <strong style={{ color: '#e2e8f0' }}>{filteredResults.length}</strong>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Total Hands: <strong style={{ color: '#e2e8f0' }}>{totalHands}</strong>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Total: <strong className={balanceClass(totalPnl)}>{fmt(totalPnl)}</strong>
                </span>
                {(isAdmin || player.seeRakeback) && (
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    Total Rake: <strong style={{ color: '#f59e0b' }}>{fmt(totalRake)}</strong>
                  </span>
                )}
                {(isAdmin || player.seeRakeback) && (
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    ריק שבת: <strong style={{ color: '#a5b4fc' }}>{fmt(shabbatRake)}</strong>
                  </span>
                )}
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Current Balance{player.chipsAsOf ? ` · ${player.chipsAsOf} 00:00` : ''}: <strong className={balanceClass(player.balance)}>{fmt(player.balance)}</strong>
                </span>
              </div>
            )}
            <div className="table-wrap"><table>
              <thead>
                <tr>
                  {thSort('date', 'Date')}
                  {thSort('table', 'Table')}
                  {thSort('game', 'Game')}
                  {thSort('buyin', 'Buy-in')}
                  {thSort('prize', 'Prize')}
                  {thSort('hands', 'Hands')}
                  {(isAdmin || player.seeRakeback) && thSort('rake', 'Rake', { color: '#f59e0b' })}
                  {thSort('pnl', 'Profit / Loss')}
                  {isAdmin && player.satelliteBacked && <th style={{ whiteSpace: 'nowrap', color: '#4ade80' }}>Sat. Balance Effect (PROTOTYPE)</th>}
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(r => {
                  const isTournament = r.session && ['MTT', 'SNG', 'AoF', 'SPIN_GOLD'].includes(r.session.gameType);
                  const displayCashout = isTournament ? (r.resultAmount || 0) : (r.cashout || 0);
                  const pnl = isTournament ? ((r.resultAmount || 0) - (r.buyIn || 0)) : (r.resultAmount || 0);
                  // TEMP PROTOTYPE - satellite backing preview, not final. Remove before merging.
                  // Signed like agent balances: + = club owes player (loss reimbursed), - = player owes club (win claimed back).
                  const backedSince = player.satelliteBackedSince;
                  const sessionDate = r.session && r.session.startTime ? r.session.startTime.substring(0, 10) : null;
                  const afterBackedSince = !backedSince || (sessionDate && sessionDate >= backedSince);
                  const isSatellite = player.satelliteBacked && afterBackedSince
                    && r.session && r.session.gameType === 'MTT' && (r.buyIn || 0) > 0 && (r.buyIn || 0) < 100;
                  const satSplit = isSatellite ? (pnl > 0 ? -(pnl / 2) : -pnl) : null;
                  return (
                  <tr key={r.id}
                    onClick={() => r.session && navigate(`/game-results/${r.session.id}`, { state: { session: r.session } })}
                    style={{ cursor: r.session ? 'pointer' : 'default' }}
                    className={r.session ? 'hoverable-row' : ''}
                  >
                    <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {r.session && r.session.startTime ? fmtDateTime(r.session.startTime) : '-'}
                    </td>
                    <td dir="rtl" style={{ textAlign: 'right' }}>{r.session ? r.session.tableName : '-'}</td>
                    <td><span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{r.session ? r.session.gameType : '-'}</span></td>
                    <td style={{ color: '#ef4444', whiteSpace: 'nowrap' }}>{fmt(-(r.buyIn || 0))}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(displayCashout)}</td>
                    <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{r.handsPlayed}</td>
                    {(isAdmin || player.seeRakeback) && <td style={{ color: '#f59e0b', whiteSpace: 'nowrap' }}>{fmt(r.rakePaid)}</td>}
                    <td style={{ whiteSpace: 'nowrap' }} className={balanceClass(pnl)}><strong>{fmt(pnl)}</strong></td>
                    {isAdmin && player.satelliteBacked && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isSatellite
                          ? (satSplit === 0
                              ? <span style={{ color: '#64748b' }}>₪0</span>
                              : <strong style={{ color: satSplit > 0 ? '#4ade80' : '#ef4444' }}>{fmt(satSplit)}</strong>)
                          : <span style={{ color: '#475569' }}>n/a</span>}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        )}

        {((tab === 'transactions' && transactions.length === 0) ||
          (tab === 'results' && filteredResults.length === 0)) && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No records found</div>
        )}
      </div>
    </div>
  );
}
