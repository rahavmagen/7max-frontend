import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers } from '../api';
import { sumSelectedBalances } from '../utils/balanceSum';

export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [showZero, setShowZero] = useState(false);
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sort, setSort] = useState({ col: null, dir: 1 });
  const navigate = useNavigate();

  useEffect(() => {
    getPlayers().then(r => setPlayers(r.data));
  }, []);

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir * -1 } : { col, dir: -1 });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sortArrow = (col) => {
    if (sort.col !== col) return ' ↕';
    return sort.dir === 1 ? ' ↑' : ' ↓';
  };

  const isStale = (p) => p.chipsStale === true && (!p.clubPlayerId || p.clubPlayerId === '') && (p.currentChips || 0) > 0;

  // Build agent lookup from the players list itself
  const agentMap = {};
  const clubManagedAgentIds = new Set();
  players.forEach(p => {
    if (p.isAgent) agentMap[p.id] = p.username;
    if (p.isAgent && p.clubManaged) clubManagedAgentIds.add(p.id);
  });

  // Club-managed agents (and their downline) are treated like normal players by the club,
  // so they stay visible even when "Show agent players" is off.
  const isClubManagedOrDownline = (p) =>
    (p.isAgent && p.clubManaged) || clubManagedAgentIds.has(p.agentId);

  let filtered = players.filter(p => {
    const agentName = agentMap[p.agentId] || '';
    return p.username.toLowerCase().includes(search.toLowerCase()) ||
      (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.includes(search)) ||
      agentName.toLowerCase().includes(search.toLowerCase());
  });

  if (showStaleOnly) {
    filtered = filtered.filter(p => isStale(p));
  }

  if (!showAgents && !search) {
    filtered = filtered.filter(p => (!p.isAgent && !p.agentId) || isClubManagedOrDownline(p));
  }

  if (!showZero) {
    filtered = filtered.filter(p => Number(p.balance) !== 0);
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

  const staleCount = players.filter(p => isStale(p)).length;
  const selectedSum = sumSelectedBalances(players, selectedIds);

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
        {staleCount > 0 && (
          <div
            className="stat-card"
            onClick={() => setShowStaleOnly(s => !s)}
            style={{ borderTopColor: '#f59e0b', borderColor: showStaleOnly ? '#f59e0b' : '#2d3148', cursor: 'pointer', outline: showStaleOnly ? '2px solid #f59e0b' : 'none' }}
            title="Click to filter unknown players (no club ID)"
          >
            <div className="label" style={{ color: '#f59e0b' }}>Not Exists {showStaleOnly ? '(filtering)' : ''}</div>
            <div className="value" style={{ color: '#f59e0b' }}>{staleCount}</div>
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
              checked={showAgents}
              onChange={e => setShowAgents(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Show agent players
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap', color: '#94a3b8', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={showZero}
              onChange={e => setShowZero(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Show zero balance players
          </label>
          <span style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            Showing {filtered.length} of {players.length}
          </span>
          {selectedIds.size > 0 && (
            <span style={{ color: '#a5b4fc', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {selectedIds.size} selected — Balance: {fmt(selectedSum)}
              <button
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </span>
          )}
        </div>

        <div className="table-wrap"><table>
          <thead>
            <tr>
              <th></th>
              {thSort('username', 'Username')}
              {thSort('fullName', 'Full Name')}
              {thSort('phone', 'Phone')}
              {thSort('clubPlayerId', 'Club ID')}
              <th>Agent</th>
              {thSort('currentChips', 'Current Chips')}
              {thSort('creditTotal', 'Credit Given')}
              {thSort('balance', 'Profit / Loss')}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} onClick={() => navigate(`/player/${p.id}`)}>
                <td onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </td>
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
                <td style={{ color: '#34d399', fontSize: '0.85rem' }}>{agentMap[p.agentId] || '—'}</td>
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
