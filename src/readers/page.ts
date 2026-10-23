import { isCommonToken, isTokenAddress } from './address';
import { readUrl, siteOf } from './url';
import { candidateKey, type Candidate, type Found, type Network } from './types';

/** Explorer token pages. A link to one of these is a strong hint. */
const EXPLORERS: ReadonlyArray<{ host: string; network: Network; path: RegExp }> = [
  { host: 'etherscan.io', network: 'eth', path: /^\/token\/([^/?#]+)/ },
  { host: 'basescan.org', network: 'base', path: /^\/token\/([^/?#]+)/ },
  { host: 'bscscan.com', network: 'bsc', path: /^\/token\/([^/?#]+)/ },
  { host: 'solscan.io', network: 'sol', path: /^\/token\/([^/?#]+)/ },
  { host: 'pump.fun', network: 'sol', path: /^\/(?:coin\/)?([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/ },
];

const LINK_SCORE = 6;
const TEXT_NEAR_LABEL_SCORE = 4;
const TEXT_SCORE = 2;
const MAX_RESULTS = 5;
const MAX_TEXT_CHARS = 300_000;

const ADDRESS_IN_TEXT = /0x[a-fA-F0-9]{40}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
/** Words that sit next to a token's own address. */
const LABEL = /\b(CA|contract|token address|mint|address)\b\s*[:：]?\s*$/i;

/** Parts of a page full of addresses that aren't the token: wallet buttons, trade lists, forms. */
const SKIP = 'script, style, noscript, template, textarea, input, select, code[class*="wallet" i], [aria-hidden="true"], table, nav';

function fromLink(href: string, base: string): Found[] {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return [];
  }
  const named = readUrl(url.href);
  if (named.length > 0) return named.slice(0, 1).map((found) => ({ ...found, source: 'link', score: LINK_SCORE }));

  const host = url.hostname.replace(/^www\./, '');
  for (const explorer of EXPLORERS) {
    if (host !== explorer.host) continue;
    const value = url.pathname.match(explorer.path)?.[1];
    if (value && isTokenAddress(value)) {
      return [{ candidate: { address: value, network: explorer.network }, source: 'link', score: LINK_SCORE, common: isCommonToken(value) }];
    }
  }
  return [];
}

function* visibleText(root: ParentNode, doc: Document): Generator<Text> {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue && node.nodeValue.length >= 32 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) yield node as Text;
}

function labelBefore(node: Text, index: number): boolean {
  const before = (node.nodeValue ?? '').slice(Math.max(0, index - 40), index);
  if (LABEL.test(before)) return true;
  // "Contract" is often in its own element just before the address.
  const previous = node.parentElement?.previousElementSibling?.textContent ?? '';
  return before.trim() === '' && LABEL.test(previous.slice(-40));
}

/**
 * Finds tokens on any page: first links to charts and explorers, then addresses in the
 * visible text. Returns at most five, best first. /api/identify drops the ones that
 * don't trade, which removes most wallet addresses.
 */
export function readPage(doc: Document, href: string): Found[] {
  const best = new Map<string, Found>();
  const add = (found: Found) => {
    const key = candidateKey(found.candidate);
    const seen = best.get(key);
    if (!seen) {
      best.set(key, found);
      return;
    }
    const network = (seen.candidate as { network?: Network }).network ?? (found.candidate as { network?: Network }).network;
    const merged: Candidate = 'address' in seen.candidate ? { ...seen.candidate, network } : seen.candidate;
    best.set(key, { ...(found.score > seen.score ? found : seen), candidate: merged, score: Math.max(seen.score, found.score) + 1 });
  };

  for (const found of readUrl(href)) add(found);

  for (const anchor of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    if (anchor.closest('nav, footer')) continue;
    for (const found of fromLink(anchor.getAttribute('href') ?? '', href)) add(found);
  }

  let budget = MAX_TEXT_CHARS;
  for (const node of visibleText(doc.body ?? doc, doc)) {
    const text = node.nodeValue ?? '';
    budget -= text.length;
    if (budget < 0) break;
    for (const match of text.matchAll(ADDRESS_IN_TEXT)) {
      const value = match[0];
      if (!isTokenAddress(value)) continue;
      add({
        candidate: { address: value },
        source: 'text',
        score: labelBefore(node, match.index ?? 0) ? TEXT_NEAR_LABEL_SCORE : TEXT_SCORE,
        common: isCommonToken(value),
      });
    }
  }

  return rank([...best.values()]);
}

/** Best first, common tokens (SOL, USDC, ...) last, at most five. */
export function rank(found: readonly Found[]): Found[] {
  return [...found].sort((a, b) => Number(Boolean(a.common)) - Number(Boolean(b.common)) || b.score - a.score).slice(0, MAX_RESULTS);
}

/**
 * What to offer on this page. On the named sites the page address says which token is
 * open; their trending bars and lists are full of other tokens, so we don't read the page.
 */
export function findTokens(doc: Document, href: string): Found[] {
  const fromUrl = readUrl(href);
  if (fromUrl.length > 0 || siteOf(new URL(href).hostname)) return fromUrl;
  return readPage(doc, href);
}
