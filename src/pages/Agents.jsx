import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAgents, getAgentSummary, getAgentPlayerStats, settleAgent, setAgentRakePercentage, setAgentClubManaged, resyncAgents, computeAgentCredit, dismissAgentFlags, getAgentBalance, getAgentLedger, addAgentOpening, addAgentPayment, deleteAgentLedgerEntry, getLastSettlementDate, setLastSettlementDate, getAgentLedgerHistory, setAgentSettledWeek, uncheckAllAgentSettledWeek } from '../api';
import { getPlayers, getBankAccounts, createTransfer, getAdminUsers, getPlayerTransactions } from '../api';
import DateInput from '../components/DateInput';
import AgentPlayerRow from '../components/AgentPlayerRow';
import PlayerSelect from '../components/PlayerSelect';
import { fmtDateOnly } from '../utils/dates';

const SETTLE_METHODS = ['CASH', 'BANK_TRANSFER', 'BIT', 'PAYBOX', 'KASHCASH', 'OTHER'];

const inputStyle = { background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '4px 8px', borderRadius: '5px', fontSize: '0.82rem' };

const fmt = (n) => {
  if (n === undefined || n === null) return '₪0.00';
  const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (Number(n) < 0 ? '-' : '') + '₪' + abs;
};

// From the AGENT's point of view: + (green) = we owe the agent; − (red) = the agent owes us.
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
  const [balance, setBalance] = useState(null);       // running-balance breakdown for the selected agent
  const [ledger, setLedger] = useState([]);           // ledger entries (openings + payments)
  const [openingForm, setOpeningForm] = useState(null); // { amount, effectiveDate, notes }
  const [paymentForm, setPaymentForm] = useState(null); // { amount, effectiveDate, notes, direction }
  const [ledgerSaving, setLedgerSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hideInactive, setHideInactive] = useState(true);
  const [agentTx, setAgentTx] = useState([]);          // the agent's own player transactions
  const [agentTxOpen, setAgentTxOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('dashboard'); // agent-detail tab: dashboard | players
  const loadAgentTx = (agentId) => getPlayerTransactions(agentId).then(r => setAgentTx(r.data || [])).catch(() => setAgentTx([]));
  const [settleForm, setSettleForm] = useState(null); // { agent, direction, counterpartyId, clubType, adminUser, method, amount, notes }
  const [settlePlayers, setSettlePlayers] = useState([]);
  const [settleBanks, setSettleBanks] = useState([]);
  const [settleAdmins, setSettleAdmins] = useState([]);
  const [settleSaving, setSettleSaving] = useState(false);

  const openSettle = (agent) => {
    setSettleForm({ agent, direction: 'agentPays', counterpartyId: '', clubType: '', adminUser: '', method: 'CASH', amount: '', notes: '', agentRake: '' });
    if (settlePlayers.length === 0) getPlayers().then(r => setSettlePlayers(r.data || [])).catch(() => {});
    if (settleBanks.length === 0) getBankAccounts().then(r => setSettleBanks(r.data || [])).catch(() => {});
    if (settleAdmins.length === 0) getAdminUsers().then(r => setSettleAdmins(r.data || [])).catch(() => {});
    // Pre-fill from the real unsettled backlog (what settleAgent can actually act on), not the
    // period-projected "Agent Rake" column, which ignores settlement status and can be non-zero
    // even when nothing is actually left to settle.
    getAgentSummary(agent.id).then(r => {
      const pending = Number(r.data?.pendingBalance || 0);
      setSettleForm(f => (f && f.agent.id === agent.id) ? { ...f, agentRake: pending > 0 ? String(pending) : '' } : f);
    }).catch(() => {});
  };

  // Resolve the counterparty into a transfer party (player / bank account / admin wallet).
  const resolveCounterparty = (f) => {
    const id = f.counterpartyId;
    if (id === 'CLUB') {
      if (f.clubType === 'admin') return { playerId: null, bankAccountId: null, adminUsername: f.adminUser || null };
      return { playerId: null, bankAccountId: settleBanks[0]?.id ?? null, adminUsername: null }; // bank
    }
    if (typeof id === 'string' && id.startsWith('BANK_')) return { playerId: null, bankAccountId: parseInt(id.slice(5)), adminUsername: null };
    return { playerId: id, bankAccountId: null, adminUsername: null };
  };

  const submitSettle = async () => {
    const f = settleForm;
    const amt = parseFloat(f?.amount);
    const rakeAmt = parseFloat(f?.agentRake);
    const hasTransfer = !isNaN(amt) && amt > 0;
    const hasRake = !isNaN(rakeAmt) && rakeAmt > 0;
    if (!hasTransfer && !hasRake) { setMsg({ type: 'error', text: 'Enter a transfer amount and/or an agent rake to record' }); return; }
    if (hasTransfer) {
      if (!f.counterpartyId) { setMsg({ type: 'error', text: 'Choose the other side (player / bank / admin wallet)' }); return; }
      if (f.counterpartyId === 'CLUB' && !f.clubType) { setMsg({ type: 'error', text: 'Choose Admin Wallet or Bank' }); return; }
      if (f.counterpartyId === 'CLUB' && f.clubType === 'admin' && !f.adminUser) { setMsg({ type: 'error', text: 'Select which admin wallet' }); return; }
    }
    setSettleSaving(true);
    try {
      if (hasTransfer) {
        const o = resolveCounterparty(f);
        // agentPays = money INTO the club (agent → counterparty); clubPays = money OUT (counterparty → agent).
        const payload = f.direction === 'agentPays'
          ? { fromPlayerId: f.agent.id, fromBankAccountId: null, fromAdminUsername: null,
              toPlayerId: o.playerId, toBankAccountId: o.bankAccountId, toAdminUsername: o.adminUsername }
          : { fromPlayerId: o.playerId, fromBankAccountId: o.bankAccountId, fromAdminUsername: o.adminUsername,
              toPlayerId: f.agent.id, toBankAccountId: null, toAdminUsername: null };
        await createTransfer({ ...payload, method: f.method, amount: amt, notes: f.notes || `Agent settle: ${f.agent.username}` });
        // Update the agent balance: agent paid us reduces what we owe (−amt); we paid the agent (+amt).
        const ledgerAmt = f.direction === 'agentPays' ? -amt : amt;
        await addAgentPayment(f.agent.id, { amount: ledgerAmt, notes: f.notes || `Settle via ${f.method}` });
      }
      // Record the agent rake as a Club Expense, independent of how much was actually transferred
      // above (e.g. owed 3K, only 2K paid now) - the full corrected figure still gets written.
      if (hasRake) {
        await settleAgent(f.agent.id, rakeAmt);
      }
      setSettleForm(null);
      setMsg({ type: 'success', text: 'Settlement recorded' });
      if (selected?.id === f.agent.id) { loadBalance(f.agent.id, filterFrom, filterTo); loadAgentTx(f.agent.id); setAgentTxOpen(true); }
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to record settlement' });
    } finally {
      setSettleSaving(false);
    }
  };
  const [txHistory, setTxHistory] = useState(null);   // full ledger history across agents (null = not loaded)
  const [txHistoryOpen, setTxHistoryOpen] = useState(false);

  const toggleTxHistory = () => {
    const next = !txHistoryOpen;
    setTxHistoryOpen(next);
    if (next) getAgentLedgerHistory().then(r => setTxHistory(r.data || [])).catch(() => setTxHistory([]));
  };

  const loadBalance = (agentId, from, to) => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    getAgentBalance(agentId, params).then(r => setBalance(r.data)).catch(() => setBalance(null));
    getAgentLedger(agentId).then(r => setLedger(r.data || [])).catch(() => setLedger([]));
  };

  const submitOpening = () => {
    const amt = parseFloat(openingForm?.amount);
    if (isNaN(amt)) { setMsg({ type: 'error', text: 'Enter a valid opening balance (may be negative)' }); return; }
    setLedgerSaving(true);
    addAgentOpening(selected.id, { amount: amt, effectiveDate: openingForm.effectiveDate || undefined, notes: openingForm.notes || null })
      .then(r => { setBalance(r.data); setOpeningForm(null); loadBalance(selected.id, filterFrom, filterTo); load(); })
      .catch(e => setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to set opening balance' }))
      .finally(() => setLedgerSaving(false));
  };

  const submitPayment = () => {
    const amt = parseFloat(paymentForm?.amount); // + = we paid agent, − = agent paid us; dated today
    if (isNaN(amt) || amt === 0) { setMsg({ type: 'error', text: 'Enter an amount (− if the agent paid you)' }); return; }
    setLedgerSaving(true);
    addAgentPayment(selected.id, { amount: amt, notes: paymentForm.notes || null })
      .then(r => { setBalance(r.data); setPaymentForm(null); loadBalance(selected.id, filterFrom, filterTo); load(); })
      .catch(e => setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to log payment' }))
      .finally(() => setLedgerSaving(false));
  };

  const removeLedgerEntry = (entryId) => {
    if (!window.confirm('Delete this ledger entry?')) return;
    deleteAgentLedgerEntry(entryId).then(() => { loadBalance(selected.id, filterFrom, filterTo); load(); })
      .catch(() => setMsg({ type: 'error', text: 'Failed to delete entry' }));
  };

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

  const [defaultedFrom, setDefaultedFrom] = useState(''); // the auto-selected last-התחשבנות date
  const [editingSettlementDate, setEditingSettlementDate] = useState(false);
  const [settlementDateDraft, setSettlementDateDraft] = useState('');
  const [savingSettlementDate, setSavingSettlementDate] = useState(false);
  useEffect(() => {
    getLastSettlementDate()
      .then(r => {
        const d = r.data?.date || '';
        if (d) { setSummaryFrom(d); setDefaultedFrom(d); load(d, ''); }
        else load('', '');
      })
      .catch(() => load('', ''));
  }, []);

  const startEditSettlementDate = () => { setSettlementDateDraft(defaultedFrom || summaryFrom || ''); setEditingSettlementDate(true); };
  const saveSettlementDate = async () => {
    if (!settlementDateDraft) return;
    setSavingSettlementDate(true);
    try {
      await setLastSettlementDate(settlementDateDraft);
      setDefaultedFrom(settlementDateDraft);
      setEditingSettlementDate(false);
      applyPageDates(settlementDateDraft, summaryTo);
    } catch {
      setMsg({ type: 'error', text: 'Failed to save last settlement date' });
    }
    setSavingSettlementDate(false);
  };

  const openDetail = (agent) => {
    setSelected(agent);
    // Agent detail's date filter defaults to whatever range is chosen on the all-agents page.
    setFilterFrom(summaryFrom);
    setFilterTo(summaryTo);
    setOpeningForm(null);
    setPaymentForm(null);
    fetchStats(agent.id, summaryFrom, summaryTo);
    loadBalance(agent.id, summaryFrom, summaryTo);
    loadAgentTx(agent.id);
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
  const resetToPageDates = () => { setFilterFrom(summaryFrom); setFilterTo(summaryTo); fetchStats(selected.id, summaryFrom, summaryTo); loadBalance(selected.id, summaryFrom, summaryTo); };
  // Changing the page (all-agents) dates also snaps the currently-open agent to that range.
  // Changing an agent's own dates (below) stays local — it does not touch the page dates.
  const applyPageDates = (from, to) => {
    setSummaryFrom(from);
    setSummaryTo(to);
    load(from, to);
    if (selected) { setFilterFrom(from); setFilterTo(to); fetchStats(selected.id, from, to); loadBalance(selected.id, from, to); }
  };
  const detailOverridesPage = (filterFrom || '') !== (summaryFrom || '') || (filterTo || '') !== (summaryTo || '');

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

  const handleToggleSettledWeek = async (a) => {
    const newVal = !a.settledThisWeek;
    setAgents(prev => prev.map(x => x.id === a.id ? { ...x, settledThisWeek: newVal } : x));
    try { await setAgentSettledWeek(a.id, newVal); }
    catch { setAgents(prev => prev.map(x => x.id === a.id ? { ...x, settledThisWeek: !newVal } : x)); }
  };
  const handleUncheckAllSettled = async () => {
    setAgents(prev => prev.map(x => ({ ...x, settledThisWeek: false })));
    try { await uncheckAllAgentSettledWeek(); } catch { load(); }
  };

  // Inline edit of an agent's starting balance → records a new OPENING ledger entry.
  const [editingStart, setEditingStart] = useState(null);   // agentId being edited
  const [startInput, setStartInput] = useState('');
  const saveStartingBalance = async (a) => {
    if (startInput === '' || startInput == null || isNaN(Number(startInput))) { setEditingStart(null); return; }
    try {
      await addAgentOpening(a.id, {
        amount: Number(startInput),
        effectiveDate: a.openingDate || a.lastSettlementDate || undefined,
      });
      setEditingStart(null);
      load();
    } catch { setMsg({ type: 'error', text: 'Failed to update starting balance' }); }
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

  // Club-managed agents are settled by the club directly — keep them out of the main table & totals,
  // and show them in their own section below.
  const mainAgentsAll = agents.filter(a => !a.clubManaged);
  // "Hide inactive": drop agents whose current balance is zero for the filtered period.
  const mainAgents = hideInactive ? mainAgentsAll.filter(a => Math.abs(Number(a.currentBalance || 0)) >= 0.005) : mainAgentsAll;
  const clubManagedAgents = agents.filter(a => a.clubManaged);

  // Agents table totals (main = non-club-managed only)
  const summaryTotalPlayers = mainAgents.reduce((s, a) => s + Number(a.playerCount || 0), 0);
  const summaryTotalActive = mainAgents.reduce((s, a) => s + Number(a.activePlayerCount || 0), 0);
  const summaryTotalGames = mainAgents.reduce((s, a) => s + Number(a.gameCount || 0), 0);
  const summaryTotalRake = mainAgents.reduce((s, a) => s + Number(a.totalRake || 0), 0);
  const summaryTotalChips = mainAgents.reduce((s, a) => s + Number(a.totalChips || 0), 0);
  const summaryTotalPnl = mainAgents.reduce((s, a) => s + Number(a.periodPnl || 0), 0);
  const summaryTotalAgentRake = mainAgents.reduce((s, a) => s + Number(a.agentRake || 0), 0);
  // Grand total excludes club-managed agents (their players are handled directly by the club).
  const summaryTotalPending = mainAgents.reduce((s, a) => s + Number(a.pendingBalance || 0), 0);
  const summaryTotalCurrentBalance = mainAgents.reduce((s, a) => s + Number(a.currentBalance || 0), 0);
  const summaryTotalStarting = mainAgents.reduce((s, a) => s + Number(a.openingBalance || 0), 0);

  if (loading) return <div className="page-container">Loading...</div>;

  return (
    <div className="page-container">
      {/* Settle modal — records a real transfer (agent as a player) + updates the agent balance */}
      {settleForm && (
        <div onClick={() => setSettleForm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6vh' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: 460, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: '#e2e8f0' }}>Settle — {settleForm.agent.username}</strong>
              <button onClick={() => setSettleForm(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
            </div>

            {/* Agent rake - what gets recorded as a Club Expense, independent of the transfer amount below */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Agent Rake (recorded as expense, editable)</label>
              <input type="number" step="0.01" min="0" value={settleForm.agentRake}
                onChange={e => setSettleForm(f => ({ ...f, agentRake: e.target.value }))}
                placeholder="0.00"
                style={{ width: '100%', background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' }} />
              <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.25rem' }}>
                Written to Club Expenses as this agent's rake fee when you record settlement, regardless of the transfer amount below.
              </div>
            </div>

            {/* Direction question */}
            <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Direction of the money</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => setSettleForm(f => ({ ...f, direction: 'agentPays' }))}
                style={{ flex: 1, padding: '8px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (settleForm.direction === 'agentPays' ? '#22c55e' : '#2d3148'), background: settleForm.direction === 'agentPays' ? '#14532d' : 'transparent', color: settleForm.direction === 'agentPays' ? '#4ade80' : '#94a3b8', fontWeight: 600 }}>
                Agent pays the club <div style={{ fontSize: '0.72rem', fontWeight: 400 }}>money into the club</div>
              </button>
              <button onClick={() => setSettleForm(f => ({ ...f, direction: 'clubPays' }))}
                style={{ flex: 1, padding: '8px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (settleForm.direction === 'clubPays' ? '#f87171' : '#2d3148'), background: settleForm.direction === 'clubPays' ? '#3a1a1a' : 'transparent', color: settleForm.direction === 'clubPays' ? '#f87171' : '#94a3b8', fontWeight: 600 }}>
                Club pays the agent <div style={{ fontSize: '0.72rem', fontWeight: 400 }}>money out of the club</div>
              </button>
            </div>

            {/* Counterparty (the other side) — reuses the transfer entity picker */}
            <PlayerSelect
              label={settleForm.direction === 'agentPays' ? 'To (player / bank / club)' : 'From (player / bank / club)'}
              value={settleForm.counterpartyId}
              onChange={v => setSettleForm(f => ({ ...f, counterpartyId: v, clubType: '', adminUser: '' }))}
              players={settlePlayers} bankAccounts={settleBanks} includeClub={true} excludeId={settleForm.agent.id} />
            {settleForm.counterpartyId === 'CLUB' && (
              <div style={{ marginTop: '-0.4rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  {[{ key: 'admin', label: '👤 Admin Wallet' }, { key: 'bank', label: '🏦 Bank' }].map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => setSettleForm(f => ({ ...f, clubType: key, adminUser: '' }))}
                      style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        background: settleForm.clubType === key ? '#2d3148' : 'transparent', borderColor: settleForm.clubType === key ? '#6366f1' : '#2d3148',
                        color: settleForm.clubType === key ? '#e2e8f0' : '#64748b' }}>{label}</button>
                  ))}
                </div>
                {settleForm.clubType === 'admin' && (
                  <select value={settleForm.adminUser} onChange={e => setSettleForm(f => ({ ...f, adminUser: e.target.value }))}
                    style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', width: '100%', fontSize: '0.85rem' }}>
                    <option value="">Select admin…</option>
                    {settleAdmins.map(u => { const name = typeof u === 'string' ? u : u.username; return <option key={name} value={name}>{name}</option>; })}
                  </select>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Method</label>
                <select value={settleForm.method} onChange={e => setSettleForm(f => ({ ...f, method: e.target.value }))}
                  style={{ width: '100%', background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
                  {SETTLE_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Amount (this transfer)</label>
                <input type="number" step="0.01" min="0" value={settleForm.amount}
                  onChange={e => setSettleForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width: '100%', background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' }} />
              </div>
            </div>
            <div className="form-group">
              <label>Note (optional)</label>
              <input value={settleForm.notes} onChange={e => setSettleForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' }} />
            </div>
            <div style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.25rem 0 0.75rem' }}>
              Records a transfer (shows on {settleForm.agent.username}'s player transactions) and moves the balance by {settleForm.direction === 'agentPays' ? '+' : '−'}{settleForm.amount || '…'} — {settleForm.direction === 'agentPays' ? 'the agent owes us less' : 'we owe the agent less'}.
            </div>
            {msg && (
              <div onClick={() => setMsg(null)} style={{
                marginBottom: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
                background: msg.type === 'success' ? '#1a3a1a' : '#3a1a1a',
                color: msg.type === 'success' ? '#4ade80' : '#f87171',
              }}>
                {msg.text}
              </div>
            )}
            <button onClick={submitSettle} disabled={settleSaving}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: settleSaving ? 0.6 : 1 }}>
              {settleSaving ? 'Saving…' : 'Record settlement'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>Agents</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>From</span>
          <DateInput value={summaryFrom} onChange={v => applyPageDates(v, summaryTo)} style={inputStyle} />
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>To</span>
          <DateInput value={summaryTo} onChange={v => applyPageDates(summaryFrom, v)} style={inputStyle} />
          {(summaryFrom || summaryTo) && (
            <button onClick={() => applyPageDates('', '')}
              style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}>
              Clear
            </button>
          )}
          <button onClick={() => showAllAgents ? collapseAllAgents() : loadAllAgentDetails()}
            style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid #2d3148', background: showAllAgents ? '#1e3a5f' : 'transparent', color: showAllAgents ? '#60a5fa' : '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            {showAllAgents ? 'Collapse All Agents' : 'Expand All Agents'}
          </button>
          <button onClick={toggleTxHistory}
            title="All agent transactions (starting balances + payments) across every agent"
            style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid #2d3148', background: txHistoryOpen ? '#1e3a5f' : 'transparent', color: txHistoryOpen ? '#60a5fa' : '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            📜 {txHistoryOpen ? 'Hide History' : 'History'}
          </button>
          <label title="Hide agents whose current balance is zero for the selected period"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: hideInactive ? '#60a5fa' : '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #2d3148', borderRadius: '5px', padding: '5px 10px' }}>
            <input type="checkbox" checked={hideInactive} onChange={e => setHideInactive(e.target.checked)} style={{ cursor: 'pointer' }} />
            Hide inactive
          </label>
          <button onClick={handleResync} disabled={resyncing}
            title="Re-link players to agents from the latest report and recompute the credit cross-check"
            style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: resyncing ? 0.6 : 1 }}>
            {resyncing ? 'Resyncing…' : '🔄 Resync agents'}
          </button>
          <span style={{ fontSize: '0.78rem', color: '#64748b', background: '#1e2235', padding: '3px 10px', borderRadius: '4px' }}>Admin only</span>
        </div>
      </div>

      <div style={{ marginTop: '-0.75rem', marginBottom: '1rem', color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span>
          Rake &amp; P&amp;L period: <strong style={{ color: '#e2e8f0' }}>{summaryFrom ? fmtDateOnly(summaryFrom) : 'start'} – {summaryTo ? fmtDateOnly(summaryTo) : 'today'}</strong>
          {summaryFrom && summaryFrom === defaultedFrom && <span style={{ color: '#a78bfa', marginLeft: '0.5rem' }}>(since last התחשבנות)</span>}
          <span style={{ color: '#64748b', marginLeft: '0.75rem' }}>· amounts are from the agent's point of view (+ green = we owe agent, − red = agent owes us)</span>
        </span>
        {editingSettlementDate ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#64748b' }}>תאריך התחשבנות אחרון:</span>
            <DateInput value={settlementDateDraft} onChange={setSettlementDateDraft} style={inputStyle} />
            <button onClick={saveSettlementDate} disabled={savingSettlementDate || !settlementDateDraft}
              style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, opacity: (savingSettlementDate || !settlementDateDraft) ? 0.6 : 1 }}>
              {savingSettlementDate ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditingSettlementDate(false)}
              style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}>
              Cancel
            </button>
          </span>
        ) : (
          <button onClick={startEditSettlementDate}
            title="Set the system-wide תאריך התחשבנות אחרון (used as the default period start here and for the Expected Rakeback estimate on P&L)"
            style={{ padding: '3px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
            ✏️ Set תאריך התחשבנות אחרון
          </button>
        )}
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

      {/* Transaction history across all agents */}
      {txHistoryOpen && (
        <div className="card" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #2d3148', color: '#e2e8f0', fontWeight: 600 }}>
            📜 Transaction History {txHistory ? `(${txHistory.length})` : ''}
          </div>
          {txHistory === null ? (
            <div style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>Loading…</div>
          ) : txHistory.length === 0 ? (
            <div style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>No transactions yet — set a starting balance or log a Settle &amp; Pay.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2d3148', color: '#64748b', textAlign: 'left', fontSize: '0.8rem', background: '#12151f' }}>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Agent</th>
                    <th style={{ padding: '8px 12px' }}>Type</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '8px 12px' }}>Note</th>
                    <th style={{ padding: '8px 12px' }}>By</th>
                  </tr>
                </thead>
                <tbody>
                  {txHistory.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #1e2235' }}>
                      <td style={{ padding: '8px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDateOnly(t.effectiveDate)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => { const ag = agents.find(x => x.id === t.agentId); if (ag) openDetail(ag); }}
                          style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontWeight: 600 }}>{t.agent}</button>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, background: t.type === 'OPENING' ? '#3b2a5f' : '#14532d', color: t.type === 'OPENING' ? '#c4b5fd' : '#4ade80' }}>
                          {t.type === 'OPENING' ? 'starting balance' : (Number(t.amount) >= 0 ? 'we paid agent' : 'agent paid us')}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(t.amount)}>{fmt(t.amount)}</td>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{t.notes || ''}</td>
                      <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '0.8rem' }}>{t.createdBy || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Agents summary table */}
      <div className="card" style={{ marginBottom: '2rem', padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 1150, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3148', color: '#94a3b8', textAlign: 'left', fontSize: '0.82rem', background: '#12151f' }}>
              <th style={{ padding: '10px 12px', position: 'sticky', left: 0, background: '#12151f', zIndex: 3 }}>Agent</th>
              <th style={{ padding: '10px 12px' }}>Rake %</th>
              <th style={{ padding: '10px 6px', textAlign: 'right' }} title="Players">Ply</th>
              <th style={{ padding: '10px 6px', textAlign: 'right' }} title="Active players">Act</th>
              <th style={{ padding: '10px 6px', textAlign: 'right' }} title="Games">Gms</th>
              <th style={{ padding: '10px 12px' }}>Phone</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Rake</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', borderLeft: '2px solid #475569' }} title="Balance calc starts here. Agent's cut = rake% × Total Rake (rakeback we owe the agent)">Agent Rake</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }} title="The real unsettled backlog - games not yet closed into a Club Expense. This is what Settle actually acts on, and can differ from Agent Rake (which is just a period estimate that ignores settlement status).">Real Balance</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }} title="Players' net P&L over the chosen dates (won = +)">P&amp;L</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }} title="Starting balance carried from the last התחשבנות">Starting Bal</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }} title="Amounts are from the agent's point of view: + (green) = we owe the agent, − (red) = the agent owes us. Starting + Agent Rake + Players' P&L − Payments.">Current Balance</th>
              <th style={{ padding: '10px 12px' }}>Last Settlement</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }} title="בוצע התחשבנות — mark that this agent's weekly settlement is done">
                בוצע
                <button onClick={handleUncheckAllSettled} title="Uncheck all"
                  style={{ display: 'block', margin: '2px auto 0', background: 'transparent', color: '#60a5fa', border: 'none', cursor: 'pointer', fontSize: '0.68rem', textDecoration: 'underline' }}>
                  uncheck all
                </button>
              </th>
              <th style={{ padding: '10px 12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {mainAgents.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #1e2235', background: selected?.id === a.id ? '#151826' : 'transparent' }}>
                <td style={{ padding: '10px 12px', position: 'sticky', left: 0, background: selected?.id === a.id ? '#151826' : 'var(--bg-card)', zIndex: 1 }}>
                  <button onClick={() => navigate(`/player/${a.id}`)}
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
                <td style={{ padding: '10px 6px', textAlign: 'right', color: '#94a3b8' }}>{a.playerCount}</td>
                <td style={{ padding: '10px 6px', textAlign: 'right', color: '#94a3b8' }}>{a.activePlayerCount ?? 0}</td>
                <td style={{ padding: '10px 6px', textAlign: 'right', color: '#94a3b8' }}>{a.gameCount ?? 0}</td>
                <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '0.85rem' }}>{a.phone || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>{fmt(a.totalRake)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, borderLeft: '2px solid #475569' }} className={balanceClass(a.agentRake)}>{fmt(a.agentRake)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(a.pendingBalance)}>{fmt(a.pendingBalance)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(a.periodPnl)}>{fmt(a.periodPnl)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }} className={editingStart === a.id ? '' : balanceClass(a.openingBalance)}>
                  {editingStart === a.id ? (
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input type="number" step="0.01" value={startInput} autoFocus
                        onChange={e => setStartInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveStartingBalance(a); if (e.key === 'Escape') setEditingStart(null); }}
                        style={{ ...inputStyle, width: 90, textAlign: 'right' }} />
                      <button onClick={() => saveStartingBalance(a)} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>✓</button>
                      <button onClick={() => setEditingStart(null)} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>✗</button>
                    </span>
                  ) : (
                    <span onClick={() => { setEditingStart(a.id); setStartInput(a.openingBalance != null ? Number(a.openingBalance).toString() : ''); }}
                      style={{ cursor: 'pointer' }} title="Click to edit the starting balance (records a new opening entry)">
                      {fmt(a.openingBalance)}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: '1.02rem' }} className={balanceClass(a.currentBalance)}
                  title={Number(a.currentBalance) > 0 ? 'We owe the agent' : Number(a.currentBalance) < 0 ? 'The agent owes us' : 'Settled'}>
                  {fmt(a.currentBalance)}
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.85rem' }}>{a.lastSettlementDate ? fmtDateOnly(a.lastSettlementDate) : '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <input type="checkbox" checked={!!a.settledThisWeek} onChange={() => handleToggleSettledWeek(a)}
                    title="בוצע התחשבנות" style={{ cursor: 'pointer', width: 16, height: 16 }} />
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => openSettle(a)}
                    title="Record a settlement transfer with this agent"
                    style={{ padding: '4px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.82rem',
                      background: '#1d4ed8', color: '#fff' }}>
                    Settle
                  </button>
                </td>
              </tr>
            ))}
            {mainAgents.length === 0 && (
              <tr><td colSpan={15} style={{ padding: '2rem', color: '#64748b', textAlign: 'center' }}>No agents configured</td></tr>
            )}
            {mainAgents.length > 0 && (
              <tr style={{ borderTop: '1px solid #334155', background: '#12151f' }}>
                <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 700, position: 'sticky', left: 0, background: '#12151f', zIndex: 1 }}>Total</td>
                <td />
                <td style={{ padding: '10px 6px', textAlign: 'right', color: '#94a3b8', fontWeight: 700 }}>{summaryTotalPlayers}</td>
                <td style={{ padding: '10px 6px', textAlign: 'right', color: '#94a3b8', fontWeight: 700 }}>{summaryTotalActive}</td>
                <td style={{ padding: '10px 6px', textAlign: 'right', color: '#e2e8f0', fontWeight: 700 }}>{summaryTotalGames}</td>
                <td />{/* Phone — no total */}
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#e2e8f0', fontWeight: 700 }}>{fmt(summaryTotalRake)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, borderLeft: '2px solid #475569' }} className={balanceClass(summaryTotalAgentRake)}>{fmt(summaryTotalAgentRake)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }} className={balanceClass(summaryTotalPending)}>{fmt(summaryTotalPending)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }} className={balanceClass(summaryTotalPnl)}>{fmt(summaryTotalPnl)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }} className={balanceClass(summaryTotalStarting)}>{fmt(summaryTotalStarting)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: '1.02rem' }} className={balanceClass(summaryTotalCurrentBalance)}>{fmt(summaryTotalCurrentBalance)}</td>
                <td />{/* Last Settlement */}
                <td />{/* בוצע */}
                <td />{/* Action */}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Club-managed agents — settled directly by the club, excluded from the totals above */}
      {clubManagedAgents.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ color: '#4ade80', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
            Club-managed agents ({clubManagedAgents.length}) — handled by the club directly, not counted in the totals above
          </div>
          <div className="card" style={{ padding: 0, overflowX: 'auto', opacity: 0.85 }}>
            <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2d3148', color: '#94a3b8', textAlign: 'left', fontSize: '0.82rem', background: '#12151f' }}>
                  <th style={{ padding: '10px 12px' }}>Agent</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Players</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Active</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Games</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Chips</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Rake</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {clubManagedAgents.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #1e2235' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => navigate(`/player/${a.id}`)}
                        style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontWeight: 600 }}>{a.username}</button>
                      {a.fullName && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{a.fullName}</span>}
                      {a.phone && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>📞 {a.phone}</span>}
                      <button onClick={() => handleToggleClubManaged(a)}
                        title="Remove club-managed" style={{ marginLeft: '0.5rem', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #22c55e55', background: '#14532d', color: '#4ade80' }}>✓ club-managed</button>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{a.playerCount}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{a.activePlayerCount ?? 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{a.gameCount ?? 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#e2e8f0' }}>{fmt(a.totalChips)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{fmt(a.totalRake)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(a.periodPnl)}>{fmt(a.periodPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                    {a.phone && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>📞 {a.phone}</span>}
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
                  {/* Agent balance summary — same reconciliation as the single-agent view */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'baseline', marginBottom: '0.7rem', padding: '0.5rem 0.6rem', background: '#12151f', borderRadius: '6px', fontSize: '0.82rem', color: '#94a3b8' }}>
                    <span>Current balance: <strong style={{ fontSize: '1.15rem' }} className={balanceClass(a.currentBalance)}>{fmt(a.currentBalance)}</strong>
                      <span style={{ color: '#64748b', marginLeft: 4 }}>({Number(a.currentBalance) > 0 ? 'we owe agent' : Number(a.currentBalance) < 0 ? 'agent owes us' : 'settled'})</span></span>
                    <span style={{ marginLeft: 'auto' }}>= Starting <strong className={balanceClass(a.openingBalance)}>{fmt(a.openingBalance)}</strong> − Agent Rake <strong className={balanceClass(a.agentRake)}>{fmt(a.agentRake)}</strong> − P&L <strong className={balanceClass(a.periodPnl)}>{fmt(a.periodPnl)}</strong></span>
                    {Number(a.ticketWorth) > 0 && (
                      <span style={{ width: '100%', color: '#c084fc' }}>🎟 כרטיס ללייב שאנחנו חייבים בשווי <strong>{fmt(a.ticketWorth)}</strong> — כרטיס, לא כסף</span>
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.82rem', padding: '0.5rem' }}>No players / no data for the selected range</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #2d3148', color: '#64748b', textAlign: 'left', fontSize: '0.8rem' }}>
                          <th style={{ padding: '6px' }}>Player</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Chips</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Games</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Club Rake</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Agent Share</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(p => (
                          <AgentPlayerRow key={p.playerId} player={p} showBalance={false}
                            expanded={expandedIds.has(p.playerId)} onToggle={() => toggleExpand(p.playerId)} />
                        ))}
                        <tr style={{ borderTop: '1px solid #334155', background: '#12151f', fontWeight: 700 }}>
                          <td style={{ padding: '6px', color: '#e2e8f0' }}>Total</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#e2e8f0' }}>{fmt(tChips)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#94a3b8' }}>{tGames}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#f59e0b' }}>{fmt(tRake)}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#fbbf24' }}>{fmt(tShare)}</td>
                          <td style={{ padding: '6px', textAlign: 'right' }} className={balanceClass(tPnl)}>{fmt(tPnl)}</td>
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
              <span style={{ color: '#64748b', fontSize: '0.82rem' }} title="Dates for THIS agent only. Defaults to the range chosen on the agents page — change freely just for this agent.">Dates (this agent)</span>
              <span style={{ color: '#64748b', fontSize: '0.82rem' }}>From</span>
              <DateInput value={filterFrom} onChange={v => { setFilterFrom(v); fetchStats(selected.id, v, filterTo); loadBalance(selected.id, v, filterTo); }} style={inputStyle} />
              <span style={{ color: '#64748b', fontSize: '0.82rem' }}>To</span>
              <DateInput value={filterTo} onChange={v => { setFilterTo(v); fetchStats(selected.id, filterFrom, v); loadBalance(selected.id, filterFrom, v); }} style={inputStyle} />
              {detailOverridesPage && (summaryFrom || summaryTo) && (
                <button onClick={resetToPageDates} title="Snap back to the range chosen on the agents page"
                  style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: '0.82rem' }}>
                  ↺ Page dates
                </button>
              )}
              {(filterFrom || filterTo) && (
                <button onClick={handleClearFilter} title="Clear the filter (show all-time)"
                  style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #2d3148', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Detail tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #2d3148' }}>
            {[['dashboard', 'Dashboard'], ['players', 'Players & Games']].map(([key, label]) => (
              <button key={key} onClick={() => setDetailTab(key)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 1.1rem',
                  color: detailTab === key ? '#60a5fa' : '#64748b', fontWeight: detailTab === key ? 700 : 400, fontSize: '0.92rem',
                  borderBottom: detailTab === key ? '2px solid #60a5fa' : '2px solid transparent', marginBottom: '-1px' }}>
                {label}
              </button>
            ))}
          </div>

          {detailTab === 'dashboard' && (<>
          {/* Running balance ledger */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <strong style={{ color: '#e2e8f0' }}>Current Balance</strong>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.25rem' }} className={balanceClass(balance?.currentBalance)}>
                  {fmt(balance?.currentBalance)}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.8rem' }} title="Amounts are from the agent's point of view: + = we owe the agent, − = the agent owes us">
                  {Number(balance?.currentBalance) > 0 ? 'We owe the agent' : Number(balance?.currentBalance) < 0 ? 'The agent owes us' : 'Settled'}
                  {!balance?.hasBaseline && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>⚠ no starting balance set — counting all-time</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => { setOpeningForm(openingForm ? null : { amount: '', effectiveDate: '', notes: '' }); setPaymentForm(null); }}
                  style={{ ...inputStyle, cursor: 'pointer', color: '#a78bfa', fontWeight: 600 }}>Set starting balance</button>
                <button onClick={() => openSettle(selected)}
                  style={{ ...inputStyle, cursor: 'pointer', color: '#4ade80', fontWeight: 600 }}>Settle</button>
              </div>
            </div>

            {/* Breakdown: starting − rake − players' P&L + payments = current (agent owes us) */}
            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              <span>Starting {balance?.openingDate ? `(${fmtDateOnly(balance.openingDate)})` : '(none)'}: <strong className={balanceClass(balance?.openingBalance)}>{fmt(balance?.openingBalance)}</strong></span>
              <span>− Agent Rake: <strong className={balanceClass(balance?.rakebackSince)}>{fmt(balance?.rakebackSince)}</strong> <span style={{ color: '#64748b' }}>(of {fmt(balance?.totalRake)} rake)</span></span>
              <span>− Players' P&L: <strong className={balanceClass(balance?.playerPnlSince)}>{fmt(balance?.playerPnlSince)}</strong> <span style={{ color: '#64748b' }}>({Number(balance?.playerPnlSince) >= 0 ? 'won' : 'lost'})</span></span>
              <span>− Payments: <strong className={balanceClass(balance?.paymentsSince)}>{fmt(balance?.paymentsSince)}</strong></span>
              {Number(balance?.ticketWorth) > 0 && (
                <span style={{ width: '100%', color: '#c084fc' }}>🎟 כרטיס ללייב שאנחנו חייבים בשווי <strong>{fmt(balance?.ticketWorth)}</strong> — כרטיס, לא כסף</span>
              )}
            </div>

            {/* Set-opening form */}
            {openingForm && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#12151f', borderRadius: '6px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Starting balance (+ = we owe agent, − = agent owes us)</div>
                  <input type="number" step="0.01" value={openingForm.amount} autoFocus
                    onChange={e => setOpeningForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, width: 200 }} /></div>
                <div><div style={{ color: '#64748b', fontSize: '0.75rem' }}>As of date</div>
                  <DateInput value={openingForm.effectiveDate} onChange={v => setOpeningForm(f => ({ ...f, effectiveDate: v }))} style={inputStyle} /></div>
                <div style={{ flex: 1, minWidth: 140 }}><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Note</div>
                  <input value={openingForm.notes} onChange={e => setOpeningForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></div>
                <button onClick={submitOpening} disabled={ledgerSaving}
                  style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{ledgerSaving ? 'Saving…' : 'Save'}</button>
              </div>
            )}

            {/* Settle & Pay form — single signed amount, dated today */}
            {paymentForm && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#12151f', borderRadius: '6px' }}>
                <div style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Enter the amount paid. Put a <strong>minus (−)</strong> if the <strong>agent paid you</strong>. Logged with today's date ({fmtDateOnly(new Date().toISOString())}).
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Amount (+ we paid agent, − agent paid us)</div>
                    <input type="number" step="0.01" value={paymentForm.amount} autoFocus
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, width: 200 }} /></div>
                  <div style={{ flex: 1, minWidth: 140 }}><div style={{ color: '#64748b', fontSize: '0.75rem' }}>Note</div>
                    <input value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, width: '100%' }} /></div>
                  <button onClick={submitPayment} disabled={ledgerSaving}
                    style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{ledgerSaving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            )}

            {/* Ledger history (collapsible) */}
            {ledger.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <button onClick={() => setHistoryOpen(o => !o)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0 }}>
                  {historyOpen ? '▾' : '▸'} Ledger history ({ledger.length})
                </button>
                {historyOpen && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '0.35rem' }}>
                  <tbody>
                    {ledger.map(e => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #1e2235' }}>
                        <td style={{ padding: '4px 8px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDateOnly(e.effectiveDate)}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, background: e.type === 'OPENING' ? '#3b2a5f' : '#14532d', color: e.type === 'OPENING' ? '#c4b5fd' : '#4ade80' }}>
                            {e.type === 'OPENING' ? 'opening' : (Number(e.amount) >= 0 ? 'paid agent' : 'agent paid')}
                          </span>
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(e.type === 'PAYMENT' ? -e.amount : e.amount)}>{fmt(e.amount)}</td>
                        <td style={{ padding: '4px 8px', color: '#64748b' }}>{e.notes || ''}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                          <button onClick={() => removeLedgerEntry(e.id)} title="Delete entry"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            )}
          </div>

          {/* Agent's own transactions (deposits, payments, transfers incl. settlements) */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <button onClick={() => setAgentTxOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: '0.95rem' }}>
              {agentTxOpen ? '▾' : '▸'} Transactions ({agentTx.length})
            </button>
            {agentTxOpen && (
              agentTx.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '0.6rem 0' }}>No transactions for this agent.</div>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ color: '#64748b', textAlign: 'left', fontSize: '0.8rem', borderBottom: '1px solid #2d3148' }}>
                        <th style={{ padding: '6px 8px' }}>Date</th>
                        <th style={{ padding: '6px 8px' }}>Type</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '6px 8px' }}>Method</th>
                        <th style={{ padding: '6px 8px' }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentTx.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #1e2235' }}>
                          <td style={{ padding: '6px 8px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDateOnly(t.transactionDate)}</td>
                          <td style={{ padding: '6px 8px', color: '#e2e8f0' }}>{t.type}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(t.amount)}</td>
                          <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{t.method || ''}</td>
                          <td style={{ padding: '6px 8px', color: '#64748b' }}>{t.notes || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
          </>)}

          {detailTab === 'players' && (<>
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
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map(p => (
                      <AgentPlayerRow key={p.playerId} player={p} showBalance={true} expanded={expandedIds.has(p.playerId)} onToggle={() => toggleExpand(p.playerId)} />
                    ))}
                    {playerStats.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>No data for selected period</td></tr>
                    )}
                    {playerStats.length > 1 && (
                      <tr style={{ borderTop: '1px solid #334155', background: '#12151f' }}>
                        <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 700 }}>Total</td>
                        <td />
                        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{playerStats.reduce((s, p) => s + p.gameCount, 0)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>{fmt(statsTotalRake)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24', fontWeight: 700 }}>{fmt(statsTotalShare)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }} className={balanceClass(statsTotalPnl)}>{fmt(statsTotalPnl)}</td>
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
          </>)}
        </div>
      )}
    </div>
  );
}
