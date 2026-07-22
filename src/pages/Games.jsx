import { useState, useEffect, useMemo, useRef } from 'react';
import { getGameSessions, getShabatRakeSummary } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import DateInput from '../components/DateInput';

export default function Games() {
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'MANAGER';
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shabbatRake, setShabbatRake] = useState(null);
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState('');
  const [costMin, setCostMin] = useState('');
  const [costMax, setCostMax] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState('');
  const [hiddenNames, setHiddenNames] = useState(new Set());
  const [nameDropOpen, setNameDropOpen] = useState(false);
  const nameDropRef = useRef(null);
  const [excludedIds, setExcludedIds] = useState(new Set());
  const navigate = useNavigate();

  const toggleExclude = (id, e) => {
    e.stopPropagation();
    setExcludedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    getGameSessions().then(r => {
      setSessions(r.data);
      setLoading(false);
    });
    getShabatRakeSummary().then(r => setShabbatRake(r.data)).catch(() => {});
  }, []);

  const preFiltered = useMemo(() => {
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
  }, [sessions, dateFrom, dateTo, costMin, costMax, gameTypeFilter]);

  const uniqueNames = useMemo(() => [...new Set(preFiltered.map(s => s.tableName).filter(Boolean))].sort(), [preFiltered]);

  const filtered = useMemo(() => {
    if (hiddenNames.size === 0) return preFiltered;
    return preFiltered.filter(s => !hiddenNames.has(s.tableName));
  }, [preFiltered, hiddenNames]);

  const hasFilter = dateFrom || dateTo || costMin !== '' || costMax !== '' || gameTypeFilter || hiddenNames.size > 0;

  const filteredRake = filtered.reduce((s, session) =>
    excludedIds.has(session.id) ? s : s + Number(session.rakeTotal || 0), 0);

  const fmtDate = (dt) => {
    if (!dt) return '—';
    const [datePart, timePart] = dt.replace('T', ' ').substring(0, 16).split(' ');
    const [y, m, d] = datePart.split('-');
    return `${d}/${m}/${y}${timePart ? ' ' + timePart : ''}`;
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  return (
    <div>
      <h1>Games</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        All game sessions. Click a game to see results.
      </p>

      {shabbatRake && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#1a1d2e', border: '1px solid #3730a3', borderRadius: '10px', padding: '0.6rem 1.2rem', marginBottom: '1.5rem' }}>
          <span style={{ color: '#7a8499', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>ריק שבת</span>
          <strong style={{ color: '#a5b4fc', fontSize: '1.1rem' }}>₪{Number(shabbatRake.current).toLocaleString()}</strong>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Shabbat Rake</span>
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
          <DateInput value={dateFrom} onChange={setDateFrom} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Date to</label>
          <DateInput value={dateTo} onChange={setDateTo} />
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
        {uniqueNames.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }} ref={nameDropRef}>
            <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Tournament</label>
            <button onClick={() => setNameDropOpen(o => !o)}
              style={{
                background: hiddenNames.size > 0 ? '#1e3a5f' : '#1e2130',
                color: hiddenNames.size > 0 ? '#93c5fd' : '#e2e8f0',
                border: `1px solid ${hiddenNames.size > 0 ? '#3b82f6' : '#334155'}`,
                borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.85rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
              {hiddenNames.size > 0 ? `${uniqueNames.length - hiddenNames.size}/${uniqueNames.length} selected` : 'All'}
              <span style={{ fontSize: '0.65rem' }}>▼</span>
            </button>
            {nameDropOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: '#1a1d2e', border: '1px solid #334155', borderRadius: '8px',
                padding: '0.5rem 0', minWidth: '220px', marginTop: '2px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
                onMouseLeave={() => setNameDropOpen(false)}>
                <div
                  onClick={() => setHiddenNames(hiddenNames.size === 0 ? new Set(uniqueNames) : new Set())}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.9rem', cursor: 'pointer', borderBottom: '1px solid #2d3148', marginBottom: '0.25rem' }}>
                  <input type="checkbox" readOnly
                    checked={hiddenNames.size === 0}
                    style={{ accentColor: '#3b82f6', width: '14px', height: '14px' }} />
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>(Select All)</span>
                </div>
                {uniqueNames.map(name => (
                  <div key={name}
                    onClick={() => setHiddenNames(prev => {
                      const next = new Set(prev);
                      next.has(name) ? next.delete(name) : next.add(name);
                      return next;
                    })}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.9rem', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e2130'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <input type="checkbox" readOnly
                      checked={!hiddenNames.has(name)}
                      style={{ accentColor: '#3b82f6', width: '14px', height: '14px' }} />
                    <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }} dir="rtl">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {hasFilter && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setCostMin(''); setCostMax(''); setGameTypeFilter(''); setHiddenNames(new Set()); }}
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

      {isAdmin && filtered.length > 0 && (
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '0.75rem', padding: '0.6rem 1rem', background: '#1a1d2e', borderRadius: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            סה"כ ריק (מסומן):&nbsp;
            <strong style={{ color: '#f59e0b', fontSize: '1rem' }}>
              ₪{filteredRake.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </span>
          {excludedIds.size > 0 && (
            <>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({excludedIds.size} לא נכלל)</span>
              <button onClick={() => setExcludedIds(new Set())}
                style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '2px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                אפס הכל
              </button>
            </>
          )}
        </div>
      )}

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
                {isAdmin && <th>Rake</th>}
                <th>Hands</th>
                {isAdmin && <th style={{ color: '#64748b', fontSize: '0.78rem' }}>כלול בריק</th>}
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
                  {isAdmin && (
                    <td style={{ color: s.rakeTotal > 0 ? '#34d399' : '#64748b' }}>
                      {s.rakeTotal > 0 ? `₪${Number(s.rakeTotal).toLocaleString()}` : '—'}
                    </td>
                  )}
                  <td style={{ color: s.handsPlayed > 0 ? '#94a3b8' : '#64748b' }}>
                    {s.handsPlayed > 0 ? s.handsPlayed : '—'}
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!excludedIds.has(s.id)}
                        onChange={e => toggleExclude(s.id, e)}
                        style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#f59e0b' }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
