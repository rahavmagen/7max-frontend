import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Import() {
  const navigate = useNavigate();
  const [max7File, setMax7File] = useState(null);
  const [balanceFile, setBalanceFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const max7Ref = useRef();
  const balanceRef = useRef();

  const handleImport = async () => {
    if (!max7File) {
      setMsg({ type: 'error', text: 'Please select the max7.xlsx file' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('max7', max7File);
      if (balanceFile) form.append('balance', balanceFile);
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'https://7max-tracker-production.up.railway.app/api'}/import/players`, form);
      setMsg({
        type: 'success',
        text: `Import complete! Created: ${res.data.created}, Updated: ${res.data.updated}, Total: ${res.data.total}`
      });
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
        Upload both files to import players with their balances, credits, and contact info.
      </p>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h2>1. max7.xlsx (ניהול)</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Contains player list (מעקב יוזרים) and credits (מעקב קרדיטים)
          </p>
          <div
            className="upload-area"
            style={{ padding: '1.5rem' }}
            onClick={() => max7Ref.current.click()}
          >
            {max7File
              ? <div className="positive">✓ {max7File.name}</div>
              : <div style={{ color: '#64748b' }}>Click to select max7.xlsx</div>
            }
            <input ref={max7Ref} type="file" accept=".xlsx" style={{ display: 'none' }}
              onChange={e => setMax7File(e.target.files[0])} />
          </div>
        </div>

        <div className="card">
          <h2>2. ClubGG Balance File (770299...)</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Contains Club Member Balance tab with current chips
          </p>
          <div
            className="upload-area"
            style={{ padding: '1.5rem' }}
            onClick={() => balanceRef.current.click()}
          >
            {balanceFile
              ? <div className="positive">✓ {balanceFile.name}</div>
              : <div style={{ color: '#64748b' }}>Click to select ClubGG file</div>
            }
            <input ref={balanceRef} type="file" accept=".xlsx" style={{ display: 'none' }}
              onChange={e => setBalanceFile(e.target.files[0])} />
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ fontSize: '1rem', padding: '0.7rem 2rem' }}
        onClick={handleImport}
        disabled={loading || !max7File}
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
            <tr><td>Username</td><td>max7.xlsx → מעקב יוזרים col A</td></tr>
            <tr><td>Full Name</td><td>max7.xlsx → מעקב יוזרים col B</td></tr>
            <tr><td>Phone</td><td>max7.xlsx → מעקב יוזרים col C</td></tr>
            <tr><td>Club ID</td><td>max7.xlsx → מעקב יוזרים col D</td></tr>
            <tr><td>Credit Total</td><td>max7.xlsx → מעקב קרדיטים (sum of רועי + יאיר + אורי)</td></tr>
            <tr><td>Current Chips</td><td>ClubGG file → Club Member Balance tab</td></tr>
            <tr><td>P&L (Balance)</td><td>Current Chips − Credit Total</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
