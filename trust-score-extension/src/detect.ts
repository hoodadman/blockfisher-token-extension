import type { InsightXNetwork } from '@engine/adapters';

export const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
export const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const DEXSCREENER_CHAIN: Record<string, InsightXNetwork> = {
  ethereum: 'eth',
  eth: 'eth',
  base: 'base',
  bsc: 'bsc',
  'bnb-chain': 'bsc',
  solana: 'sol',
  sol: 'sol',
};

const UNISWAP_CHAIN: Record<string, InsightXNetwork> = {
  ethereum: 'eth',
  base: 'base',
  bnb: 'bsc',
  'bnb-chain': 'bsc',
};

const GMGN_CHAIN: Record<string, InsightXNetwork> = {
  eth: 'eth',
  base: 'base',
  bsc: 'bsc',
  sol: 'sol',
};

export interface DetectedTarget {
  address: string;
  chainHint?: InsightXNetwork;
  /** Pair pages need a DexScreener lookup before we scan. */
  kind: 'token' | 'pair-or-token';
  source: 'url';
  pageUrl: string;
}

function asAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (EVM_ADDRESS.test(value) || SOLANA_ADDRESS.test(value)) return value;
  return undefined;
}

function fromDexScreener(url: URL): DetectedTarget | null {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'search' || parts.length < 2) return null;
  const chainHint = DEXSCREENER_CHAIN[parts[0].toLowerCase()];
  const address = asAddress(parts[1]);
  if (!address) return null;
  return { address, chainHint, kind: 'pair-or-token', source: 'url', pageUrl: url.href };
}

function fromUniswap(url: URL): DetectedTarget | null {
  const parts = url.pathname.split('/').filter(Boolean);
  const explore = parts[0] === 'explore' && parts[1] === 'tokens' ? parts.slice(2) : parts[0] === 'tokens' ? parts.slice(1) : [];
  if (explore.length >= 2) {
    const chainHint = UNISWAP_CHAIN[explore[0].toLowerCase()];
    const address = asAddress(explore[1]);
    if (address) return { address, chainHint, kind: 'token', source: 'url', pageUrl: url.href };
  }
  const output = asAddress(url.searchParams.get('outputCurrency') ?? undefined);
  if (output) return { address: output, kind: 'token', source: 'url', pageUrl: url.href };
  return null;
}

function fromGmgn(url: URL): DetectedTarget | null {
  const parts = url.pathname.split('/').filter(Boolean);
  const tokenAt = parts.indexOf('token');
  if (tokenAt < 1 || !parts[tokenAt + 1]) return null;
  const chainHint = GMGN_CHAIN[parts[tokenAt - 1]?.toLowerCase() ?? ''];
  const address = asAddress(parts[tokenAt + 1]);
  if (!address) return null;
  return { address, chainHint, kind: 'token', source: 'url', pageUrl: url.href };
}

function fromBirdeye(url: URL): DetectedTarget | null {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'token') return null;
  const address = asAddress(parts[1]);
  if (!address) return null;
  const chainParam = url.searchParams.get('chain')?.toLowerCase();
  const chainHint = chainParam ? DEXSCREENER_CHAIN[chainParam] : EVM_ADDRESS.test(address) ? 'eth' : 'sol';
  return { address, chainHint, kind: 'token', source: 'url', pageUrl: url.href };
}

export function detectFromUrl(href: string): DetectedTarget | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'dexscreener.com') return fromDexScreener(url);
  if (host === 'app.uniswap.org') return fromUniswap(url);
  if (host === 'gmgn.ai') return fromGmgn(url);
  if (host === 'birdeye.so') return fromBirdeye(url);
  return null;
}

export function sameTarget(a: DetectedTarget | null, b: DetectedTarget | null): boolean {
  if (!a || !b) return a === b;
  return a.address.toLowerCase() === b.address.toLowerCase() && a.kind === b.kind && a.chainHint === b.chainHint;
}
