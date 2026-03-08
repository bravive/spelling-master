import { selectWords } from '../wordSelection';
import { C, s } from '../shared';

export const ResultsScreen = ({ roundResults, getUser, wordStats, setWords, setRetryCount, setGameScreen }) => {
  if (!roundResults) return null;
  const { score, earned, pass, shouldRetry, results: res, wasQuit } = roundResults;
  const total = res.length;

  const correctWords = res.filter(r => r.correct);
  const wrongWords = res.filter(r => !r.correct && !r.skipped);
  const skippedWords = res.filter(r => r.skipped);

  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 64, fontWeight: 900, color: pass ? C.green : C.red }}>{score}/{total}</div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, display: 'inline-block', padding: '6px 20px', margin: '8px 0', color: wasQuit ? C.muted : (pass ? C.green : C.red), fontWeight: 700, fontSize: 18 }}>
          {wasQuit ? 'Round ended early' : (pass ? '✅ Passed!' : '❌ Try again')}
        </div>
        {earned > 0 && <div style={{ color: C.yellow, fontSize: 20, fontWeight: 700 }}>+{earned} credits</div>}
        {earned === 0 && !wasQuit && <div style={{ color: C.muted, fontSize: 14 }}>No credits earned</div>}
        {wasQuit && earned === 0 && <div style={{ color: C.muted, fontSize: 14 }}>No credits — round was quit early</div>}
        {shouldRetry && <div style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Score below 6 — back to study time!</div>}
      </div>

      {/* Correct words */}
      {correctWords.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.green, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            ✅ Correct ({correctWords.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {correctWords.map((r, i) => (
              <span key={i} style={{ background: 'rgba(16,185,129,0.15)', border: `1px solid ${C.green}`, borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 600, color: C.green }}>
                {r.word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Wrong words */}
      {wrongWords.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.red, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            ❌ Wrong ({wrongWords.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {wrongWords.map((r, i) => (
              <span key={i} style={{ background: 'rgba(239,68,68,0.15)', border: `1px solid ${C.red}`, borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 600, color: C.red }}>
                {r.word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skipped words */}
      {skippedWords.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.muted, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            ⏭ Skipped ({skippedWords.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {skippedWords.map((r, i) => (
              <span key={i} style={{ background: 'rgba(148,163,184,0.15)', border: `1px solid ${C.muted}`, borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 600, color: C.muted }}>
                {r.word}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
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
