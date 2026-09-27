// Shared physics for Googly Heist: googly movement on flat floors with walls, counters, doors and glass,
// line of sight / bullet rays, and the navigation grid (A* paths + flow fields) for everyone the computer runs.
// Runs the same in the browser (PLAY SOLO) and on the server (online lobbies).
export const GRAV = 20, JUMP_V = 6.6;
export const PR = 0.38;                   // body radius
export const PH = 1.66, PHC = 1.18;       // standing / crouching height
export const STEP = 0.47;
export const EYE = 1.42, EYEC = 0.98;
export const WALK = 4.4, SPRINT = 6.5, CROUCH = 2.3;
export const REACH = 2.1;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ------------------------------------------------------------------ colliders
// A collider is { t:'b', x,y,z,w,h,d } (box, centre x/z, bottom y) or { t:'c', x,y,z,r,h } (cylinder).
// Extra flags: glass (you see through it, but can't walk or shoot through), bars (see + shoot through, can't walk),
// door: id into map.doors — a door stops blocking when it's open; npcPass: staff, guards and police walk
// through it even while it's locked (they have keys); soft: blocks sight only.
/** Does collider c stop a body belonging to `who` ('crew' | 'npc')? */
export function blocks(map, c, who) {
  if (c.soft) return false;
  if (c.door) { const d = map.doors[c.door]; if (d && d.open) return false; if (who === 'npc' && c.npcPass) return false; }
  return true;
}
/** Spatial buckets so movement and rays only test nearby colliders. */
export function indexMap(map, B = 4) {
  const nx = Math.ceil(map.W / B), nz = Math.ceil(map.D / B), cells = Array.from({ length: nx * nz }, () => []);
  map.colliders.forEach((c, i) => {
    c.i = i;
    const hx = c.t === 'b' ? c.w / 2 : c.r, hz = c.t === 'b' ? c.d / 2 : c.r;
    const i0 = clamp(Math.floor((c.x - hx + map.W / 2) / B), 0, nx - 1), i1 = clamp(Math.floor((c.x + hx + map.W / 2) / B), 0, nx - 1);
    const j0 = clamp(Math.floor((c.z - hz + map.D / 2) / B), 0, nz - 1), j1 = clamp(Math.floor((c.z + hz + map.D / 2) / B), 0, nz - 1);
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) cells[j * nx + k].push(c);
  });
  map.grid = { B, nx, nz, cells };
  map.h = map.h || (() => 0);
  return map;
}
let stamp = 1; const seen = new Uint32Array(4096);
function near(map, x0, z0, x1, z1, fn) {
  const g = map.grid, B = g.B; stamp++;
  const i0 = clamp(Math.floor((Math.min(x0, x1) + map.W / 2) / B), 0, g.nx - 1), i1 = clamp(Math.floor((Math.max(x0, x1) + map.W / 2) / B), 0, g.nx - 1);
  const j0 = clamp(Math.floor((Math.min(z0, z1) + map.D / 2) / B), 0, g.nz - 1), j1 = clamp(Math.floor((Math.max(z0, z1) + map.D / 2) / B), 0, g.nz - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const c of g.cells[j * g.nx + i]) { if (seen[c.i] === stamp) continue; seen[c.i] = stamp; if (fn(c) === false) return; }
}

/** Highest top under a circle at (x,z) that is at most maxY (benches, the counter if you jump on it…). */
export function groundAt(map, x, z, r, maxY, who = 'crew') {
  let g = 0;
  near(map, x - r, z - r, x + r, z + r, c => {
    if (!blocks(map, c, who)) return;
    const top = c.y + c.h;
    if (top > maxY || top <= g) return;
    if (c.t === 'b') {
      const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0), dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
      if (dx * dx + dz * dz < r * r * 0.5) g = top;
    } else if (Math.hypot(x - c.x, z - c.z) < c.r + r * 0.5) g = top;
  });
  return g;
}

