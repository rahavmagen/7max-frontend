import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getPlayerStats } from '../api';

const GAME_TYPES = ['', 'NLH', 'PLO', 'PLO5', 'PLO6', 'MTT', 'SNG', 'AoF', 'SPIN_GOLD'];
const GAME_TYPE_LABELS = { '': 'All Types', NLH: 'NLH (Cash)', PLO: 'PLO', PLO5: 'PLO5', PLO6: 'PLO6', MTT: 'MTT', SNG: 'SNG', AoF: 'AoF', SPIN_GOLD: 'Spin Gold' };

const BUCKETS = [
  { label: '1–5',    min: 1,   max: 5   },
  { label: '6–20',   min: 6,   max: 20  },
  { label: '21–50',  min: 21,  max: 50  },
  { label: '51–100', min: 51,  max: 100 },
  { label: '100+',   min: 101, max: Infinity },
];

export default function PlayerStats() {
  const [gameType, setGameType] = useState('');
  const [minGames, setMinGames] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState('sessionCount');
  const [sortDir, setSortDir] = useState(-1); // -1 = desc

  const load = async (gt) => {
    setLoading(true);
    try {
      const res = await getPlayerStats(gt || '');
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(''); }, []);

  const handleGameTypeChange = (gt) => {
    setGameType(gt);
    load(gt);
  };

  const minG = parseInt(minGames) || 0;

  const sorted = useMemo(() => {
    if (!data) return [];
    const filtered = minG > 0 ? data.filter(p => p.sessionCount >= minG) : data;
    return [...filtered].sort((a, b) => {
      const av = sortCol === 'username' ? (a.username || '') : Number(a[sortCol] || 0);
      const bv = sortCol === 'username' ? (b.username || '') : Number(b[sortCol] || 0);
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    });
  }, [data, sortCol, sortDir, minG]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(col === 'username' ? 1 : -1); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '';

  const winRateBuckets = useMemo(() => {
    if (!data) return [];
    const base = minG > 0 ? data.filter(p => p.sessionCount >= minG) : data;
    return BUCKETS.map(b => {
      const inBucket = base.filter(p => p.sessionCount >= b.min && p.sessionCount <= b.max);
      const winners = inBucket.filter(p => Number(p.totalPnl) > 0);
      return { ...b, total: inBucket.length, winners: winners.length };
    }).filter(b => b.total > 0);
  }, [data, minG]);

  const fmt = (n) => {
    const v = Number(n);
    const abs = Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (v < 0 ? '-' : v > 0 ? '+' : '') + '₪' + abs;
  };

  const thStyle = { padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none' };
  const tdStyle = { padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: '0.9rem' };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Player Statistics</h2>

      {/* Filters */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Game type</label>
          <select value={gameType} onChange={e => handleGameTypeChange(e.target.value)}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: '0.9rem' }}>
            {GAME_TYPES.map(t => <option key={t} value={t}>{GAME_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Min games</label>
          <input type="number" min="0" value={minGames} onChange={e => setMinGames(e.target.value)} placeholder="0 = all"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: '0.9rem', width: 90 }} />
        </div>
        {loading && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</span>}
        {data && !loading && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{sorted.length}{minG > 0 ? `/${data.length}` : ''} players</span>}
      </div>

      {/* Win Rate Buckets */}
      {winRateBuckets.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Win Rate by Games Played</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {winRateBuckets.map(b => {
              const pct = b.total > 0 ? Math.round((b.winners / b.total) * 100) : 0;
              const color = pct >= 50 ? '#22c55e' : pct >= 30 ? '#f59e0b' : '#ef4444';
              return (
                <div key={b.label} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1.25rem', minWidth: 130, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>{b.label} games</div>
                  <div style={{ color, fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{pct}%</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>winners</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>{b.winners}/{b.total} players</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Table */}
      {data && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                  <th style={thStyle} onClick={() => handleSort('username')}>Username{arrow('username')}</th>
                  <th style={thStyle}>Full Name</th>
                  <th style={thStyle} onClick={() => handleSort('sessionCount')}>Games{arrow('sessionCount')}</th>
                  <th style={thStyle} onClick={() => handleSort('totalPnl')}>Total P&L{arrow('totalPnl')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const pnl = Number(row.totalPnl);
                  return (
                    <tr key={row.playerId} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={tdStyle}>
                        <Link to={`/player/${row.playerId}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{row.username}</Link>
                      </td>
                      <td style={tdStyle}>
                        <Link to={`/player/${row.playerId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{row.fullName || '—'}</Link>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: 600 }}>{row.sessionCount}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: pnl > 0 ? '#22c55e' : pnl < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                        {fmt(pnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
