import { useState, useEffect } from 'react';
import { pkImg, pkShiny } from '../data/pokemon';
import { speak, C, s } from '../shared';
import { Confetti } from './Confetti';

export const TrophyModal = ({ unlock, onDismiss }) => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 700);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const msg = unlock.shiny
      ? `Wow! You got a shiny ${unlock.name}! So rare!`
      : `Amazing! You caught ${unlock.name}!`;
    speak(msg);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [unlock]);

  const isShiny = unlock.shiny;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      {phase >= 1 && <Confetti />}
      <div style={{ ...s.card, textAlign: 'center', padding: 40, animation: 'popIn 0.6s ease', border: `2px solid ${isShiny ? '#a78bfa' : C.yellow}`, maxWidth: 340, width: '90%' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: isShiny ? '#a78bfa' : C.yellow, marginBottom: 8 }}>
          {isShiny ? '✨ Shiny Pokemon!' : '🎉 New Pokemon!'}
        </div>
        <img
          src={isShiny ? pkShiny(unlock.slug) : pkImg(unlock.slug)}
          alt={unlock.name}
          style={{ width: 140, height: 140, objectFit: 'contain', animation: phase >= 1 ? 'pop 0.5s ease' : 'none', filter: isShiny ? 'drop-shadow(0 0 16px #a78bfa)' : 'none' }}
        />
        <div style={{ fontSize: 24, fontWeight: 700, margin: '12px 0 4px' }}>{unlock.name}</div>
        {isShiny && <div style={{ color: '#a78bfa', fontSize: 14, marginBottom: 8 }}>✨ Shiny variant</div>}
        <button style={{ ...s.btn(isShiny ? '#a78bfa' : C.yellow, 'lg'), marginTop: 16 }} onClick={onDismiss}>
          🎉 Awesome!
        </button>
      </div>
    </div>
  );
};
