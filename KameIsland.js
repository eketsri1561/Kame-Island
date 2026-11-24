// Emmanuel Ketsri & Jeremey Sarkodie
// AI Statement: I completed this assignment without using generative AI tools.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

// Scene, camera, renderer, and controls
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0x8fd3ff, 130, 300); // far ocean fades into sky

const WORLD_SCALE = 2.8;

const FRUSTUM = 22 * WORLD_SCALE;
let aspect = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
  -FRUSTUM * aspect / 2,
  FRUSTUM * aspect / 2,
  FRUSTUM / 2,
  -FRUSTUM / 2,
  0.1,
  500
);

camera.position.set(20, 14, 22).multiplyScalar(WORLD_SCALE);
camera.lookAt(0, 0.5 * WORLD_SCALE, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft shadow edges
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5 * WORLD_SCALE, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05; // keep above water
controls.minZoom = 0.6; // keep ocean edge out of view
controls.maxZoom = 4;
controls.update();

// Lighting
scene.add(new THREE.HemisphereLight(0xcfe9ff, 0xe0cfa8, 0.9));

// Sun (main light, casts shadows)
const sun = new THREE.DirectionalLight(0xfff0d9, 2.0);
sun.position.set(10, 20, 8).normalize().multiplyScalar(60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -34;
sun.shadow.camera.right = 34;
sun.shadow.camera.top = 34;
sun.shadow.camera.bottom = -34;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 150;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
scene.add(sun);

// Rim light (from behind, separates shapes from the background)
const rimLight = new THREE.DirectionalLight(0x9ec5ff, 0.45);
rimLight.position.set(-30, 20, -25);
scene.add(rimLight);

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

island.scale.setScalar(WORLD_SCALE);
island.updateMatrixWorld(); // so the raycasts below see the scaled island
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
  raycaster.set(new THREE.Vector3(x, 100, z), DOWN);
  const hit = raycaster.intersectObject(island);
  return hit.length ? hit[0].point.y : 0;
}

// x, z are in the original island units
function placePalm(x, z, opts) {
  const tree = makePalmTree(opts);
  const wx = x * WORLD_SCALE;
  const wz = z * WORLD_SCALE;
  tree.scale.setScalar(WORLD_SCALE);
  tree.position.set(wx, groundHeightAt(wx, wz) - 0.05 * WORLD_SCALE, wz);
  tree.rotation.y = Math.atan2(z, -x); // tree leans away from island center
  scene.add(tree);

  return tree;
}

placePalm(-3.4, -1.0, {segments: 7, lean: 0.07});
placePalm(3.8, -0.8, {segments: 7, lean: 0.06});
placePalm(3.0, 1.6, {segments: 5, lean: 0.09,frondLength: 1.3});

// Kame House (Jeremey's composite object)
const pink = new THREE.MeshStandardMaterial({color: 0xf7a3cf, roughness: 0.9});

const sidingPink = new THREE.MeshStandardMaterial({color: 0xd987b3, roughness: 0.9});

const signRed = new THREE.MeshStandardMaterial({color: 0xd8324a, roughness: 0.45});

// Weathervane (metallic, semi-gloss)
const vaneMetal = new THREE.MeshStandardMaterial({color: 0xf4f1ea, metalness: 0.3, roughness: 0.4});

const trim = new THREE.MeshStandardMaterial({color: 0xfff4e9, roughness: 0.8});

const roofRed = new THREE.MeshStandardMaterial({color: 0xa92c37, roughness: 0.8, side: THREE.DoubleSide});

const greenDoor = new THREE.MeshStandardMaterial({color: 0x388451});

// Glass (smooth, clear-coated and see-through)
const glass = new THREE.MeshPhysicalMaterial({
  color: 0x9fd3ea, roughness: 0.05, metalness: 0.0,
  clearcoat: 1.0, transparent: true, opacity: 0.55
});

function part(
  parent, geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
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
let kameVane;        // weathervane group
let kameVaneSpinner; // the arrow that turns in the wind

// Kame House + interior
function makeKameHouse() {
  const house = new THREE.Group();
  const shell = new THREE.Group();
  const interior = new THREE.Group();
  house.add(shell, interior);

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
  // The floor is shared by the living room and smaller rooms
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

  // Outside walls
  for (const x of [-2.4, 2.4]) {
    box(shell, 0.12, 2.36, 4.12, pink, x, 1.44, 0);
    box(shell, 0.014, 2.22, 3.98, insidePink,
      x - Math.sign(x) * 0.068, 1.44, 0);
  }
  box(shell, 4.8, 2.36, 0.12, pink, 0, 1.44, -2.05);
  box(shell, 4.62, 2.22, 0.014, insidePink, 0, 1.44, -1.982);

  // Front wall temporarily hidden when roof opens
  kameFront = new THREE.Group();
  shell.add(kameFront);
  box(kameFront, 4.8, 2.36, 0.12, pink, 0, 1.44, 2.05);
  box(kameFront, 4.62, 2.22, 0.014, insidePink, 0, 1.44, 1.982);

  // Horizontal siding lines (front, sides, back)
  for (let y = 0.5; y < 2.6; y += 0.2) {
    box(kameFront, 4.8, 0.02, 0.02, sidingPink, 0, y, 2.12);
    box(shell, 4.8, 0.02, 0.02, sidingPink, 0, y, -2.12);
    for (const x of [-2.465, 2.465]) {
      box(shell, 0.02, 0.02, 4.12, sidingPink, x, y, 0);
    }
  }

  // Front door
  const DOOR_X = 0.95;
  box(kameFront, 0.98, 1.78, 0.05, white, DOOR_X, 1.21, 2.10); // frame
  box(kameFront, 0.84, 1.68, 0.075, greenDoor, DOOR_X, 1.16, 2.13);
  part(kameFront, new THREE.SphereGeometry(0.045, 12, 8),
    trim, DOOR_X + 0.29, 1.16, 2.19);

  // Single front window on the left, with shutters
  const WIN_X = -1.48;
  box(kameFront, 1.02, 1.12, 0.08, white, WIN_X, 1.52, 2.14);
  box(kameFront, 0.89, 0.99, 0.085, glass, WIN_X, 1.52, 2.19);
  box(kameFront, 0.055, 1.04, 0.095, white, WIN_X, 1.52, 2.25);
  box(kameFront, 0.96, 0.055, 0.095, white, WIN_X, 1.52, 2.25);
  for (const dx of [-0.66, 0.66]) {
    box(kameFront, 0.26, 1.12, 0.05, white, WIN_X + dx, 1.52, 2.14);
    for (let y = 1.1; y < 1.98; y += 0.1) { // shutter slats
      box(kameFront, 0.22, 0.02, 0.03, trim, WIN_X + dx, y, 2.175);
    }
  }

  // Porch awning + columns over the door (hide with the front wall when the roof opens)
  part(kameFront, new THREE.BoxGeometry(1.55, 0.1, 0.95), roofRed,
    DOOR_X, 2.1, 2.5, 0.22, 0, 0);
  for (const dx of [-0.63, 0.63]) {
    part(kameFront, new THREE.CylinderGeometry(0.052, 0.052, 1.78, 10),
      trim, DOOR_X + dx, 1.12, 2.76);
  }

  // Porch lamp (warm spotlight shining on the door)
  const porchLight = new THREE.SpotLight(0xffd9a0, 30, 8, 0.6, 0.6, 2);
  porchLight.position.set(DOOR_X, 1.95, 2.55);
  porchLight.target.position.set(DOOR_X, 0.3, 2.6);
  kameFront.add(porchLight, porchLight.target);

  // Outside windows
  for (const side of [-1, 1]) {
    box(shell, 0.085, 1.10, 1.20, white, side * 2.48, 1.60, 0.38);
    box(shell, 0.09, 0.98, 1.08, glass, side * 2.54, 1.60, 0.38);
    box(shell, 0.10, 0.055, 1.12, white, side * 2.60, 1.60, 0.38);
  }
  box(shell, 1.25, 0.13, 0.62, trim, DOOR_X, 0.16, 2.42); // front step

  // Roof
  kameRoof = new THREE.Group();
  shell.add(kameRoof);

  // Roof shape (change ROOF_RISE for a taller/shorter roof)
  const WALL_TOP = 2.62;     // top of the walls
  const WALL_HALF = 2.4;     // half the house width
  const halfSpan = 2.62;     // half the roof width (overhangs the walls)
  const ROOF_RISE = 2.4;     // ridge height above the eaves (was 1.10)
  const ROOF_THICK = 0.14;

  const roofAngle = Math.atan2(ROOF_RISE, halfSpan);
  const roofLength = Math.hypot(halfSpan, ROOF_RISE);
  const thickOff = (ROOF_THICK / 2) / Math.cos(roofAngle); // center line -> top/bottom surface
  // Eave height chosen so the underside of the roof sits right on top of the walls
  const eaveY = WALL_TOP + thickOff - ROOF_RISE * (1 - WALL_HALF / halfSpan);
  const ridgeY = eaveY + ROOF_RISE;
  // Height of the roof's top surface at a given x
  const roofTopY = (x) => eaveY + ROOF_RISE * (1 - Math.abs(x) / halfSpan) + thickOff;

  for (const side of [-1, 1]) {
    part(kameRoof,
      new THREE.BoxGeometry(roofLength, ROOF_THICK, 4.56),
      roofRed, side * halfSpan / 2, eaveY + ROOF_RISE / 2, 0,
      0, 0, -side * roofAngle);
  }

  // Front and back gables (triangles that fill the wall up to the roof underside)
  const gableTop = WALL_TOP + WALL_HALF * ROOF_RISE / halfSpan;
  for (const z of [-2.065, 2.065]) {
    const gable = new THREE.Shape();
    gable.moveTo(-WALL_HALF, WALL_TOP);
    gable.lineTo(WALL_HALF, WALL_TOP);
    gable.lineTo(0, gableTop);
    gable.closePath();
    const gableMat = pink.clone();
    gableMat.side = THREE.DoubleSide;
    part(kameRoof, new THREE.ShapeGeometry(gable), gableMat, 0, 0, z);
  }
  box(kameRoof, 0.17, 0.13, 4.58, roofRed, 0, ridgeY, 0); // ridge cap

  // Upstairs room
  const dormerProfile = new THREE.Shape();
  dormerProfile.moveTo(-0.55, 0);
  dormerProfile.lineTo(0.55, 0);
  dormerProfile.lineTo(0.55, 0.7);
  dormerProfile.lineTo(0, 1.0);
  dormerProfile.lineTo(-0.55, 0.7);
  dormerProfile.closePath();

  const DORMER_Z = 0.9;      // toward the front of the house
  const DORMER_FRONT = -1.9; // face with the window (points out the left side)
  // Sits just below the roof surface at its front face
  const DORMER_BASE = roofTopY(DORMER_FRONT) - 0.15;
  const DORMER_BACK = -halfSpan * (1 - (DORMER_BASE + 1.05 - eaveY - thickOff) / ROOF_RISE);
  const dormerLen = DORMER_BACK - DORMER_FRONT;

  // Rotating -90° around Y makes the extrusion run toward -x
  part(kameRoof,
    new THREE.ExtrudeGeometry(dormerProfile, { depth: dormerLen, bevelEnabled: false }),
    pink, DORMER_BACK, DORMER_BASE, DORMER_Z, 0, -Math.PI / 2, 0);

  // Dormer's roof
  const dRise = 0.3;
  const dHalf = 0.55;
  const dAngle = Math.atan2(dRise, dHalf);
  const dLen = Math.hypot(dRise, dHalf) + 0.12;
  for (const s of [-1, 1]) {
    part(kameRoof, new THREE.BoxGeometry(dormerLen + 0.15, 0.08, dLen), roofRed,
      (DORMER_FRONT + DORMER_BACK) / 2 - 0.075, DORMER_BASE + 0.89,
      DORMER_Z + s * dHalf / 2, s * dAngle, 0, 0);
  }

  // Dormer window
  const dwX = DORMER_FRONT - 0.03;
  const dwY = DORMER_BASE + 0.48;
  box(kameRoof, 0.06, 0.44, 0.56, white, dwX, dwY, DORMER_Z);
  box(kameRoof, 0.065, 0.34, 0.46, glass, dwX - 0.01, dwY, DORMER_Z);
  box(kameRoof, 0.07, 0.36, 0.035, white, dwX - 0.02, dwY, DORMER_Z);
  box(kameRoof, 0.07, 0.035, 0.48, white, dwX - 0.02, dwY, DORMER_Z);

  // Weathervane/compass on ridge
  kameVane = new THREE.Group();
  kameVane.position.set(0, ridgeY + 0.065, 1.55); // on top of the ridge cap
  kameRoof.add(kameVane);

  // Finial base (bell-shaped profile spun around Y)
  const finialProfile = [
    [0, 0], [0.14, 0], [0.14, 0.035], [0.08, 0.07],
    [0.1, 0.12], [0.05, 0.18], [0.035, 0.24], [0, 0.26]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  part(kameVane, new THREE.LatheGeometry(finialProfile, 20), vaneMetal, 0, 0, 0);

  // Pole, compass cross arms, top ball
  part(kameVane, new THREE.CylinderGeometry(0.018, 0.022, 0.95, 8), vaneMetal, 0, 0.7, 0);
  part(kameVane, new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), vaneMetal,
    0, 0.62, 0, 0, 0, Math.PI / 2);
  part(kameVane, new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), vaneMetal,
    0, 0.62, 0, Math.PI / 2, 0, 0);
  part(kameVane, new THREE.SphereGeometry(0.045, 12, 8), vaneMetal, 0, 1.18, 0);

  // Spinning arrow (extruded shape)
  kameVaneSpinner = new THREE.Group();
  kameVaneSpinner.position.y = 0.95;
  kameVane.add(kameVaneSpinner);

  const arrowShape = new THREE.Shape();
  const arrowPts = [
    [0.42, 0], [0.22, 0.09], [0.22, 0.025], [-0.3, 0.025],
    [-0.42, 0.13], [-0.5, 0.13], [-0.4, 0], [-0.5, -0.13],
    [-0.42, -0.13], [-0.3, -0.025], [0.22, -0.025], [0.22, -0.09]
  ];
  arrowShape.moveTo(...arrowPts[0]);
  for (const p of arrowPts.slice(1)) arrowShape.lineTo(...p);
  arrowShape.closePath();

  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.025, bevelEnabled: false });
  arrowGeo.translate(0, 0, -0.0125); // center the thickness on the pole
  part(kameVaneSpinner, arrowGeo, vaneMetal, 0, 0, 0);

  // Kitchen counter, upper cabinets, and window above sink
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

  // Refrigerator beside kitchen
  box(interior, 0.58, 1.66, 0.62, fridgeGreen, -0.08, 1.16, -1.68);
  box(interior, 0.035, 0.40, 0.04, steel, 0.24, 1.40, -1.34);
  box(interior, 0.54, 0.035, 0.04, darkWood, -0.08, 1.53, -1.35);

  // Closet doors on back wall
  box(interior, 1.10, 1.76, 0.06, white, 1.00, 1.30, -1.93);
  box(interior, 0.035, 1.76, 0.08, trim, 1.00, 1.30, -1.88);
  for (const x of [0.73, 1.27]) {
    for (let y = 0.68; y < 2.02; y += 0.13) {
      box(interior, 0.42, 0.022, 0.075, trim, x, y, -1.87);
    }
  }

  // Small rooms behind living room
  box(interior, 0.10, 2.10, 0.48, insidePink, 1.62, 1.36, -1.75);
  box(interior, 0.10, 2.10, 0.37, insidePink, 1.62, 1.36, -0.65);
  box(interior, 0.12, 0.27, 0.75, insidePink, 1.62, 2.275, -1.15);
  box(interior, 0.82, 2.10, 0.10, insidePink, 2.00, 1.36, -0.46);
  // Trim doorway edges
  for (const z of [-1.50, -0.84]) {
    box(interior, 0.15, 1.80, 0.055, white, 1.62, 1.23, z);
  }
  // Bedroom
  box(interior, 0.72, 0.18, 1.16, darkWood, 2.00, 0.44, -1.20);
  box(interior, 0.66, 0.15, 1.06, white, 2.00, 0.59, -1.20);
  box(interior, 0.64, 0.045, 0.62, tvBlue, 2.00, 0.69, -0.98);
  box(interior, 0.48, 0.09, 0.23, white, 2.00, 0.72, -1.62);
  box(interior, 0.74, 0.55, 0.10, darkWood, 2.00, 0.70, -1.82);
  box(interior, 0.35, 0.045, 0.18, woodAlt, 2.06, 1.10, -0.53);

  // Side room
  box(interior, 0.10, 2.10, 0.65, insidePink, 1.52, 1.36, 0.40);
  box(interior, 0.10, 2.10, 0.28, insidePink, 1.52, 1.36, 1.88);
  box(interior, 0.12, 0.27, 0.72, insidePink, 1.52, 2.275, 1.20);
  for (const z of [0.76, 1.74]) {
    box(interior, 0.15, 1.80, 0.055, white, 1.52, 1.23, z);
  }
  // Back wall for staircase room
  box(interior, 0.88, 2.10, 0.10, insidePink, 1.98, 1.36, 0.03);
  box(interior, 0.88, 0.075, 0.12, white, 1.98, 0.39, 0.03);

  // Second room on right
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
    // Solid riser and separate wood tread
    box(interior, stairWidth, (i + 1) * stepRise, stepDepth,
      stairWood, 2.02, 0.34 + (i + 1) * stepRise / 2, z);
    box(interior, stairWidth + 0.04, 0.055, stepDepth + 0.025,
      woodAlt, 2.02, top + 0.027, z);
    // Dark nosing on each step
    box(interior, stairWidth + 0.045, 0.025, 0.025,
      stairDark, 2.02, top + 0.055, z + stepDepth / 2);
  }
  // Small upper landing
  box(interior, 0.72, 0.12, 0.25, stairWood, 2.02, 1.92, 0.48);
  // Rail
  for (const i of [0, 2, 4, 6, 7]) {
    const z = stairStartZ - i * stepDepth;
    const top = 0.34 + (i + 1) * stepRise;
    box(interior, 0.045, 0.55, 0.045, stairRail,
      1.65, top + 0.30, z);
  }
  // Handrail
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

  // Living room rug
  box(interior, 2.48, 0.025, 1.72, rug, -0.34, 0.335, 0.56);

  // Couch
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

  // Coffee table
  box(interior, 0.59, 0.06, 0.59, black, -0.55, 0.56, 0.82);
  for (const x of [-0.78, -0.32]) {
    for (const z of [0.59, 1.05]) {
      box(interior, 0.045, 0.20, 0.045, black, x, 0.43, z);
    }
  }

  // Living room TV
  box(interior, 0.12, 0.82, 1.16, black, -2.18, 1.50, 0.80);
  box(interior, 0.018, 0.72, 1.06, tvBlue, -2.105, 1.50, 0.80);
  box(interior, 0.34, 0.40, 1.26, darkWood, -2.13, 0.54, 0.80);
  for (const z of [0.49, 1.10]) {
    box(interior, 0.025, 0.27, 0.50, woodAlt, -1.94, 0.54, z);
  }

  // Indoor plant
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
  // Backsplash above the kitchen counter
  box(interior, 1.86, 0.24, 0.025, white, -1.34, 1.24, -1.94);
  // Kitchen upper cabinets
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
const HOUSE_Z = -0.45 * WORLD_SCALE;

