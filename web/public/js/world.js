// Draws Googly Heist: First Googly National Bank (marble lobby, teller counter, offices, the vault and its round door,
// deposit boxes, cash pallets, gold, the diamond), the street, alley and parking lot, the van, the armored truck,
// police cars, the helicopter, the Hideout warehouse, and every bullet, spark and banknote. All textures are painted
// on canvases at load time — nothing to download.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAPS, BANK, HIDEOUT } from './maps.js';
import { makeBag, textSprite } from './googly.js';

const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const phys = o => new THREE.MeshPhysicalMaterial(o);
const rnd = (a, b) => a + Math.random() * (b - a);
function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const texCache = new Map();
function tex(key, w, h, draw, srgb = true) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h, seeded(key.length * 977 + w));
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
const speck = (g, w, h, n, cols, s = 2, r = Math.random) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(r() * w, r() * h, s, s); } };
// ------------------------------------------------------------------ textures (u/v measured in metres: see uvBox)
const TX = {
  // 4 m wide x 6 m tall: walnut wainscot, chair rail, cream plaster, crown moulding
  wall: () => tex('wall', 512, 768, (g, w, h, r) => {
    const px = h / 6;
    g.fillStyle = '#e9dfc8'; g.fillRect(0, 0, w, h); speck(g, w, h, 9000, ['#00000008', '#ffffff14', '#c8b89a10'], 3, r);
    const wy = h - 1.25 * px;
    const wood = g.createLinearGradient(0, wy, 0, h); wood.addColorStop(0, '#5a3620'); wood.addColorStop(1, '#3a2012'); g.fillStyle = wood; g.fillRect(0, wy, w, h - wy);
    for (let x = 0; x < w; x += 128) { g.strokeStyle = '#2a1608'; g.lineWidth = 3; g.strokeRect(x + 14, wy + 22, 100, 1.25 * px - 50); g.strokeStyle = '#7a5030'; g.lineWidth = 1.5; g.strokeRect(x + 18, wy + 26, 92, 1.25 * px - 58); }
    for (let i = 0; i < 90; i++) { g.strokeStyle = 'rgba(30,15,5,.18)'; g.beginPath(); const y = wy + r() * (h - wy); g.moveTo(0, y); g.lineTo(w, y + r() * 4); g.stroke(); }
    g.fillStyle = '#6a4228'; g.fillRect(0, wy - 8, w, 10); g.fillStyle = '#8a6040'; g.fillRect(0, wy - 8, w, 3);
    g.fillStyle = '#f6efe0'; g.fillRect(0, 0, w, 26); g.fillStyle = '#d8ccb0'; g.fillRect(0, 26, w, 6); g.fillRect(0, 12, w, 2);
    g.fillStyle = '#2a1a10'; g.fillRect(0, h - 10, w, 10);
  }),
  staffWall: () => tex('staffwall', 512, 768, (g, w, h, r) => { g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, w, h); speck(g, w, h, 6000, ['#00000008', '#ffffff10'], 3, r); g.fillStyle = '#6a6a6a'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#b0ab9e'; g.fillRect(0, h * 0.72, w, 5); }),
  steel: () => tex('steel', 512, 768, (g, w, h, r) => {
    g.fillStyle = '#8a929c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 128) for (let y = 0; y < h; y += 128) { g.strokeStyle = '#5a626c'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, 124, 124); g.fillStyle = '#6a727c'; for (const [a, b] of [[10, 10], [118, 10], [10, 118], [118, 118]]) { g.beginPath(); g.arc(x + a, y + b, 4, 0, 7); g.fill(); } }
  }),
  stone: () => tex('stone', 512, 768, (g, w, h, r) => {
    const px = h / 6; g.fillStyle = '#b8a888'; g.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += px * 0.5, row++) for (let x = (row % 2) * -64; x < w; x += 128) { const tone = 170 + r() * 30; g.fillStyle = `rgb(${tone + 14},${tone},${tone - 28})`; g.fillRect(x + 2, y + 2, 124, px * 0.5 - 4); }
    speck(g, w, h, 8000, ['#00000010', '#ffffff14'], 2, r);
    g.fillStyle = '#7a6e5a'; g.fillRect(0, h - px * 0.8, w, px * 0.8); g.fillStyle = '#968a72'; g.fillRect(0, h - px * 0.8, w, 8);
  }),
  brick: () => tex('brick', 512, 512, (g, w, h, r) => {
    g.fillStyle = '#6a5a50'; g.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 21, row++) for (let x = (row % 2) * -24; x < w; x += 48) { const tone = 120 + r() * 50; g.fillStyle = `rgb(${tone + 40},${tone * 0.55},${tone * 0.42})`; g.fillRect(x + 1.5, y + 1.5, 45, 18); }
    speck(g, w, h, 5000, ['#00000014', '#ffffff10'], 2, r);
  }),
  marble: () => tex('marble', 512, 512, (g, w, h, r) => {
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const dark = (tx + ty) % 2 === 1, x0 = tx * 256, y0 = ty * 256;
      g.fillStyle = dark ? '#2e3a36' : '#ece8e0'; g.fillRect(x0, y0, 256, 256);
      for (let i = 0; i < 16; i++) { g.strokeStyle = dark ? `rgba(200,210,200,${0.05 + r() * 0.12})` : `rgba(120,110,100,${0.05 + r() * 0.16})`; g.lineWidth = 0.6 + r() * 2.2; g.beginPath(); let x = x0 + r() * 256, y = y0 + r() * 256; g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 90; y += (r() - 0.3) * 60; g.lineTo(Math.max(x0, Math.min(x0 + 256, x)), Math.max(y0, Math.min(y0 + 256, y))); } g.stroke(); }
      g.strokeStyle = '#8a8070'; g.lineWidth = 1.5; g.strokeRect(x0 + 0.5, y0 + 0.5, 255, 255);
    }
  }),
  marbleRough: () => tex('marbleR', 64, 64, (g, w, h) => { g.fillStyle = '#404040'; g.fillRect(0, 0, w, h); g.fillStyle = '#909090'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(0, 32, w, 1); g.fillRect(32, 0, 1, h); }, false),
  carpet: () => tex('carpet', 256, 256, (g, w, h, r) => { g.fillStyle = '#3a4a5e'; g.fillRect(0, 0, w, h); speck(g, w, h, 14000, ['#2e3c4e', '#465a70', '#34445a'], 2, r); for (let i = 0; i < w; i += 32) { g.fillStyle = '#00000010'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } }),
  wood: () => tex('woodfloor', 512, 512, (g, w, h, r) => { for (let y = 0; y < h; y += 32) for (let x = -(y % 96); x < w; x += 192) { const t = 110 + r() * 50; g.fillStyle = `rgb(${t + 50},${t * 0.72},${t * 0.42})`; g.fillRect(x, y, 190, 31); for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(50,25,10,.2)'; g.beginPath(); const yy = y + r() * 30; g.moveTo(x, yy); g.lineTo(x + 190, yy + r() * 3); g.stroke(); } } }),
  plate: () => tex('plate', 256, 256, (g, w, h, r) => { g.fillStyle = '#6a7078'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * 16; x < w; x += 32) { g.save(); g.translate(x + 8, y + 8); g.rotate((y / 32 % 2) ? 0.7 : -0.7); g.fillStyle = '#8a929c'; g.fillRect(-9, -2.5, 18, 5); g.restore(); } speck(g, w, h, 3000, ['#0000001a', '#ffffff10'], 2, r); }),
  lino: () => tex('lino', 256, 256, (g, w, h, r) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#b8b4a8' : '#c8c4b8'; g.fillRect(x * 64, y * 64, 64, 64); } speck(g, w, h, 4000, ['#0000000c', '#ffffff10'], 2, r); }),
  concrete: () => tex('concrete', 512, 512, (g, w, h, r) => { g.fillStyle = '#9a9690'; g.fillRect(0, 0, w, h); speck(g, w, h, 20000, ['#8a8680', '#aaa6a0', '#7a7670', '#b4b0aa'], 2, r); for (let i = 0; i < 5; i++) { g.strokeStyle = '#6a666044'; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) g.lineTo(x += (r() - 0.5) * 60, y += (r() - 0.5) * 60); g.stroke(); } g.strokeStyle = '#6a6660'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }),
  sidewalk: () => tex('sidewalk', 256, 256, (g, w, h, r) => { g.fillStyle = '#b4aea4'; g.fillRect(0, 0, w, h); speck(g, w, h, 9000, ['#a09a90', '#c4beb4', '#8a847a'], 2, r); g.strokeStyle = '#7a746a'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, h); g.moveTo(0, 128); g.lineTo(w, 128); g.stroke(); }),
  asphalt: () => tex('asphalt', 512, 512, (g, w, h, r) => { g.fillStyle = '#3a3a3c'; g.fillRect(0, 0, w, h); speck(g, w, h, 40000, ['#2e2e30', '#48484a', '#343436', '#525254'], 2, r); for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); } }),
  ceiling: () => tex('ceiling', 256, 256, (g, w, h) => { g.fillStyle = '#f2eee4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8c0ae'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.strokeStyle = '#ddd6c6'; g.lineWidth = 4; g.strokeRect(24, 24, w - 48, h - 48); }),
  tiles: () => tex('ceilTiles', 256, 256, (g, w, h, r) => { g.fillStyle = '#e8e6e0'; g.fillRect(0, 0, w, h); speck(g, w, h, 5000, ['#00000010'], 2, r); g.strokeStyle = '#a8a69e'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128); g.strokeRect(128, 128, 128, 128); g.strokeRect(128, 0, 128, 128); g.strokeRect(0, 128, 128, 128); }),
  cash: () => tex('cash', 256, 128, (g, w, h, r) => {
    for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * -32; x < w; x += 64) { g.fillStyle = '#7aa870'; g.fillRect(x + 1, y + 1, 62, 30); g.fillStyle = '#5a8a52'; g.fillRect(x + 4, y + 4, 56, 24); g.fillStyle = '#c8b870'; g.fillRect(x + 26, y + 1, 12, 30); g.fillStyle = '#e8f0d8'; g.beginPath(); g.ellipse(x + 14, y + 16, 7, 9, 0, 0, 7); g.fill(); }
  }),
  goldbars: () => tex('goldbars', 256, 128, (g, w, h) => { for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 64) { const gr = g.createLinearGradient(x, y, x, y + 32); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#e0a820'); gr.addColorStop(1, '#8a6010'); g.fillStyle = gr; g.fillRect(x + 2, y + 2, 60, 28); g.fillStyle = '#a07818'; g.font = 'bold 10px sans-serif'; g.fillText('999.9', x + 18, y + 20); } }),
  deposit: () => tex('deposit', 256, 256, (g, w, h) => { g.fillStyle = '#6a5a3a'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 64) { const gr = g.createLinearGradient(x, y, x + 64, y + 32); gr.addColorStop(0, '#d8b870'); gr.addColorStop(1, '#8a6a30'); g.fillStyle = gr; g.fillRect(x + 2, y + 2, 60, 28); g.fillStyle = '#3a2a10'; g.fillRect(x + 28, y + 12, 8, 8); g.fillStyle = '#2a1a08'; g.font = 'bold 9px sans-serif'; g.fillText(String(100 + x / 64 + y / 8 | 0), x + 6, y + 12); } }),
  facade: (seed, base, win) => tex('facade' + seed, 512, 512, (g, w, h, r) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); speck(g, w, h, 6000, ['#00000012', '#ffffff10'], 3, r);
    for (let y = 30; y < h - 40; y += 128) for (let x = 24; x < w; x += 128) { g.fillStyle = '#2a2a2a'; g.fillRect(x - 4, y - 4, 88, 88); g.fillStyle = win; g.fillRect(x, y, 80, 80); g.fillStyle = '#ffffff22'; g.fillRect(x, y, 80, 30); g.fillStyle = '#1a1a1a'; g.fillRect(x + 38, y, 4, 80); g.fillRect(x, y + 38, 80, 4); g.fillStyle = '#d8d0c0'; g.fillRect(x - 8, y + 84, 96, 8); }
  }),
  winGlow: seed => tex('winglow' + seed, 512, 512, (g, w, h, r) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let y = 30; y < h - 40; y += 128) for (let x = 24; x < w; x += 128) if (r() < 0.55) { g.fillStyle = r() < 0.5 ? '#ffd890' : '#ffe8c0'; g.fillRect(x, y, 80, 80); } }),
  shopfront: (text, col) => tex('shop' + text, 1024, 256, (g, w, h) => {
    g.fillStyle = '#1a1a1c'; g.fillRect(0, 0, w, h); g.fillStyle = col; g.fillRect(0, 0, w, 70);
    g.font = '900 52px "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(text, w / 2, 54);
    g.fillStyle = '#88a4b8'; g.fillRect(40, 90, w - 80, 150); g.fillStyle = '#ffffff30'; g.fillRect(40, 90, w - 80, 50); g.fillStyle = '#1a1a1c'; for (let x = 40; x < w; x += 190) g.fillRect(x, 90, 8, 150);
  }),
  sign: (text, bg, fg, w = 1024, h = 160, font = 'Georgia, serif') => tex('sign' + text + bg, w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); let fs = Math.floor(h * 0.52); g.font = `700 ${fs}px ${font}`; const tw = g.measureText(text).width; if (tw > w * 0.92) { fs = Math.floor(fs * w * 0.92 / tw); } g.font = `700 ${fs}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#0006'; g.fillText(text, w / 2 + 3, h / 2 + 4); g.fillStyle = fg; g.fillText(text, w / 2, h / 2); }),
  screen: (n) => tex('screen' + n, 256, 192, (g, w, h, r) => { g.fillStyle = '#0a1a14'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a8a6a'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.strokeRect(20 + r() * 150, 30 + r() * 100, 30 + r() * 60, 20 + r() * 40); } for (let y = 0; y < h; y += 3) { g.fillStyle = '#ffffff08'; g.fillRect(0, y, w, 1); } g.fillStyle = '#7dffb0'; g.font = 'bold 16px monospace'; g.fillText('CAM ' + (n + 1), 10, 20); g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(w - 20, 14, 6, 0, 7); g.fill(); }),
  blueprint: () => tex('blueprint', 1024, 512, (g, w, h) => {
    g.fillStyle = '#1a4a8a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffff22'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#e8f4ff'; g.lineWidth = 5; g.strokeRect(100, 60, 820, 400); g.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [[100, 260, 920, 260], [340, 60, 340, 180], [680, 60, 680, 180], [100, 180, 920, 180], [420, 60, 420, 180]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    g.fillStyle = '#e8f4ff'; g.font = 'bold 26px monospace'; g.fillText('VAULT', 470, 125); g.fillText('LOBBY', 470, 380); g.fillText('OFFICE', 170, 125); g.fillText('SECURITY', 720, 125); g.fillText('STAFF', 470, 225);
    g.strokeStyle = '#ff5a5a'; g.lineWidth = 6; g.beginPath(); g.arc(510, 120, 60, 0, 7); g.stroke(); g.beginPath(); g.moveTo(920, 220); g.lineTo(990, 220); g.lineTo(990, 480); g.stroke();
    g.fillStyle = '#ff5a5a'; g.font = 'bold 22px monospace'; g.fillText('VAN', 950, 500); g.fillText('X', 500, 128);
  }),
  heistBoard: () => tex('heistboard', 1024, 320, (g, w, h, r) => {
    g.fillStyle = '#c8a878'; g.fillRect(0, 0, w, h); speck(g, w, h, 6000, ['#a8885a', '#d8b888'], 3, r);
    const photos = ['BANK', 'VAULT', 'MANAGER', 'GUARD', 'VAN', 'CAMERAS'];
    photos.forEach((p, i) => { const x = 40 + i * 160, y = 40 + (i % 2) * 110; g.save(); g.translate(x + 60, y + 70); g.rotate((r() - 0.5) * 0.2); g.fillStyle = '#f4f0e8'; g.fillRect(-60, -70, 120, 140); g.fillStyle = ['#4a5a6a', '#6a7078', '#8a6a4a', '#3a4a5c', '#e8e8e8', '#2a2a2a'][i]; g.fillRect(-52, -62, 104, 96); g.fillStyle = '#222'; g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.fillText(p, 0, 58); g.fillStyle = '#d82a2a'; g.beginPath(); g.arc(0, -64, 7, 0, 7); g.fill(); g.restore(); });
    g.strokeStyle = '#d82a2a'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 6; i++) { const x = 100 + i * 160, y = 46 + (i % 2) * 110; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  }),
};
/** Rewrite a box's UVs in metres so textures tile at a real-world size (u: along the face; v: height). */
function uvBox(geo, w, h, d, U = 4, V = 6) {
  const uv = geo.attributes.uv;
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z; four verts each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) { const [a, b] = dims[f]; for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * a / U, f === 2 || f === 3 ? uv.getY(k) * b / U : uv.getY(k) * b / V); } }
  uv.needsUpdate = true;
  return geo;
}
function floorUV(geo, w, d, U) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / U, uv.getY(i) * d / U); uv.needsUpdate = true; return geo; }

export class World {
  constructor(canvas) {
    this.lq = /lq=1/.test(location.search);
    this.mobile = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.lq, powerPreference: 'high-performance', preserveDrawingBuffer: /shot|icon/.test(location.search) });
    this.maxDpr = this.lq ? 0.6 : Math.min(devicePixelRatio, this.mobile ? 1.25 : 1.5); this.dpr = this.maxDpr; this.renderer.setPixelRatio(this.dpr);
    this.renderer.shadowMap.enabled = !this.lq;
    this.renderer.shadowMap.type = this.mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.08, 700);
    this.canvas = canvas;
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x6a5a4a, 0.9); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
    this.sun.castShadow = true; const sm = this.mobile ? 1024 : 2048; this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.makeSky();
    this.parts = []; this.mapId = -1; this.focus = new THREE.Vector3(); this.flashes = [];
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  makeSky() {
    this.skyU = { top: { value: new THREE.Color('#5a98d8') }, bot: { value: new THREE.Color('#e8e0d0') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff') } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vd;
        void main(){ float h = clamp(vd.y*1.3+0.06,0.0,1.0); vec3 c = mix(bot, top, pow(h,0.7));
          float s = max(dot(vd, sunDir),0.0); c += sunCol * (pow(s, 700.0)*3.0 + pow(s, 10.0)*0.35);
          gl_FragColor = vec4(c,1.0); }`,
    }));
    sky.renderOrder = -10; this.sky = sky; this.scene.add(sky);
  }
  clear() {
    if (this.level) { this.scene.remove(this.level); this.level.traverse(o => { o.geometry?.dispose?.(); }); }
    this.parts = []; this.flashes = []; this.doorViews = {}; this.bagViews = new Map(); this.palletViews = []; this.depViews = []; this.camViews = []; this.lights = []; this.beacons = []; this.pcarViews = []; this.tracers = [];
    this.drillView = null; this.heli = null; this.van = null; this.truck = null; this.alarmOn = false; this.glassHits = [];
  }
  // ------------------------------------------------------------------ build a place
  load(id) {
    if (this.mapId === id && this.level) { for (const o of [...this.actors.children]) this.actors.remove(o); return this.map; }
    this.clear();
    this.mapId = id;
    const map = this.map = MAPS[id];
    const L = this.level = new THREE.Group(); this.scene.add(L);
    this.fx = new THREE.Group(); L.add(this.fx);
    this.actors = new THREE.Group(); L.add(this.actors);
    this.bagsG = new THREE.Group(); L.add(this.bagsG);
    this.dynamic = new Set([this.fx, this.actors, this.bagsG]);
    if (id === BANK) this.bank(L, map); else this.hideout(L, map);
    L.traverse(o => { if (o.isMesh && !o.userData.noRecv) o.receiveShadow = true; });
    this.mergeStatic(L);
    this.setTime(0.3);
    return map;
  }
  /** Merge every static mesh that shares a material into one draw call (walls, furniture, fittings…). */
  mergeStatic(L) {
    const groups = new Map(), drop = [];
    L.updateMatrixWorld(true);
    const visit = (o, top) => {
      if (this.dynamic.has(o) || o.userData.dynamic) return;
      if (o.isMesh && !o.isInstancedMesh && o.visible && !o.material.transparent && !o.userData.keep) {
        const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
        if (!g.attributes.uv) return;
        g.applyMatrix4(o.matrixWorld);
        if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
        groups.get(key).geos.push(g); drop.push(o);
      }
      for (const c of [...o.children]) visit(c, false);
    };
    for (const c of [...L.children]) visit(c, true);
    for (const o of drop) o.parent.remove(o);
    for (const { mat, cast, recv, geos } of groups.values()) {
      for (let i = 0; i < geos.length; i += 400) {
        const m = new THREE.Mesh(mergeGeometries(geos.slice(i, i + 400)), mat); m.castShadow = cast; m.receiveShadow = recv; m.matrixAutoUpdate = false; L.add(m);
      }
    }
  }
  mesh(parent, geo, mat, x, y, z, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; parent.add(m); return m; }
  boxAt(parent, c, mat, U = 4, V = 6) { const g = uvBox(new THREE.BoxGeometry(c.w, c.h, c.d), c.w, c.h, c.d, U, V); return this.mesh(parent, g, mat, c.x, c.y + c.h / 2, c.z); }
  floor(parent, x0, z0, x1, z1, mat, U = 2, y = 0.001) {
    const w = x1 - x0, d = z1 - z0, g = floorUV(new THREE.PlaneGeometry(w, d), w, d, U); g.rotateX(-Math.PI / 2);
    const m = this.mesh(parent, g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, false); return m;
  }
  light(parent, x, y, z, color, intensity, distance, shadow = false) {
    if (this.lq && this.lights.length > 3) return null;
    const l = new THREE.PointLight(color, intensity, distance, 1.6); l.position.set(x, y, z);
    if (shadow && !this.mobile && !this.lq) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; }
    parent.add(l); this.lights.push(l); return l;
  }

  bank(L, map) {
    const M = this.M = {
      wall: std(0xffffff, 0.85, 0, { map: TX.wall() }), staff: std(0xffffff, 0.9, 0, { map: TX.staffWall() }), steel: std(0xffffff, 0.35, 0.85, { map: TX.steel() }),
      stone: std(0xffffff, 0.85, 0, { map: TX.stone() }), brick: std(0xffffff, 0.9, 0, { map: TX.brick() }),
      marble: phys({ map: TX.marble(), roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.08, roughnessMap: TX.marbleRough() }),
      carpet: std(0xffffff, 1, 0, { map: TX.carpet() }), wood: std(0xffffff, 0.55, 0, { map: TX.wood() }), plate: std(0xffffff, 0.4, 0.8, { map: TX.plate() }), lino: std(0xffffff, 0.6, 0, { map: TX.lino() }),
      concrete: std(0xffffff, 0.95, 0, { map: TX.concrete() }), sidewalk: std(0xffffff, 0.9, 0, { map: TX.sidewalk() }), asphalt: std(0xffffff, 0.92, 0, { map: TX.asphalt() }),
      ceiling: std(0xffffff, 0.9, 0, { map: TX.ceiling() }), tiles: std(0xffffff, 0.9, 0, { map: TX.tiles() }),
      darkwood: std(0x4a2a16, 0.45), brass: std(0xd8a84a, 0.28, 1), gold: phys({ color: 0xffc83a, metalness: 1, roughness: 0.18, clearcoat: 0.5 }),
      glass: phys({ color: 0xcfe8f0, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.55, transparent: true, opacity: 0.35, ior: 1.5, depthWrite: false }),
      black: std(0x151518, 0.5), grey: std(0x5a5e66, 0.6), white: std(0xf4f4f0, 0.6), green: std(0x2a5a3a, 0.8), red: std(0xc01818, 0.5), chrome: std(0xd8dee6, 0.15, 1),
      cash: std(0xffffff, 0.8, 0, { map: TX.cash() }), goldbars: phys({ map: TX.goldbars(), metalness: 1, roughness: 0.22 }), deposit: std(0xffffff, 0.35, 0.8, { map: TX.deposit() }),
      pallet: std(0x9a7a4a, 0.9), paper: std(0xf0ece0, 0.9), plant: std(0x2a6a2a, 0.8), pot: std(0x8a5a3a, 0.7),
      lamp: new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xfff0d0, emissiveIntensity: 2.4 }), lampCool: new THREE.MeshStandardMaterial({ color: 0xf0f6ff, emissive: 0xeaf2ff, emissiveIntensity: 2 }),
    };
    M.marble.map.repeat.set(1, 1);
    // --- floors
    this.floor(L, -24, -4, 24, 10, M.marble, 2);
    this.floor(L, -24, -12, 24, -4, M.carpet, 3);
    this.floor(L, -24, -21, -10, -12, M.wood, 4);
    this.floor(L, -10, -21, 10, -12, M.marble, 2);
    this.floor(L, 10, -21, 24, -12, M.lino, 2);
    this.floor(L, -8, -36, 8, -21, M.plate, 2);
    this.floor(L, -50, 10, 50, 15, M.sidewalk, 2.5); this.floor(L, -50, 29, 50, 31, M.sidewalk, 2.5);
    this.floor(L, -50, 15, 50, 29, M.asphalt, 8);
    this.floor(L, 24, -45, 34, 10, M.asphalt, 8); this.floor(L, -24, -45, 24, -36, M.asphalt, 8);
    // street markings, curbs
    const paint = std(0xf2f2e8, 0.7), yellow = std(0xe8c02a, 0.7);
    for (let x = -48; x < 48; x += 6) this.mesh(L, new THREE.BoxGeometry(3, 0.01, 0.18), paint, x, 0.006, 22, false);
    this.mesh(L, new THREE.BoxGeometry(100, 0.012, 0.12), yellow, 0, 0.006, 21.8, false); this.mesh(L, new THREE.BoxGeometry(100, 0.012, 0.12), yellow, 0, 0.006, 22.2, false);
    for (let z = 15.6; z < 28.6; z += 0.9) this.mesh(L, new THREE.BoxGeometry(4, 0.012, 0.45), paint, 0, 0.005, z, false);   // crosswalk
    for (const z of [15, 29]) this.mesh(L, new THREE.BoxGeometry(100, 0.16, 0.25), std(0xa8a298, 0.8), 0, 0.08, z, false);
    for (let x = -22; x < 24; x += 3.4) this.mesh(L, new THREE.BoxGeometry(0.12, 0.01, 4), paint, x, 0.006, -40.5, false);    // parking spaces
    // --- walls
    const staffZone = c => c.z < -4 && c.z > -21.2 && Math.abs(c.x) > 0;
    for (const c of map.colliders) {
      switch (c.kind) {
        case 'front': { this.frontWall(L, c); break; }
        case 'ext': {
          const g = this.boxAt(L, c, M.stone);
          // inside faces: lobby wood, staff plaster (paint a thin panel on the inside)
          const inner = c.w < c.d ? (c.x < 0 ? 1 : -1) : (c.z < 0 ? 1 : -1);
          const lobbyPart = c.z > -4 || c.w > c.d;
          this.innerSkin(L, c, inner, c.w < c.d);
          break;
        }
        case 'wall': this.boxAt(L, c, (c.z < -4.1 || c.d > c.w && c.z < -4) ? M.staff : M.wall); break;
        case 'vaultwall': this.boxAt(L, c, M.steel); break;
        case 'filler': { const m = this.boxAt(L, c, M.steel); break; }
        case 'roof': this.roof(L, c); break;
        case 'building': this.building(L, c); break;
        case 'counter': this.counter(L, c); break;
        case 'glass': { const m = this.mesh(L, new THREE.BoxGeometry(c.w, c.h, c.d), M.glass, c.x, c.y + c.h / 2, c.z, false); m.userData.noRecv = true; this.counterGlass = m; for (let x = -14; x <= 14; x += 3.5) this.mesh(L, new THREE.BoxGeometry(0.06, c.h, 0.12), M.brass, x, c.y + c.h / 2, c.z); this.mesh(L, new THREE.BoxGeometry(c.w, 0.06, 0.14), M.brass, c.x, c.y + c.h, c.z); break; }
        case 'pillar': { this.mesh(L, new THREE.CylinderGeometry(c.r, c.r, c.h, 24), M.marble, c.x, c.h / 2, c.z); for (const y of [0.15, 1.2, 5.7]) this.mesh(L, new THREE.CylinderGeometry(c.r + 0.06, c.r + 0.06, y === 0.15 ? 0.3 : 0.1, 24), M.brass, c.x, y, c.z); break; }
        case 'desk': this.desk(L, c); break;
        case 'bench': { this.boxAt(L, { ...c, h: 0.08, y: 0.38 }, M.darkwood); for (const dx of [-c.w / 2 + 0.2, c.w / 2 - 0.2]) this.mesh(L, new THREE.BoxGeometry(0.08, 0.38, c.d * 0.8), M.brass, c.x + dx, 0.19, c.z); this.mesh(L, new THREE.BoxGeometry(c.w, 0.5, 0.08), M.darkwood, c.x, 0.7, c.z + (c.z > 0 ? c.d / 2 : -c.d / 2)); break; }
        case 'atm': this.atm(L, c); break;
        case 'plant': { this.mesh(L, new THREE.CylinderGeometry(c.r, c.r * 0.8, 0.7, 16), M.pot, c.x, 0.35, c.z); for (let i = 0; i < 9; i++) { const l = this.mesh(L, new THREE.SphereGeometry(0.28, 8, 6), M.plant, c.x + rnd(-0.25, 0.25), 0.9 + rnd(0, 0.9), c.z + rnd(-0.25, 0.25)); l.scale.set(0.7, 1.4, 0.7); } break; }
        case 'cabinet': { this.boxAt(L, c, std(0x8a8e94, 0.4, 0.6)); for (let k = 0; k < 4; k++) this.mesh(L, new THREE.BoxGeometry(c.w * 0.9, 0.02, 0.02), M.black, c.x, 0.4 + k * 0.45, c.z + c.d / 2 + 0.01); break; }
        case 'copier': { this.boxAt(L, c, std(0xd8d8d4, 0.5)); this.mesh(L, new THREE.BoxGeometry(0.6, 0.04, 0.9), M.grey, c.x, c.h + 0.02, c.z); break; }
        case 'mdesk': this.managerDesk(L, c); break;
        case 'shelf': { this.boxAt(L, c, M.darkwood); const cols = [0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0xc8a040, 0x5a3a6a]; for (let s = 0; s < 4; s++) for (let i = 0; i < 16; i++) this.mesh(L, new THREE.BoxGeometry(0.08 + Math.random() * 0.06, 0.3 + Math.random() * 0.1, 0.3), std(cols[(i + s) % 5], 0.8), c.x - c.w / 2 + 0.2 + i * 0.21, 0.3 + s * 0.5, c.z + 0.12); break; }
        case 'safe': { this.boxAt(L, c, std(0x3a3e44, 0.4, 0.7)); const d = this.mesh(L, new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), M.chrome, c.x, 0.8, c.z + c.d / 2 + 0.03); d.rotation.x = Math.PI / 2; d.userData.keep = true; this.safeDial = d; break; }
        case 'monitors': this.monitors(L, c); break;
        case 'rack': { this.boxAt(L, c, M.black); for (let k = 0; k < 14; k++) this.mesh(L, new THREE.BoxGeometry(0.04, 0.04, 0.02), new THREE.MeshStandardMaterial({ color: 0x2aff6a, emissive: k % 3 ? 0x2aff6a : 0xffa02a, emissiveIntensity: 2 }), c.x - 1 + (k % 7) * 0.3, 0.5 + Math.floor(k / 7) * 0.8, c.z + c.d / 2 + 0.01, false); break; }
        case 'boxwall': this.depositWall(L, c); break;
        case 'bars': this.bars(L, c); break;
        case 'car': this.car(L, c); break;
        case 'mailbox': { this.boxAt(L, c, std(0x2a4aa8, 0.5)); break; }
        case 'hydrant': { this.mesh(L, new THREE.CylinderGeometry(0.2, 0.25, 0.7, 12), std(0xd82a1a, 0.5), c.x, 0.35, c.z); this.mesh(L, new THREE.SphereGeometry(0.2, 12, 8), std(0xd82a1a, 0.5), c.x, 0.72, c.z); break; }
        case 'dumpster': { this.boxAt(L, c, std(0x2a5a3a, 0.6, 0.4)); this.mesh(L, new THREE.BoxGeometry(c.w + 0.1, 0.08, c.d + 0.1), std(0x1a3a2a, 0.6), c.x, c.h + 0.04, c.z); break; }
        case 'pallet': case 'goldcart': case 'pedestal': break;   // drawn with the loot
        case 'door': case 'gate': case 'vaultdoor': case 'cagedoor': case 'van': case 'truck': case 'pcar': break; // dynamic
      }
    }
    // ceilings (inside the bank) with light fittings
    const ceil = (x0, z0, x1, z1, mat, U) => { const w = x1 - x0, d = z1 - z0, g = floorUV(new THREE.PlaneGeometry(w, d), w, d, U); g.rotateX(Math.PI / 2); const m = this.mesh(L, g, mat, (x0 + x1) / 2, 5.99, (z0 + z1) / 2, false); m.userData.noRecv = false; };
    ceil(-24, -4, 24, 10, M.ceiling, 3); ceil(-24, -12, 24, -4, M.tiles, 1.2); ceil(-24, -21, 24, -12, M.tiles, 1.2); ceil(-8, -36, 8, -21, M.steel, 4);
    // chandeliers in the lobby
    for (const x of [-12, 0, 12]) this.chandelier(L, x, 3);
    for (const [x, z] of [[-16, -8], [0, -8], [16, -8], [-17, -16.5], [0, -16.5], [17, -16.5]]) { this.mesh(L, new THREE.BoxGeometry(1.2, 0.05, 0.6), M.lampCool, x, 5.96, z, false); }
    for (const z of [-24, -28, -32]) this.mesh(L, new THREE.BoxGeometry(3, 0.05, 0.3), M.lampCool, 0, 5.96, z, false);
    this.light(L, -10, 4.6, 3, 0xffe6c0, 75, 28); this.light(L, 10, 4.6, 3, 0xffe6c0, 75, 28);
    this.light(L, 0, 5, -8, 0xf0f4ff, 45, 26);
    this.light(L, -14, 5, -16.5, 0xffe8cc, 30, 16); this.light(L, 14, 5, -16.5, 0xf0f4ff, 28, 16);
    this.light(L, 0, 5, -28, 0xf0f4ff, 55, 18);
    // big bank sign + front steps light
    this.lobbyDecor(L);
    this.vault(L, map);
    this.loot(L, map);
    this.doors(L, map);
    this.cameras(L, map);
    this.street(L, map);
    this.vehicles(L, map);
    this.beaconsInit(L);
  }
  innerSkin(L, c, inner, alongZ) {
    // a thin panel of wall texture on the inside of the stone outer walls
    const zoneLobby = z => z > -4, zoneStaff = z => z <= -4 && z > -21;
    const segs = [];
    if (alongZ) { const z0 = c.z - c.d / 2, z1 = c.z + c.d / 2; for (const [a, b, mat] of [[Math.max(z0, -4), Math.min(z1, 10), this.M.wall], [Math.max(z0, -21), Math.min(z1, -4), this.M.staff]]) if (b - a > 0.05) segs.push({ x: c.x + inner * (c.w / 2 + 0.01), z: (a + b) / 2, w: 0.02, d: b - a, mat }); }
    else if (c.z < -30) { segs.push({ x: c.x, z: c.z + inner * (c.d / 2 + 0.01), w: c.w, d: 0.02, mat: this.M.steel }); }
    for (const s of segs) this.boxAt(L, { x: s.x, z: s.z, w: s.w, d: s.d, y: 0, h: 6 }, s.mat);
  }
  frontWall(L, c) {
    const M = this.M;
    // stone outside, wood-panelled inside, with tall windows (glass) and a bronze-framed entrance
    this.boxAt(L, { ...c, d: c.d * 0.5, z: c.z + c.d * 0.25 }, M.stone);
    this.boxAt(L, { ...c, d: c.d * 0.5, z: c.z - c.d * 0.25 }, M.wall);
    const side = c.x < 0 ? -1 : 1;
    for (let k = 0; k < 3; k++) {
      const x = side * (6 + k * 6);
      if (Math.abs(x) > 23) continue;
      const fr = this.mesh(L, new THREE.BoxGeometry(2.6, 3.4, c.d + 0.06), M.black, x, 2.9, c.z, false);
      const gl = this.mesh(L, new THREE.BoxGeometry(2.4, 3.2, 0.04), phys({ color: 0x9ab8c8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, envMapIntensity: 1.5 }), x, 2.9, c.z + c.d / 2 + 0.03, false);
      gl.userData.noRecv = true;
      for (let j = 1; j < 3; j++) this.mesh(L, new THREE.BoxGeometry(0.05, 3.2, 0.06), M.brass, x - 1.2 + j * 0.8, 2.9, c.z + c.d / 2 + 0.05, false);
      this.mesh(L, new THREE.BoxGeometry(2.4, 0.05, 0.06), M.brass, x, 3.6, c.z + c.d / 2 + 0.05, false);
      // inside glow of the window
      const inG = this.mesh(L, new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35 }), x, 2.9, c.z - c.d / 2 - 0.02, false); inG.rotation.y = Math.PI;
    }
  }
  roof(L, c) {
    const M = this.M;
    // the top (seen from outside) and a parapet; the underside is hidden above the ceilings
    const top = this.mesh(L, new THREE.BoxGeometry(c.w, c.h, c.d), std(0x6a6660, 0.95), c.x, c.y + c.h / 2, c.z);
    top.userData.roof = true; top.userData.keep = true; this.roofMesh = top;
    for (const [x, z, w, d] of [[c.x, c.z + c.d / 2, c.w, 0.4], [c.x, c.z - c.d / 2, c.w, 0.4], [c.x - c.w / 2, c.z, 0.4, c.d], [c.x + c.w / 2, c.z, 0.4, c.d]]) this.mesh(L, new THREE.BoxGeometry(w, 1.0, d), M.stone, x, c.y + c.h + 0.5, z);
    for (const [x, z] of [[-12, -20], [10, -26], [-4, -8]]) { this.mesh(L, new THREE.BoxGeometry(2.4, 1.2, 1.6), std(0xa8aaa8, 0.5, 0.5), x, c.y + c.h + 0.6, z); }
    // the bank's name over the entrance
    const cornice = this.mesh(L, new THREE.BoxGeometry(49, 0.5, 0.8), M.stone, 0, 6.25, 10.3);
    // a portico: two columns holding a beam with the bank's name in gold letters
    for (const x of [-4.6, 4.6]) { this.mesh(L, new THREE.CylinderGeometry(0.45, 0.5, 4.9, 20), M.stone, x, 2.45, 11.1); this.mesh(L, new THREE.BoxGeometry(1.2, 0.3, 1.2), M.stone, x, 5.0, 11.1); }
    this.mesh(L, new THREE.BoxGeometry(12, 1.1, 1.5), M.stone, 0, 5.7, 11.0);
    this.mesh(L, new THREE.PlaneGeometry(11.4, 0.85), new THREE.MeshStandardMaterial({ map: TX.sign('FIRST GOOGLY NATIONAL BANK', '#2a2418', '#f2cf6a', 2048, 150), roughness: 0.35, metalness: 0.6 }), 0, 5.7, 11.76, false);
    this.mesh(L, new THREE.BoxGeometry(10, 0.3, 2.2), M.stone, 0, 0.15, 11.4);   // the front step
  }
  building(L, c) {
    const face = c.face;
    const bases = { south: ['#8a6a5a', '#bcd0dc'], west: ['#7a5a4a', '#a8c0cc'], east: ['#6a6a72', '#b0c4d0'] }[face];
    const mat = std(0xffffff, 0.85, 0, { map: TX.facade(face, bases[0], bases[1]), emissiveMap: TX.winGlow(face), emissive: 0xffffff, emissiveIntensity: 0 });
    const g = uvBox(new THREE.BoxGeometry(c.w, c.h, c.d), c.w, c.h, c.d, 5, 5);
    const m = this.mesh(L, g, mat, c.x, c.h / 2, c.z); this.winMats = (this.winMats || []).concat(mat);
    if (face === 'south') {
      // storefronts across the street
      const shops = [['DONUTS', '#e86a9a'], ['PAWN SHOP', '#3a8a4a'], ['LAUNDROMAT', '#2a6ad8'], ['PIZZA', '#d82a1a'], ['DINER', '#e8a020'], ['BARBER', '#8a2ad8']];
      shops.forEach(([t, col], i) => { const s = this.mesh(L, new THREE.PlaneGeometry(12, 3), new THREE.MeshStandardMaterial({ map: TX.shopfront(t, col), roughness: 0.5, emissive: 0xffffff, emissiveMap: TX.shopfront(t, col), emissiveIntensity: 0.15 }), -40 + i * 16, 1.6, c.z - c.d / 2 - 0.02, false); s.rotation.y = Math.PI; this.shopMats = (this.shopMats || []).concat(s.material); });
      for (let i = 0; i < 6; i++) { const aw = this.mesh(L, new THREE.BoxGeometry(12, 0.1, 1.4), std(shops[i][1], 0.8), -40 + i * 16, 3.3, c.z - c.d / 2 - 0.7); aw.rotation.x = -0.25; }
    }
    // streetlights along the curb
    if (face === 'south') for (const x of [-40, -24, -10, 10, 24, 40]) { this.streetLight(L, x, 14.4, 0); this.streetLight(L, x + (x < 0 ? -6 : 6), 29.6, Math.PI); }
  }
  streetLight(L, x, z, rot) {
    const pole = std(0x2a2c30, 0.5, 0.6);
    this.mesh(L, new THREE.CylinderGeometry(0.08, 0.12, 6, 10), pole, x, 3, z);
    const arm = this.mesh(L, new THREE.BoxGeometry(0.08, 0.08, 1.6), pole, x, 5.9, z + (rot ? -0.8 : 0.8));
    const head = this.mesh(L, new THREE.BoxGeometry(0.4, 0.14, 0.7), pole, x, 5.85, z + (rot ? -1.5 : 1.5));
    const bulb = this.mesh(L, new THREE.BoxGeometry(0.34, 0.03, 0.6), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd890, emissiveIntensity: 0 }), x, 5.77, z + (rot ? -1.5 : 1.5), false);
    (this.streetBulbs ||= []).push(bulb);
  }
  counter(L, c) {
    const M = this.M;
    this.boxAt(L, { ...c, h: c.h - 0.06 }, M.darkwood);
    this.mesh(L, new THREE.BoxGeometry(c.w + 0.1, 0.06, c.d + 0.12), M.marble, c.x, c.h - 0.03, c.z);
    for (let x = c.x - c.w / 2 + 1; x < c.x + c.w / 2; x += 2) this.mesh(L, new THREE.BoxGeometry(1.6, 0.8, 0.02), std(0x3a2010, 0.5), x, 0.5, c.z + c.d / 2 + 0.01);
    // teller windows: little signs and pens
    for (const t of this.map.tellers) { const s = this.mesh(L, new THREE.PlaneGeometry(1.1, 0.26), new THREE.MeshStandardMaterial({ map: TX.sign('TELLER ' + (t.id + 1), '#1a3a2a', '#f2cf6a', 512, 120), roughness: 0.5 }), t.x, 2.45, c.z + 0.08, false); this.mesh(L, new THREE.BoxGeometry(0.5, 0.02, 0.3), M.paper, t.x + 0.4, c.h + 0.01, c.z + 0.2, false); }
    // cash drawers on the staff side
    this.drawers = this.map.tellers.map(t => { const d = this.mesh(L, new THREE.BoxGeometry(0.7, 0.14, 0.4), std(0x6a6e74, 0.4, 0.6), t.x, 0.9, c.z - c.d / 2 - 0.1); d.userData.keep = true; return d; });
  }
  desk(L, c) {
    const M = this.M;
    this.boxAt(L, { ...c, h: c.h - 0.05 }, M.darkwood);
    this.mesh(L, new THREE.BoxGeometry(c.w + 0.06, 0.05, c.d + 0.06), M.marble, c.x, c.h - 0.02, c.z);
    for (let i = 0; i < 4; i++) this.mesh(L, new THREE.BoxGeometry(0.22, 0.01, 0.3), M.paper, c.x - c.w / 2 + 0.4 + i * (c.w - 0.8) / 3, c.h + 0.01, c.z + rnd(-0.2, 0.2), false);
  }
  managerDesk(L, c) {
    const M = this.M;
    this.boxAt(L, c, M.darkwood);
    this.mesh(L, new THREE.BoxGeometry(c.w + 0.1, 0.05, c.d + 0.1), std(0x2a1a0a, 0.3), c.x, c.h + 0.02, c.z);
    this.mesh(L, new THREE.BoxGeometry(0.7, 0.45, 0.05), M.black, c.x - 0.6, c.h + 0.3, c.z - 0.2);
    this.mesh(L, new THREE.PlaneGeometry(0.64, 0.38), new THREE.MeshStandardMaterial({ map: TX.screen(9), emissive: 0xffffff, emissiveMap: TX.screen(9), emissiveIntensity: 0.6 }), c.x - 0.6, c.h + 0.3, c.z - 0.17, false);
    const lamp = this.mesh(L, new THREE.CylinderGeometry(0.02, 0.1, 0.4, 10), M.brass, c.x + 1, c.h + 0.2, c.z - 0.2);
    this.mesh(L, new THREE.ConeGeometry(0.16, 0.18, 14, 1, true), std(0x2a6a3a, 0.4), c.x + 1, c.h + 0.46, c.z - 0.2);
    // his chair
    this.mesh(L, new THREE.BoxGeometry(0.6, 0.1, 0.6), std(0x3a1a10, 0.5), c.x, 0.5, c.z + 1.1);
    this.mesh(L, new THREE.BoxGeometry(0.6, 0.7, 0.1), std(0x3a1a10, 0.5), c.x, 0.9, c.z + 1.4);
  }
  atm(L, c) {
    const M = this.M;
    const g = this.boxAt(L, c, std(0x3a3e46, 0.4, 0.5));
    const face = c.x + c.w / 2 + 0.01;
    const scr = this.mesh(L, new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshStandardMaterial({ color: 0x1a3a8a, emissive: 0x2a6aff, emissiveIntensity: 0.9 }), face, 1.35, c.z, false); scr.rotation.y = Math.PI / 2;
    const top = this.mesh(L, new THREE.PlaneGeometry(0.6, 0.18), new THREE.MeshStandardMaterial({ map: TX.sign('ATM', '#1a3a8a', '#fff', 256, 90, 'Arial Black'), emissive: 0xffffff, emissiveMap: TX.sign('ATM', '#1a3a8a', '#fff', 256, 90, 'Arial Black'), emissiveIntensity: 0.5 }), face, 1.75, c.z, false); top.rotation.y = Math.PI / 2;
    this.mesh(L, new THREE.BoxGeometry(0.1, 0.12, 0.34), M.grey, face + 0.05, 1.05, c.z);
    scr.userData.keep = true; (this.atmViews ||= []).push(scr);
  }
  monitors(L, c) {
    const M = this.M;
    this.boxAt(L, c, std(0x2a2c30, 0.5));
    this.monViews = [];
    for (let i = 0; i < 6; i++) {
      const x = c.x - c.w / 2 + 0.6 + (i % 3) * 1.9, y = c.h + 0.35 + Math.floor(i / 3) * 0.62;
      this.mesh(L, new THREE.BoxGeometry(1.1, 0.6, 0.1), M.black, x, y, c.z - 0.3);
      const s = this.mesh(L, new THREE.PlaneGeometry(1.0, 0.52), new THREE.MeshStandardMaterial({ map: TX.screen(i), emissive: 0xffffff, emissiveMap: TX.screen(i), emissiveIntensity: 0.9 }), x, y, c.z - 0.24, false);
      s.userData.keep = true; this.monViews.push(s);
    }
    // the guard's chair
    this.mesh(L, new THREE.BoxGeometry(0.6, 0.1, 0.6), M.black, 20.6, 0.5, -17.5);
    this.mesh(L, new THREE.BoxGeometry(0.6, 0.7, 0.1), M.black, 20.6, 0.9, -17.2);
    this.mesh(L, new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), M.chrome, 20.6, 0.23, -17.5);
  }
  chandelier(L, x, z) {
    const M = this.M, G = new THREE.Group(); G.position.set(x, 5.9, z); L.add(G);
    this.mesh(G, new THREE.CylinderGeometry(0.02, 0.02, 1, 6), M.brass, 0, -0.5, 0);
    this.mesh(G, new THREE.TorusGeometry(0.7, 0.04, 8, 24), M.brass, 0, -1.05, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this.mesh(G, new THREE.SphereGeometry(0.09, 10, 8), M.lamp, Math.cos(a) * 0.7, -0.95, Math.sin(a) * 0.7, false); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; this.mesh(G, new THREE.OctahedronGeometry(0.05), phys({ color: 0xffffff, roughness: 0, transparent: true, opacity: 0.6 }), Math.cos(a) * 0.55, -1.25, Math.sin(a) * 0.55, false); }
  }
  lobbyDecor(L) {
    const M = this.M;
    // velvet rope queue
    for (let i = 0; i < 6; i++) { const x = -6 + i * 2.4; this.mesh(L, new THREE.CylinderGeometry(0.05, 0.12, 0.95, 12), M.brass, x, 0.47, -1.6); this.mesh(L, new THREE.SphereGeometry(0.07, 10, 8), M.brass, x, 0.98, -1.6); if (i < 5) { const r = this.mesh(L, new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), std(0x8a0a1a, 0.7), x + 1.2, 0.86, -1.6); r.rotation.z = Math.PI / 2; } }
    // wall clock, portraits, the logo on the back wall behind the tellers
    const logo = this.mesh(L, new THREE.PlaneGeometry(6, 1.2), new THREE.MeshStandardMaterial({ map: TX.sign('FIRST GOOGLY NATIONAL', '#00000000', '#d8b050', 1024, 170), transparent: true, roughness: 0.3, metalness: 0.8 }), 0, 4.2, -11.73, false);
    const clk = this.mesh(L, new THREE.CylinderGeometry(0.5, 0.5, 0.06, 32), std(0xf8f4ea, 0.4), -20, 4.3, -4.28); clk.rotation.x = Math.PI / 2;
    this.mesh(L, new THREE.TorusGeometry(0.5, 0.05, 8, 32), M.brass, -20, 4.3, -4.25);
    this.clockHands = [this.mesh(L, new THREE.BoxGeometry(0.04, 0.34, 0.01), M.black, -20, 4.3, -4.22, false), this.mesh(L, new THREE.BoxGeometry(0.03, 0.44, 0.01), M.black, -20, 4.3, -4.21, false)];
    for (const h of this.clockHands) { h.geometry.translate(0, h.geometry.parameters.height / 2, 0); h.userData.keep = true; }
    for (const [x, col] of [[-22.5, 0x7a4a2a], [22.5, 0x3a4a6a]]) { const f = this.mesh(L, new THREE.BoxGeometry(0.06, 1.6, 1.2), M.brass, x + (x < 0 ? -1.3 : 1.3), 3.2, 4); f.position.x = x < 0 ? -23.72 : 23.72; const p = this.mesh(L, new THREE.PlaneGeometry(1.0, 1.4), std(col, 0.7), f.position.x + (x < 0 ? 0.04 : -0.04), 3.2, 4, false); p.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; }
    // a rug at the entrance
    this.mesh(L, new THREE.BoxGeometry(5, 0.01, 3.4), std(0x6a1a22, 0.95), 0, 0.006, 8, false);
    // the new-accounts desk: a computer and a nameplate
    this.mesh(L, new THREE.BoxGeometry(0.5, 0.35, 0.04), M.black, 22, 1.28, -3.0);
  }
  vault(L, map) {
    const M = this.M;
    // a steel-lined room: the round door sits in the thick front wall
    const frame = this.mesh(L, new THREE.TorusGeometry(1.75, 0.22, 16, 48), M.chrome, 0, 1.75, -20.35);
    const door = new THREE.Group(); door.userData.dynamic = true; door.position.set(1.6, 0, -20.3); L.add(door);   // hinge on the right
    const disc = this.mesh(door, new THREE.CylinderGeometry(1.62, 1.62, 1.1, 48), M.steel, -1.6, 1.75, -0.55); disc.rotation.x = Math.PI / 2;
    const face = this.mesh(door, new THREE.CylinderGeometry(1.5, 1.5, 0.08, 48), phys({ color: 0xc8ced6, metalness: 1, roughness: 0.2, clearcoat: 0.4 }), -1.6, 1.75, 0.02); face.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const b = this.mesh(door, new THREE.CylinderGeometry(0.09, 0.09, 0.4, 12), M.chrome, -1.6 + Math.cos(a) * 1.35, 1.75 + Math.sin(a) * 1.35, 0.0); b.rotation.x = Math.PI / 2; }
    const wheel = new THREE.Group(); wheel.position.set(-1.6, 1.75, 0.12); door.add(wheel);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 24), M.chrome));
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.06), M.chrome); s.rotation.z = i * Math.PI / 3; wheel.add(s); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 16), M.brass); hub.rotation.x = Math.PI / 2; wheel.add(hub);
    this.vaultDoor = { g: door, wheel, open: 0, want: 0 };
    // signs
    const vs = this.mesh(L, new THREE.PlaneGeometry(3, 0.5), new THREE.MeshStandardMaterial({ map: TX.sign('VAULT  ·  AUTHORIZED STAFF ONLY', '#1a1a1a', '#e8c040', 1024, 120, 'Arial Black'), roughness: 0.5 }), 0, 4, -20.33, false);
    const rs = this.mesh(L, new THREE.PlaneGeometry(2.4, 0.4), new THREE.MeshStandardMaterial({ map: TX.sign('RESERVE · TIME LOCK 6:00 PM', '#3a0a0a', '#ffd23a', 1024, 120, 'Arial Black'), roughness: 0.5 }), 0, 3.2, -28.85, false);
    // the vault's inside walls: steel skin
    for (const [x, z, w, d] of [[-7.45, -28.5, 0.1, 15], [7.45, -28.5, 0.1, 15], [0, -35.7, 15, 0.1]]) this.mesh(L, new THREE.BoxGeometry(w, 6, d), M.steel, x, 3, z);
    // the time-lock clock above the cage
    this.cageLight = this.mesh(L, new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 2 }), 1.6, 3.2, -28.9, false); this.cageLight.userData.keep = true;
  }
  depositWall(L, c) {
    const M = this.M;
    const side = c.x < 0 ? 1 : -1, fx = c.x + side * c.w / 2;
    const g = this.boxAt(L, c, M.steel);
    const face = this.mesh(L, new THREE.PlaneGeometry(c.d, 3), std(0xffffff, 0.35, 0.8, { map: TX.deposit() }), fx + side * 0.01, 1.5, c.z, false);
    face.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; face.material.map = TX.deposit().clone(); face.material.map.needsUpdate = true; face.material.map.repeat.set(c.d / 2, 1.5);
  }
  bars(L, c) {
    const M = this.M;
    const alongX = c.w > c.d, n = Math.floor((alongX ? c.w : c.d) / 0.16);
    const barGeo = new THREE.CylinderGeometry(0.025, 0.025, c.h, 6);
    const inst = new THREE.InstancedMesh(barGeo, M.chrome, n); const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const t = -0.5 + (i + 0.5) / n; m.makeTranslation(alongX ? c.x + t * c.w : c.x, c.h / 2, alongX ? c.z : c.z + t * c.d); inst.setMatrixAt(i, m); }
    inst.castShadow = true; L.add(inst);
    for (const y of [0.05, c.h - 0.05, c.h / 2]) this.mesh(L, new THREE.BoxGeometry(alongX ? c.w : 0.06, 0.06, alongX ? 0.06 : c.d), M.chrome, c.x, y, c.z);
  }
  loot(L, map) {
    const M = this.M;
    this.palletViews = map.pallets.map((p, i) => {
      const G = new THREE.Group(); G.userData.dynamic = true; G.position.set(p.x, 0, p.z); L.add(G);
      const layers = [];
      if (p.kind === 'cash') {
        this.mesh(G, new THREE.BoxGeometry(1.2, 0.14, 0.9), M.pallet, 0, 0.07, 0);
        for (let k = 0; k < 2; k++) { const l = this.mesh(G, new THREE.BoxGeometry(1.1, 0.36, 0.82), M.cash, 0, 0.14 + 0.18 + k * 0.37, 0); layers.push(l); const band = this.mesh(G, new THREE.BoxGeometry(1.12, 0.05, 0.84), std(0xe8e0c8, 0.8), 0, 0.14 + 0.18 + k * 0.37, 0); layers.push(band); }
      } else if (p.kind === 'gold') {
        this.mesh(G, new THREE.BoxGeometry(1.2, 0.5, 0.9), std(0x5a5e66, 0.5, 0.7), 0, 0.25, 0);
        for (const [x, z] of [[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]]) this.mesh(G, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), M.black, x, 0.03, z).rotation.x = Math.PI / 2;
        for (let k = 0; k < 2; k++) { const l = this.mesh(G, new THREE.BoxGeometry(1.0, 0.2, 0.7), M.goldbars, 0, 0.6 + k * 0.21, 0); layers.push(l); }
      } else {
        this.mesh(G, new THREE.CylinderGeometry(0.45, 0.55, 1.0, 24), M.marble, 0, 0.5, 0);
        const gem = this.mesh(G, new THREE.OctahedronGeometry(0.22, 0), phys({ color: 0xdff4ff, roughness: 0, transparent: true, opacity: 0.55, ior: 2.4, emissive: 0x4a8aff, emissiveIntensity: 0.8, clearcoat: 1 }), 0, 1.35, 0);
        gem.scale.y = 1.3; layers.push(gem); this.gem = gem;
        const dome = this.mesh(G, new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, 0, 1.0, 0, false); layers.push(dome);
      }
      return { G, layers, n: p.n };
    });
    // deposit box doors (open when looted)
    this.depViews = map.deposit.map(d => {
      const side = d.side, fx = side * 7.1 - side * 0.02;
      const doors = [];
      for (let k = 0; k < d.n; k++) { const door = this.mesh(L, new THREE.BoxGeometry(0.03, 0.34, 0.5), std(0xd8b870, 0.3, 0.9), fx, 0.9 + k * 0.42, d.z, false); door.userData.keep = true; doors.push(door); }
      return doors;
    });
  }
  doors(L, map) {
    const M = this.M;
    const mk = (id, c, build) => { const G = new THREE.Group(); G.userData.dynamic = true; L.add(G); build(G, c); this.doorViews[id] = { G, c, t: 0, want: 0 }; };
    for (const c of map.colliders) {
      if (!c.door) continue;
      if (c.kind === 'door') mk(c.door, c, (G, c) => {
        const alongX = c.w > c.d;
        const pivot = new THREE.Group(); pivot.position.set(alongX ? c.x - c.w / 2 : c.x, 0, alongX ? c.z : c.z - c.d / 2); G.add(pivot);
        const leaf = this.mesh(pivot, new THREE.BoxGeometry(alongX ? c.w : 0.08, c.h, alongX ? 0.08 : c.d), c.door === 'back' ? std(0x5a6a6a, 0.5, 0.6) : M.darkwood, alongX ? c.w / 2 : 0, c.h / 2, alongX ? 0 : c.d / 2);
        const kn = this.mesh(pivot, new THREE.SphereGeometry(0.06, 10, 8), M.brass, alongX ? c.w - 0.2 : 0.1, 1.05, alongX ? 0.08 : c.d - 0.2);
        this.doorViews[c.door] = { G, c, pivot, t: 0, want: 0, swing: alongX ? 1 : -1 };
        // keycard readers next to the locked doors
        if (c.door !== 'back') { const rd = this.mesh(G, new THREE.BoxGeometry(0.12, 0.18, 0.05), M.black, alongX ? c.x + c.w / 2 + 0.2 : c.x, 1.3, alongX ? c.z + (c.door === 'staff' ? 0.3 : 0.3) : c.z); const led = this.mesh(G, new THREE.BoxGeometry(0.05, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 2 }), rd.position.x, 1.36, rd.position.z + 0.03, false); this.doorViews[c.door].led = led; }
        const sign = c.door === 'staff' ? 'STAFF ONLY' : c.door === 'sec' ? 'SECURITY' : 'EXIT';
        const s = this.mesh(G, new THREE.PlaneGeometry(1.3, 0.28), new THREE.MeshStandardMaterial({ map: TX.sign(sign, c.door === 'back' ? '#1a6a2a' : '#1a1a1a', '#fff', 512, 110, 'Arial Black'), emissive: c.door === 'back' ? 0x2aff6a : 0, emissiveIntensity: 0.2 }), c.x, c.h + 0.3, c.z + (alongX ? 0.1 : 0), false);
        if (!alongX) { s.rotation.y = -Math.PI / 2; s.position.x = c.x - 0.1; }
      });
      if (c.kind === 'gate' || c.kind === 'cagedoor') mk(c.door, c, (G, c) => {
        const slide = new THREE.Group(); G.add(slide);
        const n = Math.floor(c.w / 0.14);
        for (let i = 0; i < n; i++) this.mesh(slide, new THREE.CylinderGeometry(0.025, 0.025, c.h, 6), M.chrome, c.x - c.w / 2 + (i + 0.5) * c.w / n, c.h / 2, c.z);
        for (const y of [0.1, c.h / 2, c.h - 0.1]) this.mesh(slide, new THREE.BoxGeometry(c.w, 0.06, 0.08), M.chrome, c.x, y, c.z);
        this.doorViews[c.door] = { G, c, slide, t: 0, want: 0 };
      });
    }
  }
  cameras(L, map) {
    this.camViews = map.cams.map(c => {
      const G = new THREE.Group(); G.userData.dynamic = true; G.position.set(c.x, c.y, c.z); L.add(G);
      this.mesh(G, new THREE.BoxGeometry(0.1, 0.1, 0.3), this.M.white, 0, 0.1, 0);
      const head = new THREE.Group(); G.add(head); head.rotation.y = c.yaw;
      this.mesh(head, new THREE.BoxGeometry(0.2, 0.2, 0.45), this.M.white, 0, 0, -0.15);
      this.mesh(head, new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), this.M.black, 0, 0, -0.4).rotation.x = Math.PI / 2;
      const led = this.mesh(head, new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 3 }), 0.07, 0.08, -0.38, false);
      return { G, head, led, yaw: c.yaw, t: Math.random() * 6, state: 'on' };
    });
  }
  street(L, map) {
    const M = this.M;
    // alley details: fire escape ladder, pipes, puddle; parking lot fence
    for (let y = 2; y < 11; y += 3) this.mesh(L, new THREE.BoxGeometry(0.1, 0.1, 6), std(0x2a2c30, 0.6, 0.5), 33.9, y, -24);
    this.mesh(L, new THREE.CylinderGeometry(0.1, 0.1, 12, 8), std(0x5a5e66, 0.5, 0.6), 24.4, 6, -30);
    const puddle = this.mesh(L, new THREE.CircleGeometry(1.4, 24), phys({ color: 0x1a1c20, roughness: 0.02, metalness: 0.6 }), 30.5, 0.008, -30, false); puddle.rotation.x = -Math.PI / 2;
    const fence = std(0x6a6e74, 0.5, 0.7);
    for (let x = -24; x <= 34; x += 2.5) this.mesh(L, new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), fence, x, 1.1, -44.6);
    for (const y of [0.3, 1.2, 2.1]) this.mesh(L, new THREE.BoxGeometry(58, 0.04, 0.04), fence, 5, y, -44.6);
    // trees in sidewalk pits
    for (const x of [-36, -16, 14, 38]) { this.mesh(L, new THREE.CylinderGeometry(0.12, 0.16, 3, 8), std(0x5a3a22, 0.9), x, 1.5, 13.8); const c = this.mesh(L, new THREE.SphereGeometry(1.5, 12, 10), std(0x3a7a2a, 0.9), x, 3.8, 13.8); c.scale.y = 1.2; }
  }
  vehicles(L, map) {
    const M = this.M;
    // the getaway van
    const v = this.carBody({ len: 5.6, wid: 2.2, hgt: 2.4, col: 0x2a2c30, van: true, text: 'GOOGLY PLUMBING' });
    v.position.set(map.van.x, 0, map.van.z); v.rotation.y = 0; v.userData.dynamic = true; L.add(v);
    this.van = { g: v, home: new THREE.Vector3(map.van.x, 0, map.van.z), away: 0, want: 0 };
    // the armored truck (hidden until it arrives)
    const t = this.carBody({ len: 6.8, wid: 2.4, hgt: 2.8, col: 0x4a5a4a, truck: true, text: 'GOOGLY ARMORED' });
    t.position.set(map.truck.x, 0, map.truck.z); t.rotation.y = -Math.PI / 2; t.visible = false; t.userData.dynamic = true; L.add(t);
    this.truck = { g: t, state: 'none', k: 0 };
    // police cars
    this.pcarViews = map.pcars.map(([x, z, a], i) => { const g = this.carBody({ len: 4.8, wid: 2.0, hgt: 1.45, col: 0xf2f2f2, police: true }); g.position.set(x, 0, z); g.rotation.y = a + Math.PI / 2; g.visible = false; g.userData.dynamic = true; L.add(g); return { g, x, z, a, t: 0, on: false }; });
    // the helicopter
    const h = new THREE.Group(); h.userData.dynamic = true; L.add(h); h.visible = false;
    const hb = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 2.6, 8, 16), std(0x1a2a4a, 0.4, 0.5)); hb.rotation.z = Math.PI / 2; h.add(hb);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 0.4), std(0x1a2a4a, 0.4, 0.5)); tail.position.set(-3.6, 0.3, 0); h.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.3), M.black); rotor.position.y = 1.4; h.add(rotor);
    const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; h.add(rotor2);
    const spot = new THREE.SpotLight(0xf0f4ff, this.lq ? 0 : 2000, 80, 0.2, 0.5, 1.2); spot.position.set(0, -1, 0); h.add(spot); h.add(spot.target); spot.target.position.set(0, -30, 0);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 30, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xf0f4ff, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = -16; h.add(beam);
    this.heli = { g: h, rotor, rotor2, spot, beam, t: 0, on: false };
  }
  carBody({ len, wid, hgt, col, van = false, truck = false, police = false, text = '' }) {
    const G = new THREE.Group(), M = this.M;
    const paint = phys({ color: col, roughness: 0.3, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glass = phys({ color: 0x1a2430, roughness: 0.05, metalness: 0.5, clearcoat: 1 });
    const tyre = std(0x141414, 0.9), rim = std(0xb8bcc4, 0.3, 0.9);
    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, hgt * (van || truck ? 0.78 : 0.45), len), paint); body.position.y = 0.35 + hgt * (van || truck ? 0.39 : 0.225); body.castShadow = true; G.add(body);
    if (!van && !truck) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, hgt * 0.36, len * 0.5), glass); cab.position.set(0, 0.35 + hgt * 0.45 + hgt * 0.18, -len * 0.05); cab.castShadow = true; G.add(cab);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.05, len * 0.46), paint); roof.position.set(0, 0.35 + hgt * 0.81, -len * 0.05); G.add(roof);
    } else {
      const wind = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.96, hgt * 0.32, 0.05), glass); wind.position.set(0, 0.35 + hgt * 0.6, len / 2 + 0.01); wind.rotation.x = -0.12; G.add(wind);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.03, hgt * 0.26, len * 0.18), glass); w.position.set(s * (wid / 2 + 0.01), 0.35 + hgt * 0.62, len * 0.36); G.add(w); }
      if (text) for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.62, hgt * 0.24), new THREE.MeshStandardMaterial({ map: TX.sign(text, truck ? '#3a4a3a' : '#2a2c30', truck ? '#ffd23a' : '#e8e8e8', 1024, 150, 'Arial Black'), roughness: 0.5 })); t.position.set(s * (wid / 2 + 0.02), 0.35 + hgt * 0.45, -len * 0.08); t.rotation.y = s * Math.PI / 2; G.add(t); }
      // rear doors
      const rd = new THREE.Group(); rd.position.set(0, 0.35 + hgt * 0.39, -len / 2 - 0.01); G.add(rd);
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(wid / 2 - 0.04, hgt * 0.74, 0.04), paint); d.position.x = s * wid / 4; rd.add(d); const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), M.chrome); h.position.set(s * 0.1, 0, -0.03); rd.add(h); }
      G.userData.rear = rd;
    }
    if (police) {
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.02, hgt * 0.3, len * 0.5), std(0x121418, 0.4)); d.position.set(s * (wid / 2 + 0.005), 0.35 + hgt * 0.22, 0); G.add(d); const t = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.4, hgt * 0.18), new THREE.MeshStandardMaterial({ map: TX.sign('POLICE', '#121418', '#fff', 512, 110, 'Arial Black'), roughness: 0.4 })); t.position.set(s * (wid / 2 + 0.02), 0.35 + hgt * 0.24, 0); t.rotation.y = s * Math.PI / 2; G.add(t); }
      const bar = new THREE.Group(); bar.position.set(0, 0.35 + hgt * 0.85, -len * 0.05); G.add(bar);
      const red = new THREE.MeshStandardMaterial({ color: 0xff1a1a, emissive: 0xff1a1a, emissiveIntensity: 0 }), blue = new THREE.MeshStandardMaterial({ color: 0x1a4aff, emissive: 0x1a4aff, emissiveIntensity: 0 });
      const r = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.35, 0.12, 0.3), red); r.position.x = -wid * 0.2; bar.add(r);
      const b = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.35, 0.12, 0.3), blue); b.position.x = wid * 0.2; bar.add(b);
      G.userData.lights = [red, blue];
    }
    // lights, bumpers, wheels
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.04), new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff0c0, emissiveIntensity: 0.6 })); hl.position.set(s * wid * 0.33, 0.7, len / 2 + 0.01); G.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.04), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 0.6 })); tl.position.set(s * wid * 0.36, 0.72, -len / 2 - 0.01); G.add(tl);
      for (const z of [len * 0.32, -len * 0.32]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), tyre); w.rotation.z = Math.PI / 2; w.position.set(s * (wid / 2 - 0.1), 0.36, z); w.castShadow = true; G.add(w); const rr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.27, 12), rim); rr.rotation.z = Math.PI / 2; rr.position.copy(w.position); G.add(rr); }
    }
    for (const z of [len / 2, -len / 2]) { const bp = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.05, 0.18, 0.14), std(0x2a2a2a, 0.6)); bp.position.set(0, 0.42, z); G.add(bp); }
    G.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return G;
  }
  car(L, c) {
    const cols = [0x8a1a1a, 0x1a3a6a, 0xd8d8d8, 0x2a2a2a, 0x3a6a3a, 0xc8a040, 0x6a6a72, 0xe86a1a];
    const g = this.carBody({ len: c.w, wid: c.d + 0.1, hgt: 1.45, col: cols[c.car % cols.length] });
    g.position.set(c.x, 0, c.z); g.rotation.y = Math.PI / 2 * (c.car % 2 ? 1 : -1); this.level.add(g);
  }
  beaconsInit(L) {
    // red alarm beacons high on the walls inside the bank
    const mat = new THREE.MeshStandardMaterial({ color: 0x881010, emissive: 0xff1a1a, emissiveIntensity: 0 });
    for (const [x, z] of [[-23.6, 0], [23.6, 0], [0, 9.6], [-23.6, -8], [23.6, -8], [0, -20.2], [-12, -12.4], [12, -12.4]]) { const b = this.mesh(L, new THREE.CylinderGeometry(0.14, 0.14, 0.2, 12), mat, x, 5.3, z, false); b.userData.keep = true; this.beacons.push(b); }
    this.beaconMat = mat;
    this.alarmLight = this.light(L, 0, 5, 1, 0xff1010, 0, 30);
  }
  // ------------------------------------------------------------------ the Hideout
  hideout(L, map) {
    const M = this.M = {
      concrete: std(0xffffff, 0.9, 0, { map: TX.concrete() }), metal: std(0x7a8088, 0.55, 0.6), rust: std(0x8a5a3a, 0.8, 0.2), wood: std(0x9a7a4a, 0.85), black: std(0x151518, 0.5), grey: std(0x5a5e66, 0.6), chrome: std(0xd8dee6, 0.15, 1),
      lamp: new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffe0a0, emissiveIntensity: 3 }), paper: std(0xf0ece0, 0.9), brick: std(0xffffff, 0.9, 0, { map: TX.brick() }),
    };
    this.floor(L, -15, -11, 15, 11, M.concrete, 4);
    this.floor(L, -30, 11, 30, 30, std(0xffffff, 0.92, 0, { map: TX.asphalt() }), 8, 0.0);
    const wallMat = std(0xffffff, 0.8, 0.3, { map: tex('corrugated', 256, 256, (g, w, h) => { for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#5a6068'); gr.addColorStop(0.5, '#8a9098'); gr.addColorStop(1, '#5a6068'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } }) });
    for (const c of map.colliders) {
      if (c.kind === 'hwall') this.boxAt(L, c, wallMat, 4, 4);
      if (c.kind === 'shutter') { const s = this.boxAt(L, c, std(0x9a8a5a, 0.6, 0.4)); s.scale.y = 0.25; s.position.y = 6.1; }
      if (c.kind === 'roof') { const r = this.mesh(L, new THREE.BoxGeometry(c.w, c.h, c.d), std(0x3a3e44, 0.9), c.x, c.y + c.h / 2, c.z); }
      if (c.kind === 'plantable') { this.boxAt(L, c, M.wood); const bp = this.mesh(L, new THREE.PlaneGeometry(c.w - 0.3, c.d - 0.3), new THREE.MeshStandardMaterial({ map: TX.blueprint(), roughness: 0.8 }), c.x, c.h + 0.01, c.z, false); bp.rotation.x = -Math.PI / 2; for (const [x, z] of [[-2, -3.6], [1.8, -2.5], [0.3, -3.2]]) this.mesh(L, new THREE.CylinderGeometry(0.05, 0.04, 0.1, 10), std(0xf2f2f2, 0.5), x, c.h + 0.06, z); }
      if (c.kind === 'lockers') { this.boxAt(L, c, std(0x4a5a6a, 0.5, 0.5)); for (let i = 0; i < 6; i++) this.mesh(L, new THREE.BoxGeometry(0.02, 2.2, 0.8), M.black, c.x - c.w / 2 + 0.86 * (i + 0.5), 1.25, c.z + c.d / 2 + 0.01); }
      if (c.kind === 'van') { const v = this.carBody({ len: 5.6, wid: 2.2, hgt: 2.4, col: 0x2a2c30, van: true, text: 'GOOGLY PLUMBING' }); v.position.set(c.x, 0, c.z); L.add(v); }
      if (c.kind === 'crates') { this.boxAt(L, c, M.wood, 1, 1); }
      if (c.kind === 'workbench') { this.boxAt(L, c, M.wood); for (let i = 0; i < 5; i++) this.mesh(L, new THREE.BoxGeometry(0.3, 0.08, 0.12), [M.grey, M.chrome, M.rust][i % 3], c.x - 1.2 + i * 0.6, c.h + 0.04, c.z + 0.2); }
      if (c.kind === 'board') { const b = this.mesh(L, new THREE.PlaneGeometry(c.w, c.h - 0.6), new THREE.MeshStandardMaterial({ map: TX.heistBoard(), roughness: 0.9 }), c.x, 2.6, c.z + 0.12, false); }
      if (c.kind === 'barrel') { this.mesh(L, new THREE.CylinderGeometry(c.r, c.r, 1.0, 16), std(0x2a5a8a, 0.5, 0.4), c.x, 0.5, c.z); }
    }
    for (const [x, z] of [[-6, -5], [6, -5], [-6, 5], [6, 5], [0, 0]]) { this.mesh(L, new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), M.black, x, 6.3, z); const sh = this.mesh(L, new THREE.ConeGeometry(0.5, 0.35, 16, 1, true), M.grey, x, 5.5, z); this.mesh(L, new THREE.SphereGeometry(0.14, 10, 8), M.lamp, x, 5.4, z, false); this.light(L, x, 5.2, z, 0xffd8a0, 22, 16, x === 0); }
    // the mask wall (the shop)
    const mw = this.mesh(L, new THREE.BoxGeometry(4.5, 3, 0.2), std(0x6a4a2a, 0.8), -14.6, 2.3, -6.5); mw.rotation.y = Math.PI / 2;
    const ms = this.mesh(L, new THREE.PlaneGeometry(4, 0.6), new THREE.MeshStandardMaterial({ map: TX.sign('MASKS & SKINS', '#2a1a0a', '#ffd23a', 1024, 150, 'Arial Black'), emissive: 0xffffff, emissiveMap: TX.sign('MASKS & SKINS', '#2a1a0a', '#ffd23a', 1024, 150, 'Arial Black'), emissiveIntensity: 0.3 }), -14.45, 4.2, -6.5, false); ms.rotation.y = Math.PI / 2;
    const ring = this.mesh(L, new THREE.RingGeometry(map.shop.r - 0.25, map.shop.r, 40), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.5 }), map.shop.x, 0.02, map.shop.z, false); ring.rotation.x = -Math.PI / 2; this.shopRing = ring;
    this.maskHooks = [];
    for (let i = 0; i < 8; i++) { const hk = new THREE.Group(); hk.position.set(-14.4, 1.4 + Math.floor(i / 4) * 1.2, -8 + (i % 4) * 1); hk.rotation.y = Math.PI / 2; L.add(hk); this.maskHooks.push(hk); }
  }

  // ------------------------------------------------------------------ changing things
  setTime(k) {
    // k: 0 = 4:00 PM, 1 = 6:30 PM (sunset). The sun sinks in the west (the -x side) and turns orange.
    const sunA = 0.72 - k * 0.62, az = 2.4;
    const dir = new THREE.Vector3(-Math.cos(sunA) * Math.cos(az) * 0.9 - 0.35, Math.sin(sunA), Math.cos(sunA) * 0.55).normalize();
    this.sunDir = dir; this.skyU.sunDir.value.copy(dir);
    const gold = Math.min(1, Math.max(0, (k - 0.35) / 0.65));
    const top = new THREE.Color('#4a88d0').lerp(new THREE.Color('#2a3a6a'), gold * 0.7), bot = new THREE.Color('#e4e8ea').lerp(new THREE.Color('#ff9a5a'), gold * 0.85);
    this.skyU.top.value.copy(top); this.skyU.bot.value.copy(bot);
    this.skyU.sunCol.value.set('#fff4e0').lerp(new THREE.Color('#ff7a30'), gold);
    this.sun.color.set('#fff0d8').lerp(new THREE.Color('#ff9a50'), gold);
    this.sun.intensity = 2.8 - gold * 1.3;
    this.hemi.intensity = 0.95 - gold * 0.35; this.hemi.color.set('#dfeaff').lerp(new THREE.Color('#ffb080'), gold * 0.4);
    const fog = bot.clone().lerp(top, 0.25);
    if (!this.scene.fog) this.scene.fog = new THREE.Fog(fog, 70, 300);
    this.scene.fog.color.copy(fog);
    const night = Math.max(0, (k - 0.7) / 0.3);
    for (const m of this.winMats || []) m.emissiveIntensity = night * 0.8;
    for (const b of this.streetBulbs || []) b.material.emissiveIntensity = night * 3;
    for (const m of this.shopMats || []) m.emissiveIntensity = 0.15 + night * 0.6;
    if (this.mapId === HIDEOUT) { this.sun.intensity = 1.6; this.hemi.intensity = 0.5; }
  }
  setDoor(id, open, instant = false) {
    const v = this.doorViews[id];
    if (id === 'vault') { this.vaultDoor.want = open ? 1 : 0; if (instant) this.vaultDoor.open = this.vaultDoor.want; return; }
    if (id === 'van') { this.van.want = open ? 1 : 0; if (instant) this.van.away = this.van.want; return; }
    if (id === 'truck') { this.truck.want = open ? 0 : 1; if (instant) { this.truck.k = this.truck.want; this.truck.g.visible = this.truck.k > 0.01; } return; }
    if (id.startsWith('pc')) { const p = this.pcarViews[+id.slice(2)]; if (p) { p.on = !open; if (instant) p.t = p.on ? 1 : 0; } return; }
    if (!v) return;
    v.want = open ? 1 : 0; if (instant) v.t = v.want;
    if (v.led) { v.led.material = v.led.material.clone(); v.led.material.color.set(open ? 0x2aff6a : 0xff2a2a); v.led.material.emissive.set(open ? 0x2aff6a : 0xff2a2a); }
  }
  setLoot(loot) {
    if (!this.palletViews.length) return;
    loot.p.forEach((left, i) => {
      const v = this.palletViews[i]; if (!v) return;
      const kind = this.map.pallets[i].kind;
      if (kind === 'diamond') { v.layers.forEach(l => l.visible = left > 0 || l !== this.gem); return; }
      const per = kind === 'cash' ? 2 : 1;
      v.layers.forEach((l, k) => l.visible = Math.floor(k / per) < left);
    });
    loot.d.forEach((left, i) => { const doors = this.depViews[i]; if (!doors) return; doors.forEach((d, k) => { const open = k >= left; d.rotation.y = open ? (this.map.deposit[i].side > 0 ? 1.3 : -1.3) : 0; d.position.x = (this.map.deposit[i].side * 7.1 - this.map.deposit[i].side * 0.02) + (open ? this.map.deposit[i].side * 0.2 : 0); }); });
    loot.dr.forEach((left, i) => { const d = this.drawers?.[i]; if (d) d.position.z = this.map.colliders.find(c => c.kind === 'counter').z - 0.55 - (left ? 0 : 0.35); });
    loot.a.forEach((left, i) => { const s = this.atmViews?.[i]; if (s) { s.material.color.set(left ? 0x1a3a8a : 0x8a1a1a); s.material.emissive.set(left ? 0x2a6aff : 0xff2a2a); } });
    if (this.safeDial) this.safeDial.rotation.z = loot.s ? 0 : 2;
  }
  setCams(states) { states.forEach((s, i) => { const v = this.camViews[i]; if (!v) return; v.state = s; v.led.visible = s === 'on'; if (s === 'broken') { v.head.rotation.x = 0.9; v.head.rotation.z = 0.4; } }); if (this.monViews) this.monViews.forEach((m, i) => { const s = states[i % states.length]; m.material.emissiveIntensity = s === 'on' ? 0.9 : 0.05; m.material.color.set(s === 'on' ? 0xffffff : 0x222222); }); }
  setDrill(d) {
    if (!this.drillView) {
      const G = new THREE.Group(), M = this.M;
      G.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.9), std(0xe86a10, 0.5)), { castShadow: true }));
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 10), M.chrome); arm.rotation.x = Math.PI / 2; arm.position.set(0, 0.1, -0.9); G.add(arm);
      const bit = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 10), M.chrome); bit.rotation.x = -Math.PI / 2; bit.position.set(0, 0.1, -1.7); G.add(bit);
      for (const x of [-0.3, 0.3]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), M.black); leg.position.set(x, -0.5, 0.2); G.add(leg); }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2aff6a, emissive: 0x2aff6a, emissiveIntensity: 2 })); lamp.position.set(0, 0.32, 0.3); G.add(lamp);
      this.level.add(G);
      this.drillView = { G, bit, lamp, state: 'none', t: 0 };
    }
    const v = this.drillView;
    v.state = d.state;
    v.G.visible = d.state === 'running' || d.state === 'jammed';
    if (d.on === 'vault') { v.G.position.set(-0.6, 1.6, -18.3); v.G.rotation.y = 0; }
    else if (d.on === 'truck') { v.G.position.set(this.map.truck.rear[0] - 1.9, 1.3, this.map.truck.rear[1]); v.G.rotation.y = -Math.PI / 2; }
    v.lamp.material.color.set(d.state === 'jammed' ? 0xff2a2a : 0x2aff6a); v.lamp.material.emissive.set(d.state === 'jammed' ? 0xff2a2a : 0x2aff6a);
  }
  setTruck(state) {
    this.truck.state = state;
    if (state === 'open' && this.truck.g.userData.rear) this.truck.g.userData.rear.children.forEach((d, i) => { d.rotation.y = (i ? 1 : -1) * 1.8; d.position.x = (i ? 1 : -1) * 1.2; });
  }
  setAlarm(on) { this.alarmOn = on; if (this.alarmLight) this.alarmLight.intensity = 0; }
  setHeli(on) { if (this.heli) { this.heli.on = on; this.heli.g.visible = on; } }
  // ------------------------------------------------------------------ loot bags lying around / flying
  addBag(b) {
    if (this.bagViews.has(b.id)) return this.updBag(b);
    const g = makeBag(b.kind); g.position.set(b.x, b.y + 0.2, b.z); g.rotation.y = Math.random() * 6;
    if (b.kind === 'key') { const glow = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 24), new THREE.MeshBasicMaterial({ color: 0x4ad8ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide })); glow.rotation.x = -Math.PI / 2; glow.position.y = -0.18; g.add(glow); }
    this.bagsG.add(g);
    const v = { g, b: { ...b }, vel: b.fly ? new THREE.Vector3(...b.fly) : null };
    this.bagViews.set(b.id, v);
    g.visible = !b.by;
    return v;
  }
  updBag(b) {
    const v = this.bagViews.get(b.id); if (!v) return this.addBag(b);
    v.b = { ...b }; v.g.visible = !b.by;
    if (b.fly) { v.vel = new THREE.Vector3(...b.fly); v.g.position.set(b.x, b.y, b.z); } else { v.vel = null; v.g.position.set(b.x, b.y + 0.2, b.z); }
  }
  moveBag(id, x, y, z) { const v = this.bagViews.get(id); if (v) { v.target = new THREE.Vector3(x, y + 0.2, z); } }
  rmBag(id) { const v = this.bagViews.get(id); if (v) { this.bagsG.remove(v.g); this.bagViews.delete(id); } }
  // ------------------------------------------------------------------ bullets and sparks
  tracer(o, h, color = 0x4ad8ff) {
    const a = new THREE.Vector3(...o), b = new THREE.Vector3(...h), len = a.distanceTo(b);
    if (len < 0.2) return;
    this.tracerGeo ||= new THREE.CylinderGeometry(0.018, 0.018, 1, 5, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const m = new THREE.Mesh(this.tracerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(a); m.lookAt(b); m.scale.set(1, 1, len); m.userData.noRecv = true;
    this.fx.add(m); this.parts.push({ m, life: 0.09, tracer: true });
    this.flash(a, color, 0.06, 5);
  }
  flash(p, color, life = 0.06, intensity = 6) {
    // a small pool of point lights for muzzle flashes / zaps
    this.flashPool ||= [];
    let l = this.flashPool.find(q => q.life <= 0);
    if (!l) { if (this.flashPool.length >= (this.lq ? 1 : 2)) return; const pl = new THREE.PointLight(color, 0, 7, 2); this.scene.add(pl); l = { pl, life: 0 }; this.flashPool.push(l); }
    l.pl.color.set(color); l.pl.position.copy(p); l.pl.intensity = intensity; l.life = life; l.max = life; l.i = intensity;
  }
  spark(p, color = 0xffd890, n = 6, speed = 4) {
    this.sparkGeo ||= new THREE.BoxGeometry(0.03, 0.03, 0.12);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.copy(p);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      m.lookAt(p.clone().add(v)); this.fx.add(m); this.parts.push({ m, v, life: 0.25 + Math.random() * 0.25, grav: true, fade: true });
    }
  }
  impact(h, kind) {
    const p = new THREE.Vector3(...h);
    if (kind === 'glass') { this.glassCrack(p); this.spark(p, 0xdff4ff, 5, 3); return; }
    this.spark(p, kind === 'vaultwall' || kind === 'filler' || kind === 'steel' ? 0xffd890 : 0xd8d0c0, 5, 3.5);
    this.puff(p, 0xc8c0b0, 3, 0.6);
  }
  glassCrack(p) {
    if (this.glassHits.length > 30) { const o = this.glassHits.shift(); this.fx.remove(o); }
    this.crackTex ||= tex('crack', 128, 128, (g, w) => { g.strokeStyle = '#fff'; g.lineWidth = 1.5; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(64, 64); let x = 64, y = 64; const a = i / 9 * 6.28; for (let k = 0; k < 4; k++) { x += Math.cos(a + (Math.random() - 0.5)) * 12; y += Math.sin(a + (Math.random() - 0.5)) * 12; g.lineTo(x, y); } g.stroke(); } g.beginPath(); g.arc(64, 64, 5, 0, 7); g.stroke(); }, false);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.set(p.x, p.y, -3.94); this.fx.add(m); this.glassHits.push(m);
  }
  zap(p) { this.spark(p, 0x7adfff, 14, 4); this.flash(p, 0x4ad8ff, 0.25, 12); }
  cash(p, n = 16) {
    this.billGeo ||= new THREE.PlaneGeometry(0.16, 0.07);
    this.billMat ||= new THREE.MeshStandardMaterial({ color: 0x8ac880, side: THREE.DoubleSide, roughness: 0.8 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.billGeo, this.billMat); m.position.copy(p);
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      this.fx.add(m); this.parts.push({ m, v, life: 1.6 + Math.random(), conf: true, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0), floor: 0.01, shared: true });
    }
  }
  puff(p, col = 0xffffff, n = 10, speed = 3) {
    this.dropGeo ||= new THREE.SphereGeometry(1, 6, 4);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.dropGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false }));
      m.position.copy(p); m.scale.setScalar(0.06 + Math.random() * 0.07);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.fx.add(m); this.parts.push({ m, v, life: 0.6 + Math.random() * 0.4, fade: true, grow: true });
    }
  }
  smoke(p, col = 0x9a9a9a) {
    this.smokeGeo ||= new THREE.SphereGeometry(1, 7, 5);
    const m = new THREE.Mesh(this.smokeGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, depthWrite: false }));
    m.position.copy(p); m.scale.setScalar(0.2); this.fx.add(m);
    this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.9, (Math.random() - 0.5) * 0.4), life: 2.5, smoke: true });
  }
  confetti(p, n = 60) {
    this.confGeo ||= new THREE.PlaneGeometry(0.12, 0.2);
    const cols = [0x7dff9a, 0xffd23a, 0x4ad8ff, 0xffffff];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.confGeo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
      m.position.copy(p);
      const v = new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.5) * 6);
      this.fx.add(m); this.parts.push({ m, v, life: 2 + Math.random(), spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), conf: true, floor: 0.02 });
    }
  }
  /** Keep the frame rate up: lower the resolution when frames get slow, raise it again when there's room. */
  adapt(dt) {
    this.ft = (this.ft ?? 1 / 60) * 0.95 + dt * 0.05; this.adT = (this.adT || 0) + dt;
    if (this.adT < 2 || this.lq) return;
    const fps = 1 / this.ft;
    let d = this.dpr;
    if (fps < 45 && d > 0.7) d = Math.max(0.7, d - 0.15);
    else if (fps > 58 && d < this.maxDpr) d = Math.min(this.maxDpr, d + 0.1);
    if (d !== this.dpr) { this.dpr = d; this.renderer.setPixelRatio(d); this.resize(); this.adT = 0; } else this.adT = 1.2;
  }
  update(dt, t, focus, cam) {
    this.adapt(dt);
    if (focus) this.focus.copy(focus);
    const f = this.focus;
    if (this.sunDir) { this.sun.position.copy(f).addScaledVector(this.sunDir, 120); this.sun.target.position.copy(f); }
    this.sky.position.copy(this.camera.position);
    // effects
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life -= dt;
      if (q.life <= 0) { this.fx.remove(q.m); if (!q.shared) q.m.material?.dispose?.(); this.parts.splice(i, 1); continue; }
      if (q.tracer) { q.m.material.opacity = q.life / 0.09; continue; }
      if (q.conf) { q.v.y -= 9 * dt; q.v.multiplyScalar(1 - dt * 2.2); q.m.rotation.x += q.spin.x * dt; q.m.rotation.y += q.spin.y * dt; }
      else if (q.smoke) { q.m.scale.multiplyScalar(1 + dt * 0.8); q.m.material.opacity *= 1 - dt * 0.6; }
      else { if (q.grav) q.v.y -= 9 * dt; if (q.grow) q.m.scale.multiplyScalar(1 + dt * 2.5); if (q.fade) q.m.material.opacity = Math.min(1, q.life * 3); }
      if (q.v) q.m.position.addScaledVector(q.v, dt);
      if (q.floor !== undefined && q.m.position.y < q.floor) { q.m.position.y = q.floor; q.v.set(0, 0, 0); q.m.rotation.x = -Math.PI / 2; }
    }
    for (const l of this.flashPool || []) { if (l.life > 0) { l.life -= dt; l.pl.intensity = Math.max(0, l.life / l.max) * l.i; } else l.pl.intensity = 0; }
    if (this.mapId === HIDEOUT) { if (this.shopRing) this.shopRing.material.opacity = 0.35 + Math.sin(t * 4) * 0.2; return; }
    if (this.mapId !== BANK) return;
    // doors
    for (const [id, v] of Object.entries(this.doorViews)) {
      v.t += (v.want - v.t) * (1 - Math.exp(-4 * dt));
      if (v.pivot) v.pivot.rotation.y = v.t * 1.5 * (v.swing || 1) * (id === 'back' ? -1 : 1);
      if (v.slide) v.slide.position.x = v.t * (v.c.w * 0.95);
    }
    const vd = this.vaultDoor; vd.open += (vd.want - vd.open) * (1 - Math.exp(-0.9 * dt));
    vd.g.rotation.y = vd.open * 1.75; vd.wheel.rotation.z = vd.open * 8;
    if (this.cageLight) { const open = this.doorViews.cage?.want > 0; this.cageLight.material.color.set(open ? 0x2aff6a : 0xff2a2a); this.cageLight.material.emissive.set(open ? 0x2aff6a : 0xff2a2a); }
    // the van drives off down the alley and back
    const v = this.van; if (v) { v.away += (v.want - v.away) * (1 - Math.exp(-1.2 * dt)); const k = v.away; v.g.position.set(v.home.x, 0, v.home.z + k * 40); v.g.visible = k < 0.95; }
    const tr = this.truck; if (tr) { tr.k += ((tr.want ?? 0) - tr.k) * (1 - Math.exp(-1.2 * dt)); tr.g.visible = tr.k > 0.01; tr.g.position.x = this.map.truck.x + (1 - tr.k) * 50; }
    for (const p of this.pcarViews) {
      p.t += ((p.on ? 1 : 0) - p.t) * (1 - Math.exp(-1.5 * dt)); p.g.visible = p.t > 0.02;
      const dx = Math.cos(p.a) * (1 - p.t) * 40, dz = -Math.sin(p.a) * (1 - p.t) * 40;
      p.g.position.set(p.x - (p.z > 0 ? (p.x < 0 ? 40 : -40) * (1 - p.t) : 0), 0, p.z + (p.z < 0 ? -(1 - p.t) * 20 : 0));
      const L = p.g.userData.lights; if (L && p.t > 0.02) { const ph = Math.floor(t * 6 + p.x) % 2; L[0].emissiveIntensity = ph ? 4 : 0.3; L[1].emissiveIntensity = ph ? 0.3 : 4; }
    }
    // alarm beacons
    if (this.beaconMat) { const on = this.alarmOn && Math.sin(t * 9) > 0; this.beaconMat.emissiveIntensity = on ? 5 : this.alarmOn ? 1 : 0; if (this.alarmLight) this.alarmLight.intensity = this.alarmOn ? (on ? 25 : 4) : 0; }
    // security cameras sweep
    for (const c of this.camViews) { if (c.state !== 'on') continue; c.t += dt; c.head.rotation.y = c.yaw + Math.sin(c.t * 0.4) * 0.45; }
    // the drill spins and throws sparks
    const d = this.drillView;
    if (d && d.G.visible) { if (d.state === 'running') { d.bit.rotation.z += dt * 40; d.G.position.y += Math.sin(t * 60) * 0.002; if (Math.random() < dt * 30) { const p = new THREE.Vector3(); d.bit.getWorldPosition(p); this.spark(p, 0xffc860, 2, 3); } } else if (Math.random() < dt * 4) { const p = new THREE.Vector3(); d.G.getWorldPosition(p); p.y += 0.4; this.smoke(p, 0x5a5a5a); } }
    // the diamond glitters
    if (this.gem) this.gem.rotation.y += dt * 0.8;
    // the helicopter circles
    const h = this.heli;
    if (h && h.on) { h.t += dt; const a = h.t * 0.12; h.g.position.set(Math.cos(a) * 34, 32 + Math.sin(h.t * 0.5), Math.sin(a) * 30 - 10); h.g.rotation.y = -a; h.rotor.rotation.y += dt * 30; h.rotor2.rotation.y += dt * 30; h.spot.target.position.set(Math.sin(h.t * 0.3) * 8, -30, Math.cos(h.t * 0.4) * 8); h.beam.lookAt(h.spot.target.getWorldPosition(new THREE.Vector3())); h.beam.rotateX(-Math.PI / 2); h.beam.position.set(0, 0, 0); h.beam.translateY(-15); }
    // bags in flight (client-side ballistic prediction, corrected by the server)
    for (const bv of this.bagViews.values()) {
      if (bv.vel) { bv.vel.y -= 20 * dt; bv.g.position.addScaledVector(bv.vel, dt); if (bv.g.position.y < 0.2) { bv.g.position.y = 0.2; bv.vel.multiplyScalar(0.4); bv.vel.y = 0; } bv.g.rotation.x += dt * 6; }
      if (bv.target) { bv.g.position.lerp(bv.target, 1 - Math.exp(-14 * dt)); }
      if (bv.b.kind === 'key' || bv.b.kind === 'ammo') bv.g.rotation.y += dt * 2;
    }
    // hide the roof when the camera is inside (so we see the ceiling instead of its underside, and outdoor shadow stays)
    if (this.clockHands) { const mins = (this.clockK || 0) * 150 + 0; this.clockHands[0].rotation.z = -((4 + mins / 60) / 12) * Math.PI * 2; this.clockHands[1].rotation.z = -(mins % 60) / 60 * Math.PI * 2; }
  }
}
