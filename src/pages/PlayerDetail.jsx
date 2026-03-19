import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlayer, getPlayerTransactions, getPlayerResults, addTransaction, adminResetPassword, updateCredit, addDeposit } from '../api';
import { useAuth } from '../auth/AuthContext';

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'MANAGER';
  const [player, setPlayer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState('results');
  const [showForm, setShowForm] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [creditValue, setCreditValue] = useState('');
  const [depositValue, setDepositValue] = useState('');
  const [depositNotes, setDepositNotes] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [msg, setMsg] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [form, setForm] = useState({ type: 'DEPOSIT', amount: '', method: 'BIT', notes: '' });

  const load = () => {
    getPlayer(id).then(r => setPlayer(r.data));
    getPlayerTransactions(id).then(r => setTransactions(r.data));
    getPlayerResults(id).then(r => setResults(r.data));
  };

  useEffect(() => { load(); }, [id]);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '₪' + abs;
  };

  const balanceClass = (b) => b > 0 ? 'positive' : b < 0 ? 'negative' : 'zero';

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addTransaction({ playerId: Number(id), ...form, amount: Number(form.amount) });
      setMsg({ type: 'success', text: `${form.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} added successfully` });
      setShowForm(false);
      setForm({ type: 'DEPOSIT', amount: '', method: 'BIT', notes: '' });
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to add transaction' });
    }
  };

  const handleCreditUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateCredit(id, Number(creditValue));
      setMsg({ type: 'success', text: `Credit ${Number(creditValue) >= 0 ? 'added' : 'subtracted'} successfully` });
      setShowCreditForm(false);
      setCreditValue('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to update credit' });
    }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    try {
      await addDeposit(id, Number(depositValue), depositNotes);
      setMsg({ type: 'success', text: 'Deposit added successfully' });
      setShowDepositForm(false);
      setDepositValue('');
      setDepositNotes('');
      load();
    } catch {
      setMsg({ type: 'error', text: 'Failed to add deposit' });
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await adminResetPassword({ username: player.username, newPassword: newPass });
      setMsg({ type: 'success', text: `הסיסמא של ${player.username} אופסה בהצלחה` });
      setShowResetPass(false);
      setNewPass('');
    } catch {
      setMsg({ type: 'error', text: 'שגיאה באיפוס הסיסמא' });
    }
  };

  if (!player) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  const filteredResults = results.filter(r => {
    if (!r.session?.startTime) return true;
    const d = r.session.startTime.substring(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });
  const totalPnl = filteredResults.reduce((s, r) => s + (r.resultAmount || 0), 0);
  const totalHands = filteredResults.reduce((s, r) => s + (r.handsPlayed || 0), 0);
  const totalRake = filteredResults.reduce((s, r) => s + (r.rakePaid || 0), 0);

  return (
    <div>
      <div className="page-header">
        {isAdmin && <button className="back-btn" onClick={() => navigate('/')}>← Back to Dashboard</button>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isAdmin && (
            <>
              <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                + Transaction
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowCreditForm(!showCreditForm); setShowDepositForm(false); }}>
                ✏ Credit
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowDepositForm(!showDepositForm); setShowCreditForm(false); }}>
                + Deposit
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowResetPass(!showResetPass); setNewPass(''); }}>
                🔑 Reset Pass
              </button>
            </>
          )}
        </div>
      </div>

      {showResetPass && isAdmin && (
        <div className="card">
          <h2>איפוס סיסמא — {player.username}</h2>
          <form onSubmit={handleResetPassword}>
            <div className="form-row">
              <div className="form-group">
                <label>סיסמא חדשה</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    placeholder="לפחות 4 תווים"
                    style={{ paddingRight: '2.5rem', width: '100%', boxSizing: 'border-box' }}
                  />
                  <button type="button" onClick={() => setShowNewPass(v => !v)}
                    style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                    {showNewPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-success">אפס סיסמא</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowResetPass(false)}>ביטול</button>
            </div>
          </form>
        </div>
      )}

      {showCreditForm && isAdmin && (
        <div className="card">
          <h2>Add / Subtract Credit — {player.username}</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Current credit: <strong style={{ color: '#f59e0b' }}>{fmt(player.creditTotal)}</strong>
            {creditValue !== '' && !isNaN(Number(creditValue)) && (
              <span style={{ marginLeft: '1rem' }}>
                → New credit: <strong style={{ color: '#f59e0b' }}>{fmt((player.creditTotal || 0) + Number(creditValue))}</strong>
              </span>
            )}
          </p>
          <form onSubmit={handleCreditUpdate}>
            <div className="form-row">
              <div className="form-group">
                <label>Amount to add (use negative to subtract) (₪)</label>
                <input type="number" step="0.01" required value={creditValue}
                  onChange={e => setCreditValue(e.target.value)} placeholder="e.g. 1000 or -500" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-success">Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowCreditForm(false); setCreditValue(''); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showDepositForm && isAdmin && (
        <div className="card">
          <h2>Add Deposit — {player.username}</h2>
          <form onSubmit={handleDeposit}>
            <div className="form-row">
              <div className="form-group">
                <label>Amount (₪)</label>
                <input type="number" step="0.01" min="0.01" required value={depositValue}
                  onChange={e => setDepositValue(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={depositNotes}
                  onChange={e => setDepositNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-success">Add Deposit</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDepositForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {msg && (
        <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2>Add Deposit / Withdrawal</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="DEPOSIT">Deposit</option>
                  <option value="WITHDRAWAL">Withdrawal</option>
                </select>
              </div>
              <div className="form-group">
                <label>Amount (₪)</label>
                <input type="number" min="0" step="0.01" required value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Method</label>
                <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                  <option value="BIT">Bit</option>
                  <option value="PAYBOX">Paybox</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-success">Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="player-balance-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h2>Player Info</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>USERNAME</div>
              <div style={{ fontWeight: 600 }}>{player.username}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>FULL NAME</div>
              <div>{player.fullName || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>PHONE</div>
              <div>{player.phone || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>CLUB ID</div>
              <div style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{player.clubPlayerId || '—'}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>P&L (Balance)</div>
          <div className={balanceClass(player.balance)} style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', fontWeight: 700, margin: '0.5rem 0' }}>
            {fmt(player.balance)}
          </div>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>CURRENT CHIPS{player.chipsAsOf ? ` · ${player.chipsAsOf} 00:00` : ''}</div>
              <div style={{ fontWeight: 600 }}>{fmt(player.currentChips)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>CREDIT GIVEN</div>
              <div style={{ fontWeight: 600, color: player.creditTotal > 0 ? '#f59e0b' : '#94a3b8' }}>{fmt(player.creditTotal)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #2d3148', paddingBottom: '1rem', flexWrap: 'wrap' }}>
          {['transactions', 'results'].map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(t)}>
              {t === 'transactions'
                ? `Transactions${transactions.length ? ` (${transactions.length})` : ''}`
                : `Game Results${filteredResults.length ? ` (${filteredResults.length})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'transactions' && (
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Method</th>
                <th>By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{t.transactionDate || '—'}</td>
                  <td>
                    <span className={`badge ${t.type === 'DEPOSIT' ? 'deposit' : t.type === 'CREDIT' ? 'credit' : t.type === 'REPAYMENT' ? 'repayment' : 'withdrawal'}`}>
                      {t.type === 'CREDIT' ? 'Payment' : t.type === 'REPAYMENT' ? 'Cashout' : t.type}
                    </span>
                  </td>
                  <td className={t.type === 'DEPOSIT' || t.type === 'REPAYMENT' ? 'positive' : 'negative'}>{fmt(t.amount)}</td>
                  <td>{t.method || '—'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{t.createdByUsername || '—'}</td>
                  <td style={{ color: '#64748b' }}>{t.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        {tab === 'results' && (
          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ color: '#64748b', fontSize: '0.85rem' }}>From:</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem' }} />
              <label style={{ color: '#64748b', fontSize: '0.85rem' }}>To:</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem' }} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                  style={{ background: 'none', border: '1px solid #2d3148', color: '#94a3b8', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Clear
                </button>
              )}
            </div>
            {filteredResults.length > 0 && (
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#1a1d2e', borderRadius: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Sessions: <strong style={{ color: '#e2e8f0' }}>{filteredResults.length}</strong>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Total Hands: <strong style={{ color: '#e2e8f0' }}>{totalHands}</strong>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Total: <strong className={balanceClass(totalPnl)}>{fmt(totalPnl)}</strong>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Current Balance{player.chipsAsOf ? ` · ${player.chipsAsOf} 00:00` : ''}: <strong className={balanceClass(player.balance)}>{fmt(player.balance)}</strong>
                </span>
              </div>
            )}
            <div className="table-wrap"><table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Table</th>
                  <th>Game</th>
                  <th>Buy-in</th>
                  <th>Cashout</th>
                  <th>Hands</th>
                  {isAdmin && <th style={{ color: '#f59e0b' }}>Rake</th>}
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {r.session && r.session.startTime ? r.session.startTime.replace('T', ' ').substring(0, 16) : '-'}
                    </td>
                    <td style={{ unicodeBidi: 'bidi-override', direction: 'ltr' }}>{r.session ? r.session.tableName : '-'}</td>
                    <td><span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', unicodeBidi: 'bidi-override', direction: 'ltr' }}>{r.session ? r.session.gameType : '-'}</span></td>
                    <td>{fmt(r.buyIn)}</td>
                    <td>{fmt(r.cashout)}</td>
                    <td style={{ color: '#64748b' }}>{r.handsPlayed}</td>
                    {isAdmin && <td style={{ color: '#f59e0b' }}>{fmt(r.rakePaid)}</td>}
                    <td className={balanceClass(r.resultAmount)}><strong>{fmt(r.resultAmount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {((tab === 'transactions' && transactions.length === 0) ||
          (tab === 'results' && filteredResults.length === 0)) && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No records found</div>
        )}
      </div>
    </div>
  );
}
