import { useState } from 'react';
import { todayStr, C, s } from '../shared';

const weekLabel = (startDate) => {
  const d = new Date(startDate + 'T00:00:00');
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((d - jan1) / 86400000);
  const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `Week ${weekNum} - ${year}`;
};

export const WeeklyChallengeScreen = ({ weeklyWords, weeklyStats, setWords, setRetryCount, setGameScreen, setActiveWeekId }) => {
  const today = todayStr();

  const available = weeklyWords.filter(w => w.startDate <= today);
  const locked = weeklyWords.filter(w => w.startDate > today);

  const all = [...available, ...locked];

  // Default to the latest available week
  const [selectedId, setSelectedId] = useState(() => available.length > 0 ? available[available.length - 1].id : null);
  const selected = all.find(w => w.id === selectedId);
  const isLocked = selected ? selected.startDate > today : true;

  const startChallenge = (week, wordList) => {
    setActiveWeekId(week.id);
    setWords(wordList);
    setRetryCount(0);
    setGameScreen('weeklyStage1');
  };

  return (
    <div style={{ width: '100%', maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted }} onClick={() => setGameScreen('home')}>← Back</button>
        <h2 style={{ color: C.yellow, margin: 0, fontSize: 20, flex: 1, textAlign: 'center' }}>Weekly Challenge</h2>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {/* Sidebar — scrollable week list */}
        <div style={{
          width: 110, flexShrink: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          display: 'flex', flexDirection: 'column', gap: 4,
          paddingRight: 4, maxHeight: 'min(500px, calc(100vh - 160px))',
        }}>
          {all.map(week => {
            const isAvailable = week.startDate <= today;
            const wp = weeklyStats[week.id] || {};
            const wordsCorrect = (wp.wordsCorrect || []).length;
            const completed = wp.completed || false;
            const credits = wp.creditsEarned || 0;
            const isSelected = selectedId === week.id;
            const isCurrent = isAvailable && available[available.length - 1]?.id === week.id;
            const shortDate = week.startDate.slice(5); // MM-DD

            // Has points to collect: not started, incomplete, or daily replay available
            const hasCredits = isAvailable && (
              !wp.wordsCorrect || wordsCorrect < week.words.length ||
              (completed && wp.lastDailyReward !== today)
            );

            return (
              <div
                key={week.id}
                onClick={() => setSelectedId(week.id)}
                style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  position: 'relative',
                  background: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border: isCurrent ? `2px solid ${C.yellow}` : isSelected ? `2px solid rgba(255,255,255,0.3)` : completed ? `1px solid ${C.green}` : isAvailable ? `1px solid #d4c89a55` : `1px solid ${C.border}`,
                  opacity: isAvailable ? 1 : 0.4,
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: isCurrent ? C.yellow : '#fff' }}>
                    {shortDate}
                  </div>
                  {hasCredits && (
                    <div style={{
                      background: C.yellow, borderRadius: '50%', width: 8, height: 8,
                      boxShadow: `0 0 6px ${C.yellow}`,
                      animation: 'pulse 1.5s ease infinite',
                    }} />
                  )}
                </div>
                {isAvailable ? (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    <span>{wordsCorrect}/{week.words.length}</span>
                    {credits > 0 && <span style={{ color: C.yellow, marginLeft: 4 }}>{credits}cr</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>🔒</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Main panel — selected week details */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {selected ? (
            <WeekDetail
              week={selected}
              progress={weeklyStats[selected.id]}
              isLocked={isLocked}
              today={today}
              onStart={(wordList) => startChallenge(selected, wordList)}
            />
          ) : (
            <div style={{ color: C.muted, textAlign: 'center', padding: '40px 0' }}>
              Select a week to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WeekDetail = ({ week, progress, isLocked, today, onStart }) => {
  const wp = progress || {};
  const correctSet = new Set(wp.wordsCorrect || []);
  const correctCount = correctSet.size;
  const completed = wp.completed || false;
  const credits = wp.creditsEarned || 0;
  const canEarnDaily = completed && wp.lastDailyReward !== today;
  const hasPartialProgress = correctCount > 0 && !completed;
  const remainingWords = week.words.filter(entry => !correctSet.has(entry.w));

  if (isLocked) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{weekLabel(week.startDate)}</div>
        <div style={{ color: C.muted, fontSize: 14 }}>Unlocks on {week.startDate}</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>{week.words.length} words</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{weekLabel(week.startDate)}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', fontSize: 13, color: C.muted }}>
          <span>{week.words.length} words</span>
          {credits > 0 && <span style={{ color: C.yellow }}>{credits} credits</span>}
          {completed && <span style={{ color: C.green }}>All words completed</span>}
        </div>
        {canEarnDaily && (
          <div style={{ color: C.purple, fontWeight: 700, fontSize: 13, marginTop: 4, animation: 'pulse 1.5s ease infinite' }}>
            +2 credits available today!
          </div>
        )}
      </div>

      {/* Word list preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
        {week.words.map((entry, i) => {
          const correct = correctSet.has(entry.w);
          return (
            <div key={i} style={{
              background: C.card, borderRadius: 10, padding: '8px 12px',
              border: correct ? `1px solid ${C.green}` : `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: correct ? C.green : '#fff' }}>
                {correct && <span style={{ marginRight: 4 }}>✓</span>}
                {entry.w}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.3 }}>{entry.s}</div>
            </div>
          );
        })}
      </div>

      {correctCount > 0 && !completed && (
        <div style={{ textAlign: 'center', fontSize: 13, color: C.blue, marginBottom: 12 }}>
          {correctCount}/{week.words.length} correct
        </div>
      )}

      {/* Buttons: no progress → Start, partial → Restart + Resume, completed → Replay */}
      {completed ? (
        <button
          style={{ ...s.btn(C.yellow, 'lg'), width: '100%' }}
          onClick={() => onStart(week.words)}
        >
          🔁 Replay
        </button>
      ) : hasPartialProgress ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ ...s.btn('rgba(255,255,255,0.15)'), flex: 1 }}
            onClick={() => onStart(week.words)}
          >
            🔄 Restart
          </button>
          <button
            style={{ ...s.btn(C.yellow, 'lg'), flex: 1 }}
            onClick={() => onStart(remainingWords)}
          >
            ▶️ Resume ({remainingWords.length})
          </button>
        </div>
      ) : (
        <button
          style={{ ...s.btn(C.yellow, 'lg'), width: '100%' }}
          onClick={() => onStart(week.words)}
        >
          🚀 Start
        </button>
      )}
    </div>
  );
};
