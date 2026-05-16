import { useState, useEffect } from 'react';
import { getAgents, getAgentBreakdown, settleAgent } from '../api';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { id, username }
  const [breakdown, setBreakdown] = useState([]);
  const [bdLoading, setBdLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [settling, setSettling] = useState(false);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '₪' + abs;
  };

  const load = () => {
    setLoading(true);
    getAgents().then(r => { setAgents(r.data); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openBreakdown = (agent) => {
    setSelected(agent);
    setBdLoading(true);
    getAgentBreakdown(agent.id).then(r => { setBreakdown(r.data); setBdLoading(false); });
  };

  const handleSettle = async (agentId) => {
    setSettling(true);
    setMsg(null);
    try {
      const r = await settleAgent(agentId);
      setMsg({ type: 'success', text: `Settled ${fmt(r.data.agentShare)} for ${r.data.fromDate} – ${r.data.toDate}` });
      load();
      if (selected?.id === agentId) openBreakdown({ id: agentId, username: selected.username });
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to settle' });
    }
    setSettling(false);
  };

  if (loading) return <div className="page-container">Loading...</div>;

  return (
    <div className="page-container">
      <h2>Agents</h2>
      {msg && (
        <div style={{
          padding: '0.5rem 1rem', marginBottom: '1rem', borderRadius: '6px',
          background: msg.type === 'success' ? '#1a3a1a' : '#3a1a1a',
          color: msg.type === 'success' ? '#4ade80' : '#f87171'
        }}>
          {msg.text}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2d3148', color: '#94a3b8', textAlign: 'left', fontSize: '0.85rem' }}>
            <th style={{ padding: '8px' }}>Agent</th>
            <th style={{ padding: '8px' }}>Players</th>
            <th style={{ padding: '8px' }}>Pending Balance</th>
            <th style={{ padding: '8px' }}>Last Settlement</th>
            <th style={{ padding: '8px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(a => (
            <tr key={a.id} style={{ borderBottom: '1px solid #1e2235' }}>
              <td style={{ padding: '8px' }}>
                <button
                  onClick={() => openBreakdown(a)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0 }}
                >
                  {a.username}
                </button>
              </td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>{a.playerCount}</td>
              <td style={{ padding: '8px', color: Number(a.pendingBalance) > 0 ? '#fbbf24' : '#94a3b8' }}>
                {fmt(a.pendingBalance)}
              </td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>{a.lastSettlementDate || '—'}</td>
              <td style={{ padding: '8px' }}>
                <button
                  onClick={() => handleSettle(a.id)}
                  disabled={settling || Number(a.pendingBalance) <= 0}
                  style={{
                    padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: Number(a.pendingBalance) > 0 ? '#1d4ed8' : '#374151',
                    color: '#fff', opacity: settling ? 0.6 : 1
                  }}
                >
                  Settle & Pay
                </button>
              </td>
            </tr>
          ))}
          {agents.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>
                No agents configured
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selected && (
        <div>
          <h3 style={{ marginBottom: '1rem' }}>{selected.username} — Game Breakdown</h3>
          {bdLoading ? <div>Loading...</div> : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2d3148', color: '#94a3b8', textAlign: 'left', fontSize: '0.85rem' }}>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>Table</th>
                    <th style={{ padding: '8px' }}>Player</th>
                    <th style={{ padding: '8px' }}>Rake</th>
                    <th style={{ padding: '8px' }}>Agent Share</th>
                    <th style={{ padding: '8px' }}>Status</th>
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
                      <td style={{ padding: '8px', color: '#64748b', fontSize: '0.8rem' }}>{row.status}</td>
                    </tr>
                  ))}
                  {breakdown.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>
                        No pending results
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {breakdown.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '2rem', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8' }}>
                    Total Rake: {fmt(breakdown.reduce((s, r) => s + Number(r.rakePaid), 0))}
                  </span>
                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                    Agent Share: {fmt(breakdown.reduce((s, r) => s + Number(r.agentShare), 0))}
                  </span>
                  <button
                    onClick={() => handleSettle(selected.id)}
                    disabled={settling}
                    style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer' }}
                  >
                    Settle & Pay
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
