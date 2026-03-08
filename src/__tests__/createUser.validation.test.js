import { describe, it, expect } from 'vitest';
import { generateKey } from '../shared';

// Mirrors the name validation logic in CreateUserScreen step 1
function validateName(rawName, existingUsers = {}) {
  const trimmed = rawName.trim();
  if (!trimmed) return 'Please enter a name.';
  if (trimmed.length < 4) return 'Name must be at least 4 characters.';
  if (trimmed.toLowerCase() === 'test') return 'That name is reserved.';
  const key = generateKey(trimmed);
  if (!key) return 'Name must contain at least one letter or number.';
  if (Object.values(existingUsers).some(u => u.userId === key)) return 'Name already taken.';
  return null;
}

// Mirrors the noAllSame validation in NumPad
function validatePin(pin) {
  if (pin.split('').every(d => d === pin[0])) return "PIN can't be all the same digit";
  return null;
}

describe('PIN all-same-digit validation', () => {
  it('rejects all-same PINs', () => {
    expect(validatePin('0000')).toBeTruthy();
    expect(validatePin('1111')).toBeTruthy();
    expect(validatePin('5555')).toBeTruthy();
    expect(validatePin('9999')).toBeTruthy();
  });

  it('accepts PINs with varied digits', () => {
    expect(validatePin('1234')).toBeNull();
    expect(validatePin('1122')).toBeNull();
    expect(validatePin('1110')).toBeNull();
    expect(validatePin('0001')).toBeNull();
  });
});

describe('createUser name validation', () => {
  it('rejects empty name', () => {
    expect(validateName('')).toBe('Please enter a name.');
    expect(validateName('   ')).toBe('Please enter a name.');
  });

  it('rejects names shorter than 4 characters', () => {
    expect(validateName('ab')).toBe('Name must be at least 4 characters.');
    expect(validateName('abc')).toBe('Name must be at least 4 characters.');
  });

  it('accepts names with exactly 4 characters', () => {
    expect(validateName('abcd')).toBeNull();
  });

  it('accepts names longer than 4 characters', () => {
    expect(validateName('Alice')).toBeNull();
  });

  it('rejects the reserved name "test"', () => {
    expect(validateName('test')).toBe('That name is reserved.');
    expect(validateName('TEST')).toBe('That name is reserved.');
  });

  it('rejects duplicate names', () => {
    const users = { u1: { userId: 'alice' } };
    expect(validateName('Alice', users)).toBe('Name already taken.');
  });

  it('allows a unique name', () => {
    const users = { u1: { userId: 'alice' } };
    expect(validateName('Bobby', users)).toBeNull();
  });
});
