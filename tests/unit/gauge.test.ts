import { describe, expect, it } from 'vitest';
// @ts-expect-error Node filesystem is provided by Vitest's runtime; this browser project omits @types/node.
import { readdirSync, readFileSync } from 'node:fs';
import { needleAngle } from '../../src/quiz/gauge';

describe('gauge', () => {
  it.each([[0, -90], [50, 0], [100, 90], [-5, -90], [130, 90]])('maps %s to %s degrees', (level, angle) => {
    expect(needleAngle(level)).toBe(angle);
  });
  it('ships exactly 101 email gauge PNGs at 600 × 340', () => {
    const dir = new URL('../../public/quiz/gauge/', import.meta.url);
    expect(readdirSync(dir).sort()).toEqual(Array.from({ length: 101 }, (_, i) => `${i}.png`).sort());
    for (let i = 0; i <= 100; i++) {
      const png = readFileSync(new URL(`${i}.png`, dir));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([600, 340]);
    }
  });
});

// The renderer only requires these SVG DOM operations; no browser dependency.
import { vi } from 'vitest';
import { renderGauge } from '../../src/quiz/gauge';
function fixture(reduced = false) {
  const nodes = Object.fromEntries(['[data-needle]', '[data-value]', '[data-band]'].map(key => [key, { setAttribute: vi.fn(), textContent: '' }]));
  const attrs = new Map<string, string>();
  const svg = { style: {}, innerHTML: '', setAttribute: (k: string, v: string) => attrs.set(k, v), querySelector: (key: string) => nodes[key] };
  const callbacks: FrameRequestCallback[] = [];
  let nextFrame = 0;
  const win = { cancelAnimationFrame: vi.fn(), requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => { callbacks.push(cb); return ++nextFrame; }), matchMedia: () => ({ matches: reduced }) };
  const container = { ownerDocument: { defaultView: win, createElementNS: () => svg }, replaceChildren: vi.fn() };
  return { container: container as unknown as HTMLElement, svg, attrs, nodes, win, callbacks };
}
it('sets an accessible clamped score with safe custom label text', () => {
  const f = fixture();
  const gauge = renderGauge(f.container, { size: 'mini', label: '<Progress>' });
  gauge.set(130, false);
  expect(f.attrs.get('aria-label')).toBe('AI Level 100 of 100, Full Speed');
  expect(f.nodes['[data-band]'].textContent).toBe('<Progress>');
  expect(f.nodes['[data-needle]'].setAttribute).toHaveBeenLastCalledWith('transform', 'rotate(90 300 260)');
});
it('honours reduced motion without scheduling frames', () => {
  const f = fixture(true);
  renderGauge(f.container).set(63, true);
  expect(f.win.requestAnimationFrame).not.toHaveBeenCalled();
  expect(f.attrs.get('aria-label')).toBe('AI Level 63 of 100, Accelerating');
});
it('animates for 1200ms with overshoot and cancels an interrupted animation', () => {
  const f = fixture();
  const gauge = renderGauge(f.container);
  gauge.set(50, true);
  f.callbacks.shift()!(0);
  f.callbacks.shift()!(900);
  const rotated = f.nodes['[data-needle]'].setAttribute.mock.lastCall![1];
  expect(Number(rotated.match(/rotate\(([^ ]+)/)![1])).toBeGreaterThan(0);
  f.callbacks.shift()!(1200);
  expect(f.nodes['[data-needle]'].setAttribute).toHaveBeenLastCalledWith('transform', 'rotate(0 300 260)');
  gauge.set(80, true);
  gauge.set(0, false);
  expect(f.win.cancelAnimationFrame).toHaveBeenLastCalledWith(4);
});
