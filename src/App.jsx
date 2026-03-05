import { useState, useEffect, useRef, useCallback } from 'react';
import { ALL_POKEMON, STARTER_POKEMON, pkImg, pkShiny } from './data/pokemon';
import { WORD_POOL } from './data/words';

// ─── Storage ─────────────────────────────────────────────────────────────────
const save = (users) => fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(users) });

// ─── Speech ──────────────────────────────────────────────────────────────────
const speakTimes = (text, times, onDone) => {
  window.speechSynthesis.cancel();
  let c = 0;
  const next = () => {
    if (c >= times) { onDone?.(); return; }
    c++;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.82; u.pitch = 1.05;
    u.onend = () => setTimeout(next, 700);
    window.speechSynthesis.speak(u);
  };
  next();
};
const speak = (text) => speakTimes(text, 1, null);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);

const newUser = (name, pin, starterId, starterSlug) => ({
  name, pin, starterId, starterSlug,
  level: 1,
  totalCredits: 0,
  creditBank: 0,
  streak: 0,
  lastPlayed: null,
  streakDates: [],
  collection: {},
  shinyEligible: false,
  consecutiveRegular: 0,
  wordStats: {},
  roundHistory: [],
  bestScores: {},
  roundCount: 0,
  createdAt: new Date().toISOString(),
});

// Weighted word selection
export const selectWords = (user) => {
  const pool = WORD_POOL[user.level] || WORD_POOL[1];
  const roundCount = user.roundCount || 0;

  const isRetired = (ws) => ws && ws.attempts >= 3 && ws.correct === 0;
  const isOnCooldown = (ws) => ws && ws.lastPassedRound != null && roundCount - ws.lastPassedRound < 3;

  // Prefer words that aren't retired and aren't on cooldown
  let candidates = pool.filter(entry => {
    const ws = user.wordStats[entry.w];
    return !isRetired(ws) && !isOnCooldown(ws);
  });

  // If too few remain after cooldown, relax cooldown (keep retirement filter)
  if (candidates.length < 10) {
    candidates = pool.filter(entry => !isRetired(user.wordStats[entry.w]));
  }

  const weighted = candidates.map(entry => {
    const ws = user.wordStats[entry.w];
    let weight = 1;
    if (ws) {
      const rate = ws.attempts > 0 ? ws.correct / ws.attempts : 0;
      if (ws.attempts >= 3 && rate >= 0.8) weight = 0.3;
      else if (ws.attempts > 0 && rate < 0.5) weight = Math.min(ws.weight || 1, 5);
    }
    return { ...entry, weight };
  });

  const used = new Set();
  const selected = [];
  const n = Math.min(10, weighted.length);

  // Weighted random sampling without replacement
  while (selected.length < n && used.size < weighted.length) {
    const available = weighted.filter(e => !used.has(e.w));
    const total = available.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of available) {
      r -= e.weight;
      if (r <= 0) { selected.push(e); used.add(e.w); break; }
    }
  }
  return selected;
};

const checkLevelUp = (user) => {
  const pool = WORD_POOL[user.level] || [];
  if (pool.length === 0) return user;
  const mastered = pool.filter(e => {
    const ws = user.wordStats[e.w];
    return ws && ws.attempts >= 3 && ws.correct / ws.attempts >= 0.8;
  });
  if (mastered.length / pool.length >= 0.7 && user.level < 5) {
    return { ...user, level: user.level + 1 };
  }
  return user;
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const C = {
  bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  yellow: '#fbbf24',
  pink: '#f472b6',
  blue: '#60a5fa',
  green: '#10b981',
  red: '#ef4444',
  muted: '#94a3b8',
  purple: '#c4b5fd',
  card: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.12)',
};

