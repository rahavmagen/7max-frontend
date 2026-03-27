import { useState, useEffect } from 'react';
import { getAdminExpenses, deleteAdminExpense, updateAdminExpense } from '../api';

export default function AdminExpenses() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id, adminUsername, amount, notes }
  const [msg, setMsg] = useState(null);
  const [expandedAdmins, setExpandedAdmins] = useState({});

  const load = () => {
    setLoading(true);
    getAdminExpenses().then(r => { setData(r.data); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const toggleExpand = (username) => {
    setExpandedAdmins(prev => ({ ...prev, [username]: !prev[username] }));
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

      {admins.length === 0 && (
        <div className="card" style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
          No expense records yet. Import the management XLS or add expenses from the Transfers page.
        </div>
      )}

      {admins.map(admin => (
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
            <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem' }}>
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
                            {entry.sourceRef === 'XLS' ? (
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

      {admins.length > 0 && (
        <div className="card" style={{ borderTopColor: '#ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ color: '#e2e8f0' }}>Grand Total Expenses</strong>
          <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>{fmt(grandTotal)}</strong>
        </div>
      )}
    </div>
  );
}
