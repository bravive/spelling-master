import { useState } from 'react';
import { C, s } from '../shared';
import { NumPad } from './NumPad';

export const AdminLoginScreen = ({ setCurrentUser, setScreen }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
      <h2 style={{ color: C.yellow, margin: '0 0 24px' }}>Admin Login</h2>
      <input
        style={{ ...s.input, marginBottom: 16 }}
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Username"
        autoFocus
      />
      <NumPad value={pin} onChange={setPin} onSubmit={(p) => {
        if (username === 'test' && p === '0000') {
          setCurrentUser('test');
          setScreen('parentMenu');
        } else {
          setError('Invalid credentials.');
          setPin('');
        }
      }} />
      {error && <div style={{ color: C.red, marginTop: 12, animation: 'shake 0.3s ease' }}>{error}</div>}
    </div>
  );
};