// Foundation box
const FOUNDATION_BOTTOM = 0.015 * 1.8;

// Sample points cover the real footprint
const groundY = lowestGroundUnder(
  HOUSE_X,
  HOUSE_Z,
  [-4.52, 0, 4.52],
  [-3.89, 0, 3.89, 4.91]
);

kameHouse.position.set(
  HOUSE_X,
  groundY - FOUNDATION_BOTTOM,
  HOUSE_Z
);

scene.add(kameHouse);

// KAME HOUSE sign + compass letters
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/three@0.164.0/examples/fonts/helvetiker_regular.typeface.json";

new FontLoader().load(FONT_URL, (font) => {
  function makeText(str, size, depth, material) {
    const geo = new TextGeometry(str, {
      font, size, depth,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: depth * 0.25,
      bevelSize: size * 0.03,
      bevelSegments: 1
    });
    geo.center(); // so positions refer to the middle of the word
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Sign on the front roof
  const SIGN_TILT = 0.35; // radians ~20° counterclockwise 
  const kameWord = makeText("KAME", 0.4, 0.04, signRed);
  kameWord.position.set(-0.2, 3.8, 2.1);
  kameWord.rotation.z = SIGN_TILT;
  const houseWord = makeText("HOUSE", 0.4, 0.04, signRed);
  houseWord.position.set(0.1, 3.35, 2.1);
  houseWord.rotation.z = SIGN_TILT;
  kameRoof.add(kameWord, houseWord);

  // N E S W at ends of the compass arms
  for (const [letter, x, z, ry] of [
    ["N", 0, -0.44, Math.PI],
    ["S", 0, 0.44, 0],
    ["E", 0.44, 0, Math.PI / 2],
    ["W", -0.44, 0, -Math.PI / 2]
  ]) {
    const l = makeText(letter, 0.12, 0.02, vaneMetal);
    l.position.set(x, 0.66, z);
    l.rotation.y = ry;
    kameVane.add(l);
  }
});

// Shoreline boulders + bushes (additional objects)
const rockMat = new THREE.MeshStandardMaterial({color: 0xd99a6c, roughness: 0.95, flatShading: true});
const bushMat = new THREE.MeshStandardMaterial({color: 0x3f8f3f, roughness: 0.9, flatShading: true});

// Boulder (icosahedron with each corner pushed in/out a random-looking amount)
function makeRock(size, seed) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Hash rounded position so shared corners move together
    const key = Math.round(v.x * 100) * 12.9898 + Math.round(v.y * 100) * 78.233 + Math.round(v.z * 100) * 37.719;
    const h = Math.sin(key + seed) * 43758.5453;
    v.multiplyScalar(0.8 + 0.35 * (h - Math.floor(h)));
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, rockMat);
  rock.scale.set(size * 1.3, size * 0.7, size);
  return rock;
}

