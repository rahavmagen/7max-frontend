import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { getPlayers, getAdminTransfers } from '../api';

// ── shared helpers ──────────────────────────────────────────────────────────

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++)
      curr[j] = a[i-1] === b[j-1] ? prev[j-1] : 1 + Math.min(prev[j-1], prev[j], curr[j-1]);
    prev.splice(0, prev.length, ...curr);
  }
  return prev[n];
}

function norm(s) { return s.replace(/[''`´]/g, "'").trim(); }

function nameMatch(a, b) {
  a = norm(a); b = norm(b);
  if (levenshtein(a, b) <= 3) return true;
  const short = a.length < b.length ? a : b;
  const long  = a.length < b.length ? b : a;
  return long.startsWith(short + ' ') || long.startsWith(short);
}

const fmt = (n) => {
  if (n === undefined || n === null) return '—';
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (n < 0 ? '-' : '') + '₪' + abs;
};

// ── presets ─────────────────────────────────────────────────────────────────

const PRESETS = {
  RSTil: {
    label: 'RSTil',
    adminUsername: 'RSTil',
    sheet: 'מיקום הכסף',
    nameCol: 0,           // col A
    amtCols: [2, 3, 4, 5], // cols C-F
    startRow: 65,
    skipNames: ['שולם לקלאב', 'קוזזו הוצאות'],
  },
  LavanMiday: {
    label: 'LavanMiday',
    adminUsername: 'LavanMiday',
    sheet: 'מיקום הכסף',
    nameCol: 7,            // col H
    amtCols: [9, 10, 11, 12], // cols J-M
    startRow: 69,
    skipNames: ['מקס 7', 'שולם לקלאב'],
  },
};

// ── TransferCompare tab ──────────────────────────────────────────────────────

function TransferCompare() {
  const [presetKey, setPresetKey] = useState('RSTil');
  const [startRow, setStartRow] = useState(PRESETS.RSTil.startRow);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const fileRef = useRef();

  const handlePresetChange = (key) => {
    setPresetKey(key);
    setStartRow(PRESETS[key].startRow);
    setResults(null);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const preset = PRESETS[presetKey];

      // Parse XLS
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[preset.sheet];
      if (!ws) throw new Error(`Sheet "${preset.sheet}" not found in file`);
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      const startIdx = Number(startRow) - 1;
      const xlsEntries = [];
      let xlsTotal = 0;

      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        const name = row[preset.nameCol] ? String(row[preset.nameCol]).trim() : null;
        if (!name || preset.skipNames.some(s => name.includes(s))) continue;
        for (const col of preset.amtCols) {
          const val = row[col];
          if (val != null && val !== 0) {
            const n = Number(val);
            xlsTotal += n;
            xlsEntries.push({ name, amount: Math.abs(n), dir: n > 0 ? 'in' : 'out', row: i + 1, matched: false });
          }
        }
      }

      // Fetch DB transfers
      const res = await getAdminTransfers(preset.adminUsername);
      const dbEntries = res.data.map(d => ({
        id: d.id,
        amount: Number(d.amount),
        dir: d.dir,
        name: d.playerName,
        username: d.username,
        matched: false,
      }));

      let dbTotal = 0;
      for (const d of dbEntries) dbTotal += d.dir === 'in' ? d.amount : -d.amount;

      // Match
      const matches = [], xlsOnly = [], dbOnly = [];

      for (const x of xlsEntries) {
        let best = null, bestDist = Infinity;
        for (const d of dbEntries) {
          if (d.matched) continue;
          if (d.dir !== x.dir) continue;
          if (Math.abs(d.amount - x.amount) > 0.01) continue;
          const dist = nameMatch(x.name, d.name) ? levenshtein(norm(x.name), norm(d.name)) : 999;
          if (dist < bestDist) { bestDist = dist; best = d; }
        }
        if (best && bestDist < 999) {
          best.matched = true; x.matched = true;
          matches.push({ xls: x, db: best, dist: bestDist });
        }
      }

      for (const x of xlsEntries) if (!x.matched) xlsOnly.push(x);
      for (const d of dbEntries) if (!d.matched) dbOnly.push(d);

      const xlsOnlyTotal = xlsOnly.reduce((s, x) => s + (x.dir === 'in' ? x.amount : -x.amount), 0);
      const dbOnlyTotal = dbOnly.reduce((s, d) => s + (d.dir === 'in' ? d.amount : -d.amount), 0);

      setResults({ xlsTotal, dbTotal, gap: xlsTotal - dbTotal, matches, xlsOnly, dbOnly, xlsOnlyTotal, dbOnlyTotal, presetLabel: preset.label });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Upload a 7MAX XLS file and select the admin wallet to compare player transfers against the database.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Admin</label>
            <select value={presetKey} onChange={e => handlePresetChange(e.target.value)}
              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
              {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Start Row</label>
            <input type="number" value={startRow} onChange={e => setStartRow(e.target.value)} min={1}
              style={{ background: '#1a1d2e', border: '1px solid #2d3148', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', width: '90px' }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', color: '#64748b' }}>XLS File</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ color: '#e2e8f0' }} />
          </div>
          {loading && <span style={{ color: '#64748b', alignSelf: 'center' }}>Comparing...</span>}
        </div>
        {error && <div style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</div>}
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#475569' }}>
          {presetKey === 'RSTil' ? 'Sheet: מיקום הכסף · Cols C–F · Name col A' : 'Sheet: מיקום הכסף · Cols J–M · Name col H'}
        </div>
      </div>

      {results && (
        <>
          {/* Totals */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Totals — {results.presetLabel}</h2>
            <div className="table-wrap"><table><tbody>
              <tr>
                <td style={{ color: '#94a3b8' }}>XLS Net (from row {startRow})</td>
                <td><strong style={{ color: '#e2e8f0' }}>{fmt(results.xlsTotal)}</strong></td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>DB Net (all {results.presetLabel} transfers)</td>
                <td><strong style={{ color: '#e2e8f0' }}>{fmt(results.dbTotal)}</strong></td>
              </tr>
              <tr style={{ borderTop: '2px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>Gap (XLS − DB)</strong></td>
                <td>
                  <strong style={{ fontSize: '1.2rem', color: results.gap === 0 ? '#22c55e' : '#f87171' }}>
                    {results.gap >= 0 ? '+' : ''}{fmt(results.gap)}
                  </strong>
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>XLS entries</td>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{results.matches.length + results.xlsOnly.length}</td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>DB entries</td>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{results.matches.length + results.dbOnly.length}</td>
              </tr>
            </tbody></table></div>
          </div>

          {/* XLS only */}
          {results.xlsOnly.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: '#f87171' }}>In XLS but not on site ({results.xlsOnly.length})</h2>
              <div className="table-wrap"><table>
                <thead><tr style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Row</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Amount</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Name</th>
                </tr></thead>
                <tbody>
                  {results.xlsOnly.map((x, i) => (
                    <tr key={i}>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{x.row}</td>
                      <td style={{ textAlign: 'right', color: x.dir === 'in' ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                        {x.dir === 'out' ? '-' : '+'}{fmt(x.amount)}
                      </td>
                      <td style={{ color: '#e2e8f0' }}>{x.name}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #334155' }}>
                    <td /><td style={{ textAlign: 'right', fontWeight: 700, color: results.xlsOnlyTotal >= 0 ? '#4ade80' : '#f87171' }}>{fmt(results.xlsOnlyTotal)}</td><td />
                  </tr>
                </tbody>
              </table></div>
            </div>
          )}

          {/* DB only */}
          {results.dbOnly.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: '#f59e0b' }}>On site but not in XLS ({results.dbOnly.length})</h2>
              <div className="table-wrap"><table>
                <thead><tr style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>ID</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Amount</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Name</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Username</th>
                </tr></thead>
                <tbody>
                  {results.dbOnly.map((d) => (
                    <tr key={d.id}>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{d.id}</td>
                      <td style={{ textAlign: 'right', color: d.dir === 'in' ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                        {d.dir === 'out' ? '-' : '+'}{fmt(d.amount)}
                      </td>
                      <td style={{ color: '#e2e8f0' }}>{d.name}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{d.username}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #334155' }}>
                    <td /><td style={{ textAlign: 'right', fontWeight: 700, color: results.dbOnlyTotal >= 0 ? '#4ade80' : '#f87171' }}>{fmt(results.dbOnlyTotal)}</td><td colSpan={2} />
                  </tr>
                </tbody>
              </table></div>
            </div>
          )}

          {/* Matched */}
          <div className="card">
            <h2 style={{ marginBottom: '1rem', color: '#22c55e' }}>Matched ({results.matches.length})</h2>
            <div className="table-wrap"><table>
              <thead><tr style={{ color: '#64748b', fontSize: '0.85rem' }}>
                <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Amount</th>
                <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>DB Name</th>
                <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Username</th>
                <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Note</th>
              </tr></thead>
              <tbody>
                {results.matches.map((m, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'right', color: m.db.dir === 'in' ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                      {m.db.dir === 'out' ? '-' : '+'}{fmt(m.db.amount)}
                    </td>
                    <td style={{ color: '#e2e8f0' }}>{m.db.name}</td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{m.db.username}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{m.dist > 0 ? `~${m.xls.name}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}

// ── CreditCompare tab (preserved) ────────────────────────────────────────────

function CreditCompare() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const fmtC = (n) => {
    if (!n) return '—';
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (n < 0 ? '-' : '') + '₪' + abs;
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames.find(n => n.includes('קרדיט') || n.toLowerCase().includes('credit'));
      if (!sheetName) throw new Error('Could not find credit tracking sheet (מעקב קרדיטים)');

      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      const xlsByUser = {};
      const xlsColB = {};
      const xlsByName = {};
      let xlsTotal = 0;
      const unnamedRows = [];
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        const colA = row[0] ? String(row[0]).trim() : null;
        const colB = row[1] ? String(row[1]).trim() : null;
        const c = Number(row[2]) || 0;
        const d = Number(row[3]) || 0;
        const ee = Number(row[4]) || 0;
        const f = Number(row[5]) || 0;
        const total = c + d + ee + f;
        if (total !== 0) {
          xlsTotal += total;
          if (colA) {
            xlsByUser[colA] = (xlsByUser[colA] || 0) + total;
            if (colB) xlsColB[colA.toLowerCase().trim()] = colB;
          } else if (colB) {
            xlsByName[colB] = (xlsByName[colB] || 0) + total;
          } else {
            unnamedRows.push({ row: `Row ${i + 1}`, amount: total });
          }
        }
      }

      const res = await getPlayers();
      const players = res.data;
      let dbTotal = 0;
      const dbByUserLower = {};
      const dbByNameLower = {};
      for (const p of players) {
        const ct = Number(p.creditTotal) || 0;
        dbTotal += ct;
        dbByUserLower[p.username.toLowerCase()] = { key: p.username, val: ct };
        if (p.fullName) dbByNameLower[p.fullName.toLowerCase()] = { key: p.username, val: ct };
      }

      const diffs = [];
      const matchedByNameUsernames = new Set();
      const nameUnmatched = [];
      for (const [realName, xlsVal] of Object.entries(xlsByName)) {
        const dbEntry = dbByNameLower[realName.toLowerCase()];
        if (dbEntry) {
          matchedByNameUsernames.add(dbEntry.key.toLowerCase());
          const dbVal = dbEntry.val;
          const diff = xlsVal - dbVal;
          if (Math.abs(diff) > 0.01) diffs.push({ username: dbEntry.key, xlsVal, dbVal, diff, note: `matched by name: ${realName}` });
        } else {
          nameUnmatched.push({ row: realName, amount: xlsVal });
        }
      }

      const xlsByUserLower = {};
      for (const [k, v] of Object.entries(xlsByUser)) xlsByUserLower[k.toLowerCase().trim()] = { key: k, val: v };

      const dbNonZero = Object.fromEntries(Object.entries(dbByUserLower).filter(([k, e]) => e.val !== 0 && !matchedByNameUsernames.has(k)));
      const dbZero = Object.fromEntries(Object.entries(dbByUserLower).filter(([k, e]) => e.val === 0 && !matchedByNameUsernames.has(k)));

      const exactMatchedDbKeys = new Set();
      const unmatchedXls = [];
      for (const [key, xlsEntry] of Object.entries(xlsByUserLower)) {
        if (matchedByNameUsernames.has(key)) continue;
        const dbEntry = dbNonZero[key];
        if (dbEntry) {
          exactMatchedDbKeys.add(key);
          const diff = xlsEntry.val - dbEntry.val;
          if (Math.abs(diff) > 0.01) diffs.push({ username: dbEntry.key, xlsVal: xlsEntry.val, dbVal: dbEntry.val, diff });
        } else {
          unmatchedXls.push([key, xlsEntry]);
        }
      }

      const unmatchedNonZeroDb = Object.entries(dbNonZero).filter(([k]) => !exactMatchedDbKeys.has(k));
      const fuzzyMatchedDbKeys = new Set();
      const stillUnmatchedXls = [];
      for (const [xlsKey, xlsEntry] of unmatchedXls) {
        let bestMatch = null, bestDist = Infinity;
        for (const [dbKey, dbEntry] of unmatchedNonZeroDb) {
          if (fuzzyMatchedDbKeys.has(dbKey)) continue;
          const dist = levenshtein(xlsKey, dbKey);
          if (dist < bestDist) { bestDist = dist; bestMatch = [dbKey, dbEntry]; }
        }
        if (bestMatch && bestDist <= 2) {
          fuzzyMatchedDbKeys.add(bestMatch[0]);
          const diff = xlsEntry.val - bestMatch[1].val;
          if (Math.abs(diff) > 0.01) diffs.push({ username: bestMatch[1].key, xlsVal: xlsEntry.val, dbVal: bestMatch[1].val, diff, note: `fuzzy: ${xlsEntry.key}` });
        } else {
          stillUnmatchedXls.push([xlsKey, xlsEntry]);
        }
      }

      for (const [xlsKey, xlsEntry] of stillUnmatchedXls) {
        const colBVal = xlsColB[xlsKey];
        let colBMatch = null;
        if (colBVal) {
          const byFullName = dbByNameLower[colBVal.toLowerCase()];
          const byUsername = dbByUserLower[colBVal.toLowerCase()];
          const candidate = byFullName || byUsername;
          if (candidate && !matchedByNameUsernames.has(candidate.key.toLowerCase())) colBMatch = candidate;
        }
        if (colBMatch) {
          fuzzyMatchedDbKeys.add(colBMatch.key.toLowerCase());
          matchedByNameUsernames.add(colBMatch.key.toLowerCase());
          const diff = xlsEntry.val - colBMatch.val;
          if (Math.abs(diff) > 0.01) diffs.push({ username: colBMatch.key, xlsVal: xlsEntry.val, dbVal: colBMatch.val, diff, note: `matched by name: ${colBVal}` });
        } else {
          const zeroEntry = dbZero[xlsKey];
          const displayName = zeroEntry ? zeroEntry.key : xlsEntry.key;
          diffs.push({ username: displayName, xlsVal: xlsEntry.val, dbVal: 0, diff: xlsEntry.val });
        }
      }

      for (const [dbKey, dbEntry] of unmatchedNonZeroDb) {
        if (fuzzyMatchedDbKeys.has(dbKey)) continue;
        diffs.push({ username: dbEntry.key, xlsVal: 0, dbVal: dbEntry.val, diff: -dbEntry.val });
      }

      const unnamed = [...unnamedRows, ...nameUnmatched];
      diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      setResults({ diffs, unnamed, xlsTotal, dbTotal, netDiff: xlsTotal - dbTotal, sheetName });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Upload a 7MAX XLS file to compare the <strong>מעקב קרדיטים</strong> sheet (columns C–F) against the production database.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ color: '#e2e8f0' }} />
          {loading && <span style={{ color: '#64748b' }}>Comparing...</span>}
        </div>
        {error && <div style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</div>}
      </div>

      {results && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Summary</h2>
            <div className="table-wrap"><table><tbody>
              <tr>
                <td style={{ color: '#94a3b8' }}>XLS Total (cols C–F)</td>
                <td><strong style={{ color: '#e2e8f0' }}>{fmtC(results.xlsTotal)}</strong></td>
              </tr>
              <tr>
                <td style={{ color: '#94a3b8' }}>DB Total (all player credits)</td>
                <td><strong style={{ color: '#e2e8f0' }}>{fmtC(results.dbTotal)}</strong></td>
              </tr>
              <tr style={{ borderTop: '2px solid #334155' }}>
                <td><strong style={{ color: '#e2e8f0' }}>Difference (XLS − DB)</strong></td>
                <td>
                  <strong style={{ fontSize: '1.2rem', color: results.netDiff === 0 ? '#22c55e' : '#f87171' }}>
                    {results.netDiff >= 0 ? '+' : ''}{fmtC(results.netDiff)}
                  </strong>
                </td>
              </tr>
            </tbody></table></div>
          </div>

          {results.diffs.length === 0 ? (
            <div className="card" style={{ color: '#22c55e', fontSize: '1.1rem' }}>All named players match exactly.</div>
          ) : (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>Mismatches ({results.diffs.length})</h2>
              <div className="table-wrap"><table>
                <thead><tr style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Username</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>XLS</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>DB</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Diff</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Note</th>
                </tr></thead>
                <tbody>
                  {results.diffs.map((d) => {
                    const { username, xlsVal, dbVal, diff } = d;
                    const note = d.note || (xlsVal === 0 ? 'In DB only' : dbVal === 0 ? 'In XLS only' : 'Amount differs');
                    return (
                      <tr key={username}>
                        <td style={{ color: '#e2e8f0', fontWeight: '500' }}>{username}</td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>{xlsVal ? fmtC(xlsVal) : '—'}</td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>{dbVal ? fmtC(dbVal) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: diff > 0 ? '#f87171' : '#22c55e' }}>
                            {diff > 0 ? '+' : ''}{fmtC(diff)}
                          </strong>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          )}

          {results.unnamed.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: '1rem' }}>Unmatched XLS Rows ({results.unnamed.length})</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                These rows have credit values but could not be matched to a DB player.
              </p>
              <div className="table-wrap"><table>
                <thead><tr style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>XLS Row</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Amount</th>
                </tr></thead>
                <tbody>
                  {results.unnamed.map(({ row, amount }) => (
                    <tr key={row}>
                      <td style={{ color: '#94a3b8' }}>{row}</td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>{fmtC(amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #334155' }}>
                    <td style={{ color: '#e2e8f0' }}><strong>Total unmatched</strong></td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: '#f87171' }}>{fmtC(results.unnamed.reduce((s, r) => s + r.amount, 0))}</strong>
                    </td>
                  </tr>
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main page with tabs ──────────────────────────────────────────────────────

const TABS = [
  { key: 'credit', label: 'Credit Compare' },
  { key: 'transfer', label: 'Transfer Compare' },
];

export default function XlsCompare() {
  const [tab, setTab] = useState('credit');

  return (
    <div>
      <div className="page-header">
        <h1>XLS Compare</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #2d3148', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.6rem 1.2rem',
              color: tab === t.key ? '#60a5fa' : '#64748b',
              fontWeight: tab === t.key ? 700 : 400,
              fontSize: '0.95rem',
              borderBottom: tab === t.key ? '2px solid #60a5fa' : '2px solid transparent',
              marginBottom: '-1px',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'credit' ? <CreditCompare /> : <TransferCompare />}
    </div>
  );
}
