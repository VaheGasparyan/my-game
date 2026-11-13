// DOCKYARD — a container terminal at midday. Tight lanes between stacked containers and two
// raised catwalks that overlook the middle.

import { COLORS, createBuilder, side } from './builder.js';

const m = createBuilder();
const { box, ramp, decal, strip, prop } = m;
const ASPHALT = 0xb4b8c2, STEEL = 0x6f7688, YELLOW = 0xf2c230;

m.arena(30, 22, { floor: ASPHALT, wall: 0x9aa0b0 });

// centre: a double stack that blocks the spawn-to-spawn sight line
box(0, 0, 6.4, 2.6, 2.7, { color: COLORS.white, kind: 'container' });
box(0, 0, 6.4, 2.6, 2.7, { y: 2.7, color: YELLOW, kind: 'container' });
strip(0, 0, 0.3, 42, YELLOW);

for (const s of [1, -1]) {
  const { A, B, flip } = side(s);

  m.base(s, 30, { cover: 7 });
  strip(s * -25.5, 0, 0.3, 18, YELLOW);

  // catwalk across the lane with a ramp at each end
  box(0, s * -10, 20, 3, 0.4, { y: 3.0, color: STEEL, kind: 'deck' });
  box(0, s * -11.44, 20, 0.12, 1.0, { y: 3.4, rail: true, color: YELLOW });
  box(0, s * -8.56, 20, 0.12, 1.0, { y: 3.4, rail: true, color: YELLOW });
  ramp(s * -18, s * -10, s * -11.5, s * -8.5, 0, 3.4, [s, 0], { color: YELLOW });
  ramp(s * 18, s * 10, s * -11.5, s * -8.5, 0, 3.4, [-s, 0], { color: YELLOW });
  box(s * -6, s * -10, 0.8, 0.8, 3.0, { color: STEEL });
  box(s * 6, s * -10, 0.8, 0.8, 3.0, { color: STEEL });

  // container yard
  box(s * -20, s * -15, 2.6, 6.4, 2.7, { color: A, kind: 'container' });
  box(s * -21, s * 5, 6.4, 2.6, 2.7, { color: B, kind: 'container' });
  box(s * -21, s * 5, 6.4, 2.6, 2.7, { y: 2.7, color: COLORS.white, kind: 'container' });
  decal(s === 1 ? 'D1' : 'D2', s * -21, 4.0, s * 6.33, flip, 2.2, '#2a2e45');
  box(s * -12, s * 16, 6.4, 2.6, 2.7, { color: A, kind: 'container' });
  box(s * -4, s * 17.5, 2.6, 6.4, 2.7, { color: B, kind: 'container' });
  box(s * -11, s * -2, 2.6, 6.4, 2.7, { color: COLORS.white, kind: 'container' });
  box(s * -6, s * -18.5, 6.4, 2.6, 2.7, { color: B, kind: 'container' });
  prop('antenna', s * -21, 5.4, s * 5);

  // crates and barriers
  box(s * -23, s * -13.5, 2, 2, 1.2, { color: YELLOW });
  box(s * -16, s * -5, 1.6, 1.6, 1.3);
  box(s * -6, s * 6, 2, 2, 1.2);
  box(s * -25, s * 13, 2.4, 1.6, 1.2);
  box(s * -15, s * 10.5, 0.7, 4, 1.3, { color: STEEL });
  box(s * -3.2, s * 5, 1.6, 1.6, 2.4, { color: STEEL });
}

export default m.finish({
  id: 'dockyard',
  name: 'DOCKYARD',
  blurb: 'Container maze with two overlooking catwalks.',
  theme: {
    sky: [0x2f7fe0, 0x8cc4ff, 0xdff1ff, 0x86a9c8],
    fog: 0xd6e8f5,
    hemi: [0xe8f2ff, 0xb8b0a0, 1.7],
    sun: [0xffffff, 2.5],
    sunPos: [30, 60, 20],
    clouds: [0xffffff, 0xf0f4fa, 0xe3eaf4],
    hull: 0x6f7688,
  },
});
