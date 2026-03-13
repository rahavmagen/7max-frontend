import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHandsReport } from '../api';

export default function AdminReports() {
  const navigate = useNavigate();
  const fmt = (iso) => iso.split('-').reverse().join('-');
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [minHands, setMinHands] = useState(0);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await getHandsReport({ dateFrom, dateTo, minHands });
      setRows(res.data);
    } catch {
      setError('שגיאה בטעינת הדוח');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>דוחות</h1>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, color: '#e2e8f0' }}>דוח ידיים — Cash Games</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          מציג שחקנים שיחקו לפחות X ידיים בטווח תאריכים נבחר (Ring Games בלבד)
        </p>

        <form onSubmit={run}>
          <div className="form-row" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group">
              <label>מתאריך</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>עד תאריך</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>מינימום ידיים</label>
              <input
                type="number" min="0" value={minHands}
                onChange={e => setMinHands(Number(e.target.value))}
                style={{ width: '120px' }}
                placeholder="0"
              />
            </div>
            <div className="form-group" style={{ paddingTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'טוען...' : 'הפעל דוח'}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div style={{ color: '#ef4444', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', marginTop: '1rem' }}>
            {error}
          </div>
        )}

        {rows !== null && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                {fmt(dateFrom)} — {fmt(dateTo)} &nbsp;|&nbsp; מינימום {minHands} ידיים &nbsp;|&nbsp;
                <strong style={{ color: '#e2e8f0' }}>{rows.length} שחקנים</strong>
              </span>
            </div>
            {rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>לא נמצאו תוצאות</div>
            ) : (
              <div className="table-wrap"><table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>שם משתמש</th>
                    <th>שם מלא</th>
                    <th>סשנים</th>
                    <th>סה"כ ידיים</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.playerId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/player/${r.playerId}`)}>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{i + 1}</td>
                      <td><strong>{r.username}</strong></td>
                      <td style={{ color: '#94a3b8' }}>{r.fullName || '—'}</td>
                      <td style={{ color: '#64748b' }}>{r.sessionCount}</td>
                      <td>
                        <span style={{
                          background: '#2d3148',
                          padding: '2px 10px',
                          borderRadius: '20px',
                          fontWeight: 700,
                          color: '#a5b4fc',
                          fontSize: '0.95rem',
                        }}>
                          {r.totalHands?.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