for (const i of [1, 4, 8, 11, 15, 19, 23, 26]) {
  const p = ringPoint(3, i).multiplyScalar(WORLD_SCALE * 1.02);
  const rock = makeRock(0.9 + (i % 3) * 0.35, i);
  rock.position.set(p.x, 0.1, p.z);
  rock.rotation.y = i;
  scene.add(rock);
}

// Bush
function makeBush(size) {
  const bush = new THREE.Group();
  for (const [x, y, z, r] of [
    [0, 0.45, 0, 0.55],
    [0.45, 0.3, 0.1, 0.42],
    [-0.4, 0.3, -0.1, 0.45],
    [0.1, 0.3, 0.42, 0.4],
    [-0.1, 0.28, -0.42, 0.38]
  ]) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), bushMat);
    puff.position.set(x, y, z);
    bush.add(puff);
  }
  bush.scale.setScalar(size);
  return bush;
}

for (const [x, z, size] of [[-5.6, -5.8, 1.8], [5.6, -5.6, 1.6], [5.4, 3.0, 1.4]]) {
  const bush = makeBush(size);
  bush.position.set(x, groundHeightAt(x, z) - 0.1, z);
  scene.add(bush);
}

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

beachChair.scale.setScalar(0.40 * WORLD_SCALE);
beachChair.rotation.y = 0.25;

