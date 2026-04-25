import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getLeagueSessions, saveLeagueConfig, getLeagueStandings } from '../api';

const sel = {
  background: '#1e2130', color: '#e2e8f0',
  border: '1px solid #334155', borderRadius: '6px',
  padding: '0.35rem 0.6rem', fontSize: '0.85rem',
};

const inputStyle = {
  background: '#1e2130', color: '#e2e8f0',
  border: '1px solid #334155', borderRadius: '6px',
  padding: '0.3rem 0.5rem', fontSize: '0.85rem',
};

const multiplierStyle = {
  ...inputStyle, width: '56px', textAlign: 'center',
};

const fixedPtsStyle = {
  ...inputStyle, width: '76px', textAlign: 'center',
};

function fmtDate(dt) {
  if (!dt) return '—';
  return dt.replace('T', ' ').substring(0, 10);
}

function gameTypeBadge(gt) {
  const colors = {
    NLH:  { bg: '#3a1e1e', color: '#f87171' },
    PLO:  { bg: '#2a1e3a', color: '#c084fc' },
    PLO5: { bg: '#2a1e3a', color: '#c084fc' },
    PLO6: { bg: '#2a1e3a', color: '#c084fc' },
  };
  const c = colors[gt] || { bg: '#1e2a3a', color: '#60a5fa' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
      {gt}
    </span>
  );
}

