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

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayStr = () => localDateStr();

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
  bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  yellow: '#fbbf24',
  pink: '#f472b6',
  blue: '#60a5fa',
  green: '#10b981',
  red: '#ef4444',
  muted: '#94a3b8',
  purple: '#c4b5fd',
  card: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.12)',
};

export const s = {
  page: { minHeight: '100dvh', background: C.bg, color: '#fff', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px' },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 },
  btn: (color = C.yellow, size = 'md') => ({
    background: color, border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700,
    padding: size === 'sm' ? '8px 16px' : size === 'lg' ? '16px 32px' : '12px 24px',
    fontSize: size === 'sm' ? 14 : size === 'lg' ? 20 : 16,
    color: color === 'rgba(255,255,255,0.12)' || color === 'rgba(255,255,255,0.1)' ? '#fff' : '#1a1a2e',
    transition: 'opacity 0.15s',
  }),
  input: { background: 'rgba(255,255,255,0.1)', border: `1px solid ${C.border}`, borderRadius: 10, color: '#fff', fontSize: 18, padding: '12px 16px', width: '100%', boxSizing: 'border-box', outline: 'none' },
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
    .pk-card-inner { transition: transform 0.45s; transform-style: preserve-3d; }
    .pk-card-inner.flipped { transform: rotateY(180deg); }
    .pk-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
    .pk-back  { backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); }
    .word-card:hover { background: rgba(255,255,255,0.16) !important; }
    .wk-hint-wrap:hover .wk-hint { display: block !important; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    @media (orientation: landscape) and (max-height: 500px) {
      body { font-size: 14px; }
    }
  `;
  document.head.appendChild(el);
};
