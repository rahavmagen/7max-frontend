import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getLessonEvent, setLessonEvent, getLessonRegistrations,
  registerLesson, unregisterLesson, getMyPlayerInfo
} from '../api';

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '12px 16px',
  color: '#e2e8f0',
  fontSize: '1rem',
  boxSizing: 'border-box',
  outline: 'none',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const features = [
  'ניתוח ספוטים מעניינים שלכם ושלי (לייב ואונליין) מהתקופה האחרונה',
  'קונספטים תיאורטיים חדשים, טקטיקות חזקות והתאמות נצלניות',
  'סשנים משותפים — חיזוק תהליכי חשיבה וקבלת החלטות בזמן אמת',
  'בניית סט הרגלים חזק לפני, במהלך ואחרי סשן',
  'שיתוף בהתלבטויות מקצועיות ומנטליות — נתפתח ביחד',
];

export default function Lesson() {
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'MANAGER';

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [adminDate, setAdminDate] = useState('');
  const [adminTitle, setAdminTitle] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);

  useEffect(() => { loadEvent(); }, []);
  useEffect(() => { if (isAdmin && event?.id) loadRegistrations(); }, [isAdmin, event]);

  async function loadEvent() {
    setLoading(true);
    try {
      const res = await getLessonEvent();
      setEvent(Object.keys(res.data).length ? res.data : null);
    } finally { setLoading(false); }
  }

  async function loadRegistrations() {
    const res = await getLessonRegistrations();
    setRegistrations(res.data);
  }

  async function openForm() {
    setMsg(null);
    try {
      const res = await getMyPlayerInfo();
      setForm({ fullName: res.data.fullName || '', phone: res.data.phone || '' });
    } catch { setForm({ fullName: '', phone: '' }); }
    setShowForm(true);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      await registerLesson({ fullName: form.fullName, phone: form.phone });
      setMsg({ type: 'success', text: 'נרשמת בהצלחה! 🎉' });
      setShowForm(false);
      loadEvent();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'שגיאה בהרשמה' });
    } finally { setSubmitting(false); }
  }

  async function handleUnregister() {
    if (!window.confirm('האם לבטל את ההרשמה?')) return;
    setSubmitting(true);
    try {
      await unregisterLesson();
      setMsg({ type: 'info', text: 'ההרשמה בוטלה' });
      loadEvent();
      if (isAdmin) loadRegistrations();
    } finally { setSubmitting(false); }
  }

  async function handleSetEvent(e) {
    e.preventDefault();
    setAdminSaving(true);
    try {
      await setLessonEvent({ eventDate: adminDate, title: adminTitle || null });
      await loadEvent();
      if (isAdmin) loadRegistrations();
      setAdminDate('');
      setAdminTitle('');
    } finally { setAdminSaving(false); }
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: 'inherit', paddingBottom: 80 }}>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(160deg, #0f1117 0%, #1a1d2e 60%, #0f1117 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '56px 24px 48px',
        textAlign: 'center',
      }}>
        {/* Profile photo */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 28 }}>
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6, #f59e0b)',
            zIndex: 0,
          }} />
          <img
            src="/uri-profile.jpg"
            alt="Uri Alberg"
            style={{
              position: 'relative', zIndex: 1,
              width: 130, height: 130,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '4px solid #0f1117',
              display: 'block',
            }}
          />
        </div>

        {/* Title */}
        <h1 style={{
          margin: '0 0 14px',
          fontSize: 'clamp(2rem, 6vw, 3rem)',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f97316 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.5px',
          lineHeight: 1.2,
        }}>
          📈 מרסקים את הקאש!
        </h1>

        {/* Subtitle */}
        <p style={{ margin: '0 0 10px', color: '#cbd5e1', fontSize: '1.1rem', lineHeight: 1.6 }}>
          אימון קאש עם{' '}
          <span style={{
            color: '#f59e0b', fontWeight: 700,
            borderBottom: '2px solid #f59e0b44',
          }}>אורי אלברג</span>
          {' '}בכל מוצ"ש בשעות 20:30–22:00 בזום
        </p>

        {/* Tag */}
        <span style={{
          display: 'inline-block',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.3)',
          color: '#f59e0b',
          borderRadius: 20,
          padding: '4px 16px',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: 28,
        }}>
          • בלעדי לקהילת מקס7
        </span>

        {/* Description */}
        <p style={{
          maxWidth: 520, margin: '0 auto',
          color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.7,
        }}>
          מתאים לשחקנים שרוצים לשדרג את אסטרטגיית הקאש שלהם ולמקסם רווחים לייב ואונליין
        </p>
      </div>

      {/* ── FEATURES ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 0' }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 28,
        }}>
          <div style={{ fontWeight: 800, color: '#e2e8f0', fontSize: '1.1rem', marginBottom: 20 }}>
            במהלך האימונים:
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {features.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>
                <span style={{
                  flexShrink: 0, marginTop: 2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  color: '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700,
                }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 20, marginBottom: 0, color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>
            מחכה לכם! 🙌
          </p>
        </div>

        {/* ── EVENT + REGISTRATION ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: '32px 28px',
          marginBottom: 28,
          textAlign: 'center',
        }}>
          {loading ? (
            <div style={{ color: '#64748b', padding: '20px 0' }}>טוען...</div>
          ) : !event ? (
            <div style={{ color: '#64748b', fontSize: '0.95rem', padding: '16px 0' }}>
              האימון הבא טרם נקבע — בדוק שוב בקרוב
            </div>
          ) : (
            <>
              <div style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                האימון הקרוב
              </div>
              <div style={{
                fontSize: '1.4rem', fontWeight: 800,
                color: '#f59e0b',
                marginBottom: event.title ? 6 : 24,
              }}>
                {formatDate(event.eventDate)}
              </div>
              {event.title && (
                <div style={{ color: '#94a3b8', marginBottom: 24, fontSize: '0.95rem' }}>{event.title}</div>
              )}

              {msg && (
                <div style={{
                  background: msg.type === 'success' ? 'rgba(34,197,94,0.12)' : msg.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.15)',
                  border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : msg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.3)'}`,
                  color: msg.type === 'success' ? '#86efac' : msg.type === 'error' ? '#fca5a5' : '#94a3b8',
                  borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: '0.95rem',
                }}>{msg.text}</div>
              )}

              {event.isRegistered ? (
                <div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: '#86efac',
                    borderRadius: 10, padding: '12px 24px',
                    fontWeight: 700, fontSize: '1rem', marginBottom: 16,
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>✅</span> רשום לאימון הקרוב
                  </div>
                  <br />
                  <button
                    onClick={handleUnregister}
                    disabled={submitting}
                    style={{
                      background: 'transparent', color: '#64748b',
                      border: '1px solid rgba(100,116,139,0.3)',
                      borderRadius: 8, padding: '8px 20px',
                      fontSize: '0.85rem', cursor: 'pointer',
                    }}
                  >
                    ביטול הרשמה
                  </button>
                </div>
              ) : showForm ? (
                <form onSubmit={handleRegister} style={{ maxWidth: 380, margin: '0 auto', textAlign: 'right' }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ color: '#64748b', fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>שם מלא</label>
                    <input
                      style={inputStyle}
                      value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                      required placeholder="השם שלך"
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ color: '#64748b', fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>טלפון</label>
                    <input
                      style={inputStyle}
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="מספר טלפון"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowForm(false)} style={{
                      background: 'transparent', color: '#64748b',
                      border: '1px solid rgba(100,116,139,0.3)',
                      borderRadius: 8, padding: '11px 20px', fontSize: '0.9rem', cursor: 'pointer',
                    }}>ביטול</button>
                    <button type="submit" disabled={submitting} style={{
                      background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                      color: '#000', border: 'none', borderRadius: 8,
                      padding: '11px 28px', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer',
                    }}>
                      {submitting ? '...' : 'אישור הרשמה ✓'}
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={openForm} style={{
                  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                  color: '#000', border: 'none', borderRadius: 12,
                  padding: '16px 48px', fontSize: '1.1rem', fontWeight: 900,
                  cursor: 'pointer', letterSpacing: '0.3px',
                  boxShadow: '0 4px 24px rgba(245,158,11,0.35)',
                  transition: 'transform 0.1s',
                }}>
                  הרשמה לאימון ←
                </button>
              )}
            </>
          )}
        </div>

        {/* ── ADMIN PANEL ── */}
        {isAdmin && (
          <>
            <div style={{
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 14,
              padding: '24px',
              marginBottom: 20,
            }}>
              <div style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: 16, fontSize: '0.95rem' }}>
                🛠 הגדרת מועד אימון
              </div>
              <form onSubmit={handleSetEvent} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>תאריך</label>
                  <input type="date" style={{ ...inputStyle, width: 'auto' }} value={adminDate} onChange={e => setAdminDate(e.target.value)} required />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>כותרת (אופציונלי)</label>
                  <input style={inputStyle} value={adminTitle} onChange={e => setAdminTitle(e.target.value)} placeholder="שיעור #3" />
                </div>
                <button type="submit" disabled={adminSaving} style={{
                  background: 'rgba(99,102,241,0.2)', color: '#a5b4fc',
                  border: '1px solid rgba(99,102,241,0.35)',
                  borderRadius: 8, padding: '11px 22px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                }}>
                  {adminSaving ? '...' : event ? 'עדכון' : 'קביעה'}
                </button>
              </form>
            </div>

            <div style={{
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 14,
              padding: '24px',
            }}>
              <div style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: 16, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                👥 רשומים לאימון הבא
                <span style={{
                  background: 'rgba(99,102,241,0.25)', color: '#c7d2fe',
                  borderRadius: 6, padding: '2px 10px', fontSize: '0.82rem', fontWeight: 700,
                }}>{registrations.length}</span>
              </div>
              {registrations.length === 0 ? (
                <div style={{ color: '#475569', fontSize: '0.9rem' }}>אין רשומים עדיין</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ color: '#475569', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['יוזר', 'שם מלא', 'טלפון', 'תאריך הרשמה'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' }}>
                        <td style={{ padding: '10px 10px' }}>{r.username}</td>
                        <td style={{ padding: '10px 10px' }}>{r.fullName}</td>
                        <td style={{ padding: '10px 10px' }}>{r.phone}</td>
                        <td style={{ padding: '10px 10px', color: '#475569', fontSize: '0.8rem' }}>
                          {new Date(r.registeredAt).toLocaleString('he-IL')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
