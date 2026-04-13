import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPlayers, resetAllData } from '../api';

export default function Import() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [newPlayers, setNewPlayers] = useState(null);
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
        setNewPlayers(null);
      } else {
        setMsg({ type: 'success', text: `Import complete! Created: ${res.data.created}, Updated: ${res.data.updated}, Total: ${res.data.total}` });
        setNewPlayers(res.data.newPlayers?.length ? res.data.newPlayers : null);
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Import failed: ' + (e.response?.data?.error || e.message) });
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!confirm('DELETE ALL DATA? This will remove all players, reports, transactions, transfers and expenses. Admin user will be kept. This cannot be undone.')) return;
    setResetting(true);
    setMsg(null);
    try {
      await resetAllData();
      setMsg({ type: 'success', text: 'All data cleared. Admin user kept.' });
    } catch (e) {
      setMsg({ type: 'error', text: 'Reset failed: ' + (e.response?.data?.error || e.message) });
    }
    setResetting(false);
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
      {newPlayers && (
        <div style={{ background: '#1a2035', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
          <strong style={{ color: '#f59e0b' }}>⚠️ {newPlayers.length} new player{newPlayers.length > 1 ? 's' : ''} created — verify these are not duplicates:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.2rem', color: '#e2e8f0', fontSize: '0.9rem' }}>
            {newPlayers.map(name => <li key={name}>{name}</li>)}
          </ul>
        </div>
      )}

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
            onChange={e => setFile(e.target.files[0])} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: '1rem', padding: '0.7rem 2rem' }}
          onClick={handleImport}
          disabled={loading || !file}
        >
          {loading ? 'Importing...' : '⬆ Import Players'}
        </button>

        {msg?.type === 'success' && (
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Go to Dashboard →
          </button>
        )}
      </div>

      {import.meta.env.DEV && (
        <div className="card" style={{ marginTop: '2rem', borderColor: '#ef4444' }}>
          <h2 style={{ color: '#ef4444' }}>Danger Zone</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Delete all data and start fresh. Admin user will be kept.
          </p>
          <button
            className="btn"
            style={{ background: '#ef4444', color: '#fff', border: 'none' }}
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? 'Resetting...' : '🗑 Reset All Data'}
          </button>
        </div>
      )}

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>What gets imported</h2>
        <div className="table-wrap"><table>
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
            <tr><td>Profit / Loss</td><td>Current Chips − Credit Total</td></tr>
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
