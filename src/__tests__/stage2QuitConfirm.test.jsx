import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Stage2Screen } from '../components/Stage2Screen';

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

describe('Stage2Screen quit confirmation', () => {
  it('shows quit button at bottom instead of top', () => {
    const setGameScreen = vi.fn();
    render(<Stage2Screen words={mockWords} processRound={vi.fn()} setRoundResults={vi.fn()} setGameScreen={setGameScreen} />);

    const quitBtn = screen.getByTestId('quit-button');
    expect(quitBtn).toBeTruthy();
    expect(quitBtn.textContent).toBe('Quit Round');
  });

  it('shows confirmation dialog when quit is clicked', () => {
    const setGameScreen = vi.fn();
    render(<Stage2Screen words={mockWords} processRound={vi.fn()} setRoundResults={vi.fn()} setGameScreen={setGameScreen} />);

    fireEvent.click(screen.getByTestId('quit-button'));

    const confirmDialog = screen.getByTestId('quit-confirm');
    expect(confirmDialog).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
    expect(screen.getByText('Keep Going')).toBeTruthy();
    // "Quit Round" appears as both the confirm button and the bottom link
    expect(screen.getAllByText('Quit Round').length).toBeGreaterThanOrEqual(2);
  });

  it('dismisses confirmation when "Keep Going" is clicked', () => {
    const setGameScreen = vi.fn();
    render(<Stage2Screen words={mockWords} processRound={vi.fn()} setRoundResults={vi.fn()} setGameScreen={setGameScreen} />);

    fireEvent.click(screen.getByTestId('quit-button'));
    expect(screen.getByTestId('quit-confirm')).toBeTruthy();

    fireEvent.click(screen.getByText('Keep Going'));
    expect(screen.queryByTestId('quit-confirm')).toBeNull();
  });

  it('navigates to results with skipped words when confirmed', () => {
    const setGameScreen = vi.fn();
    const setRoundResults = vi.fn();
    const processRound = vi.fn().mockReturnValue({ earned: 0, pass: false, shouldRetry: true });

    render(<Stage2Screen words={mockWords} processRound={processRound} setRoundResults={setRoundResults} setGameScreen={setGameScreen} />);

    // Quit immediately (all words become skipped)
    fireEvent.click(screen.getByTestId('quit-button'));
    // Click the confirm button inside the dialog (not the bottom link)
    const confirmDialog = screen.getByTestId('quit-confirm');
    fireEvent.click(confirmDialog.querySelector('button:last-child'));

    expect(processRound).toHaveBeenCalledWith(0, expect.any(Array));
    const results = setRoundResults.mock.calls[0][0];
    expect(results.wasQuit).toBe(true);
    expect(results.results.length).toBe(3);
    expect(results.results.every(r => r.skipped)).toBe(true);
    expect(setGameScreen).toHaveBeenCalledWith('results');
  });

  it('blocks keyboard input while confirm dialog is shown', () => {
    const setGameScreen = vi.fn();
    render(<Stage2Screen words={mockWords} processRound={vi.fn()} setRoundResults={vi.fn()} setGameScreen={setGameScreen} />);

    fireEvent.click(screen.getByTestId('quit-button'));

    // Try typing while confirm is shown — should not affect typed state
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Enter' });

    // processRound should not have been called from keyboard
    expect(setGameScreen).not.toHaveBeenCalledWith('results');
  });
});
