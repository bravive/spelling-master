import { pkImg } from '../data/pokemon';
import { C, s } from '../shared';

export const SelectUserScreen = ({ users, setLoginTarget, setLoginPin, setLoginError, setScreen, setCreateStep, setNewName, setNewStarter, setNewPin, setConfirmPin }) => {
  const profiles = Object.entries(users).filter(([k]) => k !== 'admin');
  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48 }}>📖</div>
        <h1 style={{ fontSize: 36, fontWeight: 900, margin: '8px 0', color: C.yellow }}>Spell Master</h1>
        <div style={{ color: C.muted }}>Who's playing today?</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {profiles.map(([key, u]) => {
            const caught = u.caught || 0;
          return (
            <button key={key}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', width: '100%', textAlign: 'left', color: '#fff' }}
              onClick={() => { setLoginTarget(key); setLoginPin(''); setLoginError(''); setScreen('login'); }}>
              <img src={pkImg(u.starterSlug)} alt={u.starterSlug} style={{ width: 60, height: 60, objectFit: 'contain' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{u.name}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>Level {u.level} · {u.streak} day streak · {caught} caught</div>
              </div>
            </button>
          );
        })}
      </div>
      <button style={{ ...s.btn(C.blue), width: '100%', marginTop: 16 }}
        onClick={() => { setCreateStep(0); setNewName(''); setNewStarter(null); setNewPin(''); setConfirmPin(''); setScreen('createUser'); }}>
        ➕ Create New Profile
      </button>
    </div>
  );
};
