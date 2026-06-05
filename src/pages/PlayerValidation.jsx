import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayerValidation } from '../api';
import DateInput from '../components/DateInput';

export default function PlayerValidation() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sinceDate, setSinceDate] = useState('');
  const navigate = useNavigate();

  const load = (since) => {
    setLoading(true);
    setError('');
    getPlayerValidation(since || undefined)
      .then(res => setRows(res.data))
      .catch(() => setError('שגיאה בטעינת נתוני ולידציה'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '0';
    const num = Number(n);
    const abs = Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (num < 0 ? '−' : '') + abs;
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>טוען...</div>;
  if (error) return <div className="alert alert-error" style={{ margin: '2rem' }}>{error}</div>;

  const withDiff = rows?.filter(r => Math.abs(Number(r.diff)) > 0) || [];

  return (
    <div>
      <div className="page-header">
        <h1>Validation — ולידציה לפי שחקן</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ color: '#64748b', fontSize: '0.85rem' }}>מאז תאריך:</label>
          <DateInput value={sinceDate} onChange={setSinceDate} />
          <button className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}
            onClick={() => load(sinceDate)}>
            עדכן
          </button>
        </div>
      </div>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        השוואה בין מצב הצ'יפים הנוכחי לבין מה שצפוי לפי הפעילות מאז הדוח האחרון.
        שחקנים עם הפרש 0 (ללא פעילות) מוסתרים.
      </p>

      <div className="card">
        {rows?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            אין שחקנים עם פעילות מאז הדוח האחרון
          </div>
        ) : (
          <>
            <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0' }}>{rows?.length}</strong> שחקנים עם פעילות
              {withDiff.length > 0 && (
                <span style={{ marginLeft: '0.75rem', color: '#ef4444' }}>
                  | <strong>{withDiff.length}</strong> עם הפרש
                </span>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>שחקן</th>
                    <th>צ'יפים נוכחיים</th>
                    <th>הפקדות</th>
                    <th>קרדיטים</th>
                    <th>גלגל</th>
                    <th>ריק ששולם</th>
                    <th>צפוי בדוח הבא</th>
                    <th>הפרש</th>
                  </tr>
                </thead>
                <tbody>
                  {rows?.map((r, i) => {
                    const diff = Number(r.diff);
                    const hasDiff = Math.abs(diff) > 0;
                    return (
                      <tr key={r.playerId} style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/player/${r.playerId}`)}>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{i + 1}</td>
                        <td>
                          <strong>{r.username}</strong>
                          {r.fullName && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.4rem' }}>{r.fullName}</span>}
                        </td>
                        <td style={{ color: '#e2e8f0' }}>{fmt(r.currentChips)}</td>
                        <td style={{ color: Number(r.deposits) > 0 ? '#22c55e' : '#64748b' }}>
                          {Number(r.deposits) > 0 ? `+${fmt(r.deposits)}` : '—'}
                        </td>
                        <td style={{ color: Number(r.credits) > 0 ? '#60a5fa' : '#64748b' }}>
                          {Number(r.credits) > 0 ? `+${fmt(r.credits)}` : '—'}
                        </td>
                        <td style={{ color: Number(r.wheelReceived) > 0 ? '#fb923c' : '#64748b' }}>
                          {Number(r.wheelReceived) > 0 ? `+${fmt(r.wheelReceived)}` : '—'}
                        </td>
                        <td style={{ color: Number(r.rakePaid) > 0 ? '#ef4444' : '#64748b' }}>
                          {Number(r.rakePaid) > 0 ? `−${fmt(r.rakePaid)}` : '—'}
                        </td>
                        <td>
                          <span style={{
                            background: '#2d3148', padding: '2px 10px',
                            borderRadius: '20px', fontWeight: 700,
                            color: '#f6c90e', fontSize: '0.95rem',
                          }}>
                            {fmt(r.expectedNextXls)}
                          </span>
                        </td>
                        <td>
                          {hasDiff ? (
                            <span style={{
                              background: diff > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                              color: diff > 0 ? '#22c55e' : '#ef4444',
                              padding: '2px 8px', borderRadius: '6px',
                              fontWeight: 700, fontSize: '0.9rem',
                            }}>
                              {diff > 0 ? '+' : ''}{fmt(diff)}
                            </span>
                          ) : (
                            <span style={{ color: '#22c55e', fontSize: '0.85rem' }}>✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
