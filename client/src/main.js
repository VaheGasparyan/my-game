import './style.css';
import * as THREE from 'three';
import { MAPS, DEFAULT_MAP, getMap } from '@shared/maps/index.js';
import { World } from '@shared/world.js';
import { NavGraph } from '@shared/nav.js';
import { GAME_TITLE, PLAYER as P, PRIMARIES, DEFAULT_PRIMARY, weaponOf } from '@shared/config.js';
import { settings, saveSettings } from './settings.js';
import { Input } from './input.js';
import { sfx } from './audio.js';
import { buildScene } from './scene.js';
import { Effects } from './effects.js';
import { ViewModel } from './viewmodel.js';
import { Game } from './game.js';
import { loadCharacters } from './character.js';
import { Hud } from './hud.js';

const $ = (id) => document.getElementById(id);
document.title = GAME_TITLE;
document.querySelectorAll('[data-title]').forEach((el) => (el.textContent = GAME_TITLE));

// ---------------------------------------------------------------- engine setup
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;

// everything that depends on the chosen map lives in `env` and is rebuilt by setMap()
let env = null; // { map, world, nav, scene, sun, effects, dispose }
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 1000);
camera.rotation.order = 'YXZ';
const viewmodel = new ViewModel();
const input = new Input(canvas);
const hud = new Hud();

// local view state that isn't part of the simulation
const view = { yaw: 0, pitch: 0, ads: 0, scoped: false, camY: 0, shake: 0, scoreboard: false, showFps: settings.showFps, stepT: 0 };

const game = new Game({
  world: null, nav: null, scene: null, effects: { clear() {} },
  hooks: {
    onPlayerSpawn(s) { view.yaw = s.yaw; view.pitch = 0; view.camY = s.body.y; viewmodel.lower = 1; },
    onPlayerShot(W) {
      const k = input.buttons[2] ? 0.6 : 1;
      view.pitch += W.recoil * k;
      view.yaw += (Math.random() - 0.5) * W.recoil * 0.7 * k;
      viewmodel.fire();
    },
    onPlayerHit(head, kill) { hud.hit(head, kill); if (kill) sfx.kill(); else sfx.hit(head); },
    onPlayerDamaged(attacker) { hud.damaged(attacker); sfx.hurt(); view.shake = Math.max(view.shake, 0.25); },
    onPlayerDeath() { view.shake = 0.5; },
    onExplosion(x, y, z) {
      const p = game.player;
      if (!p) return;
      const d = Math.hypot(x - p.body.x, y - p.body.y, z - p.body.z);
      view.shake = Math.max(view.shake, Math.max(0, 1 - d / 22));
    },
    onEnd(winner) { endMatch(winner); },
  },
});

function setMap(id) {
  const map = getMap(id);
  if (env?.map === map) return;
  const world = new World(map);
  const nav = new NavGraph(world);
  const built = buildScene(map);
  const effects = new Effects(built.scene, world);
  game.setEnvironment({ world, nav, scene: built.scene, effects }); // also ends any running match
  env?.dispose();
  env = { map, world, nav, effects, ...built };
  env.sun.castShadow = settings.shadows;
  renderer.shadowMap.needsUpdate = true;
  hud.setMap(map);
  $('menu-map').textContent = map.name;
  $('map-blurb').textContent = map.blurb || '';
}
if (!MAPS.some((x) => x.id === settings.map)) settings.map = DEFAULT_MAP;
$('set-map').innerHTML = MAPS.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');
setMap(settings.map);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  viewmodel.resize(w / h);
}
addEventListener('resize', resize);
resize();

function applySettings() {
  sfx.setVolume(settings.volume);
  view.showFps = settings.showFps;
  if (env.map.id !== settings.map) setMap(settings.map); // menu background follows the picker
  if (env.sun.castShadow !== settings.shadows) {
    env.sun.castShadow = settings.shadows;
    renderer.shadowMap.needsUpdate = true;
  }
}
applySettings();

// ---------------------------------------------------------------- menus / app state
// app state: menu | playing | paused | ended
let state = 'menu';
let returnTo = 'menu-main'; // where Settings/Controls "back" goes
const MENUS = ['menu-main', 'menu-play', 'menu-settings', 'menu-controls', 'menu-pause', 'menu-end'];

function showMenu(id) {
  for (const m of MENUS) $(m).classList.toggle('hidden', m !== id);
  if (id) $(id).querySelector('.btn.primary, .btn')?.focus({ preventScroll: true });
}

