// Emmanuel Ketsri & Jeremey Sarkodie
// AI Statement: I completed this assignment without using generative AI tools. -->

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Scene, camera, renderer, and controls
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);

const FRUSTUM = 22;
let aspect = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
  -FRUSTUM * aspect / 2,
  FRUSTUM * aspect / 2,
  FRUSTUM / 2,
  -FRUSTUM / 2,
  0.1,
  500
);

camera.position.set(20, 14, 22);
camera.lookAt(0, 0.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05; // keep above water
controls.minZoom = 0.6; // keep ocean edge out of view
controls.maxZoom = 4;
controls.update();

// Lighting
scene.add(new THREE.HemisphereLight(0xdff4ff, 0x3a6b4a, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(10, 20, 8);
scene.add(sun);

// Island (Emmanuel's polygonal mesh object)
const ISLAND_RX = 7;
const ISLAND_RZ = 4.5;
const SEGMENTS = 28;

const RINGS = [
  { k: 0.35, y: 0.62 },
  { k: 0.68, y: 0.45 },
  { k: 0.84, y: 0.24 },
  { k: 1.00, y: 0.03 },
  { k: 1.25, y: -0.70 }
];

const BAND_COLORS = [0x5cb85c, 0x4fae4f, 0xeedfb0, 0xd9c48a, 0x8fe0d0];
const PEAK = new THREE.Vector3(0, 0.75, 0);

// Coastline
function shoreFactor(t) {
  return 1 + 0.10 * Math.sin(3 * t + 0.4) + 0.06 * Math.sin(5 * t + 1.7) + 0.04 * Math.sin(9 * t + 0.3);
}

function heightJitter(i, ring) {
  return 0.04 * Math.sin(i * 12.9898 + ring * 78.233);
}

function ringPoint(ringIdx, i) {
  const idx = i % SEGMENTS;
  const t = idx / SEGMENTS * Math.PI * 2;
  const { k, y } = RINGS[ringIdx];
  const f = shoreFactor(t) * k;

  return new THREE.Vector3(
    Math.cos(t) * ISLAND_RX * f,
    y + heightJitter(idx, ringIdx),
    Math.sin(t) * ISLAND_RZ * f
  );
}

function buildIslandGeometry() {
  const positions = [];
  const colors = [];
  const c = new THREE.Color();

  // Every triangle own its 3 vertices > flat faces + per face color
  function addTri(a, b, cc, hex, faceIdx, band) {
    positions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      cc.x, cc.y, cc.z
    );

    const shade = 0.9 + 0.1 * (((faceIdx * 7 + band * 3) % 5) / 4); // faceted variation
    c.setHex(hex).multiplyScalar(shade);

    for (let v = 0; v < 3; v++) {
      colors.push(c.r, c.g, c.b);
    }
  }

  // Center fan
  for (let i = 0; i < SEGMENTS; i++) {
    addTri(PEAK, ringPoint(0, i + 1), ringPoint(0, i), BAND_COLORS[0], i, 0);
  }

  // Band between rings (2 triangles per quad)
  for (let r = 0; r < RINGS.length - 1; r++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = ringPoint(r, i);
      const a1 = ringPoint(r, i + 1);
      const b0 = ringPoint(r + 1, i);
      const b1 = ringPoint(r + 1, i + 1);
      const hex = BAND_COLORS[r + 1];

      addTri(a0, b1, b0, hex, i * 2, r + 1);
      addTri(a0, a1, b1, hex, i * 2 + 1, r + 1);
    }
  }

  const geo = new THREE.BufferGeometry();

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  geo.computeVertexNormals();return geo;}

const island = new THREE.Mesh(
  buildIslandGeometry(),
  new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.95})
);

scene.add(island);

