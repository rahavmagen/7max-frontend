import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers, createTransfer, getPendingTransfers, confirmTransfer } from '../api';

const METHODS = ['BIT', 'PAYBOX', 'KASHCASH', 'BANK_TRANSFER', 'CASH', 'OTHER'];
const METHOD_LABELS = { BIT: 'Bit', PAYBOX: 'PayBox', KASHCASH: 'KashCash', BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash', OTHER: 'Other' };

function PlayerSelect({ label, value, onChange, players, excludeId }) {
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
          <div onClick={() => handleSelect('CLUB')} style={{ padding: '8px 12px', cursor: 'pointer', fontWeight: 600, color: '#f59e0b', borderBottom: '1px solid #2d3148' }}>
            CLUB
          </div>
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

export default function BalanceReport() {
  const [players, setPlayers] = useState([]);
  const [threshold, setThreshold] = useState('');
  const [sortCol, setSortCol] = useState('balance');
  const [sortDir, setSortDir] = useState(1);
  const [pending, setPending] = useState([]);
  const [form, setForm] = useState({ fromId: '', toId: '', method: '', amount: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    getPlayers().then(r => setPlayers(r.data));
    getPendingTransfers().then(r => setPending(r.data));
  };

  useEffect(() => { load(); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '0';
    const abs = Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '\u20AA' + abs;
  };

  const balanceClass = (b) => b > 0 ? 'positive' : b < 0 ? 'negative' : 'zero';

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(1); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '';
  const thStyle = { cursor: 'pointer', userSelect: 'none' };

  const t = parseFloat(threshold) || 0;
  const filtered = t > 0 ? players.filter(p => (p.balance || 0) > t || (p.balance || 0) < -t) : players;
  const sorted = [...filtered].sort((a, b) => {
    const av = sortCol === 'username' ? (a.username || '') : sortCol === 'fullName' ? (a.fullName || '') : (a[sortCol] || 0);
    const bv = sortCol === 'username' ? (b.username || '') : sortCol === 'fullName' ? (b.fullName || '') : (b[sortCol] || 0);
    if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fromId || !form.toId || !form.method || !form.amount) {
      setMsg({ type: 'error', text: 'From, To, Method, and Amount are required' });
      return;
    }
    if (form.fromId === form.toId) {
      setMsg({ type: 'error', text: 'From and To cannot be the same' });
      return;
    }
    setSubmitting(true);
    try {
      await createTransfer({
        fromPlayerId: form.fromId === 'CLUB' ? null : form.fromId,
        toPlayerId: form.toId === 'CLUB' ? null : form.toId,
        method: form.method,
        amount: parseFloat(form.amount),
        notes: form.notes || null,
      });
      setMsg({ type: 'success', text: 'Transfer recorded successfully' });
      setForm({ fromId: '', toId: '', method: '', amount: '', notes: '' });
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

  return (
    <div>
      <h1>Balance Report</h1>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {/* Transfer Form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>Record Transfer</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Record a money transfer between players or between a player and the club.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <PlayerSelect label="From" value={form.fromId} onChange={v => setForm(f => ({ ...f, fromId: v }))} players={players} excludeId={form.toId} />
            <PlayerSelect label="To" value={form.toId} onChange={v => setForm(f => ({ ...f, toId: v }))} players={players} excludeId={form.fromId} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Payment Method *</label>
              <select required value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                <option value="">Select method...</option>
                {METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Amount (\u20AA) *</label>
              <input type="number" min="0.01" step="0.01" required value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input type="text" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Recording...' : '+ Record Transfer'}
          </button>
        </form>
      </div>

      {/* Pending Transfers */}
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2>Pending Transfers <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 400 }}>({pending.length} unconfirmed)</span></h2>
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
                  <td><strong>{t.fromPlayerName}</strong>{t.fromPlayerFullName ? <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.3rem' }}>{t.fromPlayerFullName}</span> : null}</td>
                  <td><strong>{t.toPlayerName}</strong>{t.toPlayerFullName ? <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.3rem' }}>{t.toPlayerFullName}</span> : null}</td>
                  <td><span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{METHOD_LABELS[t.method] || t.method}</span></td>
                  <td className="positive" style={{ whiteSpace: 'nowrap' }}><strong>{fmt(t.amount)}</strong></td>
                  <td style={{ color: '#64748b' }}>{t.notes || '—'}</td>
                  <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{t.createdByUsername || '—'}</td>
                  <td>
                    <button className="btn btn-success" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleConfirm(t.id)}>
                      ✓ Confirm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Balance Table */}
      <p style={{ color: '#64748b', marginBottom: '1rem' }}>
        Show players with balance above or below a threshold.
      </p>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ color: '#94a3b8' }}>Show players with |balance| &gt;</label>
          <input type="number" min="0" step="1" value={threshold} onChange={e => setThreshold(e.target.value)}
            placeholder="0 = show all"
            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', width: '160px' }} />
          {threshold && (
            <button onClick={() => setThreshold('')}
              style={{ background: 'none', border: '1px solid #2d3148', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
              Clear
            </button>
          )}
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{sorted.length} player{sorted.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="card">
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No players match the filter</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSort('username')}>Username{arrow('username')}</th>
                <th style={thStyle} onClick={() => handleSort('fullName')}>Full Name{arrow('fullName')}</th>
                <th style={thStyle} onClick={() => handleSort('currentChips')}>Current Chips{arrow('currentChips')}</th>
                <th style={thStyle} onClick={() => handleSort('creditTotal')}>Credit{arrow('creditTotal')}</th>
                <th style={thStyle} onClick={() => handleSort('balance')}>Balance{arrow('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/player/${p.id}`)}>
                  <td style={{ fontWeight: 600 }}>{p.username}</td>
                  <td style={{ color: '#94a3b8' }}>{p.fullName || '—'}</td>
                  <td>{fmt(p.currentChips)}</td>
                  <td style={{ color: p.creditTotal > 0 ? '#f59e0b' : '#64748b' }}>{fmt(p.creditTotal)}</td>
                  <td><strong className={balanceClass(p.balance)}>{fmt(p.balance)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
