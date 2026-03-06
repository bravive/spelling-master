import { useState, useEffect, useRef, useCallback } from 'react';
import { speakTimes, speak, C, s } from '../shared';

export const Stage2Screen = ({ words, processRound, setRoundResults, setGameScreen, resultsScreen = 'results', discardScreen = 'home' }) => {
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [order] = useState(() => [...words].sort(() => Math.random() - 0.5));
  const inputRef = useRef(null);
  const lockRef = useRef(false);
  const currentWordRef = useRef(null);

  const currentWord = order[idx];
  currentWordRef.current = currentWord;

  const speakWord = useCallback((word) => {
    if (!word) return;
    setSpeaking(true);
    speakTimes(`${word.w}. ${word.s}`, 3, () => setSpeaking(false));
  }, []);

  useEffect(() => {
    lockRef.current = false;
    setTyped('');
    setFeedback(null);
    speakWord(order[idx]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [idx]);

  useEffect(() => {
    const handler = (e) => {
      if (lockRef.current) return;
      if (e.key === 'Backspace') { e.preventDefault(); setTyped(t => t.slice(0, -1)); return; }
      if (e.key === 'Enter') { e.preventDefault(); doSubmit(); return; }
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); setTyped(t => t + e.key.toLowerCase()); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const doSubmit = () => {
    if (lockRef.current || !currentWordRef.current) return;
    const word = currentWordRef.current;
    setTyped(cur => {
      const correct = cur.toLowerCase().trim() === word.w.toLowerCase();
      lockRef.current = true;
      if (correct) {
        setFeedback('correct');
        speak('Great job!');
        setAttempt(prevAttempt => {
          setResults(prev => {
            const newResults = [...prev, { word: word.w, correct: true, attemptNumber: prevAttempt + 1 }];
            setTimeout(() => {
              lockRef.current = false;
              setFeedback(null);
              setAttempt(0);
              setIdx(i => {
                const nextIdx = i + 1;
                if (nextIdx >= order.length) {
                  const score = newResults.filter(r => r.correct).length;
                  const outcome = processRound(score, newResults);
                  setRoundResults({ score, ...outcome, results: newResults, words: order });
                  setGameScreen(resultsScreen);
                }
                return nextIdx;
              });
            }, 1600);
            return newResults;
          });
          return prevAttempt;
        });
      } else {
        setAttempt(prev => {
          if (prev < 2) {
            setFeedback('wrong');
            speak('Not quite, try again!');
            setTimeout(() => { lockRef.current = false; setFeedback(null); setTyped(''); inputRef.current?.focus(); }, 1300);
            return prev + 1;
          } else {
            setFeedback('reveal');
            setResults(prev2 => {
              const newResults = [...prev2, { word: word.w, correct: false, attemptNumber: 3 }];
              setTimeout(() => {
                lockRef.current = false;
                setFeedback(null);
                setAttempt(0);
                setIdx(i => {
                  const nextIdx = i + 1;
                  if (nextIdx >= order.length) {
                    const score = newResults.filter(r => r.correct).length;
                    const outcome = processRound(score, newResults);
                    setRoundResults({ score, ...outcome, results: newResults, words: order });
                    setGameScreen(resultsScreen);
                  }
                  return nextIdx;
                });
              }, 2800);
              return newResults;
            });
            return prev;
          }
        });
      }
      return cur;
    });
  };

  const KEYBOARD_ROWS = [
    'qwertyuiop'.split(''),
    'asdfghjkl'.split(''),
    'zxcvbnm'.split(''),
  ];

  return (
    <div style={{ width: '100%', maxWidth: 520 }}>
      <input ref={inputRef} style={{ opacity: 0, position: 'fixed', top: -100, width: 1, height: 1 }} readOnly onFocus={() => {}} />

      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        <span
          style={{ color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => { window.speechSynthesis.cancel(); setGameScreen(discardScreen); }}
        >Discard</span>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {order.map((w, i) => {
          const isCurrent = i === idx;
          const isDone = i < idx;
          const doneRes = isDone ? results[i] : null;
          return (
            <div key={i} style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: isCurrent ? C.blue : doneRes ? (doneRes.correct ? C.green : C.red) : 'rgba(255,255,255,0.1)',
              color: '#fff',
            }}>
              {isCurrent ? '?' : doneRes ? (doneRes.correct ? '✓' : '✗') : i + 1}
            </div>
          );
        })}
      </div>

      <div style={{ ...s.card, textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{speaking ? '🎵' : '🔊'}</div>
        <div style={{ color: C.muted, fontSize: 14, marginBottom: 12 }}>{speaking ? 'Listening…' : 'Ready to spell!'}</div>
        <button style={{ ...s.btn(C.blue, 'sm') }} onClick={() => speakWord(currentWord)}>🔁 Replay</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        {[0,1,2].map(i => <div key={i} style={{ fontSize: 24 }}>{i >= attempt ? '❤️' : '🖤'}</div>)}
      </div>

      {feedback === 'correct' && (
        <div style={{ textAlign: 'center', color: C.green, fontSize: 28, animation: 'pop 0.4s ease', marginBottom: 8 }}>✅ Correct!</div>
      )}
      {feedback === 'wrong' && (
        <div style={{ textAlign: 'center', color: C.red, fontSize: 22, animation: 'shake 0.3s ease', marginBottom: 8 }}>❌ Not quite, try again!</div>
      )}
      {feedback === 'reveal' && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ color: C.red, fontSize: 20 }}>❌ The word was:</div>
          <div style={{ color: C.yellow, fontSize: 32, fontWeight: 900 }}>{currentWord?.w}</div>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, letterSpacing: 6, marginBottom: 12, minHeight: 48, color: C.yellow }}>
        {(() => {
          const total = currentWord ? currentWord.w.length : 3;
          const remaining = Math.max(0, total - typed.length);
          const underlines = remaining > 0 ? ' ' + Array(remaining).fill('_').join(' ') : '';
          return <>{typed ? <span>{typed}</span> : null}<span style={{ color: 'rgba(255,255,255,0.2)' }}>{underlines}</span></>;
        })()}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', marginBottom: 12 }}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 6 }}>
            {row.map(l => (
              <button key={l}
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: '#fff', minWidth: 36, padding: '8px 10px', fontSize: 16, cursor: 'pointer', fontWeight: 600 }}
                onClick={() => !lockRef.current && setTyped(t => t + l)}>
                {l}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>💡 Type on keyboard or tap below</div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...s.btn(C.red, 'lg'), flex: 1 }}
          onClick={() => !lockRef.current && setTyped(t => t.slice(0, -1))}>⌫ Delete</button>
        <button style={{ ...s.btn(C.green, 'lg'), flex: 1 }} onClick={doSubmit}>✅ Submit</button>
      </div>
    </div>
  );
};
