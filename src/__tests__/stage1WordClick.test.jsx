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

    fireEvent.click(readyBtn);
    expect(setGameScreen).not.toHaveBeenCalledWith('stage2');
  });

  it('shows a floating card when a word is clicked', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    const floatingWords = screen.getAllByText('cat');
    expect(floatingWords.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks overlay dismiss during countdown for unread words', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Click the overlay — should NOT dismiss during countdown
    fireEvent.click(screen.getByTestId('floating-overlay'));

    // Floating card should still be visible
    expect(screen.getByTestId('floating-overlay')).toBeTruthy();
    // Word should NOT be marked as read yet
    expect(screen.getByTestId('ready-button').textContent).toContain('0/3');
  });

  it('keeps card open after countdown finishes, marks word as read', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Advance 3 seconds — countdown finishes
    act(() => { vi.advanceTimersByTime(3000); });

    // Card should STILL be open
    expect(screen.getByTestId('floating-overlay')).toBeTruthy();
    // But word is now marked as read
    expect(screen.getByTestId('ready-button').textContent).toContain('1/3');
    // Should show "Tap outside to close"
    expect(screen.getByText('Tap outside to close')).toBeTruthy();
  });

  it('dismisses card when clicking outside after countdown finishes', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Wait for countdown
    act(() => { vi.advanceTimersByTime(3000); });

    // Now click outside to dismiss
    fireEvent.click(screen.getByTestId('floating-overlay'));

    // Card should be gone
    expect(screen.queryByTestId('floating-overlay')).toBeNull();
    // Word still marked as read
    expect(screen.getByTestId('ready-button').textContent).toContain('1/3');
  });

  it('clicking outside never marks a word as read (only countdown does)', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click unread word
    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Try clicking outside during countdown — blocked
    fireEvent.click(screen.getByTestId('floating-overlay'));

    // Word not read
    expect(screen.getByTestId('ready-button').textContent).toContain('0/3');
  });

  it('already-read words show card without countdown, dismissable immediately', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Read the word via countdown
    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));
    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByTestId('floating-overlay')); // dismiss

    // Click the same word again
    const wordCards2 = screen.getAllByText('cat');
    fireEvent.click(wordCards2[0].closest('.word-card'));

    // Should show "Tap outside to close" immediately (no countdown)
    expect(screen.getByText('Tap outside to close')).toBeTruthy();

    // Click outside — dismisses immediately
    fireEvent.click(screen.getByTestId('floating-overlay'));
    expect(screen.queryByTestId('floating-overlay')).toBeNull();
  });

  it('enables the ready button after all words are read via countdown', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click each word, wait for countdown, then dismiss
    mockWords.forEach((word) => {
      const els = screen.getAllByText(word.w);
      fireEvent.click(els[0].closest('.word-card'));
      act(() => { vi.advanceTimersByTime(3000); });
      fireEvent.click(screen.getByTestId('floating-overlay'));
    });

    const readyBtn = screen.getByTestId('ready-button');
    expect(readyBtn.disabled).toBe(false);
    expect(readyBtn.textContent).toContain("I'm Ready!");

    fireEvent.click(readyBtn);
    expect(setGameScreen).toHaveBeenCalledWith('stage2');
  });

  it('marks read words with a yellow border', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    const els = screen.getAllByText('cat');
    fireEvent.click(els[0].closest('.word-card'));
    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByTestId('floating-overlay'));

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

    fireEvent.click(readyBtn);
    expect(setGameScreen).toHaveBeenCalledWith('stage2');
  });

  it('does not show progress counter when requireClickAll is false', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} requireClickAll={false} />);

    expect(screen.queryByText(/Tap each word/)).toBeNull();
  });
});
