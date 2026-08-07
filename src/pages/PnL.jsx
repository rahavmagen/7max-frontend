import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getIncomeReport, getPnlExpenses, getExpectedRakeback, setLastSettlementDate } from '../api';
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
  const [expectedRakeback, setExpectedRakeback] = useState(null);
  const [expectedRakebackOpen, setExpectedRakebackOpen] = useState(false);
  const [editingSettlementDate, setEditingSettlementDate] = useState(false);
  const [settlementDateDraft, setSettlementDateDraft] = useState('');
  const [savingSettlementDate, setSavingSettlementDate] = useState(false);

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

  const loadExpectedRakeback = () => {
    getExpectedRakeback().then(res => setExpectedRakeback(res.data)).catch(() => setExpectedRakeback(null));
  };
  useEffect(() => { loadExpectedRakeback(); }, []);

  const startEditSettlementDate = () => {
    setSettlementDateDraft(expectedRakeback?.lastSettlementDate || '');
    setEditingSettlementDate(true);
  };
  const saveSettlementDate = async () => {
    if (!settlementDateDraft) return;
    setSavingSettlementDate(true);
    try {
      await setLastSettlementDate(settlementDateDraft);
      setEditingSettlementDate(false);
      loadExpectedRakeback();
    } catch {
      // no dedicated error banner here - the field just stays open for retry
    }
    setSavingSettlementDate(false);
  };

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

  const expectedRakebackTotal = Number(expectedRakeback?.totalExpectedRakeback || 0);
  const totalExpenses = expenseLines.reduce((s, l) => s + Number(l.amount || 0), 0) + expectedRakebackTotal;
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

        {expectedRakeback && (
          <div style={{ borderBottom: '1px solid #2d3148' }}>
            <div
              onClick={() => setExpectedRakebackOpen(o => !o)}
              style={{ ...rowStyle, cursor: 'pointer', paddingLeft: '1.5rem' }}
              title="Click to see how this estimate was calculated"
            >
              <span style={{ color: '#94a3b8' }}>
                {expectedRakebackOpen ? '▾' : '▸'} Expected Rakeback <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(est., not yet paid)</span>
              </span>
              <strong style={{ ...amountColStyle, color: '#f59e0b', marginRight: '2rem' }}>{fmt(expectedRakebackTotal)}</strong>
            </div>

            {expectedRakebackOpen && (
              <div style={{ padding: '0.75rem 1.5rem 1rem 2.5rem', background: 'rgba(245,158,11,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>תאריך התחשבנות אחרון:</span>
                  {editingSettlementDate ? (
                    <>
                      <DateInput value={settlementDateDraft} onChange={setSettlementDateDraft} />
                      <button onClick={saveSettlementDate} disabled={savingSettlementDate || !settlementDateDraft} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                        {savingSettlementDate ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingSettlementDate(false)} style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'transparent', border: '1px solid #2d3148', borderRadius: 6, color: '#94a3b8', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </>
                  ) : expectedRakeback.lastSettlementDate ? (
                    <>
                      <strong style={{ color: '#e2e8f0' }}>{new Date(expectedRakeback.lastSettlementDate).toLocaleDateString('he-IL')}</strong>
                      <span style={{ color: '#64748b' }}>({expectedRakeback.daysSince} day{expectedRakeback.daysSince === 1 ? '' : 's'} ago)</span>
                      <button onClick={startEditSettlementDate} style={{ padding: '2px 10px', fontSize: '0.78rem', background: 'transparent', border: '1px solid #2d3148', borderRadius: 6, color: '#a78bfa', cursor: 'pointer' }}>
                        ✏️ Edit
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#64748b' }}>not set</span>
                      <button onClick={startEditSettlementDate} style={{ padding: '2px 10px', fontSize: '0.78rem', background: 'transparent', border: '1px solid #2d3148', borderRadius: 6, color: '#a78bfa', cursor: 'pointer' }}>
                        ✏️ Set it
                      </button>
                    </>
                  )}
                </div>

                {expectedRakeback.lastSettlementDate && (
                  <>
                    {expectedRakeback.playersBreakdown?.length > 0 && (
                      <>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Players</div>
                        {expectedRakeback.playersBreakdown.map(row => (
                          <div key={row.playerId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '2px 0', color: '#94a3b8' }}>
                            <span>{row.username}{row.fullName ? ` (${row.fullName})` : ''} — ₪{Number(row.rake).toFixed(0)} rake × {(row.rakebackPercentage * 100).toFixed(0)}%</span>
                            <strong style={{ color: '#f59e0b', marginLeft: '1rem' }}>{fmt(row.amount)}</strong>
                          </div>
                        ))}
                      </>
                    )}
                    {expectedRakeback.agentsBreakdown?.length > 0 && (
                      <>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginTop: '0.75rem', marginBottom: '0.25rem' }}>Agents</div>
                        {expectedRakeback.agentsBreakdown.map(row => (
                          <div key={row.agentId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '2px 0', color: '#94a3b8' }}>
                            <span>{row.username}{row.fullName ? ` (${row.fullName})` : ''} — ₪{Number(row.rake).toFixed(0)} rake × {(row.rakePercentage * 100).toFixed(0)}%</span>
                            <strong style={{ color: '#f59e0b', marginLeft: '1rem' }}>{fmt(row.amount)}</strong>
                          </div>
                        ))}
                      </>
                    )}
                    {(!expectedRakeback.playersBreakdown?.length && !expectedRakeback.agentsBreakdown?.length) && (
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No rake generated by rakeback players/agents since the last settlement.</div>
                    )}
                    <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.78rem', fontStyle: 'italic' }}>
                      ⚠️ This is only the <em>expected</em> rakeback owed based on rake generated since the last settlement — not rakeback that has actually been paid out.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

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
