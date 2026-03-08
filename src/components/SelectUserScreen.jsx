import { useState, useRef, useEffect } from 'react';
import { C, s } from '../shared';

const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  left: `${12 + (i * 11) % 80}%`,
  size: 3 + (i % 3) * 2,
  delay: i * 0.7,
  dur: 3 + (i % 3),
  color: [C.yellow, C.purple, C.blue, C.pink][i % 4],
}));

const PIN_LEN = 6;

const PinBoxes = ({ value, onChange, onComplete }) => {
  const refs = Array.from({ length: PIN_LEN }, () => useRef(null));
  const digits = value.padEnd(PIN_LEN, '').split('').slice(0, PIN_LEN);

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '');
    if (!v) return;
    const digit = v.slice(-1);
    const next = value.slice(0, i) + digit + value.slice(i + 1);
    const trimmed = next.replace(/[^0-9]/g, '').slice(0, PIN_LEN);
    onChange(trimmed);
    if (i < PIN_LEN - 1) refs[i + 1].current?.focus();
    if (trimmed.length === PIN_LEN) onComplete?.(trimmed);
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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LEN);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, PIN_LEN - 1);
      refs[focusIdx].current?.focus();
      if (pasted.length === PIN_LEN) onComplete?.(pasted);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: PIN_LEN }, (_, i) => {
        const hasDig = digits[i]?.trim();
        return (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={hasDig ? '\u2022' : ''}
            onChange={e => handleChange(i, e)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={e => e.target.select()}
            className="pin-box"
            style={{
              width: 38, height: 48, borderRadius: 14,
              background: hasDig ? `${C.yellow}14` : C.card,
              border: `2px solid ${hasDig ? C.yellow : C.border}`,
              color: C.yellow, fontSize: 22, fontWeight: 800,
              textAlign: 'center', outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: hasDig ? `0 0 12px ${C.yellow}22` : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

export const SelectUserScreen = ({ setCurrentUser, setScreen, setGameScreen, setJwt, setCreateStep, setNewName, setNewStarter, setNewPin, setConfirmPin }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const usernameRef = useRef(null);

  useEffect(() => { usernameRef.current?.focus(); }, []);

  const handleLogin = async (pinOverride) => {
    const pinToUse = pinOverride || pin;
    if (!username.trim() || pinToUse.length < PIN_LEN) {
      setError('Enter your username and 6-digit PIN.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: username.trim().toLowerCase(), pin: pinToUse, rememberMe }),
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
    <div style={{
      width: '100%', maxWidth: 340, textAlign: 'center',
      position: 'relative',
      animation: 'popIn 0.5s ease both',
    }}>
      {/* Floating particles */}
      <div style={{ position: 'absolute', inset: '-40px -20px', pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {PARTICLES.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', left: p.left, top: '20%',
            width: p.size, height: p.size, borderRadius: '50%',
            background: p.color, opacity: 0,
            animation: `sparkle ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }} />
        ))}
      </div>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 20 }}>
        <div style={{
          fontSize: 48, lineHeight: 1,
          filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.3))',
          animation: 'float 3s ease-in-out infinite',
        }}>
          📖
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 900, margin: '8px 0 4px',
          color: C.yellow,
          letterSpacing: 1,
        }}>
          Spell Master
        </h1>
        <div style={{ ...s.subtext, letterSpacing: 0.5 }}>
          Sign in to start playing
        </div>
      </div>

      {/* Form card */}
      <div style={{
        ...s.card,
        position: 'relative', zIndex: 1,
        padding: '20px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        {/* Username */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Username
          </label>
          <input
            ref={usernameRef}
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="username"
            style={{
              ...s.input,
              fontWeight: 600,
              textAlign: 'center',
            }}
          />
        </div>

        {/* PIN */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            PIN
          </label>
          <PinBoxes value={pin} onChange={setPin} onComplete={(completedPin) => handleLogin(completedPin)} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            color: C.red, fontSize: 13, marginBottom: 12,
            animation: 'shake 0.3s ease',
            background: `${C.red}18`,
            borderRadius: 12, padding: '8px 12px',
          }}>
            {error}
          </div>
        )}

        {/* Remember me */}
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', color: C.muted, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: C.purple }}
          />
          Keep me logged in for 30 days
        </label>

        {/* Sign In */}
        <button
          style={{
            ...s.btn(C.yellow, 'lg'), width: '100%',
            opacity: loading ? 0.6 : 1,
            letterSpacing: 0.5,
            boxShadow: `0 4px 16px ${C.yellow}33`,
          }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </div>

      {/* Sign Up */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 16 }}>
        <span style={{ color: C.muted, fontSize: 13 }}>New here? </span>
        <span
          style={{
            color: C.blue, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
          onClick={() => { setCreateStep(0); setNewName(''); setNewStarter(null); setNewPin(''); setConfirmPin(''); setScreen('createUser'); }}
        >
          Create an account
        </span>
      </div>
    </div>
  );
};