function resolve(p, map, h, who) {
  near(map, p.x - PR - 0.1, p.z - PR - 0.1, p.x + PR + 0.1, p.z + PR + 0.1, c => {
    if (!blocks(map, c, who)) return;
    const top = c.y + c.h;
    if (p.y + h <= c.y + 0.01 || p.y >= top - 0.01) return;
    if (p.onGround && top - p.y <= STEP) return;
    if (c.t === 'b') {
      const lx = c.x - c.w / 2, lz = c.z - c.d / 2;
      const nx = clamp(p.x, lx, lx + c.w), nz = clamp(p.z, lz, lz + c.d);
      const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= PR * PR) return;
      if (p.vy > 0 && p.y + h - p.vy * 0.04 <= c.y + 0.05) { p.y = c.y - h; p.vy = 0; return; }
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = nx + dx / d * PR; p.z = nz + dz / d * PR; }
      else {
        const ex = [p.x - lx, lx + c.w - p.x, p.z - lz, lz + c.d - p.z];
        const m = Math.min(...ex), i = ex.indexOf(m);
        if (i === 0) p.x = lx - PR; else if (i === 1) p.x = lx + c.w + PR; else if (i === 2) p.z = lz - PR; else p.z = lz + c.d + PR;
      }
    } else {
      let dx = p.x - c.x, dz = p.z - c.z; const d = Math.hypot(dx, dz), m = c.r + PR;
      if (d >= m) return;
      if (d < 1e-6) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      p.x = c.x + dx * m; p.z = c.z + dz * m;
    }
  });
}

/**
 * One movement step. p: {x,y,z,vx,vy,vz,onGround,crouch,speedMul}. inp: {dx,dz (world, length ≤ 1), jump, sprint, crouch}.
 * who: 'crew' for the robbers, 'npc' for everyone the bank or the police control.
 */
export function stepPlayer(p, inp, dt, map, who = 'crew') {
  p.crouch = !!inp.crouch;
  const h = p.crouch ? PHC : PH;
  const sp = (p.crouch ? CROUCH : inp.sprint ? SPRINT : WALK) * (p.speedMul || 1);
  let mx = inp.dx || 0, mz = inp.dz || 0; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const k = 1 - Math.exp(-(p.onGround ? 14 : 2.6) * dt);
  p.vx += (mx * sp - p.vx) * k; p.vz += (mz * sp - p.vz) * k;
  if (inp.jump && p.onGround && !p.crouch) { p.vy = JUMP_V; p.onGround = false; p.jumped = true; }
  p.vy -= GRAV * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vz) * dt / 0.18));
  for (let i = 0; i < n; i++) { p.x += p.vx * dt / n; p.z += p.vz * dt / n; resolve(p, map, h, who); }
  const was = p.onGround;
  p.y += p.vy * dt;
  const g = groundAt(map, p.x, p.z, PR, p.y + (was ? STEP : 0.05) + Math.max(0, -p.vy * dt), who);
  if (p.y <= g) { if (!was && p.vy < -9) p.landed = -p.vy; p.y = g; p.vy = 0; p.onGround = true; }
  else if (was && p.y - g < STEP && p.vy <= 0) { p.y = g; p.vy = 0; p.onGround = true; }
  else p.onGround = false;
  resolve(p, map, h, who);
  const hw = map.W / 2 - PR, hd = map.D / 2 - PR;
  p.x = clamp(p.x, -hw, hw); p.z = clamp(p.z, -hd, hd);
}

// ------------------------------------------------------------------ rays: sight and bullets
/**
 * First hit of the segment a→b. mode 'sight' passes glass and bars; 'shot' passes bars only; 'solid' passes nothing.
 * Returns { t, n:[nx,ny,nz], c } or null.
 */
