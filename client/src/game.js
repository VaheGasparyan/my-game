// Match simulation: soldiers, weapons, damage, grenades, scoring, respawns.
// Every soldier (human or bot) is driven only through its `cmd` struct, which is the
// same shape a network client would send to an authoritative server later on.

import * as THREE from 'three';
import {
  PLAYER as P, WEAPONS, WEAPON_INDEX, DEFAULT_PRIMARY, SIDEARM, BOT_PRIMARIES, weaponOf,
  ABILITIES, BOT_NAMES, BOT_SKILL, TEAM_INFO, MATCH_DEFAULTS,
} from '@shared/config.js';
import { SoldierModel, CHARACTER_IDS } from './character.js';
import { BotBrain } from './bot.js';
import { sfx } from './audio.js';

export function newCmd() {
  return {
    wx: 0, wz: 0,          // world-space move direction, length 0..1
    yaw: 0, pitch: 0,
    jump: false, sprint: false, ads: false,
    fire: false, reload: false, dash: false, grenade: false,
    weapon: -1,            // weapon slot to switch to, -1 = keep
  };
}

function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < x0 || ox > x1) return Infinity; }
  else { let a = (x0 - ox) / dx, b = (x1 - ox) / dx; if (a > b) [a, b] = [b, a]; tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); }
  if (Math.abs(dy) < 1e-9) { if (oy < y0 || oy > y1) return Infinity; }
  else { let a = (y0 - oy) / dy, b = (y1 - oy) / dy; if (a > b) [a, b] = [b, a]; tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); }
  if (Math.abs(dz) < 1e-9) { if (oz < z0 || oz > z1) return Infinity; }
  else { let a = (z0 - oz) / dz, b = (z1 - oz) / dz; if (a > b) [a, b] = [b, a]; tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); }
  return tmin <= tmax ? tmin : Infinity;
}

export function aimDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

export class Game {
  constructor({ world, nav, scene, effects, hooks }) {
    this.world = world;
    this.nav = nav;
    this.scene = scene;
    this.effects = effects;
    this.hooks = hooks || {};
    this.soldiers = [];
    this.grenades = [];
    this.killfeed = [];
    this.scores = [0, 0];
    this.player = null;
    this.state = 'idle'; // idle | playing | ended
    this.time = 0;
    this.grenadeGeo = new THREE.IcosahedronGeometry(0.13, 0);
    this.grenadeMat = new THREE.MeshLambertMaterial({ color: 0xb6f02a, emissive: 0x4a6a00 });
  }

  /** Swap the map (collision world, nav graph, scene, effects). Ends any running match. */
  setEnvironment(env) {
    this.stop();
    this.world = env.world;
    this.nav = env.nav;
    this.scene = env.scene;
    this.effects = env.effects;
  }

  // ------------------------------------------------------------------ setup
  start(opts) {
    this.stop();
    this.opts = { ...MATCH_DEFAULTS, ...opts };
    this.time = 0;
    this.timeLeft = this.opts.duration;
    this.countdown = this.opts.countdown;
    this.scores = [0, 0];
    this.killfeed = [];
    this.winner = -1;

    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const skill = BOT_SKILL[this.opts.difficulty] || BOT_SKILL.normal;
    let id = 0;
    for (let team = 0; team < 2; team++) {
      for (let i = 0; i < this.opts.teamSize; i++) {
        const isPlayer = team === 0 && i === 0;
        const s = this._makeSoldier(id++, isPlayer ? this.opts.playerName || 'You' : names.pop() || 'Bot' + id, team, !isPlayer);
        const primary = isPlayer ? this.opts.primary : BOT_PRIMARIES[(Math.random() * BOT_PRIMARIES.length) | 0];
        s.loadout = [WEAPON_INDEX[primary] ?? WEAPON_INDEX[DEFAULT_PRIMARY], WEAPON_INDEX[SIDEARM]];
        if (isPlayer) this.player = s;
        else {
          s.model = new SoldierModel(team, CHARACTER_IDS[s.id % CHARACTER_IDS.length]);
          this.scene.add(s.model.group);
          s.brain = new BotBrain(this, s, skill);
        }
        this.soldiers.push(s);
      }
    }
    for (const s of this.soldiers) this._spawn(s, true);
    this.state = 'playing';
  }

