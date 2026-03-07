import { useState, useRef, useEffect } from 'react';
import { C, s } from '../shared';

export const SelectUserScreen = ({ setCurrentUser, setScreen, setGameScreen, setJwt, setCreateStep, setNewName, setNewStarter, setNewPin, setConfirmPin }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef(null);

  useEffect(() => { usernameRef.current?.focus(); }, []);

  const handleLogin = async () => {
    if (!username.trim() || pin.length < 4) {
      setError('Enter your username and 4-digit PIN.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: username.trim().toLowerCase(), pin }),
      });
      const data = await res.json();
      if (!res.ok) { setError('Wrong username or PIN.'); setPin(''); setLoading(false); return; }
      setJwt(data.token);
      if (data.user?.isAdmin) { setCurrentUser('admin'); setScreen('parentMenu'); }
      else { setCurrentUser(data.user.id); setScreen('game'); setGameScreen('home'); }
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 48 }}>📖</div>
        <h1 style={{ fontSize: 36, fontWeight: 900, margin: '8px 0', color: C.yellow }}>Spell Master</h1>
        <div style={{ color: C.muted }}>Sign in to start playing!</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <input
          ref={usernameRef}
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="username"
          style={{ ...s.input, textAlign: 'center' }}
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="4-digit PIN"
          maxLength={4}
          value={pin}
          onChange={e => { const v = e.target.value.replace(/\D/g, ''); setPin(v); }}
          onKeyDown={handleKeyDown}
          autoComplete="current-password"
          style={{ ...s.input, textAlign: 'center', letterSpacing: 8 }}
        />
      </div>

      {error && <div style={{ color: C.red, marginBottom: 12, animation: 'shake 0.3s ease' }}>{error}</div>}

      <button
        style={{ ...s.btn(C.yellow, 'lg'), width: '100%', opacity: loading ? 0.6 : 1 }}
        onClick={handleLogin}
        disabled={loading}
      >
        Sign In
      </button>

      <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>Don't have an account?</div>
        <button
          style={{ ...s.btn(C.blue), width: '100%' }}
          onClick={() => { setCreateStep(0); setNewName(''); setNewStarter(null); setNewPin(''); setConfirmPin(''); setScreen('createUser'); }}
        >
          Sign Up
        </button>
      </div>
    </div>
  );
};
