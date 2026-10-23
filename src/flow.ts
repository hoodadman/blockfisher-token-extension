import type { ScanReport } from './api';
import { candidateKey, type Candidate, type Found, type IdentifiedToken, type Network } from './readers/types';
import { tokenLabel, toneFor, type CardState } from './ui/card';

/** Messages between the page (content script, popup) and the background worker. */
export type Request =
  | { type: 'identify'; candidates: Candidate[] }
  | { type: 'scan'; address: string; network?: Network }
  | { type: 'badge'; text: string; color: string };

/** dropped: the background worker went away before answering. */
type Failure = { ok: false; text: string; dropped?: true };
export type IdentifyReply = { ok: true; tokens: IdentifiedToken[] } | Failure;
export type ScanReply = { ok: true; report: ScanReport } | Failure;

const DROPPED: Failure = { ok: false, text: 'Blockfisher stopped responding. Reload the page and try again.', dropped: true };

export function send(request: Extract<Request, { type: 'identify' }>): Promise<IdentifyReply>;
export function send(request: Extract<Request, { type: 'scan' }>): Promise<ScanReply>;
export function send(request: Request): Promise<IdentifyReply | ScanReply> {
  return chrome.runtime.sendMessage(request).then(
    (reply) => reply ?? DROPPED,
    () => DROPPED,
  );
}

const keyOfInput = (input: string) =>
  input.startsWith('name:') ? input : input.startsWith('0x') ? `addr:${input.toLowerCase()}` : input.length >= 32 ? `addr:${input}` : `cg:${input}`;

/**
 * Builds the "Run scan?" card from what the page reader found and what /api/identify said.
 * Keeps the reader's order (best first, common tokens last). Returns null when there is
 * nothing worth showing, so the card stays hidden.
 */
export function askState(found: readonly Found[], identified: readonly IdentifiedToken[], offerRemember: boolean): CardState | null {
  const byKey = new Map(found.map((item, index) => [candidateKey(item.candidate), { item, index }]));
  const placed = identified.map((token) => ({ token, from: byKey.get(keyOfInput(token.input)) }));
  placed.sort((a, b) => (a.from?.index ?? 99) - (b.from?.index ?? 99));

  const seen = new Set<string>();
  const tokens: IdentifiedToken[] = [];
  const notes: string[] = [];
  for (const { token, from } of placed) {
    if (token.status === 'token' && token.address) {
      const key = `${token.network}:${token.address.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(token);
    } else if (token.message && (from?.item.source === 'url' || from?.item.source === 'title') && token.status !== 'not-found') {
      // Only explain the token the page is about (Bitcoin on CoinGecko), never stray text.
      notes.push(token.message);
    }
  }
  if (tokens.length === 0) return notes.length > 0 ? { kind: 'message', text: notes[0] } : null;
  return { kind: 'ask', tokens: tokens.slice(0, 5), notes, offerRemember };
}

export const checkingLabel = (tokens: readonly IdentifiedToken[]) =>
  `Checking ${tokens.map(tokenLabel).join(', ')}. The first scan in a while can take up to a minute.`;

/** Scans the chosen tokens one after another and returns the results card. */
export async function scanAll(tokens: readonly IdentifiedToken[]): Promise<CardState> {
  const results: Extract<CardState, { kind: 'results' }>['results'] = [];
  for (const token of tokens) {
    if (!token.address) continue;
    let reply = await send({ type: 'scan', address: token.address, network: token.network });
    // The scanner keeps finished scans for ten minutes, so asking again picks up the result.
    if (!reply.ok && reply.dropped) reply = await send({ type: 'scan', address: token.address, network: token.network });
    results.push(reply.ok ? { token, report: reply.report } : { token, error: reply.text });
  }
  return { kind: 'results', results };
}

/** What the page card does next, given what was found and the user's switches. */
export function autoStep(state: CardState, switches: { autoPopup: boolean; confirmToken: boolean }): 'scan' | 'show' | 'badge' {
  if (state.kind === 'ask' && !switches.confirmToken) return 'scan';
  return switches.autoPopup ? 'show' : 'badge';
}

const BADGE_COLOURS = { green: '#12805c', yellow: '#a06a00', orange: '#c2410c', red: '#c0262d', none: '#5b6577' };

/**
 * The toolbar icon's badge for a card: how many tokens are waiting, or the score once
 * scanned. It's how the user sees what happened when the card doesn't pop up.
 */
export function badgeFor(state: CardState | null): { text: string; color: string } {
  if (!state) return { text: '', color: BADGE_COLOURS.none };
  if (state.kind === 'ask') return { text: String(state.tokens.length), color: '#0b5cd5' };
  if (state.kind === 'loading') return { text: '…', color: BADGE_COLOURS.none };
  if (state.kind === 'message') return { text: '!', color: BADGE_COLOURS.none };
  const report = state.results.find((result) => result.report)?.report;
  if (!report) return { text: '!', color: BADGE_COLOURS.red };
  return { text: report.overall === null ? '–' : String(report.overall), color: BADGE_COLOURS[toneFor(report.overall)] };
}
