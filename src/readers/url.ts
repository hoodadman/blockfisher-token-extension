import { EVM_ADDRESS, JUPITER_SYMBOLS, NETWORK_BY_DEXSCREENER, isCommonToken, isTokenAddress } from './address';
import type { Found, Network } from './types';

/**
 * Sites where the page address tells us the token. The content script runs on these
 * automatically (see manifest.json); keep the two lists in step.
 */
export const NAMED_SITES = ['dexscreener.com', 'coingecko.com', 'jup.ag', 'app.uniswap.org', 'gmgn.ai', 'birdeye.so'] as const;

const UNISWAP_CHAIN: Record<string, Network> = { ethereum: 'eth', base: 'base', bnb: 'bsc' };
const GMGN_CHAIN: Record<string, Network> = { eth: 'eth', base: 'base', bsc: 'bsc', sol: 'sol' };
const BIRDEYE_CHAIN: Record<string, Network> = { ethereum: 'eth', base: 'base', bsc: 'bsc', solana: 'sol' };
const COINGECKO_ID = /^[a-z0-9-]{1,100}$/;

const URL_SCORE = 10;

function address(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && isTokenAddress(trimmed) ? trimmed : undefined;
}

function token(addr: string, network?: Network, score = URL_SCORE): Found {
  return { candidate: { address: addr, network }, source: 'url', score, common: isCommonToken(addr) };
}

/** dexscreener.com/<chain>/<pair or token> */
function fromDexScreener(url: URL): Found[] {
  const [chainId, value] = url.pathname.split('/').filter(Boolean);
  const addr = address(value);
  if (!chainId || !addr) return [];
  const network = NETWORK_BY_DEXSCREENER[chainId.toLowerCase()];
  return [{ candidate: { address: addr, network, chainId: chainId.toLowerCase() }, source: 'url', score: URL_SCORE }];
}

/** coingecko.com/en/coins/<id>, coingecko.com/coins/<id> */
function fromCoinGecko(url: URL): Found[] {
  const parts = url.pathname.split('/').filter(Boolean);
  const at = parts.indexOf('coins');
  const id = at >= 0 ? parts[at + 1]?.toLowerCase() : undefined;
  if (!id || !COINGECKO_ID.test(id)) return [];
  return [{ candidate: { coingeckoId: id }, source: 'url', score: URL_SCORE }];
}

function jupiterSide(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return address(value) ?? JUPITER_SYMBOLS[value.toUpperCase()];
}

/**
 * jup.ag/swap/<sell>-<buy>, jup.ag/swap?sell=&buy= (or inputMint/outputMint), jup.ag/tokens/<mint>.
 * The buy side is the token the user is about to own, so it ranks first.
 */
function fromJupiter(url: URL): Found[] {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'tokens' || parts[0] === 'token') {
    const mint = address(parts[1]);
    return mint ? [token(mint, 'sol')] : [];
  }
  if (parts[0] !== 'swap') return [];
  let sell = url.searchParams.get('sell') ?? url.searchParams.get('inputMint');
  let buy = url.searchParams.get('buy') ?? url.searchParams.get('outputMint');
  if ((!sell || !buy) && parts[1]?.includes('-')) {
    [sell, buy] = parts[1].split('-');
  }
  const out: Found[] = [];
  const buyMint = jupiterSide(buy);
  const sellMint = jupiterSide(sell);
  if (buyMint) out.push(token(buyMint, 'sol', URL_SCORE));
  if (sellMint && sellMint !== buyMint) out.push(token(sellMint, 'sol', URL_SCORE - 2));
  return out;
}

/** app.uniswap.org/explore/tokens/<chain>/<token>, /tokens/<chain>/<token>, /swap?outputCurrency= */
function fromUniswap(url: URL): Found[] {
  const parts = url.pathname.split('/').filter(Boolean);
  const rest = parts[0] === 'explore' && parts[1] === 'tokens' ? parts.slice(2) : parts[0] === 'tokens' ? parts.slice(1) : [];
  if (rest.length >= 2) {
    const addr = address(rest[1]);
    if (addr && EVM_ADDRESS.test(addr)) return [token(addr, UNISWAP_CHAIN[rest[0].toLowerCase()])];
  }
  const out: Found[] = [];
  const output = address(url.searchParams.get('outputCurrency'));
  const input = address(url.searchParams.get('inputCurrency'));
  if (output) out.push(token(output));
  if (input && input !== output) out.push(token(input, undefined, URL_SCORE - 2));
  return out;
}

/** gmgn.ai/<chain>/token/<token> */
function fromGmgn(url: URL): Found[] {
  const parts = url.pathname.split('/').filter(Boolean);
  const at = parts.indexOf('token');
  const addr = at >= 0 ? address(parts[at + 1]) : undefined;
  if (!addr) return [];
  return [token(addr, GMGN_CHAIN[parts[at - 1]?.toLowerCase() ?? ''])];
}

/** birdeye.so/token/<token>?chain=<chain> */
function fromBirdeye(url: URL): Found[] {
  const parts = url.pathname.split('/').filter(Boolean);
  const addr = parts[0] === 'token' ? address(parts[1]) : undefined;
  if (!addr) return [];
  const chain = url.searchParams.get('chain')?.toLowerCase();
  return [token(addr, chain ? BIRDEYE_CHAIN[chain] : EVM_ADDRESS.test(addr) ? undefined : 'sol')];
}

export function siteOf(hostname: string): (typeof NAMED_SITES)[number] | undefined {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return NAMED_SITES.find((site) => host === site);
}

/** Tokens named by the page address. Empty for sites we don't know. */
export function readUrl(href: string): Found[] {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return [];
  }
  switch (siteOf(url.hostname)) {
    case 'dexscreener.com':
      return fromDexScreener(url);
    case 'coingecko.com':
      return fromCoinGecko(url);
    case 'jup.ag':
      return fromJupiter(url);
    case 'app.uniswap.org':
      return fromUniswap(url);
    case 'gmgn.ai':
      return fromGmgn(url);
    case 'birdeye.so':
      return fromBirdeye(url);
    default:
      return [];
  }
}
