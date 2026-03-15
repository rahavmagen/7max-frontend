import { useState, useRef, useEffect } from 'react';
import { uploadReport, getReports, deleteReport } from '../api';

export default function Upload() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [reports, setReports] = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    getReports().then(r => setReports(r.data));
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      setMsg({ type: 'error', text: 'Only .xlsx files are supported (ClubGG export format).' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await uploadReport(file);
      if (res.status >= 400) {
        setMsg({ type: 'error', text: res.data?.error || 'Upload failed.' });
      } else {
        setMsg({ type: 'success', text: `Uploaded! Period: ${res.data.periodStart} -> ${res.data.periodEnd} | Total Rake: ${res.data.totalRake}` });
        getReports().then(r => setReports(r.data));
      }
    } catch {
      setMsg({ type: 'error', text: 'Upload failed. Make sure it is a valid ClubGG Excel export file.' });
    }
    setLoading(false);
  };

  const handleDelete = async (id, fileName) => {
    if (!confirm(`Remove "${fileName}"?\nThis will delete all game sessions and results from this upload, and reset player chips to 0.`)) return;
    try {
      await deleteReport(id);
      setMsg({ type: 'success', text: `Removed: ${fileName}` });
      getReports().then(r => setReports(r.data));
    } catch {
      setMsg({ type: 'error', text: 'Failed to remove report.' });
    }
  };

  return (
    <div>
      <h1>Upload ClubGG Report</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Upload the daily ClubGG export file. Must include <strong>Club Member Balance</strong> tab.
      </p>

      {msg && (
        <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}

      <div className="card">
        <div
          className={`upload-area ${dragging ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current.click()}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <div style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
            {loading ? 'Processing...' : 'Drop ClubGG Excel file here or click to browse'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Required tabs: Club Overview · Ring Game Detail · MTT Detail · Club Member Balance
          </div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
        </div>
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
