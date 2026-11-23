// Photorealistic MacBook Pro 14" built in Three.js. The screen is a real DOM element placed
// on the lid with CSS3DRenderer, so its text stays crisp at any zoom. script.js drives it.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";

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
    bevelSegments: 6, curveSegments: 28
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  new RGBELoader().load(HDRI, (hdr) => {
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    if (opts.onNeedsRender) opts.onNeedsRender();
  });

  const camera = new THREE.PerspectiveCamera(opts.fov || 24, 1, 0.5, 4000);
  const size = { w: 1, h: 1 };
  const { W, D, BH, LT, LD, R, SW, SH, SY } = DIM;

  // ----- materials
  // The studio HDRI is bright, so reflections are scaled per material to land on real-world values.
  const alu = new THREE.MeshStandardMaterial({   // space grey, bead-blasted anodised aluminium
    color: 0x505156, metalness: 1, roughness: 0.5, envMapIntensity: 0.2
  });
  const aluEdge = alu.clone();
  const wellMat = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.98, metalness: 0, envMapIntensity: 0.04 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x080809, roughness: 0.88, metalness: 0, envMapIntensity: 0.05 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.55 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x46474c, metalness: 0.85, roughness: 0.32, envMapIntensity: 0.18 });
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
  well.position.set(0, BH + 0.002, wellZ);
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
    p.position.set(s * (wellW / 2 + (W / 2 - wellW / 2) / 2), BH + 0.002, wellZ);
    deck.add(p);
  });

  // glass trackpad
  const padD = 8.0, padZ = wellZ + wellD / 2 + 1.05 + padD / 2;
  const pad = plate(13.8, padD, 0.45, padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, BH + 0.002, padZ);
  deck.add(pad);

  // thumb scoop on the front edge
  const scoop = canvasTexture(256, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, w / 2);
    gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const scoopMesh = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.5),
    new THREE.MeshBasicMaterial({ map: scoop, transparent: true, depthWrite: false }));
  scoopMesh.rotation.x = -Math.PI / 2;
  scoopMesh.position.set(0, BH + 0.003, D / 2 - 0.4);
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

  // ----- internals for the exploded "what's inside" view (only when asked for)
  const anchors = {};          // named points the page can attach HUD callouts to
  const fanBlades = [];
  let parts = null;
  if (opts.internals) {
    const TRAY = 0.42;
    parts = { tray: new THREE.Group(), battery: new THREE.Group(), board: new THREE.Group(), topcase: new THREE.Group() };
    Object.values(parts).forEach((g) => { g.visible = false; root.add(g); });

    // bottom case: a milled tray (floor + rim) and a top-case slab that matches the full base when assembled
    const rimShape = roundedRect(W - 0.28, D - 0.28, R - 0.14);
    rimShape.holes.push(roundedRect(W - 1.1, D - 1.1, R - 0.5));
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: TRAY - 0.12, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 4, curveSegments: 24 });
    rimGeo.translate(0, 0, 0.12);
    rimGeo.rotateX(-Math.PI / 2);
    parts.tray.add(new THREE.Mesh(rimGeo, alu));
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3f, metalness: 1, roughness: 0.55, envMapIntensity: 0.18 });
    const floor = plate(W - 0.9, D - 0.9, R - 0.4, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.06;
    parts.tray.add(floor);
    // torx screws around the edge
    const screwGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16);
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x8c8d92, metalness: 1, roughness: 0.3, envMapIntensity: 0.5 });
    [[-13.6, -9.3], [-4.5, -9.6], [4.5, -9.6], [13.6, -9.3], [-14.4, 0], [14.4, 0], [-13.6, 9.4], [13.6, 9.4]].forEach(([x, z]) => {
      const sc = new THREE.Mesh(screwGeo, screwMat);
      sc.position.set(x, TRAY - 0.02, z);
      parts.tray.add(sc);
    });

    const topGeo = slab(W, D, BH - TRAY, R, 0.14);
    topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, alu);
    top.position.y = TRAY;
    parts.topcase.add(top);

    // battery: five cells in black foil
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
    [[-8.0, 5.2, 7.6, 6.6], [0, 5.2, 7.6, 6.6], [8.0, 5.2, 7.6, 6.6], [-13.2, 0.4, 2.5, 7.0], [13.2, 0.4, 2.5, 7.0]].forEach(([x, z, w, d], i) => {
      const cell = new THREE.Mesh(new RoundedBoxGeometry(w, 0.38, d, 3, 0.12), cellMat);
      cell.position.set(x, 0.06 + 0.19, z);
      parts.battery.add(cell);
      if (i < 3) {
        const lab = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: cellLabel("TESTED · 80%+"), toneMapped: false }));
        lab.rotation.x = -Math.PI / 2;
        lab.position.set(x - 1.6, 0.06 + 0.385, z - 1.4);
        parts.battery.add(lab);
      }
    });
    anchors.battery = new THREE.Vector3(0, 0.45, 5.2);

    // logic board: black PCB with gold traces
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
    const pcbShape = roundedRect(19.5, 9.2, 0.6);
    const pcb = new THREE.Mesh(new THREE.ExtrudeGeometry(pcbShape, { depth: 0.12, bevelEnabled: false }), [pcbMat, new THREE.MeshStandardMaterial({ color: 0x14231c, roughness: 0.6 })]);
    pcb.rotation.x = -Math.PI / 2;
    pcb.position.set(0, 0.5, -4.7 + 9.2 / 2 - 4.6);
    parts.board.add(pcb);
    const boardY = 0.62;

    // chips: black epoxy packages with laser-etched labels; the SoC wears a polished heat spreader
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
    chips.forEach((c) => {
      const tex = chipLabel(c.title, c.sub, c.big);
      const top = c.big
        ? new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.85, roughness: 0.22, clearcoat: 0.6, envMapIntensity: 0.6 })
        : new THREE.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.55, envMapIntensity: 0.3 });
      const side = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), [side, side, top, side, side, side]);
      box.position.set(c.x, boardY + c.h / 2, c.z);
      parts.board.add(box);
      if (!c.big) {          // gold pads along the long edges
        const padM = new THREE.MeshStandardMaterial({ color: 0xc9a05c, metalness: 1, roughness: 0.3, envMapIntensity: 0.6 });
        for (let k = 0; k < 8; k++) [-1, 1].forEach((s) => {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.22), padM);
          p.position.set(c.x - c.w / 2 + 0.25 + k * (c.w - 0.5) / 7, boardY + 0.02, c.z + s * (c.d / 2 + 0.11));
          parts.board.add(p);
        });
      }
      anchors[c.id] = new THREE.Vector3(c.x, boardY + c.h, c.z);
    });

    // two fans with curved blades, and copper heat pipes from the SoC to the fans
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.4 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.4 });
    [-1, 1].forEach((s) => {
      const fx = s * 11.4, fz = -6.2;
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.5, 48, 1, true), fanMat);
      housing.position.set(fx, boardY + 0.15, fz);
      parts.board.add(housing);
      const basePlate = new THREE.Mesh(new THREE.CircleGeometry(2.75, 48), fanMat);
      basePlate.rotation.x = -Math.PI / 2;
      basePlate.position.set(fx, 0.5, fz);
      parts.board.add(basePlate);
      const rotor = new THREE.Group();
      rotor.position.set(fx, boardY + 0.15, fz);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.42, 32), new THREE.MeshPhysicalMaterial({ color: 0x1d1e21, metalness: 0.6, roughness: 0.25, clearcoat: 0.8 }));
      rotor.add(hub);
      for (let b = 0; b < 31; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.36, 0.05), bladeMat);
        const a = (b / 31) * Math.PI * 2;
        blade.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
        blade.rotation.y = -a + 0.5;
        rotor.add(blade);
      }
      parts.board.add(rotor);
      fanBlades.push(rotor);
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 1.4, boardY + 0.42, -5.6), new THREE.Vector3(s * 4.6, boardY + 0.42, -8.4),
        new THREE.Vector3(s * 8.4, boardY + 0.42, -8.2), new THREE.Vector3(fx - s * 2.2, boardY + 0.42, fz - 1.4)
      ]), 48, 0.2, 12, false), new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.32, envMapIntensity: 0.7 }));
      pipe.scale.y = 0.6;
      parts.board.add(pipe);
    });
    anchors.fans = new THREE.Vector3(11.4, boardY + 0.5, -6.2);
    anchors.keyboard = new THREE.Vector3(-6, BH + 0.14, -5);
  }

  // t: 0 assembled … 1 fully exploded; spin: fan rotation in radians
  function setExplode(t, spin) {
    if (!parts) return;
    const on = t > 0.001;
    base.visible = !on;
    Object.values(parts).forEach((g) => { g.visible = on; });
    // staircase: each layer rises and slides back so the one below stays visible
    parts.tray.position.set(0, -2.5 * t, 9 * t);
    parts.battery.position.set(0, 1.2 * t, 5 * t);
    parts.board.position.set(0, 5.2 * t, -1 * t);
    parts.topcase.position.set(0, 12 * t, -15 * t);
    deck.position.set(0, 12 * t, -15 * t);
    lid.position.y = BH + 0.035 + 17 * t;
    lid.position.z = -D / 2 + 0.46 - 25 * t;
    fanBlades.forEach((r, i) => { r.rotation.y = (i ? -1 : 1) * (spin || 0); });
  }
  // project named anchors to pixel coordinates inside the host
  const proj = new THREE.Vector3();
  function project(name) {
    const a = anchors[name];
    if (!a) return null;
    const g = name === "battery" ? parts.battery : name === "keyboard" ? deck : parts.board;
    proj.copy(a);
    g.localToWorld(proj);
    proj.project(camera);
    return { x: (proj.x * 0.5 + 0.5) * size.w, y: (-proj.y * 0.5 + 0.5) * size.h, behind: proj.z > 1 };
  }

  // ----- lights on top of the HDRI: gold rim from behind, gentle key from the front
  const rim = new THREE.DirectionalLight(0xe8c88f, 2.2);
  rim.position.set(-30, 26, -44);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xbcd4ff, 0.9);
  rim2.position.set(36, 18, -30);
  scene.add(rim2);
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.35);
  keyLight.position.set(10, 40, 40);
  scene.add(keyLight);

  // ----- DOM screen glued to the lid
  const anchor = new THREE.Object3D();
  anchor.position.set(0, SY, 0.012);
  lid.add(anchor);
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

  return { render, resize, screenInfo, coverDistance, setExplode, project, camera, DIM };
}

window.MacBook3D = { createMacbook };
window.dispatchEvent(new Event("macbook3d-ready"));
