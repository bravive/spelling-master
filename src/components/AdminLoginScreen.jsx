import { useState } from 'react';
import { C, s } from '../shared';

export const AdminLoginScreen = ({ setCurrentUser, setScreen, setJwt }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'admin', pin: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError('Invalid credentials.'); setPassword(''); setLoading(false); return; }
      setJwt(data.token);
      setCurrentUser('admin');
      setScreen('parentMenu');
    } catch {
      setError('Network error. Try again.');
      setPassword('');
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
      <h2 style={{ color: C.yellow, margin: '0 0 24px' }}>Admin Login</h2>
      <input
        type="password"
        placeholder="Enter admin password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        autoFocus
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid rgba(255,255,255,0.15)`,
          borderRadius: 12, color: '#fff',
          fontSize: 18, padding: '12px 16px',
          outline: 'none', marginBottom: 16,
          textAlign: 'center',
        }}
      />
      <button
        style={{ ...s.btn(C.yellow, 'lg'), width: '100%', opacity: loading ? 0.6 : 1 }}
        onClick={handleSubmit}
        disabled={loading || !password}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
      {error && <div style={{ color: C.red, marginTop: 12, animation: 'shake 0.3s ease' }}>{error}</div>}
    </div>
  );
};
