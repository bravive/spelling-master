import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { makeAuthFetch } from './authFetch';
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
import { TrophyScreen } from './components/TrophyScreen';
import { StatsScreen } from './components/StatsScreen';
import { WeeklyChallengeScreen } from './components/WeeklyChallengeScreen';
import { WeeklyResultsScreen } from './components/WeeklyResultsScreen';
import { EditProfileScreen } from './components/EditProfileScreen';

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

  // Weekly challenge data
  const [weeklyWords, setWeeklyWords] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({});

  useEffect(() => {
    fetch('/api/weekly-words').then(r => r.json()).then(weeks =>
      setWeeklyWords(weeks.map(w => ({ ...w, id: w.id || w.weekId })))
    ).catch(() => {});
  }, []);

  // Per-user data fetched from their dedicated API endpoints after login
  const [wordStats, setWordStats] = useState({});
  const [roundHistory, setRoundHistory] = useState([]);
  const [creditHistory, setCreditHistory] = useState([]);
  const [trophyData, setTrophyData] = useState(null); // { collection, shinyEligible, consecutiveRegular }

  useEffect(() => {
    if (!jwt || !currentUser) {
      setWeeklyStats({});
      setWordStats({});
      setRoundHistory([]);
      setCreditHistory([]);
      setTrophyData(null);
      return;
    }
    const headers = { Authorization: `Bearer ${jwt}` };
    apiFetch('/api/weekly-stats', { headers }).then(r => r.json()).then(setWeeklyStats).catch(() => {});
    apiFetch('/api/wordstats', { headers }).then(r => r.json()).then(setWordStats).catch(() => {});
    apiFetch('/api/roundhistory', { headers }).then(r => r.json()).then(d => {
      setRoundHistory(d.roundHistory || []);
      setCreditHistory(d.creditHistory || []);
    }).catch(() => {});
    apiFetch('/api/trophy', { headers }).then(r => r.json()).then(setTrophyData).catch(() => {});
  }, [jwt, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Redirect to login on any 401 (expired/invalid JWT)
  const logout = useCallback(() => {
    setCurrentUser(null);
    setJwt(null);
    setScreen('selectUser');
  }, []);

  const apiFetch = useMemo(() => makeAuthFetch(logout), [logout]);

  const saveUserToServer = useCallback((userId, userData) => {
    if (!jwt) return;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` };
    apiFetch('/api/users/me', { method: 'PUT', headers, body: JSON.stringify(userData) }).catch(() => {});
    if (userData.collection !== undefined) {
      apiFetch('/api/trophy', {
        method: 'PUT', headers,
        body: JSON.stringify({ collection: userData.collection, shinyEligible: userData.shinyEligible ?? false, consecutiveRegular: userData.consecutiveRegular ?? 0 }),
      }).catch(() => {});
    }
    if (userData.wordStats) {
      apiFetch('/api/wordstats', { method: 'PUT', headers, body: JSON.stringify(userData.wordStats) }).catch(() => {});
    }
    if (userData.roundHistory) {
      apiFetch('/api/roundhistory', {
        method: 'PUT', headers,
        body: JSON.stringify({ roundHistory: userData.roundHistory, bestScores: userData.bestScores ?? {}, creditHistory: userData.creditHistory ?? [] }),
      }).catch(() => {});
    }
  }, [jwt, apiFetch]);

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
    let baseEarned = 0;
    if (score === 10) baseEarned = 5;
    else if (score === 9) baseEarned = 3;
    else if (score === 8) baseEarned = 2;

    const today = todayStr();
    let { streak, lastPlayed, streakDates, creditBank, consecutiveRegular, shinyEligible, totalCredits } = user;
    // Use trophyData for collection since it's the authoritative source
    let collection = trophyData?.collection || user.collection || {};
    const newDates = [...(streakDates || [])];
    if (!newDates.includes(today)) newDates.push(today);

    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    if (lastPlayed === today) { /* same day, no change */ }
    else if (lastPlayed === yesterday) { streak = (streak || 0) + 1; }
    else { streak = 1; }

    let streakBonus = 0;
    if (streak > 0 && streak % 3 === 0) streakBonus = 5;
    let earned = baseEarned + streakBonus;

    // Build credit history events for this round
    const newCreditEvents = [];
    if (baseEarned > 0) newCreditEvents.push({ date: today, amount: baseEarned, source: 'round', description: `Score ${score}/10` });
    if (streakBonus > 0) newCreditEvents.push({ date: today, amount: streakBonus, source: 'streak', description: `${streak}-day streak bonus` });

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

    const newRoundHistory = [...roundHistory, { date: today, score, earned, pass: score >= 6 }].slice(-200);
    const newCreditHistory = [...creditHistory, ...newCreditEvents];

    const caught = Object.values(col).filter(c => c.regular || c.shiny).length;
    const updated = { ...user, streak, lastPlayed: today, streakDates: newDates.slice(-90), creditBank, totalCredits, caught, collection: col, shinyEligible, consecutiveRegular, roundHistory: newRoundHistory, roundCount: newRoundCount, level: newLevel };

    const fullUpdate = { ...updated, wordStats: newWordStats, creditHistory: newCreditHistory };
    setWordStats(newWordStats);
    setRoundHistory(newRoundHistory);
    setCreditHistory(newCreditHistory);
    setTrophyData(prev => prev ? { ...prev, collection: col, shinyEligible, consecutiveRegular } : { collection: col, shinyEligible, consecutiveRegular });
    setUsers(prev => ({ ...prev, [currentUser]: fullUpdate }));
    saveUserToServer(currentUser, fullUpdate);
    if (newUnlocks.length) setUnlockQueue(newUnlocks);
    if (score === 10) {
      setShowConfetti(true);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setShowConfetti(false), 4000);
    }
    return { earned, pass: score >= 6, shouldRetry: score < 6 };
  }, [users, currentUser, wordStats, roundHistory, creditHistory, trophyData, saveUserToServer]);

  // ── Weekly challenge scoring ───────────────────────────────────────────────
  const processWeeklyRound = useCallback((score, results) => {
    const user = users[currentUser];
    if (!user || !activeWeekId) return { earned: 0 };
    const today = todayStr();
    const prev = weeklyStats[activeWeekId] || { wordsCorrect: [], completed: false, creditsEarned: 0, lastDailyReward: null };

    const week = weeklyWords.find(w => w.id === activeWeekId);
    const totalWords = week ? week.words.length : 0;
    const { earned, breakdown, updated } = computeWeeklyScore(prev, results, today, totalWords);

    // Save to API
    if (jwt) {
      apiFetch(`/api/weekly-stats/${activeWeekId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(updated),
      }).catch(() => {});
    }
    setWeeklyStats(prev2 => ({ ...prev2, [activeWeekId]: updated }));

    // Apply credits to bank and unlock Pokemon
    let { creditBank, consecutiveRegular, shinyEligible, totalCredits } = user;
    let collection = trophyData?.collection || user.collection || {};
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

    // Build credit history events from weekly breakdown
    const weekLabel = week?.label || activeWeekId;
    const weeklyCreditEvents = [];
    if (breakdown.correct > 0)      weeklyCreditEvents.push({ date: today, amount: breakdown.correct,      source: 'weekly', description: `${weekLabel}: ${breakdown.correctCount} new word${breakdown.correctCount !== 1 ? 's' : ''}` });
    if (breakdown.allCompleted > 0) weeklyCreditEvents.push({ date: today, amount: breakdown.allCompleted, source: 'weekly', description: `${weekLabel}: completed all words` });
    if (breakdown.daily > 0)        weeklyCreditEvents.push({ date: today, amount: breakdown.daily,        source: 'weekly', description: `${weekLabel}: daily replay bonus` });
    const newCreditHistory = [...creditHistory, ...weeklyCreditEvents];

    const caught = Object.values(col).filter(c => c.regular || c.shiny).length;
    const updatedUser = { ...user, creditBank, totalCredits, caught, collection: col, shinyEligible, consecutiveRegular, creditHistory: newCreditHistory };
    setCreditHistory(newCreditHistory);
    setTrophyData(prev2 => prev2 ? { ...prev2, collection: col, shinyEligible, consecutiveRegular } : { collection: col, shinyEligible, consecutiveRegular });
    setUsers(prev2 => ({ ...prev2, [currentUser]: updatedUser }));
    saveUserToServer(currentUser, updatedUser);
    if (newUnlocks.length) setUnlockQueue(newUnlocks);

    return { earned, creditBreakdown: breakdown };
  }, [users, currentUser, activeWeekId, weeklyStats, weeklyWords, jwt, trophyData, creditHistory, saveUserToServer, apiFetch]);

  const handleWeeklyQuit = useCallback((partialResults) => {
    if (partialResults.length > 0) {
      const score = partialResults.filter(r => r.correct).length;
      const outcome = processWeeklyRound(score, partialResults);
      setRoundResults({ score, ...outcome, results: partialResults, words });
      setGameScreen('weeklyResults');
    } else {
      setGameScreen('weekly');
    }
  }, [processWeeklyRound, words]);

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
      {screen === 'adminLogin' && <AdminLoginScreen setCurrentUser={setCurrentUser} setScreen={setScreen} setJwt={setJwt} />}
      {screen === 'parentMenu' && <ParentMenuScreen jwt={jwt} setScreen={setScreen} setCurrentUser={setCurrentUser} />}
      {screen === 'createUser' && <CreateUserScreen users={users} saveUsers={saveUsers} createStep={createStep} setCreateStep={setCreateStep} newName={newName} setNewName={setNewName} newStarter={newStarter} setNewStarter={setNewStarter} newPin={newPin} setNewPin={setNewPin} confirmPin={confirmPin} setConfirmPin={setConfirmPin} setScreen={setScreen} />}
      {screen === 'game' && gameScreen === 'home' && <HomeScreen getUser={getUser} wordStats={wordStats} trophyData={trophyData} weeklyWords={weeklyWords} weeklyStats={weeklyStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} setCurrentUser={setCurrentUser} setScreen={setScreen} />}
      {screen === 'game' && gameScreen === 'stage1' && <Stage1Screen words={words} retryCount={retryCount} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'stage2' && <Stage2Screen words={words} processRound={processRound} setRoundResults={setRoundResults} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'results' && <ResultsScreen roundResults={roundResults} getUser={getUser} wordStats={wordStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'trophy' && <TrophyScreen trophyData={trophyData} currentUser={currentUser} setScreen={setScreen} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'stats' && <StatsScreen getUser={getUser} wordStats={wordStats} roundHistory={roundHistory} creditHistory={creditHistory} weeklyStats={weeklyStats} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'weekly' && <WeeklyChallengeScreen weeklyWords={weeklyWords} weeklyStats={weeklyStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} setActiveWeekId={setActiveWeekId} initialSelectedId={activeWeekId} />}
      {screen === 'game' && gameScreen === 'weeklyStage1' && (() => {
        const wp = weeklyStats[activeWeekId];
        const completed = wp?.completed;
        const label = completed ? '🔁 Replay!' : "✅ I'm Ready!";
        return <Stage1Screen words={words} retryCount={retryCount} setGameScreen={setGameScreen} nextScreen="weeklyStage2" discardScreen="weekly" quitLabel="Quit" readyLabel={label} />;
      })()}
      {screen === 'game' && gameScreen === 'weeklyStage2' && <Stage2Screen words={words} processRound={processWeeklyRound} setRoundResults={setRoundResults} setGameScreen={setGameScreen} resultsScreen="weeklyResults" discardScreen="weekly" onQuit={handleWeeklyQuit} unlimitedRetries allowSkip />}
      {screen === 'game' && gameScreen === 'weeklyResults' && <WeeklyResultsScreen roundResults={roundResults} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'editProfile' && <EditProfileScreen user={getUser()} jwt={jwt} saveUsers={saveUsers} users={users} currentUser={currentUser} setGameScreen={setGameScreen} />}

    </div>
  );
}
