import { useState, useEffect } from 'react';
import { C, s } from '../shared';

export const NumPad = ({ value, onChange, onSubmit, noAllSame }) => {
  const [pinErr, setPinErr] = useState('');

  const handleSubmit = () => {
    if (noAllSame && value.split('').every(d => d === value[0])) {
      setPinErr('PIN can\'t be all the same digit');
      onChange('');
      return;
    }
    setPinErr('');
    onSubmit(value);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        setPinErr('');
        if (value.length < 6) onChange(value + e.key);
      } else if (e.key === 'Backspace') {
        setPinErr('');
        onChange(value.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (value.length === 6) handleSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [value, noAllSame]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: i < value.length ? C.yellow : 'transparent', border: `2px solid ${C.yellow}`, transition: 'background 0.15s' }} />
        ))}
      </div>
      {pinErr && <div style={{ color: C.red, fontSize: 13 }}>{pinErr}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%', maxWidth: 210 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 22, padding: '14px 0', borderRadius: 14 }}
            onClick={() => { setPinErr(''); value.length < 6 && onChange(value + n); }}>
            {n}
          </button>
        ))}
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 18, padding: '14px 0', borderRadius: 14 }}
          onClick={() => { setPinErr(''); onChange(''); }}>C</button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 22, padding: '14px 0', borderRadius: 14 }}
          onClick={() => { setPinErr(''); value.length < 6 && onChange(value + '0'); }}>0</button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 18, padding: '14px 0', borderRadius: 14 }}
          onClick={() => { setPinErr(''); onChange(value.slice(0, -1)); }}>⌫</button>
      </div>
      {value.length === 6 && (
        <button style={{ ...s.btn(C.green, 'lg'), width: '100%', maxWidth: 210 }} onClick={handleSubmit}>
          Enter →
        </button>
      )}
    </div>
  );
};
