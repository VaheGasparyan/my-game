// DOM heads-up display. Only touches the DOM when a value actually changes.

import * as THREE from 'three';
import { PLAYER as P, WEAPONS, ABILITIES, TEAM_INFO } from '@shared/config.js';

const $ = (id) => document.getElementById(id);
const GUN_SVG = '<svg viewBox="0 0 90 30"><path d="M2 12h10l3-4h34l2-4h10l2 4h14v5h11v3H64l-3 3H46l-5 9h-8l3-9H24l-5 8h-7l2-8H2z" fill="#fff"/></svg>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _v = new THREE.Vector3();

export class Hud {
  constructor(map) {
    this.root = $('hud');
    this.el = {
      sb: $('score-blue'), so: $('score-orange'), timer: $('timer'),
      hp: $('hp-val'), hpFill: $('hp-fill'), sh: $('sh-val'), shFill: $('sh-fill'),
      mag: $('ammo-mag'), res: $('ammo-res'), wname: $('weapon-name'),
      dash: $('ab-dash'), nade: $('ab-nade'),
      feed: $('killfeed'), cross: $('crosshair'), hit: $('hitmarker'),
      vig: $('dmg-vignette'), dirs: $('dmg-dirs'), tags: $('nametags'),
      reload: $('reload-hint'), msg: $('center-msg'), board: $('scoreboard'), fps: $('fps'),
    };
    this.el.hit.innerHTML = '<svg viewBox="0 0 26 26"><path d="M2 2l7 7M24 2l-7 7M2 24l7-7M24 24l-7-7" stroke="currentColor" stroke-width="2.6" fill="none"/></svg>';
    this.cache = {};
    this.hitT = 0;
    this.vigT = 0;
    this.dmgDirs = [];
    this.tags = new Map();
    this.visT = 0;
    this.visible = new Set(); // enemies currently in the player's line of sight
    this.feedKey = '';
    this.boardT = 0;
    this.fpsT = 0; this.fpsN = 0;

    this.mini = $('minimap');
    this.mctx = this.mini.getContext('2d');
    this._prerenderMap(map);
  }

  show(on) { this.root.classList.toggle('hidden', !on); }

  _set(key, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(value);
  }

  reset() {
    this.el.feed.innerHTML = '';
    this.feedKey = '';
    this.el.dirs.innerHTML = '';
    this.dmgDirs = [];
    for (const t of this.tags.values()) t.remove();
    this.tags.clear();
    this.visible.clear();
    this.hitT = this.vigT = 0;
    this.el.msg.innerHTML = '';
    this.cache = {};
  }

  // ---------------------------------------------------------------- minimap
  _prerenderMap(map) {
    const B = map.bounds, W = this.mini.width, H = this.mini.height, pad = 8;
    const sc = Math.min((W - pad * 2) / (B.maxX - B.minX), (H - pad * 2) / (B.maxZ - B.minZ));
    this.mx = (x) => W / 2 + x * sc;
    this.mz = (z) => H / 2 + z * sc;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#8f93a8';
    g.fillRect(this.mx(B.minX), this.mz(B.minZ), (B.maxX - B.minX) * sc, (B.maxZ - B.minZ) * sc);
    const rect = (o, color) => {
      g.fillStyle = color;
      g.fillRect(this.mx(o.min[0]), this.mz(o.min[2]), (o.max[0] - o.min[0]) * sc, (o.max[2] - o.min[2]) * sc);
    };
    for (const r of map.ramps) rect(r, '#b9d86a');
    for (const b of map.boxes) {
      if (b.rail || b.kind === 'floor' || b.kind === 'wall' || b.kind === 'banner') continue;
      if (b.min[1] > 2.9 && b.kind !== 'deck') continue;
      const walkable = b.kind === 'deck' || b.kind === 'tower' || b.kind === 'platform';
      rect(b, walkable ? '#c9ccda' : b.max[1] < 1.5 ? '#5c6078' : '#2a2e45');
    }
    this.mapImg = c;
  }

