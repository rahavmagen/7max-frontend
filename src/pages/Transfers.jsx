import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers, updateCredit, addTransaction, createTransfer, getAllPending, confirmTransfer, confirmTransaction, updateTransfer, updateTransaction, addWheelExpense } from '../api';

const METHODS = ['BIT', 'PAYBOX', 'KASHCASH', 'BANK_TRANSFER', 'CASH', 'OTHER'];
const METHOD_LABELS = { BIT: 'Bit', PAYBOX: 'PayBox', KASHCASH: 'KashCash', BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash', OTHER: 'Other' };

function PlayerSelect({ label, value, onChange, players, excludeId, includeClub = false }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = value === 'CLUB' ? { username: 'CLUB', fullName: '' } : players.find(p => p.id === value);
  const displayText = selected ? (selected.username + (selected.fullName ? ` — ${selected.fullName}` : '')) : '';

  const filteredPlayers = players.filter(p =>
    p.id !== excludeId &&
    (search === '' ||
      p.username.toLowerCase().includes(search.toLowerCase()) ||
      (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.includes(search)))
  );

  const handleSelect = (val) => { onChange(val); setOpen(false); setSearch(''); };

  return (
    <div className="form-group" ref={ref} style={{ position: 'relative' }}>
      <label>{label}</label>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: value ? '#e2e8f0' : '#64748b', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', minHeight: '36px' }}
      >
        {value ? displayText : `Select ${label}...`}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: '6px', zIndex: 100, maxHeight: '220px', overflowY: 'auto' }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', background: '#0f1117', border: 'none', borderBottom: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', boxSizing: 'border-box' }}
            onClick={e => e.stopPropagation()}
          />
          {includeClub && (
            <div onClick={() => handleSelect('CLUB')} style={{ padding: '8px 12px', cursor: 'pointer', fontWeight: 600, color: '#f59e0b', borderBottom: '1px solid #2d3148' }}>
              CLUB
            </div>
          )}
          {filteredPlayers.map(p => (
            <div key={p.id} onClick={() => handleSelect(p.id)}
              style={{ padding: '8px 12px', cursor: 'pointer', color: '#e2e8f0', borderBottom: '1px solid #1a1d2e' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2d3148'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <strong>{p.username}</strong>{p.fullName ? <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>{p.fullName}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TYPE_BADGE = {
  TRANSFER:      { bg: '#1e3a5f', color: '#60a5fa', label: 'Transfer' },
  CREDIT:        { bg: '#3b1f5e', color: '#c084fc', label: 'Manual Credit' },
  PROMOTION:     { bg: '#14532d', color: '#4ade80', label: 'Promotion' },
  WHEEL_EXPENSE: { bg: '#7c2d12', color: '#fb923c', label: 'גלגל (Wheel)' },
};

export default function Transfers() {
  const [players, setPlayers] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Edit state: { pendingType, id, amount, notes, method }
  const [editing, setEditing] = useState(null);

  // Credit form
  const [creditPlayerId, setCreditPlayerId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNotes, setCreditNotes] = useState('');

  // Promotion form
  const [promoPlayerId, setPromoPlayerId] = useState('');
  const [promoAmount, setPromoAmount] = useState('');
  const [promoNotes, setPromoNotes] = useState('');

  // Wheel expense form
  const [wheelPlayerId, setWheelPlayerId] = useState('');
  const [wheelAmount, setWheelAmount] = useState('');
  const [wheelNotes, setWheelNotes] = useState('');

  // Transfer form
  const [transferForm, setTransferForm] = useState({ fromId: '', toId: '', method: '', amount: '', notes: '' });

  const load = () => {
    getPlayers().then(r => setPlayers(r.data));
    getAllPending().then(r => setPending(r.data));
  };

  useEffect(() => { load(); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '₪' + abs;
  };

  const toggleForm = (form) => {
    setActiveForm(prev => prev === form ? null : form);
    setMsg(null);
  };

  // Credit submit
  const handleCreditSubmit = async (e) => {
    e.preventDefault();
    const delta = parseFloat(creditAmount);
    if (!creditPlayerId || creditAmount === '' || isNaN(delta) || delta === 0) {
      setMsg({ type: 'error', text: 'Select a player and enter a non-zero amount' });
      return;
    }
    setSubmitting(true);
    try {
      await updateCredit(creditPlayerId, delta, creditNotes || null);
      setMsg({ type: 'success', text: 'Credit updated successfully' });
      setCreditPlayerId(''); setCreditAmount(''); setCreditNotes('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update credit' });
    }
    setSubmitting(false);
  };

  // Promotion submit
  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    if (!promoPlayerId || !promoAmount) return;
    setSubmitting(true);
    try {
      await addTransaction({
        playerId: promoPlayerId,
        type: 'DEPOSIT',
        amount: Number(promoAmount),
        method: 'OTHER',
        notes: 'Promotion' + (promoNotes ? ' - ' + promoNotes : ''),
        pendingConfirmation: true,
        sourceRef: 'SCREEN:PROMO',
      });
      setMsg({ type: 'success', text: 'Promotion recorded' });
      setPromoPlayerId(''); setPromoAmount(''); setPromoNotes('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to record promotion' });
    }
    setSubmitting(false);
  };

  // Wheel expense submit
  const handleWheelSubmit = async (e) => {
    e.preventDefault();
    if (!wheelPlayerId || !wheelAmount) return;
    setSubmitting(true);
    try {
      await addWheelExpense(wheelPlayerId, Number(wheelAmount), wheelNotes || null);
      setMsg({ type: 'success', text: 'Wheel expense recorded' });
      setWheelPlayerId(''); setWheelAmount(''); setWheelNotes('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to record wheel expense' });
    }
    setSubmitting(false);
  };

  // Transfer submit
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferForm.fromId || !transferForm.toId || !transferForm.method || !transferForm.amount) {
      setMsg({ type: 'error', text: 'From, To, Method, and Amount are required' });
      return;
    }
    if (transferForm.fromId === transferForm.toId) {
      setMsg({ type: 'error', text: 'From and To cannot be the same' });
      return;
    }
    setSubmitting(true);
    try {
      await createTransfer({
        fromPlayerId: transferForm.fromId === 'CLUB' ? null : transferForm.fromId,
        toPlayerId: transferForm.toId === 'CLUB' ? null : transferForm.toId,
        method: transferForm.method,
        amount: parseFloat(transferForm.amount),
        notes: transferForm.notes || null,
      });
      setMsg({ type: 'success', text: 'Transfer recorded successfully' });
      setTransferForm({ fromId: '', toId: '', method: '', amount: '', notes: '' });
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to record transfer' });
    }
    setSubmitting(false);
  };

  const handleApprove = async (item) => {
    try {
      if (item.pendingType === 'TRANSFER') {
        await confirmTransfer(item.id);
      } else {
        await confirmTransaction(item.id);
      }
      setPending(prev => prev.filter(p => p.id !== item.id || p.pendingType !== item.pendingType));
    } catch {
      setMsg({ type: 'error', text: 'Failed to approve' });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(editing.amount);
    if (isNaN(amount) || amount <= 0) { setMsg({ type: 'error', text: 'Amount must be positive' }); return; }
    setSubmitting(true);
    try {
      if (editing.pendingType === 'TRANSFER') {
        await updateTransfer(editing.id, { amount, notes: editing.notes || null, method: editing.method || null });
      } else {
        await updateTransaction(editing.id, { amount, notes: editing.notes || null });
      }
      setMsg({ type: 'success', text: 'Updated successfully' });
      setEditing(null);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update' });
    }
    setSubmitting(false);
  };

  return (
    <div>
      <h1>Transfers</h1>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {/* Form selector */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className={`btn ${activeForm === 'credit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('credit')}>
          ✏ Manual Credit
        </button>
        <button className={`btn ${activeForm === 'promotion' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('promotion')}>
          🏆 Promotion (MTT)
        </button>
        <button className={`btn ${activeForm === 'transfer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('transfer')}>
          ↔ Player Transfer
        </button>
        <button className={`btn ${activeForm === 'wheel' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('wheel')}
          style={{ background: activeForm === 'wheel' ? '#fb923c' : undefined, color: activeForm === 'wheel' ? '#0f1117' : undefined }}>
          🎡 גלגל (Wheel)
        </button>
      </div>

      {/* Manual Credit Form */}
      {activeForm === 'credit' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2>Manual Credit</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Add or subtract credit from a player. Positive = add credit, negative = subtract.
          </p>
          <form onSubmit={handleCreditSubmit}>
            <div className="form-row">
              <PlayerSelect label="Player" value={creditPlayerId} onChange={setCreditPlayerId} players={players} />
              <div className="form-group">
                <label>Amount (₪) *</label>
                <input type="number" step="0.01" required value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)} placeholder="e.g. 1000 or -500" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={creditNotes} onChange={e => setCreditNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !creditPlayerId}>
              {submitting ? 'Saving...' : 'Save Credit'}
            </button>
          </form>
        </div>
      )}

      {/* Promotion Form */}
      {activeForm === 'promotion' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2>Promotion — MTT Cost</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Record a promotion for a player (e.g. MTT buy-in refund). The XLS upload will automatically match this against the tournament.
          </p>
          <form onSubmit={handlePromoSubmit}>
            <div className="form-row">
              <PlayerSelect label="Player" value={promoPlayerId} onChange={setPromoPlayerId} players={players} />
              <div className="form-group">
                <label>Amount (₪) *</label>
                <input type="number" min="0.01" step="0.01" required value={promoAmount}
                  onChange={e => setPromoAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={promoNotes} onChange={e => setPromoNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !promoPlayerId}>
              {submitting ? 'Recording...' : 'Record Promotion'}
            </button>
          </form>
        </div>
      )}

      {/* Wheel Expense Form */}
      {activeForm === 'wheel' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#fb923c' }}>
          <h2 style={{ color: '#fb923c' }}>גלגל — Wheel Expense</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Give chips to a player as a wheel prize. This increases their chip count directly (like manual credit).
          </p>
          <form onSubmit={handleWheelSubmit}>
            <div className="form-row">
              <PlayerSelect label="Player" value={wheelPlayerId} onChange={setWheelPlayerId} players={players} />
              <div className="form-group">
                <label>Amount (chips) *</label>
                <input type="number" min="0.01" step="0.01" required value={wheelAmount}
                  onChange={e => setWheelAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={wheelNotes} onChange={e => setWheelNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <button type="submit" className="btn" style={{ background: '#fb923c', color: '#0f1117' }}
              disabled={submitting || !wheelPlayerId}>
              {submitting ? 'Recording...' : '🎡 Record Wheel Expense'}
            </button>
          </form>
        </div>
      )}

      {/* Player Transfer Form */}
      {activeForm === 'transfer' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2>Player Transfer</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Record a money transfer between players or between a player and the club.
          </p>
          <form onSubmit={handleTransferSubmit}>
            <div className="form-row">
              <PlayerSelect label="From" value={transferForm.fromId} onChange={v => setTransferForm(f => ({ ...f, fromId: v }))} players={players} excludeId={transferForm.toId} includeClub />
              <PlayerSelect label="To" value={transferForm.toId} onChange={v => setTransferForm(f => ({ ...f, toId: v }))} players={players} excludeId={transferForm.fromId} includeClub />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Payment Method *</label>
                <select required value={transferForm.method} onChange={e => setTransferForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="">Select method...</option>
                  {METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Amount (₪) *</label>
                <input type="number" min="0.01" step="0.01" required value={transferForm.amount}
                  onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={transferForm.notes}
                  onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Recording...' : '+ Record Transfer'}
            </button>
          </form>
        </div>
      )}

      {/* Unified Pending Section */}
      <div className="card">
        <h2>
          Pending
          {pending.length > 0 && <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 400, marginLeft: '0.5rem' }}>({pending.length} unconfirmed)</span>}
        </h2>
        {pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No pending items</div>
        ) : (
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Player / From → To</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Notes</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((item, idx) => {
                const badge = TYPE_BADGE[item.pendingType] || TYPE_BADGE.CREDIT;
                const isEditing = editing && editing.id === item.id && editing.pendingType === item.pendingType;
                return (
                  <>
                    <tr key={`${item.pendingType}-${item.id}`}>
                      <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {item.transferDate || item.transactionDate || item.createdAt?.substring(0, 10) || '—'}
                      </td>
                      <td>
                        <span style={{ background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        {item.pendingType === 'TRANSFER' ? (
                          <span>
                            <span onClick={() => item.fromPlayerId && navigate(`/player/${item.fromPlayerId}`)}
                              style={{ color: item.fromPlayerId ? '#6366f1' : '#f59e0b', cursor: item.fromPlayerId ? 'pointer' : 'default', fontWeight: 600 }}>
                              {item.fromPlayerName}
                            </span>
                            <span style={{ color: '#64748b', margin: '0 0.4rem' }}>→</span>
                            <span onClick={() => item.toPlayerId && navigate(`/player/${item.toPlayerId}`)}
                              style={{ color: item.toPlayerId ? '#6366f1' : '#f59e0b', cursor: item.toPlayerId ? 'pointer' : 'default', fontWeight: 600 }}>
                              {item.toPlayerName}
                            </span>
                          </span>
                        ) : (
                          <span onClick={() => navigate(`/player/${item.playerId}`)} style={{ cursor: 'pointer' }}>
                            <strong style={{ color: '#6366f1' }}>{item.playerName}</strong>
                            {item.playerFullName ? <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.3rem' }}>{item.playerFullName}</span> : null}
                          </span>
                        )}
                      </td>
                      <td>
                        {item.method
                          ? <span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{METHOD_LABELS[item.method] || item.method}</span>
                          : <span style={{ color: '#64748b' }}>—</span>}
                      </td>
                      <td className="positive" style={{ whiteSpace: 'nowrap' }}><strong>{fmt(item.amount)}</strong></td>
                      <td style={{ color: '#64748b' }}>{item.notes || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.createdByUsername || '—'}</td>
                      <td style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#ef4444', color: '#fff', border: 'none' }}
                          onClick={() => handleApprove(item)}>
                          Approve
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => setEditing(isEditing ? null : {
                            pendingType: item.pendingType,
                            id: item.id,
                            amount: item.amount,
                            notes: item.notes || '',
                            method: item.method || '',
                          })}>
                          Edit
                        </button>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr key={`edit-${item.pendingType}-${item.id}`}>
                        <td colSpan={8} style={{ background: '#12151f', padding: '0.75rem 1rem' }}>
                          <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.8rem' }}>Amount (₪)</label>
                              <input type="number" min="0.01" step="0.01" value={editing.amount}
                                onChange={e => setEditing(f => ({ ...f, amount: e.target.value }))}
                                style={{ width: '120px' }} />
                            </div>
                            {item.pendingType === 'TRANSFER' && (
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.8rem' }}>Method</label>
                                <select value={editing.method} onChange={e => setEditing(f => ({ ...f, method: e.target.value }))}>
                                  {METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                                </select>
                              </div>
                            )}
                            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                              <label style={{ fontSize: '0.8rem' }}>Notes</label>
                              <input type="text" value={editing.notes}
                                onChange={e => setEditing(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} disabled={submitting}>Save</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => setEditing(null)}>Cancel</button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
