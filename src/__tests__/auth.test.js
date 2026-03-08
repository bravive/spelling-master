import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateKey } from '../shared.js';

const SECRET = 'test-secret';
const SALT_ROUNDS = 10;

// ── bcrypt helpers ────────────────────────────────────────────────────────────
describe('PIN hashing', () => {
  it('hashes a 6-digit PIN and verifies it correctly', async () => {
    const hash = await bcrypt.hash('123456', SALT_ROUNDS);
    expect(hash).not.toBe('123456');
    expect(hash.startsWith('$2')).toBe(true);
    await expect(bcrypt.compare('123456', hash)).resolves.toBe(true);
  });

  it('rejects a wrong PIN', async () => {
    const hash = await bcrypt.hash('123456', SALT_ROUNDS);
    await expect(bcrypt.compare('999999', hash)).resolves.toBe(false);
  });

  it('detects legacy plaintext PINs by absence of $2 prefix', () => {
    const legacyPin = '5678';
    expect(legacyPin.startsWith('$2')).toBe(false);
  });
});

// ── checkPin '00' prefix fallback logic ───────────────────────────────────────
// Mirrors the logic in src/store.js checkPin
const checkPin = async (user, pin) => {
  if (typeof user.pin === 'string' && user.pin.startsWith('$2')) {
    if (await bcrypt.compare(pin, user.pin)) return true;
    if (pin.startsWith('88') && pin.length === 6) {
      return bcrypt.compare(pin.slice(2), user.pin);
    }
    return false;
  }
  return user.pin === pin || (pin.startsWith('88') && pin.length === 6 && user.pin === pin.slice(2));
};

describe('checkPin — 88 prefix fallback for old 4-digit PINs', () => {
  it('matches a correct 6-digit bcrypt PIN directly', async () => {
    const hash = await bcrypt.hash('123456', SALT_ROUNDS);
    expect(await checkPin({ pin: hash }, '123456')).toBe(true);
  });

  it('rejects a wrong 6-digit bcrypt PIN with no fallback', async () => {
    const hash = await bcrypt.hash('123456', SALT_ROUNDS);
    expect(await checkPin({ pin: hash }, '999999')).toBe(false);
  });

  it('matches old 4-digit bcrypt PIN when entered with 88 prefix', async () => {
    const hash = await bcrypt.hash('1234', SALT_ROUNDS);
    expect(await checkPin({ pin: hash }, '881234')).toBe(true);
  });

  it('rejects 88-prefixed PIN when the 4-digit portion is wrong', async () => {
    const hash = await bcrypt.hash('1234', SALT_ROUNDS);
    expect(await checkPin({ pin: hash }, '889999')).toBe(false);
  });

  it('does not apply fallback when entered PIN does not start with 88', async () => {
    const hash = await bcrypt.hash('1234', SALT_ROUNDS);
    expect(await checkPin({ pin: hash }, '111234')).toBe(false);
  });

  it('matches legacy plain-text 4-digit PIN directly', async () => {
    expect(await checkPin({ pin: '1234' }, '1234')).toBe(true);
  });

  it('matches legacy plain-text 4-digit PIN via 88 prefix', async () => {
    expect(await checkPin({ pin: '1234' }, '881234')).toBe(true);
  });

  it('rejects legacy plain-text PIN with wrong 88-prefixed entry', async () => {
    expect(await checkPin({ pin: '1234' }, '889999')).toBe(false);
  });
});

// ── JWT helpers ───────────────────────────────────────────────────────────────
describe('JWT tokens', () => {
  it('issues a verifiable token for a regular user', () => {
    const token = jwt.sign({ userId: 'alice', isAdmin: false }, SECRET, { expiresIn: '8h' });
    const payload = jwt.verify(token, SECRET);
    expect(payload.userId).toBe('alice');
    expect(payload.isAdmin).toBe(false);
  });

  it('issues an admin token with isAdmin flag', () => {
    const token = jwt.sign({ userId: 'admin', isAdmin: true }, SECRET, { expiresIn: '8h' });
    const payload = jwt.verify(token, SECRET);
    expect(payload.isAdmin).toBe(true);
  });

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign({ userId: 'alice' }, 'wrong-secret');
    expect(() => jwt.verify(token, SECRET)).toThrow();
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign({ userId: 'alice' }, SECRET, { expiresIn: '0s' });
    // Give it a moment to expire
    await new Promise(r => setTimeout(r, 10));
    expect(() => jwt.verify(token, SECRET)).toThrow(/expired/i);
  });
});

