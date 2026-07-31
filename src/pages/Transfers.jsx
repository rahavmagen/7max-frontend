import { Fragment, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getPlayers, updateCredit, addTransaction, createTransfer, getAllPending, confirmTransfer, confirmTransaction, updateTransfer, updateTransaction, addWheelExpense, getBankAccounts, getAdminUsers, createAdminExpense, getRecentTransactions, createClubExpense } from '../api';
import DateInput from '../components/DateInput';
import { fmtDateOnly } from '../utils/dates';
import PlayerSelect from '../components/PlayerSelect';

const METHODS = ['BIT', 'PAYBOX', 'KASHCASH', 'BANK_TRANSFER', 'CASH', 'OTHER'];
// Bit/PayBox are tied to a personal phone/account, so money sent that way always lands in a
// specific admin's wallet - never directly in the club's bank. When the club side of a transfer
// is "Bank Transfer", only these methods make sense.
const BANK_METHODS = ['BANK_TRANSFER', 'KASHCASH', 'CASH'];
const METHOD_LABELS = { BIT: 'Bit', PAYBOX: 'PayBox', KASHCASH: 'KashCash', BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash', OTHER: 'Other' };


const TYPE_BADGE = {
  TRANSFER:      { bg: '#1e3a5f', color: '#60a5fa', label: 'Transfer' },
  CREDIT:        { bg: '#3b1f5e', color: '#c084fc', label: 'Manual Credit' },
  PROMOTION:     { bg: '#14532d', color: '#4ade80', label: 'Promotion' },
  CHIP_PROMO:    { bg: '#3b2a00', color: '#fbbf24', label: '💰 Rakeback' },
  PLAYER_GIFT:   { bg: '#3b1400', color: '#fb7185', label: '🎁 Player Gift' },
  WHEEL_EXPENSE: { bg: '#7c2d12', color: '#fb923c', label: 'גלגל (Wheel)' },
  XLS_UNMATCHED:      { bg: '#422006', color: '#fbbf24', label: '⚠ XLS Unmatched' },
  EXPENSE_REPAYMENT:  { bg: '#166534', color: '#22c55e', label: '💸 Paid Expense' },
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

  // Unified Promotion form
  const [promoSubType, setPromoSubType] = useState('chipPromo');
  const [promoPlayerId, setPromoPlayerId] = useState('');
  const [promoAmount, setPromoAmount] = useState('');
  const [promoNotes, setPromoNotes] = useState('');

  // Admin expense form
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Club expense form
  const [clubExpForm, setClubExpForm] = useState({ amount: '', description: '', expenseDate: new Date().toISOString().slice(0,10), paidBy: 'ADMIN', adminUser: auth?.username || '', bankAccountId: '' });

  // Transfer form
  const [transferForm, setTransferForm] = useState({ fromId: '', toId: '', method: '', amount: '', notes: '', fromAdminUsername: '', toAdminUsername: '', fromClubType: '', toClubType: '', toExternalName: '' });

  const load = () => {
    getPlayers().then(r => setPlayers(r.data));
    getAllPending().then(r => setPending(r.data));
    getBankAccounts().then(r => setBankAccounts(r.data));
    getAdminUsers().then(r => setAdminUsers(r.data)).catch(() => {});
    getRecentTransactions(10).then(r => setRecentCredits(r.data)).catch(() => {});
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
      await updateCredit(creditPlayerId, delta, creditNotes || null);
      setMsg({ type: 'success', text: 'Credit updated successfully' });
      setCreditPlayerId(''); setCreditAmount(''); setCreditNotes('');
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
      } else if (promoSubType === 'playerGift') {
        await addTransaction({
          playerId: promoPlayerId,
          type: 'PLAYER_GIFT',
          amount: Number(promoAmount),
          method: 'OTHER',
          notes: promoNotes || null,
          pendingConfirmation: false,
          sourceRef: 'SCREEN:PLAYER_GIFT',
        });
        setMsg({ type: 'success', text: 'Player gift recorded' });
      } else {
        await addTransaction({
          playerId: promoPlayerId,
          type: 'CHIP_PROMO',
          amount: Number(promoAmount),
          method: 'OTHER',
          notes: promoNotes || null,
          pendingConfirmation: false,
          sourceRef: 'SCREEN:CHIP_PROMO',
        });
        setMsg({ type: 'success', text: 'Rakeback recorded' });
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
  const handleClubExpenseSubmit = async (e, vatType) => {
    if (e && e.preventDefault) e.preventDefault();
    const amount = parseFloat(clubExpForm.amount);
    if (isNaN(amount) || amount <= 0 || !clubExpForm.description.trim()) {
      setMsg({ type: 'error', text: 'Amount and description are required' });
      return;
    }
    if (clubExpForm.paidBy === 'ADMIN' && !clubExpForm.adminUser) {
      setMsg({ type: 'error', text: 'Select which admin paid' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        amount,
        description: clubExpForm.description.trim(),
        expenseDate: clubExpForm.expenseDate,
        paidBy: clubExpForm.paidBy,
        ...(clubExpForm.paidBy === 'ADMIN' ? { adminUser: clubExpForm.adminUser } : { bankAccountId: bankAccounts[0]?.id }),
        ...(vatType ? { vatType } : {}),
      };
      await createClubExpense(payload);
      setMsg({ type: 'success', text: 'Club expense recorded' });
      setClubExpForm({ amount: '', description: '', expenseDate: new Date().toISOString().slice(0,10), paidBy: 'ADMIN', adminUser: auth?.username || '', bankAccountId: '' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to record expense' });
    }
    setSubmitting(false);
  };

  const resolveParty = (id) => {
    if (!id || id === 'CLUB' || id === 'EXTERNAL') return { playerId: null, bankAccountId: null };
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
    if (transferForm.fromId === 'CLUB' && !transferForm.fromClubType) {
      setMsg({ type: 'error', text: 'Select the club funds source (Admin Wallet or Bank Transfer)' });
      return;
    }
    if (transferForm.toId === 'CLUB' && !transferForm.toClubType) {
      setMsg({ type: 'error', text: 'Select the club funds destination (Admin Wallet or Bank Transfer)' });
      return;
    }
    if (transferForm.fromId === 'CLUB' && transferForm.fromClubType === 'admin' && !transferForm.fromAdminUsername) {
      setMsg({ type: 'error', text: 'Select which admin wallet the funds come from' });
      return;
    }
    if (transferForm.toId === 'CLUB' && transferForm.toClubType === 'admin' && !transferForm.toAdminUsername) {
      setMsg({ type: 'error', text: 'Select which admin wallet the funds go to' });
      return;
    }
    // "CLUB" is not a single party — it splits into sub-accounts (each admin's wallet + the bank).
    // Both sides may be CLUB as long as they resolve to different sub-accounts, e.g. Bank → Admin
    // Wallet, or Admin X → Admin Y. Only a truly identical endpoint is rejected.
    const isSameParty = (() => {
      if (transferForm.fromId !== transferForm.toId) return false;
      if (transferForm.fromId !== 'CLUB') return true; // same player / same bank account
      if (transferForm.fromClubType !== transferForm.toClubType) return false; // e.g. bank → admin
      if (transferForm.fromClubType === 'admin') {
        return transferForm.fromAdminUsername === transferForm.toAdminUsername; // same admin wallet
      }
      return true; // both bank → same bank endpoint
    })();
    if (isSameParty) {
      setMsg({ type: 'error', text: 'From and To cannot be the same' });
      return;
    }
    if (transferForm.toId === 'EXTERNAL' && !transferForm.toExternalName.trim()) {
      setMsg({ type: 'error', text: 'Enter the external entity name' });
      return;
    }
    if ((transferForm.fromClubType === 'bank' || transferForm.toClubType === 'bank') && !bankAccounts[0]?.id) {
      setMsg({ type: 'error', text: 'No bank account is configured - add one before recording a bank transfer' });
      return;
    }
    setSubmitting(true);
    const from = resolveParty(transferForm.fromId);
    const to = resolveParty(transferForm.toId);
    // "Bank Transfer" club sub-choice must link the real bank account, not just clear the admin field -
    // otherwise the transfer is indistinguishable from an unassigned club transaction and never moves
    // the tracked bank balance.
    const fromBankAccountId = transferForm.fromId === 'CLUB' && transferForm.fromClubType === 'bank' ? bankAccounts[0]?.id ?? null : from.bankAccountId;
    const toBankAccountId = transferForm.toId === 'CLUB' && transferForm.toClubType === 'bank' ? bankAccounts[0]?.id ?? null : to.bankAccountId;
    const notes = transferForm.toId === 'EXTERNAL'
      ? `External: ${transferForm.toExternalName.trim()}${transferForm.notes ? ' — ' + transferForm.notes : ''}`
      : (transferForm.notes || null);
    try {
      await createTransfer({
        fromPlayerId: from.playerId,
        fromBankAccountId,
        toPlayerId: to.playerId,
        toBankAccountId,
        method: transferForm.method,
        amount: parseFloat(transferForm.amount),
        notes,
        fromAdminUsername: transferForm.fromId === 'CLUB' && transferForm.fromClubType === 'admin' ? (transferForm.fromAdminUsername || null) : null,
        toAdminUsername: transferForm.toId === 'CLUB' && transferForm.toClubType === 'admin' ? (transferForm.toAdminUsername || null) : null,
      });
      setMsg({ type: 'success', text: 'Transfer recorded successfully' });
      setTransferForm({ fromId: '', toId: '', method: '', amount: '', notes: '', fromAdminUsername: '', toAdminUsername: '', fromClubType: '', toClubType: '', toExternalName: '' });
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
              { key: 'chipPromo',  label: '💰 Rakeback' },
              { key: 'playerGift', label: '🎁 Player Gift' },
              { key: 'writeOff',   label: '✏️ Write Off' },
              { key: 'wheel',      label: '🎡 Wheel' },
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
            {promoSubType === 'chipPromo'  && 'Record a rakeback payment (chips) to a player.'}
            {promoSubType === 'playerGift' && 'Record a discretionary chip gift to a player, not tied to their rakeback.'}
            {promoSubType === 'writeOff'   && "Forgive a player's negative balance. Deducted from club profit as a promotion expense."}
            {promoSubType === 'wheel'      && 'Record a wheel expense for a player. Chip count is updated only via XLS upload.'}
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
                <DateInput value={clubExpForm.expenseDate} onChange={v => setClubExpForm(f => ({ ...f, expenseDate: v }))} />
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
                  {adminUsers.map(u => { const name = typeof u === 'string' ? u : u.username; return <option key={name} value={name}>{name}</option>; })}
                </select>
              </div>
            )}
            {clubExpForm.paidBy === 'ADMIN' ? (
              <button type="submit" className="btn" style={{ background: '#f59e0b', color: '#000', border: 'none', fontWeight: 600 }}
                disabled={submitting}>
                {submitting ? 'Saving...' : '🧾 Save Expense'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn"
                  style={{ background: '#166534', color: '#4ade80', border: '1px solid #22c55e', fontWeight: 600 }}
                  disabled={submitting}
                  onClick={() => handleClubExpenseSubmit(null, 'NO_VAT')}>
                  {submitting ? 'Saving...' : '🧾 Save — No VAT'}
                </button>
                <button type="button" className="btn"
                  style={{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #3b82f6', fontWeight: 600 }}
                  disabled={submitting}
                  onClick={() => handleClubExpenseSubmit(null, 'WITH_VAT')}>
                  {submitting ? 'Saving...' : '🧾 Save — VAT'}
                </button>
              </div>
            )}
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
              <div>
                <PlayerSelect label="From" value={transferForm.fromId} onChange={v => setTransferForm(f => ({ ...f, fromId: v, fromAdminUsername: '', fromClubType: '', toId: v !== 'CLUB' && f.toId === 'EXTERNAL' ? '' : f.toId, toExternalName: v !== 'CLUB' && f.toId === 'EXTERNAL' ? '' : f.toExternalName }))} players={players} bankAccounts={bankAccounts} excludeId={transferForm.toId} includeClub />
                {transferForm.fromId === 'CLUB' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Club funds source *</label>
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      {[{ key: 'admin', label: '👤 Admin Wallet' }, { key: 'bank', label: '🏦 Bank Transfer' }].map(({ key, label }) => (
                        <button key={key} type="button"
                          onClick={() => setTransferForm(f => ({ ...f, fromClubType: key, fromAdminUsername: '', method: key === 'bank' && !BANK_METHODS.includes(f.method) ? '' : f.method }))}
                          style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            background: transferForm.fromClubType === key ? '#2d3148' : 'transparent',
                            borderColor: transferForm.fromClubType === key ? '#6366f1' : '#2d3148',
                            color: transferForm.fromClubType === key ? '#e2e8f0' : '#64748b' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {transferForm.fromClubType === 'admin' && (
                      <select value={transferForm.fromAdminUsername} onChange={e => setTransferForm(f => ({ ...f, fromAdminUsername: e.target.value }))}
                        style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', width: '100%', fontSize: '0.875rem' }}>
                        <option value="">Select admin...</option>
                        {adminUsers.map(u => { const name = typeof u === 'string' ? u : u.username; return <option key={name} value={name}>{name}</option>; })}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <div>
                <PlayerSelect label="To" value={transferForm.toId} onChange={v => setTransferForm(f => ({ ...f, toId: v, toAdminUsername: '', toClubType: '', toExternalName: '', method: v === 'EXTERNAL' && !BANK_METHODS.includes(f.method) ? '' : f.method }))} players={players} bankAccounts={bankAccounts} excludeId={transferForm.fromId} includeClub includeExternal={transferForm.fromId === 'CLUB'} />
                {transferForm.toId === 'EXTERNAL' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Entity name *</label>
                    <input type="text" required value={transferForm.toExternalName}
                      onChange={e => setTransferForm(f => ({ ...f, toExternalName: e.target.value }))}
                      placeholder="e.g. Partner Club ABC"
                      style={{ width: '100%', padding: '0.6rem 0.9rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </div>
                )}
                {transferForm.toId === 'CLUB' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Club funds destination *</label>
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      {[{ key: 'admin', label: '👤 Admin Wallet' }, { key: 'bank', label: '🏦 Bank Transfer' }].map(({ key, label }) => (
                        <button key={key} type="button"
                          onClick={() => setTransferForm(f => ({ ...f, toClubType: key, toAdminUsername: '', method: key === 'bank' && !BANK_METHODS.includes(f.method) ? '' : f.method }))}
                          style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            background: transferForm.toClubType === key ? '#2d3148' : 'transparent',
                            borderColor: transferForm.toClubType === key ? '#6366f1' : '#2d3148',
                            color: transferForm.toClubType === key ? '#e2e8f0' : '#64748b' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {transferForm.toClubType === 'admin' && (
                      <select value={transferForm.toAdminUsername} onChange={e => setTransferForm(f => ({ ...f, toAdminUsername: e.target.value }))}
                        style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', width: '100%', fontSize: '0.875rem' }}>
                        <option value="">Select admin...</option>
                        {adminUsers.map(u => { const name = typeof u === 'string' ? u : u.username; return <option key={name} value={name}>{name}</option>; })}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Payment Method *</label>
                {(() => {
                  const isBankSide = transferForm.fromClubType === 'bank' || transferForm.toClubType === 'bank' || transferForm.toId === 'EXTERNAL';
                  const availableMethods = isBankSide ? BANK_METHODS : METHODS;
                  return (
                    <select required value={transferForm.method} onChange={e => setTransferForm(f => ({ ...f, method: e.target.value }))}>
                      <option value="">Select method...</option>
                      {availableMethods.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                    </select>
                  );
                })()}
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
                const fmtDate = rawDate ? fmtDateOnly(rawDate) : '—';
                const fmtTime = item.createdAt && item.createdAt.length > 10 ? item.createdAt.substring(11, 16) : '';
                return (
                  <Fragment key={`${item.pendingType}-${item.id}`}>
                    <tr>
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
                  </Fragment>
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
