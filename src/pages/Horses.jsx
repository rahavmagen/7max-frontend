import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { getSatelliteBacking, getTournamentHorses, getPlayers, setPlayerHorse, getLastSettlementDate } from '../api';
import DateInput from '../components/DateInput';
import PlayerSelect from '../components/PlayerSelect';

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

// Backing "programs" a horse can be on.
const PROGRAMS = [
  { value: 'SATELLITE', label: 'Satellite Backing (net 50/50)' },
  { value: 'TOURNAMENT', label: '50/50 All Horses (deficit, then 50/50)' },
];
const PROGRAM_LABEL = { SATELLITE: 'Satellite Backing', TOURNAMENT: '50/50 All Horses' };
const HORSE_GAME_TYPES = ['NLH', 'PLO', 'PLO4', 'PLO5', 'PLO6', 'MTT', 'SNG', 'AoF', 'SPIN_GOLD'];

export default function Horses() {
  const [tab, setTab] = useState('status');
  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>🐎 Horses</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0, marginBottom: '1rem' }}>
        Players the club backs. Winning a satellite is only a ticket — the club profits only when the <b>target</b> game cashes.
        Each cashed target is split after reducing just its <b>winning sat's</b> cost: <b>Player gets</b> = (win − sat cost)/2, <b>Club gets</b> = the rest of the pot.
        Every <b>other</b> sat that lost is a full club loss. <b>Club net</b> = Club gets − all sat costs.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        {[['status', 'Status'], ['add', 'Add Horse']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.6rem 1.1rem',
              fontSize: '0.95rem', fontWeight: 600,
              color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'status' ? (
        <>
          <StatusTab />
          <TournamentHorsesSection />
        </>
      ) : <AddHorseTab onAdded={() => setTab('status')} />}
    </div>
  );
}

