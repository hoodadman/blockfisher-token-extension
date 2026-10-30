import { describe, expect, it } from 'vitest';
import { isAccountKey } from '../src/account';

describe('isAccountKey', () => {
  it('accepts the keys the scanner hands out and nothing else', () => {
    expect(isAccountKey('bf_abcdefghijklmnopqrstuvwxyz012345')).toBe(true);
    expect(isAccountKey('bf_short')).toBe(false);
    expect(isAccountKey('xx_abcdefghijklmnopqrstuvwxyz0123')).toBe(false);
    expect(isAccountKey('bf_abc def ghi jkl mno pqr stu')).toBe(false);
  });
});
