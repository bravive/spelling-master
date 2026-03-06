import { selectWords } from '../wordSelection';
import { C, s } from '../shared';

export const ResultsScreen = ({ roundResults, getUser, wordStats, setWords, setRetryCount, setGameScreen }) => {
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
          onClick={() => { const u = getUser(); const w = selectWords(wordStats, u.level, u.roundCount || 0); setWords(w); setRetryCount(0); setGameScreen('stage1'); }}>
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
