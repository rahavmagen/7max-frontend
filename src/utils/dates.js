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

// Convert display "13/04/2026" → ISO "2026-04-13"
export function displayToIso(display) {
  if (!display) return '';
  const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

// Convert ISO "2026-04-13" → display "13/04/2026"
export function isoToDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
