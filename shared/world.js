// Collision world + character movement. Engine-agnostic (plain numbers/arrays) so the
// exact same simulation can run in the browser and on a Node server.

import { PLAYER } from './config.js';

const EPS = 1e-4;

export function rampHeight(r, x, z) {
  const cx = Math.min(Math.max(x, r.min[0]), r.max[0]);
  const cz = Math.min(Math.max(z, r.min[2]), r.max[2]);
  let t = r.dir[0] !== 0
    ? (cx - r.min[0]) / (r.max[0] - r.min[0])
    : (cz - r.min[2]) / (r.max[2] - r.min[2]);
  if (r.dir[0] < 0 || r.dir[1] < 0) t = 1 - t;
  return r.min[1] + t * (r.max[1] - r.min[1]);
}

export class World {
  constructor(map) {
    this.map = map;
    this.boxes = map.boxes;
    this.ramps = map.ramps;
  }

  /** Would a character standing with its feet at `feet` collide with something it can't step onto? */
  blocked(x, z, feet, radius = PLAYER.radius, height = PLAYER.height, step = PLAYER.step) {
    const x0 = x - radius, x1 = x + radius, z0 = z - radius, z1 = z + radius;
    const top = feet + step + EPS, head = feet + height;
    for (const b of this.boxes) {
      if (x1 <= b.min[0] || x0 >= b.max[0] || z1 <= b.min[2] || z0 >= b.max[2]) continue;
      if (b.max[1] > top && b.min[1] < head) return true;
    }
    for (const r of this.ramps) {
      if (x1 <= r.min[0] || x0 >= r.max[0] || z1 <= r.min[2] || z0 >= r.max[2]) continue;
      if (r.min[1] < head && rampHeight(r, x, z) > top) return true;
    }
    return false;
  }

  /** Highest walkable surface under the character that is reachable from `feet` (within step height). */
  groundAt(x, z, feet, radius = PLAYER.radius, step = PLAYER.step) {
    const x0 = x - radius, x1 = x + radius, z0 = z - radius, z1 = z + radius;
    const top = feet + step + EPS;
    let g = -Infinity;
    for (const b of this.boxes) {
      if (x1 <= b.min[0] || x0 >= b.max[0] || z1 <= b.min[2] || z0 >= b.max[2]) continue;
      if (b.max[1] <= top && b.max[1] > g) g = b.max[1];
    }
    for (const r of this.ramps) {
      if (x1 <= r.min[0] || x0 >= r.max[0] || z1 <= r.min[2] || z0 >= r.max[2]) continue;
      const h = rampHeight(r, x, z);
      if (h <= top && h > g) g = h;
    }
    return g;
  }

  /** Lowest ceiling above `head`. */
  ceilingAt(x, z, head, radius = PLAYER.radius) {
    const x0 = x - radius, x1 = x + radius, z0 = z - radius, z1 = z + radius;
    let c = Infinity;
    for (const b of this.boxes) {
      if (x1 <= b.min[0] || x0 >= b.max[0] || z1 <= b.min[2] || z0 >= b.max[2]) continue;
      if (b.min[1] >= head - 0.05 && b.min[1] < c) c = b.min[1];
    }
    return c;
  }