const s = {
  page: { minHeight: '100vh', background: C.bg, color: '#fff', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px' },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 },
  btn: (color = C.yellow, size = 'md') => ({
    background: color, border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700,
    padding: size === 'sm' ? '8px 16px' : size === 'lg' ? '16px 32px' : '12px 24px',
    fontSize: size === 'sm' ? 14 : size === 'lg' ? 20 : 16,
    color: color === 'rgba(255,255,255,0.12)' || color === 'rgba(255,255,255,0.1)' ? '#fff' : '#1a1a2e',
    transition: 'opacity 0.15s',
  }),
  input: { background: 'rgba(255,255,255,0.1)', border: `1px solid ${C.border}`, borderRadius: 10, color: '#fff', fontSize: 18, padding: '12px 16px', width: '100%', boxSizing: 'border-box', outline: 'none' },
};

// ─── CSS animations injected once ────────────────────────────────────────────
const injectCSS = () => {
  if (document.getElementById('sm-styles')) return;
  const el = document.createElement('style');
  el.id = 'sm-styles';
  el.textContent = `
    @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.7} }
    @keyframes pop     { 0%{transform:scale(0.3);opacity:0} 70%{transform:scale(1.25)} 100%{transform:scale(1);opacity:1} }
    @keyframes popIn   { 0%{transform:scale(0.5) translateY(40px);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
    @keyframes shake   { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
    @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes shimmer { 0%{filter:drop-shadow(0 0 6px #a78bfa)} 50%{filter:drop-shadow(0 0 16px #60a5fa)} 100%{filter:drop-shadow(0 0 6px #a78bfa)} }
    @keyframes sparkle { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
    @keyframes fall    { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
    * { box-sizing: border-box; }
    body { margin: 0; }
  `;
  document.head.appendChild(el);
};

// ─── Confetti ─────────────────────────────────────────────────────────────────
const Confetti = () => {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: ['#fbbf24','#f472b6','#60a5fa','#10b981','#a78bfa'][i % 5],
    left: Math.random() * 100,
    delay: Math.random() * 2,
    dur: 2 + Math.random() * 2,
    size: 6 + Math.random() * 8,
  }));
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.left}%`, top: -10,
          width: p.size, height: p.size, background: p.color, borderRadius: 2,
          animation: `fall ${p.dur}s ${p.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  );
};

// ─── Trophy Modal ─────────────────────────────────────────────────────────────
const TrophyModal = ({ unlock, onDismiss }) => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 700);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const msg = unlock.shiny
      ? `Wow! You got a shiny ${unlock.name}! So rare!`
      : `Amazing! You caught ${unlock.name}!`;
    speak(msg);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [unlock]);

  const isShiny = unlock.shiny;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      {phase >= 1 && <Confetti />}
      <div style={{ ...s.card, textAlign: 'center', padding: 40, animation: 'popIn 0.6s ease', border: `2px solid ${isShiny ? '#a78bfa' : C.yellow}`, maxWidth: 340, width: '90%' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: isShiny ? '#a78bfa' : C.yellow, marginBottom: 8 }}>
          {isShiny ? '✨ Shiny Pokemon!' : '🎉 New Pokemon!'}
        </div>
        <img
          src={isShiny ? pkShiny(unlock.slug) : pkImg(unlock.slug)}
          alt={unlock.name}
          style={{ width: 140, height: 140, objectFit: 'contain', animation: phase >= 1 ? 'pop 0.5s ease' : 'none', filter: isShiny ? 'drop-shadow(0 0 16px #a78bfa)' : 'none' }}
        />
        <div style={{ fontSize: 24, fontWeight: 700, margin: '12px 0 4px' }}>{unlock.name}</div>
        {isShiny && <div style={{ color: '#a78bfa', fontSize: 14, marginBottom: 8 }}>✨ Shiny variant</div>}
        <button style={{ ...s.btn(isShiny ? '#a78bfa' : C.yellow, 'lg'), marginTop: 16 }} onClick={onDismiss}>
          🎉 Awesome!
        </button>
      </div>
    </div>
  );
};