// Palm trees (Emmanuel's composite object)
//    tree
//      └─ joint0 ─ trunk segment (cylinder) + ring (torus)
//          └─ joint1 (each joint bends a little for curved trunk look)
//              └─ crown
//                  ├─ cap (sphere)
//                  ├─ frondPivot x N > frond (flattened cone)
//                  └─ coconuts (spheres)
const matTrunk = new THREE.MeshStandardMaterial({color: 0x9a6b3f, flatShading: true, roughness: 1});
const matTrunkRing = new THREE.MeshStandardMaterial({color: 0x6e4a2a, flatShading: true, roughness: 1});
const matFrond = new THREE.MeshStandardMaterial({color: 0x2f9e4a, flatShading: true, roughness: 0.9,side: THREE.DoubleSide});
const matCoconut = new THREE.MeshStandardMaterial({color: 0x5a3b1e, flatShading: true, roughness: 0.8});

function makePalmTree({segments = 6, segLength = 0.55, lean = 0.08, frondCount = 7,frondLength = 1.} = {}) {
  const tree = new THREE.Group();
  let parent = tree;

  for (let i = 0; i < segments; i++) {
    const joint = new THREE.Group();

    if (i > 0) {
      joint.position.y = segLength; // top of prev
      joint.rotation.z = lean;
    }

    parent.add(joint);

    const rBottom = 0.14 - i * 0.012;
    const rTop = rBottom - 0.012;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, segLength, 10), matTrunk);

    seg.position.y = segLength / 2;
    joint.add(seg);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(rTop + 0.01, 0.02, 6, 14), matTrunkRing);

    ring.rotation.x = Math.PI / 2;
    ring.position.y = segLength; // top of prev segment
    joint.add(ring); // bend accumulates up trunk

    parent = joint;
  }

  const crown = new THREE.Group();
  crown.position.y = segLength;
  parent.add(crown);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), matFrond);
  crown.add(cap);

  for (let i = 0; i < frondCount; i++) {
    const frondPivot = new THREE.Group();
    frondPivot.rotation.y = i / frondCount * Math.PI * 2 + (i % 2) * 0.2;
    crown.add(frondPivot);

    const droop = 0.35 + (i % 3) * 0.12;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.24, frondLength, 4), matFrond);

    frond.scale.set(0.2, 1, 1);
    frond.rotation.z = -Math.PI / 2 - droop;
    frond.position.set(frondLength / 2 * Math.cos(droop), -frondLength / 2 * Math.sin(droop), 0);

    frondPivot.add(frond);
  }

  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), matCoconut);
    coconut.position.set(Math.cos(a) * 0.13, -0.13, Math.sin(a) * 0.13);
    crown.add(coconut);
  }

  return tree;
}

// Ground placement
const raycaster = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

function groundHeightAt(x, z) {
  raycaster.set(new THREE.Vector3(x, 10, z), DOWN);
  const hit = raycaster.intersectObject(island);
  return hit.length ? hit[0].point.y : 0;
}

function placePalm(x, z, opts) {
  const tree = makePalmTree(opts);
  tree.position.set(x, groundHeightAt(x, z) - 0.05, z);
  tree.rotation.y = Math.atan2(z, -x); // tree leans away from island center
  scene.add(tree);

  return tree;
}

placePalm(-3.4, -1.0, {segments: 7, lean: 0.07});
placePalm(3.8, -0.8, {segments: 7, lean: 0.06});
placePalm(3.0, 1.6, {segments: 5, lean: 0.09,frondLength: 1.3});

// Kame House (jeremy composite object)
const pink = new THREE.MeshStandardMaterial({
  color: 0xf49ac8,
  roughness: 0.9
});

const trim = new THREE.MeshStandardMaterial({
  color: 0xfff4e9,
  roughness: 0.8
});

const roofRed = new THREE.MeshStandardMaterial({
  color: 0xa92c37,
  roughness: 0.8,
  side: THREE.DoubleSide
});

const greenDoor = new THREE.MeshStandardMaterial({
  color: 0x388451
});

const glass = new THREE.MeshStandardMaterial({
  color: 0x8dc4df,
  roughness: 0.25,
  metalness: 0.1
});

function part(
  parent, geometry, material,
  x, y, z,
  rx = 0, ry = 0, rz = 0
) {
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);

  return mesh;
}

let houseOpen = false;
let roofHeight = 0;
let kameRoof;
let kameFront;

