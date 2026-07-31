import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIncomeReport, getPnlExpenses, getShabatRakeHistory } from '../api';
import DateInput from '../components/DateInput';
import { fmtDateOnly } from '../utils/dates';

const toInputDate = (d) => d.toISOString().substring(0, 10);

const getDefaultRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  return { from: toInputDate(from), to: toInputDate(now) };
};

export default function PnL() {
  const navigate = useNavigate();
  const defaultRange = getDefaultRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(null);
  const [shabatEntries, setShabatEntries] = useState([]);
  const [shabatOpen, setShabatOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async (from, to) => {
    setLoading(true);
    try {
      const [incomeRes, expRes, shabatRes] = await Promise.all([
        getIncomeReport({ dateFrom: from, dateTo: to }),
        getPnlExpenses({ dateFrom: from, dateTo: to }),
        getShabatRakeHistory().catch(() => ({ data: [] })),
      ]);
      const totalRake = incomeRes.data.reduce((s, row) => s + parseFloat(row.totalRake || 0), 0);
      setIncome(totalRake);
      setExpenses(expRes.data);
      const inRange = shabatRes.data.filter(e => {
        const d = (e.date || '').substring(0, 10);
        return d && d >= from && d <= to;
      });
      setShabatEntries(inRange);
    } catch {
      setIncome(0);
      setExpenses(null);
      setShabatEntries([]);
    }
    setLoading(false);
  };

  useEffect(() => { Promise.resolve().then(() => load(dateFrom, dateTo)); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const num = parseFloat(n);
    return (num < 0 ? '-' : '') + '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const goTo = (path) => navigate(path);

  const shabatTotal = shabatEntries.reduce((s, e) => s + Number(e.amount || 0), 0);

  const expenseLines = expenses ? [
    { label: 'General Admin Expenses', amount: expenses.generalExpenses, open: 'paid' },
    { label: 'Wheel Expenses', amount: expenses.wheelExpenses, open: 'wheelpromo' },
    { label: 'Rakeback', amount: expenses.rakeback, open: 'wheelpromo' },
    { label: 'Agent Settlements', amount: expenses.agentSettlements, open: null },
    { label: 'Write-offs', amount: expenses.writeOffs, open: 'writeoffs' },
    { label: 'Club Expenses', amount: expenses.clubExpenses, open: 'paid' },
  ] : [];

  const totalExpenses = expenseLines.reduce((s, l) => s + Number(l.amount || 0), 0) + shabatTotal;
  const netProfit = income - totalExpenses;

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

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr
                onClick={() => goTo(`/club-income?from=${dateFrom}&to=${dateTo}`)}
                style={{ cursor: 'pointer' }}
                title="Open Club Income for this date range"
              >
                <td style={{ color: '#e2e8f0' }}>Income (Rake)</td>
                <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmt(income)}</td>
              </tr>

              {expenseLines.map(line => {
                const params = new URLSearchParams({ from: dateFrom, to: dateTo });
                if (line.open) params.set('open', line.open);
                return (
                  <tr
                    key={line.label}
                    onClick={() => goTo(`/admin-expenses?${params.toString()}`)}
                    style={{ cursor: 'pointer' }}
                    title="Open Expenses for this date range"
                  >
                    <td style={{ color: '#e2e8f0' }}>{line.label}</td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(line.amount)}</td>
                  </tr>
                );
              })}

              <tr onClick={() => setShabatOpen(o => !o)} style={{ cursor: 'pointer' }}>
                <td style={{ color: '#e2e8f0' }}>
                  Shabbat Rake Bonuses <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{shabatOpen ? '▲' : '▼'}</span>
                </td>
                <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(shabatTotal)}</td>
              </tr>
              {shabatOpen && (
                <tr>
                  <td colSpan={2} style={{ padding: 0 }}>
                    {shabatEntries.length === 0 ? (
                      <div style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>No bonuses in this range</div>
                    ) : (
                      <table style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, padding: '0.4rem 1rem' }}>Date</th>
                            <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, padding: '0.4rem 1rem' }}>Player</th>
                            <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, padding: '0.4rem 1rem' }}>Reason</th>
                            <th style={{ textAlign: 'right', color: '#64748b', fontWeight: 500, padding: '0.4rem 1rem' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shabatEntries.map(e => (
                            <tr key={e.id}>
                              <td style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '0.3rem 1rem' }}>{fmtDateOnly(e.date)}</td>
                              <td style={{ color: '#e2e8f0', padding: '0.3rem 1rem' }}>{e.playerName || '—'}</td>
                              <td style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '0.3rem 1rem' }}>{e.reason || '—'}</td>
                              <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600, padding: '0.3rem 1rem' }}>{fmt(e.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}

              <tr style={{ borderTop: '2px solid #2d3148' }}>
                <td style={{ color: '#e2e8f0', fontWeight: 600, paddingTop: '0.75rem' }}>Total Expenses</td>
                <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 700, paddingTop: '0.75rem' }}>{fmt(totalExpenses)}</td>
              </tr>
              <tr>
                <td style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.05rem' }}>Net Profit</td>
                <td style={{ textAlign: 'right', color: netProfit >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '1.05rem' }}>{fmt(netProfit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