const CHAIR_X = -2.60 * WORLD_SCALE;
const CHAIR_Z = 1.05 * WORLD_SCALE;
// Find how far the chair's lowest point sits below its origin
beachChair.position.set(CHAIR_X, 0, CHAIR_Z);
beachChair.updateMatrixWorld();
const chairBottom = new THREE.Box3().setFromObject(beachChair).min.y;

// Lowest ground under the chair's footprint
const chairGround = lowestGroundUnder(
  CHAIR_X, CHAIR_Z,
  [-0.8, 0, 0.8],   // across the chair's width
  [-1.1, 0, 1.6]    // from the backrest to the front legs
);

// Put the leg bottoms on that ground
beachChair.position.y = chairGround - chairBottom;

scene.add(beachChair);

// Ocean (dense plane with vertices animated by layered sin waves)
const WATER_SIZE = 160;
const waterGeo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, 200, 200);

waterGeo.rotateX(-Math.PI / 2);
const waterBase = waterGeo.attributes.position.array.slice();

// Smooth, semi-transparent water (low roughness gives sun glints on the wave facets)
const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: 0x2a90dc,
    flatShading: true,
    transparent: true,
    opacity: 0.82,
    roughness: 0.18,
    metalness: 0.05
  })
);

water.scale.setScalar(WORLD_SCALE); // scales the size AND the wave height
scene.add(water);

