import { useState, useEffect } from 'react';
import { getPlayers, sendWhatsAppMessage } from '../api';

const TEMPLATES = [
  { label: 'Game Invitation', text: 'Game this Thursday at 9pm — please confirm your attendance.' },
  { label: 'Balance Reminder', text: 'Reminder: your balance is outstanding, please settle.' },
  { label: 'Game Cancelled', text: 'The game has been cancelled / postponed. We will update you soon.' },
  { label: 'Game Confirmed', text: 'The game is confirmed for this week. See you there!' },
  { label: 'Custom...', text: '' },
];

export default function WhatsAppMessages() {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filterDir, setFilterDir] = useState('>');
  const [filterAmt, setFilterAmt] = useState('');
  const [sortCol, setSortCol] = useState('username');
  const [sortDir, setSortDir] = useState(1);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [templateIdx, setTemplateIdx] = useState(null);
  const [adhocName, setAdhocName] = useState('');
  const [adhocPhone, setAdhocPhone] = useState('');
  const [adhocList, setAdhocList] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => { getPlayers().then(r => setPlayers(r.data)); }, []);

  const amt = parseFloat(filterAmt) || 0;
  const filtered = players.filter(p => {
    const b = p.balance || 0;
    const passFilter = amt === 0 || (filterDir === '>' ? b > amt : b < -amt);
    const passSearch = !search || p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.fullName?.toLowerCase().includes(search.toLowerCase());
    return passFilter && passSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortCol === 'username') return (a.username || '').localeCompare(b.username || '') * sortDir;
    if (sortCol === 'fullName') return (a.fullName || '').localeCompare(b.fullName || '') * sortDir;
    return ((a.balance || 0) - (b.balance || 0)) * sortDir;
  });

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(1); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '';

  const togglePlayer = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(sorted.map(p => p.id)));
  const selectAllNegative = () => setSelected(new Set(players.filter(p => (p.balance || 0) < 0).map(p => p.id)));
  const clearAll = () => setSelected(new Set());

  const addAdhoc = () => {
    if (!adhocPhone.trim()) return;
    setAdhocList(prev => [...prev, { id: `adhoc-${Date.now()}`, username: adhocName || adhocPhone, phone: adhocPhone }]);
    setAdhocName('');
    setAdhocPhone('');
  };
  const removeAdhoc = (id) => setAdhocList(prev => prev.filter(a => a.id !== id));

  const selectedPlayers = players.filter(p => selected.has(p.id));
  const allRecipients = [...selectedPlayers, ...adhocList];
  const recipientCount = allRecipients.length;

  const applyTemplate = (idx) => {
    setTemplateIdx(idx);
    setMessage(TEMPLATES[idx].text);
  };

  const handleSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setResult(null);
    try {
      const phones = allRecipients.map(r => r.phone).filter(Boolean);
      const res = await sendWhatsAppMessage(phones, message);
      setResult(res.data);
      if (!res.data?.error) {
        setSelected(new Set());
        setAdhocList([]);
      }
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setSending(false);
    }
  };

  const fmt = (n) => {
    if (!n && n !== 0) return '—';
    const abs = Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (n < 0 ? '-' : '') + '₪' + abs;
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#e2e8f0' }}>WhatsApp Messages</h2>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

        <div style={{ flex: '1', background: '#1e2235', borderRadius: '10px', padding: '1rem', minWidth: 0 }}>
          <h3 style={{ color: '#94a3b8', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>Recipients</h3>

          <input
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>|balance|</span>
            <select
              value={filterDir}
              onChange={e => setFilterDir(e.target.value)}
              style={{ ...inputStyle, width: '60px', marginBottom: 0, padding: '4px 6px' }}
            >
              <option value=">">{'>'}</option>
              <option value="<">{'<'}</option>
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={filterAmt}
              onChange={e => setFilterAmt(e.target.value)}
              style={{ ...inputStyle, width: '90px', marginBottom: 0 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {[['All', selectAll], ['All Negative', selectAllNegative], ['Clear', clearAll]].map(([label, fn]) => (
              <button key={label} onClick={fn} style={btnSecondary}>{label}</button>
            ))}
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid #2d3148', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#161929', color: '#94a3b8' }}>
                  <th style={{ width: '32px', padding: '6px' }}></th>
                  <th style={{ padding: '6px', textAlign: 'left', cursor: 'pointer' }} onClick={() => toggleSort('username')}>
                    Username{arrow('username')}
                  </th>
                  <th style={{ padding: '6px', textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('balance')}>
                    Balance{arrow('balance')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    style={{
                      cursor: 'pointer',
                      background: selected.has(p.id) ? '#1a2744' : 'transparent',
                      borderBottom: '1px solid #2d3148',
                    }}
                  >
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => togglePlayer(p.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td style={{ padding: '6px', color: '#e2e8f0' }}>
                      {p.username}
                      {p.fullName && <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '0.8rem' }}>{p.fullName}</span>}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: (p.balance || 0) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {fmt(p.balance)}
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>No players match filter</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#161929', borderRadius: '6px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Send to unlisted number</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input placeholder="Name (optional)" value={adhocName} onChange={e => setAdhocName(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: '1', minWidth: '100px' }} />
              <input placeholder="Phone e.g. 972501234567" value={adhocPhone} onChange={e => setAdhocPhone(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: '1', minWidth: '130px' }} />
              <button onClick={addAdhoc} style={btnSecondary}>Add</button>
            </div>
            {adhocList.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', color: '#e2e8f0', fontSize: '0.85rem' }}>
                <span>{a.username} — {a.phone}</span>
                <button onClick={() => removeAdhoc(a.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '0.75rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            {recipientCount} recipient{recipientCount !== 1 ? 's' : ''} selected
          </div>
        </div>

        <div style={{ width: '360px', background: '#1e2235', borderRadius: '10px', padding: '1rem', flexShrink: 0 }}>
          <h3 style={{ color: '#94a3b8', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>Message</h3>

          <label style={labelStyle}>Template</label>
          <select
            value={templateIdx ?? ''}
            onChange={e => applyTemplate(Number(e.target.value))}
            style={{ ...inputStyle }}
          >
            <option value="">— Select template —</option>
            {TEMPLATES.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
          </select>

          <label style={labelStyle}>Message</label>
          <textarea
            rows={8}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message here..."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />

          <button
            onClick={() => setShowConfirm(true)}
            disabled={sending || recipientCount === 0 || !message.trim()}
            style={{
              ...btnPrimary,
              width: '100%',
              opacity: (sending || recipientCount === 0 || !message.trim()) ? 0.5 : 1,
            }}
          >
            {sending ? 'Sending...' : `Send to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
          </button>

          {result && !result.error && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '6px', background: result.failCount > 0 ? '#422006' : '#14532d', color: result.failCount > 0 ? '#fdba74' : '#86efac', fontSize: '0.85rem' }}>
              ✓ Sent to {result.successCount} players
              {result.failCount > 0 && ` — ${result.failCount} failed: ${result.failedNumbers.join(', ')}`}
            </div>
          )}
          {result?.error && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '6px', background: '#422006', color: '#fdba74', fontSize: '0.85rem' }}>
              Error: {result.error}
            </div>
          )}
        </div>
      </div>

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e2235', borderRadius: '10px', padding: '2rem', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Confirm Send</h3>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
              Sending to <strong style={{ color: '#e2e8f0' }}>{recipientCount} recipient{recipientCount !== 1 ? 's' : ''}</strong> via WhatsApp. Continue?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfirm(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleSend} style={btnPrimary}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  background: '#0f1120',
  border: '1px solid #2d3148',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '0.85rem',
  marginBottom: '0.75rem',
  boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block',
  color: '#94a3b8',
  fontSize: '0.8rem',
  marginBottom: '0.3rem',
};
const btnPrimary = {
  padding: '8px 18px',
  background: '#25d366',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
};
const btnSecondary = {
  padding: '5px 12px',
  background: '#2d3148',
  color: '#94a3b8',
  border: '1px solid #3d4168',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.82rem',
};
