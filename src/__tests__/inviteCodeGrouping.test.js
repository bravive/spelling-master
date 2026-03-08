import { describe, it, expect } from 'vitest';

/**
 * Tests for invite code grouping logic used in the admin Invite Codes tab.
 * The tab separates codes into Admin vs User groups, sorted by availability.
 */

// Replicate the grouping/sorting logic from ParentMenuScreen
function groupInviteCodes(inviteCodes) {
  const adminCodes = inviteCodes
    .filter(c => c.createdBy === 'admin')
    .sort((a, b) => (a.usedBy ? 1 : 0) - (b.usedBy ? 1 : 0));
  const userCodes = inviteCodes
    .filter(c => c.createdBy !== 'admin')
    .sort((a, b) => (a.usedBy ? 1 : 0) - (b.usedBy ? 1 : 0));
  return { adminCodes, userCodes };
}

const mkCode = (id, createdBy, usedBy = null) => ({
  _id: id,
  code: id.toUpperCase(),
  createdBy,
  createdByName: createdBy === 'admin' ? 'Admin' : 'User',
  usedBy,
  usedByName: usedBy ? 'Someone' : null,
  created_at: '2026-01-01T00:00:00Z',
});

describe('Invite code grouping', () => {
  it('separates admin and user codes', () => {
    const codes = [
      mkCode('a1', 'admin'),
      mkCode('u1', 'user-uuid-1'),
      mkCode('a2', 'admin'),
      mkCode('u2', 'user-uuid-2'),
    ];
    const { adminCodes, userCodes } = groupInviteCodes(codes);
    expect(adminCodes).toHaveLength(2);
    expect(userCodes).toHaveLength(2);
    expect(adminCodes.every(c => c.createdBy === 'admin')).toBe(true);
    expect(userCodes.every(c => c.createdBy !== 'admin')).toBe(true);
  });

  it('sorts available codes before used codes in each group', () => {
    const codes = [
      mkCode('a1', 'admin', 'someone'),  // used
      mkCode('a2', 'admin'),              // available
      mkCode('a3', 'admin', 'someone'),  // used
      mkCode('a4', 'admin'),              // available
    ];
    const { adminCodes } = groupInviteCodes(codes);
    // Available (usedBy=null) should come first
    expect(adminCodes[0].usedBy).toBeNull();
    expect(adminCodes[1].usedBy).toBeNull();
    expect(adminCodes[2].usedBy).not.toBeNull();
    expect(adminCodes[3].usedBy).not.toBeNull();
  });

  it('sorts user codes by availability too', () => {
    const codes = [
      mkCode('u1', 'user-1', 'someone'),
      mkCode('u2', 'user-1'),
      mkCode('u3', 'user-2', 'someone'),
    ];
    const { userCodes } = groupInviteCodes(codes);
    expect(userCodes[0].usedBy).toBeNull();
    expect(userCodes[1].usedBy).not.toBeNull();
    expect(userCodes[2].usedBy).not.toBeNull();
  });

  it('handles empty input', () => {
    const { adminCodes, userCodes } = groupInviteCodes([]);
    expect(adminCodes).toHaveLength(0);
    expect(userCodes).toHaveLength(0);
  });

  it('handles all admin codes', () => {
    const codes = [mkCode('a1', 'admin'), mkCode('a2', 'admin')];
    const { adminCodes, userCodes } = groupInviteCodes(codes);
    expect(adminCodes).toHaveLength(2);
    expect(userCodes).toHaveLength(0);
  });

  it('handles all user codes', () => {
    const codes = [mkCode('u1', 'user-1'), mkCode('u2', 'user-2')];
    const { adminCodes, userCodes } = groupInviteCodes(codes);
    expect(adminCodes).toHaveLength(0);
    expect(userCodes).toHaveLength(2);
  });

  it('counts available correctly per group', () => {
    const codes = [
      mkCode('a1', 'admin'),
      mkCode('a2', 'admin', 'x'),
      mkCode('a3', 'admin'),
      mkCode('u1', 'user-1'),
      mkCode('u2', 'user-1', 'x'),
    ];
    const { adminCodes, userCodes } = groupInviteCodes(codes);
    const adminAvailable = adminCodes.filter(c => !c.usedBy).length;
    const userAvailable = userCodes.filter(c => !c.usedBy).length;
    expect(adminAvailable).toBe(2);
    expect(adminCodes.length).toBe(3);
    expect(userAvailable).toBe(1);
    expect(userCodes.length).toBe(2);
  });
});
