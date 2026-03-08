import { useState } from 'react';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: i < value.length ? C.yellow : 'transparent', border: `2px solid ${C.yellow}`, transition: 'background 0.15s' }} />
        ))}
      </div>
      {pinErr && <div style={{ color: C.red, fontSize: 13 }}>{pinErr}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 10 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 24, padding: '14px 0', borderRadius: 12 }}
            onClick={() => { setPinErr(''); value.length < 4 && onChange(value + n); }}>
            {n}
          </button>
        ))}
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 20, padding: '14px 0' }}
          onClick={() => { setPinErr(''); onChange(''); }}>C</button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 24, padding: '14px 0' }}
          onClick={() => { setPinErr(''); value.length < 4 && onChange(value + '0'); }}>0</button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 20, padding: '14px 0' }}
          onClick={() => { setPinErr(''); onChange(value.slice(0, -1)); }}>⌫</button>
      </div>
      {value.length === 4 && (
        <button style={{ ...s.btn(C.green, 'lg'), width: '100%' }} onClick={handleSubmit}>
          Enter →
        </button>
      )}
    </div>
  );
};
