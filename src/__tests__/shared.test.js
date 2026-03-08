import { describe, it, expect } from 'vitest';
import { pkCount, isPkCaught } from '../shared';

describe('pkCount', () => {
  it('returns count when set', () => {
    expect(pkCount({ count: 3 })).toBe(3);
  });

  it('returns 0 when count is explicitly 0', () => {
    expect(pkCount({ count: 0 })).toBe(0);
    expect(pkCount({ count: 0, regular: true })).toBe(0);
  });

  it('falls back to regular for legacy format', () => {
    expect(pkCount({ regular: true })).toBe(1);
    expect(pkCount({ regular: false })).toBe(0);
  });

  it('returns 0 for undefined/null/empty', () => {
    expect(pkCount(undefined)).toBe(0);
    expect(pkCount(null)).toBe(0);
    expect(pkCount({})).toBe(0);
  });
});

describe('isPkCaught', () => {
  it('returns true when count >= 1', () => {
    expect(isPkCaught({ count: 1 })).toBe(true);
  });

  it('returns false when count is 0', () => {
    expect(isPkCaught({ count: 0 })).toBe(false);
    expect(isPkCaught({ count: 0, regular: true })).toBe(false);
  });

  it('returns false for uncaught', () => {
    expect(isPkCaught(undefined)).toBe(false);
    expect(isPkCaught({})).toBe(false);
  });
});
