// ?icon=1 — draws the app icon: a black googly in a robber's bandana running out of the bank with a bag of cash,
// blaster in hand, banknotes flying, police lights behind. Screenshot the 1024x1024 canvas for mac/icon-1024.png.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Googly, makeBag } from './googly.js';

export function renderIcon() {
  document.body.innerHTML = '';
  document.body.style.background = '#000';
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024; cv.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px';
  document.body.appendChild(cv);
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(1024, 1024, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
  // background: a dusk sky gradient with red and blue police glow
  const bg = document.createElement('canvas'); bg.width = bg.height = 512; const g = bg.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#0a1030'); gr.addColorStop(0.6, '#2a1a4a'); gr.addColorStop(1, '#4a1a2a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (const [x, c] of [[70, '#ff2a2a'], [450, '#2a5aff']]) { const rg = g.createRadialGradient(x, 330, 0, x, 330, 260); rg.addColorStop(0, c + 'cc'); rg.addColorStop(1, c + '00'); g.fillStyle = rg; g.fillRect(0, 0, 512, 512); }
  const bt = new THREE.CanvasTexture(bg); bt.colorSpace = THREE.SRGBColorSpace; scene.background = bt;
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100); cam.position.set(0.3, 1.9, 7.4); cam.lookAt(0, 1.75, 0);
  scene.add(new THREE.HemisphereLight(0xb0c0ff, 0x402030, 0.9));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(3, 5, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); scene.add(key);
  const red = new THREE.PointLight(0xff2020, 30, 12); red.position.set(-2.6, 1.6, 1.2); scene.add(red);
  const blue = new THREE.PointLight(0x2050ff, 30, 12); blue.position.set(2.6, 1.6, 1.2); scene.add(blue);
  // the bank behind: stone, two columns and the gold "BANK" sign
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 0.8 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.4), stone); wall.position.set(0, 2.5, -2.4); wall.receiveShadow = true; scene.add(wall);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc870, emissiveIntensity: 1.2 })); door.position.set(0, 1.3, -2.19); scene.add(door);
  for (const x of [-1.6, 1.6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3.4, 20), stone); c.position.set(x, 1.7, -1.9); c.castShadow = true; scene.add(c); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.7, 0.8), stone); beam.position.set(0, 3.65, -1.9); scene.add(beam);
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 160; const s = sc.getContext('2d'); s.fillStyle = '#2a2418'; s.fillRect(0, 0, 1024, 160); s.font = '900 120px Georgia, serif'; s.textAlign = 'center'; s.textBaseline = 'middle'; s.fillStyle = '#f2cf6a'; s.fillText('B A N K', 512, 88);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.62), new THREE.MeshStandardMaterial({ map: st, metalness: 0.5, roughness: 0.35 })); sign.position.set(0, 3.65, -1.49); scene.add(sign);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x5a5a60, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // the robber: a black googly, bandana on, bag of cash over the shoulder, blaster ready, mid-run
  const robber = new Googly({ color: '#1c1c20', local: true, role: 'crew' });
  robber.setMask('bandana'); robber.setArmed(true); robber.setBag('cash');
  robber.group.position.set(0, 0, 1.2); robber.group.rotation.y = -0.3; robber.group.scale.setScalar(1.5);
  scene.add(robber.group);
  for (let i = 0; i < 60; i++) robber.update(1 / 60, { speed: 5.2, pose: 'aim', aimPitch: 0.05 });
  robber.update(0.2, { speed: 5.2, pose: 'aim', aimPitch: 0.05 });
  robber.bagG.scale.setScalar(1.35); robber.bagG.position.set(0.12, 0.62, -0.38);
  // a second bag in the other hand
  // banknotes flying
  const bill = new THREE.MeshStandardMaterial({ color: 0x8ac880, side: THREE.DoubleSide, roughness: 0.7 });
  let seed = 3; const rn = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.12), bill); b.position.set(rn() * 4.4 - 2.2, 0.6 + rn() * 3.4, rn() * 2.4 - 0.2); b.rotation.set(rn() * 6, rn() * 6, rn() * 6); scene.add(b); }
  r.render(scene, cam);
  document.title = 'ICON READY';
}
