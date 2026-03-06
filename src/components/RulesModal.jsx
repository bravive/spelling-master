import { useState } from 'react';
import { C, s } from '../shared';

export const RulesModal = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        style={{ color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
      >
        Rules
      </span>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900, padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e1b3a', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, maxHeight: '80vh', overflowY: 'auto', border: `1px solid ${C.border}`, animation: 'popIn 0.3s ease' }}
          >
            <h2 style={{ color: C.yellow, margin: '0 0 16px', textAlign: 'center', fontSize: 22 }}>How to Catch Pokemon</h2>

            <Section title="1. Spell Words" icon="📖">
              You get 10 words each round. First, study them. Then, listen and spell each word!
            </Section>

            <Section title="2. Earn Credits" icon="💰">
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', margin: '6px 0' }}>
                <tbody>
                  <Row label="10/10" value="5 credits" />
                  <Row label="9/10" value="3 credits" />
                  <Row label="8/10" value="2 credits" />
                  <Row label="7 or 6/10" value="0 credits" />
                  <Row label="Below 6" value="Try again!" />
                </tbody>
              </table>
            </Section>

            <Section title="3. Catch Pokemon" icon="🎉">
              Every <strong style={{ color: C.yellow }}>10 credits</strong> = 1 new Pokemon! They unlock in order, one by one.
            </Section>

            <Section title="4. Streak Bonus" icon="🔥">
              Play every day! Every <strong style={{ color: C.yellow }}>3 days in a row</strong> = 5 bonus credits.
            </Section>

            <Section title="5. Shiny Pokemon" icon="✨">
              After catching 3 Pokemon in a row, you get a <strong style={{ color: '#a78bfa' }}>shiny chance</strong>! Your next catch has a 50% chance to be a rare shiny version.
            </Section>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />
            <h3 style={{ color: C.yellow, margin: '0 0 12px', textAlign: 'center', fontSize: 18 }}>Weekly Challenge</h3>

            <Section title="6. Weekly Words" icon="📅">
              Each week there is a special word list to practice. New lists unlock every Monday!
            </Section>

            <Section title="7. First-Time Bonus" icon="⭐">
              Get a word right on your <strong style={{ color: C.yellow }}>first try</strong> = 0.5 credits. Get <strong style={{ color: C.yellow }}>ALL words</strong> right on the first try in one run = 3 bonus credits!
            </Section>

            <Section title="8. Daily Replay" icon="🔁">
              You can replay any previous weekly list every day! Get all words correct in one run = <strong style={{ color: C.yellow }}>2 credits per day per list</strong> (once per list per day).
            </Section>

            <button
              style={{ ...s.btn(C.yellow), width: '100%', marginTop: 16 }}
              onClick={() => setOpen(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const Section = ({ title, icon, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{icon} {title}</div>
    <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.5 }}>{children}</div>
  </div>
);

const Row = ({ label, value }) => (
  <tr>
    <td style={{ padding: '2px 0', fontWeight: 700, color: '#fff' }}>{label}</td>
    <td style={{ padding: '2px 0', textAlign: 'right', color: C.yellow }}>{value}</td>
  </tr>
);
