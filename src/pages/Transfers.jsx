import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers, updateCredit, addTransaction, createTransfer, getPendingTransfers, confirmTransfer, getLastNightMtt } from '../api';

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
      (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())))
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

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

export default function Transfers() {
  const [players, setPlayers] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Credit form
  const [creditPlayerId, setCreditPlayerId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNotes, setCreditNotes] = useState('');

  // Promotion form
  const [promoDate, setPromoDate] = useState(yesterday);
  const [lastNightMtt, setLastNightMtt] = useState(null);
  const [promoMttLoading, setPromoMttLoading] = useState(false);
  const [promoChecked, setPromoChecked] = useState({});
  const [promoNotes, setPromoNotes] = useState('');

  // Transfer form
  const [transferForm, setTransferForm] = useState({ fromId: '', toId: '', method: '', amount: '', notes: '' });

  const load = () => {
    getPlayers().then(r => setPlayers(r.data));
    getPendingTransfers().then(r => setPending(r.data));
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
    if (!creditPlayerId || !creditAmount) return;
    setSubmitting(true);
    try {
      await updateCredit(creditPlayerId, Number(creditAmount), creditNotes || null);
      setMsg({ type: 'success', text: 'Credit updated successfully' });
      setCreditPlayerId(''); setCreditAmount(''); setCreditNotes('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update credit' });
    }
    setSubmitting(false);
  };

  // Promotion: load MTT
  const loadMtt = async () => {
    setPromoMttLoading(true);
    setLastNightMtt(null);
    setPromoChecked({});
    try {
      const r = await getLastNightMtt(promoDate);
      if (r.data && r.data.id) {
        setLastNightMtt(r.data);
        const checked = {};
        r.data.participants.forEach(p => { checked[p.playerId] = true; });
        setPromoChecked(checked);
      } else {
        setMsg({ type: 'error', text: 'No 9PM MTT found for that date' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Failed to load MTT data' });
    }
    setPromoMttLoading(false);
  };

  // Promotion submit
  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    if (!lastNightMtt) return;
    const selected = lastNightMtt.participants.filter(p => promoChecked[p.playerId]);
    if (selected.length === 0) {
      setMsg({ type: 'error', text: 'Select at least one player' });
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(selected.map(p =>
        addTransaction({
          playerId: p.playerId,
          type: 'DEPOSIT',
          amount: p.cost,
          method: 'OTHER',
          notes: `Promotion - ${lastNightMtt.tableName}${promoNotes ? ' - ' + promoNotes : ''}`,
        })
      ));
      setMsg({ type: 'success', text: `Promotion recorded for ${selected.length} player${selected.length !== 1 ? 's' : ''}` });
      setLastNightMtt(null); setPromoChecked({}); setPromoNotes('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to record promotion' });
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

  const handleConfirm = async (id) => {
    try {
      await confirmTransfer(id);
      setPending(prev => prev.filter(t => t.id !== id));
    } catch {
      setMsg({ type: 'error', text: 'Failed to confirm transfer' });
    }
  };

  const allChecked = lastNightMtt && lastNightMtt.participants.every(p => promoChecked[p.playerId]);
  const checkedCount = Object.values(promoChecked).filter(Boolean).length;

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
            Look up last night's 9PM MTT (±40 min) and record the promotion for participating players.
          </p>
          <div className="form-row" style={{ alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={promoDate}
                onChange={e => { setPromoDate(e.target.value); setLastNightMtt(null); setPromoChecked({}); }}
                style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' }} />
            </div>
            <div className="form-group">
              <button type="button" className="btn btn-secondary" onClick={loadMtt} disabled={promoMttLoading}>
                {promoMttLoading ? 'Loading...' : 'Load 9PM MTT'}
              </button>
            </div>
          </div>

          {lastNightMtt && (
            <form onSubmit={handlePromoSubmit}>
              <div style={{ background: '#1a1d2e', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ color: '#f59e0b', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {lastNightMtt.tableName} — {lastNightMtt.startTime?.substring(0, 16).replace('T', ' ')}
                </div>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 400, padding: '4px 0' }}>
                        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input type="checkbox" checked={!!allChecked}
                            onChange={e => {
                              const c = {};
                              lastNightMtt.participants.forEach(p => { c[p.playerId] = e.target.checked; });
                              setPromoChecked(c);
                            }} />
                          Player
                        </label>
                      </th>
                      <th style={{ textAlign: 'right', color: '#64748b', fontWeight: 400, padding: '4px 0' }}>Buy-in + Rake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastNightMtt.participants.map(p => (
                      <tr key={p.playerId}>
                        <td style={{ padding: '5px 0' }}>
                          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" checked={!!promoChecked[p.playerId]}
                              onChange={e => setPromoChecked(prev => ({ ...prev, [p.playerId]: e.target.checked }))} />
                            <strong>{p.username}</strong>
                            {p.fullName && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{p.fullName}</span>}
                          </label>
                        </td>
                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmt(p.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Notes</label>
                  <input type="text" value={promoNotes} onChange={e => setPromoNotes(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting || checkedCount === 0}>
                {submitting ? 'Recording...' : `Record Promotion (${checkedCount} player${checkedCount !== 1 ? 's' : ''})`}
              </button>
            </form>
          )}
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

      {/* Pending Transfers */}
      <div className="card">
        <h2>
          Pending Transfers
          {pending.length > 0 && <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 400, marginLeft: '0.5rem' }}>({pending.length} unconfirmed)</span>}
        </h2>
        {pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No pending transfers</div>
        ) : (
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Notes</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map(t => (
                <tr key={t.id}>
                  <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{t.transferDate || t.createdAt?.substring(0, 10)}</td>
                  <td onClick={() => t.fromPlayerId && navigate(`/player/${t.fromPlayerId}`)} style={{ cursor: t.fromPlayerId ? 'pointer' : 'default' }}>
                    <strong style={{ color: t.fromPlayerId ? '#6366f1' : '#f59e0b' }}>{t.fromPlayerName}</strong>
                    {t.fromPlayerFullName ? <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.3rem' }}>{t.fromPlayerFullName}</span> : null}
                  </td>
                  <td onClick={() => t.toPlayerId && navigate(`/player/${t.toPlayerId}`)} style={{ cursor: t.toPlayerId ? 'pointer' : 'default' }}>
                    <strong style={{ color: t.toPlayerId ? '#6366f1' : '#f59e0b' }}>{t.toPlayerName}</strong>
                    {t.toPlayerFullName ? <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.3rem' }}>{t.toPlayerFullName}</span> : null}
                  </td>
                  <td><span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{METHOD_LABELS[t.method] || t.method}</span></td>
                  <td className="positive" style={{ whiteSpace: 'nowrap' }}><strong>{fmt(t.amount)}</strong></td>
                  <td style={{ color: '#64748b' }}>{t.notes || '—'}</td>
                  <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{t.createdByUsername || '—'}</td>
                  <td>
                    <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#ef4444', color: '#fff', border: 'none' }}
                      onClick={() => handleConfirm(t.id)}>
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
