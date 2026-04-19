import { useState, useEffect } from 'react';
import { getAdminExpenses, deleteAdminExpense, updateAdminExpense, getPromotions, updateClubExpense, deleteClubExpense, payAdminExpense, payClubExpense, getBankAccounts, getAdminUsers } from '../api';

export default function AdminExpenses() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [expandedAdmins, setExpandedAdmins] = useState({});
  const [promotions, setPromotions] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  // payForm: { entryId, entryType, source: 'admin'|'bank', adminUsername: '', bankAccountId: '' }
  const [payForm, setPayForm] = useState(null);
  const [paying, setPaying] = useState(false);

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

  const admins = data?.admins || [];
  const grandTotal = data?.grandTotal || 0;
  const paid = data?.paid || [];
  const paidTotal = paid.reduce((s, e) => s + Number(e.amount || 0), 0);

  const wheelAdmin = admins.find(a => a.adminUsername === 'Wheel');
  const clubAdmins = admins.filter(a => a.adminUsername !== 'Wheel');
  const wheelEntries = wheelAdmin?.entries || [];
  const wheelTotal = Number(wheelAdmin?.total || 0);

  const chipPromoEntries = promotions?.entries?.filter(e => e.type === 'CHIP_PROMO') || [];
  const writeOffEntries = promotions?.entries?.filter(e => e.type === 'PROMOTION') || [];
  const chipPromoTotal = Number(promotions?.chipPromoTotal || 0);
  const writeOffTotal = Number(promotions?.writeOffTotal || 0);
  const wheelPromoTotal = wheelTotal + chipPromoTotal;

  const adminExpensesTotal = clubAdmins.reduce((s, a) => s + Number(a.total || 0), 0);
  const totalWithPaid = adminExpensesTotal + paidTotal;

  const inputStyle = { background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '5px 9px', borderRadius: '5px', fontSize: '0.82rem' };

  return (
    <div>
      <div className="page-header">
        <h1>Admin Expenses</h1>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Grand Total: <strong style={{ color: '#e2e8f0' }}>{fmt(totalWithPaid)}</strong>
        </span>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {clubAdmins.length === 0 && wheelEntries.length === 0 && chipPromoEntries.length === 0 && writeOffEntries.length === 0 && (
        <div className="card" style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
          No expense records yet. Import the management XLS or add expenses from the Transfers page.
        </div>
      )}

      {/* Per-admin unsettled expense groups */}
      {clubAdmins.map(admin => (
        <div key={admin.adminUsername} className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand(admin.adminUsername)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>{admin.adminUsername}</strong>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                {admin.entries.length} {admin.entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(admin.total)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins[admin.adminUsername] ? '▲' : '▼'}</span>
            </div>
          </div>

          {expandedAdmins[admin.adminUsername] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Source</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {admin.entries.map(entry => {
                    const isPayOpen = payForm?.entryId === entry.id;
                    return (
                      <>
                        <tr key={`${entry.type || 'ADMIN_EXPENSE'}-${entry.id}`}>
                          {editing?.id === entry.id ? (
                            <td colSpan={5} style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
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
                                {entry.expenseDate || '—'}
                              </td>
                              <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                              <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                              <td>
                                {entry.sourceRef === 'CLUB_EXPENSE' ? (
                                  <span style={{ fontSize: '0.75rem', background: '#3b1f00', color: '#f59e0b', borderRadius: '4px', padding: '2px 6px' }}>Club Expense</span>
                                ) : (entry.sourceRef === 'XLS' || (entry.sourceRef?.startsWith('XLS:') && entry.sourceRef !== 'XLS:WHEEL')) ? (
                                  <span style={{ fontSize: '0.75rem', background: '#1e3a5f', color: '#60a5fa', borderRadius: '4px', padding: '2px 6px' }}>XLS</span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', background: '#14532d', color: '#4ade80', borderRadius: '4px', padding: '2px 6px' }}>Manual</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
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
                              </td>
                            </>
                          )}
                        </tr>
                        {isPayOpen && (
                          <tr key={`pay-${entry.id}`}>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Unified Paid section */}
      {paid.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__paid')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#4ade80', fontSize: '1.05rem' }}>✓ Paid</strong>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{paid.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#4ade80', fontSize: '1.1rem' }}>{fmt(paidTotal)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__paid'] ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedAdmins['__paid'] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Who</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Description</th>
                    <th style={{ textAlign: 'right', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Paid On</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Paid From</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.map(e => (
                    <tr key={`${e.entityType}-${e.id}`}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{e.expenseDate || '—'}</td>
                      <td style={{ color: '#a5b4fc', fontSize: '0.85rem' }}>{e.who || '—'}</td>
                      <td style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{e.notes || '—'}</td>
                      <td style={{ textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>{fmt(e.amount)}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{e.settledAt || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{e.paidFromAdminUsername || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grand Total */}
      {(clubAdmins.length > 0 || paid.length > 0) && (
        <div className="card" style={{ borderTopColor: '#ef4444', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__grandtotal')}>
            <strong style={{ color: '#e2e8f0' }}>Grand Total Expenses</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>{fmt(totalWithPaid)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__grandtotal'] ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedAdmins['__grandtotal'] && (
            <div style={{ marginTop: '0.75rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem' }}>
              <table style={{ width: '100%' }}>
                <tbody>
                  {clubAdmins.map(a => (
                    <tr key={a.adminUsername}>
                      <td style={{ color: '#94a3b8', padding: '0.2rem 0' }}>{a.adminUsername}</td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(a.total)}</td>
                    </tr>
                  ))}
                  {paidTotal > 0 && (
                    <tr>
                      <td style={{ color: '#4ade80', padding: '0.2rem 0' }}>✓ Paid</td>
                      <td style={{ textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>{fmt(paidTotal)}</td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '1px solid #334155' }}>
                    <td style={{ color: '#e2e8f0', fontWeight: 700, paddingTop: '0.4rem' }}>Total</td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 700, fontSize: '1.05rem', paddingTop: '0.4rem' }}>{fmt(totalWithPaid)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Wheel & Chip Promo */}
      {(wheelEntries.length > 0 || chipPromoEntries.length > 0) && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#d97706', opacity: 0.85 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__wheelpromo')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#fbbf24', fontSize: '1.05rem' }}>🎡 Wheel & Chip Promo</strong>
              <span style={{ fontSize: '0.72rem', background: '#3b2a00', color: '#fbbf24', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{wheelEntries.length + chipPromoEntries.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                Wheel: <span style={{ color: '#fb923c' }}>{fmt(wheelTotal)}</span>
                {' · '}
                Chip Promo: <span style={{ color: '#fbbf24' }}>{fmt(chipPromoTotal)}</span>
              </span>
              <strong style={{ color: '#f59e0b', fontSize: '1.1rem' }}>{fmt(wheelPromoTotal)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__wheelpromo'] ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedAdmins['__wheelpromo'] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Player / Source</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Type</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {wheelEntries.map(entry => (
                    <tr key={`wheel-${entry.id}`}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.expenseDate || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>—</td>
                      <td><span style={{ fontSize: '0.75rem', background: '#431407', color: '#fb923c', borderRadius: '4px', padding: '2px 6px' }}>Wheel</span></td>
                      <td style={{ color: '#fb923c', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                    </tr>
                  ))}
                  {chipPromoEntries.map(entry => (
                    <tr key={`chip-${entry.id}`}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.transactionDate || '—'}</td>
                      <td style={{ color: '#e2e8f0' }}>{entry.playerFullName || entry.playerUsername}</td>
                      <td><span style={{ fontSize: '0.75rem', background: '#3b2a00', color: '#fbbf24', borderRadius: '4px', padding: '2px 6px' }}>Chip Promo</span></td>
                      <td style={{ color: '#fbbf24', fontWeight: 600 }}>{fmt(entry.amount)}</td>
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
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#0891b2', opacity: 0.85 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__writeoffs')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#22d3ee', fontSize: '1.05rem' }}>✏️ Write-offs</strong>
              <span style={{ fontSize: '0.72rem', background: '#0c2232', color: '#22d3ee', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{writeOffEntries.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#22d3ee', fontSize: '1.1rem' }}>{fmt(writeOffTotal)}</strong>
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
                      <td style={{ textAlign: 'right', color: '#22d3ee', fontWeight: 600 }}>{fmt(entry.amount)}</td>
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
