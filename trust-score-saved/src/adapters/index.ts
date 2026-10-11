import type { TokenSignals } from '../scoring';
import { signalsFromDexScreener, type DexScreenerPair } from './dexscreener';
import { signalsFromGoPlus, type GoPlusChainId, type GoPlusToken } from './goplus';
import {
  chainFromNetwork,
  signalsFromInsightXDexMetrics,
  type InsightXDexMetrics,
  type InsightXNetwork,
} from './insightx';

export * from './coingecko';
export * from './dexscreener';
export * from './goplus';
export * from './insightx';

const GOPLUS_CHAIN: Record<InsightXNetwork, GoPlusChainId> = {
  eth: '1',
  base: '8453',
  bsc: '56',
  sol: 'solana',
};

export const goPlusChainId = (network: InsightXNetwork): GoPlusChainId => GOPLUS_CHAIN[network];

export interface SignalSources {
  dexScreenerPairs?: readonly DexScreenerPair[];
  goPlus?: GoPlusToken;
  insightXDexMetrics?: InsightXDexMetrics;
}

/** Pass whichever API responses you have; anything missing shows up as "couldn't check". */
export function buildSignals(network: InsightXNetwork, sources: SignalSources): TokenSignals {
  return {
    chain: chainFromNetwork(network),
    ...(sources.dexScreenerPairs && signalsFromDexScreener(sources.dexScreenerPairs)),
    ...(sources.goPlus && signalsFromGoPlus(goPlusChainId(network), sources.goPlus)),
    ...(sources.insightXDexMetrics && signalsFromInsightXDexMetrics(network, sources.insightXDexMetrics)),
  };
}
