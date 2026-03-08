import { useState, useEffect, useCallback } from 'react';
import { speak, speakTimes, C, s } from '../shared';

export const Stage1Screen = ({ words, retryCount, setGameScreen, nextScreen = 'stage2', discardScreen = 'home', quitLabel = 'Discard', readyLabel = "✅ I'm Ready!", requireClickAll = true }) => {
  const [elapsed, setElapsed] = useState(0);
  const [readWords, setReadWords] = useState(new Set());
  const [floatingCard, setFloatingCard] = useState(null); // { index, entry }
  const [floatingTimer, setFloatingTimer] = useState(null);
  const MAX = 180;

  useEffect(() => {
    speak("Take a good look at all the words! Click each word to study it!");
    const t = setInterval(() => setElapsed(e => {
      if (e + 1 >= MAX) { clearInterval(t); setGameScreen(nextScreen); return MAX; }
      return e + 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  // Cleanup floating card timer on unmount
  useEffect(() => {
    return () => { if (floatingTimer) clearTimeout(floatingTimer); };
  }, [floatingTimer]);

  const allRead = !requireClickAll || readWords.size >= words.length;

  const handleWordClick = useCallback((entry, index) => {
    speakTimes(`${entry.w}. ${entry.s}`, 1);

    // Clear any existing floating card timer
    if (floatingTimer) clearTimeout(floatingTimer);

    setFloatingCard({ index, entry });

    const timer = setTimeout(() => {
      setFloatingCard(null);
      setReadWords(prev => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    }, 3000);
    setFloatingTimer(timer);
  }, [floatingTimer]);

  const pct = elapsed / MAX;
  const barColor = elapsed < 60 ? C.green : elapsed < 120 ? C.yellow : C.red;
  const barLabel = elapsed < 60 ? 'Study time!' : elapsed < 120 ? 'Take your time!' : 'Almost at the limit!';
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const readyBtnColor = allRead ? C.green : 'rgba(255,255,255,0.12)';

  return (
    <div style={{ width: '100%', maxWidth: 600, position: 'relative' }}>
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
        {requireClickAll && !allRead && (
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            Tap each word to study it ({readWords.size}/{words.length})
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {words.map((entry, i) => {
          const isRead = readWords.has(i);
          return (
            <div key={i} className="word-card" style={{
              ...s.card, padding: '14px 16px', cursor: 'pointer', transition: 'background 0.15s',
              ...(requireClickAll && isRead ? { border: `1px solid ${C.green}`, background: 'rgba(16,185,129,0.12)' } : {}),
            }}
              onClick={() => handleWordClick(entry, i)}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow, display: 'flex', alignItems: 'center', gap: 6 }}>
                {entry.w}
                {requireClickAll && isRead && <span style={{ fontSize: 14, color: C.green }}>✓</span>}
              </div>
              <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>{entry.s}</div>
            </div>
          );
        })}
      </div>

      {/* Floating card overlay */}
      {floatingCard && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, animation: 'popIn 0.3s ease-out',
        }} onClick={() => {
          if (floatingTimer) clearTimeout(floatingTimer);
          setFloatingCard(null);
          setReadWords(prev => {
            const next = new Set(prev);
            next.add(floatingCard.index);
            return next;
          });
        }}>
          <div style={{
            ...s.card, padding: '32px 40px', textAlign: 'center', maxWidth: 340,
            animation: 'popIn 0.3s ease-out', border: `2px solid ${C.yellow}`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, fontWeight: 800, color: C.yellow, marginBottom: 12 }}>{floatingCard.entry.w}</div>
            <div style={{ fontSize: 16, color: '#fff', fontStyle: 'italic', lineHeight: 1.5 }}>{floatingCard.entry.s}</div>
            <div style={{ marginTop: 16, width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 4 }}>
              <div style={{ width: '100%', height: '100%', background: C.yellow, borderRadius: 4, animation: 'shrink 3s linear forwards' }} />
            </div>
          </div>
        </div>
      )}

      <button
        data-testid="ready-button"
        style={{ ...s.btn(readyBtnColor, 'lg'), width: '100%', ...(allRead ? {} : { cursor: 'not-allowed', opacity: 0.6 }) }}
        onClick={() => allRead && setGameScreen(nextScreen)}
        disabled={!allRead}>
        {allRead ? readyLabel : `📖 Read all words first (${readWords.size}/${words.length})`}
      </button>
    </div>
  );
};
