import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { changePassword } from '../api';
import mammoth from 'mammoth';

export default function ChangePassword() {
  const { auth, clearMustChange, logout } = useAuth();
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState({ old: false, new: false, confirm: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [takanonOpen, setTakanonOpen] = useState(false);
  const [takanonApproved, setTakanonApproved] = useState(false);
  const [takanonHtml, setTakanonHtml] = useState('');
  const [takanonRead, setTakanonRead] = useState(false);
  const scrollRef = useRef(null);

  const handleTakanonScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setTakanonRead(true);
    }
  };

  useEffect(() => {
    fetch('/takanon.docx')
      .then(r => r.arrayBuffer())
      .then(buf => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then(result => setTakanonHtml(result.value))
      .catch(() => setTakanonHtml('<p style="color:#ef4444">שגיאה בטעינת התקנון</p>'));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!takanonApproved) { setError('עליך לאשר את תקנון המועדון'); return; }
    if (form.newPassword !== form.confirm) { setError('הסיסמאות אינן תואמות'); return; }
    if (form.newPassword.length < 4) { setError('הסיסמא חייבת להכיל לפחות 4 תווים'); return; }
    setLoading(true);
    try {
      await changePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword });
      clearMustChange();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשינוי הסיסמא');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
      <div style={{ background: '#1a1d2e', border: '1px solid #f59e0b', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
          <h2 style={{ color: '#e2e8f0', margin: 0 }}>שינוי סיסמא נדרש</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            ברוך הבא, <strong style={{ color: '#94a3b8' }}>{auth?.username}</strong>.<br />
            עליך לשנות את הסיסמא לפני שתוכל להמשיך.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>סיסמא נוכחית</label>
            <div style={{ position: 'relative' }}>
              <input type={show.old ? 'text' : 'password'} required autoFocus value={form.oldPassword}
                onChange={e => setForm(f => ({ ...f, oldPassword: e.target.value }))}
                style={{ ...inputStyle, paddingRight: '2.5rem' }} placeholder="הסיסמא הנוכחית" />
              <button type="button" onClick={() => setShow(s => ({ ...s, old: !s.old }))} style={eyeBtn}>
                {show.old ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>סיסמא חדשה</label>
            <div style={{ position: 'relative' }}>
              <input type={show.new ? 'text' : 'password'} required value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                style={{ ...inputStyle, paddingRight: '2.5rem' }} placeholder="לפחות 4 תווים" />
              <button type="button" onClick={() => setShow(s => ({ ...s, new: !s.new }))} style={eyeBtn}>
                {show.new ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>אימות סיסמא חדשה</label>
            <div style={{ position: 'relative' }}>
              <input type={show.confirm ? 'text' : 'password'} required value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                style={{ ...inputStyle, paddingRight: '2.5rem' }} placeholder="חזור על הסיסמא החדשה" />
              <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))} style={eyeBtn}>
                {show.confirm ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: '8px', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: takanonOpen ? '0.75rem' : 0 }}>
              <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>תקנון המועדון</span>
              <button type="button" onClick={() => setTakanonOpen(o => !o)}
                style={{ background: 'none', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', padding: '0.2rem 0.5rem' }}>
                {takanonOpen ? 'סגור ▲' : 'קרא ▼'}
              </button>
            </div>
            {takanonOpen && (
              <div ref={scrollRef} onScroll={handleTakanonScroll}
                style={{ height: '300px', overflowY: 'scroll', background: '#fff', borderRadius: '6px', padding: '1rem', color: '#1a1a1a', fontSize: '0.85rem', direction: 'rtl', textAlign: 'right', lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: takanonHtml }}
              />
              {!takanonRead && (
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                  ↓ גלול עד לסוף התקנון כדי לאשר
                </div>
              )}
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.75rem', cursor: takanonRead ? 'pointer' : 'not-allowed', opacity: takanonRead ? 1 : 0.4 }}>
              <input type="checkbox" checked={takanonApproved} disabled={!takanonRead} onChange={e => setTakanonApproved(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: takanonRead ? 'pointer' : 'not-allowed', accentColor: '#f59e0b' }} />
              <span style={{ color: takanonApproved ? '#e2e8f0' : '#94a3b8', fontSize: '0.875rem' }}>
                קראתי ואני מאשר את תקנון המועדון
              </span>
            </label>
          </div>

          <button type="submit" disabled={loading || !takanonApproved}
            style={{ background: (loading || !takanonApproved) ? '#334155' : '#f59e0b', color: (loading || !takanonApproved) ? '#64748b' : '#000', border: 'none', borderRadius: '8px', padding: '0.75rem', fontSize: '1rem', fontWeight: 700, cursor: (loading || !takanonApproved) ? 'not-allowed' : 'pointer', marginTop: '0.5rem' }}>
            {loading ? 'שומר...' : 'שמור סיסמא חדשה'}
          </button>
        </form>

        <button onClick={logout} style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', display: 'block', margin: '1rem auto 0', textDecoration: 'underline' }}>
          יציאה
        </button>
      </div>
    </div>
  );
}

const labelStyle = { color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' };
const inputStyle = { width: '100%', background: '#0f1117', border: '1px solid #2d3148', borderRadius: '8px', padding: '0.65rem 0.9rem', color: '#e2e8f0', fontSize: '1rem', boxSizing: 'border-box' };
const eyeBtn = { position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0', lineHeight: 1 };
