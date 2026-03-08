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

  it('marks word as read when floating card overlay is clicked to dismiss', () => {
    const setGameScreen = vi.fn();
    const { container } = render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click the first word
    const wordCards = screen.getAllByText('cat');
    fireEvent.click(wordCards[0].closest('.word-card'));

    // Click the overlay to dismiss
    const overlay = container.querySelector('[style*="position: fixed"]');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);

    // Word should now be marked as read
    expect(screen.getByTestId('ready-button').textContent).toContain('1/3');
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

  it('shows a green checkmark on read words', () => {
    const setGameScreen = vi.fn();
    render(<Stage1Screen words={mockWords} retryCount={0} setGameScreen={setGameScreen} />);

    // Click first word and wait for auto-close
    const els = screen.getAllByText('cat');
    fireEvent.click(els[0].closest('.word-card'));
    act(() => { vi.advanceTimersByTime(3000); });

    // Check mark should appear
    expect(screen.getByText('✓')).toBeTruthy();
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
