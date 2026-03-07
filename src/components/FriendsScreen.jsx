import { useState, useEffect, useRef } from 'react';
import { pkImg } from '../data/pokemon';
import { C, s } from '../shared';

const Tab = ({ active, label, badge, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    border: active ? `1px solid ${C.yellow}` : '1px solid transparent',
    borderRadius: 8, padding: '8px 16px', color: active ? C.yellow : C.muted,
    fontWeight: active ? 700 : 400, fontSize: 14, cursor: 'pointer',
    position: 'relative',
  }}>
    {label}
    {badge > 0 && <span style={{
      position: 'absolute', top: -4, right: -4,
      background: C.red, color: '#fff', fontSize: 10, fontWeight: 700,
      borderRadius: '50%', width: 18, height: 18,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{badge}</span>}
  </button>
);

const FriendCard = ({ friend, unreadCount, onMessage, onSelect }) => (
  <div onClick={onSelect} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: 14, cursor: 'pointer' }}>
    <img src={pkImg(friend.starterSlug)} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{friend.name}</div>
      <div style={{ color: C.muted, fontSize: 12 }}>Level {friend.level} | {friend.caught} caught | {friend.shinyCount} shiny | {friend.streak} streak</div>
    </div>
    <button onClick={e => { e.stopPropagation(); onMessage(); }} style={{ ...s.btn(C.blue, 'sm'), position: 'relative', padding: '6px 12px', fontSize: 13, flexShrink: 0 }}>
      Message
      {unreadCount > 0 && <span style={{
        position: 'absolute', top: -6, right: -6,
        background: C.red, color: '#fff', fontSize: 10, fontWeight: 700,
        borderRadius: '50%', width: 18, height: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{unreadCount}</span>}
    </button>
  </div>
);

const FriendDetailModal = ({ friend, onClose, onMessage, onRemove }) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        ...s.card, width: '100%', maxWidth: 340, textAlign: 'center',
        padding: 24, animation: 'popIn 0.25s ease',
      }}>
        <img src={pkImg(friend.starterSlug)} alt="" style={{ width: 80, height: 80, objectFit: 'contain', animation: 'float 3s ease-in-out infinite' }} />
        <h3 style={{ margin: '12px 0 4px', fontSize: 20, color: C.yellow }}>{friend.name}</h3>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
          Level {friend.level} | {friend.caught} caught | {friend.shinyCount} shiny | {friend.streak} streak
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => { onClose(); onMessage(); }} style={{ ...s.btn(C.blue), width: '100%' }}>Message</button>

          {!confirming
            ? <button onClick={() => setConfirming(true)} style={{ ...s.btn('rgba(255,255,255,0.1)'), width: '100%', color: C.red }}>
                Remove Friend
              </button>
            : <div style={{ ...s.card, background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`, padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Remove {friend.name} as a friend?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirming(false)} style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), flex: 1, color: C.muted }}>Cancel</button>
                  <button onClick={onRemove} style={{ ...s.btn(C.red, 'sm'), flex: 1 }}>Confirm</button>
                </div>
              </div>
          }

          <button onClick={onClose} style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted, width: '100%' }}>Close</button>
        </div>
      </div>
    </div>
  );
};

const RequestCard = ({ req: r, myId, onAccept, onDecline }) => {
  const isSent = r.initiator === myId;
  return (
    <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: 14 }}>
      <img src={pkImg(r.starterSlug)} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
        <div style={{ color: C.muted, fontSize: 12 }}>{isSent ? 'Invite sent' : 'Wants to be your friend'}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!isSent && <button onClick={onAccept} style={{ ...s.btn(C.green, 'sm'), padding: '6px 12px', fontSize: 13 }}>Accept</button>}
        <button onClick={onDecline} style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.red, padding: '6px 12px', fontSize: 13 }}>
          {isSent ? 'Cancel' : 'Decline'}
        </button>
      </div>
    </div>
  );
};

const MessageDialog = ({ friend, jwt, myId, myStarterSlug, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };

  const loadMessages = () => {
    fetch(`/api/friends/${friend.friendId}/messages`, { headers })
      .then(r => r.json()).then(setMessages).catch(() => {});
  };

  useEffect(() => {
    loadMessages();
    inputRef.current?.focus();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [friend.friendId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/friends/${friend.friendId}/messages`, {
        method: 'POST', headers, body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setText('');
      }
    } catch { /* ignore */ }
    setSending(false);
    inputRef.current?.focus();
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        ...s.card, width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column',
        height: 'min(75dvh, 520px)', padding: 16,
        animation: 'popIn 0.25s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexShrink: 0 }}>
          <img src={pkImg(friend.starterSlug)} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{friend.name}</span>
          <button onClick={onClose} style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted, padding: '4px 10px' }}>Close</button>
        </div>

        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: 8, marginBottom: 8,
          background: 'rgba(0,0,0,0.2)', borderRadius: 10,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {messages.length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 24 }}>No messages yet. Say hi!</div>}
          {messages.map(m => {
            const mine = m.from === myId;
            const avatar = mine ? myStarterSlug : friend.starterSlug;
            return (
              <div key={m._id} style={{
                display: 'flex', alignItems: 'flex-end', gap: 6,
                flexDirection: mine ? 'row-reverse' : 'row',
              }}>
                <img src={pkImg(avatar)} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
                <div style={{
                  background: mine ? C.blue : 'rgba(255,255,255,0.12)',
                  color: mine ? '#1a1a2e' : '#fff',
                  borderRadius: 12, padding: '8px 12px', maxWidth: '70%',
                  fontSize: 14, wordBreak: 'break-word',
                }}>
                  {m.text}
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2, textAlign: 'right' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value.slice(0, 200))}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Type a message..."
            style={{ ...s.input, flex: 1, fontSize: 14 }}
          />
          <button onClick={send} disabled={sending || !text.trim()} style={{
            ...s.btn(C.yellow, 'sm'), opacity: (sending || !text.trim()) ? 0.5 : 1,
          }}>Send</button>
        </div>
        <div style={{ color: C.muted, fontSize: 11, textAlign: 'right', marginTop: 2 }}>{text.length}/200</div>
      </div>
    </div>
  );
};

