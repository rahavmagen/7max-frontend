import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRakebackReport } from '../api';
import DateInput from '../components/DateInput';
import { fmtDateOnly as fmt } from '../utils/dates';

const RB_GAME_TYPES = ['NLH', 'PLO', 'PLO5', 'MTT'];

export default function Rakeback() {
  const navigate = useNavigate();
  const [rbDateFrom, setRbDateFrom] = useState(() => new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10));
  const [rbDateTo, setRbDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rbRows, setRbRows] = useState(null);
  const [rbLoading, setRbLoading] = useState(false);
  const [rbError, setRbError] = useState('');
  const [rbGameTypes, setRbGameTypes] = useState(['NLH']);
  const toggleRbGameType = (type) => {
    setRbGameTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };
  const allRbSelected = RB_GAME_TYPES.every(t => rbGameTypes.includes(t));
  const toggleAllRbGameTypes = () => setRbGameTypes(allRbSelected ? [] : [...RB_GAME_TYPES]);

  const runRakeback = async (e) => {
    e.preventDefault();
    setRbError('');
    setRbLoading(true);
    try {
      const res = await getRakebackReport({ dateFrom: rbDateFrom, dateTo: rbDateTo, gameTypes: rbGameTypes.join(',') });
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
        <h1>דוח ריקבק</h1>
      </div>

      <div className="card">
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          סיכום ריקבק לשחקנים עם אחוז ריקבק מוגדר. תאריך התחלה אפקטיבי = MAX(מתאריך, rakebackSince)
        </p>
        <form onSubmit={runRakeback}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>סוגי משחק (ריק = ללא ריקבק)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#e2e8f0', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={allRbSelected} onChange={toggleAllRbGameTypes} />
                הכל
              </label>
              {RB_GAME_TYPES.map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={rbGameTypes.includes(type)} onChange={() => toggleRbGameType(type)} />
                  {type}
                </label>
              ))}
            </div>
          </div>
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
    </div>
  );
}
