// Googly Heist — the whole game: the Hideout lobby, a 30-minute bank job for a crew of four, stealth and witnesses,
// cameras, hostages, the manager's keycard, the thermal drill, the vault, the reserve time-lock, the armored truck,
// the getaway van, police assault waves and the computer crew. The same Room runs on the server (online lobbies)
// and inside the page (PLAY SOLO, no server needed).
import { MAPS, BANK, HIDEOUT } from './maps.js';
import * as S from './sim.js';

export const SLOTS = 4;
export const GAME_LEN = 30 * 60;
export const T_TRUCK = 13 * 60, T_TRUCK_GONE = 21 * 60, T_CAGE = 20 * 60, T_FINAL = GAME_LEN - 120;
export const VAN_CAP = 8, VAN_AWAY = 60;
export const BAG = {
  cash: { name: 'Cash bag', value: 25000, speed: 0.88, throw: 9, emoji: '💵' },
  gold: { name: 'Gold bag', value: 60000, speed: 0.64, throw: 5.5, heavy: true, emoji: '🥇' },
  diamond: { name: 'The Googly Diamond', value: 750000, speed: 0.78, throw: 6, emoji: '💎' },
  drill: { name: 'Thermal drill', value: 0, speed: 0.7, throw: 5, heavy: true, emoji: '🔧' },
};
export const MAG = 30, AMMO_MAX = 210, HP_MAX = 100, ARMOR_MAX = 60;
const DRILL_VAULT = 210, DRILL_TRUCK = 50;
const ACT = { lockpick: 6, keycard: 0.6, openBack: 0.5, takeKey: 1.2, pickpocket: 2, cuff: 1.2, placeDrill: 1.4, fixDrill: 2, takeDrill: 0.6, bag: 1.6, pick: 0.3, load: 0.4, deposit: 3, drawer: 2, atm: 8, safe: 12, cams: 4, revive: 3, ammo: 0.8, medic: 1.5, truck: 12 };
const COP = {
  guard: { hp: 50, speed: 0.9, dmg: 5, burst: 3, acc: 0.45, range: 18, name: 'Guard' },
  cop: { hp: 55, speed: 0.95, dmg: 5, burst: 3, acc: 0.5, range: 20, name: 'Police' },
  swat: { hp: 110, speed: 0.98, dmg: 7, burst: 4, acc: 0.56, range: 24, name: 'SWAT' },
  heavy: { hp: 260, speed: 0.7, dmg: 11, burst: 6, acc: 0.5, range: 16, name: 'Heavy SWAT' },
};
const DIFF = [
  { name: 'Easy', copAcc: 0.5, copDmg: 0.55, cap: 6, capMax: 11, spawn: 3.2, response: 55, det: 0.55, assault: 95, brk: 45 },
  { name: 'Normal', copAcc: 0.78, copDmg: 0.85, cap: 8, capMax: 15, spawn: 2.5, response: 42, det: 0.8, assault: 110, brk: 35 },
  { name: 'Hard', copAcc: 1, copDmg: 1.2, cap: 11, capMax: 20, spawn: 1.9, response: 30, det: 1.1, assault: 125, brk: 28 },
];
export const DIFF_NAMES = DIFF.map(d => d.name);
const BOTS = [['DUSTY', '#3a3a3c', 'hockey'], ['ROSIE', '#ff6fb5', 'clown'], ['BLUE', '#2f7bff', 'skull'], ['LIMEY', '#7bd13b', 'tiger'], ['SUNNY', '#ffcc00', 'bandana'], ['MINTY', '#00c7be', 'hockey']];
const CIV_COLORS = ['#e8a33a', '#c8a078', '#8a5a2b', '#ff9500', '#7bd13b', '#9b59ff', '#f2f2f7', '#34c759', '#ff6fb5', '#5a8ad8', '#e8452c', '#b0b0b8', '#6a4a8a', '#d8c07a'];
const clean = (s, n) => String(s ?? '').replace(/[<>&"]/g, '').trim().slice(0, n);
const r2 = v => Math.round(v * 100) / 100;
const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
let nextNpcId = 5000, nextBagId = 1, nextBotId = 900000;
const NAVS = new Map();
function navFor(map, who) {
  const key = map.id + who + Object.entries(map.doors).filter(([k, d]) => d.open && !k.startsWith('pc')).map(([k]) => k).sort().join(',');
  if (!NAVS.has(key)) { if (NAVS.size > 40) NAVS.clear(); NAVS.set(key, S.buildNav(map, who)); }
  return NAVS.get(key);
}
/** A room gets its own copy of the map's doors (shared walls, own door states). */
function roomMap(id) { const base = MAPS[id], m = Object.create(base); m.doors = JSON.parse(JSON.stringify(base.doors)); return m; }

export function newPlayer(o = {}) {
  return {
    id: 0, name: 'GOOGLY', color: '#3a3a3c', skin: 'none', mask: 'hockey', bot: false,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: true, crouch: false,
    ...freshCrew(), ...o,
  };
}
function freshCrew() {
  return { masked: false, hp: HP_MAX, armor: ARMOR_MAX, hurtT: 9, mag: MAG, ammo: AMMO_MAX - MAG, reloadT: 0, fireT: 0, down: false, downT: 0, custodyT: 0, arrestT: 0, carry: null, keycard: false, pocket: 0, act: null, shoutT: 0, aimT: 0, stats: { secured: 0, pocket: 0, zaps: 0, revives: 0, downs: 0, custody: 0, hostages: 0, boxes: 0 }, escaped: false };
}

export class Room {
  /** out(player, msg) delivers a message to one human player. */
  constructor({ code = 'SOLO', solo = false, pub = false, name = '', settings = {}, out }) {
    this.code = code; this.solo = solo; this.public = pub; this.name = clean(name, 24); this.out = out;
    this.players = new Map(); this.hostId = 0;
    this.settings = { diff: 1, plan: 'stealth', cpus: true, len: GAME_LEN, ...settings };
    this.state = 'lobby'; this.mapId = HIDEOUT; this.map = roomMap(HIDEOUT);
    this.clock = 0; this.snapAcc = 0; this.meAcc = 0; this.detAcc = 0; this.endT = 0;
    this.npcs = new Map(); this.bags = new Map(); this.events = [];
    this.syncBots();
  }
  // ---------------------------------------------------------------- messaging
  bcast(m) { for (const p of this.players.values()) if (!p.bot) this.out(p, m); }
  sys(text) { this.bcast({ t: 'chat', sys: true, text }); }
  banner(text, sub = '', color = '#ffe07a') { this.bcast({ t: 'banner', text, sub, color }); }
  humans() { return [...this.players.values()].filter(p => !p.bot); }
  crew() { return [...this.players.values()]; }
  pub(p) { return { id: p.id, name: p.name, color: p.color, skin: p.skin, mask: p.mask, bot: p.bot, host: this.hostId === p.id }; }
  full(p) { return { ...this.pub(p), x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw), masked: p.masked, carry: p.carry ? this.bags.get(p.carry)?.kind || null : null }; }
  info() { return { code: this.code, public: this.public, name: this.name, host: this.hostId, state: this.state, settings: this.settings, solo: this.solo, players: [...this.players.values()].map(p => this.pub(p)) }; }
  pushRoom() { this.bcast({ t: 'room', room: this.info() }); }
  npcPub(n) { return { id: n.id, kind: n.kind, color: n.color, hat: n.hat, x: r2(n.x), y: r2(n.y), z: r2(n.z), yaw: r2(n.yaw), f: this.npcFlags(n) }; }
  bagPub(b) { return { id: b.id, kind: b.kind, x: r2(b.x), y: r2(b.y), z: r2(b.z), by: b.by || 0, fly: b.fly ? [r2(b.vx), r2(b.vy), r2(b.vz)] : null }; }
  worldMsg() {
    const m = { t: 'world', map: this.mapId, state: this.state, clock: this.clock, settings: this.settings, players: this.crew().map(p => this.full(p)) };
    if (this.mapId === BANK) Object.assign(m, {
      npcs: [...this.npcs.values()].map(n => this.npcPub(n)), bags: [...this.bags.values()].filter(b => !b.secured).map(b => this.bagPub(b)),
      doors: Object.fromEntries(Object.entries(this.map.doors).map(([k, d]) => [k, d.open])), loot: this.lootMsg(), drill: this.drillMsg(),
      van: this.vanMsg(), truck: this.truck.state, alarm: this.alarm, wave: this.wave, cams: this.cams.map(c => c.state), secured: this.secured, hostages: this.hostageCount(),
    });
    return m;
  }
  listing() { return { code: this.code, name: this.name || (this.humans()[0]?.name + "'s crew"), humans: this.humans().length, state: this.state, diff: DIFF[this.settings.diff].name, plan: this.settings.plan, clock: Math.floor(this.clock) }; }

  // ---------------------------------------------------------------- joining and leaving
  canJoin() { return this.humans().length < SLOTS && (this.state === 'lobby' || this.crew().some(p => p.bot)); }
  join(p) {
    if (!this.canJoin()) return false;
    if (this.state !== 'lobby') {
      // take over a computer robber mid-heist (their spot, their bag, their keycard)
      const b = this.crew().find(q => q.bot);
      this.players.delete(b.id); this.bcast({ t: 'gone', id: b.id });
      const keep = { x: b.x, y: b.y, z: b.z, yaw: b.yaw, masked: b.masked, hp: b.hp, armor: b.armor, mag: b.mag, ammo: b.ammo, down: b.down, downT: b.downT, custodyT: b.custodyT, carry: b.carry, keycard: b.keycard, pocket: b.pocket, stats: b.stats };
      Object.assign(p, freshCrew(), keep);
      if (p.carry) { const bag = this.bags.get(p.carry); if (bag) bag.by = p.id; }
    }
    this.players.set(p.id, p);
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = p.id;
    this.syncBots();
    if (this.state === 'lobby') this.place(p);
    this.out(p, { t: 'joined', code: this.code, id: p.id });
    this.out(p, this.worldMsg());
    this.bcast({ t: 'join', p: this.full(p) });
    this.pushRoom();
    this.sys(this.state === 'lobby' ? `${p.name} joined the crew` : `${p.name} jumped in and took over a spot in the crew`);
    return true;
  }
  leave(p) {
    if (!this.players.has(p.id)) return;
    this.players.delete(p.id);
    this.bcast({ t: 'gone', id: p.id });
    if (!this.humans().length) return;
    if (this.hostId === p.id) this.hostId = this.humans()[0].id;
    if (this.state === 'play' && this.settings.cpus) {
      const b = this.makeBot(); Object.assign(b, { x: p.x, y: p.y, z: p.z, masked: p.masked, hp: p.hp, armor: p.armor, down: p.down, downT: p.downT, custodyT: p.custodyT, carry: p.carry, keycard: p.keycard, pocket: p.pocket, stats: p.stats });
      if (b.carry) { const bag = this.bags.get(b.carry); if (bag) bag.by = b.id; }
      this.players.set(b.id, b); this.bcast({ t: 'join', p: this.full(b) });
    } else {
      if (p.carry) this.dropBag(p);
      this.syncBots();
    }
    this.sys(`${p.name} left`);
    this.pushRoom();
  }
  makeBot() {
    const used = new Set(this.crew().map(q => q.name));
    let i = BOTS.findIndex(([n]) => !used.has(n)); if (i < 0) i = 0;
    const [name, color, mask] = BOTS[i];
    return newPlayer({ id: nextBotId++, name, color, mask, bot: true, brain: newBrain() });
  }
  syncBots() {
    const want = this.settings.cpus ? Math.max(0, SLOTS - this.humans().length) : 0;
    const bots = this.crew().filter(p => p.bot);
    while (bots.length > want) { const b = bots.pop(); if (b.carry) this.dropBag(b); this.players.delete(b.id); this.bcast({ t: 'gone', id: b.id }); }
    while (bots.length < want && this.state === 'lobby') { const b = this.makeBot(); this.players.set(b.id, b); bots.push(b); this.place(b); this.bcast({ t: 'join', p: this.full(b) }); }
  }
  place(p, i = -1) {
    const sp = this.map.spawns, s = sp[i >= 0 ? i % sp.length : Math.floor(Math.random() * sp.length)];
    Object.assign(p, { x: s[0] + rnd(-0.4, 0.4), z: s[1] + rnd(-0.4, 0.4), y: 0, vx: 0, vy: 0, vz: 0, onGround: true, yaw: this.mapId === BANK ? 0 : Math.PI });
    if (p.bot) p.brain = newBrain();
    this.outTp(p);
  }
  outTp(p) { if (!p.bot) this.out(p, { t: 'tp', x: p.x, y: p.y, z: p.z, yaw: p.yaw }); }

  // ---------------------------------------------------------------- setting up the job
  start() {
    if (this.state === 'play') return;
    this.mapId = BANK; this.map = roomMap(BANK);
    this.state = 'play'; this.clock = 0; this.endT = 0;
    this.alarm = false; this.alarmAt = 0; this.alarmWhy = ''; this.wave = { k: 'none', n: 0, t: 0 }; this.spawnT = 0;
    this.secured = 0; this.securedBags = []; this.pile = [];
    this.van = { state: 'here', t: 0, load: 0, drill: true, returned: 0 };
    this.truck = { state: 'none', t: 0, cut: 0, bags: 0 };
    this.drill = { state: 'none', on: null, t: 0, need: DRILL_VAULT, jamT: 0, x: 0, z: 0 };
    this.loot = { pallets: this.map.pallets.map(p => p.n), deposit: this.map.deposit.map(d => d.n), drawers: this.map.tellers.map(() => 1), atms: this.map.atms.map(() => 1), safe: 1 };
    this.cams = this.map.cams.map(() => ({ state: 'on' }));   // 'on' | 'off' | 'broken'
    this.camDet = 0; this.custAt = rnd(35, 60); this.heli = false; this.finalCalled = false; this.cageOpened = false; this.earlyT = 0;
    this.npcs.clear(); this.bags.clear();
    this.fields = new Map(); this.fieldT = 0;
    this.navNpc = navFor(this.map, 'npc'); this.navCrew = navFor(this.map, 'crew');
    this.crew().forEach((p, i) => { Object.assign(p, freshCrew()); this.place(p, i); p.yaw = 0; });
    this.spawnBankPeople();
    this.bcast(this.worldMsg());
    this.pushRoom();
    this.sys(`🏦 ${this.map.name}. Rob it! Walk in like a customer, mask up (G) when you're ready. The van leaves at 30:00.`);
  }
  spawnBankPeople() {
    const m = this.map;
    for (const t of m.tellers) this.addNpc({ kind: 'teller', x: t.x, z: t.z, home: [t.x, t.z], yaw: 0, teller: t.id });
    this.addNpc({ kind: 'manager', x: -18, z: -15.4, home: [-18, -15.4], keycard: true, hat: 'manager' });
    m.guardPosts.forEach((g, i) => this.addNpc({ kind: 'guard', x: g.x, z: g.z, home: [g.x, g.z], post: i, seat: !!g.seat, yaw: 0 }));
    const n = 9 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { const s = m.lobbySpots[i % m.lobbySpots.length]; this.addNpc({ kind: 'civ', x: s[0] + rnd(-0.8, 0.8), z: s[1] + rnd(-0.6, 0.6) }); }
  }
  addNpc(o) {
    const n = {
      id: nextNpcId++, kind: o.kind, x: o.x, y: 0, z: o.z, vx: 0, vy: 0, vz: 0, yaw: o.yaw ?? rnd(-3, 3), onGround: true, crouch: false,
      color: o.color || (o.kind === 'civ' ? pick(CIV_COLORS) : o.kind === 'teller' ? pick(['#c8a078', '#e8a33a', '#8a5a2b', '#f2d0b0']) : o.kind === 'manager' ? '#d8c07a' : '#5a8ad8'),
      hat: o.hat || (o.kind === 'civ' ? pick(['none', 'none', 'cap', 'fedora', 'beanie', 'bag', 'briefcase', 'none']) : o.kind),
      hp: COP[o.kind]?.hp || 30, det: 0, detBy: 0, state: o.state || 'idle', t: rnd(0, 4), hostT: 0, callT: 0,
      home: o.home || null, post: o.post ?? -1, seat: !!o.seat, keycard: !!o.keycard, teller: o.teller ?? -1,
      hostage: false, cuffed: false, handsUp: 0, zapT: 0, alert: 0, fireT: rnd(1, 2), burst: 0, seenT: 0, target: 0, arrestT: 0, lastSeen: null,
      speedMul: COP[o.kind]?.speed || 0.8, brain: { path: null, goal: null, pathT: 0 }, walkTo: o.walkTo || null, leaving: false,
    };
    this.npcs.set(n.id, n);
    if (this.state === 'play') this.bcast({ t: 'npc', add: [this.npcPub(n)] });
    return n;
  }
  removeNpc(n) { if (n.keycard) { n.keycard = false; this.dropKeycard(n.x, n.z); } this.npcs.delete(n.id); this.bcast({ t: 'npc', rm: [n.id] }); }
  npcFlags(n) {
    return (n.hostage ? 1 : 0) | (n.cuffed ? 2 : 0) | (n.handsUp > 0 ? 4 : 0) | (n.zapT > 0 || n.hp <= 0 ? 8 : 0) | (n.state === 'panic' || n.state === 'flee' ? 16 : 0) | (n.callT > 0 ? 32 : 0)
      | (n.alert > 0 ? 64 : 0) | (n.burst > 0 ? 128 : 0) | (this.armed(n) ? 256 : 0) | (n.keycard ? 512 : 0) | (Math.min(7, Math.floor(n.det * 7.99)) << 10) | (n.seat && n.state === 'idle' && !this.alarm ? 8192 : 0) | (n.state === 'sit' ? 8192 : 0) | (n.state === 'cower' ? 16384 : 0);
  }
  armed(n) { return n.kind === 'cop' || n.kind === 'swat' || n.kind === 'heavy' || n.kind === 'guard' && (this.alarm || n.state === 'fight'); }
  hostageCount() { let c = 0; for (const n of this.npcs.values()) if (n.hostage || n.cuffed) c++; return c; }
  lootMsg() { return { p: this.loot.pallets, d: this.loot.deposit, dr: this.loot.drawers, a: this.loot.atms, s: this.loot.safe }; }
  drillMsg() { const d = this.drill; return { state: d.state, on: d.on, t: r2(d.t), need: d.need, x: d.x, z: d.z }; }
  vanMsg() { return { state: this.van.state, load: this.van.load, t: r2(this.van.t), drill: this.van.drill, cap: VAN_CAP }; }
  setDoor(id, open, by = 0) {
    const d = this.map.doors[id]; if (!d || d.open === open) return;
    d.open = open;
    if (!id.startsWith('pc')) { this.navNpc = navFor(this.map, 'npc'); this.navCrew = navFor(this.map, 'crew'); this.fields.clear(); }
    this.bcast({ t: 'door', id, open, by });
  }

  // ---------------------------------------------------------------- the alarm and the police
  raiseAlarm(why) {
    if (this.alarm || this.state !== 'play') return;
    this.alarm = true; this.alarmAt = this.clock; this.alarmWhy = why;
    const D = DIFF[this.settings.diff];
    this.wave = { k: 'response', n: 0, t: D.response };
    this.bcast({ t: 'alarm', why, response: D.response });
    this.sys(`🚨 ALARM! ${why}. The police are on the way — about ${D.response} seconds.`);
    // everybody in the bank reacts
    for (const n of this.npcs.values()) {
      if (n.kind === 'guard' && !n.cuffed && !n.hostage) { n.state = 'fight'; n.alert = 3; }
      else if (n.kind === 'civ' && !n.hostage && !n.cuffed) { n.state = 'flee'; n.callT = 0; }
      else if ((n.kind === 'teller' || n.kind === 'manager') && !n.hostage && !n.cuffed) { n.state = 'cower'; n.callT = 0; }
    }
    // the crew all mask up once it's loud
    for (const p of this.crew()) if (!p.masked) this.maskUp(p);
  }
  tickPolice(dt) {
    if (!this.alarm) return;
    const D = DIFF[this.settings.diff], W = this.wave;
    W.t -= dt;
    const loudMin = (this.clock - this.alarmAt) / 60;
    if (W.k === 'response' && W.t <= 0) { this.newWave(); }
    else if (W.k === 'assault' && W.t <= 0) {
      W.k = 'break'; W.t = D.brk + Math.min(40, this.hostageCount() * 4);
      this.bcast({ t: 'wave', k: 'break', n: W.n, t: W.t });
      for (const n of this.npcs.values()) if (isCop(n)) n.state = 'retreat';
    } else if (W.k === 'break' && W.t <= 0) this.newWave();
    if (W.k === 'assault') {
      this.spawnT -= dt;
      const cap = Math.min(D.capMax, D.cap + Math.floor(loudMin * 0.6)) + (this.clock > T_FINAL ? 3 : 0);
      let cops = 0; for (const n of this.npcs.values()) if (isCop(n) && n.hp > 0 && n.state !== 'retreat') cops++;
      if (this.spawnT <= 0 && cops < cap) {
        this.spawnT = D.spawn * rnd(0.7, 1.3);
        const w = [1, clamp((loudMin - 2) / 4, 0, 1.4), clamp((loudMin - 6) / 8, 0, 1) * 0.35];
        const r = Math.random() * (w[0] + w[1] + w[2]), kind = r < w[0] ? 'cop' : r < w[0] + w[1] ? 'swat' : 'heavy';
        const sp = this.pickSpawn();
        this.addNpc({ kind, x: sp[0] + rnd(-1.5, 1.5), z: sp[1] + rnd(-1.5, 1.5), state: 'hunt', hat: kind });
      }
    }
    // the police breach the back door a minute in, and a helicopter shows up after five
    if (!this.map.doors.back.open && this.clock - this.alarmAt > 60) { this.setDoor('back', true); this.bcast({ t: 'fx', k: 'breach', x: 24, z: -10.2 }); }
    if (!this.heli && loudMin > 5) { this.heli = true; this.bcast({ t: 'heli', on: true }); this.sys('🚁 A police helicopter is circling the bank'); }
  }
  pickSpawn() {
    const sp = this.map.copSpawns, crew = this.crew().filter(p => !p.down && p.custodyT <= 0);
    // don't pop out right next to a robber
    const ok = sp.filter(s => crew.every(p => Math.hypot(p.x - s[0], p.z - s[1]) > 16));
    return pick(ok.length ? ok : sp);
  }
  newWave() {
    const D = DIFF[this.settings.diff], W = this.wave;
    W.n++; W.k = 'assault'; W.t = D.assault; this.spawnT = 0;
    // police cars pull up
    for (let i = 0; i < 4; i++) if (W.n > i || i === 0) this.setDoor('pc' + i, false);
    this.bcast({ t: 'wave', k: 'assault', n: W.n, t: W.t });
    for (const n of this.npcs.values()) if (isCop(n) && n.state === 'retreat') n.state = 'hunt';
  }

  // ---------------------------------------------------------------- the crew's actions
  maskUp(p) {
    if (p.masked || this.mapId !== BANK) return;
    p.masked = true;
    this.bcast({ t: 'fx', k: 'mask', id: p.id });
  }
  hurt(p, dmg, by) {
    if (p.down || p.custodyT > 0 || this.state !== 'play') return;
    p.hurtT = 0;
    const a = Math.min(p.armor, dmg); p.armor -= a; dmg -= a;
    p.hp = Math.max(0, p.hp - dmg);
    if (!p.bot) this.out(p, { t: 'ouch', from: by ? [r2(by.x), r2(by.z)] : null, armor: a > 0 && dmg <= 0 });
    if (p.hp <= 0) this.goDown(p);
  }
  goDown(p) {
    p.down = true; p.downT = 40; p.hp = 0; p.act = null; p.stats.downs++; p.arrestT = 0;
    if (p.carry) this.dropBag(p);
    this.bcast({ t: 'fx', k: 'down', id: p.id });
    this.sys(`🆘 ${p.name} is down! Hold E next to them to help them up.`);
  }
  revive(p) {
    p.down = false; p.hp = 50; p.armor = 0; p.hurtT = 0; p.downT = 0;
    this.bcast({ t: 'fx', k: 'up', id: p.id });
  }
  arrest(p) {
    p.down = false; p.custodyT = 25; p.stats.custody++; p.act = null;
    if (p.carry) this.dropBag(p);
    if (p.keycard) { p.keycard = false; this.dropKeycard(p.x, p.z); }
    p.pocket = Math.floor(p.pocket * 0.5);
    this.bcast({ t: 'fx', k: 'custody', id: p.id });
    this.sys(`🚓 ${p.name} was arrested! Back in 25 seconds (lost half their pocket cash).`);
  }
  dropKeycard(x, z) { const b = this.addBag('key', x, 0.1, z); b.kind = 'key'; this.bcast({ t: 'bag', add: [this.bagPub(b)] }); }
  addBag(kind, x, y, z) { const b = { id: nextBagId++, kind, x, y, z, vx: 0, vy: 0, vz: 0, fly: false, by: 0, secured: false }; this.bags.set(b.id, b); return b; }
  dropBag(p, throwDir = null) {
    const b = this.bags.get(p.carry); p.carry = null; if (!b) return;
    b.by = 0;
    b.x = p.x; b.z = p.z; b.y = p.y + 0.9;
    if (throwDir) {
      const sp = BAG[b.kind]?.throw || 6, [dx, dy, dz] = throwDir, l = Math.hypot(dx, dz) || 1;
      b.vx = dx / l * sp + p.vx * 0.5; b.vz = dz / l * sp + p.vz * 0.5; b.vy = 3.2 + clamp(dy, -0.5, 0.8) * sp * 0.6;
    } else { b.vx = p.vx * 0.3; b.vz = p.vz * 0.3; b.vy = 0; }
    b.fly = true;
    this.bcast({ t: 'bag', upd: [this.bagPub(b)] });
    this.bcast({ t: 'fx', k: throwDir ? 'throw' : 'drop', id: p.id });
  }
  tickBags(dt) {
    for (const b of this.bags.values()) {
      if (b.kind === 'ammo' && this.clock - (b.born ?? this.clock) > 45) { this.bags.delete(b.id); this.bcast({ t: 'bag', rm: [b.id] }); continue; }
      if (b.by) { const p = this.players.get(b.by); if (p) { b.x = p.x; b.y = p.y + 1; b.z = p.z; } else b.by = 0; continue; }
      if (!b.fly) continue;
      // the bag is a round lump ~0.3 m across: it bumps off walls, counters, cars and the van instead of going through
      const n = Math.max(3, Math.ceil(Math.hypot(b.vx, b.vy, b.vz) * dt / 0.12)), R = BAG_R;
      for (let i = 0; i < n; i++) {
        const h = dt / n;
        b.vy -= S.GRAV * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
        const vanBox = this.map.colliders.find(c => c.kind === 'van');
        const hitVan = this.van.state === 'here' && vanBox && Math.abs(b.x - vanBox.x) < vanBox.w / 2 + R && Math.abs(b.z - vanBox.z) < vanBox.d / 2 + R && b.y < vanBox.h + R;
        if (hitVan && b.kind !== 'key' && b.kind !== 'ammo') { this.secure(b, b.thrower); break; }
        const nrm = S.pushOut(b, this.map, R, 0.5, 'crew');
        if (nrm) { const vn = b.vx * nrm[0] + b.vz * nrm[1]; if (vn < 0) { b.vx -= 1.35 * vn * nrm[0]; b.vz -= 1.35 * vn * nrm[1]; } b.vx *= 0.6; b.vz *= 0.6; }
        // ceilings (and the underside of anything overhead)
        const up = S.segMap(this.map, b.x, b.y + 0.2, b.z, b.x, b.y + 0.5, b.z, 'solid');
        if (up && b.vy > 0) { b.vy = -b.vy * 0.2; b.y -= 0.05; }
        const g = S.groundAt(this.map, b.x, b.z, R, b.y + 0.35, 'crew');
        if (b.y <= g) { b.y = g; if (b.vy < -2) b.vy = -b.vy * 0.25; else b.vy = 0; b.vx *= 0.55; b.vz *= 0.55; if (Math.hypot(b.vx, b.vz) < 0.4 && b.vy === 0) { b.fly = false; b.vx = b.vz = 0; break; } }
      }
      if (!this.bags.has(b.id) || b.secured) continue;
      if (!b.fly) {
        // landed right behind the van: that counts
        const r = this.map.van.rear;
        if (b.kind !== 'key' && b.kind !== 'drill' && this.van.state === 'here' && Math.hypot(b.x - r[0], b.z - r[1]) < 1.6) this.secure(b, b.thrower);
        else this.bcast({ t: 'bag', upd: [this.bagPub(b)] });
      }
    }
  }
  secure(b, byId) {
    if (b.kind === 'drill') { this.bags.delete(b.id); this.van.drill = true; this.bcast({ t: 'bag', rm: [b.id] }); this.bcast({ t: 'van', van: this.vanMsg() }); return; }
    const v = BAG[b.kind]?.value || 0;
    b.secured = true; this.bags.delete(b.id);
    this.secured += v; this.securedBags.push(b.kind); this.van.load++;
    const p = this.players.get(byId); if (p) p.stats.secured += v;
    this.bcast({ t: 'bag', rm: [b.id] });
    this.bcast({ t: 'secured', kind: b.kind, value: v, by: byId || 0, total: this.secured });
    if (this.van.load >= VAN_CAP && this.clock < T_FINAL - VAN_AWAY) {
      this.van = { ...this.van, state: 'away', t: VAN_AWAY };
      this.setDoor('van', true);
      this.bcast({ t: 'van', van: this.vanMsg() });
      this.sys(`🚐 The van is full! It's dropping the loot off — back in ${VAN_AWAY} seconds. Pile bags by the alley.`);
    } else this.bcast({ t: 'van', van: this.vanMsg() });
  }
  tickVan(dt) {
    const v = this.van;
    if (v.state === 'away') {
      v.t -= dt;
      if (v.t <= 0 || this.clock >= T_FINAL) {
        v.state = 'here'; v.load = 0; v.t = 0; this.setDoor('van', false);
        this.bcast({ t: 'van', van: this.vanMsg() }); this.sys('🚐 The van is back in the alley!');
        // bags left in a pile behind it go straight in
        const r = this.map.van.rear;
        for (const b of [...this.bags.values()]) if (!b.by && !b.fly && b.kind !== 'key' && b.kind !== 'drill' && Math.hypot(b.x - r[0], b.z - r[1]) < 4.5 && this.van.state === 'here') this.secure(b, b.thrower);
      }
    }
  }
  /** Where is this robber allowed to act on something? returns the target's point. */
  actPoint(p, k, id) {
    const m = this.map, D = m.doors;
    switch (k) {
      case 'lockpick': case 'keycard': { const d = D[id]; if (!d || d.open || !(k === 'lockpick' ? d.pick : d.key)) return null; if (k === 'keycard' && !p.keycard) return null; return [d.x, d.z, 1.9]; }
      case 'openBack': return !D.back.open && p.x < 24 ? [23.3, -10.2, 1.6] : null;
      case 'takeKey': case 'pickpocket': case 'cuff': { const n = this.npcs.get(id); if (!n || n.hp <= 0 || isCop(n)) return null; if (k === 'cuff' && (!(n.hostage || n.handsUp > 0 || n.zapT > 0) || n.cuffed)) return null; if (k !== 'cuff' && !n.keycard) return null; if (k === 'takeKey' && !(n.hostage || n.cuffed || n.handsUp > 0 || n.zapT > 0)) return null; return [n.x, n.z, 1.8]; }
      case 'placeDrill': { const b = this.bags.get(p.carry); if (b?.kind !== 'drill' || this.drill.state !== 'none') return null; if (id === 'vault' && !D.vault.open) return [0, -19.9, 2]; if (id === 'truck' && this.truck.state === 'here') return [m.truck.rear[0], m.truck.rear[1], 2]; return null; }
      case 'fixDrill': return this.drill.state === 'jammed' ? [this.drill.x, this.drill.z, 2] : null;
      case 'takeDrill': return this.van.state === 'here' && this.van.drill && !p.carry ? [m.van.rear[0], m.van.rear[1], 2.2] : null;
      case 'bag': { const pl = m.pallets[id]; if (!pl || this.loot.pallets[id] <= 0 || p.carry) return null; if (pl.room === 'vault' && !D.vault.open || pl.room === 'reserve' && !D.cage.open) return null; return [pl.x, pl.z, 1.7]; }
      case 'truckbag': return this.truck.state === 'open' && this.truck.bags > 0 && !p.carry ? [m.truck.rear[0], m.truck.rear[1], 2.2] : null;
      case 'pick': { const b = this.bags.get(id); if (!b || b.by || b.fly || (p.carry && b.kind !== 'key')) return null; return [b.x, b.z, 1.6]; }
      case 'load': return p.carry && this.van.state === 'here' && this.bags.get(p.carry)?.kind !== 'key' ? [m.van.rear[0], m.van.rear[1], 2.3] : null;
      case 'deposit': { const d = m.deposit[id]; if (!d || this.loot.deposit[id] <= 0 || !D.vault.open) return null; return [d.x, d.z, 1.6]; }
      case 'drawer': { const t = m.tellers[id]; if (!t || this.loot.drawers[id] <= 0) return null; return [t.x, -5.2, 1.5]; }
      case 'atm': { const a = m.atms[id]; if (!a || this.loot.atms[id] <= 0) return null; return [a.x, a.z, 1.6]; }
      case 'safe': return this.loot.safe > 0 ? [m.safe.x, m.safe.z + 0.5, 1.6] : null;
      case 'cams': return this.cams.some(c => c.state === 'on') ? [m.monitors.x, m.monitors.z, 1.8] : null;
      case 'revive': { const q = this.players.get(id); return q && q.down && q !== p ? [q.x, q.z, 1.8] : null; }
      case 'ammo': case 'medic': return this.van.state === 'here' ? [m.van.rear[0], m.van.rear[1], 2.4] : null;
      case 'truck': return this.truck.state === 'here' && this.drill.on !== 'truck' ? [m.truck.rear[0], m.truck.rear[1], 2.2] : null;
    }
    return null;
  }
  startAct(p, k, id) {
    if (this.state !== 'play' || p.down || p.custodyT > 0) return;
    if (!k) { p.act = null; return; }
    if (!ACT[k] && k !== 'truckbag') return;
    if (!p.masked && !(k === 'pickpocket' || k === 'keycard' || k === 'openBack' || k === 'pick' && this.bags.get(id)?.kind === 'key')) { if (!p.bot) this.out(p, { t: 'toast', text: 'Put your mask on first (hold G)' }); return; }
    if (k === 'pickpocket' && p.masked) k = 'takeKey';
    const pt = this.actPoint(p, k, id); if (!pt) return;
    if (p.act && p.act.k === k && p.act.id === id) return;
    p.act = { k, id, t: 0, need: k === 'truckbag' ? ACT.bag : ACT[k] };
  }
  tickAct(p, dt) {
    const a = p.act; if (!a) return;
    const pt = this.actPoint(p, a.k, a.id);
    if (!pt || Math.hypot(p.x - pt[0], p.z - pt[1]) > pt[2] + 0.4 || p.down) { p.act = null; return; }
    if (a.k === 'pickpocket') { const n = this.npcs.get(a.id); if (n && Math.abs(angDiff(yawTo(p.x - n.x, p.z - n.z), n.yaw)) < 1.6 && !n.hostage) { n.det = Math.min(0.95, n.det + 0.5); p.act = null; if (!p.bot) this.out(p, { t: 'toast', text: 'The manager noticed you! Sneak up from behind.' }); return; } }
    a.t += dt;
    if (a.t < a.need) return;
    p.act = null;
    this.finishAct(p, a.k, a.id);
  }
  finishAct(p, k, id) {
    const m = this.map;
    const fx = (kk, extra = {}) => this.bcast({ t: 'fx', k: kk, id: p.id, ...extra });
    switch (k) {
      case 'lockpick': case 'keycard': this.setDoor(id, true, p.id); fx(k === 'keycard' ? 'beep' : 'unlock', { door: id }); if (id === 'gate') this.sys(`🔓 ${p.name} opened the vault gate`); break;
      case 'openBack': this.setDoor('back', true, p.id); fx('unlock', { door: 'back' }); break;
      case 'takeKey': case 'pickpocket': { const n = this.npcs.get(id); if (!n?.keycard) break; n.keycard = false; p.keycard = true; fx('key'); this.sys(`🗝 ${p.name} got the manager's keycard`); break; }
      case 'cuff': { const n = this.npcs.get(id); if (!n) break; n.zapT = 0; n.cuffed = true; n.hostage = true; n.handsUp = 0; n.state = 'sit'; n.det = 0; p.stats.hostages++; fx('cuff', { npc: id }); this.bcast({ t: 'hostages', n: this.hostageCount() }); break; }
      case 'placeDrill': {
        const b = this.bags.get(p.carry); if (!b) break;
        this.bags.delete(b.id); p.carry = null; this.bcast({ t: 'bag', rm: [b.id] });
        const pt = id === 'vault' ? [0, -19.9] : m.truck.rear;
        this.drill = { state: 'running', on: id, t: 0, need: id === 'vault' ? DRILL_VAULT : DRILL_TRUCK, jamT: rnd(24, 42), x: pt[0], z: pt[1] };
        this.bcast({ t: 'drill', drill: this.drillMsg() }); fx('drillOn');
        this.sys(id === 'vault' ? `🔧 The drill is on the vault door! About ${Math.round(DRILL_VAULT / 60 * 10) / 10} minutes — keep it running.` : '🔧 Drilling the armored truck!');
        break;
      }
      case 'fixDrill': this.drill.state = 'running'; this.drill.jamT = rnd(22, 40); this.bcast({ t: 'drill', drill: this.drillMsg() }); fx('drillFix'); break;
      case 'takeDrill': { this.van.drill = false; const b = this.addBag('drill', p.x, p.y + 1, p.z); b.by = p.id; p.carry = b.id; this.bcast({ t: 'bag', add: [this.bagPub(b)] }); this.bcast({ t: 'van', van: this.vanMsg() }); fx('grab'); break; }
      case 'bag': {
        const pl = m.pallets[id]; this.loot.pallets[id]--;
        const b = this.addBag(pl.kind, p.x, p.y + 1, p.z); b.by = p.id; b.thrower = p.id; p.carry = b.id;
        this.bcast({ t: 'bag', add: [this.bagPub(b)] }); this.bcast({ t: 'loot', loot: this.lootMsg() }); fx('bagged', { kind: pl.kind });
        if (pl.kind === 'diamond') this.sys(`💎 ${p.name} grabbed THE GOOGLY DIAMOND! Get it to the van!`);
        break;
      }
      case 'truckbag': { this.truck.bags--; const b = this.addBag('gold', p.x, p.y + 1, p.z); b.by = p.id; b.thrower = p.id; p.carry = b.id; this.bcast({ t: 'bag', add: [this.bagPub(b)] }); this.bcast({ t: 'truck', state: this.truck.state, bags: this.truck.bags }); fx('bagged', { kind: 'gold' }); break; }
      case 'pick': {
        const b = this.bags.get(id); if (!b) break;
        if (b.kind === 'key') { this.bags.delete(b.id); p.keycard = true; this.bcast({ t: 'bag', rm: [b.id] }); fx('key'); break; }
        b.by = p.id; b.fly = false; b.thrower = p.id; p.carry = b.id; this.bcast({ t: 'bag', upd: [this.bagPub(b)] }); fx('grab');
        break;
      }
      case 'load': { const b = this.bags.get(p.carry); if (!b) break; p.carry = null; b.by = 0; this.secure(b, p.id); fx('load'); break; }
      case 'deposit': {
        this.loot.deposit[id]--; const v = Math.random() < 0.18 ? 0 : Math.round(rnd(1, 11)) * 1000;
        p.pocket += v; p.stats.pocket += v; p.stats.boxes++;
        this.bcast({ t: 'loot', loot: this.lootMsg() }); fx('cash', { v, what: v ? 'deposit box' : 'empty deposit box' });
        break;
      }
      case 'drawer': { this.loot.drawers[id]--; const v = Math.round(rnd(2, 5)) * 1000; p.pocket += v; p.stats.pocket += v; this.bcast({ t: 'loot', loot: this.lootMsg() }); fx('cash', { v, what: 'cash drawer' }); break; }
      case 'atm': { this.loot.atms[id]--; const v = 15000; p.pocket += v; p.stats.pocket += v; this.bcast({ t: 'loot', loot: this.lootMsg() }); fx('cash', { v, what: 'ATM' }); break; }
      case 'safe': { this.loot.safe = 0; const v = 40000; p.pocket += v; p.stats.pocket += v; this.bcast({ t: 'loot', loot: this.lootMsg() }); fx('cash', { v, what: "manager's safe" }); break; }
      case 'cams': for (const c of this.cams) if (c.state === 'on') c.state = 'off'; this.bcast({ t: 'cams', cams: this.cams.map(c => c.state) }); fx('beep'); this.sys(`📹 ${p.name} switched the cameras off`); break;
      case 'revive': { const q = this.players.get(id); if (q?.down) { this.revive(q); p.stats.revives++; } break; }
      case 'ammo': p.ammo = AMMO_MAX - p.mag; fx('ammo'); break;
      case 'medic': p.hp = HP_MAX; p.armor = ARMOR_MAX; fx('medic'); break;
      case 'truck': this.truck.state = 'open'; this.truck.bags = 6; this.bcast({ t: 'truck', state: 'open', bags: 6 }); fx('unlock', { door: 'truck' }); this.sys(`🚚 ${p.name} broke into the armored truck — 6 gold bags inside!`); break;
    }
    if (!p.bot) this.sendMe(p);
  }
  /** "GET DOWN!" — everyone in front of you drops to the floor (guards put their hands up). */
  shout(p) {
    if (!p.masked || p.down || p.custodyT > 0 || p.shoutT > 0) return;
    p.shoutT = 1.1;
    this.bcast({ t: 'fx', k: 'shout', id: p.id });
    const eye = S.eyeOf(p);
    for (const n of this.npcs.values()) {
      if (n.hp <= 0 || n.cuffed || isCop(n)) continue;
      const d = dist(p, n); if (d > 12) continue;
      const a = Math.abs(angDiff(yawTo(n.x - p.x, n.z - p.z), p.yaw)); if (a > 1.0 && d > 3) continue;
      if (!S.seesBody(this.map, eye, n)) continue;
      if (n.kind === 'guard') { if (n.zapT > 0) continue; n.handsUp = 8; n.state = 'handsup'; n.det = Math.max(n.det, 0.5); n.callT = 0; }
      else { if (!n.hostage) p.stats.hostages++; n.hostage = true; n.hostT = this.alarm ? 70 : 50; n.state = 'sit'; n.callT = 0; n.det = 0.2; }
    }
    this.bcast({ t: 'hostages', n: this.hostageCount() });
  }
  fire(p, o, d) {
    if (this.state !== 'play' || p.down || p.custodyT > 0 || !p.masked || p.carry && BAG[this.bags.get(p.carry)?.kind]?.heavy) return;
    if (p.reloadT > 0 || p.fireT > 0) return;
    if (p.mag <= 0) { this.reload(p); return; }
    p.fireT = 0.11; p.mag--; p.hurtT = Math.min(p.hurtT, 9);
    const l = Math.hypot(d[0], d[1], d[2]) || 1; d = [d[0] / l, d[1] / l, d[2] / l];
    if (!o || Math.hypot(o[0] - p.x, o[2] - p.z) > 2.5) o = [p.x, p.y + 1.35, p.z];
    const R = 70, w = S.segMap(this.map, o[0], o[1], o[2], o[0] + d[0] * R, o[1] + d[1] * R, o[2] + d[2] * R, 'shot');
    let best = w ? w.t * R : R, hitN = null, head = false;
    for (const n of this.npcs.values()) {
      if (n.hp <= 0 || n.zapT > 0 && !isCop(n)) continue;
      const r = S.rayBody(o[0], o[1], o[2], d[0], d[1], d[2], { x: n.x, y: n.y, z: n.z, pose: npcPose(n), big: n.kind === 'heavy' }, best); if (r && r.d < best) { best = r.d; hitN = n; head = r.head; }
    }
    // cameras are little targets high on the walls
    let cam = -1;
    this.map.cams.forEach((c, i) => {
      if (this.cams[i].state === 'broken') return;
      const fx = c.x - o[0], fy = c.y - o[1], fz = c.z - o[2], t = fx * d[0] + fy * d[1] + fz * d[2];
      if (t < 0 || t > best) return;
      const px = o[0] + d[0] * t - c.x, py = o[1] + d[1] * t - c.y, pz = o[2] + d[2] * t - c.z;
      if (px * px + py * py + pz * pz < 0.3 * 0.3) { best = t; cam = i; hitN = null; }
    });
    const h = [r2(o[0] + d[0] * best), r2(o[1] + d[1] * best), r2(o[2] + d[2] * best)];
    this.bcast({ t: 'shot', id: p.id, o: o.map(r2), h, hit: hitN ? hitN.id : 0, head, wall: !hitN && w ? w.c?.kind || 'floor' : '', glass: !hitN && w?.c?.glass ? 1 : 0 });
    this.noise(p.x, p.z, this.alarm ? 0 : 18, 0.5, p);
    if (cam >= 0) { this.cams[cam].state = 'broken'; this.camDet = Math.min(0.95, this.camDet + 0.15); this.bcast({ t: 'cams', cams: this.cams.map(c => c.state), broke: cam }); }
    if (hitN) this.hitNpc(hitN, head ? 44 : 22, p);
  }
  reload(p) { if (p.reloadT > 0 || p.mag >= MAG || p.ammo <= 0) return; p.reloadT = 2.1; this.bcast({ t: 'fx', k: 'reload', id: p.id }); }
  hitNpc(n, dmg, p) {
    if (isCop(n) || n.kind === 'guard' && (this.alarm || n.state === 'fight')) {
      n.hp -= dmg; n.alert = 3; n.target = p.id;
      if (n.hp <= 0) { n.hp = 0; n.zapT = 8; n.state = 'zapped'; p.stats.zaps++; this.bcast({ t: 'fx', k: 'zap', npc: n.id, by: p.id });
        if (Math.random() < 0.35) { const b = this.addBag('ammo', n.x, 0.1, n.z); b.kind = 'ammo'; b.born = this.clock; this.bcast({ t: 'bag', add: [this.bagPub(b)] }); } }
      else this.bcast({ t: 'fx', k: 'hitnpc', npc: n.id });
      return;
    }
    // zapping a guard or a civilian knocks them out for a while (guards wake up angry)
    n.zapT = n.kind === 'guard' ? 30 : 40; n.handsUp = 0; n.callT = 0; n.det = 0; n.state = 'zapped';
    if (n.kind === 'guard') p.stats.zaps++;
    this.bcast({ t: 'fx', k: 'zap', npc: n.id, by: p.id });
    if (n.kind !== 'guard' && this.alarm === false) this.noise(n.x, n.z, 10, 0.4, p);
  }
  /** A loud noise: people nearby get suspicious and look toward it. */
  noise(x, z, r, amt, p) {
    if (this.alarm || r <= 0) return;
    for (const n of this.npcs.values()) {
      if (n.hostage || n.cuffed || n.zapT > 0 || n.hp <= 0 || n.state === 'panic') continue;
      const d = Math.hypot(n.x - x, n.z - z); if (d > r) continue;
      n.det = Math.min(0.99, n.det + amt * (1 - d / r) * (n.kind === 'guard' ? 1.4 : 1));
      n.alert = 2.5; n.look = [x, z]; n.detBy = p?.id || n.detBy;
    }
  }

  // ---------------------------------------------------------------- messages from a player
  handle(p, m) {
    switch (m.t) {
      case 'st': {
        if (this.state !== 'play' && this.mapId !== HIDEOUT) break;
        if (p.down || p.custodyT > 0) break;
        const x = +m.x, y = +m.y, z = +m.z; if (![x, y, z].every(Number.isFinite)) break;
        if (Math.hypot(x - p.x, z - p.z) > 8 && !p.tpGrace) { this.outTp(p); break; }
        p.tpGrace = false;
        Object.assign(p, { x, y, z, vx: +m.vx || 0, vz: +m.vz || 0, yaw: +m.yaw || 0, pitch: +m.pitch || 0, onGround: !!m.g, crouch: !!m.c, aim: !!m.a });
        break;
      }
      case 'chat': { const text = clean(m.text, 140); if (text) this.bcast({ t: 'chat', from: p.name, color: p.color, text }); break; }
      case 'set': {
        if (p.id !== this.hostId || this.state !== 'lobby') break;
        const s = m.settings || {};
        if (s.diff !== undefined) this.settings.diff = clamp(Math.round(+s.diff) || 0, 0, 2);
        if (s.plan !== undefined) this.settings.plan = s.plan === 'loud' ? 'loud' : 'stealth';
        if (s.cpus !== undefined) { this.settings.cpus = !!s.cpus; this.syncBots(); }
        if (s.public !== undefined) this.public = !!s.public;
        this.pushRoom();
        break;
      }
      case 'start': if (p.id === this.hostId && (this.state === 'lobby' || this.state === 'end')) { if (this.state === 'end') this.toLobby(true); this.start(); } break;
      case 'lobby': if (p.id === this.hostId && this.state === 'end') this.toLobby(); break;
      default:
        if (this.state !== 'play' || this.mapId !== BANK) break;
        if (m.t === 'mask') this.maskUp(p);
        else if (m.t === 'shoot' && Array.isArray(m.d)) this.fire(p, Array.isArray(m.o) ? m.o.map(Number) : null, m.d.map(Number));
        else if (m.t === 'reload') this.reload(p);
        else if (m.t === 'shout') this.shout(p);
        else if (m.t === 'act') this.startAct(p, m.k ? String(m.k) : null, typeof m.id === 'string' ? m.id : Number(m.id));
        else if (m.t === 'throw' && p.carry) { const b = this.bags.get(p.carry); if (b) b.thrower = p.id; this.dropBag(p, Array.isArray(m.d) ? m.d.map(Number) : [-Math.sin(p.yaw), 0, -Math.cos(p.yaw)]); }
    }
  }
  sendMe(p) {
    const a = p.act;
    this.out(p, { t: 'me', hp: Math.round(p.hp), armor: Math.round(p.armor), mag: p.mag, ammo: p.ammo, reload: r2(p.reloadT), masked: p.masked, carry: p.carry ? this.bags.get(p.carry)?.kind : null, key: p.keycard, pocket: p.pocket, act: a ? [a.k, r2(a.t / a.need)] : null, down: p.down ? r2(p.downT) : 0, arrest: r2(p.arrestT), custody: p.custodyT > 0 ? r2(p.custodyT) : 0, det: r2(p.det || 0), stats: p.stats });
  }

  // ---------------------------------------------------------------- the clock
  tick(dt) {
    if (this.mapId === HIDEOUT) {
      for (const p of this.crew()) if (p.bot) hideoutBot(this, p, dt);
      this.snap(dt);
      if (this.state === 'end') { this.endT -= dt; if (this.endT <= 0 && !this.solo) this.toLobby(); }
      return;
    }
    if (this.state === 'end') { this.endT -= dt; if (this.endT <= 0 && !this.solo) this.toLobby(); this.snap(dt); return; }
    if (this.state !== 'play') return;
    this.clock += dt;
    const len = this.settings.len;
    // timeline
    if (this.truck.state === 'none' && this.clock >= T_TRUCK * len / GAME_LEN) { this.truck.state = 'here'; this.setDoor('truck', false); this.bcast({ t: 'truck', state: 'here', bags: 0 }); this.sys('🚚 An armored truck just parked out front! Break into the back of it for 6 gold bags (it leaves at 21:00).'); }
    if (this.truck.state === 'here' && this.clock >= T_TRUCK_GONE * len / GAME_LEN && this.drill.on !== 'truck') { this.truck.state = 'gone'; this.setDoor('truck', true); this.bcast({ t: 'truck', state: 'gone', bags: 0 }); }
    if (!this.cageOpened && this.clock >= T_CAGE * len / GAME_LEN) { this.cageOpened = true; this.setDoor('cage', true); this.bcast({ t: 'fx', k: 'cage' }); this.sys('⏰ 20:00 — the reserve time-lock just opened! Gold and THE GOOGLY DIAMOND are behind the cage in the vault.'); }
    if (!this.finalCalled && this.clock >= len - 120) { this.finalCalled = true; this.bcast({ t: 'final' }); this.sys('🚐 TWO MINUTES LEFT! Everybody get to the van in the alley — anyone who isn\'t there at 30:00 gets left behind!'); }
    if (this.clock >= len) { this.endGame(false); return; }
    this.tickPolice(dt);
    this.tickVan(dt);
    this.tickDrill(dt);
    this.tickBags(dt);
    this.detAcc += dt;
    if (this.detAcc >= 0.1) { this.tickDetection(this.detAcc); this.detAcc = 0; }
    if (!this.alarm) this.tickCustomers(dt);
    this.fieldT -= dt; if (this.fieldT <= 0) { this.fieldT = 1.0; this.buildFields(); }
    for (const n of [...this.npcs.values()]) npcTick(this, n, dt);
    for (const p of this.crew()) {
      this.tickCrew(p, dt);
      if (p.bot) crewBot(this, p, dt);
      this.tickAct(p, dt);
    }
    this.snap(dt);
  }
  tickCrew(p, dt) {
    p.hurtT += dt; p.shoutT = Math.max(0, p.shoutT - dt); p.fireT = Math.max(0, p.fireT - dt);
    if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { const n = Math.min(MAG - p.mag, p.ammo); p.mag += n; p.ammo -= n; p.reloadT = 0; } }
    if (p.hurtT > 4 && p.armor < ARMOR_MAX && !p.down) p.armor = Math.min(ARMOR_MAX, p.armor + 30 * dt);
    if (p.custodyT > 0) {
      p.custodyT -= dt;
      if (p.custodyT <= 0) {
        p.custodyT = 0; Object.assign(p, { hp: HP_MAX, armor: ARMOR_MAX, mag: MAG, ammo: Math.max(p.ammo, 90), masked: true, x: this.map.custody[0] + rnd(-1, 1), z: this.map.custody[1] + rnd(-1, 1), y: 0, vx: 0, vz: 0, tpGrace: true });
        if (p.bot) p.brain = newBrain();
        this.outTp(p); this.bcast({ t: 'fx', k: 'back', id: p.id });
      }
      return;
    }
    if (p.down) {
      p.downT -= dt;
      // a cop standing over you slaps the cuffs on
      let cuffing = false;
      for (const n of this.npcs.values()) if (isCop(n) && n.hp > 0 && n.zapT <= 0 && dist(n, p) < 1.6) { cuffing = true; break; }
      p.arrestT = cuffing ? p.arrestT + dt : Math.max(0, p.arrestT - dt);
      if (p.downT <= 0 || p.arrestT > 3) this.arrest(p);
    }
    if (!p.bot && this.alarm && !p.down) ammoPickup(this, p);
    if (p.carry) { const b = this.bags.get(p.carry); p.speedMul = b ? BAG[b.kind]?.speed || 1 : 1; } else p.speedMul = 1;
    if (!p.bot) { this.meAccs ??= new Map(); const t = (this.meAccs.get(p.id) || 0) + dt; if (t > 0.2) { this.sendMe(p); this.meAccs.set(p.id, 0); } else this.meAccs.set(p.id, t); }
  }
  tickDrill(dt) {
    const d = this.drill;
    if (d.state !== 'running') return;
    d.t += dt; d.jamT -= dt;
    if (!this.alarm) this.noise(d.x, d.z, 14, 0.12 * dt * 10, null);
    if (d.t >= d.need) {
      d.state = 'none';
      if (d.on === 'vault') { this.setDoor('vault', true); this.sys('💰 THE VAULT IS OPEN! Bag the cash and gold and get it to the van.'); this.bcast({ t: 'fx', k: 'vaultOpen' }); }
      if (d.on === 'truck') { this.truck.state = 'open'; this.truck.bags = 6; this.bcast({ t: 'truck', state: 'open', bags: 6 }); this.sys('🚚 The armored truck is open — 6 gold bags inside!'); }
      // the drill goes back in its bag, ready for the next job
      const b = this.addBag('drill', d.x, 0.2, d.z); this.bcast({ t: 'bag', add: [this.bagPub(b)] });
      d.on = null; this.bcast({ t: 'drill', drill: this.drillMsg() });
    } else if (d.jamT <= 0) { d.state = 'jammed'; this.bcast({ t: 'drill', drill: this.drillMsg() }); this.sys('⚠️ The drill jammed! Hold E on it to fix it.'); }
  }
  tickCustomers(dt) {
    this.custAt -= dt;
    if (this.custAt > 0) return;
    this.custAt = rnd(40, 75);
    let civs = 0; for (const n of this.npcs.values()) if (n.kind === 'civ') civs++;
    if (civs > 16) return;
    const s = pick(this.map.street);
    this.addNpc({ kind: 'civ', x: s[0], z: s[1] + rnd(-0.5, 1.5), state: 'enter', walkTo: pick(this.map.lobbySpots) });
  }
  /** Who can see what they shouldn't? Witnesses fill up a suspicion meter; when it's full they call it in. */
  tickDetection(dt) {
    if (this.alarm) { for (const p of this.crew()) p.det = 0; return; }
    const D = DIFF[this.settings.diff], m = this.map;
    for (const p of this.crew()) p.det = 0;
    const suspects = this.crew().filter(p => p.custodyT <= 0);
    const evidence = [...this.npcs.values()].filter(n => (n.kind === 'guard' && (n.cuffed || n.zapT > 0 || n.hostage)) || (n.hostage && n.kind !== 'guard') || n.zapT > 0);
    if (this.drill.state !== 'none' && this.drill.on) evidence.push({ x: this.drill.x, y: 0.3, z: this.drill.z, drill: true });
    for (const n of this.npcs.values()) {
      if (n.hp <= 0 || n.zapT > 0 || n.cuffed || n.hostage || n.handsUp > 0 || isCop(n) || n.state === 'panic' || n.state === 'flee') continue;
      const eye = [n.x, n.y + S.EYE, n.z], range = n.kind === 'guard' ? (n.seat && n.state === 'idle' ? 7 : 20) : 15;   // the security guard mostly watches his monitors
      let gain = 0, by = 0;
      for (const p of suspects) {
        const d = dist(n, p); if (d > range) continue;
        const carryK = p.carry ? this.bags.get(p.carry)?.kind : null;
        const zone = m.zoneAt(p.x, p.z);
        let rate = p.masked ? 1 : carryK && carryK !== 'key' ? 0.8 : m.restricted(zone) ? 0.3 : p.act ? 0.5 : 0;
        if (!rate) continue;
        const ang = Math.abs(angDiff(yawTo(p.x - n.x, p.z - n.z), n.yaw));
        if (ang > (n.alert > 0 ? 2.4 : 1.15) && d > 2) continue;
        if (!S.seesBody(m, eye, p)) continue;
        const k = rate * D.det * (0.9 + 2.2 * (1 - d / range)) * 0.55 * (p.crouch ? 0.65 : 1) * (n.kind === 'guard' ? 1.25 : 1);
        if (k > gain) { gain = k; by = p.id; }
        p.det = Math.max(p.det, n.det);
      }
      for (const e of evidence) {
        if (e === n) continue;
        const d = Math.hypot(n.x - e.x, n.z - e.z); if (d > 12) continue;
        const ang = Math.abs(angDiff(yawTo(e.x - n.x, e.z - n.z), n.yaw)); if (ang > 1.2) continue;
        if (!S.canSee(m, eye, [e.x, 0.5, e.z])) continue;
        gain = Math.max(gain, (e.drill ? 0.9 : 0.35) * D.det);
      }
      if (gain > 0) { n.det = Math.min(1, n.det + gain * dt * 0.3 / 0.55); if (by) n.detBy = by; n.alert = Math.max(n.alert, 1.5); const q = this.players.get(by); if (q) n.look = [q.x, q.z]; }
      else n.det = Math.max(0, n.det - dt * 0.12);
      if (n.det >= 1) this.witness(n);
    }
    // the cameras feed the security guard's monitors
    const sg = [...this.npcs.values()].find(n => n.kind === 'guard' && n.seat);
    const watching = sg && sg.state === 'idle' && sg.zapT <= 0 && !sg.cuffed && !sg.hostage && sg.handsUp <= 0 && sg.hp > 0;
    if (watching) {
      let gain = 0;
      m.cams.forEach((c, i) => {
        if (this.cams[i].state !== 'on') return;
        for (const p of suspects) {
          if (!p.masked && !(p.carry && this.bags.get(p.carry)?.kind !== 'key')) continue;
          const d = Math.hypot(p.x - c.x, p.z - c.z); if (d > 20) continue;
          if (Math.abs(angDiff(yawTo(p.x - c.x, p.z - c.z), c.yaw)) > 0.8) continue;
          if (!S.canSee(m, [c.x, c.y - 0.2, c.z], S.chestOf(p))) continue;
          gain = Math.max(gain, D.det * 0.14 * (1.3 - d / 25)); p.det = Math.max(p.det, this.camDet);
        }
      });
      this.camDet = gain > 0 ? Math.min(1, this.camDet + gain * dt) : Math.max(0, this.camDet - dt * 0.05);
      if (this.camDet >= 1) { sg.state = 'radio'; sg.callT = 1.2; sg.det = 1; }
    }
  }
  witness(n) {
    if (n.state === 'panic' || n.state === 'radio' || n.callT > 0) return;
    if (n.kind === 'guard') { n.state = 'radio'; n.callT = 1.3; }
    else if (n.kind === 'teller') { n.state = 'panic'; n.callT = 1.8; }           // the silent alarm button under the counter
    else { n.state = 'panic'; n.callT = n.kind === 'manager' ? 3 : 4.2; }        // phone out, calling the police
    this.bcast({ t: 'fx', k: 'spotted', npc: n.id });
  }
  buildFields() {
    // flow fields toward every robber who's up, for the police; plus one to the front door for people running away
    const f = new Map();
    const nav = this.navNpc;
    for (const p of this.crew()) if (p.custodyT <= 0) f.set(p.id, S.flowField(nav, p.x, p.z, 260));
    if (!this.fields.has('exit')) f.set('exit', S.flowField(nav, this.map.frontDoor[0], this.map.frontDoor[1] + 2, 400)); else f.set('exit', this.fields.get('exit'));
    this.fields = f;
  }
  tickEarlyEscape(dt) {
    // if the whole bank is empty and every robber who's free is at the van, you can leave early
    const lootLeft = this.loot.pallets.some(v => v > 0) || [...this.bags.values()].some(b => !b.secured && b.kind !== 'key' && b.kind !== 'drill' && b.kind !== 'ammo') || this.truck.state === 'here' || this.truck.state === 'open' && this.truck.bags > 0;
    if (lootLeft || !this.cageOpened || this.van.state !== 'here') { this.earlyT = 0; return; }
    const z = this.map.van.zone, free = this.crew().filter(p => p.custodyT <= 0);
    if (free.length && free.every(p => !p.down && p.x > z[0] && p.x < z[2] && p.z > z[1] && p.z < z[3])) {
      this.earlyT += dt;
      if (this.earlyT > 8) this.endGame(true);
    } else this.earlyT = 0;
  }
  snap(dt) {
    this.snapAcc += dt;
    if (this.snapAcc < 1 / 15) return;
    this.snapAcc = 0;
    const e = this.crew().map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), crewFlags(this, p), r2(p.vx), r2(p.vz), r2(p.pitch || 0), p.carry ? CARRY_I[this.bags.get(p.carry)?.kind] || 0 : 0, p.act ? ACT_I[p.act.k] || 1 : 0, Math.round(p.hp), Math.round(p.armor), p.custodyT > 0 ? Math.ceil(p.custodyT) : p.down ? Math.ceil(p.downT) : 0]);
    const msg = { t: 'snap', clock: r2(this.clock), st: this.state, e };
    if (this.mapId === BANK) {
      msg.n = [...this.npcs.values()].map(n => [n.id, r2(n.x), r2(n.z), r2(n.yaw), this.npcFlags(n), r2(n.vx), r2(n.vz)]);
      msg.b = [...this.bags.values()].filter(b => b.fly).map(b => [b.id, r2(b.x), r2(b.y), r2(b.z)]);
      if (this.drill.state !== 'none') msg.dr = [this.drill.state === 'jammed' ? 1 : 0, r2(this.drill.t)];
      msg.cd = r2(this.camDet); msg.w = this.wave ? [this.wave.k, Math.max(0, Math.round(this.wave.t)), this.wave.n] : null; msg.v = this.van.state === 'away' ? Math.ceil(this.van.t) : 0; msg.et = r2(this.earlyT);
    }
    this.bcast(msg);
  }
  endGame(early) {
    if (this.state !== 'play') return;
    this.state = 'end'; this.endT = this.solo ? 1e9 : 20;
    const z = this.map.van.zone;
    let take = this.secured;
    const rows = this.crew().map(p => {
      const esc = p.custodyT <= 0 && !p.down && p.x > z[0] && p.x < z[2] && p.z > z[1] && p.z < z[3] && this.van.state === 'here';
      p.escaped = esc;
      let carried = 0;
      if (esc && p.carry) { const b = this.bags.get(p.carry); carried = BAG[b?.kind]?.value || 0; take += carried; p.stats.secured += carried; }
      if (esc) take += p.pocket;
      return { id: p.id, name: p.name, color: p.color, bot: p.bot, escaped: esc, secured: p.stats.secured, pocket: esc ? p.pocket : 0, zaps: p.stats.zaps, revives: p.stats.revives, downs: p.stats.downs, custody: p.stats.custody, hostages: p.stats.hostages, boxes: p.stats.boxes };
    });
    const score = r => r.secured + r.pocket + r.zaps * 1500 + r.revives * 6000 + r.hostages * 800 - r.custody * 10000 + (r.escaped ? 20000 : 0);
    rows.sort((a, b) => score(b) - score(a));
    const grade = take >= 2200000 ? 'S' : take >= 1600000 ? 'A' : take >= 1000000 ? 'B' : take >= 600000 ? 'C' : take >= 300000 ? 'D' : 'F';
    const awards = [];
    const best = (k, emoji, title, fmt) => { const r = rows.slice().sort((a, b) => b[k] - a[k])[0]; if (r && r[k] > 0) awards.push({ id: r.id, emoji, title, val: fmt(r[k]) }); };
    best('secured', '💰', 'Bag Runner', v => `$${v.toLocaleString()} to the van`);
    best('zaps', '⚡', 'Sharpshooter', v => `${v} zapped`);
    best('revives', '🩹', 'Guardian Angel', v => `${v} revives`);
    best('hostages', '🙌', 'Crowd Control', v => `${v} hostages`);
    best('boxes', '🗄', 'Box Cracker', v => `${v} deposit boxes`);
    const share = Math.round(take / SLOTS);
    this.bcast({ t: 'end', rows, take, secured: this.secured, grade, awards, share, early, stealth: !this.alarm, bags: this.securedBags.length, clock: Math.floor(this.clock), mvp: rows[0]?.id || 0 });
    this.sys(`🏁 ${early ? 'The crew got away early' : 'The van is gone'}! Total take: $${take.toLocaleString()} — grade ${grade}.`);
  }
  toLobby(silent = false) {
    this.state = 'lobby'; this.mapId = HIDEOUT; this.map = roomMap(HIDEOUT);
    this.npcs.clear(); this.bags.clear();
    this.crew().forEach((p, i) => { Object.assign(p, freshCrew()); this.place(p, i); });
    this.syncBots();
    if (!silent) { this.bcast(this.worldMsg()); this.pushRoom(); }
  }
  // ---------------------------------------------------------------- PLAY SOLO saves
  save() {
    if (this.state !== 'play' || this.mapId !== BANK) return null;
    const strip = o => { const c = { ...o }; delete c.brain; delete c.ws; delete c.room; return c; };
    return {
      v: 1, settings: this.settings, clock: this.clock, alarm: this.alarm, alarmAt: this.alarmAt, wave: this.wave, secured: this.secured, securedBags: this.securedBags,
      van: this.van, truck: this.truck, drill: this.drill, loot: this.loot, cams: this.cams, camDet: this.camDet, custAt: this.custAt, heli: this.heli, finalCalled: this.finalCalled, cageOpened: this.cageOpened,
      doors: Object.fromEntries(Object.entries(this.map.doors).map(([k, d]) => [k, d.open])),
      players: this.crew().map(strip), npcs: [...this.npcs.values()].map(strip), bags: [...this.bags.values()],
    };
  }
  restore(d, human) {
    this.mapId = BANK; this.map = roomMap(BANK);
    Object.assign(this, { settings: d.settings, clock: d.clock, alarm: d.alarm, alarmAt: d.alarmAt, wave: d.wave, secured: d.secured, securedBags: d.securedBags, van: d.van, truck: d.truck, drill: d.drill, loot: d.loot, cams: d.cams, camDet: d.camDet, custAt: d.custAt, heli: d.heli, finalCalled: d.finalCalled, cageOpened: d.cageOpened });
    for (const [k, v] of Object.entries(d.doors)) if (this.map.doors[k]) this.map.doors[k].open = v;
    this.navNpc = navFor(this.map, 'npc'); this.navCrew = navFor(this.map, 'crew'); this.fields = new Map(); this.fieldT = 0;
    this.state = 'play'; this.spawnT = 0; this.earlyT = 0;
    this.players.clear(); this.npcs.clear(); this.bags.clear();
    for (const q of d.players) {
      if (!q.bot) { Object.assign(human, { ...q, id: human.id, name: human.name, color: human.color, skin: human.skin, mask: human.mask, bot: false }); this.players.set(human.id, human); this.hostId = human.id; }
      else { const b = { ...q, brain: newBrain() }; this.players.set(b.id, b); nextBotId = Math.max(nextBotId, b.id + 1); }
    }
    for (const n of d.npcs) { this.npcs.set(n.id, { ...n, brain: { path: null, goal: null, pathT: 0 } }); nextNpcId = Math.max(nextNpcId, n.id + 1); }
    for (const b of d.bags) { if (b.by === (d.players.find(q => !q.bot)?.id)) b.by = human.id; this.bags.set(b.id, b); nextBagId = Math.max(nextBagId, b.id + 1); }
    if (human.carry && !this.bags.has(human.carry)) human.carry = null;
    this.out(human, { t: 'joined', code: 'SOLO', id: human.id });
    this.out(human, this.worldMsg());
    this.pushRoom();
  }
}
const BAG_R = 0.3;
const CARRY_I = { cash: 1, gold: 2, diamond: 3, drill: 4 };
export const CARRY_KINDS = [null, 'cash', 'gold', 'diamond', 'drill'];
const ACT_I = { revive: 2, lockpick: 3, deposit: 3, atm: 3, safe: 3, cams: 3, fixDrill: 3, cuff: 4, bag: 5, truckbag: 5 };
function crewFlags(R, p) { return (p.masked ? 1 : 0) | (p.onGround ? 2 : 0) | (p.down ? 4 : 0) | (p.crouch ? 8 : 0) | (p.custodyT > 0 ? 16 : 0) | (p.aim || p.fireT > 0.05 ? 32 : 0) | (p.reloadT > 0 ? 128 : 0) | (p.shoutT > 0.6 ? 256 : 0) | (p.keycard ? 512 : 0); }
export const npcPose = n => n.zapT > 0 || n.hp <= 0 ? 'lie' : n.hostage || n.cuffed || n.state === 'sit' || n.seat && n.state === 'idle' ? 'sit' : n.state === 'cower' || n.crouch ? 'crouch' : 'stand';
export const isCop = n => n.kind === 'cop' || n.kind === 'swat' || n.kind === 'heavy';

