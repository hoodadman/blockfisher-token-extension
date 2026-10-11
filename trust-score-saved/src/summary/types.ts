export interface PillarBrief {
  security: string;
  community: string;
  foundation: string;
}

export interface SummaryFacts {
  name?: string;
  overall: number | null;
  security: {
    score: number | null;
    groups: Array<{ label: string; status: 'issue' | 'pass' | 'unknown'; summary: string }>;
  };
  community: {
    score: number | null;
    handle?: string;
    followers?: number;
    replies?: number;
    otherPosts?: number;
  };
  foundation: {
    score: number | null;
    facts: Array<{ label: string; summary: string; status: string }>;
  };
}
