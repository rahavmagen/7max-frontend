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
    }}>
      <div style={{
        background: '#1a1d2e',
        border: '1px solid #2d3148',
        borderRadius: '16px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '380px',
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
