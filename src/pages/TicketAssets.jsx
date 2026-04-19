import React, { useState, useEffect } from 'react';
import { getTicketAssets, buyTickets, grantTicket, getAdminUsers, getActivePlayers } from '../api';

export default function TicketAssets() {
  const [assets, setAssets] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Buy form
  const [buyForm, setBuyForm] = useState({
    buyerAdminUsername: '',
    costPerTicket: '',
    faceValuePerTicket: '',
    quantity: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [showBuyForm, setShowBuyForm] = useState(false);

  // Grant state: { assetId, playerSearch, playerUsername }
  const [grantState, setGrantState] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      getTicketAssets(),
      getAdminUsers(),
      getActivePlayers(),
    ]).then(([assRes, adminRes, playRes]) => {
      setAssets(assRes.data);
      setAdminUsers(adminRes.data);
      setPlayers(playRes.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleBuy = async (e) => {
    e.preventDefault();
    if (!buyForm.buyerAdminUsername || !buyForm.costPerTicket || !buyForm.faceValuePerTicket || !buyForm.quantity) {
      setMsg({ type: 'error', text: 'All required fields must be filled' });
      return;
    }
    setSubmitting(true);
    try {
      await buyTickets({
        buyerAdminUsername: buyForm.buyerAdminUsername,
        costPerTicket: parseFloat(buyForm.costPerTicket),
        faceValuePerTicket: parseFloat(buyForm.faceValuePerTicket),
        quantity: parseInt(buyForm.quantity),
        purchaseDate: buyForm.purchaseDate,
        notes: buyForm.notes || null,
      });
      setMsg({ type: 'success', text: 'Tickets purchased and admin expense created' });
      setBuyForm({ buyerAdminUsername: '', costPerTicket: '', faceValuePerTicket: '', quantity: '', purchaseDate: new Date().toISOString().slice(0, 10), notes: '' });
      setShowBuyForm(false);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to buy tickets' });
    }
    setSubmitting(false);
  };

  const handleGrant = async (assetId) => {
    if (!grantState?.playerUsername) {
      setMsg({ type: 'error', text: 'Select a player' });
      return;
    }
    setSubmitting(true);
    try {
      await grantTicket(assetId, grantState.playerUsername);
      setMsg({ type: 'success', text: 'Ticket granted' });
      setGrantState(null);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to grant ticket' });
    }
    setSubmitting(false);
  };

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    return '₪' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalFaceValue = assets.reduce((s, a) => s + Number(a.quantityRemaining) * Number(a.faceValuePerTicket), 0);

  const inputStyle = { background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Ticket Assets</h1>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Total remaining value: <strong style={{ color: '#4ade80' }}>{fmt(totalFaceValue)}</strong>
        </span>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ marginBottom: '1rem' }}>{msg.text}</div>}

      {/* Buy tickets form */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button className={`btn ${showBuyForm ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setShowBuyForm(s => !s)}>
          {showBuyForm ? '✕ Cancel' : '+ Buy Tickets'}
        </button>
      </div>

      {showBuyForm && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#6366f1' }}>
          <h2>Buy Tickets</h2>
          <form onSubmit={handleBuy}>
            <div className="form-row">
              <div className="form-group">
                <label>Buyer Admin *</label>
                <select value={buyForm.buyerAdminUsername} onChange={e => setBuyForm(f => ({ ...f, buyerAdminUsername: e.target.value }))} style={inputStyle} required>
                  <option value="">Select admin...</option>
                  {adminUsers.map(u => { const name = typeof u === 'string' ? u : u.username; return <option key={name} value={name}>{name}</option>; })}
                </select>
              </div>
              <div className="form-group">
                <label>Cost per Ticket (₪) *</label>
                <input type="number" min="0.01" step="0.01" required value={buyForm.costPerTicket}
                  onChange={e => setBuyForm(f => ({ ...f, costPerTicket: e.target.value }))} placeholder="950" />
              </div>
              <div className="form-group">
                <label>Face Value per Ticket (₪) *</label>
                <input type="number" min="0.01" step="0.01" required value={buyForm.faceValuePerTicket}
                  onChange={e => setBuyForm(f => ({ ...f, faceValuePerTicket: e.target.value }))} placeholder="1000" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Quantity *</label>
                <input type="number" min="1" step="1" required value={buyForm.quantity}
                  onChange={e => setBuyForm(f => ({ ...f, quantity: e.target.value }))} placeholder="10" />
              </div>
              <div className="form-group">
                <label>Purchase Date *</label>
                <input type="date" required value={buyForm.purchaseDate}
                  onChange={e => setBuyForm(f => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={buyForm.notes}
                  onChange={e => setBuyForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            {buyForm.costPerTicket && buyForm.faceValuePerTicket && buyForm.quantity && (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Total cost: <strong style={{ color: '#f59e0b' }}>{fmt(parseFloat(buyForm.costPerTicket) * parseInt(buyForm.quantity))}</strong>
                {' · '}
                Total face value: <strong style={{ color: '#4ade80' }}>{fmt(parseFloat(buyForm.faceValuePerTicket) * parseInt(buyForm.quantity))}</strong>
                {' · '}
                An admin expense will be auto-created for the buyer.
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : '+ Buy Tickets'}
            </button>
          </form>
        </div>
      )}

      {/* Inventory table */}
      {assets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
          No tickets purchased yet.
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Cost</th>
                  <th>Face Value</th>
                  <th>Remaining</th>
                  <th>Total Qty</th>
                  <th>Purchase Date</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assets.map(asset => {
                  const isGrantOpen = grantState?.assetId === asset.id;
                  return (
                    <React.Fragment key={asset.id}>
                      <tr>
                        <td style={{ color: '#e2e8f0' }}>{asset.buyerAdminUsername}</td>
                        <td style={{ color: '#f59e0b' }}>{fmt(asset.costPerTicket)}</td>
                        <td style={{ color: '#4ade80' }}>{fmt(asset.faceValuePerTicket)}</td>
                        <td>
                          <strong style={{ color: asset.quantityRemaining > 0 ? '#60a5fa' : '#64748b' }}>
                            {asset.quantityRemaining}
                          </strong>
                        </td>
                        <td style={{ color: '#64748b' }}>{asset.quantityTotal}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{asset.purchaseDate}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{asset.notes || '—'}</td>
                        <td>
                          {asset.quantityRemaining > 0 && (
                            <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                              onClick={() => setGrantState(isGrantOpen ? null : { assetId: asset.id, playerUsername: '' })}>
                              {isGrantOpen ? 'Cancel' : 'Grant'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isGrantOpen && (
                        <tr key={`grant-${asset.id}`}>
                          <td colSpan={8} style={{ background: '#12151f', padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Player</label>
                                <select value={grantState.playerUsername}
                                  onChange={e => setGrantState(s => ({ ...s, playerUsername: e.target.value }))}
                                  style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '0.875rem', minWidth: '200px' }}>
                                  <option value="">Select player...</option>
                                  {players.map(p => <option key={p.id} value={p.username}>{p.username}{p.fullName ? ` — ${p.fullName}` : ''}</option>)}
                                </select>
                              </div>
                              <button onClick={() => handleGrant(asset.id)} disabled={submitting || !grantState.playerUsername}
                                style={{ padding: '6px 14px', borderRadius: '5px', background: '#166534', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                {submitting ? '...' : 'Confirm Grant'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3148', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
            <strong style={{ color: '#64748b' }}>Total remaining face value</strong>
            <strong style={{ color: '#4ade80', fontSize: '1.1rem' }}>{fmt(totalFaceValue)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
