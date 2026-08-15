import { useState, useEffect, useRef } from 'react';
import { initiateKashcashDeposit, finalizeKashcashDeposit, getMyKashcashDeposits } from '../api';
import { useLang } from '../i18n';

export default function Deposit() {
  const { t } = useLang();
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


  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // After opening the KashCash app (bottom sheet overlay), the browser tab is never
  // hidden so events don't fire. Poll deposit history until the KashCash webhook
  // fires and the deposit appears, then show success.
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
        // Hand off to the KashCash app directly - no barcode shown first. The tab
        // won't reliably get focus/message events while the app is in front, so
        // start polling right away.
        updateStatus('processing');
        pollForDeposit(transactionId);
        window.location.href = appPaymentIntentUrl;
        // If the tab is still visible shortly after, the app never took over
        // (not installed, or the OS blocked the handoff) - fall back to the barcode.
        setTimeout(() => {
          if (document.visibilityState === 'visible' && !paymentHandledRef.current) {
            updateStatus(null);
            setIframeUrl(url);
          }
        }, 1800);
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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 0 }}>

      <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          flex: '1 1 380px',
          minWidth: 320,
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
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>{t('depositTitle')}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>{t('depositSubtitle')}</div>
            </div>
          </div>

          {/* Form */}
          <div style={{ padding: '1.5rem' }}>
            <label style={{ display: 'block', color: 'var(--text-label)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('amount')} (&#8362;)
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
              placeholder={t('customAmount')}
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
              {loading ? t('processing') : `${t('depositBtn')}${amount && parseFloat(amount) >= 1 ? ` · ₪${parseFloat(amount).toLocaleString()}` : ''}`}
            </button>

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <span>🔒</span>
              <span>{t('securePayments')}</span>
            </div>
          </div>
      </div>

      {/* WhatsApp / Phone card */}
      <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          flex: '1 1 380px',
          minWidth: 320,
          display: 'flex',
          flexDirection: 'column',
        }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <img
            src="/whatsapp-logo.png"
            alt="WhatsApp"
            style={{ height: 48, width: 48, borderRadius: 10, objectFit: 'contain' }}
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none', width: 48, height: 48, borderRadius: 10, background: '#25d366', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>💬</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>צור קשר עם המועדון</div>
            <div style={{ color: '#6ee7b7', fontSize: '0.8rem', marginTop: 2 }}>שירות לקוחות ותמיכה</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
          <div style={{ textAlign: 'center', direction: 'rtl' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>טלפון מועדון</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.05em' }}>050-963-5828</div>
          </div>

          <a
            href="https://wa.me/972509635828"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '12px 24px',
              background: '#25d366',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
              marginTop: 'auto',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" fill="white">
              <path d="M16 2C8.268 2 2 8.268 2 16c0 2.47.68 4.786 1.86 6.77L2 30l7.45-1.83A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.83-1.6l-.42-.25-4.42 1.08 1.12-4.31-.28-.44A11.5 11.5 0 1 1 16 27.5zm6.29-8.6c-.34-.17-2.02-1-2.33-1.11-.31-.12-.54-.17-.77.17-.23.34-.88 1.11-1.08 1.34-.2.23-.4.25-.74.08-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.12-.23.06-.43-.03-.6-.08-.17-.77-1.85-1.05-2.53-.28-.67-.56-.58-.77-.59-.2-.01-.43-.01-.66-.01-.23 0-.6.08-.91.4-.31.31-1.2 1.17-1.2 2.86 0 1.68 1.23 3.31 1.4 3.54.17.23 2.42 3.69 5.86 5.17.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.02-.82 2.31-1.62.28-.8.28-1.49.2-1.62-.08-.14-.31-.22-.65-.39z"/>
            </svg>
            שלח הודעה ב-WhatsApp
          </a>

          <a
            href="tel:0509635828"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '12px 24px',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '1rem',
              textDecoration: 'none',
              direction: 'rtl',
            }}
          >
            📞 התקשר עכשיו
          </a>
        </div>
      </div>

      </div>{/* end flex row */}

      {iframeUrl && (
        <div style={{ margin: '0 0 1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('completePayment')}</span>
            <button
              onClick={() => { setIframeUrl(null); updateStatus(null); }}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {t('cancel')}
            </button>
          </div>
          {iframeUrl.trimStart().startsWith('<svg') ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
              <p style={{ color: '#334155', marginBottom: '1rem', fontWeight: 500 }}>{t('scanQr')}</p>
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
          {t('verifyingPayment')}
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
          {t('paymentConfirmed')}
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
          {t('paymentFailed')}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('depositHistory')}
          </h3>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                    {[t('colDate'), t('colAmount'), t('colTxid'), t('colStatus')].map(h => (
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
                          ? <span style={{ color: '#86efac', fontWeight: 600, fontSize: '0.8rem' }}>{t('statusAdded')}</span>
                          : <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.8rem' }}>{t('statusPending')}</span>}
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
