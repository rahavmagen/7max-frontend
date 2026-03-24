import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers, createSettlement } from '../api';

const METHODS = ['BIT', 'PAYBOX', 'KASHCASH', 'BANK_TRANSFER', 'CASH', 'OTHER'];
const METHOD_LABELS = { BIT: 'Bit', PAYBOX: 'PayBox', KASHCASH: 'KashCash', BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash', OTHER: 'Other' };

const STATUS_ORDER = ['pending', 'notify', 'waiting', 'complete', 'clean'];
const STATUS_LABELS = { pending: 'Pending', notify: 'Notified', waiting: 'Waiting', complete: 'Complete', clean: 'Clean' };
const STATUS_COLORS = { pending: '#64748b', notify: '#f59e0b', waiting: '#3b82f6', complete: '#22c55e', clean: '#475569' };

function calculateSettlements(players, minPayment) {
  const mp = parseFloat(minPayment) || 1;
  const winners = players
    .filter(p => (p.balance || 0) > 0)
    .map(p => ({ ...p, rem: p.balance }))
    .sort((a, b) => b.rem - a.rem);
  const losers = players
    .filter(p => (p.balance || 0) < 0)
    .map(p => ({ ...p, rem: p.balance }))
    .sort((a, b) => a.rem - b.rem);

  const settlements = [];
  let wi = 0;
  for (const loser of losers) {
    while (loser.rem < -0.01 && wi < winners.length) {
      const winner = winners[wi];
      if (winner.rem < 0.01) { wi++; continue; }
      // amount = full settlement between this pair (no cap)
      const amount = Math.min(Math.abs(loser.rem), winner.rem);
      if (amount < mp - 0.01) { wi++; continue; } // below minimum, skip
      settlements.push({
        id: `${loser.id}-${winner.id}-${settlements.length}`,
        fromId: loser.id,
        fromName: loser.username,
        fromFullName: loser.fullName || '',
        toId: winner.id,
        toName: winner.username,
        toFullName: winner.fullName || '',
        amount: Math.round(amount),
        status: 'pending',
      });
      loser.rem += amount;
      winner.rem -= amount;
      if (winner.rem < 0.01) wi++;
    }
  }
  return settlements;
}

export default function BalanceReport() {
  const [players, setPlayers] = useState([]);
  const [threshold, setThreshold] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [sortCol, setSortCol] = useState('balance');
  const [sortDir, setSortDir] = useState(1);
  const [settlements, setSettlements] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settlementsList') || '[]'); } catch { return []; }
  });
  const [statuses, setStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settlementStatuses') || '{}'); } catch { return {}; }
  });
  const [recording, setRecording] = useState({});
  const [recorded, setRecorded] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settlementRecorded') || '{}'); } catch { return {}; }
  });
  const [defaultMethod, setDefaultMethod] = useState('CASH');
  const [noTransfer, setNoTransfer] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => { getPlayers().then(r => setPlayers(r.data)); }, []);

  useEffect(() => { localStorage.setItem('settlementStatuses', JSON.stringify(statuses)); }, [statuses]);
  useEffect(() => { localStorage.setItem('settlementsList', JSON.stringify(settlements)); }, [settlements]);
  useEffect(() => { localStorage.setItem('settlementRecorded', JSON.stringify(recorded)); }, [recorded]);

  const fmt = (n) => {
    if (n === undefined || n === null) return '0';
    const abs = Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '\u20AA' + abs;
  };
  const fmtAmt = (n) => '\u20AA' + Math.round(n).toLocaleString('en-US');

  const balanceClass = (b) => b > 0 ? 'positive' : b < 0 ? 'negative' : 'zero';
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(1); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '';
  const thStyle = { cursor: 'pointer', userSelect: 'none' };

  const t = parseFloat(threshold) || 0;
  const filtered = t > 0 ? players.filter(p => (p.balance || 0) > t || (p.balance || 0) < -t) : players;
  const sorted = [...filtered].sort((a, b) => {
    const av = sortCol === 'username' ? (a.username || '') : sortCol === 'fullName' ? (a.fullName || '') : (a[sortCol] || 0);
    const bv = sortCol === 'username' ? (b.username || '') : sortCol === 'fullName' ? (b.fullName || '') : (b[sortCol] || 0);
    if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });

  const handleCalculate = () => {
    setStatuses({});
    setRecorded({});
    localStorage.removeItem('settlementStatuses');
    localStorage.removeItem('settlementRecorded');
    const result = calculateSettlements(filtered.filter(p => !noTransfer.has(p.id)), minPayment);
    setSettlements(result);
  };

  const setStatus = async (id, status) => {
    setStatuses(prev => ({ ...prev, [id]: status }));
    setSettlements(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    // When marking complete, auto-record transfer and refresh balances
    if (status === 'complete' && !recorded[id]) {
      const s = settlements.find(x => x.id === id);
      if (s) {
        setRecording(prev => ({ ...prev, [id]: true }));
        try {
          await createSettlement({
            fromPlayerId: s.fromId,
            toPlayerId: s.toId,
            amount: s.amount,
            method: defaultMethod,
            notes: `Settlement: ${s.fromName} → ${s.toName}`,
          });
          setRecorded(prev => ({ ...prev, [id]: true }));
          // Refresh player balances
          getPlayers().then(r => setPlayers(r.data));
        } catch (e) {
          alert('Failed to record transfer: ' + (e.response?.data?.error || e.message));
        } finally {
          setRecording(prev => ({ ...prev, [id]: false }));
        }
      }
    }
  };

  const handleRecord = async (s) => {
    setRecording(prev => ({ ...prev, [s.id]: true }));
    try {
      await createSettlement({
        fromPlayerId: s.fromId,
        toPlayerId: s.toId,
        amount: s.amount,
        method: defaultMethod,
        notes: `Settlement: ${s.fromName} → ${s.toName}`,
      });
      setRecorded(prev => ({ ...prev, [s.id]: true }));
      getPlayers().then(r => setPlayers(r.data));
    } catch (e) {
      alert('Failed to record transfer: ' + (e.response?.data?.error || e.message));
    } finally {
      setRecording(prev => ({ ...prev, [s.id]: false }));
    }
  };

  const visibleSettlements = settlements.filter(s => (statuses[s.id] || s.status) !== 'clean');

  return (
    <div>
      <h1>Balance Report</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ color: '#94a3b8' }}>|balance| &gt;</label>
          <input type="number" min="0" step="1" value={threshold} onChange={e => setThreshold(e.target.value)}
            placeholder="0 = all"
            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', width: '120px' }} />
          <label style={{ color: '#94a3b8', marginLeft: '1rem' }}>Min payment</label>
          <input type="number" min="0" step="1" value={minPayment} onChange={e => setMinPayment(e.target.value)}
            placeholder="e.g. 500"
            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', width: '120px' }} />
          <label style={{ color: '#94a3b8', marginLeft: '1rem' }}>Method</label>
          <select value={defaultMethod} onChange={e => setDefaultMethod(e.target.value)}
            style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px' }}>
            {METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
          </select>
          <button onClick={handleCalculate}
            style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: '6px', padding: '7px 18px', fontWeight: 700, cursor: 'pointer' }}>
            Calculate Settlements
          </button>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{sorted.length} players</span>
        </div>
      </div>

      {visibleSettlements.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Settlement Plan</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {visibleSettlements.map(s => {
              const status = statuses[s.id] || s.status;
              const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1];
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                  background: '#0f1117', borderRadius: '8px', padding: '0.65rem 1rem',
                  border: `1px solid ${STATUS_COLORS[status]}44` }}>
                  <span style={{ color: '#ef4444', fontWeight: 600, minWidth: '130px' }}>
                    {s.fromName}{s.fromFullName ? ` (${s.fromFullName})` : ''}
                  </span>
                  <span style={{ color: '#64748b' }}>→</span>
                  <span style={{ color: '#22c55e', fontWeight: 600, minWidth: '130px' }}>
                    {s.toName}{s.toFullName ? ` (${s.toFullName})` : ''}
                  </span>
                  <span style={{ color: '#f59e0b', fontWeight: 700, minWidth: '80px' }}>{fmtAmt(s.amount)}</span>
                  <span style={{ background: STATUS_COLORS[status] + '33', color: STATUS_COLORS[status],
                    borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600, minWidth: '70px', textAlign: 'center' }}>
                    {STATUS_LABELS[status]}
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                    {nextStatus && nextStatus !== 'clean' && (
                      <button onClick={() => setStatus(s.id, nextStatus)}
                        style={{ background: STATUS_COLORS[nextStatus] + '22', border: `1px solid ${STATUS_COLORS[nextStatus]}`,
                          color: STATUS_COLORS[nextStatus], borderRadius: '5px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                        → {STATUS_LABELS[nextStatus]}
                      </button>
                    )}
                    {status === 'complete' && (
                      <button onClick={() => setStatus(s.id, 'clean')}
                        style={{ background: '#47556922', border: '1px solid #475569', color: '#475569',
                          borderRadius: '5px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                        Clean
                      </button>
                    )}
                    {recorded[s.id] ? (
                      <span style={{ color: '#22c55e', fontSize: '0.8rem', padding: '3px 8px' }}>✓ Recorded</span>
                    ) : (
                      <button onClick={() => handleRecord(s)} disabled={recording[s.id]}
                        style={{ background: '#1e3a5f', border: '1px solid #3b82f6', color: '#3b82f6',
                          borderRadius: '5px', padding: '3px 10px', cursor: recording[s.id] ? 'wait' : 'pointer', fontSize: '0.8rem' }}>
                        {recording[s.id] ? '...' : 'Record Transfer'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No players match the filter</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSort('username')}>Username{arrow('username')}</th>
                <th style={thStyle} onClick={() => handleSort('fullName')}>Full Name{arrow('fullName')}</th>
                <th style={thStyle} onClick={() => handleSort('currentChips')}>Current Chips{arrow('currentChips')}</th>
                <th style={thStyle} onClick={() => handleSort('creditTotal')}>Credit{arrow('creditTotal')}</th>
                <th style={thStyle} onClick={() => handleSort('balance')}>Balance{arrow('balance')}</th>
                <th style={{ textAlign: 'center' }}>No Transfer</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer', opacity: noTransfer.has(p.id) ? 0.45 : 1 }} onClick={() => navigate(`/player/${p.id}`)}>
                  <td style={{ fontWeight: 600 }}>{p.username}</td>
                  <td style={{ color: '#94a3b8' }}>{p.fullName || '—'}</td>
                  <td>{fmt(p.currentChips)}</td>
                  <td style={{ color: p.creditTotal > 0 ? '#f59e0b' : '#64748b' }}>{fmt(p.creditTotal)}</td>
                  <td><strong className={balanceClass(p.balance)}>{fmt(p.balance)}</strong></td>
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={noTransfer.has(p.id)}
                      onChange={e => setNoTransfer(prev => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(p.id) : next.delete(p.id);
                        return next;
                      })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#f59e0b' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
