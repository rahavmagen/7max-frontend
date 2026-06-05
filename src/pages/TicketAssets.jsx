import React, { useState, useEffect, useRef } from 'react';
import { getTicketAssets, buyTickets, grantTicket, getAdminUsers, getActivePlayers, markTicketGrantUsed } from '../api';
import DateInput from '../components/DateInput';
import { fmtDateOnly } from '../utils/dates';

function PlayerSearchSelect({ players, value, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = players.find(p => p.username === value);
  const displayText = selected
    ? selected.username + (selected.fullName ? ` — ${selected.fullName}` : '')
    : '';

  const filtered = players.filter(p =>
    search === '' ||
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  );

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '240px' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: value ? '#e2e8f0' : '#64748b', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', minHeight: '34px', fontSize: '0.875rem' }}
      >
        {value ? displayText : 'Select player...'}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: '6px', zIndex: 100, maxHeight: '240px', overflowY: 'auto' }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            style={{ width: '100%', background: '#0f1117', border: 'none', borderBottom: '1px solid #2d3148', color: '#e2e8f0', padding: '7px 10px', boxSizing: 'border-box', fontSize: '0.875rem' }}
            onClick={e => e.stopPropagation()}
          />
          {filtered.length === 0
            ? <div style={{ padding: '8px 12px', color: '#64748b', fontSize: '0.85rem' }}>No players found</div>
            : filtered.map(p => (
              <div key={p.id}
                onClick={() => { onChange(p.username); setOpen(false); setSearch(''); }}
                style={{ padding: '7px 10px', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.875rem', borderBottom: '1px solid #1a1d2e' }}
                onMouseEnter={e => e.currentTarget.style.background = '#2d3148'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <strong>{p.username}</strong>
                {p.fullName && <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>{p.fullName}</span>}
                {p.phone && <span style={{ color: '#475569', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{p.phone}</span>}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

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

  // Grant state: { assetId, playerUsername, grantType: '' | 'CHIPS' | 'LIVE' }
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
    if (!grantState?.playerUsername || !grantState?.grantType) {
      setMsg({ type: 'error', text: 'Select a player and grant type' });
      return;
    }
    setSubmitting(true);
    try {
      await grantTicket(assetId, grantState.playerUsername, grantState.grantType);
      setMsg({ type: 'success', text: `Ticket granted (${grantState.grantType === 'CHIPS' ? 'chips added to player' : 'live – not yet used'})` });
      setGrantState(null);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to grant ticket' });
    }
    setSubmitting(false);
  };

  const handleMarkUsed = async (grantId) => {
    setSubmitting(true);
    try {
      await markTicketGrantUsed(grantId);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to mark as used' });
    }
    setSubmitting(false);
  };

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    return '₪' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtDate = fmtDateOnly;

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
                <DateInput value={buyForm.purchaseDate} onChange={v => setBuyForm(f => ({ ...f, purchaseDate: v }))} />
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
                              onClick={() => setGrantState(isGrantOpen ? null : { assetId: asset.id, playerUsername: '', grantType: '' })}>
                              {isGrantOpen ? 'Cancel' : 'Grant'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Grant form row */}
                      {isGrantOpen && (
                        <tr key={`grant-${asset.id}`}>
                          <td colSpan={8} style={{ background: '#12151f', padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Player</label>
                                <PlayerSearchSelect
                                  players={players}
                                  value={grantState.playerUsername}
                                  onChange={v => setGrantState(s => ({ ...s, playerUsername: v }))}
                                />
                              </div>
                              {grantState.playerUsername && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Grant Type</label>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[
                                      { key: 'CHIPS', label: '🎰 Chips', desc: 'Add face value as chips', activeBg: '#14532d', activeColor: '#4ade80', activeBorder: '#22c55e' },
                                      { key: 'LIVE', label: '🎫 Live', desc: 'Will use ticket at event', activeBg: '#1e3a5f', activeColor: '#60a5fa', activeBorder: '#3b82f6' },
                                    ].map(({ key, label, activeBg, activeColor, activeBorder }) => (
                                      <button key={key} type="button"
                                        onClick={() => setGrantState(s => ({ ...s, grantType: key }))}
                                        style={{
                                          padding: '6px 14px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                          background: grantState.grantType === key ? activeBg : 'transparent',
                                          borderColor: grantState.grantType === key ? activeBorder : '#2d3148',
                                          color: grantState.grantType === key ? activeColor : '#64748b',
                                        }}>
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  {grantState.grantType === 'CHIPS' && (
                                    <div style={{ fontSize: '0.75rem', color: '#4ade80', marginTop: '4px' }}>
                                      +{fmt(asset.faceValuePerTicket)} chips will be added to player
                                    </div>
                                  )}
                                  {grantState.grantType === 'LIVE' && (
                                    <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '4px' }}>
                                      Ticket documented, no chips — mark as used when player attends
                                    </div>
                                  )}
                                </div>
                              )}
                              <button onClick={() => handleGrant(asset.id)}
                                disabled={submitting || !grantState.playerUsername || !grantState.grantType}
                                style={{ padding: '6px 14px', borderRadius: '5px', background: '#166534', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: (!grantState.playerUsername || !grantState.grantType) ? 0.4 : 1 }}>
                                {submitting ? '...' : 'Confirm Grant'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Grants history for this asset */}
                      {asset.grants && asset.grants.length > 0 && (
                        <tr key={`grants-list-${asset.id}`}>
                          <td colSpan={8} style={{ background: '#0d1018', padding: '0 0 0.5rem 1.5rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '4px', paddingTop: '6px' }}>
                              Granted tickets:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {asset.grants.map(g => (
                                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem' }}>
                                  <span style={{ color: '#94a3b8' }}>{fmtDate(g.grantedAt)}</span>
                                  <strong style={{ color: '#e2e8f0' }}>{g.playerUsername}</strong>
                                  {g.playerFullName && <span style={{ color: '#64748b' }}>{g.playerFullName}</span>}
                                  <span style={{
                                    padding: '1px 7px', borderRadius: '4px', fontWeight: 600,
                                    background: g.grantType === 'CHIPS' ? '#14532d' : '#1e3a5f',
                                    color: g.grantType === 'CHIPS' ? '#4ade80' : '#60a5fa',
                                  }}>
                                    {g.grantType === 'CHIPS' ? '🎰 Chips' : '🎫 Live'}
                                  </span>
                                  {g.status === 'USED' ? (
                                    <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>✓ Used{g.usedAt && g.grantType === 'LIVE' ? ` ${fmtDate(g.usedAt)}` : ''}</span>
                                  ) : (
                                    <>
                                      <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>⏳ Not used yet</span>
                                      <button onClick={() => handleMarkUsed(g.id)} disabled={submitting}
                                        style={{ padding: '2px 8px', borderRadius: '4px', background: '#1e3a5f', border: '1px solid #3b82f6', color: '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                        Mark as Used
                                      </button>
                                    </>
                                  )}
                                </div>
                              ))}
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
