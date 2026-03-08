import { useMemo } from 'react';
import { ALL_POKEMON, pkImg } from '../data/pokemon';
import { pickNextPokemon } from '../pickNextPokemon';
import { selectWords } from '../wordSelection';
import { todayStr, C, s } from '../shared';
import { RulesModal } from './RulesModal';

export const HomeScreen = ({ getUser, wordStats, trophyData, weeklyWords, weeklyStats, setWords, setRetryCount, setGameScreen, setCurrentUser, setScreen }) => {
  const user = getUser();
  if (!user) return null;
  const col = trophyData?.collection || {};
  const caught = user.caught || 0;
  const nextPkId = trophyData?.nextPokemonId;
  const nextPk = useMemo(
    () => nextPkId ? ALL_POKEMON.find(p => p.id === nextPkId) : pickNextPokemon(col),
    [nextPkId, caught]
  );

  const today = todayStr();
  const available = weeklyWords.filter(w => w.startDate <= today);
  const hasWeeklyCredits = available.some(week => {
    const wp = weeklyStats[week.id];
    if (!wp) return true;
    if ((wp.wordsCorrect || []).length < week.words.length) return true;
    if (wp.completed && wp.lastDailyReward && wp.lastDailyReward !== today) return true;
    return false;
  });

  return (
    <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span
          style={{ color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => { setCurrentUser(null); setScreen('selectUser'); }}
        >Exit</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RulesModal />
          <span
            style={{ color: C.muted, fontSize: 18, cursor: 'pointer' }}
            title="Edit Profile"
            onClick={() => setGameScreen('editProfile')}
          >&#9881;</span>
        </div>
      </div>

      {/* Profile: centered avatar + name */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <img src={pkImg(user.starterSlug)} alt="" style={{ width: 88, height: 88, objectFit: 'contain', animation: 'float 3s ease-in-out infinite' }} />
        <h2 style={{ margin: '6px 0 4px', fontSize: 24, fontWeight: 900 }}>{user.name}</h2>
        <div style={{ ...s.badge, background: `${C.purple}22`, color: C.purple, display: 'inline-block' }}>Level {user.level} Speller</div>
      </div>

      {/* Weekly floating notification */}
      {hasWeeklyCredits && (
        <div
          onClick={() => setGameScreen('weekly')}
          style={{
            position: 'absolute', top: 40, right: 0,
            cursor: 'pointer',
            background: `${C.yellow}1a`,
            border: `1.5px solid ${C.yellow}`,
            borderRadius: 14, padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            animation: 'pulse 1.5s ease infinite',
            boxShadow: `0 0 12px ${C.yellow}33`,
          }}
        >
          <span style={{ fontSize: 16 }}>📅</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.yellow }}>Weekly</span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: C.yellow,
            boxShadow: `0 0 6px ${C.yellow}`,
            animation: 'bounce 1s ease infinite',
          }} />
        </div>
      )}

      {!hasWeeklyCredits && (
        <div
          onClick={() => setGameScreen('weekly')}
          style={{
            position: 'absolute', top: 40, right: 0,
            cursor: 'pointer',
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: 0.6,
          }}
        >
          <span style={{ fontSize: 16 }}>📅</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Weekly</span>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['💰', user.totalCredits, 'Credits'], ['🔥', user.streak, 'Streak'], ['🏆', caught, 'Caught']].map(([icon, val, label]) => (
          <div key={label} style={{ ...s.card, flex: 1, textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.yellow }}>{val}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Next Pokemon */}
      {nextPk && (
        <div style={{ ...s.card, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
          <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
            <img src={pkImg(nextPk.slug)} alt="?" style={{ width: 56, height: 56, objectFit: 'contain', filter: 'brightness(0)', opacity: 0.4 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>❓</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>Next Pokemon</div>
            {trophyData?.shinyEligible && (
              <div style={{ color: C.shiny, fontSize: 12, animation: 'pulse 1.5s ease infinite', marginBottom: 3 }}>✨ Shiny chance active!</div>
            )}
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(user.creditBank / 10) * 100}%`, height: '100%', background: C.yellow, transition: 'width 0.3s', borderRadius: 8 }} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{user.creditBank}/10 credits</div>
          </div>
        </div>
      )}

      {/* Start Round */}
      <button style={{ ...s.btn(C.yellow, 'lg'), width: '100%', marginBottom: 12, animation: 'pulse 2s ease infinite' }}
        onClick={() => {
          const u = getUser();
          const w = selectWords(wordStats, u.level, u.roundCount || 0);
          setWords(w); setRetryCount(0); setGameScreen('stage1');
        }}>
        🚀 Start Round!
      </button>

      {/* Bottom buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...s.btn(C.blue), flex: 1 }} onClick={() => setGameScreen('stats')}>📊 Stats</button>
        <button style={{ ...s.btn(C.pink), flex: 1 }} onClick={() => setGameScreen('friends')}>👫 Friends</button>
        <button style={{ ...s.btn(C.purple), flex: 1 }} onClick={() => setGameScreen('trophy')}>🏆 Trophies</button>
      </div>
    </div>
  );
};
