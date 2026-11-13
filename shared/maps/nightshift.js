// NIGHTSHIFT — a compact rooftop at night. Fast, close-range fights around a raised centre
// platform with a ramp on every side.

import { COLORS, createBuilder, side } from './builder.js';

const m = createBuilder();
const { box, ramp, decal, strip, prop } = m;
const SLATE = 0x565b78, PANEL = 0x7d83a3, DEEP = 0x2c2f47, CYAN = 0x4fe3ff;

m.arena(24, 18, { floor: SLATE, wall: DEEP, wallHeight: 5 });

// raised centre with a pillar for cover
box(0, 0, 10, 10, 2.2, { color: PANEL, kind: 'platform' });
box(0, 0, 2.4, 2.4, 1.5, { y: 2.2, color: DEEP });
box(0, 0, 2.5, 2.5, 0.12, { y: 3.7, color: CYAN });

for (const s of [1, -1]) {
  const { A, B, flip } = side(s);

  m.base(s, 24, { cover: 6, spread: 4, coverColor: PANEL });

  // four ramps onto the centre platform (two per pass of this loop)
  ramp(s * -10, s * -5, -1.5, 1.5, 0, 2.2, [s, 0], { color: COLORS.lime });
  ramp(-1.5, 1.5, s * -10, s * -5, 0, 2.2, [0, s], { color: CYAN });
  // rails on the platform edges, leaving the ramp openings clear
  box(s * -4.94, -3.25, 0.12, 3.5, 1.0, { y: 2.2, rail: true, color: CYAN });
  box(s * -4.94, 3.25, 0.12, 3.5, 1.0, { y: 2.2, rail: true, color: CYAN });
  box(-3.25, s * -4.94, 3.5, 0.12, 1.0, { y: 2.2, rail: true, color: COLORS.lime });
  box(3.25, s * -4.94, 3.5, 0.12, 1.0, { y: 2.2, rail: true, color: COLORS.lime });

  // rooftop structures
  box(s * -15.5, s * -12, 6, 6, 5, { color: B, kind: 'building' });
  decal(s === 1 ? 'N1' : 'N2', s * -15.5, 2.9, s * -8.97, flip, 2.6);
  box(s * -15, s * 12.5, 7, 4, 3.2, { color: PANEL, kind: 'building' });
  prop(s === 1 ? 'antenna' : 'dish', s * -15.5, 5, s * -12);

  // cover
  box(s * -8, s * -8, 2.6, 6.4, 2.7, { color: A, kind: 'container' });
  box(s * -13, s * 3.5, 2, 2, 1.2, { color: PANEL });
  box(s * -12, s * -3.5, 1.6, 1.6, 1.3, { color: DEEP });
  box(s * -6, s * 13, 2, 2, 1.2, { color: PANEL });
  box(s * -3, s * -14.5, 2.4, 1.6, 1.2, { color: DEEP });
  box(s * -8, s * 7.5, 0.7, 3.5, 1.3, { color: PANEL });

  strip(s * -11.5, 0, 0.2, 30, CYAN);
  strip(0, s * -11.5, 20, 0.2, COLORS.lime);
}

export default m.finish({
  id: 'nightshift',
  name: 'NIGHTSHIFT',
  blurb: 'Small rooftop at night; close-range fights.',
  theme: {
    sky: [0x0b1030, 0x232a63, 0x6a3f8f, 0x1a1436],
    fog: 0x2a2350,
    fogRange: [60, 300],
    hemi: [0x9aa6ff, 0x4a3a6a, 1.55],
    sun: [0xc4d2ff, 1.5],
    sunPos: [22, 50, -26],
    clouds: [0x3b3270, 0x4a3a80, 0x2d2a5c],
    glowStrips: true,
    hull: DEEP,
  },
});
