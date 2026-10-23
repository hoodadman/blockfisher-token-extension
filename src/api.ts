import type { Candidate, IdentifiedToken, Network } from './readers/types';

declare const __API_BASE__: string;

/** The Blockfisher scanner. Set BLOCKFISHER_API when building (see scripts/build.mjs). */
export const API_BASE = __API_BASE__;

const TIMEOUT_MS = 60_000;

/** The parts of the scanner's ScanReport the card shows. */
export interface ScanReport {
  address: string;
  chain: { name: string; network: Network };
  name?: string;
  symbol?: string;
  overall: number | null;
  security: {
    score: number | null;
    band: 'low' | 'medium' | 'high' | null;
    issues: Array<{ id: string; severity: 'critical' | 'warning' | 'minor'; title: string; summary: string }>;
    notChecked: Array<{ id: string; label: string }>;
  };
  community?: { score: number | null };
  foundation: { score: number | null };
  brief: { security: string; community: string; foundation: string };
  failures: Array<{ source: string }>;
}

export class ApiError extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError('We couldn’t reach Blockfisher. Check your connection and try again.');
  }
  const reply = (await response.json().catch(() => ({}))) as { ok?: boolean; text?: string } & T;
  if (!response.ok || reply.ok === false) {
    throw new ApiError(reply.text ?? 'Something went wrong. Please try again in a minute.');
  }
  return reply;
}

export async function identify(candidates: readonly Candidate[]): Promise<IdentifiedToken[]> {
  const reply = await post<{ tokens: IdentifiedToken[] }>('/api/identify', { candidates: candidates.slice(0, 5) });
  return reply.tokens;
}

export async function scan(address: string, network?: Network): Promise<ScanReport> {
  const reply = await post<{ report: ScanReport }>('/api/scan', { address, network });
  return reply.report;
}
