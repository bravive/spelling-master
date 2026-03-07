import { ALL_POKEMON, pkImg } from '../data/pokemon';
import { selectWords } from '../wordSelection';
import { todayStr, C, s } from '../shared';
import { RulesModal } from './RulesModal';

export const HomeScreen = ({ getUser, wordStats, trophyData, weeklyWords, weeklyStats, setWords, setRetryCount, setGameScreen, setCurrentUser, setScreen }) => {
  const user = getUser();
  if (!user) return null;
  const col = trophyData?.collection || {};
  const caught = user.caught || 0;
  const nextPk = ALL_POKEMON.find(p => !col[p.id]?.regular);

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
    <div style={{ width: '100%', maxWidth: 480 }}>
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

      {/* Profile row: avatar + name on left, weekly on right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <img src={pkImg(user.starterSlug)} alt="" style={{ width: 80, height: 80, objectFit: 'contain', animation: 'float 3s ease-in-out infinite', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: '0 0 2px', fontSize: 24 }}>{user.name}</h2>
          <div style={{ color: C.purple, fontSize: 14 }}>Level {user.level} Speller</div>
        </div>
        <div
          onClick={() => setGameScreen('weekly')}
          style={{
            ...s.card, width: 56, textAlign: 'center', padding: '8px 4px',
            cursor: 'pointer', position: 'relative', flexShrink: 0,
            border: hasWeeklyCredits ? `2px solid ${C.yellow}` : `1px solid ${C.border}`,
            boxShadow: hasWeeklyCredits ? `0 0 10px ${C.yellow}44, 0 0 20px ${C.yellow}22` : 'none',
            animation: hasWeeklyCredits ? 'pulse 1.5s ease infinite' : 'none',
          }}
        >
          <div style={{ fontSize: 22 }}>📅</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: hasWeeklyCredits ? C.yellow : C.muted, marginTop: 2, lineHeight: 1.2 }}>Weekly</div>
          {hasWeeklyCredits && (
            <div style={{
              position: 'absolute', top: -5, right: -5,
              background: C.yellow, borderRadius: '50%', width: 12, height: 12,
              animation: 'bounce 1s ease infinite',
              boxShadow: `0 0 6px ${C.yellow}`,
            }} />
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[['💰', user.totalCredits, 'Credits'], ['🔥', user.streak, 'Streak'], ['🏆', caught, 'Caught']].map(([icon, val, label]) => (
          <div key={label} style={{ ...s.card, flex: 1, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 22 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>{val}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Next Pokemon */}
      {nextPk && (
        <div style={{ ...s.card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <img src={pkImg(nextPk.slug)} alt="?" style={{ width: 64, height: 64, objectFit: 'contain', filter: 'brightness(0)', opacity: 0.4 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>❓</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Next Pokemon</div>
            {trophyData?.shinyEligible && (
              <div style={{ color: '#a78bfa', fontSize: 13, animation: 'pulse 1.5s ease infinite', marginBottom: 4 }}>✨ Shiny chance active!</div>
            )}
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(user.creditBank / 10) * 100}%`, height: '100%', background: C.yellow, transition: 'width 0.3s', borderRadius: 8 }} />
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{user.creditBank}/10 credits</div>
          </div>
        </div>
      )}

      {/* Start Round */}
      <button style={{ ...s.btn(C.yellow, 'lg'), width: '100%', marginBottom: 16, animation: 'pulse 2s ease infinite' }}
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
        <button style={{ ...s.btn(C.purple), flex: 1 }} onClick={() => setGameScreen('trophy')}>🏆 Trophies</button>
      </div>
    </div>
  );
};
