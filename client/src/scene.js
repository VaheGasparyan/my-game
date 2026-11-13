// Turns the pure map data into three.js meshes: sky, lighting, blocks, ramps, rails, decals, props.

import * as THREE from 'three';
import { rampHeight } from '@shared/world.js';
import { COLORS } from '@shared/maps/skyport.js';

const matCache = new Map();
function mat(color) {
  let m = matCache.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); matCache.set(color, m); }
  return m;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);

function boxMesh(min, max, material) {
  const m = new THREE.Mesh(unitBox, material);
  m.scale.set(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function floorTexture() {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,60,110,0.28)'; g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,60,110,0.10)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function containerTexture() {
  const t = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,30,0.16)'; g.fillRect(0, 0, w * 0.42, h);
    g.fillStyle = 'rgba(0,0,30,0.10)'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function decalMesh(d) {
  const tex = canvasTexture(512, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = d.color;
    g.font = 'italic 900 250px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(d.text, w / 2, h * 0.4);
    // three slanted bars underneath
    for (let i = 0; i < 3; i++) {
      const x = w / 2 - 40 + i * 44;
      g.beginPath();
      g.moveTo(x, h - 20); g.lineTo(x + 26, h - 20); g.lineTo(x + 56, h - 76); g.lineTo(x + 30, h - 76);
      g.fill();
    }
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(d.size * (512 / 384), d.size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  m.position.set(d.x, d.y, d.z);
  m.rotation.y = d.ry;
  return m;
}

function wedgeMesh(r) {
  const [x0, y0, z0] = r.min, [x1, , z1] = r.max;
  const c = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]]; // counter-clockwise seen from above
  const top = c.map(([x, z]) => new THREE.Vector3(x, rampHeight(r, x, z), z));
  const bot = c.map(([x, z]) => new THREE.Vector3(x, y0, z));
  const v = [];
  const tri = (a, b, d) => v.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
  const quad = (a, b, d, e) => { tri(a, b, d); tri(a, d, e); };
  quad(top[0], top[1], top[2], top[3]);
  quad(bot[3], bot[2], bot[1], bot[0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(bot[i], bot[j], top[j], top[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: r.color, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function stairMeshes(r, group) {
  const rise = r.max[1] - r.min[1];
  const n = Math.max(2, Math.round(rise / 0.37));
  const alongX = r.dir[0] !== 0;
  const a0 = alongX ? r.min[0] : r.min[2], a1 = alongX ? r.max[0] : r.max[2];
  const neg = r.dir[0] < 0 || r.dir[1] < 0;
  for (let k = 0; k < n; k++) {
    const f = (k + 0.5) / n; // slab k starts half a tread in, so feet neither sink nor hover much
    let s0, s1;
    if (!neg) { s0 = a0 + (a1 - a0) * f; s1 = a1; } else { s0 = a0; s1 = a1 - (a1 - a0) * f; }
    const min = [r.min[0], r.min[1] + (rise * k) / n, r.min[2]];
    const max = [r.max[0], r.min[1] + (rise * (k + 1)) / n, r.max[2]];
    if (alongX) { min[0] = s0; max[0] = s1; } else { min[2] = s0; max[2] = s1; }
    group.add(boxMesh(min, max, mat(k % 2 ? COLORS.concrete : COLORS.white)));
  }
  // lime stringers down both sides
  const side = wedgeMesh({ ...r, color: COLORS.lime });
  if (alongX) { side.scale.z = 1.04; side.position.z = -((r.min[2] + r.max[2]) / 2) * 0.04; }
  else { side.scale.x = 1.04; side.position.x = -((r.min[0] + r.max[0]) / 2) * 0.04; }
  side.position.y = -0.2;
  group.add(side);
}

function railMeshes(b, group) {
  const m = mat(b.color);
  const lenX = b.max[0] - b.min[0], lenZ = b.max[2] - b.min[2];
  const alongX = lenX > lenZ;
  const top = b.max[1];
  for (const y of [top - 0.08, top - 0.5]) {
    group.add(boxMesh([b.min[0], y, b.min[2]], [b.max[0], y + 0.08, b.max[2]], m));
  }
  const len = alongX ? lenX : lenZ;
  const posts = Math.max(2, Math.round(len / 2) + 1);
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    const min = [...b.min], max = [...b.max];
    if (alongX) { min[0] = b.min[0] + (lenX - 0.12) * t; max[0] = min[0] + 0.12; }
    else { min[2] = b.min[2] + (lenZ - 0.12) * t; max[2] = min[2] + 0.12; }
    group.add(boxMesh(min, max, m));
  }
}

function propMesh(p) {
  const g = new THREE.Group();
  const white = mat(COLORS.white), dark = mat(COLORS.dark);
  if (p.type === 'dish') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 1.6, 8), dark);
    base.position.y = 0.8;
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3.2),
      new THREE.MeshLambertMaterial({ color: COLORS.white, side: THREE.DoubleSide, flatShading: true }),
    );
    dish.position.set(0, 4.4, 0);
    dish.rotation.set(Math.PI + 0.7, 0.6, 0);
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 6), dark);
    horn.position.set(0.35, 2.9, 0.55);
    horn.rotation.set(0.7, 0.6, 0, 'YXZ');
    g.add(base, dish, horn);
  } else {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6, 0.18), dark);
    mast.position.y = 3;
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), dark);
    bar1.position.y = 4.6;
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.1), dark);
    bar2.position.y = 5.3;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    tip.position.y = 6.1;
    const unit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), white);
    unit.position.set(1.6, 0.45, 0.6);
    g.add(mast, bar1, bar2, tip, unit);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(p.x, p.y, p.z);
  return g;
}

