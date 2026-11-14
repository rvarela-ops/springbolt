import * as THREE from './vendor/three.module.min.js';

/* ------------------------------------------------------------------
   EDIT HERE: show title, artworks, rooms.
   Sizes are in meters. "side" is the wall the piece hangs on (n/e/s/w),
   "at" is the position along that wall.
------------------------------------------------------------------- */
const SHOW = { title: 'ODD OBJECTS', line: 'Five surreal works. Three rooms.' };

const ROOMS = {
  A: { name: 'Room 1', x0: -5, x1: 5, z0: -5, z1: 5, wall: 0xece9e1, doors: { e: 0 } },
  B: { name: 'Room 2', x0: 5.3, x1: 15.3, z0: -5, z1: 5, wall: 0xb5553a, doors: { w: 0, s: 10.3 } },
  C: { name: 'Room 3', x0: 5.3, x1: 15.3, z0: 5.3, z1: 15.3, wall: 0x1b1d20, doors: { n: 10.3 } },
};

const ART = [
  { id: 'art1', img: 'art/1.webp', title: 'Watchers', sub: 'Digital illustration', room: 'A', side: 'n', at: 0, w: 3.9, h: 2.6 },
  { id: 'art2', img: 'art/2.webp', title: 'Speech', sub: 'Digital illustration', room: 'B', side: 'n', at: 10.3, w: 2.5, h: 2.5 },
  { id: 'art3', img: 'art/3.webp', title: 'Vote', sub: 'Digital illustration', room: 'B', side: 'e', at: 0, w: 1.8, h: 2.7 },
  { id: 'art4', img: 'art/4.webp', title: 'Mechanism', sub: 'Digital illustration', room: 'C', side: 's', at: 8.3, w: 1.8, h: 2.7 },
  { id: 'art5', img: 'art/5.webp', title: 'Rook', sub: 'Digital illustration', room: 'C', side: 's', at: 12.3, w: 1.8, h: 2.7 },
];

// Standing spots. "look" is what you face on arrival, "art" ties a spot to a piece.
const SPOTS = {
  a0: { room: 'A', p: [0, 3.4], look: [0, -5], to: ['a1', 'a2'] },
  a1: { room: 'A', p: [0, -1.4], art: 'art1', to: ['a0', 'a2'] },
  a2: { room: 'A', p: [3.3, 0], look: [15.3, 0], to: ['a0', 'a1', 'b0'] },
  b0: { room: 'B', p: [7.2, 0], look: [15.3, 0], to: ['a2', 'b1', 'b2', 'b3'] },
  b1: { room: 'B', p: [10.3, -1.6], art: 'art2', to: ['b0', 'b2', 'b3'] },
  b2: { room: 'B', p: [11.9, 0], art: 'art3', to: ['b0', 'b1', 'b3'] },
  b3: { room: 'B', p: [10.3, 3.1], look: [10.3, 15.3], to: ['b0', 'b1', 'b2', 'c0'] },
  c0: { room: 'C', p: [10.3, 7.3], look: [10.3, 15.3], to: ['b3', 'c1', 'c2'] },
  c1: { room: 'C', p: [8.3, 11.7], art: 'art4', to: ['c0', 'c2'] },
  c2: { room: 'C', p: [12.3, 11.7], art: 'art5', to: ['c0', 'c1'] },
};
const ROOM_ENTRY = { A: 'a0', B: 'b0', C: 'c0' };

const H = 4.2;          // wall height
const DOOR_W = 2.4, DOOR_H = 3.1;
const EYE = 1.62;
const WALL_GAP = 0.3;

/* ------------------------------------------------------------------ */
const canvas = document.getElementById('scene');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('fail').style.display = 'grid';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 80);
camera.rotation.order = 'YXZ';

const world = new THREE.Group();   // everything that gets a floor reflection
scene.add(world);

/* ---------- helpers ---------- */
const SIDES = {
  n: { n: [0, 1], axis: 'x' }, s: { n: [0, -1], axis: 'x' },
  w: { n: [1, 0], axis: 'z' }, e: { n: [-1, 0], axis: 'z' },
};
function wallPoint(room, side, along) {
  const r = ROOMS[room];
  if (side === 'n') return [along, r.z0];
  if (side === 's') return [along, r.z1];
  if (side === 'w') return [r.x0, along];
  return [r.x1, along];
}
function rotFor(side) { const [nx, nz] = SIDES[side].n; return Math.atan2(nx, nz); }

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

