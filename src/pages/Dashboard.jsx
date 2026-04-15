import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers } from '../api';

export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [showLeftClubOnly, setShowLeftClubOnly] = useState(false);
  const [showNoFullName, setShowNoFullName] = useState(false);
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

  const isStale = (p) => p.chipsStale === true && (!p.clubPlayerId || p.clubPlayerId === '') && (p.currentChips || 0) > 0;
  const isLeftClub = (p) => p.chipsStale === true && p.clubPlayerId;

  let filtered = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  );

  if (showStaleOnly) {
    filtered = filtered.filter(p => isStale(p));
  }

  if (showLeftClubOnly) {
    filtered = filtered.filter(p => isLeftClub(p));
  }

  if (hideZero) {
    filtered = filtered.filter(p => Number(p.balance) !== 0);
  }

  if (showNoFullName) {
    filtered = filtered.filter(p => !p.fullName || p.fullName.trim() === '');
  }

  const strCols = ['username', 'fullName', 'phone', 'clubPlayerId'];
  if (sort.col) {
    filtered = [...filtered].sort((a, b) => {
      if (strCols.includes(sort.col)) {
        return (a[sort.col] || '').localeCompare(b[sort.col] || '') * sort.dir;
      }
      return ((Number(a[sort.col]) || 0) - (Number(b[sort.col]) || 0)) * sort.dir;
    });
  }

  const totalChips = players.filter(p => !isStale(p)).reduce((s, p) => s + (p.currentChips || 0), 0);
  const totalCredit = players.reduce((s, p) => s + (p.creditTotal || 0), 0);
  const totalPnl = players.filter(p => !isStale(p)).reduce((s, p) => s + (p.balance || 0), 0);
  const activeCount = players.filter(p => p.active && !isStale(p)).length;
  const staleCount = players.filter(p => isStale(p)).length;
  const leftClubCount = players.filter(p => isLeftClub(p)).length;
  const noFullNameCount = players.filter(p => !p.fullName || p.fullName.trim() === '').length;

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
        {staleCount > 0 && (
          <div
            className="stat-card"
            onClick={() => { setShowStaleOnly(s => !s); setShowLeftClubOnly(false); setShowNoFullName(false); }}
            style={{ borderTopColor: '#f59e0b', borderColor: showStaleOnly ? '#f59e0b' : '#2d3148', cursor: 'pointer', outline: showStaleOnly ? '2px solid #f59e0b' : 'none' }}
            title="Click to filter unknown players (no club ID)"
          >
            <div className="label" style={{ color: '#f59e0b' }}>Not Exists {showStaleOnly ? '(filtering)' : ''}</div>
            <div className="value" style={{ color: '#f59e0b' }}>{staleCount}</div>
          </div>
        )}
        {leftClubCount > 0 && (
          <div
            className="stat-card"
            onClick={() => { setShowLeftClubOnly(s => !s); setShowStaleOnly(false); setShowNoFullName(false); }}
            style={{ borderTopColor: '#6366f1', cursor: 'pointer', outline: showLeftClubOnly ? '2px solid #6366f1' : 'none' }}
            title="Click to filter players who left the club"
          >
            <div className="label">Left Club {showLeftClubOnly ? '(filtering)' : ''}</div>
            <div className="value">{leftClubCount}</div>
          </div>
        )}
        {noFullNameCount > 0 && (
          <div
            className="stat-card"
            onClick={() => { setShowNoFullName(s => !s); setShowStaleOnly(false); setShowLeftClubOnly(false); }}
            style={{ borderTopColor: '#94a3b8', cursor: 'pointer', outline: showNoFullName ? '2px solid #94a3b8' : 'none' }}
            title="Click to filter players with no full name set"
          >
            <div className="label" style={{ color: '#94a3b8' }}>No Full Name {showNoFullName ? '(filtering)' : ''}</div>
            <div className="value" style={{ color: '#94a3b8' }}>{noFullNameCount}</div>
          </div>
        )}
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
              {thSort('username', 'Username')}
              {thSort('fullName', 'Full Name')}
              {thSort('phone', 'Phone')}
              {thSort('clubPlayerId', 'Club ID')}
              {thSort('currentChips', 'Current Chips')}
              {thSort('creditTotal', 'Credit Given')}
              {thSort('balance', 'Profit / Loss')}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} onClick={() => navigate(`/player/${p.id}`)}>
                <td>
                  <strong>{p.username}</strong>
                  {isStale(p) && (
                    <span title={`Not found in latest XLS upload (last updated: ${p.chipsAsOf || 'unknown'})`}
                      style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#f59e0b', color: '#1e293b', borderRadius: '4px', padding: '1px 5px', fontWeight: 600, verticalAlign: 'middle' }}>
                      NOT EXISTS
                    </span>
                  )}
                </td>
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