function bindSettings() {
  const fields = ['name', 'map', 'primary', 'difficulty', 'teamSize', 'duration', 'scoreLimit', 'sensitivity', 'fov', 'volume', 'invertY', 'shadows', 'showFps'];
  for (const f of fields) {
    const el = $('set-' + f);
    const out = $('out-' + f);
    const isCheck = el.type === 'checkbox';
    const numeric = typeof settings[f] === 'number';
    if (f === 'primary') el.addEventListener('input', () => queueMicrotask(syncLoadoutUi));
    const show = () => { if (out) out.textContent = f === 'volume' ? Math.round(settings[f] * 100) + '%' : f === 'fov' ? settings[f] + '°' : settings[f].toFixed(2); };
    if (isCheck) el.checked = settings[f]; else el.value = settings[f];
    show();
    el.addEventListener('input', () => {
      settings[f] = isCheck ? el.checked : numeric ? Number(el.value) : el.value;
      show();
      saveSettings();
      applySettings();
    });
  }
}

// ---- loadout pickers (match setup + pause menu) ----
if (!PRIMARIES.some((w) => w.id === settings.primary)) settings.primary = DEFAULT_PRIMARY;
for (const id of ['set-primary', 'pause-primary']) {
  $(id).innerHTML = PRIMARIES.map((w) => `<option value="${w.id}">${w.name}</option>`).join('');
}
function syncLoadoutUi() {
  $('set-primary').value = settings.primary;
  $('pause-primary').value = settings.primary;
  const w = PRIMARIES.find((x) => x.id === settings.primary);
  const bar = (label, f) => `<span>${label}</span><i><b style="width:${Math.round(Math.max(0.06, Math.min(1, f)) * 100)}%"></b></i>`;
  const html =
    bar('DAMAGE', (w.damage * (w.pellets || 1)) / 115) +
    bar('FIRE RATE', w.rpm / 900) +
    bar('ACCURACY', 1 - ((w.scope ? w.adsSpread : w.spread) + w.moveSpread * 0.5) / 0.08) +
    bar('CONTROL', 1 - w.recoil / 0.065) +
    bar('RANGE', w.range / 200);
  $('wstats-play').innerHTML = html;
  $('wstats-pause').innerHTML = html;
}
bindSettings();
syncLoadoutUi();
$('pause-primary').addEventListener('input', (e) => {
  settings.primary = e.target.value;
  saveSettings();
  syncLoadoutUi();
  if (game.player) game.setPrimary(game.player, settings.primary); // takes effect immediately
});

const charactersReady = loadCharacters(); // starts downloading the hero model right away

async function startMatch() {
  await charactersReady;
  sfx.init();
  sfx.resume();
  hud.reset();
  game.start({
    teamSize: settings.teamSize,
    duration: settings.duration,
    scoreLimit: settings.scoreLimit,
    difficulty: settings.difficulty,
    primary: settings.primary,
    playerName: (settings.name || 'You').trim() || 'You',
  });
  state = 'playing';
  showMenu(null);
  hud.show(true);
  await input.lock();
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  returnTo = 'menu-pause';
  showMenu('menu-pause');
  sfx.suspend();
}

async function resume() {
  if (state !== 'paused') return;
  // Browsers refuse to re-lock the pointer for ~1 s after Esc; stay paused if that happens.
  const ok = await input.lock();
  if (!ok && !input.locked) return;
  state = 'playing';
  showMenu(null);
  sfx.resume();
}

function quitToMenu() {
  input.unlock();
  game.stop();
  hud.show(false);
  state = 'menu';
  returnTo = 'menu-main';
  showMenu('menu-main');
  sfx.resume();
}

function endMatch(winner) {
  state = 'ended';
  input.unlock();
  const p = game.player;
  const title = $('end-title');
  const won = winner === p.team;
  title.textContent = winner < 0 ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
  title.className = winner < 0 ? '' : won ? 'win' : 'lose';
  $('end-score').innerHTML = `<span class="b">${game.scores[0]}</span> &ndash; <span class="o">${game.scores[1]}</span>`;
  $('end-board').innerHTML = hud.boardHtml(game);
  showMenu('menu-end');
  sfx.horn(won);
}

input.onLockChange = (locked) => {
  if (!locked && state === 'playing') pause();
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  sfx.init();
  sfx.ui();
  switch (btn.dataset.action) {
    case 'play': showMenu('menu-play'); break;
    case 'start': startMatch(); break;
    case 'settings': showMenu('menu-settings'); break;
    case 'controls': showMenu('menu-controls'); break;
    case 'back': showMenu(returnTo); break;
    case 'resume': resume(); break;
    case 'quit': quitToMenu(); break;
  }
});

// clicking the dimmed backdrop of the pause menu (or the canvas) also resumes
canvas.addEventListener('click', () => {
  if (state === 'playing' && !input.locked) input.lock();
});
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  // Esc while locked is consumed by the browser (it exits pointer lock → pause()).
  if (state === 'paused' && !$('menu-pause').classList.contains('hidden')) resume();
  else if (!$('menu-settings').classList.contains('hidden') || !$('menu-controls').classList.contains('hidden') || !$('menu-play').classList.contains('hidden')) showMenu(returnTo);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') { input.unlock(); pause(); }
});

