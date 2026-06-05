import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAgentSummary, getAgentPlayerStats } from '../api';
import DateInput from '../components/DateInput';

const inputStyle = { background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '4px 8px', borderRadius: '5px', fontSize: '0.82rem' };

const fmt = (n) => {
  if (n === undefined || n === null) return '₪0.00';
  const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (Number(n) < 0 ? '-' : '') + '₪' + abs;
};

export default function AgentPortal() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const agentId = auth?.playerId;
  const isAgent = auth?.isAgent === true;
  const [summary, setSummary] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = (from, to) => {
    setStatsLoading(true);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    getAgentPlayerStats(agentId, params)
      .then(r => { setPlayerStats(r.data); setStatsLoading(false); })
      .catch(() => { setPlayerStats([]); setStatsLoading(false); });
  };

  useEffect(() => {
    if (!agentId) { setError('No player account linked to your user.'); setLoading(false); return; }
    if (!isAgent) { setError('Access denied. This page is for agents only.'); setLoading(false); return; }
    Promise.all([getAgentSummary(agentId), getAgentPlayerStats(agentId, {})])
      .then(([sRes, psRes]) => {
        setSummary(sRes.data);
        setPlayerStats(psRes.data);
        setLoading(false);
      })
      .catch(e => { setError(e.response?.data?.error || 'Failed to load agent data'); setLoading(false); });
  }, [agentId]);

  if (loading) return <div className="page-container">Loading...</div>;
  if (error) return <div className="page-container" style={{ color: '#f87171' }}>{error}</div>;

  const settlementHistory = summary.settlementHistory ?? [];
  const filteredHistory = settlementHistory.filter(s => {
    if (filterFrom && s.toDate < filterFrom) return false;
    if (filterTo && s.fromDate > filterTo) return false;
    return true;
  });
  const statsTotalRake = playerStats.reduce((s, p) => s + Number(p.totalRake || 0), 0);
  const statsTotalShare = playerStats.reduce((s, p) => s + Number(p.agentShare || 0), 0);
  const historyRakeTotal = filteredHistory.reduce((s, h) => s + Number(h.totalRake || 0), 0);
  const historyShareTotal = filteredHistory.reduce((s, h) => s + Number(h.agentShare || 0), 0);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>{auth.username} — Agent Portal</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>From</span>
          <DateInput value={filterFrom} onChange={v => { setFilterFrom(v); fetchStats(v, filterTo); }} style={inputStyle} />
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>To</span>
          <DateInput value={filterTo} onChange={v => { setFilterTo(v); fetchStats(filterFrom, v); }} style={inputStyle} />
          {(filterFrom || filterTo) && (
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); fetchStats('', ''); }}
              style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Pending Balance */}
      <div style={{ background: '#0f172a', border: '1px solid #2d3148', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Pending Balance</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fbbf24' }}>{fmt(summary.pendingBalance)}</div>
      </div>

      {/* Players */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ color: '#e2e8f0' }}>Players ({playerStats.length})</strong>
          {(filterFrom || filterTo) && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.75rem' }}>{filterFrom || '…'} – {filterTo || '…'}</span>}
        </div>
        {statsLoading ? <div style={{ color: '#64748b', padding: '1rem', textAlign: 'center' }}>Loading...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2d3148', color: '#64748b', textAlign: 'left', fontSize: '0.82rem' }}>
                  <th style={{ padding: '8px' }}>Player</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Games</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Club Rake</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Your Share</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map(p => (
                  <tr key={p.playerId} style={{ borderBottom: '1px solid #1e2235' }}>
                    <td style={{ padding: '8px' }}>
                      <Link to={`/player/${p.playerId}`} style={{ color: '#60a5fa', textDecoration: 'underline' }}>
                        {p.username}
                      </Link>
                      {p.fullName && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.4rem' }}>{p.fullName}</span>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{p.gameCount}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmt(p.totalRake)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>{fmt(p.agentShare)}</td>
                  </tr>
                ))}
                {playerStats.length === 0 && <tr><td colSpan={4} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>No data for selected period</td></tr>}
                {playerStats.length > 0 && (
                  <tr style={{ borderTop: '1px solid #334155', background: '#12151f' }}>
                    <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 700 }}>Total</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{playerStats.reduce((s, p) => s + p.gameCount, 0)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>{fmt(statsTotalRake)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24', fontWeight: 700 }}>{fmt(statsTotalShare)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settlement History */}
      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ color: '#e2e8f0' }}>Settlement History ({filteredHistory.length})</strong>
          {(filterFrom || filterTo) && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.75rem' }}>{filterFrom || '…'} – {filterTo || '…'}</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2d3148', color: '#64748b', textAlign: 'left', fontSize: '0.82rem' }}>
                <th style={{ padding: '8px' }}>Period</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Total Rake</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Your Share</th>
                <th style={{ padding: '8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e2235' }}>
                  <td style={{ padding: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>{s.fromDate} – {s.toDate}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmt(s.totalRake)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>{fmt(s.agentShare)}</td>
                  <td style={{ padding: '8px' }}><span style={{ fontSize: '0.75rem', background: '#14532d', color: '#4ade80', borderRadius: '4px', padding: '2px 7px' }}>{s.status}</span></td>
                </tr>
              ))}
              {filteredHistory.length === 0 && <tr><td colSpan={4} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>No settlement history</td></tr>}
              {filteredHistory.length > 1 && (
                <tr style={{ borderTop: '1px solid #334155', background: '#12151f' }}>
                  <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 700 }}>Total ({filteredHistory.length} settlements)</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>{fmt(historyRakeTotal)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>{fmt(historyShareTotal)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
