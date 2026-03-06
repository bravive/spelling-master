import { WEEKLY_WORDS } from '../data/weekly-words';
import { todayStr, C, s } from '../shared';

export const WeeklyChallengeScreen = ({ getUser, setWords, setRetryCount, setGameScreen, setActiveWeekId }) => {
  const user = getUser();
  const today = todayStr();
  const progress = user?.weeklyProgress || {};

  const available = WEEKLY_WORDS.filter(w => w.startDate <= today);
  const locked = WEEKLY_WORDS.filter(w => w.startDate > today);

  const startChallenge = (week) => {
    setActiveWeekId(week.id);
    setWords(week.words);
    setRetryCount(0);
    setGameScreen('weeklyStage1');
  };

  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted }} onClick={() => setGameScreen('home')}>← Back</button>
        <h2 style={{ color: C.yellow, margin: 0, fontSize: 20 }}>Weekly Challenge</h2>
        <div style={{ width: 60 }} />
      </div>

      {available.length === 0 && (
        <div style={{ color: C.muted, textAlign: 'center', padding: '40px 0' }}>No challenges available yet. Check back Monday!</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {available.map(week => {
          const wp = progress[week.id] || {};
          const firstCorrect = (wp.firstAttemptCorrect || []).length;
          const completed = wp.completed || false;
          const perfectRun = wp.perfectRun || false;
          const credits = wp.creditsEarned || 0;
          const canEarnDaily = completed && wp.lastDailyReward !== today;

          return (
            <div
              key={week.id}
              onClick={() => startChallenge(week)}
              style={{
                ...s.card, cursor: 'pointer', padding: '16px 20px',
                border: completed ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                transition: 'transform 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{week.label}</div>
                <div style={{ fontSize: 12, color: C.muted }}>Starts {week.startDate}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: C.muted, flexWrap: 'wrap' }}>
                <span>{week.words.length} words</span>
                <span style={{ color: C.yellow }}>{credits} credits earned</span>
                {firstCorrect > 0 && <span style={{ color: C.blue }}>{firstCorrect}/{week.words.length} first-try</span>}
                {perfectRun && <span style={{ color: C.green }}>Perfect!</span>}
                {completed && <span style={{ color: C.green }}>Completed</span>}
                {canEarnDaily && <span style={{ color: C.purple, fontWeight: 700 }}>+2 available today</span>}
              </div>
            </div>
          );
        })}

        {locked.map(week => (
          <div key={week.id} style={{ ...s.card, opacity: 0.4, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{week.label}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Unlocks {week.startDate}</div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{week.words.length} words</div>
          </div>
        ))}
      </div>
    </div>
  );
};
