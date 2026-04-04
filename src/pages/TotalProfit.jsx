import { useState, useEffect } from 'react';
import { getBalanceSheet, getPlayers, getProfitSummary } from '../api';

export default function TotalProfit() {
  const [players, setPlayers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [period, setPeriod] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : '';

  useEffect(() => {
    Promise.all([
      getPlayers(),
      getProfitSummary().catch(() => ({ data: null })),
    ]).then(([playersRes, summaryRes]) => {
      setPlayers(playersRes.data);
      setSummary(summaryRes.data);
      setLoading(false);
    });
  }, []);

  const loadPeriod = () => {
    if (!fromDate || !toDate) return;
    setPeriodLoading(true);
    getBalanceSheet(fromDate, toDate).then(res => {
      setPeriod(res.data.period);
      setPeriodLoading(false);
    }).catch(() => setPeriodLoading(false));
  };

  const clearPeriod = () => {
    setFromDate('');
    setToDate('');
    setPeriod(null);
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  // All-time calculation (from XLS ImportSummary + player records)
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

      {/* Date filter bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Period filter:</span>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px', padding: '0.3rem 0.6rem' }}
          />
          <span style={{ color: '#64748b' }}>→</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px', padding: '0.3rem 0.6rem' }}
          />
          <button onClick={loadPeriod} disabled={!fromDate || !toDate || periodLoading}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.35rem 1rem', cursor: 'pointer' }}>
            {periodLoading ? 'Loading…' : 'Show Period'}
          </button>
          {period && (
            <button onClick={clearPeriod}
              style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: '4px', padding: '0.35rem 0.8rem', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Period P&L — shown only when dates are selected */}
      {period && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Period P&L: {period.from} → {period.to}</h2>
          <table>
            <tbody>
              <tr>
                <td style={{ color: '#94a3b8' }}>Bank Deposits</td>
                <td className="positive"><strong>{fmt(period.deposits)}</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Cash received in period</td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>+ Net Credit Change</td>
                <td className={cls(period.netCreditChange)}><strong>{fmt(period.netCreditChange)}</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Credits given − repaid</td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>− Chip Delta</td>
                <td className="negative"><strong>({fmt(period.chipDelta)})</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  Chips end ({fmt(period.chipsEnd)}{period.chipsEndDate ? ` as of ${period.chipsEndDate}` : ''}) −
                  start ({fmt(period.chipsStart)}{period.chipsStartDate ? ` as of ${period.chipsStartDate}` : ''})
                </td>
              </tr>
              <tr style={{ borderTop: '2px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>= Period Rake</strong></td>
                <td><strong className={cls(period.periodRake)} style={{ fontSize: '1.1rem' }}>{fmt(period.periodRake)}</strong></td>
                <td></td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>− Expenses</td>
                <td className="negative" style={{ paddingTop: '1rem' }}><strong>({fmt(period.expenses)})</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem', paddingTop: '1rem' }}>Admin expenses in period</td>
              </tr>
              <tr style={{ borderTop: '1px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>= Net Profit</strong></td>
                <td><strong className={cls(period.netProfit)} style={{ fontSize: '1.2rem' }}>{fmt(period.netProfit)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* All-time Calculation */}
      <div className="card">
        <h2>All-Time P&L</h2>
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
