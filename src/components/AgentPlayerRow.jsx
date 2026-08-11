import { Link } from 'react-router-dom';
import { fmtDateOnly } from '../utils/dates';

const fmt = (n) => {
  if (n === undefined || n === null) return '₪0.00';
  const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (Number(n) < 0 ? '-' : '') + '₪' + abs;
};

const balanceClass = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : 'zero';

const gameTypeColors = {
  MTT: { background: '#1e3a5f', color: '#60a5fa' },
  SNG: { background: '#1e3a2f', color: '#4ade80' },
  NLH: { background: '#3a1e1e', color: '#f87171' },
};
const gameTypeStyle = (type) => gameTypeColors[type] || { background: '#2a1e3a', color: '#c084fc' };

export default function AgentPlayerRow({ player, showBalance, expanded, onToggle, checked, onToggleFlag }) {
  const colCount = showBalance ? 7 : 6;
  const games = player.games || [];
  const totals = games.reduce((acc, g) => ({
    buyIn: acc.buyIn + Number(g.buyIn || 0),
    cashout: acc.cashout + Number(g.cashout || 0),
    rakePaid: acc.rakePaid + Number(g.rakePaid || 0),
    pnl: acc.pnl + Number(g.pnl || 0),
  }), { buyIn: 0, cashout: 0, rakePaid: 0, pnl: 0 });

  return (
    <>
      <tr onClick={onToggle} style={{ borderBottom: '1px solid #1e2235', cursor: 'pointer' }}>
        <td style={{ padding: '8px' }}>
          <span style={{ display: 'inline-block', width: '1.4em', color: '#94a3b8', fontSize: '1.1rem', fontWeight: 700 }}>{expanded ? '▾' : '▸'}</span>
          <Link to={`/player/${player.playerId}`} onClick={e => e.stopPropagation()} style={{ color: '#60a5fa', textDecoration: 'underline' }}>
            {player.username}
          </Link>
          {player.fullName && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.4rem' }}>{player.fullName}</span>}
          {player.isSelf && <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: '#fbbf24', background: '#3b2f0b', border: '1px solid #a16207', padding: '1px 6px', borderRadius: '4px' }}>agent (self)</span>}
        </td>
        {showBalance && (
          <td style={{ padding: '8px', textAlign: 'right', color: Number(player.balance) < 0 ? '#f87171' : '#4ade80', fontWeight: 600 }}>{fmt(player.balance)}</td>
        )}
        <td style={{ padding: '8px', textAlign: 'right', color: '#e2e8f0', fontWeight: 600 }}>{fmt(player.currentChips)}</td>
        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{player.gameCount}</td>
        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmt(player.totalRake)}</td>
        <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>{fmt(player.agentShare)}</td>
        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(player.periodPnl)}>{fmt(player.periodPnl)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={colCount} style={{ padding: 0, background: '#0d0f1a', borderBottom: '1px solid #1e2235' }}>
            {games.length === 0 ? (
              <div style={{ padding: '0.6rem 1rem', color: '#64748b', fontSize: '0.82rem' }}>No games in this period</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#64748b', textAlign: 'left', fontSize: '0.78rem' }}>
                    <th style={{ padding: '4px 1rem' }}>Date</th>
                    <th style={{ padding: '4px 8px' }}>Game</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Buy-in</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Cashout</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Rake</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g, i) => (
                    <tr key={i} style={{ fontSize: '0.82rem' }}>
                      <td style={{ padding: '4px 1rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDateOnly(g.date)}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <div dir="rtl" style={{ color: '#e2e8f0', marginBottom: '2px' }}>{g.tableName || '—'}</div>
                        <span style={{ ...gameTypeStyle(g.gameType), padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>{g.gameType}</span>
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#ef4444' }}>{fmt(-(g.buyIn || 0))}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmt(g.cashout)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b' }}>{fmt(g.rakePaid)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(g.pnl)}>{fmt(g.pnl)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontSize: '0.82rem', borderTop: '1px solid #334155', background: '#12151f' }}>
                    <td style={{ padding: '4px 1rem', color: '#e2e8f0', fontWeight: 700 }}>Total</td>
                    <td />
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(-totals.buyIn)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(totals.cashout)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>{fmt(totals.rakePaid)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }} className={balanceClass(totals.pnl)}>{fmt(totals.pnl)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
