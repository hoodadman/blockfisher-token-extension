import type { Candidate, IdentifiedToken, Network } from './readers/types';

/**
 * Market data fetched from the user's own browser. DexScreener and CoinGecko rate-limit
 * the shared addresses our server runs on, so the extension asks them directly, the way
 * the Blockfisher website does, and sends what it gets to the scanner.
 * Only public token addresses and coin ids are sent to these services.
 */

const DEXSCREENER = 'https://api.dexscreener.com';
const COINGECKO = 'https://api.coingecko.com/api/v3';
const TIMEOUT_MS = 15_000;
const POOL_ID = /^0x[a-fA-F0-9]{64}$/;

/** The fields of a DexScreener pair we read. */
export interface DexPair {
  chainId: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  liquidity?: { usd?: number | null } | null;
}

export class MarketError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

async function getJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new MarketError(0);
  }
  if (!response.ok) throw new MarketError(response.status);
  return (await response.json()) as T;
}

export const NETWORK_BY_DEXSCREENER: Record<string, Network> = { ethereum: 'eth', base: 'base', bsc: 'bsc', solana: 'sol' };
export const DEXSCREENER_BY_NETWORK: Record<Network, string> = { eth: 'ethereum', base: 'base', bsc: 'bsc', sol: 'solana' };
const CHAIN_NAME: Record<Network, string> = { eth: 'Ethereum', base: 'Base', bsc: 'BNB Chain', sol: 'Solana' };
const COINGECKO_PLATFORM: Record<Network, string> = { eth: 'ethereum', base: 'base', bsc: 'binance-smart-chain', sol: 'solana' };
/** CoinGecko platforms, in the order we prefer when a coin lives on several chains. */
const NETWORK_BY_COINGECKO: ReadonlyArray<[string, Network]> = [
  ['ethereum', 'eth'],
  ['solana', 'sol'],
  ['base', 'base'],
  ['binance-smart-chain', 'bsc'],
];

const prettyChain = (chainId: string) =>
  chainId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

function matchingSide(pair: DexPair, address: string) {
  const wanted = address.toLowerCase();
  return [pair.baseToken, pair.quoteToken].find((side) => side?.address?.toLowerCase() === wanted);
}

const depth = (pairs: readonly DexPair[]) => Math.max(0, ...pairs.map((pair) => pair.liquidity?.usd ?? 0));

function fromPairs(address: string, pairs: readonly DexPair[], preferredChain?: string): IdentifiedToken | null {
  const mine = pairs.filter((pair) => matchingSide(pair, address));
  if (mine.length === 0) return null;
  const byChain = new Map<string, DexPair[]>();
  for (const pair of mine) byChain.set(pair.chainId, [...(byChain.get(pair.chainId) ?? []), pair]);
  const chainId =
    preferredChain && byChain.has(preferredChain)
      ? preferredChain
      : [...byChain.entries()].reduce((best, next) => (depth(next[1]) > depth(best[1]) ? next : best))[0];
  const chainPairs = byChain.get(chainId) ?? [];
  const side = matchingSide(chainPairs[0], address);
  const network = NETWORK_BY_DEXSCREENER[chainId];
  const liquidity = depth(chainPairs);
  const base = {
    input: address,
    address: side?.address ?? address,
    name: side?.name,
    symbol: side?.symbol,
    liquidityUsd: liquidity > 0 ? liquidity : undefined,
  };
  if (!network) {
    const chainName = prettyChain(chainId);
    return { ...base, status: 'unsupported-chain', chainName, message: `We can't check tokens on ${chainName} yet.` };
  }
  return { ...base, status: 'token', network, chainName: CHAIN_NAME[network] };
}

async function identifyPair(address: string, chainId: string): Promise<IdentifiedToken | null> {
  try {
    const body = await getJson<{ pairs?: DexPair[] | null }>(`${DEXSCREENER}/latest/dex/pairs/${chainId}/${address}`);
    const pair = body.pairs?.[0];
    const token = pair?.baseToken?.address;
    if (!pair || !token) return null;
    const found = fromPairs(token, [pair], chainId);
    return found ? { ...found, input: address } : null;
  } catch (error) {
    if (error instanceof MarketError && error.status !== 0 && error.status !== 429) return null;
    throw error;
  }
}