// ─── NumPad ───────────────────────────────────────────────────────────────────
const NumPad = ({ value, onChange, onSubmit }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: i < value.length ? C.yellow : 'transparent', border: `2px solid ${C.yellow}`, transition: 'background 0.15s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 10 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 24, padding: '14px 0', borderRadius: 12 }}
            onClick={() => value.length < 4 && onChange(value + n)}>
            {n}
          </button>
        ))}
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 20, padding: '14px 0' }}
          onClick={() => onChange('')}>C</button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 24, padding: '14px 0' }}
          onClick={() => value.length < 4 && onChange(value + '0')}>0</button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff', fontSize: 20, padding: '14px 0' }}
          onClick={() => onChange(value.slice(0, -1))}>⌫</button>
      </div>
      {value.length === 4 && (
        <button style={{ ...s.btn(C.green, 'lg'), width: '100%' }} onClick={() => onSubmit(value)}>
          Enter →
        </button>
      )}
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  injectCSS();

  const isAdminBackdoor = new URLSearchParams(window.location.search).get('admin') === '1';

  const [screen, setScreen] = useState(() => isAdminBackdoor ? 'adminLogin' : 'selectUser');
  const [gameScreen, setGameScreen] = useState('home');
  const [users, setUsers] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => {
      setUsers(data);
      if (isAdminBackdoor) return;

      // Restore session if one exists
      const savedUser = sessionStorage.getItem('currentUser');
      const savedScreen = sessionStorage.getItem('screen');
      const savedGameScreen = sessionStorage.getItem('gameScreen');
      if (savedUser && data[savedUser]) {
        setCurrentUser(savedUser);
        if (savedScreen === 'parentMenu') {
          setScreen('parentMenu');
        } else {
          setScreen('game');
          setGameScreen(savedGameScreen || 'home');
        }
      }
    }).catch(() => {});
  }, []);
  const [unlockQueue, setUnlockQueue] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimer = useRef(null);

  // Create user flow
  const [createStep, setCreateStep] = useState(0);
  const [newName, setNewName] = useState('');
  const [newStarter, setNewStarter] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Login
  const [loginPin, setLoginPin] = useState('');
  const [loginTarget, setLoginTarget] = useState(null);
  const [loginError, setLoginError] = useState('');

  // Game state
  const [words, setWords] = useState([]);
  const [retryCount, setRetryCount] = useState(0);
  const [roundResults, setRoundResults] = useState(null);

  // Persist session whenever screen/user changes
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('currentUser', currentUser);
      sessionStorage.setItem('screen', screen);
      sessionStorage.setItem('gameScreen', gameScreen);
    } else {
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('screen');
      sessionStorage.removeItem('gameScreen');
    }
  }, [currentUser, screen, gameScreen]);

  const saveUsers = (u) => { setUsers(u); save(u); };

  const getUser = useCallback(() => users[currentUser] || null, [users, currentUser]);

  const updateUser = useCallback((fn) => {
    setUsers(prev => {
      const next = { ...prev, [currentUser]: fn(prev[currentUser]) };
      save(next);
      return next;
    });
  }, [currentUser]);

  // ── Credit & Pokemon unlock logic ──────────────────────────────────────────
  const processRound = useCallback((score, results) => {
    const user = users[currentUser];
    if (!user) return { earned: 0, pass: false, shouldRetry: score < 6 };
    let earned = 0;
    if (score === 10) earned = 5;
    else if (score === 9) earned = 3;
    else if (score === 8) earned = 2;

    const today = todayStr();
    let { streak, lastPlayed, streakDates, creditBank, consecutiveRegular, shinyEligible, collection, totalCredits } = user;
    const newDates = [...(streakDates || [])];
    if (!newDates.includes(today)) newDates.push(today);

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastPlayed === today) { /* same day, no change */ }
    else if (lastPlayed === yesterday) { streak = (streak || 0) + 1; }
    else { streak = 1; }

    if (streak > 0 && streak % 3 === 0) earned += 1;

    creditBank = (creditBank || 0) + earned;
    totalCredits = (totalCredits || 0) + earned;

    const newUnlocks = [];
    let col = { ...collection };
    while (creditBank >= 10) {
      creditBank -= 10;
      if (shinyEligible && Math.random() < 0.5) {
        const eligible = Object.entries(col).filter(([, v]) => v.regular && !v.shiny).map(([id]) => parseInt(id));
        if (eligible.length > 0) {
          const shinyId = eligible[Math.floor(Math.random() * eligible.length)];
          const pk = ALL_POKEMON.find(p => p.id === shinyId);
          col = { ...col, [shinyId]: { ...col[shinyId], shiny: true } };
          newUnlocks.push({ ...pk, shiny: true });
          shinyEligible = false;
          consecutiveRegular = 0;
        } else { shinyEligible = false; }
      } else {
        const nextPk = ALL_POKEMON.find(p => !col[p.id]?.regular);
        if (nextPk) {
          col = { ...col, [nextPk.id]: { ...(col[nextPk.id] || {}), regular: true } };
          newUnlocks.push({ ...nextPk, shiny: false });
          consecutiveRegular = (consecutiveRegular || 0) + 1;
          if (consecutiveRegular >= 3) shinyEligible = true;
        }
      }
    }

    const newRoundCount = (user.roundCount || 0) + 1;
    const wordStats = { ...user.wordStats };
    for (const r of results) {
      const ws = wordStats[r.word] || { attempts: 0, correct: 0, weight: 1, lastPassedRound: null };
      ws.attempts += 1;
      if (r.correct) {
        ws.correct += 1;
        ws.weight = Math.max(0.3, (ws.weight || 1) * 0.75);
        ws.lastPassedRound = newRoundCount;
      } else {
        ws.weight = Math.min(5, (ws.weight || 1) * 1.6);
      }
      wordStats[r.word] = ws;
    }

    const roundHistory = [...(user.roundHistory || []), { date: today, score, earned, pass: score >= 6 }].slice(-200);

    let updated = { ...user, streak, lastPlayed: today, streakDates: newDates.slice(-90), creditBank, totalCredits, collection: col, shinyEligible, consecutiveRegular, wordStats, roundHistory, roundCount: newRoundCount };
    updated = checkLevelUp(updated);

    setUsers(prev => { const next = { ...prev, [currentUser]: updated }; save(next); return next; });
    if (newUnlocks.length) setUnlockQueue(newUnlocks);
    if (score === 10) {
      setShowConfetti(true);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setShowConfetti(false), 4000);
    }
    return { earned, pass: score >= 6, shouldRetry: score < 6 };
  }, [users, currentUser]);

  // ── SelectUser ──────────────────────────────────────────────────────────────
  const SelectUserScreen = () => {
    const profiles = Object.entries(users).filter(([k]) => k !== 'test');
    return (
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>📖</div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: '8px 0', color: C.yellow }}>Spell Master</h1>
          <div style={{ color: C.muted }}>Who's playing today?</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {profiles.map(([key, u]) => {
            const caught = Object.values(u.collection || {}).filter(c => c.regular || c.shiny).length;
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

  // ── Login ───────────────────────────────────────────────────────────────────
  const LoginScreen = () => {
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

  // ── AdminLogin ──────────────────────────────────────────────────────────────
  const AdminLoginScreen = () => {
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    return (
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
        <h2 style={{ color: C.yellow, margin: '0 0 24px' }}>Admin Login</h2>
        <input
          style={{ ...s.input, marginBottom: 16 }}
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
        />
        <NumPad value={pin} onChange={setPin} onSubmit={(p) => {
          if (username === 'test' && p === '0000') {
            setCurrentUser('test');
            setScreen('parentMenu');
          } else {
            setError('Invalid credentials.');
            setPin('');
          }
        }} />
        {error && <div style={{ color: C.red, marginTop: 12, animation: 'shake 0.3s ease' }}>{error}</div>}
      </div>
    );
  };

  // ── ParentMenu ──────────────────────────────────────────────────────────────
  const ParentMenuScreen = () => {
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
                onClick={() => { const next = { ...users }; delete next[key]; saveUsers(next); }}>
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

  // ── CreateUser ──────────────────────────────────────────────────────────────
  const CreateUserScreen = () => {
    const [err, setErr] = useState('');
    return (
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
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
                if (users[key]) { setErr('Name already taken.'); return; }
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
            <NumPad value={confirmPin} onChange={setConfirmPin} onSubmit={(pin) => {
              if (pin !== newPin) { setConfirmPin(''); setErr('PINs do not match!'); return; }
              const key = newName.toLowerCase().replace(/\s+/g, '_');
              const next = { ...users, [key]: newUser(newName, pin, newStarter.id, newStarter.slug) };
              saveUsers(next);
              setScreen('selectUser');
            }} />
            {err && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
          </div>
        )}

        <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted, marginTop: 16 }}
          onClick={() => createStep > 0 ? setCreateStep(createStep - 1) : setScreen('selectUser')}>← Back</button>
      </div>
    );
  };

  // ── Home ────────────────────────────────────────────────────────────────────
  const HomeScreen = () => {
    const user = getUser();
    if (!user) return null;
    const col = user.collection || {};
    const regular = Object.values(col).filter(c => c.regular).length;
    const shiny = Object.values(col).filter(c => c.shiny).length;
    const nextPk = ALL_POKEMON.find(p => !col[p.id]?.regular);

    return (
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src={pkImg(user.starterSlug)} alt="" style={{ width: 90, height: 90, objectFit: 'contain', animation: 'float 3s ease-in-out infinite' }} />
          <h2 style={{ margin: '8px 0 4px', fontSize: 26 }}>{user.name}</h2>
          <div style={{ color: C.purple }}>Level {user.level} Speller</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[['💰', user.totalCredits, 'Credits'], ['🔥', user.streak, 'Streak'], ['🏆', regular + shiny, 'Caught']].map(([icon, val, label]) => (
            <div key={label} style={{ ...s.card, flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 22 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>{val}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
            </div>
          ))}
        </div>

        {nextPk && (
          <div style={{ ...s.card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
              <img src={pkImg(nextPk.slug)} alt="?" style={{ width: 64, height: 64, objectFit: 'contain', filter: 'brightness(0)', opacity: 0.4 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>❓</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Next Pokemon</div>
              {user.shinyEligible && (
                <div style={{ color: '#a78bfa', fontSize: 13, animation: 'pulse 1.5s ease infinite', marginBottom: 4 }}>✨ Shiny chance active!</div>
              )}
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${(user.creditBank / 10) * 100}%`, height: '100%', background: C.yellow, transition: 'width 0.3s', borderRadius: 8 }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{user.creditBank}/10 credits</div>
            </div>
          </div>
        )}

        <button style={{ ...s.btn(C.yellow, 'lg'), width: '100%', marginBottom: 16, animation: 'pulse 2s ease infinite' }}
          onClick={() => {
            const w = selectWords(getUser());
            setWords(w); setRetryCount(0); setGameScreen('stage1');
          }}>
          🚀 Start Round!
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...s.btn(C.blue), flex: 1 }} onClick={() => setGameScreen('stats')}>📊 Stats</button>
          <button style={{ ...s.btn(C.purple), flex: 1 }} onClick={() => setGameScreen('collection')}>🏆 Collection</button>
          <button style={{ ...s.btn('rgba(255,255,255,0.12)'), color: '#fff' }}
            onClick={() => { setCurrentUser(null); setScreen('selectUser'); }}>🚪</button>
        </div>
      </div>
    );
  };

  // ── Stage 1: Remember ───────────────────────────────────────────────────────
  const Stage1Screen = () => {
    const [elapsed, setElapsed] = useState(0);
    const MAX = 180;
    useEffect(() => {
      speak("Take a good look at all the words! You have one minute to remember them!");
      const t = setInterval(() => setElapsed(e => {
        if (e + 1 >= MAX) { clearInterval(t); setGameScreen('stage2'); return MAX; }
        return e + 1;
      }), 1000);
      return () => clearInterval(t);
    }, []);

    const pct = elapsed / MAX;
    const barColor = elapsed < 60 ? C.green : elapsed < 120 ? C.yellow : C.red;
    const barLabel = elapsed < 60 ? 'Study time!' : elapsed < 120 ? 'Take your time!' : 'Almost at the limit!';
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');

    return (
      <div style={{ width: '100%', maxWidth: 600 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 style={{ color: C.yellow, margin: 0 }}>📖 Stage 1 — Remember!</h2>
          {retryCount > 0 && <div style={{ color: C.red, fontSize: 13 }}>Retry #{retryCount}</div>}
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{mm}:{ss}</div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, height: 10, margin: '8px 0' }}>
            <div style={{ width: `${pct * 100}%`, height: '100%', background: barColor, borderRadius: 8, transition: 'width 1s linear, background 0.5s' }} />
          </div>
          <div style={{ color: barColor, fontSize: 13 }}>{barLabel}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {words.map((entry, i) => (
            <div key={i} style={{ ...s.card, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>{entry.w}</div>
              <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>{entry.s}</div>
            </div>
          ))}
        </div>
        <button style={{ ...s.btn(C.green, 'lg'), width: '100%' }}
          onClick={() => setGameScreen('stage2')}>
          ✅ I'm Ready!
        </button>
      </div>
    );
  };

  // ── Stage 2: Listen & Spell ─────────────────────────────────────────────────
  const Stage2Screen = () => {
    const [idx, setIdx] = useState(0);
    const [attempt, setAttempt] = useState(0);
    const [typed, setTyped] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [results, setResults] = useState([]);
    const [speaking, setSpeaking] = useState(false);
    const [order] = useState(() => [...words].sort(() => Math.random() - 0.5));
    const inputRef = useRef(null);
    const lockRef = useRef(false);
    const currentWordRef = useRef(null);

    const currentWord = order[idx];
    currentWordRef.current = currentWord;

    const speakWord = useCallback((word) => {
      if (!word) return;
      setSpeaking(true);
      speakTimes(`${word.w}. ${word.s}`, 3, () => setSpeaking(false));
    }, []);

    useEffect(() => {
      lockRef.current = false;
      setTyped('');
      setFeedback(null);
      speakWord(order[idx]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }, [idx]);

    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;
      const handler = (e) => {
        if (lockRef.current) return;
        if (e.key === 'Backspace') { e.preventDefault(); setTyped(t => t.slice(0, -1)); return; }
        if (e.key === 'Enter') { e.preventDefault(); doSubmit(); return; }
        if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); setTyped(t => t + e.key.toLowerCase()); }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, []);

    const doSubmit = () => {
      if (lockRef.current || !currentWordRef.current) return;
      const word = currentWordRef.current;
      setTyped(cur => {
        const correct = cur.toLowerCase().trim() === word.w.toLowerCase();
        lockRef.current = true;
        if (correct) {
          setFeedback('correct');
          speak('Great job!');
          setResults(prev => {
            const newResults = [...prev, { word: word.w, correct: true }];
            setTimeout(() => {
              lockRef.current = false;
              setFeedback(null);
              setAttempt(0);
              setIdx(i => {
                const nextIdx = i + 1;
                if (nextIdx >= order.length) {
                  const score = newResults.filter(r => r.correct).length;
                  const outcome = processRound(score, newResults);
                  setRoundResults({ score, ...outcome, results: newResults, words: order });
                  setGameScreen('results');
                }
                return nextIdx;
              });
            }, 1600);
            return newResults;
          });
        } else {
          setAttempt(prev => {
            if (prev < 2) {
              setFeedback('wrong');
              speak('Not quite, try again!');
              setTimeout(() => { lockRef.current = false; setFeedback(null); setTyped(''); inputRef.current?.focus(); }, 1300);
              return prev + 1;
            } else {
              setFeedback('reveal');
              setResults(prev2 => {
                const newResults = [...prev2, { word: word.w, correct: false }];
                setTimeout(() => {
                  lockRef.current = false;
                  setFeedback(null);
                  setAttempt(0);
                  setIdx(i => {
                    const nextIdx = i + 1;
                    if (nextIdx >= order.length) {
                      const score = newResults.filter(r => r.correct).length;
                      const outcome = processRound(score, newResults);
                      setRoundResults({ score, ...outcome, results: newResults, words: order });
                      setGameScreen('results');
                    }
                    return nextIdx;
                  });
                }, 2800);
                return newResults;
              });
              return prev;
            }
          });
        }
        return cur;
      });
    };

    const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

    return (
      <div style={{ width: '100%', maxWidth: 520 }}>
        <input ref={inputRef} style={{ opacity: 0, position: 'fixed', top: -100, width: 1, height: 1 }} readOnly onFocus={() => {}} />

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          {order.map((w, i) => {
            const res = results.find(r => r.word === w.w && order.indexOf(w) === i);
            const isCurrent = i === idx;
            const isDone = i < idx;
            const doneRes = isDone ? results[i] : null;
            return (
              <div key={i} style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: isCurrent ? C.blue : doneRes ? (doneRes.correct ? C.green : C.red) : 'rgba(255,255,255,0.1)',
                color: '#fff',
              }}>
                {isCurrent ? '?' : doneRes ? (doneRes.correct ? '✓' : '✗') : i + 1}
              </div>
            );
          })}
        </div>

        <div style={{ ...s.card, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{speaking ? '🎵' : '🔊'}</div>
          <div style={{ color: C.muted, fontSize: 14, marginBottom: 12 }}>{speaking ? 'Listening…' : 'Ready to spell!'}</div>
          <button style={{ ...s.btn(C.blue, 'sm') }} onClick={() => speakWord(currentWord)}>🔁 Replay</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          {[0,1,2].map(i => <div key={i} style={{ fontSize: 24 }}>{i >= attempt ? '❤️' : '🖤'}</div>)}
        </div>

        {feedback === 'correct' && (
          <div style={{ textAlign: 'center', color: C.green, fontSize: 28, animation: 'pop 0.4s ease', marginBottom: 8 }}>✅ Correct!</div>
        )}
        {feedback === 'wrong' && (
          <div style={{ textAlign: 'center', color: C.red, fontSize: 22, animation: 'shake 0.3s ease', marginBottom: 8 }}>❌ Not quite, try again!</div>
        )}
        {feedback === 'reveal' && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ color: C.red, fontSize: 20 }}>❌ The word was:</div>
            <div style={{ color: C.yellow, fontSize: 32, fontWeight: 900 }}>{currentWord?.w}</div>
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, letterSpacing: 6, marginBottom: 12, minHeight: 48, color: C.yellow }}>
          {typed || <span style={{ color: 'rgba(255,255,255,0.2)' }}>_ _ _</span>}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
          {LETTERS.map(l => (
            <button key={l}
              style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: '#fff', minWidth: 36, padding: '8px 10px', fontSize: 16, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => !lockRef.current && setTyped(t => t + l)}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>💡 Type on keyboard or tap below</div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...s.btn(C.red, 'lg'), flex: 1 }}
            onClick={() => !lockRef.current && setTyped(t => t.slice(0, -1))}>⌫ Delete</button>
          <button style={{ ...s.btn(C.green, 'lg'), flex: 1 }} onClick={doSubmit}>✅ Submit</button>
        </div>
      </div>
    );
  };

  // ── Results ─────────────────────────────────────────────────────────────────
  const ResultsScreen = () => {
    if (!roundResults) return null;
    const { score, earned, pass, shouldRetry, results: res } = roundResults;
    return (
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 900, color: pass ? C.green : C.red }}>{score}/10</div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, display: 'inline-block', padding: '6px 20px', margin: '8px 0', color: pass ? C.green : C.red, fontWeight: 700, fontSize: 18 }}>
            {pass ? '✅ Passed!' : '❌ Try again'}
          </div>
          {earned > 0 && <div style={{ color: C.yellow, fontSize: 20, fontWeight: 700 }}>+{earned} credits 💰</div>}
          {shouldRetry && <div style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Score below 6 — back to study time!</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {res.map((r, i) => (
            <div key={i} style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>{r.word}</span>
              <span style={{ fontSize: 20 }}>{r.correct ? '✅' : '❌'}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button style={{ ...s.btn(C.yellow, 'lg') }}
            onClick={() => { setRetryCount(r => r + 1); setGameScreen('stage1'); }}>
            🔄 Retry Group
          </button>
          <button style={{ ...s.btn(C.blue, 'lg') }}
            onClick={() => { const w = selectWords(getUser()); setWords(w); setRetryCount(0); setGameScreen('stage1'); }}>
            🆕 New Group
          </button>
          <button style={{ ...s.btn('rgba(255,255,255,0.12)', 'lg'), color: '#fff' }}
            onClick={() => setGameScreen('home')}>
            🏠 Home
          </button>
        </div>
      </div>
    );
  };

  // ── Collection ──────────────────────────────────────────────────────────────
  const CollectionScreen = () => {
    const user = getUser();
    const isAdmin = currentUser === 'test';
    const col = user?.collection || {};
    const regular = isAdmin ? ALL_POKEMON.length : Object.values(col).filter(c => c.regular).length;
    const shiny = isAdmin ? ALL_POKEMON.length : Object.values(col).filter(c => c.shiny).length;
    return (
      <div style={{ width: '100%', maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted }} onClick={() => isAdmin ? setScreen('parentMenu') : setGameScreen('home')}>← Back</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>🏆 Collection</div>
            <div style={{ color: C.muted, fontSize: 13 }}>{regular} / {ALL_POKEMON.length} caught · {shiny} ✨ shiny</div>
            {isAdmin && <div style={{ color: C.yellow, fontSize: 11, fontWeight: 700, marginTop: 2 }}>👑 Admin preview — all unlocked</div>}
          </div>
          <div style={{ width: 60 }} />
        </div>
        {user?.shinyEligible && (
          <div style={{ color: '#a78bfa', textAlign: 'center', animation: 'pulse 1.5s ease infinite', marginBottom: 12, fontWeight: 700 }}>✨ Shiny chance active!</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {ALL_POKEMON.map(pk => {
            const owned = col[pk.id] || {};
            const isShiny = isAdmin || owned.shiny;
            const isRegular = isAdmin || owned.regular;
            return (
              <div key={pk.id} style={{
                background: C.card, borderRadius: 12, padding: 8, textAlign: 'center', position: 'relative',
                border: isShiny ? '2px solid #a78bfa' : isRegular ? '2px solid #b45309' : `1px solid ${C.border}`,
                animation: isShiny ? 'shimmer 2s ease infinite' : 'none',
              }}>
                {isShiny && <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 12 }}>✨</div>}
                <img
                  src={isShiny ? pkShiny(pk.slug) : pkImg(pk.slug)}
                  alt={pk.name}
                  style={{ width: 48, height: 48, objectFit: 'contain', filter: !isRegular && !isShiny ? 'brightness(0) opacity(0.3)' : 'none' }}
                />
                <div style={{ fontSize: 10, color: isRegular || isShiny ? '#fff' : C.muted, marginTop: 2 }}>
                  {isRegular || isShiny ? pk.name : '???'}
                </div>
                {isShiny && <div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', marginTop: 1 }}>✨ SHINY</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const StatsScreen = () => {
    const user = getUser();
    if (!user) return null;
    const col = user.collection || {};
    const caught = Object.values(col).filter(c => c.regular || c.shiny).length;
    const mastered = Object.entries(user.wordStats || {})
      .filter(([, ws]) => ws.attempts >= 3 && ws.correct / ws.attempts >= 0.8)
      .map(([w]) => w);

    const today = new Date();
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });

    const recent = [...(user.roundHistory || [])].reverse().slice(0, 8);

    return (
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted }} onClick={() => setGameScreen('home')}>← Back</button>
          <h2 style={{ margin: 0, color: C.yellow }}>📊 Stats</h2>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            ['🎮', (user.roundHistory || []).length, 'Rounds'],
            ['📚', mastered.length, 'Mastered'],
            ['🏆', caught, 'Caught'],
          ].map(([icon, val, label]) => (
            <div key={label} style={{ ...s.card, flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 22 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>{val}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>30-Day Streak</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
            {days.map(d => {
              const isToday = d === todayStr();
              const played = (user.streakDates || []).includes(d);
              return (
                <div key={d} style={{
                  aspectRatio: '1', borderRadius: 4,
                  background: played ? C.green : 'rgba(255,255,255,0.08)',
                  border: isToday ? `2px solid ${C.yellow}` : '2px solid transparent',
                }} />
              );
            })}
          </div>
        </div>

        {recent.length > 0 && (
          <div style={{ ...s.card, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Rounds</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.muted }}>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>Date</th>
                  <th style={{ textAlign: 'center' }}>Score</th>
                  <th style={{ textAlign: 'center' }}>Credits</th>
                  <th style={{ textAlign: 'center' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 0' }}>{r.date}</td>
                    <td style={{ textAlign: 'center' }}>{r.score}/10</td>
                    <td style={{ textAlign: 'center', color: C.yellow }}>+{r.earned}</td>
                    <td style={{ textAlign: 'center' }}>{r.pass ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mastered.length > 0 && (
          <div style={{ ...s.card }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Mastered Words ({mastered.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {mastered.map(w => (
                <span key={w} style={{ background: C.green + '33', color: C.green, borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 600 }}>{w}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {showConfetti && <Confetti />}

      {unlockQueue.length > 0 && (
        <TrophyModal
          unlock={unlockQueue[0]}
          onDismiss={() => setUnlockQueue(q => q.slice(1))}
        />
      )}

      {screen === 'selectUser' && <SelectUserScreen />}
      {screen === 'login' && <LoginScreen />}
      {screen === 'adminLogin' && <AdminLoginScreen />}
      {screen === 'parentMenu' && <ParentMenuScreen />}
      {screen === 'createUser' && <CreateUserScreen />}
      {screen === 'game' && gameScreen === 'home' && <HomeScreen />}
      {screen === 'game' && gameScreen === 'stage1' && <Stage1Screen />}
      {screen === 'game' && gameScreen === 'stage2' && <Stage2Screen />}
      {screen === 'game' && gameScreen === 'results' && <ResultsScreen />}
      {screen === 'game' && gameScreen === 'collection' && <CollectionScreen />}
      {screen === 'game' && gameScreen === 'stats' && <StatsScreen />}
    </div>
  );
}
