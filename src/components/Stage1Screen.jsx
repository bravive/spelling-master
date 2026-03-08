import { useState, useEffect, useCallback } from 'react';
import { speak, speakTimes, C, s } from '../shared';

export const Stage1Screen = ({ words, retryCount, setGameScreen, nextScreen = 'stage2', discardScreen = 'home', quitLabel = 'Discard', readyLabel = "✅ I'm Ready!", requireClickAll = true }) => {
  const [elapsed, setElapsed] = useState(0);
  const [readWords, setReadWords] = useState(new Set());
  const [floatingCard, setFloatingCard] = useState(null); // { index, entry, counting }
  const MAX = 180;

  useEffect(() => {
    speak("Take a good look at all the words! Click each word to study it!");
    const t = setInterval(() => setElapsed(e => {
      if (e + 1 >= MAX) { clearInterval(t); setGameScreen(nextScreen); return MAX; }
      return e + 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  const allRead = !requireClickAll || readWords.size >= words.length;

  const handleWordClick = useCallback((entry, index) => {
    speakTimes(`${entry.w}. ${entry.s}`, 1);

    const alreadyRead = readWords.has(index);

    if (alreadyRead) {
      // Already read: show card without countdown, dismissable immediately
      setFloatingCard({ index, entry, counting: false });
    } else {
      // First read: show card with 3s countdown, not dismissable until done
      setFloatingCard({ index, entry, counting: true });

      // After 3s: mark as read, keep card open but make it dismissable
      setTimeout(() => {
        setReadWords(prev => {
          const next = new Set(prev);
          next.add(index);
          return next;
        });
        setFloatingCard(prev => prev ? { ...prev, counting: false } : null);
      }, 3000);
    }
  }, [readWords]);

  const handleOverlayClick = useCallback(() => {
    if (!floatingCard) return;
    if (floatingCard.counting) return; // blocked during countdown
    setFloatingCard(null); // just close, never marks as read
  }, [floatingCard]);

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
              ...s.card, padding: '14px 16px', cursor: 'pointer', transition: 'background 0.15s, border 0.15s',
              ...(requireClickAll && isRead ? { border: `2px solid ${C.yellow}` } : {}),
            }}
              onClick={() => handleWordClick(entry, i)}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>
                {entry.w}
              </div>
              <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>{entry.s}</div>
            </div>
          );
        })}
      </div>

      {/* Floating card overlay */}
      {floatingCard && (
        <div data-testid="floating-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, animation: 'popIn 0.3s ease-out',
          cursor: floatingCard.counting ? 'not-allowed' : 'pointer',
        }} onClick={handleOverlayClick}>
          <div style={{
            background: '#1a1a2e', padding: '32px 40px', textAlign: 'center', maxWidth: 340,
            borderRadius: 16, animation: 'popIn 0.3s ease-out', border: `2px solid ${C.yellow}`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, fontWeight: 800, color: C.yellow, marginBottom: 12 }}>{floatingCard.entry.w}</div>
            <div style={{ fontSize: 16, color: '#fff', fontStyle: 'italic', lineHeight: 1.5 }}>{floatingCard.entry.s}</div>
            {floatingCard.counting && (
              <div style={{ marginTop: 16, width: '100%', background: 'rgba(255,255,255,0.15)', borderRadius: 4, height: 6 }}>
                <div style={{ width: '100%', height: '100%', background: C.yellow, borderRadius: 4, animation: 'shrink 3s linear forwards' }} />
              </div>
            )}
            {!floatingCard.counting && (
              <div style={{ marginTop: 16, color: C.muted, fontSize: 12 }}>Tap outside to close</div>
            )}
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
