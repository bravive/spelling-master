import { ALL_POKEMON, pkImg } from '../data/pokemon';
import { selectWords } from '../wordSelection';
import { C, s } from '../shared';
import { RulesModal } from './RulesModal';

export const HomeScreen = ({ getUser, wordStats, setWords, setRetryCount, setGameScreen, setCurrentUser, setScreen }) => {
  const user = getUser();
  if (!user) return null;
  const col = user.collection || {};
  const caught = user.caught || 0;
  const nextPk = ALL_POKEMON.find(p => !col[p.id]?.regular);

  return (
    <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>
      <span style={{ position: 'absolute', top: 0, left: 0 }}><RulesModal /></span>
      <span style={{ position: 'absolute', top: 0, right: 0, color: C.muted, fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}
        onClick={() => { setCurrentUser(null); setScreen('selectUser'); }}>Exit</span>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
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

      <button style={{ ...s.btn(C.green, 'lg'), width: '100%', marginBottom: 8 }}
        onClick={() => setGameScreen('weekly')}>
        📅 Weekly Challenge
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...s.btn(C.blue), flex: 1 }} onClick={() => setGameScreen('stats')}>📊 Stats</button>
        <button style={{ ...s.btn(C.purple), flex: 1 }} onClick={() => setGameScreen('collection')}>🏆 Collection</button>
      </div>
    </div>
  );
};
