import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers, createReferral, getReferrals, deleteReferral } from '../api';
import { fmtDateTime } from '../utils/dates';

export default function BringAFriend() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ referrerPlayerId: '', newPlayerName: '', newPlayerPhone: '', depositAmount: '' });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPlayers().then(r => setPlayers(r.data));
    getReferrals().then(r => setReferrals(r.data));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const filteredPlayers = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedPlayer = players.find(p => p.id === Number(form.referrerPlayerId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.referrerPlayerId) { setMsg({ type: 'error', text: 'Please select a referring player' }); return; }
    if (!form.newPlayerName.trim()) { setMsg({ type: 'error', text: 'New player name is required' }); return; }
    if (!form.newPlayerPhone.trim()) { setMsg({ type: 'error', text: 'New player phone is required' }); return; }
    setLoading(true);
    setMsg(null);
    try {
      const payload = {
        referrerPlayerId: Number(form.referrerPlayerId),
        newPlayerName: form.newPlayerName.trim(),
        newPlayerPhone: form.newPlayerPhone.trim(),
        depositAmount: form.depositAmount ? Number(form.depositAmount) : null,
      };
      await createReferral(payload);
      setMsg({ type: 'success', text: 'Referral recorded!' });
      setForm({ referrerPlayerId: '', newPlayerName: '', newPlayerPhone: '', depositAmount: '' });
      setSearch('');
      const updated = await getReferrals();
      setReferrals(updated.data);
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed: ' + (e.response?.data?.error || e.message) });
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this referral record?')) return;
    await deleteReferral(id);
    setReferrals(r => r.filter(x => x.id !== id));
  };

  const fmtDate = fmtDateTime;

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
      </div>
      <h1>Bring a Friend</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Record a player referral — select the referring player and enter the new player's details.
      </p>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ maxWidth: 600, marginBottom: '2rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Referring Player *</label>
            <input
              placeholder="Search by username or name..."
              value={search}
              onChange={e => { setSearch(e.target.value); set('referrerPlayerId', ''); }}
              style={{ marginBottom: '0.5rem' }}
            />
            {search && !selectedPlayer && (
              <div style={{ border: '1px solid #2d3148', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', background: '#0f1117' }}>
                {filteredPlayers.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.9rem' }}>No players found</div>
                ) : filteredPlayers.slice(0, 20).map(p => (
                  <div
                    key={p.id}
                    onClick={() => { set('referrerPlayerId', p.id); setSearch(p.username + (p.fullName ? ` (${p.fullName})` : '')); }}
                    style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid #1e2235', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                    className="hoverable-row"
                  >
                    <strong style={{ color: '#e2e8f0' }}>{p.username}</strong>
                    {p.fullName && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{p.fullName}</span>}
                  </div>
                ))}
              </div>
            )}
            {selectedPlayer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px' }}>
                <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{selectedPlayer.username}</span>
                {selectedPlayer.fullName && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{selectedPlayer.fullName}</span>}
                <button type="button" onClick={() => { set('referrerPlayerId', ''); setSearch(''); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>New Player Name *</label>
              <input
                required
                value={form.newPlayerName}
                onChange={e => set('newPlayerName', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="form-group">
              <label>New Player Phone *</label>
              <input
                required
                value={form.newPlayerPhone}
                onChange={e => set('newPlayerPhone', e.target.value)}
                placeholder="050-0000000"
              />
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: '200px' }}>
            <label>Deposit Amount (₪)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.depositAmount}
              onChange={e => set('depositAmount', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || !form.referrerPlayerId}>
            {loading ? 'Saving...' : '✓ Record Referral'}
          </button>
        </form>
      </div>

      {referrals.length > 0 && (
        <div className="card">
          <h2>Referral History</h2>
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Referring Player</th>
                <th>New Player</th>
                <th>Phone</th>
                <th>Deposit</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {referrals.map(r => (
                <tr key={r.id}>
                  <td>
                    <span
                      style={{ color: '#a5b4fc', cursor: 'pointer' }}
                      onClick={() => navigate(`/player/${r.referrerPlayerId}`)}
                    >
                      {r.referrerUsername}
                    </span>
                    {r.referrerFullName && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '6px' }}>{r.referrerFullName}</span>}
                  </td>
                  <td><strong>{r.newPlayerName}</strong></td>
                  <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{r.newPlayerPhone}</td>
                  <td style={{ color: r.depositAmount ? '#22c55e' : '#64748b' }}>
                    {r.depositAmount ? `₪${Number(r.depositAmount).toLocaleString()}` : '—'}
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{fmtDate(r.createdAt)}</td>
                  <td>
                    <button
                      onClick={() => handleDelete(r.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