export const FriendsScreen = ({ jwt, currentUser, myStarterSlug, setGameScreen }) => {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [unread, setUnread] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [messageTarget, setMessageTarget] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };

  const loadFriends = () => {
    Promise.all([
      fetch('/api/friends', { headers }).then(r => r.json()),
      fetch('/api/friends/unread', { headers }).then(r => r.json()),
    ]).then(([f, u]) => {
      setFriends(f);
      setUnread(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadFriends(); }, []);

  const accepted = friends.filter(f => f.status === 'accepted');
  const pending = friends.filter(f => f.status === 'pending');
  const pendingReceived = pending.filter(f => f.initiator !== currentUser);
  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery.trim())}`, { headers });
      setSearchResults(await res.json());
    } catch { /* ignore */ }
    setSearching(false);
  };

  const invite = async (userId) => {
    try {
      await fetch('/api/friends/invite', {
        method: 'POST', headers, body: JSON.stringify({ toUserId: userId }),
      });
      loadFriends();
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch { /* ignore */ }
  };

  const accept = async (friendshipId) => {
    await fetch(`/api/friends/${friendshipId}/accept`, { method: 'PUT', headers });
    loadFriends();
  };

  const remove = async (friendshipId) => {
    await fetch(`/api/friends/${friendshipId}`, { method: 'DELETE', headers });
    loadFriends();
  };

  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: C.yellow, margin: 0, fontSize: 22 }}>Friends</h2>
        <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted }}
          onClick={() => setGameScreen('home')}>Back</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Tab active={tab === 'friends'} label="Friends" badge={totalUnread} onClick={() => setTab('friends')} />
        <Tab active={tab === 'requests'} label="Requests" badge={pendingReceived.length} onClick={() => setTab('requests')} />
        <Tab active={tab === 'search'} label="Search" onClick={() => setTab('search')} />
      </div>

      {loading && <div style={{ color: C.muted, textAlign: 'center', padding: 32 }}>Loading...</div>}

      {!loading && tab === 'friends' && (
        <>
          {accepted.length === 0 && <div style={{ ...s.card, textAlign: 'center', color: C.muted, padding: 32 }}>
            No friends yet. Search for users to add!
          </div>}
          {accepted.map(f => (
            <FriendCard key={f.friendshipId} friend={f} unreadCount={unread[f.friendId] || 0}
              onMessage={() => setMessageTarget(f)} onSelect={() => setSelectedFriend(f)} />
          ))}
        </>
      )}

      {!loading && tab === 'requests' && (
        <>
          {pending.length === 0 && <div style={{ ...s.card, textAlign: 'center', color: C.muted, padding: 32 }}>
            No pending requests.
          </div>}
          {pending.map(r => (
            <RequestCard key={r.friendshipId} req={r} myId={currentUser}
              onAccept={() => accept(r.friendshipId)} onDecline={() => remove(r.friendshipId)} />
          ))}
        </>
      )}

      {!loading && tab === 'search' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by username..."
              style={{ ...s.input, flex: 1, fontSize: 14 }}
            />
            <button onClick={doSearch} disabled={searching} style={{ ...s.btn(C.yellow, 'sm') }}>
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {searchResults.map(u => {
            const alreadyFriend = friends.some(f => f.friendId === u.id);
            return (
              <div key={u.id} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: 14 }}>
                <img src={pkImg(u.starterSlug)} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>Level {u.level}</div>
                </div>
                {alreadyFriend
                  ? <span style={{ color: C.muted, fontSize: 13 }}>Added</span>
                  : <button onClick={() => invite(u.id)} style={{ ...s.btn(C.green, 'sm'), padding: '6px 12px', fontSize: 13 }}>
                      Add Friend
                    </button>
                }
              </div>
            );
          })}
        </>
      )}

      {selectedFriend && (
        <FriendDetailModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onMessage={() => { setSelectedFriend(null); setMessageTarget(selectedFriend); }}
          onRemove={() => { remove(selectedFriend.friendshipId); setSelectedFriend(null); }}
        />
      )}

      {messageTarget && (
        <MessageDialog
          friend={messageTarget}
          jwt={jwt}
          myId={currentUser}
          myStarterSlug={myStarterSlug}
          onClose={() => { setMessageTarget(null); loadFriends(); }}
        />
      )}
    </div>
  );
};
