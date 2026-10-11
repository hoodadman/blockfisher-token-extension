import type { InsightXNetwork } from './insightx';

const PLATFORM: Record<InsightXNetwork, string> = {
  eth: 'ethereum',
  base: 'base',
  bsc: 'binance-smart-chain',
  sol: 'solana',
};

export interface CoinGeckoTicker {
  market?: { name?: string; identifier?: string };
}

export interface CoinGeckoCoin {
  tickers?: CoinGeckoTicker[];
}

export const coingeckoContractUrl = (network: InsightXNetwork, address: string) =>
  `/api/coingecko/api/v3/coins/${PLATFORM[network]}/contract/${address}`;

export function exchangeIdsFromCoinGecko(coin: CoinGeckoCoin): string[] {
  const ids = new Set<string>();
  for (const ticker of coin.tickers ?? []) {
    const raw = `${ticker.market?.identifier ?? ''} ${ticker.market?.name ?? ''}`.toLowerCase();
    if (raw.trim()) ids.add(raw);
  }
  return [...ids];
}
