import { bandFor } from './scoring';

const clamp = (level: number) => Number.isNaN(level) ? 0 : Math.max(0, Math.min(100, level));
export const needleAngle = (level: number): number => clamp(level) * 1.8 - 90;
let gaugeId = 0;

/** Inline SVG shared by the teaser, results, and compact progress indicator. */
export function renderGauge(container: HTMLElement, opts: { size?: 'mini' | 'full'; label?: string } = {}): { set(level: number, animate: boolean): void } {
  const doc = container.ownerDocument;
  const win = doc.defaultView!;
  const id = `quiz-gauge-gradient-${++gaugeId}`;
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 600 340');
  svg.setAttribute('role', 'img');
  svg.style.width = opts.size === 'mini' ? '96px' : '100%';
  svg.style.maxWidth = '600px';
  svg.style.fontFamily = 'var(--font-display, sans-serif)';
  svg.innerHTML = `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#d64545"/><stop offset="40%" stop-color="#e8a33d"/><stop offset="60%" stop-color="#e3cf4f"/><stop offset="80%" stop-color="#2db56f"/><stop offset="100%" stop-color="#9be4b9"/></linearGradient></defs>
    <path d="M 60 260 A 240 240 0 0 1 540 260" fill="none" stroke="url(#${id})" stroke-width="24" stroke-linecap="round"/>
    <g data-needle><path d="M 293 260 L 300 60 L 307 260 Z" fill="#9be4b9"/><circle cx="300" cy="260" r="13" fill="#2db56f"/></g>
    <text data-value x="300" y="218" text-anchor="middle" fill="#f1f5f2" font-size="76" font-weight="700" style="paint-order:stroke;stroke:var(--bg, #040806);stroke-width:8px">0</text>
    <text data-band x="300" y="316" text-anchor="middle" fill="#9be4b9" font-size="25" font-weight="700"></text>`;
  const needle = svg.querySelector('[data-needle]')!;
  const numeral = svg.querySelector('[data-value]')!;
  const label = svg.querySelector('[data-band]')!;
  container.replaceChildren(svg);
  let frame = 0;
  let current = 0;
  function draw(value: number) {
    current = value;
    needle.setAttribute('transform', `rotate(${value * 1.8 - 90} 300 260)`);
  }
  function set(level: number, animate: boolean) {
    win.cancelAnimationFrame(frame);
    const target = Math.round(clamp(level));
    const band = bandFor(target).label;
    svg.setAttribute('aria-label', `AI Level ${target} of 100, ${band}`);
    numeral.textContent = String(target);
    label.textContent = opts.label ?? band;
    if (!animate || win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(target);
      return;
    }
    const from = current;
    let start: number | undefined;
    const tick = (time: number) => {
      start ??= time;
      const t = Math.min(1, (time - start) / 1200);
      // Back easing with about 4% overshoot, ending exactly at the target.
      const c = 1.2;
      const eased = 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
      draw(from + (target - from) * eased);
      if (t < 1) frame = win.requestAnimationFrame(tick);
    };
    frame = win.requestAnimationFrame(tick);
  }
  set(0, false);
  return { set };
}
