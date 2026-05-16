import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getAgentSummary, getAgentBreakdown } from '../api';

export default function AgentPortal() {
  const { auth } = useAuth();
  const agentId = auth?.playerId;
  const [summary, setSummary] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '₪' + abs;
  };

  useEffect(() => {
    if (!agentId) {
      setError('No player account linked to your user.');
      setLoading(false);
      return;
    }
    Promise.all([getAgentSummary(agentId), getAgentBreakdown(agentId)])
      .then(([sRes, bdRes]) => {
        setSummary(sRes.data);
        setBreakdown(bdRes.data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.response?.data?.error || 'Failed to load agent data');
        setLoading(false);
      });
  }, [agentId]);

  if (loading) return <div className="page-container">Loading...</div>;
  if (error) return <div className="page-container" style={{ color: '#f87171' }}>{error}</div>;

  return (
    <div className="page-container">
      <h2>Agent Portal</h2>

      <div style={{
        background: '#0f172a', border: '1px solid #2d3148', borderRadius: '12px',
        padding: '2rem', marginBottom: '2rem', textAlign: 'center'
      }}>
        <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Pending Balance</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fbbf24' }}>{fmt(summary.pendingBalance)}</div>
      </div>

      <h3 style={{ marginBottom: '1rem' }}>Settlement History</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2d3148', color: '#94a3b8', textAlign: 'left', fontSize: '0.85rem' }}>
            <th style={{ padding: '8px' }}>Period</th>
            <th style={{ padding: '8px' }}>Total Rake</th>
            <th style={{ padding: '8px' }}>Your Share</th>
            <th style={{ padding: '8px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {summary.settlementHistory.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #1e2235' }}>
              <td style={{ padding: '8px' }}>{s.fromDate} – {s.toDate}</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>{fmt(s.totalRake)}</td>
              <td style={{ padding: '8px', color: '#4ade80' }}>{fmt(s.agentShare)}</td>
              <td style={{ padding: '8px', color: '#64748b', fontSize: '0.8rem' }}>{s.status}</td>
            </tr>
          ))}
          {summary.settlementHistory.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>
                No settlements yet
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3 style={{ marginBottom: '1rem' }}>Pending Games</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2d3148', color: '#94a3b8', textAlign: 'left', fontSize: '0.85rem' }}>
            <th style={{ padding: '8px' }}>Date</th>
            <th style={{ padding: '8px' }}>Table</th>
            <th style={{ padding: '8px' }}>Player</th>
            <th style={{ padding: '8px' }}>Rake</th>
            <th style={{ padding: '8px' }}>Your Share</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map(row => (
            <tr key={row.gameResultId} style={{ borderBottom: '1px solid #1e2235' }}>
              <td style={{ padding: '8px', color: '#94a3b8' }}>{row.sessionDate}</td>
              <td style={{ padding: '8px' }}>{row.tableName}</td>
              <td style={{ padding: '8px' }}>{row.playerUsername}</td>
              <td style={{ padding: '8px' }}>{fmt(row.rakePaid)}</td>
              <td style={{ padding: '8px', color: '#fbbf24' }}>{fmt(row.agentShare)}</td>
            </tr>
          ))}
          {breakdown.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>
                No pending games
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
