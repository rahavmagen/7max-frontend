import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';
import { useAuth } from '../auth/AuthContext';

/* ─── Parse raw OCR text from a ClubGG player list screenshot ─── */
function parseOcrNames(text, debug = false) {
  const UI = /^(rank|players?|bounty|chips?|tables?|information|blinds?|prize|satellites?|register|host\s*option|early|bird|mtt|7max|max7|players\s+tables|total\s+players?)/i;
  // Maps lowercase → original for case-insensitive dedup
  const seen = new Map();
  const log = debug ? (...a) => console.log(...a) : () => {};

  for (let raw of text.split('\n')) {
    let line = raw.trim();
    if (!line) continue;

    // PRIMARY: ClubGG format "- PlayerName - 28,750(287.5 BB)"
    // The leading dash/rank is OPTIONAL — OCR may omit it.
    // Requires: name followed by " - digits(BB)" to confirm it's a player row.
    const primary = line.match(/^(?:[-—\s]*\d*\s*[-—.]\s*)?(.+?)\s*[-—]\s*[\d,]+(?:\.\d+)?\s*(?:\(.*?BB.*?\))?\s*$/i);
    if (primary) {
      const name = primary[1].trim();
      if (
        name.length >= 2 && name.length <= 35 &&
        !UI.test(name) &&
        !/[\u0590-\u05FF]/.test(name) &&
        !/^[\d,\.\s\-]+$/.test(name)  // not a pure number/dash line
      ) {
        const key = name.toLowerCase();
        if (!seen.has(key)) { seen.set(key, name); log('[PRIMARY]', name); }
        else log('[DUP primary]', name);
      } else {
        log('[PRIMARY skip]', name, '← failed name validation');
      }
      continue; // primary matched the row format — don't fall through
    }

    // FALLBACK: lines without chip count (OCR split columns, name only)
    line = line.replace(/^[-—\s]*\d+\s*[-—.]\s*/, '').trim();
    if (!line) continue;
    if (UI.test(line)) { log('[SKIP ui]', line); continue; }
    if (/[\d,]+\s*BB/i.test(line)) { log('[SKIP BB]', line); continue; }
    if (/[\u0590-\u05FF]/.test(line)) { log('[SKIP hebrew]', line); continue; }
    if (/^[\d,\.\s]+$/.test(line)) { log('[SKIP digits]', line); continue; }
    // Note: intentionally NOT filtering \d{3,} here — names like ramik300, lp1976 are valid
    // Chip counts in fallback context are already blocked by the comma rule below
    if (/,/.test(line)) { log('[SKIP comma]', line); continue; }
    if (line.length < 2 || line.length > 35) { log('[SKIP len]', line); continue; }

    const key = line.toLowerCase();
    if (!seen.has(key)) { seen.set(key, line); log('[FALLBACK]', line); }
    else log('[DUP fallback]', line);
  }
  log('[TOTAL]', seen.size, [...seen.values()]);
  return [...seen.values()];
}

/* ─── colours cycling through segments ─── */
const SEG_COLORS = [
  '#6a0000','#0d3a1a','#0d1040','#3a2200','#2a0a30',
  '#003a3a','#1a3a00','#3a0020','#1a1a00','#00183a',
];

function lighten(hex, amt) {
  return `rgb(${Math.min(255,parseInt(hex.slice(1,3),16)+amt)},${Math.min(255,parseInt(hex.slice(3,5),16)+amt)},${Math.min(255,parseInt(hex.slice(5,7),16)+amt)})`;
}
function easeOut(t) { return 1 - Math.pow(1 - t, 4.5); }

/* ─── File parsing helpers ─── */
function extractColumn(data, colIdx) {
  const SKIP = /^(send chips|claim chips|trade type|nickname|player|name|date|type|\d{4}[-/])/i;
  const seen = new Set();
  for (const row of data) {
    const val = String(row[colIdx] ?? '').trim();
    if (val.length >= 2 && val.length <= 30 && !SKIP.test(val) && !/^\d+(\.\d+)?$/.test(val))
      seen.add(val);
  }
  return [...seen];
}

