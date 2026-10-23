import { toneFor } from './card';

/**
 * The scanner website's score triangle: one petal per pillar, filled from the centre by
 * its score, with the overall score in the middle. Plain SVG so it works in the page card.
 */

export interface Pillar {
  id: 'security' | 'community' | 'foundation';
  label: string;
  score: number | null | undefined;
}

const SVG = 'http://www.w3.org/2000/svg';
const CX = 180;
const CY = 168;
const TIP = 128;
const INNER = 62;
const SPREAD = 34;
/** The drawing only uses this band of the 360-wide square, so crop to it. */
export const TOP = 4;
export const HEIGHT = 254;
const ANGLES: Record<Pillar['id'], number> = { security: 0, community: 120, foundation: 240 };

type Point = { x: number; y: number };

function polar(radius: number, deg: number): Point {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

const points = (...corners: Point[]) => corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

export function scoreChart(overall: number | null, pillars: readonly Pillar[]): HTMLElement {
  const box = document.createElement('div');
  box.className = `bf-chart bf-chart--${toneFor(overall)}`;

  const chart = svg('svg', { viewBox: `0 ${TOP} 360 ${HEIGHT}`, class: 'bf-chart__svg', role: 'img' });
  const described = pillars.map((p) => `${p.label} ${p.score ?? 'no score'}`).join(', ');
  chart.setAttribute('aria-label', `Overall ${overall ?? 'no score'} out of 100. ${described}.`);

  for (const pillar of pillars) {
    const angle = ANGLES[pillar.id];
    const tip = polar(TIP, angle);
    const left = polar(INNER, angle - SPREAD);
    const right = polar(INNER, angle + SPREAD);
    const mid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    const fill = Math.max(0, Math.min(100, pillar.score ?? 0)) / 100;
    const fillTip = { x: mid.x + (tip.x - mid.x) * fill, y: mid.y + (tip.y - mid.y) * fill };
    const label = polar(TIP + 22, angle);

    const petal = svg('g', { class: `bf-chart__petal bf-chart__petal--${toneFor(pillar.score)}` });
    const title = svg('title', {});
    title.textContent = pillar.score === null || pillar.score === undefined ? `${pillar.label}: no score yet` : `${pillar.label}: ${pillar.score} / 100`;
    petal.append(title, svg('polygon', { class: 'bf-chart__track', points: points(tip, left, right) }));
    if (fill > 0) {
      const empty = points(mid, left, right);
      petal.append(svg('polygon', { class: 'bf-chart__fill', points: points(fillTip, left, right), 'data-empty': empty }));
    }
    const text = svg('text', { class: 'bf-chart__label', x: label.x.toFixed(1), y: label.y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    text.textContent = pillar.label;
    petal.append(text);
    chart.append(petal);
  }
  chart.append(svg('circle', { class: 'bf-chart__ring', cx: CX, cy: CY, r: 50 }), svg('circle', { class: 'bf-chart__core', cx: CX, cy: CY, r: 46 }));

  const centre = document.createElement('div');
  centre.className = 'bf-chart__centre';
  const value = document.createElement('span');
  value.className = 'bf__overall-value';
  value.textContent = overall === null ? '?' : String(overall);
  const max = document.createElement('span');
  max.className = 'bf-chart__max';
  max.textContent = overall === null ? 'no score' : 'out of 100';
  centre.append(value, max);

  box.append(chart, centre);
  return box;
}

const FILL_MS = 900;
const STAGGER_MS = 150;

/**
 * Empties the petals, then fills each one up to its score after `delayMs`, one after the
 * other. Does nothing for people who prefer less motion, so the chart just shows.
 */
export function fillUp(chart: HTMLElement, delayMs: number): void {
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  chart.querySelectorAll<SVGPolygonElement>('.bf-chart__fill').forEach((fill, index) => {
    const full = fill.getAttribute('points');
    const empty = fill.getAttribute('data-empty');
    if (!full || !empty) return;
    fill.setAttribute('points', empty);
    const grow = svg('animate', {
      attributeName: 'points',
      from: empty,
      to: full,
      dur: `${FILL_MS}ms`,
      begin: 'indefinite',
      fill: 'freeze',
      calcMode: 'spline',
      keyTimes: '0;1',
      keySplines: '0.2 0.7 0.3 1',
    });
    fill.append(grow);
    setTimeout(() => {
      // If animation is unavailable, still end up with the right shape.
      if (typeof grow.beginElement === 'function') grow.beginElement();
      else fill.setAttribute('points', full);
    }, delayMs + index * STAGGER_MS);
    setTimeout(() => fill.setAttribute('points', full), delayMs + index * STAGGER_MS + FILL_MS + 50);
  });
}
