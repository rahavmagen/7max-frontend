import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getPendingKashcashDeposits, getKashcashHistory, confirmKashcashDeposit,
  getPendingJoinRequests, getJoinHistory, approveJoinRequest, rejectJoinRequest,
} from '../api';
import DateInput from '../components/DateInput';

const th = { padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border)' };
const td = { padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '0.9rem', borderBottom: '1px solid var(--border)' };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', marginBottom: '2rem' };

export default function OpenRequests() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [msg, setMsg] = useState(null);

  const [joinPending, setJoinPending] = useState([]);
  const [joinHistory, setJoinHistory] = useState([]);
  const [showJoinHistory, setShowJoinHistory] = useState(false);
  const [joiningId, setJoiningId] = useState(null);

  const loadPending = () =>
    getPendingKashcashDeposits().then(r => setPending(r.data)).catch(() => {});
  const loadHistory = () =>
    getKashcashHistory(from || null, to || null).then(r => setHistory(r.data)).catch(() => {});
  const loadJoinPending = () =>
    getPendingJoinRequests().then(r => setJoinPending(r.data)).catch(() => {});
  const loadJoinHistory = () =>
    getJoinHistory().then(r => setJoinHistory(r.data)).catch(() => {});

  useEffect(() => {
    loadPending();
    loadHistory();
    loadJoinPending();
    loadJoinHistory();
  }, []);

  const handleConfirm = async (id) => {
    setConfirming(id);
    setMsg(null);
    try {
      await confirmKashcashDeposit(id);
      setMsg({ type: 'success', text: 'Marked as done — chips confirmed.' });
      await Promise.all([loadPending(), loadHistory()]);
    } catch {
      setMsg({ type: 'error', text: 'Failed to confirm. Please try again.' });
    }
    setConfirming(null);
  };

  const handleJoinAction = async (id, action) => {
    setJoiningId(id);
    setMsg(null);
    try {
      if (action === 'approve') {
        await approveJoinRequest(id);
        setMsg({ type: 'success', text: 'Request approved — player account created.' });
      } else {
        await rejectJoinRequest(id);
        setMsg({ type: 'success', text: 'Request rejected.' });
      }
      await Promise.all([loadJoinPending(), loadJoinHistory()]);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Action failed. Please try again.' });
    }
    setJoiningId(null);
  };

  const fmt = (n) =>
    '\u20aa' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Open Requests</h2>

      {msg && (
        <div style={{
          background: msg.type === 'success' ? '#14532d' : '#450a0a',
          color: msg.type === 'success' ? '#86efac' : '#fca5a5',
          border: `1px solid ${msg.type === 'success' ? '#16a34a' : '#dc2626'}`,
          borderRadius: 8, padding: '0.75rem 1.25rem', marginBottom: '1rem', fontSize: '0.9rem',
        }}>
          {msg.text}
        </div>
      )}

      {/* Join Requests — Pending */}
      <div style={{ ...card, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.05)' }}>
        <h3 style={{ color: '#a5b4fc', marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>
          Pending Join Requests
          {joinPending.length > 0 && (
            <span style={{ marginLeft: 10, background: '#6366f1', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600 }}>
              {joinPending.length}
            </span>
          )}
        </h3>

        {joinPending.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No pending join requests</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Username', 'Full Name', 'Phone', 'ClubGG ID', 'Date', 'Actions'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {joinPending.map(row => (
                  <tr key={row.id}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text-primary)' }}>{row.username}</td>
                    <td style={td}>{row.fullName}</td>
                    <td style={td}>{row.phone}</td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.clubPlayerId || '—'}</td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fmtDate(row.createdAt)}</td>
                    <td style={td}>
                      <button
                        onClick={() => handleJoinAction(row.id, 'approve')}
                        disabled={joiningId === row.id}
                        style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', marginRight: 6 }}
                      >Approve</button>
                      <button
                        onClick={() => handleJoinAction(row.id, 'reject')}
                        disabled={joiningId === row.id}
                        style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                      >Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rejected history — collapsible */}
        {joinHistory.length > 0 && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(99,102,241,0.2)', paddingTop: '1rem' }}>
            <button
              onClick={() => setShowJoinHistory(v => !v)}
              style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
            >
              {showJoinHistory ? '▾' : '▸'} Processed requests ({joinHistory.length})
            </button>
            {showJoinHistory && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
                <thead>
                  <tr>
                    {['Username', 'Full Name', 'Phone', 'Status', 'Reviewed'].map(h => (
                      <th key={h} style={{ ...th, fontSize: '0.75rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {joinHistory.map(row => (
                    <tr key={row.id}>
                      <td style={td}>{row.username}</td>
                      <td style={td}>{row.fullName}</td>
                      <td style={td}>{row.phone}</td>
                      <td style={td}>
                        <span style={{ color: row.status === 'APPROVED' ? '#86efac' : '#fca5a5', fontWeight: 600 }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{fmtDate(row.reviewedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* KashCash Deposits (Open) — Pending */}
      <div style={card}>
        <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '1rem' }}>
          KashCash Deposits (Open)
          {pending.length > 0 && (
            <span style={{ marginLeft: 10, background: '#dc2626', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600 }}>
              {pending.length}
            </span>
          )}
        </h3>

        {pending.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No pending deposits</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Username', 'Full Name', 'Amount', 'KashCash TxID', 'Action'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map(row => (
                  <tr key={row.id}>
                    <td style={td}>{row.date ? new Date(row.date).toLocaleString('he-IL') : '—'}</td>
                    <td style={td}><Link to={`/player/${row.playerId}`} style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>{row.username}</Link></td>
                    <td style={td}><Link to={`/player/${row.playerId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{row.fullName}</Link></td>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--accent)' }}>{fmt(row.amount)}</td>
                    <td style={{ ...td, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{row.kashcashTxId}</td>
                    <td style={td}>
                      <button
                        onClick={() => handleConfirm(row.id)}
                        disabled={confirming === row.id}
                        style={{
                          background: confirming === row.id ? '#334155' : '#16a34a',
                          color: '#fff', border: 'none', borderRadius: 6,
                          padding: '5px 14px', fontSize: '0.85rem', fontWeight: 600,
                          cursor: confirming === row.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {confirming === row.id ? '...' : 'Mark Done'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KashCash History */}
      <div style={card}>
        <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '1rem' }}>KashCash History</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {[['From', from, setFrom], ['To', to, setTo]].map(([label, val, setter]) => (
            <div key={label}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>{label}</label>
              <DateInput value={val} onChange={setter} />
            </div>
          ))}
          <button onClick={loadHistory}
            style={{ background: 'var(--accent)', color: '#0f172a', border: 'none', borderRadius: 6, padding: '7px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
            Filter
          </button>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); getKashcashHistory(null, null).then(r => setHistory(r.data)).catch(() => {}); }}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: '0.85rem' }}>
              Clear
            </button>
          )}
        </div>
        {history && (
          history.rows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No deposits in this period</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Username', 'Full Name', 'Amount', 'KashCash TxID', 'Status'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.rows.map(row => (
                    <tr key={row.id}>
                      <td style={td}>{row.date ? new Date(row.date).toLocaleString('he-IL') : '—'}</td>
                      <td style={{ ...td, fontWeight: 500, color: 'var(--text-primary)' }}>{row.username}</td>
                      <td style={td}>{row.fullName}</td>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--accent)' }}>{fmt(row.amount)}</td>
                      <td style={{ ...td, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{row.kashcashTxId}</td>
                      <td style={td}>
                        {row.chipsConfirmed
                          ? <span style={{ color: '#86efac', fontWeight: 600 }}>Done</span>
                          : <span style={{ color: '#fbbf24' }}>Pending chips</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>{fmt(history.total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
