import { useState } from 'react';
import { STARTER_POKEMON, pkImg } from '../data/pokemon';
import { C, s, generateKey } from '../shared';
import { NumPad } from './NumPad';

export const CreateUserScreen = ({ users, saveUsers, createStep, setCreateStep, newName, setNewName, newStarter, setNewStarter, newPin, setNewPin, confirmPin, setConfirmPin, inviteCode, setInviteCode, setScreen }) => {
  const [err, setErr] = useState('');
  const [validating, setValidating] = useState(false);
  return (
    <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
      <div style={{ textAlign: 'left', marginBottom: 8 }}>
        <button style={{ ...s.backBtn }}
          onClick={() => createStep > 0 ? setCreateStep(createStep - 1) : setScreen('selectUser')}>←</button>
      </div>
      <h2 style={{ color: C.yellow }}>Create Profile</h2>
      <div style={{ color: C.muted, marginBottom: 20 }}>Step {createStep + 1} of 5</div>

      {createStep === 0 && (
        <div>
          <p style={{ color: C.muted }}>Enter your invite code</p>
          <input
            style={{ ...s.input, textTransform: 'uppercase', letterSpacing: 3, fontFamily: 'monospace', fontSize: 20, textAlign: 'center' }}
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            autoFocus
          />
          {err && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
          <button
            style={{ ...s.btn(C.yellow, 'lg'), marginTop: 16 }}
            disabled={validating}
            onClick={async () => {
              const code = inviteCode.trim();
              if (!code) { setErr('Please enter an invite code.'); return; }
              setValidating(true);
              setErr('');
              try {
                const res = await fetch(`/api/invite-codes/validate?code=${encodeURIComponent(code)}`);
                const data = await res.json();
                if (!data.valid) { setErr('Invalid or already used invite code.'); setValidating(false); return; }
              } catch { setErr('Network error. Try again.'); setValidating(false); return; }
              setValidating(false);
              setCreateStep(1);
            }}>
            {validating ? 'Checking...' : 'Next →'}
          </button>
        </div>
      )}

      {createStep === 1 && (
        <div>
          <p style={{ color: C.muted }}>What is your name?</p>
          <input style={s.input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter name…" autoFocus />
          {err && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
          <button style={{ ...s.btn(C.yellow, 'lg'), marginTop: 16 }}
            onClick={() => {
              const trimmed = newName.trim();
              if (!trimmed) { setErr('Please enter a name.'); return; }
              if (trimmed.toLowerCase() === 'test') { setErr('That name is reserved.'); return; }
              const key = generateKey(trimmed);
              if (!key) { setErr('Name must contain at least one letter or number.'); return; }
              if (Object.values(users).some(u => u.userId === key)) { setErr('Name already taken.'); return; }
              setNewName(trimmed); setCreateStep(2);
            }}>Next →</button>
        </div>
      )}

      {createStep === 2 && (
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
            onClick={() => { if (!newStarter) { setErr('Pick a Pokemon!'); return; } setCreateStep(3); }}>
            Next →
          </button>
        </div>
      )}

      {createStep === 3 && (
        <div>
          <p style={{ color: C.muted }}>Create a 4-digit PIN</p>
          <NumPad value={newPin} onChange={setNewPin} onSubmit={(pin) => { setNewPin(pin); setCreateStep(4); }} />
        </div>
      )}

      {createStep === 4 && (
        <div>
          <p style={{ color: C.muted }}>Confirm your PIN</p>
          <NumPad value={confirmPin} onChange={setConfirmPin} onSubmit={async (pin) => {
            if (pin !== newPin) { setConfirmPin(''); setErr('PINs do not match!'); return; }
            const key = generateKey(newName);
            try {
              const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, name: newName, pin, starterId: newStarter.id, starterSlug: newStarter.slug, inviteCode: inviteCode.trim() }),
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
