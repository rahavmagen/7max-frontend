import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLiveTickets, getLiveTicketsHistory, useLiveTicket, syncLiveTickets } from '../api';

export default function LiveTickets() {
  const [tickets, setTickets] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, h] = await Promise.all([getLiveTickets(), getLiveTicketsHistory()]);
      setTickets(r.data); setHistory(h.data);
    }
    catch { setMsg('שגיאה בטעינה'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setLoading(true); setMsg(null);
    try { const r = await syncLiveTickets(); setMsg(`נסרק — נוספו ${r.data.created} כרטיסים`); await load(); }
    catch { setMsg('שגיאה בסנכרון'); setLoading(false); }
  };

  const markUsed = async (id) => {
    setBusyId(id);
    try { await useLiveTicket(id); await load(); }   // reload so the ticket moves to the history table
    catch { setMsg('שגיאה בסימון'); }
    setBusyId(null);
  };

  const fmt = (n) => n == null ? '—' : '₪' + Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';
  const total = tickets ? tickets.reduce((s, t) => s + Number(t.worth || 0), 0) : 0;

  const th = { padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const td = { padding: '10px 14px' };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>🎟 כרטיסים ללייב</h2>
        <button onClick={refresh} disabled={loading}
          style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem' }}>
          {loading ? '…' : '⟳ רענן'}
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0, marginBottom: '1.25rem' }}>
        כרטיסים ללייב שהמועדון חייב לזוכי סאט ללייב (סוכנים ושחקני סוכן). לחיצה על "מומש" מסמנת שהכרטיס נוצל.
      </p>

      {msg && <div style={{ color: msg.startsWith('שגיאה') ? '#fca5a5' : '#4ade80', fontSize: '0.85rem', marginBottom: '1rem' }}>{msg}</div>}

      {tickets !== null && (tickets.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          אין כרטיסים ללייב פתוחים.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600 }}>{tickets.length} כרטיסים</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>סה"כ שווי: <strong style={{ color: '#c084fc' }}>{fmt(total)}</strong></span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                  <th style={th}>שחקן</th>
                  <th style={th}>סוכן</th>
                  <th style={th}>אירוע</th>
                  <th style={{ ...th, textAlign: 'right' }}>שווי</th>
                  <th style={th}>תאריך זכייה</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={td}>
                      <Link to={`/player/${t.playerId}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{t.player}</Link>
                      {t.playerFullName && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> — {t.playerFullName}</span>}
                    </td>
                    <td style={{ ...td, color: '#34d399', fontSize: '0.85rem' }}>{t.agent || '—'}</td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }} dir="rtl">{t.eventName || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#c084fc', fontWeight: 600 }}>{fmt(t.worth)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fmtDate(t.wonDate)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => markUsed(t.id)} disabled={busyId === t.id}
                        style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                        {busyId === t.id ? '…' : 'מומש'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {history !== null && history.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.75rem' }}>היסטוריה — כל הכרטיסים ({history.length})</h3>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <th style={th}>שחקן</th>
                    <th style={th}>סוכן</th>
                    <th style={th}>אירוע</th>
                    <th style={{ ...th, textAlign: 'right' }}>שווי</th>
                    <th style={{ ...th, textAlign: 'right' }}>עלות סאט</th>
                    <th style={{ ...th, textAlign: 'right' }}>רווח</th>
                    <th style={th}>תאריך זכייה</th>
                    <th style={th}>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t, i) => (
                    <tr key={t.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', opacity: t.used ? 0.55 : 1 }}>
                      <td style={td}>
                        <Link to={`/player/${t.playerId}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{t.player}</Link>
                        {t.playerFullName && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> — {t.playerFullName}</span>}
                      </td>
                      <td style={{ ...td, color: '#34d399', fontSize: '0.85rem' }}>{t.agent || '—'}</td>
                      <td style={{ ...td, color: 'var(--text-secondary)' }} dir="rtl">{t.eventName || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#c084fc', fontWeight: 600 }}>{fmt(t.worth)}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#fca5a5' }}>{fmt(t.cost)}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>{fmt(t.profit)}</td>
                      <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fmtDate(t.wonDate)}</td>
                      <td style={td}>
                        {t.used
                          ? <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>✓ מומש {fmtDate(t.usedDate)}</span>
                          : <span style={{ color: '#fbbf24', fontSize: '0.82rem' }}>● פתוח</span>}
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
