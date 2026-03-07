import { useState, useRef, useEffect } from 'react';
import { C, s } from '../shared';

const PinBoxes = ({ value, onChange, onComplete }) => {
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const digits = value.padEnd(4, '').split('').slice(0, 4);

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '');
    if (!v) return;
    const digit = v.slice(-1);
    const next = value.slice(0, i) + digit + value.slice(i + 1);
    const trimmed = next.replace(/[^0-9]/g, '').slice(0, 4);
    onChange(trimmed);
    if (i < 3) refs[i + 1].current?.focus();
    if (trimmed.length === 4) onComplete?.(trimmed);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i] && digits[i] !== ' ') {
        const next = value.slice(0, i) + value.slice(i + 1);
        onChange(next);
      } else if (i > 0) {
        const next = value.slice(0, i - 1) + value.slice(i);
        onChange(next);
        refs[i - 1].current?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, 3);
      refs[focusIdx].current?.focus();
      if (pasted.length === 4) onComplete?.(pasted);
    }
  };

  const boxStyle = {
    width: 52, height: 60, borderRadius: 12,
    background: 'rgba(255,255,255,0.1)',
    border: `2px solid ${C.border}`,
    color: '#fff', fontSize: 28, fontWeight: 800,
    textAlign: 'center', outline: 'none',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i]?.trim() ? '\u2022' : ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            ...boxStyle,
            borderColor: digits[i]?.trim() ? C.yellow : C.border,
          }}
        />
      ))}
    </div>
  );
};

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
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
        <div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>PIN</div>
          <PinBoxes value={pin} onChange={setPin} onComplete={() => handleLogin()} />
        </div>
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
