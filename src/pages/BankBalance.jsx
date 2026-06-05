import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBankHistory, getProfitSummary } from '../api';
import DateInput from '../components/DateInput';
import { fmtDateTime } from '../utils/dates';

const fmt = (n) => {
  if (n === undefined || n === null) return '₪0';
  const abs = Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₪${abs}`;
};

export default function BankBalance() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    Promise.all([getBankHistory(), getProfitSummary()]).then(([histRes, summRes]) => {
      setRows(histRes.data.rows || []);
      setTotal(summRes.data?.bankDeposits || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r =>
    (!filterFrom || !r.date || r.date >= filterFrom) &&
    (!filterTo || !r.date || r.date <= filterTo)
  );

  const Name = ({ id, name }) => id
    ? <span style={{ color: '#a5b4fc', cursor: 'pointer' }} onClick={() => navigate(`/player/${id}`)}>{name}</span>
    : <span style={{ color: '#64748b' }}>{name}</span>;

  // Start from current total, subtract each delta going newest→oldest
  let running = Number(total);

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>Bank Balance</h2>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#22c55e' }}>{fmt(total)}</span>
        </div>

        {/* Date filter */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Filter:</span>
          <DateInput value={filterFrom} onChange={setFilterFrom} />
          <span style={{ color: '#64748b' }}>→</span>
          <DateInput value={filterTo} onChange={setFilterTo} />
          {(filterFrom || filterTo) && (
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); }}
              style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr style={{ color: '#64748b' }}>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Date</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Transfer</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Method</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Notes</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Created By</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Amount</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Running Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  running -= Number(r.delta);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #1e293b' }}>
                      <td style={{ color: '#64748b', paddingTop: '0.4rem', whiteSpace: 'nowrap' }}>
                        <div>{r.date || '—'}</div>
                        {r.createdAt && <div style={{ fontSize: '0.75rem', color: '#475569' }}>{fmtDateTime(r.createdAt)}</div>}
                      </td>
                      <td style={{ paddingTop: '0.4rem' }}>
                        <Name id={r.fromPlayerId} name={r.fromName} />
                        <span style={{ color: '#475569', margin: '0 0.3rem' }}>→</span>
                        <Name id={r.toPlayerId} name={r.toName} />
                      </td>
                      <td style={{ color: '#64748b', paddingTop: '0.4rem' }}>{r.method || '—'}</td>
                      <td style={{ color: '#475569', paddingTop: '0.4rem', fontSize: '0.8rem', maxWidth: '200px' }}>{r.notes || ''}</td>
                      <td style={{ color: '#94a3b8', paddingTop: '0.4rem', fontSize: '0.85rem' }}>{r.createdBy || '—'}</td>
                      <td style={{ textAlign: 'right', paddingTop: '0.4rem' }} className={Number(r.delta) >= 0 ? 'positive' : 'negative'}>
                        {Number(r.delta) >= 0 ? fmt(r.delta) : `(${fmt(Math.abs(r.delta))})`}
                      </td>
                      <td style={{ textAlign: 'right', paddingTop: '0.4rem', color: '#e2e8f0' }}>{fmt(running)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