// Seafloor
const seafloor = new THREE.Mesh(new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE), new THREE.MeshBasicMaterial({color: 0x0b3d6b}));

seafloor.rotation.x = -Math.PI / 2;
seafloor.position.y = -3 * WORLD_SCALE;
seafloor.scale.setScalar(WORLD_SCALE);

scene.add(seafloor);

// Flying Nimbus (press A to start / stop)
//   nimbus
//     ├─ core  (LatheGeometry: SURFACE OF REVOLUTION, a lumpy profile spun around Y)
//     ├─ puffs (big soft lumps on top + a ring of small lumps around the rim)
//     └─ glow  (yellow point light that lights up whatever it flies past)
//   + a long tapering streak (custom tube mesh) that follows the flight path behind it
const nimbusMat = new THREE.MeshStandardMaterial({
  color: 0xf5d36e, emissive: 0xffb02e, emissiveIntensity: 0.18,
  roughness: 0.7, side: THREE.DoubleSide
});

function makeNimbus() {
  const nimbus = new THREE.Group();

  // Core
  const profile = [];
  const STEPS = 14;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const r = Math.pow(Math.sin(Math.PI * t), 0.7) * (1 + 0.08 * Math.sin(t * Math.PI * 6));
    profile.push(new THREE.Vector2(r, -0.35 + 0.7 * t));
  }
  const core = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), nimbusMat);
  core.scale.set(1, 0.8, 1.35); // stretch front-to-back (forward is +z)
  nimbus.add(core);

  // Puffs
  const addPuff = (x, y, z, r) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), nimbusMat);
    puff.position.set(x, y, z);
    puff.scale.y = 0.85; // slightly squashed = softer, cloudier
    nimbus.add(puff);
  };
  addPuff(0, 0.38, 0.15, 0.62);    // big center puff
  addPuff(0.5, 0.25, 0.35, 0.48);
  addPuff(-0.5, 0.25, 0.35, 0.48);
  addPuff(0.45, 0.3, -0.3, 0.5);
  addPuff(-0.45, 0.3, -0.3, 0.5);
  addPuff(0, 0.35, -0.5, 0.5);
  addPuff(0, 0.15, 0.85, 0.45);    // front
  addPuff(0, 0.08, -1.05, 0.5);    // back, where the streak comes out

  // Small bumps around the rim
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    addPuff(Math.cos(a) * 0.85, -0.02, Math.sin(a) * 1.1, 0.28);
  }

  const glow = new THREE.PointLight(0xffc24d, 120, 40, 2);
  glow.position.y = 0.3;
  nimbus.add(glow);

  nimbus.scale.setScalar(1.4);
  return nimbus;
}

