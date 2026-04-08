import { useState, useEffect } from 'react';
import { getAdminExpenses, deleteAdminExpense, updateAdminExpense, getPromotions } from '../api';

export default function AdminExpenses() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [expandedAdmins, setExpandedAdmins] = useState({});
  const [promotions, setPromotions] = useState(null);

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
      await updateAdminExpense(editing.id, { amount, notes: editing.notes || null });
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

  // Split admins: Wheel goes to the Wheel & Promo group, rest are Club Expenses
  const wheelAdmin = admins.find(a => a.adminUsername === 'Wheel');
  const clubAdmins = admins.filter(a => a.adminUsername !== 'Wheel');
  const wheelEntries = wheelAdmin?.entries || [];
  const wheelTotal = wheelAdmin?.total || 0;

  const chipPromoEntries = promotions?.entries?.filter(e => e.type === 'CHIP_PROMO') || [];
  const writeOffEntries = promotions?.entries?.filter(e => e.type === 'PROMOTION') || [];
  const chipPromoTotal = Number(promotions?.chipPromoTotal || 0);
  const writeOffTotal = Number(promotions?.writeOffTotal || 0);
  const wheelPromoTotal = Number(wheelTotal) + chipPromoTotal;

  return (
    <div>
      <div className="page-header">
        <h1>Admin Expenses</h1>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Grand Total: <strong style={{ color: '#e2e8f0' }}>{fmt(grandTotal)}</strong>
        </span>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {/* Wheel & Promo group */}
      {(wheelEntries.length > 0 || chipPromoEntries.length > 0) && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#d97706' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__wheelpromo')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#fbbf24', fontSize: '1.05rem' }}>🎡 Wheel & Chip Promo</strong>
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
                      <td>
                        <span style={{ fontSize: '0.75rem', background: '#431407', color: '#fb923c', borderRadius: '4px', padding: '2px 6px' }}>Wheel</span>
                      </td>
                      <td style={{ color: '#fb923c', fontWeight: 600 }}>{fmt(entry.amount)}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{entry.notes || '—'}</td>
                    </tr>
                  ))}
                  {chipPromoEntries.map(entry => (
                    <tr key={`chip-${entry.id}`}>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem', paddingTop: '0.4rem' }}>{entry.transactionDate || '—'}</td>
                      <td style={{ color: '#e2e8f0' }}>{entry.playerFullName || entry.playerUsername}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', background: '#3b2a00', color: '#fbbf24', borderRadius: '4px', padding: '2px 6px' }}>Chip Promo</span>
                      </td>
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

      {/* Write-offs group */}
      {writeOffEntries.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: '#0891b2' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleExpand('__writeoffs')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: '#22d3ee', fontSize: '1.05rem' }}>✏️ Write-offs</strong>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                {writeOffEntries.length} {writeOffEntries.length === 1 ? 'entry' : 'entries'}
              </span>
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
                    <tr key={entry.id}>
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
                            {(entry.sourceRef === 'XLS' || (entry.sourceRef?.startsWith('XLS:') && entry.sourceRef !== 'XLS:WHEEL')) ? (
                              <span style={{ fontSize: '0.75rem', background: '#1e3a5f', color: '#60a5fa', borderRadius: '4px', padding: '2px 6px' }}>XLS</span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', background: '#14532d', color: '#4ade80', borderRadius: '4px', padding: '2px 6px' }}>Manual</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 10px', fontSize: '0.78rem', marginRight: '0.35rem' }}
                              onClick={() => setEditing({ id: entry.id, adminUsername: admin.adminUsername, amount: entry.amount, notes: entry.notes })}
                            >Edit</button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 10px', fontSize: '0.78rem', color: '#ef4444' }}
                              onClick={() => handleDelete(entry.id)}
                            >Delete</button>
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

      {(clubAdmins.length > 0 || wheelEntries.length > 0 || chipPromoEntries.length > 0) && (
        <div className="card" style={{ borderTopColor: '#ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ color: '#e2e8f0' }}>Grand Total Expenses</strong>
          <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>{fmt(grandTotal)}</strong>
        </div>
      )}
    </div>
  );
}
