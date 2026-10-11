import {
  buildSignals,
  exchangeIdsFromCoinGecko,
  goPlusChainId,
  tokenFromDexScreener,
  tokenFromGoPlus,
  twitterHandleFromDexScreener,
  websitesFromDexScreener,
  type CoinGeckoCoin,
  type DexScreenerPair,
  type GoPlusEvmToken,
  type GoPlusResponse,
  type GoPlusSolanaToken,
  type InsightXDexMetrics,
  type InsightXNetwork,
} from '@engine/adapters';
import { scoreCommunity } from '@engine/community';
import { scoreFoundation } from '@engine/foundation';
import { scoreToken, type TrustReport } from '@engine/scoring';
import type { DetectedTarget } from './detect';
import { EVM_ADDRESS, SOLANA_ADDRESS } from './detect';
import type { ExtensionKeys } from './keys';
import { communityFromBundle, fetchTwitterBundle, TwitterError } from './twitter';

export interface Chain {
  name: string;
  dexScreenerId: string;
  network: InsightXNetwork;
}

const EVM_CHAINS: readonly Chain[] = [
  { name: 'Ethereum', dexScreenerId: 'ethereum', network: 'eth' },
  { name: 'Base', dexScreenerId: 'base', network: 'base' },
  { name: 'BNB Chain', dexScreenerId: 'bsc', network: 'bsc' },
];

const SOLANA_CHAINS: readonly Chain[] = [{ name: 'Solana', dexScreenerId: 'solana', network: 'sol' }];

const ALL_CHAINS: readonly Chain[] = [...EVM_CHAINS, ...SOLANA_CHAINS];

const DEXSCREENER = 'https://api.dexscreener.com';
const GOPLUS = 'https://api.gopluslabs.io';
const COINGECKO = 'https://api.coingecko.com';
const INSIGHTX = 'https://api.insightx.network';
const TIMEOUT_MS = 20_000;

const COINGECKO_PLATFORM: Record<InsightXNetwork, string> = {
  eth: 'ethereum',
  base: 'base',
  bsc: 'binance-smart-chain',
  sol: 'solana',
};

const NETWORK_CHAIN: Record<InsightXNetwork, Chain> = {
  eth: EVM_CHAINS[0],
  base: EVM_CHAINS[1],
  bsc: EVM_CHAINS[2],
  sol: SOLANA_CHAINS[0],
};

export class LookupError extends Error {
  readonly reason: 'invalid' | 'not-found' | 'unavailable';
  readonly searched: readonly Chain[];

