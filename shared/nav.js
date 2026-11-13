// Navigation graph generated automatically from the collision world by flood-filling
// walkable 1 m cells outward from the spawn points. Handles ramps, stairs and multiple
// floors (bridge over/under) because nodes are keyed by cell AND height.

import { PLAYER } from './config.js';

const CELL = 1;
const NAV_RADIUS = 0.45;
const MAX_DROP = 4;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class NavGraph {
  constructor(world) {
    this.world = world;
    this.nodes = [];
    this.cells = new Map(); // "i,j" -> [nodeIndex]
    this._build();
  }

  _key(i, j) { return i + ',' + j; }

  _nodeAt(i, j, y) {
    const list = this.cells.get(this._key(i, j));
    if (!list) return -1;
    for (const n of list) if (Math.abs(this.nodes[n].y - y) < 0.3) return n;
    return -1;
  }

  _addNode(i, j, y) {
    const idx = this.nodes.length;
    this.nodes.push({ x: (i + 0.5) * CELL, z: (j + 0.5) * CELL, y, i, j, edges: [], costs: [] });
    const k = this._key(i, j);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push(idx);
    return idx;
  }

  /** Simulate walking in a straight line; returns the final feet height or null if impossible. */
  walk(x0, y0, z0, x1, z1, maxDrop = MAX_DROP) {
    const w = this.world;
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(dist / 0.25));
    let y = y0;
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n;
      if (w.blocked(x, z, y, NAV_RADIUS)) return null;
      // ground is sampled with the real body radius so the result matches what a character does;
      // only the obstacle test uses the wider clearance radius
      const g = w.groundAt(x, z, y, PLAYER.radius);
      if (g === -Infinity || y - g > maxDrop) return null;
      y = g;
    }
    return y;
  }

  _build() {
    const w = this.world;
    const queue = [];
    for (const team of w.map.spawns) {
      for (const s of team) {
        const i = Math.floor(s.x / CELL), j = Math.floor(s.z / CELL);
        const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
        if (w.blocked(x, z, s.y, NAV_RADIUS)) continue;
        const y = w.groundAt(x, z, s.y, PLAYER.radius);
        if (y === -Infinity || this._nodeAt(i, j, y) >= 0) continue;
        queue.push(this._addNode(i, j, y));
      }
    }
    while (queue.length) {
      const idx = queue.pop();
      const a = this.nodes[idx];
      const ok = [];
      for (let d = 0; d < 8; d++) {
        const [di, dj] = DIRS[d];
        const ni = a.i + di, nj = a.j + dj;
        const tx = (ni + 0.5) * CELL, tz = (nj + 0.5) * CELL;
        const y = this.walk(a.x, a.y, a.z, tx, tz);
        ok[d] = y;
        if (y === null) continue;
        if (d >= 4) {
          // diagonals only across flat ground with both orthogonal neighbours open
          const o1 = ok[di > 0 ? 0 : 1], o2 = ok[dj > 0 ? 2 : 3];
          if (o1 === null || o2 === null) continue;
          if (Math.abs(o1 - a.y) > 0.3 || Math.abs(o2 - a.y) > 0.3 || Math.abs(y - a.y) > 0.3) continue;
        }
        let n = this._nodeAt(ni, nj, y);
        if (n < 0) { n = this._addNode(ni, nj, y); queue.push(n); }
        a.edges.push(n);
        a.costs.push((d >= 4 ? 1.414 : 1) + Math.abs(y - a.y));
      }
    }
  }

  nearest(x, y, z) {
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= 4 && best < 0; r++) {
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          const list = this.cells.get(this._key(i, j));
          if (!list) continue;
          for (const n of list) {
            const nd = this.nodes[n];
            const d = Math.hypot(nd.x - x, nd.z - z) + Math.abs(nd.y - y) * 3;
            if (d < bd) { bd = d; best = n; }
          }
        }
      }
    }
    return best;
  }

  randomNode() {
    return (Math.random() * this.nodes.length) | 0;
  }

  /** A random node on an elevated surface (bridge, towers, platforms) — good vantage points. */
  randomHighNode() {
    if (!this.high) {
      this.high = [];
      this.nodes.forEach((n, i) => { if (n.y > 2) this.high.push(i); });
    }
    return this.high.length ? this.high[(Math.random() * this.high.length) | 0] : this.randomNode();
  }

  /** A* — returns an array of nodes (excluding the start) or null. */
  findPath(start, goal) {
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [];
    const nodes = this.nodes, N = nodes.length;
    const g = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const gn = nodes[goal];
    const h = (n) => {
      const a = nodes[n];
      return Math.hypot(a.x - gn.x, a.z - gn.z) + Math.abs(a.y - gn.y);
    };
    // binary heap of [f, node]
    const hf = [], hn = [];
    const push = (f, n) => {
      let i = hf.length; hf.push(f); hn.push(n);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hf[p] <= f) break;
        hf[i] = hf[p]; hn[i] = hn[p]; i = p;
      }
      hf[i] = f; hn[i] = n;
    };
    const pop = () => {
      const top = hn[0];
      const f = hf.pop(), n = hn.pop();
      const len = hf.length;
      if (len) {
        let i = 0;
        for (;;) {
          let c = i * 2 + 1;
          if (c >= len) break;
          if (c + 1 < len && hf[c + 1] < hf[c]) c++;
          if (hf[c] >= f) break;
          hf[i] = hf[c]; hn[i] = hn[c]; i = c;
        }
        hf[i] = f; hn[i] = n;
      }
      return top;
    };
    g[start] = 0;
    push(h(start), start);
    while (hf.length) {
      const cur = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const nd = nodes[cur];
      for (let e = 0; e < nd.edges.length; e++) {
        const nb = nd.edges[e];
        if (closed[nb]) continue;
        const ng = g[cur] + nd.costs[e];
        if (ng < g[nb]) { g[nb] = ng; from[nb] = cur; push(ng + h(nb), nb); }
      }
    }
    if (from[goal] < 0) return null;
    const path = [];
    for (let n = goal; n !== start; n = from[n]) path.push(nodes[n]);
    return path.reverse();
  }
}
