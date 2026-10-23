import type { Network } from './types';

export const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BASE58_SHAPE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Number of bytes a base58 string decodes to, or -1 if it isn't base58. */
function base58Length(text: string): number {
  let value = 0n;
  for (const char of text) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) return -1;
    value = value * 58n + BigInt(digit);
  }
  let bytes = 0;
  while (value > 0n) {
    value >>= 8n;
    bytes += 1;
  }
  let leadingZeros = 0;
  while (text[leadingZeros] === '1') leadingZeros += 1;
  return bytes + leadingZeros;
}

/**
 * A Solana address is 32 bytes of base58. The decode check rules out most random
 * text that happens to use the same letters.
 */
export function isSolanaAddress(text: string): boolean {
  return BASE58_SHAPE.test(text) && base58Length(text) === 32;
}

export function isTokenAddress(text: string): boolean {
  return EVM_ADDRESS.test(text) || isSolanaAddress(text);
}

/** Quote tokens and stablecoins. Real tokens, but almost never the one a trader is looking at. */
const COMMON = new Set(
  [
    'So11111111111111111111111111111111111111112', // wrapped SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT on Ethereum
    '0x4200000000000000000000000000000000000006', // WETH on Base
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
    '0x55d398326f99059ff775485246999027b3197955', // USDT on BNB Chain
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC on BNB Chain
  ].map((address) => (address.startsWith('0x') ? address.toLowerCase() : address)),
);

export function isCommonToken(address: string): boolean {
  return COMMON.has(address.startsWith('0x') ? address.toLowerCase() : address);
}

/** Short names jup.ag puts in swap URLs, for the tokens we can map with confidence. */
export const JUPITER_SYMBOLS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

/** DexScreener chain ids for the chains we support. */
export const NETWORK_BY_DEXSCREENER: Record<string, Network> = {
  ethereum: 'eth',
  base: 'base',
  bsc: 'bsc',
  solana: 'sol',
};
