import { useState, useRef, useEffect } from 'react';
import { uploadReport, getReports, deleteReport, getStalePlayers } from '../api';
import api from '../api';
import { useNavigate, Link } from 'react-router-dom';

export default function Upload() {
  const [dragging, setDragging] = useState(false);
  const [reports, setReports] = useState([]);
  const [queue, setQueue] = useState([]); // { file, status, msg }
  const [processing, setProcessing] = useState(false);
  const [leftClub, setLeftClub] = useState([]);
  const [chipWarning, setChipWarning] = useState(null); // { mismatch, expected, actual }
  const [wheelWarnings, setWheelWarnings] = useState([]); // unmatched wheel expense rows
  const fileRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    getReports().then(r => setReports(r.data));
    getStalePlayers().then(r => setLeftClub(r.data));
  }, []);

  const processFiles = async (files) => {
    const xlsFiles = Array.from(files).filter(f => f.name.endsWith('.xlsx'));
    if (!xlsFiles.length) return;

    const initial = xlsFiles.map(f => ({ name: f.name, status: 'pending', msg: '' }));
    setQueue(initial);
    setProcessing(true);

    const updated = [...initial];
    for (let i = 0; i < xlsFiles.length; i++) {
      updated[i] = { ...updated[i], status: 'uploading' };
      setQueue([...updated]);
      try {
        const res = await uploadReport(xlsFiles[i]);
        if (res.status >= 400) {
          updated[i] = { ...updated[i], status: 'error', msg: res.data?.error || 'Upload failed.' };
        } else {
          updated[i] = {
            ...updated[i], status: 'done',
            msg: `Period: ${res.data.periodStart} → ${res.data.periodEnd} | Rake: ${Math.round(parseFloat(res.data.totalRake))}`
          };
          if (res.data.chipMismatch != null && Number(res.data.chipMismatch) > 1) {
            setChipWarning({
              mismatch: Number(res.data.chipMismatch),
              expected: Number(res.data.chipMismatchExpected),
              actual: Number(res.data.chipMismatchActual),
            });
          }
          if (res.data.wheelExpenseWarnings?.length) {
            setWheelWarnings(prev => [...prev, ...res.data.wheelExpenseWarnings]);
          }
          if (res.data.leftClub?.length || res.data.recovered?.length) {
            setLeftClub(prev => {
              let next = [...prev];
              if (res.data.leftClub?.length) {
                for (const p of res.data.leftClub) {
                  if (!next.some(x => x.id === p.id)) next.push(p);
                }
              }
              if (res.data.recovered?.length) {
                const recoveredIds = new Set(res.data.recovered.map(r => r.clubPlayerId).filter(Boolean));
                next = next.filter(x => !x.clubPlayerId || !recoveredIds.has(x.clubPlayerId));
              }
              return next;
            });
          }
        }
      } catch (e) {
        updated[i] = { ...updated[i], status: 'error', msg: e.response?.data?.error || 'Upload failed.' };
      }
      setQueue([...updated]);
    }

    setProcessing(false);
    getReports().then(r => setReports(r.data));
    getStalePlayers().then(r => setLeftClub(r.data));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDownload = async (id, fileName) => {
    try {
      const res = await api.get(`/reports/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download report.');
    }
  };

  const handleDelete = async (id, fileName) => {
    if (!confirm(`Remove "${fileName}"?\nThis will delete all game sessions and results from this upload.`)) return;
    try {
      await deleteReport(id);
      getReports().then(r => setReports(r.data));
    } catch {
      alert('Failed to remove report.');
    }
  };

  const statusIcon = (s) => ({ pending: '⏳', uploading: '⬆', done: '✓', error: '✗' }[s] || '');
  const statusColor = (s) => ({ done: '#22c55e', error: '#ef4444', uploading: '#6366f1', pending: '#64748b' }[s]);

  return (
    <div>
      <h1>Upload ClubGG Report</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Upload one or multiple ClubGG export files at once. Must include <strong>Club Member Balance</strong> tab.
      </p>

      <div className="card">
        <div
          className={`upload-area ${dragging ? 'drag-over' : ''}`}
          style={{ cursor: processing ? 'not-allowed' : 'pointer' }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !processing && fileRef.current.click()}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <div style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
            {processing ? 'Processing files...' : 'Drop one or more ClubGG Excel files here, or click to browse'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Multiple files supported · Required tabs: Club Member Balance · Ring Game Detail · MTT Detail
          </div>
          <input ref={fileRef} type="file" accept=".xlsx" multiple style={{ display: 'none' }}
            onChange={e => { processFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {queue.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <strong style={{ color: '#e2e8f0' }}>Upload Progress ({queue.filter(q => q.status === 'done').length}/{queue.length})</strong>
              {!processing && <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 12px' }} onClick={() => setQueue([])}>Clear</button>}
            </div>
            {queue.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #1e293b' }}>
                <span style={{ color: statusColor(item.status), fontSize: '1rem', width: '20px', textAlign: 'center' }}>{statusIcon(item.status)}</span>
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', color: '#cbd5e1' }}>{item.name}</span>
                <span style={{ fontSize: '0.8rem', color: statusColor(item.status) }}>{item.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {chipWarning && (
        <div style={{
          background: 'rgba(239,68,68,0.10)', border: '1px solid #ef4444',
          borderRadius: '10px', padding: '1rem 1.25rem', margin: '1rem 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <strong style={{ color: '#ef4444' }}>⚠️ אי-התאמה בצ'יפים</strong>
            <div style={{ color: '#fca5a5', fontSize: '0.875rem', marginTop: '0.3rem' }}>
              הפרש: <strong>{Math.round(chipWarning.mismatch).toLocaleString()}</strong>
              &nbsp;|&nbsp; צפוי: {Math.round(chipWarning.expected).toLocaleString()}
              &nbsp;|&nbsp; בפועל (XLS): {Math.round(chipWarning.actual).toLocaleString()}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              הדוח הועלה בהצלחה. הנתונים בפועל.{' '}
              <Link to="/chip-balance" style={{ color: '#f6c90e', textDecoration: 'underline' }}>בדוק את עמוד ה-Balance לפרטים.</Link>
            </div>
          </div>
          <button onClick={() => setChipWarning(null)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>
            ✕
          </button>
        </div>
      )}

      {wheelWarnings.length > 0 && (
        <div style={{
          background: 'rgba(251,191,36,0.10)', border: '1px solid #f59e0b',
          borderRadius: '10px', padding: '1rem 1.25rem', margin: '1rem 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <strong style={{ color: '#f59e0b' }}>⚠️ הוצאות גלגל לא זוהו</strong>
            <div style={{ color: '#fcd34d', fontSize: '0.875rem', marginTop: '0.3rem' }}>
              Send Chips שלילי ללא התאמה לטורניר הלילי — נשמר כ-CREDIT:
            </div>
            <ul style={{ color: '#fde68a', fontSize: '0.8rem', margin: '0.4rem 0 0 1rem', padding: 0 }}>
              {wheelWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <button onClick={() => setWheelWarnings([])}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>
            ✕
          </button>
        </div>
      )}

      {leftClub.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Left Club ({leftClub.length})</h2>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 12px' }} onClick={() => setLeftClub([])}>Dismiss</button>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
            These players were in the management system but are no longer in the Club Member Balance:
          </p>
          <table>
            <thead><tr><th>Username</th><th>Full Name</th><th>Club ID</th><th></th></tr></thead>
            <tbody>
              {leftClub.map((p, i) => (
                <tr key={i}>
                  <td><strong>{p.username}</strong></td>
                  <td>{p.fullName || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>{p.clubPlayerId || '—'}</td>
                  <td><button onClick={() => navigate(`/player/${p.id}`)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.8rem' }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>Upload History ({reports.length})</h2>
        {reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No reports uploaded yet</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Period</th>
                <th>Total Rake</th>
                <th>Uploaded At</th>
                <th>Download</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.fileName}</td>
                  <td>{r.periodStart} to {r.periodEnd}</td>
                  <td className="positive">{Math.round(parseFloat(r.totalRake))}</td>
                  <td style={{ color: '#64748b' }}>{r.uploadedAt?.replace('T', ' ').substring(0, 16)}</td>
                  <td>
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(r.id, r.fileName); }}
                      style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                    >
                      Download
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(r.id, r.fileName)}
                      style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Remove
                    </button>
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