function findBestColumn(data) {
  if (!data.length) return [];
  const maxCols = Math.max(...data.map(r => (Array.isArray(r) ? r.length : 0)));
  let best = -1, bestScore = 0;
  for (let c = 0; c < Math.min(maxCols, 25); c++) {
    const vals = new Set();
    for (const row of data) {
      const v = String(row[c] ?? '').trim();
      if (v.length >= 2 && v.length <= 30 && !/^\d+(\.\d+)?$/.test(v) && !/^\d{4}/.test(v)) vals.add(v);
    }
    if (vals.size > bestScore) { bestScore = vals.size; best = c; }
  }
  return best >= 0 ? extractColumn(data, best) : [];
}

async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    const names = text.split(/[\n\r,]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40);
    return [...new Set(names)];
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (data.length < 3) continue;
    // Try ClubGG column P (index 15) first
    const fromP = extractColumn(data, 15);
    if (fromP.length >= 3) return fromP;
    const best = findBestColumn(data);
    if (best.length >= 3) return best;
  }
  return [];
}

/* ═══════════════════════════════════════════════════════ */
export default function Wheel() {
  const { auth } = useAuth();

  const [step, setStep]             = useState('upload'); // upload | review | spin
  const [allPlayers, setAllPlayers] = useState([]);
  const [selected, setSelected]     = useState(new Set());
  const [editingName, setEditingName] = useState(null);   // name being edited
  const [editValue, setEditValue]   = useState('');
  const [addingName, setAddingName] = useState('');       // new name input
  const [wheelPlayers, setWheelPlayers] = useState([]);
  const [winner, setWinner]         = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [history, setHistory]       = useState([]);
  const [spinning, setSpinning]     = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [parseError, setParseError] = useState('');
  const [manualText, setManualText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrImages, setOcrImages]   = useState([]); // preview URLs

  const canvasRef    = useRef(null);
  const rotRef       = useRef(0);
  const animRef      = useRef(null);
  const audioRef     = useRef(null);
  const logoRef      = useRef(null);
  const recorderRef  = useRef(null);
  const chunksRef    = useRef([]);
  const [videoUrl, setVideoUrl] = useState(null);

  const SIZE = 480, CX = 240, CY = 240, R = 218;

  /* ─── preload logo ─── */
  useEffect(() => {
    const img = new Image();
    img.src = '/7maxlogo.png';
    img.onload = () => { logoRef.current = img; };
  }, []);

  /* ─── canvas draw ─── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || wheelPlayers.length === 0) return;
    const ctx  = canvas.getContext('2d');
    const N    = wheelPlayers.length;
    const SEG  = (2 * Math.PI) / N;
    const rot  = rotRef.current;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Outer decorative rings
    ctx.beginPath(); ctx.arc(CX,CY,R+14,0,2*Math.PI); ctx.fillStyle='#2a1a00'; ctx.fill();
    ctx.beginPath(); ctx.arc(CX,CY,R+11,0,2*Math.PI);
    const gr = ctx.createLinearGradient(CX-R,CY-R,CX+R,CY+R);
    gr.addColorStop(0,'#FFF080'); gr.addColorStop(0.25,'#9a7010');
    gr.addColorStop(0.5,'#FFD700'); gr.addColorStop(0.75,'#9a7010'); gr.addColorStop(1,'#FFF080');
    ctx.fillStyle = gr; ctx.fill();
    ctx.beginPath(); ctx.arc(CX,CY,R+2,0,2*Math.PI); ctx.fillStyle='#3a2800'; ctx.fill();

    // Tick marks
    for (let i = 0; i < N * 2; i++) {
      const a = (i * Math.PI) / N + rot;
      ctx.beginPath();
      ctx.moveTo(CX+(R+3)*Math.cos(a), CY+(R+3)*Math.sin(a));
      ctx.lineTo(CX+(R+11)*Math.cos(a), CY+(R+11)*Math.sin(a));
      ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1.5; ctx.stroke();
    }

    // Segments
    for (let i = 0; i < N; i++) {
      const sa = rot + i*SEG, ea = sa+SEG, mid = sa+SEG/2;
      const col = SEG_COLORS[i % SEG_COLORS.length];
      ctx.beginPath(); ctx.moveTo(CX,CY); ctx.arc(CX,CY,R,sa,ea); ctx.closePath();
      const sg = ctx.createRadialGradient(CX+R*0.45*Math.cos(mid),CY+R*0.45*Math.sin(mid),0,CX,CY,R);
      sg.addColorStop(0, lighten(col,22)); sg.addColorStop(1, col);
      ctx.fillStyle=sg; ctx.fill();
      ctx.strokeStyle='rgba(184,134,11,0.7)'; ctx.lineWidth=1; ctx.stroke();

      // Name text
      ctx.save();
      ctx.translate(CX,CY); ctx.rotate(mid);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,R-1,-SEG/2,SEG/2); ctx.closePath(); ctx.clip();
      const name = wheelPlayers[i];
      const fs = name.length > 13 ? 8 : name.length > 9 ? 9.5 : 11;
      ctx.font = `700 ${fs}px Rajdhani, sans-serif`;
      ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=4;
      ctx.textAlign='right'; ctx.textBaseline='middle';
      ctx.fillText(name, R-9, 0);
      ctx.restore();
    }

    // Radial shadow overlay
    const sh = ctx.createRadialGradient(CX,CY,0,CX,CY,R);
    sh.addColorStop(0,'rgba(0,0,0,0.35)'); sh.addColorStop(0.35,'rgba(0,0,0,0)'); sh.addColorStop(1,'rgba(0,0,0,0.3)');
    ctx.beginPath(); ctx.arc(CX,CY,R,0,2*Math.PI); ctx.fillStyle=sh; ctx.fill();

    // Hub rings
    [{r:38,c:'#2a1800'},{r:34,c:'#8B6914'},{r:30,c:'#3a2200'}].forEach(({r,c})=>{
      ctx.beginPath(); ctx.arc(CX,CY,r,0,2*Math.PI); ctx.fillStyle=c; ctx.fill();
    });
    ctx.beginPath(); ctx.arc(CX,CY,28,0,2*Math.PI);
    const hg = ctx.createRadialGradient(CX-6,CY-6,0,CX,CY,28);
    hg.addColorStop(0,'#FFF8C0'); hg.addColorStop(0.5,'#FFD700'); hg.addColorStop(1,'#8B6014');
    ctx.fillStyle=hg; ctx.fill();

    // Hub logo / text
    ctx.shadowColor='transparent'; ctx.shadowBlur=0;
    if (logoRef.current) {
      ctx.save(); ctx.beginPath(); ctx.arc(CX,CY,24,0,2*Math.PI); ctx.clip();
      ctx.drawImage(logoRef.current, CX-22, CY-22, 44, 44); ctx.restore();
    } else {
      ctx.font='bold 8px serif'; ctx.fillStyle='#1a0900';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('7MAX',CX,CY);
    }

    // Center pin
    ctx.beginPath(); ctx.arc(CX,CY,4,0,2*Math.PI);
    const pg = ctx.createRadialGradient(CX-1,CY-1,0,CX,CY,4);
    pg.addColorStop(0,'#fff'); pg.addColorStop(1,'#8B6014');
    ctx.fillStyle=pg; ctx.fill();
  }, [wheelPlayers]);

  useEffect(() => {
    if (step === 'spin' && wheelPlayers.length > 0) draw();
  }, [wheelPlayers, step, draw]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  /* ─── audio helpers ─── */
  const getAC = () => {
    if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioRef.current;
  };
  const playTick = useCallback((vel) => {
    try {
      const ac=getAC(), o=ac.createOscillator(), g=ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type='triangle'; o.frequency.value=800+Math.random()*300;
      const v=Math.min(0.07,Math.abs(vel)*0.002);
      g.gain.setValueAtTime(v,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.05);
      o.start(ac.currentTime); o.stop(ac.currentTime+0.06);
    } catch(_){}
  }, []);
  const playWin = useCallback(() => {
    try {
      const ac=getAC();
      [523,659,784,1047,1319].forEach((f,i)=>{
        const o=ac.createOscillator(),g=ac.createGain();
        o.connect(g); g.connect(ac.destination); o.type='sine'; o.frequency.value=f;
        const t=ac.currentTime+i*0.1;
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.12,t+0.02); g.gain.exponentialRampToValueAtTime(0.001,t+0.5);
        o.start(t); o.stop(t+0.55);
      });
    } catch(_){}
  }, []);

  /* ─── get winner from current rotation ─── */
  const getWinner = useCallback(() => {
    const N = wheelPlayers.length;
    if (!N) return '';
    const SEG = (2*Math.PI)/N;
    const a = ((-Math.PI/2 - rotRef.current) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
    return wheelPlayers[Math.floor(a/SEG) % N];
  }, [wheelPlayers]);

  /* ─── spin ─── */
  const spin = useCallback(() => {
    if (spinning || wheelPlayers.length < 2) return;
    setSpinning(true); setShowWinner(false); setWinner(null); setVideoUrl(null);

    // Start video recording
    try {
      if (canvasRef.current && window.MediaRecorder) {
        const stream = canvasRef.current.captureStream(30);
        const mimeType = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          setVideoUrl(URL.createObjectURL(blob));
        };
        recorder.start();
        recorderRef.current = recorder;
      }
    } catch(_) {}

    const N   = wheelPlayers.length;
    const SEG = (2*Math.PI)/N;
    const startRot  = rotRef.current;
    const targetRot = startRot + (9+Math.random()*4)*2*Math.PI + Math.random()*2*Math.PI;
    const duration  = 5800 + Math.random()*2000;
    const t0 = performance.now();
    let lastCross = Math.floor(startRot/SEG);

    const frame = (now) => {
      const t    = Math.min((now-t0)/duration, 1);
      const prev = rotRef.current;
      rotRef.current = startRot + (targetRot-startRot)*easeOut(t);
      draw();
      const curr = Math.floor(rotRef.current/SEG);
      if (curr !== lastCross) { playTick(rotRef.current-prev); lastCross=curr; }
      if (t < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        rotRef.current = targetRot; draw();
        setSpinning(false);
        const w = getWinner();
        setWinner(w);
        setHistory(h => [{ name:w, time: new Date().toLocaleTimeString('he-IL') }, ...h.slice(0,9)]);
        // Stop recording before showing winner (small delay so last frame is captured)
        setTimeout(() => {
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          }
          setShowWinner(true);
        }, 400);
        playWin();
      }
    };
    animRef.current = requestAnimationFrame(frame);
  }, [spinning, wheelPlayers, draw, getWinner, playTick, playWin]);

  /* ─── file / manual handlers ─── */
  const isImage = (file) => /^image\//i.test(file.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);

  const handleFiles = async (files) => {
    const fileArr = Array.from(files);
    setParseError('');

    // Separate images from data files
    const images = fileArr.filter(isImage);
    const dataFiles = fileArr.filter(f => !isImage(f));

    if (images.length > 0) {
      // OCR path
      setOcrLoading(true);
      setOcrProgress(0);
      setOcrImages(images.map(f => URL.createObjectURL(f)));
      try {
        const allNames = new Set();
        for (let i = 0; i < images.length; i++) {
          const worker = await createWorker('eng', 1, {
            logger: m => {
              if (m.status === 'recognizing text')
                setOcrProgress(Math.round(((i + m.progress) / images.length) * 100));
            },
          });
          const { data: { text } } = await worker.recognize(images[i]);
          await worker.terminate();
          console.log(`[OCR raw image ${i+1}]:\n`, text);
          parseOcrNames(text, true).forEach(n => allNames.add(n));
        }
        const names = [...allNames];
        if (!names.length) { setParseError('Could not read player names from image. Try the manual entry option.'); setOcrLoading(false); return; }
        setAllPlayers(names); setSelected(new Set(names));
        setOcrLoading(false); setStep('review');
      } catch(e) { setParseError('OCR failed: ' + e.message); setOcrLoading(false); }
      return;
    }

    if (dataFiles.length > 0) {
      try {
        const names = await parseFile(dataFiles[0]);
        if (!names.length) { setParseError('No player names found. Try a CSV with one name per line.'); return; }
        setAllPlayers(names); setSelected(new Set(names)); setStep('review');
      } catch(e) { setParseError('Failed to parse: ' + e.message); }
    }
  };

  const handleFile = (file) => handleFiles([file]);

  const handleManual = () => {
    const names = [...new Set(manualText.split(/[\n,]+/).map(s=>s.trim()).filter(s=>s.length>1))];
    if (!names.length) { setParseError('Enter at least one name.'); return; }
    setAllPlayers(names); setSelected(new Set(names)); setStep('review');
  };

  const handleApprove = () => {
    const list = allPlayers.filter(p => selected.has(p));
    if (list.length < 2) { setParseError('Select at least 2 players.'); return; }
    setWheelPlayers(list); setWinner(null); setShowWinner(false);
    rotRef.current = 0; setStep('spin');
  };

  const shareWhatsApp = () => {
    if (!winner) return;
    const msg = `🎡 *7MAX Wheel of Fortune*\n━━━━━━━━━━━━━━\n🏆 *${winner}* wins!\n━━━━━━━━━━━━━━\n♠ ♥ ♦ ♣  Congratulations! 🎉`;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  };

  const resetToUpload = () => {
    setStep('upload'); setAllPlayers([]); setSelected(new Set());
    setWheelPlayers([]); setWinner(null); setShowWinner(false);
    setHistory([]); setManualText(''); setParseError('');
    setOcrImages([]); setOcrLoading(false); setOcrProgress(0);
    setVideoUrl(null);
  };

  /* ─── shared styles ─── */
  const gold = '#FFD700', goldDark = '#B8860B';
  const card  = { background:'#12151f', border:'1px solid #2d3148', borderRadius:'8px', padding:'1.5rem' };
  const btn   = (active) => ({
    background: active ? 'linear-gradient(180deg,#FFE566 0%,#FFD700 40%,#B8860B 75%,#8B6914 100%)' : '#1a1d2e',
    color: active ? '#1a0900' : '#94a3b8',
    border: active ? 'none' : '1px solid #2d3148',
    padding:'10px 28px', borderRadius:'4px', cursor:'pointer',
    fontFamily:'Cinzel, serif', fontWeight:600, fontSize:'0.9rem', letterSpacing:'0.1em',
    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.25)' : 'none',
  });

  /* ════════════════════ RENDER ════════════════════ */

  /* Step: upload */
  if (step === 'upload') return (
    <div style={{ maxWidth:'580px', margin:'0 auto', padding:'2rem 1rem' }}>
      <h1 style={{ fontFamily:'Cinzel Decorative, serif', color:gold, fontSize:'1.6rem', marginBottom:'0.3rem',
                   filter:'drop-shadow(0 0 12px rgba(255,215,0,0.3))' }}>
        🎡 Wheel of Fortune
      </h1>
      <p style={{ color:'#64748b', fontSize:'0.85rem', marginBottom:'1.5rem' }}>Admin only — upload a screenshot or player list then spin</p>

      {/* OCR loading overlay */}
      {ocrLoading && (
        <div style={{ ...card, textAlign:'center', marginBottom:'1rem' }}>
          <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🔍</div>
          <div style={{ color:gold, fontWeight:600, marginBottom:'0.75rem' }}>Reading player names from image…</div>
          <div style={{ background:'#0f1117', borderRadius:'4px', overflow:'hidden', height:'8px' }}>
            <div style={{ background:`linear-gradient(90deg,${gold},${goldDark})`, height:'100%',
                          width:`${ocrProgress}%`, transition:'width 0.3s' }} />
          </div>
          <div style={{ color:'#64748b', fontSize:'0.8rem', marginTop:'0.5rem' }}>{ocrProgress}%</div>
          {ocrImages.length > 0 && (
            <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginTop:'0.75rem', flexWrap:'wrap' }}>
              {ocrImages.map((src,i) => (
                <img key={i} src={src} style={{ height:'80px', borderRadius:'4px', border:`1px solid #2d3148` }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drag & drop zone */}
      {!ocrLoading && (
        <div
          onDragOver={e=>{e.preventDefault();setDragOver(true)}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);if(e.dataTransfer.files.length)handleFiles(e.dataTransfer.files);}}
          onClick={()=>document.getElementById('wFileInput').click()}
          style={{
            border:`2px dashed ${dragOver?gold:'#2d3148'}`,
            borderRadius:'8px', padding:'3rem 2rem',
            textAlign:'center', cursor:'pointer',
            background: dragOver?'rgba(255,215,0,0.05)':'#0f1117',
            transition:'all 0.2s',
          }}
        >
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>📸</div>
          <div style={{ color:dragOver?gold:'#e2e8f0', fontWeight:600, marginBottom:'0.5rem' }}>
            Drop screenshot(s) here or click to browse
          </div>
          <div style={{ color:'#64748b', fontSize:'0.8rem', marginBottom:'0.4rem' }}>
            📷 WhatsApp screenshots (JPG/PNG) — names read automatically via OCR
          </div>
          <div style={{ color:'#475569', fontSize:'0.75rem' }}>
            Also accepts .xlsx, .xls, .csv, .txt — select multiple images for multi-page lists
          </div>
          <input id="wFileInput" type="file" multiple
            accept=".xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.webp,.bmp"
            style={{display:'none'}}
            onChange={e=>{if(e.target.files.length)handleFiles(e.target.files);}} />
        </div>
      )}

      {/* Manual input toggle */}
      <div style={{ marginTop:'1rem', textAlign:'center' }}>
        <button onClick={()=>setShowManual(v=>!v)}
          style={{ background:'none', border:'none', color:goldDark, cursor:'pointer',
                   fontSize:'0.85rem', textDecoration:'underline' }}>
          {showManual ? '▲ Hide' : '✏️ Enter names manually'}
        </button>
      </div>
      {showManual && (
        <div style={{ marginTop:'0.75rem' }}>
          <textarea
            value={manualText}
            onChange={e=>setManualText(e.target.value)}
            placeholder="One name per line, or comma-separated&#10;e.g.&#10;piu piu 7&#10;kashmish&#10;Einpoker"
            style={{ width:'100%', height:'140px', background:'#0f1117', border:'1px solid #2d3148',
                     borderRadius:'6px', color:'#e2e8f0', padding:'10px', fontSize:'0.9rem',
                     resize:'vertical', fontFamily:'monospace' }}
          />
          <button onClick={handleManual} style={{...btn(true), marginTop:'0.5rem'}}>
            Load Names
          </button>
        </div>
      )}
      {parseError && <div style={{ color:'#ef4444', marginTop:'0.75rem', fontSize:'0.85rem' }}>{parseError}</div>}
    </div>
  );

  /* ─── review helpers ─── */
  const commitEdit = (oldName) => {
    const v = editValue.trim();
    if (!v || v === oldName) { setEditingName(null); return; }
    setAllPlayers(p => p.map(n => n === oldName ? v : n));
    setSelected(p => { const s = new Set(p); if (s.has(oldName)) { s.delete(oldName); s.add(v); } return s; });
    setEditingName(null);
  };
  const deleteName = (name) => {
    setAllPlayers(p => p.filter(n => n !== name));
    setSelected(p => { const s = new Set(p); s.delete(name); return s; });
  };
  const addName = () => {
    const v = addingName.trim();
    if (!v || allPlayers.includes(v)) { setAddingName(''); return; }
    setAllPlayers(p => [...p, v]);
    setSelected(p => new Set([...p, v]));
    setAddingName('');
  };

  /* Step: review */
  if (step === 'review') return (
    <div style={{ maxWidth:'640px', margin:'0 auto', padding:'2rem 1rem' }}>
      <h1 style={{ fontFamily:'Cinzel Decorative, serif', color:gold, fontSize:'1.4rem', marginBottom:'0.25rem' }}>
        Review Players
      </h1>
      <p style={{ color:'#64748b', fontSize:'0.85rem', marginBottom:'1.5rem' }}>
        {allPlayers.length} players found — uncheck to exclude, ✏️ to rename, 🗑 to delete
      </p>

      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
        <button onClick={()=>setSelected(new Set(allPlayers))} style={{...btn(false), padding:'6px 14px', fontSize:'0.8rem'}}>✓ All</button>
        <button onClick={()=>setSelected(new Set())} style={{...btn(false), padding:'6px 14px', fontSize:'0.8rem'}}>✗ None</button>
        <span style={{ color:'#64748b', marginLeft:'auto', alignSelf:'center', fontSize:'0.85rem' }}>
          {selected.size} selected
        </span>
      </div>

      <div style={{ ...card, maxHeight:'420px', overflowY:'auto', marginBottom:'1rem' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          {allPlayers.map(name => (
            <div key={name} style={{
              display:'flex', alignItems:'center', gap:'8px', padding:'5px 8px',
              borderRadius:'4px',
              background: selected.has(name)?'rgba(255,215,0,0.05)':'transparent',
              border:'1px solid', borderColor: selected.has(name)?'rgba(255,215,0,0.2)':'transparent',
            }}>
              <input type="checkbox" checked={selected.has(name)}
                onChange={()=>{ setSelected(p=>{const n=new Set(p); n.has(name)?n.delete(name):n.add(name); return n; }); }}
                style={{ accentColor:gold, flexShrink:0 }} />

              {editingName === name ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e=>setEditValue(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') commitEdit(name); if(e.key==='Escape') setEditingName(null); }}
                    style={{ flex:1, background:'#0f1117', border:'1px solid '+gold, borderRadius:'4px',
                             color:'#e2e8f0', padding:'2px 6px', fontSize:'0.9rem' }}
                  />
                  <button onClick={()=>commitEdit(name)} style={{ background:gold, color:'#1a0900', border:'none',
                    borderRadius:'3px', padding:'2px 8px', cursor:'pointer', fontSize:'0.8rem', fontWeight:700 }}>✓</button>
                  <button onClick={()=>setEditingName(null)} style={{ background:'#2d3148', color:'#94a3b8', border:'none',
                    borderRadius:'3px', padding:'2px 8px', cursor:'pointer', fontSize:'0.8rem' }}>✗</button>
                </>
              ) : (
                <>
                  <span style={{ flex:1, color: selected.has(name)?'#e2e8f0':'#64748b', fontSize:'0.9rem' }}>{name}</span>
                  <button onClick={()=>{ setEditingName(name); setEditValue(name); }} title="Rename"
                    style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'0.9rem', padding:'0 2px' }}>✏️</button>
                  <button onClick={()=>deleteName(name)} title="Delete"
                    style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'0.9rem', padding:'0 2px' }}>🗑</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add new name */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
        <input
          value={addingName}
          onChange={e=>setAddingName(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') addName(); }}
          placeholder="Add a missing name…"
          style={{ flex:1, background:'#0f1117', border:'1px solid #2d3148', borderRadius:'4px',
                   color:'#e2e8f0', padding:'7px 10px', fontSize:'0.9rem' }}
        />
        <button onClick={addName} disabled={!addingName.trim()}
          style={{...btn(!!addingName.trim()), padding:'7px 16px', fontSize:'0.85rem', opacity: addingName.trim()?1:0.4}}>
          + Add
        </button>
      </div>

      {parseError && <div style={{ color:'#ef4444', marginBottom:'0.75rem', fontSize:'0.85rem' }}>{parseError}</div>}

      <div style={{ display:'flex', gap:'0.75rem' }}>
        <button onClick={()=>setStep('upload')} style={btn(false)}>← Back</button>
        <button onClick={handleApprove} style={{...btn(true), opacity: selected.size<2?0.5:1}}>
          🎡 Start Wheel ({selected.size} players)
        </button>
      </div>
    </div>
  );

  /* Step: spin */
  return (
    <div style={{ padding:'1.5rem 1rem', display:'flex', gap:'2rem', flexWrap:'wrap', justifyContent:'center', maxWidth:'960px', margin:'0 auto' }}>

      {/* Left: wheel */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>
        <h1 style={{ fontFamily:'Cinzel Decorative, serif', color:gold, fontSize:'1.5rem', margin:0,
                     filter:'drop-shadow(0 0 12px rgba(255,215,0,0.3))' }}>
          Wheel of Fortune
        </h1>

        {/* Wheel canvas */}
        <div style={{ position:'relative' }}>
          {/* Pointer */}
          <div style={{ position:'absolute', top:'-4px', left:'50%', transform:'translateX(-50%)', zIndex:10,
                        display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{ width:'12px', height:'12px', borderRadius:'50%',
                          background:'radial-gradient(circle at 35% 35%,#FFF8C0,#FFD700 50%,#8B6914)',
                          boxShadow:'0 0 10px rgba(255,215,0,0.7)' }} />
            <div style={{ width:0, height:0,
                          borderLeft:'10px solid transparent', borderRight:'10px solid transparent',
                          borderTop:`32px solid ${gold}`,
                          filter:'drop-shadow(0 3px 6px rgba(0,0,0,0.9))', marginTop:'-2px' }} />
          </div>

          <canvas ref={canvasRef} width={SIZE} height={SIZE}
            style={{ borderRadius:'50%',
                     boxShadow:`0 0 0 6px #7a5800,0 0 0 10px #3a2800,0 0 0 13px #8B6914,0 0 40px rgba(0,0,0,0.9),${spinning?'0 0 60px rgba(255,215,0,0.15)':''}`,
                     transition:'box-shadow 0.3s' }} />
        </div>

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={spinning}
          style={{
            ...btn(!spinning),
            padding:'13px 44px', fontSize:'1rem', letterSpacing:'0.2em',
            opacity: spinning ? 0.5 : 1,
            boxShadow: !spinning ? '0 2px 0 #4a3200,0 4px 0 #2a1800,0 6px 0 #0a0600,0 8px 18px rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
          }}
        >
          {spinning ? '⟳  Spinning...' : '◆  SPIN THE WHEEL  ◆'}
        </button>

        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={()=>setStep('review')} style={{...btn(false), padding:'7px 16px', fontSize:'0.8rem'}}>← Edit List</button>
          <button onClick={resetToUpload} style={{...btn(false), padding:'7px 16px', fontSize:'0.8rem'}}>↺ New Session</button>
        </div>
      </div>

      {/* Right: history */}
      <div style={{ minWidth:'200px', maxWidth:'240px', flex:1 }}>
        <div style={{ ...card, marginBottom:'1rem' }}>
          <div style={{ color:goldDark, fontFamily:'Cinzel, serif', fontSize:'0.85rem',
                        letterSpacing:'0.15em', marginBottom:'0.75rem' }}>
            {wheelPlayers.length} PLAYERS
          </div>
          <div style={{ maxHeight:'200px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'3px' }}>
            {wheelPlayers.map(p => (
              <div key={p} style={{ color:'#94a3b8', fontSize:'0.8rem', padding:'3px 6px',
                                     borderRadius:'3px', background:'rgba(255,255,255,0.03)' }}>
                {p}
              </div>
            ))}
          </div>
        </div>

        {history.length > 0 && (
          <div style={card}>
            <div style={{ color:goldDark, fontFamily:'Cinzel, serif', fontSize:'0.85rem',
                          letterSpacing:'0.15em', marginBottom:'0.75rem' }}>
              PAST WINNERS
            </div>
            {history.map((h, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                                     padding:'5px 0', borderBottom:'1px solid #1a1d2e' }}>
                <span style={{ color: i===0?gold:'#94a3b8', fontWeight: i===0?700:400, fontSize:'0.85rem' }}>
                  {i===0?'🏆 ':''}{h.name}
                </span>
                <span style={{ color:'#475569', fontSize:'0.75rem' }}>{h.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Winner overlay */}
      {showWinner && winner && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(2,8,4,0.93)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:200, animation:'fadeIn 0.4s ease',
        }}
          onClick={()=>setShowWinner(false)}
        >
          <div onClick={e=>e.stopPropagation()} style={{
            textAlign:'center', padding:'56px 72px',
            border:'1px solid rgba(255,215,0,0.25)',
            background:'radial-gradient(ellipse at 50% 0%,rgba(255,215,0,0.1) 0%,transparent 55%)',
            borderRadius:'4px', animation:'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ fontFamily:'Cinzel, serif', fontSize:'0.8rem', letterSpacing:'0.6em',
                          color:goldDark, marginBottom:'16px' }}>🏆  WINNER  🏆</div>
            <div style={{ fontSize:'2rem', letterSpacing:'0.5em', color:gold, marginBottom:'12px' }}>♠ ♥ ♦ ♣</div>
            <div style={{
              fontFamily:'Cinzel Decorative, serif', fontSize:'clamp(1.8rem,4vw,3.2rem)', fontWeight:900,
              background:'linear-gradient(180deg,#FFFACC 0%,#FFD700 45%,#B8860B 100%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
              filter:'drop-shadow(0 0 24px rgba(255,215,0,0.45))', lineHeight:1.15,
              maxWidth:'500px', wordBreak:'break-word',
            }}>
              {winner}
            </div>
            <div style={{ color:'rgba(255,215,0,0.4)', letterSpacing:'0.3em', fontSize:'0.9rem', marginTop:'16px' }}>
              CONGRATULATIONS
            </div>

            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center', marginTop:'36px', flexWrap:'wrap' }}>
              <button onClick={shareWhatsApp} style={{
                background:'#25D366', color:'#fff', border:'none',
                padding:'11px 28px', borderRadius:'4px', cursor:'pointer',
                fontWeight:700, fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'8px',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share on WhatsApp
              </button>
              {videoUrl && (
                <a href={videoUrl} download={`wheel-${winner}.webm`} style={{
                  background:'linear-gradient(180deg,#3a6fd8 0%,#1e40af 100%)', color:'#fff',
                  padding:'11px 28px', borderRadius:'4px', cursor:'pointer',
                  fontWeight:700, fontSize:'0.95rem', display:'flex', alignItems:'center', gap:'8px',
                  textDecoration:'none',
                }}>
                  ⬇ Save Video (.webm)
                </a>
              )}
              {!videoUrl && (
                <div style={{ color:'#475569', fontSize:'0.8rem', alignSelf:'center', fontStyle:'italic' }}>
                  Preparing video…
                </div>
              )}
              <button onClick={()=>{setShowWinner(false);}} style={{...btn(false), padding:'11px 20px'}}>
                Close
              </button>
              <button onClick={()=>{setShowWinner(false); setWinner(null);}} style={{...btn(false), padding:'11px 20px'}}>
                Spin Again
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popIn  { from{transform:scale(0.75) translateY(20px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
      `}</style>
    </div>
  );
}
