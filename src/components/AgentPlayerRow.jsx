import { Link } from 'react-router-dom';
import { fmtDateOnly } from '../utils/dates';

const fmt = (n) => {
  if (n === undefined || n === null) return '₪0.00';
  const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (Number(n) < 0 ? '-' : '') + '₪' + abs;
};

const balanceClass = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : 'zero';

export default function AgentPlayerRow({ player, showBalance, expanded, onToggle }) {
  const colCount = showBalance ? 6 : 5;
  return (
    <>
      <tr onClick={onToggle} style={{ borderBottom: '1px solid #1e2235', cursor: 'pointer' }}>
        <td style={{ padding: '8px' }}>
          <span style={{ display: 'inline-block', width: '1.4em', color: '#94a3b8', fontSize: '1.1rem', fontWeight: 700 }}>{expanded ? '▾' : '▸'}</span>
          <Link to={`/player/${player.playerId}`} onClick={e => e.stopPropagation()} style={{ color: '#60a5fa', textDecoration: 'underline' }}>
            {player.username}
          </Link>
          {player.fullName && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.4rem' }}>{player.fullName}</span>}
        </td>
        {showBalance && (
          <td style={{ padding: '8px', textAlign: 'right', color: Number(player.balance) < 0 ? '#f87171' : '#4ade80', fontWeight: 600 }}>{fmt(player.balance)}</td>
        )}
        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{player.gameCount}</td>
        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmt(player.totalRake)}</td>
        <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>{fmt(player.agentShare)}</td>
        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(player.periodPnl)}>{fmt(player.periodPnl)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={colCount} style={{ padding: 0, background: '#0d0f1a', borderBottom: '1px solid #1e2235' }}>
            {(!player.games || player.games.length === 0) ? (
              <div style={{ padding: '0.6rem 1rem', color: '#64748b', fontSize: '0.82rem' }}>No games in this period</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14.5%' }} />
                  <col style={{ width: '14.5%' }} />
                  <col style={{ width: '14.5%' }} />
                  <col style={{ width: '14.5%' }} />
                </colgroup>
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
                  {player.games.map((g, i) => (
                    <tr key={i} style={{ fontSize: '0.82rem' }}>
                      <td style={{ padding: '4px 1rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDateOnly(g.date)}</td>
                      <td style={{ padding: '4px 8px' }}><span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>{g.gameType}</span></td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#ef4444' }}>{fmt(-(g.buyIn || 0))}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmt(g.cashout)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b' }}>{fmt(g.rakePaid)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }} className={balanceClass(g.pnl)}>{fmt(g.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
