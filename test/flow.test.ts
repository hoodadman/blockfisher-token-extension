import { describe, expect, it } from 'vitest';
import { askState } from '../src/flow';
import type { Found, IdentifiedToken } from '../src/readers/types';

const PEPE = '0x6982508145454Ce325dDbE47a25d4ec3d2311933';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const SOL = 'So11111111111111111111111111111111111111112';
const WALLET = '0x00000000219ab540356cBB839Cbe05303d7705Fa';

const token = (input: string, extra: Partial<IdentifiedToken> = {}): IdentifiedToken => ({
  input,
  status: 'token',
  address: input,
  network: input.startsWith('0x') ? 'eth' : 'sol',
  chainName: input.startsWith('0x') ? 'Ethereum' : 'Solana',
  ...extra,
});

describe('askState', () => {
  it('keeps the page reader order, not the server order', () => {
    const found: Found[] = [
      { candidate: { address: BONK, network: 'sol' }, source: 'url', score: 10 },
      { candidate: { address: SOL, network: 'sol' }, source: 'url', score: 8, common: true },
    ];
    const state = askState(found, [token(SOL), token(BONK)], false);
    expect(state).toMatchObject({ kind: 'ask' });
    expect(state?.kind === 'ask' && state.tokens.map((item) => item.input)).toEqual([BONK, SOL]);
  });

  it('drops wallets quietly', () => {
    const found: Found[] = [
      { candidate: { address: PEPE }, source: 'text', score: 2 },
      { candidate: { address: WALLET }, source: 'text', score: 2 },
    ];
    const state = askState(found, [token(PEPE), { input: WALLET, status: 'not-found', message: 'wallet' }], true);
    expect(state).toEqual({ kind: 'ask', tokens: [token(PEPE)], notes: [], offerRemember: true });
  });

  it('explains a native coin when the page is about it', () => {
    const found: Found[] = [{ candidate: { coingeckoId: 'bitcoin' }, source: 'url', score: 10 }];
    const state = askState(found, [{ input: 'bitcoin', status: 'not-a-contract', message: 'Bitcoin is a coin…' }], false);
    expect(state).toEqual({ kind: 'message', text: 'Bitcoin is a coin…' });
  });

  it('matches CoinGecko answers to the coin id', () => {
    const found: Found[] = [{ candidate: { coingeckoId: 'pepe' }, source: 'url', score: 10 }];
    const state = askState(found, [token(PEPE, { input: 'pepe' })], false);
    expect(state?.kind === 'ask' && state.tokens).toHaveLength(1);
  });

  it('shows nothing when nothing on the page trades', () => {
    const found: Found[] = [{ candidate: { address: WALLET }, source: 'text', score: 2 }];
    expect(askState(found, [{ input: WALLET, status: 'not-found' }], false)).toBeNull();
  });
});
