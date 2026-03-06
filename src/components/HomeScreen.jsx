import { ALL_POKEMON, pkImg } from '../data/pokemon';
import { WEEKLY_WORDS } from '../data/weekly-words';
import { selectWords } from '../wordSelection';
import { todayStr, C, s } from '../shared';
import { RulesModal } from './RulesModal';

export const HomeScreen = ({ getUser, wordStats, setWords, setRetryCount, setGameScreen, setCurrentUser, setScreen }) => {
  const user = getUser();
  if (!user) return null;
  const col = user.collection || {};
  const caught = user.caught || 0;
  const nextPk = ALL_POKEMON.find(p => !col[p.id]?.regular);

  const today = todayStr();
  const progress = user.weeklyProgress || {};
  const available = WEEKLY_WORDS.filter(w => w.startDate <= today);
  const hasWeeklyCredits = available.some(week => {
    const wp = progress[week.id];
    if (!wp) return true;
    if ((wp.wordsCorrect || []).length < week.words.length) return true;
    if (wp.completed && wp.lastDailyReward !== today) return true;
    return false;
  });

  return (
    <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 560, alignItems: 'flex-start' }}>
      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
          <span style={{ position: 'absolute', top: 0, left: 0 }}><RulesModal /></span>
          <img src={pkImg(user.starterSlug)} alt="" style={{ width: 90, height: 90, objectFit: 'contain', animation: 'float 3s ease-in-out infinite' }} />
          <h2 style={{ margin: '8px 0 4px', fontSize: 26 }}>{user.name}</h2>
          <div style={{ color: C.purple }}>Level {user.level} Speller</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[['💰', user.totalCredits, 'Credits'], ['🔥', user.streak, 'Streak'], ['🏆', caught, 'Caught']].map(([icon, val, label]) => (
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
            const u = getUser();
            const w = selectWords(wordStats, u.level, u.roundCount || 0);
            setWords(w); setRetryCount(0); setGameScreen('stage1');
          }}>
          🚀 Start Round!
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...s.btn(C.blue), flex: 1 }} onClick={() => setGameScreen('stats')}>📊 Stats</button>
          <button style={{ ...s.btn(C.purple), flex: 1 }} onClick={() => setGameScreen('collection')}>🏆 Collection</button>
        </div>
      </div>

      {/* Right sidebar */}
      <div style={{ width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span
          style={{ color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', marginTop: 2 }}
          onClick={() => { setCurrentUser(null); setScreen('selectUser'); }}
        >Exit</span>

        {/* Spacer to align with stats row (profile image ~90 + name ~40 + level ~20 + margin 20 = ~170) */}
        <div style={{ height: 110 }} />

        <div
          onClick={() => setGameScreen('weekly')}
          style={{
            ...s.card, width: 56, textAlign: 'center', padding: '10px 4px',
            cursor: 'pointer', position: 'relative',
            border: hasWeeklyCredits ? `2px solid ${C.yellow}` : `1px solid ${C.border}`,
            boxShadow: hasWeeklyCredits ? `0 0 10px ${C.yellow}44, 0 0 20px ${C.yellow}22` : 'none',
            animation: hasWeeklyCredits ? 'pulse 1.5s ease infinite' : 'none',
          }}
        >
          <div style={{ fontSize: 24 }}>📅</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: hasWeeklyCredits ? C.yellow : C.muted, marginTop: 2, lineHeight: 1.2 }}>Weekly</div>
          {hasWeeklyCredits && (
            <div style={{
              position: 'absolute', top: -5, right: -5,
              background: C.yellow, borderRadius: '50%', width: 14, height: 14,
              animation: 'bounce 1s ease infinite',
              boxShadow: `0 0 6px ${C.yellow}`,
            }} />
          )}
        </div>
      </div>
    </div>
  );
};
