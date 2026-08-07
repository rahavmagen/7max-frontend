import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getInactivePlayers, handleInactivePlayer, getInactiveReportConfig, saveInactiveReportConfig } from '../api';

const GAME_TYPES = ['', 'NLH', 'PLO', 'PLO5', 'PLO6', 'MTT', 'SNG', 'AoF', 'SPIN_GOLD'];
const GAME_TYPE_LABELS = { '': 'All Types', NLH: 'NLH (Cash)', PLO: 'PLO', PLO5: 'PLO5', PLO6: 'PLO6', MTT: 'MTT', SNG: 'SNG', AoF: 'AoF', SPIN_GOLD: 'Spin Gold' };

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
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [criteriaMsg, setCriteriaMsg] = useState(null);
  const [handlingId, setHandlingId] = useState(null);  // playerId currently getting a note
  const [noteText, setNoteText] = useState('');
  const [busyId, setBusyId] = useState(null);

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

  const startHandle = (playerId) => { setHandlingId(playerId); setNoteText(''); };
  const cancelHandle = () => { setHandlingId(null); setNoteText(''); };
  const confirmHandle = async (playerId) => {
    setBusyId(playerId);
    try {
      await handleInactivePlayer(playerId, noteText);
      // Handled players drop off the list for the cooldown period.
      setResults(prev => prev.filter(r => r.playerId !== playerId));
      setHandlingId(null);
      setNoteText('');
    } catch {
      setError('Failed to mark handled');
    }
    setBusyId(null);
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
                    {['Username', 'Full Name', 'Sessions', 'Balance', 'Last played', 'Last contacted', 'Action'].map(h => (
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
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: 220 }}>
                        {row.lastHandledAt ? (
                          <span title={row.lastNote || ''}>
                            {fmt(row.lastHandledAt)}{row.lastHandledBy ? ` · ${row.lastHandledBy}` : ''}
                            {row.lastNote ? <span style={{ display: 'block', color: 'var(--text-secondary)', fontStyle: 'italic' }}>“{row.lastNote}”</span> : null}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {handlingId === row.playerId ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              autoFocus
                              value={noteText}
                              onChange={e => setNoteText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') confirmHandle(row.playerId); if (e.key === 'Escape') cancelHandle(); }}
                              placeholder="note (optional)"
                              style={{ ...inputStyle, width: 180 }}
                            />
                            <button onClick={() => confirmHandle(row.playerId)} disabled={busyId === row.playerId}
                              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                              {busyId === row.playerId ? '…' : 'Save'}
                            </button>
                            <button onClick={cancelHandle}
                              style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startHandle(row.playerId)}
                            style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                            Mark handled
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
