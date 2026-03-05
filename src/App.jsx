import { useState, useEffect, useRef, useCallback } from 'react';
import { ALL_POKEMON } from './data/pokemon';
import { selectWords, updateWordStats, checkLevelUp } from './wordSelection';
import { save, todayStr, injectCSS, C, s } from './shared';

import { Confetti } from './components/Confetti';
import { TrophyModal } from './components/TrophyModal';
import { SelectUserScreen } from './components/SelectUserScreen';
import { LoginScreen } from './components/LoginScreen';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { ParentMenuScreen } from './components/ParentMenuScreen';
import { CreateUserScreen } from './components/CreateUserScreen';
import { HomeScreen } from './components/HomeScreen';
import { Stage1Screen } from './components/Stage1Screen';
import { Stage2Screen } from './components/Stage2Screen';
import { ResultsScreen } from './components/ResultsScreen';
import { CollectionScreen } from './components/CollectionScreen';
import { StatsScreen } from './components/StatsScreen';

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

  // Per-user word stats (loaded separately from users.json)
  const [wordStats, setWordStats] = useState({});

  useEffect(() => {
    if (!currentUser) { setWordStats({}); return; }
    const enc = encodeURIComponent(currentUser);
    Promise.all([
      fetch(`/api/wordstats/${enc}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/collection/${enc}`).then(r => r.json()).catch(() => null),
      fetch(`/api/roundhistory/${enc}`).then(r => r.json()).catch(() => null),
    ]).then(([ws, colData, rhData]) => {
      setWordStats(ws || {});
      if (colData || rhData) {
        setUsers(prev => {
          if (!prev[currentUser]) return prev;
          return {
            ...prev,
            [currentUser]: {
              ...prev[currentUser],
              ...(colData || {}),
              ...(rhData || {}),
            },
          };
        });
      }
    });
  }, [currentUser]);

  const apiPost = (path, body) =>
    fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const saveWordStats = (username, stats) =>
    apiPost(`/api/wordstats/${encodeURIComponent(username)}`, stats);

  const saveCollection = (username, data) =>
    apiPost(`/api/collection/${encodeURIComponent(username)}`, data);

  const saveRoundHistory = (username, data) =>
    apiPost(`/api/roundhistory/${encodeURIComponent(username)}`, data);

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
    const newWordStats = updateWordStats(wordStats, results, newRoundCount);
    const newLevel = checkLevelUp(newWordStats, user.level);

    const roundHistory = [...(user.roundHistory || []), { date: today, score, earned, pass: score >= 6 }].slice(-200);

    const updated = { ...user, streak, lastPlayed: today, streakDates: newDates.slice(-90), creditBank, totalCredits, collection: col, shinyEligible, consecutiveRegular, roundHistory, roundCount: newRoundCount, level: newLevel };

    setWordStats(newWordStats);
    saveWordStats(currentUser, newWordStats);
    saveCollection(currentUser, { collection: col, shinyEligible, consecutiveRegular });
    saveRoundHistory(currentUser, { roundHistory, bestScores: updated.bestScores || {} });
    setUsers(prev => { const next = { ...prev, [currentUser]: updated }; save(next); return next; });
    if (newUnlocks.length) setUnlockQueue(newUnlocks);
    if (score === 10) {
      setShowConfetti(true);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setShowConfetti(false), 4000);
    }
    return { earned, pass: score >= 6, shouldRetry: score < 6 };
  }, [users, currentUser, wordStats]);

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

      {screen === 'selectUser' && <SelectUserScreen users={users} setLoginTarget={setLoginTarget} setLoginPin={setLoginPin} setLoginError={setLoginError} setScreen={setScreen} setCreateStep={setCreateStep} setNewName={setNewName} setNewStarter={setNewStarter} setNewPin={setNewPin} setConfirmPin={setConfirmPin} />}
      {screen === 'login' && <LoginScreen users={users} loginTarget={loginTarget} loginPin={loginPin} setLoginPin={setLoginPin} loginError={loginError} setLoginError={setLoginError} setCurrentUser={setCurrentUser} setScreen={setScreen} setGameScreen={setGameScreen} />}
      {screen === 'adminLogin' && <AdminLoginScreen setCurrentUser={setCurrentUser} setScreen={setScreen} />}
      {screen === 'parentMenu' && <ParentMenuScreen users={users} saveUsers={saveUsers} setCreateStep={setCreateStep} setNewName={setNewName} setNewStarter={setNewStarter} setNewPin={setNewPin} setConfirmPin={setConfirmPin} setScreen={setScreen} setGameScreen={setGameScreen} setCurrentUser={setCurrentUser} />}
      {screen === 'createUser' && <CreateUserScreen users={users} saveUsers={saveUsers} createStep={createStep} setCreateStep={setCreateStep} newName={newName} setNewName={setNewName} newStarter={newStarter} setNewStarter={setNewStarter} newPin={newPin} setNewPin={setNewPin} confirmPin={confirmPin} setConfirmPin={setConfirmPin} setScreen={setScreen} />}
      {screen === 'game' && gameScreen === 'home' && <HomeScreen getUser={getUser} wordStats={wordStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} setCurrentUser={setCurrentUser} setScreen={setScreen} />}
      {screen === 'game' && gameScreen === 'stage1' && <Stage1Screen words={words} retryCount={retryCount} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'stage2' && <Stage2Screen words={words} processRound={processRound} setRoundResults={setRoundResults} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'results' && <ResultsScreen roundResults={roundResults} getUser={getUser} wordStats={wordStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'collection' && <CollectionScreen getUser={getUser} currentUser={currentUser} setScreen={setScreen} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'stats' && <StatsScreen getUser={getUser} setGameScreen={setGameScreen} />}
    </div>
  );
}
