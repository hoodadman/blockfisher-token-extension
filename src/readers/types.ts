/** Chains the scanner can check. */
export type Network = 'eth' | 'base' | 'bsc' | 'sol';

/** What we send to /api/identify: an address (maybe a DexScreener pair) or a CoinGecko coin id. */
export type Candidate =
  | {
      address: string;
      network?: Network;
      /** DexScreener's chain id, for chains we may not support (arbitrum, ...). */
      chainId?: string;
    }
  | { coingeckoId: string };

export type FoundSource = 'url' | 'link' | 'text';

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

export const candidateKey = (candidate: Candidate): string =>
  'coingeckoId' in candidate ? `cg:${candidate.coingeckoId}` : `addr:${candidate.address.startsWith('0x') ? candidate.address.toLowerCase() : candidate.address}`;
