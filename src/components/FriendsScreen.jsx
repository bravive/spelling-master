import { useState, useEffect, useRef } from 'react';
import { ALL_POKEMON, pkImg, pkShiny } from '../data/pokemon';
import { isPkCaught, pkCount, C, s } from '../shared';

const Tab = ({ active, label, badge, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    border: active ? `1px solid ${C.yellow}` : '1px solid transparent',
    borderRadius: 8, padding: '8px 4px', color: active ? C.yellow : C.muted,
    fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer',
    position: 'relative', textAlign: 'center', whiteSpace: 'nowrap',
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

const IconBtn = ({ onClick, color, children, badge }) => (
  <button onClick={e => { e.stopPropagation(); onClick(); }} style={{
    width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: `${color}22`, color, fontSize: 17, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', transition: 'background 0.15s', flexShrink: 0,
  }}>
    {children}
    {badge > 0 && <span style={{
      position: 'absolute', top: -4, right: -4,
      background: C.red, color: '#fff', fontSize: 9, fontWeight: 800,
      borderRadius: '50%', width: 16, height: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{badge}</span>}
  </button>
);

const FriendCard = ({ friend, unreadCount, onMessage, onGift, onSelect }) => (
  <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: 12 }}>
    <div onClick={onSelect} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}>
      <img src={pkImg(friend.starterSlug)} alt="" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.name}</div>
        <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Lv {friend.level} · {friend.caught} caught · {friend.shinyCount} ✨ · 🔥{friend.streak}
        </div>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <IconBtn onClick={onGift} color={C.pink}>🎁</IconBtn>
      <IconBtn onClick={onMessage} color={C.blue} badge={unreadCount}>💬</IconBtn>
    </div>
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
          Lv {friend.level} · {friend.caught} caught · {friend.shinyCount} ✨ · 🔥{friend.streak}
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
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 1000,
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1e1b3a', border: `1px solid ${C.border}`, borderRadius: 16,
        width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column',
        height: 'min(75dvh, 520px)', maxHeight: '100%',
        padding: 16, overflow: 'hidden',
        animation: 'popIn 0.25s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ ...s.backBtn }}>←</button>
          <img src={pkImg(friend.starterSlug)} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{friend.name}</span>
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
            style={{ ...s.input, flex: 1, fontSize: 16 }}
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

const GiftPendingCard = ({ gift, myId, onAccept, onDecline }) => {
  const isSent = gift.fromUserId === myId;
  const displayName = isSent ? gift.toName : gift.fromName;
  const pokeName = gift.pokemonSlug.charAt(0).toUpperCase() + gift.pokemonSlug.slice(1);
  const imgSrc = gift.isShiny ? pkShiny(gift.pokemonSlug) : pkImg(gift.pokemonSlug);
  const cardBorder = gift.isShiny ? `1px solid #c4b5fd` : `1px solid ${C.border}`;
  return (
    <div style={{ ...s.card, border: cardBorder, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: 14 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img src={imgSrc} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
        {gift.isShiny && (
          <span style={{ position: 'absolute', top: -4, right: -6, fontSize: 13 }}>✨</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {isSent
            ? <span>You sent <b style={{ color: gift.isShiny ? '#c4b5fd' : C.pink }}>{gift.isShiny ? '✨ Shiny ' : ''}{pokeName}</b> to {displayName}</span>
            : <span><b>{displayName}</b> sent you <b style={{ color: gift.isShiny ? '#c4b5fd' : C.pink }}>{gift.isShiny ? '✨ Shiny ' : ''}{pokeName}</b></span>
          }
        </div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
          {new Date(gift.created_at).toLocaleDateString()}
        </div>
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

const GiftModal = ({ friend, jwt, onClose, onSent }) => {
  const [trophyData, setTrophyData] = useState(null);
  // confirm = { pk, isShiny }
  const [confirm, setConfirm] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };

  useEffect(() => {
    fetch('/api/trophy', { headers }).then(r => r.json()).then(setTrophyData).catch(() => {});
  }, []);

  const col = trophyData?.collection || {};
  const regularGiftable = ALL_POKEMON.filter(pk => isPkCaught(col[pk.id]));
  const shinyGiftable = ALL_POKEMON.filter(pk => col[pk.id]?.shiny);
  const hasAny = regularGiftable.length > 0 || shinyGiftable.length > 0;

  const sendGift = async ({ pk, isShiny }) => {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/gifts/send', {
        method: 'POST', headers,
        body: JSON.stringify({ toUserId: friend.friendId, pokemonId: pk.id, isShiny }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send gift');
        setSending(false);
        return;
      }
      onSent?.();
      onClose();
    } catch {
      setError('Failed to send gift');
    }
    setSending(false);
  };

  if (!trophyData) return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ color: C.muted }}>Loading...</div>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1e1b3a', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400,
        maxHeight: 'calc(100dvh - 48px)', display: 'flex', flexDirection: 'column',
        animation: 'popIn 0.25s ease', border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Gift to {friend.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <div style={{
          background: `${C.pink}18`, borderRadius: 8, padding: '6px 12px', marginBottom: 10,
          borderLeft: `3px solid ${C.pink}`, fontSize: 12, fontWeight: 600, color: C.pink, flexShrink: 0,
        }}>
          Pick a Pokemon to gift (free!)
        </div>

        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 8, flexShrink: 0 }}>{error}</div>}

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {confirm ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <img
                src={confirm.isShiny ? pkShiny(confirm.pk.slug) : pkImg(confirm.pk.slug)}
                alt={confirm.pk.name}
                style={{ width: 80, height: 80, objectFit: 'contain' }}
              />
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>
                Send {confirm.isShiny ? '✨ Shiny ' : ''}{confirm.pk.name} to {friend.name}?
              </div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                {confirm.isShiny ? 'Your shiny copy' : `You have x${pkCount(col[confirm.pk.id])}`}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                <button disabled={sending} onClick={() => sendGift(confirm)} style={{ ...s.btn(confirm.isShiny ? '#c4b5fd' : C.pink, 'sm') }}>
                  {sending ? 'Sending...' : 'Send!'}
                </button>
                <button onClick={() => setConfirm(null)} style={{ ...s.btn('rgba(255,255,255,0.12)', 'sm'), color: C.muted }}>Cancel</button>
              </div>
            </div>
          ) : !hasAny ? (
            <div style={{ color: C.muted, textAlign: 'center', padding: '32px 0' }}>
              No Pokemon available to gift.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {regularGiftable.map(pk => {
                const count = pkCount(col[pk.id]);
                return (
                  <div
                    key={`r-${pk.id}`}
                    onClick={() => setConfirm({ pk, isShiny: false })}
                    style={{
                      background: C.card, borderRadius: 10, padding: 8, textAlign: 'center',
                      cursor: 'pointer', border: `1px solid ${C.border}`, position: 'relative',
                    }}
                  >
                    {count > 1 && (
                      <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 10, fontWeight: 800, color: C.yellow }}>x{count}</div>
                    )}
                    <img src={pkImg(pk.slug)} alt={pk.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                    <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{pk.name}</div>
                  </div>
                );
              })}
              {shinyGiftable.map(pk => (
                <div
                  key={`s-${pk.id}`}
                  onClick={() => setConfirm({ pk, isShiny: true })}
                  style={{
                    background: 'rgba(196,181,253,0.08)', borderRadius: 10, padding: 8, textAlign: 'center',
                    cursor: 'pointer', border: '1px solid #c4b5fd', position: 'relative',
                  }}
                >
                  <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 11 }}>✨</span>
                  <img src={pkShiny(pk.slug)} alt={pk.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                  <div style={{ fontSize: 10, color: '#c4b5fd', marginTop: 2 }}>{pk.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InviteCodesTab = ({ jwt }) => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
  const MAX = 5;

  const load = () => {
    fetch('/api/invite-codes', { headers }).then(r => r.json()).then(data => { setCodes(data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr('');
    setCreating(true);
    try {
      const res = await fetch('/api/invite-codes', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Failed to create code'); }
      else load();
    } catch { setErr('Network error'); }
    setCreating(false);
  };

  const inviteUrl = (code) => `${window.location.origin}/?code=${code}`;

  const copy = (code) => {
    navigator.clipboard?.writeText(inviteUrl(code)).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  const used = codes.filter(c => c.usedBy).length;
  const unused = codes.filter(c => !c.usedBy).length;

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, color: C.yellow, marginBottom: 2 }}>Invite Codes</div>
          <div style={{ fontSize: 12, color: C.muted }}>{codes.length}/{MAX} created · {used} used · {unused} available</div>
        </div>
        <button
          onClick={create}
          disabled={creating || codes.length >= MAX}
          style={{ ...s.btn(codes.length >= MAX ? C.muted : C.green, 'sm'), opacity: codes.length >= MAX ? 0.5 : 1 }}
        >
          {creating ? '...' : codes.length >= MAX ? 'Limit reached' : '+ Generate'}
        </button>
      </div>
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{err}</div>}
      {loading && <div style={{ color: C.muted, textAlign: 'center', padding: 24 }}>Loading...</div>}
      {!loading && codes.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', color: C.muted, padding: 32 }}>
          No codes yet. Generate one to invite a friend!
        </div>
      )}
      {codes.map(c => (
        <div key={c._id} style={{ ...s.card, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 2, color: c.usedBy ? C.muted : C.yellow }}>{c.code}</div>
            {c.usedBy
              ? <div style={{ fontSize: 12, color: C.muted }}>Used by <span style={{ color: '#fff' }}>{c.usedByName}</span></div>
              : <div style={{ fontSize: 12, color: C.green }}>Available</div>
            }
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(c.created_at).toLocaleDateString()}</div>
          </div>
          {!c.usedBy && (
            <button
              onClick={() => copy(c.code)}
              title={inviteUrl(c.code)}
              style={{ background: copied === c.code ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copied === c.code ? C.green : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: copied === c.code ? C.green : C.muted, fontSize: 12, whiteSpace: 'nowrap' }}
            >
              {copied === c.code
                ? <><span style={{ fontSize: 14 }}>✓</span> Copied!</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Copy link</>
              }
            </button>
          )}
          {c.usedBy && <div style={{ fontSize: 18, color: C.muted }}>✓</div>}
        </div>
      ))}
    </div>
  );
};

export const FriendsScreen = ({ jwt, currentUser, myStarterSlug, setGameScreen, setTrophyData }) => {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [unread, setUnread] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [messageTarget, setMessageTarget] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [giftTarget, setGiftTarget] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };

  const loadGifts = () => {
    fetch('/api/gifts', { headers }).then(r => r.json()).then(setGifts).catch(() => {});
  };

  // Re-fetch trophyData from server so collection counts reflect accepted gifts
  const refreshTrophy = () => {
    fetch('/api/trophy', { headers }).then(r => r.json()).then(data => setTrophyData?.(data)).catch(() => {});
  };

  const loadFriends = () => {
    Promise.all([
      fetch('/api/friends', { headers }).then(r => r.json()),
      fetch('/api/friends/unread', { headers }).then(r => r.json()),
    ]).then(([f, u]) => {
      setFriends(f);
      setUnread(u);
      setLoading(false);
    }).catch(() => setLoading(false));
    loadGifts();
  };

  useEffect(() => { loadFriends(); }, []);

  const accepted = friends.filter(f => f.status === 'accepted');
  const pending = friends.filter(f => f.status === 'pending');
  const pendingReceived = pending.filter(f => f.initiator !== currentUser);
  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);
  const incomingGifts = gifts.filter(g => g.toUserId === currentUser);

  const acceptGiftHandler = async (giftId) => {
    try {
      const res = await fetch(`/api/gifts/${giftId}/accept`, { method: 'PUT', headers });
      if (res.ok) refreshTrophy();
      loadGifts();
    } catch { /* ignore */ }
  };

  const declineGiftHandler = async (giftId) => {
    try {
      await fetch(`/api/gifts/${giftId}/decline`, { method: 'PUT', headers });
      loadGifts();
    } catch { /* ignore */ }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button style={{ ...s.backBtn }} onClick={() => setGameScreen('home')}>←</button>
        <h2 style={{ color: C.yellow, margin: 0, fontSize: 22, flex: 1 }}>Friends</h2>
        <button
          onClick={() => { setSearchOpen(true); setSearchQuery(''); setSearchResults([]); }}
          title="Search users"
          style={{ ...s.backBtn, fontSize: 18 }}>🔍</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'nowrap' }}>
        <Tab active={tab === 'friends'} label="Friends" badge={totalUnread} onClick={() => setTab('friends')} />
        <Tab active={tab === 'requests'} label="Requests" badge={pendingReceived.length} onClick={() => setTab('requests')} />
        <Tab active={tab === 'gifts'} label="Gifts" badge={incomingGifts.length} onClick={() => setTab('gifts')} />
        <Tab active={tab === 'codes'} label="Codes" onClick={() => setTab('codes')} />
      </div>

      {loading && <div style={{ color: C.muted, textAlign: 'center', padding: 32 }}>Loading...</div>}

      {!loading && tab === 'friends' && (
        <>
          {accepted.length === 0 && <div style={{ ...s.card, textAlign: 'center', color: C.muted, padding: 32 }}>
            No friends yet. Search for users to add!
          </div>}
          {accepted.map(f => (
            <FriendCard key={f.friendshipId} friend={f} unreadCount={unread[f.friendId] || 0}
              onMessage={() => setMessageTarget(f)} onGift={() => setGiftTarget(f)} onSelect={() => setSelectedFriend(f)} />
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

      {!loading && tab === 'gifts' && (
        <>
          {gifts.length === 0 && <div style={{ ...s.card, textAlign: 'center', color: C.muted, padding: 32 }}>
            No pending gifts. Tap a friend to send one!
          </div>}
          {gifts.map(g => (
            <GiftPendingCard key={g._id} gift={g} myId={currentUser}
              onAccept={() => acceptGiftHandler(g._id)} onDecline={() => declineGiftHandler(g._id)} />
          ))}
        </>
      )}

      {!loading && tab === 'codes' && <InviteCodesTab jwt={jwt} />}

      {searchOpen && (
        <div onClick={() => setSearchOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          zIndex: 1000,
          paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 56px)',
          paddingLeft: 'max(env(safe-area-inset-left, 0px) + 16px, 16px)',
          paddingRight: 'max(env(safe-area-inset-right, 0px) + 16px, 16px)',
          paddingBottom: 16,
          boxSizing: 'border-box',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1e1b3a', border: `1px solid ${C.border}`, borderRadius: 16,
            width: '100%', maxWidth: 420, padding: 16,
            maxHeight: '100%', display: 'flex', flexDirection: 'column',
            animation: 'popIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Search by username..."
                style={{ ...s.input, flex: 1, fontSize: 14 }}
              />
              <button onClick={doSearch} disabled={searching} style={{ ...s.btn(C.yellow, 'sm') }}>
                {searching ? '...' : '🔍'}
              </button>
              <button onClick={() => setSearchOpen(false)} style={{ ...s.backBtn, fontSize: 18, lineHeight: '36px' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {searchResults.length === 0 && searchQuery && !searching && (
                <div style={{ color: C.muted, textAlign: 'center', padding: 24 }}>No users found.</div>
              )}
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
                      : <button onClick={() => { invite(u.id); setSearchOpen(false); }} style={{ ...s.btn(C.green, 'sm'), padding: '6px 12px', fontSize: 13 }}>
                          Add Friend
                        </button>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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

      {giftTarget && (
        <GiftModal
          friend={giftTarget}
          jwt={jwt}
          onClose={() => setGiftTarget(null)}
          onSent={() => loadGifts()}
        />
      )}

    </div>
  );
};
