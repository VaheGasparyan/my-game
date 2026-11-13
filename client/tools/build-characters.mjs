// Generates the game's character models as animated .glb files.
//
//   npm run characters        (from client/)  ->  public/models/<id>.glb
//
// Every character shares the same joint names and animation clips, so the game can treat
// them interchangeably:
//   joints : Hips > Spine > Head | ArmL > ForearmL | ArmR > ForearmR | Weapon > Muzzle
//            Hips > LegL > ShinL | LegR > ShinR
//   clips  : "Idle", "Run"
//   materials named "Team" / "TeamAccent" / "Glow" are recoloured per team by the game.
// Models are 1.8 m tall, stand on y = 0 and face -Z.

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// GLTFExporter's binary path needs a FileReader; Node only has Blob.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
};

const OUT = path.resolve(import.meta.dirname, '../public/models');
const DOWN = new THREE.Vector3(0, -1, 0);

// ------------------------------------------------------------------ materials
function makeMaterials(skin = 0xd9a07e, hair = 0x3a2418) {
  const m = (name, color, extra = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
    mat.name = name;
    return mat;
  };
  return {
    Team: m('Team', 0x2a62f0),
    TeamAccent: m('TeamAccent', 0x9fc0ff),
    Glow: m('Glow', 0x9fc0ff, { emissive: 0x9fc0ff, emissiveIntensity: 1 }),
    Suit: m('Suit', 0x343848),
    Dark: m('Dark', 0x1c1e2a),
    Metal: m('Metal', 0x7b8094, { roughness: 0.55, metalness: 0.3 }),
    Visor: m('Visor', 0x10131f, { roughness: 0.25, metalness: 0.4 }),
    Skin: m('Skin', skin),
    Hair: m('Hair', hair),
  };
}

// ------------------------------------------------------------------ geometry helpers
function flat(g) {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  n.computeVertexNormals(); // per-face normals -> faceted low-poly look
  return n;
}
const box = (w, h, d) => flat(new THREE.BoxGeometry(w, h, d));
const cyl = (rTop, rBot, h, seg = 6) => flat(new THREE.CylinderGeometry(rTop, rBot, h, seg));
const ball = (r, detail = 1) => flat(new THREE.IcosahedronGeometry(r, detail));

