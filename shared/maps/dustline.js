// DUSTLINE — a desert outpost. Long, open sight lines around a central mesa; good for rifles
// and the sniper.

import { COLORS, createBuilder, side } from './builder.js';

const m = createBuilder();
const { box, ramp, decal, strip, prop } = m;
const SAND = 0xdcbd8c, STONE = 0xc9a271, ROCK = 0x9c7a55, ADOBE = 0xe6cfa6;

m.arena(36, 20, { floor: SAND, wall: ROCK, wallHeight: 5 });

// central mesa with cover on top
box(0, 0, 12, 10, 2.6, { color: STONE, kind: 'platform' });
box(0, 0, 2.2, 2.2, 1.3, { y: 2.6, color: ROCK });

for (const s of [1, -1]) {
  const { A, B, flip } = side(s);

  m.base(s, 36, { coverColor: ADOBE });

  // mesa access: a ramp on each long side, low walls on top, a jump route on the short side
  ramp(s * -12, s * -6, s * -2, s * 2, 0, 2.6, [s, 0], { color: ADOBE });
  box(s * -3.6, 0, 0.6, 5, 1.1, { y: 2.6, color: ADOBE });
  box(s * 3, s * -6, 2, 2, 1.3, { color: ROCK });

  // adobe buildings
  box(s * -20, s * -12, 8, 7, 4.5, { color: ADOBE, kind: 'building' });
  box(s * -20, s * -12, 5, 4, 1.2, { y: 4.5, color: STONE, kind: 'building' });
  decal(s === 1 ? 'A1' : 'B1', s * -20, 2.6, s * -8.47, flip, 2.6, s === 1 ? '#2456e6' : '#f07a1e');
  box(s * -17, s * 11.5, 7, 6, 3.5, { color: STONE, kind: 'building' });
  prop(s === 1 ? 'dish' : 'antenna', s * -20, 5.7, s * -12);

  // lookout by the spawn, reached by stairs
  box(s * -31.5, s * 16, 9, 8, 2.2, { color: ADOBE, kind: 'platform' });
  ramp(s * -27, s * -23, s * 14, s * 17.5, 0, 2.2, [-s, 0], { stairs: true, color: STONE });
  box(s * -31.5, s * 12.06, 9, 0.12, 1.0, { y: 2.2, rail: true, color: ROCK });

  // rocks, walls and one container for colour
  box(s * -10, s * -13, 2.5, 2.5, 3.2, { color: ROCK });
  box(s * -12, s * 9, 3, 2, 2.4, { color: ROCK });
  box(s * -26, s * -3.5, 2, 2, 1.3, { color: STONE });
  box(s * -24, s * 6, 1.8, 3, 1.3, { color: STONE });
  box(s * -5, s * 14, 3, 2, 1.3, { color: ROCK });
  box(s * -3, s * -14.5, 2, 3, 1.3, { color: STONE });
  box(s * -15.5, 0, 0.7, 6, 1.3, { color: ADOBE });
  box(s * -8, s * 17.5, 6.4, 2.6, 2.7, { color: A, kind: 'container' });
  box(s * -27, s * -15, 2.6, 6.4, 2.7, { color: B, kind: 'container' });
  strip(s * -18, s * 3.6, 10, 0.25, ROCK);
}

export default m.finish({
  id: 'dustline',
  name: 'DUSTLINE',
  blurb: 'Open desert outpost around a central mesa.',
  theme: {
    sky: [0x3d8fd8, 0xa8d4f0, 0xf6e2b8, 0xd9b88a],
    fog: 0xefd9b0,
    hemi: [0xfff1d6, 0xc99a62, 1.7],
    sun: [0xfff0d0, 2.6],
    sunPos: [-20, 45, -35],
    clouds: [0xfff6e6, 0xf6e4c6, 0xffffff],
    hull: ROCK,
  },
});