const nimbus = makeNimbus();
scene.add(nimbus);

// Flight path (a figure eight)
const flightPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(2, 4, 11),      // parked in front of the door
  new THREE.Vector3(18, 6, 13),
  new THREE.Vector3(26, 10, 0),
  new THREE.Vector3(14, 13, -13),
  new THREE.Vector3(0, 16, -2),     // over the house
  new THREE.Vector3(-13, 13, 11),
  new THREE.Vector3(-26, 10, 4),
  new THREE.Vector3(-22, 9, -10),
  new THREE.Vector3(-9, 12, -15),
  new THREE.Vector3(-1, 15, 3)      // over the house again (clears the taller roof), then dive
], true, "centripetal");

const LOOP_SECONDS = 22;
let nimbusFlying = false;
let flightU = 0.30; // 0..1 = how far around the loop
let tailGrow = 0;

const ahead = new THREE.Vector3();
function placeNimbus(u) {
  const p = flightPath.getPointAt(u);
  const forward = flightPath.getTangentAt(u);
  nimbus.position.copy(p);
  nimbus.lookAt(ahead.copy(p).add(forward)); // +z faces the direction of travel

  // Bank (roll) into turns
  const nextForward = flightPath.getTangentAt((u + 0.01) % 1);
  const turn = new THREE.Vector3().crossVectors(forward, nextForward).y;
  nimbus.rotateZ(THREE.MathUtils.clamp(-turn * 12, -0.5, 0.5));
}
placeNimbus(flightU);

