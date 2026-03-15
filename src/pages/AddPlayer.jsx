import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPlayer, updateCredit, addDeposit } from '../api';

export default function AddPlayer() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    username: '', fullName: '', phone: '', clubPlayerId: '',
    initialCredit: '', initialDeposit: ''
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        username: form.username,
        fullName: form.fullName,
        phone: form.phone,
        clubPlayerId: form.clubPlayerId,
        creditTotal: form.initialCredit ? Number(form.initialCredit) : 0,
        balance: 0,
        active: true
      };
      const res = await createPlayer(payload);
      const playerId = res.data.id;

      if (form.initialDeposit && Number(form.initialDeposit) > 0) {
        await addDeposit(playerId, Number(form.initialDeposit), 'Initial deposit');
      }

      setMsg({ type: 'success', text: 'Player created!' });
      setTimeout(() => navigate(`/player/${playerId}`), 1000);
    } catch {
      setMsg({ type: 'error', text: 'Failed to create player. Username might already exist.' });
    }
  };

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
      </div>
      <h1>Add New Player</h1>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>ClubGG Username *</label>
              <input required value={form.username} onChange={e => set('username', e.target.value)} placeholder="e.g. liorar" />
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="e.g. לירון" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="050-0000000" />
            </div>
            <div className="form-group">
              <label>ClubGG Player ID</label>
              <input value={form.clubPlayerId} onChange={e => set('clubPlayerId', e.target.value)} placeholder="e.g. 2163-3811" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Initial Credit (₪)</label>
              <input type="number" min="0" step="0.01" value={form.initialCredit}
                onChange={e => set('initialCredit', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Initial Deposit (₪)</label>
              <input type="number" min="0" step="0.01" value={form.initialDeposit}
                onChange={e => set('initialDeposit', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Create Player</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
