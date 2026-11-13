// Blocky third-person soldier built from boxes. Faces -Z; set group.rotation.y = yaw.

import * as THREE from 'three';
import { TEAM_INFO } from '@shared/config.js';

const SUIT = new THREE.MeshLambertMaterial({ color: 0x343848 });
const DARK = new THREE.MeshLambertMaterial({ color: 0x1b1d28 });
const GUN = new THREE.MeshLambertMaterial({ color: 0x2a2c38 });
const FLASH = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
const teamMats = TEAM_INFO.map((t) => new THREE.MeshLambertMaterial({ color: t.color }));
const box = new THREE.BoxGeometry(1, 1, 1);

function part(parent, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export class SoldierModel {
  constructor(team) {
    const T = teamMats[team];
    this.group = new THREE.Group();

    // legs pivot at the hip
    this.legL = new THREE.Group(); this.legL.position.set(-0.13, 0.86, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.13, 0.86, 0);
    for (const leg of [this.legL, this.legR]) {
      part(leg, SUIT, 0.2, 0.5, 0.22, 0, -0.25, 0);
      part(leg, T, 0.22, 0.14, 0.25, 0, -0.5, -0.01);
      part(leg, DARK, 0.2, 0.3, 0.24, 0, -0.71, 0);
      this.group.add(leg);
    }

    // torso
    part(this.group, SUIT, 0.5, 0.56, 0.28, 0, 1.14, 0);
    part(this.group, T, 0.52, 0.3, 0.3, 0, 1.25, 0);
    part(this.group, DARK, 0.3, 0.34, 0.12, 0, 1.16, 0.2); // backpack

    // head, helmet, visor
    this.head = new THREE.Group(); this.head.position.set(0, 1.44, 0);
    part(this.head, SUIT, 0.26, 0.26, 0.26, 0, 0.14, 0);
    part(this.head, T, 0.32, 0.16, 0.32, 0, 0.27, 0);
    part(this.head, DARK, 0.27, 0.09, 0.05, 0, 0.15, -0.13);
    this.group.add(this.head);

    // arms + rifle pitch together around the shoulders
    this.aim = new THREE.Group(); this.aim.position.set(0, 1.32, 0);
    const armR = part(this.aim, SUIT, 0.13, 0.13, 0.46, 0.27, -0.08, -0.2);
    armR.rotation.y = 0.25;
    const armL = part(this.aim, SUIT, 0.13, 0.13, 0.52, -0.2, -0.1, -0.28);
    armL.rotation.y = -0.55;
    part(this.aim, T, 0.15, 0.15, 0.16, 0.3, -0.05, -0.02);
    part(this.aim, T, 0.15, 0.15, 0.16, -0.3, -0.05, -0.02);
    part(this.aim, GUN, 0.07, 0.11, 0.62, 0.12, -0.1, -0.55);
    part(this.aim, GUN, 0.05, 0.18, 0.08, 0.12, -0.22, -0.48);
    part(this.aim, GUN, 0.06, 0.09, 0.2, 0.12, -0.1, -0.16);
    this.flash = part(this.aim, FLASH, 0.22, 0.22, 0.3, 0.12, -0.1, -0.98);
    this.flash.castShadow = false;
    this.flash.visible = false;
    this.group.add(this.aim);

    this.phase = Math.random() * 6;
    this.flashT = 0;
  }

  muzzleFlash() { this.flashT = 0.05; }

  update(s, dt) {
    const g = this.group;
    g.visible = s.alive;
    if (!s.alive) return;
    const b = s.body;
    g.position.set(b.x, b.y, b.z);
    g.rotation.y = s.yaw;
    this.aim.rotation.x = s.pitch;
    this.head.rotation.x = s.pitch * 0.6;

    const speed = Math.hypot(b.vx, b.vz);
    const moving = b.grounded ? Math.min(1, speed / 6) : 0.5;
    this.phase += dt * (4 + speed * 1.6);
    const swing = Math.sin(this.phase) * 0.75 * moving;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    g.position.y += Math.abs(Math.cos(this.phase)) * 0.05 * moving;

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.visible = true;
      this.flash.rotation.z = Math.random() * 3;
    } else this.flash.visible = false;
  }
}
