import { useState, useEffect } from 'react';
import { getSessionResults } from '../api';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fmtDateTime } from '../utils/dates';

export default function GameResults() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const session = state?.session;
  const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'MANAGER';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentOnly, setAgentOnly] = useState(false);

  useEffect(() => {
    getSessionResults(id).then(r => {
      setResults(r.data);
      setLoading(false);
    });
  }, [id]);

  const fmt = (n) => {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    const abs = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (num < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : 'zero';

  const fmtDate = fmtDateTime;

  const displayedResults = agentOnly ? results.filter(r => r.superAgentName) : results;

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/games')}>← Back to Games</button>
      </div>

      <h1 dir="rtl" style={{ textAlign: 'right' }}>{session?.tableName || `Game #${id}`}</h1>
      <div style={{ display: 'flex', gap: '2rem', color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {session?.gameType && <span>Type: <strong style={{ color: '#94a3b8' }}>{session.gameType}</strong></span>}
        {session?.startTime && <span>Start: <strong style={{ color: '#94a3b8' }}>{fmtDate(session.startTime)}</strong></span>}
        {session?.endTime && <span>End: <strong style={{ color: '#94a3b8' }}>{fmtDate(session.endTime)}</strong></span>}
        {session?.playerCount != null && <span>Players: <strong style={{ color: '#94a3b8' }}>{session.playerCount}</strong></span>}
        {session?.reEntryCount > 0 && <span>Re-entries: <strong style={{ color: '#f59e0b' }}>{session.reEntryCount}</strong></span>}
        {isAdmin && session?.rakeTotal != null && <span>Rake: <strong style={{ color: '#94a3b8' }}>{fmt(session.rakeTotal)}</strong></span>}
      </div>

      {results.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          <input
            type="checkbox"
            checked={agentOnly}
            onChange={e => setAgentOnly(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          Show only agent players
        </label>
      )}

      {results.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          No results found for this game.
        </div>
      ) : displayedResults.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          No agent players found for this game.
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Buy-in</th>
                <th>Winnings</th>
                <th>Prize</th>
                {isAdmin && <th>Rake</th>}
              </tr>
            </thead>
            <tbody>
              {displayedResults.map((r, i) => (
                <tr key={r.playerId ?? r.username ?? i}>
                  <td style={{ color: '#64748b', width: '40px' }}>
                    {r.tournamentPlace != null ? (
                      <strong style={{ color: r.tournamentPlace <= 3 ? '#f59e0b' : '#94a3b8' }}>
                        {r.tournamentPlace}
                      </strong>
                    ) : i + 1}
                  </td>
                  <td style={{ cursor: r.playerId ? 'pointer' : 'default' }} onClick={() => r.playerId && navigate(`/player/${r.playerId}`)}>
                    <div><strong style={{ color: '#a5b4fc' }}>{r.fullName || r.username}</strong></div>
                    {r.fullName && r.fullName !== r.username && (
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{r.username}</div>
                    )}
                    {r.superAgentName && (
                      <div style={{ color: '#34d399', fontSize: '0.75rem' }}>{r.superAgentName}</div>
                    )}
                  </td>
                  <td style={{ color: '#94a3b8' }}>{fmt(r.buyIn)}</td>
                  <td className={cls(r.cashout)}>{fmt(r.cashout)}</td>
                  <td><strong className={cls(r.resultAmount)}>{fmt(r.resultAmount)}</strong></td>
                  {isAdmin && <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{fmt(r.rakePaid)}</td>}
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
