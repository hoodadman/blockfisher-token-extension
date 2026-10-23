import { askState, scanAll, send } from './flow';
import type { Found } from './readers/types';
import { siteOf } from './readers/url';
import { hostKey, loadSettings } from './settings';
import { rememberSite, requestSite } from './sites';
import { renderCard, tokenLabel, type CardState } from './ui/card';
import { renderSwitches } from './ui/switches';

/**
 * The toolbar popup. Works on any page: clicking the icon lets us read that one tab
 * (activeTab), and on sites we don't know it offers to remember the site.
 */

const root = document.getElementById('root') as HTMLElement;

function show(state: CardState, host?: string) {
  renderCard(root, state, {
    onDismiss: () => window.close(),
    onScan(tokens, remember) {
      // Chrome only shows its permission prompt inside the click, so ask before any await.
      const allowed = remember && host ? requestSite(host) : Promise.resolve(false);
      void (async () => {
        if (host && (await allowed)) await rememberSite(host);
        await runScans(tokens);
      })();
    },
  });
}

async function runScans(tokens: Parameters<typeof scanAll>[0]) {
  show({ kind: 'loading', label: `Checking ${tokens.map(tokenLabel).join(', ')}` });
  show(await scanAll(tokens));
}

/** The card the page already has, when auto pop up is off or the card was closed. */
async function fromPage(tabId: number): Promise<CardState | null> {
  try {
    const state = (await chrome.tabs.sendMessage(tabId, { type: 'current' })) as CardState | null;
    return state && state.kind !== 'loading' ? state : null;
  } catch {
    // No page reader on this tab.
    return null;
  }
}

async function readTab(tabId: number): Promise<Found[]> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['reader.js'] });
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (globalThis as { __blockfisherFound?: unknown }).__blockfisherFound,
  });
  return Array.isArray(result?.result) ? (result.result as Found[]) : [];
}

async function start() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ? new URL(tab.url) : null;
  if (!tab?.id || !url || url.protocol !== 'https:') {
    show({ kind: 'message', text: 'Open a token page on a trading site, then click Blockfisher again.' });
    return;
  }

  const host = hostKey(url.hostname);
  const onPage = await fromPage(tab.id);
  if (onPage) {
    show(onPage, host);
    return;
  }

  show({ kind: 'loading', label: 'Looking for tokens on this page' });
  let found: Found[];
  try {
    found = await readTab(tab.id);
  } catch {
    show({ kind: 'message', text: 'Chrome doesn’t let extensions read this page.' });
    return;
  }
  if (found.length === 0) {
    show({ kind: 'message', text: 'We couldn’t find a token on this page. Open the token’s own page and try again.' });
    return;
  }

  const reply = await send({ type: 'identify', candidates: found.map((item) => item.candidate) });
  if (!reply.ok) {
    show({ kind: 'message', text: reply.text });
    return;
  }
  const settings = await loadSettings();
  const offerRemember = !siteOf(url.hostname) && !settings.remembered.includes(host);
  const state = askState(found, reply.tokens, offerRemember);
  // Keep the question when it carries the "remember this site" choice.
  if (state?.kind === 'ask' && !offerRemember && !settings.switches.confirmToken) {
    await runScans(state.tokens.slice(0, 1));
    return;
  }
  show(state ?? { kind: 'message', text: 'The addresses on this page don’t trade anywhere we can see, so there’s nothing to scan.' }, host);
}

void start();
void renderSwitches(document.getElementById('switches') as HTMLElement);
document.getElementById('more')?.addEventListener('click', () => void chrome.runtime.openOptionsPage());
