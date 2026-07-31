import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIncomeReport } from '../api';
import DateInput from '../components/DateInput';

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
  const [loading, setLoading] = useState(false);

  const load = async (from, to) => {
    setLoading(true);
    try {
      const r = await getIncomeReport({ dateFrom: from, dateTo: to });
      const totalRake = r.data.reduce((s, row) => s + parseFloat(row.totalRake || 0), 0);
      setIncome(totalRake);
    } catch {
      setIncome(0);
    }
    setLoading(false);
  };

  useEffect(() => { Promise.resolve().then(() => load(dateFrom, dateTo)); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const num = parseFloat(n);
    return (num < 0 ? '-' : '') + '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const goToClubIncome = () => navigate(`/club-income?from=${dateFrom}&to=${dateTo}`);

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
                onClick={goToClubIncome}
                style={{ cursor: 'pointer' }}
                title="Open Club Income for this date range"
              >
                <td style={{ color: '#e2e8f0' }}>Income (Rake)</td>
                <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmt(income)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
