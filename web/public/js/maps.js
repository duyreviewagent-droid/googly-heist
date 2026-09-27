// The two places in Googly Heist: First Googly National Bank (and the street, alley and parking lot around it),
// and the Hideout warehouse where the crew waits and plans. Pure data, shared by the server and every browser.
import { indexMap } from './sim.js';

export const BANK = 0, HIDEOUT = 1;
const WALL_H = 6;

function mk(W, D) {
  const m = { W, D, colliders: [], doors: {}, h: () => 0 };
  m.box = (x0, z0, x1, z1, h, kind, extra = {}) => { const c = { t: 'b', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), y: extra.y || 0, h, kind, ...extra }; m.colliders.push(c); return c; };
  m.cyl = (x, z, r, h, kind, extra = {}) => { const c = { t: 'c', x, z, r, y: extra.y || 0, h, kind, ...extra }; m.colliders.push(c); return c; };
  // a straight wall from a to b (axis aligned) with gaps [[from,to],...] measured along it
  m.wall = (ax, az, bx, bz, th, h, kind, gaps = [], extra = {}) => {
    const alongX = az === bz, a0 = alongX ? Math.min(ax, bx) : Math.min(az, bz), a1 = alongX ? Math.max(ax, bx) : Math.max(az, bz);
    const cuts = gaps.slice().sort((p, q) => p[0] - q[0]);
    let s = a0;
    for (const [g0, g1] of cuts.concat([[a1, a1]])) {
      if (g0 - s > 0.01) { if (alongX) m.box(s, az - th / 2, g0, az + th / 2, h, kind, extra); else m.box(ax - th / 2, s, ax + th / 2, g0, h, kind, extra); }
      s = Math.max(s, g1);
    }
  };
  return m;
}

