// SKYPORT — a 180°-rotationally-symmetric arena. Blue spawns west (-x), orange east (+x).
// Pure data: no rendering or engine dependencies, so the server can load it too.
//
// boxes : axis-aligned solids  { min:[x,y,z], max:[x,y,z], color, kind, rail? }
// ramps : walkable wedges      { min, max, dir:[dx,dz] (uphill direction), color, stairs? }
// decals: text painted on walls; strips: flat floor markings; props: purely visual set dressing.

export const COLORS = {
  floor: 0xcfcbd8,
  concrete: 0xdedbe6,
  concreteDark: 0x8f8ba3,
  wall: 0xb8b4c8,
  white: 0xf3f1f7,
  blue: 0x2456e6,
  orange: 0xf07a1e,
  lime: 0xb6f02a,
  dark: 0x3a3d52,
};

const boxes = [];
const ramps = [];
const decals = [];
const strips = [];
const props = [];
const spawns = [[], []];

function box(cx, cz, w, d, h, o = {}) {
  const y = o.y || 0;
  const b = {
    min: [cx - w / 2, y, cz - d / 2],
    max: [cx + w / 2, y + h, cz + d / 2],
    color: o.color ?? COLORS.concrete,
    kind: o.kind || 'block',
  };
  if (o.rail) b.rail = true;
  boxes.push(b);
  return b;
}

function ramp(x0, x1, z0, z1, y0, y1, dir, o = {}) {
  ramps.push({
    min: [Math.min(x0, x1), y0, Math.min(z0, z1)],
    max: [Math.max(x0, x1), y1, Math.max(z0, z1)],
    dir,
    color: o.color ?? COLORS.lime,
    stairs: !!o.stairs,
  });
}

function decal(text, x, y, z, ry, size, color = '#ffffff') {
  decals.push({ text, x, y, z, ry, size, color });
}

function strip(cx, cz, w, d, color = COLORS.lime) {
  strips.push({ x: cx, z: cz, w, d, color });
}

export const BOUNDS = { minX: -34, maxX: 34, minZ: -24, maxZ: 24 };

// ---- ground + perimeter ----------------------------------------------------
box(0, 0, 70, 50, 2, { y: -2, color: COLORS.floor, kind: 'floor' });
box(0, -24.5, 70, 1, 4.5, { color: COLORS.wall, kind: 'wall' });
box(0, 24.5, 70, 1, 4.5, { color: COLORS.wall, kind: 'wall' });
box(-34.5, 0, 1, 48, 4.5, { color: COLORS.wall, kind: 'wall' });
box(34.5, 0, 1, 48, 4.5, { color: COLORS.wall, kind: 'wall' });

// ---- centre: bridge deck with a neutral container underneath ---------------
box(0, 0, 5, 16, 0.4, { y: 3.0, color: COLORS.white, kind: 'deck' });
box(-2.44, 0, 0.12, 16, 1.0, { y: 3.4, rail: true, color: COLORS.lime });
box(2.44, 0, 0.12, 16, 1.0, { y: 3.4, rail: true, color: COLORS.lime });
box(0, 0, 2.6, 6.4, 2.7, { color: COLORS.white, kind: 'container' });
strip(0, 0, 0.25, 46);

// ---- everything else is mirrored through the origin ------------------------
// s = 1 builds the west (blue) half, s = -1 the east (orange) half.
for (const s of [1, -1]) {
  const A = s === 1 ? COLORS.blue : COLORS.orange; // home colour
  const B = s === 1 ? COLORS.orange : COLORS.blue; // away colour
  const team = s === 1 ? 0 : 1;
  const flip = s === 1 ? 0 : Math.PI;

  // spawn area: team banner on the back wall + a cover wall in front
  box(s * -33.75, 0, 0.5, 7, 6.5, { color: A, kind: 'banner' });
  decal('V', s * -33.48, 3.6, 0, Math.PI / 2 + flip, 4.2);
  box(s * -27, 0, 0.8, 8, 1.3, { color: COLORS.concrete });
  strip(s * -29.5, 0, 0.25, 20);

  // big corner building
  box(s * -22, s * -16, 10, 8, 7, { color: B, kind: 'building' });
  box(s * -23, s * -16.5, 6, 5, 1.6, { y: 7, color: COLORS.white, kind: 'building' });
  decal(s === 1 ? 'A2' : 'B2', s * -22, 3.9, s * -11.97, flip, 3.4);
  decal(s === 1 ? 'A2' : 'B2', s * -16.97, 3.9, s * -16, Math.PI / 2 + flip, 3.4);
  props.push({ type: s === 1 ? 'antenna' : 'dish', x: s * -23, y: 8.6, z: s * -16.5 });

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
  box(s * -7.5, s * 12, 2, 2, 1.2);
  box(s * -16.5, s * -5, 1.6, 1.6, 2.4, { color: COLORS.concreteDark });
  box(s * -10.5, s * 10.5, 0.7, 4, 1.3);

  // spawn points (x, z, yaw). yaw 0 looks toward -z; forward = (-sin yaw, -cos yaw)
  const yaw = s === 1 ? -Math.PI / 2 : Math.PI / 2;
  for (const [x, z] of [[-31, -7.5], [-31, -2.5], [-31, 2.5], [-31, 7.5], [-29.5, -10.5], [-29.5, 10.5]]) {
    spawns[team].push({ x: s * x, y: 0, z: s * z, yaw });
  }
}

export default {
  id: 'skyport',
  name: 'SKYPORT',
  bounds: BOUNDS,
  boxes,
  ramps,
  decals,
  strips,
  props,
  spawns,
};
