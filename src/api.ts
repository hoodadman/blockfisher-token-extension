import { loadAccountKey } from './account';
import { MarketError, identify as identifyOnMarket, marketData } from './market';
import type { Candidate, IdentifiedToken, Network } from './readers/types';

declare const __API_BASE__: string;

/** The Blockfisher scanner. Set BLOCKFISHER_API when building (see scripts/build.mjs). */
export const API_BASE = __API_BASE__;

/** Long enough for the scanner to wake from sleep (about a minute) and then scan. */
const TIMEOUT_MS = 120_000;

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
    /** experimental: a holder check that is still being tuned, labelled so it isn't read as a measured fact. */
    issues: Array<{ id: string; severity: 'critical' | 'warning' | 'minor'; title: string; summary: string; details?: string; experimental?: boolean }>;
    passed?: Array<{ id: string; label: string }>;
    notChecked: Array<{ id: string; label: string }>;
    /** Core checks that had data, out of those that apply to the chain. */
    coverage?: { checked: number; total: number };
  };
  /** Every security check, grouped as the scanner website shows them. Drawn in "View full scan". */
  securityGroups?: Array<{ id: string; label: string; status: 'issue' | 'pass' | 'unknown'; summary: string; severity?: 'critical' | 'warning' | 'minor'; experimental?: boolean }>;
  community?: {
    score: number | null;
    official?: { handle: string; followers: number; tweetsLookedAt: number; averageLikes: number; averageReplies: number };
    mentions?: { counted: number; ignoredBots: number; total?: number };
    telegram?: { members?: number; online?: number; quiet: boolean };
    discord?: { members?: number; online?: number; quiet: boolean };
  };
  foundation: {
    score: number | null;
    facts?: Array<{ id: string; label: string; status: 'good' | 'mid' | 'bad' | 'unknown'; summary: string }>;
    exchanges?: readonly string[];
    investors?: readonly string[];
  };
  brief: { security: string; community: string; foundation: string };
  failures: Array<{ source: string }>;
  /** When shared parts were fetched (ms). The scanner shares X and holder data between users for a while. */
  checked?: { community?: number; holders?: number };
  /** The plan the scan ran on. Free can't re-check. */
  plan?: 'free' | 'pro' | 'ultra';
  /** Plain-language notes about where this result came from. */
  notes?: string[];
}

export class ApiError extends Error {}

/** The account key, when the user added one, so scans run on their paid plan. */
async function authHeaders(): Promise<Record<string, string>> {
  const key = await loadAccountKey().catch(() => undefined);
  return key ? { authorization: `Bearer ${key}` } : {};
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(await authHeaders()) },
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

function marketMessage(error: MarketError): string {
  if (error.status === 429) return 'DexScreener is busy right now. Try again in a minute.';
  if (error.status === 0) return 'We couldn’t reach DexScreener. Check your connection and try again.';
  return 'The market data service did not respond. Try again in a minute.';
}

/** Asked from the user's browser: DexScreener and CoinGecko rate-limit our server. */
export async function identify(candidates: readonly Candidate[]): Promise<IdentifiedToken[]> {
  try {
    return await identifyOnMarket(candidates.slice(0, 5));
  } catch (error) {
    throw new ApiError(error instanceof MarketError ? marketMessage(error) : 'Something went wrong. Please try again in a minute.');
  }
}

/** Market data comes from the user's browser; the scanner scores it with its own checks. */
export async function scan(address: string, network?: Network, refresh = false): Promise<ScanReport> {
  const market = network ? await marketData(address, network) : {};
  // refresh: a re-check, which skips answers shared from other users' scans.
  const reply = await post<{ report: ScanReport }>('/api/scan', { address, network, ...market, ...(refresh ? { refresh } : {}) });
  return reply.report;
}

export interface AccountView {
  email: string;
  paying: boolean;
  plan: 'free' | 'pro' | 'ultra';
}

/** The account a key belongs to, or undefined when the scanner doesn't know it. */
export async function account(key: string): Promise<AccountView | undefined> {
  const response = await fetch(`${API_BASE}/api/account`, {
    headers: { accept: 'application/json', authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const reply = (await response.json().catch(() => ({}))) as { account?: AccountView };
  return response.ok ? reply.account : undefined;
}
