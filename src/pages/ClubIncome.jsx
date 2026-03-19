import { useState, useEffect } from 'react';
import { getIncomeReport } from '../api';

const toInputDate = (d) => d.toISOString().substring(0, 10);
const fmtDisplay = (isoStr) => {
  if (!isoStr) return '—';
  const s = isoStr.replace('T', ' ').substring(0, 16);
  const [datePart, timePart] = s.split(' ');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y} ${timePart || ''}`.trim();
};

const getLastMonthRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toInputDate(from), to: toInputDate(to) };
};

export default function ClubIncome() {
  const defaultRange = getLastMonthRange();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

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

  useEffect(() => { load(defaultRange.from, defaultRange.to); }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const num = parseFloat(n);
    return '₪' + Math.abs(num).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalRake = rows.reduce((s, r) => s + parseFloat(r.totalRake || 0), 0);
  const totalHands = rows.reduce((s, r) => s + parseInt(r.totalHands || 0), 0);

  return (
    <div>
      <h1>Club Income</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ color: '#64748b', fontSize: '0.85rem' }}>From:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ background: '#0f1117', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }} />
          <label style={{ color: '#64748b', fontSize: '0.85rem' }}>To:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ background: '#0f1117', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }} />
          <button className="btn btn-primary" onClick={() => load(dateFrom, dateTo)} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>

        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: '2rem', padding: '0.75rem 1rem', background: '#1a1d2e', borderRadius: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Sessions: <strong style={{ color: '#e2e8f0' }}>{rows.length}</strong>
            </span>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Total Hands: <strong style={{ color: '#e2e8f0' }}>{totalHands.toLocaleString()}</strong>
            </span>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Total Rake: <strong style={{ color: '#f59e0b', fontSize: '1rem' }}>{fmt(totalRake)}</strong>
            </span>
          </div>
        )}

        {rows.length === 0 && !loading ? (
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
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {fmtDisplay(r.startTime)}
                    </td>
                    <td style={{ unicodeBidi: 'bidi-override', direction: 'ltr' }}>{r.tableName || '—'}</td>
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
