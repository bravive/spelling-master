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

  const startChallenge = (week) => {
    setActiveWeekId(week.id);
    setWords(week.words);
    setRetryCount(0);
    setGameScreen('weeklyStage1');
  };

  return (
    <div style={{ width: '100%', maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted }} onClick={() => setGameScreen('home')}>← Back</button>
        <h2 style={{ color: C.yellow, margin: 0, fontSize: 20 }}>Weekly Challenge</h2>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 140px)', minHeight: 400 }}>
        {/* Sidebar — scrollable week list */}
        <div style={{
          width: 110, flexShrink: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 4,
          paddingRight: 4, maxHeight: 500,
        }}>
          {all.map(week => {
            const isAvailable = week.startDate <= today;
            const wp = weeklyStats[week.id] || {};
            const firstCorrect = (wp.wordsCorrect || []).length;
            const completed = wp.completed || false;
            const credits = wp.creditsEarned || 0;
            const isSelected = selectedId === week.id;
            const shortDate = week.startDate.slice(5); // MM-DD

            return (
              <div
                key={week.id}
                onClick={() => setSelectedId(week.id)}
                style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border: isSelected ? `2px solid ${C.yellow}` : completed ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                  opacity: isAvailable ? 1 : 0.4,
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: isSelected ? C.yellow : '#fff' }}>
                  {shortDate}
                </div>
                {isAvailable ? (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    <span>{firstCorrect}/{week.words.length}</span>
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {selected ? (
            <WeekDetail
              week={selected}
              progress={weeklyStats[selected.id]}
              isLocked={isLocked}
              today={today}
              onStart={() => startChallenge(selected)}
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
  const firstCorrect = (wp.wordsCorrect || []).length;
  const completed = wp.completed || false;
  const credits = wp.creditsEarned || 0;
  const canEarnDaily = completed && wp.lastDailyReward !== today;
  const firstSet = new Set(wp.wordsCorrect || []);

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
          const gotFirst = firstSet.has(entry.w);
          return (
            <div key={i} style={{
              background: C.card, borderRadius: 10, padding: '8px 12px',
              border: gotFirst ? `1px solid ${C.green}` : `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: gotFirst ? C.green : '#fff' }}>
                {gotFirst && <span style={{ marginRight: 4 }}>✓</span>}
                {entry.w}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.3 }}>{entry.s}</div>
            </div>
          );
        })}
      </div>

      {firstCorrect > 0 && (
        <div style={{ textAlign: 'center', fontSize: 13, color: C.blue, marginBottom: 12 }}>
          {firstCorrect}/{week.words.length} correct
        </div>
      )}

      <button
        style={{ ...s.btn(C.yellow, 'lg'), width: '100%' }}
        onClick={onStart}
      >
        {completed ? '🔁 Replay Challenge' : '🚀 Start Challenge'}
      </button>
    </div>
  );
};
