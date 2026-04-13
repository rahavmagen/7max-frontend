import { useState, useEffect } from 'react';
import { getAdminExpenses, deleteAdminExpense, updateAdminExpense, getPromotions, settleClubExpense, updateClubExpense, deleteClubExpense, settleAdminExpense } from '../api';

export default function AdminExpenses() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id, type: 'ADMIN_EXPENSE'|'CLUB_EXPENSE', amount, notes }
  const [msg, setMsg] = useState(null);
  const [expandedAdmins, setExpandedAdmins] = useState({});
  const [promotions, setPromotions] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [payingType, setPayingType] = useState(null); // 'CLUB_EXPENSE' | 'ADMIN_EXPENSE'
  const [payForm, setPayForm] = useState({ settledAt: new Date().toISOString().slice(0, 10), method: 'CASH' });

  const load = () => {
    setLoading(true);
    Promise.all([
      getAdminExpenses(),
      getPromotions(),
    ]).then(([expRes, promoRes]) => {
      setData(expRes.data);
      setPromotions(promoRes.data);
      setLoading(false);
    });
  };

  const startPay = (id, type) => {
    setPayingId(id);
    setPayingType(type);
    setPayForm({ settledAt: new Date().toISOString().slice(0, 10), method: 'CASH' });
  };

  const handlePay = async (id, type) => {
    try {
      if (type === 'CLUB_EXPENSE') {
        await settleClubExpense(id, { settledAt: payForm.settledAt, method: payForm.method });
      } else {
        await settleAdminExpense(id, { settledAt: payForm.settledAt });
      }
      setPayingId(null);
      setPayingType(null);
      setPayForm({ settledAt: new Date().toISOString().slice(0, 10), method: 'CASH' });
      setMsg({ type: 'success', text: 'Paid' });
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to pay' });
    }
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await deleteAdminExpense(id);
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

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  const admins = data?.admins || [];
  const grandTotal = data?.grandTotal || 0;
  const paidClubExpenses = data?.paidClubExpenses || [];
  const paidClubTotal = paidClubExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // Split admins: Wheel goes to the Wheel & Promo group, rest are Club Expenses
  const wheelAdmin = admins.find(a => a.adminUsername === 'Wheel');
  const clubAdmins = admins.filter(a => a.adminUsername !== 'Wheel');
  const wheelEntries = wheelAdmin?.entries || [];
  const wheelTotal = Number(wheelAdmin?.total || 0);

  const chipPromoEntries = promotions?.entries?.filter(e => e.type === 'CHIP_PROMO') || [];
  const writeOffEntries = promotions?.entries?.filter(e => e.type === 'PROMOTION') || [];
  const chipPromoTotal = Number(promotions?.chipPromoTotal || 0);
  const writeOffTotal = Number(promotions?.writeOffTotal || 0);
  const wheelPromoTotal = wheelTotal + chipPromoTotal;

  // Grand Total = non-wheel admin expenses + write-offs + paid club expenses (wheel & chip promo are chip-based, shown below)
  const totalWithPaid = (Number(grandTotal) - wheelTotal) + writeOffTotal + paidClubTotal;

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

      {/* Club Expenses (per-admin, excluding Wheel) */}
      {clubAdmins.length === 0 && wheelEntries.length === 0 && chipPromoEntries.length === 0 && writeOffEntries.length === 0 && (
        <div className="card" style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
          No expense records yet. Import the management XLS or add expenses from the Transfers page.
        </div>
      )}

      {clubAdmins.map(admin => (
        <div key={admin.adminUsername} className="card" style={{ marginBottom: '1rem' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand(admin.adminUsername)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>{admin.adminUsername}</strong>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                {admin.entries.length} {admin.entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{fmt(admin.total)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                {expandedAdmins[admin.adminUsername] ? '▲' : '▼'}
              </span>
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
                  {admin.entries.map(entry => (
                    <tr key={`${entry.type || 'ADMIN_EXPENSE'}-${entry.id}`}>
                      {editing?.id === entry.id ? (
                        <td colSpan={5} style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                          <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="number" step="0.01" min="0.01" required
                              value={editing.amount}
                              onChange={e => setEditing(prev => ({ ...prev, amount: e.target.value }))}
                              style={{ width: '120px', background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px' }}
                            />
                            <input
                              type="text"
                              value={editing.notes || ''}
                              onChange={e => setEditing(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Notes"
                              style={{ flex: 1, minWidth: '160px', background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px' }}
                            />
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
                            {payingId === entry.id ? (
                              <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                {entry.type === 'CLUB_EXPENSE' && ['CASH', 'CHIPS'].map(m => (
                                  <button key={m} type="button"
                                    onClick={() => setPayForm(f => ({ ...f, method: m }))}
                                    style={{ padding: '2px 10px', borderRadius: '4px', border: '1px solid', fontSize: '0.78rem', cursor: 'pointer',
                                      background: payForm.method === m ? '#2d3148' : 'transparent',
                                      borderColor: payForm.method === m ? '#22c55e' : '#475569',
                                      color: payForm.method === m ? '#22c55e' : '#94a3b8' }}>
                                    {m === 'CASH' ? '💵 Cash' : '🎰 Chips'}
                                  </button>
                                ))}
                                <input type="date" value={payForm.settledAt} onChange={e => setPayForm(f => ({ ...f, settledAt: e.target.value }))}
                                  style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '3px 8px', borderRadius: '4px', fontSize: '0.82rem' }} />
                                <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                                  onClick={() => handlePay(entry.id, payingType)}>✓ Confirm</button>
                                <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                                  onClick={() => { setPayingId(null); setPayingType(null); }}>✕</button>
                              </span>
                            ) : (
                              <>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 10px', fontSize: '0.78rem', marginRight: '0.25rem' }}
                                  onClick={() => setEditing({ id: entry.id, type: entry.type || 'ADMIN_EXPENSE', amount: entry.amount, notes: entry.notes })}
                                >Edit</button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 10px', fontSize: '0.78rem', color: '#ef4444', marginRight: '0.25rem' }}
                                  onClick={() => handleDeleteEntry(entry)}
                                >Delete</button>
                                <button className="btn btn-primary"
                                  style={{ padding: '3px 10px', fontSize: '0.78rem', background: '#166534', borderColor: '#22c55e', color: '#22c55e' }}
                                  onClick={() => startPay(entry.id, entry.type || 'ADMIN_EXPENSE')}>
                                  💸 Pay
                                </button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Paid Club Expenses */}
      {paidClubExpenses.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#16a34a' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__paid')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#22c55e', fontSize: '1.05rem' }}>✓ Paid Expenses</strong>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{paidClubExpenses.length} entries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: '#22c55e', fontSize: '1.1rem' }}>{fmt(paidClubTotal)}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{expandedAdmins['__paid'] ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedAdmins['__paid'] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Date</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Admin</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Description</th>
                    <th style={{ textAlign: 'right', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Amount</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Paid On</th>
                    <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: '0.5rem' }}>Paid By</th>
                  </tr>
                </thead>
                <tbody>
                  {paidClubExpenses.map(e => (
                    <tr key={`paid-${e.id}`}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{e.expenseDate || '—'}</td>
                      <td style={{ color: '#a5b4fc', fontSize: '0.85rem' }}>👤 {e.adminUser}</td>
                      <td style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{e.notes || '—'}</td>
                      <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmt(e.amount)}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{e.settledAt || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{e.settledBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Write-offs — chip-based, shown above Grand Total */}
      {writeOffEntries.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#0891b2', opacity: 0.85 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__writeoffs')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#22d3ee', fontSize: '1.05rem' }}>✏️ Write-offs</strong>
              <span style={{ fontSize: '0.72rem', background: '#0c2232', color: '#22d3ee', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                {writeOffEntries.length} {writeOffEntries.length === 1 ? 'entry' : 'entries'}
              </span>
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

      {(clubAdmins.length > 0 || paidClubExpenses.length > 0 || writeOffEntries.length > 0) && (
        <div className="card" style={{ borderTopColor: '#ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <strong style={{ color: '#e2e8f0' }}>Grand Total Expenses</strong>
          <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>{fmt(totalWithPaid)}</strong>
        </div>
      )}

      {/* Wheel & Chip Promo — chip-based, shown below Grand Total for info only */}
      {(wheelEntries.length > 0 || chipPromoEntries.length > 0) && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#d97706', opacity: 0.85 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__wheelpromo')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#fbbf24', fontSize: '1.05rem' }}>🎡 Wheel & Chip Promo</strong>
              <span style={{ fontSize: '0.72rem', background: '#3b2a00', color: '#fbbf24', borderRadius: '4px', padding: '2px 7px' }}>chips only</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                {wheelEntries.length + chipPromoEntries.length} entries
              </span>
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
    </div>
  );
}
