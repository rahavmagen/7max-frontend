import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getInactivePlayersBalance } from '../api';

const inputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '6px 10px',
  fontSize: '0.9rem',
  width: 90,
};

export default function InactivePlayersBalance() {
  const [days, setDays] = useState('30');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInactivePlayersBalance(parseInt(days) || 30);
      setResults(res.data);
    } catch {
      setError('Failed to load report');
    }
    setLoading(false);
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('he-IL') : 'Never';
  const fmtMoney = (n) => {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    return (num < 0 ? '-' : '') + '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const moneyColor = (n) => Number(n) > 0 ? '#4ade80' : Number(n) < 0 ? '#fca5a5' : 'var(--text-muted)';

  const totalPositive = (results || []).reduce((s, r) => s + (Number(r.balance) > 0 ? Number(r.balance) : 0), 0);
  const totalNegative = (results || []).reduce((s, r) => s + (Number(r.balance) < 0 ? Number(r.balance) : 0), 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Inactive Players Balance</h2>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
              Inactive for (days)
            </label>
            <input type="number" min="1" value={days} onChange={e => setDays(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={handleRun} disabled={loading}
            style={{ background: loading ? '#334155' : 'var(--accent)', color: loading ? '#64748b' : '#0f172a', border: 'none', borderRadius: 6, padding: '8px 22px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
            {loading ? 'Loading...' : 'Run Report'}
          </button>
        </div>
        <div style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Players with no games in the last <strong style={{ color: 'var(--text-secondary)' }}>{days || '?'} days</strong> whose balance is more than <strong style={{ color: 'var(--text-secondary)' }}>₪5</strong> away from zero, either direction.
        </div>
      </div>

      {error && (
        <div style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #dc2626', borderRadius: 8, padding: '0.75rem 1.25rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {results !== null && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Results</span>
            {results.length > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600 }}>
                {results.length} players
              </span>
            )}
          </div>
          {results.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No inactive players with an outstanding balance found</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                    {['Username', 'Full Name', 'Balance', 'Last played'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={row.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <Link to={`/player/${row.id}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{row.username}</Link>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Link to={`/player/${row.id}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{row.fullName || '—'}</Link>
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: moneyColor(row.balance) }}>{fmtMoney(row.balance)}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fmt(row.lastPlayed)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                    <td colSpan={2} style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Totals</td>
                    <td style={{ padding: '10px 16px' }} colSpan={2}>
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>{fmtMoney(totalPositive)}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>/</span>
                      <span style={{ color: '#fca5a5', fontWeight: 700 }}>{fmtMoney(totalNegative)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
