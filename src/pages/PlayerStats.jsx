import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getPlayerStats } from '../api';

const GAME_TYPES = ['', 'NLH', 'PLO', 'PLO5', 'PLO6', 'MTT', 'SNG', 'AoF', 'SPIN_GOLD'];
const GAME_TYPE_LABELS = { '': 'All Types', NLH: 'NLH (Cash)', PLO: 'PLO', PLO5: 'PLO5', PLO6: 'PLO6', MTT: 'MTT', SNG: 'SNG', AoF: 'AoF', SPIN_GOLD: 'Spin Gold' };


export default function PlayerStats() {
  const [gameType, setGameType] = useState('');
  const [minGames, setMinGames] = useState('');
  const [minAbsPnl, setMinAbsPnl] = useState('');
  const [maxAbsPnl, setMaxAbsPnl] = useState('');
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
  const minAbs = parseInt(minAbsPnl) || 0;
  const maxAbs = parseInt(maxAbsPnl) || 0;

  const sorted = useMemo(() => {
    if (!data) return [];
    let filtered = minG > 0 ? data.filter(p => p.sessionCount >= minG) : data;
    if (minAbs > 0) filtered = filtered.filter(p => Math.abs(Number(p.totalPnl)) >= minAbs);
    if (maxAbs > 0) filtered = filtered.filter(p => Math.abs(Number(p.totalPnl)) <= maxAbs);
    return [...filtered].sort((a, b) => {
      const av = sortCol === 'username' ? (a.username || '') : Number(a[sortCol] || 0);
      const bv = sortCol === 'username' ? (b.username || '') : Number(b[sortCol] || 0);
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    });
  }, [data, sortCol, sortDir, minG, minAbs, maxAbs]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(col === 'username' ? 1 : -1); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '';

  const fmt = (n) => {
    const v = Number(n);
    const abs = Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (v < 0 ? '-' : v > 0 ? '+' : '') + '₪' + abs;
  };

  const pnlChart = useMemo(() => {
    if (sorted.length < 2) return null;
    const pnls = sorted.map(p => Number(p.totalPnl));
    const minV = Math.min(...pnls);
    const maxV = Math.max(...pnls);
    if (minV === maxV) return null;
    const BUCKETS = 14;
    const step = (maxV - minV) / BUCKETS;
    const buckets = Array.from({ length: BUCKETS }, (_, i) => ({
      from: minV + i * step,
      to: minV + (i + 1) * step,
      count: 0,
    }));
    pnls.forEach(v => {
      const idx = Math.min(Math.floor((v - minV) / step), BUCKETS - 1);
      buckets[idx].count++;
    });
    return { buckets, step };
  }, [sorted]);

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
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>|P&L| filter (₪) — pick one</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Min</span>
            <input type="number" min="0" value={minAbsPnl}
              onChange={e => { setMinAbsPnl(e.target.value); if (e.target.value) setMaxAbsPnl(''); }}
              placeholder="0"
              disabled={!!maxAbsPnl}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: maxAbsPnl ? '#475569' : 'var(--text-primary)', padding: '6px 10px', fontSize: '0.9rem', width: 90, opacity: maxAbsPnl ? 0.4 : 1 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Max</span>
            <input type="number" min="0" value={maxAbsPnl}
              onChange={e => { setMaxAbsPnl(e.target.value); if (e.target.value) setMinAbsPnl(''); }}
              placeholder="0"
              disabled={!!minAbsPnl}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: minAbsPnl ? '#475569' : 'var(--text-primary)', padding: '6px 10px', fontSize: '0.9rem', width: 90, opacity: minAbsPnl ? 0.4 : 1 }} />
          </div>
        </div>
        {loading && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</span>}
        {data && !loading && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{sorted.length}{minG > 0 ? `/${data.length}` : ''} players</span>}
      </div>

      {/* Win Rate Summary */}
      {sorted.length > 0 && (() => {
        const winners = sorted.filter(p => Number(p.totalPnl) > 0).length;
        const pct = Math.round((winners / sorted.length) * 100);
        const color = pct >= 50 ? '#22c55e' : pct >= 30 ? '#f59e0b' : '#ef4444';
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Win Rate</h3>
            <div style={{ display: 'inline-block', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1.5rem', textAlign: 'center', minWidth: 150 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>{minG > 0 ? `${minG}+ games` : 'All games'}</div>
              <div style={{ color, fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{pct}%</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>winners</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>{winners}/{sorted.length} players</div>
            </div>
          </div>
        );
      })()}

      {/* P&L Distribution Chart */}
      {pnlChart && (() => {
        const { buckets } = pnlChart;
        const W = 900, H = 220, PAD = { top: 28, bottom: 56, left: 10, right: 10 };
        const innerW = W - PAD.left - PAD.right;
        const innerH = H - PAD.top - PAD.bottom;
        const maxCount = Math.max(...buckets.map(b => b.count));
        const barW = innerW / buckets.length;
        const fmtAxis = (v) => {
          const abs = Math.abs(v);
          const s = abs >= 1000 ? `${Math.round(abs / 1000)}k` : String(Math.round(abs));
          return (v < 0 ? '-' : v > 0 ? '+' : '') + '₪' + s;
        };
        // show label every 2nd bucket to avoid overlap
        const showLabel = (i) => i % 2 === 0 || i === buckets.length - 1;
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>P&L Distribution</h3>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {/* grid lines */}
              {[0.25, 0.5, 0.75, 1].map(f => {
                const y = PAD.top + innerH - f * innerH;
                return <line key={f} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
              })}
              {/* baseline */}
              <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              {/* bars */}
              {buckets.map((b, i) => {
                const barH = maxCount > 0 ? (b.count / maxCount) * innerH : 0;
                const x = PAD.left + i * barW + 1;
                const y = PAD.top + innerH - barH;
                const midVal = (b.from + b.to) / 2;
                const color = midVal < 0 ? '#ef4444' : '#22c55e';
                const cx = x + (barW - 2) / 2;
                const labelY = PAD.top + innerH + 14;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={barW - 2} height={barH} fill={color} opacity={0.8} rx="2" />
                    {b.count > 0 && (
                      <text x={cx} y={y - 5} textAnchor="middle" fill={color} fontSize="13" fontWeight="800">{b.count}</text>
                    )}
                    {showLabel(i) && (
                      <text
                        x={cx} y={labelY}
                        textAnchor="end"
                        fill="#94a3b8"
                        fontSize="13"
                        fontWeight="600"
                        transform={`rotate(-45, ${cx}, ${labelY})`}
                      >{fmtAxis(b.from)}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })()}

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
