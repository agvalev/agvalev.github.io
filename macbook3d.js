// Photorealistic MacBook Pro 14" built in Three.js. The screen is a real DOM element placed
// on the lid with CSS3DRenderer, so its text stays crisp at any zoom. script.js drives it.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

RectAreaLightUniformsLib.init();

// Studio HDRI (Poly Haven, CC0) for realistic reflections on the aluminium.
const HDRI = "https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/studio_small_03_1k.hdr";

// Real dimensions in centimetres (MacBook Pro 14", 2021+).
const DIM = {
  W: 31.26,   // width
  D: 22.12,   // base depth
  BH: 0.98,   // base thickness
  LT: 0.57,   // lid thickness
  LD: 21.66,  // lid height (hinge → top edge)
  R: 1.05,    // corner radius seen from above
  SW: 30.1,   // display width
  SH: 19.25,  // display height
  SY: 11.48   // display centre, measured up the lid from the hinge
};
const SCREEN_PX = { w: 1200, h: 767 };

// the HDRI is downloaded once and shared by every scene on the page (a texture can feed several renderers)
let hdriPromise = null;
function loadHdri() {
  if (!hdriPromise) hdriPromise = new Promise((resolve) => new RGBELoader().load(HDRI, resolve));
  return hdriPromise;
}
// phones: keep GPU memory low — fewer pixels per 3D frame
const MAX_DPR = window.innerWidth <= 860 ? 1.5 : 2;

// MacBook Pro keyboard. Each key: [width in units, legend, style].
// styles: c = centred letter, s = small label bottom-left, r = small label bottom-right, t = Touch ID, h = half-height arrow
const ROWS = [
  [[1.55, "esc", "s"], [1, "F1", "c"], [1, "F2", "c"], [1, "F3", "c"], [1, "F4", "c"], [1, "F5", "c"], [1, "F6", "c"],
   [1, "F7", "c"], [1, "F8", "c"], [1, "F9", "c"], [1, "F10", "c"], [1, "F11", "c"], [1, "F12", "c"], [0.95, "", "t"]],
  [[1, "`", "c"], [1, "1", "c"], [1, "2", "c"], [1, "3", "c"], [1, "4", "c"], [1, "5", "c"], [1, "6", "c"], [1, "7", "c"],
   [1, "8", "c"], [1, "9", "c"], [1, "0", "c"], [1, "-", "c"], [1, "=", "c"], [1.5, "delete", "r"]],
  [[1.5, "tab", "s"], [1, "Q", "c"], [1, "W", "c"], [1, "E", "c"], [1, "R", "c"], [1, "T", "c"], [1, "Y", "c"], [1, "U", "c"],
   [1, "I", "c"], [1, "O", "c"], [1, "P", "c"], [1, "[", "c"], [1, "]", "c"], [1, "\\", "c"]],
  [[1.8, "caps lock", "s"], [1, "A", "c"], [1, "S", "c"], [1, "D", "c"], [1, "F", "c"], [1, "G", "c"], [1, "H", "c"],
   [1, "J", "c"], [1, "K", "c"], [1, "L", "c"], [1, ";", "c"], [1, "'", "c"], [1.7, "return", "r"]],
  [[2.3, "shift", "s"], [1, "Z", "c"], [1, "X", "c"], [1, "C", "c"], [1, "V", "c"], [1, "B", "c"], [1, "N", "c"],
   [1, "M", "c"], [1, ",", "c"], [1, ".", "c"], [1, "/", "c"], [2.2, "shift", "r"]],
  [[1, "fn", "s"], [1, "control", "s"], [1, "option", "s"], [1.25, "command", "s"], [5.0, "", "c"], [1.25, "command", "s"],
   [1, "option", "s"], [1, "◀", "h"], [1, "▲▼", "v"], [1, "▶", "h"]]
];

