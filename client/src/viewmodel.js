// First-person weapon, rendered in its own scene on top of the world so it never clips into walls.

import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1);
const M = {
  body: new THREE.MeshLambertMaterial({ color: 0xd4d6e2 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x2f3142 }),
  mid: new THREE.MeshLambertMaterial({ color: 0x6a6d82 }),
  lime: new THREE.MeshLambertMaterial({ color: 0xb6f02a }),
  grip: new THREE.MeshLambertMaterial({ color: 0xe0933c }),
  glove: new THREE.MeshLambertMaterial({ color: 0x2a62f0 }),
  sleeve: new THREE.MeshLambertMaterial({ color: 0x343848 }),
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
  // hands
  part(g, M.glove, 0.1, 0.08, 0.13, -0.01, -0.085, -0.42);
  part(g, M.glove, 0.09, 0.09, 0.3, -0.1, -0.17, -0.31, 0.75, 0.55, 0);
  part(g, M.glove, 0.085, 0.1, 0.1, 0.005, -0.12, 0.11);
  part(g, M.sleeve, 0.09, 0.09, 0.28, 0.05, -0.22, 0.22, -0.6, -0.25, 0);
  g.userData = { muzzle: new THREE.Vector3(0, 0.012, -0.9), sightY: 0.135 };
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
  part(g, M.sleeve, 0.1, 0.1, 0.44, -0.19, -0.24, 0.12, -0.5, 0.6, 0);
  g.userData = { muzzle: new THREE.Vector3(0, 0.02, -0.27), sightY: 0.075 };
  return g;
}

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
    this.guns = [buildRifle(), buildPistol()];
    for (const g of this.guns) { g.visible = false; this.root.add(g); }

    this.flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), M.flash);
    this.flash.visible = false;
    this.root.add(this.flash);

    this.current = 0;
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

  setWeapon(i) {
    if (i === this.current && this.guns[i].visible) return;
    this.current = i;
    this.lower = 1;
  }

  fire() {
    this.kick = Math.min(0.09, this.kick + (this.current === 0 ? 0.035 : 0.06));
    this.kickRot = Math.min(0.2, this.kickRot + (this.current === 0 ? 0.035 : 0.11));
    this.flashT = 0.045;
  }

  /**
   * s: local soldier, look: {dx, dy} mouse delta this frame, reloadFrac: 0..1 progress or -1
   */
  update(dt, s, adsHeld, look, reloadFrac) {
    this.root.visible = this.visible && s.alive;
    if (!this.root.visible) return;
    this.guns.forEach((g, i) => { g.visible = i === this.current; });
    const gun = this.guns[this.current];

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

    const hip = this.current === 0 ? [0.23, -0.235, -0.6] : [0.2, -0.19, -0.58];
    const adsPos = [0, -gun.userData.sightY, this.current === 0 ? -0.52 : -0.5];
    const a = this.ads;
    gun.position.set(
      hip[0] + (adsPos[0] - hip[0]) * a + bx + this.swayX,
      hip[1] + (adsPos[1] - hip[1]) * a + by + this.swayY + air - this.lower * 0.3 - dip * 0.16,
      hip[2] + (adsPos[2] - hip[2]) * a + this.kick,
    );
    gun.rotation.set(
      this.kickRot - this.lower * 0.9 - dip * 0.55 + this.swayY * 1.2,
      (1 - a) * 0.07 + this.swayX * 2.2,
      dip * 0.5 + this.swayX * 1.5,
    );

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.visible = true;
      this.flash.position.copy(gun.userData.muzzle).applyEuler(gun.rotation).add(gun.position);
      const sc = 0.7 + Math.random() * 0.9;
      this.flash.scale.set(sc, sc, sc * 1.8);
      this.flash.rotation.z = Math.random() * 6;
    } else this.flash.visible = false;
  }
}