/* ---------------- Status tab: satellite-backing P&L per horse ---------------- */
function StatusTab() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(isoDate(new Date()));
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = async (f = from, t = to) => {
    setLoading(true); setError(null);
    try {
      const res = await getSatelliteBacking({ from: f, to: t });
      setRows(res.data);
    } catch { setError('Failed to load status'); }
    setLoading(false);
  };

  // Default the range to start at the last התחשבנות (settlement) date, matching Agents / P&L.
  useEffect(() => {
    getLastSettlementDate()
      .then(res => {
        const d = res.data?.date;
        if (d) { setFrom(d); load(d, to); }
        else load(from, to);
      })
      .catch(() => load(from, to));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    return (num < 0 ? '-' : '') + '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const color = (n) => Number(n) > 0 ? '#4ade80' : Number(n) < 0 ? '#fca5a5' : 'var(--text-muted)';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const countedLabel = { shared: 'shared 50/50', own: 'own money (his)', busted: 'busted', unused: 'ticket unused' };
  const countedColor = { shared: '#4ade80', own: '#94a3b8', busted: '#fca5a5', unused: '#fbbf24' };
  const th = { padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const td = { padding: '10px 14px' };

  return (
    <div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>From:</span>
        <DateInput value={from} onChange={setFrom} />
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>To:</span>
        <DateInput value={to} onChange={setTo} />
        <button onClick={() => load()} disabled={loading}
          style={{ background: loading ? '#334155' : 'var(--accent)', color: loading ? '#64748b' : '#0f172a', border: 'none', borderRadius: 6, padding: '8px 22px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {error && <div style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #dc2626', borderRadius: 8, padding: '0.75rem 1.25rem', marginBottom: '1rem' }}>{error}</div>}

      {rows !== null && (rows.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No horses yet. Add one in the “Add Horse” tab.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                  <th style={th}>Horse</th>
                  <th style={th}>Program</th>
                  <th style={{ ...th, textAlign: 'right' }}>Sat cost</th>
                  <th style={{ ...th, textAlign: 'right' }}>Target winnings</th>
                  <th style={{ ...th, textAlign: 'right' }}>Player gets</th>
                  <th style={{ ...th, textAlign: 'right' }}>Club gets</th>
                  <th style={{ ...th, textAlign: 'right' }}>Club net</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.playerId}>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={td}>
                        <Link to={`/player/${r.playerId}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{r.username}</Link>
                        {r.fullName && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>{r.fullName}</span>}
                        {r.satelliteBackedSince && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            since {fmtDate(r.satelliteBackedSince)}
                            {r.satelliteBackedUntil && <span style={{ color: '#fbbf24' }}> · ends {fmtDate(r.satelliteBackedUntil)}</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Satellite Backing</td>
                      <td style={{ ...td, textAlign: 'right', color: '#fca5a5' }}>{fmt(-Math.abs(Number(r.satCost)))}</td>
                      <td style={{ ...td, textAlign: 'right', color: color(r.sharedReturns) }}>{fmt(r.sharedReturns)}</td>
                      <td style={{ ...td, textAlign: 'right', color: color(r.playerShare) }}>{fmt(r.playerShare)}</td>
                      <td style={{ ...td, textAlign: 'right', color: color(r.clubGets) }}>{fmt(r.clubGets)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: color(r.clubNet) }}>{fmt(r.clubNet)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {r.breakdown && r.breakdown.length > 0 && (
                          <button onClick={() => toggle(r.playerId)}
                            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            {expanded[r.playerId] ? 'Hide' : 'Breakdown'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded[r.playerId] && r.breakdown.map((day, di) => (
                      <tr key={`${r.playerId}-${di}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <td colSpan={8} style={{ padding: '0.5rem 1.5rem 1rem' }}>
                          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', margin: '0.5rem 0' }}>{fmtDate(day.date)}</div>
                          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: 4 }}>Satellites (club cost)</div>
                              {day.sats.map((s, i) => (
                                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '2px 0' }}>
                                  {s.name} — {s.entries}× = <span style={{ color: '#fca5a5' }}>{fmt(-Math.abs(Number(s.cost)))}</span>
                                  {Number(s.wonAmount) > 0 ? <span style={{ color: '#4ade80' }}> · won a ticket ({fmt(s.wonAmount)}) → {s.targetMatched}</span> : <span style={{ color: 'var(--text-muted)' }}> · lost</span>}
                                </div>
                              ))}
                            </div>
                            {day.targets && day.targets.length > 0 && (
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: 4 }}>Targets</div>
                                {day.targets.map((t, i) => (
                                  <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '2px 0' }}>
                                    {t.name} — {t.entries}× ({t.tickets} ticket{t.tickets === 1 ? '' : 's'}), result <span style={{ color: color(t.result) }}>{fmt(t.result)}</span>
                                    {' '}<span style={{ color: countedColor[t.counted] || 'var(--text-muted)' }}>[{countedLabel[t.counted] || t.counted}]</span>
                                    {t.counted === 'shared' && (
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        {' '}→ {fmt(t.result)} − {fmt(t.feedCost)} sat = {fmt(t.profit)} profit → player {fmt(t.playerKeep)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 50/50 All Horses: winnings vs. fronted, deficit or 50/50 split ---------------- */
function TournamentHorsesSection() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    getTournamentHorses().then(res => setRows(res.data)).catch(() => setError('Failed to load 50/50 All Horses'));
  }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    return (num < 0 ? '-' : '') + '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const color = (n) => Number(n) > 0 ? '#4ade80' : Number(n) < 0 ? '#fca5a5' : 'var(--text-muted)';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const th = { padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const td = { padding: '10px 14px' };

  if (rows === null && !error) return null;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.5rem' }}>50/50 All Horses</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 0, marginBottom: '0.75rem' }}>
        Their winnings (in the game types chosen for them) must first cover everything the club has fronted (via Horses Transactions on the Transfers page) before any split happens. Once winnings exceed what's been fronted, the surplus splits 50/50.
      </p>
      {error && <div style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #dc2626', borderRadius: 8, padding: '0.75rem 1.25rem', marginBottom: '1rem' }}>{error}</div>}
      {rows && (rows.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No 50/50 All Horses yet. Add one in the “Add Horse” tab.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                  <th style={th}>Horse</th>
                  <th style={th}>Game types</th>
                  <th style={{ ...th, textAlign: 'right' }}>Winnings</th>
                  <th style={{ ...th, textAlign: 'right' }}>Fronted</th>
                  <th style={{ ...th, textAlign: 'right' }}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Player gets</th>
                  <th style={{ ...th, textAlign: 'right' }}>Club gets</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <Fragment key={r.playerId}>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={td}>
                        <Link to={`/player/${r.playerId}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{r.username}</Link>
                        {r.fullName && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>{r.fullName}</span>}
                        {r.backedSince && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            since {fmtDate(r.backedSince)}
                            {r.backedUntil && <span style={{ color: '#fbbf24' }}> · ends {fmtDate(r.backedUntil)}</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.gameTypes || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: color(r.winnings) }}>{fmt(r.winnings)}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#fca5a5' }}>{fmt(-Math.abs(Number(r.fronted)))}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {r.profitable
                          ? <span style={{ color: '#4ade80', fontWeight: 700 }}>Profitable ({fmt(r.net)})</span>
                          : <span style={{ color: '#fbbf24' }}>Needs {fmt(r.deficit)} more</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: color(r.playerShare) }}>{fmt(r.playerShare)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: color(r.clubShare) }}>{fmt(r.clubShare)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {r.breakdown && r.breakdown.length > 0 && (
                          <button onClick={() => toggle(r.playerId)}
                            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            {expanded[r.playerId] ? 'Hide' : 'Breakdown'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded[r.playerId] && r.breakdown.map((day, di) => (
                      <tr key={`${r.playerId}-${di}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <td colSpan={8} style={{ padding: '0.5rem 1.5rem 1rem' }}>
                          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', margin: '0.5rem 0' }}>{fmtDate(day.date)}</div>
                          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                            {day.games.length > 0 && (
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: 4 }}>Games (counted)</div>
                                {day.games.map((g, i) => (
                                  <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '2px 0' }}>
                                    {g.gameType} {g.tableName ? `— ${g.tableName}` : ''} <span style={{ color: color(g.amount) }}>{fmt(g.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {day.transactions.length > 0 && (
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: 4 }}>Horses Transactions</div>
                                {day.transactions.map((t, i) => (
                                  <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '2px 0' }}>
                                    <span style={{ color: '#fca5a5' }}>{fmt(-Math.abs(Number(t.amount)))}</span>
                                    {t.notes ? ` — ${t.notes}` : ''}
                                    {t.createdBy ? <span style={{ color: 'var(--text-muted)' }}> ({t.createdBy})</span> : ''}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Add Horse tab: enroll a player in a program + manage existing ---------------- */
function AddHorseTab({ onAdded }) {
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [program, setProgram] = useState('SATELLITE');
  const [since, setSince] = useState(firstOfMonth());
  const [gameTypes, setGameTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [endDateFor, setEndDateFor] = useState(null); // `${id}:${prog}` while the end-date picker is open
  const [endDateValue, setEndDateValue] = useState(isoDate(new Date()));

  const loadPlayers = () => getPlayers().then(res => setPlayers(res.data || [])).catch(() => {});
  useEffect(() => { loadPlayers(); }, []);

  const horses = players.filter(p => p.satelliteBacked || p.tournamentHorseBacked);
  const [hideInactive, setHideInactive] = useState(false);
  const shownHorses = hideInactive ? horses.filter(h => Math.abs(Number(h.balance || 0)) >= 0.005) : horses;
  const toggleGameType = (t) => setGameTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const isEditing = program === 'TOURNAMENT' && horses.some(h => h.id === playerId && h.tournamentHorseBacked);

  const add = async () => {
    if (!playerId) { setMsg({ ok: false, text: 'Choose a player first.' }); return; }
    if (program === 'TOURNAMENT' && gameTypes.length === 0) { setMsg({ ok: false, text: 'Pick at least one game type.' }); return; }
    setSaving(true); setMsg(null);
    try {
      const payload = { program, since, enabled: true };
      if (program === 'TOURNAMENT') payload.gameTypes = gameTypes.join(',');
      await setPlayerHorse(playerId, payload);
      setMsg({ ok: true, text: isEditing ? 'Horse updated.' : 'Horse added.' });
      setPlayerId(null);
      setGameTypes([]);
      await loadPlayers();
      if (onAdded) onAdded();
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || 'Failed to save horse.' });
    }
    setSaving(false);
  };

  const remove = async (id, prog) => {
    setBusyId(id);
    try {
      await setPlayerHorse(id, { program: prog, enabled: false });
      await loadPlayers();
    } catch { /* ignore */ }
    setBusyId(null);
  };

  const openEndDate = (id, prog) => {
    setEndDateFor(`${id}:${prog}`);
    setEndDateValue(isoDate(new Date()));
  };

  const confirmEndDate = async (id, prog) => {
    setBusyId(id);
    try {
      await setPlayerHorse(id, { program: prog, enabled: false, until: endDateValue });
      await loadPlayers();
      setEndDateFor(null);
    } catch { /* ignore */ }
    setBusyId(null);
  };

  const editTournament = (h) => {
    setPlayerId(h.id);
    setProgram('TOURNAMENT');
    setSince(h.tournamentHorseBackedSince || firstOfMonth());
    setGameTypes(h.tournamentHorseGameTypes ? h.tournamentHorseGameTypes.split(',').map(s => s.trim()).filter(Boolean) : []);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';
  const labelStyle = { display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' };

  return (
    <div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem', maxWidth: 520 }}>
        <div style={{ marginBottom: '1.1rem' }}>
          <label style={labelStyle}>Player</label>
          <PlayerSelect label="player" value={playerId} onChange={setPlayerId} players={players} />
        </div>
        <div style={{ marginBottom: '1.1rem' }}>
          <label style={labelStyle}>Program</label>
          <select value={program} onChange={e => setProgram(e.target.value)}
            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, minHeight: 36, minWidth: 260 }}>
            {PROGRAMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {program === 'TOURNAMENT' && (
          <div style={{ marginBottom: '1.1rem' }}>
            <label style={labelStyle}>Game types counted</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {HORSE_GAME_TYPES.map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: gameTypes.includes(t) ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={gameTypes.includes(t)} onChange={() => toggleGameType(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: '1.4rem' }}>
          <label style={labelStyle}>Backed since</label>
          <DateInput value={since} onChange={setSince} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>P&amp;L is only counted from this date onward.</div>
        </div>
        <button onClick={add} disabled={saving}
          style={{ background: saving ? '#334155' : 'var(--accent)', color: saving ? '#64748b' : '#0f172a', border: 'none', borderRadius: 6, padding: '9px 24px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Horse'}
        </button>
        {msg && <div style={{ marginTop: '0.8rem', color: msg.ok ? '#4ade80' : '#fca5a5', fontSize: '0.85rem' }}>{msg.text}</div>}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>Current horses ({shownHorses.length})</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 400, cursor: 'pointer' }}>
            <input type="checkbox" checked={hideInactive} onChange={e => setHideInactive(e.target.checked)} style={{ cursor: 'pointer' }} />
            Hide inactive (zero balance)
          </label>
        </div>
        {shownHorses.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{horses.length === 0 ? 'No horses enrolled yet.' : 'All zero-balance horses are hidden.'}</div>
        ) : shownHorses.map(h => (
          <div key={h.id} style={{ padding: '0.7rem 1.25rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <Link to={`/player/${h.id}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>{h.username}</Link>
                {h.fullName && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 6 }}>{h.fullName}</span>}
                {h.satelliteBacked && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 10 }}>
                    Satellite Backing{h.satelliteBackedSince ? ` · since ${fmtDate(h.satelliteBackedSince)}` : ''}
                    {h.satelliteBackedUntil ? <span style={{ color: '#fbbf24' }}> · ends {fmtDate(h.satelliteBackedUntil)}</span> : ''}
                  </span>
                )}
                {h.tournamentHorseBacked && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 10 }}>
                    50/50 All Horses ({h.tournamentHorseGameTypes || '—'}){h.tournamentHorseBackedSince ? ` · since ${fmtDate(h.tournamentHorseBackedSince)}` : ''}
                    {h.tournamentHorseBackedUntil ? <span style={{ color: '#fbbf24' }}> · ends {fmtDate(h.tournamentHorseBackedUntil)}</span> : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {h.satelliteBacked && (
                  <>
                    <button onClick={() => openEndDate(h.id, 'SATELLITE')}
                      style={{ background: 'transparent', color: '#fbbf24', border: '1px solid #7a5b0e', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      📅 Set End Date
                    </button>
                    <button onClick={() => remove(h.id, 'SATELLITE')} disabled={busyId === h.id}
                      style={{ background: 'transparent', color: '#fca5a5', border: '1px solid #7f1d1d', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      {busyId === h.id ? '…' : 'Remove Horse'}
                    </button>
                  </>
                )}
                {h.tournamentHorseBacked && (
                  <>
                    <button onClick={() => editTournament(h)}
                      style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => openEndDate(h.id, 'TOURNAMENT')}
                      style={{ background: 'transparent', color: '#fbbf24', border: '1px solid #7a5b0e', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      📅 Set End Date
                    </button>
                    <button onClick={() => remove(h.id, 'TOURNAMENT')} disabled={busyId === h.id}
                      style={{ background: 'transparent', color: '#fca5a5', border: '1px solid #7f1d1d', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      {busyId === h.id ? '…' : 'Remove Horse'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {(endDateFor === `${h.id}:SATELLITE` || endDateFor === `${h.id}:TOURNAMENT`) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem', padding: '0.6rem', background: 'rgba(251,191,36,0.08)', border: '1px solid #7a5b0e', borderRadius: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Games from this date onward stop counting:</span>
                <DateInput value={endDateValue} onChange={setEndDateValue} />
                <button onClick={() => confirmEndDate(h.id, endDateFor.endsWith('SATELLITE') ? 'SATELLITE' : 'TOURNAMENT')} disabled={busyId === h.id}
                  style={{ background: 'var(--accent)', color: '#0f172a', border: 'none', borderRadius: 6, padding: '5px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                  {busyId === h.id ? '…' : 'Confirm'}
                </button>
                <button onClick={() => setEndDateFor(null)}
                  style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: '0.82rem' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
