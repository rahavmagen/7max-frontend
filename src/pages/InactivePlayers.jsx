import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getInactivePlayers } from '../api';

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
  const [gameType, setGameType] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        recentDays: parseInt(recentDays) || 7,
        lookbackDays: parseInt(lookbackDays) || 30,
        minSessions: parseInt(minSessions) || 1,
      };
      if (gameType) params.gameType = gameType;
      const res = await getInactivePlayers(params);
      setResults(res.data);
    } catch (e) {
      setError('Failed to load report');
    }
    setLoading(false);
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
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
        </div>
        <div style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Players who played <strong style={{ color: 'var(--text-secondary)' }}>≥ {minSessions || '?'} sessions</strong> in the {lookbackDays || '?'} days before the last {recentDays || '?'} days, and played <strong style={{ color: 'var(--text-secondary)' }}>nothing</strong> in the last {recentDays || '?'} days.
        </div>
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
                    {['Username', 'Full Name', 'Sessions in period', 'Last played'].map(h => (
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
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fmt(row.lastPlayed)}</td>
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
