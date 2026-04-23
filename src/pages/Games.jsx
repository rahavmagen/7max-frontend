import { useState, useEffect, useMemo } from 'react';
import { getGameSessions, getFridayRakeReport } from '../api';
import { useNavigate } from 'react-router-dom';

export default function Games() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shabbatRake, setShabbatRake] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [costMin, setCostMin] = useState('');
  const [costMax, setCostMax] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getGameSessions().then(r => {
      setSessions(r.data);
      setLoading(false);
    });
    getFridayRakeReport().then(r => {
      const total = r.data.reduce((s, row) => s + Number(row.totalRake || 0), 0);
      setShabbatRake(total);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const date = s.startTime ? s.startTime.substring(0, 10) : '';
      const cost = s.entryFee ? Number(s.entryFee) : 0;
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
      if (costMin !== '' && cost < Number(costMin)) return false;
      if (costMax !== '' && cost > Number(costMax)) return false;
      if (gameTypeFilter && s.gameType !== gameTypeFilter) return false;
      return true;
    });
  }, [sessions, dateFrom, dateTo, costMin, costMax]);

  const hasFilter = dateFrom || dateTo || costMin !== '' || costMax !== '' || gameTypeFilter;

  const fmtDate = (dt) => {
    if (!dt) return '—';
    return dt.replace('T', ' ').substring(0, 16);
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  return (
    <div>
      <h1>Games</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        All game sessions. Click a game to see results.
      </p>

      {shabbatRake > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#1a1d2e', border: '1px solid #3730a3', borderRadius: '10px', padding: '0.6rem 1.2rem', marginBottom: '1.5rem' }}>
          <span style={{ color: '#7a8499', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>ריק שבת</span>
          <strong style={{ color: '#a5b4fc', fontSize: '1.1rem' }}>{shabbatRake.toLocaleString()}</strong>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Total Shabbat Rake</span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Game type</label>
          <select value={gameTypeFilter} onChange={e => setGameTypeFilter(e.target.value)}
            style={{ background: '#1e2130', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}>
            <option value="">All</option>
            <option value="MTT">MTT</option>
            <option value="SNG">SNG</option>
            <option value="NLH">NLH</option>
            <option value="PLO">PLO</option>
            <option value="PLO5">PLO5</option>
            <option value="PLO6">PLO6</option>
            <option value="AoF">AoF</option>
            <option value="SPIN_GOLD">SPIN_GOLD</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Date from</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ background: '#1e2130', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Date to</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ background: '#1e2130', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Cost min (₪)</label>
          <input type="number" placeholder="0" value={costMin} onChange={e => setCostMin(e.target.value)}
            style={{ background: '#1e2130', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.85rem', width: '90px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Cost max (₪)</label>
          <input type="number" placeholder="∞" value={costMax} onChange={e => setCostMax(e.target.value)}
            style={{ background: '#1e2130', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.85rem', width: '90px' }} />
        </div>
        {hasFilter && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setCostMin(''); setCostMax(''); setGameTypeFilter(''); }}
            style={{ background: '#374151', color: '#94a3b8', border: 'none', borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            Clear
          </button>
        )}
        {hasFilter && (
          <span style={{ color: '#64748b', fontSize: '0.8rem', alignSelf: 'center' }}>
            {filtered.length} / {sessions.length} games
          </span>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          No game data yet — upload a ClubGG report first.
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Tournament</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Cost</th>
                <th>Players</th>
                <th>Entries</th>
                <th>Re-entries</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/game-results/${s.id}`, { state: { session: s } })}
                  style={{ cursor: 'pointer' }}
                  className="hoverable-row"
                >
                  <td dir="rtl" style={{ textAlign: 'right' }}><strong style={{ color: '#e2e8f0' }}>{s.tableName || '—'}</strong></td>
                  <td>
                    <span style={{
                      background: s.gameType === 'MTT' ? '#1e3a5f' : s.gameType === 'SNG' ? '#1e3a2f' : s.gameType === 'NLH' ? '#3a1e1e' : '#2a1e3a',
                      color: s.gameType === 'MTT' ? '#60a5fa' : s.gameType === 'SNG' ? '#4ade80' : s.gameType === 'NLH' ? '#f87171' : '#c084fc',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                    }}>
                      {s.gameType}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{fmtDate(s.startTime)}</td>
                  <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{fmtDate(s.endTime)}</td>
                  <td style={{ color: '#f59e0b', fontWeight: 600 }}>
                    {s.entryFee ? `₪${Number(s.entryFee).toLocaleString()}` : '—'}
                  </td>
                  <td><strong>{s.playerCount}</strong></td>
                  <td>{s.entryCount}</td>
                  <td style={{ color: s.reEntryCount > 0 ? '#f59e0b' : '#64748b' }}>
                    {s.reEntryCount > 0 ? s.reEntryCount : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
