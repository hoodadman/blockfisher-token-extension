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

describe('identify with a Uniswap v4 pool id', () => {
  it('looks it up as a pair only', async () => {
    const pool = `0x${'ab'.repeat(32)}`;
    const fetchMock = vi.fn(async (url: string) =>
      json({ pairs: url.includes('/pairs/base/') ? [{ chainId: 'base', baseToken: { address: PEPE, symbol: 'PEPE' } }] : [] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const [token] = await identify([{ address: pool, network: 'base' }]);
    expect(token).toMatchObject({ input: pool, address: PEPE, network: 'base' });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/tokens/'))).toBe(false);
  });
});

describe('identify by name', () => {
  it('finds the coin by name and ticker through CoinGecko search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/search?')
          ? json({ coins: [{ id: 'tao-imposter', name: 'Bittensor', symbol: 'FAKE' }, { id: 'bittensor', name: 'Bittensor', symbol: 'TAO' }] })
          : json({ name: 'Bittensor', symbol: 'tao', platforms: {} }),
      ),
    );
    const [token] = await identify([{ coin: 'Bittensor', symbol: 'TAO' }]);
    expect(token).toMatchObject({ input: 'name:bittensor', status: 'not-a-contract', name: 'Bittensor' });
  });

  it('gives up when no coin matches both name and ticker', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ coins: [{ id: 'x', name: 'Other', symbol: 'TAO' }] })));
    expect(await identify([{ coin: 'Bittensor', symbol: 'TAO' }])).toEqual([{ input: 'name:bittensor', status: 'not-found', message: 'CoinGecko does not list this coin.' }]);
  });
});

describe('identify by ticker', () => {
  it('takes the best-ranked coin with exactly that ticker', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/search?')
          ? json({ coins: [
              { id: 'pepe-fork', symbol: 'PEPE', market_cap_rank: 2400 },
              { id: 'pepe-unranked', symbol: 'PEPE', market_cap_rank: null },
              { id: 'pepecoin', symbol: 'PEPECOIN', market_cap_rank: 300 },
              { id: 'pepe', symbol: 'PEPE', market_cap_rank: 40 },
            ] })
          : url.includes('/coins/pepe?')
            ? json({ name: 'Pepe', symbol: 'pepe', platforms: { ethereum: PEPE } })
            : json({}, 404),
      ),
    );
    expect(await identify([{ ticker: 'PEPE' }])).toEqual([
      { input: 'ticker:PEPE', status: 'token', address: PEPE, network: 'eth', chainName: 'Ethereum', name: 'Pepe', symbol: 'PEPE' },
    ]);
  });

  it('finds OKX-style price pages that add the ticker to the name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/search?query=bittensor%20tao')
          ? json({ coins: [] })
          : url.includes('/search?')
            ? json({ coins: [{ id: 'bittensor', name: 'Bittensor', symbol: 'TAO' }] })
            : url.includes('/coins/bittensor?')
              ? json({ name: 'Bittensor', symbol: 'tao', platforms: {} })
              : json({}, 404),
      ),
    );
    const [token] = await identify([{ coingeckoId: 'bittensor-tao' }]);
    expect(token).toMatchObject({ input: 'bittensor-tao', status: 'not-a-contract', name: 'Bittensor' });
  });
});
