import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ResultsScreen } from '../components/ResultsScreen';

afterEach(() => { cleanup(); });

const baseProps = {
  getUser: () => ({ level: 1, roundCount: 5 }),
  wordStats: {},
  setWords: vi.fn(),
  setRetryCount: vi.fn(),
  setGameScreen: vi.fn(),
};

describe('ResultsScreen 3-section layout', () => {
  it('shows correct, wrong, and skipped sections', () => {
    const roundResults = {
      score: 2,
      earned: 0,
      pass: false,
      shouldRetry: true,
      results: [
        { word: 'cat', correct: true, attemptNumber: 1 },
        { word: 'dog', correct: true, attemptNumber: 2 },
        { word: 'hat', correct: false, attemptNumber: 3 },
        { word: 'run', correct: false, attemptNumber: 0, skipped: true },
        { word: 'big', correct: false, attemptNumber: 0, skipped: true },
      ],
      words: [],
    };

    render(<ResultsScreen roundResults={roundResults} {...baseProps} />);

    // Correct section
    expect(screen.getByText('✅ Correct (2)')).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('dog')).toBeTruthy();

    // Wrong section
    expect(screen.getByText('❌ Wrong (1)')).toBeTruthy();
    expect(screen.getByText('hat')).toBeTruthy();

    // Skipped section
    expect(screen.getByText('⏭ Skipped (2)')).toBeTruthy();
    expect(screen.getByText('run')).toBeTruthy();
    expect(screen.getByText('big')).toBeTruthy();
  });

  it('shows "Round ended early" for quit rounds', () => {
    const roundResults = {
      score: 1,
      earned: 0,
      pass: false,
      shouldRetry: true,
      wasQuit: true,
      results: [
        { word: 'cat', correct: true, attemptNumber: 1 },
        { word: 'dog', correct: false, attemptNumber: 0, skipped: true },
      ],
      words: [],
    };

    render(<ResultsScreen roundResults={roundResults} {...baseProps} />);
    expect(screen.getByText('Round ended early')).toBeTruthy();
  });

  it('hides sections with zero items', () => {
    const roundResults = {
      score: 3,
      earned: 2,
      pass: true,
      results: [
        { word: 'cat', correct: true, attemptNumber: 1 },
        { word: 'dog', correct: true, attemptNumber: 1 },
        { word: 'hat', correct: true, attemptNumber: 1 },
      ],
      words: [],
    };

    render(<ResultsScreen roundResults={roundResults} {...baseProps} />);

    // Only correct section should be visible
    expect(screen.getByText('✅ Correct (3)')).toBeTruthy();
    expect(screen.queryByText(/Wrong/)).toBeNull();
    expect(screen.queryByText(/Skipped/)).toBeNull();
  });

  it('shows credits earned', () => {
    const roundResults = {
      score: 10,
      earned: 5,
      pass: true,
      results: Array(10).fill(null).map((_, i) => ({ word: `w${i}`, correct: true, attemptNumber: 1 })),
      words: [],
    };

    render(<ResultsScreen roundResults={roundResults} {...baseProps} />);
    expect(screen.getByText('+5 credits')).toBeTruthy();
  });
});
