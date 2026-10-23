// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readPage } from '../src/readers/page';

const PEPE = '0x6982508145454Ce325dDbE47a25d4ec3d2311933';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const WALLET = '0x00000000219ab540356cBB839Cbe05303d7705Fa';

function page(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
}

const addresses = (html: string) =>
  readPage(page(html), 'https://news.example/article').map((found) => ('address' in found.candidate ? found.candidate.address : found.candidate.coingeckoId));

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
