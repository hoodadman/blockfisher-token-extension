import { askState, autoStep, badgeFor, scanAll, send } from './flow';
import { findTokens } from './readers/page';
import { candidateKey } from './readers/types';
import { loadSettings, hostKey } from './settings';
import { renderCard, tokenLabel, type CardState } from './ui/card';
import css from './ui/card.css';

/**
 * Runs on the named trading sites and on sites the user remembered. Watches for the
 * token on screen and asks "Run scan?". What it does follows the user's switches: auto
 * scan (watch at all), auto pop up (show the card, or only the icon's badge) and confirm
 * token (ask first, or scan straight away). Nothing leaves the browser until a scan runs.
 */

const HOST_ID = 'blockfisher-auto-scan';
const POLL_MS = 1_000;
/** Pages fill in after load, so while nothing is found keep looking for this many seconds. */
const EMPTY_LOOKS = 10;

let root: HTMLElement | null = null;
let lastKey = '';
/** What the card shows, or would show; the popup reads it when the card stays hidden. */
let current: CardState | null = null;
let popup = true;
const dismissed = new Set<string>();

function mount(): HTMLElement {
  if (root) return root;
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = css;
  root = document.createElement('div');
  shadow.append(style, root);
  document.documentElement.append(host);
  return root;
}

function badge(state: CardState | null) {
  chrome.runtime.sendMessage({ type: 'badge', ...badgeFor(state) }).catch(() => undefined);
}

function hide() {
  root?.replaceChildren();
}

function clear() {
  current = null;
  hide();
  badge(null);
}

/** Records the state, shows it on the page when pop ups are on, and updates the badge. */
function show(state: CardState, key: string) {
  current = state;
  badge(state);
  if (!popup) {
    hide();
    return;
  }
  renderCard(mount(), state, {
    onDismiss() {
      dismissed.add(key);
      hide();
    },
    onScan(tokens) {
      void runScans(tokens, key);
    },
  });
}

async function runScans(tokens: Parameters<typeof scanAll>[0], key: string) {
  show({ kind: 'loading', label: `Checking ${tokens.map(tokenLabel).join(', ')}` }, key);
  const results = await scanAll(tokens);
  if (lastKey === key) show(results, key);
}

async function check() {
  const found = findTokens(document, location.href);
  const key = found.map((item) => candidateKey(item.candidate)).join('|');
  if (key === lastKey) return;
  lastKey = key;
  if (!key || dismissed.has(key)) {
    clear();
    return;
  }

  const settings = await loadSettings();
  if (lastKey !== key) return;
  const { switches } = settings;
  popup = switches.autoPopup;
  if (!switches.autoScan || settings.modes[hostKey(location.hostname)] === 'off') {
    clear();
    return;
  }

  const reply = await send({ type: 'identify', candidates: found.map((item) => item.candidate) });
  if (lastKey !== key) return;
  if (!reply.ok) {
    // Say so rather than stay hidden, or it looks like the extension isn't working.
    show({ kind: 'message', text: `Blockfisher couldn’t check this token right now. ${reply.text}` }, key);
    return;
  }
  const state = askState(found, reply.tokens, false);
  if (!state) {
    clear();
    return;
  }
  if (state.kind === 'ask' && autoStep(state, switches) === 'scan') {
    await runScans(state.tokens.slice(0, 1), key);
    return;
  }
  show(state, key);
}

let lastHref = '';
let emptyLooks = 0;

/**
 * Reads the page again when its address changes (these sites switch pages without
 * reloading), and every second for a while when nothing has been found yet.
 */
function tick() {
  if (location.href !== lastHref) {
    lastHref = location.href;
    emptyLooks = 0;
    void check();
    return;
  }
  if (!lastKey && emptyLooks < EMPTY_LOOKS) {
    emptyLooks += 1;
    void check();
  }
}

/** Looks at the page afresh, for when the switches change. */
function recheck() {
  lastKey = '';
  lastHref = '';
  tick();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.switches || changes.modes)) recheck();
});

// The toolbar popup asks for the card when it isn't on the page.
chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message?.type !== 'current') return false;
  sendResponse(current);
  return false;
});

tick();
window.setInterval(tick, POLL_MS);
window.addEventListener('popstate', tick);