// =================================================================== the people in the bank, and the police
function walk(R, n, goal, dt, speed = 1, nav = R.navNpc) {
  const B = n.brain;
  if (!B.path || !B.goal || Math.hypot(goal[0] - B.goal[0], goal[1] - B.goal[1]) > 0.8 || R.clock - B.pathT > 4) {
    B.path = S.findPath(nav, n.x, n.z, goal[0], goal[1]); B.goal = goal; B.pathT = R.clock + rnd(0, 1);
  }
  let dx = 0, dz = 0, done = false;
  if (B.path) { const f = S.followPath(n, B.path); dx = f.dx; dz = f.dz; done = f.done || Math.hypot(goal[0] - n.x, goal[1] - n.z) < 0.5; }
  else done = Math.hypot(goal[0] - n.x, goal[1] - n.z) < 1;
  if (done) dx = dz = 0;
  step(R, n, dx, dz, dt, speed);
  return done;
}
function step(R, n, dx, dz, dt, speed = 1, face = null) {
  const sm = n.speedMul; n.speedMul = sm * speed;
  S.stepPlayer(n, { dx, dz, sprint: speed > 1.2 }, dt, R.map, 'npc');
  n.speedMul = sm;
  const want = face ?? (Math.hypot(dx, dz) > 0.1 ? yawTo(dx, dz) : null);
  if (want !== null) n.yaw += angDiff(want, n.yaw) * (1 - Math.exp(-9 * dt));
}
function npcTick(R, n, dt) {
  n.t -= dt; n.alert = Math.max(0, n.alert - dt);
  if (n.zapT > 0) {
    n.zapT -= dt; n.vx = n.vz = 0;
    if (n.zapT <= 0) {
      if (isCop(n) || n.hp <= 0) { R.removeNpc(n); return; }       // carried off by their team
      n.state = n.kind === 'guard' ? (R.alarm ? 'fight' : 'radio') : R.alarm ? (n.kind === 'civ' ? 'flee' : 'cower') : 'panic';
      if (n.kind === 'guard' && !R.alarm) { n.callT = 1.5; n.det = 1; }
      if (n.kind !== 'guard' && !R.alarm) { n.callT = 4; n.det = 1; }
    }
    return;
  }
  if (n.cuffed) { n.vx = n.vz = 0; return; }
  if (n.hostage) {
    n.vx = n.vz = 0; n.hostT -= dt;
    if (n.hostT <= 0) { n.hostage = false; n.state = R.alarm ? (n.kind === 'civ' ? 'flee' : 'cower') : n.kind === 'civ' ? 'sneak' : 'panic'; n.det = R.alarm ? 0 : 0.7; if (!R.alarm && n.kind !== 'civ') n.callT = 3; }
    return;
  }
  if (n.handsUp > 0) {
    n.handsUp -= dt; n.vx = n.vz = 0;
    if (n.handsUp <= 0) { n.state = R.alarm ? 'fight' : 'radio'; n.callT = 1.4; n.det = 1; }   // he's had enough of standing there
    return;
  }
  // calling the police: when the timer runs out, it's loud
  if (n.callT > 0 && !R.alarm) {
    n.callT -= dt;
    if (n.callT <= 0) {
      const who = { guard: 'A guard radioed it in', teller: 'A teller hit the silent alarm', manager: 'The manager called the police', civ: 'A customer called the police' }[n.kind] || 'Somebody called the police';
      R.raiseAlarm(n.state === 'radio' && n.seat ? 'The security guard saw you on the cameras' : who);
      n.state = n.kind === 'guard' ? 'fight' : n.kind === 'civ' ? 'flee' : 'cower';
    }
  }
  if (isCop(n) || n.kind === 'guard' && n.state === 'fight') { copTick(R, n, dt); return; }
  const m = R.map;
  switch (n.state) {
    case 'enter': if (walk(R, n, n.walkTo || [0, 5], dt)) { n.state = 'idle'; n.t = rnd(3, 9); } break;
    case 'panic': {
      // phone out, backing away from the robbers — or running for the door
      if (n.kind === 'civ' && m.zoneAt(n.x, n.z) !== 'outside') runExit(R, n, dt, 1.5);
      else { n.vx = n.vz = 0; if (n.look) n.yaw += angDiff(yawTo(n.look[0] - n.x, n.look[1] - n.z), n.yaw) * (1 - Math.exp(-6 * dt)); }
      break;
    }
    case 'flee': case 'sneak': runExit(R, n, dt, n.state === 'flee' ? 1.5 : 0.8); break;
    case 'radio': n.vx = n.vz = 0; break;
    case 'cower': n.vx = n.vz = 0; n.crouch = true; break;
    case 'leave': runExit(R, n, dt, 0.9); break;
    default: idleTick(R, n, dt);
  }
}
function runExit(R, n, dt, speed) {
  const m = R.map;
  if (m.zoneAt(n.x, n.z) === 'outside' && n.z > 11) {
    // out on the street: keep going and vanish round the corner
    const s = n.x < 0 ? m.street[0] : m.street[1];
    const done = walk(R, n, s, dt, speed);
    if (done || Math.abs(n.x) > 44) R.removeNpc(n);
    if (n.state === 'sneak' && !R.alarm && n.callT <= 0) { n.callT = 3; }
    return;
  }
  const F = R.fields.get('exit');
  if (F) { const f = S.flowDir(F, n.x, n.z); step(R, n, f.dx, f.dz, dt, speed); if (f.d < 2) { n.brain.path = null; walk(R, n, [n.x < 0 ? -8 : 8, 13.5], dt, speed); } }
  else walk(R, n, [0, 13], dt, speed);
}
function idleTick(R, n, dt) {
  const m = R.map;
  if (n.alert > 0 && n.look) { n.vx = n.vz = 0; n.yaw += angDiff(yawTo(n.look[0] - n.x, n.look[1] - n.z), n.yaw) * (1 - Math.exp(-5 * dt)); return; }
  if (n.kind === 'teller') { if (Math.hypot(n.x - n.home[0], n.z - n.home[1]) > 0.5) walk(R, n, n.home, dt, 0.8); else { n.vx = n.vz = 0; n.yaw += angDiff(0, n.yaw) * (1 - Math.exp(-3 * dt)); } return; }
  if (n.kind === 'guard' && n.seat) { if (Math.hypot(n.x - n.home[0], n.z - n.home[1]) > 0.5) walk(R, n, n.home, dt, 0.8); else { n.vx = n.vz = 0; n.yaw += angDiff(0, n.yaw) * (1 - Math.exp(-3 * dt)); } return; }
  // wander: go to a spot, hang about, pick another
  if (!n.walkTo || n.t <= 0 && n.arrived) {
    const spots = n.kind === 'manager' ? (Math.random() < 0.35 ? m.managerLobby : m.officeSpots.concat(m.staffSpots.slice(0, 3))) : n.kind === 'guard' ? m.guardPosts[n.post].patrol : Math.random() < 0.25 ? m.benchSpots : m.lobbySpots;
    // customers are done with their banking after a while and leave
    if (n.kind === 'civ' && Math.random() < 0.08) { n.state = 'leave'; return; }
    n.walkTo = pick(spots); n.arrived = false; n.t = rnd(4, 12);
  }
  if (!n.arrived) { if (walk(R, n, n.walkTo, dt, n.kind === 'guard' ? 0.7 : 0.62)) { n.arrived = true; n.sitting = m.benchSpots.includes(n.walkTo); } }
  else { n.vx = n.vz = 0; if (Math.random() < dt * 0.2) n.yaw += rnd(-1, 1); }
  if (n.sitting && n.arrived) n.state = 'idle';
}
/** Police (and guards once it's loud): hunt the nearest robber, keep a fighting distance, shoot in bursts, arrest the fallen. */
function copTick(R, n, dt) {
  const C = COP[n.kind], D = DIFF[R.settings.diff], m = R.map;
  n.fireT -= dt;
  if (n.state === 'retreat') {
    const sp = R.map.copSpawns.reduce((a, s) => Math.hypot(s[0] - n.x, s[1] - n.z) < Math.hypot(a[0] - n.x, a[1] - n.z) ? s : a);
    if (walk(R, n, sp, dt, 1.1) || Math.hypot(sp[0] - n.x, sp[1] - n.z) < 3) R.removeNpc(n);
    return;
  }
  // choose a target: the closest robber we can get to (re-think every second)
  n.thinkT = (n.thinkT || 0) - dt;
  if (n.thinkT <= 0 || !R.players.get(n.target) || R.players.get(n.target).custodyT > 0) {
    n.thinkT = rnd(0.8, 1.4);
    let best = null, bd = 1e9;
    for (const p of R.crew()) {
      if (p.custodyT > 0) continue;
      const F = R.fields.get(p.id), fd = F ? S.flowDir(F, n.x, n.z).d * 0.5 : dist(n, p);
      const d = fd + (p.down ? -4 : 0) + (n.target === p.id ? -3 : 0);
      if (d < bd) { bd = d; best = p; }
    }
    n.target = best ? best.id : 0;
  }
  const p = R.players.get(n.target);
  if (!p) { n.vx = n.vz = 0; return; }
  const d = dist(n, p);
  n.losT = (n.losT || 0) - dt;
  if (n.losT <= 0) { n.losT = 0.25; n.los = d < 40 && S.seesBody(m, [n.x, n.y + S.EYE, n.z], p); if (n.los) n.seenT = (n.seenT || 0) + 0.25; else n.seenT = 0; }
  // downed robber: walk over and cuff them
  if (p.down) {
    const F = R.fields.get(p.id);
    if (d > 1.1) { if (F && d > 3) { const f = S.flowDir(F, n.x, n.z); step(R, n, f.dx, f.dz, dt, 1.1); } else step(R, n, (p.x - n.x) / d, (p.z - n.z) / d, dt, 0.8); }
    else step(R, n, 0, 0, dt, 1, yawTo(p.x - n.x, p.z - n.z));
    return;
  }
  const face = yawTo(p.x - n.x, p.z - n.z);
  if (n.los && d < C.range) {
    // in the fight: hold at a comfortable distance, side-step a little, shoot in bursts
    const want = n.kind === 'heavy' ? 6 : n.kind === 'swat' ? 10 : 12;
    let mx = 0, mz = 0;
    if (d > want + 3) { const F = R.fields.get(p.id); if (F) { const f = S.flowDir(F, n.x, n.z); mx = f.dx * 0.6; mz = f.dz * 0.6; } }
    else if (d < want - 4 && n.kind !== 'heavy') { mx = -(p.x - n.x) / d * 0.5; mz = -(p.z - n.z) / d * 0.5; }
    n.strafe = (n.strafe ?? (Math.random() < 0.5 ? 1 : -1)); if (Math.random() < dt * 0.4) n.strafe = -n.strafe;
    mx += Math.cos(face) * n.strafe * 0.35; mz += -Math.sin(face) * n.strafe * 0.35;
    step(R, n, mx, mz, dt, 0.7, face);
    if (n.fireT <= 0 && n.seenT > 0.5) {
      if (n.burst <= 0) n.burst = C.burst;
      n.burst--; n.fireT = n.burst > 0 ? 0.13 : rnd(1.1, 2.0);
      copShoot(R, n, p, d, C, D);
    }
  } else {
    n.burst = 0;
    const F = R.fields.get(p.id);
    if (F) { const f = S.flowDir(F, n.x, n.z); step(R, n, f.dx, f.dz, dt, n.los ? 0.9 : 1.15); }
    else walk(R, n, [p.x, p.z], dt, 1.1);
  }
}
function copShoot(R, n, p, d, C, D) {
  const moving = Math.hypot(p.vx || 0, p.vz || 0) > 3;
  const inside = (R.map.inside(p.x, p.z) !== R.map.inside(n.x, n.z)) ? 0.8 : 1;
  const chance = C.acc * D.copAcc * clamp(1.2 - d / 28, 0.12, 1) * (moving ? 0.72 : 1) * (p.crouch ? 0.78 : 1) * inside * (n.kind === 'guard' ? 0.8 : 1);
  const hit = Math.random() < chance;
  const o = [n.x - Math.sin(n.yaw) * 0.4, n.y + 1.3, n.z - Math.cos(n.yaw) * 0.4];
  let h = [p.x, p.y + (p.crouch ? 0.8 : 1.1), p.z];
  if (!hit) { const k = rnd(0.6, 1.6); h = [p.x + rnd(-k, k), p.y + rnd(0.2, 2), p.z + rnd(-k, k)]; const dx = h[0] - o[0], dy = h[1] - o[1], dz = h[2] - o[2], l = Math.hypot(dx, dy, dz); h = [o[0] + dx / l * 60, o[1] + dy / l * 60, o[2] + dz / l * 60]; }
  const w = S.segMap(R.map, o[0], o[1], o[2], h[0], h[1], h[2], 'shot');
  if (w && (!hit || w.t < 0.97)) { h = [o[0] + (h[0] - o[0]) * w.t, o[1] + (h[1] - o[1]) * w.t, o[2] + (h[2] - o[2]) * w.t]; }
  R.bcast({ t: 'shot', npc: n.id, o: o.map(r2), h: h.map(r2), hit: hit && !(w && w.t < 0.97) ? p.id : 0 });
  if (hit && !(w && w.t < 0.97)) R.hurt(p, C.dmg * D.copDmg * rnd(0.8, 1.2), n);
}

