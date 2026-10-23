import { askState, scanAll, send } from './flow';
import { findTokens } from './readers/page';
import { candidateKey } from './readers/types';
import { modeFor } from './settings';
import { renderCard, tokenLabel, type CardState } from './ui/card';
import css from './ui/card.css';

/**
 * Runs on the named trading sites and on sites the user remembered. Watches for the
 * token on screen and asks "Run scan?". Nothing leaves the browser until the user says
 * yes, unless they picked "Scan automatically" for this site.
 */

const HOST_ID = 'blockfisher-auto-scan';
const POLL_MS = 1_000;
/** Pages on unknown sites often fill in after load; look again once. */
const SECOND_LOOK_MS = 3_000;

let root: HTMLElement | null = null;
let lastKey = '';
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

function hide() {
  root?.replaceChildren();
}

function show(state: CardState, key: string) {
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
    hide();
    return;
  }

  const mode = await modeFor(location.hostname);
  if (mode === 'off' || lastKey !== key) return;

  const reply = await send({ type: 'identify', candidates: found.map((item) => item.candidate) });
  if (lastKey !== key) return;
  if (!reply.ok) {
    // Say so rather than stay hidden, or it looks like the extension isn't working.
    show({ kind: 'message', text: `Blockfisher couldn’t check this token right now. ${reply.text}` }, key);
    return;
  }
  const state = askState(found, reply.tokens, false);
  if (!state) {
    hide();
    return;
  }
  if (mode === 'auto' && state.kind === 'ask') {
    await runScans(state.tokens.slice(0, 1), key);
    return;
  }
  show(state, key);
}

let lastHref = '';

/** Reads the page again only when its address changes; these sites switch pages without reloading. */
function tick() {
  if (location.href === lastHref) return;
  lastHref = location.href;
  void check();
}

tick();
window.setInterval(tick, POLL_MS);
window.addEventListener('popstate', tick);
window.setTimeout(() => {
  if (lastKey) return;
  lastHref = '';
  tick();
}, SECOND_LOOK_MS);