  _drawMinimap(game) {
    const g = this.mctx, p = game.player;
    g.clearRect(0, 0, this.mini.width, this.mini.height);
    g.drawImage(this.mapImg, 0, 0);
    for (const s of game.soldiers) {
      if (s === p || !s.alive) continue;
      const ally = s.team === p.team;
      if (!ally && !(this.visible.has(s) || game.time - s.lastShotT < 1.5)) continue;
      g.fillStyle = ally ? '#6fe3ff' : '#ff7a2a';
      g.beginPath();
      g.arc(this.mx(s.body.x), this.mz(s.body.z), 3.4, 0, Math.PI * 2);
      g.fill();
    }
    g.save();
    g.translate(this.mx(p.body.x), this.mz(p.body.z));
    g.rotate(-p.yaw);
    g.fillStyle = '#b6f02a'; g.strokeStyle = '#141a30'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------- events
  hit(head, kill) {
    this.hitT = kill ? 0.4 : 0.18;
    this.el.hit.className = kill ? 'kill' : head ? 'head' : '';
  }

  damaged(attacker) {
    this.vigT = 0.5;
    if (!attacker) return;
    const el = document.createElement('div');
    el.className = 'dmg-dir';
    this.el.dirs.appendChild(el);
    this.dmgDirs.push({ el, x: attacker.body.x, z: attacker.body.z, t: 1.2 });
  }

  // ---------------------------------------------------------------- frame
  update(game, camera, dt, view) {
    const p = game.player, e = this.el;
    if (!p) return;

    this._set('sb', game.scores[0], (v) => (e.sb.textContent = v));
    this._set('so', game.scores[1], (v) => (e.so.textContent = v));
    const tl = Math.ceil(game.timeLeft);
    this._set('timer', tl, (v) => {
      e.timer.textContent = String((v / 60) | 0).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
      e.timer.classList.toggle('low', v <= 30);
    });

    const hp = Math.max(0, Math.ceil(p.health)), sh = Math.max(0, Math.ceil(p.shield));
    this._set('hp', hp, (v) => {
      e.hp.textContent = v;
      e.hpFill.style.width = (v / P.maxHealth) * 100 + '%';
      e.hpFill.classList.toggle('low', v <= 35);
    });
    this._set('sh', sh, (v) => {
      e.sh.textContent = v;
      e.shFill.style.width = (v / P.maxShield) * 100 + '%';
    });

    const W = WEAPONS[p.weapon], ws = p.weapons[p.weapon];
    this._set('mag', ws.ammo, (v) => {
      e.mag.textContent = v;
      e.mag.classList.toggle('low', v <= W.mag * 0.25);
    });
    this._set('res', ws.reserve, (v) => (e.res.textContent = v));
    this._set('wname', W.name, (v) => (e.wname.textContent = v.toUpperCase()));
    this._set('reload', p.alive && p.reloadT > 0, (v) => e.reload.classList.toggle('on', v));

    const cd = (el, key, left, total) => {
      const f = Math.max(0, Math.min(1, left / total));
      this._set(key, Math.round(f * 50), () => {
        el.querySelector('.cd').style.height = f * 100 + '%';
        el.classList.toggle('ready', f === 0);
      });
    };
    cd(e.dash, 'dash', p.dashCd, ABILITIES.dash.cooldown);
    cd(e.nade, 'nade', p.grenadeCd, ABILITIES.grenade.cooldown);

    // crosshair spreads with bloom / movement, hides when aiming
    const moving = Math.hypot(p.body.vx, p.body.vz) > 1.5 || !p.body.grounded;
    const gap = Math.round(5 + (p.bloom + (moving ? W.moveSpread : 0)) * 420);
    this._set('gap', gap, (v) => e.cross.style.setProperty('--gap', v + 'px'));
    this._set('crossOn', p.alive && view.ads < 0.6, (v) => (e.cross.style.opacity = v ? 1 : 0));

    // hit marker + damage feedback
    if (this.hitT > 0) { this.hitT -= dt; e.hit.style.opacity = Math.min(1, this.hitT * 8); }
    else this._set('hitOff', true, () => (e.hit.style.opacity = 0));
    if (this.hitT > 0) this.cache.hitOff = false;
    if (this.vigT > 0) { this.vigT -= dt; e.vig.style.opacity = Math.max(0, this.vigT * 1.6); this.cache.vigOff = false; }
    else this._set('vigOff', true, () => (e.vig.style.opacity = 0));
    for (let i = this.dmgDirs.length - 1; i >= 0; i--) {
      const d = this.dmgDirs[i];
      d.t -= dt;
      if (d.t <= 0) { d.el.remove(); this.dmgDirs.splice(i, 1); continue; }
      const ang = Math.atan2(d.x - p.body.x, -(d.z - p.body.z)) + p.yaw;
      d.el.style.transform = `rotate(${ang}rad)`;
      d.el.style.opacity = Math.min(1, d.t * 2);
    }

    // kill feed
    const key = game.killfeed.map((k) => k.t).join(',');
    if (key !== this.feedKey) {
      this.feedKey = key;
      e.feed.innerHTML = game.killfeed.map((k) => {
        const mine = k.killer === p || k.victim === p;
        const icon = k.weapon === 'grenade' ? '<b>✹</b>' : k.weapon === 'fall' ? '<b>↓</b>' : GUN_SVG;
        return `<div class="kf${mine ? ' mine' : ''}">` +
          (k.killer ? `<span class="t${k.killer.team}">${esc(k.killer.name)}</span>` : '') +
          icon + (k.head ? '<span class="hs">HEAD</span>' : '') +
          `<span class="t${k.victim.team}">${esc(k.victim.name)}</span></div>`;
      }).join('');
    }

    // line-of-sight cache (5 Hz) feeds name tags and the minimap
    this.visT -= dt;
    if (this.visT <= 0) {
      this.visT = 0.2;
      this.visible.clear();
      const [ex, ey, ez] = game.eye(p);
      for (const s of game.soldiers) {
        if (s === p || !s.alive) continue;
        if (game.world.lineOfSight(ex, ey, ez, s.body.x, s.body.y + 1.5, s.body.z)) this.visible.add(s);
      }
    }
    this._nameTags(game, camera);
    this._drawMinimap(game);

    // centre messages: countdown / death
    let msg = '';
    if (game.countdown > 0) msg = `<div class="big lime">${Math.ceil(game.countdown)}</div><div class="sub">GET READY</div>`;
    else if (game.countdown > -1) msg = '<div class="big lime">GO!</div>';
    else if (!p.alive) {
      const k = p.lastAttacker && p.lastAttacker !== p ? p.lastAttacker : null;
      msg = `<div class="sub">ELIMINATED${k ? ` BY <span class="t${k.team}">${esc(k.name)}</span>` : ''}</div>` +
        `<div class="sub">Respawning in ${Math.max(1, Math.ceil(p.respawnT))}</div>`;
    } else if (p.protectT > 0) msg = '<div class="sub lime">SPAWN PROTECTION</div>';
    this._set('msg', msg, (v) => (e.msg.innerHTML = v));

    // scoreboard (held Tab) refreshes a few times a second
    this._set('boardOn', !!view.scoreboard, (v) => { e.board.classList.toggle('hidden', !v); this.boardT = 0; });
    if (view.scoreboard) {
      this.boardT -= dt;
      if (this.boardT <= 0) { this.boardT = 0.25; e.board.innerHTML = this.boardHtml(game); }
    }

    if (view.showFps) {
      this.fpsT += dt; this.fpsN++;
      if (this.fpsT >= 0.5) { e.fps.textContent = Math.round(this.fpsN / this.fpsT) + ' FPS'; this.fpsT = 0; this.fpsN = 0; }
    } else this._set('fpsOff', true, () => (e.fps.textContent = ''));
    if (view.showFps) this.cache.fpsOff = false;
  }

  _nameTags(game, camera) {
    const p = game.player, w = innerWidth, h = innerHeight;
    for (const s of game.soldiers) {
      if (s === p) continue;
      let tag = this.tags.get(s);
      const ally = s.team === p.team;
      let show = s.alive && (ally || this.visible.has(s));
      if (show) {
        _v.set(s.body.x, s.body.y + 2.05, s.body.z).project(camera);
        if (_v.z > 1 || _v.z < -1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) show = false;
      }
      if (!show) { if (tag && tag.style.display !== 'none') tag.style.display = 'none'; continue; }
      if (!tag) {
        tag = document.createElement('div');
        tag.className = 'tag ' + (ally ? 'ally' : 'enemy');
        tag.textContent = s.name;
        this.el.tags.appendChild(tag);
        this.tags.set(s, tag);
      }
      tag.style.display = '';
      const x = (_v.x * 0.5 + 0.5) * w, y = (-_v.y * 0.5 + 0.5) * h;
      tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  boardHtml(game) {
    const p = game.player;
    const col = (team) => {
      const rows = game.soldiers.filter((s) => s.team === team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      return `<div class="col${team}"><h3><span>${TEAM_INFO[team].name}</span><span>${game.scores[team]}</span></h3>` +
        '<table><tr><th>PLAYER</th><th>K</th><th>D</th></tr>' +
        rows.map((s) => `<tr class="${s === p ? 'me' : ''}${s.alive ? '' : ' dead'}"><td>${esc(s.name)}</td><td>${s.kills}</td><td>${s.deaths}</td></tr>`).join('') +
        '</table></div>';
    };
    return `<div class="board">${col(0)}${col(1)}</div>`;
  }
}