// soft vertical shading so walls don't look flat: darker near ceiling and at the floor line
const wallShade = canvasTex(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#8f8f8f'); gr.addColorStop(0.14, '#e6e6e6'); gr.addColorStop(0.5, '#ffffff');
  gr.addColorStop(0.93, '#f0f0f0'); gr.addColorStop(1, '#a8a8a8');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

function plane(w, h, mat, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  world.add(m); return m;
}

/* ---------- walls ---------- */
const revealMat = new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.95 });

function buildRoom(key) {
  const r = ROOMS[key];
  const mat = new THREE.MeshStandardMaterial({ color: r.wall, roughness: 0.94, map: wallShade });
  const lintelMat = new THREE.MeshStandardMaterial({ color: r.wall, roughness: 0.94 });
  for (const side of ['n', 's', 'w', 'e']) {
    const horiz = SIDES[side].axis === 'x';
    const a0 = horiz ? r.x0 : r.z0, a1 = horiz ? r.x1 : r.z1;
    const ry = rotFor(side);
    const seg = (from, to, y0, y1, m) => {
      const [x, z] = wallPoint(key, side, (from + to) / 2);
      plane(to - from, y1 - y0, m, x, (y0 + y1) / 2, z, ry);
    };
    const door = r.doors[side];
    if (door === undefined) { seg(a0, a1, 0, H, mat); continue; }
    seg(a0, door - DOOR_W / 2, 0, H, mat);
    seg(door + DOOR_W / 2, a1, 0, H, mat);
    seg(door - DOOR_W / 2, door + DOOR_W / 2, DOOR_H, H, lintelMat);
  }
}
Object.keys(ROOMS).forEach(buildRoom);

// door reveals (the thickness of the wall you walk through)
function reveal(cx, cz, alongX) {
  // alongX: door opening spans the x axis (wall runs along x), you walk along z
  const half = DOOR_W / 2, t = WALL_GAP;
  if (alongX) {
    plane(t, DOOR_H, revealMat, cx - half, DOOR_H / 2, cz, Math.PI / 2);
    plane(t, DOOR_H, revealMat, cx + half, DOOR_H / 2, cz, -Math.PI / 2);
    const top = plane(DOOR_W, t, revealMat, cx, DOOR_H, cz, 0); top.rotation.x = Math.PI / 2;
  } else {
    plane(t, DOOR_H, revealMat, cx, DOOR_H / 2, cz - half, 0);
    plane(t, DOOR_H, revealMat, cx, DOOR_H / 2, cz + half, Math.PI);
    const top = plane(t, DOOR_W, revealMat, cx, DOOR_H, cz, 0); top.rotation.x = Math.PI / 2;
  }
}
reveal(5.15, 0, false);     // A <-> B
reveal(10.3, 5.15, true);   // B <-> C

/* ---------- artworks ---------- */
const loader = new THREE.TextureLoader();
const artMeshes = [];
const pending = [];
const frameMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.5 });
const shadowTex = canvasTex(256, 256, (g, w, h) => {
  const pad = 46; g.filter = 'blur(18px)'; g.fillStyle = 'rgba(0,0,0,0.85)';
  g.fillRect(pad, pad, w - pad * 2, h - pad * 2);
});
shadowTex.colorSpace = THREE.NoColorSpace;

