// Bot AI. Reads the world, writes only to soldier.cmd — exactly like a human player would.

import { PLAYER as P, WEAPONS } from '@shared/config.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;
const wrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class BotBrain {
  constructor(game, soldier, skill) {
    this.game = game;
    this.s = soldier;
    this.skill = skill;
    this.reset();
  }

  reset() {
    this.target = null;
    this.scanT = Math.random() * 0.2;
    this.reactT = 0;
    this.errYaw = 0; this.errPitch = 0; this.errT = 0;
    this.burstT = 0; this.pauseT = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0;
    this.path = null; this.pi = 0; this.repathT = 0; this.pullT = 0;
    this.lastSeen = null; this.lastSeenT = -99;
    this.stuckT = 0; this.stuckX = this.s.body.x; this.stuckZ = this.s.body.z;
    this.aimYaw = this.s.yaw; this.aimPitch = 0;
    this.jumpNext = false;
  }

  onDamaged(attacker) {
    if (!attacker.alive) return;
    this.lastSeen = [attacker.body.x, attacker.body.y, attacker.body.z];
    this.lastSeenT = this.game.time;
    if (!this.target && this.canSee(attacker)) {
      this.target = attacker;
      this.reactT = this.skill.reaction;
    }
  }

  canSee(e) {
    const w = this.game.world, b = this.s.body, eb = e.body;
    const ey = b.y + P.eye;
    if (Math.hypot(eb.x - b.x, eb.z - b.z) > 75) return false;
    return w.lineOfSight(b.x, ey, b.z, eb.x, eb.y + 1.2, eb.z) || w.lineOfSight(b.x, ey, b.z, eb.x, eb.y + 1.68, eb.z);
  }

  _scan() {
    const s = this.s, b = s.body, time = this.game.time;
    let best = null, bestD = Infinity;
    for (const e of this.game.soldiers) {
      if (e.team === s.team || !e.alive) continue;
      const dx = e.body.x - b.x, dz = e.body.z - b.z;
      let d = Math.hypot(dx, dz);
      // outside the view cone bots only notice close enemies, shooters, or whoever just hit them
      const off = Math.abs(wrap(Math.atan2(-dx, -dz) - this.aimYaw));
      const noticed = off < 1.25 || d < 7 || time - e.lastShotT < 0.6 || (s.lastAttacker === e && time - s.lastDamageT < 2);
      if (!noticed && e !== this.target) continue;
      if (e === this.target) d -= 5; // stick with the current target
      if (d < bestD && this.canSee(e)) { bestD = d; best = e; }
    }
    if (best !== this.target) {
      this.target = best;
      if (best) this.reactT = this.skill.reaction * rnd(0.8, 1.3);
    }
    if (best) {
      this.lastSeen = [best.body.x, best.body.y, best.body.z];
      this.lastSeenT = time;
    }
  }

  update(dt, frozen) {
    const s = this.s, c = s.cmd;
    c.wx = c.wz = 0;
    c.jump = c.fire = c.reload = c.grenade = c.dash = c.sprint = c.ads = false;
    c.weapon = -1;
    if (!s.alive || frozen) return;

    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.18; this._scan(); }
    if (this.target && !this.target.alive) { this.target = null; this.lastSeenT = -99; }

    let wantYaw, wantPitch;
    if (this.target) [wantYaw, wantPitch] = this._combat(dt);
    else [wantYaw, wantPitch] = this._navigate(dt);

    // turn toward the wanted aim at a limited rate
    const max = this.skill.turnRate * dt * (this.target ? 1 : 0.7);
    const dy = wrap(wantYaw - this.aimYaw), dp = wantPitch - this.aimPitch;
    this.aimYaw = wrap(this.aimYaw + Math.max(-max, Math.min(max, dy)));
    this.aimPitch += Math.max(-max, Math.min(max, dp));
    c.yaw = this.aimYaw;
    c.pitch = this.aimPitch;

    this._unstick(dt);
    if (this.jumpNext) { c.jump = true; this.jumpNext = false; }
  }

  _combat(dt) {
    const s = this.s, c = s.cmd, b = s.body, t = this.target, tb = t.body, sk = this.skill;
    const dx = tb.x - b.x, dz = tb.z - b.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dyv = tb.y + 1.15 - (b.y + P.eye);

    this.errT -= dt;
    if (this.errT <= 0) {
      const k = 1 + Math.hypot(tb.vx, tb.vz) / 7;
      this.errYaw = gauss() * sk.aimError * k;
      this.errPitch = gauss() * sk.aimError * 0.6 * k;
      this.errT = rnd(0.2, 0.5);
    }
    const trueYaw = Math.atan2(-dx, -dz);
    const wantYaw = trueYaw + this.errYaw;
    let wantPitch = Math.atan2(dyv, dist) + this.errPitch;

    // trigger discipline: react, then fire in bursts while roughly on target
    this.reactT -= dt;
    if (this.burstT > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) this.pauseT = rnd(sk.pause[0], sk.pause[1]);
    } else if (this.pauseT > 0) this.pauseT -= dt;
    else this.burstT = rnd(sk.burst[0], sk.burst[1]);
    const onTarget = Math.abs(wrap(trueYaw - this.aimYaw)) < Math.max(0.06, 0.9 / dist);
    c.fire = this.reactT <= 0 && onTarget && this.burstT > 0 && t.protectT <= 0;

    if (sk.grenades > 0 && s.grenadeCd <= 0 && this.reactT <= 0 && dist > 9 && dist < 26 && onTarget &&
        Math.random() < 0.2 * dt * sk.grenades) {
      c.grenade = true;
      this.aimPitch = Math.atan2(dyv, dist) + 0.06 + dist * 0.009;
    }

    // footwork: strafe, close in when far, back off when too close
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafe = Math.random() < 0.15 ? 0 : Math.random() < 0.5 ? -1 : 1;
      this.strafeT = rnd(0.5, 1.4);
    }
    const fx = dx / dist, fz = dz / dist;
    const fwd = dist > 22 ? 1 : dist < 6 ? -0.7 : 0.2;
    let wx = fx * fwd - fz * this.strafe, wz = fz * fwd + fx * this.strafe;
    const l = Math.hypot(wx, wz);
    if (l > 0) {
      wx /= l; wz /= l;
      // don't strafe into walls or off ledges
      const w = this.game.world;
      const px = b.x + wx * 0.9, pz = b.z + wz * 0.9;
      if (w.blocked(px, pz, b.y) || b.y - w.groundAt(px, pz, b.y) > 1) {
        this.strafe = -this.strafe;
        this.strafeT = rnd(0.4, 0.9);
        wx = 0; wz = 0;
      }
    }
    c.wx = wx; c.wz = wz;
    this.path = null; // re-plan once the fight is over
    return [wantYaw, wantPitch];
  }

  _pickGoal() {
    const nav = this.game.nav, time = this.game.time;
    if (this.lastSeen && time - this.lastSeenT < 8) {
      const g = nav.nearest(this.lastSeen[0], this.lastSeen[1], this.lastSeen[2]);
      this.lastSeen = null;
      return g;
    }
    const roll = Math.random();
    if (roll < 0.22) return nav.randomHighNode();
    if (roll < 0.8) {
      const enemies = this.game.soldiers.filter((e) => e.team !== this.s.team && e.alive);
      if (enemies.length) {
        const e = enemies[(Math.random() * enemies.length) | 0];
        return nav.nearest(e.body.x, e.body.y, e.body.z);
      }
    }
    return nav.randomNode();
  }

  _navigate(dt) {
    const s = this.s, c = s.cmd, b = s.body, nav = this.game.nav;
    const W = WEAPONS[s.weapon];
    if (s.reloadT <= 0 && s.weapons[s.weapon].ammo < W.mag * 0.5) c.reload = true;

    this.repathT -= dt;
    if (!this.path || this.pi >= this.path.length || this.repathT <= 0) {
      const start = nav.nearest(b.x, b.y, b.z);
      this.path = nav.findPath(start, this._pickGoal());
      this.pi = 0;
      this.repathT = rnd(5, 9);
      if (!this.path || !this.path.length) { this.path = null; return [this.aimYaw, 0]; }
    }

    // string-pulling: skip ahead to the furthest node we can walk straight to
    this.pullT -= dt;
    if (this.pullT <= 0) {
      this.pullT = 0.25;
      for (let k = Math.min(this.pi + 6, this.path.length - 1); k > this.pi; k--) {
        const n = this.path[k];
        const y = nav.walk(b.x, b.y, b.z, n.x, n.z, 0.6);
        if (y !== null && Math.abs(y - n.y) < 0.3) { this.pi = k; break; }
      }
    }

    let n = this.path[this.pi];
    let dx = n.x - b.x, dz = n.z - b.z;
    if (Math.hypot(dx, dz) < 0.45) {
      this.pi++;
      if (this.pi >= this.path.length) return [this.aimYaw, 0];
      n = this.path[this.pi];
      dx = n.x - b.x; dz = n.z - b.z;
    }
    const l = Math.hypot(dx, dz) || 1;
    c.wx = dx / l; c.wz = dz / l;
    c.sprint = true;

    // look a few nodes ahead so turning is smooth
    const ahead = this.path[Math.min(this.pi + 3, this.path.length - 1)];
    const ax = ahead.x - b.x, az = ahead.z - b.z;
    const yaw = Math.hypot(ax, az) > 0.8 ? Math.atan2(-ax, -az) : Math.atan2(-dx, -dz);
    return [yaw, 0];
  }

  _unstick(dt) {
    const b = this.s.body, c = this.s.cmd;
    this.stuckT += dt;
    if (this.stuckT < 0.8) return;
    const moved = Math.hypot(b.x - this.stuckX, b.z - this.stuckZ);
    if (moved < 0.35 && (c.wx !== 0 || c.wz !== 0)) {
      this.jumpNext = true;
      this.path = null;
      this.strafe = -this.strafe;
    }
    this.stuckT = 0; this.stuckX = b.x; this.stuckZ = b.z;
  }
}
