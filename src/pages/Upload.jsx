import { useState, useRef, useEffect } from 'react';
import { uploadReport, getReports, deleteReport } from '../api';

export default function Upload() {
  const [dragging, setDragging] = useState(false);
  const [reports, setReports] = useState([]);
  const [queue, setQueue] = useState([]); // { file, status, msg }
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    getReports().then(r => setReports(r.data));
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
            msg: `Period: ${res.data.periodStart} → ${res.data.periodEnd} | Rake: ${res.data.totalRake}`
          };
        }
      } catch (e) {
        updated[i] = { ...updated[i], status: 'error', msg: e.response?.data?.error || 'Upload failed.' };
      }
      setQueue([...updated]);
    }

    setProcessing(false);
    getReports().then(r => setReports(r.data));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
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
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !processing && fileRef.current.click()}
          style={{ cursor: processing ? 'not-allowed' : 'pointer' }}
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
                  <td className="positive">{r.totalRake}</td>
                  <td style={{ color: '#64748b' }}>{r.uploadedAt?.replace('T', ' ').substring(0, 16)}</td>
                  <td>
                    <a
                      href={`${import.meta.env.VITE_API_URL || 'https://7max-tracker-production.up.railway.app/api'}/reports/${r.id}/download`}
                      style={{ color: '#6366f1', fontSize: '0.85rem', textDecoration: 'none' }}
                      onClick={e => e.stopPropagation()}
                    >
                      Download
                    </a>
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
