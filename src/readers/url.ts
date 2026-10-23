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

/** Uniswap v4 pools have a 32-byte id rather than an address. DexScreener looks them up like pairs. */
const POOL_ID = /^0x[a-fA-F0-9]{64}$/;

/** The chain and the pair (or token) in a dexscreener.com/<chain>/<value> address, unchecked. */
export function dexScreenerPath(href: string): { chainId: string; value: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (siteOf(url.hostname) !== 'dexscreener.com') return null;
  const [chainId, value] = url.pathname.split('/').filter(Boolean);
  return chainId && value ? { chainId: chainId.toLowerCase(), value } : null;
}

/** dexscreener.com/<chain>/<pair or token>. Solana addresses come in lower case; see findTokens. */
function fromDexScreener(url: URL): Found[] {
  const [chainId, value] = url.pathname.split('/').filter(Boolean);
  const addr = address(value) ?? (value && POOL_ID.test(value) ? value : undefined);
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

/** Query keys for the token being bought or looked at, and for the one being sold. */
const WANTED_KEYS = /^(buy|to|output|outputmint|outputcurrency|tokenout|token|tokenaddress|address|ca|mint|contract|inputtoken)$/i;
const SOLD_KEYS = /^(sell|from|input|inputmint|inputcurrency|tokenin)$/i;
const CHAIN_WORDS: Record<string, Network> = {
  eth: 'eth', ethereum: 'eth', mainnet: 'eth', base: 'base', bsc: 'bsc', bnb: 'bsc', sol: 'sol', solana: 'sol',
};

/**
 * Token addresses anywhere in a page address, on any site: path parts (/solana/<mint>,
 * /token/<address>) and query values (?sell=..&buy=..). Swap links name two tokens; the one
 * being bought ranks first. Site-specific readers above know more, so they win when they apply.
 */
export function readAnyUrl(href: string): Found[] {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return [];
  }
  const found: Found[] = [];
  const seen = new Set<string>();
  const push = (value: string, network: Network | undefined, score: number) => {
    let text = value;
    try {
      text = decodeURIComponent(value);
    } catch {
      // Keep it as it is.
    }
    const addr = address(text);
    if (!addr || seen.has(addr.toLowerCase())) return;
    seen.add(addr.toLowerCase());
    found.push(token(addr, network ?? (EVM_ADDRESS.test(addr) ? undefined : 'sol'), score));
  };

  const parts = url.pathname.split('/').filter(Boolean);
  parts.forEach((part, index) => push(part, CHAIN_WORDS[parts[index - 1]?.toLowerCase() ?? ''], URL_SCORE - 1));
  const chain = CHAIN_WORDS[(url.searchParams.get('chain') ?? url.searchParams.get('network') ?? '').toLowerCase()];
  for (const [key, value] of url.searchParams) {
    push(value, chain, WANTED_KEYS.test(key) ? URL_SCORE : SOLD_KEYS.test(key) ? URL_SCORE - 2 : URL_SCORE - 3);
  }
  return found.sort((a, b) => b.score - a.score);
}

/** What exchanges price a coin in. A trading page's address names the coin and one of these. */
const QUOTES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'USDE', 'PYUSD', 'DAI', 'USD', 'EUR', 'GBP', 'TRY', 'BRL', 'JPY', 'AUD', 'CAD', 'BTC', 'ETH', 'BNB'];
/** BTCUSDT with no separator: only stablecoins and money, so ETHBTC-style words aren't split. */
const JOINED_PAIR = /^([A-Z0-9]{2,12}?)(USDT|USDC|FDUSD|BUSD|TUSD|USDE|USD|EUR|GBP|TRY)$/;
const SPLIT_PAIR = /^([A-Za-z0-9]{2,12})[-_/]([A-Za-z]{3,6})$/;
const TICKER = /^[A-Za-z0-9]{2,12}$/;
/** Path words that are never a coin, so /spot/usdt or /trade-spot/usd don't read as one. */
const NOT_TICKERS = new Set(['app', 'en', 'trade', 'spot', 'price', 'prices', 'futures', 'margin', 'convert', 'buy', 'sell', 'swap', 'market', 'markets', 'chart', 'perp', 'perpetual', 'pro', 'advanced']);
/** /price/bittensor, /prices/bittensor, /currencies/bittensor: the coin's name, as most sites spell it. */
const COIN_PAGE_WORDS = /^(price|prices|currencies|currency|coin|coins|asset|assets|crypto|cryptocurrency|cryptocurrencies)$/i;

function tickerOf(base: string): string | undefined {
  return TICKER.test(base) && !NOT_TICKERS.has(base.toLowerCase()) && !QUOTES.includes(base.toUpperCase()) ? base.toUpperCase() : undefined;
}

/** The coin in a trading pair: BTCUSDT, TAO-USD, tao_usdt, TAO/USDT. */
function pairBase(value: string): string | undefined {
  const joined = value.match(JOINED_PAIR);
  if (joined) return tickerOf(joined[1]);
  const split = value.match(SPLIT_PAIR);
  return split && QUOTES.includes(split[2].toUpperCase()) ? tickerOf(split[1]) : undefined;
}

/**
 * Exchanges (Coinbase, Kraken, Bitget, Binance, OKX, Bybit) name coins, not contracts: a
 * trading pair (/spot/TAOUSDT, /trade/tao-usd, /spot/TAO/USDT, ?symbol=TAOUSDT) or a price
 * page (/price/bittensor). Identify looks them up on CoinGecko for the contract, if any.
 */
export function readExchangeUrl(href: string): Found[] {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return [];
  }
  const found: Found[] = [];
  const parts = url.pathname.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  const add = (candidate: Found['candidate']) => found.push({ candidate, source: 'url', score: URL_SCORE - 4 });

  const last = parts.length - 1;
  if (last >= 1 && COIN_PAGE_WORDS.test(parts[last - 1]) && /^[a-z0-9][a-z0-9-]{1,60}$/i.test(parts[last])) {
    add({ coingeckoId: parts[last].toLowerCase() });
  }
  parts.forEach((part, index) => {
    // Bybit splits the pair over two path parts: /trade/spot/TAO/USDT.
    const base = pairBase(part) ?? (QUOTES.includes(parts[index + 1]?.toUpperCase() ?? '') ? tickerOf(part) : undefined);
    if (base) add({ ticker: base });
  });
  for (const value of url.searchParams.values()) {
    const base = pairBase(value);
    if (base) add({ ticker: base });
  }
  const seen = new Set<string>();
  return found.filter((item) => {
    const key = JSON.stringify(item.candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
