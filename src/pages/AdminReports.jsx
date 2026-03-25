import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHandsReport, getFridayRakeReport } from '../api';

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

  const [fridayRows, setFridayRows] = useState(null);
  const [fridayLoading, setFridayLoading] = useState(true);
  const [fridayError, setFridayError] = useState('');

  useEffect(() => {
    getFridayRakeReport()
      .then(res => setFridayRows(res.data))
      .catch(() => setFridayError('שגיאה בטעינת דוח ריק שישי'))
      .finally(() => setFridayLoading(false));
  }, []);

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
              <input type="date" lang="he" value={dateFrom} onChange={e => setDateFrom(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>עד תאריך</label>
              <input type="date" lang="he" value={dateTo} onChange={e => setDateTo(e.target.value)} required />
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

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ marginTop: 0, color: '#e2e8f0' }}>ריק שישי — משחקים מ-18:00</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          כל הגיימים שהתחילו ביום שישי החל מ-18:00 ואילך
        </p>

        {fridayLoading && <div style={{ color: '#64748b' }}>טוען...</div>}
        {fridayError && (
          <div style={{ color: '#ef4444', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
            {fridayError}
          </div>
        )}
        {fridayRows !== null && !fridayLoading && (
          fridayRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>לא נמצאו משחקי שישי</div>
          ) : (
            <>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                <strong style={{ color: '#e2e8f0' }}>{fridayRows.length}</strong> גיימים
                &nbsp;|&nbsp; סה"כ ריק:&nbsp;
                <strong style={{ color: '#a5b4fc' }}>
                  {fridayRows.reduce((s, r) => s + Number(r.totalRake || 0), 0).toLocaleString()}
                </strong>
              </div>
              <div className="table-wrap"><table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>תאריך</th>
                    <th>שעת התחלה</th>
                    <th>שולחן</th>
                    <th>סוג</th>
                    <th>שחקנים</th>
                    <th>ריק</th>
                  </tr>
                </thead>
                <tbody>
                  {fridayRows.map((r, i) => {
                    const dt = r.startTime ? new Date(r.startTime) : null;
                    const dateStr = dt ? dt.toLocaleDateString('he-IL') : '—';
                    const timeStr = dt ? dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—';
                    return (
                      <tr key={r.sessionId}>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{i + 1}</td>
                        <td>{dateStr}</td>
                        <td style={{ color: '#94a3b8' }}>{timeStr}</td>
                        <td><strong>{r.tableName || '—'}</strong></td>
                        <td style={{ color: '#94a3b8' }}>{r.gameType || '—'}</td>
                        <td style={{ color: '#64748b' }}>{r.playerCount}</td>
                        <td>
                          <span style={{
                            background: Number(r.totalRake) > 0 ? '#2d3148' : 'rgba(100,116,139,0.15)',
                            padding: '2px 10px',
                            borderRadius: '20px',
                            fontWeight: 700,
                            color: Number(r.totalRake) > 0 ? '#a5b4fc' : '#64748b',
                            fontSize: '0.95rem',
                          }}>
                            {Number(r.totalRake).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </>
          )
        )}
      </div>
    </div>
  );
}
