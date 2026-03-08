import { useState, useEffect } from 'react';
import { pkImg } from '../data/pokemon';
import { C, s } from '../shared';

const StatCard = ({ label, value, sub, color = C.yellow }) => (
  <div style={{ ...s.card, flex: '1 1 140px', minWidth: 140, textAlign: 'center' }}>
    <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const TrendChart = ({ title, color, dates, data }) => {
  const values = dates.map(d => data[d] || 0);
  const maxVal = Math.max(1, ...values);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8, textAlign: 'center' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 72 }}>
        {dates.map((d, i) => {
          const v = values[i];
          const barH = Math.max(3, (v / maxVal) * 60);
          const isToday = i === dates.length - 1;
          return (
            <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: 9, color: v > 0 ? color : 'transparent', fontWeight: 700 }}>{v || ''}</div>
              <div style={{
                width: '100%', height: `${barH}px`,
                background: v > 0 ? color : 'rgba(255,255,255,0.07)',
                borderRadius: 3, opacity: isToday ? 1 : 0.75,
                boxShadow: isToday && v > 0 ? `0 0 6px ${color}88` : 'none',
                transition: 'height 0.3s',
              }} />
              <div style={{ fontSize: 8, color: isToday ? color : 'rgba(255,255,255,0.3)', fontWeight: isToday ? 700 : 400 }}>
                {d.slice(5).replace('-', '/')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MiniBar = ({ value, max, color = C.blue }) => (
  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
    <div style={{ background: color, height: '100%', width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, borderRadius: 4, transition: 'width 0.4s' }} />
  </div>
);

const Tab = ({ active, label, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    border: active ? `1px solid ${C.yellow}` : '1px solid transparent',
    borderRadius: 8, padding: '8px 16px', color: active ? C.yellow : C.muted,
    fontWeight: active ? 700 : 400, fontSize: 14, cursor: 'pointer',
  }}>{label}</button>
);

export const ParentMenuScreen = ({ jwt, setScreen, setCurrentUser }) => {
  const [users, setUsers] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [inviteCodes, setInviteCodes] = useState([]);
  const [creatingCode, setCreatingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState('');
  const [trends, setTrends] = useState(null);

  const [refreshing, setRefreshing] = useState(false);
  const adminHeaders = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

  const fetchAll = (showSpinner = false) => {
    if (!jwt) return;
    if (showSpinner) setRefreshing(true);
    return Promise.all([
      fetch('/api/admin/users', { headers: adminHeaders }).then(r => r.json()),
      fetch('/api/admin/friendships', { headers: adminHeaders }).then(r => r.json()),
      fetch('/api/admin/invite-codes', { headers: adminHeaders }).then(r => r.json()),
      fetch('/api/admin/trends', { headers: adminHeaders }).then(r => r.json()),
    ]).then(([u, f, codes, t]) => { setUsers(u); setFriendships(f); setInviteCodes(codes); setTrends(t); setLoading(false); setRefreshing(false); })
      .catch(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { fetchAll(); }, [jwt]);

  const createAdminCode = async () => {
    setCreatingCode(true);
    try {
      const res = await fetch('/api/admin/invite-codes', { method: 'POST', headers: adminHeaders });
      const code = await res.json();
      if (res.ok) setInviteCodes(prev => [code, ...prev]);
    } catch { /* ignore */ }
    setCreatingCode(false);
  };

  const inviteUrl = (code) => `${window.location.origin}/?code=${code}`;

  const copyCode = (code) => {
    navigator.clipboard?.writeText(inviteUrl(code)).catch(() => {});
    setCodeCopied(code);
    setTimeout(() => setCodeCopied(''), 2000);
  };

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const totalRounds = users.reduce((s, u) => s + (u.roundCount || 0), 0);
  const totalCaught = users.reduce((s, u) => s + (u.caught || 0), 0);
  const totalShiny = users.reduce((s, u) => s + (u.shinyCount || 0), 0);
  const activeToday = users.filter(u => u.lastPlayed === today).length;
  const activeWeek = users.filter(u => u.lastPlayed && u.lastPlayed >= weekAgo).length;
  const totalMastered = users.reduce((s, u) => s + (u.masteredCount || 0), 0);
  const acceptedFriendships = friendships.filter(f => f.status === 'accepted').length;
  const pendingFriendships = friendships.filter(f => f.status === 'pending').length;
  const totalMessages = friendships.reduce((s, f) => s + (f.messageCount || 0), 0);

  // Signups per day (last 7 days) — derived client-side from users.created_at
  const trendDates = trends?.dates || Array.from({ length: 7 }, (_, i) =>
    new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10));
  const signupsByDay = Object.fromEntries(trendDates.map(d => [d, 0]));
  users.forEach(u => {
    if (u.created_at) {
      const d = new Date(u.created_at).toISOString().slice(0, 10);
      if (d in signupsByDay) signupsByDay[d]++;
    }
  });

  // Rounds per day (last 14 days)
  const allRounds = users.flatMap(u => u.rounds || []);
  const dayBuckets = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dayBuckets[d] = 0;
  }
  allRounds.forEach(r => { if (r.date in dayBuckets) dayBuckets[r.date]++; });
  const dayData = Object.entries(dayBuckets);
  const maxRoundsDay = Math.max(1, ...dayData.map(([, v]) => v));

  // Score distribution
  const scoreDist = Array(11).fill(0);
  allRounds.forEach(r => { if (r.score >= 0 && r.score <= 10) scoreDist[r.score]++; });
  const maxScoreDist = Math.max(1, ...scoreDist);

  // Level distribution
  const levelDist = [0, 0, 0, 0, 0];
  users.forEach(u => { if (u.level >= 1 && u.level <= 5) levelDist[u.level - 1]++; });

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 32, animation: 'pulse 1.5s infinite' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.yellow, margin: 0, fontSize: 24 }}>Admin Dashboard</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>{today}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ ...s.btn('rgba(255,255,255,0.12)', 'sm'), fontSize: 18, padding: '8px 12px' }}
            title="Refresh data"
            onClick={() => fetchAll(true)}
            disabled={refreshing}>
            {refreshing ? '⏳' : '🔄'}
          </button>
          <button style={{ ...s.btn(C.red, 'sm') }}
            onClick={() => { setCurrentUser(null); setScreen('adminLogin'); }}>
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Tab active={tab === 'overview'} label="Overview" onClick={() => setTab('overview')} />
        <Tab active={tab === 'users'} label="Users" onClick={() => setTab('users')} />
        <Tab active={tab === 'usage'} label="Usage" onClick={() => setTab('usage')} />
        <Tab active={tab === 'friendships'} label="Friendships" onClick={() => setTab('friendships')} />
        <Tab active={tab === 'invites'} label="Invite Codes" onClick={() => setTab('invites')} />
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────── */}
      {tab === 'overview' && <>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <StatCard label="Total Users" value={users.length} />
          <StatCard label="Active Today" value={activeToday} sub={`${activeWeek} this week`} color={C.green} />
          <StatCard label="Total Rounds" value={totalRounds} color={C.blue} />
          <StatCard label="Pokemon Caught" value={totalCaught} sub={`${totalShiny} shiny`} color={C.pink} />
          <StatCard label="Words Mastered" value={totalMastered} color={C.purple} />
          <StatCard label="Friendships" value={acceptedFriendships} sub={`${pendingFriendships} pending`} color={C.pink} />
          <StatCard label="Messages" value={totalMessages} color={C.blue} />
        </div>

        {/* Quick user summary */}
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow, marginBottom: 12 }}>Player Summary</div>
          {users.length === 0 && <div style={{ color: C.muted }}>No users yet</div>}
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <img src={pkImg(u.starterSlug)} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>Lv.{u.level} | {u.streak} day streak | {u.caught} caught</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: u.lastPlayed === today ? C.green : C.muted }}>
                  {u.lastPlayed === today ? 'Active today' : u.lastPlayed || 'Never played'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* ── Users Tab ────────────────────────────────────────────── */}
      {tab === 'users' && <>
        {users.map(u => (
          <div key={u.id} style={{ ...s.card, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img src={pkImg(u.starterSlug)} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>@{u.userId} | Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div style={{
                background: u.lastPlayed === today ? C.green : 'rgba(255,255,255,0.1)',
                color: u.lastPlayed === today ? '#1a1a2e' : C.muted,
                padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              }}>
                {u.lastPlayed === today ? 'Online today' : u.lastPlayed || 'Never'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
              {[
                { l: 'Level', v: u.level, c: C.yellow },
                { l: 'Streak', v: `${u.streak}d`, c: C.pink },
                { l: 'Rounds', v: u.roundCount || 0, c: C.blue },
                { l: 'Avg Score', v: u.avgScore || '-', c: C.green },
                { l: 'Credits', v: u.totalCredits || 0, c: C.yellow },
                { l: 'Bank', v: `${u.creditBank || 0}/10`, c: C.purple },
                { l: 'Caught', v: u.caught || 0, c: C.pink },
                { l: 'Shiny', v: u.shinyCount || 0, c: C.purple },
                { l: 'Mastered', v: u.masteredCount || 0, c: C.green },
                { l: 'Words Tried', v: u.totalWordsAttempted || 0, c: C.blue },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </>}

      {/* ── Usage Tab ────────────────────────────────────────────── */}
      {tab === 'usage' && <>
        {/* 7-Day Trends */}
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow, marginBottom: 16 }}>7-Day Trends</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <TrendChart title="New Signups" color={C.blue} dates={trendDates} data={signupsByDay} />
            <TrendChart title="Rounds Finished" color={C.green} dates={trendDates} data={trends?.roundsByDay || {}} />
            <TrendChart title="Weekly Completions" color={C.yellow} dates={trendDates} data={trends?.weeklyByDay || {}} />
          </div>
        </div>

        {/* Rounds per day chart */}
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow, marginBottom: 12 }}>Rounds / Day (Last 14 days)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
            {dayData.map(([date, count]) => (
              <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, color: C.muted }}>{count || ''}</div>
                <div style={{
                  width: '100%', minHeight: 4,
                  height: `${(count / maxRoundsDay) * 80}px`,
                  background: count > 0 ? C.blue : 'rgba(255,255,255,0.06)',
                  borderRadius: 3, transition: 'height 0.3s',
                }} />
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                  {date.slice(5)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score distribution */}
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow, marginBottom: 12 }}>Score Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {scoreDist.map((count, score) => (
              <div key={score} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, fontSize: 12, color: C.muted, textAlign: 'right' }}>{score}/10</div>
                <MiniBar value={count} max={maxScoreDist} color={score >= 8 ? C.green : score >= 6 ? C.yellow : C.red} />
                <div style={{ width: 24, fontSize: 11, color: C.muted }}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Level distribution */}
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow, marginBottom: 12 }}>Level Distribution</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {levelDist.map((count, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.purple }}>{count}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Level {i + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow, marginBottom: 12 }}>Leaderboards</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { title: 'Top Streak', key: 'streak', suffix: 'd' },
              { title: 'Most Rounds', key: 'roundCount', suffix: '' },
              { title: 'Most Caught', key: 'caught', suffix: '' },
              { title: 'Highest Avg', key: 'avgScore', suffix: '' },
            ].map(({ title, key, suffix }) => (
              <div key={title}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{title}</div>
                {[...users].sort((a, b) => (parseFloat(b[key]) || 0) - (parseFloat(a[key]) || 0)).slice(0, 3).map((u, i) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 13 }}>
                    <span style={{ color: [C.yellow, C.muted, '#cd7f32'][i] || C.muted, fontWeight: 700, width: 16 }}>{i + 1}</span>
                    <span>{u.name}</span>
                    <span style={{ marginLeft: 'auto', color: C.blue, fontWeight: 600 }}>{u[key] || 0}{suffix}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* ── Friendships Tab ────────────────────────────────────────── */}
      {tab === 'friendships' && <>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatCard label="Accepted" value={acceptedFriendships} color={C.green} />
          <StatCard label="Pending" value={pendingFriendships} color={C.yellow} />
          <StatCard label="Total Messages" value={totalMessages} color={C.blue} />
        </div>

        {friendships.length === 0 && <div style={{ ...s.card, textAlign: 'center', color: C.muted, padding: 32 }}>No friendships yet</div>}

        {friendships.map(f => (
          <div key={f.id} style={{ ...s.card, marginBottom: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <img src={pkImg(f.user1.starterSlug)} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{f.user1.name || f.user1.userId}</span>
              </div>
              <div style={{
                background: f.status === 'accepted' ? C.green : C.yellow,
                color: '#1a1a2e', padding: '2px 10px', borderRadius: 10,
                fontSize: 11, fontWeight: 700,
              }}>
                {f.status === 'accepted' ? 'Friends' : 'Pending'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{f.user2.name || f.user2.userId}</span>
                <img src={pkImg(f.user2.starterSlug)} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: C.muted }}>
              <span>{f.messageCount} message{f.messageCount !== 1 ? 's' : ''}</span>
              <span>
                {f.lastMessage
                  ? `Last msg: ${new Date(f.lastMessage).toLocaleDateString()}`
                  : f.status === 'pending' ? `Invited by ${f.initiator === f.user1.id ? f.user1.name : f.user2.name}` : 'No messages'}
              </span>
              <span>Since {new Date(f.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </>}

      {/* ── Invite Codes Tab ─────────────────────────────────────── */}
      {tab === 'invites' && <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.yellow }}>Invite Codes</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {inviteCodes.length} total · {inviteCodes.filter(c => !c.usedBy).length} available · {inviteCodes.filter(c => c.usedBy).length} used
            </div>
          </div>
          <button onClick={createAdminCode} disabled={creatingCode} style={{ ...s.btn(C.green, 'sm') }}>
            {creatingCode ? '...' : '+ Generate Code'}
          </button>
        </div>
        {inviteCodes.length === 0 && (
          <div style={{ ...s.card, textAlign: 'center', color: C.muted, padding: 32 }}>No codes yet.</div>
        )}
        {inviteCodes.map(c => (
          <div key={c._id} style={{ ...s.card, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 2, color: c.usedBy ? C.muted : C.yellow }}>{c.code}</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Created by <span style={{ color: '#fff' }}>{c.createdByName}</span> · {new Date(c.created_at).toLocaleDateString()}
              </div>
              {c.usedBy
                ? <div style={{ fontSize: 12, color: C.green }}>Used by <span style={{ color: '#fff' }}>{c.usedByName}</span></div>
                : <div style={{ fontSize: 12, color: C.muted }}>Available</div>
              }
            </div>
            {!c.usedBy && (
              <button
                onClick={() => copyCode(c.code)}
                title={inviteUrl(c.code)}
                style={{ background: codeCopied === c.code ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${codeCopied === c.code ? C.green : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: codeCopied === c.code ? C.green : C.muted, fontSize: 12, whiteSpace: 'nowrap' }}
              >
                {codeCopied === c.code
                  ? <><span style={{ fontSize: 14 }}>✓</span> Copied!</>
                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Copy link</>
                }
              </button>
            )}
            {c.usedBy && <div style={{ fontSize: 20, color: C.muted }}>✓</div>}
          </div>
        ))}
      </>}
    </div>
  );
};