// Trail (long tube that gets thinner toward the end, laid along the flight
// path behind nimbus)
const TAIL_SAMPLES = 70;    // rings along the streak
const TAIL_SIDES = 10;      // vertices around each ring
const TAIL_STEP = 0.45;     // world units between rings
const TAIL_START = 1.3;     // starts inside the back of the cloud
const TAIL_RADIUS = 0.6;    // thickness where it leaves the cloud
const pathLength = flightPath.getLength();

const tailGeo = new THREE.BufferGeometry();
const tailPositions = new Float32Array(TAIL_SAMPLES * TAIL_SIDES * 3);
tailGeo.setAttribute("position", new THREE.BufferAttribute(tailPositions, 3));

const tailIndex = [];
for (let i = 0; i < TAIL_SAMPLES - 1; i++) {
  for (let j = 0; j < TAIL_SIDES; j++) {
    const a = i * TAIL_SIDES + j;
    const b = i * TAIL_SIDES + (j + 1) % TAIL_SIDES;
    const c = a + TAIL_SIDES;
    const d = b + TAIL_SIDES;
    tailIndex.push(a, c, b, b, c, d);
  }
}
tailGeo.setIndex(tailIndex);

const tail = new THREE.Mesh(tailGeo, nimbusMat);
tail.frustumCulled = false; // its shape changes every frame
scene.add(tail);

