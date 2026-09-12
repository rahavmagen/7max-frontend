// Format ISO datetime "2026-04-13T21:00" or "2026-04-13 21:00" → "13/04/2026 21:00"
export function fmtDateTime(dt) {
  if (!dt) return '—';
  const [datePart, timePart] = dt.replace('T', ' ').substring(0, 16).split(' ');
  const [y, m, d] = datePart.split('-');
  return timePart ? `${d}/${m}/${y} ${timePart}` : `${d}/${m}/${y}`;
}

// Format ISO date "2026-04-13" → "13/04/2026"
export function fmtDateOnly(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// ISO date "2026-04-13" + 1 → "2026-04-14" (UTC arithmetic, so no local-timezone rollover surprises)
export function addDaysIso(iso, days) {
  if (!iso) return iso;
  const [y, m, d] = iso.substring(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