// ---------------------------------------------------------------- player control
function controlPlayer(dt) {
  const p = game.player, c = p.cmd;
  const ads = input.buttons[2] && p.alive && p.reloadT <= 0;
  const sens = 0.0022 * settings.sensitivity * (1 - view.ads * (1 - weaponOf(p).zoom));
  view.yaw -= input.mouseDX * sens;
  view.pitch -= input.mouseDY * sens * (settings.invertY ? -1 : 1);
  view.pitch = Math.max(-1.5, Math.min(1.5, view.pitch));

  const f = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
  const r = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
  const sin = Math.sin(view.yaw), cos = Math.cos(view.yaw);
  let wx = -sin * f + cos * r, wz = -cos * f - sin * r;
  const l = Math.hypot(wx, wz);
  if (l > 1) { wx /= l; wz /= l; }

  c.wx = wx; c.wz = wz;
  c.yaw = view.yaw; c.pitch = view.pitch;
  c.jump = input.down('Space');
  c.ads = ads;
  c.sprint = (input.down('ShiftLeft') || input.down('ShiftRight')) && f > 0 && !ads;
  c.fire = input.buttons[0];
  c.reload = input.hit('KeyR');
  c.dash = input.hit('KeyQ');
  c.grenade = input.hit('KeyE');
  c.weapon = -1;
  if (input.hit('Digit1')) c.weapon = 0;
  else if (input.hit('Digit2')) c.weapon = 1;
  else if (input.wheel !== 0) c.weapon = (p.weapon + 1) % p.loadout.length;
  view.scoreboard = input.down('Tab');
}

function updateCamera(dt) {
  const p = game.player, b = p.body;
  const k = 1 - Math.exp(-18 * dt);
  // smooth out step-ups; snap on big changes (respawn)
  if (Math.abs(b.y - view.camY) > 1.2 || !b.grounded) view.camY = b.y;
  else view.camY += (b.y - view.camY) * k;

  view.ads += ((input.buttons[2] && p.alive && p.reloadT <= 0 ? 1 : 0) - view.ads) * (1 - Math.exp(-14 * dt));
  const fov = settings.fov * (1 - view.ads * (1 - weaponOf(p).zoom));
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  view.shake = Math.max(0, view.shake - dt * 2.2);
  const sh = view.shake * view.shake * 0.12;
  camera.position.set(
    b.x + (Math.random() - 0.5) * sh,
    view.camY + (p.alive ? P.eye : 0.9) + (Math.random() - 0.5) * sh,
    b.z + (Math.random() - 0.5) * sh,
  );
  camera.rotation.set(p.alive ? p.pitch : Math.min(p.pitch, -0.2), p.yaw, (Math.random() - 0.5) * sh * 0.3);

  // footsteps
  const speed = Math.hypot(b.vx, b.vz);
  if (p.alive && b.grounded && speed > 2) {
    view.stepT -= dt * speed;
    if (view.stepT <= 0) { view.stepT = 2.6; sfx.step(speed > 7 ? 1.3 : 1); }
  }
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
let menuT = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state === 'playing') {
    const look = { dx: input.mouseDX, dy: input.mouseDY };
    controlPlayer(dt);
    game.update(dt);
    if (game.player) {
      const p = game.player;
      // the sim clamps/holds the angles while frozen; keep the view in sync with what it used
      env.effects.update(dt);
      updateCamera(dt);
      const W = weaponOf(p);
      viewmodel.setWeapon(W.id);
      view.scoped = !!W.scope && p.alive && view.ads > 0.8;
      viewmodel.visible = !view.scoped;
      viewmodel.update(dt, p, input.buttons[2], look, p.reloadT > 0 ? 1 - p.reloadT / W.reloadTime : -1);
      hud.update(game, camera, dt, view);
    }
  } else if (state === 'menu') {
    menuT += dt;
    const a = menuT * 0.06 + 0.9;
    const r = env.map.bounds.maxX * 1.3; // orbit distance scales with the arena
    camera.position.set(Math.cos(a) * r, r * 0.39, Math.sin(a) * r);
    camera.lookAt(-6 * Math.cos(a + 1.2), 2, -6 * Math.sin(a + 1.2));
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
  }
  input.endFrame();

  renderer.clear();
  renderer.render(env.scene, camera);
  if (state !== 'menu' && game.player) {
    renderer.clearDepth();
    renderer.render(viewmodel.scene, viewmodel.camera);
  }
}
requestAnimationFrame(frame);

// handy for debugging from the console
if (import.meta.env.DEV) window.__game = { game, view, input, settings, get env() { return env; }, get world() { return env.world; }, get nav() { return env.nav; } };
