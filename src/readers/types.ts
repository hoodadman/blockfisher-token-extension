/** Chains the scanner can check. */
export type Network = 'eth' | 'base' | 'bsc' | 'sol';

/**
 * What the page reader found: an address (maybe a DexScreener pair), a CoinGecko coin id,
 * or a coin's name and ticker read from the page title, looked up by search.
 */
export type Candidate =
  | {
      address: string;
      network?: Network;
      /** DexScreener's chain id, for chains we may not support (arbitrum, ...). */
      chainId?: string;
    }
  | { coingeckoId: string }
  | { coin: string; symbol: string };

/** url and title describe the page itself; link and text are things mentioned on it. */
export type FoundSource = 'url' | 'title' | 'link' | 'text';

export interface Found {
  candidate: Candidate;
  source: FoundSource;
  /** Higher is more likely to be the token the user means. */
  score: number;
  /** SOL, USDC, WETH and the like: real tokens, but rarely the one being looked at. */
  common?: boolean;
}

/** What /api/identify answers for each token. Mirrors IdentifiedToken in the scanner. */
export interface IdentifiedToken {
  input: string;
  status: 'token' | 'unsupported-chain' | 'not-a-contract' | 'not-found';
  address?: string;
  network?: Network;
  chainName?: string;
  name?: string;
  symbol?: string;
  liquidityUsd?: number;
  message?: string;
}

/** The input identify reports back for a name candidate. */
export const nameInput = (coin: string) => `name:${coin.toLowerCase()}`;

export const candidateKey = (candidate: Candidate): string =>
  'coingeckoId' in candidate
    ? `cg:${candidate.coingeckoId}`
    : 'coin' in candidate
      ? nameInput(candidate.coin)
      : `addr:${candidate.address.startsWith('0x') ? candidate.address.toLowerCase() : candidate.address}`;