function joint(name, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

let meshId = 0;
function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.name = `${parent.name}_${mat.name}_${meshId++}`;
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

/** Two-bone IK: pose an arm (bones pointing down -Y at rest) so the hand lands on `target`. */
function poseArm(arm, forearm, shoulder, target, L1, L2, side) {
  const T = target.clone().sub(shoulder);
  const d = Math.min(T.length(), L1 + L2 - 0.005);
  const dir = T.clone().normalize();
  const alpha = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const pole = new THREE.Vector3(side * 0.7, -1, 0.25).normalize(); // elbows point down and out
  const axis = new THREE.Vector3().crossVectors(dir, pole).normalize();
  const qAim = new THREE.Quaternion().setFromUnitVectors(DOWN, dir);
  let best = null;
  for (const sign of [1, -1]) {
    const qU = new THREE.Quaternion().setFromAxisAngle(axis, alpha * sign).multiply(qAim);
    const u = DOWN.clone().applyQuaternion(qU);
    const elbow = u.clone().multiplyScalar(L1);
    const score = elbow.dot(pole); // prefer the solution whose elbow goes toward the pole
    if (!best || score > best.score) best = { qU, u, elbow, score };
  }
  const f = dir.clone().multiplyScalar(d).sub(best.elbow).normalize();
  const qFworld = new THREE.Quaternion().setFromUnitVectors(best.u, f).multiply(best.qU);
  arm.quaternion.copy(best.qU);
  forearm.quaternion.copy(best.qU.clone().invert().multiply(qFworld));
}

// ------------------------------------------------------------------ shared body
/**
 * p: proportions  { torsoW, torsoD, shoulderX, limb (thickness multiplier), skin, hair }
 * dress(j, M, p): adds the character-specific pieces to the joints
 */
function buildCharacter(id, p, dress) {
  const M = makeMaterials(p.skin, p.hair);
  const k = p.limb ?? 1;
  const root = new THREE.Scene();
  root.name = id;

  const j = {};
  j.Hips = joint('Hips', root, 0, 0.95, 0);
  j.Spine = joint('Spine', j.Hips, 0, 0.1, 0);
  j.Head = joint('Head', j.Spine, 0, 0.48, 0);
  j.ArmL = joint('ArmL', j.Spine, -p.shoulderX, 0.4, 0);
  j.ForearmL = joint('ForearmL', j.ArmL, 0, -0.3, 0);
  j.ArmR = joint('ArmR', j.Spine, p.shoulderX, 0.4, 0);
  j.ForearmR = joint('ForearmR', j.ArmR, 0, -0.3, 0);
  j.Weapon = joint('Weapon', j.Spine, 0.05, 0.2, -0.22);
  j.Muzzle = joint('Muzzle', j.Weapon, 0, 0.05, -0.62);
  j.LegL = joint('LegL', j.Hips, -0.11, -0.06, 0);
  j.ShinL = joint('ShinL', j.LegL, 0, -0.42, 0);
  j.LegR = joint('LegR', j.Hips, 0.11, -0.06, 0);
  j.ShinR = joint('ShinR', j.LegR, 0, -0.42, 0);

  // pelvis + torso
  add(j.Hips, box(p.torsoW * 0.86, 0.18, p.torsoD * 0.92), M.Suit, 0, 0, 0);
  add(j.Hips, box(p.torsoW * 0.92, 0.06, p.torsoD), M.Dark, 0, 0.09, 0);
  add(j.Hips, box(0.09, 0.07, 0.03), M.Metal, 0, 0.09, -p.torsoD / 2);
  add(j.Spine, box(p.torsoW, 0.44, p.torsoD), M.Suit, 0, 0.24, 0);

  // neck + head
  add(j.Head, cyl(0.05, 0.06, 0.1), M.Skin, 0, 0.03, 0);
  add(j.Head, box(0.19, 0.22, 0.2), M.Skin, 0, 0.17, 0);

  // limbs
  for (const s of ['L', 'R']) {
    add(j['Arm' + s], cyl(0.055 * k, 0.048 * k, 0.3), M.Suit, 0, -0.15, 0);
    add(j['Forearm' + s], cyl(0.05 * k, 0.042 * k, 0.24), p.sleeves ? M.Team : M.Suit, 0, -0.12, 0);
    add(j['Forearm' + s], box(0.085 * k, 0.1, 0.095 * k), M.Dark, 0, -0.275, 0); // glove
    add(j['Leg' + s], cyl(0.088 * k, 0.07 * k, 0.44), M.Suit, 0, -0.21, 0);
    add(j['Shin' + s], cyl(0.068 * k, 0.056 * k, 0.38), M.Suit, 0, -0.18, 0);
    add(j['Shin' + s], box(0.13 * k, 0.12, 0.27), M.Dark, 0, -0.41, -0.045);      // boot
    add(j['Shin' + s], box(0.135 * k, 0.03, 0.28), M.Metal, 0, -0.455, -0.045);   // sole
  }

  // rifle (origin at the grip, pointing -Z)
  const W = j.Weapon;
  add(W, box(0.055, 0.09, 0.4), M.Dark, 0, 0.05, -0.1);
  add(W, box(0.06, 0.07, 0.2), M.Metal, 0, 0.05, -0.33);
  add(W, box(0.028, 0.028, 0.22), M.Dark, 0, 0.055, -0.52);
  add(W, box(0.045, 0.15, 0.065), M.Metal, 0, -0.06, -0.13, 0.2);
  add(W, box(0.045, 0.11, 0.05), M.Dark, 0, -0.03, 0.02, -0.3);
  add(W, box(0.05, 0.08, 0.1), M.Dark, 0, 0.04, 0.13);
  add(W, box(0.04, 0.04, 0.09), M.TeamAccent, 0, 0.115, -0.08);

  dress(j, M, p);

  // rest pose: both hands on the rifle
  const spineLocal = (node, v) => node.localToWorld(v.clone()).sub(j.Spine.getWorldPosition(new THREE.Vector3()));
  root.updateMatrixWorld(true);
  const grip = spineLocal(W, new THREE.Vector3(0, -0.02, 0.02));
  const fore = spineLocal(W, new THREE.Vector3(-0.01, 0.0, -0.3));
  poseArm(j.ArmR, j.ForearmR, j.ArmR.position, grip, 0.3, 0.275, 1);
  poseArm(j.ArmL, j.ForearmL, j.ArmL.position, fore, 0.3, 0.275, -1);
  root.updateMatrixWorld(true);

  return { root, j, clips: buildClips(j) };
}

// ------------------------------------------------------------------ animation
function buildClips(j) {
  const quat = (x, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const track = (node, times, fn) => {
    const v = [];
    for (const t of times) v.push(...fn(t).toArray());
    return new THREE.QuaternionKeyframeTrack(node.name + '.quaternion', times, v);
  };
  const posTrack = (node, times, fn) => {
    const v = [];
    for (const t of times) v.push(...fn(t));
    return new THREE.VectorKeyframeTrack(node.name + '.position', times, v);
  };
  const sample = (dur, n) => Array.from({ length: n + 1 }, (_, i) => (dur * i) / n);
  const hip = j.Hips.position;

  // Idle: breathing + a slow look around
  const iD = 3.2, iT = sample(iD, 16), w = (t) => (t / iD) * Math.PI * 2;
  const idle = new THREE.AnimationClip('Idle', iD, [
    posTrack(j.Hips, iT, (t) => [hip.x, hip.y + Math.sin(w(t) * 2) * 0.006 - 0.006, hip.z]),
    track(j.Spine, iT, (t) => quat(Math.sin(w(t) * 2) * 0.018, Math.sin(w(t)) * 0.05)),
    track(j.Head, iT, (t) => quat(0, Math.sin(w(t)) * 0.16)),
    track(j.LegL, iT, () => quat(0.06, 0, 0.05)),
    track(j.LegR, iT, () => quat(-0.05, 0, -0.05)),
    track(j.ShinL, iT, () => quat(-0.08)),
    track(j.ShinR, iT, () => quat(-0.03)),
  ]);

  // Run: one full stride per loop
  const rD = 0.64, rT = sample(rD, 16), ph = (t) => (t / rD) * Math.PI * 2;
  const thigh = (a) => Math.sin(a) * 0.82 + 0.12;
  const knee = (a) => -(0.25 + 1.15 * (0.5 + 0.5 * Math.cos(a - 0.5))); // most bent while swinging forward
  const run = new THREE.AnimationClip('Run', rD, [
    posTrack(j.Hips, rT, (t) => [hip.x, hip.y - 0.035 + Math.cos(ph(t) * 2) * 0.03, hip.z]),
    track(j.Hips, rT, (t) => quat(0, Math.sin(ph(t)) * 0.1, 0)),
    track(j.Spine, rT, (t) => quat(-0.16 + Math.cos(ph(t) * 2) * 0.025, -Math.sin(ph(t)) * 0.16, 0)),
    track(j.Head, rT, (t) => quat(0.08, Math.sin(ph(t)) * 0.06)),
    track(j.LegL, rT, (t) => quat(thigh(ph(t)))),
    track(j.LegR, rT, (t) => quat(thigh(ph(t) + Math.PI))),
    track(j.ShinL, rT, (t) => quat(knee(ph(t)))),
    track(j.ShinR, rT, (t) => quat(knee(ph(t) + Math.PI))),
  ]);
  return [idle, run];
}

// ------------------------------------------------------------------ the roster
const CHARACTERS = {
  // Standard infantry: helmet with visor, chest plate, backpack.
  trooper: [{ torsoW: 0.4, torsoD: 0.24, shoulderX: 0.26 }, (j, M) => {
    add(j.Spine, box(0.42, 0.27, 0.27), M.Team, 0, 0.31, 0);
    add(j.Spine, box(0.3, 0.05, 0.02), M.TeamAccent, 0, 0.36, -0.14);
    add(j.Spine, box(0.11, 0.09, 0.05), M.Dark, -0.1, 0.11, -0.14);
    add(j.Spine, box(0.11, 0.09, 0.05), M.Dark, 0.1, 0.11, -0.14);
    add(j.Spine, box(0.27, 0.32, 0.11), M.Dark, 0, 0.27, 0.175);
    add(j.Spine, box(0.2, 0.08, 0.06), M.Metal, 0, 0.44, 0.19);
    add(j.Head, box(0.25, 0.14, 0.27), M.Team, 0, 0.255, 0.005);
    add(j.Head, box(0.25, 0.1, 0.12), M.Team, 0, 0.16, 0.08);
    add(j.Head, box(0.205, 0.075, 0.03), M.Visor, 0, 0.175, -0.105);
    add(j.Head, box(0.03, 0.09, 0.09), M.Dark, -0.125, 0.17, 0);
    add(j.Head, box(0.03, 0.09, 0.09), M.Dark, 0.125, 0.17, 0);
    for (const s of [-1, 1]) {
      add(j[s < 0 ? 'ArmL' : 'ArmR'], box(0.15, 0.1, 0.16), M.Team, s * 0.01, -0.02, 0);
      add(j[s < 0 ? 'ShinL' : 'ShinR'], box(0.13, 0.12, 0.05), M.Team, 0, -0.02, -0.075);
    }
  }],

  // Light skirmisher: cap, goggles, scarf, team-coloured sleeves, bandolier.
  scout: [{ torsoW: 0.35, torsoD: 0.21, shoulderX: 0.235, limb: 0.9, sleeves: true, skin: 0x8d5a3c, hair: 0x1d1512 }, (j, M) => {
    add(j.Spine, box(0.37, 0.2, 0.235), M.Team, 0, 0.36, 0);
    add(j.Spine, box(0.06, 0.52, 0.03), M.Dark, 0, 0.26, -0.115, 0, 0, 0.72);
    add(j.Spine, box(0.08, 0.07, 0.04), M.Metal, 0.09, 0.17, -0.125);
    add(j.Spine, box(0.2, 0.2, 0.08), M.Dark, 0, 0.3, 0.14);
    add(j.Spine, box(0.27, 0.08, 0.27), M.TeamAccent, 0, 0.47, 0);            // scarf
    add(j.Spine, box(0.09, 0.2, 0.03), M.TeamAccent, -0.08, 0.36, 0.14, 0.15); // scarf tail
    add(j.Head, box(0.215, 0.08, 0.23), M.Team, 0, 0.29, 0.005);               // cap
    add(j.Head, box(0.2, 0.02, 0.1), M.Team, 0, 0.26, -0.15);                  // brim
    add(j.Head, box(0.2, 0.055, 0.035), M.Visor, 0, 0.19, -0.1);               // goggles
    add(j.Head, box(0.225, 0.03, 0.2), M.Dark, 0, 0.19, 0.01);                 // strap
    add(j.Head, box(0.2, 0.16, 0.05), M.Hair, 0, 0.16, 0.1);
    add(j.ShinL, box(0.11, 0.1, 0.045), M.Dark, 0, -0.02, -0.065);
    add(j.ShinR, box(0.11, 0.1, 0.045), M.Dark, 0, -0.02, -0.065);
    add(j.LegR, box(0.05, 0.16, 0.1), M.Dark, 0.085, -0.14, 0);                // holster
  }],

  // Heavy assault: wide armour, sealed helmet with a glowing slit, twin tanks.
  heavy: [{ torsoW: 0.48, torsoD: 0.29, shoulderX: 0.31, limb: 1.28 }, (j, M) => {
    add(j.Spine, box(0.51, 0.3, 0.33), M.Team, 0, 0.31, 0);
    add(j.Spine, box(0.36, 0.14, 0.05), M.Metal, 0, 0.14, -0.15);
    add(j.Spine, box(0.14, 0.14, 0.03), M.TeamAccent, 0, 0.32, -0.17);
    add(j.Spine, cyl(0.075, 0.075, 0.36, 8), M.Metal, -0.1, 0.27, 0.21);
    add(j.Spine, cyl(0.075, 0.075, 0.36, 8), M.Metal, 0.1, 0.27, 0.21);
    add(j.Spine, box(0.3, 0.06, 0.1), M.Dark, 0, 0.42, 0.2);
    add(j.Head, box(0.27, 0.27, 0.29), M.Dark, 0, 0.17, 0);
    add(j.Head, box(0.29, 0.07, 0.31), M.Team, 0, 0.3, 0);
    add(j.Head, box(0.21, 0.035, 0.02), M.Glow, 0, 0.19, -0.15);
    add(j.Head, box(0.13, 0.09, 0.07), M.Metal, 0, 0.08, -0.14);
    for (const s of [-1, 1]) {
      add(j[s < 0 ? 'ArmL' : 'ArmR'], box(0.21, 0.14, 0.23), M.Team, s * 0.02, -0.01, 0);
      add(j[s < 0 ? 'ArmL' : 'ArmR'], box(0.22, 0.03, 0.24), M.TeamAccent, s * 0.02, 0.07, 0);
      add(j[s < 0 ? 'ForearmL' : 'ForearmR'], box(0.14, 0.15, 0.14), M.Metal, 0, -0.1, 0);
      add(j[s < 0 ? 'LegL' : 'LegR'], box(0.19, 0.2, 0.06), M.Team, 0, -0.16, -0.1);
      add(j[s < 0 ? 'ShinL' : 'ShinR'], box(0.17, 0.26, 0.07), M.Team, 0, -0.12, -0.09);
    }
  }],

  // Stealth operative: hood, mask with a glowing band, single shoulder plate, half cape.
  specter: [{ torsoW: 0.37, torsoD: 0.22, shoulderX: 0.245, limb: 0.95, skin: 0xc48a6a }, (j, M) => {
    add(j.Spine, box(0.385, 0.16, 0.24), M.Dark, 0, 0.38, 0);
    add(j.Spine, box(0.2, 0.2, 0.03), M.Team, 0, 0.24, -0.115);
    add(j.Spine, box(0.05, 0.3, 0.035), M.TeamAccent, 0, 0.26, -0.125);
    add(j.Spine, box(0.36, 0.56, 0.025), M.Team, 0, 0.14, 0.15, -0.14);          // cape
    add(j.Spine, box(0.36, 0.04, 0.03), M.TeamAccent, 0, -0.13, 0.19, -0.14);
    add(j.Head, cyl(0.1, 0.165, 0.3, 6), M.Dark, 0, 0.19, 0.02);                 // hood
    add(j.Head, box(0.17, 0.17, 0.04), M.Metal, 0, 0.15, -0.105);                // mask
    add(j.Head, box(0.175, 0.032, 0.02), M.Glow, 0, 0.19, -0.13);
    add(j.Head, box(0.015, 0.2, 0.015), M.Metal, 0.12, 0.34, 0.03);              // antenna
    add(j.ArmL, box(0.19, 0.08, 0.2), M.Team, -0.03, 0.02, 0, 0, 0, 0.35);       // shoulder plate
    add(j.ArmL, box(0.16, 0.07, 0.18), M.TeamAccent, -0.045, -0.06, 0, 0, 0, 0.35);
    add(j.ForearmR, box(0.1, 0.12, 0.11), M.Team, 0, -0.1, 0);
    add(j.LegL, box(0.05, 0.18, 0.1), M.Dark, -0.085, -0.15, 0);
    add(j.LegL, box(0.2, 0.035, 0.2), M.Metal, 0, -0.1, 0);
    add(j.ShinL, box(0.11, 0.1, 0.045), M.Metal, 0, -0.02, -0.07);
    add(j.ShinR, box(0.11, 0.1, 0.045), M.Metal, 0, -0.02, -0.07);
  }],
};

// ------------------------------------------------------------------ export
fs.mkdirSync(OUT, { recursive: true });
const exporter = new GLTFExporter();
for (const [id, [proportions, dress]] of Object.entries(CHARACTERS)) {
  const { root, clips } = buildCharacter(id, proportions, dress);
  const bounds = new THREE.Box3().setFromObject(root);
  const glb = await exporter.parseAsync(root, { binary: true, animations: clips });
  const file = path.join(OUT, id + '.glb');
  fs.writeFileSync(file, Buffer.from(glb));
  console.log(
    `${id.padEnd(8)} ${(glb.byteLength / 1024).toFixed(1).padStart(6)} kB   height ${bounds.max.y.toFixed(2)} m   feet ${bounds.min.y.toFixed(3)}   ` +
    `clips: ${clips.map((c) => c.name).join(', ')}`,
  );
}
