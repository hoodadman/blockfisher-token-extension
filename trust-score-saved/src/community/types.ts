export type ActivityBand = 'quiet' | 'warming' | 'active';

export interface OfficialPage {
  handle: string;
  name?: string;
  followers: number;
  tweetsLookedAt: number;
  averageLikes: number;
  averageReplies: number;
  averageReposts: number;
}

export interface MentionSummary {
  counted: number;
  ignoredBots: number;
  weightedReach: number;
}

export interface CommunityReport {
  /** 0–100, or null when we found no usable Twitter activity. */
  score: number | null;
  band: ActivityBand | null;
  official?: OfficialPage;
  mentions: MentionSummary;
}
