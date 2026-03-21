import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPlayers, comparePlayersWithXls, resetAllData } from '../api';

export default function Import() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const fileRef = useRef();

  const handleImport = async () => {
    if (!file) {
      setMsg({ type: 'error', text: 'Please select the max7 xlsx file' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await importPlayers(file, false);
      if (res.data.error) {
        setMsg({ type: 'error', text: res.data.error });
      } else {
        setMsg({
          type: 'success',
          text: `Import complete! Created: ${res.data.created}, Updated: ${res.data.updated}, Total: ${res.data.total}`
        });
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Import failed: ' + (e.response?.data?.error || e.message) });
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!confirm('Delete ALL players, reports, sessions, results and transactions? This cannot be undone.')) return;
    try {
      await resetAllData();
      setMsg({ type: 'success', text: 'All data deleted. Ready for fresh import.' });
      setCompareResult(null);
    } catch (e) {
      setMsg({ type: 'error', text: 'Reset failed: ' + (e.response?.data?.error || e.message) });
    }
  };

  const handleCompare = async () => {
    if (!file) {
      setMsg({ type: 'error', text: 'Please select the max7 xlsx file first' });
      return;
    }
    setComparing(true);
    setCompareResult(null);
    setMsg(null);
    try {
      const res = await comparePlayersWithXls(file);
      setCompareResult(res.data);
    } catch (e) {
      setMsg({ type: 'error', text: 'Compare failed: ' + (e.response?.data?.error || e.message) });
    }
    setComparing(false);
  };

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
      </div>
      <h1>Import Players</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Upload the max7 management file to import players, credits, and contact info.
        Current chips are set via the Upload Report page.
      </p>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>max7 Management File (any .xlsx)</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Must contain: <strong>מעקב יוזרים</strong> (players) and <strong>מעקב קרדיטים</strong> (credits) tabs
        </p>
        <div
          className="upload-area"
          style={{ padding: '1.5rem' }}
          onClick={() => fileRef.current.click()}
        >
          {file
            ? <div className="positive">✓ {file.name}</div>
            : <div style={{ color: '#64748b' }}>Click to select xlsx file</div>
          }
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files[0]); setCompareResult(null); }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: '1rem', padding: '0.7rem 2rem' }}
          onClick={handleImport}
          disabled={loading || comparing || !file}
        >
          {loading ? 'Importing...' : '⬆ Import Players'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleCompare}
          disabled={loading || comparing || !file}
        >
          {comparing ? 'Comparing...' : '🔍 Compare XLS vs DB'}
        </button>

        <button
          onClick={handleReset}
          style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          🗑 Reset All Data
        </button>

        {msg?.type === 'success' && (
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Go to Dashboard →
          </button>
        )}
      </div>

      {compareResult && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2>Comparison Result</h2>
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8' }}>XLS total rows: <strong style={{ color: '#e2e8f0' }}>{compareResult.xlsCount}</strong></span>
            <span style={{ color: '#94a3b8' }}>XLS unique: <strong style={{ color: '#e2e8f0' }}>{compareResult.xlsUniqueCount}</strong></span>
            <span style={{ color: '#94a3b8' }}>DB players: <strong style={{ color: '#e2e8f0' }}>{compareResult.dbCount}</strong></span>
          </div>

          {compareResult.xlsDuplicates?.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#f59e0b', marginBottom: '0.5rem' }}>Duplicate rows in XLS ({compareResult.xlsDuplicates.length})</h3>
              <table>
                <thead><tr><th>Row</th><th>Username</th><th>Full Name</th><th>Club ID</th><th>Reason</th></tr></thead>
                <tbody>
                  {compareResult.xlsDuplicates.map((p, i) => (
                    <tr key={i}>
                      <td style={{ color: '#64748b' }}>{p.row}</td>
                      <td style={{ color: '#f59e0b' }}><strong>{p.username}</strong></td>
                      <td>{p.fullName || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.clubPlayerId || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: '#f59e0b' }}>{p.dupReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {compareResult.missingFromDb?.length === 0 ? (
            <div style={{ color: '#22c55e', padding: '1rem 0' }}>✓ All XLS players found in DB</div>
          ) : (
            <div>
              <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>In XLS but missing from DB ({compareResult.missingFromDb.length})</h3>
              <table>
                <thead><tr><th>Row</th><th>Username</th><th>Full Name</th><th>Club ID</th></tr></thead>
                <tbody>
                  {compareResult.missingFromDb.map((p, i) => (
                    <tr key={i}>
                      <td style={{ color: '#64748b' }}>{p.row}</td>
                      <td style={{ color: '#ef4444' }}><strong>{p.username}</strong></td>
                      <td>{p.fullName || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.clubPlayerId || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>What gets imported</h2>
        <table>
          <thead>
            <tr><th>Field</th><th>Source</th></tr>
          </thead>
          <tbody>
            <tr><td>Username</td><td>מעקב יוזרים col A</td></tr>
            <tr><td>Full Name</td><td>מעקב יוזרים col B</td></tr>
            <tr><td>Phone</td><td>מעקב יוזרים col C</td></tr>
            <tr><td>Club ID</td><td>מעקב יוזרים col D</td></tr>
            <tr><td>Credit Total</td><td>מעקב קרדיטים (sum of רועי + יאיר + אורי)</td></tr>
            <tr><td>Current Chips</td><td>Set via Upload Report → Club Member Balance</td></tr>
            <tr><td>P&L (Balance)</td><td>Current Chips − Credit Total</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
