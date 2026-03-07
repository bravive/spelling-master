import { useState } from 'react';
import { C, s } from '../shared';
import { NumPad } from './NumPad';

export const AdminLoginScreen = ({ setCurrentUser, setScreen, setJwt }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
      <h2 style={{ color: C.yellow, margin: '0 0 24px' }}>Admin Login</h2>
      <NumPad value={pin} onChange={setPin} onSubmit={async (p) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'admin', pin: p }),
          });
          const data = await res.json();
          if (!res.ok) { setError('Invalid credentials.'); setPin(''); return; }
          setJwt(data.token);
          setCurrentUser('admin');
          setScreen('parentMenu');
        } catch {
          setError('Network error. Try again.');
          setPin('');
        }
      }} />
      {error && <div style={{ color: C.red, marginTop: 12, animation: 'shake 0.3s ease' }}>{error}</div>}
    </div>
  );
};
