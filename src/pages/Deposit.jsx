import { useState, useEffect } from 'react';
import { initiateKashcashDeposit, getMyKashcashDeposits } from '../api';

export default function Deposit() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'success' | 'error' | null
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getMyKashcashDeposits().then(r => setHistory(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      // TODO: restrict to KashCash origin once confirmed, e.g.: if (e.origin !== 'https://checkout.kashcash.co.il') return;
      const data = e.data || {};
      if (data.status === 1) {
        setPaymentStatus('success');
        setIframeUrl(null);
        // Reload history after successful payment
        getMyKashcashDeposits().then(r => setHistory(r.data)).catch(() => {});
      } else if (data.status === 2 || data.status === 3) {
        setPaymentStatus('error');
        setIframeUrl(null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handlePay = async () => {
    const num = parseFloat(amount);
    if (!num || num < 1) return;
    setLoading(true);
    setPaymentStatus(null);
    setIframeUrl(null);
    try {
      const res = await initiateKashcashDeposit(num);
      const { iframeUrl: url, appPaymentIntentUrl } = res.data;
      if (appPaymentIntentUrl && /Mobi|Android/i.test(navigator.userAgent)) {
        window.location.href = appPaymentIntentUrl;
      } else {
        setIframeUrl(url);
      }
    } catch {
      setPaymentStatus('error');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Deposit via KashCash</h2>

      {!iframeUrl && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 400,
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: 'var(--text-label)', fontSize: '0.85rem', marginBottom: 6 }}>
              Amount (&#8362;)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Enter amount"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handlePay}
            disabled={loading || !amount || parseFloat(amount) < 1}
            style={{
              background: loading || !amount ? '#334155' : 'var(--accent)',
              color: '#0f172a',
              border: 'none',
              borderRadius: 6,
              padding: '10px 24px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: loading || !amount ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {loading ? 'Processing...' : 'Pay with KashCash'}
          </button>
        </div>
      )}

      {iframeUrl && (
        <div style={{ margin: '1rem 0' }}>
          <iframe
            src={iframeUrl}
            title="KashCash Payment"
            style={{
              width: '100%',
              height: 520,
              border: 'none',
              borderRadius: 8,
              background: '#fff',
            }}
          />
        </div>
      )}

      {paymentStatus === 'success' && (
        <div style={{
          background: '#14532d',
          color: '#86efac',
          border: '1px solid #16a34a',
          borderRadius: 8,
          padding: '1rem 1.5rem',
          marginTop: '1rem',
          fontWeight: 500,
        }}>
          Payment confirmed! Chips will be added to your account shortly.
        </div>
      )}

      {paymentStatus === 'error' && (
        <div style={{
          background: '#450a0a',
          color: '#fca5a5',
          border: '1px solid #dc2626',
          borderRadius: 8,
          padding: '1rem 1.5rem',
          marginTop: '1rem',
          fontWeight: 500,
        }}>
          Payment was cancelled or rejected. Please try again.
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>My Deposit History</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Amount', 'KashCash TxID', 'Chips Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {row.date ? new Date(row.date).toLocaleString('he-IL') : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      &#8362;{Number(row.amount).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {row.kashcashTxId}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {row.chipsConfirmed
                        ? <span style={{ color: '#86efac' }}>Added</span>
                        : <span style={{ color: '#fbbf24' }}>Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
