import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getIncomeReport, getPnlExpenses } from '../api';
import DateInput from '../components/DateInput';

const toInputDate = (d) => d.toISOString().substring(0, 10);

const getDefaultRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  return { from: toInputDate(from), to: toInputDate(now) };
};

// Shared row layout so the amount column lines up in the same position across the
// Income, Expenses, and Profit blocks even though they're separate cards.
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' };
const amountColStyle = { width: '160px', textAlign: 'right', flexShrink: 0 };

export default function PnL() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultRange = getDefaultRange();
  const [dateFrom, setDateFromState] = useState(() => searchParams.get('from') || defaultRange.from);
  const [dateTo, setDateToState] = useState(() => searchParams.get('to') || defaultRange.to);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(null);
  const [loading, setLoading] = useState(false);

  // Keep the URL in sync with the chosen dates so browser back-navigation (e.g. after jumping
  // to Club Income or Expenses and coming back) restores the same range instead of the default.
  const setDateFrom = (v) => {
    setDateFromState(v);
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('from', v); return p; }, { replace: true });
  };
  const setDateTo = (v) => {
    setDateToState(v);
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('to', v); return p; }, { replace: true });
  };

  const load = async (from, to) => {
    setLoading(true);
    try {
      const [incomeRes, expRes] = await Promise.all([
        getIncomeReport({ dateFrom: from, dateTo: to }),
        getPnlExpenses({ dateFrom: from, dateTo: to }),
      ]);
      const totalRake = incomeRes.data.reduce((s, row) => s + parseFloat(row.totalRake || 0), 0);
      setIncome(totalRake);
      setExpenses(expRes.data);
    } catch {
      setIncome(0);
      setExpenses(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => load(dateFrom, dateTo));
    if (!searchParams.get('from') || !searchParams.get('to')) {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.set('from', dateFrom);
        p.set('to', dateTo);
        return p;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const num = parseFloat(n);
    return (num < 0 ? '-' : '') + '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const goTo = (path) => navigate(path);
  const expensesLink = (open) => {
    const params = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (open) params.set('open', open);
    return `/admin-expenses?${params.toString()}`;
  };

  const expenseLines = expenses ? [
    { label: 'Club Expenses', amount: Number(expenses.generalExpenses || 0) + Number(expenses.clubExpenses || 0), open: 'club_expenses' },
    { label: 'Wheel Expenses', amount: expenses.wheelExpenses, open: 'wheel' },
    { label: 'Rakeback', amount: expenses.rakeback, open: 'rakeback' },
    { label: 'Player Gifts', amount: expenses.playerGifts, open: 'playergifts' },
    { label: 'Agent Settlements', amount: expenses.agentSettlements, open: null },
    { label: 'Write-offs', amount: expenses.writeOffs, open: 'writeoffs' },
  ] : [];

  const totalExpenses = expenseLines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const netProfit = income - totalExpenses;

  // Number of days in the chosen range (01/08 → 04/08 = 3 days) for the average-per-day line.
  const periodDays = (() => {
    if (!dateFrom || !dateTo) return 0;
    const ms = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
    return Math.max(1, Math.round(ms / 86400000));
  })();
  const avgPerDay = periodDays > 0 ? netProfit / periodDays : 0;

  return (
    <div>
      <h1>P&amp;L</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <label style={{ color: '#64748b', fontSize: '0.85rem' }}>From:</label>
          <DateInput value={dateFrom} onChange={setDateFrom} />
          <label style={{ color: '#64748b', fontSize: '0.85rem' }}>To:</label>
          <DateInput value={dateTo} onChange={setDateTo} />
          <button className="btn btn-primary" onClick={() => load(dateFrom, dateTo)} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>

        <div
          onClick={() => goTo(`/club-income?from=${dateFrom}&to=${dateTo}`)}
          style={{ ...rowStyle, cursor: 'pointer' }}
          title="Open Club Income for this date range"
        >
          <span style={{ color: '#e2e8f0' }}>Income (Rake)</span>
          <strong style={{ ...amountColStyle, color: '#22c55e' }}>{fmt(income)}</strong>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ marginTop: 0, color: '#e2e8f0' }}>Expenses</h2>

        {expenseLines.map(line => (
          <div
            key={line.label}
            onClick={() => goTo(expensesLink(line.open))}
            style={{ ...rowStyle, cursor: 'pointer', borderBottom: '1px solid #2d3148', paddingLeft: '1.5rem' }}
            title="Open Club Expenses for this date range"
          >
            <span style={{ color: '#94a3b8' }}>{line.label}</span>
            <strong style={{ ...amountColStyle, color: '#ef4444', marginRight: '2rem' }}>{fmt(line.amount)}</strong>
          </div>
        ))}

        <div style={{ ...rowStyle, borderTop: '2px solid #2d3148', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
          <strong style={{ color: '#e2e8f0' }}>Total Expenses</strong>
          <strong style={{ ...amountColStyle, color: '#ef4444', fontSize: '1.05rem' }}>{fmt(totalExpenses)}</strong>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ marginTop: 0, color: '#e2e8f0' }}>Profit</h2>
        <div style={rowStyle}>
          <strong style={{ color: '#e2e8f0', fontSize: '1.05rem' }}>Net Profit (Income − Expenses)</strong>
          <strong style={{ ...amountColStyle, color: netProfit >= 0 ? '#22c55e' : '#ef4444', fontSize: '1.05rem' }}>{fmt(netProfit)}</strong>
        </div>
      </div>

      {periodDays > 0 && (
        <div style={{ marginTop: '0.6rem', paddingLeft: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>
          The average net profit per day for this period is{' '}
          <strong style={{ color: netProfit >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(avgPerDay)}</strong>
          {' '}({periodDays} day{periodDays === 1 ? '' : 's'})
        </div>
      )}
    </div>
  );
}
