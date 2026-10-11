import type { PillarBrief, SummaryFacts } from './types';
import { localBrief } from './local';

export async function fetchBrief(facts: SummaryFacts, signal?: AbortSignal): Promise<PillarBrief> {
  const fallback = localBrief(facts);
  try {
    const response = await fetch('/api/summarise', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(facts),
      signal,
    });
    if (!response.ok) return fallback;
    const body = (await response.json()) as Partial<PillarBrief>;
    if (!body.security || !body.community || !body.foundation) return fallback;
    return { security: body.security, community: body.community, foundation: body.foundation };
  } catch {
    return fallback;
  }
}
