import { useState, useEffect } from 'react';
import { isoToDisplay, displayToIso } from '../utils/dates';

const defaultStyle = {
  background: '#1e2130',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '0.35rem 0.6rem',
  fontSize: '0.85rem',
};

/**
 * Date input that accepts manual typing in dd/mm/yyyy format.
 * value / onChange use ISO yyyy-mm-dd strings (same as <input type="date">).
 */
export default function DateInput({ value, onChange, style, placeholder = 'dd/mm/yyyy', ...props }) {
  const [text, setText] = useState(value ? isoToDisplay(value) : '');

  useEffect(() => {
    setText(value ? isoToDisplay(value) : '');
  }, [value]);

  const handleChange = (e) => {
    let raw = e.target.value;
    // Auto-insert slashes
    if (/^\d{2}$/.test(raw) && text.length === 1) raw = raw + '/';
    if (/^\d{2}\/\d{2}$/.test(raw) && text.length === 4) raw = raw + '/';
    setText(raw);
    if (raw === '') { onChange(''); return; }
    const iso = displayToIso(raw);
    if (iso) onChange(iso);
  };

  const handleBlur = () => {
    // On blur, if value is set, normalise display; if invalid clear it
    if (value) {
      setText(isoToDisplay(value));
    } else {
      setText('');
    }
  };

  return (
    <input
      type="text"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      maxLength={10}
      style={{ ...defaultStyle, ...style }}
      {...props}
    />
  );
}
