import { useState, useEffect, useRef } from 'react';
import { initiateKashcashDeposit, finalizeKashcashDeposit, getMyKashcashDeposits } from '../api';

export default function Deposit() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [iframeUrl, setIframeUrl] = useState(null);
  // Persist status across tab switches so user sees result when returning to this page
  const [paymentStatus, setPaymentStatus] = useState(() => {
    const s = sessionStorage.getItem('kc_payment_status');
    return s === 'success' ? 'success' : null; // only restore success, never error/processing
  });
  const [history, setHistory] = useState([]);
  const pendingTxIdRef = useRef(null);
  const paymentHandledRef = useRef(false); // prevents duplicate/follow-up postMessages overriding result

  const updateStatus = (status) => {
    // Only persist success — error/processing should clear on page reload
    if (status === 'success') sessionStorage.setItem('kc_payment_status', status);
    else sessionStorage.removeItem('kc_payment_status');
    setPaymentStatus(status);
  };

  useEffect(() => {
    getMyKashcashDeposits().then(r => setHistory(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const data = e.data || {};
      if (data.status === 1) {
        if (paymentHandledRef.current) return;
        paymentHandledRef.current = true;
        setIframeUrl(null);
        updateStatus('processing');
        const txId = pendingTxIdRef.current || data.transactionId;
        if (txId) {
          finalizeKashcashDeposit(txId)
            .then((res) => {
              if (res.data && res.data.success === false) {
                updateStatus('error');
              } else {
                updateStatus('success');
                getMyKashcashDeposits().then(r => setHistory(r.data)).catch(() => {});
              }
            })
            .catch(() => updateStatus('error'));
        } else {
          updateStatus('error');
        }
      } else if (data.status === 2 || data.status === 3) {
        if (paymentHandledRef.current) return;
        updateStatus('error');
        setIframeUrl(null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);


  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // On mobile: after opening the KashCash app (bottom sheet overlay), the browser
  // tab is never hidden so events don't fire. Instead, poll deposit history until
  // the KashCash webhook fires and the deposit appears, then show success.
  const pollForDeposit = (txId) => {
    const startTime = Date.now();
    const pollId = setInterval(async () => {
      if (paymentHandledRef.current) { clearInterval(pollId); return; }
      // Timeout after 10 minutes
      if (Date.now() - startTime > 10 * 60 * 1000) {
        clearInterval(pollId);
        if (!paymentHandledRef.current) updateStatus('error');
        return;
      }
      try {
        const res = await getMyKashcashDeposits();
        const found = res.data.find(d => d.kashcashTxId === txId);
        if (found) {
          clearInterval(pollId);
          paymentHandledRef.current = true;
          updateStatus('success');
          setHistory(res.data);
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const handlePay = async () => {
    const num = parseFloat(amount);
    if (!num || num < 1) return;
    setLoading(true);
    updateStatus(null);
    setIframeUrl(null);
    paymentHandledRef.current = false;
    try {
      const res = await initiateKashcashDeposit(num);
      const { iframeUrl: url, appPaymentIntentUrl, transactionId } = res.data;
      pendingTxIdRef.current = transactionId;
      if (isMobile && appPaymentIntentUrl) {
        // Open native KashCash app (bottom sheet). Detection via events is impossible
        // (overlay never hides the tab), so poll deposit history for webhook confirmation.
        window.location.href = appPaymentIntentUrl;
        updateStatus('processing');
        pollForDeposit(transactionId);
      } else {
        setIframeUrl(url);
      }
    } catch {
      updateStatus('error');
    }
    setLoading(false);
  };

  const quickAmounts = [300, 500, 1000, 2000];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem' }}>

      <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          maxWidth: 420,
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2240 100%)',
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            borderBottom: '1px solid var(--border)',
          }}>
            <img
              src="/kashcashLogo.png"
              alt="KashCash"
              style={{ height: 48, width: 48, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 4 }}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>KashCash Deposit</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>Secure payment via KashCash</div>
            </div>
          </div>

          {/* Form */}
          <div style={{ padding: '1.5rem' }}>
            <label style={{ display: 'block', color: 'var(--text-label)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Amount (&#8362;)
            </label>

            {/* Quick amount buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {quickAmounts.map(q => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    background: amount === String(q) ? 'var(--accent)' : 'var(--bg-input)',
                    color: amount === String(q) ? '#0f172a' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  &#8362;{q}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Or enter custom amount"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: '1rem',
                boxSizing: 'border-box',
                marginBottom: '1.25rem',
                outline: 'none',
              }}
            />

            <button
              onClick={handlePay}
              disabled={loading || !amount || parseFloat(amount) < 1}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: loading || !amount || parseFloat(amount) < 1 ? '#334155' : 'var(--accent)',
                color: loading || !amount || parseFloat(amount) < 1 ? '#64748b' : '#0f172a',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading || !amount || parseFloat(amount) < 1 ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {loading ? 'Processing...' : `Deposit KashCash${amount && parseFloat(amount) >= 1 ? ` · ₪${parseFloat(amount).toLocaleString()}` : ''}`}
            </button>

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <span>🔒</span>
              <span>Payments are processed securely by KashCash</span>
            </div>
          </div>
      </div>

      {iframeUrl && (
        <div style={{ margin: '0 0 1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Complete your payment</span>
            <button
              onClick={() => { setIframeUrl(null); updateStatus(null); }}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
          </div>
          {iframeUrl.trimStart().startsWith('<svg') ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
              <p style={{ color: '#334155', marginBottom: '1rem', fontWeight: 500 }}>Scan the QR code to complete your payment</p>
              <div dangerouslySetInnerHTML={{ __html: iframeUrl }} style={{ display: 'inline-block', maxWidth: 260 }} />
            </div>
          ) : (
            <iframe
              src={iframeUrl}
              title="KashCash Payment"
              style={{
                width: '100%',
                height: 540,
                border: 'none',
                borderRadius: 12,
                background: '#fff',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              }}
            />
          )}
        </div>
      )}

      {paymentStatus === 'processing' && (
        <div style={{
          background: '#1e3a5f',
          color: '#93c5fd',
          border: '1px solid #3b82f6',
          borderRadius: 10,
          padding: '1rem 1.5rem',
          marginTop: '1rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: '1.2rem' }}>⏳</span>
          Verifying payment with KashCash...
        </div>
      )}

      {paymentStatus === 'success' && (
        <div style={{
          background: '#14532d',
          color: '#86efac',
          border: '1px solid #16a34a',
          borderRadius: 10,
          padding: '1rem 1.5rem',
          marginTop: '1rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: '1.2rem' }}>✓</span>
          Payment confirmed! Chips will be added to your account shortly.
        </div>
      )}

      {paymentStatus === 'error' && (
        <div style={{
          background: '#450a0a',
          color: '#fca5a5',
          border: '1px solid #dc2626',
          borderRadius: 10,
          padding: '1rem 1.5rem',
          marginTop: '1rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: '1.2rem' }}>✕</span>
          Payment was cancelled or rejected. Please try again.
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Deposit History
          </h3>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                    {['Date', 'Amount', 'KashCash TxID', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => (
                    <tr key={row.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {row.date ? new Date(row.date).toLocaleString('he-IL') : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        &#8362;{Number(row.amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {row.kashcashTxId || '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {row.chipsConfirmed
                          ? <span style={{ color: '#86efac', fontWeight: 600, fontSize: '0.8rem' }}>Added</span>
                          : <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.8rem' }}>Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
