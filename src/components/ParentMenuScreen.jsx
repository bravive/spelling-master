import { pkImg } from '../data/pokemon';
import { C, s } from '../shared';

export const ParentMenuScreen = ({ users, saveUsers, jwt, setCreateStep, setNewName, setNewStarter, setNewPin, setConfirmPin, setScreen, setGameScreen, setCurrentUser }) => {
  const profiles = Object.entries(users).filter(([k]) => k !== 'test');
  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <h2 style={{ color: C.yellow, textAlign: 'center' }}>Admin Panel</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {profiles.map(([key, u]) => (
          <div key={key} style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={pkImg(u.starterSlug)} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <span style={{ fontWeight: 600 }}>{u.name}</span>
            </div>
            <button style={{ ...s.btn(C.red, 'sm') }}
              onClick={async () => {
                const res = await fetch(`/api/users/${encodeURIComponent(key)}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${jwt}` },
                });
                if (res.ok) { const next = { ...users }; delete next[key]; saveUsers(next); }
              }}>
              Delete
            </button>
          </div>
        ))}
      </div>
      <button style={{ ...s.btn(C.blue), width: '100%', marginTop: 12 }}
        onClick={() => { setCreateStep(0); setNewName(''); setNewStarter(null); setNewPin(''); setConfirmPin(''); setScreen('createUser'); }}>
        ➕ Create New Profile
      </button>
      <button style={{ ...s.btn(C.purple), width: '100%', marginTop: 8 }}
        onClick={() => { setScreen('game'); setGameScreen('collection'); }}>
        🏆 Preview Full Collection
      </button>
      <button style={{ ...s.btn(C.red, 'sm'), marginTop: 12 }}
        onClick={() => { setCurrentUser(null); setScreen('selectUser'); }}>🚪 Logout</button>
    </div>
  );
};
