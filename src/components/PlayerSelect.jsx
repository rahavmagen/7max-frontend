import { useState, useEffect, useRef } from 'react';

export default function PlayerSelect({ label, value, onChange, players, bankAccounts = [], excludeId, includeClub = false, includeExternal = false }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isBankValue = typeof value === 'string' && value.startsWith('BANK_');
  const bankId = isBankValue ? parseInt(value.slice(5)) : null;
  const selectedBank = bankAccounts.find(b => b.id === bankId);
  const selectedPlayer = !isBankValue && value !== 'CLUB' && value !== 'EXTERNAL' ? players.find(p => p.id === value) : null;
  const displayText = value === 'CLUB' ? 'CLUB'
    : value === 'EXTERNAL' ? '🤝 External Entity'
    : selectedBank ? `🏦 ${selectedBank.name}`
    : selectedPlayer ? (selectedPlayer.username + (selectedPlayer.fullName ? ` — ${selectedPlayer.fullName}` : ''))
    : '';

  const filteredPlayers = players.filter(p =>
    p.id !== excludeId &&
    (search === '' ||
      p.username.toLowerCase().includes(search.toLowerCase()) ||
      (p.fullName && p.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.includes(search)))
  );

  const filteredBanks = bankAccounts.filter(b =>
    search === '' || b.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (val) => { onChange(val); setOpen(false); setSearch(''); };

  return (
    <div className="form-group" ref={ref} style={{ position: 'relative' }}>
      <label>{label}</label>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: value ? '#e2e8f0' : '#64748b', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', minHeight: '36px' }}
      >
        {value ? displayText : `Select ${label}...`}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: '6px', zIndex: 100, maxHeight: '260px', overflowY: 'auto' }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', background: '#0f1117', border: 'none', borderBottom: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', boxSizing: 'border-box' }}
            onClick={e => e.stopPropagation()}
          />
          {includeClub && (
            <div onClick={() => handleSelect('CLUB')} style={{ padding: '8px 12px', cursor: 'pointer', fontWeight: 600, color: '#f59e0b', borderBottom: '1px solid #2d3148' }}>
              CLUB
            </div>
          )}
          {includeExternal && (
            <div onClick={() => handleSelect('EXTERNAL')} style={{ padding: '8px 12px', cursor: 'pointer', fontWeight: 600, color: '#a78bfa', borderBottom: '1px solid #2d3148' }}>
              🤝 External Entity
            </div>
          )}
          {filteredBanks.length > 0 && (
            <>
              <div style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#64748b', background: '#12151f', borderBottom: '1px solid #2d3148' }}>
                חשבון בנק
              </div>
              {filteredBanks.map(b => (
                <div key={`bank-${b.id}`} onClick={() => handleSelect(`BANK_${b.id}`)}
                  style={{ padding: '8px 12px', cursor: 'pointer', color: '#34d399', borderBottom: '1px solid #1a1d2e' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2d3148'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🏦 <strong>{b.name}</strong>{b.accountNumber ? <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{b.accountNumber}</span> : null}
                </div>
              ))}
            </>
          )}
          {filteredPlayers.length > 0 && (
            <>
              <div style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#64748b', background: '#12151f', borderBottom: '1px solid #2d3148' }}>
                שחקנים
              </div>
              {filteredPlayers.map(p => (
                <div key={p.id} onClick={() => handleSelect(p.id)}
                  style={{ padding: '8px 12px', cursor: 'pointer', color: '#e2e8f0', borderBottom: '1px solid #1a1d2e' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2d3148'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <strong>{p.username}</strong>{p.fullName ? <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>{p.fullName}</span> : null}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
