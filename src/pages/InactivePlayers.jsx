import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getInactivePlayers, handleInactivePlayer, getInactiveReportConfig, saveInactiveReportConfig, getInactiveOutreachHistory, assignInactivePlayer, getAdminUsers, sendWhatsAppMessage } from '../api';
import DateInput from '../components/DateInput';

// TEST MODE: redirect all "Send WhatsApp" messages from this page to this number instead of the
// player's real phone, so the feature can be tried safely. Set to null to send to real numbers.
const TEST_REDIRECT_PHONE = null;

const GAME_TYPES = ['', 'NLH', 'PLO', 'PLO4', 'PLO5', 'PLO6', 'MTT', 'SNG', 'AoF', 'SPIN_GOLD'];
const GAME_TYPE_LABELS = { '': 'All Types', NLH: 'NLH (Cash)', PLO: 'PLO', PLO4: 'PLO4', PLO5: 'PLO5', PLO6: 'PLO6', MTT: 'MTT', SNG: 'SNG', AoF: 'AoF', SPIN_GOLD: 'Spin Gold' };

const inputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '6px 10px',
  fontSize: '0.9rem',
  width: 90,
};

export default function InactivePlayers() {
  const [recentDays, setRecentDays] = useState('7');
  const [lookbackDays, setLookbackDays] = useState('30');
  const [minSessions, setMinSessions] = useState('10');
  const [cooldownDays, setCooldownDays] = useState('7');
  const [gameType, setGameType] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [assigningId, setAssigningId] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [criteriaMsg, setCriteriaMsg] = useState(null);
  const [handlingPlayer, setHandlingPlayer] = useState(null);  // row currently getting a note, in the modal
  const [noteText, setNoteText] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [messagingPlayer, setMessagingPlayer] = useState(null);  // row currently getting a WhatsApp message
  const [messageText, setMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [messageResult, setMessageResult] = useState(null);

  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await getInactiveOutreachHistory({ from: historyFrom || undefined, to: historyTo || undefined });
      setHistory(res.data);
    } catch {
      setHistoryError('Failed to load history');
    }
    setHistoryLoading(false);
  };

  // Load the full (unfiltered) history once when the page opens.
  useEffect(() => {
    getInactiveOutreachHistory({}).then(res => setHistory(res.data)).catch(() => setHistoryError('Failed to load history'));
  }, []);

  useEffect(() => {
    getAdminUsers().then(res => setAdminUsers(res.data || [])).catch(() => {});
  }, []);

  // Prefill the boxes from the saved weekly criteria so the page reflects what the weekly job uses.
  useEffect(() => {
    getInactiveReportConfig().then(res => {
      const c = res.data || {};
      if (c.recentDays != null) setRecentDays(String(c.recentDays));
      if (c.lookbackDays != null) setLookbackDays(String(c.lookbackDays));
      if (c.minSessions != null) setMinSessions(String(c.minSessions));
      if (c.cooldownDays != null) setCooldownDays(String(c.cooldownDays));
      if (c.gameType != null) setGameType(c.gameType);
    }).catch(() => {});
  }, []);

  const currentParams = () => ({
    recentDays: parseInt(recentDays) || 7,
    lookbackDays: parseInt(lookbackDays) || 30,
    minSessions: parseInt(minSessions) || 1,
    cooldownDays: parseInt(cooldownDays) || 0,
    gameType: gameType || undefined,
    assignedTo: assignedToFilter || undefined,
  });

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInactivePlayers(currentParams());
      setResults(res.data);
    } catch {
      setError('Failed to load report');
    }
    setLoading(false);
  };

  const handleSaveCriteria = async () => {
    setSavingCriteria(true);
    setCriteriaMsg(null);
    try {
      await saveInactiveReportConfig({
        recentDays: parseInt(recentDays) || 7,
        lookbackDays: parseInt(lookbackDays) || 30,
        minSessions: parseInt(minSessions) || 1,
        cooldownDays: parseInt(cooldownDays) || 0,
        gameType: gameType || null,
      });
      setCriteriaMsg('Saved — the weekly WhatsApp will use these numbers.');
    } catch {
      setCriteriaMsg('Failed to save criteria.');
    }
    setSavingCriteria(false);
  };

  const startHandle = (row) => { setHandlingPlayer(row); setNoteText(''); };
  const cancelHandle = () => { setHandlingPlayer(null); setNoteText(''); };
  const confirmHandle = async (playerId) => {
    setBusyId(playerId);
    try {
      await handleInactivePlayer(playerId, noteText);
      // Handled players drop off the list for the cooldown period.
      setResults(prev => prev.filter(r => r.playerId !== playerId));
      setHandlingPlayer(null);
      setNoteText('');
      loadHistory();
    } catch {
      setError('Failed to mark handled');
    }
    setBusyId(null);
  };

  const assignPlayer = async (playerId, adminUsername) => {
    setAssigningId(playerId);
    try {
      await assignInactivePlayer(playerId, adminUsername || null);
      if (assignedToFilter && assignedToFilter !== adminUsername) {
        // No longer matches the active filter — drop it from view.
        setResults(prev => prev.filter(r => r.playerId !== playerId));
      } else {
        setResults(prev => prev.map(r => r.playerId === playerId ? { ...r, assignedTo: adminUsername || null } : r));
      }
    } catch {
      setError('Failed to assign player');
    }
    setAssigningId(null);
  };

  const startMessage = (row) => { setMessagingPlayer(row); setMessageText(''); setMessageResult(null); };
  const cancelMessage = () => { setMessagingPlayer(null); setMessageText(''); setMessageResult(null); };
  const confirmMessage = async () => {
    if (!messagingPlayer?.phone) return;
    setSendingMsg(true);
    setMessageResult(null);
    try {
      const toPhone = TEST_REDIRECT_PHONE || messagingPlayer.phone;
      const res = await sendWhatsAppMessage([toPhone], messageText);
      if (res.data?.error || res.data?.failCount > 0) {
        setMessageResult({ ok: false, text: res.data?.error || 'Failed to send' });
      } else {
        setMessageResult({ ok: true, text: 'Sent!' });
      }
    } catch {
      setMessageResult({ ok: false, text: 'Failed to send' });
    }
    setSendingMsg(false);
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';
  const fmtMoney = (n) => {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    return (num < 0 ? '-' : '') + '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const moneyColor = (n) => Number(n) > 0 ? '#4ade80' : Number(n) < 0 ? '#fca5a5' : 'var(--text-muted)';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Inactive Players</h2>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
              Silent period (days)
            </label>
            <input type="number" min="1" value={recentDays} onChange={e => setRecentDays(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
              Lookback (days)
            </label>
            <input type="number" min="1" value={lookbackDays} onChange={e => setLookbackDays(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
              Min sessions
            </label>
            <input type="number" min="1" value={minSessions} onChange={e => setMinSessions(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
              Cooldown (days)
            </label>
            <input type="number" min="0" value={cooldownDays} onChange={e => setCooldownDays(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
              Game type
            </label>
            <select value={gameType} onChange={e => setGameType(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}>
              {GAME_TYPES.map(t => <option key={t} value={t}>{GAME_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
              Assigned to
            </label>
            <select value={assignedToFilter} onChange={e => setAssignedToFilter(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}>
              <option value="">Anyone</option>
              <option value="UNASSIGNED">Unassigned</option>
              {adminUsers.map(a => <option key={a.username} value={a.username}>{a.username}</option>)}
            </select>
          </div>
          <button onClick={handleRun} disabled={loading}
            style={{ background: loading ? '#334155' : 'var(--accent)', color: loading ? '#64748b' : '#0f172a', border: 'none', borderRadius: 6, padding: '8px 22px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
            {loading ? 'Loading...' : 'Run Report'}
          </button>
          <button onClick={handleSaveCriteria} disabled={savingCriteria}
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: savingCriteria ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}
            title="Save these numbers as the criteria the weekly WhatsApp uses">
            {savingCriteria ? 'Saving…' : 'Save as weekly criteria'}
          </button>
        </div>
        <div style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Players who played <strong style={{ color: 'var(--text-secondary)' }}>≥ {minSessions || '?'} sessions</strong> in the {lookbackDays || '?'} days before the last {recentDays || '?'} days, played <strong style={{ color: 'var(--text-secondary)' }}>nothing</strong> in the last {recentDays || '?'} days, and were <strong style={{ color: 'var(--text-secondary)' }}>not handled in the last {cooldownDays || '0'} days</strong>.
        </div>
        <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          📲 Weekly WhatsApp reminder: <strong style={{ color: 'var(--text-secondary)' }}>Sunday 10:00</strong> → 3 admin numbers.
        </div>
        {criteriaMsg && (
          <div style={{ marginTop: '0.5rem', color: criteriaMsg.startsWith('Failed') ? '#fca5a5' : '#4ade80', fontSize: '0.8rem' }}>{criteriaMsg}</div>
        )}
      </div>

      {error && (
        <div style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #dc2626', borderRadius: 8, padding: '0.75rem 1.25rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {results !== null && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Results</span>
            {results.length > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600 }}>
                {results.length} players
              </span>
            )}
          </div>
          {results.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No inactive players found for these parameters</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                    {['Username', 'Full Name', 'Sessions', 'Balance', 'Last played', 'Assigned to', 'Last contacted', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={row.playerId} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <Link to={`/player/${row.playerId}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{row.username}</Link>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Link to={`/player/${row.playerId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{row.fullName || '—'}</Link>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{row.sessionCount}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: moneyColor(row.balance) }}>{fmtMoney(row.balance)}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fmt(row.lastPlayed)}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <select value={row.assignedTo || ''} disabled={assigningId === row.playerId}
                          onChange={e => assignPlayer(row.playerId, e.target.value)}
                          style={{ ...inputStyle, width: 'auto' }}>
                          <option value="">— Unassigned —</option>
                          {adminUsers.map(a => <option key={a.username} value={a.username}>{a.username}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: 220 }}>
                        {row.lastHandledAt ? (
                          <span title={row.lastNote || ''}>
                            {fmt(row.lastHandledAt)}{row.lastHandledBy ? ` · ${row.lastHandledBy}` : ''}
                            {row.lastNote ? <span style={{ display: 'block', color: 'var(--text-secondary)', fontStyle: 'italic' }}>“{row.lastNote}”</span> : null}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => startHandle(row)}
                            style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                            Mark handled
                          </button>
                          <button onClick={() => startMessage(row)} disabled={!row.phone}
                            title={row.phone ? '' : 'No phone number on file'}
                            style={{ background: 'transparent', color: row.phone ? '#25d366' : 'var(--text-muted)', border: `1px solid ${row.phone ? '#25d366' : 'var(--border)'}`, borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: row.phone ? 'pointer' : 'not-allowed', fontSize: '0.85rem' }}>
                            💬 WhatsApp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginTop: '2rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Contact History</span>
            {history !== null && history.length > 0 && (
              <span style={{ background: '#334155', color: '#e2e8f0', borderRadius: 12, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600 }}>
                {history.length} contacts
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
                From
              </label>
              <DateInput value={historyFrom} onChange={setHistoryFrom} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
                To
              </label>
              <DateInput value={historyTo} onChange={setHistoryTo} />
            </div>
            <button onClick={loadHistory} disabled={historyLoading}
              style={{ background: historyLoading ? '#334155' : 'var(--accent)', color: historyLoading ? '#64748b' : '#0f172a', border: 'none', borderRadius: 6, padding: '8px 22px', fontWeight: 700, cursor: historyLoading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
              {historyLoading ? 'Loading...' : 'Filter'}
            </button>
          </div>
        </div>
        {historyError && (
          <div style={{ padding: '0.75rem 1.25rem', color: '#fca5a5' }}>{historyError}</div>
        )}
        {history !== null && (
          history.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No contacts recorded for this range</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                    {['Date', 'Player', 'Full Name', 'Handled By', 'Note'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{fmt(row.handledAt)}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <Link to={`/player/${row.playerId}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{row.username || `#${row.playerId}`}</Link>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{row.fullName || '—'}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{row.handledBy || '—'}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxWidth: 400 }}>{row.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {handlingPlayer && (
        <div onClick={cancelHandle}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6vh' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: 480, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Mark handled — {handlingPlayer.username}</strong>
              <button onClick={cancelHandle}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>
              Note (optional)
            </label>
            <textarea
              autoFocus
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') cancelHandle(); }}
              placeholder="What happened when you reached out..."
              rows={6}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, fontSize: '0.95rem', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={cancelHandle}
                style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: '0.9rem' }}>
                Cancel
              </button>
              <button onClick={() => confirmHandle(handlingPlayer.playerId)} disabled={busyId === handlingPlayer.playerId}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                {busyId === handlingPlayer.playerId ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {messagingPlayer && (
        <div onClick={cancelMessage}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6vh' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: 480, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--text-primary)' }}>💬 WhatsApp — {messagingPlayer.username}</strong>
              <button onClick={cancelMessage}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              {TEST_REDIRECT_PHONE ? (
                <span>
                  <span style={{ background: '#78350f', color: '#fdba74', borderRadius: 4, padding: '1px 8px', fontWeight: 700, fontSize: '0.75rem', marginRight: 8 }}>TEST MODE</span>
                  To: {TEST_REDIRECT_PHONE} <span style={{ opacity: 0.6 }}>(real number is {messagingPlayer.phone})</span>
                </span>
              ) : `To: ${messagingPlayer.phone}`}
            </div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>
              Message
            </label>
            <textarea
              autoFocus
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') cancelMessage(); }}
              placeholder="Type your message..."
              rows={6}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, fontSize: '0.95rem', outline: 'none' }}
            />
            {messageResult && (
              <div style={{ marginTop: '0.5rem', color: messageResult.ok ? '#4ade80' : '#fca5a5', fontSize: '0.85rem' }}>{messageResult.text}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={cancelMessage}
                style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: '0.9rem' }}>
                Close
              </button>
              <button onClick={confirmMessage} disabled={sendingMsg || !messageText.trim()}
                style={{ background: '#25d366', color: '#000', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, cursor: (sendingMsg || !messageText.trim()) ? 'not-allowed' : 'pointer', fontSize: '0.9rem', opacity: (sendingMsg || !messageText.trim()) ? 0.6 : 1 }}>
                {sendingMsg ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
