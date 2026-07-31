import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getIncomeReport } from '../api';
import DateInput from '../components/DateInput';
import { fmtDateTime as fmtDisplay } from '../utils/dates';

const toInputDate = (d) => d.toISOString().substring(0, 10);

const getDefaultRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  return { from: toInputDate(from), to: toInputDate(now) };
};

export default function ClubIncome() {
  const [searchParams] = useSearchParams();
  const defaultRange = getDefaultRange();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || defaultRange.from);
  const [dateTo, setDateTo] = useState(searchParams.get('to') || defaultRange.to);
  const [gameTypeFilter, setGameTypeFilter] = useState('ALL');

  const load = async (from, to) => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.dateFrom = from;
      if (to) params.dateTo = to;
      const r = await getIncomeReport(params);
      setRows(r.data);
    } catch {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(dateFrom, dateTo); }, []);

  const gameTypes = useMemo(() => {
    const types = [...new Set(rows.map(r => r.gameType).filter(Boolean))].sort();
    return types;
  }, [rows]);

  const filtered = gameTypeFilter === 'ALL' ? rows : rows.filter(r => r.gameType === gameTypeFilter);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const num = parseFloat(n);
    return '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalRake = filtered.reduce((s, r) => s + parseFloat(r.totalRake || 0), 0);
  const totalHands = filtered.reduce((s, r) => s + parseInt(r.totalHands || 0), 0);

  const rakeByGameType = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const type = r.gameType || 'Unknown';
      map[type] = (map[type] || 0) + parseFloat(r.totalRake || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div>
      <h1>Club Income</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ color: '#64748b', fontSize: '0.85rem' }}>From:</label>
          <DateInput value={dateFrom} onChange={setDateFrom} />
          <label style={{ color: '#64748b', fontSize: '0.85rem' }}>To:</label>
          <DateInput value={dateTo} onChange={setDateTo} />
          <select value={gameTypeFilter} onChange={e => setGameTypeFilter(e.target.value)}
            style={{ background: '#0f1117', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}>
            <option value="ALL">All Games</option>
            {gameTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => load(dateFrom, dateTo)} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>

        {rakeByGameType.length > 0 && (
          <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', background: '#12151f', border: '1px solid #2d3148', borderRadius: '8px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rake by Type:</span>
            {rakeByGameType.map(([type, rake]) => (
              <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#e2e8f0' }}>{type}</span>
                <strong style={{ color: '#f59e0b', fontSize: '0.9rem' }}>{fmt(rake)}</strong>
              </span>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ display: 'flex', gap: '2rem', padding: '0.75rem 1rem', background: '#1a1d2e', borderRadius: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Sessions: <strong style={{ color: '#e2e8f0' }}>{filtered.length}</strong>
            </span>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Total Hands: <strong style={{ color: '#e2e8f0' }}>{totalHands.toLocaleString()}</strong>
            </span>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Total Rake: <strong style={{ color: '#f59e0b', fontSize: '1rem' }}>{fmt(totalRake)}</strong>
            </span>
          </div>
        )}

        {filtered.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No data found</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Table</th>
                  <th>Game</th>
                  <th>Players</th>
                  <th>Hands</th>
                  <th style={{ color: '#f59e0b' }}>Rake</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {fmtDisplay(r.startTime)}
                    </td>
                    <td dir="rtl" style={{ textAlign: 'right' }}>{r.tableName || '—'}</td>
                    <td>
                      <span style={{ background: '#2d3148', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {r.gameType || '—'}
                      </span>
                    </td>
                    <td style={{ color: '#64748b' }}>{r.playerCount}</td>
                    <td style={{ color: '#64748b' }}>{r.totalHands}</td>
                    <td style={{ color: '#f59e0b', fontWeight: 600 }}>{fmt(r.totalRake)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