for (const a of ART) {
  const [wx, wz] = wallPoint(a.room, a.side, a.at);
  const [nx, nz] = SIDES[a.side].n;
  const ry = rotFor(a.side);
  const cy = 1.78;
  a.center = new THREE.Vector3(wx, cy, wz);
  a.normal = new THREE.Vector3(nx, 0, nz);

  // soft contact shadow, dropped slightly down and to the side
  const sh = plane(a.w * 1.5, a.h * 1.5, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
    wx + nx * 0.006, cy - 0.07, wz + nz * 0.006, ry);
  sh.renderOrder = 1;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(a.w + 0.07, a.h + 0.07, 0.06), frameMat);
  frame.position.set(wx + nx * 0.03, cy, wz + nz * 0.03); frame.rotation.y = ry; world.add(frame);

  const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, color: 0xffffff });
  pending.push(new Promise((res) => loader.load(a.img, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    mat.map = t; mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = t; mat.emissiveIntensity = 0.22; mat.needsUpdate = true; res();
  }, undefined, () => res())));
  const art = plane(a.w, a.h, mat, wx + nx * 0.062, cy, wz + nz * 0.062, ry);
  art.userData.art = a; artMeshes.push(art);

  // wall label
  const label = canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111'; g.font = '700 58px Syne, sans-serif'; g.fillText(a.title, 40, 110);
    g.fillStyle = '#555'; g.font = '500 34px Syne, sans-serif'; g.fillText(a.sub, 40, 170);
    g.fillText('2026', 40, 220);
  });
  // "right of the piece" as the viewer sees it
  const rx = -nz, rz = nx;
  const off = -(a.w / 2 + 0.42);
  plane(0.3, 0.176, new THREE.MeshStandardMaterial({ map: label, roughness: 0.9 }),
    wx + rx * off + nx * 0.012, 1.32, wz + rz * off + nz * 0.012, ry);
}

/* ---------- title wall (Room 1, west wall) ---------- */
function titleWall() {
  const tex = canvasTex(2048, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#101010';
    const words = SHOW.title.split(' ');
    let size = 300; g.font = `800 ${size}px Syne, sans-serif`;
    const widest = Math.max(...words.map((wd) => g.measureText(wd).width));
    size = Math.min(size, Math.floor(size * (w - 80) / widest)); g.font = `800 ${size}px Syne, sans-serif`;
    const lh = size * 0.9;
    words.forEach((wd, i) => g.fillText(wd, 30, size + i * lh));
    g.font = '500 62px Syne, sans-serif'; g.fillStyle = '#3a3a3a';
    g.fillText(SHOW.line, 40, size + (words.length - 1) * lh + 130);
  });
  const m = plane(5.2, 2.6, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, depthWrite: false }),
    ROOMS.A.x0 + 0.01, 2.05, 0.4, Math.PI / 2);
  m.renderOrder = 1;
}

/* ---------- benches ---------- */
function bench(x, z, ry) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.09, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.6 }));
  top.position.y = 0.44; g.add(top);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.4 });
  for (const sx of [-0.8, 0.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.44), legMat);
    leg.position.set(sx, 0.2, 0); g.add(leg);
  }
  g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
}
bench(-3.2, -2.6, Math.PI / 2);
bench(13.2, 3.9, 0);
bench(6.3, 12.4, Math.PI / 2);

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xfff6ea, 0x3a3836, 0.75));
for (const k of Object.keys(ROOMS)) {
  const r = ROOMS[k];
  const p = new THREE.PointLight(0xfff1dd, k === 'C' ? 36 : 62, 22, 1.7);
  p.position.set((r.x0 + r.x1) / 2, 3.7, (r.z0 + r.z1) / 2); scene.add(p);
}
const canMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 });
const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff3dc });
function artSpot(a, mirrored) {
  const s = new THREE.SpotLight(0xfff0dc, 58, 14, 0.5, 0.75, 1.6);
  const out = 2.5, y = 4.0;
  s.position.set(a.center.x + a.normal.x * out, mirrored ? -y : y, a.center.z + a.normal.z * out);
  s.target.position.set(a.center.x, mirrored ? -a.center.y + 0.1 : a.center.y - 0.1, a.center.z);
  scene.add(s, s.target);
  if (mirrored) return;
  // visible track head
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.2, 16), canMat);
  can.position.copy(s.position).setY(H - 0.2);
  can.lookAt(s.target.position); can.rotateX(Math.PI / 2);
  scene.add(can);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), glowMat);
  lens.position.copy(can.position); lens.lookAt(s.target.position);
  lens.translateZ(0.102); scene.add(lens);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), canMat);
  stem.position.copy(can.position).setY(H - 0.06); scene.add(stem);
}
ART.forEach((a) => { artSpot(a, false); artSpot(a, true); });

/* ---------- ceiling + tracks ---------- */
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x070707 }));
ceiling.rotation.x = Math.PI / 2; ceiling.position.set(5, H, 5); scene.add(ceiling);
function track(x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const t = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.045), canMat);
  t.position.set((x0 + x1) / 2, H - 0.015, (z0 + z1) / 2); t.rotation.y = -Math.atan2(z1 - z0, x1 - x0); scene.add(t);
}
track(-4, -2.5, 4, -2.5); track(6.3, -2.5, 14.3, -2.5); track(12.8, -4, 12.8, 4); track(6.3, 12.8, 14.3, 12.8);

