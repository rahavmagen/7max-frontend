import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getLessonEvent, setLessonEvent, getLessonRegistrations,
  registerLesson, unregisterLesson, getMyPlayerInfo
} from '../api';

const cardStyle = {
  background: '#1a1d2e',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #2d3148',
};

const btnPrimary = {
  background: 'linear-gradient(135deg, #6c63ff, #4f46e5)',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '12px 28px',
  fontSize: '1rem',
  fontWeight: '700',
  cursor: 'pointer',
  letterSpacing: '0.5px',
};

const btnDanger = {
  background: 'transparent',
  color: '#f87171',
  border: '1px solid #f87171',
  borderRadius: '8px',
  padding: '10px 24px',
  fontSize: '0.95rem',
  cursor: 'pointer',
};

const inputStyle = {
  width: '100%',
  background: '#0f1117',
  border: '1px solid #2d3148',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#e2e8f0',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Lesson() {
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'MANAGER';

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);

  // Registration form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  // Admin panel state
  const [adminDate, setAdminDate] = useState('');
  const [adminTitle, setAdminTitle] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);

  useEffect(() => {
    loadEvent();
  }, []);

  useEffect(() => {
    if (isAdmin && event?.id) loadRegistrations();
  }, [isAdmin, event]);

  async function loadEvent() {
    setLoading(true);
    try {
      const res = await getLessonEvent();
      setEvent(Object.keys(res.data).length ? res.data : null);
    } finally {
      setLoading(false);
    }
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
      setMsg({ type: 'success', text: '!נרשמת בהצלחה' });
      setShowForm(false);
      loadEvent();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'שגיאה בהרשמה' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnregister() {
    if (!window.confirm('האם לבטל את ההרשמה?')) return;
    setSubmitting(true);
    try {
      await unregisterLesson();
      setMsg({ type: 'success', text: 'ההרשמה בוטלה' });
      loadEvent();
      if (isAdmin) loadRegistrations();
    } finally {
      setSubmitting(false);
    }
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
    } finally {
      setAdminSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 60px', direction: 'rtl' }}>

      {/* Hero */}
      <div style={{
        ...cardStyle,
        marginBottom: 28,
        background: 'linear-gradient(135deg, #1a1d2e 0%, #0f1117 100%)',
        borderColor: '#6c63ff44',
        display: 'flex',
        gap: 32,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <img
          src="/uri-profile.jpg"
          alt="Uri Alberg"
          style={{ width: 130, height: 130, borderRadius: '50%', objectFit: 'cover', border: '3px solid #6c63ff', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
            מרסקים את הקאש!
          </div>
          <div style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.6 }}>
            אימון קאש עם <strong style={{ color: '#a5b4fc' }}>אורי אלברג</strong> — כל מוצ"ש בשעות 20:30–22:00 בזום
          </div>
          <div style={{ marginTop: 8, color: '#64748b', fontSize: '0.9rem' }}>
            בלעדי לקהילת Max7
          </div>
        </div>
      </div>

      {/* About */}
      <div style={{ ...cardStyle, marginBottom: 28 }}>
        <div style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.9 }}>
          <p style={{ marginTop: 0 }}>
            מתאים לשחקנים שרוצים לשדרג את אסטרטגיית הקאש שלהם ולמקסם רווחים לייב ואונליין.
          </p>
          <div style={{ fontWeight: 700, color: '#c7d2fe', marginBottom: 10 }}>במהלך האימונים נעשה:</div>
          <ul style={{ margin: 0, paddingRight: 20 }}>
            <li>ניתוח ספוטים מעניינים שלכם ושלי (לייב ואונליין) מהתקופה האחרונה</li>
            <li>הכרת קונספטים תיאורטיים חדשים, טקטיקות חזקות והתאמות נצלניות</li>
            <li>סשנים משותפים — חיזוק תהליכי חשיבה וקבלת החלטות בזמן אמת</li>
            <li>בניית סט הרגלים חזק לפני, במהלך ואחרי סשן</li>
            <li>שיתוף בהתלבטויות מקצועיות ומנטליות — נתפתח ביחד כשחקנים וכאנשים</li>
          </ul>
        </div>
      </div>

      {/* Event + Registration */}
      <div style={{ ...cardStyle, marginBottom: 28, textAlign: 'center' }}>
        {loading ? (
          <div style={{ color: '#64748b' }}>טוען...</div>
        ) : !event ? (
          <div style={{ color: '#64748b', fontSize: '0.95rem' }}>
            האימון הבא טרם נקבע — בדוק שוב בקרוב
          </div>
        ) : (
          <>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 4 }}>האימון הקרוב</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a5b4fc', marginBottom: event.title ? 4 : 20 }}>
              {formatDate(event.eventDate)}
            </div>
            {event.title && (
              <div style={{ color: '#94a3b8', marginBottom: 20 }}>{event.title}</div>
            )}

            {msg && (
              <div style={{
                background: msg.type === 'success' ? '#14532d' : '#7f1d1d',
                color: msg.type === 'success' ? '#86efac' : '#fca5a5',
                borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: '0.95rem'
              }}>{msg.text}</div>
            )}

            {event.isRegistered ? (
              <div>
                <div style={{
                  background: '#14532d', color: '#86efac', borderRadius: 8,
                  padding: '10px 20px', display: 'inline-block', marginBottom: 14, fontWeight: 600
                }}>
                  ✓ רשום לאימון
                </div>
                <br />
                <button style={btnDanger} onClick={handleUnregister} disabled={submitting}>
                  ביטול הרשמה
                </button>
              </div>
            ) : showForm ? (
              <form onSubmit={handleRegister} style={{ maxWidth: 360, margin: '0 auto', textAlign: 'right' }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>שם מלא</label>
                  <input
                    style={inputStyle}
                    value={form.fullName}
                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    required
                    placeholder="שם מלא"
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>טלפון</label>
                  <input
                    style={inputStyle}
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="מספר טלפון"
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" style={{ ...btnDanger, padding: '10px 18px' }} onClick={() => setShowForm(false)}>ביטול</button>
                  <button type="submit" style={btnPrimary} disabled={submitting}>
                    {submitting ? '...' : 'אישור הרשמה'}
                  </button>
                </div>
              </form>
            ) : (
              <button style={{ ...btnPrimary, fontSize: '1.05rem', padding: '14px 36px' }} onClick={openForm}>
                הרשמה לאימון
              </button>
            )}
          </>
        )}
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <>
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#c7d2fe', marginBottom: 16 }}>הגדרת מועד אימון</div>
            <form onSubmit={handleSetEvent} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>תאריך</label>
                <input
                  type="date"
                  style={{ ...inputStyle, width: 'auto' }}
                  value={adminDate}
                  onChange={e => setAdminDate(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>כותרת (אופציונלי)</label>
                <input
                  style={inputStyle}
                  value={adminTitle}
                  onChange={e => setAdminTitle(e.target.value)}
                  placeholder="למשל: שיעור #3"
                />
              </div>
              <button type="submit" style={{ ...btnPrimary, padding: '10px 22px', fontSize: '0.9rem' }} disabled={adminSaving}>
                {adminSaving ? '...' : event ? 'עדכון תאריך' : 'קביעת תאריך'}
              </button>
            </form>
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 700, color: '#c7d2fe', marginBottom: 16 }}>
              רשומים לאימון הבא
              <span style={{ marginRight: 8, background: '#2d3148', borderRadius: 6, padding: '2px 10px', fontSize: '0.85rem', color: '#94a3b8' }}>
                {registrations.length}
              </span>
            </div>
            {registrations.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>אין רשומים עדיין</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #2d3148' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>יוזר</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>שם מלא</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>טלפון</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>נרשם</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #1e2235', color: '#e2e8f0' }}>
                      <td style={{ padding: '9px 10px' }}>{r.username}</td>
                      <td style={{ padding: '9px 10px' }}>{r.fullName}</td>
                      <td style={{ padding: '9px 10px' }}>{r.phone}</td>
                      <td style={{ padding: '9px 10px', color: '#64748b', fontSize: '0.82rem' }}>
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
  );
}