// ------------------------------------------------------------------ the bank
// x runs west→east, z runs north→south (the street is south). The building spans x -24..24, z -36..10.
function bank() {
  const m = mk(100, 90);
  m.id = BANK; m.name = 'First Googly National Bank';
  m.building = { x0: -24, x1: 24, z0: -36, z1: 10, h: WALL_H };
  const T = 0.5;
  // outside walls
  m.wall(-24, 10, 24, 10, T, WALL_H, 'front', [[-2.5, 2.5]]);
  m.wall(-24, -36, -24, 10, T, WALL_H, 'ext');
  m.wall(24, -36, 24, 10, T, WALL_H, 'ext', [[-11, -9.4]]);
  m.wall(-24, -36, 24, -36, T, WALL_H, 'ext');
  // the roof (keeps the camera inside) and the lobby's big front windows are drawn by the renderer
  m.box(-24.3, -36.3, 24.3, 10.3, 0.5, 'roof', { y: WALL_H });
  // doors: open = no longer blocks; npcPass = staff and police go through it even when it's locked
  m.doors = {
    staff: { open: false, name: 'Staff door', key: true, pick: true, x: 17, z: -4 },
    sec: { open: false, name: 'Security room door', key: true, pick: true, x: 17, z: -12 },
    gate: { open: false, name: 'Vault gate', key: true, pick: false, x: 0, z: -12 },
    back: { open: false, name: 'Back door', inside: true, x: 24, z: -10.2 },
    vault: { open: false, name: 'Vault door', drill: true, x: 0, z: -21 },
    cage: { open: false, name: 'Reserve time-lock cage', timelock: true, x: 0, z: -29 },
    van: { open: false, name: 'Getaway van' },
    truck: { open: true, name: 'Armored truck' },
    pc0: { open: true }, pc1: { open: true }, pc2: { open: true }, pc3: { open: true },
  };
  // --- lobby (z -4..10)
  for (const x of [-16, -8, 8, 16]) m.cyl(x, 3, 0.55, WALL_H, 'pillar');
  m.box(-2.2, 2.4, 2.2, 3.6, 1.05, 'desk');                     // the writing table in the middle
  m.box(-21.5, 7.6, -18.5, 8.2, 0.46, 'bench'); m.box(18.5, 7.6, 21.5, 8.2, 0.46, 'bench');
  m.box(-12, 7.6, -9, 8.2, 0.46, 'bench'); m.box(9, 7.6, 12, 8.2, 0.46, 'bench');
  m.box(-23.75, -1, -23.05, 0.2, 1.9, 'atm', { atm: 0 }); m.box(-23.75, 2.2, -23.05, 3.4, 1.9, 'atm', { atm: 1 });
  m.cyl(-22.8, 8.8, 0.45, 1.2, 'plant'); m.cyl(22.8, 8.8, 0.45, 1.2, 'plant'); m.cyl(-22.8, -2.8, 0.45, 1.2, 'plant');
  m.box(20.5, -3.2, 23.5, -2.4, 1.05, 'desk');                  // new accounts desk
  // --- teller counter with bulletproof glass on top
  m.box(-14, -4.45, 14, -3.55, 1.15, 'counter');
  m.box(-14, -4.05, 14, -3.95, 1.55, 'glass', { y: 1.15, glass: true });
  m.wall(-24, -4, -14, -4, T, WALL_H, 'wall');
  m.wall(14, -4, 24, -4, T, WALL_H, 'wall', [[16, 18]]);
  m.box(16, -4.1, 18, -3.9, 2.4, 'door', { door: 'staff', npcPass: true });
  // --- staff area (z -12..-4): tellers' side of the counter, the corridor to the back rooms
  for (const x of [-21.5, -19.5]) m.box(x - 0.9, -11.7, x + 0.9, -11.1, 1.9, 'cabinet');
  for (const x of [5.5, 7.5]) m.box(x - 0.9, -11.7, x + 0.9, -11.1, 1.9, 'cabinet');
  m.box(-23.6, -9, -22.8, -6, 1.0, 'copier');
  m.box(10.5, -9.5, 13.5, -8.5, 0.95, 'desk');                  // break table
  // --- wall z=-12 with the office doorway, the vault gate (bars) and the security door
  m.wall(-24, -12, 24, -12, T, WALL_H, 'wall', [[-18, -16], [-1.5, 1.5], [16, 18]]);
  m.box(-1.5, -12.08, 1.5, -11.92, 3.2, 'gate', { door: 'gate', npcPass: true, bars: true });
  m.box(16, -12.1, 18, -11.9, 2.4, 'door', { door: 'sec', npcPass: true });
  m.box(24, -11, 24.3, -9.4, 2.4, 'door', { door: 'back', npcPass: true });
  // --- back rooms (z -21..-12): manager's office (west), vault hall (middle), security room (east)
  m.wall(-10, -21, -10, -12, T, WALL_H, 'wall');
  m.wall(10, -21, 10, -12, T, WALL_H, 'wall');
  m.box(-19.5, -17.6, -16.5, -16.4, 0.8, 'mdesk');               // manager's desk
  m.box(-23.6, -20.6, -20, -20.1, 2.2, 'shelf');
  m.box(-12.6, -20.7, -10.6, -19.6, 1.3, 'safe', { safe: true });  // the office safe
  m.box(18, -20.6, 23.5, -19.4, 0.95, 'monitors');                  // camera monitors
  m.box(11, -20.6, 13.5, -20, 2, 'rack');
  // --- the vault: thick steel walls, the round door, and the reserve cage at the back
  m.box(-24, -36, -8, -21, WALL_H, 'filler');
  m.box(8, -36, 24, -21, WALL_H, 'filler');
  m.wall(-8, -21, 8, -21, 1.2, WALL_H, 'vaultwall', [[-1.6, 1.6]]);
  m.box(-1.6, -21.6, 1.6, -20.4, 3.2, 'vaultdoor', { door: 'vault' });
  m.wall(-7.5, -29, 7.5, -29, 0.2, 3.4, 'bars', [[-1, 1]], { bars: true });
  m.box(-1, -29.08, 1, -28.92, 3.2, 'cagedoor', { door: 'cage', bars: true });
  // deposit box walls line both sides of the main vault
  m.box(-8, -28.6, -7.1, -21.8, 3, 'boxwall'); m.box(7.1, -28.6, 8, -21.8, 3, 'boxwall');
  // --- outside: sidewalk + street (south), the alley (east), parking lot (north), the neighbours
  m.box(-50, 31, 50, 45, 14, 'building', { face: 'south' });           // across the street
  m.box(-50, -45, -24.25, 10, 12, 'building', { face: 'west' });       // west neighbour
  m.box(34, -45, 50, 10, 12, 'building', { face: 'east' });            // east neighbour (alley wall)
  // parked cars on both curbs give cover
  for (const [x, z, k] of [[-40, 16.5, 0], [-30, 16.5, 1], [-11, 28.6, 2], [9, 16.5, 3], [19, 28.6, 4], [38, 16.5, 5], [-34, 28.6, 6], [36, 28.6, 7]]) m.box(x - 2.2, z - 0.9, x + 2.2, z + 0.9, 1.45, 'car', { car: k });
  m.box(-6, 11.4, -5.4, 12, 1.0, 'mailbox'); m.cyl(6, 11.8, 0.25, 0.8, 'hydrant');
  m.box(26.4, -40, 28.4, -38.8, 1.4, 'dumpster'); m.box(31, -26, 33.4, -24.6, 1.4, 'dumpster');
  // the getaway van (the collider disappears while it's away) and the armored truck event
  m.van = { x: 29.2, z: -12.5, rear: [29.2, -16.4], zone: [24.6, -21, 33.8, -5] };
  m.box(28.05, -15.6, 30.35, -9.4, 2.5, 'van', { door: 'van' });
  m.truck = { x: -10, z: 19, rear: [-14.4, 19] };
  m.box(-13.4, 17.8, -6.6, 20.2, 2.8, 'truck', { door: 'truck' });
  // police cars pull up in these spots
  m.pcars = [[-26, 23, 0.3], [-18, 25, -0.4], [22, 23, 0.25], [14, -41, 1.3]];
  m.pcars.forEach(([x, z, a], i) => { const w = 2.1, l = 4.8, c = Math.abs(Math.cos(a)) > 0.7; m.box(x - (c ? l : w) / 2, z - (c ? w : l) / 2, x + (c ? l : w) / 2, z + (c ? w : l) / 2, 1.45, 'pcar', { door: 'pc' + i }); });

  // --- where people are and things happen
  m.zones = [
    { k: 'vault', x0: -7.4, x1: 7.4, z0: -29, z1: -21.6 },
    { k: 'reserve', x0: -7.4, x1: 7.4, z0: -35.7, z1: -29 },
    { k: 'office', x0: -24, x1: -10, z0: -21, z1: -12 },
    { k: 'hall', x0: -10, x1: 10, z0: -21, z1: -12 },
    { k: 'security', x0: 10, x1: 24, z0: -21, z1: -12 },
    { k: 'staff', x0: -24, x1: 24, z0: -12, z1: -4 },
    { k: 'lobby', x0: -24, x1: 24, z0: -4, z1: 10 },
  ];
  m.zoneAt = (x, z) => { for (const q of m.zones) if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) return q.k; return 'outside'; };
  m.restricted = k => k !== 'lobby' && k !== 'outside';
  m.inside = (x, z) => x > -24 && x < 24 && z > -36 && z < 10;
  // security cameras (seen by the guard at the monitors while he's on duty)
  m.cams = [
    { id: 0, x: -23.4, y: 4.6, z: 9.4, yaw: -2.36, zone: 'lobby' },
    { id: 1, x: 23.4, y: 4.6, z: 9.4, yaw: 2.36, zone: 'lobby' },
    { id: 2, x: -23.4, y: 4.6, z: -4.6, yaw: -0.9, zone: 'staff' },
    { id: 3, x: 23.4, y: 4.6, z: -11.4, yaw: 2.2, zone: 'staff' },
    { id: 4, x: -9.4, y: 4.6, z: -12.6, yaw: -2.3, zone: 'hall' },
  ];
  // loot
  m.tellers = [-10.5, -3.5, 3.5, 10.5].map((x, i) => ({ id: i, x, z: -5.3, drawer: [x, -4.9] }));
  m.pallets = [];
  for (const [x, z] of [[-4.8, -23.2], [-1.6, -23.2], [1.6, -23.2], [4.8, -23.2], [-4.8, -26.2], [-1.6, -26.2], [1.6, -26.2], [4.8, -26.2]]) m.pallets.push({ x, z, kind: 'cash', n: 2, room: 'vault' });
  for (const x of [-4.8, 4.8]) m.pallets.push({ x, z: -28.1, kind: 'gold', n: 2, room: 'vault' });
  for (const [x, z] of [[-4.8, -31], [-1.6, -31], [1.6, -31], [4.8, -31], [-4.8, -34], [4.8, -34]]) m.pallets.push({ x, z, kind: 'gold', n: 2, room: 'reserve' });
  m.pallets.push({ x: 0, z: -34.2, kind: 'diamond', n: 1, room: 'reserve' });
  m.pallets.forEach(p => { m.box(p.x - 0.6, p.z - 0.45, p.x + 0.6, p.z + 0.45, p.kind === 'diamond' ? 1.05 : 0.9, p.kind === 'diamond' ? 'pedestal' : p.kind === 'gold' ? 'goldcart' : 'pallet'); });
  m.deposit = [];
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) m.deposit.push({ x: side * 6.55, z: -22.5 - i * 1.4, side, n: 4 });
  m.atms = [{ x: -22.5, z: -0.4 }, { x: -22.5, z: 2.8 }];
  m.safe = { x: -11.6, z: -19.1 };
  m.monitors = { x: 20.6, z: -18.8 };
  // people
  m.lobbySpots = [[-18, 1], [-12, 5], [-6, 7], [0, 5], [6, 7], [12, 5], [18, 1], [-3, 0.2], [3, 0.2], [-10, 0.3], [10, 0.3], [-20, 7], [20, 7], [-1, 1.7], [1.2, 4.6], [22, -1.5], [-15, 8], [15, 8]];
  m.benchSpots = [[-20, 7.9], [-10.5, 7.9], [10.5, 7.9], [20, 7.9]];
  m.staffSpots = [[-8, -8], [0, -9], [8, -7], [-15, -7], [15, -7], [12, -10], [-20, -8]];
  m.officeSpots = [[-18, -15.4], [-14, -18], [-21, -14], [-12, -14]];
  m.managerLobby = [[21.8, -1.6], [18, 1.5], [12, 4.5], [20, 5]];
  m.guardPosts = [{ x: 4, z: 8, patrol: [[4, 8], [-14, 6], [-18, 0], [14, 6], [18, 0]] }, { x: -4, z: -8, patrol: [[-4, -8], [-18, -8], [8, -8], [0, -14], [-8, -16]] }, { x: 20.6, z: -17.7, seat: true }];
  m.frontDoor = [0, 11.5]; m.street = [[-46, 13], [46, 13]];
  m.copSpawns = [[-47, 22], [47, 22], [6, -43], [29, -43]];
  m.spawns = [[-1.5, 13], [1.5, 13], [-0.5, 14.5], [2.5, 14.5]];           // the crew walks up from the street
  m.custody = [29.6, -24];                                                // you come back here after custody
  return indexMap(m);
}