// Kame House with redesigned interior
function makeKameHouse() {
  const house = new THREE.Group();
  const shell = new THREE.Group();
  const interior = new THREE.Group();
  house.add(shell, interior);

  // Larger footprint, while keeping the original 1.8x house scale.
  shell.scale.setScalar(1.8);
  interior.scale.setScalar(1.8);

  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const wood = mat(0xc9824e);
  const woodAlt = mat(0xd79560);
  const woodSeam = mat(0x9b5b36);
  const insidePink = mat(0xd47e96, { side: THREE.DoubleSide });
  const red = mat(0x9b202a);
  const redLight = mat(0xb62f39);
  const rug = mat(0xcac5c0);
  const black = mat(0x242326);
  const white = mat(0xf2ede5);
  const darkWood = mat(0x554037);
  const stone = mat(0xc4bcb6);
  const steel = mat(0xb9c4c8, { metalness: 0.45, roughness: 0.4 });
  const fridgeGreen = mat(0x28563e);
  const tvBlue = mat(0x213b4d, { roughness: 0.25 });
  const leafGreen = mat(0x348348);
  const potBrown = mat(0x8a5740);

  const box = (parent, w, h, d, material, x, y, z) =>
    part(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);

  // Main dimensions: x = -2.4 to 2.4; z = -2.05 to 2.05.
  // The floor is shared by the living room and the smaller rooms.
  box(shell, 5.02, 0.23, 4.32, trim, 0, 0.13, 0);
  box(shell, 4.78, 0.055, 4.08, wood, 0, 0.27, 0);
  for (let i = 0; i < 27; i++) {
    const z = -1.98 + i * 0.15;
    box(shell, 4.72, 0.008, 0.143, i % 4 === 0 ? woodAlt : wood,
      0, 0.303, z);
    for (let j = 0; j < 6; j++) {
      const x = -2.25 + j * 0.76 + (i % 2) * 0.38;
      if (x < 2.3) box(shell, 0.009, 0.004, 0.142,
        woodSeam, x, 0.311, z);
    }
  }

  // Exterior walls, with warm pink inner faces.
  for (const x of [-2.4, 2.4]) {
    box(shell, 0.12, 2.36, 4.12, pink, x, 1.44, 0);
    box(shell, 0.014, 2.22, 3.98, insidePink,
      x - Math.sign(x) * 0.068, 1.44, 0);
  }
  box(shell, 4.8, 2.36, 0.12, pink, 0, 1.44, -2.05);
  box(shell, 4.62, 2.22, 0.014, insidePink, 0, 1.44, -1.982);

  // Front wall is hidden temporarily when A opens the roof for a clear view.
  kameFront = new THREE.Group();
  shell.add(kameFront);
  box(kameFront, 4.8, 2.36, 0.12, pink, 0, 1.44, 2.05);
  box(kameFront, 4.62, 2.22, 0.014, insidePink, 0, 1.44, 1.982);
  box(kameFront, 0.84, 1.68, 0.075, greenDoor, 0, 1.16, 2.13);
  part(kameFront, new THREE.SphereGeometry(0.045, 12, 8),
    trim, 0.29, 1.16, 2.19);

  // Front windows and their cross-shaped white frames.
  for (const x of [-1.48, 1.48]) {
    box(kameFront, 1.02, 1.12, 0.08, white, x, 1.52, 2.14);
    box(kameFront, 0.89, 0.99, 0.085, glass, x, 1.52, 2.19);
    box(kameFront, 0.055, 1.04, 0.095, white, x, 1.52, 2.25);
    box(kameFront, 0.96, 0.055, 0.095, white, x, 1.52, 2.25);
  }

  // Exterior side windows.
  for (const side of [-1, 1]) {
    box(shell, 0.085, 1.10, 1.20, white, side * 2.48, 1.60, 0.38);
    box(shell, 0.09, 0.98, 1.08, glass, side * 2.54, 1.60, 0.38);
    box(shell, 0.10, 0.055, 1.12, white, side * 2.60, 1.60, 0.38);
  }
  box(shell, 1.25, 0.13, 0.62, trim, 0, 0.16, 2.42);

  // Roof: the red panels and both filled-in pink triangles move together.
  kameRoof = new THREE.Group();
  shell.add(kameRoof);
  const halfSpan = 2.62;
  const rise = 1.10;
  const roofAngle = Math.atan2(rise, halfSpan);
  const roofLength = Math.hypot(halfSpan, rise);
  for (const side of [-1, 1]) {
    part(kameRoof,
      new THREE.BoxGeometry(roofLength, 0.14, 4.56),
      roofRed, side * halfSpan / 2, 3.16, 0,
      0, 0, -side * roofAngle);
  }
  for (const z of [-2.065, 2.065]) {
    const gable = new THREE.Shape();
    gable.moveTo(-2.4, 2.62);
    gable.lineTo(2.4, 2.62);
    gable.lineTo(0, 3.72);
    gable.closePath();
    const gableMat = pink.clone();
    gableMat.side = THREE.DoubleSide;
    part(kameRoof, new THREE.ShapeGeometry(gable), gableMat, 0, 0, z);
  }
  box(kameRoof, 0.17, 0.13, 4.58, roofRed, 0, 3.72, 0);
  box(kameRoof, 1.55, 0.14, 0.95, roofRed, 0, 2.08, 2.48);
  for (const x of [-0.63, 0.63]) {
    part(shell, new THREE.CylinderGeometry(0.052, 0.052, 1.70, 10),
      trim, x, 1.08, 2.76);
  }

  // REFERENCE LAYOUT: kitchen on back-left, living room in the middle,
  // closet on the back wall, and separate rooms on the back-right.

  // Kitchen counter, upper cabinets, and big window above the sink.
  box(interior, 1.88, 0.72, 0.48, darkWood, -1.34, 0.68, -1.72);
  box(interior, 1.98, 0.075, 0.58, stone, -1.34, 1.08, -1.72);
  for (const x of [-2.04, -1.56, -1.08, -0.60]) {
    box(interior, 0.42, 0.55, 0.025, woodAlt, x, 0.70, -1.425);
    part(interior, new THREE.SphereGeometry(0.026, 8, 6),
      steel, x + 0.12, 0.70, -1.405);
  }
  box(interior, 1.45, 0.98, 0.055, white, -1.37, 1.90, -1.94);
  box(interior, 1.31, 0.84, 0.06, glass, -1.37, 1.90, -1.90);
  box(interior, 0.045, 0.89, 0.08, white, -1.37, 1.90, -1.85);
  box(interior, 1.36, 0.045, 0.08, white, -1.37, 1.90, -1.85);
  box(interior, 0.40, 0.025, 0.31, steel, -1.60, 1.13, -1.70);
  part(interior, new THREE.CylinderGeometry(0.02, 0.02, 0.22, 10),
    steel, -1.61, 1.26, -1.88);
  box(interior, 0.18, 0.025, 0.03, steel, -1.54, 1.37, -1.88);
  box(interior, 0.38, 0.03, 0.36, black, -0.82, 1.13, -1.69);
  for (const x of [-0.93, -0.72]) {
    for (const z of [-1.80, -1.59]) {
      part(interior, new THREE.TorusGeometry(0.055, 0.008, 6, 12),
        steel, x, 1.154, z, Math.PI / 2);
    }
  }

  // Tall green refrigerator beside the kitchen.
  box(interior, 0.58, 1.66, 0.62, fridgeGreen, -0.08, 1.16, -1.68);
  box(interior, 0.035, 0.40, 0.04, steel, 0.24, 1.40, -1.34);
  box(interior, 0.54, 0.035, 0.04, darkWood, -0.08, 1.53, -1.35);

  // White double closet doors on the back wall.
  box(interior, 1.10, 1.76, 0.06, white, 1.00, 1.30, -1.93);
  box(interior, 0.035, 1.76, 0.08, trim, 1.00, 1.30, -1.88);
  for (const x of [0.73, 1.27]) {
    for (let y = 0.68; y < 2.02; y += 0.13) {
      box(interior, 0.42, 0.022, 0.075, trim, x, y, -1.87);
    }
  }

  // Small rooms behind the living room, with actual dividing walls.
  // Two openings are intentionally left clear for access.
  box(interior, 0.10, 2.10, 0.48, insidePink, 1.62, 1.36, -1.75);
  box(interior, 0.10, 2.10, 0.37, insidePink, 1.62, 1.36, -0.65);
  // Lintel bridges the opening without blocking the doorway.
  box(interior, 0.12, 0.27, 0.75, insidePink, 1.62, 2.275, -1.15);
  box(interior, 0.82, 2.10, 0.10, insidePink, 2.00, 1.36, -0.46);
  // Trim the doorway edges.
  for (const z of [-1.50, -0.84]) {
    box(interior, 0.15, 1.80, 0.055, white, 1.62, 1.23, z);
  }
  // First room on right: bedroom
  box(interior, 0.72, 0.18, 1.16, darkWood, 2.00, 0.44, -1.20);
  box(interior, 0.66, 0.15, 1.06, white, 2.00, 0.59, -1.20);
  box(interior, 0.64, 0.045, 0.62, tvBlue, 2.00, 0.69, -0.98);
  box(interior, 0.48, 0.09, 0.23, white, 2.00, 0.72, -1.62);
  box(interior, 0.74, 0.55, 0.10, darkWood, 2.00, 0.70, -1.82);
  // Slim wall shelf leaves floor clear.
  box(interior, 0.35, 0.045, 0.18, woodAlt, 2.06, 1.10, -0.53);

  // Side room on the right, separated by a wall with a doorway gap.
  box(interior, 0.10, 2.10, 0.65, insidePink, 1.52, 1.36, 0.40);
  box(interior, 0.10, 2.10, 0.28, insidePink, 1.52, 1.36, 1.88);
  box(interior, 0.12, 0.27, 0.72, insidePink, 1.52, 2.275, 1.20);
  for (const z of [0.76, 1.74]) {
    box(interior, 0.15, 1.80, 0.055, white, 1.52, 1.23, z);
  }
  // Solid back wall for the staircase room, closing off the rear opening.
  // This wall is part of Kame House only; the doorway on the left stays open.
  box(interior, 0.88, 2.10, 0.10, insidePink, 1.98, 1.36, 0.03);
  box(interior, 0.88, 0.075, 0.12, white, 1.98, 0.39, 0.03);

  // Second room on the right: neat wooden staircase instead of bathroom.
  // Steps climb from the front of the room toward the back wall.
  const stairWood = mat(0xb47a4e);
  const stairDark = mat(0x6e4931);
  const stairRail = mat(0xf7eee2);
  const stairStartZ = 1.78;
  const stairWidth = 0.66;
  const stepDepth = 0.16;
  const stepRise = 0.19;
  for (let i = 0; i < 8; i++) {
    const z = stairStartZ - i * stepDepth;
    const top = 0.34 + (i + 1) * stepRise;
    // Solid riser and separate wood tread, for clearly visible stairs.
    box(interior, stairWidth, (i + 1) * stepRise, stepDepth,
      stairWood, 2.02, 0.34 + (i + 1) * stepRise / 2, z);
    box(interior, stairWidth + 0.04, 0.055, stepDepth + 0.025,
      woodAlt, 2.02, top + 0.027, z);
    // Dark nosing on each step.
    box(interior, stairWidth + 0.045, 0.025, 0.025,
      stairDark, 2.02, top + 0.055, z + stepDepth / 2);
  }
  // Small upper landing (visual staircase; no second floor is modeled).
  box(interior, 0.72, 0.12, 0.25, stairWood, 2.02, 1.92, 0.48);
  // Rail posts along the open side of the stairs.
  for (const i of [0, 2, 4, 6, 7]) {
    const z = stairStartZ - i * stepDepth;
    const top = 0.34 + (i + 1) * stepRise;
    box(interior, 0.045, 0.55, 0.045, stairRail,
      1.65, top + 0.30, z);
  }
  // Sloping handrail follows the stairs upward.
  const railStart = new THREE.Vector3(1.65, 1.05, 1.78);
  const railEnd = new THREE.Vector3(1.65, 2.38, 0.66);
  const railVec = railEnd.clone().sub(railStart);
  const handrail = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, railVec.length(), 0.055), stairRail
  );
  handrail.position.copy(railStart).add(railEnd).multiplyScalar(0.5);
  handrail.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), railVec.normalize()
  );
  interior.add(handrail);

  // Large light-gray rug in the middle of the living room.
  box(interior, 2.48, 0.025, 1.72, rug, -0.34, 0.335, 0.56);

  // Red L-shaped couch, low like the reference.
  // Main long section follows the back edge of the rug.
  box(interior, 2.14, 0.25, 0.43, red, -0.47, 0.49, -0.05);
  box(interior, 0.44, 0.25, 1.32, red, 0.38, 0.49, 0.40);
  box(interior, 2.14, 0.32, 0.14, redLight, -0.47, 0.76, -0.24);
  box(interior, 0.14, 0.32, 1.30, redLight, 0.57, 0.76, 0.40);
  for (const x of [-1.26, -0.74, -0.22]) {
    box(interior, 0.47, 0.12, 0.35, redLight, x, 0.66, -0.02);
  }
  for (const z of [0.26, 0.69]) {
    box(interior, 0.36, 0.12, 0.39, redLight, 0.37, 0.66, z);
  }

  // Simple black square coffee table.
  box(interior, 0.59, 0.06, 0.59, black, -0.55, 0.56, 0.82);
  for (const x of [-0.78, -0.32]) {
    for (const z of [0.59, 1.05]) {
      box(interior, 0.045, 0.20, 0.045, black, x, 0.43, z);
    }
  }

  // Living room TV on the left wall, facing the sofa.
  box(interior, 0.12, 0.82, 1.16, black, -2.18, 1.50, 0.80);
  box(interior, 0.018, 0.72, 1.06, tvBlue, -2.105, 1.50, 0.80);
  box(interior, 0.34, 0.40, 1.26, darkWood, -2.13, 0.54, 0.80);
  for (const z of [0.49, 1.10]) {
    box(interior, 0.025, 0.27, 0.50, woodAlt, -1.94, 0.54, z);
  }

  // Indoor plant near the kitchen.
  part(interior, new THREE.CylinderGeometry(0.18, 0.13, 0.32, 12),
    potBrown, -2.10, 0.49, -0.77);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2;
    const leaf = part(interior, new THREE.SphereGeometry(0.16, 8, 6),
      leafGreen,
      -2.10 + Math.cos(a) * 0.15,
      0.79 + (i % 3) * 0.10,
      -0.77 + Math.sin(a) * 0.15);
    leaf.scale.set(0.75, 1.4, 0.65);
  }

  // Clean finishing details: continuous baseboards, crown molding,
  // wall art, kitchen backsplash and individual cabinet hardware.
  for (const z of [-1.96, 1.96]) {
    box(interior, 4.62, 0.075, 0.035, white, 0, 0.39, z);
    box(interior, 4.62, 0.055, 0.045, white, 0, 2.57, z);
  }
  for (const x of [-2.32, 2.32]) {
    box(interior, 0.035, 0.075, 3.90, white, x, 0.39, 0);
    box(interior, 0.045, 0.055, 3.90, white, x, 2.57, 0);
  }
  // Backsplash above the kitchen counter.
  box(interior, 1.86, 0.24, 0.025, white, -1.34, 1.24, -1.94);
  // Kitchen upper cabinets either side of the window.
  box(interior, 0.34, 0.55, 0.26, darkWood, -2.16, 2.04, -1.78);
  box(interior, 0.34, 0.55, 0.26, darkWood, -0.55, 2.04, -1.78);
  for (const x of [-2.16, -0.55]) {
    box(interior, 0.25, 0.43, 0.018, woodAlt, x, 2.04, -1.63);
    box(interior, 0.07, 0.018, 0.025, steel, x + 0.08, 2.04, -1.61);
  }
  // A framed picture on the rear wall near the closet.
  box(interior, 0.38, 0.48, 0.045, darkWood, 1.79, 1.94, -1.93);
  box(interior, 0.30, 0.40, 0.05, leafGreen, 1.79, 1.94, -1.90);
  // Sofa armrests and subtle cushion seams.
  box(interior, 0.14, 0.36, 0.43, red, -1.57, 0.67, -0.05);
  box(interior, 0.44, 0.35, 0.14, red, 0.38, 0.67, 1.04);
  // Rug border and coffee-table lower shelf.
  box(interior, 2.36, 0.005, 1.60, white, -0.34, 0.351, 0.56);
  box(interior, 2.22, 0.007, 1.46, rug, -0.34, 0.356, 0.56);
  box(interior, 0.51, 0.028, 0.51, darkWood, -0.55, 0.39, 0.82);
  const interiorLight = new THREE.PointLight(0xffe5d3, 1.8, 10);
  interiorLight.position.set(0, 2.3, 0);
  interior.add(interiorLight);

  return house;
}

