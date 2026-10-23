import { NETWORK_BY_DEXSCREENER, isCommonToken, isSolanaAddress, isTokenAddress } from './address';
import { dexScreenerPath, readAnyUrl, readUrl, siteOf } from './url';
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
  for (const found of readAnyUrl(href)) add(found);

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

const BASE58_RUN = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

/**
 * DexScreener puts Solana pair addresses in its page address in lower case, which isn't a
 * valid address. The page itself (links, scripts) carries the real spelling, so find the
 * one string that matches it ignoring case.
 */
function fromDexScreenerPage(doc: Document, href: string): Found[] {
  const path = dexScreenerPath(href);
  if (!path) return [];
  const wanted = path.value.toLowerCase();
  if (!/^[1-9a-z]{32,44}$/.test(wanted)) return [];
  for (const match of (doc.documentElement?.innerHTML ?? '').matchAll(BASE58_RUN)) {
    const value = match[0];
    if (value.toLowerCase() === wanted && isSolanaAddress(value)) {
      return [{ candidate: { address: value, network: NETWORK_BY_DEXSCREENER[path.chainId], chainId: path.chainId }, source: 'url', score: 10 }];
    }
  }
  return [];
}

/** "Bittensor (TAO)", "Bittensor price today, TAO to USD", "Bittensor TAO Price". */
const TITLE_PATTERNS = [
  /^\s*([A-Za-z][\w .'&-]{1,40}?)\s*\(\$?([A-Za-z0-9]{2,10})\)/,
  /^\s*([A-Za-z][\w .'&-]{1,40}?) price today,?\s+\$?([A-Za-z0-9]{2,10}) to [A-Z]{3}/i,
  /^\s*([A-Za-z][\w .'&-]{1,40}?)\s+\$?([A-Z0-9]{2,10})\s+price\b/i,
];

/**
 * Pages about a coin that has no address of its own on the page (Bitcoin, TAO): read the
 * coin's name and ticker from the page title. Identify only accepts a CoinGecko coin whose
 * name and ticker both match, so a stray title doesn't turn into a wrong token.
 */
export function readTitle(doc: Document): Found[] {
  const titles = [doc.querySelector('meta[property="og:title"]')?.getAttribute('content'), doc.title];
  for (const title of titles) {
    for (const pattern of TITLE_PATTERNS) {
      const match = title?.match(pattern);
      if (match) return [{ candidate: { coin: match[1].trim(), symbol: match[2].toUpperCase() }, source: 'title', score: 3 }];
    }
  }
  return [];
}

/**
 * What to offer on this page, from most to least certain:
 * 1. The page address, read by a site-specific reader or, on any site, for any address in it.
 * 2. On named sites, nothing else: their trending bars and lists are full of other tokens.
 * 3. Elsewhere, links and addresses on the page.
 * 4. Failing that, the coin named in the page title.
 */
export function findTokens(doc: Document, href: string): Found[] {
  const fromUrl = readUrl(href);
  if (fromUrl.length > 0) return fromUrl;
  if (siteOf(new URL(href).hostname)) {
    const anyUrl = readAnyUrl(href);
    return anyUrl.length > 0 ? rank(anyUrl) : fromDexScreenerPage(doc, href);
  }
  const onPage = readPage(doc, href);
  return onPage.length > 0 ? onPage : readTitle(doc);
}
