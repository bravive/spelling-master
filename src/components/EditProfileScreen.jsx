import { useState } from 'react';
import { STARTER_POKEMON, pkImg } from '../data/pokemon';
import { C, s } from '../shared';
import { NumPad } from './NumPad';

export const EditProfileScreen = ({ user, jwt, saveUsers, users, currentUser, setGameScreen }) => {
  const [tab, setTab] = useState('avatar'); // avatar | name | pin
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  // Avatar state
  const [selectedStarter, setSelectedStarter] = useState(null);

  // Name state
  const [newName, setNewName] = useState(user.name);

  // PIN state
  const [pinStep, setPinStep] = useState('current'); // current | new | confirm
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const clearMessages = () => { setErr(''); setSuccess(''); };

  const saveProfile = async (body) => {
    clearMessages();
    try {
      const res = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Failed to update profile.'); return false; }
      saveUsers({ ...users, [currentUser]: { ...users[currentUser], ...data.user } });
      return true;
    } catch {
      setErr('Network error. Try again.');
      return false;
    }
  };

  const tabs = [
    { id: 'avatar', label: 'Avatar' },
    { id: 'name', label: 'Name' },
    { id: 'pin', label: 'PIN' },
  ];

  return (
    <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
      <h2 style={{ color: C.yellow, marginBottom: 4 }}>Edit Profile</h2>
      <div style={{ color: C.muted, marginBottom: 20 }}>{user.name}</div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id}
            style={{
              ...s.btn(tab === t.id ? C.yellow : 'rgba(255,255,255,0.1)'),
              flex: 1, fontSize: 14,
            }}
            onClick={() => { setTab(t.id); clearMessages(); }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Avatar tab */}
      {tab === 'avatar' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <img src={pkImg(user.starterSlug)} alt="" style={{ width: 80, height: 80, objectFit: 'contain' }} />
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Current avatar</div>
          </div>
          <p style={{ color: C.muted, fontSize: 14 }}>Pick a new avatar</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {STARTER_POKEMON.map(pk => (
              <button key={pk.id}
                style={{
                  background: C.card,
                  border: `2px solid ${selectedStarter?.id === pk.id ? C.yellow : pk.slug === user.starterSlug ? C.green : C.border}`,
                  borderRadius: 12, padding: 10, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
                onClick={() => setSelectedStarter(pk)}>
                <img src={pkImg(pk.slug)} alt={pk.name} style={{ width: 60, height: 60, objectFit: 'contain' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: selectedStarter?.id === pk.id ? C.yellow : '#fff' }}>{pk.name}</div>
              </button>
            ))}
          </div>
          <AvatarPinPrompt
            selectedStarter={selectedStarter}
            user={user}
            onSave={async (pin) => {
              const ok = await saveProfile({ currentPin: pin, starterId: selectedStarter.id, starterSlug: selectedStarter.slug });
              if (ok) { setSuccess('Avatar updated!'); setSelectedStarter(null); }
            }}
            err={err}
            setErr={setErr}
          />
        </div>
      )}

      {/* Name tab */}
      {tab === 'name' && (
        <div>
          <p style={{ color: C.muted, fontSize: 14 }}>Change your display name</p>
          <input style={s.input} value={newName} onChange={e => { setNewName(e.target.value); clearMessages(); }} placeholder="Enter new name..." autoFocus />
          <NamePinPrompt
            newName={newName}
            user={user}
            users={users}
            onSave={async (pin) => {
              const ok = await saveProfile({ currentPin: pin, newName: newName.trim() });
              if (ok) setSuccess('Name updated!');
            }}
            err={err}
            setErr={setErr}
          />
        </div>
      )}

      {/* PIN tab */}
      {tab === 'pin' && (
        <div>
          {pinStep === 'current' && (
            <div>
              <p style={{ color: C.muted }}>Enter your current PIN</p>
              <NumPad value={currentPin} onChange={setCurrentPin} onSubmit={(pin) => {
                setCurrentPin(pin);
                setPinStep('new');
                clearMessages();
              }} />
            </div>
          )}
          {pinStep === 'new' && (
            <div>
              <p style={{ color: C.muted }}>Enter your new PIN</p>
              <NumPad value={newPin} onChange={setNewPin} onSubmit={(pin) => {
                setNewPin(pin);
                setPinStep('confirm');
                clearMessages();
              }} />
            </div>
          )}
          {pinStep === 'confirm' && (
            <div>
              <p style={{ color: C.muted }}>Confirm your new PIN</p>
              <NumPad value={confirmPin} onChange={setConfirmPin} onSubmit={async (pin) => {
                if (pin !== newPin) {
                  setConfirmPin('');
                  setErr('PINs do not match!');
                  return;
                }
                const ok = await saveProfile({ currentPin, newPin });
                if (ok) {
                  setSuccess('PIN updated!');
                  setPinStep('current');
                  setCurrentPin('');
                  setNewPin('');
                  setConfirmPin('');
                }
              }} />
              <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted, marginTop: 12 }}
                onClick={() => { setPinStep('new'); setConfirmPin(''); clearMessages(); }}>
                Back
              </button>
            </div>
          )}
        </div>
      )}

      {err && <div style={{ color: C.red, marginTop: 12, animation: 'shake 0.3s ease' }}>{err}</div>}
      {success && <div style={{ color: C.green, marginTop: 12 }}>{success}</div>}

      <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted, marginTop: 20 }}
        onClick={() => setGameScreen('home')}>
        Back to Home
      </button>
    </div>
  );
};

// Small inline PIN prompt for avatar & name changes
const InlinePinPrompt = ({ label, onSubmit, disabled }) => {
  const [pin, setPin] = useState('');
  const [showPad, setShowPad] = useState(false);

  if (!showPad) {
    return (
      <button
        style={{ ...s.btn(C.green, 'lg'), width: '100%', marginTop: 12, opacity: disabled ? 0.5 : 1 }}
        disabled={disabled}
        onClick={() => setShowPad(true)}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ color: C.muted, fontSize: 13 }}>Enter your PIN to confirm</p>
      <NumPad value={pin} onChange={setPin} onSubmit={(p) => { onSubmit(p); setPin(''); setShowPad(false); }} />
      <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted, marginTop: 8 }}
        onClick={() => { setShowPad(false); setPin(''); }}>Cancel</button>
    </div>
  );
};

const AvatarPinPrompt = ({ selectedStarter, user, onSave, err, setErr }) => {
  if (!selectedStarter || selectedStarter.slug === user.starterSlug) return null;
  return <InlinePinPrompt label="Save Avatar" onSubmit={onSave} />;
};

const NamePinPrompt = ({ newName, user, users, onSave, err, setErr }) => {
  const trimmed = newName.trim();
  const changed = trimmed && trimmed !== user.name;
  const key = trimmed.toLowerCase().replace(/\s+/g, '_');
  const duplicate = Object.values(users).some(u => u.userId === key && u.name !== user.name);

  if (duplicate) {
    return <div style={{ color: C.red, marginTop: 12 }}>Name already taken.</div>;
  }
  if (key === 'test' || key === 'admin') {
    return <div style={{ color: C.red, marginTop: 12 }}>That name is reserved.</div>;
  }

  return <InlinePinPrompt label="Save Name" onSubmit={onSave} disabled={!changed} />;
};