  constructor(reason: LookupError['reason'], searched: readonly Chain[] = []) {
    super(`Token lookup failed: ${reason}`);
    this.name = 'LookupError';
    this.reason = reason;
    this.searched = searched;
  }
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

export interface ScanResult {
  address: string;
  chain: Chain;
  name?: string;
  symbol?: string;
  twitter?: string;
  community?: ReturnType<typeof scoreCommunity>;
  foundation: ReturnType<typeof scoreFoundation>;
  failures: Array<{ source: 'scan' | 'holders' | 'community'; status?: number }>;
  report: TrustReport;
}

async function getJson<T>(url: string, signal?: AbortSignal, headers?: HeadersInit): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(url, {
    headers: { accept: '*/*', ...headers },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new HttpError(response.status);
  return (await response.json()) as T;
}

function chainsFor(address: string, hint?: InsightXNetwork): readonly Chain[] {
  if (hint) return [NETWORK_CHAIN[hint]];
  if (EVM_ADDRESS.test(address)) return EVM_CHAINS;
  if (SOLANA_ADDRESS.test(address)) return SOLANA_CHAINS;
  return [];
}

function goPlusUrl(chain: Chain, address: string): string {
  return chain.network === 'sol'
    ? `${GOPLUS}/api/v1/solana/token_security?contract_addresses=${address}`
    : `${GOPLUS}/api/v1/token_security/${goPlusChainId(chain.network)}?contract_addresses=${address}`;
}

async function fetchGoPlus(chain: Chain, address: string, signal?: AbortSignal) {
  const body = await getJson<GoPlusResponse<GoPlusEvmToken | GoPlusSolanaToken>>(goPlusUrl(chain, address), signal);
  if (body.code !== 1) throw new HttpError(body.code ?? 500);
  const token = tokenFromGoPlus(body.result, address);
  if (!token) throw new HttpError(404);
  return token;
}

const deepestPool = (pairs: readonly DexScreenerPair[]) => Math.max(0, ...pairs.map((pair) => pair.liquidity?.usd ?? 0));

async function resolveTokenAddress(target: DetectedTarget, signal?: AbortSignal): Promise<{ address: string; chainHint?: InsightXNetwork }> {
  if (target.kind === 'token') return { address: target.address, chainHint: target.chainHint };

  const chainId = ALL_CHAINS.find((chain) => chain.network === target.chainHint)?.dexScreenerId ?? target.chainHint;
  if (chainId) {
    try {
      const body = await getJson<{ pairs?: DexScreenerPair[] | null }>(
        `${DEXSCREENER}/latest/dex/pairs/${chainId}/${target.address}`,
        signal,
      );
      const pair = body.pairs?.[0];
      const token = pair?.baseToken?.address;
      if (token && (EVM_ADDRESS.test(token) || SOLANA_ADDRESS.test(token))) {
        return { address: token, chainHint: target.chainHint };
      }
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
    }
  }

  return { address: target.address, chainHint: target.chainHint };
}

export async function scanTarget(target: DetectedTarget, keys: ExtensionKeys, signal?: AbortSignal): Promise<ScanResult> {
  const resolved = await resolveTokenAddress(target, signal);
  const address = resolved.address;
  const chains = chainsFor(address, resolved.chainHint);
  if (chains.length === 0) throw new LookupError('invalid');

  const listings = await Promise.allSettled(
    chains.map((chain) =>
      getJson<DexScreenerPair[]>(`${DEXSCREENER}/token-pairs/v1/${chain.dexScreenerId}/${address}`, signal),
    ),
  );
  signal?.throwIfAborted();

  const found = chains.flatMap((chain, i) => {
    const listing = listings[i];
    return listing.status === 'fulfilled' && Array.isArray(listing.value) && listing.value.length > 0
      ? [{ chain, pairs: listing.value }]
      : [];
  });
  if (found.length === 0) {
    throw new LookupError(listings.some((listing) => listing.status === 'rejected') ? 'unavailable' : 'not-found', chains);
  }
  const { chain, pairs } = found.reduce((best, next) => (deepestPool(next.pairs) > deepestPool(best.pairs) ? next : best));
  const identity = tokenFromDexScreener(pairs, address);
  const twitter = twitterHandleFromDexScreener(pairs);

  const [scan, holders, twitterBundle, gecko] = await Promise.allSettled([
    fetchGoPlus(chain, address, signal),
    keys.insightx
      ? getJson<InsightXDexMetrics>(`${INSIGHTX}/dex-metrics/v1/${chain.network}/${address}`, signal, {
          'X-API-Key': keys.insightx,
        })
      : Promise.reject(new HttpError(401)),
    keys.twitter
      ? fetchTwitterBundle({ handle: twitter, name: identity.name, symbol: identity.symbol }, keys.twitter, signal)
      : Promise.reject(new TwitterError(401)),
    getJson<CoinGeckoCoin>(`${COINGECKO}/api/v3/coins/${COINGECKO_PLATFORM[chain.network]}/contract/${address}`, signal),
  ]);
  signal?.throwIfAborted();

  const failures: ScanResult['failures'] = [];
  if (scan.status === 'rejected') failures.push(failureFrom('scan', scan.reason));
  if (holders.status === 'rejected') failures.push(failureFrom('holders', holders.reason));
  if (twitterBundle.status === 'rejected') failures.push(failureFrom('community', twitterBundle.reason));

  const signals = buildSignals(chain.network, {
    dexScreenerPairs: pairs,
    goPlus: scan.status === 'fulfilled' ? scan.value : undefined,
    insightXDexMetrics: holders.status === 'fulfilled' ? holders.value : undefined,
  });
  const bundle = twitterBundle.status === 'fulfilled' ? twitterBundle.value : undefined;

  return {
    address,
    chain,
    ...identity,
    twitter,
    community: bundle ? communityFromBundle(bundle) : scoreCommunity({}),
    foundation: scoreFoundation({
      launchedAt: signals.launchedAt,
      websites: websitesFromDexScreener(pairs),
      bio: bundle?.profile?.bio,
      urls: bundle?.profile?.urls,
      mentionedPeople: bundle?.mentionedPeople,
      exchangeHints: gecko.status === 'fulfilled' ? exchangeIdsFromCoinGecko(gecko.value) : [],
    }),
    failures,
    report: scoreToken(signals),
  };
}

function failureFrom(source: ScanResult['failures'][number]['source'], reason: unknown): ScanResult['failures'][number] {
  if (reason instanceof HttpError || reason instanceof TwitterError) return { source, status: reason.status };
  return { source };
}

export function scanErrorMessage(error: unknown): string {
  if (!(error instanceof LookupError)) return 'Something went wrong. Please try again.';
  if (error.reason === 'invalid') return 'That doesn’t look like a token address.';
  if (error.reason === 'not-found') {
    const chains = new Intl.ListFormat('en-GB', { type: 'disjunction' }).format(error.searched.map((chain) => chain.name));
    return `We couldn’t find this token on ${chains}.`;
  }
  return 'We couldn’t reach the market data service. Try again in a minute.';
}
