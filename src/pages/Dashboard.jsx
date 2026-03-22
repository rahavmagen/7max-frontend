import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers } from '../api';

export default function Dashboard() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [showLeftClubOnly, setShowLeftClubOnly] = useState(false);
  const [sort, setSort] = useState({ col: null, dir: 1 });
  const navigate = useNavigate();

  useEffect(() => {
    getPlayers().then(r => setPlayers(r.data));
  }, []);

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir * -1 } : { col, dir: -1 });
  };

  const sortArrow = (col) => {
    if (sort.col !== col) return <span style={{ opacity: 0.3, fontSize: '0.7em' }}> ↕</span>;
    return <span style={{ color: '#f6c90e', fontSize: '0.7em' }}>{sort.dir === 1 ? ' ↑' : ' ↓'}</span>;
  };

  const isStale = (p) => (!p.clubPlayerId) && (p.currentChips || 0) > 0;
  const isLeftClub = (p) => p.chipsStale === true && p.clubPlayerId;

  let filtered = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  );

  if (showStaleOnly) filtered = filtered.filter(p => isStale(p));
  if (showLeftClubOnly) filtered = filtered.filter(p => isLeftClub(p));
  if (hideZero) filtered = filtered.filter(p => Number(p.balance) !== 0);

  const strCols = ['username', 'fullName', 'phone', 'clubPlayerId'];
  if (sort.col) {
    filtered = [...filtered].sort((a, b) => {
      if (strCols.includes(sort.col)) return (a[sort.col] || '').localeCompare(b[sort.col] || '') * sort.dir;
      return ((Number(a[sort.col]) || 0) - (Number(b[sort.col]) || 0)) * sort.dir;
    });
  }

  const totalChips = players.filter(p => !isStale(p)).reduce((s, p) => s + (p.currentChips || 0), 0);
  const totalCredit = players.reduce((s, p) => s + (p.creditTotal || 0), 0);
  const totalPnl = players.filter(p => !isStale(p)).reduce((s, p) => s + (p.balance || 0), 0);
  const activeCount = players.filter(p => p.active && !isStale(p)).length;
  const staleCount = players.filter(p => isStale(p)).length;
  const leftClubCount = players.filter(p => isLeftClub(p)).length;

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '₪' + abs;
  };

  const pnlColor = Number(totalPnl) > 0 ? '#22c55e' : Number(totalPnl) < 0 ? '#ef4444' : '#64748b';
  const balColor = (b) => Number(b) > 0 ? '#22c55e' : Number(b) < 0 ? '#ef4444' : '#64748b';

  const StatCard = ({ label, value, color, icon, onClick, active }) => (
    <div onClick={onClick} style={{
      background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
      border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 16, padding: '20px 18px', textAlign: 'center',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative', overflow: 'hidden',
      boxShadow: active ? `0 0 28px ${color}28, inset 0 1px 0 rgba(255,255,255,0.06)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: active ? 1 : 0.5 }} />
      {icon && <div style={{ fontSize: '1.3rem', marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: '1.65rem', fontWeight: 800, color, lineHeight: 1, textShadow: `0 0 24px ${color}44` }}>{value}</div>
      {active && <div style={{ fontSize: '0.68rem', color, marginTop: 6, opacity: 0.75 }}>filtering ✕</div>}
    </div>
  );

  const Th = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} style={{
      cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
      padding: '13px 14px', textAlign: 'left',
      fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px',
      color: sort.col === col ? '#f6c90e' : '#475569',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(0,0,0,0.2)', fontWeight: 600,
      transition: 'color 0.15s',
    }}>
      {label}{sortArrow(col)}
    </th>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px' }}>Players Dashboard</h1>
          <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: 4 }}>{players.length} players total</div>
        </div>
        <button onClick={() => navigate('/import')} style={{
          background: 'linear-gradient(135deg, #f6c90e, #f59e0b)',
          color: '#0f1117', border: 'none', borderRadius: 10,
          padding: '10px 20px', fontSize: '0.9rem', fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(246,201,14,0.3)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>⬆ Import Players</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard icon="👥" label="Active Players" value={activeCount} color="#6366f1" />
        <StatCard icon="🪙" label="Chips in System" value={fmt(totalChips)} color="#f6c90e" />
        <StatCard icon="💳" label="Credit Given" value={fmt(totalCredit)} color="#a78bfa" />
        <StatCard icon="📊" label="Total P / L" value={fmt(totalPnl)} color={pnlColor} />
        {staleCount > 0 && <StatCard icon="⚠️" label="Not in System" value={staleCount} color="#f59e0b" onClick={() => { setShowStaleOnly(s => !s); setShowLeftClubOnly(false); }} active={showStaleOnly} />}
        {leftClubCount > 0 && <StatCard icon="🚪" label="Left Club" value={leftClubCount} color="#94a3b8" onClick={() => { setShowLeftClubOnly(s => !s); setShowStaleOnly(false); }} active={showLeftClubOnly} />}
      </div>

      <div style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 40px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }}>🔍</span>
            <input
              style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 12px 9px 36px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              placeholder="Search by username, name or phone..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#f6c90e' }} />
            Hide zero balance
          </label>
          <span style={{ color: '#475569', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 10px', whiteSpace: 'nowrap' }}>{filtered.length} / {players.length}</span>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
            <thead>
              <tr>
                <Th col="username" label="Username" />
                <Th col="fullName" label="Full Name" />
                <Th col="phone" label="Phone" />
                <Th col="clubPlayerId" label="Club ID" />
                <Th col="currentChips" label="Chips" />
                <Th col="creditTotal" label="Credit" />
                <Th col="balance" label="P / L" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} onClick={() => navigate(`/player/${p.id}`)}
                  style={{ cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(246,201,14,0.045)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                >
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 600, color: '#e2e8f0' }}>
                    {p.username}
                    {isStale(p) && <span style={{ marginLeft: 8, fontSize: '0.65rem', background: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px', fontWeight: 700, verticalAlign: 'middle' }}>NOT EXISTS</span>}
                    {isLeftClub(p) && <span style={{ marginLeft: 8, fontSize: '0.65rem', background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700, verticalAlign: 'middle' }}>LEFT</span>}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' }}>{p.fullName || '—'}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#475569', fontSize: '0.85rem' }}>{p.phone || '—'}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#475569', fontSize: '0.8rem', fontFamily: 'monospace' }}>{p.clubPlayerId || '—'}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#f6c90e', fontWeight: 700 }}>{fmt(p.currentChips)}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#64748b' }}>{p.creditTotal > 0 ? fmt(p.creditTotal) : '—'}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 700, color: balColor(p.balance) }}>{fmt(p.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: '#475569', fontSize: '0.9rem' }}>No players found</div>}
        </div>
      </div>
    </div>
  );
}
