import type { ChainFamily, TokenSignals } from '../scoring';
import { anyTrue, compact } from './util';

export type InsightXNetwork = 'sol' | 'eth' | 'base' | 'bsc';

export const chainFromNetwork = (network: InsightXNetwork): ChainFamily => (network === 'sol' ? 'solana' : 'evm');

/** `results.advanced` from GET /scanner/v1/tokens/sol/{token_address}. */
export interface InsightXSolanaAdvanced {
  honeypot?: { score?: number };
  mintable?: boolean;
  freezable?: boolean;
  drainable?: boolean;
  pausable?: boolean;
  transfer_paused?: boolean;
  metadata_mutable?: boolean;
  authorities?: { transfer_fee_config_authority?: string | null };
  tax?: { pct?: number };
  locked_liquidity_weighted?: number;
}

/** `results.advanced` from GET /scanner/v1/tokens/{eth|base|bsc}/{token_address}. */
export interface InsightXEvmAdvanced {
  honeypot?: { score?: number };
  verified?: boolean;
  renounced?: boolean;
  take_back_ownership?: boolean;
  hidden_owners?: boolean;
  proxy_contract?: boolean;
  pausable?: boolean;
  cannot_sell_all?: boolean;
  anti_whale_modifiable?: boolean;
  has_whitelist?: boolean;
  has_blacklist?: boolean;
  tax?: { buy?: number; sell?: number; transfer?: number };
  tax_modifiable?: boolean;
  modify_tax_for_individuals?: boolean;
  mintable?: boolean;
  change_balance_off_chain?: boolean;
  known_honeypot_creator?: boolean;
  locked_liquidity_weighted?: number;
}

export interface InsightXScan {
  results?: { advanced?: InsightXSolanaAdvanced | InsightXEvmAdvanced };
}

/** Response of GET /dex-metrics/v1/{network}/{token_address}. */
export interface InsightXDexMetrics {
  cluster_pct?: number;
  snipers_pct?: number;
  bundlers_pct?: number;
  dev_pct?: number;
  insiders_pct?: number;
  top10_pct?: number;
}

export function signalsFromInsightXScan(network: InsightXNetwork, scan: InsightXScan): Partial<TokenSignals> {
  const advanced = scan.results?.advanced;
  if (!advanced) return {};

  if (network === 'sol') {
    const a = advanced as InsightXSolanaAdvanced;
    const feeAuthority = a.authorities?.transfer_fee_config_authority;
    return compact({
      honeypotRisk: a.honeypot?.score,
      mintable: a.mintable,
      canFreeze: a.freezable,
      canTakeTokens: a.drainable,
      canPause: a.pausable,
      tradingPaused: a.transfer_paused,
      transferFeePct: a.tax?.pct,
      feesChangeable: feeAuthority === undefined ? undefined : feeAuthority !== null,
      metadataMutable: a.metadata_mutable,
      liquidityLockedPct: a.locked_liquidity_weighted,
    });
  }

  const a = advanced as InsightXEvmAdvanced;
  return compact({
    honeypotRisk: a.honeypot?.score,
    codeVerified: a.verified,
    ownershipRenounced: a.renounced,
    hiddenControl: anyTrue(a.hidden_owners, a.take_back_ownership),
    upgradeable: a.proxy_contract,
    canPause: a.pausable,
    sellLimited: a.cannot_sell_all,
    cannotSellAll: a.cannot_sell_all,
    antiWhale: a.anti_whale_modifiable,
    canFreeze: anyTrue(a.has_blacklist, a.has_whitelist),
    hasBlacklist: a.has_blacklist,
    hasWhitelist: a.has_whitelist,
    buyFeePct: a.tax?.buy,
    sellFeePct: a.tax?.sell,
    transferFeePct: a.tax?.transfer,
    feesChangeable: anyTrue(a.tax_modifiable, a.modify_tax_for_individuals),
    mintable: a.mintable,
    canTakeTokens: a.change_balance_off_chain,
    knownScamCreator: a.known_honeypot_creator,
    liquidityLockedPct: a.locked_liquidity_weighted,
  });
}

/** InsightX only measures snipers, bundlers, dev and insiders on Solana; elsewhere it reports 0. */
export function signalsFromInsightXDexMetrics(network: InsightXNetwork, metrics: InsightXDexMetrics): Partial<TokenSignals> {
  const onSolana = network === 'sol';
  return compact({
    clusterPct: metrics.cluster_pct,
    top10Pct: metrics.top10_pct,
    snipersPct: onSolana ? metrics.snipers_pct : undefined,
    bundlersPct: onSolana ? metrics.bundlers_pct : undefined,
    devPct: onSolana ? metrics.dev_pct : undefined,
    insidersPct: onSolana ? metrics.insiders_pct : undefined,
  });
}