export function segMap(map, ax, ay, az, bx, by, bz, mode = 'sight') {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let best = null;
  if (dy < 0 && by < 0) { const t = ay / (ay - by); best = { t, n: [0, 1, 0], c: null }; }
  near(map, ax, az, bx, bz, c => {
    if (c.soft && mode !== 'sight') return;
    if (c.door && map.doors[c.door]?.open) return;
    if (mode === 'sight' && (c.glass || c.bars)) return;
    if (mode === 'shot' && c.bars) return;
    const lim = best ? best.t : 1;
    if (c.t === 'b') {
      let t0 = 0, t1 = lim, axis = -1, sign = 0;
      const mins = [c.x - c.w / 2, c.y, c.z - c.d / 2], maxs = [c.x + c.w / 2, c.y + c.h, c.z + c.d / 2], o = [ax, ay, az], d = [dx, dy, dz];
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mins[i] || o[i] > maxs[i]) return; continue; }
        let ta = (mins[i] - o[i]) / d[i], tb = (maxs[i] - o[i]) / d[i], sg = -1;
        if (ta > tb) { const q = ta; ta = tb; tb = q; sg = 1; }
        if (ta > t0) { t0 = ta; axis = i; sign = sg; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) return;
      }
      if (axis >= 0) { const nn = [0, 0, 0]; nn[axis] = sign; best = { t: t0, n: nn, c }; }
    } else {
      const fx = ax - c.x, fz = az - c.z, A = dx * dx + dz * dz, Bq = 2 * (fx * dx + fz * dz), Cq = fx * fx + fz * fz - c.r * c.r;
      if (A < 1e-9) return;
      const disc = Bq * Bq - 4 * A * Cq; if (disc < 0) return;
      const t = (-Bq - Math.sqrt(disc)) / (2 * A);
      if (t >= 0 && t <= lim) { const y = ay + dy * t; if (y >= c.y && y <= c.y + c.h) best = { t, n: [(fx + dx * t) / c.r, 0, (fz + dz * t) / c.r], c }; }
    }
  });
  return best;
}
export const canSee = (map, a, b) => !segMap(map, a[0], a[1], a[2], b[0], b[1], b[2], 'sight');
export const eyeOf = p => [p.x, p.y + (p.crouch ? EYEC : EYE), p.z];
export const chestOf = p => [p.x, p.y + (p.down ? 0.3 : p.crouch ? 0.72 : 1.0), p.z];
export const headOf = p => [p.x, p.y + (p.down ? 0.4 : (p.crouch ? PHC : PH) - 0.18), p.z];
export const seesBody = (map, eye, q) => canSee(map, eye, headOf(q)) || canSee(map, eye, chestOf(q));
/** The shape a googly's body has for bullets: a vertical capsule that fits the jelly bean (smaller when sitting or ducking). */
export function bodyShape(q) {
  const k = q.big ? 1.12 : 1;
  switch (q.pose) {
    case 'lie': return { r: 0.5, h: 0.62, head: 0 };
    case 'sit': return { r: 0.37 * k, h: 1.22 * k, head: 0.38 * k };
    case 'crouch': return { r: 0.36 * k, h: 1.32 * k, head: 0.4 * k };
    default: return { r: 0.35 * k, h: 1.67 * k, head: 0.42 * k };
  }
}
/** Where a ray from o along unit dir d first touches body q ({x,y,z,pose,big}): { d, head } or null. */
export function rayBody(ox, oy, oz, dx, dy, dz, q, maxD) {
  const { r, h, head } = bodyShape(q);
  const y0 = q.y + r, y1 = q.y + Math.max(r, h - r);
  let best = Infinity;
  // the straight middle
  const fx = ox - q.x, fz = oz - q.z, A = dx * dx + dz * dz;
  if (A > 1e-9) {
    const B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - r * r, disc = B * B - 4 * A * C;
    if (disc >= 0) { const t = (-B - Math.sqrt(disc)) / (2 * A); if (t >= 0) { const y = oy + dy * t; if (y >= y0 && y <= y1) best = t; } }
  }
  // the round top and bottom
  for (const cy of [y0, y1]) {
    const px = ox - q.x, py = oy - cy, pz = oz - q.z;
    const b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - r * r, disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t >= 0 && t < best) { const y = oy + dy * t; if (cy === y0 ? y <= y0 : y >= y1) best = t; }
  }
  if (best > maxD) return null;
  const y = oy + dy * best;
  return { d: best, head: head > 0 && y > q.y + h - head };
}
/** Push a round thing (radius r, height h) out of anything solid it overlaps; returns the push normal or null. */
export function pushOut(p, map, r, h, who = 'npc') {
  let nx = 0, nz = 0;
  near(map, p.x - r - 0.1, p.z - r - 0.1, p.x + r + 0.1, p.z + r + 0.1, c => {
    if (!blocks(map, c, who)) return;
    if (p.y + h <= c.y + 0.01 || p.y >= c.y + c.h - 0.01) return;
    if (c.t === 'b') {
      const lx = c.x - c.w / 2, lz = c.z - c.d / 2, qx = clamp(p.x, lx, lx + c.w), qz = clamp(p.z, lz, lz + c.d);
      let dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
      if (d >= r) return;
      if (d < 1e-6) { const ex = [p.x - lx, lx + c.w - p.x, p.z - lz, lz + c.d - p.z], i = ex.indexOf(Math.min(...ex)); dx = [-1, 1, 0, 0][i]; dz = [0, 0, -1, 1][i]; d = 0; const push = ex[i] + r; p.x += dx * push; p.z += dz * push; }
      else { p.x = qx + dx / d * r; p.z = qz + dz / d * r; dx /= d; dz /= d; }
      nx += dx; nz += dz;
    } else {
      let dx = p.x - c.x, dz = p.z - c.z; const d = Math.hypot(dx, dz), m = c.r + r;
      if (d >= m) return;
      if (d < 1e-6) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      p.x = c.x + dx * m; p.z = c.z + dz * m; nx += dx; nz += dz;
    }
  });
  const l = Math.hypot(nx, nz);
  return l > 0 ? [nx / l, nz / l] : null;
}

