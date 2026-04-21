import { useState, useEffect } from 'react';
import { getWalletSummary, getWalletHistory, getBankAccounts, setAdminStartingBalance, getBankTransactions, addBankTransaction, deleteBankTransaction } from '../api';

export default function ClubWallets() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [bankAccounts, setBankAccountsState] = useState([]);
  const [bankTxns, setBankTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [startingBalanceForms, setStartingBalanceForms] = useState({});
  const [startingBalanceSaving, setStartingBalanceSaving] = useState(null);

  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterHolder, setFilterHolder] = useState('');
  const [filterMethod, setFilterMethod] = useState('');

  // Bank add-entry form
  const [bbForm, setBbForm] = useState(null); // null = hidden, {} = open
  const [bbSaving, setBbSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      getWalletSummary(),
      getWalletHistory({ from: filterFrom || undefined, to: filterTo || undefined, holder: (filterHolder && !filterHolder.startsWith('BANK_')) ? filterHolder : undefined }),
      getBankAccounts(),
      getBankTransactions(),
    ]).then(([sumRes, histRes, bankRes, btRes]) => {
      setSummary(sumRes.data);
      setHistory(histRes.data);
      setBankAccountsState(bankRes.data);
      setBankTxns(btRes.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const applyFilters = () => load();

  const handleAddBankTransaction = async () => {
    const val = parseFloat(bbForm?.amount);
    if (isNaN(val)) { setMsg({ type: 'error', text: 'Enter a valid amount' }); return; }
    setBbSaving(true);
    try {
      await addBankTransaction({ amount: val, transactionDate: bbForm?.date || null, notes: bbForm?.notes || null });
      setMsg({ type: 'success', text: 'Bank entry added' });
      setBbForm(null);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to add bank entry' });
    }
    setBbSaving(false);
  };

  const handleDeleteBankTransaction = async (id) => {
    if (!window.confirm('Delete this bank entry?')) return;
    try {
      await deleteBankTransaction(id);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete entry' });
    }
  };

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const date = d.substring(8, 10) + '-' + d.substring(5, 7) + '-' + d.substring(0, 4);
    if (d.length > 10) {
      const time = d.substring(11, 16);
      return date + ' ' + time;
    }
    return date;
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  const adminWallets = summary?.adminWallets || [];
  const bankWallets = summary?.bankAccounts || [];
  const clubTotal = summary?.clubTotal || 0;
  const unassignedTotal = summary?.unassignedTotal || 0;

  // Synthetic starting-balance rows from the wallet summary
  const startingRows = (() => {
    if (filterHolder && filterHolder.startsWith('BANK_')) return [];
    const walletsToShow = filterHolder
      ? adminWallets.filter(w => w.adminUsername === filterHolder)
      : adminWallets;
    const rows = [];
    for (const w of walletsToShow) {
      const amount = w.breakdown?.STARTING;
      if (!amount || Number(amount) === 0) continue;
      rows.push({
        id: `sb_${w.adminUsername}`,
        _synthetic: true,
        type: 'STARTING',
        toAdminUsername: w.adminUsername,
        fromAdminUsername: null,
        amount: Number(amount),
        transferDate: null,
        createdAt: null,
        notes: 'Opening balance',
        createdByUsername: null,
      });
    }
    return rows;
  })();

  const transferHistory = history.filter(h => {
    if (h.unassigned) return false;
    if (filterHolder) {
      const isBank = filterHolder.startsWith('BANK_');
      if (isBank) {
        const bank = bankWallets.find(b => `BANK_${b.id}` === filterHolder);
        const bankName = bank?.name;
        if (h.fromBankAccount !== bankName && h.toBankAccount !== bankName) return false;
      } else {
        if (h.fromAdminUsername !== filterHolder && h.toAdminUsername !== filterHolder) return false;
      }
    }
    return true;
  });

  const isBankFilter = filterHolder && filterHolder.startsWith('BANK_');

  // When Bank is selected, show bank transactions instead of admin transfers
  const bankTxnRows = isBankFilter ? bankTxns
    .filter(t => {
      if (filterFrom && t.transactionDate && t.transactionDate < filterFrom) return false;
      if (filterTo && t.transactionDate && t.transactionDate > filterTo) return false;
      return true;
    })
    .map(t => ({
      id: `bt_${t.id}`,
      _bankTxn: true,
      _bankTxnId: t.id,
      type: 'BANK',
      transferDate: t.transactionDate,
      createdAt: t.createdAt,
      amount: Number(t.amount),
      notes: t.notes,
      createdByUsername: t.createdBy,
    })) : [];

  const assignedHistory = isBankFilter
    ? bankTxnRows
    : [...startingRows, ...transferHistory];


  // Returns { signedAmount, color } for a history row based on selected holder
  const getAmountDisplay = (h) => {
    let isReceiving = false;
    let isPaying = false;

    if (filterHolder) {
      const isBank = filterHolder.startsWith('BANK_');
      if (!isBank) {
        isReceiving = h.toAdminUsername === filterHolder;
        isPaying = h.fromAdminUsername === filterHolder;
      } else {
        const bankId = parseInt(filterHolder.replace('BANK_', ''), 10);
        const bank = bankWallets.find(b => b.id === bankId);
        const bankName = bank?.name;
        isReceiving = h.toBankAccount === bankName;
        isPaying = h.fromBankAccount === bankName;
      }
    } else {
      // No filter: color by direction — fromAdmin = paying out (red), toAdmin = receiving (green)
      isPaying = !!h.fromAdminUsername || h.type === 'EXPENSE_PAID';
      isReceiving = !!h.toAdminUsername && h.type !== 'EXPENSE_PAID';
    }

    if (isReceiving) return { signedAmount: Math.abs(h.amount), color: '#4ade80' };
    if (isPaying) return { signedAmount: -Math.abs(h.amount), color: '#ef4444' };
    return { signedAmount: h.amount, color: '#94a3b8' };
  };

  const handleSetStartingBalance = async (adminUsername) => {
    const form = startingBalanceForms[adminUsername] || {};
    const toNum = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    setStartingBalanceSaving(adminUsername);
    try {
      await setAdminStartingBalance(adminUsername, {
        amount: toNum(form.amount),
        notes: form.notes || null,
      });
      setMsg({ type: 'success', text: `Starting balance set for ${adminUsername}` });
      setStartingBalanceForms(f => { const n = { ...f }; delete n[adminUsername]; return n; });
      load();
    } catch (e) {
      const errMsg = e?.response?.data?.error || 'Failed to set starting balance';
      setMsg({ type: 'error', text: errMsg });
    }
    setStartingBalanceSaving(null);
  };

const METHOD_LABEL = { BIT: 'Bit', PAYBOX: 'Paybox', KASHCASH: 'Kashcash', CASH: 'Cash', OTHER: 'Other', TRANSFER: 'Transfer', ADJUSTMENT: 'Adjustment', EXPENSES: 'Expenses', EXPENSE_PAID: 'Expense', STARTING: 'Opening' };
  const METHOD_COLOR = { BIT: '#3b82f6', PAYBOX: '#a855f7', KASHCASH: '#06b6d4', CASH: '#22c55e', OTHER: '#475569', TRANSFER: '#64748b', ADJUSTMENT: '#f59e0b', EXPENSES: '#ef4444', STARTING: '#475569' };

  const MethodPill = ({ method }) => {
    if (!method) return null;
    const label = METHOD_LABEL[method] || method;
    const color = METHOD_COLOR[method] || '#64748b';
    return (
      <span style={{ fontSize: '0.72rem', background: color + '22', color, border: `1px solid ${color}55`, borderRadius: '4px', padding: '1px 6px', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    );
  };

  // Holder options for filter
  const holderOptions = [
    ...adminWallets.map(w => ({ value: w.adminUsername, label: w.adminUsername })),
    ...bankWallets.map(w => ({ value: `BANK_${w.id}`, label: `🏦 ${w.name}` })),
  ];

  return (
    <div>
      <h1>Club Wallets</h1>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ marginBottom: '1rem' }}>{msg.text}</div>}

      {/* Summary card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Balances</h2>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Holder</th>
              <th style={{ textAlign: 'right', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {adminWallets.map(w => {
              const alreadySet = w.startingBalance != null;
              const form = startingBalanceForms[w.adminUsername] || null;
              const isSaving = startingBalanceSaving === w.adminUsername;
              return (
                <>
                  <tr key={w.adminUsername}>
                    <td style={{ color: '#e2e8f0', padding: '0.4rem 0' }}>
                      <span>{w.adminUsername}</span>
                      {' '}
                      {alreadySet ? (
                        <span style={{ fontSize: '0.7rem', color: '#475569', marginLeft: '6px' }}>
                          🔒 Starting: {fmt(w.startingBalance)}
                          <button onClick={() => setStartingBalanceForms(f => form ? (({ [w.adminUsername]: _, ...rest }) => rest)(f) : { ...f, [w.adminUsername]: { amount: w.startingBalance ?? '', notes: w.startingBalanceNotes || '' } })}
                            style={{ fontSize: '0.65rem', background: 'none', border: '1px solid #7c3aed55', color: '#7c3aed', borderRadius: '4px', padding: '1px 5px', cursor: 'pointer', marginLeft: '6px' }}>
                            {form ? '✕' : '✏️'}
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setStartingBalanceForms(f => form ? (({ [w.adminUsername]: _, ...rest }) => rest)(f) : { ...f, [w.adminUsername]: { amount: '', notes: '' } })}
                          style={{ fontSize: '0.7rem', background: 'none', border: '1px solid #334155', color: '#64748b', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', marginLeft: '6px' }}>
                          {form ? '✕' : '+ Set Starting'}
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: Number(w.balance) >= 0 ? '#4ade80' : '#ef4444' }}>{fmt(w.balance)}</td>
                  </tr>
                  {form && (
                    <tr key={`${w.adminUsername}-starting-form`}>
                      <td colSpan={2} style={{ background: '#12151f', padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Starting Balance (₪)</label>
                            <input type="number" step="0.01" placeholder="0" value={form.amount || ''}
                              onChange={e => setStartingBalanceForms(f => ({ ...f, [w.adminUsername]: { ...f[w.adminUsername], amount: e.target.value } }))}
                              style={{ background: '#1a1d2e', border: '1px solid #60a5fa55', color: '#e2e8f0', padding: '5px 8px', borderRadius: '5px', width: '140px' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Notes</label>
                            <input type="text" placeholder="e.g. Balance as of April 2026" value={form.notes || ''}
                              onChange={e => setStartingBalanceForms(f => ({ ...f, [w.adminUsername]: { ...f[w.adminUsername], notes: e.target.value } }))}
                              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '5px 8px', borderRadius: '5px', width: '200px' }} />
                          </div>
                          <button onClick={() => handleSetStartingBalance(w.adminUsername)} disabled={isSaving}
                            style={{ padding: '5px 12px', borderRadius: '5px', background: '#1e3a5f', border: 'none', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                            {isSaving ? '...' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {bankWallets.map(b => (
              <>
                <tr key={b.id ?? 'bank'}>
                  <td style={{ color: '#34d399', padding: '0.4rem 0' }}>
                    🏦 {b.name}
                    <button onClick={() => setBbForm(f => f ? null : { amount: '', date: '', notes: '' })}
                      style={{ fontSize: '0.7rem', background: 'none', border: '1px solid #334155', color: '#64748b', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', marginLeft: '8px' }}>
                      {bbForm ? '✕' : '+ Add Entry'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#34d399' }}>{fmt(b.balance)}</td>
                </tr>
                {bbForm && (
                  <tr key="bank-add-form">
                    <td colSpan={2} style={{ background: '#12151f', padding: '0.6rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Amount (₪) *</label>
                          <input type="number" step="0.01" placeholder="e.g. 5000 or -1000" value={bbForm.amount}
                            onChange={e => setBbForm(f => ({ ...f, amount: e.target.value }))}
                            style={{ background: '#1a1d2e', border: '1px solid #34d39955', color: '#e2e8f0', padding: '5px 8px', borderRadius: '5px', width: '140px' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Date</label>
                          <input type="date" value={bbForm.date}
                            onChange={e => setBbForm(f => ({ ...f, date: e.target.value }))}
                            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '5px 8px', borderRadius: '5px' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Notes</label>
                          <input type="text" placeholder="e.g. April deposit" value={bbForm.notes}
                            onChange={e => setBbForm(f => ({ ...f, notes: e.target.value }))}
                            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '5px 8px', borderRadius: '5px', width: '200px' }} />
                        </div>
                        <button onClick={handleAddBankTransaction} disabled={bbSaving}
                          style={{ padding: '5px 12px', borderRadius: '5px', background: '#064e3b', border: 'none', color: '#34d399', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                          {bbSaving ? '...' : 'Add'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {unassignedTotal !== 0 && (
              <tr>
                <td style={{ color: '#64748b', padding: '0.4rem 0', fontStyle: 'italic' }}>Unassigned</td>
                <td style={{ textAlign: 'right', color: '#64748b' }}>{fmt(unassignedTotal)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '1px solid #2d3148' }}>
              <td style={{ color: '#e2e8f0', fontWeight: 700, padding: '0.6rem 0' }}>Club Total</td>
              <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: Number(clubTotal) >= 0 ? '#60a5fa' : '#ef4444' }}>{fmt(clubTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* History filters */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>History</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>From</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>To</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Holder</label>
            <select value={filterHolder} onChange={e => setFilterHolder(e.target.value)}
              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
              <option value="">All holders</option>
              {holderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={applyFilters}>Apply</button>
        </div>

        {assignedHistory.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '1.5rem' }}>No history entries</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Method</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Notes</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {assignedHistory.map(h => {
                  const isBankRow = h._bankTxn;
                  const { signedAmount, color } = (h._synthetic || isBankRow)
                    ? { signedAmount: h.amount, color: h.amount >= 0 ? '#4ade80' : '#ef4444' }
                    : getAmountDisplay(h);
                  return (
                    <tr key={h.id} style={(h._synthetic || isBankRow) ? { opacity: 0.9, fontStyle: isBankRow ? 'normal' : 'italic' } : undefined}>
                      <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{(h._synthetic && !isBankRow) ? '—' : fmtDate(h.transferDate || h.createdAt)}</td>
                      <td>
                        <span style={{ fontSize: '0.78rem', background: h._synthetic ? '#1a3a1a' : isBankRow ? '#0f2a1a' : '#1e3a5f', color: h._synthetic ? '#4ade80' : isBankRow ? '#34d399' : '#60a5fa', borderRadius: '4px', padding: '2px 6px' }}>
                          {h._synthetic ? 'OPENING' : isBankRow ? 'BANK' : (h.type || 'Transfer')}
                        </span>
                      </td>
                      <td style={{ color: '#64748b' }}>{(h._synthetic || isBankRow) ? '—' : (h.fromAdminUsername ? <span style={{ color: '#e2e8f0' }}>{h.fromAdminUsername}</span> : h.fromBankAccount ? <span style={{ color: '#34d399' }}>🏦 {h.fromBankAccount}</span> : <span style={{ color: '#f59e0b' }}>{h.fromPlayer || 'CLUB'}</span>)}</td>
                      <td style={{ color: isBankRow ? '#34d399' : h.toAdminUsername ? '#e2e8f0' : h.toBankAccount ? '#34d399' : '#f59e0b' }}>
                        {isBankRow ? '🏦 Bank' : (h.toAdminUsername || (h.toBankAccount ? `🏦 ${h.toBankAccount}` : (h.toPlayer || 'CLUB')))}
                      </td>
                      <td><MethodPill method={h.method} /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color }}>{fmt(signedAmount)}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{h.notes || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {h.createdByUsername || '—'}
                        {isBankRow && (
                          <button onClick={() => handleDeleteBankTransaction(h._bankTxnId)}
                            style={{ marginLeft: '6px', fontSize: '0.65rem', background: 'none', border: '1px solid #ef444455', color: '#ef4444', borderRadius: '4px', padding: '1px 5px', cursor: 'pointer' }}>
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {(() => {
                const total = assignedHistory.reduce((sum, h) => sum + ((h._synthetic || h._bankTxn) ? h.amount : getAmountDisplay(h).signedAmount), 0);
                const totalColor = total > 0 ? '#4ade80' : total < 0 ? '#ef4444' : '#94a3b8';
                return (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #334155' }}>
                      <td colSpan={5} style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.5rem' }}>Total ({assignedHistory.length} entries)</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: totalColor, fontSize: '1rem', paddingTop: '0.5rem' }}>{fmt(total)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
