import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { makeAuthFetch } from './authFetch';
import { ALL_POKEMON } from './data/pokemon';
import { unlockPokemon } from './unlockPokemon';
import { pickNextPokemon } from './pickNextPokemon';
import { selectWords, updateWordStats, checkLevelUp } from './wordSelection';
import { computeWeeklyScore } from './weeklyScoring';
import { todayStr, localDateStr, injectCSS, isPkCaught, C, s } from './shared';

import { Confetti } from './components/Confetti';
import { TrophyModal } from './components/TrophyModal';
import { SelectUserScreen } from './components/SelectUserScreen';

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
import { FriendsScreen } from './components/FriendsScreen';

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  injectCSS();

  const isAdminRoute = window.location.pathname.startsWith('/admin');
  const urlInviteCode = new URLSearchParams(window.location.search).get('code')?.toUpperCase() || '';

  const [screen, setScreen] = useState(() => {
    if (isAdminRoute) return 'adminLogin';
    if (urlInviteCode) return 'createUser';
    return 'selectUser';
  });
  const [gameScreen, setGameScreen] = useState('home');
  const [users, setUsers] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [jwt, setJwt] = useState(() => localStorage.getItem('jwt') || null);
  const hasRestored = useRef(false);

  // Weekly challenge data
  const [weeklyWords, setWeeklyWords] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({});

  useEffect(() => {
    fetch('/api/weekly-words').then(r => r.json()).then(weeks =>
      setWeeklyWords(weeks.map(w => ({ ...w, id: w.id || w.weekId })))
    ).catch(() => {});
  }, []);

  // Clean invite code from URL after it's been read into state
  useEffect(() => {
    if (urlInviteCode) window.history.replaceState({}, '', '/');
  }, []);

  // Per-user data fetched from their dedicated API endpoints after login
  const [wordStats, setWordStats] = useState({});
  const [roundHistory, setRoundHistory] = useState([]);
  const [creditHistory, setCreditHistory] = useState([]);
  const [trophyData, setTrophyData] = useState(null); // { collection, shinyEligible, consecutiveRegular }

  const [unlockQueue, setUnlockQueue] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimer = useRef(null);

  // Create user flow
  const [createStep, setCreateStep] = useState(0);
  const [inviteCode, setInviteCode] = useState(() => urlInviteCode);
  const [newName, setNewName] = useState('');
  const [newStarter, setNewStarter] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Game state
  const [words, setWords] = useState([]);
  const [retryCount, setRetryCount] = useState(0);
  const [roundResults, setRoundResults] = useState(null);
  const [activeWeekId, setActiveWeekId] = useState(null);

  // Persist session whenever screen/user changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', currentUser);
      localStorage.setItem('screen', screen);
      localStorage.setItem('gameScreen', gameScreen);
      if (jwt) localStorage.setItem('jwt', jwt);
    } else if (hasRestored.current) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('screen');
      localStorage.removeItem('gameScreen');
      localStorage.removeItem('jwt');
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

  const refreshUserData = useCallback(() => {
    if (!jwt || !currentUser) return;
    const headers = { Authorization: `Bearer ${jwt}` };
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {});
    apiFetch('/api/weekly-stats', { headers }).then(r => r.json()).then(setWeeklyStats).catch(() => {});
    apiFetch('/api/wordstats', { headers }).then(r => r.json()).then(setWordStats).catch(() => {});
    apiFetch('/api/roundhistory', { headers }).then(r => r.json()).then(d => {
      setRoundHistory(d.roundHistory || []);
    }).catch(() => {});
    apiFetch('/api/credithistory', { headers }).then(r => r.json()).then(setCreditHistory).catch(() => {});
    apiFetch('/api/trophy', { headers }).then(r => r.json()).then(data => {
      const col = data.collection || {};
      // Recompute nextPokemonId if missing or already caught
      if (!data.nextPokemonId || isPkCaught(col[data.nextPokemonId])) {
        const next = pickNextPokemon(col);
        data.nextPokemonId = next?.id || null;
        // Persist the computed nextPokemonId
        apiFetch('/api/trophy', {
          method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).catch(() => {});
      }
      setTrophyData(data);
    }).catch(() => {});
  }, [jwt, currentUser, apiFetch]);

  useEffect(() => {
    if (!jwt || !currentUser) {
      setWeeklyStats({});
      setWordStats({});
      setRoundHistory([]);
      setCreditHistory([]);
      setTrophyData(null);
      return;
    }
    refreshUserData();
  }, [jwt, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload data when tab becomes visible again (e.g. after locking/unlocking phone)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUserData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshUserData]);

  // Refresh data when returning to home (e.g. after completing a round)
  const prevGameScreen = useRef(gameScreen);
  useEffect(() => {
    if (gameScreen === 'home' && prevGameScreen.current !== 'home') refreshUserData();
    prevGameScreen.current = gameScreen;
  }, [gameScreen, refreshUserData]);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => {
      setUsers(data);
      hasRestored.current = true;
      if (isAdminRoute) return;

      // Restore session if one exists
      const savedUser = localStorage.getItem('currentUser');
      const savedScreen = localStorage.getItem('screen');
      const savedGameScreen = localStorage.getItem('gameScreen');
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

  const saveUserToServer = useCallback((userId, userData) => {
    if (!jwt) return;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` };
    // Strip fields that belong in dedicated collections
    const { collection: _col, creditHistory: _ch, roundHistory: _rh, wordStats: _ws,
            shinyEligible: _se, consecutiveRegular: _cr, nextPokemonId: _np,
            bestScores: _bs, ...userFields } = userData;
    apiFetch('/api/users/me', { method: 'PUT', headers, body: JSON.stringify(userFields) }).catch(() => {});
    if (userData.collection !== undefined) {
      apiFetch('/api/trophy', {
        method: 'PUT', headers,
        body: JSON.stringify({ collection: userData.collection, shinyEligible: userData.shinyEligible ?? false, consecutiveRegular: userData.consecutiveRegular ?? 0, nextPokemonId: userData.nextPokemonId ?? null }),
      }).catch(() => {});
    }
    if (userData.wordStats) {
      apiFetch('/api/wordstats', { method: 'PUT', headers, body: JSON.stringify(userData.wordStats) }).catch(() => {});
    }
    if (userData.roundHistory) {
      apiFetch('/api/roundhistory', {
        method: 'PUT', headers,
        body: JSON.stringify({ roundHistory: userData.roundHistory, bestScores: userData.bestScores ?? {} }),
      }).catch(() => {});
    }
    if (userData.creditHistory) {
      apiFetch('/api/credithistory', {
        method: 'PUT', headers,
        body: JSON.stringify(userData.creditHistory),
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
    let collection = trophyData?.collection || {};
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

    let nextPokemonId = trophyData?.nextPokemonId;
    // Ensure nextPokemonId is valid (not null, not already caught)
    if (!nextPokemonId || isPkCaught(collection[nextPokemonId])) {
      const next = pickNextPokemon(collection);
      nextPokemonId = next?.id || null;
    }
    const unlock = unlockPokemon({ creditBank, consecutiveRegular, shinyEligible, collection, nextPokemonId });
    creditBank = unlock.creditBank;
    consecutiveRegular = unlock.consecutiveRegular;
    shinyEligible = unlock.shinyEligible;
    let col = unlock.collection;
    const newUnlocks = unlock.newUnlocks;

    const newRoundCount = (user.roundCount || 0) + 1;
    const newWordStats = updateWordStats(wordStats, results, newRoundCount);
    const newLevel = checkLevelUp(newWordStats, user.level);

    const newRoundHistory = [...roundHistory, { date: today, score, earned, pass: score >= 6 }].slice(-200);
    const newCreditHistory = [...creditHistory, ...newCreditEvents];

    const caught = Object.values(col).filter(c => isPkCaught(c)).length;
    // User-level fields only (no collection/trophy/history/stats data)
    const updated = { ...user, streak, lastPlayed: today, streakDates: newDates.slice(-90), creditBank, totalCredits, caught, roundCount: newRoundCount, level: newLevel };

    // Full update includes all fields so saveUserToServer can route each to its dedicated endpoint
    const fullUpdate = { ...updated, collection: col, shinyEligible, consecutiveRegular, nextPokemonId: unlock.nextPokemonId, roundHistory: newRoundHistory, bestScores: user.bestScores, wordStats: newWordStats, creditHistory: newCreditHistory };
    setWordStats(newWordStats);
    setRoundHistory(newRoundHistory);
    setCreditHistory(newCreditHistory);
    setTrophyData(prev => prev ? { ...prev, collection: col, shinyEligible, consecutiveRegular, nextPokemonId: unlock.nextPokemonId } : { collection: col, shinyEligible, consecutiveRegular, nextPokemonId: unlock.nextPokemonId });
    setUsers(prev => ({ ...prev, [currentUser]: updated }));
    saveUserToServer(currentUser, fullUpdate);
    if (newUnlocks.length) {
      setUnlockQueue(newUnlocks);
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
      for (const u of newUnlocks) {
        const entry = u.shiny
          ? { action: 'shiny', pokemon: u.slug }
          : { action: 'catch', pokemon: u.slug };
        apiFetch('/api/trophyhistory', { method: 'POST', headers: h, body: JSON.stringify(entry) }).catch(() => {});
      }
    }
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
    let collection = trophyData?.collection || {};
    creditBank = (creditBank || 0) + earned;
    totalCredits = (totalCredits || 0) + earned;

    let nextPokemonId2 = trophyData?.nextPokemonId;
    // Ensure nextPokemonId is valid (not null, not already caught)
    if (!nextPokemonId2 || isPkCaught(collection[nextPokemonId2])) {
      const next = pickNextPokemon(collection);
      nextPokemonId2 = next?.id || null;
    }
    const unlock = unlockPokemon({ creditBank, consecutiveRegular, shinyEligible, collection, nextPokemonId: nextPokemonId2 });
    creditBank = unlock.creditBank;
    consecutiveRegular = unlock.consecutiveRegular;
    shinyEligible = unlock.shinyEligible;
    let col = unlock.collection;
    const newUnlocks = unlock.newUnlocks;

    // Build credit history events from weekly breakdown
    const weekLabel = week?.label || activeWeekId;
    const weeklyCreditEvents = [];
    if (breakdown.correct > 0)      weeklyCreditEvents.push({ date: today, amount: breakdown.correct,      source: 'weekly', description: `${weekLabel}: ${breakdown.correctCount} new word${breakdown.correctCount !== 1 ? 's' : ''}` });
    if (breakdown.allCompleted > 0) weeklyCreditEvents.push({ date: today, amount: breakdown.allCompleted, source: 'weekly', description: `${weekLabel}: completed all words` });
    if (breakdown.daily > 0)        weeklyCreditEvents.push({ date: today, amount: breakdown.daily,        source: 'weekly', description: `${weekLabel}: daily replay bonus` });
    const newCreditHistory = [...creditHistory, ...weeklyCreditEvents];

    const caught = Object.values(col).filter(c => isPkCaught(c)).length;
    // User-level fields only
    const updatedUser = { ...user, creditBank, totalCredits, caught };
    // Full update for routing to dedicated endpoints
    const fullWeeklyUpdate = { ...updatedUser, collection: col, shinyEligible, consecutiveRegular, nextPokemonId: unlock.nextPokemonId, creditHistory: newCreditHistory };
    setCreditHistory(newCreditHistory);
    setTrophyData(prev2 => prev2 ? { ...prev2, collection: col, shinyEligible, consecutiveRegular, nextPokemonId: unlock.nextPokemonId } : { collection: col, shinyEligible, consecutiveRegular, nextPokemonId: unlock.nextPokemonId });
    setUsers(prev2 => ({ ...prev2, [currentUser]: updatedUser }));
    saveUserToServer(currentUser, fullWeeklyUpdate);
    if (newUnlocks.length) {
      setUnlockQueue(newUnlocks);
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
      for (const u of newUnlocks) {
        const entry = u.shiny
          ? { action: 'shiny', pokemon: u.slug }
          : { action: 'catch', pokemon: u.slug };
        apiFetch('/api/trophyhistory', { method: 'POST', headers: h, body: JSON.stringify(entry) }).catch(() => {});
      }
    }

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

      {screen === 'selectUser' && <SelectUserScreen setCurrentUser={setCurrentUser} setScreen={setScreen} setGameScreen={setGameScreen} setJwt={setJwt} setCreateStep={setCreateStep} setNewName={setNewName} setNewStarter={setNewStarter} setNewPin={setNewPin} setConfirmPin={setConfirmPin} />}
      {screen === 'adminLogin' && <AdminLoginScreen setCurrentUser={setCurrentUser} setScreen={setScreen} setJwt={setJwt} />}
      {screen === 'parentMenu' && <ParentMenuScreen jwt={jwt} setScreen={setScreen} setCurrentUser={setCurrentUser} />}
      {screen === 'createUser' && <CreateUserScreen users={users} saveUsers={saveUsers} createStep={createStep} setCreateStep={setCreateStep} inviteCode={inviteCode} setInviteCode={setInviteCode} newName={newName} setNewName={setNewName} newStarter={newStarter} setNewStarter={setNewStarter} newPin={newPin} setNewPin={setNewPin} confirmPin={confirmPin} setConfirmPin={setConfirmPin} setScreen={setScreen} />}
      {screen === 'game' && gameScreen === 'home' && <HomeScreen getUser={getUser} wordStats={wordStats} trophyData={trophyData} weeklyWords={weeklyWords} weeklyStats={weeklyStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} setCurrentUser={setCurrentUser} setScreen={setScreen} />}
      {screen === 'game' && gameScreen === 'stage1' && <Stage1Screen words={words} retryCount={retryCount} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'stage2' && <Stage2Screen words={words} processRound={processRound} setRoundResults={setRoundResults} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'results' && <ResultsScreen roundResults={roundResults} getUser={getUser} wordStats={wordStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'trophy' && <TrophyScreen trophyData={trophyData} currentUser={currentUser} setScreen={setScreen} setGameScreen={setGameScreen} jwt={jwt} getUser={getUser} updateUser={updateUser} apiFetch={apiFetch} setTrophyData={setTrophyData} />}
      {screen === 'game' && gameScreen === 'stats' && <StatsScreen getUser={getUser} wordStats={wordStats} roundHistory={roundHistory} creditHistory={creditHistory} weeklyStats={weeklyStats} setGameScreen={setGameScreen} jwt={jwt} apiFetch={apiFetch} />}
      {screen === 'game' && gameScreen === 'weekly' && <WeeklyChallengeScreen weeklyWords={weeklyWords} weeklyStats={weeklyStats} setWords={setWords} setRetryCount={setRetryCount} setGameScreen={setGameScreen} setActiveWeekId={setActiveWeekId} initialSelectedId={activeWeekId} />}
      {screen === 'game' && gameScreen === 'weeklyStage1' && (() => {
        const wp = weeklyStats[activeWeekId];
        const completed = wp?.completed;
        const label = completed ? '🔁 Replay!' : "✅ I'm Ready!";
        return <Stage1Screen words={words} retryCount={retryCount} setGameScreen={setGameScreen} nextScreen="weeklyStage2" discardScreen="weekly" quitLabel="Quit" readyLabel={label} requireClickAll={false} />;
      })()}
      {screen === 'game' && gameScreen === 'weeklyStage2' && <Stage2Screen words={words} processRound={processWeeklyRound} setRoundResults={setRoundResults} setGameScreen={setGameScreen} resultsScreen="weeklyResults" discardScreen="weekly" onQuit={handleWeeklyQuit} unlimitedRetries allowSkip />}
      {screen === 'game' && gameScreen === 'weeklyResults' && <WeeklyResultsScreen roundResults={roundResults} setGameScreen={setGameScreen} />}
      {screen === 'game' && gameScreen === 'editProfile' && <EditProfileScreen user={getUser()} jwt={jwt} saveUsers={saveUsers} users={users} currentUser={currentUser} setGameScreen={setGameScreen} trophyData={trophyData} />}
      {screen === 'game' && gameScreen === 'friends' && <FriendsScreen jwt={jwt} currentUser={currentUser} myStarterSlug={getUser()?.starterSlug} setGameScreen={setGameScreen} setTrophyData={setTrophyData} />}

    </div>
  );
}
