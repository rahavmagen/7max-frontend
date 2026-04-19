import { useState, useEffect } from 'react';
import { getWalletSummary, getWalletHistory, getBankAccounts, setBankBalance, setAdminStartingBalance } from '../api';

export default function ClubWallets() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [bankAccounts, setBankAccountsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [expandedAdmins, setExpandedAdmins] = useState(new Set());
  const [startingBalanceForms, setStartingBalanceForms] = useState({}); // { adminUsername: { amount, notes } }
  const [startingBalanceSaving, setStartingBalanceSaving] = useState(null);

  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterHolder, setFilterHolder] = useState('');
  const [filterMethod, setFilterMethod] = useState('');

  // Bank balance correction
  const [bbInput, setBbInput] = useState('');
  const [bbSaving, setBbSaving] = useState(false);
  const [bbEditing, setBbEditing] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      getWalletSummary(),
      getWalletHistory({ from: filterFrom || undefined, to: filterTo || undefined, holder: filterHolder || undefined }),
      getBankAccounts(),
    ]).then(([sumRes, histRes, bankRes]) => {
      setSummary(sumRes.data);
      setHistory(histRes.data);
      setBankAccountsState(bankRes.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const applyFilters = () => load();

  const handleSetBankBalance = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const val = parseFloat(bbInput);
    if (isNaN(val)) { setMsg({ type: 'error', text: 'Enter a valid number' }); return; }
    setBbSaving(true);
    try {
      await setBankBalance(val);
      setMsg({ type: 'success', text: 'Bank balance updated' });
      setBbInput('');
      setBbEditing(false);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update bank balance' });
    }
    setBbSaving(false);
  };

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return d.substring(8, 10) + '-' + d.substring(5, 7) + '-' + d.substring(0, 4);
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  const adminWallets = summary?.adminWallets || [];
  const bankWallets = summary?.bankAccounts || [];
  const clubTotal = summary?.clubTotal || 0;
  const unassignedTotal = summary?.unassignedTotal || 0;

  const assignedHistory = history.filter(h => !h.unassigned && (!filterMethod || h.method === filterMethod || (filterMethod === 'EXPENSE_PAID' && h.type === 'EXPENSE_PAID')));
  const unassignedHistory = history.filter(h => h.unassigned);

  // Unique methods present in history for the method filter dropdown
  const historyMethods = [...new Set(history.filter(h => !h.unassigned).map(h => h.method || (h.type === 'EXPENSE_PAID' ? 'EXPENSE_PAID' : null)).filter(Boolean))];

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
        cashAmount: toNum(form.cash),
        bitAmount: toNum(form.bit),
        payboxAmount: toNum(form.paybox),
        otherAmount: toNum(form.other),
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

  const toggleAdmin = (username) => {
    setExpandedAdmins(prev => {
      const next = new Set(prev);
      next.has(username) ? next.delete(username) : next.add(username);
      return next;
    });
  };

  const METHOD_LABEL = { BIT: 'Bit', PAYBOX: 'Paybox', CASH: 'Cash', OTHER: 'Other', TRANSFER: 'Transfer', ADJUSTMENT: 'Adjustment', EXPENSES: 'Expenses', EXPENSE_PAID: 'Expense', STARTING_CASH: 'Starting Cash', STARTING_BIT: 'Starting Bit', STARTING_PAYBOX: 'Starting Paybox', STARTING_OTHER: 'Starting Other' };
  const METHOD_COLOR = { BIT: '#3b82f6', PAYBOX: '#a855f7', CASH: '#22c55e', OTHER: '#475569', TRANSFER: '#64748b', ADJUSTMENT: '#f59e0b', EXPENSES: '#ef4444', STARTING_CASH: '#475569', STARTING_BIT: '#475569', STARTING_PAYBOX: '#475569', STARTING_OTHER: '#475569' };

  // Merge STARTING_* into base method keys for the breakdown panel
  const consolidateBreakdown = (breakdown) => {
    const MERGE_INTO = { STARTING_CASH: 'CASH', STARTING_BIT: 'BIT', STARTING_PAYBOX: 'PAYBOX', STARTING_OTHER: 'OTHER' };
    const merged = {};
    for (const [method, amount] of Object.entries(breakdown)) {
      const key = MERGE_INTO[method] || method;
      merged[key] = (merged[key] || 0) + Number(amount);
    }
    return merged;
  };

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
              const isOpen = expandedAdmins.has(w.adminUsername);
              const breakdown = w.breakdown || {};
              const hasBreakdown = Object.keys(breakdown).length > 0;
              const alreadySet = w.startingBalance != null;
              const form = startingBalanceForms[w.adminUsername] || null;
              const isSaving = startingBalanceSaving === w.adminUsername;
              return (
                <>
                  <tr key={w.adminUsername}>
                    <td style={{ color: '#e2e8f0', padding: '0.4rem 0', userSelect: 'none' }}>
                      <span onClick={() => hasBreakdown && toggleAdmin(w.adminUsername)} style={{ cursor: hasBreakdown ? 'pointer' : 'default' }}>
                        {hasBreakdown && (
                          <span style={{ marginRight: '6px', fontSize: '0.7rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                        )}
                        {w.adminUsername}
                      </span>
                      {' '}
                      {alreadySet ? (
                        <span style={{ fontSize: '0.7rem', color: '#475569', marginLeft: '6px' }}>
                          🔒 Starting: {fmt(w.startingBalance)}
                          {import.meta.env.VITE_ALLOW_STARTING_BALANCE_RESET === 'true' && (
                            <button onClick={() => setStartingBalanceForms(f => form ? (({ [w.adminUsername]: _, ...rest }) => rest)(f) : { ...f, [w.adminUsername]: { cash: '', bit: '', paybox: '', other: '', notes: '' } })}
                              style={{ fontSize: '0.65rem', background: 'none', border: '1px solid #7c3aed55', color: '#7c3aed', borderRadius: '4px', padding: '1px 5px', cursor: 'pointer', marginLeft: '6px' }}>
                              {form ? '✕' : '✏️'}
                            </button>
                          )}
                        </span>
                      ) : (
                        <button onClick={() => setStartingBalanceForms(f => form ? (({ [w.adminUsername]: _, ...rest }) => rest)(f) : { ...f, [w.adminUsername]: { cash: '', bit: '', paybox: '', other: '', notes: '' } })}
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
                          {[['cash', 'Cash', '#22c55e'], ['bit', 'Bit', '#3b82f6'], ['paybox', 'Paybox', '#a855f7'], ['other', 'Other', '#64748b']].map(([key, label, color]) => (
                            <div key={key}>
                              <label style={{ fontSize: '0.72rem', color, display: 'block', marginBottom: '2px' }}>{label} (₪)</label>
                              <input type="number" step="0.01" placeholder="0" value={form[key] || ''}
                                onChange={e => setStartingBalanceForms(f => ({ ...f, [w.adminUsername]: { ...f[w.adminUsername], [key]: e.target.value } }))}
                                style={{ background: '#1a1d2e', border: `1px solid ${color}55`, color: '#e2e8f0', padding: '5px 8px', borderRadius: '5px', width: '100px' }} />
                            </div>
                          ))}
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
                  {isOpen && Object.entries(consolidateBreakdown(breakdown)).map(([method, amount]) => (
                    <tr key={`${w.adminUsername}-${method}`}>
                      <td style={{ paddingLeft: '2.5rem', paddingTop: '2px', paddingBottom: '2px', borderLeft: '2px solid #1e293b' }}>
                        <MethodPill method={method} />
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.85rem', color: Number(amount) >= 0 ? '#4ade80' : '#ef4444', paddingRight: '6rem' }}>{fmt(amount)}</td>
                    </tr>
                  ))}
                </>
              );
            })}
            {bankWallets.map(b => (
              <>
                <tr key={b.id}>
                  <td style={{ color: '#34d399', padding: '0.4rem 0' }}>
                    🏦 {b.name}
                    <button onClick={() => { setBbEditing(e => { if (!e) setBbInput(String(b.balance ?? '')); else setBbInput(''); return !e; }); }}
                      style={{ fontSize: '0.7rem', background: 'none', border: '1px solid #334155', color: '#64748b', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', marginLeft: '8px' }}>
                      {bbEditing ? '✕' : '✏️ Edit'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#34d399' }}>{fmt(b.balance)}</td>
                </tr>
                {bbEditing && (
                  <tr key={`${b.id}-edit`}>
                    <td colSpan={2} style={{ background: '#12151f', padding: '0.6rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input type="number" step="0.01" placeholder="New balance (₪)" value={bbInput}
                          onChange={e => setBbInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSetBankBalance()}
                          style={{ background: '#1a1d2e', border: '1px solid #34d39955', color: '#e2e8f0', padding: '5px 8px', borderRadius: '5px', width: '160px' }} />
                        <button onClick={handleSetBankBalance} disabled={bbSaving}
                          style={{ padding: '5px 12px', borderRadius: '5px', background: '#064e3b', border: 'none', color: '#34d399', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                          {bbSaving ? '...' : 'Save'}
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
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Method</label>
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
              <option value="">All methods</option>
              {historyMethods.map(m => <option key={m} value={m}>{METHOD_LABEL[m] || m}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={applyFilters}>Apply</button>
        </div>

        {assignedHistory.length === 0 && unassignedHistory.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '1.5rem' }}>No history entries</div>
        ) : (
          <>
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
                  </tr>
                </thead>
                <tbody>
                  {assignedHistory.map(h => {
                    const { signedAmount, color } = getAmountDisplay(h);
                    return (
                      <tr key={h.id}>
                        <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{fmtDate(h.transferDate)}</td>
                        <td><span style={{ fontSize: '0.78rem', background: '#1e3a5f', color: '#60a5fa', borderRadius: '4px', padding: '2px 6px' }}>{h.type || 'Transfer'}</span></td>
                        <td style={{ color: h.fromAdminUsername ? '#e2e8f0' : h.fromBankAccount ? '#34d399' : '#f59e0b' }}>
                          {h.fromAdminUsername || (h.fromBankAccount ? `🏦 ${h.fromBankAccount}` : (h.fromPlayer || 'CLUB'))}
                        </td>
                        <td style={{ color: h.toAdminUsername ? '#e2e8f0' : h.toBankAccount ? '#34d399' : '#f59e0b' }}>
                          {h.toAdminUsername || (h.toBankAccount ? `🏦 ${h.toBankAccount}` : (h.toPlayer || 'CLUB'))}
                        </td>
                        <td><MethodPill method={h.method} /></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color }}>{fmt(signedAmount)}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{h.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {unassignedHistory.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Unassigned (legacy — no admin set)</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>From</th>
                        <th>To</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedHistory.map(h => (
                        <tr key={h.id} style={{ opacity: 0.65 }}>
                          <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{fmtDate(h.transferDate)}</td>
                          <td><span style={{ fontSize: '0.78rem', background: '#2d3148', color: '#94a3b8', borderRadius: '4px', padding: '2px 6px' }}>{h.type || 'Transfer'}</span></td>
                          <td style={{ color: '#94a3b8' }}>{h.fromPlayer || 'CLUB'}</td>
                          <td style={{ color: '#94a3b8' }}>{h.toPlayer || 'CLUB'}</td>
                          <td style={{ textAlign: 'right', color: '#94a3b8' }}>{fmt(h.amount)}</td>
                          <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{h.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
