import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('שם משתמש או סיסמא שגויים');
      } else if (err.response) {
        setError(`שגיאת שרת: ${err.response.status}`);
      } else if (err.request) {
        setError('השרת לא מגיב — בדוק את חיבור הרשת');
      } else {
        setError(`שגיאה: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f1117',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', width: '100%', maxWidth: 860 }}>
      <div style={{
        background: '#1a1d2e',
        border: '1px solid #2d3148',
        borderRadius: '16px',
        padding: '2.5rem',
        flex: '1 1 340px',
        minWidth: 300,
        maxWidth: 400,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/7maxlogo.png" alt="7MAX" style={{ height: '64px', marginBottom: '0.75rem' }} />
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>כניסה למערכת</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: '#ef4444',
            fontSize: '0.875rem',
            marginBottom: '1.25rem',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>
              שם משתמש
            </label>
            <input
              type="text"
              required
              autoFocus
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              style={inputStyle}
              placeholder="username"
            />
          </div>
          <div>
            <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>
              סיסמא
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ ...inputStyle, paddingRight: '2.5rem' }}
                placeholder="••••••"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} style={eyeBtn}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#334155' : '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid #2d3148', paddingTop: '1.25rem' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>עדיין לא חבר? </span>
          <a href="/join" style={{ color: '#6366f1', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
            הצטרף למועדון ←
          </a>
        </div>

      </div>

      {/* WhatsApp / Phone card */}
      <div style={{
        background: '#1a1d2e',
        border: '1px solid #2d3148',
        borderRadius: '16px',
        overflow: 'hidden',
        flex: '1 1 340px',
        minWidth: 300,
        maxWidth: 400,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          borderBottom: '1px solid #2d3148',
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>💬</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>צור קשר עם המועדון</div>
            <div style={{ color: '#6ee7b7', fontSize: '0.8rem', marginTop: 2 }}>שירות לקוחות ותמיכה</div>
          </div>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
          <div style={{ textAlign: 'center', direction: 'rtl' }}>
            <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>טלפון מועדון</div>
            <div style={{ color: '#e2e8f0', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.05em' }}>050-963-5828</div>
          </div>
          <a
            href="https://wa.me/972509635828"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px 24px', background: '#25d366', color: '#fff',
              borderRadius: 8, fontWeight: 700, fontSize: '1rem', textDecoration: 'none',
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px 24px', background: '#0f1117', color: '#e2e8f0',
              border: '1px solid #2d3148', borderRadius: 8, fontWeight: 600,
              fontSize: '1rem', textDecoration: 'none', direction: 'rtl',
            }}
          >
            📞 התקשר עכשיו
          </a>
        </div>
      </div>

      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#0f1117',
  border: '1px solid #2d3148',
  borderRadius: '8px',
  padding: '0.65rem 0.9rem',
  color: '#e2e8f0',
  fontSize: '1rem',
  boxSizing: 'border-box',
};

const eyeBtn = {
  position: 'absolute',
  right: '0.6rem',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
  padding: '0',
  lineHeight: 1,
};
