// SKYPORT — floating platform at sunset. Three lanes, a central bridge with towers and ramps.
// 180°-rotationally symmetric: blue spawns west (-x), orange east (+x).

import { COLORS, createBuilder, side } from './builder.js';
export { COLORS };

const m = createBuilder();
const { box, ramp, decal, strip, prop } = m;

m.arena(34, 24);

// centre: bridge deck with a neutral container underneath
box(0, 0, 5, 16, 0.4, { y: 3.0, color: COLORS.white, kind: 'deck' });
box(-2.44, 0, 0.12, 16, 1.0, { y: 3.4, rail: true, color: COLORS.lime });
box(2.44, 0, 0.12, 16, 1.0, { y: 3.4, rail: true, color: COLORS.lime });
box(0, 0, 2.6, 6.4, 2.7, { color: COLORS.white, kind: 'container' });
strip(0, 0, 0.25, 46);

// everything else is mirrored through the origin (s = 1 west/blue half, s = -1 east/orange half)
for (const s of [1, -1]) {
  const { A, B, flip } = side(s);

  m.base(s, 34);
  strip(s * -29.5, 0, 0.25, 20);

  // big corner building
  box(s * -22, s * -16, 10, 8, 7, { color: B, kind: 'building' });
  box(s * -23, s * -16.5, 6, 5, 1.6, { y: 7, color: COLORS.white, kind: 'building' });
  decal(s === 1 ? 'A2' : 'B2', s * -22, 3.9, s * -11.97, flip, 3.4);
  decal(s === 1 ? 'A2' : 'B2', s * -16.97, 3.9, s * -16, Math.PI / 2 + flip, 3.4);
  prop(s === 1 ? 'antenna' : 'dish', s * -23, 8.6, s * -16.5);

  // raised corner platform with stairs
  box(s * -29.5, s * 19.5, 9, 9, 2.2, { color: COLORS.concrete, kind: 'platform' });
  ramp(s * -25, s * -21, s * 17, s * 20.5, 0, 2.2, [-s, 0], { stairs: true, color: COLORS.concrete });
  box(s * -30.5, s * 15.06, 7, 0.12, 1.0, { y: 2.2, rail: true, color: COLORS.lime });
  box(s * -32, s * 21.5, 2.2, 2.2, 1.2, { y: 2.2, color: COLORS.concreteDark });

  // tower at the end of the bridge + the lime ramp leading up to it
  box(0, s * -10.75, 10, 5.5, 3.4, { color: COLORS.concrete, kind: 'tower' });
  ramp(s * -13, s * -5, s * -12.5, s * -9.5, 0, 3.4, [s, 0]);
  box(0, s * -13.44, 10, 0.12, 1.0, { y: 3.4, rail: true, color: COLORS.lime });
  box(s * -3.75, s * -8.06, 2.5, 0.12, 1.0, { y: 3.4, rail: true, color: COLORS.lime });
  box(s * 3.75, s * -8.06, 2.5, 0.12, 1.0, { y: 3.4, rail: true, color: COLORS.lime });
  // parkour route up the far side of the tower (jump only)
  box(s * 6, s * -11, 2, 2, 2.3, { color: COLORS.concreteDark });
  box(s * 7.8, s * -11, 1.6, 2, 1.2, { color: COLORS.concrete });

  // shipping containers
  box(s * -15, s * 7, 2.6, 6.4, 2.7, { color: A, kind: 'container' });
  box(s * -14, s * 17, 6.4, 2.6, 2.7, { color: B, kind: 'container' });
  box(s * -12, s * -19, 6.4, 2.6, 2.7, { color: A, kind: 'container' });
  box(s * -12, s * -19, 6.4, 2.6, 2.7, { y: 2.7, color: COLORS.white, kind: 'container' });

  // concrete cover blocks
  box(s * -9, s * 1.5, 1.8, 1.8, 1.2);
  box(s * -7, s * -4.5, 1.6, 2.4, 1.2);
  box(s * -21, s * 3.5, 2, 2, 1.3);
  box(s * -22, s * -6.5, 2.4, 1.6, 1.2);
  box(s * -8, s * 14.5, 2, 2, 1.2);
  box(s * -16.5, s * -5, 1.6, 1.6, 2.4, { color: COLORS.concreteDark });
  box(s * -10.5, s * 10.5, 0.7, 4, 1.3);
}

export default m.finish({
  id: 'skyport',
  name: 'SKYPORT',
  blurb: 'Three lanes and a central bridge, at sunset.',
});