const kameHouse = makeKameHouse();

// House placement
function lowestGroundUnder(cx, cz, xs, zs) {
  let min = Infinity;

  for (const dx of xs) {
    for (const dz of zs) {
      min = Math.min(
        min,
        groundHeightAt(cx + dx, cz + dz)
      );
    }
  }

  return min;
}

const HOUSE_X = 0;
const HOUSE_Z = -0.45;

const FOUNDATION_BOTTOM = 0.045 * 1.8;

const groundY = lowestGroundUnder(
  HOUSE_X,
  HOUSE_Z,
  [-2.85, 0, 2.85],
  [-2.6, 0, 2.6]
);

kameHouse.position.set(
  HOUSE_X,
  groundY - FOUNDATION_BOTTOM,
  HOUSE_Z
);

scene.add(kameHouse);

// Beach Chair (Jeremy's polygonal mesh object)
function makeBeachChair() {
  const chair = new THREE.Group();

  const pinkFabric = new THREE.MeshStandardMaterial({color: 0x4fc3f7, side: THREE.DoubleSide, roughness: 0.9, flatShading: true});

  const whiteFabric = new THREE.MeshStandardMaterial({color: 0xfff7ee, side: THREE.DoubleSide, roughness: 0.9, flatShading: true});

  const wood = new THREE.MeshStandardMaterial({color: 0xfff7ee, roughness: 0.85, flatShading: true});

  const darkWood = new THREE.MeshStandardMaterial({color: 0xfff7ee, roughness: 0.9});

  // Custom mesh (165 vertices, 280 triangular faces)
  const rows = 14;
  const columns = 10;
  const vertices = [];
  const indices = [];

  function surfacePoint(u, v) {
    const z = -0.95 + v * 2.35;
    let y;

    // Curved back
    if (v < 0.38) {
      const t = v / 0.38;
      y = 1.35 - 0.91 * t + 0.055 * Math.sin(t * Math.PI);
    } 
    else {
      // Seat
      const t = (v - 0.38) / 0.62;
      y = 0.44 - 0.10 * Math.sin(t * Math.PI) + 0.035 * t;
    }

    const x = (u - 0.5) * 1.05;

    // Raised edges
    const sideCurve =
      Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.075;

    // Fabric ripples
    const ripple = 0.018 * Math.sin(v * Math.PI * 5) * Math.sin(u * Math.PI);
    y += sideCurve + ripple;

    return new THREE.Vector3(x, y, z);
  }

  // Build vertices
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;

    for (let c = 0; c <= columns; c++) {
      const u = c / columns;
      const p = surfacePoint(u, v);

      vertices.push(p.x, p.y, p.z);
    }
  }

  // Build triangular faces and stripes
  const fabricGeo = new THREE.BufferGeometry();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c;
      const b = a + 1;
      const d = (r + 1) * (columns + 1) + c;
      const e = d + 1;

      const start = indices.length;

      indices.push(a, d, b);
      indices.push(b, d, e);

      const stripe = Math.floor(c / 2) % 2;
      fabricGeo.addGroup(start, 6, stripe);
    }
  }

  fabricGeo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

  fabricGeo.setIndex(indices);
  fabricGeo.computeVertexNormals();

  const fabricMesh = new THREE.Mesh(fabricGeo, [pinkFabric, whiteFabric]);

  chair.add(fabricMesh);

  // Wooden beam
  function woodenBeam(start, end, thickness = 0.075, material = wood) {

    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const beam = new THREE.Mesh(new THREE.BoxGeometry(thickness, length, thickness), material);

    beam.position.copy(start).add(end).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    chair.add(beam);

    return beam;
  }

  // Side rails and legs
  for (const side of [-1, 1]) {
    const u = side === -1 ? 0 : 1;

    // Curved side rails
    for (let r = 0; r < rows; r++) {
      const a = surfacePoint(u, r / rows);
      const b = surfacePoint(u, (r + 1) / rows);

      a.x += side * 0.055;
      b.x += side * 0.055;

      woodenBeam(a, b, 0.09);
    }

    const x = side * 0.58;

    // Back support
    woodenBeam(new THREE.Vector3(x, 1.35, -0.95), new THREE.Vector3(x, 0.10, -0.62),0.09);

    // Front leg
    woodenBeam(new THREE.Vector3(x, 0.47, 1.15), new THREE.Vector3(x, 0.10, 1.28), 0.09);

    // Middle leg
    woodenBeam(new THREE.Vector3(x, 0.43, 0.05), new THREE.Vector3(x, 0.10, -0.23), 0.08);

    // Diagonal brace
    woodenBeam(new THREE.Vector3(x, 0.73, -0.65), new THREE.Vector3(x, 0.10, 0.12), 0.065, darkWood);
  }

  // Crossbars
  for (const [y, z] of [
    [1.35, -0.95],
    [0.48, 1.40],
    [0.14, -0.62],
    [0.14, 1.28]
  ]) {
    woodenBeam(new THREE.Vector3(-0.61, y, z), new THREE.Vector3(0.61, y, z), 0.075);
  }

  // Armrests
  for (const x of [-0.66, 0.66]) {
    woodenBeam(new THREE.Vector3(x, 0.73, -0.24), new THREE.Vector3(x, 0.68, 0.57), 0.11);
    woodenBeam(new THREE.Vector3(x, 0.68, 0.35), new THREE.Vector3(x, 0.37, 0.35), 0.065);
  }

  return chair;
}