async function identifyAddresses(candidates: ReadonlyArray<Extract<Candidate, { address: string }>>): Promise<IdentifiedToken[]> {
  if (candidates.length === 0) return [];
  // Uniswap v4 pool ids are never tokens; they're looked up as pairs below.
  const addresses = candidates.map((item) => item.address).filter((address) => !POOL_ID.test(address));
  const body = addresses.length > 0 ? await getJson<{ pairs?: DexPair[] | null }>(`${DEXSCREENER}/latest/dex/tokens/${addresses.join(',')}`) : {};
  const pairs = body.pairs ?? [];
  return Promise.all(
    candidates.map(async (candidate): Promise<IdentifiedToken> => {
      const preferred = candidate.network ? DEXSCREENER_BY_NETWORK[candidate.network] : candidate.chainId;
      const asToken = fromPairs(candidate.address, pairs, preferred);
      if (asToken) return asToken;
      // DexScreener page addresses are usually the pair, not the token.
      const asPair = preferred ? await identifyPair(candidate.address, preferred) : null;
      if (asPair) return asPair;
      return {
        input: candidate.address,
        status: 'not-found',
        message: 'This address does not trade anywhere we can see. It may be a wallet rather than a token.',
      };
    }),
  );
}

async function identifyCoinGecko(id: string): Promise<IdentifiedToken[]> {
  let coin: { name?: string; symbol?: string; platforms?: Record<string, string | null> | null };
  try {
    coin = await getJson(`${COINGECKO}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`);
  } catch (error) {
    if (error instanceof MarketError && error.status === 404) return [{ input: id, status: 'not-found', message: 'CoinGecko does not list this coin.' }];
    throw error;
  }
  const platforms = Object.entries(coin.platforms ?? {}).filter(
    (entry): entry is [string, string] => Boolean(entry[0]) && typeof entry[1] === 'string' && entry[1].length > 0,
  );
  const base = { input: id, name: coin.name, symbol: coin.symbol?.toUpperCase() };
  const label = coin.name ?? id;
  if (platforms.length === 0) {
    return [{ ...base, status: 'not-a-contract', message: `${label} is a coin with its own blockchain, not a token contract, so there is nothing to check.` }];
  }
  const supported = NETWORK_BY_COINGECKO.flatMap(([platform, network]): IdentifiedToken[] => {
    const address = platforms.find(([key]) => key === platform)?.[1];
    return address ? [{ ...base, status: 'token', address, network, chainName: CHAIN_NAME[network] }] : [];
  });
  if (supported.length > 0) return supported;
  const chainName = prettyChain(platforms[0][0]);
  return [{ ...base, status: 'unsupported-chain', chainName, message: `We can't check tokens on ${chainName} yet.` }];
}

/** Which of the page's candidates are real tokens on chains we support. Throws MarketError. */
export async function identify(candidates: readonly Candidate[]): Promise<IdentifiedToken[]> {
  const addresses = candidates.filter((item): item is Extract<Candidate, { address: string }> => 'address' in item);
  const coins = candidates.filter((item): item is Extract<Candidate, { coingeckoId: string }> => 'coingeckoId' in item);
  const [fromAddresses, ...fromCoins] = await Promise.all([identifyAddresses(addresses), ...coins.map((coin) => identifyCoinGecko(coin.coingeckoId))]);
  return [...fromAddresses, ...fromCoins.flat()];
}

/** What the scanner needs from DexScreener and CoinGecko for one token. Missing parts are left out. */
export async function marketData(address: string, network: Network): Promise<{ pairs?: unknown[]; coingecko?: { tickers: unknown[] } }> {
  const [pairs, coin] = await Promise.allSettled([
    getJson<unknown[]>(`${DEXSCREENER}/token-pairs/v1/${DEXSCREENER_BY_NETWORK[network]}/${address}`),
    getJson<{ tickers?: Array<{ market?: { name?: string; identifier?: string } }> }>(
      `${COINGECKO}/coins/${COINGECKO_PLATFORM[network]}/contract/${address}`,
    ),
  ]);
  return {
    pairs: pairs.status === 'fulfilled' && Array.isArray(pairs.value) ? pairs.value.slice(0, 30) : undefined,
    // Only the exchange names are used, and the full answer is large.
    coingecko:
      coin.status === 'fulfilled'
        ? { tickers: (coin.value.tickers ?? []).slice(0, 200).map((ticker) => ({ market: { name: ticker.market?.name, identifier: ticker.market?.identifier } })) }
        : undefined,
  };
}
