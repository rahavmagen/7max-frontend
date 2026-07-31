import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminExpenses, deleteAdminExpense, updateAdminExpense, getPromotions, updateClubExpense, deleteClubExpense, payAdminExpense, payClubExpense, getBankAccounts, getAdminUsers } from '../api';
import { fmtDateOnly } from '../utils/dates';
import DateInput from '../components/DateInput';

export default function AdminExpenses() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [expandedAdmins, setExpandedAdmins] = useState(() => {
    const open = searchParams.get('open');
    return open ? { [`__${open}`]: true } : {};
  });
  const [promotions, setPromotions] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  // payForm: { entryId, entryType, source: 'admin'|'bank', adminUsername: '', bankAccountId: '' }
  const [payForm, setPayForm] = useState(null);
  const [paying, setPaying] = useState(false);

  // Page-wide date filter (pre-filled from URL when arriving from P&L, editable here too).
  // Applies to every section on the page. Club Expenses additionally gets its own "Paid From"
  // filter on top of this, scoped to that section only.
  const [rangeFrom, setRangeFrom] = useState(() => searchParams.get('from') || '');
  const [rangeTo, setRangeTo] = useState(() => searchParams.get('to') || '');
  const [clubExpensePaidFrom, setClubExpensePaidFrom] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      getAdminExpenses(),
      getPromotions(),
      getBankAccounts(),
      getAdminUsers(),
    ]).then(([expRes, promoRes, bankRes, adminRes]) => {
      setData(expRes.data);
      setPromotions(promoRes.data);
      setBankAccounts(bankRes.data);
      setAdminUsers(adminRes.data);
      setLoading(false);
    });
  };

  const handleConfirmPay = async () => {
    if (!payForm) return;
    setPaying(true);
    try {
      const payload = payForm.source === 'admin'
        ? { paidFromAdminUsername: payForm.adminUsername }
        : (payForm.bankAccountId ? { paidFromBankAccountId: payForm.bankAccountId } : {});

      if (payForm.entryType === 'CLUB_EXPENSE') {
        await payClubExpense(payForm.entryId, payload);
      } else {
        await payAdminExpense(payForm.entryId, payload);
      }
      setMsg({ type: 'success', text: 'Paid' });
      setPayForm(null);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to pay' });
    }
    setPaying(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const open = searchParams.get('open');
    if (!open || loading) return;
    const el = document.getElementById(`section-${open}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, searchParams]);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const toggleExpand = (key) => {
    setExpandedAdmins(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDeleteEntry = async (entry) => {
    if (!confirm('Delete this expense?')) return;
    try {
      if (entry.type === 'CLUB_EXPENSE') {
        await deleteClubExpense(entry.id);
      } else {
        await deleteAdminExpense(entry.id);
      }
      setMsg({ type: 'success', text: 'Deleted' });
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete' });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(editing.amount);
    if (isNaN(amount) || amount <= 0) {
      setMsg({ type: 'error', text: 'Amount must be positive' });
      return;
    }
    try {
      if (editing.type === 'CLUB_EXPENSE') {
        await updateClubExpense(editing.id, { amount, description: editing.notes || null });
      } else {
        await updateAdminExpense(editing.id, { amount, notes: editing.notes || null });
      }
      setMsg({ type: 'success', text: 'Updated' });
      setEditing(null);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update' });
    }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  const inRange = (dateStr) => {
    if (!rangeFrom && !rangeTo) return true;
    const d = (dateStr || '').substring(0, 10);
    if (!d) return false;
    if (rangeFrom && d < rangeFrom) return false;
    if (rangeTo && d > rangeTo) return false;
    return true;
  };

  const allAdmins = (data?.admins || []).map(a => {
    const entries = (a.entries || []).filter(e => inRange(e.expenseDate));
    return { ...a, entries, total: entries.reduce((s, e) => s + Number(e.amount || 0), 0) };
  });
  const paid = (data?.paid || []).filter(e => inRange(e.expenseDate));
  // Agent fees: unsettled AGENT expenses from admin groups + settled AGENT expenses from paid list
  const agentFees = [
    ...allAdmins.flatMap(a => (a.entries || []).filter(e => e.expenseType === 'AGENT').map(e => ({ ...e, settled: false, who: a.adminUsername }))),
    ...paid.filter(e => e.expenseType === 'AGENT'),
  ];
  // Only show non-AGENT expenses in the main admin sections
  const admins = allAdmins
    .map(a => ({ ...a, entries: (a.entries || []).filter(e => e.expenseType !== 'AGENT') }))
    .filter(a => a.entries.length > 0);
  const paidAdminExpenses = paid.filter(e => e.expenseType !== 'AGENT' && e.entityType !== 'CLUB_EXPENSE');
  const paidClubExpenses = paid.filter(e => e.entityType === 'CLUB_EXPENSE');

  const wheelAdmin = admins.find(a => a.adminUsername === 'Wheel');
  const clubAdmins = admins.filter(a => a.adminUsername !== 'Wheel');
  const wheelEntries = wheelAdmin?.entries || [];
  const wheelTotal = Number(wheelAdmin?.total || 0);

  const chipPromoEntries = (promotions?.entries || []).filter(e => e.type === 'CHIP_PROMO' && inRange(e.transactionDate));
  const playerGiftEntries = (promotions?.entries || []).filter(e => e.type === 'PLAYER_GIFT' && inRange(e.transactionDate));
  const writeOffEntries = (promotions?.entries || []).filter(e => e.type === 'PROMOTION' && inRange(e.transactionDate));
  const chipPromoTotal = chipPromoEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const playerGiftTotal = playerGiftEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const writeOffTotal = writeOffEntries.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Unified Club Expenses: admin-attributed (admin_expenses table) + club_expenses table entries,
  // settled or not, all in one flat list with a "Paid From" column (admin wallet or bank account) -
  // which record it came from doesn't change what it is, just where the money moved from.
  const allExpenses = [
    ...clubAdmins.flatMap(a => a.entries.filter(e => e.type !== 'CLUB_EXPENSE').map(e => ({ ...e, who: a.adminUsername, settled: false }))),
    ...paidAdminExpenses.map(e => ({ ...e, settled: true })),
    ...paidClubExpenses.map(e => ({ ...e, settled: true })),
  ];

  const allExpensesTotal = allExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  // "Paid From" filter is scoped to the Club Expenses section only - it narrows what's displayed
  // there without affecting the other sections.
  const paidFromOptions = [...new Set(allExpenses.map(e => e.who).filter(Boolean))].sort();
  const displayedExpenses = clubExpensePaidFrom ? allExpenses.filter(e => e.who === clubExpensePaidFrom) : allExpenses;
  const displayedExpensesTotal = displayedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const agentFeesTotal = agentFees.reduce((s, e) => s + Number(e.amount || 0), 0);

  const pageTotal = allExpensesTotal + wheelTotal + chipPromoTotal + playerGiftTotal + writeOffTotal + agentFeesTotal;

  const inputStyle = { background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '5px 9px', borderRadius: '5px', fontSize: '0.82rem' };

  return (
    <div>
      <div className="page-header">
        <h1>Club Expenses</h1>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Total Expenses: <strong style={{ color: '#e2e8f0' }}>{fmt(pageTotal)}</strong>
        </span>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
        background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd',
        borderRadius: '6px', padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.85rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>Date range (applies to the whole page):</span>
          <label>From</label>
          <DateInput value={rangeFrom} onChange={setRangeFrom} />
          <label>To</label>
          <DateInput value={rangeTo} onChange={setRangeTo} />
        </div>
        {(rangeFrom || rangeTo) && (
          <button
            onClick={() => { setRangeFrom(''); setRangeTo(''); }}
            style={{ background: 'none', border: '1px solid #3b82f6', color: '#93c5fd', borderRadius: '4px', padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {allExpenses.length === 0 && wheelEntries.length === 0 && chipPromoEntries.length === 0 && playerGiftEntries.length === 0 && writeOffEntries.length === 0 && (
        <div className="card" style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
          No expense records yet. Import the management XLS or add expenses from the Transfers page.
        </div>
      )}

      {/* Club Expenses - admin-attributed + club_expenses table, settled or not, one row per expense */}
      {allExpenses.length > 0 && (
        <div id="section-club_expenses" className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__club_expenses')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>Club Expenses</strong>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{displayedExpenses.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(displayedExpensesTotal)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__club_expenses'] ? '▲' : '▼'}</span>
            </div>
          </div>

          {expandedAdmins['__club_expenses'] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }} onClick={e => e.stopPropagation()}>
                <label style={{ color: '#64748b', fontSize: '0.82rem' }}>Paid from:</label>
                <select value={clubExpensePaidFrom} onChange={e => setClubExpensePaidFrom(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {paidFromOptions.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Paid From</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedExpenses.map(entry => {
                    const isPayOpen = payForm?.entryId === entry.id;
                    return (
                      <>
                        <tr key={`${entry.type || 'ADMIN_EXPENSE'}-${entry.id}`}>
                          {editing?.id === entry.id ? (
                            <td colSpan={6} style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                              <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input type="number" step="0.01" min="0.01" required value={editing.amount}
                                  onChange={e => setEditing(prev => ({ ...prev, amount: e.target.value }))}
                                  style={{ width: '120px', ...inputStyle }} />
                                <input type="text" value={editing.notes || ''}
                                  onChange={e => setEditing(prev => ({ ...prev, notes: e.target.value }))}
                                  placeholder="Notes"
                                  style={{ flex: 1, minWidth: '160px', ...inputStyle }} />
                                <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>Save</button>
                                <button type="button" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => setEditing(null)}>Cancel</button>
                              </form>
                            </td>
                          ) : (
                            <>
                              <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem', paddingBottom: '0.4rem' }}>
                                {fmtDateOnly(entry.expenseDate)}
                              </td>
                              <td style={{ color: '#a5b4fc', fontSize: '0.85rem' }}>{entry.who || '—'}</td>
                              <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                              <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                              <td>
                                {entry.settled ? (
                                  <span style={{ fontSize: '0.75rem', background: '#14532d', color: '#4ade80', borderRadius: '4px', padding: '2px 6px' }}>
                                    Paid {entry.settledAt || ''}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', background: '#3b2a00', color: '#fbbf24', borderRadius: '4px', padding: '2px 6px' }}>Pending</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {!entry.settled && (
                                  <>
                                    <button className="btn btn-secondary"
                                      style={{ padding: '3px 10px', fontSize: '0.78rem', marginRight: '0.25rem' }}
                                      onClick={() => setEditing({ id: entry.id, type: entry.type || 'ADMIN_EXPENSE', amount: entry.amount, notes: entry.notes })}
                                    >Edit</button>
                                    <button className="btn btn-secondary"
                                      style={{ padding: '3px 10px', fontSize: '0.78rem', color: '#ef4444', marginRight: '0.25rem' }}
                                      onClick={() => handleDeleteEntry(entry)}
                                    >Delete</button>
                                    <button style={{ padding: '3px 10px', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #4ade80', color: '#4ade80', background: 'transparent', cursor: 'pointer' }}
                                      onClick={() => setPayForm(isPayOpen ? null : { entryId: entry.id, entryType: entry.type || 'ADMIN_EXPENSE', source: 'admin', adminUsername: '', bankAccountId: '' })}>
                                      {isPayOpen ? 'Cancel' : 'Pay'}
                                    </button>
                                  </>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                        {isPayOpen && (
                          <tr key={`pay-${entry.id}`}>
                            <td colSpan={6} style={{ background: '#12151f', padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div>
                                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Paid from</label>
                                  <select value={payForm.source} onChange={e => {
                                    const src = e.target.value;
                                    setPayForm(f => ({ ...f, source: src, adminUsername: '', bankAccountId: src === 'bank' && bankAccounts.length > 0 ? bankAccounts[0].id : '' }));
                                  }} style={inputStyle}>
                                    <option value="admin">Admin wallet</option>
                                    <option value="bank">Bank account</option>
                                  </select>
                                </div>
                                {payForm.source === 'admin' && (
                                  <div>
                                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Admin</label>
                                    <select value={payForm.adminUsername} onChange={e => setPayForm(f => ({ ...f, adminUsername: e.target.value }))} style={inputStyle}>
                                      <option value="">Select admin...</option>
                                      {adminUsers.map(u => { const name = typeof u === 'string' ? u : u.username; return <option key={name} value={name}>{name}</option>; })}
                                    </select>
                                  </div>
                                )}
                                <button onClick={handleConfirmPay} disabled={paying || (payForm.source === 'admin' && !payForm.adminUsername)}
                                  style={{ padding: '5px 14px', borderRadius: '5px', background: '#166534', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                                  {paying ? '...' : 'Confirm Pay'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* Agent Fees Section */}
      {agentFees.length > 0 && (() => {
        // Group agent fees by agent (who)
        const byAgent = {};
        agentFees.forEach(e => {
          const key = e.who || 'Unknown';
          if (!byAgent[key]) byAgent[key] = [];
          byAgent[key].push(e);
        });
        return Object.entries(byAgent).map(([agentName, entries]) => {
          const agentTotal = entries.reduce((s, e) => s + Number(e.amount || 0), 0);
          const expandKey = `__agent_${agentName}`;
          const isPayOpen = (e) => payForm?.entryId === e.id;
          return (
            <div key={agentName} className="card" style={{ marginBottom: '1rem', borderColor: '#4ade8033' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => toggleExpand(expandKey)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>{agentName}</strong>
                  <span style={{ fontSize: '0.72rem', background: '#14532d', color: '#4ade80', borderRadius: '4px', padding: '2px 7px' }}>Agent Fee</span>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(agentTotal)}</strong>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins[expandKey] ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedAdmins[expandKey] && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                        <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                        <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                        <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(entry => (
                        <>
                          <tr key={`agent-fee-${entry.id}`}>
                            <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem', paddingBottom: '0.4rem' }}>
                              {entry.expenseDate || '—'}
                            </td>
                            <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                            <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                            <td>
                              {entry.settled || entry.settledAt ? (
                                <span style={{ fontSize: '0.75rem', background: '#14532d', color: '#4ade80', borderRadius: '4px', padding: '2px 6px' }}>
                                  Paid {entry.settledAt || ''}
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', background: '#3b2a00', color: '#fbbf24', borderRadius: '4px', padding: '2px 6px' }}>Pending</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {!(entry.settled || entry.settledAt) && (
                                <button
                                  style={{ padding: '3px 10px', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #4ade80', color: '#4ade80', background: 'transparent', cursor: 'pointer' }}
                                  onClick={() => setPayForm(isPayOpen(entry) ? null : { entryId: entry.id, entryType: 'ADMIN_EXPENSE', source: 'admin', adminUsername: '', bankAccountId: '' })}
                                >
                                  {isPayOpen(entry) ? 'Cancel' : 'Pay'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isPayOpen(entry) && (
                            <tr key={`pay-agent-${entry.id}`}>
                              <td colSpan={5} style={{ background: '#12151f', padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                  <div>
                                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Paid from</label>
                                    <select value={payForm.source} onChange={e => {
                                      const src = e.target.value;
                                      setPayForm(f => ({ ...f, source: src, adminUsername: '', bankAccountId: src === 'bank' && bankAccounts.length > 0 ? bankAccounts[0].id : '' }));
                                    }} style={inputStyle}>
                                      <option value="admin">Admin wallet</option>
                                      <option value="bank">Bank account</option>
                                    </select>
                                  </div>
                                  {payForm.source === 'admin' && (
                                    <div>
                                      <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Admin</label>
                                      <select value={payForm.adminUsername} onChange={e => setPayForm(f => ({ ...f, adminUsername: e.target.value }))} style={inputStyle}>
                                        <option value="">Select admin...</option>
                                        {adminUsers.map(u => { const name = typeof u === 'string' ? u : u.username; return <option key={name} value={name}>{name}</option>; })}
                                      </select>
                                    </div>
                                  )}
                                  <button onClick={handleConfirmPay} disabled={paying || (payForm.source === 'admin' && !payForm.adminUsername)}
                                    style={{ padding: '5px 14px', borderRadius: '5px', background: '#166534', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                                    {paying ? '...' : 'Confirm Pay'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        });
      })()}


      {/* Wheel */}
      {wheelEntries.length > 0 && (
        <div id="section-wheel" className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__wheel')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>🎡 Wheel</strong>
              <span style={{ fontSize: '0.72rem', background: '#3f1d1d', color: '#ef4444', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{wheelEntries.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(wheelTotal)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__wheel'] ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedAdmins['__wheel'] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {wheelEntries.map(entry => (
                    <tr key={`wheel-${entry.id}`}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.expenseDate || '—'}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary"
                          style={{ padding: '3px 10px', fontSize: '0.78rem', color: '#ef4444' }}
                          onClick={() => handleDeleteEntry(entry)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rakeback */}
      {chipPromoEntries.length > 0 && (
        <div id="section-rakeback" className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__rakeback')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>💰 Rakeback</strong>
              <span style={{ fontSize: '0.72rem', background: '#3f1d1d', color: '#ef4444', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{chipPromoEntries.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(chipPromoTotal)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__rakeback'] ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedAdmins['__rakeback'] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Player</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {chipPromoEntries.map(entry => (
                    <tr key={`chip-${entry.id}`}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.transactionDate || '—'}</td>
                      <td style={{ color: '#e2e8f0' }}>{entry.playerFullName || entry.playerUsername}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Player Gifts */}
      {playerGiftEntries.length > 0 && (
        <div id="section-playergifts" className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__playergifts')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>🎁 Player Gifts</strong>
              <span style={{ fontSize: '0.72rem', background: '#3f1d1d', color: '#ef4444', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{playerGiftEntries.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(playerGiftTotal)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__playergifts'] ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedAdmins['__playergifts'] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Player</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {playerGiftEntries.map(entry => (
                    <tr key={`gift-${entry.id}`}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.transactionDate || '—'}</td>
                      <td style={{ color: '#e2e8f0' }}>{entry.playerFullName || entry.playerUsername}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Write-offs */}
      {writeOffEntries.length > 0 && (
        <div id="section-writeoffs" className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__writeoffs')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>✏️ Write-offs</strong>
              <span style={{ fontSize: '0.72rem', background: '#3f1d1d', color: '#ef4444', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{writeOffEntries.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(writeOffTotal)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__writeoffs'] ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedAdmins['__writeoffs'] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Player</th>
                    <th style={{ textAlign: 'right', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {writeOffEntries.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.transactionDate || '—'}</td>
                      <td style={{ color: '#e2e8f0' }}>{entry.playerFullName || entry.playerUsername}</td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
