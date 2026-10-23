/**
 * The "going underwater" moment when scan results open: water rises over the card with
 * a moving wave and bubbles, then clears to show the results. Pure CSS animation; the
 * layer removes itself when done, and is skipped for people who prefer less motion.
 */

/** When the water has cleared (see .bf-dive in card.css). */
export const DIVE_CLEAR_MS = 1_700;

const BUBBLES = [
  { left: 12, size: 8, delay: 0.1 },
  { left: 24, size: 5, delay: 0.35 },
  { left: 38, size: 10, delay: 0.2 },
  { left: 52, size: 6, delay: 0.5 },
  { left: 63, size: 9, delay: 0.05 },
  { left: 74, size: 4, delay: 0.4 },
  { left: 86, size: 7, delay: 0.25 },
  { left: 93, size: 5, delay: 0.55 },
];

const WAVE =
  '<svg viewBox="0 0 240 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10 Q 30 0 60 10 T 120 10 T 180 10 T 240 10 V 20 H 0 Z"/></svg>';

export function diveLayer(): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'bf-dive';
  layer.setAttribute('aria-hidden', 'true');

  const water = document.createElement('div');
  water.className = 'bf-dive__water';
  const wave = document.createElement('div');
  wave.className = 'bf-dive__wave';
  // A fixed, trusted string: two copies side by side so the wave can slide seamlessly.
  wave.innerHTML = WAVE + WAVE;
  water.append(wave);

  for (const bubble of BUBBLES) {
    const dot = document.createElement('span');
    dot.className = 'bf-dive__bubble';
    dot.style.left = `${bubble.left}%`;
    dot.style.width = dot.style.height = `${bubble.size}px`;
    dot.style.animationDelay = `${bubble.delay}s`;
    water.append(dot);
  }

  layer.append(water);
  layer.addEventListener('animationend', (event) => {
    if (event.target === layer) layer.remove();
  });
  return layer;
}
