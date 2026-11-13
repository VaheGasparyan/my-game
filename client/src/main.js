import './style.css';
import * as THREE from 'three';
import map from '@shared/maps/skyport.js';
import { World } from '@shared/world.js';
import { NavGraph } from '@shared/nav.js';
import { GAME_TITLE, PLAYER as P, WEAPONS } from '@shared/config.js';
import { settings, saveSettings } from './settings.js';
import { Input } from './input.js';
import { sfx } from './audio.js';
import { buildScene } from './scene.js';
import { Effects } from './effects.js';
import { ViewModel } from './viewmodel.js';
import { Game } from './game.js';
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

const world = new World(map);
const nav = new NavGraph(world);
const { scene, sun } = buildScene(map);
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 1000);
camera.rotation.order = 'YXZ';
const effects = new Effects(scene, world);
const viewmodel = new ViewModel();
const input = new Input(canvas);
const hud = new Hud(map);

// local view state that isn't part of the simulation
const view = { yaw: 0, pitch: 0, ads: 0, camY: 0, shake: 0, scoreboard: false, showFps: settings.showFps, stepT: 0 };

const game = new Game({
  world, nav, scene, effects,
  hooks: {
    onPlayerSpawn(s) { view.yaw = s.yaw; view.pitch = 0; view.camY = s.body.y; viewmodel.setWeapon(0); viewmodel.lower = 1; },
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
  if (sun.castShadow !== settings.shadows) {
    sun.castShadow = settings.shadows;
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
  const fields = ['name', 'difficulty', 'teamSize', 'duration', 'scoreLimit', 'sensitivity', 'fov', 'volume', 'invertY', 'shadows', 'showFps'];
  for (const f of fields) {
    const el = $('set-' + f);
    const out = $('out-' + f);
    const isCheck = el.type === 'checkbox';
    const numeric = typeof settings[f] === 'number';
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
bindSettings();

async function startMatch() {
  sfx.init();
  sfx.resume();
  hud.reset();
  game.start({
    teamSize: settings.teamSize,
    duration: settings.duration,
    scoreLimit: settings.scoreLimit,
    difficulty: settings.difficulty,
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
  const sens = 0.0022 * settings.sensitivity * (1 - view.ads * 0.45);
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
  else if (input.wheel !== 0) c.weapon = (p.weapon + 1) % WEAPONS.length;
  view.scoreboard = input.down('Tab');
}

function updateCamera(dt) {
  const p = game.player, b = p.body;
  const k = 1 - Math.exp(-18 * dt);
  // smooth out step-ups; snap on big changes (respawn)
  if (Math.abs(b.y - view.camY) > 1.2 || !b.grounded) view.camY = b.y;
  else view.camY += (b.y - view.camY) * k;

  view.ads += ((input.buttons[2] && p.alive && p.reloadT <= 0 ? 1 : 0) - view.ads) * (1 - Math.exp(-14 * dt));
  const fov = settings.fov * (1 - view.ads * 0.28);
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
      effects.update(dt);
      updateCamera(dt);
      viewmodel.setWeapon(p.weapon);
      const W = WEAPONS[p.weapon];
      viewmodel.update(dt, p, input.buttons[2], look, p.reloadT > 0 ? 1 - p.reloadT / W.reloadTime : -1);
      hud.update(game, camera, dt, view);
    }
  } else if (state === 'menu') {
    menuT += dt;
    const a = menuT * 0.06 + 0.9;
    camera.position.set(Math.cos(a) * 44, 17, Math.sin(a) * 44);
    camera.lookAt(-6 * Math.cos(a + 1.2), 2, -6 * Math.sin(a + 1.2));
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
  }
  input.endFrame();

  renderer.clear();
  renderer.render(scene, camera);
  if (state !== 'menu' && game.player) {
    renderer.clearDepth();
    renderer.render(viewmodel.scene, viewmodel.camera);
  }
}
requestAnimationFrame(frame);

// handy for debugging from the console
if (import.meta.env.DEV) window.__game = { game, view, input, settings, world, nav };
