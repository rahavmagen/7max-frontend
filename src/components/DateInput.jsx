const defaultStyle = {
  background: '#1e2130',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '0.35rem 0.6rem',
  fontSize: '0.85rem',
  colorScheme: 'dark',
};

/**
 * Date input with the browser's native calendar picker.
 * value / onChange use ISO yyyy-mm-dd strings (same as <input type="date">).
 */
export default function DateInput({ value, onChange, style, ...props }) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...defaultStyle, ...style }}
      {...props}
    />
  );
}
