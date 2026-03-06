import { todayStr, localDateStr, C, s } from '../shared';

export const StatsScreen = ({ getUser, wordStats, roundHistory, setGameScreen }) => {
  const user = getUser();
  if (!user) return null;
  const caught = user.caught || 0;
  const mastered = Object.entries(wordStats || {})
    .filter(([, ws]) => ws.attempts >= 3 && ws.correct / ws.attempts >= 0.8)
    .map(([w]) => w);

  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i));
    return localDateStr(d);
  });

  const recent = [...(roundHistory || [])].reverse();

  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted }} onClick={() => setGameScreen('home')}>← Back</button>
        <h2 style={{ margin: 0, color: C.yellow }}>📊 Stats</h2>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          ['🎮', user.roundCount || 0, 'Rounds'],
          ['📚', mastered.length, 'Mastered'],
          ['🏆', caught, 'Caught'],
        ].map(([icon, val, label]) => (
          <div key={label} style={{ ...s.card, flex: 1, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 22 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>{val}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>30-Day Streak</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
          {days.map(d => {
            const isToday = d === todayStr();
            const played = (user.streakDates || []).includes(d);
            return (
              <div key={d} title={d} style={{
                aspectRatio: '1', borderRadius: 4, cursor: 'default',
                background: played ? C.green : 'rgba(255,255,255,0.08)',
                border: isToday ? `2px solid ${C.yellow}` : '2px solid transparent',
              }} />
            );
          })}
        </div>
      </div>

      {recent.length > 0 && (
        <div style={{ ...s.card, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Round History</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Date</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center' }}>Credits</th>
                <th style={{ textAlign: 'center' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '4px 0' }}>{r.date}</td>
                  <td style={{ textAlign: 'center' }}>{r.score}/10</td>
                  <td style={{ textAlign: 'center', color: C.yellow }}>+{r.earned}</td>
                  <td style={{ textAlign: 'center' }}>{r.pass ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mastered.length > 0 && (
        <div style={{ ...s.card }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Mastered Words ({mastered.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {mastered.map(w => (
              <span key={w} style={{ background: C.green + '33', color: C.green, borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 600 }}>{w}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
