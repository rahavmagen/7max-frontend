import { useRef, useState, useEffect } from 'react';

const defaultStyle = {
  background: '#1e2130',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '0.35rem 0.6rem',
  fontSize: '0.85rem',
  colorScheme: 'dark',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ISO yyyy-mm-dd -> dd/mm/yyyy for display
function isoToDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.substring(0, 10).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
// dd/mm/yyyy (or d/m/yyyy) -> ISO yyyy-mm-dd, or null if incomplete/invalid
function displayToIso(s) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!match) return null;
  const d = match[1].padStart(2, '0');
  const mo = match[2].padStart(2, '0');
  const y = match[3];
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo}-${d}`;
}
const pad = (n) => String(n).padStart(2, '0');

function Calendar({ value, onPick }) {
  const init = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  const initY = init ? Number(init.substring(0, 4)) : new Date().getFullYear();
  const initM = init ? Number(init.substring(5, 7)) - 1 : new Date().getMonth();
  const [view, setView] = useState({ y: initY, m: initM });

  const prevMonth = () => setView(v => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const nextMonth = () => setView(v => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const startDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const navBtn = { background: '#2d3148', border: 'none', color: '#e2e8f0', cursor: 'pointer', borderRadius: 4, padding: '2px 8px', fontSize: '1rem', lineHeight: 1 };

  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000, marginTop: 4, width: 236,
      background: '#1a1d2e', border: '1px solid #334155', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span>
          <button type="button" onClick={() => setView(v => ({ ...v, y: v.y - 1 }))} title="Previous year" style={navBtn}>«</button>
          <button type="button" onClick={prevMonth} title="Previous month" style={{ ...navBtn, marginLeft: 4 }}>‹</button>
        </span>
        <strong style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{MONTHS[view.m]} {view.y}</strong>
        <span>
          <button type="button" onClick={nextMonth} title="Next month" style={navBtn}>›</button>
          <button type="button" onClick={() => setView(v => ({ ...v, y: v.y + 1 }))} title="Next year" style={{ ...navBtn, marginLeft: 4 }}>»</button>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {DOW.map(d => <div key={d} style={{ textAlign: 'center', color: '#64748b', fontSize: '0.68rem', padding: '2px 0' }}>{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
          const selected = iso === value;
          return (
            <button key={i} type="button" onClick={() => onPick(iso)}
              style={{ textAlign: 'center', padding: '4px 0', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem',
                border: 'none', background: selected ? '#2563eb' : 'transparent', color: selected ? '#fff' : '#cbd5e1' }}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Date input that always shows dd/mm/yyyy with a self-contained calendar dropdown
 * (native <input type=date> renders in the browser locale, which we can't control).
 * value / onChange stay ISO yyyy-mm-dd so callers are unchanged.
 */
export default function DateInput({ value, onChange, style, ...props }) {
  const [text, setText] = useState(isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => { setText(isoToDisplay(value)); }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onText = (e) => {
    const v = e.target.value.replace(/[^\d/]/g, '').slice(0, 10);
    setText(v);
    if (v === '') { onChange(''); return; }
    const iso = displayToIso(v);
    if (iso) onChange(iso);
  };

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={onText}
        style={{ ...defaultStyle, width: 118, paddingRight: '1.6rem', ...style }}
        {...props}
      />
      <button type="button" onClick={() => setOpen(o => !o)} title="Pick date" tabIndex={-1}
        style={{ position: 'absolute', right: 4, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, padding: 0 }}>
        📅
      </button>
      {open && <Calendar value={value} onPick={(iso) => { onChange(iso); setOpen(false); }} />}
    </span>
  );
}
