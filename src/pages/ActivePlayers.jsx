import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActivePlayers, getMyActivity } from '../api';
import { useLang } from '../i18n';
import { useAuth } from '../auth/AuthContext';

export default function ActivePlayers() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [showChipless, setShowChipless] = useState(false);   // default: hide players with no chips
  const [locked, setLocked] = useState(false);   // inactive players can't view the names list
  const navigate = useNavigate();
  const { t } = useLang();
  const { auth } = useAuth();

  useEffect(() => {
    const isPlayer = auth?.role === 'PLAYER';
    // Only active players (a game in the last month) may view the names list. Admins/managers always can.
    const load = () => getActivePlayers().then(r => setPlayers(r.data));   // all players; chips filter is client-side
    if (isPlayer) {
      getMyActivity()
        .then(r => { if (r.data?.active) load(); else setLocked(true); })
        .catch(() => setLocked(true));
    } else {
      load();
    }
  }, [auth]);

  if (locked) {
    return (
      <div>
        <h1 style={{ marginTop: 0 }}>{t('playersTitle')}</h1>
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
          <p dir="rtl" style={{ color: '#94a3b8', fontSize: '1.05rem', margin: 0, lineHeight: 1.6 }}>
            {t('playersActiveOnly')}
          </p>
        </div>
      </div>
    );
  }

  const filtered = players.filter(p => {
    const matchesSearch =
      p.username.toLowerCase().includes(search.toLowerCase()) ||
      (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (p.agentUsername && p.agentUsername.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch && (showChipless || p.hasChips);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>{t('playersTitle')}</h1>
        <a href="/takanon.docx" download className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: '0.875rem' }}>📄 {t('clubRules')}</a>
      </div>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        {t('playersHoldingChips')}
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', width: '260px' }}
          />
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {filtered.length} {t('playersWord')}
          </span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', marginLeft: 'auto' }}>
            <input type="checkbox" checked={showChipless} onChange={e => setShowChipless(e.target.checked)} style={{ cursor: 'pointer' }} />
            {t('showChipless')}
          </label>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>{t('noPlayers')}</div>
        ) : (
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>{t('colUsername')}</th>
                <th>{t('colFullName')}</th>
                <th>{t('colAgent')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={i} style={{ cursor: p.id ? 'pointer' : 'default' }} onClick={() => p.id && navigate(`/player/${p.id}`)}>
                  <td style={{ fontWeight: 600, color: '#a5b4fc' }}>{p.username}</td>
                  <td dir="rtl" style={{ textAlign: 'right', color: '#94a3b8' }}>{p.fullName || '—'}</td>
                  <td style={{ color: '#34d399', fontSize: '0.85rem' }}>{p.agentUsername || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
