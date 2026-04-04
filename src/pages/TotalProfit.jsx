import { useState, useEffect } from 'react';
import { getBalanceSheet } from '../api';

export default function TotalProfit() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [snapshot, setSnapshot] = useState(null);
  const [period, setPeriod] = useState(null);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (Number(n) < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : '';

  useEffect(() => {
    getBalanceSheet().then(r => {
      setSnapshot(r.data.snapshot);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    setPeriodLoading(true);
    getBalanceSheet(from, to).then(r => {
      setPeriod(r.data.period);
      setPeriodLoading(false);
    });
  }, [from, to]);

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Total Profit</h1>
        {snapshot?.chipsAsOf && (
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Chips as of: {snapshot.chipsAsOf}
          </span>
        )}
      </div>

      {/* Card 1: Balance Sheet Snapshot */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Balance Sheet — Current Snapshot</h2>
        <table style={{ width: '100%' }}>
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
              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Chips held by players</td>
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

      {/* Card 2: Period P&L */}
      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Period P&L</h2>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>
          {periodLoading && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading...</span>}
        </div>

        {period && (
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ color: '#94a3b8' }}>Deposits in period</td>
                <td className="positive"><strong>{fmt(period.deposits)}</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Bank deposits {period.from} → {period.to}</td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>+ Net credit change</td>
                <td className={cls(period.netCreditChange)}>
                  <strong>{Number(period.netCreditChange) >= 0 ? fmt(period.netCreditChange) : `(${fmt(Math.abs(Number(period.netCreditChange)))})`}</strong>
                </td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>Credits given minus repaid</td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>− Chip change</td>
                <td className={Number(period.chipDelta) > 0 ? 'negative' : 'positive'}>
                  <strong>{Number(period.chipDelta) >= 0 ? `(${fmt(period.chipDelta)})` : fmt(Math.abs(Number(period.chipDelta)))}</strong>
                </td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  {period.chipsStartDate || '—'} → {period.chipsEndDate || '—'}
                </td>
              </tr>
              <tr style={{ borderTop: '2px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>= Period Rake</strong></td>
                <td><strong className={cls(period.periodRake)} style={{ fontSize: '1.1rem' }}>{fmt(period.periodRake)}</strong></td>
                <td></td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8', paddingTop: '1rem' }}>− Expenses in period</td>
                <td className="negative" style={{ paddingTop: '1rem' }}><strong>({fmt(period.expenses)})</strong></td>
                <td style={{ color: '#64748b', fontSize: '0.8rem', paddingTop: '1rem' }}>Admin + wheel expenses</td>
              </tr>
              <tr style={{ borderTop: '1px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>= Net Profit</strong></td>
                <td><strong className={cls(period.netProfit)} style={{ fontSize: '1.2rem' }}>{fmt(period.netProfit)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
