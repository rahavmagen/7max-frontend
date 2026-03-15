import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function BalanceLog() {
  const [mismatches, setMismatches] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = sessionStorage.getItem('balanceMismatches');
    if (stored) {
      try { setMismatches(JSON.parse(stored)); } catch {}
    }
  }, []);

  const fmt = (n) => {
    if (n === undefined || n === null) return '₪0';
    const num = Number(n);
    const abs = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (num < 0 ? '-' : '') + '₪' + abs;
  };

  const cls = (n) => Number(n) > 0 ? 'positive' : Number(n) < 0 ? 'negative' : 'zero';

  return (
    <div>
      <div className="page-header">
        <h1>Balance Log</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/upload')}>← Back to Upload</button>
      </div>

      {mismatches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✓</div>
          <div>No balance mismatches on record.</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Mismatches appear here when an upload fails validation.</div>
        </div>
      ) : (
        <>
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            Last upload was rejected: <strong>{mismatches.length} player(s)</strong> had balance mismatches.
            The file was NOT saved. Fix the discrepancies and re-upload.
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Prev Chips</th>
                    <th>Game P&L</th>
                    <th>Send Out</th>
                    <th>Claim Back</th>
                    <th>Expected</th>
                    <th>Actual</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((m, i) => (
                    <tr key={i}>
                      <td><strong>{m.username}</strong></td>
                      <td className="neutral">{fmt(m.previousChips)}</td>
                      <td className={cls(m.gamePnl)}>{fmt(m.gamePnl)}</td>
                      <td className="positive">{fmt(m.sendOut)}</td>
                      <td className="negative">{fmt(m.claimBack)}</td>
                      <td className="neutral">{fmt(m.expectedChips)}</td>
                      <td className="neutral">{fmt(m.actualChips)}</td>
                      <td className={cls(m.difference)}><strong>{fmt(m.difference)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card" style={{ background: '#1a1d2e', fontSize: '0.85rem', color: '#64748b', lineHeight: '1.8' }}>
            <div><strong style={{ color: '#94a3b8' }}>Formula:</strong> Previous Chips + Game P&L + Send Out − Claim Back = Expected</div>
            <div><strong style={{ color: '#94a3b8' }}>Send Out</strong> — player received chips from club (positive)</div>
            <div><strong style={{ color: '#94a3b8' }}>Claim Back</strong> — player returned chips to club (negative)</div>
          </div>
        </>
      )}
    </div>
  );
}
