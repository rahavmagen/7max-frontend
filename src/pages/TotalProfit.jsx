import { useState, useEffect } from 'react';
import { getBalanceSheet, getPlayers, getProfitSummary } from '../api';

export default function TotalProfit() {
  const [snapshot, setSnapshot] = useState(null);
  const [players, setPlayers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : '';

  useEffect(() => {
    Promise.all([
      getBalanceSheet(),
      getPlayers(),
      getProfitSummary().catch(() => ({ data: null })),
    ]).then(([bsRes, playersRes, summaryRes]) => {
      setSnapshot(bsRes.data.snapshot);
      setPlayers(playersRes.data);
      setSummary(summaryRes.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  // Old calculation
  const totalCredit = players.reduce((s, p) => s + Number(p.creditTotal || 0), 0);
  const totalChips = players.filter(p => !p.chipsStale).reduce((s, p) => s + Number(p.currentChips || 0), 0);
  const willExpense = Number(summary?.willExpense || 0);
  const generalExpenses = Number(summary?.generalExpenses || 0);
  const bankDeposits = Number(summary?.bankDeposits || 0);
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

      {/* Card 1: Balance Sheet Snapshot */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Balance Sheet — Current Snapshot</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ color: '#94a3b8' }}>Bank Deposits</td>
              <td className="positive"><strong>{fmt(snapshot?.bankDeposits)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Cash received from players (all time)</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>+ Open Credits</td>
              <td className="positive"><strong>{fmt(snapshot?.openCredits)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Net credit outstanding (owed to club)</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>− Active Chips</td>
              <td className="negative"><strong>({fmt(snapshot?.activeChips)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Chips held by players{snapshot?.chipsAsOf ? ` (as of ${snapshot.chipsAsOf})` : ''}</td>
            </tr>
            <tr style={{ borderTop: '2px solid #334155' }}>
              <td><strong style={{ color: '#e2e8f0' }}>= Gross Rake (all time)</strong></td>
              <td><strong className={cls(snapshot?.grossRake)} style={{ fontSize: '1.1rem' }}>{fmt(snapshot?.grossRake)}</strong></td>
              <td></td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>− Total Expenses</td>
              <td className="negative" style={{ paddingTop: '1rem' }}><strong>({fmt(snapshot?.totalExpenses)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem', paddingTop: '1rem' }}>Admin + wheel expenses (all time)</td>
            </tr>
            <tr style={{ borderTop: '1px solid #334155' }}>
              <td><strong style={{ color: '#e2e8f0' }}>= Net Profit</strong></td>
              <td><strong className={cls(snapshot?.netProfit)} style={{ fontSize: '1.2rem' }}>{fmt(snapshot?.netProfit)}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Card 2: Original Calculation Breakdown */}
      <div className="card">
        <h2>Calculation Breakdown</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ color: '#94a3b8' }}>Bank Balance</td>
              <td className="positive"><strong>{fmt(bankDeposits)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>From XLS P2 + club transfers</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>+ Total Credit Given</td>
              <td className="positive"><strong>{fmt(totalCredit)}</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Sum of all player credits</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>− Chips Players Paid For</td>
              <td className="negative"><strong>({fmt(chipsPlayersPaidFor)})</strong></td>
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                Chips ({fmt(totalChips)}) − גלגל / Wheel ({fmt(willExpense)})
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid #334155' }}>
              <td><strong style={{ color: '#e2e8f0' }}>= Club Earning</strong></td>
              <td><strong className={cls(clubEarning)} style={{ fontSize: '1.1rem' }}>{fmt(clubEarning)}</strong></td>
              <td></td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>− גלגל / Wheel Expenses</td>
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
