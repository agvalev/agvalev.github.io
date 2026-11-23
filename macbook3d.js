// Realistic MacBook built in Three.js. The screen is a real DOM element placed on the
// lid with CSS3DRenderer, so its text stays crisp at any zoom. script.js drives it.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";

// Dimensions in centimetres, close to a 14" MacBook Pro.
const DIM = {
  W: 31.2,    // width
  D: 22.0,    // base depth
  BH: 0.95,   // base thickness
  LT: 0.5,    // lid thickness
  LD: 21.4,   // lid height
  SW: 29.6,   // display width
  SH: 18.9,   // display height
  SY: 11.15   // display centre, measured up the lid from the hinge
};
const SCREEN_PX = { w: 1184, h: 756 };

const KEY_ROWS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.8],
  [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.3],
  [1, 1, 1, 1.25, 5.1, 1.25, 1, 1, 1, 1]
];

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function plate(w, h, r, mat) {
  return new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w, h, r), 10), mat);
}
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createMacbook(host, screenEl, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure || 1.1;
  renderer.domElement.className = "mb3d__gl";
  host.appendChild(renderer.domElement);

  const css = new CSS3DRenderer();
  css.domElement.className = "mb3d__css";
  host.appendChild(css.domElement);

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(opts.fov || 26, 1, 0.5, 3000);
  const { W, D, BH, LT, LD, SW, SH, SY } = DIM;

  // ----- materials
  const alu = new THREE.MeshPhysicalMaterial({
    color: opts.color || 0x2b2b2f, metalness: 0.94, roughness: 0.3,
    clearcoat: 0.35, clearcoatRoughness: 0.28, envMapIntensity: 0.62
  });
  const well = new THREE.MeshStandardMaterial({ color: 0x070708, roughness: 0.9, metalness: 0.05 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.45, metalness: 0.12, envMapIntensity: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x040405, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5
  });
  const padMat = new THREE.MeshPhysicalMaterial({
    color: 0x2f2f33, metalness: 0.55, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.6
  });
  const hingeMat = new THREE.MeshPhysicalMaterial({ color: 0x18181a, metalness: 0.7, roughness: 0.4 });

  const root = new THREE.Group();
  scene.add(root);

  // ----- base
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, BH, D, 6, 0.44), alu);
  base.position.y = BH / 2;
  root.add(base);

  const wellW = 27.2, wellD = 11.4, wellZ = -D / 2 + 1.9 + wellD / 2;
  const wellMesh = plate(wellW, wellD, 0.55, well);
  wellMesh.rotation.x = -Math.PI / 2;
  wellMesh.position.set(0, BH + 0.003, wellZ);
  root.add(wellMesh);

  // keys: one instanced rounded box, scaled per key
  const keyCount = KEY_ROWS.reduce((n, r) => n + r.length, 0);
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 0.16, 1, 2, 0.07), keyMat, keyCount);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const rowW = wellW - 0.9, gap = 0.19;
  let z = wellZ - wellD / 2 + 0.5, idx = 0;
  KEY_ROWS.forEach((row, ri) => {
    const depth = ri === 0 ? 0.95 : 1.6;
    const total = row.reduce((a, b) => a + b, 0);
    const unit = (rowW - gap * (row.length - 1)) / total;
    let x = -rowW / 2;
    row.forEach((u) => {
      const w = u * unit;
      m.compose(new THREE.Vector3(x + w / 2, BH + 0.085, z + depth / 2), q, new THREE.Vector3(w, 1, depth));
      keys.setMatrixAt(idx++, m);
      x += w + gap;
    });
    z += depth + gap;
  });
  root.add(keys);

  // speaker grilles either side of the keyboard
  const grille = canvasTexture(64, 640, (g, w, h) => {
    g.fillStyle = "#000";
    for (let y = 6; y < h; y += 9) for (let x = 6 + ((y / 9) % 2) * 4; x < w; x += 9) {
      g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.fill();
    }
  });
  const grilleMat = new THREE.MeshBasicMaterial({ map: grille, transparent: true, opacity: 0.7, depthWrite: false });
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, wellD), grilleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(s * (wellW / 2 + 0.95), BH + 0.003, wellZ);
    root.add(p);
  });

  // glass trackpad
  const pad = plate(13.4, 8.3, 0.5, padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, BH + 0.003, D / 2 - 5.45);
  root.add(pad);

  // hinge barrel
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, W - 6.5, 32), hingeMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, BH + 0.02, -D / 2 + 0.45);
  root.add(hinge);

  // ----- lid, pivoting on the hinge
  const lid = new THREE.Group();
  lid.position.set(0, BH + 0.03, -D / 2 + 0.45);
  root.add(lid);

  const shell = new THREE.Mesh(new RoundedBoxGeometry(W, LD, LT, 6, 0.22), alu);
  shell.position.set(0, LD / 2, -LT / 2);
  lid.add(shell);

  const bezel = plate(W - 0.34, LD - 0.34, 0.55, glass);
  bezel.position.set(0, LD / 2, 0.004);
  lid.add(bezel);

  const panel = plate(SW, SH, 0.3, new THREE.MeshBasicMaterial({ color: 0x000000 }));
  panel.position.set(0, SY, 0.008);
  lid.add(panel);

  // engraved monogram on the back of the lid (reads correctly when the laptop is closed)
  const logoTex = canvasTexture(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = "italic 500 170px 'Cormorant Garamond', Georgia, serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    const grad = g.createLinearGradient(0, 40, 0, h - 40);
    grad.addColorStop(0, "#f3dfb4"); grad.addColorStop(1, "#b8955a");
    g.fillStyle = grad;
    g.fillText("AV", w / 2, h / 2 + 8);
  });
  if (document.fonts && document.fonts.load) {
    document.fonts.load("italic 500 170px 'Cormorant Garamond'").then(() => {
      const c = logoTex.image, g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      g.font = "italic 500 170px 'Cormorant Garamond', Georgia, serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      const grad = g.createLinearGradient(0, 40, 0, c.height - 40);
      grad.addColorStop(0, "#f3dfb4"); grad.addColorStop(1, "#b8955a");
      g.fillStyle = grad;
      g.fillText("AV", c.width / 2, c.height / 2 + 8);
      logoTex.needsUpdate = true;
    }).catch(() => {});
  }
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), new THREE.MeshPhysicalMaterial({
    map: logoTex, transparent: true, metalness: 0.85, roughness: 0.22, clearcoat: 1, envMapIntensity: 1.3
  }));
  logo.position.set(0, LD / 2 + 0.6, -LT - 0.004);
  logo.rotation.set(0, Math.PI, Math.PI);
  lid.add(logo);

  // soft contact shadow
  const shadowTex = canvasTexture(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(0,0,0,0.8)");
    gr.addColorStop(0.5, "rgba(0,0,0,0.42)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.55, D * 1.75),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.03;
  root.add(shadow);

  // ----- lights: soft environment reflections, warm key, gold rim, cool fill
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));
  const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.7);
  keyLight.position.set(20, 42, 30);
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xe0bd7e, 2.6);
  rim.position.set(-34, 22, -42);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9cc4ff, 0.45);
  fill.position.set(-30, 8, 34);
  scene.add(fill);

  // ----- DOM screen glued to the lid
  const anchor = new THREE.Object3D();
  anchor.position.set(0, SY, 0.012);
  lid.add(anchor);
  screenEl.style.width = SCREEN_PX.w + "px";
  screenEl.style.height = SCREEN_PX.h + "px";
  screenEl.style.setProperty("--w", SCREEN_PX.w / 0.958 + "px");
  screenEl.style.backfaceVisibility = "hidden";
  const cssObj = new CSS3DObject(screenEl);
  cssObj.matrixAutoUpdate = false;
  cssScene.add(cssObj);
  const pxScale = SW / SCREEN_PX.w;
  const scaleM = new THREE.Matrix4().makeScale(pxScale, pxScale, pxScale);

  function resize() {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h);
    css.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const tmpQ = new THREE.Quaternion();
  function screenInfo(lidAngle) {
    if (lidAngle != null) lid.rotation.x = lidAngle;
    root.updateMatrixWorld(true);
    const pos = new THREE.Vector3().setFromMatrixPosition(anchor.matrixWorld);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(anchor.getWorldQuaternion(tmpQ));
    return { pos, n };
  }
  // camera distance at which the display just covers the whole viewport
  function coverDistance() {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return Math.min((SH / 2) / t, (SW / 2) / (t * camera.aspect));
  }

  const target = new THREE.Vector3();
  // state: { lid: radians (≈1.56 closed … -0.3 open), pos: Vector3-like, look: Vector3-like, rotY }
  function render(state) {
    lid.rotation.x = state.lid;
    root.rotation.y = state.rotY || 0;
    camera.position.set(state.pos.x, state.pos.y, state.pos.z);
    target.set(state.look.x, state.look.y, state.look.z);
    camera.lookAt(target);
    root.updateMatrixWorld(true);
    cssObj.matrix.copy(anchor.matrixWorld).multiply(scaleM);
    cssObj.matrixWorldNeedsUpdate = true;
    screenEl.style.visibility = state.lid > 1.25 ? "hidden" : "visible";
    renderer.render(scene, camera);
    css.render(cssScene, camera);
  }

  return { render, resize, screenInfo, coverDistance, camera, DIM };
}

window.MacBook3D = { createMacbook };
window.dispatchEvent(new Event("macbook3d-ready"));