/* ---------- floor: polished concrete with a mirrored copy of the rooms beneath ---------- */
const floorTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#7d7b78'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = 105 + Math.random() * 50 | 0;
    g.fillStyle = `rgba(${v},${v},${v - 3},${0.05 + Math.random() * 0.07})`;
    const s = 6 + Math.random() * 46;
    g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, s, s * (0.4 + Math.random() * 0.6), Math.random() * 3, 0, 7); g.fill();
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(7, 7);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ map: floorTex, color: 0x77746f, roughness: 0.42, transparent: true, opacity: 0.86 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(5, 0, 5); floor.renderOrder = 2; scene.add(floor);

/* ---------- navigation markers ---------- */
const nav = new THREE.Group(); scene.add(nav);
const chevShape = new THREE.Shape();
chevShape.moveTo(0, 0.2); chevShape.lineTo(0.2, -0.02); chevShape.lineTo(0.2, -0.13);
chevShape.lineTo(0, 0.09); chevShape.lineTo(-0.2, -0.13); chevShape.lineTo(-0.2, -0.02); chevShape.closePath();
const chevGeo = new THREE.ShapeGeometry(chevShape);
const discGeo = new THREE.CircleGeometry(0.5, 48);
const ringGeo = new THREE.RingGeometry(0.2, 0.26, 40);
let hot = null;

function makeArrow(target, dir, pos) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x0b0b0c, transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false }));
  const chev = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color: 0xf1eee6, toneMapped: false, depthWrite: false, transparent: true }));
  disc.rotation.x = chev.rotation.x = -Math.PI / 2;
  chev.position.y = 0.004; chev.scale.setScalar(1.25);
  g.add(disc, chev);
  g.position.set(pos.x, 0.02, pos.z);
  g.rotation.y = Math.atan2(-dir.x, -dir.z);
  g.userData = { target, disc, chev };
  disc.userData.navRoot = g;
  g.renderOrder = 5; disc.renderOrder = 5; chev.renderOrder = 6;
  return g;
}
function makeRing(target) {
  const s = SPOTS[target];
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf1eee6, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(s.p[0], 0.015, s.p[1]); m.renderOrder = 4;
  return m;
}
function showNav(key) {
  nav.clear(); hot = null;
  const here = SPOTS[key];
  for (const t of here.to) {
    const there = SPOTS[t];
    const d = new THREE.Vector3(there.p[0] - here.p[0], 0, there.p[1] - here.p[1]);
    const dist = d.length(); d.normalize();
    const r = Math.min(3.3, dist * 0.7);
    nav.add(makeArrow(t, d, { x: here.p[0] + d.x * r, z: here.p[1] + d.z * r }));
    if (dist > 3.6) nav.add(makeRing(t));
  }
  nav.visible = true;
}

/* ---------- camera state + movement ---------- */
let current = 'a0';
let yaw = 0, pitch = -0.14, fov = 68;
let move = null;            // active glide
let queue = [];

