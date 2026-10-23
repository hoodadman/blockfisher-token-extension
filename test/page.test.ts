// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { findTokens, readPage, readTitle } from '../src/readers/page';

const PEPE = '0x6982508145454Ce325dDbE47a25d4ec3d2311933';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const WALLET = '0x00000000219ab540356cBB839Cbe05303d7705Fa';

function page(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
}

const addresses = (html: string) =>
  readPage(page(html), 'https://news.example/article').map((found) => ('address' in found.candidate ? found.candidate.address : 'coingeckoId' in found.candidate ? found.candidate.coingeckoId : 'coin' in found.candidate ? found.candidate.coin : found.candidate.ticker));

describe('readPage', () => {
  it('finds tokens from explorer and chart links, with the chain', () => {
    const found = readPage(
      page(`<p>Buy <a href="https://etherscan.io/token/${PEPE}">PEPE</a> or <a href="https://dexscreener.com/solana/${BONK}">BONK</a></p>`),
      'https://news.example/',
    );
    expect(found.map((item) => item.candidate)).toEqual([
      { address: PEPE, network: 'eth' },
      { address: BONK, network: 'sol', chainId: 'solana' },
    ]);
  });

  it('ranks an address labelled CA above loose text', () => {
    expect(addresses(`<p>Someone sent ${WALLET} a tip.</p><p>CA: ${BONK}</p>`)).toEqual([BONK, WALLET]);
  });

  it('puts common tokens like WETH last', () => {
    expect(addresses(`<p>Contract: ${WETH}</p><p>${PEPE}</p>`)).toEqual([PEPE, WETH]);
  });

  it('ignores text in inputs, scripts, tables and navigation', () => {
    expect(addresses(`<script>var a="${PEPE}"</script><nav>${BONK}</nav><table><tr><td>${WALLET}</td></tr></table><textarea>${PEPE}</textarea>`)).toEqual([]);
  });

  it('counts the same address once and returns at most five', () => {
    const many = Array.from({ length: 8 }, (_, i) => `0x${String(i + 1).repeat(40)}`);
    expect(addresses(`<p>${PEPE}</p><p>${PEPE.toLowerCase()}</p>`)).toHaveLength(1);
    expect(addresses(many.map((item) => `<p>${item}</p>`).join(''))).toHaveLength(5);
  });

  it('skips random text that only looks like base58', () => {
    expect(addresses('<p>abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMN</p>')).toEqual([]);
  });
});

describe('findTokens', () => {
  it('ignores trending bars on named sites and keeps the token in the address', async () => {
    const { findTokens } = await import('../src/readers/page');
    const doc = page(`<div class="trending"><a href="/solana/${BONK}">BONK</a><a href="/ethereum/${WETH}">WETH</a></div>`);
    const found = findTokens(doc, `https://dexscreener.com/ethereum/${PEPE}`);
    expect(found.map((item) => item.candidate)).toEqual([{ address: PEPE, network: 'eth', chainId: 'ethereum' }]);
  });

  it('shows nothing on a named site page with no token in the address', async () => {
    const { findTokens } = await import('../src/readers/page');
    const doc = page(`<a href="/solana/${BONK}">BONK</a>`);
    expect(findTokens(doc, 'https://dexscreener.com/')).toEqual([]);
  });
});

describe('findTokens on DexScreener', () => {
  const PAIR = 'Gc5W9CzeiUJxDzxfWBXFQeW6UEDb2RykErdhUDtzZt5p';
  const href = `https://dexscreener.com/solana/${PAIR.toLowerCase()}`;

  it('recovers the real spelling of a lower-case Solana pair from the page', () => {
    const doc = page(`<div class="trending"><a href="/solana/${BONK.toLowerCase()}">BONK</a></div><script>window.pair="${PAIR}"</script>`);
    expect(findTokens(doc, href).map((item) => item.candidate)).toEqual([{ address: PAIR, network: 'sol', chainId: 'solana' }]);
  });

  it('offers nothing until the page has loaded the pair', () => {
    expect(findTokens(page(`<a href="https://solscan.io/token/${BONK}">BONK</a>`), href)).toEqual([]);
  });
});

