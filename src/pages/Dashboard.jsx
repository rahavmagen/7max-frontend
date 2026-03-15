import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers } from '../api';

export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [sort, setSort] = useState({ col: null, dir: 1 });
  const navigate = useNavigate();

  useEffect(() => {
    getPlayers().then(r => setPlayers(r.data));
  }, []);

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir * -1 } : { col, dir: -1 });
  };

  const sortArrow = (col) => {
    if (sort.col !== col) return ' ↕';
    return sort.dir === 1 ? ' ↑' : ' ↓';
  };

  let filtered = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  );

  if (hideZero) {
    filtered = filtered.filter(p => Number(p.balance) !== 0);
  }

  if (sort.col) {
    filtered = [...filtered].sort((a, b) => {
      const av = Number(a[sort.col]) || 0;
      const bv = Number(b[sort.col]) || 0;
      return (av - bv) * sort.dir;
    });
  }

  const totalChips = players.reduce((s, p) => s + (p.currentChips || 0), 0);
  const totalCredit = players.reduce((s, p) => s + (p.creditTotal || 0), 0);
  const totalPnl = players.reduce((s, p) => s + (p.balance || 0), 0);
  const activeCount = players.filter(p => p.active).length;

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (b) => Number(b) > 0 ? 'positive' : Number(b) < 0 ? 'negative' : 'zero';

  const thSort = (col, label) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label}<span style={{ opacity: 0.5, fontSize: '0.75em' }}>{sortArrow(col)}</span>
    </th>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Players Dashboard</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/import')}>⬆ Import Players</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Players</div>
          <div className="value neutral">{activeCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Chips in System</div>
          <div className="value neutral">{fmt(totalChips)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Credit Given</div>
          <div className="value neutral">{fmt(totalCredit)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Net P&L (All Players)</div>
          <div className={`value ${cls(totalPnl)}`}>{fmt(totalPnl)}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            className="search-input"
            style={{ margin: 0, flex: '1', minWidth: '200px' }}
            placeholder="Search by username, name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap', color: '#94a3b8', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={hideZero}
              onChange={e => setHideZero(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Hide zero balance players
          </label>
          <span style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            Showing {filtered.length} of {players.length}
          </span>
        </div>

        <div className="table-wrap"><table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Phone</th>
              <th>Club ID</th>
              {thSort('currentChips', 'Current Chips')}
              {thSort('creditTotal', 'Credit Given')}
              {thSort('balance', 'P&L (Balance)')}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} onClick={() => navigate(`/player/${p.id}`)}>
                <td><strong>{p.username}</strong></td>
                <td>{p.fullName || '—'}</td>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{p.phone || '—'}</td>
                <td style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>{p.clubPlayerId || '—'}</td>
                <td className="neutral"><strong>{fmt(p.currentChips)}</strong></td>
                <td style={{ color: '#94a3b8' }}>{p.creditTotal > 0 ? fmt(p.creditTotal) : '—'}</td>
                <td className={cls(p.balance)}><strong>{fmt(p.balance)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            No players found
          </div>
        )}
      </div>
    </div>
  );
}
