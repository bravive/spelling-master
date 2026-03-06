import { pkImg } from '../data/pokemon';
import { C, s } from '../shared';
import { NumPad } from './NumPad';

export const LoginScreen = ({ users, loginTarget, loginPin, setLoginPin, loginError, setLoginError, setCurrentUser, setScreen, setGameScreen, setJwt }) => {
  const user = users[loginTarget] || {};
  return (
    <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
      <img src={pkImg(user.starterSlug)} alt="" style={{ width: 100, height: 100, objectFit: 'contain', animation: 'float 3s ease-in-out infinite' }} />
      <h2 style={{ color: C.yellow, margin: '8px 0 24px' }}>{user.name}</h2>
      <NumPad value={loginPin} onChange={setLoginPin} onSubmit={async (pin) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: loginTarget, pin }),
          });
          const data = await res.json();
          if (!res.ok) { setLoginError('Wrong PIN. Try again!'); setLoginPin(''); return; }
          setJwt(data.token);
          if (loginTarget === 'test') { setCurrentUser('test'); setScreen('parentMenu'); }
          else { setCurrentUser(loginTarget); setScreen('game'); setGameScreen('home'); }
        } catch {
          setLoginError('Network error. Try again.'); setLoginPin('');
        }
      }} />
      {loginError && <div style={{ color: C.red, marginTop: 12, animation: 'shake 0.3s ease' }}>{loginError}</div>}
      <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted, marginTop: 16 }}
        onClick={() => { setScreen('selectUser'); setLoginError(''); }}>← Back</button>
    </div>
  );
};
