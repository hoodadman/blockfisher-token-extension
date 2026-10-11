import { describe, expect, it } from 'vitest';
import { localBrief } from './local';
import type { SummaryFacts } from './types';

const facts: SummaryFacts = {
  name: 'Pepe',
  overall: 83,
  security: {
    score: 75,
    groups: [{ label: 'Trading pot', status: 'issue', summary: 'The trading pot is not locked.' }],
  },
  community: { score: 98, handle: 'pepecoineth', followers: 745_000, replies: 223, otherPosts: 40 },
  foundation: {
    score: 77,
    facts: [{ label: 'How old it is', summary: 'It has been trading for 42 months.', status: 'good' }],
  },
};

describe('localBrief', () => {
  it('writes one plain sentence block per pillar', () => {
    const brief = localBrief(facts);
    expect(brief.security).toMatch(/trading pot/i);
    expect(brief.community).toMatch(/pepecoineth/);
    expect(brief.foundation).toMatch(/Pepe/);
    expect(Object.keys(brief)).toEqual(['security', 'community', 'foundation']);
  });
});
