import { useState } from 'react';
import { submitJoinRequest } from '../api';

export default function JoinRequest() {
  const [form, setForm] = useState({ username: '', fullName: '', phone: '', clubPlayerId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await submitJoinRequest(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send request. Please try again.');
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
        maxWidth: '400px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/7maxlogo.png" alt="7MAX" style={{ height: '64px', marginBottom: '0.75rem' }} />
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Request to join the club</p>
        </div>

        {submitted ? (
          <div style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '10px',
            padding: '1.5rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✅</div>
            <div style={{ color: '#86efac', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' }}>
              Request sent!
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              You will receive access once an admin approves your request.
            </div>
          </div>
        ) : (
          <>
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
                <label style={labelStyle}>ClubGG Username *</label>
                <input required value={form.username} onChange={e => set('username', e.target.value)}
                  style={inputStyle} placeholder="e.g. liorar" />
              </div>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input required value={form.fullName} onChange={e => set('fullName', e.target.value)}
                  style={inputStyle} placeholder="e.g. לירון כהן" />
              </div>
              <div>
                <label style={labelStyle}>Phone *</label>
                <input required value={form.phone} onChange={e => set('phone', e.target.value)}
                  style={inputStyle} placeholder="050-0000000" />
              </div>
              <div>
                <label style={labelStyle}>ClubGG Player ID (optional)</label>
                <input value={form.clubPlayerId} onChange={e => set('clubPlayerId', e.target.value)}
                  style={inputStyle} placeholder="e.g. 2163-3811" />
              </div>
              <button type="submit" disabled={loading} style={{
                background: loading ? '#334155' : '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '0.25rem',
              }}>
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </form>
            <div style={{
              marginTop: '1.25rem',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '10px',
              padding: '0.9rem 1rem',
              fontSize: '0.83rem',
              color: '#a5b4fc',
              lineHeight: 1.6,
            }}>
              To be approved, you must first join the club on ClubGG.<br />
              👉 <a href="https://clubgg.app.link/QyU3JGEfS2b" target="_blank" rel="noopener noreferrer"
                style={{ color: '#818cf8' }}>Join the club app</a><br />
              Club ID: <strong>770299</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle = { color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' };
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
