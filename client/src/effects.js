// Pooled visual effects: bullet tracers, cube particles, explosions.

import * as THREE from 'three';

const MAX_PARTICLES = 500;
const MAX_TRACERS = 48;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _e = new THREE.Euler();
const Z = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();

export class Effects {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.pmesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      MAX_PARTICLES,
    );
    this.pmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pmesh.frustumCulled = false;
    this.pmesh.count = 0;
    this.pmesh.setColorAt(0, _c.set(0xffffff));
    scene.add(this.pmesh);
    this.particles = [];

    const tgeo = new THREE.BoxGeometry(0.035, 0.035, 1);
    tgeo.translate(0, 0, 0.5);
    const tmat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.85 });
    this.tracers = [];
    for (let i = 0; i < MAX_TRACERS; i++) {
      const m = new THREE.Mesh(tgeo, tmat);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.tracers.push({ mesh: m, t: 0 });
    }
    this.tracerIdx = 0;

    this.blasts = [];
    this.blastGeo = new THREE.IcosahedronGeometry(1, 1);
  }

  tracer(ax, ay, az, bx, by, bz) {
    const tr = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % MAX_TRACERS;
    _d.set(bx - ax, by - ay, bz - az);
    const len = _d.length();
    if (len < 0.5) return;
    tr.mesh.position.set(ax, ay, az);
    tr.mesh.quaternion.setFromUnitVectors(Z, _d.divideScalar(len));
    tr.mesh.scale.set(1, 1, len);
    tr.mesh.visible = true;
    tr.t = 0.06;
  }

  burst(x, y, z, color, count, speed, size = 0.09, nx = 0, ny = 0, nz = 0) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      this.particles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * speed + nx * speed * 0.6,
        vy: Math.random() * speed * 0.8 + ny * speed * 0.6,
        vz: (Math.random() - 0.5) * speed + nz * speed * 0.6,
        life: 0.35 + Math.random() * 0.5,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        rx: Math.random() * 6, ry: Math.random() * 6,
      });
    }
  }

  explosion(x, y, z, radius) {
    const mesh = new THREE.Mesh(
      this.blastGeo,
      new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.blasts.push({ mesh, t: 0, radius });
    this.burst(x, y, z, 0xffc24a, 26, 14, 0.16);
    this.burst(x, y, z, 0x55586a, 16, 9, 0.2);
    this.burst(x, y, z, 0xb6f02a, 8, 12, 0.1);
  }

  update(dt) {
    for (const tr of this.tracers) {
      if (tr.t > 0) { tr.t -= dt; if (tr.t <= 0) tr.mesh.visible = false; }
    }

    const ps = this.particles;
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= 20 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.vy < 0) {
        const g = this.world.groundAt(p.x, p.z, p.y + 0.3, 0.02, 0);
        if (p.y < g + p.size / 2) { p.y = g + p.size / 2; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      }
      p.rx += dt * 7; p.ry += dt * 5;
      const sc = p.size * Math.min(1, p.life * 4);
      _m.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e.set(p.rx, p.ry, 0)), _s.set(sc, sc, sc));
      this.pmesh.setMatrixAt(n, _m);
      this.pmesh.setColorAt(n, _c.set(p.color));
      ps[n++] = p;
    }
    ps.length = n;
    this.pmesh.count = n;
    this.pmesh.instanceMatrix.needsUpdate = true;
    if (this.pmesh.instanceColor) this.pmesh.instanceColor.needsUpdate = true;

    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t += dt;
      const f = b.t / 0.35;
      if (f >= 1) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.blasts.splice(i, 1);
        continue;
      }
      const r = b.radius * (0.25 + 0.75 * (1 - (1 - f) ** 3));
      b.mesh.scale.setScalar(r);
      b.mesh.material.opacity = 0.9 * (1 - f);
    }
  }

  clear() {
    this.particles.length = 0;
    this.pmesh.count = 0;
    for (const tr of this.tracers) { tr.t = 0; tr.mesh.visible = false; }
    for (const b of this.blasts) { this.scene.remove(b.mesh); b.mesh.material.dispose(); }
    this.blasts.length = 0;
  }
}
