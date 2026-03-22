import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers } from '../api';

export default function BalanceReport() {
  const [players, setPlayers] = useState([]);
  const [threshold, setThreshold] = useState('');
  const [sortCol, setSortCol] = useState('balance');
  const [sortDir, setSortDir] = useState(1);
  const navigate = useNavigate();

  useEffect(() => { getPlayers().then(r => setPlayers(r.data)); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '0';
    const abs = Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '\u20AA' + abs;
  };

  const balanceClass = (b) => b > 0 ? 'positive' : b < 0 ? 'negative' : 'zero';

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(1); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '';
  const thStyle = { cursor: 'pointer', userSelect: 'none' };

  const t = parseFloat(threshold) || 0;
  const filtered = t > 0 ? players.filter(p => (p.balance || 0) > t || (p.balance || 0) < -t) : players;
  const sorted = [...filtered].sort((a, b) => {
    const av = sortCol === 'username' ? (a.username || '') : sortCol === 'fullName' ? (a.fullName || '') : (a[sortCol] || 0);
    const bv = sortCol === 'username' ? (b.username || '') : sortCol === 'fullName' ? (b.fullName || '') : (b[sortCol] || 0);
    if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });

  return (
    <div>
      <h1>Balance Report</h1>

      <p style={{ color: '#64748b', marginBottom: '1rem' }}>
        Show players with balance above or below a threshold.
      </p>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ color: '#94a3b8' }}>Show players with |balance| &gt;</label>
          <input type="number" min="0" step="1" value={threshold} onChange={e => setThreshold(e.target.value)}
            placeholder="0 = show all"
            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', width: '160px' }} />
          {threshold && (
            <button onClick={() => setThreshold('')}
              style={{ background: 'none', border: '1px solid #2d3148', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
              Clear
            </button>
          )}
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{sorted.length} player{sorted.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="card">
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No players match the filter</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSort('username')}>Username{arrow('username')}</th>
                <th style={thStyle} onClick={() => handleSort('fullName')}>Full Name{arrow('fullName')}</th>
                <th style={thStyle} onClick={() => handleSort('currentChips')}>Current Chips{arrow('currentChips')}</th>
                <th style={thStyle} onClick={() => handleSort('creditTotal')}>Credit{arrow('creditTotal')}</th>
                <th style={thStyle} onClick={() => handleSort('balance')}>Balance{arrow('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/player/${p.id}`)}>
                  <td style={{ fontWeight: 600 }}>{p.username}</td>
                  <td style={{ color: '#94a3b8' }}>{p.fullName || '—'}</td>
                  <td>{fmt(p.currentChips)}</td>
                  <td style={{ color: p.creditTotal > 0 ? '#f59e0b' : '#64748b' }}>{fmt(p.creditTotal)}</td>
                  <td><strong className={balanceClass(p.balance)}>{fmt(p.balance)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
