import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getLessonEvent, setLessonEvent, getLessonRegistrations,
  registerLesson, unregisterLesson, getMyPlayerInfo
} from '../api';

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
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
  return new Date(y, m - 1, d).toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
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

  async function handleRegister() {
    setSubmitting(true);
    setMsg(null);
    try {
      const profile = await getMyPlayerInfo();
      await registerLesson({ fullName: profile.data.fullName || '', phone: profile.data.phone || '' });
      setMsg({ type: 'success', text: 'נרשמת בהצלחה! 🎉' });
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
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(245,158,11,0.18) 0%, transparent 70%), #0f1117',
        borderBottom: '1px solid rgba(245,158,11,0.15)',
        padding: '60px 24px 52px',
        textAlign: 'center',
      }}>
        {/* Decorative glow blobs */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 260, height: 260,
          borderRadius: '50%', background: 'rgba(245,158,11,0.08)', filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(139,92,246,0.1)', filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        {/* Profile photo with spinning gradient ring */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 28 }}>
          <div style={{
            position: 'absolute', inset: -5, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6, #10b981, #f59e0b)',
            zIndex: 0, filter: 'blur(1px)',
          }} />
          <div style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6, #10b981, #f59e0b)',
            zIndex: 0,
          }} />
          <img
            src="/uri-profile.jpg"
            alt="Uri Alberg"
            style={{
              position: 'relative', zIndex: 1,
              width: 140, height: 140,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '5px solid #0f1117',
              display: 'block',
              boxShadow: '0 0 40px rgba(245,158,11,0.25)',
            }}
          />
        </div>

        {/* Title */}
        <h1 style={{
          margin: '0 0 16px',
          fontSize: 'clamp(2.2rem, 7vw, 3.4rem)',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #f97316 80%, #fbbf24 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-1px',
          lineHeight: 1.1,
          textShadow: 'none',
          filter: 'drop-shadow(0 0 30px rgba(245,158,11,0.4))',
        }}>
          📈 מרסקים את הקאש!
        </h1>

        {/* Subtitle */}
        <p style={{ margin: '0 0 14px', color: '#cbd5e1', fontSize: '1.1rem', lineHeight: 1.7 }}>
          אימון קאש עם{' '}
          <span style={{
            fontWeight: 800, color: '#fbbf24',
            textShadow: '0 0 20px rgba(251,191,36,0.5)',
          }}>אורי אלברג</span>
          {' '}בכל מוצ"ש בשעות 20:30–22:00 בזום
        </p>

        {/* Exclusive tag */}
        <div style={{ marginBottom: 28 }}>
          <span style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(249,115,22,0.12))',
            border: '1px solid rgba(245,158,11,0.45)',
            color: '#fbbf24',
            borderRadius: 24,
            padding: '6px 20px',
            fontSize: '0.88rem',
            fontWeight: 700,
            letterSpacing: '0.3px',
            boxShadow: '0 0 16px rgba(245,158,11,0.2)',
          }}>
            ✦ בלעדי לקהילת מקס7
          </span>
        </div>

        <p style={{
          maxWidth: 520, margin: '0 auto',
          color: '#94a3b8', fontSize: '1rem', lineHeight: 1.8,
        }}>
          מתאים לשחקנים שרוצים לשדרג את אסטרטגיית הקאש שלהם ולמקסם רווחים לייב ואונליין
        </p>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 660, margin: '0 auto', padding: '44px 20px 0' }}>

        {/* Features card */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '32px 36px',
          marginBottom: 28,
          boxShadow: '0 4px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          <div style={{
            fontWeight: 800, color: '#f1f5f9', fontSize: '1.15rem',
            marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              borderRadius: 8, padding: '4px 10px', fontSize: '0.85rem', color: '#000', fontWeight: 900,
            }}>במהלך האימונים</span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {features.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, color: '#94a3b8', fontSize: '0.97rem', lineHeight: 1.6 }}>
                <span style={{
                  flexShrink: 0, marginTop: 1,
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(249,115,22,0.15))',
                  border: '1px solid rgba(245,158,11,0.5)',
                  color: '#fbbf24',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 900,
                  boxShadow: '0 0 8px rgba(245,158,11,0.2)',
                }}>✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 24, marginBottom: 0, color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>
            מחכה לכם! 🙌
          </p>
        </div>

        {/* Event + Registration card */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '36px 32px',
          marginBottom: 28,
          textAlign: 'center',
          boxShadow: '0 4px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle glow behind CTA */}
          <div style={{
            position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)',
            width: 300, height: 120,
            background: 'radial-gradient(ellipse, rgba(245,158,11,0.12), transparent 70%)',
            pointerEvents: 'none',
          }} />

          {loading ? (
            <div style={{ color: '#64748b', padding: '20px 0' }}>טוען...</div>
          ) : !event ? (
            <div style={{ color: '#64748b', fontSize: '0.95rem', padding: '16px 0' }}>
              האימון הבא טרם נקבע — בדוק שוב בקרוב
            </div>
          ) : (
            <>
              <div style={{
                display: 'inline-block',
                color: '#64748b', fontSize: '0.75rem',
                textTransform: 'uppercase', letterSpacing: '1.5px',
                marginBottom: 10,
              }}>האימון הקרוב</div>
              <div style={{
                fontSize: '1.55rem', fontWeight: 900,
                background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 12px rgba(245,158,11,0.35))',
                marginBottom: event.title ? 8 : 28,
              }}>
                {formatDate(event.eventDate)}
              </div>
              {event.title && (
                <div style={{ color: '#94a3b8', marginBottom: 28, fontSize: '0.95rem' }}>{event.title}</div>
              )}

              {msg && (
                <div style={{
                  background: msg.type === 'success' ? 'rgba(34,197,94,0.1)' : msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)',
                  border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.35)' : msg.type === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(100,116,139,0.3)'}`,
                  color: msg.type === 'success' ? '#86efac' : msg.type === 'error' ? '#fca5a5' : '#94a3b8',
                  borderRadius: 10, padding: '12px 18px', marginBottom: 22, fontSize: '0.95rem',
                  boxShadow: msg.type === 'success' ? '0 0 16px rgba(34,197,94,0.15)' : 'none',
                }}>{msg.text}</div>
              )}

              {event.isRegistered ? (
                <div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.1))',
                    border: '1px solid rgba(34,197,94,0.4)',
                    color: '#86efac',
                    borderRadius: 12, padding: '14px 28px',
                    fontWeight: 800, fontSize: '1.05rem', marginBottom: 18,
                    boxShadow: '0 0 24px rgba(34,197,94,0.15)',
                  }}>
                    ✅ רשום לאימון הקרוב
                  </div>
                  <br />
                  <button onClick={handleUnregister} disabled={submitting} style={{
                    background: 'transparent', color: '#475569',
                    border: '1px solid rgba(71,85,105,0.4)',
                    borderRadius: 8, padding: '8px 22px',
                    fontSize: '0.85rem', cursor: 'pointer',
                  }}>
                    ביטול הרשמה
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <div style={{
                    position: 'absolute', inset: -2, borderRadius: 14,
                    background: 'linear-gradient(135deg, #f59e0b, #f97316, #ef4444, #f59e0b)',
                    filter: 'blur(8px)', opacity: 0.7, zIndex: 0,
                  }} />
                  <button onClick={handleRegister} disabled={submitting} style={{
                    position: 'relative', zIndex: 1,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                    color: '#000', border: 'none', borderRadius: 12,
                    padding: '17px 52px', fontSize: '1.15rem', fontWeight: 900,
                    cursor: submitting ? 'wait' : 'pointer', letterSpacing: '0.2px',
                    boxShadow: '0 6px 30px rgba(245,158,11,0.5)',
                  }}>
                    {submitting ? '...' : 'הרשמה לאימון ←'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── ADMIN PANEL ── */}
        {isAdmin && (
          <>
            <div style={{
              background: 'linear-gradient(145deg, rgba(99,102,241,0.08), rgba(99,102,241,0.04))',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 18,
              padding: '26px',
              marginBottom: 20,
              boxShadow: '0 0 30px rgba(99,102,241,0.08)',
            }}>
              <div style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: 18, fontSize: '0.95rem' }}>
                🛠 הגדרת מועד אימון
              </div>
              <form onSubmit={handleSetEvent} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '0 0 auto' }}>
                  <label style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>תאריך</label>
                  <input
                    type="date"
                    lang="he"
                    style={{ ...inputStyle, width: '100%', cursor: 'pointer', minWidth: 190 }}
                    value={adminDate}
                    onChange={e => setAdminDate(e.target.value)}
                    onClick={e => e.target.showPicker?.()}
                    required
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>כותרת (אופציונלי)</label>
                  <input style={inputStyle} value={adminTitle} onChange={e => setAdminTitle(e.target.value)} placeholder="שיעור #3" />
                </div>
                <button type="submit" disabled={adminSaving} style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.15))',
                  color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: 10, padding: '12px 24px', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(99,102,241,0.2)',
                }}>
                  {adminSaving ? '...' : event ? 'עדכון' : 'קביעה'}
                </button>
              </form>
            </div>

            <div style={{
              background: 'linear-gradient(145deg, rgba(99,102,241,0.08), rgba(99,102,241,0.04))',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 18,
              padding: '26px',
              boxShadow: '0 0 30px rgba(99,102,241,0.08)',
            }}>
              <div style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: 18, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                👥 רשומים לאימון הבא
                <span style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(99,102,241,0.2))',
                  border: '1px solid rgba(99,102,241,0.4)',
                  color: '#c7d2fe', borderRadius: 8, padding: '2px 12px',
                  fontSize: '0.82rem', fontWeight: 800,
                }}>{registrations.length}</span>
              </div>
              {registrations.length === 0 ? (
                <div style={{ color: '#475569', fontSize: '0.9rem' }}>אין רשומים עדיין</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
                      {['יוזר', 'שם מלא', 'טלפון', 'תאריך הרשמה'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' }}>
                        <td style={{ padding: '10px 10px', fontWeight: 600 }}>{r.username}</td>
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