const UP = new THREE.Vector3(0, 1, 0);
const tailSide = new THREE.Vector3();
const tailUp = new THREE.Vector3();

function updateTail() {
  for (let i = 0; i < TAIL_SAMPLES; i++) {
    // Walk backward along path from nimbus
    const back = (TAIL_START + i * TAIL_STEP * tailGrow) / pathLength;
    const u = ((flightU - back) % 1 + 1) % 1;
    const center = flightPath.getPointAt(u);
    const forward = flightPath.getTangentAt(u);

    // Two directions perpendicular to the path to build ring
    tailSide.crossVectors(forward, UP).normalize();
    tailUp.crossVectors(tailSide, forward).normalize();

    // Taper from thick to thin
    const f = 1 - i / (TAIL_SAMPLES - 1);
    const r = TAIL_RADIUS * Math.pow(f, 0.9) + 0.03;

    for (let j = 0; j < TAIL_SIDES; j++) {
      const a = j / TAIL_SIDES * Math.PI * 2;
      const k = (i * TAIL_SIDES + j) * 3;
      tailPositions[k]     = center.x + (tailSide.x * Math.cos(a) + tailUp.x * Math.sin(a)) * r;
      tailPositions[k + 1] = center.y + (tailSide.y * Math.cos(a) + tailUp.y * Math.sin(a)) * r;
      tailPositions[k + 2] = center.z + (tailSide.z * Math.cos(a) + tailUp.z * Math.sin(a)) * r;
    }
  }
  tailGeo.attributes.position.needsUpdate = true;
  tailGeo.computeVertexNormals();
}
updateTail(); // the streak is visible even while parked
tail.visible = false;

// Shadows
scene.traverse((obj) => {
  if (obj.isMesh) {
    obj.castShadow = true;
    obj.receiveShadow = true;
  }
});
water.castShadow = false;
seafloor.castShadow = false;

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

// Keys
//   A = start / stop the Flying Nimbus
//   O = open / close the roof to see the interior
window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "KeyA") {
    nimbusFlying = !nimbusFlying;
    tail.visible = nimbusFlying; // streak only while moving
    if (!nimbusFlying) tailGrow = 0;
}
  if (event.code === "KeyO") houseOpen = !houseOpen;
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05); // avoid big jumps after a tab switch
  const t = clock.elapsedTime;

  // Roof open / close
  const target = houseOpen ? 4.5 : 0;
  roofHeight += (target - roofHeight) * Math.min(1, delta * 2.3);
  kameRoof.position.y = roofHeight;
  kameFront.visible = roofHeight < 0.3;

  // Arrow swings in the wind
  kameVaneSpinner.rotation.y = 0.6 * Math.sin(t * 0.35) + 0.25 * Math.sin(t * 1.3);

  // Flying Nimbus (moves while flying, A toggles)
  if (nimbusFlying) {
    flightU = (flightU + delta / LOOP_SECONDS) % 1;
    placeNimbus(flightU);
    tailGrow = Math.min(1, tailGrow + delta * 0.5);
    updateTail();
  }

  updateWater(t);
  controls.update();
  renderer.render(scene, camera);
});