// =================================================================== the computer robbers
function newBrain() { return { task: null, thinkT: rnd(0.2, 0.8), path: null, goal: null, pathT: 0, stuck: 0, lastPos: null, stuckT: 0, fireT: 0, target: 0, losT: 0, los: false, aimYaw: 0, maskT: rnd(1.5, 4), wander: null, waitT: 0 }; }
function hideoutBot(R, p, dt) {
  const B = p.brain ||= newBrain();
  B.waitT -= dt;
  if (!B.wander || B.waitT <= 0) { B.wander = [rnd(-10, 10), rnd(-6, 8)]; B.waitT = rnd(3, 8); B.path = null; }
  const nav = R.hideNav ||= S.buildNav(R.map, 'crew');
  botWalk(R, p, B.wander, dt, false, nav);
}
function botWalk(R, p, goal, dt, sprint, nav = R.navCrew, face = null) {
  const B = p.brain;
  if (!B.path || !B.goal || Math.hypot(goal[0] - B.goal[0], goal[1] - B.goal[1]) > 0.6 || R.clock - B.pathT > 3) {
    B.path = S.findPath(nav, p.x, p.z, goal[0], goal[1]); B.goal = goal; B.pathT = R.clock;
    B.noPath = B.path ? 0 : (B.noPath || 0) + 1;
  }
  let dx = 0, dz = 0, there = Math.hypot(goal[0] - p.x, goal[1] - p.z) < 0.55;
  if (B.path && !there) { const f = S.followPath(p, B.path); dx = f.dx; dz = f.dz; if (f.done) there = true; }
  // stuck on something: hop and re-plan
  B.stuckT += dt;
  if (B.stuckT > 1) { const lp = B.lastPos; if (lp && Math.hypot(p.x - lp[0], p.z - lp[1]) < 0.3 && !there && (dx || dz)) { B.path = null; B.stuck++; } else B.stuck = 0; B.lastPos = [p.x, p.z]; B.stuckT = 0; }
  const heavy = p.carry && BAG[R.bags.get(p.carry)?.kind]?.heavy;
  S.stepPlayer(p, { dx, dz, sprint: sprint && !heavy, jump: B.stuck > 1 && Math.random() < 0.3 }, dt, R.map, 'crew');
  const want = face ?? (dx || dz ? yawTo(dx, dz) : null);
  if (want !== null) p.yaw += angDiff(want, p.yaw) * (1 - Math.exp(-10 * dt));
  return there;
}
/** Which rooms can the crew walk into right now (doors that are open)? */
function palletSpot(pl) {
  if (pl.room === 'reserve') return [pl.x, -32.5];
  if (pl.kind === 'gold') return [pl.x - Math.sign(pl.x) * 1.3, pl.z];
  return [pl.x, -24.7];
}
function reach(R, zone) {
  const D = R.map.doors, staff = D.staff.open || D.back.open;
  switch (zone) {
    case 'lobby': case 'outside': return true;
    case 'staff': case 'office': return staff;
    case 'hall': return staff && D.gate.open;
    case 'security': return staff && D.sec.open;
    case 'vault': return staff && D.gate.open && D.vault.open;
    case 'reserve': return staff && D.gate.open && D.vault.open && D.cage.open;
  }
  return false;
}
/** Where to stand to deal with someone: next to them, or (if they're behind the counter glass) facing them across it. */
function approach(R, n) {
  const z = R.map.zoneAt(n.x, n.z);
  if (reach(R, z)) return [n.x, n.z];
  if (z === 'staff' && n.z > -8) return [clamp(n.x, -13, 13), -2.7];
  return null;
}
/** Is this spot free for me (no other computer robber already doing it)? */
function free(R, p, key) { for (const q of R.crew()) if (q !== p && q.bot && q.brain?.task?.key === key) return false; return true; }
function humanNear(R, x, z, r = 2.2) { return R.humans().some(h => Math.hypot(h.x - x, h.z - z) < r && h.act); }
function crewBot(R, p, dt) {
  const B = p.brain ||= newBrain();
  if (p.custodyT > 0 || p.down) { B.task = null; p.act = null; return; }
  const loud = R.alarm, m = R.map;
  // --- masks: in a loud plan (or once any human has masked up) the computer crew masks up too
  if (!p.masked) {
    B.maskT -= dt;
    const go = loud || R.settings.plan === 'loud' || R.humans().some(h => h.masked) || R.clock > 240;
    if (go && B.maskT <= 0) R.maskUp(p);
  }
  // --- shooting (only once it's loud): aim at the nearest cop we can see
  B.fireT -= dt; B.losT -= dt;
  let tgt = null;
  if (loud && p.masked) {
    if (B.losT <= 0) {
      B.losT = rnd(0.2, 0.35); B.target = 0; let bd = 30;
      for (const n of R.npcs.values()) {
        if (!(isCop(n) || n.kind === 'guard' && n.state === 'fight') || n.hp <= 0 || n.zapT > 0) continue;
        const d = dist(p, n); if (d >= bd) continue;
        if (!S.seesBody(m, S.eyeOf(p), n)) continue;
        bd = d; B.target = n.id;
      }
    }
    tgt = R.npcs.get(B.target);
    if (tgt && (tgt.hp <= 0 || tgt.zapT > 0)) tgt = null;
    if (p.mag <= 0 && p.reloadT <= 0) R.reload(p);
  }
  // --- choose what to do
  B.thinkT -= dt;
  if (B.thinkT <= 0 || !B.task) { B.thinkT = rnd(0.5, 0.9); decide(R, p, B); }
  const T = B.task;
  let face = null;
  if (tgt) face = yawTo(tgt.x - p.x, tgt.z - p.z);
  if (T) doTask(R, p, B, T, dt, face);
  if (tgt && p.mag > 0 && p.reloadT <= 0 && B.fireT <= 0 && !(p.carry && BAG[R.bags.get(p.carry)?.kind]?.heavy)) {
    // fire when we're facing them
    if (Math.abs(angDiff(face, p.yaw)) < 0.35) {
      B.fireT = rnd(0.13, 0.22);
      const o = [p.x, p.y + 1.35, p.z], tz = [tgt.x + rnd(-0.35, 0.35), tgt.y + rnd(0.7, 1.55), tgt.z + rnd(-0.35, 0.35)];
      const d = dist(p, tgt), miss = clamp(d / 45, 0.05, 0.6);
      const dir = [tz[0] - o[0] + rnd(-miss, miss) * d * 0.2, tz[1] - o[1] + rnd(-miss, miss) * d * 0.12, tz[2] - o[2] + rnd(-miss, miss) * d * 0.2];
      const aim = p.aim; p.aim = true; R.fire(p, o, dir); p.aim = aim;
    }
  }
}
function decide(R, p, B) {
  const m = R.map, D = m.doors, loud = R.alarm, cur = B.task;
  const set = (task) => { if (!cur || cur.key !== task.key) { B.task = task; B.path = null; } else B.task = { ...cur, ...task }; };
  const stealthy = !loud && R.settings.plan !== 'loud';
  const carryK = p.carry ? R.bags.get(p.carry)?.kind : null;
  const inZone = (x, z) => { const q = m.van.zone; return x > q[0] && x < q[2] && z > q[1] && z < q[3]; };
  // the van leaves at 30:00: everyone to the alley for the last two minutes
  if (R.clock > R.settings.len - 100 && !carryK || R.clock > R.settings.len - 40) {
    if (carryK && carryK !== 'drill' && R.van.state === 'here') return set({ key: 'load' + p.id, k: 'act', act: 'load', id: 0, to: m.van.rear });
    return set({ key: 'escape' + p.id, k: 'go', to: [27 + (p.id % 4) * 1.4, -19], sprint: true });
  }
  // help a teammate up
  for (const q of R.crew()) {
    if (q === p || !q.down) continue;
    const d = dist(p, q); if (d > 45) continue;
    if (free(R, p, 'revive' + q.id) && !R.crew().some(o => !o.bot && o.act?.k === 'revive' && o.act.id === q.id)) return set({ key: 'revive' + q.id, k: 'act', act: 'revive', id: q.id, to: [q.x, q.z], sprint: true });
  }
  if (!p.masked) {
    // casing the bank like a customer until the crew masks up
    if (!cur || cur.k !== 'wander' || Math.hypot(p.x - cur.to[0], p.z - cur.to[1]) < 1) return set({ key: 'wander' + p.id, k: 'wander', to: pick(m.lobbySpots) });
    return;
  }
  // carrying something: bags go to the van, the drill goes to the vault door (or the truck)
  if (carryK === 'drill') {
    if (!D.vault.open && R.drill.state === 'none') { if (D.gate.open) return set({ key: 'placeDrill', k: 'act', act: 'placeDrill', id: 'vault', to: [0, -19.4] }); }
    if (!D.gate.open) { /* hold on to it and help open the gate below */ }
    else if (R.van.state === 'here') return set({ key: 'returnDrill' + p.id, k: 'act', act: 'load', id: 0, to: m.van.rear });
  } else if (carryK && carryK !== 'key') {
    if (R.van.state === 'here') return set({ key: 'load' + p.id, k: 'act', act: 'load', id: 0, to: m.van.rear });
    return set({ key: 'pile' + p.id, k: 'drop', to: [m.van.rear[0] + rnd(-1.2, 1.2), m.van.rear[1] - rnd(0.2, 1.6)] });
  }
  // low on bullets or health: back to the van for a top-up (only when things are calm-ish)
  if (loud && R.van.state === 'here' && (p.ammo + p.mag < 45 || p.hp < 35) && !carryK) {
    return set({ key: 'supply' + p.id, k: 'act', act: p.hp < 35 ? 'medic' : 'ammo', id: 0, to: m.van.rear, sprint: true });
  }
  if (loud && p.ammo + p.mag < 60) { let best = null, bd = 12; for (const b of R.bags.values()) if (b.kind === 'ammo' && !b.by) { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; best = b; } } if (best) return set({ key: 'ammo' + best.id, k: 'grabAmmo', id: best.id, to: [best.x, best.z] }); }
  // the drill
  if (R.drill.state === 'jammed' && free(R, p, 'fix') && !humanNear(R, R.drill.x, R.drill.z, 3)) return set({ key: 'fix', k: 'act', act: 'fixDrill', id: 0, to: [R.drill.x, R.drill.z + (R.drill.on === 'vault' ? 0.6 : 0)], sprint: true });
  // --- stealth duties (masked, alarm not raised)
  if (stealthy) {
    // guards first: hands up, then cuffs (or keep shouting at him through the glass until someone can get there)
    for (const n of R.npcs.values()) {
      if (n.kind !== 'guard' || n.cuffed || n.hp <= 0) continue;
      const key = 'guard' + n.id; if (!free(R, p, key)) continue;
      const can = reach(R, m.zoneAt(n.x, n.z)), ap = approach(R, n);
      if (!ap) continue;
      if ((n.handsUp > 0 || n.zapT > 0) && can) return set({ key, k: 'act', act: 'cuff', id: n.id, to: [n.x, n.z] });
      if (n.handsUp > 2.5 || n.zapT > 4) continue;
      return set({ key, k: 'shout', id: n.id, to: ap });
    }
    // anyone standing (or calling!) in the lobby or staff area: down on the floor
    let bestN = null, bd = 1e9;
    for (const n of R.npcs.values()) {
      if (n.hostage || n.cuffed || n.hp <= 0 || n.zapT > 0 || n.kind === 'guard' || isCop(n)) continue;
      const z = m.zoneAt(n.x, n.z); if (z === 'outside' && n.z > 14) continue;
      if (!approach(R, n)) continue;
      const d = dist(p, n) - (n.callT > 0 ? 30 : 0) - (n.det > 0.5 ? 10 : 0);
      if (d < bd && free(R, p, 'shoutc' + n.id)) { bd = d; bestN = n; }
    }
    if (bestN) return set({ key: 'shoutc' + bestN.id, k: 'shout', id: bestN.id, to: approach(R, bestN) });
    // hostages whose time is running out get cuffed (or shouted at again if we can't get to them)
    for (const n of R.npcs.values()) {
      if (!n.hostage || n.cuffed || n.hostT > 30 || !free(R, p, 'cuff' + n.id)) continue;
      if (reach(R, m.zoneAt(n.x, n.z))) return set({ key: 'cuff' + n.id, k: 'act', act: 'cuff', id: n.id, to: [n.x, n.z] });
      if (n.hostT < 12) { const ap = approach(R, n); if (ap) return set({ key: 'cuff' + n.id, k: 'shout', id: n.id, to: ap, again: true }); }
    }
  }
  // --- getting through the bank: staff door, keycard, vault gate, back door, the drill
  if (!D.staff.open && !D.back.open && free(R, p, 'staff')) return set({ key: 'staff', k: 'act', act: p.keycard ? 'keycard' : 'lockpick', id: 'staff', to: [17, -3.1] });
  if (!D.back.open && (D.staff.open) && free(R, p, 'back')) return set({ key: 'back', k: 'act', act: 'openBack', id: 0, to: [23.1, -10.2] });
  if (!D.gate.open) {
    if (p.keycard) return set({ key: 'gate', k: 'act', act: 'keycard', id: 'gate', to: [0, -11.1] });
    const kc = [...R.bags.values()].find(b => b.kind === 'key');
    if (kc && free(R, p, 'key')) return set({ key: 'key', k: 'act', act: 'pick', id: kc.id, to: [kc.x, kc.z] });
    const mgr = [...R.npcs.values()].find(n => n.keycard);
    if (mgr && free(R, p, 'key') && !R.crew().some(q => q.keycard)) {
      const ap = approach(R, mgr);
      if ((mgr.hostage || mgr.cuffed || mgr.handsUp > 0 || mgr.zapT > 0) && reach(R, m.zoneAt(mgr.x, mgr.z))) return set({ key: 'key', k: 'act', act: 'takeKey', id: mgr.id, to: [mgr.x, mgr.z] });
      if (ap && !mgr.hostage) return set({ key: 'key', k: 'shout', id: mgr.id, to: ap });
    }
  }
  // the security room: in stealth, the cameras
  if (stealthy && R.cams.some(c => c.state === 'on') && free(R, p, 'cams') && reach(R, 'staff')) {
    if (!D.sec.open) return set({ key: 'cams', k: 'act', act: p.keycard ? 'keycard' : 'lockpick', id: 'sec', to: [17, -11.1] });
    const sg = [...R.npcs.values()].find(n => n.kind === 'guard' && n.seat);
    if (!sg || sg.cuffed || sg.hp <= 0) return set({ key: 'cams', k: 'act', act: 'cams', id: 0, to: [20.6, -18.4] });
  }
  // fetch the drill
  const drillBag = [...R.bags.values()].find(b => b.kind === 'drill' && !b.by);
  const wantDrill = !D.vault.open && R.drill.state === 'none';
  if (wantDrill && !R.crew().some(q => q.carry && R.bags.get(q.carry)?.kind === 'drill') && free(R, p, 'drill') && !carryK) {
    if (drillBag) return set({ key: 'drill', k: 'act', act: 'pick', id: drillBag.id, to: [drillBag.x, drillBag.z] });
    if (R.van.drill && R.van.state === 'here' && (D.gate.open || D.back.open)) return set({ key: 'drill', k: 'act', act: 'takeDrill', id: 0, to: m.van.rear });
  }
  // --- loot
  if (!carryK) {
    // bags lying around (dropped, thrown short) come first
    let best = null, bd = 1e9;
    for (const b of R.bags.values()) {
      if (b.by || b.fly || b.kind === 'key' || b.kind === 'ammo' || b.kind === 'drill') continue;
      const nearVan = R.van.state === 'away' && Math.hypot(b.x - m.van.rear[0], b.z - m.van.rear[1]) < 4.5;
      if (nearVan) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd && free(R, p, 'bag' + b.id)) { bd = d; best = b; }
    }
    if (best) return set({ key: 'bag' + best.id, k: 'act', act: 'pick', id: best.id, to: [best.x, best.z], sprint: true });
    // the pallets in the vault, the reserve, and the truck
    let bp = -1; bd = 1e9;
    m.pallets.forEach((pl, i) => {
      if (R.loot.pallets[i] <= 0) return;
      if (pl.room === 'vault' && !D.vault.open || pl.room === 'reserve' && !D.cage.open) return;
      let taken = 0; for (const q of R.crew()) if (q !== p && q.brain?.task?.key === 'pallet' + i) taken++;
      if (taken >= R.loot.pallets[i]) return;
      const v = pl.kind === 'diamond' ? -30 : pl.kind === 'gold' ? -4 : 0;
      const d = Math.hypot(pl.x - p.x, pl.z - p.z) + v;
      if (d < bd) { bd = d; bp = i; }
    });
    if (R.truck.state === 'open' && R.truck.bags > 0) {
      let taken = 0; for (const q of R.crew()) if (q !== p && q.brain?.task?.key === 'truckbag') taken++;
      if (taken < R.truck.bags && (bp < 0 || Math.hypot(m.truck.rear[0] - p.x, m.truck.rear[1] - p.z) < bd)) return set({ key: 'truckbag', k: 'act', act: 'truckbag', id: 0, to: [m.truck.rear[0] - 0.8, m.truck.rear[1]] });
    }
    if (bp >= 0) { const pl = m.pallets[bp]; return set({ key: 'pallet' + bp, k: 'act', act: 'bag', id: bp, to: palletSpot(pl) }); }
    // the armored truck: pry the back doors open
    if (R.truck.state === 'here' && R.drill.on !== 'truck' && free(R, p, 'truckcut') && (loud || !stealthy)) return set({ key: 'truckcut', k: 'act', act: 'truck', id: 0, to: [m.truck.rear[0] - 0.8, m.truck.rear[1]] });
    // deposit boxes while we wait
    if (D.vault.open) {
      let bi = -1; bd = 1e9;
      m.deposit.forEach((dp, i) => { if (R.loot.deposit[i] <= 0 || !free(R, p, 'dep' + i)) return; const d = Math.hypot(dp.x - p.x, dp.z - p.z); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0 && Math.random() < 0.8) { const dp = m.deposit[bi]; return set({ key: 'dep' + bi, k: 'act', act: 'deposit', id: bi, to: [dp.x - dp.side * 0.3, dp.z] }); }
    }
    // teller drawers and the manager's safe while the drill runs
    if (!D.vault.open && R.drill.state !== 'none') {
      const i = R.loot.drawers.findIndex(v => v > 0);
      if (i >= 0 && free(R, p, 'drawer' + i) && D.staff.open) return set({ key: 'drawer' + i, k: 'act', act: 'drawer', id: i, to: [m.tellers[i].x, -5.6] });
      if (R.loot.safe > 0 && free(R, p, 'safe') && Math.random() < 0.5) return set({ key: 'safe', k: 'act', act: 'safe', id: 0, to: [m.safe.x, m.safe.z + 1] });
    }
  }
  // nothing to do: guard the drill / the vault hall, or head to the van when the bank is empty
  const everything = !R.loot.pallets.some(v => v > 0) && R.cageOpened && !(R.truck.state === 'here' || R.truck.state === 'open' && R.truck.bags > 0);
  const spots = R.drill.state !== 'none' && R.drill.on === 'vault' ? [[-4, -15], [4, -15], [-6, -18], [6, -18]] : D.vault.open ? [[-3, -16], [3, -14], [0, -9], [14, -8]] : [[-6, -8], [6, -8], [0, -6], [18, -6]];
  if (!cur || cur.k !== 'defend') return set({ key: 'defend' + p.id, k: 'defend', to: spots[p.id % spots.length] });
}
function doTask(R, p, B, T, dt, face) {
  switch (T.k) {
    case 'go': case 'wander': case 'defend': {
      const there = botWalk(R, p, T.to, dt, T.sprint || T.k === 'go', R.navCrew, face);
      if (there && T.k === 'defend' && face === null && Math.random() < dt * 0.3) p.yaw += rnd(-1, 1);
      if (there && T.k === 'wander') B.task = null;
      break;
    }
    case 'act': {
      const pt = R.actPoint(p, T.act, T.id);
      if (!pt) { B.task = null; p.act = null; break; }
      if (T.act === 'revive' || T.act === 'pick' || T.act === 'cuff' || T.act === 'takeKey') T.to = [pt[0], pt[1]];
      const d = Math.hypot(pt[0] - p.x, pt[1] - p.z);
      let close = d < pt[2] - 0.35 || (p.act && p.act.k === T.act && d < pt[2] + 0.3);
      if (!close) {
        p.act = null;
        const there = botWalk(R, p, T.to, dt, T.sprint, R.navCrew, face);
        if (there && d < pt[2] + 0.2) close = true;
        else if (there || B.noPath > 3) { B.task = null; B.noPath = 0; B.bad = T.key; }
      }
      if (close) {
        S.stepPlayer(p, { dx: 0, dz: 0 }, dt, R.map, 'crew');
        if (face === null) p.yaw += angDiff(yawTo(pt[0] - p.x, pt[1] - p.z), p.yaw) * (1 - Math.exp(-8 * dt)); else p.yaw += angDiff(face, p.yaw) * (1 - Math.exp(-10 * dt));
        if (!p.act) R.startAct(p, T.act, T.id);
      }
      break;
    }
    case 'shout': {
      const n = R.npcs.get(T.id);
      if (!n || (n.hostage && !(T.again && n.hostT < 12)) || n.cuffed || n.hp <= 0 || n.handsUp > 0) { B.task = null; break; }
      const d = dist(p, n);
      const see = d < 9 && S.seesBody(R.map, S.eyeOf(p), n);
      if (!see) { const there = botWalk(R, p, T.to || [n.x, n.z], dt, true, R.navCrew); if (B.noPath > 3 || there && d > 11) { B.task = null; B.noPath = 0; } }
      else { S.stepPlayer(p, { dx: 0, dz: 0 }, dt, R.map, 'crew'); const want = yawTo(n.x - p.x, n.z - p.z); p.yaw += angDiff(want, p.yaw) * (1 - Math.exp(-12 * dt)); if (Math.abs(angDiff(want, p.yaw)) < 0.3) R.shout(p); }
      break;
    }
    case 'drop': { if (botWalk(R, p, T.to, dt, false, R.navCrew, face)) { R.dropBag(p); B.task = null; } break; }
    case 'grabAmmo': {
      const b = R.bags.get(T.id); if (!b) { B.task = null; break; }
      if (botWalk(R, p, [b.x, b.z], dt, true, R.navCrew, face) || Math.hypot(b.x - p.x, b.z - p.z) < 1.2) { R.bags.delete(b.id); R.bcast({ t: 'bag', rm: [b.id] }); p.ammo = Math.min(AMMO_MAX - p.mag, p.ammo + 60); B.task = null; }
      break;
    }
  }
}
// humans can also pick up ammo boxes the police drop, just by walking over them
export function ammoPickup(R, p) {
  for (const b of R.bags.values()) if (b.kind === 'ammo' && !b.by && Math.hypot(b.x - p.x, b.z - p.z) < 1.1 && p.ammo < AMMO_MAX - p.mag) {
    R.bags.delete(b.id); R.bcast({ t: 'bag', rm: [b.id] }); p.ammo = Math.min(AMMO_MAX - p.mag, p.ammo + 60); R.bcast({ t: 'fx', k: 'ammo', id: p.id }); return;
  }
}
