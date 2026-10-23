import type { ScanReport } from '../api';
import type { IdentifiedToken } from '../readers/types';
import { fillUp, scoreChart } from './chart';
import { DIVE_CLEAR_MS, diveLayer } from './dive';

/**
 * The "Run scan?" card and the results. Plain DOM, so it can live in a shadow root on any
 * page (content script) or in the toolbar popup.
 */

export type CardState =
  | { kind: 'ask'; tokens: IdentifiedToken[]; notes: string[]; offerRemember: boolean }
  | { kind: 'loading'; label: string }
  | {
      kind: 'results';
      results: Array<{ token: IdentifiedToken; report?: ScanReport; error?: string }>;
      /** Other tokens on the page, not scanned yet: offered as "Scan X as well?". */
      more?: IdentifiedToken[];
      /** How many results were already shown (and animated) before; only newer ones animate. */
      shown?: number;
    }
  | { kind: 'message'; text: string; offerRemember?: boolean };

export interface CardHandlers {
  onScan(tokens: IdentifiedToken[], remember: boolean): void;
  onDismiss(): void;
  /** Scan one more of the page's tokens and add it to the results. */
  onScanMore?(token: IdentifiedToken): void;
  /** Turn on auto scan for this site. Only offered in the toolbar popup on unknown sites. */
  onRemember?(): void;
}

type Tone = 'green' | 'yellow' | 'orange' | 'red' | 'none';

/** Same colour steps as the scanner website. */
export function toneFor(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return 'none';
  if (score >= 90) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 30) return 'orange';
  return 'red';
}