  stop() {
    for (const s of this.soldiers) if (s.model) this.scene.remove(s.model.group);
    for (const g of this.grenades) this.scene.remove(g.mesh);
    this.soldiers = [];
    this.grenades = [];
    this.player = null;
    this.effects.clear();
    this.state = 'idle';
  }

  _makeSoldier(id, name, team, isBot) {
    return {
      id, name, team, isBot,
      body: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true },
      yaw: 0, pitch: 0,
      health: P.maxHealth, shield: P.maxShield, alive: true,
      weapon: 0,                                                   // loadout slot in hand
      loadout: [WEAPON_INDEX[DEFAULT_PRIMARY], WEAPON_INDEX[SIDEARM]], // indices into WEAPONS
      weapons: [],                                                 // per-slot { ammo, reserve }
      reloadT: 0, nextFire: 0, fireHeld: false, bloom: 0,
      dashCd: 0, dashT: 0, dashX: 0, dashZ: 0, grenadeCd: 0,
      kills: 0, deaths: 0, respawnT: 0, protectT: 0,
      lastDamageT: -99, lastShotT: -99, lastAttacker: null,
      cmd: newCmd(), model: null, brain: null,
    };
  }

  _spawn(s, initial = false) {
    const spawns = this.world.map.spawns[s.team];
    let best = spawns[0], bestScore = -Infinity;
    spawns.forEach((sp, i) => {
      let score = Math.random() * 3;
      if (initial) score = -Math.abs(i - (s.id % this.opts.teamSize)) * 100; // line up in order at match start
      let nearestEnemy = 200;
      for (const o of this.soldiers) {
        if (o === s || !o.alive) continue;
        const d = Math.hypot(o.body.x - sp.x, o.body.z - sp.z);
        if (o.team !== s.team) nearestEnemy = Math.min(nearestEnemy, d);
        else if (d < 1.2) score -= 1000; // occupied
      }
      score += Math.min(nearestEnemy, 40);
      if (score > bestScore) { bestScore = score; best = sp; }
    });
    const b = s.body;
    b.x = best.x; b.y = best.y; b.z = best.z;
    b.vx = b.vy = b.vz = 0; b.grounded = true;
    s.yaw = s.cmd.yaw = best.yaw;
    s.pitch = s.cmd.pitch = 0;
    s.health = P.maxHealth; s.shield = P.maxShield; s.alive = true;
    s.weapon = 0;
    s.weapons = s.loadout.map((i) => ({ ammo: WEAPONS[i].mag, reserve: s.isBot ? 9999 : WEAPONS[i].reserve }));
    s.reloadT = 0; s.bloom = 0; s.dashT = 0; s.fireHeld = false;
    s.nextFire = this.time + 0.3;
    s.protectT = initial ? 0 : P.spawnProtection;
    s.brain?.reset();
    if (s === this.player) this.hooks.onPlayerSpawn?.(s);
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    const frozen = this.countdown > 0;
    this.countdown -= dt;
    if (!frozen) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this._end(); return; }
    }

    for (const s of this.soldiers) if (s.brain) s.brain.update(dt, frozen);
    for (const s of this.soldiers) this._simulate(s, dt, frozen);
    this._updateGrenades(dt);
    for (const s of this.soldiers) s.model?.update(s, dt);
    while (this.killfeed.length && this.time - this.killfeed[0].t > 6) this.killfeed.shift();
  }

  _simulate(s, dt, frozen) {
    if (!s.alive) {
      s.respawnT -= dt;
      if (s.respawnT <= 0) this._spawn(s);
      return;
    }
    const c = s.cmd, b = s.body;
    s.yaw = c.yaw;
    s.pitch = Math.max(-1.5, Math.min(1.5, c.pitch));
    if (frozen) return;

    s.protectT -= dt;
    s.dashCd -= dt;
    s.grenadeCd -= dt;
    s.bloom = Math.max(0, s.bloom - dt * 0.09);

    // weapon switch
    if (c.weapon >= 0 && c.weapon < s.loadout.length && c.weapon !== s.weapon) {
      s.weapon = c.weapon;
      s.reloadT = 0;
      s.nextFire = this.time + 0.35;
    }
    const W = weaponOf(s), ws = s.weapons[s.weapon];

    // reload
    if (s.reloadT > 0) {
      s.reloadT -= dt;
      if (s.reloadT <= 0) {
        const n = Math.min(W.mag - ws.ammo, ws.reserve);
        ws.ammo += n; ws.reserve -= n;
      }
    } else if (((c.reload && ws.ammo < W.mag) || ws.ammo === 0) && ws.reserve > 0) {
      s.reloadT = W.reloadTime;
      if (s === this.player) sfx.reload();
    }

    // fire
    const trigger = c.fire && (W.auto || !s.fireHeld);
    if (trigger && s.reloadT <= 0 && this.time >= s.nextFire) {
      if (ws.ammo > 0) this._shoot(s, W, ws);
      else if (s === this.player && !s.fireHeld) sfx.empty();
    }
    s.fireHeld = c.fire;

    // abilities
    if (c.dash && s.dashCd <= 0) {
      let dx = c.wx, dz = c.wz;
      const l = Math.hypot(dx, dz);
      if (l < 0.1) { dx = -Math.sin(s.yaw); dz = -Math.cos(s.yaw); } else { dx /= l; dz /= l; }
      s.dashX = dx; s.dashZ = dz;
      s.dashT = ABILITIES.dash.duration;
      s.dashCd = ABILITIES.dash.cooldown;
      if (s === this.player) sfx.dash();
      this.effects.burst(b.x, b.y + 0.9, b.z, 0xffffff, 8, 3, 0.07);
    }
    if (c.grenade && s.grenadeCd <= 0) this._throwGrenade(s);

    // movement
    if (s.dashT > 0) {
      s.dashT -= dt;
      b.vx = s.dashX * ABILITIES.dash.speed;
      b.vz = s.dashZ * ABILITIES.dash.speed;
      if (b.vy < 0) b.vy = 0;
      this.world.stepBody(b, s.dashX, s.dashZ, ABILITIES.dash.speed, false, dt);
      if (s.dashT <= 0) { b.vx = s.dashX * P.sprintSpeed; b.vz = s.dashZ * P.sprintSpeed; }
    } else {
      const speed = c.ads ? P.adsSpeed : c.sprint ? P.sprintSpeed : P.walkSpeed;
      this.world.stepBody(b, c.wx, c.wz, speed, c.jump, dt);
    }
    if (b.y < -25) this._kill(s, null, 'fall', false);

    // shield regen
    if (s.shield < P.maxShield && this.time - s.lastDamageT > P.shieldRegenDelay) {
      s.shield = Math.min(P.maxShield, s.shield + P.shieldRegenRate * dt);
    }
  }

  // ------------------------------------------------------------------ combat
  eye(s) { return [s.body.x, s.body.y + P.eye, s.body.z]; }

  /** Swap a soldier's primary weapon (fresh magazine). Used by the loadout picker. */
  setPrimary(s, id) {
    const idx = WEAPON_INDEX[id];
    if (idx === undefined || WEAPONS[idx].slot !== 'primary' || s.loadout[0] === idx) return;
    s.loadout[0] = idx;
    s.weapons[0] = { ammo: WEAPONS[idx].mag, reserve: s.isBot ? 9999 : WEAPONS[idx].reserve };
    if (s.weapon === 0) { s.reloadT = 0; s.nextFire = this.time + 0.4; s.bloom = 0; }
  }

  _shoot(s, W, ws) {
    ws.ammo--;
    s.protectT = 0; // shooting gives up spawn protection
    s.nextFire = this.time + 60 / W.rpm;
    s.lastShotT = this.time;
    const b = s.body, c = s.cmd;

    let spread = W.spread;
    if (!s.isBot) {
      const moving = Math.hypot(b.vx, b.vz) > 1.5 || !b.grounded;
      spread = (c.ads ? W.adsSpread : W.spread) + s.bloom * (c.ads ? 0.45 : 1) + (moving ? W.moveSpread * (c.ads ? 0.5 : 1) : 0);
    }
    s.bloom = Math.min(W.maxBloom, s.bloom + W.bloomPerShot);

    const f = aimDir(s.yaw, s.pitch);
    const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
    const ux = -rz * f[1], uy = rz * f[0] - rx * f[2], uz = rx * f[1];
    const [ex, ey, ez] = this.eye(s);
    const side = s === this.player ? 0.16 : 0.12, drop = s === this.player ? 0.13 : 0.4;

    // launchers lob an explosive instead of tracing a bullet
    if (W.projectile) this._launchGrenade(s, W.projectile, f, W.id);
    const pellets = W.projectile ? 0 : W.pellets || 1;
    for (let k = 0; k < pellets; k++) {
      const ang = Math.random() * Math.PI * 2, rad = spread * Math.sqrt(Math.random());
      const ox = Math.cos(ang) * rad, oy = Math.sin(ang) * rad;
      let dx = f[0] + rx * ox + ux * oy, dy = f[1] + uy * oy, dz = f[2] + rz * ox + uz * oy;
      const dl = Math.hypot(dx, dy, dz);
      dx /= dl; dy /= dl; dz /= dl;

      const wh = this.world.raycast(ex, ey, ez, dx, dy, dz, W.range);
      let t = wh ? wh.t : W.range;
      let victim = null, head = false;
      for (const o of this.soldiers) {
        if (o.team === s.team || !o.alive) continue;
        const ob = o.body;
        const tb = rayAABB(ex, ey, ez, dx, dy, dz, ob.x - 0.33, ob.y, ob.z - 0.33, ob.x + 0.33, ob.y + 1.42, ob.z + 0.33);
        const th = rayAABB(ex, ey, ez, dx, dy, dz, ob.x - 0.2, ob.y + 1.42, ob.z - 0.2, ob.x + 0.2, ob.y + 1.8, ob.z + 0.2);
        const tt = Math.min(tb, th);
        if (tt < t) { t = tt; victim = o; head = th <= tb; }
      }
      const hx = ex + dx * t, hy = ey + dy * t, hz = ez + dz * t;

      this.effects.tracer(ex + rx * side + f[0] * 0.8, ey - drop + f[1] * 0.8, ez + rz * side + f[2] * 0.8, hx, hy, hz);
      if (victim) this.effects.burst(hx, hy, hz, TEAM_INFO[victim.team].color, 4, 4, 0.07);
      else if (wh) this.effects.burst(hx, hy, hz, 0xe8e6f0, 3, 3.5, 0.06, wh.nx, wh.ny, wh.nz);
      if (victim) this.damage(victim, W.damage * (head ? W.headMult : 1), s, W.id, head);
    }

    s.model?.muzzleFlash();
    if (s === this.player) {
      sfx.shot(W.id, 1, 0);
      this.hooks.onPlayerShot?.(W);
    } else {
      const sp = this.spatial(b.x, b.y, b.z);
      sfx.shot(W.id, sp.vol * 0.8, sp.pan);
    }
  }

  damage(v, amount, attacker, weapon, head = false) {
    if (!v.alive || v.protectT > 0 || this.state !== 'playing') return;
    v.lastDamageT = this.time;
    v.lastAttacker = attacker;
    const absorbed = Math.min(v.shield, amount);
    v.shield -= absorbed;
    v.health -= amount - absorbed;
    const killed = v.health <= 0;
    if (attacker && attacker !== v) {
      v.brain?.onDamaged(attacker);
      if (attacker === this.player) this.hooks.onPlayerHit?.(head, killed);
    }
    if (v === this.player) this.hooks.onPlayerDamaged?.(attacker, amount);
    if (killed) this._kill(v, attacker, weapon, head);
  }

  _kill(v, attacker, weapon, head) {
    v.alive = false;
    v.health = 0;
    v.deaths++;
    v.respawnT = P.respawnTime;
    const b = v.body;
    this.effects.burst(b.x, b.y + 1, b.z, TEAM_INFO[v.team].color, 14, 6, 0.16);
    this.effects.burst(b.x, b.y + 1, b.z, 0x343848, 8, 5, 0.14);
    const real = attacker && attacker !== v && attacker.team !== v.team;
    if (real) {
      attacker.kills++;
      this.scores[attacker.team]++;
    }
    this.killfeed.push({ killer: real ? attacker : null, victim: v, weapon, head, t: this.time });
    if (this.killfeed.length > 5) this.killfeed.shift();
    if (v === this.player) this.hooks.onPlayerDeath?.(real ? attacker : null);
    if (real && this.scores[attacker.team] >= this.opts.scoreLimit) this._end();
  }

  _throwGrenade(s) {
    s.grenadeCd = ABILITIES.grenade.cooldown;
    this._launchGrenade(s, ABILITIES.grenade, aimDir(s.yaw, s.pitch + 0.08), 'grenade', 2);
    if (s === this.player) sfx.throw();
  }

  /**
   * Spawn an explosive projectile. spec: { speed, fuse, radius, damage, impact? }
   * (impact = explode on first contact instead of bouncing). f: unit launch direction.
   */
  _launchGrenade(s, spec, f, weapon, lift = 1) {
    const [ex, ey, ez] = this.eye(s);
    const mesh = new THREE.Mesh(this.grenadeGeo, this.grenadeMat);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.grenades.push({
      x: ex + f[0] * 0.4, y: ey - 0.1 + f[1] * 0.4, z: ez + f[2] * 0.4,
      vx: f[0] * spec.speed + s.body.vx * 0.5, vy: f[1] * spec.speed + lift, vz: f[2] * spec.speed + s.body.vz * 0.5,
      fuse: spec.fuse, radius: spec.radius, damage: spec.damage, impact: !!spec.impact, armT: 0.08,
      weapon, owner: s, mesh,
    });
  }

  _updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vy -= 20 * dt;
      let mx = g.vx * dt, my = g.vy * dt, mz = g.vz * dt;
      const len = Math.hypot(mx, my, mz);
      if (len > 1e-5) {
        const hit = this.world.raycast(g.x, g.y, g.z, mx / len, my / len, mz / len, len + 0.14);
        if (hit) {
          const dot = g.vx * hit.nx + g.vy * hit.ny + g.vz * hit.nz;
          g.vx = (g.vx - 2 * dot * hit.nx) * 0.5;
          g.vy = (g.vy - 2 * dot * hit.ny) * 0.5;
          g.vz = (g.vz - 2 * dot * hit.nz) * 0.5;
          if (hit.ny > 0.7) { g.vx *= 0.75; g.vz *= 0.75; if (Math.abs(g.vy) < 1.2) g.vy = 0; }
          const back = Math.max(0, hit.t - 0.14);
          g.x += (mx / len) * back; g.y += (my / len) * back; g.z += (mz / len) * back;
          if (g.impact) g.fuse = 0;
        } else { g.x += mx; g.y += my; g.z += mz; }
      }
      if (g.impact && g.fuse > 0 && (g.armT -= dt) <= 0) {
        // launcher rounds also go off when they reach an enemy
        for (const o of this.soldiers) {
          if (!o.alive || o.team === g.owner.team) continue;
          const dy = g.y - o.body.y;
          if (dy > -0.2 && dy < 2 && Math.hypot(o.body.x - g.x, o.body.z - g.z) < 0.6) { g.fuse = 0; break; }
        }
      }
      g.mesh.position.set(g.x, g.y, g.z);
      g.mesh.rotation.x += dt * 9; g.mesh.rotation.z += dt * 6;

      if (g.fuse <= 0 || g.y < -20) {
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
        if (g.y < -20) continue;
        this.effects.explosion(g.x, g.y, g.z, g.radius * 0.6);
        const sp = this.spatial(g.x, g.y, g.z);
        sfx.explosion(sp.vol, sp.pan);
        this.hooks.onExplosion?.(g.x, g.y, g.z);
        for (const o of [...this.soldiers]) {
          if (!o.alive || (o.team === g.owner.team && o !== g.owner)) continue;
          const cy = o.body.y + 0.9;
          const d = Math.hypot(o.body.x - g.x, cy - g.y, o.body.z - g.z);
          if (d > g.radius) continue;
          if (!this.world.lineOfSight(g.x, g.y + 0.25, g.z, o.body.x, cy, o.body.z)) continue;
          const dmg = g.damage * (1 - d / g.radius) * (o === g.owner ? 0.5 : 1);
          this.damage(o, dmg, g.owner, g.weapon);
        }
      }
    }
  }

  /** Volume + stereo pan of a world position relative to the local player. */
  spatial(x, y, z) {
    const p = this.player;
    if (!p) return { vol: 0, pan: 0 };
    const dx = x - p.body.x, dz = z - p.body.z;
    const d = Math.hypot(dx, y - p.body.y, dz);
    const vol = Math.max(0, 1 - d / 75) ** 2;
    const pan = d > 0.5 ? ((dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw)) / d) * 0.8 : 0;
    return { vol, pan };
  }

  _end() {
    if (this.state !== 'playing') return;
    this.state = 'ended';
    this.winner = this.scores[0] === this.scores[1] ? -1 : this.scores[0] > this.scores[1] ? 0 : 1;
    this.hooks.onEnd?.(this.winner);
  }
}
