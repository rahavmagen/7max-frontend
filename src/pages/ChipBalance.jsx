import { useState, useEffect } from 'react';
import { getChipBalance } from '../api';

export default function ChipBalance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getChipBalance()
      .then(res => setData(res.data))
      .catch(() => setError('שגיאה בטעינת Balance'))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '0';
    return Number(n).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>טוען...</div>;
  if (error) return <div className="alert alert-error" style={{ margin: '2rem' }}>{error}</div>;

  const mismatch = data ? Number(data.mismatch || 0) : 0;
  const hasMismatch = mismatch > 1;

  return (
    <div>
      <div className="page-header">
        <h1>Balance — מצב צ'יפים</h1>
        {data?.lastReportDate && (
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            נכון לדוח: {fmtDate(data.lastReportDate)}
          </span>
        )}
      </div>

      {!data?.lastReportDate && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          לא נמצא דוח XLS. יש להעלות קובץ ClubGG כדי לראות את מצב הצ'יפים.
        </div>
      )}

      {hasMismatch && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444',
          borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <strong style={{ color: '#ef4444' }}>אי-התאמה בצ'יפים!</strong>
            <div style={{ color: '#fca5a5', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              הפרש: <strong>{fmt(mismatch)}</strong> | צפוי: {fmt(data.expectedChips)} | בפועל: {fmt(data.actualChips)}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0, color: '#e2e8f0' }}>חישוב מצב צ'יפים</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ color: '#94a3b8', width: '50%' }}>צ'יפים בדוח האחרון</td>
              <td style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '1rem' }}>
                {fmt(data?.baseChips)}
              </td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                {data?.lastReportDate ? `מדוח ${fmtDate(data.lastReportDate)}` : '—'}
              </td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>+ הפקדות מאז</td>
              <td style={{ color: '#22c55e', fontWeight: 600 }}>+{fmt(data?.deposits)}</td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Deposits</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>+ קרדיטים שניתנו</td>
              <td style={{ color: '#22c55e', fontWeight: 600 }}>+{fmt(data?.credits)}</td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Manual Credits</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>− הוצאות גלגל (Wheel)</td>
              <td style={{ color: '#ef4444', fontWeight: 600 }}>−{fmt(data?.wheelExpenses)}</td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Wheel Expenses</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>+ ריק שנגבה</td>
              <td style={{ color: '#22c55e', fontWeight: 600 }}>+{fmt(data?.rake)}</td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Rake since last report</td>
            </tr>
            <tr style={{ borderTop: '2px solid #334155' }}>
              <td><strong style={{ color: '#e2e8f0' }}>= סה"כ צ'יפים צפויים</strong></td>
              <td>
                <strong style={{ color: '#f6c90e', fontSize: '1.15rem' }}>{fmt(data?.expectedChips)}</strong>
              </td>
              <td></td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>צ'יפים בפועל (מסד נתונים)</td>
              <td style={{ paddingTop: '1rem' }}>
                <strong style={{
                  color: hasMismatch ? '#ef4444' : '#22c55e',
                  fontSize: '1.15rem',
                }}>{fmt(data?.actualChips)}</strong>
              </td>
              <td style={{ paddingTop: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
                {hasMismatch
                  ? <span style={{ color: '#ef4444' }}>⚠ הפרש: {fmt(mismatch)}</span>
                  : <span style={{ color: '#22c55e' }}>✓ תואם</span>
                }
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
