// Shared helpers for writing maps as plain data (no rendering or engine dependencies, so the
// server can load maps too).
//
// boxes : axis-aligned solids  { min:[x,y,z], max:[x,y,z], color, kind, rail? }
// ramps : walkable wedges      { min, max, dir:[dx,dz] (uphill direction), color, stairs? }
// decals: text painted on walls; strips: flat floor markings; props: purely visual set dressing.
// spawns: [blue[], orange[]] of { x, y, z, yaw }   (yaw 0 looks toward -z)
// theme : optional sky / light / fog colours, see DEFAULT_THEME in client/src/scene.js

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

export function createBuilder() {
  const boxes = [], ramps = [], decals = [], strips = [], props = [];
  const spawns = [[], []];
  let bounds = null;

  const b = {
    /** Box centred on (cx, cz), sitting on y (default 0). */
    box(cx, cz, w, d, h, o = {}) {
      const y = o.y || 0;
      const bx = {
        min: [cx - w / 2, y, cz - d / 2],
        max: [cx + w / 2, y + h, cz + d / 2],
        color: o.color ?? COLORS.concrete,
        kind: o.kind || 'block',
      };
      if (o.rail) bx.rail = true;
      boxes.push(bx);
      return bx;
    },

    /** Wedge between two corners, rising from y0 to y1 in direction dir ([±1,0] or [0,±1]). */
    ramp(x0, x1, z0, z1, y0, y1, dir, o = {}) {
      ramps.push({
        min: [Math.min(x0, x1), y0, Math.min(z0, z1)],
        max: [Math.max(x0, x1), y1, Math.max(z0, z1)],
        dir,
        color: o.color ?? COLORS.lime,
        stairs: !!o.stairs,
      });
    },

    decal(text, x, y, z, ry, size, color = '#ffffff') { decals.push({ text, x, y, z, ry, size, color }); },
    strip(cx, cz, w, d, color = COLORS.lime) { strips.push({ x: cx, z: cz, w, d, color }); },
    prop(type, x, y, z) { props.push({ type, x, y, z }); },
    spawn(team, x, z, yaw, y = 0) { spawns[team].push({ x, y, z, yaw }); },

    /** Floor slab + perimeter walls for a rectangular arena of half-size (hx, hz). */
    arena(hx, hz, o = {}) {
      bounds = { minX: -hx, maxX: hx, minZ: -hz, maxZ: hz };
      const wall = o.wall ?? COLORS.wall, h = o.wallHeight ?? 4.5;
      b.box(0, 0, hx * 2 + 2, hz * 2 + 2, 2, { y: -2, color: o.floor ?? COLORS.floor, kind: 'floor' });
      b.box(0, -hz - 0.5, hx * 2 + 2, 1, h, { color: wall, kind: 'wall' });
      b.box(0, hz + 0.5, hx * 2 + 2, 1, h, { color: wall, kind: 'wall' });
      b.box(-hx - 0.5, 0, 1, hz * 2, h, { color: wall, kind: 'wall' });
      b.box(hx + 0.5, 0, 1, hz * 2, h, { color: wall, kind: 'wall' });
    },

    /**
     * Standard spawn area for one side (s = 1 west/blue, -1 east/orange): team banner on the
     * back wall, a cover wall in front, six spawn points.
     */
    base(s, backX, o = {}) {
      const team = s === 1 ? 0 : 1;
      const A = s === 1 ? COLORS.blue : COLORS.orange;
      const flip = s === 1 ? 0 : Math.PI;
      const spread = o.spread ?? 5;
      b.box(s * -(backX - 0.25), 0, 0.5, 7, 6.5, { color: A, kind: 'banner' });
      b.decal('V', s * -(backX - 0.52), 3.6, 0, Math.PI / 2 + flip, 4.2);
      b.box(s * -(backX - 7), 0, 0.8, o.cover ?? 8, 1.3, { color: o.coverColor ?? COLORS.concrete });
      const yaw = s === 1 ? -Math.PI / 2 : Math.PI / 2;
      const x0 = backX - 3, x1 = backX - 4.5;
      for (const [x, z] of [[x0, -1.5 * spread], [x0, -0.5 * spread], [x0, 0.5 * spread], [x0, 1.5 * spread], [x1, -2.1 * spread], [x1, 2.1 * spread]]) {
        b.spawn(team, s * -x, s * z, yaw);
      }
    },

    finish(meta) {
      return { ...meta, bounds, boxes, ramps, decals, strips, props, spawns };
    },
  };
  return b;
}

/** Home / away colours and helpers for one half of a mirrored map. */
export function side(s) {
  return {
    A: s === 1 ? COLORS.blue : COLORS.orange,
    B: s === 1 ? COLORS.orange : COLORS.blue,
    flip: s === 1 ? 0 : Math.PI,
  };
}
