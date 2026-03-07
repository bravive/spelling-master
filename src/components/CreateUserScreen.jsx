import { useState } from 'react';
import { STARTER_POKEMON, pkImg } from '../data/pokemon';
import { C, s } from '../shared';
import { NumPad } from './NumPad';

export const CreateUserScreen = ({ users, saveUsers, createStep, setCreateStep, newName, setNewName, newStarter, setNewStarter, newPin, setNewPin, confirmPin, setConfirmPin, setScreen }) => {
  const [err, setErr] = useState('');
  return (
    <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
      <div style={{ textAlign: 'left', marginBottom: 8 }}>
        <button style={{ ...s.backBtn }}
          onClick={() => createStep > 0 ? setCreateStep(createStep - 1) : setScreen('selectUser')}>←</button>
      </div>
      <h2 style={{ color: C.yellow }}>Create Profile</h2>
      <div style={{ color: C.muted, marginBottom: 20 }}>Step {createStep + 1} of 4</div>

      {createStep === 0 && (
        <div>
          <p style={{ color: C.muted }}>What is your name?</p>
          <input style={s.input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter name…" autoFocus />
          {err && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
          <button style={{ ...s.btn(C.yellow, 'lg'), marginTop: 16 }}
            onClick={() => {
              const trimmed = newName.trim();
              if (!trimmed) { setErr('Please enter a name.'); return; }
              if (trimmed.toLowerCase() === 'test') { setErr('That name is reserved.'); return; }
              const key = trimmed.toLowerCase().replace(/\s+/g, '_');
              if (Object.values(users).some(u => u.userId === key)) { setErr('Name already taken.'); return; }
              setNewName(trimmed); setCreateStep(1);
            }}>Next →</button>
        </div>
      )}

      {createStep === 1 && (
        <div>
          <p style={{ color: C.muted }}>Pick your starter Pokemon!</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {STARTER_POKEMON.map(pk => (
              <button key={pk.id}
                style={{ background: C.card, border: `2px solid ${newStarter?.id === pk.id ? C.yellow : C.border}`, borderRadius: 12, padding: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                onClick={() => setNewStarter(pk)}>
                <img src={pkImg(pk.slug)} alt={pk.name} style={{ width: 60, height: 60, objectFit: 'contain' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: newStarter?.id === pk.id ? C.yellow : '#fff' }}>{pk.name}</div>
              </button>
            ))}
          </div>
          {err && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
          <button style={{ ...s.btn(C.yellow, 'lg'), marginTop: 16 }}
            onClick={() => { if (!newStarter) { setErr('Pick a Pokemon!'); return; } setCreateStep(2); }}>
            Next →
          </button>
        </div>
      )}

      {createStep === 2 && (
        <div>
          <p style={{ color: C.muted }}>Create a 4-digit PIN</p>
          <NumPad value={newPin} onChange={setNewPin} onSubmit={(pin) => { setNewPin(pin); setCreateStep(3); }} />
        </div>
      )}

      {createStep === 3 && (
        <div>
          <p style={{ color: C.muted }}>Confirm your PIN</p>
          <NumPad value={confirmPin} onChange={setConfirmPin} onSubmit={async (pin) => {
            if (pin !== newPin) { setConfirmPin(''); setErr('PINs do not match!'); return; }
            const key = newName.toLowerCase().replace(/\s+/g, '_');
            try {
              const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, name: newName, pin, starterId: newStarter.id, starterSlug: newStarter.slug }),
              });
              const data = await res.json();
              if (!res.ok) { setErr(data.error || 'Failed to create profile.'); return; }
              saveUsers({ ...users, [data.user.id]: data.user });
              setScreen('selectUser');
            } catch {
              setErr('Network error. Try again.');
            }
          }} />
          {err && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
        </div>
      )}

    </div>
  );
};
