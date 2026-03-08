// ─── Speech ──────────────────────────────────────────────────────────────────
export const speakTimes = (text, times, onDone) => {
  window.speechSynthesis.cancel();
  let c = 0;
  const next = () => {
    if (c >= times) { onDone?.(); return; }
    c++;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.82; u.pitch = 1.05;
    u.onend = () => setTimeout(next, 700);
    window.speechSynthesis.speak(u);
  };
  next();
};
export const speak = (text) => speakTimes(text, 1, null);

// ─── Pokemon collection helpers ──────────────────────────────────────────────
export const pkCount = (owned) => owned?.count != null ? owned.count : (owned?.regular ? 1 : 0);
export const isPkCaught = (owned) => pkCount(owned) >= 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayStr = () => localDateStr();

/** Convert a display name to a valid user key: lowercase, spaces→_, strip everything else. */
export const generateKey = (name) =>
  name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

export const newUser = (name, pin, starterId, starterSlug) => ({
  name, pin, starterId, starterSlug,
  level: 1,
  totalCredits: 0,
  creditBank: 0,
  streak: 0,
  lastPlayed: null,
  streakDates: [],
  caught: 0,           // denormalized count for the select screen
  roundCount: 0,
  createdAt: new Date().toISOString(),
});

// ─── Styles ──────────────────────────────────────────────────────────────────
export const C = {
  bg: 'linear-gradient(135deg, #1a1040, #2d1b69, #1e1450)',
  yellow: '#fbbf24',
  pink: '#f472b6',
  blue: '#60a5fa',
  green: '#34d399',
  red: '#ef4444',
  muted: '#94a3b8',
  purple: '#c4b5fd',
  orange: '#fb923c',
  shiny: '#a78bfa',
  card: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.15)',
  modal: '#1e1b3a',
};

export const s = {
  page: { minHeight: '100dvh', background: C.bg, color: '#fff', fontFamily: 'system-ui,-apple-system,"Segoe UI",sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', boxSizing: 'border-box', overflowX: 'hidden', width: '100%' },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16 },
  btn: (color = C.yellow, size = 'md') => ({
    background: color, border: 'none', borderRadius: 16, cursor: 'pointer', fontWeight: 800,
    padding: size === 'sm' ? '8px 16px' : size === 'lg' ? '14px 24px' : '10px 20px',
    fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 15,
    color: color === 'rgba(255,255,255,0.12)' || color === 'rgba(255,255,255,0.1)' || color === 'rgba(255,255,255,0.15)' ? '#fff' : '#1a1a2e',
    transition: 'all 0.2s ease',
  }),
  input: { background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.border}`, borderRadius: 14, color: '#fff', fontSize: 17, padding: '12px 16px', width: '100%', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' },
  backBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', fontSize: 20, color: '#fff', flexShrink: 0, lineHeight: '38px', textAlign: 'center', padding: 0, transition: 'background 0.2s' },
  heading: { fontSize: 22, fontWeight: 900, letterSpacing: 0.5 },
  subtext: { fontSize: 13, color: C.muted, lineHeight: 1.4 },
  badge: { borderRadius: 99, padding: '4px 12px', fontWeight: 700, fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16 },
  modalCard: { background: C.modal, borderRadius: 24, border: `1px solid ${C.border}`, animation: 'popIn 0.3s ease', width: '100%', maxHeight: 'calc(100dvh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
};

// ─── CSS animations injected once ────────────────────────────────────────────
export const injectCSS = () => {
  if (document.getElementById('sm-styles')) return;
  const el = document.createElement('style');
  el.id = 'sm-styles';
  el.textContent = `
    @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.7} }
    @keyframes pop     { 0%{transform:scale(0.3);opacity:0} 70%{transform:scale(1.25)} 100%{transform:scale(1);opacity:1} }
    @keyframes popIn   { 0%{transform:scale(0.5) translateY(40px);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
    @keyframes shake   { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
    @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes shimmer { 0%{filter:drop-shadow(0 0 6px #a78bfa)} 50%{filter:drop-shadow(0 0 16px #60a5fa)} 100%{filter:drop-shadow(0 0 6px #a78bfa)} }
    @keyframes sparkle { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
    @keyframes fall    { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
    @keyframes shrink  { 0%{width:100%} 100%{width:0%} }
    .pk-card-inner { transition: transform 0.45s; transform-style: preserve-3d; }
    .pk-card-inner.flipped { transform: rotateY(180deg); }
    .pk-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
    .pk-back  { backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); }
    .word-card:hover { background: rgba(255,255,255,0.16) !important; }
    .trophy-card:hover { transform: scale(1.05) !important; }
    .wk-hint-wrap:hover .wk-hint { display: block !important; }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; overflow-x: hidden; width: 100%; }
    body { overscroll-behavior-y: contain; -webkit-text-size-adjust: 100%; }
    input, button, select { font-family: inherit; }
    @media (orientation: landscape) and (max-height: 500px) {
      body { font-size: 14px; }
    }
    @supports (padding: env(safe-area-inset-top)) {
      body { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
    }
  `;
  document.head.appendChild(el);
};