function roundedRect(w, h, r, rTop) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2, rt = rTop == null ? r : rTop;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - rt); s.quadraticCurveTo(x + w, y + h, x + w - rt, y + h);
  s.lineTo(x + rt, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rt);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function plate(w, h, r, mat, rTop) {
  return new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w, h, r, rTop), 12), mat);
}
// slab with large plan-view corners and a small edge fillet, like milled aluminium
function slab(w, h, depth, r, fillet) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * fillet, h - 2 * fillet, r - fillet), {
    depth: depth - 2 * fillet, bevelEnabled: true, bevelThickness: fillet, bevelSize: fillet,
    bevelSegments: 10, curveSegments: 32
  });
  g.translate(0, 0, fillet);
  return g;
}
function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (!opts.linear) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function createMacbook(host, screenEl, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = opts.exposure || 0.9;
  renderer.domElement.className = "mb3d__gl";
  host.appendChild(renderer.domElement);

  const css = new CSS3DRenderer();
  css.domElement.className = "mb3d__css";
  host.appendChild(css.domElement);

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // neutral studio first, the real HDRI replaces it once downloaded
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  loadHdri().then((hdr) => {
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    if (opts.onNeedsRender) opts.onNeedsRender();
  });

  const camera = new THREE.PerspectiveCamera(opts.fov || 24, 1, 0.5, 4000);
  const size = { w: 1, h: 1 };
  const { W, D, BH, LT, LD, R, SW, SH, SY } = DIM;

  // ----- materials
  // The studio HDRI is bright, so reflections are scaled per material to land on real-world values.
  // bead-blasted grain: fine noise in the roughness, so reflections break up like real anodised metal
  const grain = canvasTexture(512, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    let seed = 7;
    for (let i = 0; i < w * h; i++) {
      seed = (seed * 16807) % 2147483647;
      const v = 150 + ((seed / 2147483647) - 0.5) * 70;   // around 0.59 roughness, ±0.14
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { linear: true });
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(0.45, 0.45);       // geometry UVs are in centimetres
  const alu = new THREE.MeshStandardMaterial({   // space grey, bead-blasted anodised aluminium
    color: 0x46474c, metalness: 1, roughness: 0.62, roughnessMap: grain, envMapIntensity: 0.22
  });
  const aluEdge = alu.clone();
  const wellMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, metalness: 0, envMapIntensity: 0.06 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x070708, roughness: 0.82, metalness: 0, envMapIntensity: 0.035 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.55 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x3f4045, metalness: 0.95, roughness: 0.34, envMapIntensity: 0.2 });
  const portMat = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.8 });
  const hingeMat = new THREE.MeshPhysicalMaterial({ color: 0x0e0e10, metalness: 0.5, roughness: 0.45 });

  const root = new THREE.Group();
  scene.add(root);
  // everything that sits on the top case (keyboard, trackpad, grilles, ports) — lifts off in the exploded view
  const deck = new THREE.Group();
  root.add(deck);

  // ----- base
  const baseGeo = slab(W, D, BH, R, 0.14);
  baseGeo.rotateX(-Math.PI / 2);           // extrusion now points up (+y)
  const base = new THREE.Mesh(baseGeo, alu);
  root.add(base);

  // keyboard well and keys
  const kbW = 27.2, rowPitch = 1.78, keyD = 1.6, gap = 0.19;
  const wellW = kbW + 0.55, wellD = ROWS.length * rowPitch + 0.42;
  const wellZ = -D / 2 + 1.15 + wellD / 2;
  const well = plate(wellW, wellD, 0.45, wellMat);
  well.rotation.x = -Math.PI / 2;
  well.position.set(0, BH + 0.006, wellZ);
  deck.add(well);

  const keyTop = BH + 0.13;
  const keySlots = [];
  ROWS.forEach((row, ri) => {
    const total = row.reduce((a, k) => a + k[0], 0);
    const unit = (kbW - gap * (row.length - 1)) / total;
    let x = -kbW / 2;
    const zc = wellZ - wellD / 2 + 0.21 + ri * rowPitch + keyD / 2;
    row.forEach((k) => {
      const w = k[0] * unit;
      if (k[2] === "v") {        // up/down arrows stacked
        keySlots.push({ x: x + w / 2, z: zc - keyD / 4 - 0.02, w, d: keyD / 2 - 0.04, label: "▲", style: "a" });
        keySlots.push({ x: x + w / 2, z: zc + keyD / 4 + 0.02, w, d: keyD / 2 - 0.04, label: "▼", style: "a" });
      } else if (k[2] === "h") { // left/right arrows are half height
        keySlots.push({ x: x + w / 2, z: zc + keyD / 4 + 0.02, w, d: keyD / 2 - 0.04, label: k[1], style: "a" });
      } else {
        keySlots.push({ x: x + w / 2, z: zc, w, d: keyD, label: k[1], style: k[2] });
      }
      x += w + gap;
    });
  });
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 0.12, 1, 3, 0.05), keyMat, keySlots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  keySlots.forEach((k, i) => {
    m.compose(new THREE.Vector3(k.x, BH + 0.07, k.z), q, new THREE.Vector3(k.w, 1, k.d));
    keys.setMatrixAt(i, m);
  });
  deck.add(keys);

  // printed legends on top of the keys (one texture for the whole keyboard)
  const legendPx = 120; // pixels per cm
  const legend = canvasTexture(Math.round(wellW * legendPx), Math.round(wellD * legendPx), (g, cw, ch) => {
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = "rgba(226, 226, 230, 0.88)";
    g.strokeStyle = "rgba(226, 226, 230, 0.55)";
    const font = "-apple-system, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";
    keySlots.forEach((k) => {
      if (!k.label && k.style !== "t") return;
      const cx = (k.x + wellW / 2) * legendPx, cz = (k.z - (wellZ - wellD / 2)) * legendPx;
      const hw = k.w * legendPx / 2, hd = k.d * legendPx / 2;
      if (k.style === "t") {       // Touch ID ring
        g.lineWidth = 3;
        roundRectPath(g, cx - hw + 10, cz - hd + 10, hw * 2 - 20, hd * 2 - 20, 22);
        g.stroke();
        return;
      }
      if (k.style === "c") {
        const big = k.label.length === 1;
        g.font = (big ? "500 " + legendPx * 0.42 : "500 " + legendPx * 0.2) + "px " + font;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(k.label, cx, cz + (big ? 2 : 0));
      } else if (k.style === "a") {
        g.font = "500 " + legendPx * 0.2 + "px " + font;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(k.label, cx, cz);
      } else {
        g.font = "500 " + legendPx * 0.17 + "px " + font;
        g.textBaseline = "alphabetic";
        g.textAlign = k.style === "r" ? "right" : "left";
        g.fillText(k.label, k.style === "r" ? cx + hw - 14 : cx - hw + 14, cz + hd - 16);
      }
    });
  });
  const legendPlane = new THREE.Mesh(new THREE.PlaneGeometry(wellW, wellD),
    new THREE.MeshBasicMaterial({ map: legend, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.8 }));
  legendPlane.rotation.x = -Math.PI / 2;
  legendPlane.position.set(0, keyTop + 0.003, wellZ);
  deck.add(legendPlane);

  // perforated speaker grilles either side of the keyboard
  const grille = canvasTexture(96, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#000";
    for (let y = 5, row = 0; y < h; y += 7.2, row++) {
      for (let x = 5 + (row % 2) * 3.6; x < w - 3; x += 7.2) { g.beginPath(); g.arc(x, y, 1.75, 0, Math.PI * 2); g.fill(); }
    }
  });
  const grilleMat = new THREE.MeshBasicMaterial({ map: grille, transparent: true, opacity: 0.9, depthWrite: false });
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.25, wellD - 0.2), grilleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(s * (wellW / 2 + (W / 2 - wellW / 2) / 2), BH + 0.006, wellZ);
    deck.add(p);
  });

  // glass trackpad
  const padD = 8.0, padZ = wellZ + wellD / 2 + 1.05 + padD / 2;
  const padGap = plate(13.8 + 0.1, padD + 0.1, 0.5, new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.85, metalness: 0, envMapIntensity: 0.1 }));
  padGap.rotation.x = -Math.PI / 2;
  padGap.position.set(0, BH + 0.006, wellZ + wellD / 2 + 1.05 + padD / 2);
  deck.add(padGap);
  const pad = plate(13.8, padD, 0.45, padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, BH + 0.014, padZ);
  deck.add(pad);

  // flush layers on the deck: bias their depth so they never flicker against the aluminium at a distance
  [well, padGap, pad].forEach((m, i) => {
    m.material.polygonOffset = true;
    m.material.polygonOffsetFactor = -1;
    m.material.polygonOffsetUnits = -4 - 4 * i;
  });
  grilleMat.polygonOffset = true; grilleMat.polygonOffsetFactor = -1; grilleMat.polygonOffsetUnits = -6;

  // thumb scoop on the front edge
  const scoop = canvasTexture(256, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, w / 2);
    gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const scoopMesh = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.5),
    new THREE.MeshBasicMaterial({ map: scoop, transparent: true, depthWrite: false }));
  scoopMesh.rotation.x = -Math.PI / 2;
  scoopMesh.position.set(0, BH + 0.006, D / 2 - 0.4);
  deck.add(scoopMesh);

  // ports on the sides: MagSafe, Thunderbolt ×2, headphone (left) · HDMI, Thunderbolt, SD (right)
  const ports = [
    [-1, -6.6, 1.05, 0.32, 0.16], [-1, -4.4, 0.86, 0.3, 0.15], [-1, -2.6, 0.86, 0.3, 0.15], [-1, 7.9, 0.36, 0.36, 0.18],
    [1, -5.8, 1.45, 0.42, 0.06], [1, -3.4, 0.86, 0.3, 0.15], [1, 5.6, 2.4, 0.18, 0.05]
  ];
  ports.forEach(([side, z, w, h, r]) => {
    const p = plate(w, h, r, portMat);
    p.rotation.y = side * Math.PI / 2;
    p.position.set(side * (W / 2 + 0.003), BH / 2, z);
    deck.add(p);
  });

  // hinge barrel
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, W - 5.6, 40), hingeMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, BH + 0.03, -D / 2 + 0.5);
  deck.add(hinge);

  // ----- lid, pivoting on the hinge
  const lid = new THREE.Group();
  lid.position.set(0, BH + 0.035, -D / 2 + 0.46);
  root.add(lid);

  const shellGeo = slab(W, LD, LT, R, 0.13);
  shellGeo.translate(0, LD / 2, -LT);       // bottom edge on the hinge, front face at z = 0
  const shell = new THREE.Mesh(shellGeo, aluEdge);
  lid.add(shell);

  const bezel = plate(W - 0.3, LD - 0.3, R - 0.15, glass);
  bezel.position.set(0, LD / 2, 0.004);
  lid.add(bezel);

  const panel = plate(SW, SH, 0.18, new THREE.MeshBasicMaterial({ color: 0x000000 }), 0.75);
  panel.position.set(0, SY, 0.007);
  lid.add(panel);

  // polished monogram on the back of the lid (mirror finish on bead-blasted metal)
  const logoTex = canvasTexture(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = "italic 600 300px 'Cormorant Garamond', Georgia, serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText("AV", w / 2, h / 2 + 10);
  }, { linear: true });
  const drawLogo = () => {
    const c = logoTex.image, g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    g.font = "italic 600 300px 'Cormorant Garamond', Georgia, serif";
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff";
    g.fillText("AV", c.width / 2, c.height / 2 + 10);
    logoTex.needsUpdate = true;
    if (opts.onNeedsRender) opts.onNeedsRender();
  };
  if (document.fonts && document.fonts.load) document.fonts.load("italic 600 300px 'Cormorant Garamond'").then(drawLogo).catch(() => {});
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), new THREE.MeshPhysicalMaterial({
    color: 0x9a9ba0, metalness: 1, roughness: 0.08, alphaMap: logoTex, transparent: true, envMapIntensity: 0.7
  }));
  logo.position.set(0, LD / 2 + 0.4, -LT - 0.004);
  logo.rotation.set(0, Math.PI, Math.PI);
  lid.add(logo);

  // ----- soft contact shadow: stacked rounded rects give a blur that works in every browser
  const shadowTex = canvasTexture(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const fw = w * 0.64, fh = h * 0.6;
    for (let i = 0; i < 40; i++) {
      const e = i * 2.6;
      g.fillStyle = "rgba(0,0,0," + (0.05 * (1 - i / 40)).toFixed(3) + ")";
      roundRectPath(g, (w - fw) / 2 - e, (h - fh) / 2 - e, fw + 2 * e, fh + 2 * e, 22 + e);
      g.fill();
    }
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W / 0.64, D / 0.6),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.95 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.02;
  root.add(shadow);

  // the live DOM screen sits on this point of the lid
  const anchor = new THREE.Object3D();
  anchor.position.set(0, SY, 0.012);
  lid.add(anchor);

  // ----- internals for the exploded "what's inside" view (only when asked for)
  // Every part is a "piece": it starts where it sits in the assembled laptop and travels by `to`
  // during its own slice [a, b] of the explode, so the laptop comes apart one part after another.
  const anchors = {};          // name → { obj, v }: points the page attaches HUD callouts to
  const fanBlades = [];
  const pieces = [];
  const onlyExploded = [];      // layers that only exist in the exploded view (hidden inside the closed shell)
  let internals = null, explodeExtras = () => {};
  const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
  const piece = (obj, to, a, b, extra) => {
    const p = Object.assign({ obj, home: obj.position.clone(), to: new THREE.Vector3(...to), a, b }, extra || {});
    pieces.push(p);
    return p;
  };
  if (opts.internals) {
    const TRAY = 0.42;
    internals = new THREE.Group();
    internals.visible = false;
    root.add(internals);
    const add = (o) => { internals.add(o); return o; };
    const steel = new THREE.MeshStandardMaterial({ color: 0x8c8d92, metalness: 1, roughness: 0.3, envMapIntensity: 0.5 });
    const screwGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 18);
    const screwShaft = new THREE.CylinderGeometry(0.07, 0.07, 0.42, 10);
    const makeScrew = () => {
      const s = new THREE.Group();
      s.add(new THREE.Mesh(screwGeo, steel));
      const shaft = new THREE.Mesh(screwShaft, steel);
      shaft.position.y = -0.24;
      s.add(shaft);
      return s;
    };

    // --- bottom case: a milled tray (floor + rim), rubber feet and torx screws
    const tray = add(new THREE.Group());
    const rimShape = roundedRect(W - 0.28, D - 0.28, R - 0.14);
    rimShape.holes.push(roundedRect(W - 1.1, D - 1.1, R - 0.5));
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: TRAY - 0.12, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 4, curveSegments: 24 });
    rimGeo.translate(0, 0, 0.12);
    rimGeo.rotateX(-Math.PI / 2);
    tray.add(new THREE.Mesh(rimGeo, alu));
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3f, metalness: 1, roughness: 0.55, roughnessMap: grain, envMapIntensity: 0.18 });
    const floor = plate(W - 0.9, D - 0.9, R - 0.4, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.06;
    tray.add(floor);
    // milled ribs on the floor
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x414247, metalness: 1, roughness: 0.5, envMapIntensity: 0.2 });
    [[-7.6, 0.9, 0.12, 15], [7.6, 0.9, 0.12, 15], [0, -2.2, 26, 0.12]].forEach(([x, z, w, d]) => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), ribMat);
      rib.position.set(x, 0.11, z);
      tray.add(rib);
    });
    piece(tray, [0, -3.4, 11], 0.34, 0.86);

    const footMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.92, metalness: 0 });
    [[-12.9, -8.6], [12.9, -8.6], [-12.9, 8.6], [12.9, 8.6]].forEach(([x, z], i) => {
      const foot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.14, 32), footMat));
      foot.position.set(x, -0.07, z);
      piece(foot, [0, -5.2, 11], 0.4 + i * 0.02, 0.9);
    });
    [[-13.6, -9.3], [-4.5, -9.6], [4.5, -9.6], [13.6, -9.3], [-14.4, 0], [14.4, 0], [-13.6, 9.4], [13.6, 9.4]].forEach(([x, z], i) => {
      const sc = add(makeScrew());
      sc.rotation.x = Math.PI;             // they go in from underneath
      sc.position.set(x, -0.04, z);
      piece(sc, [0, -6.6, 11], 0.36 + i * 0.018, 0.86, { spin: -9 });
    });

    // --- battery: three large cells in black foil with printed labels
    const cellMat = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, metalness: 0.4, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.35 });
    const cellLabel = (text) => canvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = "#0c0c0e"; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(255,255,255,.65)";
      g.font = "600 30px -apple-system, 'Segoe UI', Arial, sans-serif";
      g.fillText(text, 26, 60);
      g.font = "400 20px -apple-system, 'Segoe UI', Arial, sans-serif";
      g.fillStyle = "rgba(255,255,255,.4)";
      g.fillText("Li-Polymer · 11.4 V", 26, 96);
      g.fillText("Do not puncture · Recycle", 26, 124);
      g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 2; g.strokeRect(26, 150, 90, 60);
    });
    const labelTex = cellLabel("TESTED · 80%+");
    [-8.0, 0, 8.0].forEach((x, i) => {
      const cell = add(new THREE.Group());
      cell.position.set(x, 0.25, 5.2);
      cell.add(new THREE.Mesh(new RoundedBoxGeometry(7.6, 0.38, 6.6, 3, 0.12), cellMat));
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false }));
      lab.rotation.x = -Math.PI / 2;
      lab.position.set(-1.6, 0.195, -1.4);
      cell.add(lab);
      piece(cell, [0, 1.3, 7], 0.28 + i * 0.035, 0.78 + i * 0.035);
      if (i === 1) anchors.battery = { obj: cell, v: new THREE.Vector3(0, 0.2, 0) };
    });

    // --- speakers: two long modules either side of the battery
    const spkMat = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.3 });
    const spkGrille = new THREE.MeshBasicMaterial({ map: grille, transparent: true, opacity: 0.85, depthWrite: false });
    [-1, 1].forEach((s) => {
      const spk = add(new THREE.Group());
      spk.position.set(s * 13.3, 0.3, 0.6);
      spk.add(new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.44, 7.4, 3, 0.14), spkMat));
      const top = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 6.4), spkGrille);
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.225;
      spk.add(top);
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 10, 40), new THREE.MeshStandardMaterial({ color: 0xc9a05c, metalness: 1, roughness: 0.3, envMapIntensity: 0.6 }));
      coil.rotation.x = Math.PI / 2;
      coil.position.set(0, 0.23, 2.6);
      spk.add(coil);
      piece(spk, [s * 3.2, 2.6, 5], 0.3, 0.82);
    });

    // --- logic board: black PCB with gold traces, fan housings, chips, heat pipes, screws
    const board = add(new THREE.Group());
    const boardTo = [0, 4.8, 0.5];
    const pcbTex = canvasTexture(2048, 1024, (g, w, h) => {
      g.fillStyle = "#0a0d0c"; g.fillRect(0, 0, w, h);
      let seed = 3;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 420; i++) {          // traces: short orthogonal runs with a 45° bend
        let x = rnd() * w, y = rnd() * h;
        g.strokeStyle = "rgba(201,160,92," + (0.16 + rnd() * 0.22).toFixed(2) + ")";
        g.lineWidth = 1.5 + rnd() * 2.5;
        g.beginPath(); g.moveTo(x, y);
        const len = 40 + rnd() * 260, horiz = rnd() > 0.5;
        x += horiz ? len : 0; y += horiz ? 0 : len; g.lineTo(x, y);
        const d = 20 + rnd() * 60; g.lineTo(x + d, y + d);
        g.stroke();
      }
      for (let i = 0; i < 900; i++) {          // vias
        g.fillStyle = "rgba(214,178,112,.55)";
        g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 2.5, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = "rgba(255,255,255,.28)";       // silkscreen
      g.font = "500 22px 'JetBrains Mono', Consolas, monospace";
      ["AV-820-02021", "LOGIC BOARD REV 3", "J4501", "U9000", "C2207", "R7130"].forEach((t, i) => g.fillText(t, 60 + i * 320, 60 + (i % 2) * 900));
    });
    // extrude caps use shape coordinates as UVs: map the 19.5 × 9.2 board onto the texture
    pcbTex.repeat.set(1 / 19.5, 1 / 9.2);
    pcbTex.offset.set(0.5, 0.5);
    const pcbMat = new THREE.MeshStandardMaterial({ map: pcbTex, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.14 });
    const pcb = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(19.5, 9.2, 0.6), { depth: 0.12, bevelEnabled: false }), [pcbMat, new THREE.MeshStandardMaterial({ color: 0x14231c, roughness: 0.6 })]);
    pcb.rotation.x = -Math.PI / 2;
    pcb.position.set(0, 0.5, -4.7);
    board.add(pcb);
    const boardY = 0.62;
    piece(board, boardTo, 0.2, 0.74);

    // chips: black epoxy packages with laser-etched labels; the SoC wears a polished heat spreader.
    // Each one lifts off the board on its own.
    const chipLabel = (title, sub, big) => canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = big ? "#1b1c1f" : "#0b0b0c"; g.fillRect(0, 0, w, h);
      if (big) { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "rgba(255,255,255,.10)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      g.fillStyle = "rgba(220,220,225,.78)";
      g.textAlign = "center";
      g.font = (big ? "600 92px" : "600 64px") + " -apple-system, 'Segoe UI', Arial, sans-serif";
      g.fillText(title, w / 2, h / 2 + (big ? 10 : 8));
      g.font = "400 30px 'JetBrains Mono', Consolas, monospace";
      g.fillStyle = "rgba(220,220,225,.42)";
      g.fillText(sub, w / 2, h / 2 + (big ? 74 : 60));
      g.beginPath(); g.arc(44, 44, 12, 0, Math.PI * 2); g.fill();   // pin-1 dot
    });
    const chips = [
      { id: "python", x: 0, z: -5.6, w: 4.2, d: 4.2, h: 0.32, title: "Python", sub: "SoC · 3.12", big: true },
      { id: "fastapi", x: -4.4, z: -6.9, w: 2.4, d: 1.9, h: 0.16, title: "FastAPI", sub: "REST · OpenAPI" },
      { id: "django", x: -4.4, z: -4.2, w: 2.4, d: 1.9, h: 0.16, title: "Django", sub: "ORM · admin" },
      { id: "postgres", x: 4.4, z: -6.9, w: 2.4, d: 1.9, h: 0.16, title: "PostgreSQL", sub: "DATA · SQL" },
      { id: "docker", x: 4.4, z: -4.2, w: 2.4, d: 1.9, h: 0.16, title: "Docker", sub: "COMPOSE" },
      { id: "linux", x: -7.4, z: -5.5, w: 1.5, d: 1.5, h: 0.14, title: "Linux", sub: "x86 · arm" },
      { id: "actions", x: 7.4, z: -5.5, w: 1.5, d: 1.5, h: 0.14, title: "CI", sub: "Actions" }
    ];
    const padM = new THREE.MeshStandardMaterial({ color: 0xc9a05c, metalness: 1, roughness: 0.3, envMapIntensity: 0.6 });
    const padGeo = new THREE.BoxGeometry(0.1, 0.04, 0.22);
    chips.forEach((c, i) => {
      const tex = chipLabel(c.title, c.sub, c.big);
      const top = c.big
        ? new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.85, roughness: 0.22, clearcoat: 0.6, envMapIntensity: 0.6 })
        : new THREE.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.55, envMapIntensity: 0.3 });
      const side = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6 });
      const chip = new THREE.Group();
      chip.position.set(c.x, boardY + c.h / 2, c.z);
      chip.add(new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), [side, side, top, side, side, side]));
      if (!c.big) {          // gold pads along the long edges
        for (let k = 0; k < 8; k++) [-1, 1].forEach((s) => {
          const p = new THREE.Mesh(padGeo, padM);
          p.position.set(-c.w / 2 + 0.25 + k * (c.w - 0.5) / 7, -c.h / 2 + 0.02, s * (c.d / 2 + 0.11));
          chip.add(p);
        });
      }
      board.add(chip);
      piece(chip, [0, c.big ? 2.2 : 1.5, 0], 0.4 + i * 0.03, 0.8 + i * 0.02);
      anchors[c.id] = { obj: chip, v: new THREE.Vector3(0, c.h / 2, 0) };
    });

    // two fans: housings stay on the board, the rotors lift out and spin; copper heat pipes float above
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.4 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.4 });
    const bladeGeo = new THREE.BoxGeometry(1.75, 0.36, 0.05);
    const thermal = new THREE.Group();
    board.add(thermal);
    [-1, 1].forEach((s) => {
      const fx = s * 11.4, fz = -6.2;
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.5, 48, 1, true), fanMat);
      housing.position.set(fx, boardY + 0.15, fz);
      board.add(housing);
      const basePlate = new THREE.Mesh(new THREE.CircleGeometry(2.75, 48), fanMat);
      basePlate.rotation.x = -Math.PI / 2;
      basePlate.position.set(fx, 0.5, fz);
      board.add(basePlate);
      const rotor = new THREE.Group();
      rotor.position.set(fx, boardY + 0.15, fz);
      rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.42, 32), new THREE.MeshPhysicalMaterial({ color: 0x1d1e21, metalness: 0.6, roughness: 0.25, clearcoat: 0.8 })));
      for (let b = 0; b < 31; b++) {
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        const a = (b / 31) * Math.PI * 2;
        blade.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
        blade.rotation.y = -a + 0.5;
        rotor.add(blade);
      }
      board.add(rotor);
      fanBlades.push(rotor);
      piece(rotor, [0, 1.7, 0], 0.42, 0.82);
      if (s > 0) anchors.fans = { obj: rotor, v: new THREE.Vector3(0, 0.3, 0) };
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 1.4, boardY + 0.42, -5.6), new THREE.Vector3(s * 4.6, boardY + 0.42, -8.4),
        new THREE.Vector3(s * 8.4, boardY + 0.42, -8.2), new THREE.Vector3(fx - s * 2.2, boardY + 0.42, fz - 1.4)
      ]), 48, 0.2, 12, false), new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.32, envMapIntensity: 0.7 }));
      pipe.scale.y = 0.6;
      thermal.add(pipe);
    });
    // dozens of tiny SMD parts (capacitors, resistors, inductors) that scatter up off the board like dust
    const SMD = 140;
    const smd = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, envMapIntensity: 0.5 }), SMD);
    smd.frustumCulled = false;
    const smdHome = [];
    {
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const tints = [0xb79b72, 0x121213, 0x121213, 0x8f9096, 0xc9a05c];
      for (let i = 0; i < SMD; i++) {
        let x, z, tries = 0;
        do { x = -9.3 + rnd() * 18.6; z = -9.0 + rnd() * 8.6; tries++; }
        while (tries < 20 && chips.some((c) => Math.abs(x - c.x) < c.w / 2 + 0.3 && Math.abs(z - c.z) < c.d / 2 + 0.4));
        const big = rnd() > 0.85;
        smdHome.push({ x, z, sx: big ? 0.5 : 0.16 + rnd() * 0.12, sy: big ? 0.22 : 0.08, sz: big ? 0.5 : 0.28 + rnd() * 0.1,
          rot: rnd() > 0.5 ? Math.PI / 2 : 0, lift: 0.9 + rnd() * 2.6, a: 0.34 + rnd() * 0.2, tumble: rnd() * 2 - 1 });
        smd.setColorAt(i, new THREE.Color(tints[Math.floor(rnd() * tints.length)]));
      }
    }
    board.add(smd);
    const sm = new THREE.Matrix4(), sq = new THREE.Quaternion(), se = new THREE.Euler(), sp = new THREE.Vector3(), ss3 = new THREE.Vector3();
    const smdUpdate = (t) => {
      smdHome.forEach((h, i) => {
        const l = smoother(THREE.MathUtils.clamp((t - h.a) / 0.4, 0, 1));
        se.set(h.tumble * Math.sin(Math.PI * l) * 0.9, h.rot + h.tumble * l * 1.2, 0);
        sq.setFromEuler(se);
        sp.set(h.x, boardY + h.sy / 2 + h.lift * l, h.z);
        ss3.set(h.sx, h.sy, h.sz);
        sm.compose(sp, sq, ss3);
        smd.setMatrixAt(i, sm);
      });
      smd.instanceMatrix.needsUpdate = true;
    };
    smdUpdate(0);

    // copper plate over the SoC that the pipes start from
    const coldPlate = new THREE.Mesh(new RoundedBoxGeometry(4.6, 0.12, 4.6, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0xc07a45, metalness: 1, roughness: 0.28, envMapIntensity: 0.7 }));
    coldPlate.position.set(0, boardY + 0.26, -5.6);
    thermal.add(coldPlate);
    piece(thermal, [0, 3.6, 0], 0.36, 0.78);
    [[-9.2, -1.6], [-2.6, -1.4], [2.6, -1.4], [9.2, -1.6], [-9.2, -8.6], [9.2, -8.6]].forEach(([x, z], i) => {
      const sc = makeScrew();
      sc.position.set(x, boardY + 0.04, z);
      board.add(sc);
      piece(sc, [0, 5.4, 0], 0.3 + i * 0.02, 0.72, { spin: 8 });
    });

    // --- top case: the aluminium shell under the keyboard (the deck carries keys, trackpad, grilles)
    const topGeo = slab(W, D, BH - TRAY, R, 0.14);
    topGeo.rotateX(-Math.PI / 2);
    const top = add(new THREE.Mesh(topGeo, alu));
    top.position.y = TRAY;
    const deckTo = [0, 12, -13];
    piece(top, deckTo, 0.12, 0.64);
    piece(deck, deckTo, 0.12, 0.64);

    // backlight plate under the keys: warm light bleeding round every keycap
    const glowTex = canvasTexture(Math.round(wellW * 40), Math.round(wellD * 40), (g, cw, ch) => {
      g.fillStyle = "#08080a"; g.fillRect(0, 0, cw, ch);
      g.shadowColor = "rgba(255,206,130,1)"; g.shadowBlur = 7;
      g.strokeStyle = "rgba(255,238,210,.9)"; g.lineWidth = 1.6;
      keySlots.forEach((k) => {
        const x = (k.x - k.w / 2 + wellW / 2) * 40, y = (k.z - k.d / 2 - (wellZ - wellD / 2)) * 40;
        roundRectPath(g, x + 2, y + 2, k.w * 40 - 4, k.d * 40 - 4, 6);
        g.fillStyle = "rgba(255,214,160,.13)"; g.fill();
        g.stroke();
      });
    });
    const glowPlate = plate(wellW, wellD, 0.45, new THREE.MeshBasicMaterial({ map: glowTex, toneMapped: false }));
    glowPlate.rotation.x = -Math.PI / 2;
    glowPlate.position.set(0, BH + 0.03, wellZ);
    glowPlate.visible = false;
    onlyExploded.push(glowPlate);
    deck.add(glowPlate);
    piece(glowPlate, [0, 2.2, 0], 0.2, 0.66);

    // trackpad glass lifts off its well; the hinge barrel floats back toward the lid
    piece(pad, [0, 2.4, 6.5], 0.26, 0.7);
    piece(hinge, [0, 2.4, -4.5], 0.16, 0.6);

    // display: back shell, mini-LED backlight, then the glass with the live screen
    const ledTex = canvasTexture(1024, 660, (g, w, h) => {
      g.fillStyle = "#050506"; g.fillRect(0, 0, w, h);
      for (let y = 10; y < h; y += 20) for (let x = 10; x < w; x += 20) {
        const gr = g.createRadialGradient(x, y, 0, x, y, 9);
        gr.addColorStop(0, "rgba(255,246,232,.95)"); gr.addColorStop(.35, "rgba(255,226,190,.35)"); gr.addColorStop(1, "rgba(255,210,160,0)");
        g.fillStyle = gr; g.fillRect(x - 10, y - 10, 20, 20);
      }
    });
    const backlight = plate(SW, SH, 0.18, new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false }), 0.75);
    backlight.position.set(0, SY, -0.02);
    backlight.visible = false;
    onlyExploded.push(backlight);
    lid.add(backlight);
    piece(backlight, [0, 0, 1.6], 0.3, 0.74);
    piece(panel, [0, 0, 3.2], 0.3, 0.76);
    piece(bezel, [0, 0, 3.2], 0.3, 0.76);
    piece(anchor, [0, 0, 3.2], 0.3, 0.76);
    piece(lid, [0, 18.5, -28], 0.04, 0.56);

    anchors.keyboard = { obj: deck, v: new THREE.Vector3(-6, BH + 0.14, -5) };

    // keycaps rise off the deck one by one in a ripple from the centre, tumbling a little on the way
    const keyHome = keySlots.map((k) => {
      const dist = Math.min(1, Math.hypot(k.x / 14, (k.z - wellZ) / 6) / 1.2);
      return { k, a: 0.14 + 0.24 * dist, spin: (k.x * 7.3 + k.z * 3.1) % 1 };
    });
    const km = new THREE.Matrix4(), kq = new THREE.Quaternion(), ke = new THREE.Euler(), kp = new THREE.Vector3(), ks = new THREE.Vector3();
    keys.frustumCulled = false;
    explodeExtras = (t) => {
      smdUpdate(t);
      keyHome.forEach((h, i) => {
        const l = smoother(THREE.MathUtils.clamp((t - h.a) / 0.36, 0, 1));
        const wob = Math.sin(Math.PI * l);
        ke.set(wob * 0.5 * (h.spin - 0.5), 0, wob * 0.35 * (0.5 - h.spin));
        kq.setFromEuler(ke);
        kp.set(h.k.x, BH + 0.07 + 5.2 * l, h.k.z);
        ks.set(h.k.w, 1, h.k.d);
        km.compose(kp, kq, ks);
        keys.setMatrixAt(i, km);
      });
      keys.instanceMatrix.needsUpdate = true;
      legendPlane.material.opacity = 0.8 * (1 - THREE.MathUtils.smoothstep(t, 0.1, 0.2));
      legendPlane.visible = legendPlane.material.opacity > 0.01;
      const shadowL = smoother(THREE.MathUtils.clamp((t - 0.34) / 0.52, 0, 1));
      shadow.position.y = -0.02 - 3.6 * shadowL;
      shadow.position.z = 11 * shadowL;
    };
  }

  // t: 0 assembled … 1 fully exploded; spin: fan rotation in radians
  function setExplode(t, spin) {
    if (!internals) return;
    const on = t > 0.12;
    base.visible = !on;
    internals.visible = on;
    onlyExploded.forEach((o) => { o.visible = on; });
    pieces.forEach((p) => {
      const l = smoother(THREE.MathUtils.clamp((t - p.a) / (p.b - p.a), 0, 1));
      p.obj.position.copy(p.home).addScaledVector(p.to, l);
      if (p.spin) p.obj.rotation.y = p.spin * l;
    });
    explodeExtras(t);
    fanBlades.forEach((r, i) => { r.rotation.y = (i ? -1 : 1) * (spin || 0); });
  }
  // project named anchors to pixel coordinates inside the host
  const proj = new THREE.Vector3();
  function project(name) {
    const a = anchors[name];
    if (!a) return null;
    root.updateMatrixWorld(true);
    proj.copy(a.v);
    a.obj.localToWorld(proj);
    proj.project(camera);
    return { x: (proj.x * 0.5 + 0.5) * size.w, y: (-proj.y * 0.5 + 0.5) * size.h, behind: proj.z > 1 };
  }

  // ----- lights on top of the HDRI: gold rim from behind, gentle key from the front
  const rim = new THREE.DirectionalLight(0xf0dcbc, 2.0);
  rim.position.set(-30, 26, -44);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xbcd4ff, 0.9);
  rim2.position.set(36, 18, -30);
  scene.add(rim2);
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.25);
  keyLight.position.set(10, 40, 40);
  scene.add(keyLight);
  // product-photo softboxes: a long one overhead-behind draws a smooth gradient across the metal
  const softTop = new THREE.RectAreaLight(0xfff4e6, 0.7, 60, 16);
  softTop.position.set(0, 34, -18);
  softTop.lookAt(0, 0, 2);
  scene.add(softTop);
  const softSide = new THREE.RectAreaLight(0xdfe8ff, 0.35, 14, 30);
  softSide.position.set(-38, 14, 16);
  softSide.lookAt(0, 4, 0);
  scene.add(softSide);

  // ----- DOM screen glued to the lid
  screenEl.classList.add("is-3d");
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
    size.w = w; size.h = h;
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
  // state: { lid: radians (≈1.56 closed … -0.3 open), pos, look }
  function render(state) {
    lid.rotation.x = state.lid;
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

  // ----- intro reveal, like a product launch film: the laptop waits in the dark, a warm rim light
  // draws its silhouette, a soft light glides across the aluminium and the studio slowly comes up.
  // Everything happens in the lighting, so nothing is drawn outside the laptop itself.
  // t: 0 dark … 1 fully lit
  let setMaterialize = () => {};
  if (opts.materialize) {
    const ss = THREE.MathUtils.smoothstep;
    const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
    const lit = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if ("envMapIntensity" in m && !lit.some((e) => e.m === m)) lit.push({ m, env: m.envMapIntensity });
      });
    });
    const lights = [[rim, "rim"], [rim2, "rim"], [keyLight, "fill"], [softTop, "fill"], [softSide, "fill"]].map(([l, k]) => ({ l, k, i: l.intensity }));
    // the gliding light: a tall softbox behind and above, so its reflection crosses the lid
    const sweep = new THREE.RectAreaLight(0xfff0dc, 0, 5, 50);
    scene.add(sweep);
    setMaterialize = (t) => {
      const rimF = smoother(ss(t, 0.02, 0.42));
      const fill = smoother(ss(t, 0.44, 1));
      lights.forEach((e) => { e.l.intensity = e.i * (e.k === "rim" ? rimF : fill); });
      lit.forEach((e) => { e.m.envMapIntensity = e.env * fill; });
      const g = ss(t, 0.12, 0.74);
      const x = THREE.MathUtils.lerp(-52, 52, smoother(g));
      sweep.intensity = 14 * Math.pow(Math.sin(Math.PI * g), 1.5);
      sweep.position.set(x, 30, -26);
      sweep.lookAt(x * 0.25, 0, 2);
      sweep.visible = g > 0 && g < 1;
      // it settles into place while the light comes up
      const settle = 1 - smoother(ss(t, 0, 1));
      root.position.y = -1.4 * settle;
      root.rotation.y = -0.14 * settle;
    };
    setMaterialize(0);
  }

  return { render, resize, screenInfo, coverDistance, setExplode, setMaterialize, project, camera, DIM };
}

