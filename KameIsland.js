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

// Kame House (Jeremy composite object)
const pink = new THREE.MeshStandardMaterial({color: 0xf49ac8, roughness: 0.9});

const trim = new THREE.MeshStandardMaterial({color: 0xfff4e9, roughness: 0.8});

const roofRed = new THREE.MeshStandardMaterial({color: 0xa92c37, roughness: 0.8, side: THREE.DoubleSide});

const greenDoor = new THREE.MeshStandardMaterial({color: 0x388451});

const glass = new THREE.MeshStandardMaterial({color: 0x8dc4df, roughness: 0.25, metalness: 0.1});

function part(parent, geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);

  return mesh;
}

function makeKameHouse() {
  const house = new THREE.Group();

  // Walls
  part(house, new THREE.BoxGeometry(3, 2.05, 2.65), pink, 0, 1.12, 0);

  // Foundation
  part(house, new THREE.BoxGeometry(3.2, 0.15, 2.9), trim, 0, 0.12, 0);

  // Roof
  const roofWidth = Math.sqrt(1.7 ** 2 + 1.10 ** 2);

  part(house, new THREE.BoxGeometry(roofWidth, 0.13, 3.05), roofRed, -0.85, 2.64, 0, 0, 0, Math.atan2(1.10, 1.7));

  part(house, new THREE.BoxGeometry(roofWidth, 0.13, 3.05), roofRed, 0.85, 2.64, 0, 0, 0, -Math.atan2(1.10, 1.7));

  // Triangular front and rear gables
  const gable = new THREE.BufferGeometry();

  gable.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      -1.5, 2.14, 1.335,
       1.5, 2.14, 1.335,
       0, 3.23, 1.335,

       1.5, 2.14, -1.335,
      -1.5, 2.14, -1.335,
       0, 3.23, -1.335
    ], 3)
  );

  gable.computeVertexNormals();
  part(house, gable, pink, 0, 0, 0);

  // Horizontal siding
  for (let y = 0.37; y < 2.08; y += 0.22) {
    part(house, new THREE.BoxGeometry(3.02, 0.025, 0.025), trim, 0, y, 1.335);
    part(house, new THREE.BoxGeometry(0.025, 0.025, 2.65), trim, -1.51, y, 0);
  }

  // Front door
  part(house, new THREE.BoxGeometry(0.72, 1.5, 0.07), greenDoor, 0.86, 0.92, 1.38);

  // Doorknob
  part(house, new THREE.SphereGeometry(0.045, 10, 8), trim, 1.11, 0.93, 1.44);

  // Porch
  part(house, new THREE.BoxGeometry(1.2, 0.12, 0.85), trim, 0.84, 0.13, 1.75);

  // Porch roof
  part(house,new THREE.BoxGeometry(1.4, 0.14, 0.92), roofRed, 0.82, 1.88, 1.72);

  // Porch columns
  for (const x of [0.24, 1.4]) {
    part(house, new THREE.CylinderGeometry(0.045, 0.045, 1.5, 10), trim, x, 0.94, 2.03);
  }

  // Front window
  part(house,new THREE.BoxGeometry(1.05, 0.87, 0.06), trim, -0.63, 1.25, 1.39);
  part(house, new THREE.BoxGeometry(0.85, 0.68, 0.07), glass, -0.63, 1.25, 1.44);

  // Window crossbars
  part(house, new THREE.BoxGeometry(0.065, 0.72, 0.09), trim, -0.63, 1.25, 1.49);
  part(house, new THREE.BoxGeometry(0.91, 0.06, 0.09), trim, -0.63, 1.25, 1.49);

  // Shutters
  for (const x of [-1.28, 0.02]) {part(house, new THREE.BoxGeometry(0.23, 0.87, 0.08), trim, x, 1.25, 1.44);
  }

  // Side window
  part(house, new THREE.BoxGeometry(0.07, 0.78, 0.82), trim, -1.54, 1.25, 0);
  part(house, new THREE.BoxGeometry(0.08, 0.61, 0.66), glass, -1.59, 1.25, 0);
  part(house, new THREE.BoxGeometry(0.09, 0.07, 0.7), trim, -1.64, 1.25, 0);

  return house;
}

const kameHouse = makeKameHouse();

// Place the house so lowest corner touches the ground
function lowestGroundUnder(cx, cz, xs, zs) {
  let min = Infinity;
  for (const dx of xs) {
    for (const dz of zs) {
      min = Math.min(min, groundHeightAt(cx + dx, cz + dz));
    }
  }
  return min;
}

const HOUSE_X = 0, HOUSE_Z = -0.45;
const FOUNDATION_BOTTOM = 0.045;

const groundY = lowestGroundUnder( HOUSE_X, HOUSE_Z, [-1.6, 0, 1.6], [-1.45, 0, 1.45, 2.2]);

kameHouse.position.set(HOUSE_X, groundY - FOUNDATION_BOTTOM, HOUSE_Z);

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

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  updateWater(clock.getElapsedTime());
  controls.update();
  renderer.render(scene, camera);
});
