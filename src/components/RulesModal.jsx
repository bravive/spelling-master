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
          style={{ ...s.overlay, zIndex: 900 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ ...s.modalCard, padding: 20, maxWidth: 380, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto' }}
          >
            <h2 style={{ color: C.yellow, margin: '0 0 14px', textAlign: 'center', fontSize: 20, fontWeight: 900 }}>How to Catch Pokemon</h2>

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
              After catching 3 Pokemon in a row, you get a <strong style={{ color: C.shiny }}>shiny chance</strong>! Your next catch will also unlock a rare shiny version of one of your Pokemon.
            </Section>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '14px 0' }} />
            <h3 style={{ color: C.yellow, margin: '0 0 10px', textAlign: 'center', fontSize: 17, fontWeight: 800 }}>Weekly Challenge</h3>

            <Section title="6. Weekly Words" icon="📅">
              Each week there is a special word list to practice. New lists unlock every Monday!
            </Section>

            <Section title="7. Word Bonus" icon="⭐">
              Get a word correct = <strong style={{ color: C.yellow }}>0.5 credits</strong>. When <strong style={{ color: C.yellow }}>ALL words</strong> are completed = 3 bonus credits!
            </Section>

            <Section title="8. Daily Replay" icon="🔁">
              You can replay any previous weekly list every day! Get all words correct in one run = <strong style={{ color: C.yellow }}>2 credits per day per list</strong> (once per list per day).
            </Section>

            <button
              style={{ ...s.btn(C.yellow), width: '100%', marginTop: 14 }}
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
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{icon} {title}</div>
    <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>{children}</div>
  </div>
);

const Row = ({ label, value }) => (
  <tr>
    <td style={{ padding: '2px 0', fontWeight: 700, color: '#fff' }}>{label}</td>
    <td style={{ padding: '2px 0', textAlign: 'right', color: C.yellow }}>{value}</td>
  </tr>
);