// ------------------------------------------------------------------ the hideout (lobby)
function hideout() {
  const m = mk(34, 26);
  m.id = HIDEOUT; m.name = 'The Hideout';
  const T = 0.5, H = 7;
  m.wall(-15, -11, 15, -11, T, H, 'hwall'); m.wall(-15, 11, 15, 11, T, H, 'hwall', [[-4, 4]]);
  m.wall(-15, -11, -15, 11, T, H, 'hwall'); m.wall(15, -11, 15, 11, T, H, 'hwall');
  m.box(-4, 11, 4, 11.3, H, 'shutter');
  m.box(-15.3, -11.3, 15.3, 11.3, 0.5, 'roof', { y: H });
  m.box(-3.2, -4.2, 3.2, -1.8, 0.95, 'plantable');          // the planning table with the blueprint
  m.box(-14.6, -10.6, -9.4, -9.4, 2.5, 'lockers');
  m.box(9, 4.5, 11.4, 10.2, 2.5, 'van');                     // the van waiting by the shutter
  m.box(-14.4, 3, -12, 8, 1.1, 'crates'); m.box(-11.6, 6.6, -10.2, 8, 0.8, 'crates');
  m.box(11, -10.6, 14.6, -8.6, 0.9, 'workbench');
  m.box(-6, -10.8, 6, -10.6, 3.2, 'board');                  // the heist board on the back wall
  m.cyl(-7.5, 1.5, 0.35, 0.5, 'barrel'); m.cyl(7, -3, 0.35, 0.95, 'barrel');
  m.shop = { x: -12, z: -6.5, r: 2.2 };                       // the mask wall
  m.spawns = [[-2, 3], [2, 3], [-3, 6], [3, 6], [0, 1], [-5, 4], [5, 4], [0, 7]];
  m.zoneAt = () => 'hideout'; m.restricted = () => false; m.inside = () => true;
  m.doors = {};
  return indexMap(m);
}

export const MAPS = [bank(), hideout()];
