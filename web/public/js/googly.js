// The googly: a glossy jelly bean with wobbly googly eyes — robbers in masks, guards, police, SWAT, tellers and customers.
import * as THREE from 'three';

export const SCALE = 1.2;
const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function textSprite(text, { size = 44, color = '#fff', bg = 'rgba(0,0,0,.55)', border = null, pad = 12 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `900 ${size}px "Avenir Next", system-ui, sans-serif`;
  g.font = font;
  const w = g.measureText(text).width + pad * 2, h = size * 1.25 + pad * 2;
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  g.font = font;
  if (bg) { g.fillStyle = bg; rr(g, 0, 0, c.width, c.height, 16); g.fill(); }
  if (border) { g.strokeStyle = border; g.lineWidth = 5; rr(g, 3, 3, c.width - 6, c.height - 6, 14); g.stroke(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(c.width / 200, c.height / 200, 1); s.renderOrder = 10;
  return s;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x, y, r); g.closePath(); }

// ------------------------------------------------------------------ skins (bought in the shop with coins)
export const SKINS = [
  { id: 'none', name: 'Classic', price: 0, dot: c => c },
  { id: 'polka', name: 'Polka Dots', price: 100, dot: c => `radial-gradient(circle at 30% 30%, #fff 18%, transparent 20%), radial-gradient(circle at 70% 65%, #fff 16%, ${c} 18%)` },
  { id: 'camo', name: 'Camo', price: 150, dot: () => 'radial-gradient(#6b7a3a 30%, #3a2e1c 60%)' },
  { id: 'zebra', name: 'Zebra', price: 200, dot: () => 'repeating-linear-gradient(70deg,#f4f4f4 0 5px,#141414 5px 9px)' },
  { id: 'tiger', name: 'Tiger', price: 250, dot: () => 'repeating-linear-gradient(60deg,#ff8a1c 0 5px,#1a1008 5px 8px)' },
  { id: 'cookie', name: 'Cookie', price: 300, dot: () => 'radial-gradient(circle at 35% 35%, #3a2010 12%, transparent 14%), radial-gradient(circle at 65% 60%, #3a2010 10%, #c98a4a 12%)' },
  { id: 'denim', name: 'Denim', price: 350, dot: () => 'repeating-linear-gradient(45deg,#3a5f9a 0 2px,#2c4a7a 2px 4px)' },
  { id: 'galaxy', name: 'Galaxy', price: 500, dot: () => 'radial-gradient(#ff4fd8, #3a0a6a 50%, #001a3a)' },
  { id: 'chrome', name: 'Chrome', price: 700, dot: () => 'linear-gradient(135deg,#fff,#8a96a8,#fff)' },
  { id: 'rainbow', name: 'Rainbow', price: 900, dot: () => 'linear-gradient(90deg,#ff2d55,#ffd60a,#34c759,#0a84ff,#bf5af2)' },
  { id: 'lava', name: 'Lava', price: 1100, dot: () => 'radial-gradient(#ff5a00 20%, #1a0a06 70%)' },
  { id: 'gold', name: 'Solid Gold', price: 1500, dot: () => 'linear-gradient(135deg,#fff3b0,#d4a52a,#fff3b0)' },
];
const skinCache = new Map();
function skinTex(id, color) {
  const key = id + color;
  if (skinCache.has(key)) return skinCache.get(key);
  const base = new THREE.Color(color), hex = '#' + base.getHexString();
  const dk = '#' + base.clone().multiplyScalar(0.45).getHexString(), lt = '#' + base.clone().lerp(new THREE.Color('#fff'), 0.35).getHexString();
  let t = null;
  if (id === 'camo') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#6b7a3a'; g.fillRect(0, 0, w, w);
    for (const [c, n] of [['#4a5a2a', 26], ['#3a2e1c', 18], ['#8f9a5a', 16], [hex, 8]]) for (let i = 0; i < n; i++) {
      g.fillStyle = c; g.beginPath(); const x = Math.random() * w, y = Math.random() * w;
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, r = 12 + Math.random() * 22; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7); }
      g.fill();
    }
  });
  if (id === 'polka') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, w); g.fillStyle = '#fff';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 7, 0, 7); g.fill(); }
  });
  if (id === 'zebra') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#f2f2f0'; g.fillRect(0, 0, w, w); g.fillStyle = '#141414';
    for (let i = 0; i < 12; i++) { const y = i * 22 + Math.random() * 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(70, y - 16, 120, y + 20, 256, y + 4); g.lineTo(256, y + 11); g.bezierCurveTo(120, y + 26, 70, y - 6, 0, y + 9); g.fill(); }
  });
  if (id === 'tiger') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#ff8a1c'; g.fillRect(0, 0, w, w); g.fillStyle = '#1a1008';
    for (let i = 0; i < 14; i++) { const y = i * 19 + Math.random() * 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(60, y - 12, 100, y + 18, 140 + Math.random() * 60, y + 3); g.lineTo(130, y + 8); g.bezierCurveTo(90, y + 16, 50, y + 2, 0, y + 9); g.fill(); }
  });
  if (id === 'cookie') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#c98a4a'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? '#b0763a44' : '#e0a86044'; g.fillRect(Math.random() * w, Math.random() * w, 4, 4); }
    g.fillStyle = '#3a2010'; for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * w; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, r = 5 + Math.random() * 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
  });
  if (id === 'denim') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#34588f'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < w * 2; i += 3) { g.strokeStyle = i % 2 ? '#2a4674' : '#4a6fa8'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(i, 0); g.lineTo(i - w, w); g.stroke(); }
    g.strokeStyle = '#e8a33a'; g.setLineDash([6, 5]); g.lineWidth = 2.5; for (const y of [60, 196]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  if (id === 'galaxy') t = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#12002e'); gr.addColorStop(0.5, '#3a0a6a'); gr.addColorStop(1, '#001a3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { const x = Math.random() * w, y = Math.random() * h, r = 40 + Math.random() * 70; const n = g.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, ['#ff4fd8aa', '#4fc3ffaa', '#b388ffaa'][i % 3]); n.addColorStop(1, '#0000'); g.fillStyle = n; g.fillRect(0, 0, w, h); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random()})`; g.fillRect(Math.random() * w, Math.random() * h, Math.random() < 0.1 ? 2 : 1, 1); }
  });
  if (id === 'rainbow') t = canvasTex(512, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); ['#ff2d55', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff2d55'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  if (id === 'lava') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#1a0a06'; g.fillRect(0, 0, w, w); g.strokeStyle = '#ff5a00'; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { g.lineWidth = 1 + Math.random() * 4; g.beginPath(); let x = Math.random() * w, y = Math.random() * w; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  });
  if (id === 'none') t = canvasTex(128, 128, (g, w) => { g.fillStyle = hex; g.fillRect(0, 0, w, w); for (let i = 0; i < 600; i++) { g.fillStyle = Math.random() < 0.5 ? lt + '18' : dk + '18'; g.fillRect(Math.random() * w, Math.random() * w, 3, 3); } });
  skinCache.set(key, t);
  return t;
}
function skinMaterial(id, color) {
  const c = new THREE.Color(color);
  switch (id) {
    case 'gold': return new THREE.MeshPhysicalMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 });
    case 'chrome': return new THREE.MeshPhysicalMaterial({ color: 0xe8eef5, metalness: 1, roughness: 0.08, clearcoat: 1 });
    case 'lava': return new THREE.MeshPhysicalMaterial({ map: skinTex('lava', color), emissive: 0xff4a00, emissiveMap: skinTex('lava', color), emissiveIntensity: 1.8, roughness: 0.5 });
    case 'galaxy': return new THREE.MeshPhysicalMaterial({ map: skinTex('galaxy', color), emissive: 0xffffff, emissiveMap: skinTex('galaxy', color), emissiveIntensity: 0.35, roughness: 0.25, clearcoat: 1 });
    case 'camo': case 'tiger': case 'rainbow': case 'polka': case 'zebra': case 'cookie': case 'denim':
      return new THREE.MeshPhysicalMaterial({ map: skinTex(id, color), roughness: id === 'camo' || id === 'denim' || id === 'cookie' ? 0.75 : 0.35, clearcoat: id === 'camo' || id === 'denim' || id === 'cookie' ? 0 : 0.6 });
    default: return new THREE.MeshPhysicalMaterial({ color: c, map: skinTex('none', color), roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.5) });
  }
}

