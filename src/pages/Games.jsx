import { useState, useEffect } from 'react';
import { getGameSessions } from '../api';
import { useNavigate } from 'react-router-dom';

export default function Games() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getGameSessions().then(r => {
      setSessions(r.data);
      setLoading(false);
    });
  }, []);

  const fmtDate = (dt) => {
    if (!dt) return '—';
    return dt.replace('T', ' ').substring(0, 16);
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  const shabbatSessions = sessions.filter(s => {
    if (!s.startTime) return false;
    const dt = new Date(s.startTime);
    const day = dt.getDay();
    const hour = dt.getHours();
    return (day === 5 && hour >= 18) || day === 6;
  });
  const shabbatRake = shabbatSessions.reduce((sum, s) => sum + Number(s.rakeTotal || 0), 0);

  return (
    <div>
      <h1>Games</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        All MTT & SNG tournaments. Click a game to see results.
      </p>

      {shabbatRake > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#1a1d2e', border: '1px solid #3730a3', borderRadius: '10px', padding: '0.6rem 1.2rem', marginBottom: '1.5rem' }}>
          <span style={{ color: '#7a8499', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>ריק שבת</span>
          <strong style={{ color: '#a5b4fc', fontSize: '1.1rem' }}>{shabbatRake.toLocaleString()}</strong>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({shabbatSessions.length} משחקים)</span>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          No tournament data yet — upload a ClubGG report first.
        </div>
      ) : (
        <div className="card">
          <table>
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
              {sessions.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/game-results/${s.id}`, { state: { session: s } })}
                  style={{ cursor: 'pointer' }}
                  className="hoverable-row"
                >
                  <td dir="rtl" style={{ textAlign: 'right' }}><strong style={{ color: '#e2e8f0' }}>{s.tableName || '—'}</strong></td>
                  <td>
                    <span style={{
                      background: s.gameType === 'MTT' ? '#1e3a5f' : '#1e3a2f',
                      color: s.gameType === 'MTT' ? '#60a5fa' : '#4ade80',
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
          </table>
        </div>
      )}
    </div>
  );
}
