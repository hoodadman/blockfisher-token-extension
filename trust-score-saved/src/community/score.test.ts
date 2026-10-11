import { describe, expect, it } from 'vitest';
import { MIN_FOLLOWERS, mentionWeight, scoreCommunity } from './score';

describe('scoreCommunity', () => {
  it('scores a busy official page more for replies than for likes', () => {
    const quietLikes = scoreCommunity({
      official: { handle: 'token', followers: 10_000, tweets: [{ likes: 80, replies: 0, reposts: 0 }] },
    });
    const talkative = scoreCommunity({
      official: { handle: 'token', followers: 10_000, tweets: [{ likes: 8, replies: 40, reposts: 0 }] },
    });
    expect(talkative.score ?? 0).toBeGreaterThan(quietLikes.score ?? 0);
    expect(talkative.official?.averageReplies).toBe(40);
  });

  it('ignores accounts with fewer than 10 followers', () => {
    const empty = scoreCommunity({
      official: { handle: 'token', followers: 8, tweets: [] },
      mentions: [{ followers: MIN_FOLLOWERS - 1, likes: 50, replies: 20, reposts: 10 }],
    });
    expect(empty.mentions).toEqual({ counted: 0, ignoredBots: 1, weightedReach: 0 });
    expect(empty.score).toBe(0);
  });

  it('gives larger accounts more weight than small ones', () => {
    const small = mentionWeight({ followers: 20, likes: 0, replies: 0, reposts: 0 });
    const large = mentionWeight({ followers: 20_000, likes: 0, replies: 0, reposts: 0 });
    expect(large).toBeGreaterThan(small * 2);
  });

  it('caps mentions-only results when there is no official page', () => {
    const mentions = Array.from({ length: 20 }, () => ({ followers: 50_000, likes: 30, replies: 10, reposts: 5 }));
    const report = scoreCommunity({ mentions });
    expect(report.official).toBeUndefined();
    expect(report.score).toBeLessThanOrEqual(40);
    expect(report.mentions.counted).toBe(20);
  });

  it('returns no score when nothing was found', () => {
    expect(scoreCommunity({})).toMatchObject({ score: null, band: null, mentions: { counted: 0, ignoredBots: 0 } });
  });
});
