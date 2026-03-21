import { useState, useEffect } from 'react';
import { getPlayers, getProfitSummary } from '../api';

export default function TotalProfit() {
  const [players, setPlayers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPlayers(), getProfitSummary().catch(() => ({ data: null }))])
      .then(([playersRes, summaryRes]) => {
        setPlayers(playersRes.data);
        setSummary(summaryRes.data);
        setLoading(false);
      });
  }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : 'zero';

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  // From DB (players)
  const totalCredit = players.reduce((s, p) => s + Number(p.creditTotal || 0), 0);
  const totalChips = players.filter(p => !p.chipsStale).reduce((s, p) => s + Number(p.currentChips || 0), 0);

  // From XLS (import summary)
  const willExpense = Number(summary?.willExpense || 0);
  const generalExpenses = Number(summary?.generalExpenses || 0);
  const bankDeposits = Number(summary?.bankDeposits || 0);

  // Calculations
  const moneyIn = totalCredit + bankDeposits;
  const chipsPlayersPaidFor = totalChips - willExpense;
  const clubEarning = bankDeposits + totalCredit - chipsPlayersPaidFor;
  const netProfit = clubEarning - willExpense - generalExpenses;

  return (
    <div>
      <div className="page-header">
        <h1>Total Profit</h1>
        {summary?.lastUpdated && (
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Last updated: {summary.lastUpdated.replace('T', ' ').substring(0, 16)}
          </span>
        )}
      </div>

      {!summary && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          No profit data yet — import the management XLS first to compute these figures.
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Bank Deposits</div>
          <div className="value neutral">{fmt(bankDeposits)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Credit Given</div>
          <div className="value neutral">{fmt(totalCredit)}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#6366f1' }}>
          <div className="label" style={{ color: '#818cf8' }}>Money In (Credit + Deposits)</div>
          <div className="value" style={{ color: '#818cf8' }}>{fmt(moneyIn)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Chips Players Paid For</div>
          <div className="value neutral">{fmt(chipsPlayersPaidFor)}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Chips ({fmt(totalChips)}) − Will & Free Roll ({fmt(willExpense)})
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="stat-card">
          <div className="label">General Expenses</div>
          <div className={`value ${cls(-generalExpenses)}`}>{fmt(generalExpenses)}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#6366f1' }}>
          <div className="label" style={{ color: '#818cf8' }}>Club Earning</div>
          <div className={`value ${cls(clubEarning)}`} style={{ fontSize: '1.4rem' }}>{fmt(clubEarning)}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Deposits + Credit − Chips Players Paid For
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: '#22c55e' }}>
          <div className="label" style={{ color: '#4ade80' }}>Net Profit</div>
          <div className={`value ${cls(netProfit)}`} style={{ fontSize: '1.6rem' }}>{fmt(netProfit)}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Club Earning − Will & Free Roll − General Expenses
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2>Calculation Breakdown</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ color: '#94a3b8' }}>Bank Deposits</td>
              <td className="neutral"><strong>{fmt(bankDeposits)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>מיקום הכסף B2+I2</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>+ Total Credit Given</td>
              <td className="neutral"><strong>{fmt(totalCredit)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Sum of all player credits</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>− Chips Players Paid For</td>
              <td className="negative"><strong>({fmt(chipsPlayersPaidFor)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                Chips ({fmt(totalChips)}) − Will & Free Roll ({fmt(willExpense)})
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid #334155' }}>
              <td><strong style={{ color: '#e2e8f0' }}>= Club Earning</strong></td>
              <td><strong className={cls(clubEarning)} style={{ fontSize: '1.1rem' }}>{fmt(clubEarning)}</strong></td>
              <td></td>
            </tr>
            <tr style={{ marginTop: '1rem' }}>
              <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>− Will & Free Roll Expenses</td>
              <td className="negative" style={{ paddingTop: '1rem' }}><strong>({fmt(willExpense)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem', paddingTop: '1rem' }}>הוצאות col H</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>− General Expenses</td>
              <td className="negative"><strong>({fmt(generalExpenses)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>הוצאות col C</td>
            </tr>
            <tr style={{ borderTop: '1px solid #334155' }}>
              <td><strong style={{ color: '#e2e8f0' }}>= Net Profit</strong></td>
              <td><strong className={cls(netProfit)} style={{ fontSize: '1.1rem' }}>{fmt(netProfit)}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
