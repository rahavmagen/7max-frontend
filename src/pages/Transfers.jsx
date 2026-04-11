import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getPlayers, updateCredit, addTransaction, createTransfer, getAllPending, confirmTransfer, confirmTransaction, updateTransfer, updateTransaction, addWheelExpense, getBankAccounts, getAdminUsers, createAdminExpense, getRecentTransactions, getClubExpenses, createClubExpense, settleClubExpense, deleteClubExpense } from '../api';

const METHODS = ['BIT', 'PAYBOX', 'KASHCASH', 'BANK_TRANSFER', 'CASH', 'OTHER'];
const METHOD_LABELS = { BIT: 'Bit', PAYBOX: 'PayBox', KASHCASH: 'KashCash', BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash', OTHER: 'Other' };

function PlayerSelect({ label, value, onChange, players, bankAccounts = [], excludeId, includeClub = false }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isBankValue = typeof value === 'string' && value.startsWith('BANK_');
  const bankId = isBankValue ? parseInt(value.slice(5)) : null;
  const selectedBank = bankAccounts.find(b => b.id === bankId);
  const selectedPlayer = !isBankValue && value !== 'CLUB' ? players.find(p => p.id === value) : null;
  const displayText = value === 'CLUB' ? 'CLUB'
    : selectedBank ? `🏦 ${selectedBank.name}`
    : selectedPlayer ? (selectedPlayer.username + (selectedPlayer.fullName ? ` — ${selectedPlayer.fullName}` : ''))
    : '';

  const filteredPlayers = players.filter(p =>
    p.id !== excludeId &&
    (search === '' ||
      p.username.toLowerCase().includes(search.toLowerCase()) ||
      (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.includes(search)))
  );

  const filteredBanks = bankAccounts.filter(b =>
    search === '' || b.name.toLowerCase().includes(search.toLowerCase())
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
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: '6px', zIndex: 100, maxHeight: '260px', overflowY: 'auto' }}>
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
          {filteredBanks.length > 0 && (
            <>
              <div style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#64748b', background: '#12151f', borderBottom: '1px solid #2d3148' }}>
                חשבון בנק
              </div>
              {filteredBanks.map(b => (
                <div key={`bank-${b.id}`} onClick={() => handleSelect(`BANK_${b.id}`)}
                  style={{ padding: '8px 12px', cursor: 'pointer', color: '#34d399', borderBottom: '1px solid #1a1d2e' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2d3148'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🏦 <strong>{b.name}</strong>{b.accountNumber ? <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{b.accountNumber}</span> : null}
                </div>
              ))}
            </>
          )}
          {filteredPlayers.length > 0 && (
            <>
              <div style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#64748b', background: '#12151f', borderBottom: '1px solid #2d3148' }}>
                שחקנים
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TYPE_BADGE = {
  TRANSFER:      { bg: '#1e3a5f', color: '#60a5fa', label: 'Transfer' },
  CREDIT:        { bg: '#3b1f5e', color: '#c084fc', label: 'Manual Credit' },
  PROMOTION:     { bg: '#14532d', color: '#4ade80', label: 'Promotion' },
  CHIP_PROMO:    { bg: '#3b2a00', color: '#fbbf24', label: '🎁 Chip Promo' },
  WHEEL_EXPENSE: { bg: '#7c2d12', color: '#fb923c', label: 'גלגל (Wheel)' },
  XLS_UNMATCHED: { bg: '#422006', color: '#fbbf24', label: '⚠ XLS Unmatched' },
};

export default function Transfers() {
  const { auth } = useAuth();
  const [players, setPlayers] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [pending, setPending] = useState([]);
  const [pendingSort, setPendingSort] = useState({ col: 'createdAt', dir: 'desc' });
  const [recentCredits, setRecentCredits] = useState([]);
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
  const [noChipChange, setNoChipChange] = useState(false);

  // Unified Promotion form
  const [promoSubType, setPromoSubType] = useState('chipPromo');
  const [promoPlayerId, setPromoPlayerId] = useState('');
  const [promoAmount, setPromoAmount] = useState('');
  const [promoNotes, setPromoNotes] = useState('');

  // Admin expense form
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Club expense form
  const [clubExpenses, setClubExpenses] = useState([]);
  const [clubExpForm, setClubExpForm] = useState({ amount: '', description: '', expenseDate: new Date().toISOString().slice(0,10), paidBy: 'ADMIN', adminUser: '', bankAccountId: '' });
  const [settlingId, setSettlingId] = useState(null);
  const [settleForm, setSettleForm] = useState({ bankAccountId: '', settledAt: new Date().toISOString().slice(0,10) });

  // Transfer form
  const [transferForm, setTransferForm] = useState({ fromId: '', toId: '', method: '', amount: '', notes: '' });

  const load = () => {
    getPlayers().then(r => setPlayers(r.data));
    getAllPending().then(r => setPending(r.data));
    getBankAccounts().then(r => setBankAccounts(r.data));
    getAdminUsers().then(r => setAdminUsers(r.data)).catch(() => {});
    getRecentTransactions(10).then(r => setRecentCredits(r.data)).catch(() => {});
    getClubExpenses().then(r => setClubExpenses(r.data)).catch(() => {});
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
    const selectedPlayer = players.find(p => String(p.id) === String(creditPlayerId));
    const currentCredit = Number(selectedPlayer?.creditTotal || 0);
    const newCredit = currentCredit + delta;
    if (newCredit < 0) {
      alert(
        `Cannot apply this credit change.\n\n` +
        `Current credit: ₪${currentCredit.toLocaleString()}\n` +
        `Change: ₪${delta.toLocaleString()}\n` +
        `Result would be: ₪${newCredit.toLocaleString()}\n\n` +
        `A player's credit cannot go negative. The activity was not saved.`
      );
      return;
    }
    setSubmitting(true);
    try {
      await updateCredit(creditPlayerId, delta, creditNotes || null, noChipChange);
      setMsg({ type: 'success', text: 'Credit updated successfully' });
      setCreditPlayerId(''); setCreditAmount(''); setCreditNotes(''); setNoChipChange(false);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update credit' });
    }
    setSubmitting(false);
  };

  // Unified Promotion submit
  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    if (!promoPlayerId || !promoAmount) return;
    setSubmitting(true);
    try {
      if (promoSubType === 'wheel') {
        await addWheelExpense(promoPlayerId, Number(promoAmount), promoNotes || null);
        setMsg({ type: 'success', text: 'Wheel expense recorded' });
      } else if (promoSubType === 'writeOff') {
        await addTransaction({
          playerId: promoPlayerId,
          type: 'PROMOTION',
          amount: Number(promoAmount),
          method: 'OTHER',
          notes: promoNotes || null,
          pendingConfirmation: false,
          sourceRef: 'SCREEN:WRITEOFF',
        });
        setMsg({ type: 'success', text: 'Write-off recorded' });
      } else {
        await addTransaction({
          playerId: promoPlayerId,
          type: 'CHIP_PROMO',
          amount: Number(promoAmount),
          method: 'OTHER',
          notes: promoNotes || null,
          pendingConfirmation: true,
          sourceRef: 'SCREEN:CHIP_PROMO',
        });
        setMsg({ type: 'success', text: 'Chip promo recorded' });
      }
      setPromoPlayerId(''); setPromoAmount(''); setPromoNotes('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to record promotion' });
    }
    setSubmitting(false);
  };

  // Admin expense submit
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    const expenseUsername = auth?.username;
    if (!expenseUsername || isNaN(amount) || amount <= 0) {
      setMsg({ type: 'error', text: 'Select an admin and enter a positive amount' });
      return;
    }
    setSubmitting(true);
    try {
      await createAdminExpense({ adminUsername: expenseUsername, amount, notes: expenseNotes || null });
      setMsg({ type: 'success', text: 'Expense recorded' });
      setExpenseAmount(''); setExpenseNotes('');
    } catch {
      setMsg({ type: 'error', text: 'Failed to record expense' });
    }
    setSubmitting(false);
  };

  // Club expense submit
  const handleClubExpenseSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(clubExpForm.amount);
    if (isNaN(amount) || amount <= 0 || !clubExpForm.description.trim()) {
      setMsg({ type: 'error', text: 'Amount and description are required' });
      return;
    }
    if (clubExpForm.paidBy === 'ADMIN' && !clubExpForm.adminUser) {
      setMsg({ type: 'error', text: 'Select which admin paid' });
      return;
    }
    if (clubExpForm.paidBy === 'CLUB' && !clubExpForm.bankAccountId) {
      setMsg({ type: 'error', text: 'Select a bank account' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        amount,
        description: clubExpForm.description.trim(),
        expenseDate: clubExpForm.expenseDate,
        paidBy: clubExpForm.paidBy,
        ...(clubExpForm.paidBy === 'ADMIN' ? { adminUser: clubExpForm.adminUser } : { bankAccountId: parseInt(clubExpForm.bankAccountId) }),
      };
      await createClubExpense(payload);
      setMsg({ type: 'success', text: 'Club expense recorded' });
      setClubExpForm({ amount: '', description: '', expenseDate: new Date().toISOString().slice(0,10), paidBy: 'ADMIN', adminUser: '', bankAccountId: '' });
      getClubExpenses().then(r => setClubExpenses(r.data));
    } catch {
      setMsg({ type: 'error', text: 'Failed to record expense' });
    }
    setSubmitting(false);
  };

  const handleSettle = async (id) => {
    if (!settleForm.bankAccountId) {
      setMsg({ type: 'error', text: 'Select a bank account for repayment' });
      return;
    }
    try {
      await settleClubExpense(id, { bankAccountId: parseInt(settleForm.bankAccountId), settledAt: settleForm.settledAt });
      setSettlingId(null);
      setSettleForm({ bankAccountId: '', settledAt: new Date().toISOString().slice(0,10) });
      getClubExpenses().then(r => setClubExpenses(r.data));
      setMsg({ type: 'success', text: 'Expense settled' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to settle expense' });
    }
  };

  const handleDeleteClubExpense = async (id) => {
    try {
      await deleteClubExpense(id);
      getClubExpenses().then(r => setClubExpenses(r.data));
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete expense' });
    }
  };

  const resolveParty = (id) => {
    if (!id || id === 'CLUB') return { playerId: null, bankAccountId: null };
    if (typeof id === 'string' && id.startsWith('BANK_')) return { playerId: null, bankAccountId: parseInt(id.slice(5)) };
    return { playerId: id, bankAccountId: null };
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
    const from = resolveParty(transferForm.fromId);
    const to = resolveParty(transferForm.toId);
    try {
      await createTransfer({
        fromPlayerId: from.playerId,
        fromBankAccountId: from.bankAccountId,
        toPlayerId: to.playerId,
        toBankAccountId: to.bankAccountId,
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
        <button className={`btn ${activeForm === 'transfer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('transfer')}>
          ↔ Player Transfer
        </button>
        <button className={`btn ${activeForm === 'credit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('credit')}>
          ✏ Manual Credit
        </button>
        <button className={`btn ${activeForm === 'promotion' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('promotion')}>
          🎁 Promotion
        </button>
        <button className={`btn ${activeForm === 'expense' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('expense')}>
          💸 Admin Expense
        </button>
        <button className={`btn ${activeForm === 'clubExpense' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleForm('clubExpense')}>
          🧾 Club Expense
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
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="noChipChange"
                checked={noChipChange}
                onChange={e => setNoChipChange(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#f59e0b' }}
              />
              <label htmlFor="noChipChange" style={{ cursor: 'pointer', color: noChipChange ? '#f59e0b' : '#94a3b8', fontSize: '0.875rem', userSelect: 'none' }}>
                No chip change (bookkeeping only — will not appear in pending)
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !creditPlayerId}>
              {submitting ? 'Saving...' : 'Save Credit'}
            </button>
          </form>
        </div>
      )}

      {/* Unified Promotion Form */}
      {activeForm === 'promotion' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2>🎁 Promotion</h2>
          {/* Sub-type selector */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {[
              { key: 'chipPromo', label: '🎁 Chip Promo' },
              { key: 'writeOff',  label: '✏️ Write Off' },
              { key: 'wheel',     label: '🎡 Wheel' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setPromoSubType(key); setPromoPlayerId(''); setPromoAmount(''); setPromoNotes(''); }}
                style={{
                  padding: '5px 14px', borderRadius: '6px', border: '1px solid',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: promoSubType === key ? 600 : 400,
                  background: promoSubType === key ? '#2d3148' : 'transparent',
                  borderColor: promoSubType === key ? '#6366f1' : '#2d3148',
                  color: promoSubType === key ? '#e2e8f0' : '#64748b',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {promoSubType === 'chipPromo' && 'Record chips given to a player (rakeback, bonus, etc.). Goes to pending for XLS matching.'}
            {promoSubType === 'writeOff'  && "Forgive a player's negative balance. Deducted from club profit as a promotion expense."}
            {promoSubType === 'wheel'     && 'Record a wheel expense for a player. Chip count is updated only via XLS upload.'}
          </p>
          <form onSubmit={handlePromoSubmit}>
            <div className="form-row">
              <PlayerSelect
                label="Player"
                value={promoPlayerId}
                onChange={(v) => {
                  setPromoPlayerId(v);
                  if (promoSubType === 'writeOff') {
                    const p = players.find(pl => String(pl.id) === String(v));
                    if (p && Number(p.balance) < 0) setPromoAmount(String(Math.abs(Number(p.balance))));
                  }
                }}
                players={players}
              />
              <div className="form-group">
                <label>Amount {promoSubType === 'writeOff' ? '(₪)' : '(chips)'} *</label>
                <input type="number" min="0.01" step="0.01" required value={promoAmount}
                  onChange={e => setPromoAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={promoNotes} onChange={e => setPromoNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !promoPlayerId}>
              {submitting ? 'Recording...' : 'Record'}
            </button>
          </form>
        </div>
      )}

      {/* Admin Expense Form */}
      {activeForm === 'expense' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#ef4444' }}>
          <h2 style={{ color: '#ef4444' }}>Admin Expense</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Record an expense for an admin. This will appear in the Admin Expenses page.
          </p>
          <form onSubmit={handleExpenseSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Admin</label>
                <div style={{ padding: '8px 12px', background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: '6px', color: '#e2e8f0', fontWeight: 600 }}>
                  {auth?.username}
                </div>
              </div>
              <div className="form-group">
                <label>Amount (₪) *</label>
                <input type="number" min="0.01" step="0.01" required value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={expenseNotes} onChange={e => setExpenseNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <button type="submit" className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }}
              disabled={submitting}>
              {submitting ? 'Recording...' : '💸 Record Expense'}
            </button>
          </form>
        </div>
      )}

      {/* Club Expense Form */}
      {activeForm === 'clubExpense' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#f59e0b' }}>
          <h2 style={{ color: '#f59e0b' }}>🧾 Club Expense</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Record an operational expense for the club.
          </p>
          <form onSubmit={handleClubExpenseSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Amount (₪) *</label>
                <input type="number" min="0.01" step="0.01" required value={clubExpForm.amount}
                  onChange={e => setClubExpForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" required value={clubExpForm.expenseDate}
                  onChange={e => setClubExpForm(f => ({ ...f, expenseDate: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Description *</label>
              <input type="text" required value={clubExpForm.description}
                onChange={e => setClubExpForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Parking, Accountant, Internet bill..." />
            </div>
            <div className="form-group">
              <label>Paid By</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['ADMIN', 'CLUB'].map(opt => (
                  <button key={opt} type="button"
                    onClick={() => setClubExpForm(f => ({ ...f, paidBy: opt, adminUser: '', bankAccountId: '' }))}
                    style={{ padding: '6px 18px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontSize: '0.875rem',
                      background: clubExpForm.paidBy === opt ? '#2d3148' : 'transparent',
                      borderColor: clubExpForm.paidBy === opt ? '#f59e0b' : '#2d3148',
                      color: clubExpForm.paidBy === opt ? '#f59e0b' : '#64748b', fontWeight: clubExpForm.paidBy === opt ? 600 : 400 }}>
                    {opt === 'ADMIN' ? '👤 Admin paid' : '🏦 Club paid directly'}
                  </button>
                ))}
              </div>
            </div>
            {clubExpForm.paidBy === 'ADMIN' && (
              <div className="form-group">
                <label>Admin Username *</label>
                <select value={clubExpForm.adminUser} onChange={e => setClubExpForm(f => ({ ...f, adminUser: e.target.value }))}
                  style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px', width: '100%' }}>
                  <option value="">Select admin...</option>
                  {adminUsers.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}
            {clubExpForm.paidBy === 'CLUB' && (
              <div className="form-group">
                <label>Bank Account *</label>
                <select value={clubExpForm.bankAccountId} onChange={e => setClubExpForm(f => ({ ...f, bankAccountId: e.target.value }))}
                  style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px', width: '100%' }}>
                  <option value="">Select bank account...</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}{b.accountNumber ? ` — ${b.accountNumber}` : ''}</option>)}
                </select>
              </div>
            )}
            <button type="submit" className="btn" style={{ background: '#f59e0b', color: '#000', border: 'none', fontWeight: 600 }}
              disabled={submitting}>
              {submitting ? 'Saving...' : '🧾 Save Expense'}
            </button>
          </form>

          {/* Expenses list */}
          {clubExpenses.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.75rem' }}>All Club Expenses</h3>
              <div className="table-wrap"><table>
                <thead><tr>
                  <th>Date</th><th>Description</th><th>Paid By</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                  {clubExpenses.map(exp => (
                    <tr key={exp.id}>
                      <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{exp.expenseDate}</td>
                      <td>{exp.description}</td>
                      <td style={{ color: exp.paidBy === 'ADMIN' ? '#a5b4fc' : '#94a3b8', fontSize: '0.85rem' }}>
                        {exp.paidBy === 'ADMIN' ? `👤 ${exp.adminUser}` : `🏦 ${exp.bankAccount?.name || 'Club'}`}
                      </td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>₪{Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td>
                        {exp.settled
                          ? <span style={{ background: '#16a34a22', color: '#22c55e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>✓ Settled</span>
                          : <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>Unsettled</span>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {!exp.settled && settlingId !== exp.id && (
                          <button onClick={() => setSettlingId(exp.id)}
                            style={{ fontSize: '0.78rem', padding: '2px 8px', background: '#1e3a5f', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: '4px', cursor: 'pointer' }}>
                            Settle
                          </button>
                        )}
                        {!exp.settled && settlingId === exp.id && (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select value={settleForm.bankAccountId} onChange={e => setSettleForm(f => ({ ...f, bankAccountId: e.target.value }))}
                              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem' }}>
                              <option value="">Bank...</option>
                              {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <input type="date" value={settleForm.settledAt} onChange={e => setSettleForm(f => ({ ...f, settledAt: e.target.value }))}
                              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem' }} />
                            <button onClick={() => handleSettle(exp.id)}
                              style={{ fontSize: '0.78rem', padding: '2px 8px', background: '#166534', border: '1px solid #22c55e', color: '#22c55e', borderRadius: '4px', cursor: 'pointer' }}>
                              ✓ Confirm
                            </button>
                            <button onClick={() => setSettlingId(null)}
                              style={{ fontSize: '0.78rem', padding: '2px 8px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}>
                              ✕
                            </button>
                          </div>
                        )}
                        <button onClick={() => handleDeleteClubExpense(exp.id)}
                          style={{ fontSize: '0.78rem', padding: '2px 6px', background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', marginLeft: '4px' }}
                          title="Delete">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
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
              <PlayerSelect label="From" value={transferForm.fromId} onChange={v => setTransferForm(f => ({ ...f, fromId: v }))} players={players} bankAccounts={bankAccounts} excludeId={transferForm.toId} includeClub />
              <PlayerSelect label="To" value={transferForm.toId} onChange={v => setTransferForm(f => ({ ...f, toId: v }))} players={players} bankAccounts={bankAccounts} excludeId={transferForm.fromId} includeClub />
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
      <div className="card" style={{ marginBottom: '1.5rem' }}>
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
                {[
                  { key: 'createdAt', label: 'Date' },
                  { key: 'pendingType', label: 'Type' },
                  { key: 'playerName', label: 'Player / From → To' },
                  { key: 'method', label: 'Method' },
                  { key: 'amount', label: 'Amount' },
                  { key: null, label: 'Notes' },
                  { key: 'createdByUsername', label: 'By' },
                  { key: null, label: '' },
                ].map(({ key, label }) => (
                  <th key={label} onClick={key ? () => setPendingSort(s => ({ col: key, dir: s.col === key && s.dir === 'asc' ? 'desc' : 'asc' })) : undefined}
                    style={key ? { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' } : undefined}>
                    {label}
                    {key && pendingSort.col === key && (
                      <span style={{ marginLeft: 4, fontSize: '0.75rem' }}>{pendingSort.dir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...pending].sort((a, b) => {
                const { col, dir } = pendingSort;
                const getVal = (item) => {
                  if (col === 'createdAt') return item.createdAt || '';
                  return item[col];
                };
                let av = getVal(a), bv = getVal(b);
                if (av == null && bv == null) return 0;
                if (av == null) return 1;
                if (bv == null) return -1;
                if (col === 'amount') { av = parseFloat(av); bv = parseFloat(bv); }
                const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                return dir === 'asc' ? cmp : -cmp;
              }).map((item, idx) => {
                const badge = TYPE_BADGE[item.pendingType] || TYPE_BADGE.CREDIT;
                const isEditing = editing && editing.id === item.id && editing.pendingType === item.pendingType;
                const rawDate = item.transferDate || item.transactionDate || item.createdAt?.substring(0, 10) || null;
                const fmtDate = rawDate ? rawDate.substring(8, 10) + '-' + rawDate.substring(5, 7) + '-' + rawDate.substring(0, 4) : '—';
                const fmtTime = item.createdAt && item.createdAt.length > 10 ? item.createdAt.substring(11, 16) : '';
                return (
                  <>
                    <tr key={`${item.pendingType}-${item.id}`}>
                      <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {fmtDate}{fmtTime && <span style={{ color: '#475569', marginLeft: '0.3rem' }}>{fmtTime}</span>}
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
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {(() => {
                          const isDebit = item.transactionType === 'PAYMENT' || item.transactionType === 'WHEEL_EXPENSE' || item.transactionType === 'WITHDRAWAL'
                            || (item.pendingType === 'XLS_UNMATCHED' && item.notes === 'Reduce Chips');
                          return isDebit
                            ? <strong className="negative">-{fmt(item.amount)}</strong>
                            : <strong className="positive">{fmt(item.amount)}</strong>;
                        })()}
                      </td>
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

      {/* Recent Credit Changes */}
      {recentCredits.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2>Recent Credit Changes <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 400 }}>(last 10 days)</span></h2>
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Player</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Notes</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {recentCredits.map(tx => (
                <tr key={tx.id}>
                  <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {tx.transactionDate ? tx.transactionDate.substring(8,10) + '-' + tx.transactionDate.substring(5,7) + '-' + tx.transactionDate.substring(0,4) : '—'}
                  </td>
                  <td>
                    <span onClick={() => navigate(`/player/${tx.playerId}`)} style={{ cursor: 'pointer' }}>
                      <strong style={{ color: '#6366f1' }}>{tx.playerUsername}</strong>
                      {tx.playerFullName ? <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.3rem' }}>{tx.playerFullName}</span> : null}
                    </span>
                  </td>
                  <td>
                    <span style={{ background: tx.type === 'CREDIT' ? '#3b1f5e' : '#1e3a5f', color: tx.type === 'CREDIT' ? '#c084fc' : '#60a5fa', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                      {tx.type === 'CREDIT' ? 'Credit' : 'Deposit'}
                    </span>
                  </td>
                  <td className={tx.amount >= 0 ? 'positive' : 'negative'} style={{ whiteSpace: 'nowrap' }}>
                    <strong>{fmt(tx.amount)}</strong>
                  </td>
                  <td style={{ color: '#64748b' }}>{tx.notes || '—'}</td>
                  <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{tx.createdByUsername || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
