import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlayer, getPlayerTransactions, getPlayerResults, addTransaction } from '../api';

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState('transactions');
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState(null);
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

  if (!player) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  const totalPnl = results.reduce((s, r) => s + (r.resultAmount || 0), 0);
  const totalHands = results.reduce((s, r) => s + (r.handsPlayed || 0), 0);

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back to Dashboard</button>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + Add Transaction
        </button>
      </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.5rem' }}>
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
          <div className={balanceClass(player.balance)} style={{ fontSize: '3rem', fontWeight: 700, margin: '0.5rem 0' }}>
            {fmt(player.balance)}
          </div>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>CURRENT CHIPS</div>
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
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #2d3148', paddingBottom: '1rem' }}>
          {['transactions', 'results'].map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(t)}>
              {t === 'transactions' ? 'Transactions' : `Game Results${results.length ? ` (${results.length})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'transactions' && (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{t.transactionDate || '—'}</td>
                  <td><span className={`badge ${t.type === 'DEPOSIT' ? 'deposit' : 'withdrawal'}`}>{t.type}</span></td>
                  <td className={t.type === 'DEPOSIT' ? 'positive' : 'negative'}>{fmt(t.amount)}</td>
                  <td>{t.method}</td>
                  <td style={{ color: '#64748b' }}>{t.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'results' && (
          <div>
            {results.length > 0 && (
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#1a1d2e', borderRadius: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Sessions: <strong style={{ color: '#e2e8f0' }}>{results.length}</strong>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Total Hands: <strong style={{ color: '#e2e8f0' }}>{totalHands}</strong>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Total P&L: <strong className={balanceClass(totalPnl)}>{fmt(totalPnl)}</strong>
                </span>
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Table</th>
                  <th>Game</th>
                  <th>Buy-in</th>
                  <th>Cashout</th>
                  <th>Hands</th>
                  <th>Rake</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {r.session && r.session.startTime ? r.session.startTime.replace('T', ' ').substring(0, 16) : '-'}
                    </td>
                    <td>{r.session ? r.session.tableName : '-'}</td>
                    <td><span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{r.session ? r.session.gameType : '-'}</span></td>
                    <td>{fmt(r.buyIn)}</td>
                    <td>{fmt(r.cashout)}</td>
                    <td style={{ color: '#64748b' }}>{r.handsPlayed}</td>
                    <td style={{ color: '#64748b' }}>{fmt(r.rakePaid)}</td>
                    <td className={balanceClass(r.resultAmount)}><strong>{fmt(r.resultAmount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {((tab === 'transactions' && transactions.length === 0) ||
          (tab === 'results' && results.length === 0)) && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No records found</div>
        )}
      </div>
    </div>
  );
}