/** Same risk bands as the scanner: 80 and up is low risk, under 40 is high. */
function riskWords(score: number | null): string {
  if (score === null) return 'Not enough data to score';
  if (score >= 80) return 'Low risk';
  if (score >= 40) return 'Medium risk';
  return 'High risk';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const tokenLabel = (token: IdentifiedToken) => {
  const name = token.symbol || token.name || 'This token';
  return token.chainName ? `${name} on ${token.chainName}` : name;
};

function header(onDismiss: () => void, closeLabel = 'Close'): HTMLElement {
  const bar = el('div', 'bf__bar');
  bar.append(el('span', 'bf__brand', 'Blockfisher'));
  const close = el('button', 'bf__close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', closeLabel);
  close.addEventListener('click', onDismiss);
  bar.append(close);
  return bar;
}

function askView(state: Extract<CardState, { kind: 'ask' }>, handlers: CardHandlers): HTMLElement {
  const body = el('div', 'bf__body');
  const { tokens } = state;
  if (tokens.length === 1) {
    body.append(el('p', 'bf__question', `Blockfisher found ${tokenLabel(tokens[0])}. Run a safety scan?`));
  } else {
    body.append(el('p', 'bf__question', `Blockfisher found ${tokens.length} tokens on this page. Which should we check? You can pick more than one.`));
  }

  const boxes: Array<{ box: HTMLInputElement; token: IdentifiedToken }> = [];
  if (tokens.length > 1) {
    const list = el('ul', 'bf__list');
    tokens.forEach((token, index) => {
      const item = el('li');
      const label = el('label', 'bf__pick');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = index === 0;
      label.append(box, el('span', undefined, tokenLabel(token)));
      if (token.address) label.append(el('span', 'bf__address', shortAddress(token.address)));
      item.append(label);
      list.append(item);
      boxes.push({ box, token });
    });
    body.append(list);
  }

  for (const note of state.notes) body.append(el('p', 'bf__note', note));

  let remember: HTMLInputElement | undefined;
  if (state.offerRemember) {
    const label = el('label', 'bf__remember');
    remember = el('input');
    remember.type = 'checkbox';
    label.append(remember, el('span', undefined, 'Run auto scan on this site in future'));
    body.append(label);
  }

  const actions = el('div', 'bf__actions');
  const go = el('button', 'bf__primary', 'Scan');
  go.type = 'button';
  go.addEventListener('click', () => {
    const chosen = tokens.length === 1 ? tokens : boxes.filter((item) => item.box.checked).map((item) => item.token);
    if (chosen.length > 0) handlers.onScan(chosen, remember?.checked ?? false);
  });
  const later = el('button', 'bf__secondary', 'Not now');
  later.type = 'button';
  later.addEventListener('click', handlers.onDismiss);
  actions.append(go, later);
  body.append(actions);
  return body;
}

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function scoreBox(label: string, score: number | null | undefined): HTMLElement {
  const box = el('div', `bf__score bf__score--${toneFor(score)}`);
  box.append(el('span', 'bf__score-value', score === null || score === undefined ? '–' : String(score)), el('span', 'bf__score-label', label));
  return box;
}

function reportView(token: IdentifiedToken, report: ScanReport): HTMLElement {
  const card = el('section', 'bf__report');
  const title = el('div', 'bf__report-title');
  title.append(el('strong', undefined, report.symbol || report.name || tokenLabel(token)), el('span', 'bf__muted', ` on ${report.chain.name}`));
  card.append(title);

  card.append(
    scoreChart(report.overall, [
      { id: 'security', label: 'Security', score: report.security.score },
      { id: 'community', label: 'Community', score: report.community?.score },
      { id: 'foundation', label: 'Foundation', score: report.foundation.score },
    ]),
    el('p', `bf__overall-label bf__score--${toneFor(report.overall)}`, riskWords(report.overall)),
  );

  const row = el('div', 'bf__scores');
  row.append(scoreBox('Security', report.security.score), scoreBox('Community', report.community?.score), scoreBox('Foundation', report.foundation.score));
  card.append(row);

  const top = report.security.issues.slice(0, 3);
  if (top.length > 0) {
    const list = el('ul', 'bf__issues');
    for (const issue of top) {
      const item = el('li', `bf__issue bf__issue--${issue.severity}`);
      item.append(el('strong', undefined, issue.title), el('span', undefined, ` ${issue.summary}`));
      list.append(item);
    }
    card.append(list);
  }

  const brief = el('div', 'bf__brief');
  brief.append(
    el('p', undefined, report.brief.security),
    el('p', undefined, report.brief.community),
    el('p', undefined, report.brief.foundation),
  );
  card.append(brief);

  if (report.failures.length > 0 || report.security.notChecked.length > 0) {
    card.append(el('p', 'bf__note', 'Some checks couldn’t run, so treat this score as unfinished rather than clear.'));
  }
  card.append(el('p', 'bf__small', 'Not financial advice. A low-risk score doesn’t mean a token will go up.'));
  return card;
}

export function renderCard(root: HTMLElement, state: CardState, handlers: CardHandlers): void {
  root.replaceChildren();
  const card = el('div', 'bf');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Blockfisher token scan');
  card.append(header(handlers.onDismiss));

  if (state.kind === 'ask') card.append(askView(state, handlers));
  if (state.kind === 'loading') {
    const body = el('div', 'bf__body');
    body.append(el('p', 'bf__loading', state.label));
    card.append(body);
  }
  if (state.kind === 'message') {
    const body = el('div', 'bf__body');
    body.append(el('p', undefined, state.text));
    if (state.offerRemember && handlers.onRemember) {
      const remember = el('button', 'bf__secondary', 'Run auto scan on this site in future');
      remember.type = 'button';
      remember.addEventListener('click', handlers.onRemember);
      body.append(remember);
    }
    card.append(body);
  }
  if (state.kind === 'results') {
    const body = el('div', 'bf__body');
    const shown = state.shown ?? 0;
    const fresh: HTMLElement[] = [];
    state.results.forEach((result, index) => {
      const view = result.report
        ? reportView(result.token, result.report)
        : el('p', 'bf__note', `${tokenLabel(result.token)}: ${result.error ?? 'The scan didn’t finish.'}`);
      if (index >= shown) fresh.push(view);
      body.append(view);
    });
    for (const token of state.more ?? []) {
      if (!handlers.onScanMore) break;
      const more = el('button', 'bf__secondary bf__more', `Scan ${token.symbol || token.name || 'the other token'} as well?`);
      more.type = 'button';
      more.addEventListener('click', () => {
        more.disabled = true;
        more.textContent = `Checking ${tokenLabel(token)}…`;
        handlers.onScanMore?.(token);
      });
      body.append(more);
    }
    card.append(body);
    const charts = fresh.flatMap((view) => Array.from(view.querySelectorAll<HTMLElement>('.bf-chart')));
    if (shown === 0) {
      if (charts.length > 0) {
        card.classList.add('bf--dive');
        card.append(diveLayer());
        // Once the water clears, fill the triangles up to their scores.
        charts.forEach((chart) => fillUp(chart, DIVE_CLEAR_MS));
      }
    } else {
      // A token added with "as well?": no second dive, just fill its triangle and show it.
      charts.forEach((chart) => fillUp(chart, 0));
      requestAnimationFrame(() => fresh[0]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }));
    }
  }
  root.append(card);
}