// ------------------------------------------------------------------ navigation: a flat grid of walkable cells
export function buildNav(map, who, cell = 0.5) {
  const nx = Math.floor(map.W / cell), nz = Math.floor(map.D / cell), N = nx * nz;
  const open = new Uint8Array(N), edge = new Uint8Array(N);
  const x0 = -map.W / 2, z0 = -map.D / 2, pad = PR + 0.06;
  const cx = i => x0 + (i + 0.5) * cell, cz = j => z0 + (j + 0.5) * cell;
  open.fill(1);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (Math.abs(cx(i)) > map.W / 2 - 1 || Math.abs(cz(j)) > map.D / 2 - 1) open[j * nx + i] = 0;
  for (const c of map.colliders) {
    if (!blocks(map, c, who)) continue;
    if (c.y > PH - 0.1) continue;       // overhead things (the roof)
    const hx = (c.t === 'b' ? c.w / 2 : c.r) + pad + 0.3, hz = (c.t === 'b' ? c.d / 2 : c.r) + pad + 0.3;
    const i0 = Math.max(0, Math.floor((c.x - hx - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((c.x + hx - x0) / cell));
    const j0 = Math.max(0, Math.floor((c.z - hz - z0) / cell)), j1 = Math.min(nz - 1, Math.floor((c.z + hz - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = cx(i), z = cz(j);
      let d;
      if (c.t === 'b') d = Math.hypot(Math.max(Math.abs(x - c.x) - c.w / 2, 0), Math.max(Math.abs(z - c.z) - c.d / 2, 0));
      else d = Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r);
      if (d < pad) open[j * nx + i] = 0; else if (d < pad + 0.35) edge[j * nx + i] = 1;
    }
  }
  return { nx, nz, cell, open, edge, x0, z0, cx, cz, who };
}
const cellOf = (nav, x, z) => clamp(Math.floor((x - nav.x0) / nav.cell), 0, nav.nx - 1) + clamp(Math.floor((z - nav.z0) / nav.cell), 0, nav.nz - 1) * nav.nx;
export function nearestOpen(nav, x, z, maxR = 12) {
  const c = cellOf(nav, x, z); if (nav.open[c]) return c;
  const i0 = c % nav.nx, j0 = (c / nav.nx) | 0;
  for (let r = 1; r < maxR; r++) {
    let best = -1, bd = 1e9;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) continue;
      const k = j * nav.nx + i; if (!nav.open[k]) continue;
      const d = di * di + dj * dj; if (d < bd) { bd = d; best = k; }
    }
    if (best >= 0) return best;
  }
  return -1;
}
export const isOpen = (nav, x, z) => !!nav.open[cellOf(nav, x, z)];
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; k.push(key); v.push(val); let i = k.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) { k[0] = lk; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } }
    return top;
  }
}
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
/** A* from (x0,z0) to (x1,z1). Returns [[x,z],...] (string-pulled) or null. */
export function findPath(nav, x0, z0, x1, z1) {
  const s = nearestOpen(nav, x0, z0), e = nearestOpen(nav, x1, z1);
  if (s < 0 || e < 0) return null;
  if (s === e) return [[x1, z1]];
  const N = nav.open.length, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const ex = e % nav.nx, ez = (e / nav.nx) | 0;
  const hfn = k => { const dx = Math.abs(k % nav.nx - ex), dz = Math.abs(((k / nav.nx) | 0) - ez); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const heap = new Heap(); g[s] = 0; heap.push(hfn(s), s);
  let it = 0, found = false;
  while (heap.size && it++ < 60000) {
    const k = heap.pop(); if (closed[k]) continue; closed[k] = 1;
    if (k === e) { found = true; break; }
    const i = k % nav.nx, j = (k / nav.nx) | 0;
    for (const [di, dj, w] of DIRS) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nav.nx || b >= nav.nz) continue;
      const n = b * nav.nx + a; if (!nav.open[n] || closed[n]) continue;
      if (di && dj && (!nav.open[j * nav.nx + a] || !nav.open[b * nav.nx + i])) continue;
      const ng = g[k] + w + (nav.edge[n] ? 0.6 : 0);
      if (ng < g[n]) { g[n] = ng; from[n] = k; heap.push(ng + hfn(n), n); }
    }
  }
  if (!found) return null;
  const cells = []; let k = e;
  while (k !== s && k >= 0) { cells.push(k); k = from[k]; }
  cells.reverse();
  const pt = k => [nav.cx(k % nav.nx), nav.cz((k / nav.nx) | 0)];
  const out = []; let prev = [x0, z0];
  for (let q = 0; q < cells.length; q++) {
    const nxt = cells[q + 1];
    if (nxt !== undefined && straight(nav, prev, pt(nxt))) continue;
    const p = pt(cells[q]); out.push(p); prev = p;
  }
  if (out.length) out[out.length - 1] = [x1, z1]; else out.push([x1, z1]);
  return out;
}
export function straight(nav, a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / (nav.cell * 0.5));
  for (let i = 1; i <= n; i++) { const t = i / n; if (!nav.open[cellOf(nav, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)]) return false; }
  return true;
}
/** Dijkstra outward from a goal: a field anybody can walk "downhill" on to reach it. */
export function flowField(nav, gx, gz, maxCost = 400) {
  const N = nav.open.length, dist = new Float32Array(N).fill(1e9), e = nearestOpen(nav, gx, gz);
  if (e < 0) return null;
  const heap = new Heap(); dist[e] = 0; heap.push(0, e);
  while (heap.size) {
    const k = heap.pop(), dk = dist[k]; if (dk > maxCost) break;
    const i = k % nav.nx, j = (k / nav.nx) | 0;
    for (const [di, dj, w] of DIRS) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nav.nx || b >= nav.nz) continue;
      const n = b * nav.nx + a; if (!nav.open[n]) continue;
      if (di && dj && (!nav.open[j * nav.nx + a] || !nav.open[b * nav.nx + i])) continue;
      const nd = dk + w + (nav.edge[n] ? 0.5 : 0);
      if (nd < dist[n]) { dist[n] = nd; heap.push(nd, n); }
    }
  }
  return { dist, nav, gx, gz };
}
/** Direction to walk on a flow field from (x,z). {dx,dz,d} with d = remaining cost in cells (1e9 = can't get there). */
export function flowDir(F, x, z) {
  const nav = F.nav; let k = cellOf(nav, x, z);
  if (!nav.open[k]) { k = nearestOpen(nav, x, z, 4); if (k < 0) return { dx: 0, dz: 0, d: 1e9 }; const tx = nav.cx(k % nav.nx), tz = nav.cz((k / nav.nx) | 0), l = Math.hypot(tx - x, tz - z) || 1; return { dx: (tx - x) / l, dz: (tz - z) / l, d: F.dist[k] }; }
  // look a few cells ahead for the lowest cost we can walk straight to (smoother than cell-to-cell)
  const i = k % nav.nx, j = (k / nav.nx) | 0; let best = k, bd = F.dist[k];
  for (let r = 1; r <= 3; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nav.nx || b >= nav.nz) continue;
    const n = b * nav.nx + a; if (F.dist[n] >= bd - 0.01) continue;
    if (r > 1 && !straight(nav, [x, z], [nav.cx(a), nav.cz(b)])) continue;
    bd = F.dist[n]; best = n;
  }
  if (best === k) { const l = Math.hypot(F.gx - x, F.gz - z) || 1; return { dx: (F.gx - x) / l, dz: (F.gz - z) / l, d: F.dist[k] }; }
  const tx = nav.cx(best % nav.nx), tz = nav.cz((best / nav.nx) | 0), l = Math.hypot(tx - x, tz - z) || 1;
  return { dx: (tx - x) / l, dz: (tz - z) / l, d: F.dist[k] };
}
/** Steering along a findPath() result (mutates the path). */
export function followPath(p, path) {
  while (path.length > 1 && Math.hypot(path[0][0] - p.x, path[0][1] - p.z) < 0.45) path.shift();
  if (!path.length) return { dx: 0, dz: 0, done: true };
  const [gx, gz] = path[0], d = Math.hypot(gx - p.x, gz - p.z);
  return { dx: d > 0.1 ? (gx - p.x) / d : 0, dz: d > 0.1 ? (gz - p.z) / d : 0, done: path.length === 1 && d < 0.35 };
}
