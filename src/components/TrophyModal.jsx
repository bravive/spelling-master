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
    <div style={{ ...s.overlay, background: 'rgba(0,0,0,0.85)', zIndex: 1000 }}>
      {phase >= 1 && <Confetti />}
      <div style={{ ...s.card, textAlign: 'center', padding: '32px 24px', animation: 'popIn 0.6s ease', border: `2px solid ${isShiny ? C.shiny : C.yellow}`, maxWidth: 340, width: '90%' }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: isShiny ? C.shiny : C.yellow, marginBottom: 8 }}>
          {isShiny ? '✨ Shiny Pokemon!' : '🎉 New Pokemon!'}
        </div>
        <img
          src={isShiny ? pkShiny(unlock.slug) : pkImg(unlock.slug)}
          alt={unlock.name}
          style={{ width: 120, height: 120, objectFit: 'contain', animation: phase >= 1 ? 'pop 0.5s ease' : 'none', filter: isShiny ? `drop-shadow(0 0 16px ${C.shiny})` : 'none' }}
        />
        <div style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 4px' }}>{unlock.name}</div>
        {isShiny && <div style={{ color: C.shiny, fontSize: 14, marginBottom: 6 }}>✨ Shiny variant</div>}
        <button style={{ ...s.btn(isShiny ? C.shiny : C.yellow, 'lg'), marginTop: 12, width: '100%' }} onClick={onDismiss}>
          🎉 Awesome!
        </button>
      </div>
    </div>
  );
};
