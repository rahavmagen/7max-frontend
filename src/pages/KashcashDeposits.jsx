import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPendingKashcashDeposits, getKashcashHistory, confirmKashcashDeposit } from '../api';

const th = { padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border)' };
const td = { padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '0.9rem', borderBottom: '1px solid var(--border)' };

export default function KashcashDeposits() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [msg, setMsg] = useState(null);

  const loadPending = () =>
    getPendingKashcashDeposits().then(r => setPending(r.data)).catch(() => {});

  const loadHistory = () =>
    getKashcashHistory(from || null, to || null).then(r => setHistory(r.data)).catch(() => {});

  useEffect(() => {
    loadPending();
    loadHistory();
  }, []);

  const handleConfirm = async (id) => {
    setConfirming(id);
    setMsg(null);
    try {
      await confirmKashcashDeposit(id);
      setMsg({ type: 'success', text: 'Marked as done — chips confirmed.' });
      loadPending();
      loadHistory();
    } catch {
      setMsg({ type: 'error', text: 'Failed to confirm. Please try again.' });
    }
    setConfirming(null);
  };

  const fmt = (n) =>
    '\u20aa' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', marginBottom: '2rem' };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>KashCash Deposits</h2>

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

      {/* Pending Section */}
      <div style={card}>
        <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '1rem' }}>
          Pending — Chips Not Added
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
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px 14px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
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

      {/* History Section */}
      <div style={card}>
        <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '1rem' }}>History</h3>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {[['From', from, setFrom], ['To', to, setTo]].map(([label, val, setter]) => (
            <div key={label}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>{label}</label>
              <input
                type="date"
                value={val}
                onChange={e => setter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          ))}
          <button
            onClick={loadHistory}
            style={{
              background: 'var(--accent)',
              color: '#0f172a',
              border: 'none',
              borderRadius: 6,
              padding: '7px 20px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Filter
          </button>
          {(from || to) && (
            <button
              onClick={() => {
                setFrom('');
                setTo('');
                getKashcashHistory(null, null).then(r => setHistory(r.data)).catch(() => {});
              }}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
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
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>
                      {fmt(history.total)}
                    </td>
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
