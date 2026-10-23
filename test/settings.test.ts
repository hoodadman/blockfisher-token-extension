import { describe, expect, it } from 'vitest';
import { autoStep, badgeFor } from '../src/flow';
import { DEFAULT_SWITCHES, readModes, readSwitches } from '../src/settings';
import type { CardState } from '../src/ui/card';
import type { ScanReport } from '../src/api';

const ask: CardState = { kind: 'ask', tokens: [{ input: 'a', status: 'token', address: 'a' }, { input: 'b', status: 'token', address: 'b' }], notes: [], offerRemember: false };

describe('switches', () => {
  it('starts with everything on and keeps only real booleans', () => {
    expect(readSwitches(undefined)).toEqual(DEFAULT_SWITCHES);
    expect(readSwitches({ autoPopup: false, confirmToken: 'no' })).toEqual({ autoScan: true, autoPopup: false, confirmToken: true });
  });

  it('treats the old "ask" and "auto" site choices as on', () => {
    expect(readModes({ 'dexscreener.com': 'ask', 'jup.ag': 'auto', 'gmgn.ai': 'off' })).toEqual({
      'dexscreener.com': 'on',
      'jup.ag': 'on',
      'gmgn.ai': 'off',
    });
  });
});

describe('autoStep', () => {
  it('scans straight away only when confirm is off', () => {
    expect(autoStep(ask, { autoPopup: true, confirmToken: true })).toBe('show');
    expect(autoStep(ask, { autoPopup: true, confirmToken: false })).toBe('scan');
    expect(autoStep(ask, { autoPopup: false, confirmToken: false })).toBe('scan');
  });

  it('uses the badge instead of the card when pop ups are off', () => {
    expect(autoStep(ask, { autoPopup: false, confirmToken: true })).toBe('badge');
    expect(autoStep({ kind: 'message', text: 'x' }, { autoPopup: false, confirmToken: false })).toBe('badge');
  });
});

describe('badgeFor', () => {
  it('shows the token count, then the score in its colour', () => {
    expect(badgeFor(null).text).toBe('');
    expect(badgeFor(ask).text).toBe('2');
    const report = { overall: 25 } as ScanReport;
    expect(badgeFor({ kind: 'results', results: [{ token: ask.tokens[0], report }] })).toEqual({ text: '25', color: '#c0262d' });
    expect(badgeFor({ kind: 'results', results: [{ token: ask.tokens[0], error: 'x' }] }).text).toBe('!');
  });
});