export default function League() {
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'MANAGER';

  // Admin state
  const [sessions, setSessions] = useState([]);
  const [sessionState, setSessionState] = useState({}); // { [sessionId]: { included, handsMultiplier, profitMultiplier } }
  const [minHands, setMinHands] = useState(100);
  const [gameTypeFilter, setGameTypeFilter] = useState(() => localStorage.getItem('leagueGameTypeFilter') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const standingsRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  // Standings state
  const [standings, setStandings] = useState(null);
  const [standingsLoading, setStandingsLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) loadSessions();
    loadStandings();
  }, [isAdmin]);

  useEffect(() => {
    localStorage.setItem('leagueGameTypeFilter', gameTypeFilter);
  }, [gameTypeFilter]);

  async function loadSessions() {
    setAdminLoading(true);
    try {
      const res = await getLeagueSessions({ gameType: gameTypeFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
      setSessions(res.data);
      // Initialise session state from server data (don't overwrite user edits)
      setSessionState(prev => {
        const next = { ...prev };
        res.data.forEach(s => {
          if (!next[s.sessionId]) {
            next[s.sessionId] = { included: s.included, handsMultiplier: s.handsMultiplier, profitMultiplier: s.profitMultiplier };
          }
        });
        return next;
      });
    } finally { setAdminLoading(false); }
  }

  async function loadStandings() {
    setStandingsLoading(true);
    try {
      const res = await getLeagueStandings();
      setStandings(res.data);
      setMinHands(res.data.minHands ?? 100);
    } finally { setStandingsLoading(false); }
  }

  function applyFilters() {
    setSessionState({}); // reset so server values reload cleanly
    loadSessions();
  }

  function setSessionField(sessionId, field, value) {
    setSessionState(prev => ({
      ...prev,
      [sessionId]: { ...(prev[sessionId] || {}), [field]: value },
    }));
  }

  function unmarkAll() {
    setSessionState(prev => {
      const next = { ...prev };
      sessions.forEach(s => { next[s.sessionId] = { ...(next[s.sessionId] || {}), included: false }; });
      return next;
    });
  }

  async function saveAndRecalculate() {
    setSaving(true);
    try {
      const sessionPayload = sessions.map(s => {
        const st = sessionState[s.sessionId] || {};
        return {
          sessionId: s.sessionId,
          included: st.included ?? s.included,
          handsMultiplier: parseInt(st.handsMultiplier ?? s.handsMultiplier, 10) || 1,
          profitMultiplier: parseInt(st.profitMultiplier ?? s.profitMultiplier, 10) || 1,
          fixedPoints: parseInt(st.fixedPoints ?? s.fixedPoints ?? 0, 10) || 0,
        };
      });
      await saveLeagueConfig({ minHands: parseInt(minHands, 10) || 100, sessions: sessionPayload });
      await loadStandings();
      // Reload sessions to reflect new server state
      setSessionState({});
      await loadSessions();
      standingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally { setSaving(false); }
  }

  const selectedCount = sessions.filter(s => (sessionState[s.sessionId]?.included ?? s.included)).length;

  const fmtPts = (v) => v >= 0 ? `+${v.toLocaleString()}` : v.toLocaleString();
  const fmtILS = (v) => {
    const n = typeof v === 'object' ? Number(v) : v;
    return n >= 0 ? `+₪${n.toLocaleString()}` : `-₪${Math.abs(n).toLocaleString()}`;
  };

  return (
    <div>
      <h1>League</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Cash game league standings.
      </p>

      {/* ── STANDINGS ── */}
      <div className="card" ref={standingsRef} style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1.1rem', color: '#e2e8f0' }}>League Standings</h2>
        {standingsLoading ? (
          <div style={{ color: '#64748b', padding: '1rem' }}>Loading...</div>
        ) : !standings || standings.standings.length === 0 ? (
          <div style={{ color: '#64748b', padding: '1rem' }}>No data yet — admin needs to select sessions.</div>
        ) : (
          <>
            <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              {standings.sessionCount} session{standings.sessionCount !== 1 ? 's' : ''} · min {standings.minHands} hands · computed live
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>#</th>
                    <th style={{ textAlign: 'left' }}>Player</th>
                    <th style={{ textAlign: 'right' }}>Hands</th>
                    <th style={{ textAlign: 'right' }}>Hands Pts</th>
                    <th style={{ textAlign: 'right' }}>Profit (₪)</th>
                    <th style={{ textAlign: 'right' }}>Profit Pts</th>
                    <th style={{ textAlign: 'right' }}>Fixed Pts</th>
                    <th style={{ textAlign: 'right', color: '#a5b4fc' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.standings.map((row) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const rankLabel = row.rank != null ? (medals[row.rank - 1] || row.rank) : '—';
                    const qualified = row.qualified;
                    const profitColor = Number(row.profitILS) >= 0 ? '#34d399' : '#ef4444';
                    const profitPtsColor = row.profitPoints >= 0 ? '#34d399' : '#ef4444';
                    return (
                      <tr key={row.playerId} style={{ opacity: qualified ? 1 : 0.4 }}>
                        <td style={{ textAlign: 'center', color: qualified ? '#f59e0b' : '#64748b', fontWeight: 600 }}>
                          {rankLabel}
                        </td>
                        <td style={{ color: qualified ? '#e2e8f0' : '#64748b' }}>
                          {row.username}
                          {!qualified && <span style={{ fontSize: '0.75rem', color: '#475569', marginLeft: '0.5rem' }}>({row.totalHands} hands)</span>}
                        </td>
                        {qualified ? (
                          <>
                            <td style={{ textAlign: 'right', color: '#64748b' }}>{row.totalHands}</td>
                            <td style={{ textAlign: 'right', color: '#94a3b8' }}>{row.handsPoints.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: profitColor }}>{fmtILS(row.profitILS)}</td>
                            <td style={{ textAlign: 'right', color: profitPtsColor }}>{fmtPts(row.profitPoints)}</td>
                            <td style={{ textAlign: 'right', color: '#a5b4fc' }}>{row.fixedPoints > 0 ? `+${row.fixedPoints.toLocaleString()}` : '—'}</td>
                            <td style={{ textAlign: 'right', color: '#a5b4fc', fontWeight: 700 }}>{row.totalPoints.toLocaleString()}</td>
                          </>
                        ) : (
                          <td colSpan={6} style={{ textAlign: 'center', color: '#374151', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            below minimum — not ranked
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── ADMIN CONFIG ── */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ color: '#a5b4fc', fontSize: '1rem', fontWeight: 600 }}>⚙ League Settings</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={unmarkAll}
                style={{ background: '#374151', color: '#94a3b8', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
                Unmark All
              </button>
              <button onClick={saveAndRecalculate} disabled={saving}
                style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : '💾 Save & Recalculate'}
              </button>
            </div>
          </div>

          {/* Min hands */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#1a1d2e', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Min. hands to qualify:</span>
            <input type="number" value={minHands} onChange={e => setMinHands(e.target.value)}
              style={{ ...multiplierStyle, width: '80px' }} />
            <span style={{ color: '#475569', fontSize: '0.8rem' }}>|</span>
            <span style={{ color: '#a5b4fc', fontSize: '0.85rem' }}>{selectedCount} session{selectedCount !== 1 ? 's' : ''} selected</span>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Game type</label>
              <select value={gameTypeFilter} onChange={e => setGameTypeFilter(e.target.value)} style={sel}>
                <option value="">All</option>
                <option value="NLH">NLH</option>
                <option value="PLO">PLO</option>
                <option value="PLO5">PLO5</option>
                <option value="PLO6">PLO6</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Date from</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={sel} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Date to</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={sel} />
            </div>
            <button onClick={applyFilters}
              style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              Filter
            </button>
            {(gameTypeFilter || dateFrom || dateTo) && (
              <button onClick={() => { setGameTypeFilter(''); setDateFrom(''); setDateTo(''); }}
                style={{ background: '#374151', color: '#94a3b8', border: 'none', borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                Clear
              </button>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', marginLeft: '0.5rem' }}>
              <input type="checkbox" checked={showSelectedOnly} onChange={e => setShowSelectedOnly(e.target.checked)} />
              Selected only
            </label>
          </div>

          {/* Session table */}
          {adminLoading ? (
            <div style={{ color: '#64748b', padding: '1rem' }}>Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div style={{ color: '#64748b', padding: '1rem' }}>No sessions found.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>✓</th>
                    <th>Session</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Hands</th>
                    <th style={{ textAlign: 'right' }}>Rake (₪)</th>
                    <th>Hands ×</th>
                    <th>Profit ×</th>
                    <th>Fixed Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.filter(s => !showSelectedOnly || (sessionState[s.sessionId]?.included ?? s.included)).map(s => {
                    const st = sessionState[s.sessionId] || {};
                    const included = st.included ?? s.included;
                    const hm = st.handsMultiplier ?? s.handsMultiplier;
                    const pm = st.profitMultiplier ?? s.profitMultiplier;
                    const fp = st.fixedPoints ?? s.fixedPoints ?? 0;
                    return (
                      <tr key={s.sessionId} className="hoverable-row"
                        style={{ opacity: included ? 1 : 0.45 }}>
                        <td>
                          <input type="checkbox" checked={included}
                            onChange={e => setSessionField(s.sessionId, 'included', e.target.checked)} />
                        </td>
                        <td dir="rtl" style={{ textAlign: 'right', color: '#e2e8f0' }}>{s.tableName}</td>
                        <td>{gameTypeBadge(s.gameType)}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{fmtDate(s.startTime)}</td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>{s.totalHands ?? '—'}</td>
                        <td style={{ textAlign: 'right', color: '#34d399', fontSize: '0.85rem' }}>
                          {s.rake != null && Number(s.rake) !== 0 ? `₪${Number(s.rake).toLocaleString()}` : '—'}
                        </td>
                        <td>
                          {included ? (
                            <input type="number" value={hm} min="1"
                              onChange={e => setSessionField(s.sessionId, 'handsMultiplier', e.target.value)}
                              style={multiplierStyle} />
                          ) : <span style={{ color: '#374151' }}>—</span>}
                        </td>
                        <td>
                          {included ? (
                            <input type="number" value={pm} min="1"
                              onChange={e => setSessionField(s.sessionId, 'profitMultiplier', e.target.value)}
                              style={multiplierStyle} />
                          ) : <span style={{ color: '#374151' }}>—</span>}
                        </td>
                        <td>
                          {included ? (
                            <input type="number" value={fp} min="0"
                              onChange={e => setSessionField(s.sessionId, 'fixedPoints', e.target.value)}
                              style={fixedPtsStyle} />
                          ) : <span style={{ color: '#374151' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
