import { pkImg } from '../data/pokemon';
import { C, s } from '../shared';
import { NumPad } from './NumPad';

export const LoginScreen = ({ users, loginTarget, loginPin, setLoginPin, loginError, setLoginError, setCurrentUser, setScreen, setGameScreen }) => {
  const user = users[loginTarget] || {};
  return (
    <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
      <img src={pkImg(user.starterSlug)} alt="" style={{ width: 100, height: 100, objectFit: 'contain', animation: 'float 3s ease-in-out infinite' }} />
      <h2 style={{ color: C.yellow, margin: '8px 0 24px' }}>{user.name}</h2>
      <NumPad value={loginPin} onChange={setLoginPin} onSubmit={(pin) => {
        if (loginTarget === 'test' && pin === '0000') { setCurrentUser('test'); setScreen('parentMenu'); return; }
        if (users[loginTarget]?.pin === pin) {
          setCurrentUser(loginTarget); setScreen('game'); setGameScreen('home');
        } else {
          setLoginError('Wrong PIN. Try again!'); setLoginPin('');
        }
      }} />
      {loginError && <div style={{ color: C.red, marginTop: 12, animation: 'shake 0.3s ease' }}>{loginError}</div>}
      <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted, marginTop: 16 }}
        onClick={() => { setScreen('selectUser'); setLoginError(''); }}>← Back</button>
    </div>
  );
};