  /**
   * Ray vs. world. Rails are ignored (bullets and sight pass between the bars).
   * Returns null or { t, nx, ny, nz }.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxT = 1000) {
    let best = maxT, nx = 0, ny = 0, nz = 0, hit = false;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    const inv = [1 / dx, 1 / dy, 1 / dz];

    for (const b of this.boxes) {
      if (b.rail) continue;
      let tmin = 0, tmax = best, axis = -1, sign = 0, miss = false;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) {
          if (o[i] < b.min[i] || o[i] > b.max[i]) { miss = true; break; }
          continue;
        }
        let t1 = (b.min[i] - o[i]) * inv[i];
        let t2 = (b.max[i] - o[i]) * inv[i];
        let sg = -1;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sg = 1; }
        if (t1 > tmin) { tmin = t1; axis = i; sign = sg; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { miss = true; break; }
      }
      if (miss || axis < 0) continue; // axis < 0: origin inside the box
      if (tmin < best) {
        best = tmin; hit = true;
        nx = axis === 0 ? sign : 0; ny = axis === 1 ? sign : 0; nz = axis === 2 ? sign : 0;
      }
    }

    for (const r of this.ramps) {
      let tmin = 0, tmax = best, axis = -1, sign = 0, miss = false;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) {
          if (o[i] < r.min[i] || o[i] > r.max[i]) { miss = true; break; }
          continue;
        }
        let t1 = (r.min[i] - o[i]) * inv[i];
        let t2 = (r.max[i] - o[i]) * inv[i];
        let sg = -1;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sg = 1; }
        if (t1 > tmin) { tmin = t1; axis = i; sign = sg; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { miss = true; break; }
      }
      if (miss) continue;
      const under = (t) => oy + dy * t < rampHeight(r, ox + dx * t, oz + dz * t);
      if (under(tmin + EPS)) {
        // entered through a side / the tall end
        if (axis >= 0 && tmin < best) {
          best = tmin; hit = true;
          nx = axis === 0 ? sign : 0; ny = axis === 1 ? sign : 0; nz = axis === 2 ? sign : 0;
        }
        continue;
      }
      const N = 12;
      let prev = tmin;
      for (let k = 1; k <= N; k++) {
        const t = tmin + ((tmax - tmin) * k) / N;
        if (under(t)) {
          let lo = prev, hi = t;
          for (let j = 0; j < 8; j++) {
            const mid = (lo + hi) / 2;
            if (under(mid)) hi = mid; else lo = mid;
          }
          if (hi < best) {
            best = hi; hit = true;
            const slope = (r.max[1] - r.min[1]) /
              (r.dir[0] !== 0 ? r.max[0] - r.min[0] : r.max[2] - r.min[2]);
            const l = Math.hypot(slope, 1);
            nx = (-r.dir[0] * slope) / l; ny = 1 / l; nz = (-r.dir[1] * slope) / l;
          }
          break;
        }
        prev = t;
      }
    }

    return hit ? { t: best, nx, ny, nz } : null;
  }

  /** True when nothing solid lies between the two points. */
  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return true;
    return !this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.05);
  }

  /**
   * Advance a character body by dt.
   * body: { x, y, z, vx, vy, vz, grounded }   (y is the feet position)
   * wishX/wishZ: desired horizontal direction (length 0..1), speed: target speed.
   */
  stepBody(body, wishX, wishZ, speed, jump, dt) {
    const P = PLAYER;

    // --- horizontal velocity ---
    const tx = wishX * speed, tz = wishZ * speed;
    const hasWish = wishX !== 0 || wishZ !== 0;
    if (body.grounded || hasWish) {
      const accel = (body.grounded ? P.groundAccel : P.airAccel) * dt;
      const ddx = tx - body.vx, ddz = tz - body.vz;
      const dl = Math.hypot(ddx, ddz);
      if (dl <= accel || dl === 0) { body.vx = tx; body.vz = tz; }
      else { body.vx += (ddx / dl) * accel; body.vz += (ddz / dl) * accel; }
    }

    if (jump && body.grounded) {
      body.vy = P.jumpSpeed;
      body.grounded = false;
    }

    // --- horizontal move, sub-stepped so fast bodies can't tunnel ---
    const mx = body.vx * dt, mz = body.vz * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(mz)) / 0.2));
    const sx = mx / n, sz = mz / n;
    for (let i = 0; i < n; i++) {
      if (sx !== 0) {
        if (!this.blocked(body.x + sx, body.z, body.y)) body.x += sx; else body.vx = 0;
      }
      if (sz !== 0) {
        if (!this.blocked(body.x, body.z + sz, body.y)) body.z += sz; else body.vz = 0;
      }
      if (body.grounded) {
        const g = this.groundAt(body.x, body.z, body.y);
        if (g >= body.y - P.step) body.y = g; // follow steps and slopes, both up and down
        else body.grounded = false;
      }
    }

    // --- vertical ---
    if (!body.grounded) {
      body.vy -= P.gravity * dt;
      let ny = body.y + body.vy * dt;
      if (body.vy <= 0) {
        const g = this.groundAt(body.x, body.z, body.y);
        if (ny <= g) { ny = g; body.vy = 0; body.grounded = true; }
      } else {
        const c = this.ceilingAt(body.x, body.z, body.y + P.height);
        if (ny + P.height > c) { ny = c - P.height; body.vy = 0; }
      }
      body.y = ny;
    } else {
      body.vy = 0;
    }
  }
}