// Position chair beside house
const beachChair = makeBeachChair();

beachChair.scale.setScalar(0.40);
beachChair.rotation.y = 0.25;

beachChair.position.set(-2.60, groundHeightAt(4.85, 1.05) + 0.08, 1.05);

scene.add(beachChair);

// Ocean (dense plane with vertices animated by layered sin waves)
const WATER_SIZE = 160;
const waterGeo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, 200, 200);

waterGeo.rotateX(-Math.PI / 2);
const waterBase = waterGeo.attributes.position.array.slice();

const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: 0x1e88d6,
    flatShading: true,
    transparent: true,
    opacity: 0.82,
    roughness: 0.35,
    metalness: 0.1
  })
);

scene.add(water);

// Seafloor
const seafloor = new THREE.Mesh(new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE), new THREE.MeshBasicMaterial({color: 0x0b3d6b}));

seafloor.rotation.x = -Math.PI / 2;
seafloor.position.y = -3;

scene.add(seafloor);

// Animated waves
function updateWater(t) {
  const pos = waterGeo.attributes.position;
  const arr = pos.array;

  for (let i = 0; i < pos.count; i++) {
    const x = waterBase[i * 3];
    const z = waterBase[i * 3 + 2];

    arr[i * 3 + 1] =
      0.06 * Math.sin(x * 0.55 + t * 1.2) +
      0.04 * Math.sin(z * 0.8 - t * 0.9) +
      0.025 * Math.sin((x + z) * 1.7 + t * 2.0);
  }

  pos.needsUpdate = true;
  waterGeo.computeVertexNormals();
}

// Window resize and render loop
function onResize() {
  aspect = window.innerWidth / window.innerHeight;

  camera.left = -FRUSTUM * aspect / 2;
  camera.right = FRUSTUM * aspect / 2;
  camera.top = FRUSTUM / 2;
  camera.bottom = -FRUSTUM / 2;

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onResize);

// Kame House roof control: press A to open or close.
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyA" && !event.repeat) houseOpen = !houseOpen;
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const target = houseOpen ? 4.5 : 0;
  roofHeight += (target - roofHeight) * Math.min(1, delta * 2.3);
  kameRoof.position.y = roofHeight;
  kameFront.visible = roofHeight < 0.3;
  updateWater(clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
});
