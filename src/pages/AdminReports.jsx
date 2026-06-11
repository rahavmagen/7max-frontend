import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHandsReport, getFridayRakeReport, getRakebackReport, getShabatRakeLatest, getShabatRakeHistory, postShabatRake } from '../api';
import DateInput from '../components/DateInput';
import { fmtDateOnly } from '../utils/dates';

export default function AdminReports() {
  const navigate = useNavigate();
  const fmt = fmtDateOnly;
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

  const [rbDateFrom, setRbDateFrom] = useState(monthAgo);
  const [rbDateTo, setRbDateTo] = useState(today);
  const [rbRows, setRbRows] = useState(null);
  const [rbLoading, setRbLoading] = useState(false);
  const [rbError, setRbError] = useState('');

  const [shabatLatest, setShabatLatest] = useState(null);
  const [shabatHistory, setShabatHistory] = useState([]);
  const [shabatForm, setShabatForm] = useState({ amount: '', date: '', reason: '' });
  const [shabatSaving, setShabatSaving] = useState(false);

  const loadShabatRake = () => {
    getShabatRakeLatest().then(r => setShabatLatest(r.data)).catch(() => {});
    getShabatRakeHistory().then(r => setShabatHistory(r.data)).catch(() => {});
  };

  useEffect(() => {
    getFridayRakeReport()
      .then(res => setFridayRows(res.data))
      .catch(() => setFridayError('שגיאה בטעינת דוח ריק שישי'))
      .finally(() => setFridayLoading(false));
    loadShabatRake();
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

  const runRakeback = async (e) => {
    e.preventDefault();
    setRbError('');
    setRbLoading(true);
    try {
      const res = await getRakebackReport({ dateFrom: rbDateFrom, dateTo: rbDateTo });
      setRbRows(res.data);
    } catch {
      setRbError('שגיאה בטעינת דוח ריקבק');
    } finally {
      setRbLoading(false);
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
              <DateInput value={dateFrom} onChange={setDateFrom} />
            </div>
            <div className="form-group">
              <label>עד תאריך</label>
              <DateInput value={dateTo} onChange={setDateTo} />
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
        <h2 style={{ marginTop: 0, color: '#e2e8f0' }}>דוח ריקבק</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          סיכום ריקבק לשחקנים עם אחוז ריקבק מוגדר. תאריך התחלה אפקטיבי = MAX(מתאריך, rakebackSince)
        </p>
        <form onSubmit={runRakeback}>
          <div className="form-row" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group">
              <label>מתאריך</label>
              <DateInput value={rbDateFrom} onChange={setRbDateFrom} />
            </div>
            <div className="form-group">
              <label>עד תאריך</label>
              <DateInput value={rbDateTo} onChange={setRbDateTo} />
            </div>
            <div className="form-group" style={{ paddingTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={rbLoading}>
                {rbLoading ? 'טוען...' : 'הפעל דוח'}
              </button>
            </div>
          </div>
        </form>
        {rbError && (
          <div style={{ color: '#ef4444', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', marginTop: '1rem' }}>
            {rbError}
          </div>
        )}
        {rbRows !== null && (
          <div style={{ marginTop: '1.5rem' }}>
            {rbRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>אין שחקנים עם ריקבק מוגדר בטווח זה</div>
            ) : (
              <>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  {fmt(rbDateFrom)} — {fmt(rbDateTo)} &nbsp;|&nbsp;
                  <strong style={{ color: '#e2e8f0' }}>{rbRows.length} שחקנים</strong>
                  &nbsp;|&nbsp; סה"כ ריקבק:&nbsp;
                  <strong style={{ color: '#34d399' }}>
                    ₪{rbRows.reduce((s, r) => s + Number(r.rakebackAmount || 0), 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="table-wrap"><table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>שם משתמש</th>
                      <th>שם מלא</th>
                      <th>%</th>
                      <th>תאריך התחלה</th>
                      <th>תאריך אפקטיבי</th>
                      <th>ריק ששולם</th>
                      <th>ריקבק לתשלום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rbRows.map((r, i) => (
                      <tr key={r.playerId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/player/${r.playerId}`)}>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{i + 1}</td>
                        <td><strong>{r.username}</strong></td>
                        <td style={{ color: '#94a3b8' }}>{r.fullName || '—'}</td>
                        <td style={{ color: '#a5b4fc' }}>{Math.round(r.rakebackPercentage * 100)}%</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{r.rakebackSince || '—'}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{r.effectiveFrom}</td>
                        <td style={{ color: '#f59e0b' }}>₪{Number(r.totalRakePaid).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          <span style={{ background: '#0d2b1d', border: '1px solid #16a34a', padding: '2px 12px', borderRadius: '20px', fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>
                            ₪{Number(r.rakebackAmount).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: '#e2e8f0' }}>ריק שבת — עדכון ידני</h2>
          {shabatLatest && (
            <span style={{ background: '#1e1a3f', border: '1px solid #4338ca', borderRadius: '8px', padding: '4px 14px', color: '#a5b4fc', fontWeight: 700, fontSize: '1rem' }}>
              ערך נוכחי: ₪{Number(shabatLatest.amount).toLocaleString()}
            </span>
          )}
        </div>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          הגדרת ערך ריק השבת שמוצג לשחקנים באתר. כל עדכון נשמר בהיסטוריה.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label>סכום (₪)</label>
            <input type="number" placeholder="0" value={shabatForm.amount}
              onChange={e => setShabatForm(f => ({ ...f, amount: e.target.value }))}
              style={{ width: '110px' }} />
          </div>
          <div className="form-group">
            <label>תאריך</label>
            <DateInput value={shabatForm.date} onChange={v => setShabatForm(f => ({ ...f, date: v }))} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label>סיבה / הערה</label>
            <input type="text" placeholder="לדוגמה: שישי 6.6.25" value={shabatForm.reason}
              onChange={e => setShabatForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="form-group" style={{ paddingTop: '1.5rem' }}>
            <button className="btn btn-primary"
              disabled={!shabatForm.amount || !shabatForm.date || shabatSaving}
              onClick={async () => {
                setShabatSaving(true);
                try {
                  await postShabatRake(shabatForm);
                  setShabatForm({ amount: '', date: '', reason: '' });
                  loadShabatRake();
                } finally {
                  setShabatSaving(false);
                }
              }}>
              {shabatSaving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>

        {shabatHistory.length > 0 && (
          <>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>היסטוריית עדכונים</p>
            <div className="table-wrap"><table>
              <thead>
                <tr>
                  <th>סכום</th>
                  <th>תאריך</th>
                  <th>סיבה</th>
                  <th>עודכן ע"י</th>
                  <th>עודכן ב</th>
                </tr>
              </thead>
              <tbody>
                {shabatHistory.map((h, i) => (
                  <tr key={h.id} style={{ background: i === 0 ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                    <td><strong style={{ color: '#a5b4fc' }}>₪{Number(h.amount).toLocaleString()}</strong></td>
                    <td style={{ color: '#94a3b8' }}>{h.date?.substring(0, 10)}</td>
                    <td>{h.reason || '—'}</td>
                    <td style={{ color: '#64748b' }}>{h.createdBy || '—'}</td>
                    <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{h.createdAt?.substring(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
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
          ) : (() => {
            // Group by Friday date (startTime date part)
            const weekends = [];
            const dateMap = {};
            fridayRows.forEach(r => {
              const key = r.startTime ? r.startTime.substring(0, 10) : 'unknown';
              if (!dateMap[key]) { dateMap[key] = []; weekends.push(key); }
              dateMap[key].push(r);
            });
            weekends.sort((a, b) => b.localeCompare(a)); // newest first
            const totalRake = fridayRows.reduce((s, r) => s + Number(r.totalRake || 0), 0);
            let rowNum = 0;
            return (
              <>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  <strong style={{ color: '#e2e8f0' }}>{weekends.length}</strong> סופי שבוע
                  &nbsp;|&nbsp; <strong style={{ color: '#e2e8f0' }}>{fridayRows.length}</strong> גיימים
                  &nbsp;|&nbsp; סה"כ ריק:&nbsp;
                  <strong style={{ color: '#a5b4fc' }}>{totalRake.toLocaleString()}</strong>
                </div>
                <div className="table-wrap"><table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>שעת התחלה</th>
                      <th>שולחן</th>
                      <th>סוג</th>
                      <th>שחקנים</th>
                      <th>ריק</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekends.map(dateKey => {
                      const rows = dateMap[dateKey];
                      const weekendRake = rows.reduce((s, r) => s + Number(r.totalRake || 0), 0);
                      const dt = new Date(dateKey);
                      const weekendLabel = dt.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                      return [
                        <tr key={`header-${dateKey}`}>
                          <td colSpan={6} style={{ background: '#12151f', borderTop: '2px solid #2d3148', padding: '0.6rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ color: '#e2e8f0', fontSize: '0.95rem' }}>{weekendLabel}</strong>
                              <span style={{ background: '#1e1a3f', border: '1px solid #4338ca', borderRadius: '6px', padding: '2px 12px', color: '#a5b4fc', fontWeight: 700, fontSize: '0.95rem' }}>
                                ריק שבוע: {weekendRake.toLocaleString()}
                              </span>
                            </div>
                          </td>
                        </tr>,
                        ...rows.map(r => {
                          rowNum++;
                          const rdt = r.startTime ? new Date(r.startTime) : null;
                          const timeStr = rdt ? rdt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—';
                          return (
                            <tr key={r.sessionId}>
                              <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{rowNum}</td>
                              <td style={{ color: '#94a3b8' }}>{timeStr}</td>
                              <td><strong>{r.tableName || '—'}</strong></td>
                              <td style={{ color: '#94a3b8' }}>{r.gameType || '—'}</td>
                              <td style={{ color: '#64748b' }}>{r.playerCount}</td>
                              <td>
                                <span style={{
                                  background: Number(r.totalRake) > 0 ? '#2d3148' : 'rgba(100,116,139,0.15)',
                                  padding: '2px 10px', borderRadius: '20px', fontWeight: 700,
                                  color: Number(r.totalRake) > 0 ? '#a5b4fc' : '#64748b', fontSize: '0.95rem',
                                }}>
                                  {Number(r.totalRake).toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          );
                        }),
                      ];
                    })}
                  </tbody>
                </table></div>
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