// ---------------------------------------------------------------------------------------------
// Photorealistic iPhone 15 Pro (natural titanium). Same idea as the MacBook: real dimensions,
// HDRI reflections, and the display is a live DOM element placed on the glass with CSS3DRenderer.
const PH = {
  W: 7.06, H: 14.66, T: 0.825,   // body (cm)
  R: 1.0,                        // corner radius seen from the front
  SW: 6.46,                      // display width
  SR: 0.9                        // display corner radius
};
const PHONE_PX = { w: 393, h: 852 }; // iPhone 15 Pro viewport in points
PH.SH = PH.SW * PHONE_PX.h / PHONE_PX.w;

export function createIphone(host, screenEl, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = opts.exposure || 0.95;
  renderer.domElement.className = "ph3d__gl";
  host.appendChild(renderer.domElement);
  const css = new CSS3DRenderer();
  css.domElement.className = "ph3d__css";
  host.appendChild(css.domElement);

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  loadHdri().then((hdr) => {
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    if (opts.onNeedsRender) opts.onNeedsRender();
  });
  const camera = new THREE.PerspectiveCamera(opts.fov || 18, 1, 0.5, 2000);
  const { W, H, T, R, SW, SR } = PH;

  // ----- materials
  // brushed natural titanium: warm grey metal with a fine satin finish
  const ti = new THREE.MeshPhysicalMaterial({ color: 0xa39d94, metalness: 1, roughness: 0.32, envMapIntensity: 0.6 });
  const band = new THREE.MeshStandardMaterial({ color: 0x55524d, metalness: 0, roughness: 0.7, envMapIntensity: 0.2 });
  const frontGlass = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.6 });
  // textured matte back glass, tinted to match the titanium
  const backGlass = new THREE.MeshPhysicalMaterial({ color: 0x8e8a84, roughness: 0.62, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5, envMapIntensity: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6, envMapIntensity: 0.1 });
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x05060a, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 1.1 });

  const root = new THREE.Group();
  scene.add(root);

  // ----- titanium band with milled edges
  const bodyGeo = slab(W, H, T, R, 0.16);
  bodyGeo.translate(0, 0, -T / 2);
  root.add(new THREE.Mesh(bodyGeo, ti));

  // front: one sheet of black glass, the display sits on it
  const front = plate(W - 0.2, H - 0.2, R - 0.1, frontGlass);
  front.position.z = T / 2 + 0.003;
  root.add(front);
  const anchor = new THREE.Object3D();
  anchor.position.z = T / 2 + 0.006;
  root.add(anchor);

  // back: frosted glass + camera plateau with three lenses, flash and LiDAR
  const back = plate(W - 0.2, H - 0.2, R - 0.1, backGlass);
  back.rotation.y = Math.PI;
  back.position.z = -T / 2 - 0.003;
  root.add(back);
  const plateau = new THREE.Mesh(slab(3.62, 3.62, 0.17, 0.78, 0.06), backGlass);
  plateau.rotation.y = Math.PI;
  // seen from the back the camera sits top-left, i.e. top-right in front coordinates
  const px = W / 2 - 0.32 - 1.81, py = H / 2 - 0.32 - 1.81;
  plateau.position.set(px, py, -T / 2);
  root.add(plateau);
  const lensSpots = [[-0.82, 0.82], [-0.82, -0.82], [0.86, 0], [0.86, 1.08], [0.86, -1.08]];
  lensSpots.forEach(([lx, ly], k) => {
    const g = new THREE.Group();
    if (k < 3) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.16, 48), ti);
      ring.rotation.x = Math.PI / 2;
      const glassDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.17, 48), lensGlass);
      glassDisc.rotation.x = Math.PI / 2;
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), black);
      inner.rotation.y = Math.PI; inner.position.z = -0.09;
      g.add(ring, glassDisc, inner);
    } else {
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 32), k === 3 ? backGlass : black);
      dot.rotation.x = Math.PI / 2;
      g.add(dot);
    }
    g.position.set(px - lx, py + ly, -T / 2 - 0.17 - (k < 3 ? 0.06 : 0.01));
    root.add(g);
  });

  // ----- buttons: action + volume on the left, side button on the right
  const btn = (x, y, len) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.12, len, 0.3, 3, 0.05), ti);
    m.position.set(x, y, 0);
    root.add(m);
  };
  btn(-W / 2 - 0.03, H / 2 - 3.05, 0.62);   // action button
  btn(-W / 2 - 0.03, H / 2 - 4.2, 1.05);    // volume up
  btn(-W / 2 - 0.03, H / 2 - 5.55, 1.05);   // volume down
  btn(W / 2 + 0.03, H / 2 - 4.9, 1.7);      // side button

  // antenna bands cut through the titanium
  const bandMesh = (x, y, rotZ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, T * 0.86), band);
    m.position.set(x, y, 0); m.rotation.z = rotZ;
    root.add(m);
  };
  bandMesh(-W / 2 + 0.05, H / 2 - 1.35, 0); bandMesh(W / 2 - 0.05, H / 2 - 1.35, 0);
  bandMesh(-W / 2 + 0.05, -H / 2 + 1.35, 0); bandMesh(W / 2 - 0.05, -H / 2 + 1.35, 0);
  bandMesh(1.6, H / 2 - 0.05, Math.PI / 2); bandMesh(-1.6, -H / 2 + 0.05, Math.PI / 2);

  // bottom edge: USB-C port and speaker / mic holes
  const port = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.08, 0.3, 3, 0.1), black);
  port.position.set(0, -H / 2, 0);
  root.add(port);
  const holeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12);
  for (let k = 0; k < 6; k++) {
    for (const side of [-1, 1]) {
      if (side < 0 && k > 3) continue;
      const hole = new THREE.Mesh(holeGeo, black);
      hole.position.set(side * (0.85 + k * 0.17), -H / 2 - 0.005, 0);
      root.add(hole);
    }
  }

  // ----- display (DOM)
  screenEl.style.width = PHONE_PX.w + "px";
  screenEl.style.height = PHONE_PX.h + "px";
  screenEl.style.borderRadius = (SR / SW * PHONE_PX.w).toFixed(1) + "px";
  screenEl.style.backfaceVisibility = "hidden";
  const cssObj = new CSS3DObject(screenEl);
  cssObj.matrixAutoUpdate = false;
  cssScene.add(cssObj);
  const pxScale = SW / PHONE_PX.w;
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

  // state: { rx, ry, rz (radians), y (cm), fill (share of the view height the phone takes) }
  const nrm = new THREE.Vector3(), camDir = new THREE.Vector3();
  function render(state) {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fill = state.fill || 0.78;
    const d = Math.max((H / 2) / (fill * t), (W / 2) / (0.8 * t * camera.aspect));
    camera.position.set(0, 0, d);
    camera.lookAt(0, 0, 0);
    root.rotation.set(state.rx || 0, state.ry || 0, state.rz || 0, "YXZ");
    root.position.y = state.y || 0;
    root.updateMatrixWorld(true);
    cssObj.matrix.copy(anchor.matrixWorld).multiply(scaleM);
    cssObj.matrixWorldNeedsUpdate = true;
    // hide the DOM display whenever the back of the phone faces the camera
    nrm.set(0, 0, 1).applyQuaternion(root.quaternion);
    camDir.copy(camera.position).sub(root.position).normalize();
    screenEl.style.visibility = nrm.dot(camDir) > 0.02 ? "visible" : "hidden";
    renderer.render(scene, camera);
    css.render(cssScene, camera);
  }
  return { render, resize, camera, DIM: PH };
}

window.MacBook3D = { createMacbook, createIphone };
window.dispatchEvent(new Event("macbook3d-ready"));
