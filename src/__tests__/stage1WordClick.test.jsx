import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Stage1Screen } from '../components/Stage1Screen';

const mockWords = [
  { w: 'cat', s: 'The cat sat on the mat.' },
  { w: 'dog', s: 'The dog ran fast.' },
  { w: 'hat', s: 'She wore a red hat.' },
];

beforeEach(() => {
  window.speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
  window.SpeechSynthesisUtterance = class { constructor() { this.rate = 0; this.pitch = 0; this.onend = null; } };
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Stage1Screen word-click validation', () => {
  it('disables the ready button until all words are clicked', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    const readyBtn = screen.getByTestId('ready-button');
    expect(readyBtn.disabled).toBe(true);
    expect(readyBtn.textContent).toContain('Read all words first');

    // Click the button while disabled — should NOT navigate
    fireEvent.click(readyBtn);
    expect(setGameScreen).not.toHaveBeenCalledWith('stage2');
  });

  it('shows a floating card when a word is clicked', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click the first word
    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Floating card should appear with the word in large text
    const floatingWords = screen.getAllByText('cat');
    // There should be more than just the grid card — the floating card adds another
    expect(floatingWords.length).toBeGreaterThanOrEqual(2);
  });

  it('marks a word as read after floating card auto-closes (3 seconds)', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click the first word
    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Advance 3 seconds to auto-close
    act(() => { vi.advanceTimersByTime(3000); });

    // Progress should update
    expect(screen.getByTestId('ready-button').textContent).toContain('1/3');
  });

  it('auto-closes floating card after countdown and returns to word list', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Floating card visible during countdown
    expect(screen.getByTestId('floating-overlay')).toBeTruthy();

    // After 3s, card should auto-close
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByTestId('floating-overlay')).toBeNull();

    // Word is now marked as read — need to click again to see it
    expect(screen.getByTestId('ready-button').textContent).toContain('1/3');
  });

  it('blocks overlay dismiss during countdown for unread words', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click the first word (unread)
    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Click the overlay — should NOT dismiss during countdown
    const overlay = screen.getByTestId('floating-overlay');
    fireEvent.click(overlay);

    // Floating card should still be visible
    expect(screen.getByTestId('floating-overlay')).toBeTruthy();

    // Word should NOT be marked as read yet
    expect(screen.getByTestId('ready-button').textContent).toContain('0/3');
  });

  it('clicking outside does NOT mark word as read (dismisses without selecting)', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // First: read the word via countdown
    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));
    act(() => { vi.advanceTimersByTime(3000); });

    // Now click the same word again (already read — no countdown)
    const wordCards2 = screen.getAllByText('cat');
    fireEvent.click(wordCards2[0].closest('.word-card'));

    // Floating card should be visible
    expect(screen.getByTestId('floating-overlay')).toBeTruthy();

    // Click overlay to dismiss
    fireEvent.click(screen.getByTestId('floating-overlay'));

    // Floating card should be gone
    expect(screen.queryByTestId('floating-overlay')).toBeNull();

    // Word should still be marked as read (was already read)
    expect(screen.getByTestId('ready-button').textContent).toContain('1/3');
  });

  it('already-read words show card without countdown', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Read the word via countdown
    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));
    act(() => { vi.advanceTimersByTime(3000); });

    // Click the same word again
    const wordCards2 = screen.getAllByText('cat');
    fireEvent.click(wordCards2[0].closest('.word-card'));

    // Floating card should show "Tap outside to close" hint (no countdown bar)
    expect(screen.getByText('Tap outside to close')).toBeTruthy();
  });

  it('enables the ready button after all words are clicked and read', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click each word and wait for floating card to close
    mockWords.forEach((word) => {
      const els = screen.getAllByText(word.w);
      fireEvent.click(els[0].closest('.word-card'));
      act(() => { vi.advanceTimersByTime(3000); });
    });

    const readyBtn = screen.getByTestId('ready-button');
    expect(readyBtn.disabled).toBe(false);
    expect(readyBtn.textContent).toContain("I'm Ready!");

    // Click should navigate
    fireEvent.click(readyBtn);
    expect(setGameScreen).toHaveBeenCalledWith('stage2');
  });

  it('marks read words with a yellow border', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click first word and wait for auto-close
    const els = screen.getAllByText('cat');
    const card = els[0].closest('.word-card');
    fireEvent.click(card);
    act(() => { vi.advanceTimersByTime(3000); });

    // Card should have yellow border, no green checkmark
    const readCard = screen.getAllByText('cat')[0].closest('.word-card');
    expect(readCard.style.border).toContain('rgb(251, 191, 36)');
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('does not require clicking all words when requireClickAll is false (weekly mode)', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} requireClickAll={false} />);

    const readyBtn = screen.getByTestId('ready-button');
    expect(readyBtn.disabled).toBe(false);
    expect(readyBtn.textContent).toContain("I'm Ready!");

    // Should be able to navigate immediately
    fireEvent.click(readyBtn);
    expect(setGameScreen).toHaveBeenCalledWith('stage2');
  });

  it('does not show progress counter when requireClickAll is false', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} requireClickAll={false} />);

    // Should not show "Tap each word to study it" counter
    expect(screen.queryByText(/Tap each word/)).toBeNull();
  });
});
