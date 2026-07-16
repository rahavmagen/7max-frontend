import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAgents, getAgentSummary, getAgentPlayerStats, settleAgent, setAgentRakePercentage, setAgentClubManaged, resyncAgents, computeAgentCredit, dismissAgentFlags } from '../api';
import DateInput from '../components/DateInput';
import AgentPlayerRow from '../components/AgentPlayerRow';

const inputStyle = { background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '4px 8px', borderRadius: '5px', fontSize: '0.82rem' };

const fmt = (n) => {
  if (n === undefined || n === null) return '₪0.00';
  const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (Number(n) < 0 ? '-' : '') + '₪' + abs;
};

const balanceClass = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : 'zero';

export default function Agents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { id, username }
  const [playerStats, setPlayerStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [settlementHistory, setSettlementHistory] = useState([]);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [msg, setMsg] = useState(null);
  const [settling, setSettling] = useState(false);
  const [editingRake, setEditingRake] = useState(null); // agentId being edited
  const [rakeInput, setRakeInput] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [summaryFrom, setSummaryFrom] = useState(''); // date filter for the agents table
  const [summaryTo, setSummaryTo] = useState('');
  const [showAllAgents, setShowAllAgents] = useState(false); // expand ALL agents at once
  const [allAgentStats, setAllAgentStats] = useState({});    // agentId -> playerStats[]
  const [allLoading, setAllLoading] = useState(false);
  const [checkedFlags, setCheckedFlags] = useState(new Set()); // flagged player ids ticked for dismissal
  const [dismissing, setDismissing] = useState(false);

  const toggleFlag = (id) => setCheckedFlags(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleDismissFlags = () => {
    const ids = [...checkedFlags];
    if (ids.length === 0) return;
    setDismissing(true);
    dismissAgentFlags(ids)
      .then(() => { setCheckedFlags(new Set()); load(); })
      .catch(() => setMsg({ type: 'error', text: 'Failed to update error list' }))
      .finally(() => setDismissing(false));
  };

  const load = (from = summaryFrom, to = summaryTo) => {
    setLoading(true);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    getAgents(params)
      .then(r => { setAgents(r.data); setLoading(false); })
      .catch(() => { setMsg({ type: 'error', text: 'Failed to load agents' }); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openDetail = (agent) => {
    setSelected(agent);
    setFilterFrom('');
    setFilterTo('');
    fetchStats(agent.id, '', '');
    getAgentSummary(agent.id)
      .then(r => setSettlementHistory(r.data.settlementHistory || []))
      .catch(() => setSettlementHistory([]));
  };

  const fetchStats = (agentId, from, to) => {
    setStatsLoading(true);
    setExpandedIds(new Set());
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    getAgentPlayerStats(agentId, params)
      .then(r => { setPlayerStats(r.data); setStatsLoading(false); })
      .catch(() => { setPlayerStats([]); setStatsLoading(false); });
  };

  const handleFilter = () => fetchStats(selected.id, filterFrom, filterTo);
  const handleClearFilter = () => { setFilterFrom(''); setFilterTo(''); fetchStats(selected.id, '', ''); };

  const toggleExpand = (playerId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(playerStats.map(p => p.playerId)));
  const collapseAll = () => setExpandedIds(new Set());

  // Open ALL agents at once — fetch every agent's player stats (respecting the table date filter).
  const loadAllAgentDetails = async () => {
    setShowAllAgents(true);
    setAllLoading(true);
    const params = {};
    if (summaryFrom) params.from = summaryFrom;
    if (summaryTo) params.to = summaryTo;
    try {
      const entries = await Promise.all(agents.map(a =>
        getAgentPlayerStats(a.id, params).then(r => [a.id, r.data]).catch(() => [a.id, []])
      ));
      const map = {};
      for (const [id, data] of entries) map[id] = data;
      setAllAgentStats(map);
    } finally {
      setAllLoading(false);
    }
  };
  const collapseAllAgents = () => { setShowAllAgents(false); setAllAgentStats({}); };

  const handleSaveRake = async (agentId) => {
    const pct = parseFloat(rakeInput);
    if (isNaN(pct) || pct < 0 || pct > 100) { setMsg({ type: 'error', text: 'Rake must be 0–100%' }); return; }
    try {
      await setAgentRakePercentage(agentId, pct / 100);
      setEditingRake(null);
      setMsg({ type: 'success', text: `Rake updated to ${pct}%` });
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update rake' });
    }
  };

  const [resyncing, setResyncing] = useState(false);
  const handleResync = async () => {
    setResyncing(true);
    setMsg({ type: 'success', text: 'Resyncing agent links & recomputing credit…' });
    try {
      await resyncAgents();
      await computeAgentCredit();
      setMsg({ type: 'success', text: 'Agent links & credit refreshed from the latest report' });
      load();
    } catch {
      setMsg({ type: 'error', text: 'Resync failed' });
    }
    setResyncing(false);
  };

  const handleToggleClubManaged = async (agent) => {
    try {
      await setAgentClubManaged(agent.id, !agent.clubManaged);
      setMsg({ type: 'success', text: `${agent.username} ${!agent.clubManaged ? 'marked club-managed' : 'unmarked club-managed'}` });
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update club-managed flag' });
    }
  };

  const handleSettle = async (agentId) => {
    setSettling(true);
    setMsg(null);
    try {
      const r = await settleAgent(agentId);
      setMsg({ type: 'success', text: `Settled ${fmt(r.data.agentShare)} for ${r.data.fromDate} – ${r.data.toDate}` });
      load();
      if (selected?.id === agentId) {
        fetchStats(agentId, filterFrom, filterTo);
        getAgentSummary(agentId).then(r => setSettlementHistory(r.data.settlementHistory || []));
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to settle' });
    }
    setSettling(false);
  };

  // Filtered settlement history (client-side, same filter as player stats)
  const filteredHistory = settlementHistory.filter(s => {
    if (filterFrom && s.toDate < filterFrom) return false;
    if (filterTo && s.fromDate > filterTo) return false;
    return true;
  });
  const filteredHistoryRakeTotal = filteredHistory.reduce((s, h) => s + Number(h.totalRake || 0), 0);
  const filteredHistoryShareTotal = filteredHistory.reduce((s, h) => s + Number(h.agentShare || 0), 0);

  // Player stats totals
  const statsTotalRake = playerStats.reduce((s, p) => s + Number(p.totalRake || 0), 0);
  const statsTotalShare = playerStats.reduce((s, p) => s + Number(p.agentShare || 0), 0);
  const statsTotalPnl = playerStats.reduce((s, p) => s + Number(p.periodPnl || 0), 0);

  // Agents table totals (across all agents)
  const summaryTotalPlayers = agents.reduce((s, a) => s + Number(a.playerCount || 0), 0);
  const summaryTotalActive = agents.reduce((s, a) => s + Number(a.activePlayerCount || 0), 0);
  const summaryTotalGames = agents.reduce((s, a) => s + Number(a.gameCount || 0), 0);
  const summaryTotalRake = agents.reduce((s, a) => s + Number(a.totalRake || 0), 0);
  // Grand total excludes club-managed agents (their players are handled directly by the club).
  const summaryTotalFreeCredit = agents.reduce((s, a) => s + (a.clubManaged ? 0 : Number(a.freeCreditTotal || 0)), 0);
  const summaryTotalPending = agents.reduce((s, a) => s + Number(a.pendingBalance || 0), 0);

  if (loading) return <div className="page-container">Loading...</div>;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>Agents</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>From</span>
          <DateInput value={summaryFrom} onChange={v => { setSummaryFrom(v); load(v, summaryTo); }} style={inputStyle} />
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>To</span>
          <DateInput value={summaryTo} onChange={v => { setSummaryTo(v); load(summaryFrom, v); }} style={inputStyle} />
          {(summaryFrom || summaryTo) && (
            <button onClick={() => { setSummaryFrom(''); setSummaryTo(''); load('', ''); }}
              style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}>
              Clear
            </button>
          )}
          <button onClick={() => showAllAgents ? collapseAllAgents() : loadAllAgentDetails()}
            style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid #2d3148', background: showAllAgents ? '#1e3a5f' : 'transparent', color: showAllAgents ? '#60a5fa' : '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            {showAllAgents ? 'Collapse All Agents' : 'Expand All Agents'}
          </button>
          <button onClick={handleResync} disabled={resyncing}
            title="Re-link players to agents from the latest report and recompute the credit cross-check"
            style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: resyncing ? 0.6 : 1 }}>
            {resyncing ? 'Resyncing…' : '🔄 Resync agents'}
          </button>
          <span style={{ fontSize: '0.78rem', color: '#64748b', background: '#1e2235', padding: '3px 10px', borderRadius: '4px' }}>Admin only</span>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '0.5rem 1rem', marginBottom: '1rem', borderRadius: '6px',
          background: msg.type === 'success' ? '#1a3a1a' : '#3a1a1a',
          color: msg.type === 'success' ? '#4ade80' : '#f87171', cursor: 'pointer'
        }} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}

      {/* Grand total of free chips (credit) given by all agents to their players */}
      {summaryTotalFreeCredit !== 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', borderRadius: '6px', background: '#2a1420', border: '1px solid #f472b655', color: '#f472b6', fontSize: '0.9rem' }}>
          Total credit given by agents to players: <strong>{fmt(summaryTotalFreeCredit)}</strong>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '0.5rem' }}>(free chips = current chips − game P&amp;L; not yet booked as credit)</span>
        </div>
      )}

      {/* Agents summary table */}
      <div className="card" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3148', color: '#94a3b8', textAlign: 'left', fontSize: '0.82rem', background: '#12151f' }}>
              <th style={{ padding: '10px 12px' }}>Agent</th>
              <th style={{ padding: '10px 12px' }}>Rake %</th>
              <th style={{ padding: '10px 12px' }}>Players</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Active</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Games</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Rake</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Free Credit</th>
              <th style={{ padding: '10px 12px' }}>Pending Balance</th>
              <th style={{ padding: '10px 12px' }}>Last Settlement</th>
              <th style={{ padding: '10px 12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #1e2235', background: selected?.id === a.id ? '#151826' : 'transparent' }}>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => selected?.id === a.id ? setSelected(null) : openDetail(a)}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                    {a.username}
                  </button>
                  {a.fullName && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{a.fullName}</span>}
                  <button onClick={() => handleToggleClubManaged(a)}
                    title="Club-managed: club handles this agent's players directly (excluded from credit total, players may get manual credit)"
                    style={{ marginLeft: '0.5rem', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer',
                      border: '1px solid', borderColor: a.clubManaged ? '#22c55e55' : '#33415555',
                      background: a.clubManaged ? '#14532d' : 'transparent', color: a.clubManaged ? '#4ade80' : '#64748b' }}>
                    {a.clubManaged ? '✓ club-managed' : 'club-managed?'}
                  </button>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {editingRake === a.id ? (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="number" min="0" max="100" step="1"
                        value={rakeInput} onChange={e => setRakeInput(e.target.value)}
                        style={{ ...inputStyle, width: 52 }}
                        autoFocus
                      />
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>%</span>
                      <button onClick={() => handleSaveRake(a.id)}
                        style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>✓</button>
                      <button onClick={() => setEditingRake(null)}
                        style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>✗</button>
                    </span>
                  ) : (
                    <span
                      onClick={() => { setEditingRake(a.id); setRakeInput(a.rakePercentage != null ? (Number(a.rakePercentage) * 100).toFixed(0) : ''); }}
                      style={{ color: a.rakePercentage != null ? '#a78bfa' : '#475569', cursor: 'pointer', fontWeight: 600 }}
                      title="Click to edit"
                    >
                      {a.rakePercentage != null ? `${(Number(a.rakePercentage) * 100).toFixed(0)}%` : '—'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{a.playerCount}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{a.activePlayerCount ?? 0}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{a.gameCount ?? 0}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>{fmt(a.totalRake)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: a.clubManaged ? '#475569' : (Number(a.freeCreditTotal) > 0 ? '#f472b6' : '#475569'), fontWeight: (!a.clubManaged && Number(a.freeCreditTotal) > 0) ? 700 : 400, textDecoration: a.clubManaged ? 'line-through' : 'none' }}
                  title={a.clubManaged ? 'Club-managed — excluded from the credit total' : 'Free chips this agent gave players (credit)'}>
                  {fmt(a.freeCreditTotal)}
                </td>
                <td style={{ padding: '10px 12px', color: Number(a.pendingBalance) > 0 ? '#fbbf24' : '#94a3b8', fontWeight: Number(a.pendingBalance) > 0 ? 600 : 400 }}>
                  {fmt(a.pendingBalance)}
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.85rem' }}>{a.lastSettlementDate || '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => handleSettle(a.id)} disabled={settling || Number(a.pendingBalance) <= 0}
                    style={{ padding: '4px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.82rem',
                      background: Number(a.pendingBalance) > 0 ? '#1d4ed8' : '#374151', color: '#fff', opacity: settling ? 0.6 : 1 }}>
                    Settle & Pay
                  </button>
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr><td colSpan={10} style={{ padding: '2rem', color: '#64748b', textAlign: 'center' }}>No agents configured</td></tr>
            )}
            {agents.length > 0 && (
              <tr style={{ borderTop: '1px solid #334155', background: '#12151f' }}>
                <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 700 }}>Total</td>
                <td />
                <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 700 }}>{summaryTotalPlayers}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8', fontWeight: 700 }}>{summaryTotalActive}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#e2e8f0', fontWeight: 700 }}>{summaryTotalGames}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#e2e8f0', fontWeight: 700 }}>{fmt(summaryTotalRake)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#f472b6', fontWeight: 700 }}>{fmt(summaryTotalFreeCredit)}</td>
                <td style={{ padding: '10px 12px', color: Number(summaryTotalPending) > 0 ? '#fbbf24' : '#94a3b8', fontWeight: 700 }}>{fmt(summaryTotalPending)}</td>
                <td />
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* All-agents expanded overview */}
      {showAllAgents && (
        <div style={{ marginBottom: '2rem' }}>
          {allLoading ? (
            <div style={{ color: '#64748b', padding: '1rem', textAlign: 'center' }}>Loading all agents…</div>
          ) : (
            agents.map(a => {
              const rows = allAgentStats[a.id] || [];
              const tGames = rows.reduce((s, p) => s + Number(p.gameCount || 0), 0);
              const tRake = rows.reduce((s, p) => s + Number(p.totalRake || 0), 0);
              const tShare = rows.reduce((s, p) => s + Number(p.agentShare || 0), 0);
              const tPnl = rows.reduce((s, p) => s + Number(p.periodPnl || 0), 0);
              const tChips = rows.reduce((s, p) => s + Number(p.currentChips || 0), 0);
              const tCredit = rows.reduce((s, p) => s + Number(p.agentChipCredit || 0), 0);
              return (
                <div key={a.id} className="card" style={{ marginBottom: '1rem' }}>
                  {(() => { const agentChecked = rows.filter(p => p.reconciles === false && checkedFlags.has(p.playerId)).length; return (
                  <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <strong style={{ color: '#e2e8f0' }}>{a.username}</strong>
                    {a.fullName && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{a.fullName}</span>}
                    {a.clubManaged && <span style={{ fontSize: '0.68rem', color: '#4ade80', background: '#14532d', padding: '1px 6px', borderRadius: '4px' }}>club-managed</span>}
                    {agentChecked > 0 && (
                      <button onClick={handleDismissFlags} disabled={dismissing}
                        style={{ ...inputStyle, background: '#16a34a', color: '#e2e8f0', fontWeight: 600, cursor: 'pointer' }}>
                        {dismissing ? 'Saving…' : `Done (${agentChecked})`}
                      </button>
                    )}
                    <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: 'auto' }}>{rows.length} players</span>
                  </div>
                  ); })()}
                  {rows.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.82rem', padding: '0.5rem' }}>No players / no data for the selected range</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #2d3148', color: '#64748b', textAlign: 'left', fontSize: '0.8rem' }}>
                          <th style={{ padding: '6px' }}>Player</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Games</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Club Rake</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Agent Share</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>P&L</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Chips</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Free Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(p => (
                          <AgentPlayerRow key={p.playerId} player={p} showBalance={false}
                            expanded={expandedIds.has(p.playerId)} onToggle={() => toggleExpand(p.playerId)}
                            checked={checkedFlags.has(p.playerId)} onToggleFlag={() => toggleFlag(p.playerId)} />
                        ))}
                        <tr style={{ borderTop: '1px solid #334155', background: '#12151f', fontWeight: 700 }}>
                          <td style={{ padding: '6px', color: '#e2e8f0' }}>Total</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#94a3b8' }}>{tGames}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#f59e0b' }}>{fmt(tRake)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#fbbf24' }}>{fmt(tShare)}</td>
                          <td style={{ padding: '6px', textAlign: 'right' }} className={balanceClass(tPnl)}>{fmt(tPnl)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#94a3b8' }}>{fmt(tChips)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#f472b6' }}>{fmt(tCredit)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Agent detail panel */}
      {selected && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, color: '#e2e8f0' }}>
              {selected.username} — Detail
              {selected.rakePercentage != null && (
                <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: '#a78bfa', fontWeight: 400 }}>
                  {(Number(selected.rakePercentage) * 100).toFixed(0)}% rake
                </span>
              )}
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#64748b', fontSize: '0.82rem' }}>From</span>
              <DateInput value={filterFrom} onChange={v => { setFilterFrom(v); fetchStats(selected.id, v, filterTo); }} style={inputStyle} />
              <span style={{ color: '#64748b', fontSize: '0.82rem' }}>To</span>
              <DateInput value={filterTo} onChange={v => { setFilterTo(v); fetchStats(selected.id, filterFrom, v); }} style={inputStyle} />
              {(filterFrom || filterTo) && (
                <button onClick={handleClearFilter}
                  style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Player stats */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong style={{ color: '#e2e8f0' }}>Players ({playerStats.length})</strong>
                {(filterFrom || filterTo) && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.75rem' }}>{filterFrom || '…'} – {filterTo || '…'}</span>}
              </div>
              {playerStats.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {(() => { const n = playerStats.filter(p => p.reconciles === false && checkedFlags.has(p.playerId)).length; return n > 0 && (
                    <button onClick={handleDismissFlags} disabled={dismissing}
                      style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#16a34a', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      {dismissing ? 'Saving…' : `Done (${n})`}
                    </button>
                  ); })()}
                  <button onClick={expandAll} style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Expand All</button>
                  <button onClick={collapseAll} style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>Collapse All</button>
                </div>
              )}
            </div>

            {statsLoading ? (
              <div style={{ color: '#64748b', padding: '1rem', textAlign: 'center' }}>Loading...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2d3148', color: '#64748b', textAlign: 'left', fontSize: '0.82rem' }}>
                      <th style={{ padding: '8px' }}>Player</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Balance</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Games</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Club Rake</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Agent Share</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Period P&L</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Chips</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Free Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map(p => (
                      <AgentPlayerRow key={p.playerId} player={p} showBalance={true} expanded={expandedIds.has(p.playerId)} onToggle={() => toggleExpand(p.playerId)} checked={checkedFlags.has(p.playerId)} onToggleFlag={() => toggleFlag(p.playerId)} />
                    ))}
                    {playerStats.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>No data for selected period</td></tr>
                    )}
                    {playerStats.length > 1 && (
                      <tr style={{ borderTop: '1px solid #334155', background: '#12151f' }}>
                        <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 700 }}>Total</td>
                        <td />
                        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{playerStats.reduce((s, p) => s + p.gameCount, 0)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>{fmt(statsTotalRake)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24', fontWeight: 700 }}>{fmt(statsTotalShare)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }} className={balanceClass(statsTotalPnl)}>{fmt(statsTotalPnl)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8', fontWeight: 700 }}>{fmt(playerStats.reduce((s, p) => s + Number(p.currentChips || 0), 0))}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#f472b6', fontWeight: 700 }}>{fmt(playerStats.reduce((s, p) => s + Number(p.agentChipCredit || 0), 0))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Settlement history */}
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
                    <th style={{ padding: '8px', textAlign: 'right' }}>Agent Share</th>
                    <th style={{ padding: '8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #1e2235' }}>
                      <td style={{ padding: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>{s.fromDate} – {s.toDate}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmt(s.totalRake)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>{fmt(s.agentShare)}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ fontSize: '0.75rem', background: '#14532d', color: '#4ade80', borderRadius: '4px', padding: '2px 7px' }}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>No settlement history</td></tr>
                  )}
                  {filteredHistory.length > 1 && (
                    <tr style={{ borderTop: '1px solid #334155', background: '#12151f' }}>
                      <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 700 }}>Total ({filteredHistory.length} settlements)</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>{fmt(filteredHistoryRakeTotal)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>{fmt(filteredHistoryShareTotal)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
