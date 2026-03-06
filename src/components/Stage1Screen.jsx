import { useState, useEffect } from 'react';
import { speak, C, s } from '../shared';

export const Stage1Screen = ({ words, retryCount, setGameScreen, nextScreen = 'stage2', discardScreen = 'home', quitLabel = 'Discard', readyLabel = "✅ I'm Ready!" }) => {
  const [elapsed, setElapsed] = useState(0);
  const MAX = 180;
  useEffect(() => {
    speak("Take a good look at all the words! You have one minute to remember them!");
    const t = setInterval(() => setElapsed(e => {
      if (e + 1 >= MAX) { clearInterval(t); setGameScreen(nextScreen); return MAX; }
      return e + 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  const pct = elapsed / MAX;
  const barColor = elapsed < 60 ? C.green : elapsed < 120 ? C.yellow : C.red;
  const barLabel = elapsed < 60 ? 'Study time!' : elapsed < 120 ? 'Take your time!' : 'Almost at the limit!';
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div style={{ width: '100%', maxWidth: 600 }}>
      <div style={{ textAlign: 'center', marginBottom: 16, position: 'relative' }}>
        <span
          style={{ position: 'absolute', top: 0, right: 0, color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => setGameScreen(discardScreen)}
        >{quitLabel}</span>
        <h2 style={{ color: C.yellow, margin: 0 }}>📖 Stage 1 — Remember!</h2>
        {retryCount > 0 && <div style={{ color: C.red, fontSize: 13 }}>Retry #{retryCount}</div>}
        <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{mm}:{ss}</div>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, height: 10, margin: '8px 0' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%', background: barColor, borderRadius: 8, transition: 'width 1s linear, background 0.5s' }} />
        </div>
        <div style={{ color: barColor, fontSize: 13 }}>{barLabel}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {words.map((entry, i) => (
          <div key={i} style={{ ...s.card, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>{entry.w}</div>
            <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>{entry.s}</div>
          </div>
        ))}
      </div>
      <button style={{ ...s.btn(C.green, 'lg'), width: '100%' }}
        onClick={() => setGameScreen(nextScreen)}>
        {readyLabel}
      </button>
    </div>
  );
};