// ------------------------------------------------------------------ googly
// ------------------------------------------------------------------ masks (bought in the shop with your share of the loot)
export const MASKS = [
  { id: 'hockey', name: 'Hockey Mask', price: 0, dot: 'linear-gradient(#f2efe6,#d8d2c4)' },
  { id: 'bandana', name: 'Outlaw Bandana', price: 0, dot: 'radial-gradient(circle at 30% 30%,#fff 10%,#c8202a 14%)' },
  { id: 'ski', name: 'Ski Mask', price: 20000, dot: 'repeating-linear-gradient(0deg,#141418 0 3px,#24242a 3px 5px)' },
  { id: 'clown', name: 'Clown', price: 40000, dot: 'radial-gradient(#ff2a2a 22%,#fff 26%)' },
  { id: 'skull', name: 'Skull', price: 60000, dot: 'radial-gradient(#1a1a1a 18%,#e8e2d0 22%)' },
  { id: 'tiger', name: 'Tiger', price: 80000, dot: 'repeating-linear-gradient(60deg,#ff8a1c 0 5px,#1a1008 5px 8px)' },
  { id: 'panda', name: 'Panda', price: 100000, dot: 'radial-gradient(circle at 35% 45%,#111 18%,transparent 20%),radial-gradient(circle at 65% 45%,#111 18%,#fafafa 20%)' },
  { id: 'pumpkin', name: 'Pumpkin', price: 120000, dot: 'radial-gradient(#ffd23a 14%,#ff7a1a 18%)' },
  { id: 'devil', name: 'Devil', price: 150000, dot: 'radial-gradient(#ffcc00 12%,#c01818 16%)' },
  { id: 'robot', name: 'Robot', price: 200000, dot: 'linear-gradient(135deg,#dfe6ee,#7a8698,#dfe6ee)' },
  { id: 'gold', name: 'Solid Gold', price: 350000, dot: 'linear-gradient(135deg,#fff3b0,#d4a52a,#fff3b0)' },
];
// the mask is a curved shell over the googly's face with two big holes so the googly eyes still wobble through
const MW = 512, EYE_L = [173, 249], EYE_R = [339, 249], EYE_RX = 90, EYE_RY = 100, MOUTH_Y = 374;
let maskGeo = null;
function maskGeometry() {
  if (maskGeo) return maskGeo;
  const pts = [], N = 36, arcTop = 0.325 * (Math.PI / 2 - 0.3), total = arcTop + 0.29;
  for (let i = 0; i <= N; i++) {
    const s = i / N * total;
    if (s <= arcTop) { const th = 0.3 + s / 0.325; pts.push(new THREE.Vector2(0.327 * Math.sin(th), 0.59 + 0.327 * Math.cos(th))); }
    else pts.push(new THREE.Vector2(0.322, 0.59 - (s - arcTop)));
  }
  maskGeo = new THREE.LatheGeometry(pts, 40, -1.25, 2.5);
  // LatheGeometry's v runs bottom→top along our list; flip so the canvas top is the forehead
  const uv = maskGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i));
  return maskGeo;
}
const holes = (g, grow = 0) => { g.beginPath(); for (const [x, y] of [EYE_L, EYE_R]) g.ellipse(x, y, EYE_RX + grow, EYE_RY + grow, 0, 0, 7); };
const maskTexCache = new Map();
function maskTex(id) {
  if (maskTexCache.has(id)) return maskTexCache.get(id);
  const c = document.createElement('canvas'); c.width = c.height = MW; const g = c.getContext('2d');
  const W = MW, fill = col => { g.fillStyle = col; g.fillRect(0, 0, W, W); };
  const noiseDots = (n, cols, s = 3) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * W, Math.random() * W, s, s); } };
  switch (id) {
    case 'hockey': {
      fill('#efeadd'); noiseDots(1500, ['#0000000c', '#ffffff30']);
      g.fillStyle = '#c8202a'; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(256 + sx * 30, 40); g.lineTo(256 + sx * 110, 110); g.lineTo(256 + sx * 96, 124); g.lineTo(256 + sx * 30, 64); g.fill(); }
      g.fillStyle = '#2a2a2a'; for (let r = 0; r < 3; r++) for (let k = -3; k <= 3; k++) { g.beginPath(); g.arc(256 + k * 22 + (r % 2) * 11, MOUTH_Y - 20 + r * 24, 5, 0, 7); g.fill(); }
      g.strokeStyle = '#8a8478'; g.lineWidth = 3; g.beginPath(); g.moveTo(256, 20); g.lineTo(256, 150); g.stroke();
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#b8b0a0'; g.lineWidth = 6; holes(g, 3); g.stroke();
      break;
    }
    case 'bandana': {
      g.fillStyle = '#c8202a'; g.beginPath(); g.moveTo(0, 318); g.quadraticCurveTo(256, 290, W, 318); g.lineTo(W, W); g.lineTo(0, W); g.fill();
      g.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { const x = Math.random() * W, y = 330 + Math.random() * 180; g.beginPath(); g.arc(x, y, 3 + Math.random() * 4, 0, 7); g.fill(); }
      g.strokeStyle = '#fff'; g.lineWidth = 3; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(Math.random() * W, 340 + Math.random() * 160, 10, 0, 4); g.stroke(); }
      g.fillStyle = '#8a1016'; g.fillRect(0, 312, W, 10);
      break;
    }
    case 'ski': {
      fill('#18181c'); for (let y = 0; y < W; y += 5) { g.fillStyle = y % 10 ? '#222228' : '#141418'; g.fillRect(0, y, W, 3); }
      g.globalCompositeOperation = 'destination-out'; holes(g, 6); g.fill(); g.beginPath(); g.ellipse(256, MOUTH_Y + 6, 48, 26, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#34343c'; g.lineWidth = 10; holes(g, 9); g.stroke();
      break;
    }
    case 'clown': {
      fill('#fbf8f2'); g.fillStyle = '#2a6ad8';
      for (const [x, y] of [EYE_L, EYE_R]) { g.beginPath(); g.moveTo(x, y - EYE_RY - 60); g.lineTo(x + 30, y); g.lineTo(x, y + EYE_RY + 50); g.lineTo(x - 30, y); g.fill(); }
      g.strokeStyle = '#e8202a'; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(150, MOUTH_Y - 30); g.quadraticCurveTo(256, MOUTH_Y + 70, 362, MOUTH_Y - 30); g.stroke();
      g.fillStyle = '#ff8ab0aa'; for (const x of [110, 402]) { g.beginPath(); g.arc(x, MOUTH_Y - 40, 34, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'skull': {
      fill('#e8e2d0'); noiseDots(1800, ['#0000000e', '#8a7a5a18']);
      g.fillStyle = '#1a1a1a'; holes(g, 16); g.fill();
      g.beginPath(); g.moveTo(256, 300); g.lineTo(236, 345); g.lineTo(276, 345); g.fill();
      g.fillRect(150, MOUTH_Y - 16, 212, 52); g.fillStyle = '#e8e2d0'; for (let k = 0; k < 8; k++) { g.fillRect(154 + k * 26, MOUTH_Y - 14, 20, 22); g.fillRect(154 + k * 26, MOUTH_Y + 12, 20, 20); }
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'tiger': {
      fill('#ff8a1c'); g.fillStyle = '#1a1008';
      for (let i = 0; i < 9; i++) { const x = 40 + i * 54; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 18, 60, x - 6, 120); g.lineTo(x + 10, 120); g.quadraticCurveTo(x + 30, 60, x + 16, 0); g.fill(); }
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(256 + s * 250, 300 + i * 50); g.lineTo(256 + s * 150, 320 + i * 46); g.lineTo(256 + s * 250, 330 + i * 50); g.fill(); }
      g.fillStyle = '#fff6e8'; g.beginPath(); g.ellipse(256, MOUTH_Y, 120, 90, 0, 0, 7); g.fill();
      g.fillStyle = '#e86a8a'; g.beginPath(); g.moveTo(226, 320); g.lineTo(286, 320); g.lineTo(256, 350); g.fill();
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'panda': {
      fill('#fafafa'); g.fillStyle = '#111'; holes(g, 26); g.fill();
      g.beginPath(); g.ellipse(256, 330, 30, 20, 0, 0, 7); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.moveTo(256, 348); g.lineTo(256, MOUTH_Y); g.quadraticCurveTo(226, MOUTH_Y + 20, 206, MOUTH_Y); g.moveTo(256, MOUTH_Y); g.quadraticCurveTo(286, MOUTH_Y + 20, 306, MOUTH_Y); g.stroke();
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'pumpkin': {
      fill('#ff7a1a'); for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#f06a10' : '#ff8a2a'; g.fillRect(i * 52, 0, 26, W); }
      g.fillStyle = '#3a1500'; g.beginPath(); g.moveTo(236, 330); g.lineTo(276, 330); g.lineTo(256, 300); g.fill();
      g.beginPath(); g.moveTo(130, MOUTH_Y - 30); for (let k = 0; k <= 8; k++) g.lineTo(130 + k * 31.5, MOUTH_Y + (k % 2 ? -10 : 20)); g.lineTo(382, MOUTH_Y + 20); g.quadraticCurveTo(256, MOUTH_Y + 110, 130, MOUTH_Y - 30); g.fill();
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#3a1500'; g.lineWidth = 8; holes(g, 4); g.stroke();
      break;
    }
    case 'devil': {
      fill('#c01818'); noiseDots(900, ['#00000014', '#ff606020']);
      g.fillStyle = '#2a0404'; g.beginPath(); g.moveTo(140, 90); g.lineTo(230, 140); g.lineTo(140, 130); g.fill(); g.beginPath(); g.moveTo(372, 90); g.lineTo(282, 140); g.lineTo(372, 130); g.fill();
      g.strokeStyle = '#2a0404'; g.lineWidth = 12; g.beginPath(); g.moveTo(170, MOUTH_Y - 10); g.quadraticCurveTo(256, MOUTH_Y + 60, 342, MOUTH_Y - 10); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(200, MOUTH_Y + 12); g.lineTo(212, MOUTH_Y + 40); g.lineTo(222, MOUTH_Y + 16); g.fill(); g.beginPath(); g.moveTo(312, MOUTH_Y + 12); g.lineTo(300, MOUTH_Y + 40); g.lineTo(290, MOUTH_Y + 16); g.fill();
      g.fillStyle = '#2a0404'; g.beginPath(); g.moveTo(236, 470); g.lineTo(276, 470); g.lineTo(256, 512); g.fill();
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'robot': {
      fill('#c8d0da'); g.strokeStyle = '#6a7484'; g.lineWidth = 4;
      for (const y of [150, 330, 440]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (const x of [80, 432]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, W); g.stroke(); }
      g.fillStyle = '#5a6474'; for (let i = 0; i < 20; i++) { g.beginPath(); g.arc(20 + (i % 10) * 52, i < 10 ? 170 : 420, 5, 0, 7); g.fill(); }
      g.fillStyle = '#20242c'; g.fillRect(180, MOUTH_Y - 18, 152, 40); g.fillStyle = '#4ad8ff'; for (let k = 0; k < 6; k++) g.fillRect(188 + k * 24, MOUTH_Y - 10, 16, 24);
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#4ad8ff'; g.lineWidth = 8; holes(g, 5); g.stroke();
      break;
    }
    case 'gold': {
      const gr = g.createLinearGradient(0, 0, W, W); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.5, '#d4a52a'); gr.addColorStop(1, '#fff0a0'); g.fillStyle = gr; g.fillRect(0, 0, W, W);
      g.strokeStyle = '#a07818'; g.lineWidth = 5; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(256, 80, 30 + i * 12, Math.PI, 0); g.stroke(); }
      g.beginPath(); g.moveTo(180, MOUTH_Y); g.quadraticCurveTo(256, MOUTH_Y + 40, 332, MOUTH_Y); g.stroke();
      g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#a07818'; g.lineWidth = 10; holes(g, 5); g.stroke();
      break;
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  maskTexCache.set(id, t);
  return t;
}
function buildMask(id) {
  const G = new THREE.Group();
  const metal = id === 'gold' || id === 'robot';
  const m = new THREE.Mesh(maskGeometry(), new THREE.MeshPhysicalMaterial({ map: maskTex(id), alphaTest: 0.5, side: THREE.DoubleSide, roughness: id === 'ski' ? 0.95 : id === 'bandana' ? 0.8 : metal ? 0.25 : 0.4, metalness: metal ? 0.9 : 0, clearcoat: id === 'hockey' || id === 'clown' || id === 'devil' ? 0.6 : 0 }));
  m.castShadow = true; G.add(m);
  const S = (r, col, x, y, z, rough = 0.5) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), std(col, rough)); s.position.set(x, y, z); s.castShadow = true; G.add(s); return s; };
  if (id === 'clown') { S(0.06, 0xff1a1a, 0, 0.56, 0.33, 0.25); for (const x of [-0.27, 0.27]) for (let k = 0; k < 3; k++) S(0.07, 0xff7a1a, x + Math.sign(x) * 0.03, 0.62 + k * 0.08, -0.02 - k * 0.03, 0.9); }
  if (id === 'devil') for (const x of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 10), std(0x2a0404, 0.4)); h.position.set(x * 0.15, 0.9, 0.08); h.rotation.z = -x * 0.35; G.add(h); }
  if (id === 'tiger' || id === 'panda') for (const x of [-1, 1]) { const e = S(0.075, id === 'panda' ? 0x111111 : 0xff8a1c, x * 0.2, 0.86, 0, 0.8); e.scale.set(1, 1, 0.5); }
  if (id === 'robot') { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), std(0x9aa4b4, 0.3, 0.9)); a.position.set(0, 0.99, 0); G.add(a); const b = S(0.03, 0xff3a3a, 0, 1.1, 0); b.material.emissive = new THREE.Color(0xff2020); b.material.emissiveIntensity = 1.5; }
  if (id === 'ski') { const pom = S(0.06, 0x222228, 0, 0.93, -0.02, 1); pom.scale.set(1, 0.7, 1); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.325, 28, 12, 0, Math.PI * 2, 0, 1.05), std(0x1a1a1e, 0.95)); cap.position.y = 0.59; G.add(cap); }
  if (id === 'bandana') { const k = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), std(0xc8202a, 0.8)); k.position.set(0, 0.36, -0.3); k.rotation.x = Math.PI; G.add(k); }
  return G;
}

