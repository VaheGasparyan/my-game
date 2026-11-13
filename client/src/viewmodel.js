// First-person weapons, rendered in their own scene on top of the world so they never clip into walls.
// Each builder returns a Group pointing down -Z with userData describing how to hold it:
//   muzzle  : where the flash appears          sightY : height of the sight line above the origin
//   hip     : resting position                 adsZ   : distance from the eye while aiming
//   kick/kickRot : recoil animation strength

import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1);
const lam = (color) => new THREE.MeshLambertMaterial({ color });
const M = {
  body: lam(0xd4d6e2),
  dark: lam(0x2f3142),
  metal: lam(0x23252f),
  steel: lam(0x4a4d5c),
  mid: lam(0x6a6d82),
  lime: lam(0xb6f02a),
  grip: lam(0xe0933c),
  wood: lam(0x9a5f2c),
  woodDark: lam(0x7a4720),
  bakelite: lam(0xb4552a),
  glove: lam(0x2a62f0),
  sleeve: lam(0x343848),
  glass: lam(0x5fd0ff),
  dot: new THREE.MeshBasicMaterial({ color: 0xff3030 }),
  flash: new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.95 }),
};

function part(parent, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

/** Support hand under the fore-end + trigger hand on the grip. */
function hands(g, foreZ, foreY, gripZ, gripY = -0.12) {
  part(g, M.glove, 0.1, 0.08, 0.13, -0.01, foreY, foreZ);
  part(g, M.glove, 0.09, 0.09, 0.3, -0.1, foreY - 0.085, foreZ + 0.11, 0.75, 0.55, 0);
  part(g, M.glove, 0.085, 0.1, 0.1, 0.005, gripY, gripZ);
  part(g, M.sleeve, 0.09, 0.09, 0.28, 0.05, gripY - 0.1, gripZ + 0.11, -0.6, -0.25, 0);
}

function buildAK47() {
  const g = new THREE.Group();
  part(g, M.metal, 0.07, 0.1, 0.38, 0, 0, -0.03);               // stamped receiver
  part(g, M.steel, 0.062, 0.03, 0.3, 0, 0.062, -0.01);          // dust cover
  part(g, M.steel, 0.02, 0.02, 0.05, 0.045, 0.03, -0.06);       // charging handle
  part(g, M.wood, 0.076, 0.085, 0.24, 0, -0.012, -0.34);        // lower handguard
  part(g, M.woodDark, 0.052, 0.04, 0.2, 0, 0.052, -0.33);       // gas tube cover
  part(g, M.metal, 0.03, 0.03, 0.36, 0, -0.005, -0.62);         // barrel
  part(g, M.metal, 0.024, 0.024, 0.16, 0, 0.05, -0.5);          // gas tube
  part(g, M.metal, 0.04, 0.085, 0.035, 0, 0.022, -0.59);        // gas block
  part(g, M.metal, 0.036, 0.1, 0.03, 0, 0.045, -0.75);          // front sight tower
  part(g, M.metal, 0.012, 0.03, 0.012, 0, 0.1, -0.75);          // front sight post
  part(g, M.metal, 0.04, 0.04, 0.05, 0, -0.005, -0.82, 0, 0, 0.25); // slanted muzzle brake
  part(g, M.metal, 0.05, 0.02, 0.07, 0, 0.088, -0.17);          // rear sight leaf
  part(g, M.metal, 0.014, 0.022, 0.014, -0.018, 0.105, -0.14);  // rear notch
  part(g, M.metal, 0.014, 0.022, 0.014, 0.018, 0.105, -0.14);
  part(g, M.bakelite, 0.05, 0.13, 0.078, 0, -0.105, -0.13, 0.22); // the curved "banana" magazine
  part(g, M.bakelite, 0.05, 0.12, 0.076, 0, -0.205, -0.175, 0.55);
  part(g, M.wood, 0.05, 0.14, 0.062, 0, -0.115, 0.1, -0.32);    // pistol grip
  part(g, M.wood, 0.042, 0.07, 0.15, 0, -0.065, 0.23, -0.3);    // wooden stock
  hands(g, -0.35, -0.09, 0.11);
  g.userData = { muzzle: new THREE.Vector3(0, -0.005, -0.9), sightY: 0.112, hip: [0.23, -0.235, -0.6], adsZ: -0.5, kick: 0.045, kickRot: 0.05 };
  return g;
}

function buildRifle() {
  const g = new THREE.Group();
  part(g, M.body, 0.085, 0.12, 0.46, 0, 0, -0.05);            // receiver
  part(g, M.dark, 0.08, 0.095, 0.32, 0, -0.005, -0.43);       // handguard
  part(g, M.mid, 0.034, 0.034, 0.24, 0, 0.012, -0.69);        // barrel
  part(g, M.dark, 0.05, 0.05, 0.07, 0, 0.012, -0.82);         // muzzle brake
  part(g, M.lime, 0.09, 0.022, 0.26, 0, -0.02, -0.1);         // accent stripe
  part(g, M.lime, 0.084, 0.02, 0.1, 0, 0.03, -0.5);
  part(g, M.dark, 0.055, 0.2, 0.085, 0, -0.15, -0.14, 0.2);   // magazine
  part(g, M.grip, 0.055, 0.15, 0.07, 0, -0.12, 0.1, -0.3);    // pistol grip
  // holo sight
  part(g, M.dark, 0.06, 0.03, 0.12, 0, 0.075, -0.06);
  part(g, M.dark, 0.012, 0.085, 0.03, -0.045, 0.13, -0.06);
  part(g, M.dark, 0.012, 0.085, 0.03, 0.045, 0.13, -0.06);
  part(g, M.dark, 0.102, 0.012, 0.03, 0, 0.176, -0.06);
  part(g, M.dot, 0.008, 0.008, 0.004, 0, 0.135, -0.06);
  hands(g, -0.42, -0.085, 0.11);
  g.userData = { muzzle: new THREE.Vector3(0, 0.012, -0.9), sightY: 0.135, hip: [0.23, -0.235, -0.6], adsZ: -0.52, kick: 0.035, kickRot: 0.035 };
  return g;
}

function buildSMG() {
  const g = new THREE.Group();
  part(g, M.dark, 0.07, 0.12, 0.34, 0, 0, -0.08);             // body
  part(g, M.body, 0.074, 0.05, 0.3, 0, 0.04, -0.08);          // top cover
  part(g, M.dark, 0.056, 0.07, 0.14, 0, -0.01, -0.32);        // barrel shroud
  part(g, M.mid, 0.03, 0.03, 0.08, 0, -0.005, -0.42);         // muzzle
  part(g, M.lime, 0.076, 0.018, 0.16, 0, -0.03, -0.12);
  part(g, M.dark, 0.044, 0.24, 0.058, 0, -0.17, -0.16, 0.08); // long stick magazine
  part(g, M.grip, 0.05, 0.13, 0.062, 0, -0.11, 0.05, -0.28);  // grip
  part(g, M.dark, 0.05, 0.022, 0.07, 0, 0.076, -0.04);        // mini red dot
  part(g, M.dark, 0.01, 0.06, 0.02, -0.032, 0.115, -0.04);
  part(g, M.dark, 0.01, 0.06, 0.02, 0.032, 0.115, -0.04);
  part(g, M.dark, 0.074, 0.01, 0.02, 0, 0.148, -0.04);
  part(g, M.dot, 0.007, 0.007, 0.004, 0, 0.115, -0.04);
  hands(g, -0.31, -0.085, 0.06, -0.11);
  g.userData = { muzzle: new THREE.Vector3(0, -0.005, -0.48), sightY: 0.115, hip: [0.21, -0.215, -0.52], adsZ: -0.44, kick: 0.022, kickRot: 0.022 };
  return g;
}

function buildShotgun() {
  const g = new THREE.Group();
  part(g, M.metal, 0.07, 0.11, 0.32, 0, 0, -0.02);            // receiver
  part(g, M.steel, 0.042, 0.042, 0.62, 0, 0.022, -0.48);      // barrel
  part(g, M.metal, 0.036, 0.036, 0.5, 0, -0.03, -0.42);       // magazine tube
  part(g, M.grip, 0.074, 0.074, 0.2, 0, -0.03, -0.4);         // pump
  part(g, M.lime, 0.076, 0.014, 0.2, 0, -0.03, -0.4);
  part(g, M.metal, 0.014, 0.02, 0.014, 0, 0.052, -0.77);      // bead sight
  part(g, M.wood, 0.05, 0.13, 0.062, 0, -0.105, 0.1, -0.35);  // grip
  part(g, M.wood, 0.042, 0.07, 0.15, 0, -0.07, 0.23, -0.3);   // stock
  hands(g, -0.4, -0.1, 0.1, -0.11);
  g.userData = { muzzle: new THREE.Vector3(0, 0.022, -0.82), sightY: 0.064, hip: [0.23, -0.225, -0.6], adsZ: -0.5, kick: 0.09, kickRot: 0.16 };
  return g;
}

function buildSniper() {
  const g = new THREE.Group();
  part(g, M.body, 0.066, 0.09, 0.5, 0, 0, -0.08);             // chassis
  part(g, M.dark, 0.06, 0.07, 0.3, 0, -0.01, -0.44);          // fore-end
  part(g, M.steel, 0.03, 0.03, 0.62, 0, 0.012, -0.82);        // long barrel
  part(g, M.dark, 0.05, 0.05, 0.1, 0, 0.012, -1.12);          // muzzle brake
  part(g, M.lime, 0.07, 0.016, 0.3, 0, -0.02, -0.12);
  part(g, M.dark, 0.05, 0.1, 0.09, 0, -0.09, -0.1);           // box magazine
  part(g, M.grip, 0.05, 0.13, 0.062, 0, -0.105, 0.12, -0.32); // grip
  part(g, M.steel, 0.022, 0.022, 0.06, 0.05, 0.03, 0.02);     // bolt handle
  // scope
  part(g, M.dark, 0.03, 0.04, 0.03, 0, 0.065, -0.2);
  part(g, M.dark, 0.03, 0.04, 0.03, 0, 0.065, 0.0);
  part(g, M.dark, 0.05, 0.05, 0.34, 0, 0.11, -0.1);
  part(g, M.dark, 0.066, 0.066, 0.09, 0, 0.11, -0.3);
  part(g, M.dark, 0.06, 0.06, 0.07, 0, 0.11, 0.1);
  part(g, M.glass, 0.05, 0.05, 0.006, 0, 0.11, -0.347);
  hands(g, -0.44, -0.085, 0.13, -0.11);
  g.userData = { muzzle: new THREE.Vector3(0, 0.012, -1.18), sightY: 0.11, hip: [0.23, -0.23, -0.56], adsZ: -0.42, kick: 0.1, kickRot: 0.14 };
  return g;
}

function buildLauncher() {
  const g = new THREE.Group();
  part(g, M.dark, 0.075, 0.11, 0.3, 0, 0, 0.02);              // receiver
  part(g, M.steel, 0.095, 0.095, 0.4, 0, 0.02, -0.33);        // fat barrel
  part(g, M.metal, 0.105, 0.105, 0.05, 0, 0.02, -0.53);       // muzzle ring
  part(g, M.lime, 0.1, 0.1, 0.03, 0, 0.02, -0.45);
  part(g, M.mid, 0.15, 0.15, 0.13, 0, -0.03, -0.08, 0, 0, 0.785); // revolving drum
  part(g, M.dark, 0.05, 0.11, 0.06, 0, -0.1, -0.3);           // fore grip
  part(g, M.grip, 0.05, 0.13, 0.062, 0, -0.105, 0.12, -0.32); // grip
  part(g, M.dark, 0.014, 0.07, 0.014, 0, 0.1, -0.5);          // ladder sight
  part(g, M.dark, 0.04, 0.012, 0.014, 0, 0.13, -0.5);
  part(g, M.dark, 0.03, 0.03, 0.02, 0, 0.085, 0.1);
  hands(g, -0.3, -0.16, 0.13, -0.11);
  g.userData = { muzzle: new THREE.Vector3(0, 0.02, -0.6), sightY: 0.1, hip: [0.23, -0.225, -0.56], adsZ: -0.46, kick: 0.1, kickRot: 0.18 };
  return g;
}

function buildPistol() {
  const g = new THREE.Group();
  part(g, M.body, 0.05, 0.065, 0.28, 0, 0.02, -0.1);          // slide
  part(g, M.dark, 0.046, 0.04, 0.24, 0, -0.03, -0.09);        // frame
  part(g, M.lime, 0.052, 0.014, 0.1, 0, 0.02, -0.02);
  part(g, M.grip, 0.046, 0.15, 0.065, 0, -0.1, 0.02, -0.22);  // grip
  part(g, M.dark, 0.012, 0.02, 0.012, 0, 0.062, -0.22);       // front sight
  part(g, M.dark, 0.03, 0.02, 0.012, 0, 0.062, 0.03);         // rear sight
  part(g, M.glove, 0.09, 0.12, 0.1, 0, -0.1, 0.03);
  part(g, M.sleeve, 0.1, 0.1, 0.42, 0.06, -0.24, 0.2, -0.55, -0.2, 0);
  part(g, M.glove, 0.08, 0.1, 0.09, -0.04, -0.12, 0.0);
  part(g, M.glove, 0.1, 0.1, 0.44, -0.19, -0.24, 0.12, -0.5, 0.6, 0);
  g.userData = { muzzle: new THREE.Vector3(0, 0.02, -0.27), sightY: 0.075, hip: [0.2, -0.19, -0.58], adsZ: -0.5, kick: 0.06, kickRot: 0.11 };
  return g;
}

const BUILDERS = { ak47: buildAK47, rifle: buildRifle, smg: buildSMG, shotgun: buildShotgun, sniper: buildSniper, launcher: buildLauncher, pistol: buildPistol };

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xe6ecff, 0xd8a888, 1.9));
    const sun = new THREE.DirectionalLight(0xffeedd, 2.0);
    sun.position.set(-1, 2, 1.5);
    this.scene.add(sun);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.guns = {};
    for (const id in BUILDERS) {
      const g = BUILDERS[id]();
      g.visible = false;
      this.root.add(g);
      this.guns[id] = g;
    }

    this.flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), M.flash);
    this.flash.visible = false;
    this.root.add(this.flash);

    this.current = 'ak47';
    this.ads = 0;        // 0 hip .. 1 aiming
    this.kick = 0;
    this.kickRot = 0;
    this.swayX = 0; this.swayY = 0;
    this.bob = 0;
    this.lower = 1;      // 1 = lowered (drawing), eases to 0
    this.flashT = 0;
    this.visible = true;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** id: a weapon id from shared/config.js */
  setWeapon(id) {
    if (!this.guns[id] || id === this.current) return;
    this.current = id;
    this.lower = 1; // play the draw animation
  }

  fire() {
    const u = this.guns[this.current].userData;
    this.kick = Math.min(0.12, this.kick + u.kick);
    this.kickRot = Math.min(0.24, this.kickRot + u.kickRot);
    this.flashT = 0.045;
  }

  /**
   * s: local soldier, look: {dx, dy} mouse delta this frame, reloadFrac: 0..1 progress or -1
   */
  update(dt, s, adsHeld, look, reloadFrac) {
    this.root.visible = this.visible && s.alive;
    if (!this.root.visible) return;
    for (const id in this.guns) this.guns[id].visible = id === this.current;
    const gun = this.guns[this.current];
    const u = gun.userData;

    const k = (rate) => 1 - Math.exp(-rate * dt);
    const aiming = adsHeld && reloadFrac < 0 ? 1 : 0;
    this.ads += (aiming - this.ads) * k(16);
    this.lower += (0 - this.lower) * k(11);
    this.kick += (0 - this.kick) * k(15);
    this.kickRot += (0 - this.kickRot) * k(13);

    // sway lags behind the camera turn
    this.swayX += (THREE.MathUtils.clamp(-look.dx * 0.0009, -0.05, 0.05) - this.swayX) * k(9);
    this.swayY += (THREE.MathUtils.clamp(look.dy * 0.0009, -0.05, 0.05) - this.swayY) * k(9);

    const b = s.body;
    const speed = Math.hypot(b.vx, b.vz);
    const moving = b.grounded ? Math.min(1, speed / 6) : 0;
    this.bob += dt * (5 + speed * 1.25);
    const bobAmt = moving * (1 - this.ads * 0.85);
    const bx = Math.sin(this.bob) * 0.012 * bobAmt;
    const by = -Math.abs(Math.cos(this.bob)) * 0.014 * bobAmt;

    // reload: dip down and tilt, come back up at the end
    let dip = 0;
    if (reloadFrac >= 0) dip = Math.sin(Math.min(1, reloadFrac) * Math.PI) ** 0.5;
    const air = b.grounded ? 0 : THREE.MathUtils.clamp(-b.vy * 0.004, -0.03, 0.03);

    const hip = u.hip;
    const a = this.ads;
    gun.position.set(
      hip[0] + (0 - hip[0]) * a + bx + this.swayX,
      hip[1] + (-u.sightY - hip[1]) * a + by + this.swayY + air - this.lower * 0.3 - dip * 0.16,
      hip[2] + (u.adsZ - hip[2]) * a + this.kick,
    );
    gun.rotation.set(
      this.kickRot - this.lower * 0.9 - dip * 0.55 + this.swayY * 1.2,
      (1 - a) * 0.07 + this.swayX * 2.2,
      dip * 0.5 + this.swayX * 1.5,
    );

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.visible = true;
      this.flash.position.copy(u.muzzle).applyEuler(gun.rotation).add(gun.position);
      const sc = 0.7 + Math.random() * 0.9;
      this.flash.scale.set(sc, sc, sc * 1.8);
      this.flash.rotation.z = Math.random() * 6;
    } else this.flash.visible = false;
  }
}