function buildSky(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(480, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x4f74ec) },
        mid: { value: new THREE.Color(0x9cb4ff) },
        horizon: { value: new THREE.Color(0xffc8a2) },
        below: { value: new THREE.Color(0xc39ad6) },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vDir; uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 below;
        void main(){
          float h = normalize(vDir).y;
          vec3 c = h > 0.0
            ? mix(mix(horizon, mid, smoothstep(0.0, 0.22, h)), top, smoothstep(0.18, 0.75, h))
            : mix(horizon, below, smoothstep(0.0, -0.45, h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // low-poly sunset clouds
  const puff = new THREE.IcosahedronGeometry(1, 0);
  const cloudMats = [0xffb98a, 0xffa68f, 0xffd3b0].map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.42, flatShading: true, fog: false }));
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const m = cloudMats[i % 3];
    const n = 4 + ((rnd() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(puff, m);
      const s = 7 + rnd() * 9;
      p.scale.set(s * 1.7, s * 0.55, s);
      p.position.set((k - n / 2) * 11 + rnd() * 5, rnd() * 4, rnd() * 8 - 4);
      p.rotation.y = rnd() * 3;
      cloud.add(p);
    }
    const a = rnd() * Math.PI * 2, r = 130 + rnd() * 190;
    cloud.position.set(Math.cos(a) * r, -45 + rnd() * 120, Math.sin(a) * r);
    cloud.rotation.y = -a + Math.PI / 2;
    scene.add(cloud);
  }
}

export function buildScene(map) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe8c8c8, 90, 420);

  const hemi = new THREE.HemisphereLight(0xdfe6ff, 0xe6b89a, 1.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe7cf, 2.3);
  sun.position.set(-34, 52, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -48; sc.right = 48; sc.top = 40; sc.bottom = -40; sc.near = 5; sc.far = 140;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  buildSky(scene);

  const world = new THREE.Group();
  const floorTex = floorTexture();
  const contTex = containerTexture();

  for (const b of map.boxes) {
    if (b.rail) { railMeshes(b, world); continue; }
    const w = b.max[0] - b.min[0], d = b.max[2] - b.min[2];
    let material = mat(b.color);
    if (b.kind === 'floor') {
      const t = floorTex.clone();
      t.repeat.set(w / 5, d / 5);
      t.needsUpdate = true;
      material = new THREE.MeshLambertMaterial({ color: b.color, map: t });
    } else if (b.kind === 'container') {
      const t = contTex.clone();
      t.repeat.set(Math.max(w, d) * 1.6, 1);
      t.needsUpdate = true;
      material = new THREE.MeshLambertMaterial({ color: b.color, map: t });
    }
    const mesh = boxMesh(b.min, b.max, material);
    if (b.kind === 'floor') mesh.castShadow = false;
    world.add(mesh);

    // little bits of trim that sell the look
    if (b.kind === 'tower' || b.kind === 'platform' || b.kind === 'deck') {
      world.add(boxMesh([b.min[0] - 0.05, b.max[1] - 0.14, b.min[2] - 0.05], [b.max[0] + 0.05, b.max[1] - 0.04, b.max[2] + 0.05], mat(COLORS.lime)));
    }
    if (b.kind === 'building' || b.kind === 'wall') {
      world.add(boxMesh([b.min[0] - 0.06, b.max[1] - 0.35, b.min[2] - 0.06], [b.max[0] + 0.06, b.max[1] + 0.05, b.max[2] + 0.06], mat(b.kind === 'wall' ? COLORS.concreteDark : COLORS.white)));
    }
  }
  for (const r of map.ramps) {
    if (r.stairs) stairMeshes(r, world); else world.add(wedgeMesh(r));
  }
  for (const s of map.strips) {
    const m = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: s.color }));
    m.scale.set(s.w, 0.02, s.d);
    m.position.set(s.x, 0.011, s.z);
    m.receiveShadow = true;
    world.add(m);
  }
  for (const d of map.decals) world.add(decalMesh(d));
  for (const p of map.props) world.add(propMesh(p));

  // underside of the floating platform, so it reads as a sky port when seen from the menu
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(30, 12, 14, 8), mat(COLORS.concreteDark));
  hull.scale.set(1.25, 1, 0.9);
  hull.position.y = -9;
  world.add(hull);

  scene.add(world);
  return { scene, sun };
}
