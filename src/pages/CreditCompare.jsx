import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { getPlayers } from '../api';

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

export default function CreditCompare() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const fmt = (n) => {
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
      // Read XLS
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // Find מעקב קרדיטים sheet
      const sheetName = wb.SheetNames.find(n => n.includes('קרדיט') || n.toLowerCase().includes('credit'));
      if (!sheetName) throw new Error('Could not find credit tracking sheet (מעקב קרדיטים)');

      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      // Parse: col A=username, col B=real name, cols C–F=credit values
      const xlsByUser = {};   // username (col A) → total
      const xlsColB = {};     // lowercase col A → col B value (for fallback matching)
      const xlsByName = {};   // real name (col B, when col A empty) → total
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

      // Fetch DB players
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

      // Match col B (real name) → look up player by fullName in DB first,
      // track matched DB usernames to exclude them from col A matching
      const matchedByNameUsernames = new Set();
      const nameUnmatched = [];
      for (const [realName, xlsVal] of Object.entries(xlsByName)) {
        const dbEntry = dbByNameLower[realName.toLowerCase()];
        if (dbEntry) {
          matchedByNameUsernames.add(dbEntry.key.toLowerCase());
          const dbVal = dbEntry.val;
          const diff = xlsVal - dbVal;
          if (Math.abs(diff) > 0.01) {
            diffs.push({ username: dbEntry.key, xlsVal, dbVal, diff, note: `matched by name: ${realName}` });
          }
        } else {
          nameUnmatched.push({ row: realName, amount: xlsVal });
        }
      }

      // Match col A (username) vs DB username
      // Strategy: prefer non-zero DB entries — avoids a zero-credit duplicate from stealing an exact match
      const xlsByUserLower = {};
      for (const [k, v] of Object.entries(xlsByUser)) {
        xlsByUserLower[k.toLowerCase().trim()] = { key: k, val: v };
      }

      // Split DB into non-zero and zero-credit entries (excluding col-B matched players)
      const dbNonZero = Object.fromEntries(
        Object.entries(dbByUserLower).filter(([k, e]) => e.val !== 0 && !matchedByNameUsernames.has(k))
      );
      const dbZero = Object.fromEntries(
        Object.entries(dbByUserLower).filter(([k, e]) => e.val === 0 && !matchedByNameUsernames.has(k))
      );

      // Phase 1: exact match XLS against non-zero DB
      const exactMatchedDbKeys = new Set();
      const unmatchedXls = [];
      for (const [key, xlsEntry] of Object.entries(xlsByUserLower)) {
        // Skip if same player was already matched via col B real name (duplicate XLS row)
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

      // Phase 2: fuzzy match remaining XLS against non-zero DB (Levenshtein ≤ 2)
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
          if (Math.abs(diff) > 0.01) {
            diffs.push({ username: bestMatch[1].key, xlsVal: xlsEntry.val, dbVal: bestMatch[1].val, diff, note: `fuzzy: ${xlsEntry.key}` });
          }
        } else {
          stillUnmatchedXls.push([xlsKey, xlsEntry]);
        }
      }

      // Phase 3: remaining XLS — try col B as DB fullName or DB username fallback
      for (const [xlsKey, xlsEntry] of stillUnmatchedXls) {
        const colBVal = xlsColB[xlsKey];
        let colBMatch = null;
        if (colBVal) {
          const byFullName = dbByNameLower[colBVal.toLowerCase()];
          const byUsername = dbByUserLower[colBVal.toLowerCase()];
          const candidate = byFullName || byUsername;
          if (candidate && !matchedByNameUsernames.has(candidate.key.toLowerCase())) {
            colBMatch = candidate;
          }
        }
        if (colBMatch) {
          fuzzyMatchedDbKeys.add(colBMatch.key.toLowerCase());
          matchedByNameUsernames.add(colBMatch.key.toLowerCase());
          const diff = xlsEntry.val - colBMatch.val;
          if (Math.abs(diff) > 0.01) {
            diffs.push({ username: colBMatch.key, xlsVal: xlsEntry.val, dbVal: colBMatch.val, diff, note: `matched by name: ${colBVal}` });
          }
        } else {
          const zeroEntry = dbZero[xlsKey];
          const displayName = zeroEntry ? zeroEntry.key : xlsEntry.key;
          diffs.push({ username: displayName, xlsVal: xlsEntry.val, dbVal: 0, diff: xlsEntry.val });
        }
      }

      // Remaining non-zero DB entries with no XLS match → "DB only"
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
      <div className="page-header">
        <h1>Credit Compare — XLS vs DB</h1>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Upload a 7MAX XLS file to compare the <strong>מעקב קרדיטים</strong> sheet (columns C–F) against the production database.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            style={{ color: '#e2e8f0' }}
          />
          {loading && <span style={{ color: '#64748b' }}>Comparing...</span>}
        </div>
        {error && <div style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</div>}
      </div>

      {results && (
        <>
          {/* Totals */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Summary</h2>
            <div className="table-wrap"><table>
              <tbody>
                <tr>
                  <td style={{ color: '#94a3b8' }}>XLS Total (cols C–F)</td>
                  <td><strong style={{ color: '#e2e8f0' }}>{fmt(results.xlsTotal)}</strong></td>
                </tr>
                <tr>
                  <td style={{ color: '#94a3b8' }}>DB Total (all player credits)</td>
                  <td><strong style={{ color: '#e2e8f0' }}>{fmt(results.dbTotal)}</strong></td>
                </tr>
                <tr style={{ borderTop: '2px solid #334155' }}>
                  <td><strong style={{ color: '#e2e8f0' }}>Difference (XLS − DB)</strong></td>
                  <td>
                    <strong style={{ fontSize: '1.2rem', color: results.netDiff === 0 ? '#22c55e' : '#f87171' }}>
                      {results.netDiff >= 0 ? '+' : ''}{fmt(results.netDiff)}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table></div>
          </div>

          {/* Diffs */}
          {results.diffs.length === 0 ? (
            <div className="card" style={{ color: '#22c55e', fontSize: '1.1rem' }}>
              All named players match exactly.
            </div>
          ) : (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>Mismatches ({results.diffs.length})</h2>
              <div className="table-wrap"><table>
                <thead>
                  <tr style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Username</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>XLS</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>DB</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Diff</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {results.diffs.map((d) => {
                    const { username, xlsVal, dbVal, diff } = d;
                    const note = d.note || (xlsVal === 0 ? 'In DB only' : dbVal === 0 ? 'In XLS only' : 'Amount differs');
                    return (
                      <tr key={username}>
                        <td style={{ color: '#e2e8f0', fontWeight: '500' }}>{username}</td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>{xlsVal ? fmt(xlsVal) : '—'}</td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>{dbVal ? fmt(dbVal) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: diff > 0 ? '#f87171' : '#22c55e' }}>
                            {diff > 0 ? '+' : ''}{fmt(diff)}
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

          {/* Unnamed rows */}
          {results.unnamed.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: '1rem' }}>Unmatched XLS Rows ({results.unnamed.length})</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                These rows have credit values but could not be matched to a DB player (no username in col A, or real name in col B not found in DB).
              </p>
              <div className="table-wrap"><table>
                <thead>
                  <tr style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>XLS Row</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {results.unnamed.map(({ row, amount }) => (
                    <tr key={row}>
                      <td style={{ color: '#94a3b8' }}>{row}</td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>{fmt(amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #334155' }}>
                    <td style={{ color: '#e2e8f0' }}><strong>Total unmatched</strong></td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: '#f87171' }}>
                        {fmt(results.unnamed.reduce((s, r) => s + r.amount, 0))}
                      </strong>
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