// ------------------------------------------------------------------ outfits, gear and props
const M = {
  vest: std(0x23262c, 0.75), pouch: std(0x33373e, 0.8), navy: std(0x1e2c4a, 0.7), guard: std(0x3a4a5c, 0.7), black: std(0x121316, 0.55),
  gold: std(0xffc83a, 0.3, 1), steel: std(0x9aa4b4, 0.35, 0.9), glass: new THREE.MeshPhysicalMaterial({ color: 0x0a1a12, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.8 }),
  shirt: std(0xf2f2f2, 0.6), maroon: std(0x6a1a2a, 0.7), suit: std(0x2e3038, 0.6), red: std(0xc01818, 0.5), white: std(0xfafafa, 0.6), brown: std(0x6a4a2a, 0.7), tan: std(0xc8a070, 0.8),
  bag: std(0x2a3a2a, 0.9), goldbag: std(0x3a3020, 0.85), drill: std(0xe86a10, 0.5), glove: std(0x18181a, 0.6),
};
function cyl(rt, rb, h, mat, y, open = false, seg = 24) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat); m.position.y = y; m.castShadow = true; return m; }
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function labelTex(text, bg, fg) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 256, 64); g.fillStyle = fg; g.font = '900 44px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function outfit(kind) {
  const G = new THREE.Group();
  const add = o => { G.add(o); return o; };
  const shirt = (mat, h = 0.5, y = 0.2) => add(cyl(0.312, 0.312, h, mat, y, true));
  const badge = () => { const b = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 6), M.gold)); b.rotation.x = Math.PI / 2; b.position.set(-0.13, 0.36, 0.285); };
  const belt = () => { const b = add(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 6, 24), M.black)); b.rotation.x = Math.PI / 2; b.position.y = -0.02; };
  const peakCap = (mat) => {
    add(cyl(0.29, 0.26, 0.13, mat, 0.9)); add(cyl(0.3, 0.3, 0.03, M.black, 0.84));
    const brim = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), M.black)); brim.position.set(0, 0.84, 0.2); brim.rotation.x = 0.2;
    const b = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 6), M.gold)); b.rotation.x = Math.PI / 2 - 0.1; b.position.set(0, 0.9, 0.29);
  };
  switch (kind) {
    case 'crew': {
      add(cyl(0.322, 0.322, 0.34, M.vest, 0.2, true));
      for (const x of [-0.12, 0, 0.12]) add(box(0.09, 0.11, 0.06, M.pouch, x, 0.17, 0.31));
      add(box(0.06, 0.34, 0.02, M.pouch, -0.2, 0.2, 0.25)).rotation.y = 0.6; add(box(0.06, 0.34, 0.02, M.pouch, 0.2, 0.2, 0.25)).rotation.y = -0.6;
      break;
    }
    case 'guard': shirt(M.guard); badge(); belt(); peakCap(M.guard); add(box(0.2, 0.05, 0.02, labelTexMat('SECURITY', '#3a4a5c', '#ffe07a'), 0, 0.3, -0.315)).rotation.y = Math.PI; break;
    case 'cop': shirt(M.navy); badge(); belt(); peakCap(M.navy); add(box(0.24, 0.07, 0.02, labelTexMat('POLICE', '#1e2c4a', '#fff'), 0, 0.3, -0.318)).rotation.y = Math.PI; break;
    case 'swat': case 'heavy': {
      const big = kind === 'heavy';
      add(cyl(big ? 0.35 : 0.325, big ? 0.35 : 0.325, big ? 0.5 : 0.38, M.black, 0.2, true));
      const lab = add(box(0.26, 0.08, 0.02, labelTexMat(big ? 'HEAVY' : 'SWAT', '#121316', '#e8e8e8'), 0, 0.33, big ? -0.35 : -0.33)); lab.rotation.y = Math.PI;
      add(new THREE.Mesh(new THREE.SphereGeometry(big ? 0.35 : 0.33, 24, 12, 0, Math.PI * 2, 0, 1.3), M.black)).position.y = 0.6;
      const vis = add(new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.345 : 0.335, big ? 0.345 : 0.335, big ? 0.3 : 0.1, 24, 1, true, -1.1, 2.2), big ? new THREE.MeshPhysicalMaterial({ color: 0x0a2a14, emissive: 0x0a4a1a, emissiveIntensity: 0.5, roughness: 0.1, transparent: true, opacity: 0.85 }) : M.glass)); vis.position.y = big ? 0.66 : 0.8;
      if (big) for (const x of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), M.black)).position.set(x * 0.3, 0.44, 0);
      break;
    }
    case 'teller': shirt(M.shirt, 0.46, 0.19); add(cyl(0.318, 0.318, 0.3, M.maroon, 0.17, true)); { const t = add(box(0.1, 0.05, 0.03, M.black, 0, 0.44, 0.3)); } break;
    case 'manager': {
      shirt(M.suit, 0.52, 0.19);
      add(box(0.05, 0.22, 0.02, M.red, 0, 0.3, 0.312));
      add(box(0.14, 0.2, 0.01, M.shirt, 0, 0.36, 0.308)).rotation.z = 0;
      const gl = new THREE.Group(); for (const x of [-0.125, 0.125]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 20), M.black); r.position.set(x, 0.66, 0.3); r.rotation.y = x * 2.2; gl.add(r); } G.add(gl);
      break;
    }
  }
  G.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return G;
}
const labMats = new Map();
function labelTexMat(text, bg, fg) { if (!labMats.has(text)) labMats.set(text, new THREE.MeshStandardMaterial({ map: labelTex(text, bg, fg), roughness: 0.7 })); return labMats.get(text); }
function hat(kind, color) {
  const G = new THREE.Group();
  if (kind === 'cap') { const c = new THREE.Color(color).offsetHSL(0.5, 0, -0.1); const m = std(c, 0.7); const cr = new THREE.Mesh(new THREE.SphereGeometry(0.31, 24, 10, 0, Math.PI * 2, 0, 1.0), m); cr.position.y = 0.6; G.add(cr); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), m); b.position.set(0, 0.84, 0.22); b.rotation.x = 0.15; G.add(b); }
  if (kind === 'fedora') { const m = std(0x3a2e24, 0.8); G.add(cyl(0.44, 0.44, 0.02, m, 0.84)); G.add(cyl(0.22, 0.26, 0.2, m, 0.95)); G.add(cyl(0.262, 0.262, 0.05, M.black, 0.88)); }
  if (kind === 'beanie') { const m = std(new THREE.Color(color).offsetHSL(0.3, 0, 0), 0.95); const b = new THREE.Mesh(new THREE.SphereGeometry(0.315, 20, 10, 0, Math.PI * 2, 0, 1.1), m); b.position.y = 0.62; G.add(b); G.add(cyl(0.3, 0.3, 0.08, m, 0.8)); }
  G.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return G;
}
/** The blaster everyone carries: a stubby stun rifle with a glowing strip (blue for the crew, red for the police). */
export function makeGun(color = 0x4ad8ff) {
  const G = new THREE.Group(), body = std(0x2a2c32, 0.45, 0.6), grip = std(0x16171a, 0.8);
  G.add(box(0.07, 0.1, 0.42, body, 0, 0, 0.05));
  G.add(box(0.05, 0.05, 0.3, std(0x3a3d44, 0.35, 0.8), 0, 0.02, 0.36));
  G.add(box(0.05, 0.12, 0.05, grip, 0, -0.09, -0.02)).rotation.x = -0.25;
  G.add(box(0.045, 0.08, 0.05, grip, 0, -0.07, 0.15));
  G.add(box(0.03, 0.04, 0.12, std(0x16171a, 0.5), 0, 0.075, 0.06));
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.34), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }));
  glow.position.set(0, 0.03, 0.06); G.add(glow);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3 })); tip.rotation.x = Math.PI / 2; tip.position.set(0, 0.02, 0.52); G.add(tip);
  G.traverse(o => { if (o.isMesh) o.castShadow = true; });
  G.userData.tip = tip;
  return G;
}
/** What you haul on your back: a cash duffel, a gold bag, the diamond case or the drill case. */
export function makeBag(kind) {
  const G = new THREE.Group();
  if (kind === 'cash' || kind === 'gold') {
    const mat = kind === 'gold' ? M.goldbag : M.bag;
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.38, 6, 14), mat); b.rotation.z = Math.PI / 2; b.scale.set(1, 1, 0.9); G.add(b);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 16, Math.PI), M.black); strap.position.y = 0.16; G.add(strap);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: labelTex(kind === 'gold' ? 'Au' : '$', kind === 'gold' ? '#3a3020' : '#2a3a2a', kind === 'gold' ? '#ffc83a' : '#7dff9a'), transparent: false }));
    tag.position.set(0, 0, 0.19); G.add(tag); const tag2 = tag.clone(); tag2.position.z = -0.19; tag2.rotation.y = Math.PI; G.add(tag2);
    if (kind === 'cash') for (let i = 0; i < 3; i++) { const bill = box(0.14, 0.02, 0.07, std(0x7aa870, 0.8), -0.2 + i * 0.16, 0.2, 0.02); bill.rotation.y = i; G.add(bill); }
  } else if (kind === 'diamond') {
    G.add(box(0.5, 0.3, 0.34, std(0x5a0a2a, 0.5), 0, 0, 0));
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0, transparent: true, opacity: 0.55, ior: 2.4, emissive: 0x4a8aff, emissiveIntensity: 0.6, clearcoat: 1 }));
    d.position.y = 0.26; d.scale.y = 1.2; G.add(d); G.userData.gem = d;
  } else if (kind === 'drill') {
    G.add(box(0.6, 0.32, 0.3, M.drill, 0, 0, 0)); G.add(box(0.3, 0.06, 0.06, M.black, 0, 0.2, 0));
    for (const x of [-0.2, 0.2]) G.add(box(0.06, 0.34, 0.32, std(0x2a2a2a, 0.6), x, 0, 0));
  } else if (kind === 'key') {
    G.add(box(0.14, 0.09, 0.01, std(0xf2f2f2, 0.4), 0, 0, 0)); G.add(box(0.14, 0.02, 0.012, std(0x2a6ad8, 0.4), 0, 0.02, 0));
  } else if (kind === 'ammo') {
    G.add(box(0.3, 0.18, 0.2, std(0x3a4a2a, 0.8), 0, 0, 0)); G.add(box(0.12, 0.04, 0.21, std(0xffc83a, 0.4, 0.8), 0, 0.03, 0));
  }
  G.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return G;
}

