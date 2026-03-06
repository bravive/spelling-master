import { C, s } from '../shared';

export const NumPad = ({ value, onChange, onSubmit }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: i < value.length ? C.yellow : 'transparent', border: `2px solid ${C.yellow}`, transition: 'background 0.15s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 10 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 24, padding: '14px 0', borderRadius: 12 }}
            onClick={() => value.length < 4 && onChange(value + n)}>
            {n}
          </button>
        ))}
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 20, padding: '14px 0' }}
          onClick={() => onChange('')}>C</button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 24, padding: '14px 0' }}
          onClick={() => value.length < 4 && onChange(value + '0')}>0</button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 20, padding: '14px 0' }}
          onClick={() => onChange(value.slice(0, -1))}>⌫</button>
      </div>
      {value.length === 4 && (
        <button style={{ ...s.btn(C.green, 'lg'), width: '100%' }} onClick={() => onSubmit(value)}>
          Enter →
        </button>
      )}
    </div>
  );
};
