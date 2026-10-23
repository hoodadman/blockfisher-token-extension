import { describe, expect, it } from 'vitest';
import { isSolanaAddress } from '../src/readers/address';
import { readUrl, siteOf } from '../src/readers/url';

const PEPE = '0x6982508145454Ce325dDbE47a25d4ec3d2311933';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const first = (href: string) => readUrl(href)[0]?.candidate;

describe('address checks', () => {
  it('accepts real Solana mints and rejects look-alike text', () => {
    expect(isSolanaAddress(BONK)).toBe(true);
    expect(isSolanaAddress(SOL)).toBe(true);
    expect(isSolanaAddress('abcdefghijkmnopqrstuvwxyzABCDEFGH')).toBe(false);
  });
});

describe('readUrl', () => {
  it('reads DexScreener pair pages with the chain', () => {
    expect(first(`https://dexscreener.com/ethereum/${PEPE}`)).toEqual({ address: PEPE, network: 'eth', chainId: 'ethereum' });
    expect(first(`https://dexscreener.com/arbitrum/${PEPE}`)).toEqual({ address: PEPE, network: undefined, chainId: 'arbitrum' });
    expect(readUrl('https://dexscreener.com/search?q=pepe')).toEqual([]);
    const pool = `0x${'ab'.repeat(32)}`;
    expect(first(`https://dexscreener.com/base/${pool}`)).toEqual({ address: pool, network: 'base', chainId: 'base' });
  });

  it('reads the CoinGecko coin id from the page address', () => {
    expect(first('https://www.coingecko.com/en/coins/pepe')).toEqual({ coingeckoId: 'pepe' });
    expect(first('https://www.coingecko.com/coins/bitcoin')).toEqual({ coingeckoId: 'bitcoin' });
    expect(readUrl('https://www.coingecko.com/en/categories/meme-token')).toEqual([]);
  });

  it('puts the jup.ag buy side first in every URL style', () => {
    expect(first(`https://jup.ag/swap/SOL-${BONK}`)).toEqual({ address: BONK, network: 'sol' });
    expect(first(`https://jup.ag/swap?sell=${SOL}&buy=${BONK}`)).toEqual({ address: BONK, network: 'sol' });
    expect(first(`https://jup.ag/swap?inputMint=${USDC}&outputMint=${BONK}`)).toEqual({ address: BONK, network: 'sol' });
    expect(first(`https://jup.ag/tokens/${BONK}`)).toEqual({ address: BONK, network: 'sol' });
    const both = readUrl(`https://jup.ag/swap/SOL-${BONK}`);
    expect(both).toHaveLength(2);
    expect(both[1]).toMatchObject({ candidate: { address: SOL }, common: true });
  });

  it('reads Uniswap, GMGN and Birdeye pages', () => {
    expect(first(`https://app.uniswap.org/explore/tokens/base/${PEPE}`)).toEqual({ address: PEPE, network: 'base' });
    expect(first(`https://app.uniswap.org/swap?outputCurrency=${PEPE}`)).toEqual({ address: PEPE, network: undefined });
    expect(first(`https://gmgn.ai/sol/token/${BONK}`)).toEqual({ address: BONK, network: 'sol' });
    expect(first(`https://birdeye.so/token/${PEPE}?chain=ethereum`)).toEqual({ address: PEPE, network: 'eth' });
  });

  it('knows only the named sites', () => {
    expect(siteOf('www.dexscreener.com')).toBe('dexscreener.com');
    expect(siteOf('evil-dexscreener.com')).toBeUndefined();
    expect(readUrl(`https://example.com/ethereum/${PEPE}`)).toEqual([]);
  });
});
