import { useState, useEffect } from 'react';
import { getActivePlayers } from '../api';

export default function ActivePlayers() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getActivePlayers().then(r => setPlayers(r.data));
  }, []);

  const filtered = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Active Players</h1>
        <a href="/takanon.docx" download className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: '0.875rem' }}>📄 תקנון המועדון</a>
      </div>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Players who participated in at least one game in the last 30 days.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username or name..."
            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', width: '260px' }}
          />
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {filtered.length} player{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No players found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{p.username}</td>
                  <td dir="rtl" style={{ textAlign: 'right', color: '#94a3b8' }}>{p.fullName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
