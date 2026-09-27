// Throw bags hard at walls, the counter glass, pillars and cars from all over: none may end up inside anything or outside the map.
import { Room, newPlayer } from '../public/js/core.js';
import * as S from '../public/js/sim.js';
const R = new Room({ code: 'T', solo: true, settings: { cpus: false }, out: () => {} });
const p = newPlayer({ id: 1 }); R.join(p); R.start(); R.maskUp(p);
const spots = [[0, 5, 0], [0, -2.5, Math.PI], [-20, 0, 1.57], [20, -8, -1.57], [0, -15, 0], [16, 1, 0.8], [2, -24, 0], [29, -20, 3.14], [5, 13, 0], [-7, 3.8, 1.2]];
let bad = 0, n = 0;
for (const [x, z, yaw] of spots) for (let k = 0; k < 8; k++) {
  Object.assign(p, { x, z, y: 0, yaw: yaw + k * 0.785 });
  const b = R.addBag('cash', x, 1, z); b.by = p.id; p.carry = b.id;
  const a = p.yaw, d = [-Math.sin(a), Math.random() * 0.6 - 0.1, -Math.cos(a)];
  R.dropBag(p, d); b.vx *= 2.2; b.vz *= 2.2;       // extra hard
  for (let i = 0; i < 150 && b.fly; i++) R.tickBags(1 / 30);
  if (!R.bags.has(b.id)) continue;               // landed in the van
  n++;
  const probe = { x: b.x, y: b.y, z: b.z }, before = [probe.x, probe.z];
  const pushed = S.pushOut(probe, R.map, 0.25, 0.4, 'crew');
  const inside = pushed && Math.hypot(probe.x - before[0], probe.z - before[1]) > 0.08;
  const through = R.map.inside(x, z) !== R.map.inside(b.x, b.z) && !(Math.abs(b.x) < 3 && b.z > 9) && !(Math.abs(b.z + 10.2) < 1.2 && b.x > 23);
  if (inside || through || b.fly) { bad++; console.log('BAD', { from: [x, z], to: [b.x.toFixed(2), b.y.toFixed(2), b.z.toFixed(2)], inside, through, fly: b.fly }); }
  R.bags.delete(b.id);
}
console.log(`${n} throws landed, ${bad} ended up inside something or through a wall`);