describe('findTokens on exchanges', () => {
  const at = (href: string) => findTokens(page('<p>Order book</p>'), href).map((item) => item.candidate);

  it('reads the coin from trading pairs in any style', () => {
    expect(at('https://www.bitget.com/spot/TAOUSDT')).toEqual([{ ticker: 'TAO' }]);
    expect(at('https://www.coinbase.com/advanced-trade/spot/TAO-USD')).toEqual([{ ticker: 'TAO' }]);
    expect(at('https://pro.kraken.com/app/trade/tao-usd')).toEqual([{ ticker: 'TAO' }]);
    expect(at('https://www.binance.com/en/trade/PEPE_USDT?type=spot')).toEqual([{ ticker: 'PEPE' }]);
    expect(at('https://www.okx.com/trade-spot/pepe-usdt')).toEqual([{ ticker: 'PEPE' }]);
    expect(at('https://www.bybit.com/en/trade/spot/PEPE/USDT')).toEqual([{ ticker: 'PEPE' }]);
    expect(at('https://www.binance.com/en/futures/PEPEUSDT')).toEqual([{ ticker: 'PEPE' }]);
  });

  it('reads the coin from price pages', () => {
    expect(at('https://www.coinbase.com/price/bittensor')).toEqual([{ coingeckoId: 'bittensor' }]);
    expect(at('https://www.kraken.com/prices/bittensor')).toEqual([{ coingeckoId: 'bittensor' }]);
    expect(at('https://www.okx.com/price/bittensor-tao')).toEqual([{ coingeckoId: 'bittensor-tao' }]);
    expect(at('https://coinmarketcap.com/currencies/bittensor/')).toEqual([{ coingeckoId: 'bittensor' }]);
  });

  it('leaves ordinary addresses alone', () => {
    expect(at('https://www.kraken.com/learn/what-is-usd')).toEqual([]);
    expect(at('https://www.binance.com/en/trade')).toEqual([]);
    expect(at('https://www.coinbase.com/spot/usdt')).toEqual([]);
  });
});

describe('readTitle', () => {
  const titled = (title: string) => {
    const doc = page('<p>No addresses here.</p>');
    doc.title = title;
    return doc;
  };

  it('reads the coin from common price-page titles', () => {
    expect(findTokens(titled('Bittensor price today, TAO to USD live price, marketcap and chart | CoinMarketCap'), 'https://news.example/today').map((item) => item.candidate)).toEqual([
      { coin: 'Bittensor', symbol: 'TAO' },
    ]);
    expect(readTitle(titled('Bittensor Price: TAO Live Price Chart, Market Cap & News Today | Coinbase')).map((item) => item.candidate)).toEqual([{ coin: 'Bittensor', symbol: 'TAO' }]);
    expect(readTitle(titled('Bittensor Price (TAO), Market Cap & Charts')).map((item) => item.candidate)).toEqual([{ coin: 'Bittensor', symbol: 'TAO' }]);
    expect(readTitle(titled('Bitcoin Price | Kraken'))).toEqual([]);
    expect(readTitle(titled('Pepe (PEPE) Price, Charts, and News')).map((item) => item.candidate)).toEqual([{ coin: 'Pepe', symbol: 'PEPE' }]);
    expect(readTitle(titled('My holiday photos'))).toEqual([]);
  });

  it('prefers addresses on the page over the title', () => {
    const doc = page(`<p>CA: ${BONK}</p>`);
    doc.title = 'Bonk (BONK) price';
    expect(findTokens(doc, 'https://news.example/bonk').map((item) => item.candidate)).toEqual([{ address: BONK }]);
  });
});
