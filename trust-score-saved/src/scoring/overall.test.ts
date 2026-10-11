import { describe, expect, it } from 'vitest';
import { averageScore, toneFor } from './overall';

describe('averageScore', () => {
  it('averages the pillars we have and ignores missing ones', () => {
    expect(averageScore([75, 98, 40])).toBe(71);
    expect(averageScore([75, null, 40])).toBe(58);
    expect(averageScore([null, undefined])).toBeNull();
  });
});

describe('toneFor', () => {
  it('colours each score on its own 0–29 / 30–59 / 60–89 / 90–100 scale', () => {
    expect(toneFor(90)).toBe('green');
    expect(toneFor(89)).toBe('yellow');
    expect(toneFor(60)).toBe('yellow');
    expect(toneFor(59)).toBe('orange');
    expect(toneFor(30)).toBe('orange');
    expect(toneFor(29)).toBe('red');
    expect(toneFor(null)).toBe('none');
  });
});
