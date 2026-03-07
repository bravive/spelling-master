import { describe, it, expect } from 'vitest';
import { resolveInitialWeek } from '../components/WeeklyChallengeScreen';

const week = (id, startDate) => ({ id, startDate, words: [] });

const PAST   = week('w1', '2026-02-01');
const RECENT = week('w2', '2026-03-01');
const FUTURE = week('w3', '2099-01-01');

const available = [PAST, RECENT];
const all       = [PAST, RECENT, FUTURE];

describe('resolveInitialWeek', () => {
  it('defaults to the latest available week when no initialSelectedId', () => {
    expect(resolveInitialWeek(all, available, null)).toBe('w2');
  });

  it('returns null when no weeks are available and no initialSelectedId', () => {
    expect(resolveInitialWeek([FUTURE], [], null)).toBeNull();
  });

  it('uses initialSelectedId when it matches an available week', () => {
    expect(resolveInitialWeek(all, available, 'w1')).toBe('w1');
  });

  it('uses initialSelectedId even when the week is locked (future)', () => {
    // Edge case: user somehow has an activeWeekId pointing to a future week — still honour it
    expect(resolveInitialWeek(all, available, 'w3')).toBe('w3');
  });

  it('falls back to latest available when initialSelectedId does not exist in the list', () => {
    expect(resolveInitialWeek(all, available, 'w-nonexistent')).toBe('w2');
  });

  it('falls back to null when initialSelectedId is unknown and no available weeks exist', () => {
    expect(resolveInitialWeek([FUTURE], [], 'w-nonexistent')).toBeNull();
  });
});
