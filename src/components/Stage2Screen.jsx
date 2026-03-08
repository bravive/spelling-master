import { useState, useEffect, useRef, useCallback } from 'react';
import { speakTimes, speak, C, s } from '../shared';

const useIsLandscape = () => {
  const [landscape, setLandscape] = useState(() => window.innerHeight < 500 && window.innerWidth > window.innerHeight);
  useEffect(() => {
    const check = () => setLandscape(window.innerHeight < 500 && window.innerWidth > window.innerHeight);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return landscape;
};

export const Stage2Screen = ({ words, processRound, setRoundResults, setGameScreen, resultsScreen = 'results', discardScreen = 'home', onQuit, unlimitedRetries = false, allowSkip = false }) => {
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [order] = useState(() => [...words].sort(() => Math.random() - 0.5));
  const inputRef = useRef(null);
  const lockRef = useRef(false);
  const currentWordRef = useRef(null);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const idxRef = useRef(idx);
  idxRef.current = idx;

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
      if (lockRef.current || showQuitConfirm) return;
      if (e.key === 'Backspace') { e.preventDefault(); setTyped(t => t.slice(0, -1)); return; }
      if (e.key === 'Enter') { e.preventDefault(); doSubmit(); return; }
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); setTyped(t => t + e.key.toLowerCase()); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showQuitConfirm]);

  const handleQuitConfirm = () => {
    window.speechSynthesis.cancel();
    // Build full results including remaining words as skipped
    const currentResults = resultsRef.current;
    const currentIdx = idxRef.current;
    const remainingWords = order.slice(currentIdx).map(w => ({ word: w.w, correct: false, attemptNumber: 0, skipped: true }));
    const allResults = [...currentResults, ...remainingWords];
    const score = allResults.filter(r => r.correct).length;

    if (onQuit) {
      onQuit(allResults);
    } else {
      const outcome = processRound(score, allResults);
      setRoundResults({ score, ...outcome, results: allResults, words: order, wasQuit: true });
      setGameScreen(resultsScreen);
    }
  };

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
          if (unlimitedRetries || prev < 2) {
            setFeedback('wrong');
            speak('Not quite, try again!');
            setTimeout(() => { lockRef.current = false; setFeedback(null); setTyped(''); inputRef.current?.focus(); }, 1300);
            return unlimitedRetries ? prev : prev + 1;
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

  const doSkip = () => {
    if (lockRef.current || !currentWordRef.current) return;
    const word = currentWordRef.current;
    lockRef.current = true;
    setTyped('');
    setFeedback('reveal');
    speak('Let\'s move on!');
    setResults(prev => {
      const newResults = [...prev, { word: word.w, correct: false, attemptNumber: attempt + 1, skipped: true }];
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
      }, 2000);
      return newResults;
    });
  };

  const KEYBOARD_ROWS = [
    'qwertyuiop'.split(''),
    'asdfghjkl'.split(''),
    'zxcvbnm'.split(''),
  ];

  const landscape = useIsLandscape();

  return (
    <div style={{ width: '100%', maxWidth: landscape ? 700 : 520, display: landscape ? 'flex' : 'block', gap: landscape ? 16 : 0, alignItems: landscape ? 'flex-start' : undefined }}>
      <input ref={inputRef} style={{ opacity: 0, position: 'fixed', top: -100, width: 1, height: 1 }} readOnly onFocus={() => {}} />

      {/* Quit confirmation overlay */}
      {showQuitConfirm && (
        <div data-testid="quit-confirm" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, animation: 'popIn 0.2s ease-out',
        }}>
          <div style={{ ...s.card, padding: '28px 32px', textAlign: 'center', maxWidth: 320, border: `2px solid ${C.red}` }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>Are you sure?</div>
            <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>
              You've completed {results.length} of {order.length} words. Remaining words will be marked as skipped.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...s.btn('rgba(255,255,255,0.12)', 'md'), flex: 1, color: '#fff' }}
                onClick={() => { setShowQuitConfirm(false); setTimeout(() => inputRef.current?.focus(), 100); }}>
                Keep Going
              </button>
              <button style={{ ...s.btn(C.red, 'md'), flex: 1 }}
                onClick={handleQuitConfirm}>
                Quit Round
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left panel in landscape: status + feedback */}
      <div style={landscape ? { flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 8 } : {}}>
        <div style={{ display: 'flex', gap: landscape ? 4 : 6, justifyContent: 'center', marginBottom: landscape ? 8 : 16, flexWrap: 'wrap' }}>
          {order.map((w, i) => {
            const isCurrent = i === idx;
            const isDone = i < idx;
            const doneRes = isDone ? results[i] : null;
            return (
              <div key={i} style={{
                width: landscape ? 24 : 32, height: landscape ? 24 : 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: landscape ? 11 : 13, fontWeight: 700,
                background: isCurrent ? C.blue : doneRes ? (doneRes.correct ? C.green : C.red) : 'rgba(255,255,255,0.1)',
                color: '#fff',
              }}>
                {isCurrent ? '?' : doneRes ? (doneRes.correct ? '✓' : '✗') : i + 1}
              </div>
            );
          })}
        </div>

        <div style={{ ...s.card, textAlign: 'center', marginBottom: landscape ? 8 : 16, padding: landscape ? '8px 12px' : 20 }}>
          <div style={{ fontSize: landscape ? 24 : 36, marginBottom: landscape ? 4 : 8 }}>{speaking ? '🎵' : '🔊'}</div>
          <div style={{ color: C.muted, fontSize: landscape ? 12 : 14, marginBottom: landscape ? 6 : 12 }}>{speaking ? 'Listening…' : 'Ready to spell!'}</div>
          <button style={{ ...s.btn(C.blue, 'sm') }} onClick={() => speakWord(currentWord)}>🔁 Replay</button>
        </div>

        {!unlimitedRetries && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: landscape ? 4 : 12 }}>
            {[0,1,2].map(i => <div key={i} style={{ fontSize: landscape ? 18 : 24 }}>{i >= attempt ? '❤️' : '🖤'}</div>)}
          </div>
        )}

        {feedback === 'correct' && (
          <div style={{ textAlign: 'center', color: C.green, fontSize: landscape ? 22 : 28, animation: 'pop 0.4s ease', marginBottom: 8 }}>✅ Correct!</div>
        )}
        {feedback === 'wrong' && (
          <div style={{ textAlign: 'center', color: C.red, fontSize: landscape ? 18 : 22, animation: 'shake 0.3s ease', marginBottom: 8 }}>❌ Try again!</div>
        )}
        {feedback === 'reveal' && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ color: C.red, fontSize: landscape ? 16 : 20 }}>❌ The word was:</div>
            <div style={{ color: C.yellow, fontSize: landscape ? 26 : 32, fontWeight: 900 }}>{currentWord?.w}</div>
          </div>
        )}
      </div>

      {/* Right panel in landscape: input + keyboard */}
      <div style={landscape ? { flex: 1, minWidth: 0 } : {}}>
        <div style={{ textAlign: 'center', fontSize: landscape ? 28 : 36, fontWeight: 800, letterSpacing: 6, marginBottom: landscape ? 8 : 12, minHeight: landscape ? 36 : 48, color: C.yellow }}>
          {(() => {
            const total = currentWord ? currentWord.w.length : 3;
            const remaining = Math.max(0, total - typed.length);
            const underlines = remaining > 0 ? ' ' + Array(remaining).fill('_').join(' ') : '';
            return <>{typed ? <span>{typed}</span> : null}<span style={{ color: 'rgba(255,255,255,0.2)' }}>{underlines}</span></>;
          })()}
        </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', marginBottom: 12, width: '100%' }}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'center' }}>
            {row.map(l => (
              <button key={l}
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: '#fff', flex: '1 1 0', maxWidth: 48, padding: '12px 4px', fontSize: 18, cursor: 'pointer', fontWeight: 600, minHeight: 44 }}
                onClick={() => !lockRef.current && setTyped(t => t + l)}>
                {l}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 12 }}>
        <button style={{ ...s.btn(C.red, 'lg'), flex: 1, minHeight: 48 }}
          onClick={() => !lockRef.current && setTyped(t => t.slice(0, -1))}>⌫ Delete</button>
        {allowSkip && (
          <button style={{ ...s.btn('rgba(255,255,255,0.15)', 'lg'), flex: 1, color: C.muted, minHeight: 48 }}
            onClick={doSkip}>⏭ Skip</button>
        )}
        <button style={{ ...s.btn(C.green, 'lg'), flex: 1, minHeight: 48 }} onClick={doSubmit}>✅ Submit</button>
      </div>

      {/* Quit button at bottom */}
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <span
          data-testid="quit-button"
          style={{ color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => {
            window.speechSynthesis.cancel();
            setShowQuitConfirm(true);
          }}
        >{onQuit ? 'Quit' : 'Quit Round'}</span>
      </div>
      </div>
    </div>
  );
};
