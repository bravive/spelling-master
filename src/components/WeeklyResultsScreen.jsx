import { C, s } from '../shared';

export const WeeklyResultsScreen = ({ roundResults, setGameScreen }) => {
  if (!roundResults) return null;
  const { score, results: res, words, earned, creditBreakdown } = roundResults;
  const total = words.length;
  const allCorrect = score === total;

  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 56, fontWeight: 900, color: allCorrect ? C.green : C.yellow }}>{score}/{total}</div>
        {allCorrect && <div style={{ color: C.green, fontWeight: 700, fontSize: 18, marginBottom: 4 }}>All Correct!</div>}
        {earned > 0 && <div style={{ color: C.yellow, fontSize: 20, fontWeight: 700 }}>+{earned} credits</div>}
      </div>

      {creditBreakdown && (
        <div style={{ ...s.card, marginBottom: 16, padding: '12px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Credit Breakdown</div>
          {creditBreakdown.correct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 4 }}>
              <span>Correct words ({creditBreakdown.correctCount})</span>
              <span style={{ color: C.yellow }}>+{creditBreakdown.correct}</span>
            </div>
          )}
          {creditBreakdown.allCompleted > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 4 }}>
              <span>All words completed bonus</span>
              <span style={{ color: C.yellow }}>+{creditBreakdown.allCompleted}</span>
            </div>
          )}
          {creditBreakdown.daily > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 4 }}>
              <span>Daily replay reward</span>
              <span style={{ color: C.yellow }}>+{creditBreakdown.daily}</span>
            </div>
          )}
          {earned === 0 && (
            <div style={{ fontSize: 13, color: C.muted }}>No new credits this run</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {res.map((r, i) => (
          <div key={i} style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{r.word}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{r.correct ? '✅' : '❌'}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={{ ...s.btn(C.yellow, 'lg'), width: '100%' }}
          onClick={() => setGameScreen('weekly')}>
          Back to Weekly Challenges
        </button>
        <button style={{ ...s.btn('rgba(255,255,255,0.12)', 'lg'), color: '#fff', width: '100%' }}
          onClick={() => setGameScreen('home')}>
          Home
        </button>
      </div>
    </div>
  );
};