function yawTo(from, to) { return Math.atan2(-(to[0] - from[0]), -(to[1] - from[1])); }
function lookTarget(key) {
  const s = SPOTS[key];
  if (s.art) { const a = ART.find((x) => x.id === s.art); return [a.center.x, a.center.z]; }
  return s.look;
}
function shortest(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

function path(from, to) {
  const prev = { [from]: null }; const q = [from];
  while (q.length) {
    const k = q.shift(); if (k === to) break;
    for (const n of SPOTS[k].to) if (!(n in prev)) { prev[n] = k; q.push(n); }
  }
  const out = []; for (let k = to; k && k !== from; k = prev[k]) out.unshift(k);
  return out;
}
function goTo(key) {
  if (key === current && !move) return;
  const start = move ? move.to : current;
  queue = path(start, key);
  if (!move) step();
}
function step() {
  const next = queue.shift();
  if (!next) { move = null; arrive(); return; }
  const a = SPOTS[current].p, b = SPOTS[next].p;
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const last = queue.length === 0;
  const face = last ? lookTarget(next) : SPOTS[queue[0]].p;
  move = {
    from: a, to: next, toP: b, t: 0, dur: reduceMotion ? 0.01 : THREE.MathUtils.clamp(dist * 0.3, 0.8, 1.9) * (last ? 1 : 0.8),
    yaw0: yaw, dyaw: shortest(yaw, yawTo(b, face)), pitch0: pitch, last,
  };
  nav.visible = false;
  document.body.classList.add('moved');
}
function arrive() {
  showNav(current);
  setCaption();
}
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ---------- caption + room nav ---------- */
const capInner = document.querySelector('.caption-inner');
const capTitle = document.getElementById('capTitle'), capSub = document.getElementById('capSub');
let capKey = '';
function setCaption() {
  const s = SPOTS[current];
  const a = s.art && ART.find((x) => x.id === s.art);
  const title = a ? a.title : ROOMS[s.room].name;
  const sub = a ? `${a.sub}, ${ROOMS[s.room].name}` : roomLine(s.room);
  document.querySelectorAll('.rooms button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.room === s.room)));
  if (title + sub === capKey) return;
  capKey = title + sub;
  capInner.classList.add('swap');
  setTimeout(() => { capTitle.textContent = title; capSub.textContent = sub; capInner.classList.remove('swap'); }, capTitle.textContent ? 260 : 0);
}
function roomLine(room) {
  const n = ART.filter((a) => a.room === room).length;
  return n === 1 ? '1 work on view' : `${n} works on view`;
}
document.querySelectorAll('.rooms button').forEach((b) => b.addEventListener('click', () => goTo(ROOM_ENTRY[b.dataset.room])));

/* ---------- input ---------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let drag = null;
const pinch = new Map();
let pinchDist = 0;

function pick(e) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  if (nav.visible) {
    const discs = nav.children.map((g) => g.userData.disc).filter(Boolean);
    const h = ray.intersectObjects(discs, false)[0];
    if (h) return { type: 'nav', root: h.object.userData.navRoot, target: h.object.userData.navRoot.userData.target };
  }
  const hits = ray.intersectObjects([...artMeshes, floor, ...world.children.filter((o) => o.isMesh && !artMeshes.includes(o))], false);
  const h = hits[0];
  if (!h) return null;
  if (h.object.userData.art) {
    const id = h.object.userData.art.id;
    const key = Object.keys(SPOTS).find((k) => SPOTS[k].art === id);
    return { type: 'art', target: key };
  }
  if (h.object === floor) {
    let best = null, bd = 2.4;
    for (const k of Object.keys(SPOTS)) { const d = Math.hypot(SPOTS[k].p[0] - h.point.x, SPOTS[k].p[1] - h.point.z); if (d < bd) { bd = d; best = k; } }
    if (best && best !== current) return { type: 'floor', target: best };
  }
  return null;
}
function setHot(p) {
  const root = p && p.type === 'nav' ? p.root : null;
  if (root !== hot) {
    if (hot) { hot.userData.disc.material.color.set(0x0b0b0c); hot.userData.chev.material.color.set(0xf1eee6); hot.scale.setScalar(1); }
    hot = root;
    if (hot) { hot.userData.disc.material.color.set(0xd8f24a); hot.userData.chev.material.color.set(0x0b0b0c); hot.scale.setScalar(1.12); }
  }
  canvas.classList.toggle('hot', !!p);
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pinch.set(e.pointerId, e);
  if (pinch.size === 2) { const [a, b] = [...pinch.values()]; pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); drag = null; return; }
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (pinch.has(e.pointerId)) pinch.set(e.pointerId, e);
  if (pinch.size === 2) {
    const [a, b] = [...pinch.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinchDist) setFov(fov * (pinchDist / d)); pinchDist = d; return;
  }
  if (!drag) { if (e.pointerType === 'mouse' && !move) setHot(pick(e)); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; canvas.classList.add('dragging'); }
  if (drag.moved) {
    const k = (fov * Math.PI / 180) / innerHeight;
    yaw += dx * k; pitch = THREE.MathUtils.clamp(pitch + dy * k, -1.1, 0.95);
    if (move) { move.yaw0 = yaw - move.dyaw * ease(Math.min(move.t / move.dur, 1)); move.pitch0 = pitch; }
  }
  drag.x = e.clientX; drag.y = e.clientY;
});
function endPointer(e) {
  pinch.delete(e.pointerId); pinchDist = 0;
  canvas.classList.remove('dragging');
  if (drag && !drag.moved && e.type === 'pointerup') { const p = pick(e); if (p) goTo(p.target); }
  drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); setFov(fov + e.deltaY * 0.03); }, { passive: false });

function baseFov() { return innerWidth < innerHeight ? 84 : 68; }
function setFov(v) { fov = THREE.MathUtils.clamp(v, 32, baseFov() + 6); camera.fov = fov; camera.updateProjectionMatrix(); }

const keys = new Set();
addEventListener('keydown', (e) => {
  if (!document.body.classList.contains('entered')) return;
  if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'ArrowRight' || k === 'd') { keys.add(k); e.preventDefault(); }
  if (k === 'ArrowUp' || k === 'w' || k === 'ArrowDown' || k === 's') {
    e.preventDefault();
    if (move) return;
    // walk to the neighbour that best matches where you're facing (or behind you, for down)
    const sign = (k === 'ArrowDown' || k === 's') ? -1 : 1;
    const f = [-Math.sin(yaw) * sign, -Math.cos(yaw) * sign];
    let best = null, bs = 0.35;
    for (const n of SPOTS[current].to) {
      const d = [SPOTS[n].p[0] - SPOTS[current].p[0], SPOTS[n].p[1] - SPOTS[current].p[1]];
      const l = Math.hypot(d[0], d[1]); const dot = (d[0] * f[0] + d[1] * f[1]) / l;
      if (dot > bs) { bs = dot; best = n; }
    }
    if (best) goTo(best);
  }
});
addEventListener('keyup', (e) => keys.delete(e.key));

/* ---------- resize + loop ---------- */
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  fov = baseFov(); camera.fov = fov; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
let entered = false, idleT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (move) {
    move.t += dt;
    const k = ease(Math.min(move.t / move.dur, 1));
    camera.position.x = move.from[0] + (move.toP[0] - move.from[0]) * k;
    camera.position.z = move.from[1] + (move.toP[1] - move.from[1]) * k;
    camera.position.y = EYE + Math.sin(k * Math.PI * 3) * 0.012 * (reduceMotion ? 0 : 1);
    yaw = move.yaw0 + move.dyaw * k;
    if (move.last) pitch = move.pitch0 + (-0.12 - move.pitch0) * k;
    if (move.t >= move.dur) { current = move.to; move = null; step(); }
  } else {
    camera.position.set(SPOTS[current].p[0], EYE, SPOTS[current].p[1]);
  }
  const turn = (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('d') ? 1 : 0);
  if (turn) { yaw += turn * dt * 1.5; if (move) move.yaw0 += turn * dt * 1.5; }
  // slow drift on the entry screen
  if (!entered && !reduceMotion) { idleT += dt; yaw = Math.sin(idleT * 0.22) * 0.16; }
  camera.rotation.set(pitch, yaw, 0);
  // arrows breathe a little so they read as interactive
  if (nav.visible && !reduceMotion) {
    const s = 1.25 * (1 + Math.sin(clock.elapsedTime * 2.4) * 0.04);
    for (const g of nav.children) if (g.userData.chev && g !== hot) g.userData.chev.scale.setScalar(s);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
const enterBtn = document.getElementById('enter');
const fontReady = document.fonts.load('800 60px Syne').catch(() => {});
Promise.all([...pending, fontReady]).then(() => {
  titleWall();
  // the reflection: a flipped copy of the rooms under the see-through floor
  const mirror = world.clone(true); mirror.scale.y = -1; scene.add(mirror);
  camera.position.set(SPOTS.a0.p[0], EYE, SPOTS.a0.p[1]);
  nav.visible = false;
  requestAnimationFrame(frame);
  document.getElementById('enterLabel').textContent = 'Enter the gallery';
  enterBtn.disabled = false; enterBtn.focus({ preventScroll: true });
});
enterBtn.addEventListener('click', () => {
  entered = true; yaw = 0;
  document.body.classList.add('entered');
  arrive();
  canvas.focus?.();
});

// handy for testing from the console
window.__gallery = { goTo, SPOTS, state: () => ({ current, yaw, pitch, moving: !!move }), look: (y, p) => { yaw = y; pitch = p ?? pitch; } };
