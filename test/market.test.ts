import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketError, identify, marketData } from '../src/market';

const PEPE = '0x6982508145454Ce325dDbE47a25d4ec3d2311933';
const PAIR = '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f';

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('identify', () => {
  it('turns a DexScreener pair address into its token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/latest/dex/pairs/ethereum/')
          ? json({ pairs: [{ chainId: 'ethereum', baseToken: { address: PEPE, name: 'Pepe', symbol: 'PEPE' }, liquidity: { usd: 10 } }] })
          : json({ pairs: [] }),
      ),
    );
    const [token] = await identify([{ address: PAIR, network: 'eth' }]);
    expect(token).toMatchObject({ input: PAIR, address: PEPE, status: 'token', network: 'eth', symbol: 'PEPE' });
  });

  it('throws MarketError with the status when DexScreener is busy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 429 })));
    await expect(identify([{ address: PEPE }])).rejects.toEqual(new MarketError(429));
  });

  it('reads a CoinGecko coin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ name: 'Pepe', symbol: 'pepe', platforms: { ethereum: PEPE } })));
    expect(await identify([{ coingeckoId: 'pepe' }])).toEqual([
      { input: 'pepe', name: 'Pepe', symbol: 'PEPE', status: 'token', address: PEPE, network: 'eth', chainName: 'Ethereum' },
    ]);
  });
});

describe('marketData', () => {
  it('keeps only exchange names from CoinGecko and leaves out what failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('coingecko') ? json({ tickers: [{ market: { name: 'Binance', identifier: 'binance' }, volume: 9 }], description: 'big' }) : new Response(null, { status: 429 }),
      ),
    );
    expect(await marketData(PEPE, 'eth')).toEqual({ pairs: undefined, coingecko: { tickers: [{ market: { name: 'Binance', identifier: 'binance' } }] } });
  });
});
