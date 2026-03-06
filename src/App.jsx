import { useState, useEffect, useRef, useCallback } from 'react';
import { ALL_POKEMON } from './data/pokemon';
import { selectWords, updateWordStats, checkLevelUp } from './wordSelection';
import { computeWeeklyScore } from './weeklyScoring';
import { todayStr, localDateStr, injectCSS, C, s } from './shared';

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
import { WeeklyChallengeScreen } from './components/WeeklyChallengeScreen';
import { WeeklyResultsScreen } from './components/WeeklyResultsScreen';

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  injectCSS();

  const isAdminBackdoor = new URLSearchParams(window.location.search).get('admin') === '1';

  const [screen, setScreen] = useState(() => isAdminBackdoor ? 'adminLogin' : 'selectUser');
  const [gameScreen, setGameScreen] = useState('home');
  const [users, setUsers] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [jwt, setJwt] = useState(() => sessionStorage.getItem('jwt') || null);
  const hasRestored = useRef(false);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => {
      setUsers(data);
      hasRestored.current = true;
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

  // Per-user word stats (fetched from /api/wordstats on login)
  const [wordStats, setWordStats] = useState({});

  useEffect(() => {
    if (!currentUser) { setWordStats({}); return; }
    setWordStats(users[currentUser]?.wordStats || {});
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Game state
  const [words, setWords] = useState([]);
  const [retryCount, setRetryCount] = useState(0);
  const [roundResults, setRoundResults] = useState(null);
  const [activeWeekId, setActiveWeekId] = useState(null);

  // Persist session whenever screen/user changes
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('currentUser', currentUser);
      sessionStorage.setItem('screen', screen);
      sessionStorage.setItem('gameScreen', gameScreen);
      if (jwt) sessionStorage.setItem('jwt', jwt);
    } else if (hasRestored.current) {
      // Only clear after restoration is done — avoids wiping storage on mount
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('screen');
      sessionStorage.removeItem('gameScreen');
      sessionStorage.removeItem('jwt');
      setJwt(null);
    }
  }, [currentUser, screen, gameScreen, jwt]);

  const saveUsers = setUsers;

  const saveUserToServer = useCallback((userId, userData) => {
    if (!jwt) return;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` };
    fetch('/api/users/me', {
      method: 'PUT', headers, body: JSON.stringify(userData),
    });
    if (userData.collection) {
      fetch('/api/collection', {
        method: 'PUT', headers,
        body: JSON.stringify({ collection: userData.collection, shinyEligible: userData.shinyEligible, consecutiveRegular: userData.consecutiveRegular }),
      });
    }
  }, [jwt]);

  const getUser = useCallback(() => users[currentUser] || null, [users, currentUser]);

  const updateUser = useCallback((fn) => {
    setUsers(prev => {
      const updated = fn(prev[currentUser]);
      saveUserToServer(currentUser, updated);
      return { ...prev, [currentUser]: updated };
    });
  }, [currentUser, saveUserToServer]);

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

    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    if (lastPlayed === today) { /* same day, no change */ }
    else if (lastPlayed === yesterday) { streak = (streak || 0) + 1; }
    else { streak = 1; }

    if (streak > 0 && streak % 3 === 0) earned += 5;

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

    const caught = Object.values(col).filter(c => c.regular || c.shiny).length;
    const updated = { ...user, streak, lastPlayed: today, streakDates: newDates.slice(-90), creditBank, totalCredits, caught, collection: col, shinyEligible, consecutiveRegular, roundHistory, roundCount: newRoundCount, level: newLevel };

    const fullUpdate = { ...updated, wordStats: newWordStats };
    setWordStats(newWordStats);
    setUsers(prev => ({ ...prev, [currentUser]: fullUpdate }));
    saveUserToServer(currentUser, fullUpdate);
    if (newUnlocks.length) setUnlockQueue(newUnlocks);
    if (score === 10) {
      setShowConfetti(true);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setShowConfetti(false), 4000);
    }
    return { earned, pass: score >= 6, shouldRetry: score < 6 };
  }, [users, currentUser, wordStats]);

  // ── Weekly challenge scoring ───────────────────────────────────────────────
  const processWeeklyRound = useCallback((score, results) => {
    const user = users[currentUser];
    if (!user || !activeWeekId) return { earned: 0 };
    const today = todayStr();
    const wp = { ...(user.weeklyProgress || {}) };
    const prev = wp[activeWeekId] || { firstAttemptCorrect: [], completed: false, perfectRun: false, creditsEarned: 0, lastDailyReward: null };

    const { earned, breakdown, updated } = computeWeeklyScore(prev, results, today);
    wp[activeWeekId] = updated;

    // Apply credits to bank and unlock Pokemon
    let { creditBank, consecutiveRegular, shinyEligible, collection, totalCredits } = user;
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

    const caught = Object.values(col).filter(c => c.regular || c.shiny).length;
    const updated = { ...user, creditBank, totalCredits, caught, collection: col, shinyEligible, consecutiveRegular, weeklyProgress: wp };
    setUsers(prev2 => ({ ...prev2, [currentUser]: updated }));
    saveUserToServer(currentUser, updated);
    if (newUnlocks.length) setUnlockQueue(newUnlocks);

    return { earned, creditBreakdown: breakdown };
  }, [users, currentUser, activeWeekId, saveUserToServer]);

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
      {screen === 'login' && <LoginScreen users={users} loginTarget={loginTarget} loginPin={loginPin} setLoginPin={setLoginPin} loginError={loginError} setLoginError={setLoginError} setCurrentUser={setCurrentUser} setScreen={setScreen} setGameScreen={setGameScreen} setJwt={setJwt} />}
      {screen === 'adminLogin' && <AdminLoginScreen setCurrentUser={setCurrentUser} setScreen={setScreen} />}
      {screen === 'parentMenu' && <ParentMenuScreen users={users} saveUsers={saveUsers} jwt={jwt} setCreateStep={setCreateStep} setNewName={setNewName} setNewStarter={setNewStarter} setNewPin={setNewPin} setConfirmPin={setConfirmPin} setScreen={setScreen} setGameScreen={setGameScreen} setCurrentUser={setCurrentUser} />}
      {screen === 'createUser' && <CreateUserScreen users={users} saveUsers={saveUsers} createStep={createStep} setCreateStep={setCreateStep} newName={newName} setNewName={setNewName} newStarter={newStarter} setNewStarter={setNewStarter} newPin={newPin} setNewPin={setNewPin} confirmPin={confirmPin} setConfirmPin={setConfirmPin} setScreen={setScreen} />}
      {screen === 'game' && gameScreen === 'home' && <HomeScreen getUser={getUser} wordStats={wordStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} setCurrentUser={setCurrentUser} setScreen={setScreen} />}
      {screen === 'game' && gameScreen === 'stage1' && <Stage1Screen words={words} retryCount={retryCount} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'stage2' && <Stage2Screen words={words} processRound={processRound} setRoundResults={setRoundResults} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'results' && <ResultsScreen roundResults={roundResults} getUser={getUser} wordStats={wordStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'collection' && <CollectionScreen getUser={getUser} currentUser={currentUser} jwt={jwt} setScreen={setScreen} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'stats' && <StatsScreen getUser={getUser} wordStats={wordStats} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'weekly' && <WeeklyChallengeScreen getUser={getUser} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} setActiveWeekId={setActiveWeekId} />}
      {screen === 'game' && gameScreen === 'weeklyStage1' && <Stage1Screen words={words} retryCount={retryCount} setGameScreen={setGameScreen} nextScreen="weeklyStage2" discardScreen="weekly" />}
      {screen === 'game' && gameScreen === 'weeklyStage2' && <Stage2Screen words={words} processRound={processWeeklyRound} setRoundResults={setRoundResults} setGameScreen={setGameScreen} resultsScreen="weeklyResults" discardScreen="weekly" />}
      {screen === 'game' && gameScreen === 'weeklyResults' && <WeeklyResultsScreen roundResults={roundResults} setGameScreen={setGameScreen} />}

    </div>
  );
}
