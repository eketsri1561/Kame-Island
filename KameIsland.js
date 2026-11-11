// Emmanuel Ketsri & Jeremey Sarkodie
// AI Statement: I completed this assignment without using generative AI tools.
// Kame Island — starting point, ocean + island + palm trees


import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Scene, camera, renderer, controls
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);

const FRUSTUM = 22; // world units visible at zoom = 1
let aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  (-FRUSTUM * aspect) / 2, (FRUSTUM * aspect) / 2,
  FRUSTUM / 2, -FRUSTUM / 2,
  0.1, 500
);
camera.position.set(20, 14, 22);
camera.lookAt(0, 0.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below the water
controls.minZoom = 0.6;                      // keep the ocean edge out of view
controls.maxZoom = 4;
controls.update();


// Lights
scene.add(new THREE.HemisphereLight(0xdff4ff, 0x3a6b4a, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(10, 20, 8);
scene.add(sun);

// Island (polygonal mesh)
//    Concentric rings of vertices around an irregular coastline.
//    Each band between rings is stitched with triangles and colored:
//      peak > ring0 : grass
//      ring0 > ring1: grass
//      ring1 > ring2: dry sand
//      ring2 > ring3: wet sand (shoreline)
//      ring3 > ring4: underwater shelf (shows through the water as shallows)
const ISLAND_RX = 7;    // half-width along X
const ISLAND_RZ = 4.5;  // half-depth along Z
const SEGMENTS = 28;    // vertices per ring

const RINGS = [
  { k: 0.35, y: 0.62 },
  { k: 0.68, y: 0.45 },
  { k: 0.84, y: 0.24 },
  { k: 1.00, y: 0.03 },
  { k: 1.25, y: -0.70 },
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
  const t = (idx / SEGMENTS) * Math.PI * 2;
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

  // Every triangle owns its 3 vertices > flat faces + per face color
  function addTri(a, b, cc, hex, faceIdx, band) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, cc.x, cc.y, cc.z);
    const shade = 0.9 + 0.1 * (((faceIdx * 7 + band * 3) % 5) / 4); // subtle faceted variation
    c.setHex(hex).multiplyScalar(shade);
    for (let v = 0; v < 3; v++) colors.push(c.r, c.g, c.b);
  }

  // Center fan
  for (let i = 0; i < SEGMENTS; i++) {
    addTri(PEAK, ringPoint(0, i + 1), ringPoint(0, i), BAND_COLORS[0], i, 0);
  }

  // Bands between rings (two triangles per quad)
  for (let r = 0; r < RINGS.length - 1; r++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = ringPoint(r, i), a1 = ringPoint(r, i + 1);
      const b0 = ringPoint(r + 1, i), b1 = ringPoint(r + 1, i + 1);
      const hex = BAND_COLORS[r + 1];
      addTri(a0, b1, b0, hex, i * 2, r + 1);
      addTri(a0, a1, b1, hex, i * 2 + 1, r + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals(); // non-indexed > one normal per face
  return geo;
}

const island = new THREE.Mesh(
  buildIslandGeometry(),
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })
);
scene.add(island);


// Palm tree (composite object)
//    tree
//      └─ joint0 ─ trunk segment (cylinder) + ring (torus)
//          └─ joint1 (each joint bends a little for curved trunk look)
//              └─ crown
//                  ├─ cap (sphere)
//                  ├─ frondPivot x N -> frond (flattened cone)
//                  └─ coconuts (spheres)
const matTrunk     = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, flatShading: true, roughness: 1 });
const matTrunkRing = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, flatShading: true, roughness: 1 });
const matFrond     = new THREE.MeshStandardMaterial({ color: 0x2f9e4a, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
const matCoconut   = new THREE.MeshStandardMaterial({ color: 0x5a3b1e, flatShading: true, roughness: 0.8 });

function makePalmTree({ segments = 6, segLength = 0.55, lean = 0.08, frondCount = 7, frondLength = 1.6 } = {}) {
  const tree = new THREE.Group();
  let parent = tree;

  for (let i = 0; i < segments; i++) {
    const joint = new THREE.Group();
    if (i > 0) {
      joint.position.y = segLength; // top of previous segment
      joint.rotation.z = lean;      // bend accumulates up the trunk
    }
    parent.add(joint);

    const rBottom = 0.14 - i * 0.012;
    const rTop = rBottom - 0.012;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, segLength, 10), matTrunk);
    seg.position.y = segLength / 2;
    joint.add(seg);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(rTop + 0.01, 0.02, 6, 14), matTrunkRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = segLength;
    joint.add(ring);

    parent = joint;
  }

  const crown = new THREE.Group();
  crown.position.y = segLength;
  parent.add(crown);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), matFrond);
  crown.add(cap);

  for (let i = 0; i < frondCount; i++) {
    const frondPivot = new THREE.Group();
    frondPivot.rotation.y = (i / frondCount) * Math.PI * 2 + (i % 2) * 0.2;
    crown.add(frondPivot);

    const droop = 0.35 + (i % 3) * 0.12;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.24, frondLength, 4), matFrond);
    frond.scale.set(0.2, 1, 1);                // flatten into a leaf blade
    frond.rotation.z = -Math.PI / 2 - droop;   // point outward and droop down
    frond.position.set(
      (frondLength / 2) * Math.cos(droop),
      -(frondLength / 2) * Math.sin(droop),
      0
    );
    frondPivot.add(frond);
  }

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), matCoconut);
    coconut.position.set(Math.cos(a) * 0.13, -0.13, Math.sin(a) * 0.13);
    crown.add(coconut);
  }

  return tree;
}

// Find island surface height under (x, z) so trees sit on the ground
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
  // Trunk bends toward local -X; turn the tree so it leans away from the island center
  tree.rotation.y = Math.atan2(z, -x);
  scene.add(tree);
  return tree;
}

placePalm(-3.4, -1.0, { segments: 7, lean: 0.07 });
placePalm(3.8, -0.8, { segments: 7, lean: 0.06 });
placePalm(3.0, 1.6, { segments: 5, lean: 0.09, frondLength: 1.3 });

// Ocean — dense plane with vertices animated by layered sin waves
const WATER_SIZE = 160;
const waterGeo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, 200, 200);
waterGeo.rotateX(-Math.PI / 2); // lay flat in XZ so Y is wave height
const waterBase = waterGeo.attributes.position.array.slice();

const water = new THREE.Mesh(
  waterGeo,
  new THREE.MeshStandardMaterial({
    color: 0x1e88d6,
    flatShading: true,
    transparent: true,
    opacity: 0.82,
    roughness: 0.35,
    metalness: 0.1,
  })
);
scene.add(water);

// Deep seafloor so the water reads as dark blue away from the island
const seafloor = new THREE.Mesh(
  new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE),
  new THREE.MeshBasicMaterial({ color: 0x0b3d6b })
);
seafloor.rotation.x = -Math.PI / 2;
seafloor.position.y = -3;
scene.add(seafloor);

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

// Resize + render loop
function onResize() {
  aspect = window.innerWidth / window.innerHeight;
  camera.left = (-FRUSTUM * aspect) / 2;
  camera.right = (FRUSTUM * aspect) / 2;
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