// ── publicUser helper (strips PIN) ────────────────────────────────────────────
describe('publicUser', () => {
  const publicUser = ({ pin: _pin, ...rest }) => rest;

  it('strips the pin field', () => {
    const user = { name: 'Alice', pin: '$2b$10$abc', level: 1 };
    const pub = publicUser(user);
    expect(pub.pin).toBeUndefined();
    expect(pub.name).toBe('Alice');
    expect(pub.level).toBe(1);
  });

  it('does not mutate the original object', () => {
    const user = { name: 'Bob', pin: '1234', level: 2 };
    const pub = publicUser(user);
    expect(user.pin).toBe('1234'); // original untouched
    expect(pub.pin).toBeUndefined();
  });
});

// ── rememberMe token expiry ────────────────────────────────────────────────────
describe('rememberMe token expiry', () => {
  const makeToken = (rememberMe) => {
    const expiry = rememberMe ? '30d' : '8h';
    return jwt.sign({ userId: 'alice' }, SECRET, { expiresIn: expiry });
  };

  it('issues an 8h token when rememberMe is false', () => {
    const token = makeToken(false);
    const payload = jwt.verify(token, SECRET);
    const durationMs = (payload.exp - payload.iat) * 1000;
    expect(durationMs).toBe(8 * 60 * 60 * 1000);
  });

  it('issues a 30d token when rememberMe is true', () => {
    const token = makeToken(true);
    const payload = jwt.verify(token, SECRET);
    const durationMs = (payload.exp - payload.iat) * 1000;
    expect(durationMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('30d token expires significantly later than 8h token', () => {
    const shortToken = makeToken(false);
    const longToken = makeToken(true);
    const shortExp = jwt.decode(shortToken).exp;
    const longExp = jwt.decode(longToken).exp;
    expect(longExp).toBeGreaterThan(shortExp);
  });
});

// ── key validation (server-side rules mirrored) ───────────────────────────────
describe('user key validation', () => {
  const validKey = (k) => /^[a-z0-9_]+$/.test(k);

  it('accepts a simple lowercase key', () => {
    expect(validKey('alice')).toBe(true);
    expect(validKey('alice_smith')).toBe(true);
  });

  it('rejects keys with uppercase or special chars', () => {
    expect(validKey('Alice')).toBe(false);
    expect(validKey('alice-smith')).toBe(false);
    expect(validKey('alice smith')).toBe(false);
  });
});

// ── generateKey ───────────────────────────────────────────────────────────────
describe('generateKey', () => {
  it('lowercases the name', () => {
    expect(generateKey('Alice')).toBe('alice');
  });

  it('replaces spaces with underscores', () => {
    expect(generateKey('Mary Jane')).toBe('mary_jane');
    expect(generateKey('anne  marie')).toBe('anne_marie'); // multiple spaces
  });

  it('strips hyphens', () => {
    expect(generateKey('Mary-Jane')).toBe('maryjane');
  });

  it('strips apostrophes', () => {
    expect(generateKey("O'Brien")).toBe('obrien');
  });

  it('strips accented characters', () => {
    // é, ü, ñ are not in [a-z0-9_], they get stripped
    expect(generateKey('José')).toBe('jos');
  });

  it('preserves digits in the name', () => {
    expect(generateKey('Player1')).toBe('player1');
  });

  it('produces a key that passes server validation', () => {
    const validKey = (k) => /^[a-z0-9_]+$/.test(k);
    const names = ['Mary-Jane', "O'Brien", 'Anne Marie', 'José', 'Player1', 'Bob'];
    for (const name of names) {
      const key = generateKey(name);
      if (key) expect(validKey(key)).toBe(true);
    }
  });

  it('returns empty string for a name with no valid characters', () => {
    expect(generateKey('!!!---')).toBe('');
  });

  it('trims leading/trailing whitespace', () => {
    expect(generateKey('  alice  ')).toBe('alice');
  });
});
