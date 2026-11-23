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
  root.add(well);

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
  root.add(keys);

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
  root.add(legendPlane);

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
    root.add(p);
  });

  // glass trackpad
  const padD = 8.0, padZ = wellZ + wellD / 2 + 1.05 + padD / 2;
  const pad = plate(13.8, padD, 0.45, padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, BH + 0.002, padZ);
  root.add(pad);

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
  root.add(scoopMesh);

  // ports on the sides: MagSafe, Thunderbolt ×2, headphone (left) · HDMI, Thunderbolt, SD (right)
  const ports = [
    [-1, -6.6, 1.05, 0.32, 0.16], [-1, -4.4, 0.86, 0.3, 0.15], [-1, -2.6, 0.86, 0.3, 0.15], [-1, 7.9, 0.36, 0.36, 0.18],
    [1, -5.8, 1.45, 0.42, 0.06], [1, -3.4, 0.86, 0.3, 0.15], [1, 5.6, 2.4, 0.18, 0.05]
  ];
  ports.forEach(([side, z, w, h, r]) => {
    const p = plate(w, h, r, portMat);
    p.rotation.y = side * Math.PI / 2;
    p.position.set(side * (W / 2 + 0.003), BH / 2, z);
    root.add(p);
  });

  // hinge barrel
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, W - 5.6, 40), hingeMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, BH + 0.03, -D / 2 + 0.5);
  root.add(hinge);

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

  return { render, resize, screenInfo, coverDistance, camera, DIM };
}

window.MacBook3D = { createMacbook };
window.dispatchEvent(new Event("macbook3d-ready"));
