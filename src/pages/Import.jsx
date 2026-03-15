import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPlayers } from '../api';

export default function Import() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef();

  const handleImport = async () => {
    if (!file) {
      setMsg({ type: 'error', text: 'Please select the max7 xlsx file' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await importPlayers(file, clearExisting);
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
            onChange={e => setFile(e.target.files[0])} />
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', color: '#94a3b8' }}>
          <input
            type="checkbox"
            checked={clearExisting}
            onChange={e => setClearExisting(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span>
            <strong style={{ color: '#f87171' }}>Replace existing players</strong>
            <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem', color: '#64748b' }}>
              — deletes all current players before importing
            </span>
          </span>
        </label>
      </div>

      <button
        className="btn btn-primary"
        style={{ fontSize: '1rem', padding: '0.7rem 2rem' }}
        onClick={handleImport}
        disabled={loading || !file}
      >
        {loading ? 'Importing...' : '⬆ Import Players'}
      </button>

      {msg?.type === 'success' && (
        <button className="btn btn-secondary" style={{ marginLeft: '1rem' }} onClick={() => navigate('/')}>
          Go to Dashboard →
        </button>
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