// ------------------------------------------------------------------ the googly
const UP = new THREE.Vector3(0, 1, 0);
export class Googly {
  /** role: 'crew' | 'guard' | 'cop' | 'swat' | 'heavy' | 'teller' | 'manager' | 'civ' */
  constructor({ color = '#3a3a3c', name = '', skin = 'none', local = false, role = 'crew', mask = 'hockey', hatKind = 'none', tagColor = null } = {}) {
    this.group = new THREE.Group();
    this.root = new THREE.Group(); this.root.scale.setScalar(SCALE * (role === 'heavy' ? 1.12 : 1)); this.group.add(this.root);
    this.color = color; this.local = local; this.role = role; this.tagColor = tagColor;
    this.pelvis = new THREE.Group(); this.pelvis.position.y = 0.5; this.root.add(this.pelvis);
    this.body = new THREE.Group(); this.pelvis.add(this.body);
    this.bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.38, 10, 24), std(0xffffff));
    this.bodyMesh.position.y = 0.4; this.bodyMesh.castShadow = true; this.bodyMesh.receiveShadow = true; this.body.add(this.bodyMesh);
    this.belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), std(0xffffff));
    this.belly.scale.set(1, 1.3, 0.4); this.belly.position.set(0, 0.25, 0.19); this.body.add(this.belly);
    this.eyes = [];
    for (const side of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(side * 0.125, 0.66, 0.27); e.rotation.set(-0.08, side * 0.28, 0);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.134, 0.134, 0.03, 28), std(0x15151a, 0.5)); rim.rotation.x = Math.PI / 2; e.add(rim);
      const white = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.036, 28), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1 })); white.rotation.x = Math.PI / 2; e.add(white);
      const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.012, 20), std(0x050505, 0.2)); pupil.rotation.x = Math.PI / 2; pupil.position.set(0, -0.03, 0.022); e.add(pupil);
      this.body.add(e);
      this.eyes.push({ node: e, pupil, p: new THREE.Vector2(0, -0.03), v: new THREE.Vector2(), last: null, lastV: new THREE.Vector3() });
    }
    this.brows = new THREE.Group(); this.body.add(this.brows);
    for (const side of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.03), std(0x15151a, 0.5)); b.position.set(side * 0.13, 0.83, 0.25); b.rotation.z = side * 0.35; this.brows.add(b); }
    this.brows.visible = role === 'cop' || role === 'guard';
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI), std(0x2a0c12, 0.4));
    this.mouth.position.set(0, 0.49, 0.29); this.mouth.rotation.z = Math.PI; this.body.add(this.mouth);
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1, 4, 8), std(0xffffff)); arm.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(0xffffff, 0.5)); hand.castShadow = true;
      this.body.add(arm); this.body.add(hand);
      this.arms.push({ arm, hand, side, sh: new THREE.Vector3(side * 0.29, 0.44, 0), cur: new THREE.Vector3(side * 0.36, 0.1, 0.05) });
    }
    this.hips = []; this.knees = []; this.legMeshes = [];
    const shoe = new THREE.MeshPhysicalMaterial({ color: role === 'crew' || role === 'swat' || role === 'heavy' || role === 'cop' ? 0x141416 : 0x3a2a1c, roughness: 0.35, clearcoat: 0.8 });
    for (const side of [-1, 1]) {
      const hp = new THREE.Group(); hp.position.set(side * 0.13, 0.02, 0); this.pelvis.add(hp);
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.17, 4, 8), std(0xffffff)); th.position.y = -0.12; hp.add(th);
      const kn = new THREE.Group(); kn.position.y = -0.23; hp.add(kn);
      const sn = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.17, 4, 8), std(0xffffff)); sn.position.y = -0.11; kn.add(sn);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), shoe); sh.scale.set(0.85, 0.55, 1.45); sh.position.set(0, -0.24, 0.06); kn.add(sh);
      th.castShadow = sn.castShadow = sh.castShadow = true;
      this.hips.push(hp); this.knees.push(kn); this.legMeshes.push(th, sn);
    }
    // role gear
    if (role !== 'civ') this.body.add(outfit(role));
    else if (hatKind && hatKind !== 'none' && hatKind !== 'bag' && hatKind !== 'briefcase') this.body.add(hat(hatKind, color));
    if (hatKind === 'briefcase') { this.prop = box(0.34, 0.26, 0.09, M.brown, 0, -0.16, 0); this.arms[1].hand.add(this.prop); }
    if (hatKind === 'bag') { this.prop = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), std(new THREE.Color(color).offsetHSL(0.5, 0.2, -0.2), 0.5)); this.prop.scale.set(1.2, 0.8, 0.6); this.prop.position.y = -0.14; this.arms[0].hand.add(this.prop); }
    this.gun = null; this.armed = false;
    if (role === 'crew' || role === 'cop' || role === 'swat' || role === 'heavy' || role === 'guard') {
      this.gun = makeGun(role === 'crew' ? 0x4ad8ff : 0xff3a3a); this.gun.visible = false; this.body.add(this.gun);
    }
    this.maskId = null; this.maskG = null; this.setMask(role === 'crew' ? null : null);
    this.bagG = null; this.bagKind = null;
    this.phone = null;
    this.phase = 0; this.gait = 0; this.t = Math.random() * 10; this.crouchK = 0; this.hurtT = 0; this.reachT = 0; this.shoutT = 0; this.spinT = 0; this.sitK = 0; this.lieK = 0; this.recoil = 0; this.aimPitch = 0;
    this.lastSide = 0; this.onStep = null;
    this.defaultMask = mask;
    this.setLook(color, skin);
    if (name) this.setName(name);
  }
  setLook(color, skin) {
    const key = color + skin;
    if (key === this.lookKey) return;
    this.lookKey = key; this.color = color; this.skin = skin;
    const mat = skinMaterial(skin, color);
    const c = new THREE.Color(color);
    const dark = skin === 'none' ? std(c.clone().multiplyScalar(0.62), 0.45) : mat;
    const bel = skin === 'none' ? std(c.clone().lerp(new THREE.Color('#fff'), 0.2), 0.4) : mat;
    this.bodyMesh.material = mat; this.belly.material = bel;
    const gloves = this.role === 'crew' || this.role === 'swat' || this.role === 'heavy';
    for (const a of this.arms) { a.arm.material = mat; a.hand.material = gloves ? M.glove : skin === 'none' ? bel : mat; }
    for (const l of this.legMeshes) l.material = this.role === 'cop' ? M.navy : this.role === 'swat' || this.role === 'heavy' ? M.black : this.role === 'manager' ? M.suit : this.role === 'guard' ? M.guard : dark;
    if (this.name) this.setName(this.name);
  }
  setName(name) {
    this.name = name;
    if (this.tag) this.group.remove(this.tag);
    if (this.local || !name) return;
    this.tag = textSprite(name, { size: 36, border: this.tagColor || this.color });
    this.tag.position.y = 2.3; this.group.add(this.tag);
  }
  /** Put a mask on (null takes it off). */
  setMask(id) {
    if (id === this.maskId) return;
    if (this.maskG) this.body.remove(this.maskG);
    this.maskId = id; this.maskG = null;
    if (id) { this.maskG = buildMask(id); this.body.add(this.maskG); this.maskPop = 0.35; }
    this.mouth.visible = !id;
  }
  setBag(kind) {
    if (kind === this.bagKind) return;
    if (this.bagG) this.body.remove(this.bagG);
    this.bagKind = kind; this.bagG = null;
    if (kind) { this.bagG = makeBag(kind); this.bagG.position.set(0, 0.42, -0.42); this.bagG.rotation.set(0, 0, kind === 'drill' || kind === 'diamond' ? 0 : 0.35); this.body.add(this.bagG); }
  }
  setArmed(on) { this.armed = on; if (this.gun) this.gun.visible = on; }
  setPhone(on) {
    if (!!this.phone === on) return;
    if (on) { this.phone = box(0.07, 0.13, 0.015, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x3a7aff, emissiveIntensity: 0.4 }), 0, 0.05, 0); this.arms[0].hand.add(this.phone); }
    else { this.arms[0].hand.remove(this.phone); this.phone = null; }
  }
  reach() { this.reachT = 0.4; }
  shout() { this.shoutT = 0.9; }
  fire() { this.recoil = 1; }
  hit() { this.hurtT = 0.3; }
  caught() { this.spinT = 0.8; this.hurtT = 0.35; }

  /**
   * speed: ground speed; pose: 'idle' | 'aim' | 'handsup' | 'hostage' | 'cuffed' | 'down' | 'zapped' | 'cower' | 'phone' | 'act' | 'sit' | 'cheer' | 'sad'
   * aimPitch: up/down angle of the gun when aiming.
   */
  update(dt, { speed = 0, crouch = false, onGround = true, pose = 'idle', aimPitch = 0 } = {}) {
    this.t += dt;
    this.gait += (Math.min(1, speed / 3.5) - this.gait) * (1 - Math.exp(-8 * dt));
    const run = Math.min(1, Math.max(0, (speed - 4.6) / 1.6));
    this.phase += speed / (1.25 + run * 0.35) * Math.PI * 2 * dt;
    const cr = crouch || pose === 'cower';
    this.crouchK += ((cr ? 1 : 0) - this.crouchK) * (1 - Math.exp(-12 * dt));
    const sit = pose === 'hostage' || pose === 'cuffed' || pose === 'sit';
    const lie = pose === 'down' || pose === 'zapped';
    this.sitK += ((sit ? 1 : 0) - this.sitK) * (1 - Math.exp(-7 * dt));
    this.lieK += ((lie ? 1 : 0) - this.lieK) * (1 - Math.exp(-6 * dt));
    this.aimPitch += (aimPitch - this.aimPitch) * (1 - Math.exp(-18 * dt));
    this.hurtT = Math.max(0, this.hurtT - dt); this.reachT = Math.max(0, this.reachT - dt); this.shoutT = Math.max(0, this.shoutT - dt); this.spinT = Math.max(0, this.spinT - dt); this.recoil = Math.max(0, this.recoil - dt * 9);
    if (this.maskPop > 0) { this.maskPop -= dt; const k = 1 + Math.sin(Math.max(0, this.maskPop) / 0.35 * Math.PI) * 0.15; this.maskG?.scale.setScalar(k); }
    const g = this.gait * (1 - this.crouchK * 0.5) * (1 - this.sitK) * (1 - this.lieK), s = Math.sin(this.phase), c = Math.cos(this.phase), ck = this.crouchK * (1 - this.sitK);
    const sk = this.sitK;
    for (let i = 0; i < 2; i++) {
      const ph = this.phase + (i ? Math.PI : 0), swing = Math.max(0, Math.cos(ph));
      const air = onGround ? 0 : (i ? 0.5 : -0.3);
      this.hips[i].rotation.set((-(0.7 + run * 0.25) * Math.sin(ph) * g - ck * 1.1 + air) * (1 - sk) - sk * 1.45, 0, (i ? 1 : -1) * (0.07 + ck * 0.1 + sk * 0.12));
      this.knees[i].rotation.x = ((1.3 + run * 0.4) * Math.pow(swing, 1.3) * g + 0.08 + ck * 1.9 + (onGround ? 0 : 0.6)) * (1 - sk) + sk * 1.35;
    }
    const side = s > 0 ? 0 : 1;
    if (side !== this.lastSide && g > 0.3 && onGround) this.onStep?.(side === 0 ? 1 : 0.7);
    this.lastSide = side;
    this.pelvis.position.y = 0.5 + (0.06 * Math.max(0, s) + 0.02 * Math.abs(c)) * g * (1 + run * 0.6) - ck * 0.24 - sk * 0.36;
    const hurt = Math.sin(this.hurtT / 0.35 * Math.PI) * 0.35;
    const aiming = pose === 'aim';
    const lean = (0.1 + run * 0.18) * g + ck * 0.25 - hurt + (pose === 'hostage' ? 0.3 : 0) + (pose === 'cower' ? 0.3 : 0) + (pose === 'sad' ? 0.25 : 0) - (this.shoutT > 0 ? 0.12 : 0);
    const twitch = pose === 'zapped' ? Math.sin(this.t * 40) * 0.05 * (Math.sin(this.t * 3) > 0 ? 1 : 0) : 0;
    this.body.rotation.set(lean, (aiming ? 0 : 0.12 * c * g), 0.09 * s * g * (aiming ? 0.3 : 1) + Math.sin(this.t * 0.9) * 0.02 + twitch);
    this.root.rotation.y = this.spinT > 0 ? (1 - this.spinT / 0.8) * Math.PI * 4 : 0;
    this.root.rotation.x = -this.lieK * 1.5; this.root.position.y = this.lieK * 0.3;
    const breath = 1 + Math.sin(this.t * 2.2) * 0.012 + this.hurtT * 0.2 + (this.shoutT > 0 ? Math.abs(Math.sin(this.t * 14)) * 0.04 : 0);
    this.bodyMesh.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
    // the gun: raised along the aim, or held low across the body
    const gunUp = this.armed && (aiming || this.recoil > 0);
    if (this.gun) {
      if (!this.armed) this.gun.visible = false;
      else {
        this.gun.visible = !(sit || lie || pose === 'handsup');
        const p = gunUp ? -this.aimPitch : 0.55;
        this.gun.position.set(gunUp ? 0.13 : 0.12, gunUp ? 0.44 : 0.22, gunUp ? 0.32 - this.recoil * 0.06 : 0.28);
        this.gun.rotation.set(p, gunUp ? 0 : -0.5, 0);
      }
    }
    for (const a of this.arms) {
      const sd = a.side, sw = Math.sin(this.phase + (sd > 0 ? 0 : Math.PI)) * g;
      let tx = sd * (0.36 + run * 0.04), ty = 0.1 + Math.abs(sw) * 0.08 * (1 + run), tz = 0.05 + sw * (0.26 + run * 0.12);
      if (this.armed && this.gun?.visible) {
        // right hand on the grip, left hand on the barrel
        const gp = this.gun.position, pr = this.gun.rotation.x, cs = Math.cos(pr), sn = Math.sin(pr), yaw = this.gun.rotation.y;
        const along = (d, up) => [gp.x + Math.sin(yaw) * d * cs, gp.y - d * sn + up * cs, gp.z + Math.cos(yaw) * d * cs + up * sn];
        [tx, ty, tz] = sd > 0 ? along(-0.02, -0.08) : along(0.24, -0.04);
      }
      if (this.bagG && !this.armed) { tx = sd * 0.26; ty = 0.62; tz = -0.1; }                        // hands up on the strap
      if (ck > 0.5 && !this.armed) { tx = sd * 0.3; ty = 0.02; tz = 0.28; }
      if (pose === 'handsup') { tx = sd * 0.34; ty = 1.02 + Math.sin(this.t * 3 + sd) * 0.02; tz = 0.06; }
      if (pose === 'hostage' || pose === 'cower') { tx = sd * 0.2; ty = 0.9; tz = 0.08; }            // hands on head
      if (pose === 'cuffed') { tx = sd * 0.1; ty = 0.12; tz = -0.34; }                                // behind the back
      if (pose === 'phone' && sd < 0) { tx = -0.3; ty = 0.66; tz = 0.12; }
      if (pose === 'act' && !this.armed) { tx = sd * 0.14; ty = 0.32 + Math.sin(this.t * 12 + sd) * 0.03; tz = 0.4; }
      if (pose === 'cheer') { tx = sd * 0.42; ty = 0.95 + Math.sin(this.t * 9 + sd) * 0.08; tz = 0.08; }
      if (pose === 'sad') { tx = sd * 0.24; ty = -0.05; tz = 0.12; }
      if (lie) { tx = sd * 0.45; ty = 0.5; tz = -0.1; }
      if (this.shoutT > 0 && !this.armed && pose !== 'handsup') { tx = sd * 0.4; ty = 0.5; tz = 0.35; }
      if (this.reachT > 0) { const k = Math.sin(this.reachT / 0.4 * Math.PI); tx = sd * 0.16; ty = 0.38 + k * 0.05; tz = 0.3 + k * 0.42; }
      a.cur.lerp(V.set(tx, ty, tz), 1 - Math.exp(-(this.reachT > 0 || this.armed ? 30 : 16) * dt));
      const d = V2.copy(a.cur).sub(a.sh), L = d.length();
      a.arm.position.copy(a.sh).addScaledVector(d, 0.5);
      a.arm.quaternion.setFromUnitVectors(UP, d.normalize());
      a.arm.scale.set(1, Math.max(0.05, (L - 0.1) / 1.1), 1);
      a.hand.position.copy(a.cur);
    }
    this.setPhone(pose === 'phone');
    const shocked = this.hurtT > 0 || this.spinT > 0 || pose === 'handsup' || pose === 'hostage' || pose === 'cower' || lie || pose === 'phone' || pose === 'sad';
    this.mouth.rotation.z = shocked ? 0 : Math.PI;
    this.mouth.position.y = shocked ? 0.45 : 0.49;
    const open = this.shoutT > 0 ? 1.6 : 1;
    this.mouth.scale.set(open, open, 1);
    if (this.bagG?.userData.gem) this.bagG.userData.gem.rotation.y += dt * 2;
    // googly eyes: pupils rattle around under gravity and head motion
    this.root.updateMatrixWorld(true);
    for (const e of this.eyes) {
      e.node.getWorldPosition(E); e.node.getWorldQuaternion(Qt);
      UX.set(1, 0, 0).applyQuaternion(Qt); UY.set(0, 1, 0).applyQuaternion(Qt);
      if (!e.last) { e.last = E.clone(); e.lastV.set(0, 0, 0); }
      const ve = V.copy(E).sub(e.last).divideScalar(Math.max(dt, 1e-3));
      const ae = V2.copy(ve).sub(e.lastV).divideScalar(Math.max(dt, 1e-3)); if (ae.length() > 250) ae.setLength(250);
      e.last.copy(E); e.lastV.copy(ve);
      const a3 = V3.set(0, -22, 0).sub(ae), ax = a3.dot(UX), ay = a3.dot(UY);
      for (let k = 0; k < 3; k++) {
        const h = dt / 3;
        e.v.x += ax * h; e.v.y += ay * h; e.v.multiplyScalar(1 - 1.6 * h);
        e.p.x += e.v.x * h; e.p.y += e.v.y * h;
        const maxD = 0.061, dd = e.p.length();
        if (dd > maxD) { const nx = e.p.x / dd, ny = e.p.y / dd; e.p.set(nx * maxD, ny * maxD); const vn = e.v.x * nx + e.v.y * ny; if (vn > 0) { e.v.x -= nx * vn * 1.55; e.v.y -= ny * vn * 1.55; } }
      }
      e.pupil.position.set(e.p.x, e.p.y, 0.022);
    }
  }
  /** World position of the gun's muzzle (for tracers). */
  muzzle(out) { if (this.gun?.visible) { this.gun.userData.tip.getWorldPosition(out); return out; } this.group.getWorldPosition(out); out.y += 1.3; return out; }
}
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), E = new THREE.Vector3(), UX = new THREE.Vector3(), UY = new THREE.Vector3(), Qt = new THREE.Quaternion();
