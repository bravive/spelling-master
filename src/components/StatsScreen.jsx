import { todayStr, localDateStr, C, s } from '../shared';

const SOURCE_LABEL = { round: 'Round', weekly: 'Weekly', streak: 'Streak' };
const SOURCE_COLOR = { round: C.blue, weekly: C.purple, streak: C.yellow };

export const StatsScreen = ({ getUser, wordStats, roundHistory, creditHistory, weeklyStats, setGameScreen }) => {
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

  const recentRounds = [...(roundHistory || [])].reverse();

  // Credit history newest-first with running balance
  const allCredits = [...(creditHistory || [])];
  const totalEarned = allCredits.reduce((sum, e) => sum + e.amount, 0);
  const creditsNewestFirst = [...allCredits].reverse();
  let runningTotal = totalEarned;
  const creditsWithBalance = creditsNewestFirst.map(e => {
    const bal = runningTotal;
    runningTotal -= e.amount;
    return { ...e, balanceAfter: bal };
  });

  // Weekly summary from weeklyStats
  const weeklySummary = Object.entries(weeklyStats || {})
    .filter(([, wp]) => wp.creditsEarned > 0)
    .sort((a, b) => (b[1].lastDailyReward || '').localeCompare(a[1].lastDailyReward || ''));

  return (
    <div style={{ width: '100%', maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button style={{ ...s.backBtn }} onClick={() => setGameScreen('home')}>←</button>
        <h2 style={{ margin: 0, color: C.yellow }}>📊 Stats</h2>
      </div>

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          ['🎮', user.roundCount || 0, 'Rounds'],
          ['📚', mastered.length, 'Mastered'],
          ['🏆', caught, 'Caught'],
          ['💰', user.totalCredits || 0, 'Total Credits'],
        ].map(([icon, val, label]) => (
          <div key={label} style={{ ...s.card, flex: 1, textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.yellow }}>{val}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 30-Day streak calendar */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>30-Day Streak</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
          {days.map(d => {
            const isToday = d === todayStr();
            const played = (user.streakDates || []).includes(d);
            return (
              <div key={d} title={d} style={{
                aspectRatio: '1', borderRadius: 4,
                background: played ? C.green : 'rgba(255,255,255,0.08)',
                border: isToday ? `2px solid ${C.yellow}` : '2px solid transparent',
              }} />
            );
          })}
        </div>
      </div>

      {/* Credit history */}
      {creditsWithBalance.length > 0 && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Credit History</div>
            <div style={{ fontSize: 12, color: C.muted }}>{creditsWithBalance.length} events · {totalEarned.toFixed(1)} total</div>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: C.muted }}>
                  <th style={{ textAlign: 'left', padding: '3px 0', fontWeight: 600 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 600 }}>Source</th>
                  <th style={{ textAlign: 'left', padding: '3px 0', fontWeight: 600 }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '3px 0', fontWeight: 600 }}>+Credits</th>
                  <th style={{ textAlign: 'right', padding: '3px 0 3px 6px', fontWeight: 600 }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {creditsWithBalance.map((e, i) => (
                  <tr key={i} style={{ borderTop: i > 0 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
                    <td style={{ padding: '4px 0', color: C.muted }}>{e.date}</td>
                    <td style={{ padding: '4px 4px' }}>
                      <span style={{ background: (SOURCE_COLOR[e.source] || C.muted) + '33', color: SOURCE_COLOR[e.source] || C.muted, borderRadius: 4, padding: '1px 5px', fontSize: 11, fontWeight: 700 }}>
                        {SOURCE_LABEL[e.source] || e.source}
                      </span>
                    </td>
                    <td style={{ padding: '4px 0', color: '#fff' }}>{e.description}</td>
                    <td style={{ padding: '4px 0', textAlign: 'right', color: C.yellow, fontWeight: 700 }}>+{e.amount}</td>
                    <td style={{ padding: '4px 0 4px 6px', textAlign: 'right', color: C.muted }}>{e.balanceAfter.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weekly challenge summary */}
      {weeklySummary.length > 0 && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Weekly Challenges</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted }}>
                <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>Week</th>
                <th style={{ textAlign: 'center', fontWeight: 600 }}>Words</th>
                <th style={{ textAlign: 'center', fontWeight: 600 }}>Credits</th>
                <th style={{ textAlign: 'center', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {weeklySummary.map(([weekId, wp]) => (
                <tr key={weekId} style={{ borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                  <td style={{ padding: '4px 0', fontWeight: 600 }}>{weekId}</td>
                  <td style={{ textAlign: 'center', color: C.muted }}>{(wp.wordsCorrect || []).length}</td>
                  <td style={{ textAlign: 'center', color: C.yellow, fontWeight: 700 }}>{wp.creditsEarned}</td>
                  <td style={{ textAlign: 'center' }}>{wp.completed ? '✅' : '🔄'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Round history */}
      {recentRounds.length > 0 && (
        <div style={{ ...s.card, marginBottom: 16, maxHeight: 280, overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Round History ({recentRounds.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted }}>
                <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>Date</th>
                <th style={{ textAlign: 'center', fontWeight: 600 }}>Score</th>
                <th style={{ textAlign: 'center', fontWeight: 600 }}>Credits</th>
                <th style={{ textAlign: 'center', fontWeight: 600 }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {recentRounds.map((r, i) => (
                <tr key={i} style={{ borderTop: i > 0 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
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

      {/* Mastered words */}
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
