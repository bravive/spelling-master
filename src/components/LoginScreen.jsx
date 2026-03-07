import { useState } from 'react';
import { pkImg } from '../data/pokemon';
import { C, s } from '../shared';
import { NumPad } from './NumPad';

export const LoginScreen = ({ users, loginTarget, loginPin, setLoginPin, loginError, setLoginError, setCurrentUser, setScreen, setGameScreen, setJwt }) => {
  const user = users[loginTarget] || {};
  const [rememberMe, setRememberMe] = useState(false);
  return (
    <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
      <div style={{ textAlign: 'left', marginBottom: 8 }}>
        <button style={{ ...s.backBtn }} onClick={() => { setScreen('selectUser'); setLoginError(''); }}>←</button>
      </div>
      <img src={pkImg(user.starterSlug)} alt="" style={{ width: 100, height: 100, objectFit: 'contain', animation: 'float 3s ease-in-out infinite' }} />
      <h2 style={{ color: C.yellow, margin: '8px 0 24px' }}>{user.name}</h2>
      <NumPad value={loginPin} onChange={setLoginPin} onSubmit={async (pin) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, pin, rememberMe }),
          });
          const data = await res.json();
          if (!res.ok) { setLoginError('Wrong PIN. Try again!'); setLoginPin(''); return; }
          setJwt(data.token);
          if (data.user?.isAdmin) { setCurrentUser('admin'); setScreen('parentMenu'); }
          else { setCurrentUser(loginTarget); setScreen('game'); setGameScreen('home'); }
        } catch {
          setLoginError('Network error. Try again.'); setLoginPin('');
        }
      }} />
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, cursor: 'pointer', color: C.muted, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={e => setRememberMe(e.target.checked)}
          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: C.purple }}
        />
        Keep me logged in for 30 days
      </label>
      {loginError && <div style={{ color: C.red, marginTop: 12, animation: 'shake 0.3s ease' }}>{loginError}</div>}
    </div>
  );
};
