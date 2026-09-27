// Googly Heist — browser client: menus, the solo engine, online lobbies, controls, the over-the-shoulder camera,
// shooting, hold-to-use actions, the HUD and minimap, phone controls and the end-of-heist screen.
import * as THREE from 'three';
import { World } from './world.js';
import { Googly, SKINS, MASKS, textSprite } from './googly.js';
import { MAPS, BANK, HIDEOUT } from './maps.js';
import * as S from './sim.js';
import { Room, newPlayer, BAG, CARRY_KINDS, GAME_LEN, T_CAGE, T_TRUCK, T_TRUCK_GONE, MAG, AMMO_MAX, HP_MAX, ARMOR_MAX, DIFF_NAMES, VAN_CAP } from './core.js';
import { sfx, music, ambience, unlockAudio, setMusic, setSfx, setVolume, audioState, setListener } from './sfx.js';

const Q = new URLSearchParams(location.search);
if (Q.has('shim')) window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = v => '$' + Math.round(v).toLocaleString('en-US');
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('gh.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gh.' + k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem('gh.' + k); } catch { } },
};
const COLORS = ['#26262a', '#3a3a3c', '#f2f2f7', '#e8452c', '#ff9500', '#ffcc00', '#7bd13b', '#00c7be', '#2f7bff', '#9b59ff', '#ff6fb5', '#8a5a2b', '#c8a078', '#5a2ab0'];
const prof = {
  name: store.get('name', ''), color: store.get('color', '#26262a'), skin: store.get('skin', 'none'), mask: store.get('mask', 'hockey'),
  cash: store.get('cash', 0), ownedMasks: store.get('ownedMasks', ['hockey', 'bandana']), owned: store.get('owned', ['none']),
  sens: store.get('sens', 1), invy: store.get('invy', false), solo: store.get('soloSet', { diff: 1, plan: 'stealth' }),
};
if (Q.has('cash')) prof.cash = +Q.get('cash');
const isMac = !!window.webkit?.messageHandlers?.gp;
const mobile = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window || Q.has('touch');
if (mobile) document.body.classList.add('mobile');
const TOUCH_KEY = { E: 'USE', G: 'MASK', F: 'SHOUT', Q: 'THROW', R: 'RELOAD' };
const kk = k => mobile ? TOUCH_KEY[k] || k : k;

const world = new World($('view'));
const clock = new THREE.Clock();
let G = null, room = null, myId = 0, local = null;
let pendingRoom = (Q.get('room') || '').toUpperCase().slice(0, 4);
const ME = { hp: HP_MAX, armor: ARMOR_MAX, mag: MAG, ammo: AMMO_MAX - MAG, reload: 0, masked: false, carry: null, key: false, pocket: 0, act: null, down: 0, arrest: 0, custody: 0, det: 0, stats: {} };

// ------------------------------------------------------------------ screens
const SCREENS = ['scr-title', 'scr-solo', 'scr-online', 'scr-shop', 'scr-pause', 'scr-end', 'scr-help'];
let screen = 'scr-title', prevScreen = 'scr-title';
function show(id) { if (id !== screen) prevScreen = screen; screen = id; for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
function toast(t, ms = 2600) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.opacity = 0, ms); }
document.querySelectorAll('.back').forEach(b => b.onclick = () => { sfx.click(); if (screen === 'scr-help' && prevScreen === 'scr-pause') return show('scr-pause'); show(G && G.mapId !== HIDEOUT ? 'scr-pause' : G ? null : 'scr-title'); });
for (const ev of ['pointerdown', 'keydown', 'touchend', 'click']) document.addEventListener(ev, () => unlockAudio(), { capture: true });
if (mobile) {
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  addEventListener('scroll', () => { if (scrollY) scrollTo(0, 0); });
}
let hoverT = 0;
document.addEventListener('mouseover', e => { const b = e.target.closest?.('button, .plan, .item, .sw'); if (b && !b.disabled && performance.now() - hoverT > 60) { hoverT = performance.now(); sfx.hover(); } });

// ------------------------------------------------------------------ title
$('nm').value = prof.name;
$('nm').oninput = () => { prof.name = $('nm').value.replace(/[<>&"]/g, '').slice(0, 14); store.set('name', prof.name); sendMe(); };
function drawSwatches() {
  $('swatches').innerHTML = COLORS.map(c => `<div data-c="${c}" style="background:${c}" class="sw ${c === prof.color ? 'on' : ''}"></div>`).join('');
  $('swatches').querySelectorAll('div').forEach(d => d.onclick = () => setColor(d.dataset.c));
}
function setColor(c) { prof.color = c; store.set('color', c); sfx.click(); drawSwatches(); if (shopTab === 'colors') drawShop(); lookChanged(); }
drawSwatches();
function drawCash() { for (const id of ['t-cash', 's-cash']) $(id).textContent = Math.round(prof.cash).toLocaleString('en-US'); }
function addCash(n) { prof.cash += n; store.set('cash', prof.cash); drawCash(); }
drawCash();
function needName() { if (!prof.name.trim()) { $('nm').focus(); toast('Type your name first'); sfx.nope(); return true; } return false; }
$('b-solo').onclick = () => { if (needName()) return; sfx.click(); show('scr-solo'); drawPlans(); };
$('b-online').onclick = () => { if (needName()) return; sfx.click(); openOnline(); };
$('b-help').onclick = $('p-help').onclick = () => { sfx.click(); show('scr-help'); };
$('b-shop').onclick = () => { sfx.buy(); openShop(); };
const fsToggle = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen not available here')); };
$('b-fs').onclick = $('p-fs').onclick = () => { sfx.click(); fsToggle(); };
if (!document.documentElement.requestFullscreen) for (const id of ['b-fs', 'p-fs']) $(id).classList.add('hidden');
function drawAudioBtns() { const a = audioState(); for (const id of ['b-music', 'p-music']) $(id).textContent = a.music ? '♪ Music: on' : '♪ Music: off'; for (const id of ['b-sfx', 'p-sfx']) $(id).textContent = a.sfx ? '🔊 Sound: on' : '🔈 Sound: off'; }
$('b-music').onclick = $('p-music').onclick = () => { setMusic(!audioState().music); drawAudioBtns(); };
$('b-sfx').onclick = $('p-sfx').onclick = () => { setSfx(!audioState().sfx); drawAudioBtns(); sfx.click(); };
drawAudioBtns();
function drawInvite() {
  $('invite').classList.toggle('hidden', !pendingRoom);
  $('invite').innerHTML = `You've been invited to crew <b>${esc(pendingRoom)}</b> — type your name and press JOIN`;
  $('b-online').innerHTML = pendingRoom ? `JOIN ${esc(pendingRoom)}<small>your friend's crew</small>` : 'PLAY ONLINE<small>optional · lobbies · codes · invite up to 3 friends</small>';
}
drawInvite();
function drawContinue() {
  const s = store.get('solo', null);
  $('b-continue').classList.toggle('hidden', !s);
  if (s) $('continue-sub').textContent = `${mmss(s.clock)} into the heist · ${money(s.secured)} secured · saved ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
drawContinue();
$('b-continue').onclick = () => { if (needName()) return; sfx.click(); continueSolo(); };

// ------------------------------------------------------------------ solo setup
function planPicker(el, cur, onPick, locked = false) {
  el.classList.toggle('locked', locked);
  el.querySelectorAll('.plan').forEach(d => { d.classList.toggle('on', d.dataset.v === cur); d.onclick = locked ? null : () => { sfx.click(); onPick(d.dataset.v); }; });
}
function drawPlans() { planPicker($('solo-plan'), prof.solo.plan, v => { prof.solo.plan = v; store.set('soloSet', prof.solo); drawPlans(); }); }
$('solo-d').value = prof.solo.diff;
$('solo-d').onchange = () => { prof.solo.diff = +$('solo-d').value; store.set('soloSet', prof.solo); };
$('solo-go').onclick = () => { sfx.click(); startSolo(prof.solo); };

// ------------------------------------------------------------------ the solo engine: a Room right here in the page
function makeLocal() {
  const inbox = [];
  const r = new Room({ code: 'SOLO', solo: true, settings: {}, out: (p, m) => inbox.push(m) });
  const p = newPlayer({ id: 1, name: prof.name.trim() || 'GOOGLY', color: prof.color, skin: prof.skin, mask: prof.mask });
  local = { room: r, p, inbox };
  myId = 1;
  return local;
}
function startSolo(set) {
  closeOnline();
  const L = makeLocal();
  Object.assign(L.room.settings, { diff: set.diff, plan: set.plan, cpus: true });
  if (Q.has('len')) L.room.settings.len = +Q.get('len');
  L.room.syncBots();
  L.room.join(L.p);
  if (Q.get('noCpus') === '1') { for (const b of [...L.room.players.values()]) if (b.bot) L.room.players.delete(b.id); }
  L.room.start();
  store.del('solo'); drawContinue();
  pump();
}
function continueSolo() {
  const s = store.get('solo', null); if (!s) return;
  closeOnline();
  const L = makeLocal();
  try { L.room.restore(s.data, L.p); } catch (e) { console.error(e); toast("Couldn't load that save — starting fresh"); store.del('solo'); drawContinue(); local = null; return; }
  pump();
}
function saveSolo(flash = true) {
  if (!local) return;
  const data = local.room.save(); if (!data) return;
  store.set('solo', { data, at: Date.now(), clock: data.clock, secured: data.secured });
  if (flash) { const e = $('saved'); e.style.opacity = 1; setTimeout(() => e.style.opacity = 0, 1200); }
}
setInterval(() => { if (local && G && G.mapId === BANK && G.state === 'play') saveSolo(); }, 30000);
addEventListener('beforeunload', () => { if (local && G?.state === 'play') saveSolo(false); });
let lastPump = performance.now();
/** Solo heists stop dead while you're in the pause menu (or the help page from it, or another tab). */
const soloPaused = () => local && G && G.mapId === BANK && G.state === 'play' && (screen === 'scr-pause' || screen === 'scr-help' && prevScreen === 'scr-pause' || document.hidden);
function pump() {
  if (!local) return;
  const t = performance.now(), dt = Math.min(0.1, (t - lastPump) / 1000); lastPump = t;
  if (soloPaused()) { for (const m of local.inbox.splice(0)) onMsg(m); return; }
  if (dt > 0) local.room.tick(dt);
  const box = local.inbox.splice(0);
  for (const m of box) onMsg(m);
}
setInterval(() => { if (document.hidden && !local) pump(); }, 50);

// ------------------------------------------------------------------ online
let ws = null, wasConnected = false, wantOnline = false;
const SERVER = (window.__server || (location.protocol.startsWith('http') ? location.origin : 'https://googly-heist.onrender.com')).replace(/\/$/, '');
function send(m) {
  if (local) { if (m.t === 'leave') return; if (m.t === 'me') { Object.assign(local.p, { name: m.name, color: m.color, skin: m.skin, mask: m.mask }); return; } local.room.handle(local.p, m); return; }
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}
function sendMe() { send({ t: 'me', name: prof.name.trim() || 'GOOGLY', color: prof.color, skin: prof.skin, mask: prof.mask }); }
function connect() {
  if (ws && ws.readyState <= 1) return;
  $('on-status').textContent = 'Connecting to the server… (it can take ~30 seconds to wake up)';
  ws = new WebSocket(SERVER.replace(/^http/, 'ws'));
  ws.onopen = () => { wasConnected = true; $('on-status').textContent = 'Connected. Make a lobby, or join one with a code.'; sendMe(); send({ t: 'list' }); if (pendingRoom) { send({ t: 'join', code: pendingRoom }); pendingRoom = ''; drawInvite(); } else if (Q.has('lobby')) send({ t: 'create', public: false }); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (!local) onMsg(m); };
  ws.onclose = () => {
    if (local) return;
    if (wasConnected) toast('Lost connection to the server — reconnecting…', 4000);
    wasConnected = false;
    if (G && !local) { leaveWorld(); room = null; show('scr-title'); }
    $('on-status').textContent = "Can't reach the server right now. PLAY SOLO works without it!";
    if (wantOnline) setTimeout(connect, 2000);
  };
}
function openOnline() { wantOnline = true; show('scr-online'); connect(); if (ws?.readyState === 1) send({ t: 'list' }); }
function closeOnline() { wantOnline = false; if (ws) { const w = ws; ws = null; w.onclose = null; try { w.close(); } catch { } } }
setInterval(() => { if (!local && ws?.readyState === 1) send({ t: 'ping', c: performance.now() }); }, 5000);
$('on-pub').onclick = () => { sfx.click(); send({ t: 'create', public: true }); };
$('on-priv').onclick = () => { sfx.click(); send({ t: 'create', public: false }); };
$('on-join').onclick = () => { const c = $('on-code').value.trim().toUpperCase(); if (c.length !== 4) return toast('Lobby codes are 4 letters'); sfx.click(); send({ t: 'join', code: c }); };
$('on-code').onkeydown = e => { if (e.key === 'Enter') $('on-join').click(); };
$('on-ref').onclick = () => { sfx.click(); send({ t: 'list' }); };
function drawRooms(list) {
  $('rooms').innerHTML = list.length ? list.map(r => `<div class="roomrow"><div><b>${esc(r.name)}</b><small>${r.humans}/4 robbers · ${r.plan === 'loud' ? '💥 loud' : '🤫 stealth'} · police ${esc(r.diff)} · ${r.state === 'lobby' ? 'waiting at the Hideout' : `heist on (${mmss(r.clock)}) — take over a CPU`}</small></div><button class="green" data-c="${r.code}">JOIN</button></div>`).join('')
    : `<div class="empty">No open lobbies right now. Make one and send your friends the code!</div>`;
  $('rooms').querySelectorAll('button').forEach(b => b.onclick = () => { sfx.click(); send({ t: 'join', code: b.dataset.c }); });
}
setInterval(() => { if (screen === 'scr-online' && !G && !local) send({ t: 'list' }); }, 4000);

// ------------------------------------------------------------------ shop (your stash → masks, skins)
let shopTab = 'masks', shopOpen = false;
function seg(el, value, onPick) {
  const draw = v => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  el.querySelectorAll('button').forEach(b => b.onclick = () => { sfx.click(); draw(b.dataset.v); onPick(b.dataset.v); });
  draw(value);
}
seg($('shop-tab'), shopTab, v => { shopTab = v; drawShop(); });
function openShop() { shopOpen = true; show('scr-shop'); drawShop(); keys.clear(); unlock(); }
function closeShop() { shopOpen = false; show(G ? null : 'scr-title'); }
$('shop-close').onclick = () => { sfx.click(); closeShop(); };
const skinPrice = it => it.price * 200;
function drawShop() {
  drawCash();
  const g = $('shop-grid');
  if (shopTab === 'colors') {
    g.innerHTML = COLORS.map(c => `<div class="item ${c === prof.color ? 'on' : ''}" data-c="${c}"><i class="sk" style="background:${c}"></i>Colour<small class="own">${c === prof.color ? 'WEARING' : 'free'}</small></div>`).join('');
    g.querySelectorAll('.item').forEach(d => d.onclick = () => setColor(d.dataset.c));
    return;
  }
  const masks = shopTab === 'masks', list = masks ? MASKS : SKINS, owned = masks ? prof.ownedMasks : prof.owned, cur = masks ? prof.mask : prof.skin;
  g.innerHTML = list.map(it => {
    const price = masks ? it.price : skinPrice(it), has = owned.includes(it.id) || price === 0, on = it.id === cur;
    const dot = masks ? it.dot : it.dot(prof.color);
    const tag = on ? `<small class="eq">WEARING</small>` : has ? `<small class="own">owned · tap to wear</small>` : `<small class="price">${money(price)}</small>`;
    return `<div class="item ${on ? 'on' : ''} ${has ? '' : 'locked'}" data-id="${it.id}"><i class="sk" style="background:${dot}"></i>${esc(it.name)}${tag}</div>`;
  }).join('');
  g.querySelectorAll('.item').forEach(d => d.onclick = () => buy(masks, d.dataset.id));
}
function buy(masks, id) {
  const it = (masks ? MASKS : SKINS).find(x => x.id === id), owned = masks ? prof.ownedMasks : prof.owned, price = masks ? it.price : skinPrice(it);
  if (!owned.includes(id) && price > 0) {
    if (prof.cash < price) { sfx.nope(); toast(`You need ${money(price - prof.cash)} more — pull off a bigger heist!`); return; }
    addCash(-price); owned.push(id); store.set(masks ? 'ownedMasks' : 'owned', owned);
    sfx.buy(); toast(`You got the ${it.name}!`);
  } else sfx.click();
  if (masks) { prof.mask = id; store.set('mask', id); } else { prof.skin = id; store.set('skin', id); }
  drawShop(); lookChanged();
}
function lookChanged() {
  sendMe();
  if (preview) { preview.fig.setLook(prof.color, prof.skin); preview.fig.setMask(prof.mask); }
  const e = G?.ents.get(myId); if (e) { e.fig.setLook(prof.color, prof.skin); e.mask = prof.mask; if (e.fig.maskId) e.fig.setMask(prof.mask); }
}

// ------------------------------------------------------------------ lobby panel (the Hideout)
const amHost = () => room && room.host === myId;
function drawLobby() {
  if (!room) return;
  $('lb-code').textContent = room.code;
  $('lb-count').textContent = `· ${room.players.filter(p => !p.bot).length}/4 robbers`;
  const slots = room.players.map(p => `<div class="pl"><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}${p.id === myId ? ' (you)' : ''}<span class="tag">${p.bot ? 'CPU' : p.host ? 'HOST' : 'ROBBER'}</span></div>`);
  for (let i = room.players.length; i < 4; i++) slots.push(`<div class="pl" style="opacity:.5"><span class="dot" style="background:transparent"></span>empty spot<span class="tag">invite a friend</span></div>`);
  $('lb-players').innerHTML = slots.join('');
  const s = room.settings, h = amHost();
  planPicker($('lb-plan'), s.plan, v => send({ t: 'set', settings: { plan: v } }), !h);
  $('lb-diff').value = String(s.diff); $('lb-cpus').value = s.cpus ? '1' : '0';
  for (const id of ['lb-diff', 'lb-cpus']) $(id).disabled = !h;
  $('lb-pub').checked = room.public; $('lb-pub').disabled = !h;
  $('lb-hostctl').classList.toggle('hidden', !h);
  $('lb-summary').classList.toggle('hidden', h);
  $('lb-summary').innerHTML = `Plan: <b>${s.plan === 'loud' ? '💥 Go loud' : '🤫 Stealth first'}</b><br>Police: ${DIFF_NAMES[s.diff]} · empty spots: ${s.cpus ? 'computer robbers' : 'nobody'}<br>${room.public ? 'Public lobby' : 'Private lobby'} · only the host can change these`;
  $('lb-start').classList.toggle('hidden', !h);
  $('lb-start').textContent = room.state === 'lobby' ? 'START THE HEIST' : 'HEIST RUNNING…';
  $('lb-start').disabled = room.state === 'play';
  const hostName = room.players.find(p => p.id === room.host)?.name || 'the host';
  $('lb-wait').textContent = h ? 'You are the host. Invite friends with the code or link, then press START. Empty spots get computer robbers.' : `Waiting for ${hostName} to start… walk around the Hideout while you wait!`;
}
for (const [id, k, f] of [['lb-diff', 'diff', Number], ['lb-cpus', 'cpus', v => v === '1']]) $(id).onchange = () => send({ t: 'set', settings: { [k]: f($(id).value) } });
$('lb-pub').onchange = () => send({ t: 'set', settings: { public: $('lb-pub').checked } });
$('lb-start').onclick = () => { sfx.click(); send({ t: 'start' }); };
$('lb-leave').onclick = () => { sfx.click(); leaveAll(); };
$('lb-shop').onclick = () => { sfx.buy(); openShop(); };
$('lb-hide').onclick = () => { sfx.click(); $('lobbyui').classList.add('collapsed'); };
$('lb-show').onclick = () => { sfx.click(); $('lobbyui').classList.remove('collapsed'); };
const inviteLink = () => `${SERVER}/?room=${room.code}`;
$('lb-copy').onclick = async () => { sfx.click(); const link = inviteLink(); try { await navigator.clipboard.writeText(link); toast('Invite link copied! Send it to your crew: ' + link, 4000); } catch { prompt('Send this link to your crew:', link); } };
if (navigator.share) { $('lb-share').classList.remove('hidden'); $('lb-share').onclick = () => navigator.share({ title: 'Googly Heist', text: `Join my crew — lobby code ${room.code}`, url: inviteLink() }).catch(() => { }); }
$('lb-form').onsubmit = e => { e.preventDefault(); const t = $('lb-msg').value.trim(); if (t) send({ t: 'chat', text: t }); $('lb-msg').value = ''; $('lb-msg').blur(); };
function addChat(m) {
  const line = m.sys ? `<div class="sys">${esc(m.text)}</div>` : `<div><b style="color:${esc(m.color)}">${esc(m.from)}:</b> ${esc(m.text)}</div>`;
  for (const id of ['lb-log', 'log']) { const el = $(id); el.insertAdjacentHTML('beforeend', line); while (el.children.length > 40) el.firstChild.remove(); el.scrollTop = 1e6; }
  if (!m.sys) { sfx.chat(); const e = G && [...G.ents.values()].find(q => q.name === m.from); if (e) sfx.babble(e.id === myId ? null : [e.x, e.y + 1.4, e.z], e.id, Math.min(7, 2 + Math.ceil(m.text.length / 12))); }
}

// ------------------------------------------------------------------ messages from the game (the page's own Room, or the server)
function onMsg(m) {
  switch (m.t) {
    case 'hello': myId = m.id; break;
    case 'list': drawRooms(m.rooms); break;
    case 'err': toast(m.msg, 3500); sfx.nope(); break;
    case 'joined': sfx.join(); myId = m.id ?? myId; $('lb-log').innerHTML = ''; $('log').innerHTML = ''; if (!local && location.protocol.startsWith('http')) history.replaceState(null, '', '?room=' + m.code); break;
    case 'left': history.replaceState(null, '', location.pathname); break;
    case 'room': room = m.room; drawLobby(); break;
    case 'chat': addChat(m); break;
    case 'world': enterWorld(m); break;
    case 'toast': toast(m.text); sfx.nope(); break;
    default: if (G) onGameMsg(m);
  }
}

// ------------------------------------------------------------------ entering a place
const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true, crouch: false, yaw: 0, camYaw: 0, camPitch: -0.12, speedMul: 1 };
function localMap(id) { const m = Object.create(MAPS[id]); m.doors = JSON.parse(JSON.stringify(MAPS[id].doors)); return m; }
function enterWorld(m) {
  world.load(m.map);
  preview = null;
  G = { mapId: m.map, map: localMap(m.map), state: m.state, clock: m.clock, settings: m.settings, ents: new Map(), npcs: new Map(), sendT: 0, len: m.settings?.len || GAME_LEN,
    loot: m.loot, drill: m.drill || { state: 'none' }, van: m.van || { state: 'here', load: 0 }, truck: m.truck || 'none', alarm: !!m.alarm, wave: m.wave, cams: m.cams || [], secured: m.secured || 0, hostages: m.hostages || 0, camDet: 0, lastTick: -1, mm: null };
  for (const p of m.players) addEnt(p);
  const mine = m.players.find(p => p.id === myId);
  if (mine) Object.assign(me, { x: mine.x, y: mine.y, z: mine.z, vx: 0, vy: 0, vz: 0, yaw: mine.yaw, camYaw: mine.yaw, camPitch: -0.12, onGround: true, crouch: false });
  $('feed').innerHTML = '';
  if (m.map === HIDEOUT) {
    $('lobbyui').classList.remove('hidden'); $('hud').classList.remove('hidden'); $('hud').classList.add('lobby');
    if (screen !== 'scr-shop') show(null);
    unlock(); music.play('hideout');
  } else {
    for (const n of m.npcs || []) addNpc(n);
    for (const b of m.bags || []) world.addBag(b);
    for (const [k, open] of Object.entries(m.doors || {})) { if (G.map.doors[k]) G.map.doors[k].open = open; world.setDoor(k, open, true); }
    if (m.loot) world.setLoot(m.loot);
    world.setDrill(G.drill); world.setCams(G.cams); world.setTruck(G.truck); world.setAlarm(G.alarm); world.setHeli(false);
    $('lobbyui').classList.add('hidden'); $('hud').classList.remove('hidden', 'lobby');
    shopOpen = false; show(null);
    Object.assign(ME, { masked: !!mine?.masked });
    if (m.clock < 3) { center('FIRST GOOGLY NATIONAL BANK', 4000, '#ffd23a', m.settings.plan === 'loud' ? 'Plan: go loud. Masks on (hold G) and hit the vault!' : 'Plan: stealth. You look like a customer — put your mask on (hold G) when you\'re ready.'); }
    buildMinimap();
    setTimeout(() => { if (G?.mapId === BANK && G.clock < 40 && !ME.masked) hintOnce(m.settings.plan === 'loud' ? `Hold ${kk('G')} to put your mask on. Your crew follows your lead.` : `Tip: the manager (in the suit) has the keycard. Sneak up behind him and hold ${kk('E')} to pickpocket it — no mask needed.`); }, 4500);
    if (!mobile && !Q.has('bot') && !Q.has('cam')) askLock();
    applyTestHooks();
  }
}
function leaveWorld() {
  if (!G) return;
  G = null;
  for (const id of ['hud', 'clickto', 'board', 'lobbyui', 'downscr']) $(id).classList.add('hidden');
  unlock(); music.play('menu');
  showPreview();
}
function leaveAll() {
  if (local) { if (G?.state === 'play' && G.mapId === BANK) saveSolo(false); local = null; drawContinue(); }
  else send({ t: 'leave' });
  leaveWorld(); room = null; show('scr-title');
}
function addEnt(p) {
  const isMe = p.id === myId;
  const fig = new Googly({ color: p.color, name: p.name, skin: p.skin, local: isMe, role: 'crew', mask: p.mask });
  fig.group.position.set(p.x, p.y, p.z); fig.group.rotation.y = p.yaw + Math.PI;
  world.actors.add(fig.group);
  const e = { id: p.id, name: p.name, color: p.color, bot: p.bot, mask: isMe ? prof.mask : p.mask || 'hockey', fig, buf: [], x: p.x, y: p.y, z: p.z, yaw: p.yaw, flags: 2, vx: 0, vz: 0, pitch: 0, carry: 0, act: 0, hp: 100, armor: 60, timer: 0 };
  if (p.masked) fig.setMask(e.mask);
  if (isMe) fig.onStep = v => sfx.step(null, v * 0.5, surfaceAt(me.x, me.z));
  else fig.onStep = v => { if (Math.hypot(e.x - me.x, e.z - me.z) < 22) sfx.step([e.x, e.y, e.z], v * 0.8, surfaceAt(e.x, e.z)); };
  G.ents.set(p.id, e);
  return e;
}
const ROLE = { civ: 'civ', teller: 'teller', manager: 'manager', guard: 'guard', cop: 'cop', swat: 'swat', heavy: 'heavy' };
function addNpc(n) {
  if (G.npcs.has(n.id)) return;
  const fig = new Googly({ color: n.color, role: ROLE[n.kind] || 'civ', hatKind: n.hat, local: true });
  fig.group.position.set(n.x, 0, n.z); fig.group.rotation.y = n.yaw + Math.PI;
  world.actors.add(fig.group);
  const v = { id: n.id, kind: n.kind, fig, buf: [], x: n.x, z: n.z, yaw: n.yaw, flags: n.f || 0, vx: 0, vz: 0, icon: null, iconKey: '' };
  fig.onStep = s => { if (Math.hypot(v.x - me.x, v.z - me.z) < 16) sfx.step([v.x, 0, v.z], s * 0.6, surfaceAt(v.x, v.z)); };
  G.npcs.set(n.id, v);
}
function rmNpc(id) { const v = G.npcs.get(id); if (!v) return; world.actors.remove(v.fig.group); G.npcs.delete(id); }
const ent = id => G?.ents.get(id);
function surfaceAt(x, z) {
  const zn = G?.map?.zoneAt?.(x, z);
  return { lobby: 'marble', hall: 'marble', staff: 'carpet', office: 'wood', security: 'wood', vault: 'steel', reserve: 'steel', hideout: 'concrete' }[zn] || 'asphalt';
}
const nameSpan = id => { const e = ent(id); return e ? `<span style="color:${esc(e.color)}">${esc(e.name)}</span>` : 'Someone'; };
function center(text, ms = 1500, color = '#fff', small = '') { const c = $('center'); c.innerHTML = esc(text) + (small ? `<small>${esc(small)}</small>` : ''); c.style.color = color; c.style.opacity = 1; clearTimeout(center.t); center.t = setTimeout(() => c.style.opacity = 0, ms); }
function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d); while ($('feed').children.length > 6) $('feed').lastChild.remove(); }
function pop(text, color = '#7dff9a') {
  const d = document.createElement('div'); d.textContent = text;
  d.style.cssText = `position:absolute;left:50%;top:44%;transform:translateX(-50%);font-weight:900;font-size:24px;color:${color};text-shadow:2px 2px #000;transition:all 1.3s ease-out;pointer-events:none;font-family:Futura,'Arial Black',sans-serif`;
  $('hud').appendChild(d); requestAnimationFrame(() => { d.style.top = '34%'; d.style.opacity = 0; }); setTimeout(() => d.remove(), 1400);
}
const shown = new Set();
function hintOnce(t, ms = 6000) { if (shown.has(t)) return; shown.add(t); toast(t, ms); }
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
const posOf = id => { if (id === myId) return null; const e = ent(id); return e ? [e.x, e.y + 1.2, e.z] : null; };

function onGameMsg(m) {
  const t = performance.now() / 1000;
  switch (m.t) {
    case 'snap': {
      G.clock = m.clock; if (m.st !== G.state) G.state = m.st;
      for (const a of m.e) {
        const e = ent(a[0]); if (!e) continue;
        e.buf.push({ t, x: a[1], y: a[2], z: a[3], yaw: a[4], flags: a[5], vx: a[6], vz: a[7], pitch: a[8] }); if (e.buf.length > 30) e.buf.shift();
        e.carry = a[9]; e.act = a[10]; e.hp = a[11] ?? 100; e.armor = a[12] ?? 0; e.timer = a[13] || 0; e.flagsNow = a[5];
      }
      for (const a of m.n || []) { const v = G.npcs.get(a[0]); if (!v) continue; v.buf.push({ t, x: a[1], z: a[2], yaw: a[3], flags: a[4], vx: a[5], vz: a[6] }); if (v.buf.length > 30) v.buf.shift(); }
      for (const a of m.b || []) world.moveBag(a[0], a[1], a[2], a[3]);
      if (m.dr) { G.drill.t = m.dr[1]; }
      if (m.cd !== undefined) G.camDet = m.cd;
      if (m.w) G.wave = { k: m.w[0], t: m.w[1], n: m.w[2] };
      G.vanT = m.v || 0;
      break;
    }
    case 'me': {
      const was = { ...ME };
      Object.assign(ME, m);
      if (!was.down && m.down) { sfx.down(); }
      if (was.down && !m.down && !m.custody) { sfx.up(); }
      if (!was.custody && m.custody) sfx.custody();
      if (m.pocket > was.pocket) pop('+' + money(m.pocket - was.pocket));
      if (was.hp > m.hp + 0.5 || was.armor > m.armor + 0.5) G.hurtT = 0.5;
      if (was.armor > 0 && m.armor <= 0) sfx.armorGone();
      break;
    }
    case 'tp': Object.assign(me, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0 }); if (m.yaw !== undefined) { me.yaw = m.yaw; } break;
    case 'ouch': {
      if (m.armor) sfx.armor(); else sfx.ouch();
      if (m.from) { const a = Math.atan2(-(m.from[0] - me.x), -(m.from[1] - me.z)) - me.camYaw; const i = document.createElement('i'); i.style.transform = `rotate(${-a}rad)`; $('dmgdirs').appendChild(i); setTimeout(() => i.remove(), 1000); }
      $('vign').style.setProperty('--vc', m.armor ? '#4a8aff' : '#ff1a3a'); G.hurtT = 0.5;
      break;
    }
    case 'join': if (!ent(m.p.id)) { addEnt(m.p); feed(`${nameSpan(m.p.id)} joined the crew`); } break;
    case 'gone': { const e = ent(m.id); if (e) { world.actors.remove(e.fig.group); G.ents.delete(m.id); } break; }
    case 'look': { const e = ent(m.p.id); if (e && m.p.id !== myId) { e.fig.setLook(m.p.color, m.p.skin); e.color = m.p.color; e.mask = m.p.mask; if (e.fig.maskId) e.fig.setMask(e.mask); } break; }
    case 'npc': for (const n of m.add || []) addNpc(n); for (const id of m.rm || []) rmNpc(id); break;
    case 'door': {
      if (G.map.doors[m.id]) G.map.doors[m.id].open = m.open;
      world.setDoor(m.id, m.open);
      const d = MAPS[BANK].doors[m.id];
      if (m.id === 'van') sfx.van([29, 1, -12], m.open);
      else if (m.id === 'truck') { if (!m.open) sfx.truck([-10, 1, 19]); }
      else if (m.id.startsWith('pc')) { if (!m.open) sfx.van([0, 1, 22], false); }
      else if (m.id !== 'vault' && m.id !== 'cage' && d?.x !== undefined) sfx.door([d.x, 1, d.z]);
      buildMinimap();
      break;
    }
    case 'alarm':
      G.alarm = true; G.alarmAt = G.clock; world.setAlarm(true); sfx.alarmStart();
      center('🚨 ALARM!', 3500, '#ff6a5a', `${m.why}. Police in ~${m.response}s — grab what you can!`);
      ME.masked = true;
      break;
    case 'wave':
      G.wave = { k: m.k, t: m.t, n: m.n };
      if (m.k === 'assault') { sfx.wave(); center(`🚓 POLICE ASSAULT ${m.n > 1 ? m.n : ''}`, 2600, '#ff8a7a', m.n > 2 ? 'SWAT is here. Stay together!' : 'Here they come!'); }
      else { sfx.calm(); feed('😮‍💨 The police are falling back — loot fast before the next wave!'); }
      break;
    case 'heli': world.setHeli(m.on); G.heli = m.on; break;
    case 'bag':
      for (const b of m.add || []) world.addBag(b);
      for (const b of m.upd || []) { world.updBag(b); if (!b.fly && !b.by) sfx.thud([b.x, b.y, b.z], b.kind === 'gold' || b.kind === 'drill'); }
      for (const id of m.rm || []) world.rmBag(id);
      break;
    case 'secured': {
      G.secured = m.total;
      const big = m.kind === 'diamond' || m.kind === 'gold';
      sfx.secured(big); world.cash(new THREE.Vector3(29.2, 1.6, -16.2), big ? 26 : 12);
      if (m.by === myId) pop(`+${money(m.value)} SECURED`);
      feed(`${BAG[m.kind]?.emoji || '💰'} ${nameSpan(m.by)} secured ${m.kind === 'diamond' ? 'THE GOOGLY DIAMOND' : 'a ' + m.kind + ' bag'} (${money(m.value)})`);
      break;
    }
    case 'van': G.van = m.van; break;
    case 'drill': {
      const prev = G.drill.state; G.drill = m.drill; world.setDrill(m.drill);
      if (m.drill.state === 'jammed' && prev !== 'jammed') { sfx.drillJam([m.drill.x, 1.5, m.drill.z]); center('⚠️ DRILL JAMMED', 1800, '#ffb05a', `Hold ${kk('E')} on it to fix it`); }
      break;
    }
    case 'loot': G.loot = m.loot; world.setLoot(m.loot); break;
    case 'cams': G.cams = m.cams; world.setCams(m.cams); if (m.broke !== undefined) sfx.glass(null); break;
    case 'hostages': G.hostages = m.n; break;
    case 'truck': G.truck = m.state; world.setTruck(m.state); if (m.state === 'here') { center('🚚 ARMORED TRUCK', 2600, '#ffd23a', 'It just parked out front — break into the back for 6 gold bags'); } G.truckBags = m.bags; break;
    case 'final': sfx.warn(); center('🚐 TWO MINUTES!', 3200, '#ff8a7a', 'Get to the van in the alley — it leaves at 30:00!'); break;
    case 'banner': center(m.text, 2600, m.color, m.sub); break;
    case 'shot': onShot(m); break;
    case 'fx': onFx(m); break;
    case 'end': showEnd(m); break;
  }
}
function onShot(m) {
  if (m.id === myId) {
    if (m.hit) { const n = G.npcs.get(m.hit); showHit(m.head); if (n) world.spark(new THREE.Vector3(...m.h), 0x7adfff, 5, 3); }
    else if (m.glass) { world.impact(m.h, 'glass'); }
    else if (m.wall) world.impact(m.h, m.wall);
    return;
  }
  const crew = !!m.id;
  const src = crew ? ent(m.id) : G.npcs.get(m.npc);
  let o = m.o;
  if (src) { src.fig.fire(); if (!crew) src.firedT = 0.4; const mz = src.fig.muzzle(V3); if (mz) o = [mz.x, mz.y, mz.z]; }
  world.tracer(o, m.h, crew ? 0x4ad8ff : 0xff3a3a);
  if (crew) sfx.blaster(o); else { sfx.copShot(o); if (m.hit !== myId) { const d = distToSeg(me.x, me.y + 1.2, me.z, o, m.h); if (d < 1.4) sfx.whiz([me.x + (m.h[0] - me.x) * 0.2, me.y + 1.2, me.z]); } }
  if (m.hit && crew) { const n = G.npcs.get(m.hit); if (n) world.spark(new THREE.Vector3(...m.h), 0x7adfff, 4, 3); }
  else if (!m.hit) world.impact(m.h, m.glass ? 'glass' : m.wall || '');
}
function distToSeg(px, py, pz, a, b) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [px - a[0], py - a[1], pz - a[2]]; const L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1; const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L)); return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t); }
function showHit(head) { const h = $('hitm'); h.classList.toggle('head', !!head); h.style.opacity = 1; clearTimeout(showHit.t); showHit.t = setTimeout(() => h.style.opacity = 0, 120); sfx.hitmark(head); }
function onFx(m) {
  const e = m.id ? ent(m.id) : null, n = m.npc ? G.npcs.get(m.npc) : null;
  const pos = e ? (m.id === myId ? null : [e.x, e.y + 1.2, e.z]) : n ? [n.x, 1.2, n.z] : null;
  switch (m.k) {
    case 'mask': if (e) { e.fig.setMask(e.mask); if (m.id === myId) { ME.masked = true; sfx.mask(); center('MASK ON', 1200, '#ffd23a', G.alarm ? '' : 'Anyone who sees you now knows what you are!'); } else sfx.zip(pos); } break;
    case 'down': if (e) e.fig.caught(); if (m.id !== myId) { feed(`🆘 ${nameSpan(m.id)} is down — help them up!`); sfx.gasp(pos); } break;
    case 'up': if (m.id !== myId) feed(`🩹 ${nameSpan(m.id)} is back up`); break;
    case 'custody': if (m.id !== myId) feed(`🚓 ${nameSpan(m.id)} got arrested`); break;
    case 'back': if (m.id === myId) center('BACK IN THE ALLEY', 1600, '#9ab8ff', 'Your crew bailed you out'); break;
    case 'breach': sfx.breach([m.x, 1, m.z]); world.puff(new THREE.Vector3(m.x, 1.2, m.z), 0xa8a8a8, 18, 4); feed('💥 The police blew the back door open!'); break;
    case 'throw': sfx.throwBag(pos); if (e) e.fig.reach(); break;
    case 'drop': sfx.thud(pos); break;
    case 'beep': sfx.beep(true); break;
    case 'unlock': sfx.unlock(pos || [me.x, 1, me.z]); if (m.id === myId) center(m.door === 'truck' ? 'TRUCK OPEN' : 'UNLOCKED', 1000, '#7dff9a'); break;
    case 'key': sfx.beep(true); if (m.id === myId) { center('🗝 GOT THE KEYCARD', 1800, '#7dff9a', 'It opens the staff door, the security room and the vault gate'); } break;
    case 'cuff': sfx.cuff(n ? [n.x, 1, n.z] : null); break;
    case 'drillOn': sfx.drillOn([G.drill.x || 0, 1.5, G.drill.z || -19.9]); break;
    case 'drillFix': sfx.drillOn([G.drill.x, 1.5, G.drill.z]); if (m.id === myId) pop('DRILL FIXED', '#7dff9a'); break;
    case 'grab': sfx.zip(pos); break;
    case 'bagged': sfx.bagged(m.kind); if (m.id === myId) pop(m.kind === 'diamond' ? '💎 THE GOOGLY DIAMOND!' : `${BAG[m.kind].emoji} ${BAG[m.kind].name.toUpperCase()}`, '#ffe07a'); break;
    case 'load': if (m.id === myId) sfx.thud(null, true); break;
    case 'cash': if (m.id === myId) { if (m.v) { sfx.cash(Math.ceil(m.v / 3000)); world.cash(new THREE.Vector3(me.x, me.y + 1.2, me.z), 8); } else { sfx.nope(); pop('EMPTY', '#aaa'); } } break;
    case 'ammo': if (m.id === myId) { sfx.reload(null); pop('+AMMO', '#9ad8ff'); } break;
    case 'medic': if (m.id === myId) { sfx.up(); pop('+HEALTH', '#ff9aa8'); } break;
    case 'reload': sfx.reload(pos); break;
    case 'shout': if (e) { e.fig.shout(); sfx.shout(pos, m.id); } break;
    case 'zap': if (n) { n.fig.caught(); world.zap(new THREE.Vector3(n.x, 1, n.z)); sfx.zap([n.x, 1, n.z]); if (m.by === myId) showHit(false); if (['cop', 'swat', 'heavy'].includes(n.kind) && m.by === myId) pop('ZAPPED', '#7adfff'); } break;
    case 'hitnpc': if (n) n.fig.hit(); break;
    case 'spotted': if (n && performance.now() - (onFx.spotT || 0) > 2500) { onFx.spotT = performance.now(); sfx.spotted(); sfx.gasp([n.x, 1.4, n.z]); feed(n.kind === 'guard' ? '📻 A guard is reaching for his radio!' : n.kind === 'teller' ? '🔔 A teller is going for the alarm button!' : '📞 Someone is calling the police!'); } break;
    case 'cage': sfx.cage([0, 1.5, -29]); center('⏰ RESERVE OPEN', 2600, '#ffd23a', 'Gold and THE GOOGLY DIAMOND — in the back of the vault'); break;
    case 'vaultOpen': sfx.vaultOpen([0, 1.7, -21]); center('💰 THE VAULT IS OPEN!', 3000, '#7dff9a', 'Bag the cash and gold — get it to the van'); break;
  }
}

// ------------------------------------------------------------------ input
const keys = new Set(); let locked = false, macLocked = false, chatting = false, mouseHeld = false, aimHeld = false;
const look = { dx: 0, dy: 0 };
const typing = e => e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range' || e.target.tagName === 'SELECT';
let crouchOn = false;
addEventListener('keydown', e => {
  if (chatting) { if (e.key === 'Escape') closeChat(); return; }
  if (typing(e)) { if (e.key === 'Escape') e.target.blur(); return; }
  if (G && ['Tab', ' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  keys.add(e.code);
  if (!G) return;
  if (G.mapId === HIDEOUT) {
    if (e.code === 'Enter' || e.code === 'KeyT') { e.preventDefault(); $('lobbyui').classList.remove('collapsed'); $('lb-msg').focus(); keys.clear(); }
    if (e.code === 'KeyE' && onShopMat() && !shopOpen) { sfx.buy(); openShop(); }
    if (e.code === 'Escape' && shopOpen) closeShop();
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyR') doReload();
  if (e.code === 'KeyF') doShout();
  if (e.code === 'KeyQ') doThrow();
  if (e.code === 'KeyC') crouchOn = !crouchOn;
  if (e.code === 'KeyT' || e.code === 'Enter') { e.preventDefault(); openChat(); }
  if (e.code === 'Escape') { if (macLocked) { unlock(); pause(); } }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseHeld = false; aimHeld = false; });
const canvas = $('view');
let drag = null;
canvas.addEventListener('mousedown', e => {
  if (!G) return;
  if (G.mapId === HIDEOUT || shopOpen) { drag = { x: e.clientX, y: e.clientY }; return; }
  if (!locked && !macLocked && !mobile) { askLock(); return; }
  if (e.button === 0) mouseHeld = true;
  if (e.button === 2) aimHeld = true;
});
addEventListener('mousemove', e => {
  if (locked) { look.dx += e.movementX; look.dy += e.movementY; }
  else if (drag) { look.dx += (e.clientX - drag.x) * 1.4; look.dy += (e.clientY - drag.y) * 1.4; drag = { x: e.clientX, y: e.clientY }; }
});
addEventListener('mouseup', e => { drag = null; if (e.button === 0) mouseHeld = false; if (e.button === 2) aimHeld = false; });
addEventListener('contextmenu', e => { if (G) e.preventDefault(); });
window.__look = (dx, dy) => { if (macLocked) { look.dx += dx; look.dy += dy; } };
window.__unlocked = () => { if (macLocked) { macLocked = false; mouseHeld = aimHeld = false; if (G && G.mapId === BANK && screen !== 'scr-end') pause(); } };
window.__mouse = (b, down) => { if (!macLocked) return; if (b === 0) mouseHeld = down; if (b === 2) aimHeld = down; };
function askLock() {
  if (!G || G.mapId === HIDEOUT || screen === 'scr-end') return;
  if (isMac) { window.webkit.messageHandlers.gp.postMessage('lock'); macLocked = true; $('clickto').classList.add('hidden'); if (screen === 'scr-pause') show(null); return; }
  $('clickto').classList.remove('hidden');
}
$('clickto').onclick = () => { unlockAudio(); if (isMac) return askLock(); canvas.requestPointerLock?.(); };
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { $('clickto').classList.add('hidden'); if (screen === 'scr-pause') show(null); }
  else { mouseHeld = aimHeld = false; if (G && G.mapId === BANK && !chatting && screen !== 'scr-end' && !shopOpen) pause(); }
});
function unlock() { if (document.pointerLockElement) document.exitPointerLock(); if (macLocked) { macLocked = false; window.webkit?.messageHandlers?.gp?.postMessage('unlock'); } }
function pause() { if (!G) return; keys.clear(); mouseHeld = aimHeld = false; touch.fire = touch.act = false; show('scr-pause'); $('clickto').classList.add('hidden'); $('p-note').textContent = local ? 'The heist is paused — nothing moves until you press RESUME.' : "Online heists can't pause — your crew is still playing!"; }
$('p-resume').onclick = () => { sfx.click(); show(null); if (isMac) askLock(); else if (!mobile) canvas.requestPointerLock?.(); };
$('p-leave').onclick = () => { sfx.click(); leaveAll(); };
$('sens').value = prof.sens; $('sens').oninput = () => { prof.sens = +$('sens').value; store.set('sens', prof.sens); };
for (const k of ['music', 'sfx', 'amb']) { const el = $('vol-' + k); el.value = audioState().vol[k]; el.oninput = () => { setVolume(k, +el.value); if (k === 'sfx') sfx.click(); }; }
$('invy').checked = prof.invy; $('invy').onchange = () => { prof.invy = $('invy').checked; store.set('invy', prof.invy); };
function openChat() { chatting = true; keys.clear(); mouseHeld = false; $('chatform').classList.remove('hidden'); $('chatin').focus(); }
function closeChat() { chatting = false; $('chatform').classList.add('hidden'); $('chatin').blur(); $('chatin').value = ''; }
$('chatform').onsubmit = e => { e.preventDefault(); const t = $('chatin').value.trim(); if (t) send({ t: 'chat', text: t }); closeChat(); };
const onShopMat = () => G && G.mapId === HIDEOUT && Math.hypot(me.x - G.map.shop.x, me.z - G.map.shop.z) < G.map.shop.r;

// touch controls
const touch = { mx: 0, mz: 0, mag: 0, jump: false, fire: false, act: false, mask: false, board: false, aim: false, stickId: null, lookId: null, fireId: null, lx: 0, ly: 0, fx: 0, fy: 0 };
if (mobile) {
  const stick = $('stick'), knob = $('knob');
  const moveStick = t => {
    const r = stick.getBoundingClientRect(), R = r.width / 2, dx = (t.clientX - r.left - R) / R, dy = (t.clientY - r.top - R) / R, l = Math.min(1, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const k = l < 0.12 ? 0 : l;
    touch.mx = Math.cos(a) * k; touch.mz = -Math.sin(a) * k; touch.mag = k;
    knob.style.transform = `translate(${Math.cos(a) * l * R * 0.62}px, ${Math.sin(a) * l * R * 0.62}px)`;
  };
  const stopStick = () => { touch.stickId = null; touch.mx = touch.mz = touch.mag = 0; knob.style.transform = ''; };
  stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; touch.stickId = t.identifier; moveStick(t); }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) moveStick(t);
      if (t.identifier === touch.lookId) { look.dx += (t.clientX - touch.lx) * 2.1; look.dy += (t.clientY - touch.ly) * 2.1; touch.lx = t.clientX; touch.ly = t.clientY; }
      if (t.identifier === touch.fireId) { look.dx += (t.clientX - touch.fx) * 1.6; look.dy += (t.clientY - touch.fy) * 1.6; touch.fx = t.clientX; touch.fy = t.clientY; }
    }
    if (!e.target.closest?.('.card, .lp, #rooms, #shop-grid, #lb-log, input[type=range]')) e.preventDefault();
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === touch.stickId) stopStick(); if (t.identifier === touch.lookId) touch.lookId = null; if (t.identifier === touch.fireId) { touch.fireId = null; touch.fire = false; $('t-fire').classList.remove('held'); } } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; } }, { passive: false });
  const tb = (id, down, up) => {
    const el = $(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); el.classList.add('held'); down(e); }, { passive: false });
    const off = () => { el.classList.remove('held'); up?.(); };
    el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
  };
  $('t-fire').addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; touch.fireId = t.identifier; touch.fx = t.clientX; touch.fy = t.clientY; touch.fire = true; $('t-fire').classList.add('held'); if (!ME.masked) toast(`Put your mask on first — hold ${kk('G')}`); }, { passive: false });
  tb('t-jump', () => touch.jump = true, () => touch.jump = false);
  tb('t-act', () => { if (G?.mapId === HIDEOUT) { if (onShopMat() && !shopOpen) { sfx.buy(); openShop(); } return; } touch.act = true; }, () => touch.act = false);
  tb('t-mask', () => touch.mask = true, () => touch.mask = false);
  tb('t-shout', () => doShout()); tb('t-throw', () => doThrow()); tb('t-reload', () => doReload());
  tb('t-aim', () => { touch.aim = !touch.aim; $('t-aim').classList.toggle('on', touch.aim); });
  tb('t-crouch', () => { crouchOn = !crouchOn; $('t-crouch').classList.toggle('on', crouchOn); });
  $('t-board').onclick = () => { touch.board = !touch.board; $('t-board').classList.toggle('on', touch.board); };
  $('t-chat').onclick = () => { if (!G) return; if (G.mapId === HIDEOUT) { $('lobbyui').classList.remove('collapsed'); $('lb-msg').focus(); } else if (chatting) closeChat(); else openChat(); };
  $('t-menu').onclick = () => { if (G?.mapId === HIDEOUT) $('lobbyui').classList.toggle('collapsed'); else pause(); };
  $('chatin').addEventListener('blur', () => { if (chatting) setTimeout(() => { if (chatting && document.activeElement !== $('chatin')) closeChat(); }, 50); scrollTo(0, 0); });
}

// ------------------------------------------------------------------ actions
const canAct = () => G && G.mapId === BANK && G.state === 'play' && !ME.down && !ME.custody;
function doReload() { if (!canAct() || !ME.masked) return; if (ME.mag >= MAG) return; if (ME.ammo <= 0) { toast('Out of ammo! Grab some at the back of the van, or from zapped police'); return; } send({ t: 'reload' }); }
function doShout() { if (!canAct()) return; if (!ME.masked) { toast(`Put your mask on first — hold ${kk('G')}`); return; } const t = performance.now(); if (t - (doShout.t || 0) < 1100) return; doShout.t = t; send({ t: 'st', ...stMsg() }); send({ t: 'shout' }); }
function doThrow() { if (!canAct() || !ME.carry) return; const cp = Math.cos(me.camPitch); send({ t: 'st', ...stMsg() }); send({ t: 'throw', d: [-Math.sin(me.camYaw) * cp, Math.sin(me.camPitch) + 0.15, -Math.cos(me.camYaw) * cp] }); }
let maskT = 0;
/** what's right here that E would use: returns { k, id, label, sub, needMask } */
function target() {
  if (!canAct()) return null;
  const m = G.map, D = m.doors, cands = [];
  const fx = -Math.sin(me.camYaw), fz = -Math.cos(me.camYaw);
  const add = (k, id, x, z, r, label, sub = '', o = {}) => { const d = Math.hypot(x - me.x, z - me.z); if (d > r) return; const facing = ((x - me.x) * fx + (z - me.z) * fz) / (d || 1); cands.push({ k, id, label, sub, score: d - facing * 0.9 + (o.pri || 0), ...o }); };
  for (const e of G.ents.values()) if (e.id !== myId && (e.flags & 4)) add('revive', e.id, e.x, e.z, 1.9, `help <b>${esc(e.name)}</b> up`, '', { pri: -2 });
  const carryK = ME.carry;
  for (const v of world.bagViews.values()) { const b = v.b; if (b.by || b.fly) continue; if (carryK && b.kind !== 'key') continue; if (b.kind === 'ammo') continue; add('pick', b.id, v.g.position.x, v.g.position.z, 1.7, b.kind === 'key' ? "pick up the <b>keycard</b>" : `pick up the <b>${BAG[b.kind]?.name.toLowerCase()}</b>`, '', { free: b.kind === 'key' }); }
  for (const n of G.npcs.values()) {
    const f = n.flags; if (['cop', 'swat', 'heavy'].includes(n.kind)) continue;
    if (f & 512) { const held = f & (1 | 2 | 4 | 8); if (held) add('takeKey', n.id, n.x, n.z, 1.9, "take the manager's <b>keycard</b>"); else if (!ME.masked) add('pickpocket', n.id, n.x, n.z, 1.9, "<b>pickpocket</b> the keycard", 'from behind, so he doesn\'t notice', { free: true }); else add('takeKey', n.id, n.x, n.z, 1.9, "take the <b>keycard</b>", `shout at him first (${kk('F')})`, { info: true }); }
    if (!(f & 2) && ((f & 1) || (f & 4) || (f & 8))) add('cuff', n.id, n.x, n.z, 1.9, `tie up the <b>${n.kind === 'guard' ? 'guard' : 'hostage'}</b>`, 'so they stay put for good', { pri: 0.3 });
  }
  for (const id of ['staff', 'sec', 'gate']) { const d = D[id]; if (d.open) continue; if (ME.key) add('keycard', id, d.x, d.z, 1.9, `swipe the keycard: <b>${d.name}</b>`, '', { free: true }); else if (d.pick) add('lockpick', id, d.x, d.z, 1.9, `pick the lock: <b>${d.name}</b>`, '6 seconds'); else add('none', id, d.x, d.z, 1.9, `<b>${d.name}</b> is locked`, "you need the manager's keycard", { info: true }); }
  if (!D.back.open && me.x < 24) add('openBack', 0, 23.3, -10.2, 1.7, 'open the <b>back door</b>', 'a quick way to the van', { free: true });
  if (carryK === 'drill') { if (!D.vault.open && G.drill.state === 'none') add('placeDrill', 'vault', 0, -19.9, 2.1, 'set up the <b>drill</b> on the vault door'); if (G.truck === 'here' && G.drill.state === 'none') add('placeDrill', 'truck', m.truck.rear[0], m.truck.rear[1], 2.3, 'drill the <b>armored truck</b>'); }
  if (G.drill.state === 'jammed') add('fixDrill', 0, G.drill.x, G.drill.z, 2.1, '<b>fix the drill</b>', '', { pri: -1 });
  if (G.van.state === 'here') {
    const r = m.van.rear;
    if (carryK && carryK !== 'key') add('load', 0, r[0], r[1], 2.4, carryK === 'drill' ? 'put the drill back in the van' : `load the <b>${BAG[carryK].name.toLowerCase()}</b> into the van`, '', { pri: -1 });
    else if (!carryK && G.van.drill && !D.vault.open) add('takeDrill', 0, r[0], r[1], 2.4, 'take the <b>thermal drill</b>', 'it goes on the round vault door');
    else if (!carryK && ME.hp < HP_MAX - 5) add('medic', 0, r[0], r[1], 2.4, 'use the <b>first aid kit</b>');
    else if (!carryK && ME.ammo < AMMO_MAX - MAG - 10) add('ammo', 0, r[0], r[1], 2.4, 'grab <b>ammo</b>');
  }
  if (G.loot) {
    if (!carryK) m.pallets.forEach((p, i) => { if (G.loot.p[i] <= 0) return; if (p.room === 'vault' && !D.vault.open || p.room === 'reserve' && !D.cage.open) return; add('bag', i, p.x, p.z, 1.95, p.kind === 'diamond' ? 'take <b>THE GOOGLY DIAMOND</b>' : `bag the <b>${p.kind}</b>`, `${G.loot.p[i]} bag${G.loot.p[i] > 1 ? 's' : ''} here · ${money(BAG[p.kind].value)} each`); });
    if (D.vault.open) m.deposit.forEach((dp, i) => { if (G.loot.d[i] > 0) add('deposit', i, dp.x, dp.z, 1.8, 'crack a <b>deposit box</b>', `${G.loot.d[i]} left here · cash for your pocket`); });
    m.tellers.forEach((t, i) => { if (G.loot.dr[i] > 0) add('drawer', i, t.x, -5.2, 1.6, 'empty the <b>cash drawer</b>'); });
    m.atms.forEach((a, i) => { if (G.loot.a[i] > 0) add('atm', i, a.x, a.z, 1.7, 'crack the <b>ATM</b>', '8 seconds · $15,000'); });
    if (G.loot.s > 0) add('safe', 0, m.safe.x, m.safe.z + 0.5, 1.7, "crack the <b>manager's safe</b>", '12 seconds · $40,000');
  }
  if (G.cams.some(c => c === 'on')) add('cams', 0, m.monitors.x, m.monitors.z, 1.9, 'switch the <b>cameras</b> off');
  if (G.truck === 'here' && G.drill.on !== 'truck') add('truck', 0, m.truck.rear[0], m.truck.rear[1], 2.3, 'pry open the <b>armored truck</b>', '12 seconds');
  if (G.truck === 'open' && (G.truckBags ?? 6) > 0 && !carryK) add('truckbag', 0, m.truck.rear[0], m.truck.rear[1], 2.3, 'grab a <b>gold bag</b> from the truck');
  if (!cands.length) return null;
  cands.sort((a, b) => a.score - b.score);
  const c = cands[0];
  c.needMask = !ME.masked && !c.free && !c.info;
  return c;
}
let acting = null;
function updateActing(dt) {
  const held = keys.has('KeyE') || touch.act;
  const tg = held ? target() : null;
  const want = tg && !tg.needMask && !tg.info && tg.k !== 'none' ? tg : null;
  if (want && (!acting || acting.k !== want.k || acting.id !== want.id)) { acting = { k: want.k, id: want.id, t: 0 }; send({ t: 'st', ...stMsg() }); send({ t: 'act', k: want.k, id: want.id }); }
  if (!want && acting) { acting = null; send({ t: 'act', k: null }); }
  if (acting) { acting.t += dt; if (Math.random() < dt * 6 && ['lockpick', 'deposit', 'atm', 'safe', 'cams', 'fixDrill', 'truck'].includes(acting.k)) sfx.pick(); }
  if (held && tg?.needMask && !updateActing.warned) { updateActing.warned = true; toast(`Put your mask on first — hold ${kk('G')}`); }
  if (!held) updateActing.warned = false;
}

// ------------------------------------------------------------------ your googly
const camPos = new THREE.Vector3();
const stMsg = () => ({ x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), vx: +me.vx.toFixed(2), vz: +me.vz.toFixed(2), yaw: +me.yaw.toFixed(3), pitch: +me.camPitch.toFixed(3), g: me.onGround ? 1 : 0, c: me.crouch ? 1 : 0, a: (aimHeld || touch.aim) ? 1 : 0 });
function localInput() {
  const k = c => keys.has(c);
  if (Q.has('bot')) return botInput();
  let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.mx;
  let mz = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) + touch.mz;
  if (shopOpen || screen === 'scr-pause' || screen === 'scr-end' || ME.down || ME.custody || chatting) mx = mz = 0;
  return { mx, mz, jump: k('Space') || touch.jump, sprint: k('ShiftLeft') || k('ShiftRight') || touch.mag > 0.92 };
}
const botS = { t: 0, mx: 0, mz: 1 };
function botInput() { botS.t -= 1 / 60; if (botS.t <= 0) { botS.t = 1 + Math.random() * 2; botS.mx = Math.random() * 2 - 1; me.camYaw += (Math.random() - 0.5) * 2; } return { mx: botS.mx * 0.4, mz: 1, jump: Math.random() < 0.01, sprint: true }; }
let fireT = 0;
function updateLocal(dt) {
  const inp = localInput();
  const aiming = (aimHeld || touch.aim) && ME.masked && G.mapId === BANK;
  const sens = 0.0024 * prof.sens * (aiming ? 0.6 : 1);
  me.camYaw -= look.dx * sens; me.camPitch -= look.dy * sens * (prof.invy ? -1 : 1); look.dx = look.dy = 0;
  me.camPitch = Math.max(-1.2, Math.min(0.9, me.camPitch));
  const s = Math.sin(me.camYaw), c = Math.cos(me.camYaw);
  let dx = inp.mx * c - inp.mz * s, dz = -inp.mx * s - inp.mz * c;
  const carryHeavy = ME.carry && BAG[ME.carry]?.heavy;
  me.speedMul = ME.carry ? BAG[ME.carry]?.speed || 1 : 1;
  me.crouch = crouchOn && G.mapId === BANK;
  const n = Math.ceil(dt / (1 / 90));
  if (!ME.down && !ME.custody) for (let i = 0; i < n; i++) S.stepPlayer(me, { dx, dz, jump: inp.jump && i === 0 && !carryHeavy, sprint: inp.sprint && !carryHeavy && !aiming, crouch: me.crouch }, dt / n, G.map, 'crew');
  if (me.jumped) { me.jumped = false; sfx.jump(null); }
  if (me.landed) { sfx.land(Math.min(1, me.landed / 14)); me.landed = 0; }
  // facing: armed robbers face where the camera looks; otherwise face where you walk
  const armed = ME.masked && G.mapId === BANK && !carryHeavy;
  const moving = Math.hypot(dx, dz) > 0.1;
  const want = armed && (aiming || mouseHeld || touch.fire || moving) ? me.camYaw : moving ? Math.atan2(-dx, -dz) : null;
  if (want !== null) me.yaw += (((want - me.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-(armed ? 20 : 12) * dt));
  if (G.mapId === BANK) {
    // mask: hold G
    if ((keys.has('KeyG') || touch.mask) && !ME.masked && canAct()) { maskT += dt; if (maskT > 0.6) { maskT = 0; send({ t: 'mask' }); ME.masked = true; } } else maskT = 0;
    updateActing(dt);
    // shooting
    fireT -= dt;
    if ((mouseHeld || touch.fire) && canAct() && fireT <= 0 && !acting) {
      if (!ME.masked) { if (!updateLocal.warn) { updateLocal.warn = true; toast(`Put your mask on first — hold ${kk('G')}`); setTimeout(() => updateLocal.warn = false, 3000); } }
      else if (carryHeavy) { if (!updateLocal.warnH) { updateLocal.warnH = true; toast("You can't shoot while carrying something heavy — throw it (Q) or drop it off"); setTimeout(() => updateLocal.warnH = false, 3000); } }
      else if (ME.reload > 0) { }
      else if (ME.mag <= 0) { fireT = 0.4; sfx.empty(); doReload(); }
      else { fireT = 0.11; shoot(); }
    }
    if (ME.reload > 0) ME.reload = Math.max(0, ME.reload - dt);
  }
  G.sendT -= dt;
  if (G.sendT <= 0) { G.sendT = G.mapId === HIDEOUT ? 1 / 15 : 1 / 30; send({ t: 'st', ...stMsg() }); }
}
const ray = new THREE.Raycaster();
function aimPoint() {
  // where the crosshair points: the first wall, or somebody in front of it
  const cam = world.camera, o = cam.position, d = V2.set(0, 0, -1).applyQuaternion(cam.quaternion);
  const R = 70, w = S.segMap(G.map, o.x, o.y, o.z, o.x + d.x * R, o.y + d.y * R, o.z + d.z * R, 'shot');
  let best = w ? w.t * R : R;
  for (const n of G.npcs.values()) { if (n.flags & 8) continue; const f = n.flags, r = S.rayBody(o.x, o.y, o.z, d.x, d.y, d.z, { x: n.x, y: 0, z: n.z, pose: f & (1 | 2 | 8192) ? 'sit' : f & 16384 ? 'crouch' : 'stand', big: n.kind === 'heavy' }, best); if (r && r.d < best && r.d > 1.2) best = r.d; }
  G.map.cams.forEach((c, i) => { if (G.cams[i] === 'broken') return; const fx = c.x - o.x, fy = c.y - o.y, fz = c.z - o.z, t = fx * d.x + fy * d.y + fz * d.z; if (t < 0 || t > best) return; const px = o.x + d.x * t - c.x, py = o.y + d.y * t - c.y, pz = o.z + d.z * t - c.z; if (px * px + py * py + pz * pz < 0.09) best = t; });
  return new THREE.Vector3(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best);
}
function shoot() {
  const e = ent(myId); if (!e) return;
  const tgt = aimPoint();
  e.fig.update(0, { pose: 'aim', aimPitch: me.camPitch });
  const mz = e.fig.muzzle(V3).clone();
  // don't let the muzzle poke through a wall: fall back to the chest if it's blocked
  if (S.segMap(G.map, me.x, me.y + 1.3, me.z, mz.x, mz.y, mz.z, 'shot')) mz.set(me.x, me.y + 1.3, me.z);
  const d = tgt.clone().sub(mz); const spread = (aimHeld || touch.aim ? 0.004 : 0.018) + Math.hypot(me.vx, me.vz) * 0.004; d.normalize(); d.x += (Math.random() - 0.5) * spread; d.y += (Math.random() - 0.5) * spread; d.z += (Math.random() - 0.5) * spread;
  send({ t: 'st', ...stMsg() });
  send({ t: 'shoot', o: [+mz.x.toFixed(3), +mz.y.toFixed(3), +mz.z.toFixed(3)], d: [+d.x.toFixed(4), +d.y.toFixed(4), +d.z.toFixed(4)] });
  ME.mag = Math.max(0, ME.mag - 1);
  e.fig.fire();
  // our own tracer right away
  const R = 70, w = S.segMap(G.map, mz.x, mz.y, mz.z, mz.x + d.x * R, mz.y + d.y * R, mz.z + d.z * R, 'shot');
  const L = Math.min(w ? w.t * R : R, mz.distanceTo(tgt) + 0.3);
  world.tracer([mz.x, mz.y, mz.z], [mz.x + d.x * L, mz.y + d.y * L, mz.z + d.z * L], 0x4ad8ff);
  sfx.blaster(null, true);
  G.kick = 0.06;
}

// ------------------------------------------------------------------ everyone's googly
function interp(e, rt) {
  const b = e.buf; if (!b.length) return;
  let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
  const B = b[i], A = b[Math.max(0, i - 1)];
  const k = B.t === A.t ? 1 : Math.max(0, Math.min(1.2, (rt - A.t) / (B.t - A.t)));
  e.x = A.x + (B.x - A.x) * k; if (A.y !== undefined) e.y = A.y + (B.y - A.y) * k; e.z = A.z + (B.z - A.z) * k;
  e.yaw = A.yaw + (((B.yaw - A.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, k);
  e.flags = B.flags; e.vx = B.vx; e.vz = B.vz; if (B.pitch !== undefined) e.pitch = B.pitch;
}
const ICONS = {};
function iconSprite(key) {
  if (ICONS[key]) return ICONS[key].clone();
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const [kind, lvl] = key.split(':'); const k = +lvl / 7;
  if (kind === 'det') {
    g.fillStyle = '#0009'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill();
    g.strokeStyle = k >= 1 ? '#ff2a2a' : '#ffd23a'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.05, k)); g.stroke();
    g.fillStyle = k >= 0.99 ? '#ff4a3a' : '#ffe07a'; g.font = '900 64px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k >= 0.99 ? '!' : '?', 64, 68);
  } else { g.font = '84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText({ phone: '📞', key: '🗝', radio: '📻', cuffed: '⛓' }[kind] || '?', 64, 70); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(0.55, 0.55, 1); s.renderOrder = 20;
  ICONS[key] = s; return s.clone();
}
function updateEnts(dt) {
  const rt = performance.now() / 1000 - (local ? 0.05 : 0.1);
  const aiming = (aimHeld || touch.aim) && ME.masked;
  for (const e of G.ents.values()) {
    let speed, onGround, pose = 'idle', flags;
    if (e.id === myId) {
      e.x = me.x; e.y = me.y; e.z = me.z; e.yaw = me.yaw; e.pitch = me.camPitch;
      speed = Math.hypot(me.vx, me.vz); onGround = me.onGround;
      flags = (ME.masked ? 1 : 0) | (ME.down ? 4 : 0) | (ME.custody ? 16 : 0);
      e.carry = ME.carry ? CARRY_KINDS.indexOf(ME.carry) : 0;
      e.fig.root.visible = !ME.custody && camPos.distanceTo(V.set(me.x, me.y + 1.1, me.z)) > 0.7;
      if (aiming || mouseHeld || touch.fire) pose = 'aim';
      if (acting) pose = 'act';
    } else {
      interp(e, rt); flags = e.flags;
      speed = Math.hypot(e.vx, e.vz); onGround = !!(flags & 2);
      if (flags & 32) pose = 'aim';
      if (e.act) pose = 'act';
      e.fig.root.visible = !(flags & 16);
    }
    const masked = !!(flags & 1), carryK = CARRY_KINDS[e.carry] || null, heavy = carryK && BAG[carryK]?.heavy;
    if (masked && !e.fig.maskId) e.fig.setMask(e.mask);
    e.fig.setBag(carryK);
    e.fig.setArmed(masked && !heavy && G.mapId === BANK);
    if (flags & 4) pose = 'down';
    if (G.state === 'end' && G.endRows) pose = G.endRows.find(r => r.id === e.id)?.escaped ? 'cheer' : 'sad';
    const f = e.fig;
    f.group.position.set(e.x, e.y, e.z); f.group.rotation.y = e.yaw + Math.PI;
    f.update(dt, { speed: flags & 4 ? 0 : speed, onGround, pose, crouch: e.id === myId ? me.crouch : !!(flags & 8), aimPitch: e.pitch || 0 });
  }
  for (const n of G.npcs.values()) {
    interp(n, rt);
    const f = n.flags, fig = n.fig;
    let pose = 'idle';
    if (f & 8192) pose = 'sit';
    if (f & 32) pose = 'phone';
    if (f & 256) { fig.setArmed(true); pose = n.firedT > 0 || (f & 128) ? 'aim' : 'idle'; } else fig.setArmed(false);
    if (f & 16384) pose = 'cower';
    if (f & 4) pose = 'handsup';
    if (f & 1) pose = 'hostage';
    if (f & 2) pose = 'cuffed';
    if (f & 8) pose = 'zapped';
    n.firedT = Math.max(0, (n.firedT || 0) - dt);
    const speed = pose === 'idle' || pose === 'aim' || pose === 'phone' ? Math.hypot(n.vx, n.vz) : 0;
    fig.group.position.set(n.x, 0, n.z); fig.group.rotation.y = n.yaw + Math.PI;
    const near = camPos.distanceToSquared(fig.group.position) < 60 * 60;
    fig.group.visible = near;
    if (near) fig.update(dt, { speed, pose, aimPitch: 0 });
    // what's above their head: suspicion, a phone, the manager's keycard
    const det = (f >> 10) & 7;
    let key = '';
    if (!G.alarm && !(f & (1 | 2 | 8))) key = f & 32 ? 'phone:0' : det > 0 ? 'det:' + det : f & 512 && !ME.masked ? 'key:0' : '';
    if (f & 512 && (f & (1 | 2 | 4 | 8))) key = 'key:0';
    if (key !== n.iconKey) { if (n.icon) fig.group.remove(n.icon); n.icon = key ? iconSprite(key) : null; if (n.icon) { n.icon.position.y = 2.45; fig.group.add(n.icon); } n.iconKey = key; if (key.startsWith('det') && det >= 3) sfx.sus(det / 7); }
  }
}

// ------------------------------------------------------------------ camera
function updateCamera(dt) {
  const cam = world.camera;
  if (Q.has('cam')) { const v = Q.get('cam').split(',').map(Number); cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]); cam.fov = +(Q.get('fov') || 60); cam.updateProjectionMatrix(); camPos.copy(cam.position); setListener(camPos.x, camPos.y, camPos.z, 0); return; }
  if (shopOpen) {
    const fwd = V2.set(-Math.sin(me.yaw), 0, -Math.cos(me.yaw)), right = V.set(Math.cos(me.yaw), 0, -Math.sin(me.yaw));
    const want = new THREE.Vector3(me.x, me.y + 1.35, me.z).addScaledVector(fwd, 3.1).addScaledVector(right, innerWidth > 900 ? -1.3 : 0);
    camPos.lerp(want, 1 - Math.exp(-6 * dt)); cam.position.copy(camPos);
    cam.lookAt(me.x - right.x * (innerWidth > 900 ? 1.0 : 0), me.y + 0.95, me.z - right.z * (innerWidth > 900 ? 1.0 : 0));
    cam.fov = 50; cam.updateProjectionMatrix(); setListener(camPos.x, camPos.y, camPos.z, me.yaw); return;
  }
  const hide = G.mapId === HIDEOUT;
  const aiming = (aimHeld || touch.aim) && ME.masked && !hide;
  G.aimK = (G.aimK || 0) + ((aiming ? 1 : 0) - (G.aimK || 0)) * (1 - Math.exp(-12 * dt));
  const ak = G.aimK, down = ME.down || ME.custody;
  const right = V.set(Math.cos(me.camYaw), 0, -Math.sin(me.camYaw));
  const pivot = new THREE.Vector3(me.x, me.y + (me.crouch ? 1.15 : 1.55) - (down ? 0.9 : 0), me.z).addScaledVector(right, hide ? 0 : 0.55 + ak * 0.15);
  // keep the shoulder offset out of walls
  const sh = S.segMap(G.map, me.x, pivot.y, me.z, pivot.x, pivot.y, pivot.z, 'solid'); if (sh) pivot.set(me.x + (pivot.x - me.x) * sh.t * 0.8, pivot.y, me.z + (pivot.z - me.z) * sh.t * 0.8);
  const dist = hide ? 5 : (3.2 - ak * 1.35) * (mobile && innerWidth < innerHeight ? 1.15 : 1);
  G.kick = Math.max(0, (G.kick || 0) - dt * 0.6);
  const pitch = me.camPitch + G.kick;
  const cp = Math.cos(pitch), fwd = V2.set(-Math.sin(me.camYaw) * cp, Math.sin(pitch), -Math.cos(me.camYaw) * cp);
  const want = pivot.clone().addScaledVector(fwd, -dist);
  const hit = S.segMap(G.map, pivot.x, pivot.y, pivot.z, want.x, want.y, want.z, 'solid');
  const pos = hit ? pivot.clone().lerp(want, Math.max(0, hit.t - 0.15 / dist)) : want;
  pos.y = Math.max(pos.y, 0.25);
  camPos.copy(pos);
  cam.position.copy(camPos);
  cam.lookAt(pivot.clone().addScaledVector(fwd, 6));
  const baseFov = mobile && innerWidth < innerHeight ? 78 : 66;
  cam.fov += ((baseFov - ak * 20) - cam.fov) * (1 - Math.exp(-14 * dt)); cam.updateProjectionMatrix();
  setListener(camPos.x, camPos.y, camPos.z, me.camYaw);
}

// ------------------------------------------------------------------ minimap (a blueprint of the bank)
const MM = { x0: -27, x1: 37, z0: -44, z1: 32 };
function buildMinimap() {
  if (!G || G.mapId !== BANK) return;
  const N = 400, c = G.mm || document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), sc = N / Math.max(MM.x1 - MM.x0, MM.z1 - MM.z0);
  const P = (x, z) => [(x - MM.x0) * sc, (z - MM.z0) * sc];
  g.fillStyle = '#10223a'; g.fillRect(0, 0, N, N);
  g.fillStyle = '#1a3050'; { const [a, b] = P(-24, -36), [e, f] = P(24, 10); g.fillRect(a, b, e - a, f - b); }
  g.fillStyle = '#22262e'; { const [a, b] = P(-50, 15), [e, f] = P(50, 29); g.fillRect(a, b, e - a, f - b); const [h, i] = P(24, -45), [j, k] = P(34, 15); g.fillRect(h, i, j - h, k - i); const [l, n] = P(-24, -45), [o, q] = P(34, -36); g.fillRect(l, n, o - l, q - n); }
  for (const col of G.map.colliders) {
    if (col.kind === 'roof' || col.t !== 'b' && col.kind !== 'pillar') continue;
    const k = col.kind;
    let fill = null;
    if (['ext', 'front', 'wall', 'vaultwall', 'filler'].includes(k)) fill = '#cfe0f4';
    else if (k === 'building') fill = '#3a4250';
    else if (k === 'door' || k === 'gate' || k === 'vaultdoor' || k === 'cagedoor') fill = G.map.doors[col.door]?.open ? '#2aff6a' : '#ff5a5a';
    else if (k === 'glass') fill = '#8ad8ff';
    else if (k === 'van') fill = G.map.doors.van?.open ? null : '#ffd23a';
    else if (k === 'truck') fill = G.map.doors.truck?.open ? null : '#9a9a5a';
    else if (k === 'pallet' || k === 'goldcart' || k === 'pedestal') fill = k === 'pallet' ? '#7dff9a' : '#ffd23a';
    else if (k === 'pcar') fill = G.map.doors[col.door]?.open ? null : '#5a8aff';
    else if (k === 'car') fill = '#5a6070';
    else fill = '#50688a';
    if (!fill) continue;
    g.fillStyle = fill;
    if (col.t === 'b') { const [a, b] = P(col.x - col.w / 2, col.z - col.d / 2); g.fillRect(a, b, Math.max(1.5, col.w * sc), Math.max(1.5, col.d * sc)); }
    else { const [a, b] = P(col.x, col.z); g.beginPath(); g.arc(a, b, col.r * sc, 0, 7); g.fill(); }
  }
  g.fillStyle = '#ffd23a'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center';
  for (const [t, x, z] of [['VAULT', 0, -25], ['LOBBY', 0, 6], ['VAN', 29.2, -18.5], ['OFFICE', -17, -18], ['SECURITY', 17, -14]]) { const [a, b] = P(x, z); g.fillText(t, a, b); }
  G.mm = c;
}
function drawMinimap() {
  if (!G.mm) return;
  const cv = $('mm'), g = cv.getContext('2d'), N = cv.width, sc = N / Math.max(MM.x1 - MM.x0, MM.z1 - MM.z0);
  g.drawImage(G.mm, 0, 0, N, N);
  const P = (x, z) => [(x - MM.x0) * sc, (z - MM.z0) * sc];
  for (const n of G.npcs.values()) {
    const cop = ['cop', 'swat', 'heavy'].includes(n.kind) || (n.kind === 'guard' && (n.flags & 256));
    if (n.flags & 8 && cop) continue;
    const [x, z] = P(n.x, n.z); g.fillStyle = cop ? '#ff3a3a' : n.flags & (1 | 2) ? '#8a8a9a' : n.kind === 'guard' ? '#6aa8ff' : '#e8e8e8';
    g.beginPath(); g.arc(x, z, cop ? 3 : 2, 0, 7); g.fill();
  }
  for (const v of world.bagViews.values()) { if (v.b.by) continue; const [x, z] = P(v.g.position.x, v.g.position.z); g.fillStyle = v.b.kind === 'key' ? '#4ad8ff' : '#ffd23a'; g.fillRect(x - 2.5, z - 2.5, 5, 5); }
  if (G.drill.state !== 'none' && G.drill.on) { const [x, z] = P(G.drill.x, G.drill.z); g.fillStyle = G.drill.state === 'jammed' ? '#ff5a3a' : '#ff9a2a'; g.beginPath(); g.arc(x, z, 4, 0, 7); g.fill(); }
  for (const e of G.ents.values()) { if (e.id === myId) continue; const [x, z] = P(e.x, e.z); g.fillStyle = e.color; g.beginPath(); g.arc(x, z, 4, 0, 7); g.fill(); g.strokeStyle = e.flags & 4 ? '#ff3a3a' : '#fff'; g.lineWidth = 1.5; g.stroke(); }
  const [x, z] = P(me.x, me.z);
  g.save(); g.translate(x, z); g.rotate(-me.camYaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 5.5); g.lineTo(0, 2); g.lineTo(-5.5, 5.5); g.closePath(); g.fill(); g.stroke(); g.restore();
}

// ------------------------------------------------------------------ HUD
function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
function setHTML(el, h) { if (el._h !== h) { el.innerHTML = h; el._h = h; } }
function setBar(id, v, max, low) { const el = $(id); el.querySelector('i').style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; el.querySelector('b').textContent = Math.round(v); el.classList.toggle('low', low); }
function objectives() {
  const D = G.map.doors, L = G.loot, o = [];
  const len = G.len, cl = G.clock;
  const item = (text, state = 'now') => o.push(`<div class="o ${state}">${text}</div>`);
  if (!ME.masked && !G.alarm) item(`Put your mask on — hold <b>${kk('G')}</b>`, G.settings.plan === 'stealth' ? 'later' : 'now');
  if (!G.alarm && G.cams.some(c => c === 'on')) item('📹 Cameras are watching — switch them off in the security room', 'later');
  const hasKey = ME.key || [...G.ents.values()].some(e => e.flags & 512);
  if (!D.gate.open) item(hasKey ? '🗝 Open the <b>vault gate</b> with the keycard' : "🗝 Get the manager's <b>keycard</b>");
  else if (!D.vault.open) {
    if (G.drill.state === 'none') item(ME.carry === 'drill' ? '🔧 Put the drill on the <b>round vault door</b>' : '🔧 Bring the <b>thermal drill</b> from the van');
    else item(G.drill.state === 'jammed' ? '⚠️ <b>The drill jammed</b> — fix it!' : `🔧 Drilling the vault… <b>${mmss(G.drill.need - G.drill.t)}</b>`);
  } else {
    const left = L ? L.p.reduce((a, v, i) => a + (G.map.pallets[i].room === 'vault' ? v : 0), 0) : 0;
    if (left) item(`💰 Bag the loot — <b>${left}</b> bags left in the vault`);
    else item('💰 Main vault empty', 'done');
  }
  if (!D.cage.open) item(`⏰ Reserve time-lock opens at <b>20:00</b> (${mmss(T_CAGE * len / GAME_LEN - cl)})`, 'later');
  else if (L && L.p.some((v, i) => v > 0 && G.map.pallets[i].room === 'reserve')) item('💎 The reserve is open: gold + <b>THE GOOGLY DIAMOND</b>');
  if (G.truck === 'here') item(`🚚 Armored truck out front — break in (${mmss(T_TRUCK_GONE * len / GAME_LEN - cl)})`);
  if (G.truck === 'open' && (G.truckBags ?? 6) > 0) item(`🚚 ${G.truckBags ?? 6} gold bags in the truck`);
  item(cl > len - 120 ? '🚐 <b>GET TO THE VAN!</b>' : `🚐 The van leaves at <b>30:00</b>`, cl > len - 120 ? 'now' : 'later');
  return `<div class="oh">THE JOB</div>` + o.join('');
}
function updateHUD(dt) {
  const hide = G.mapId === HIDEOUT;
  if (hide) {
    const mat = onShopMat() && !shopOpen;
    $('prompt').innerHTML = mat ? (mobile ? 'Tap <span class="k">SHOP</span> for masks and skins' : 'Press <span class="k">E</span> for the MASK WALL (shop)') : '';
    if (mobile) { $('hud').classList.toggle('shopmat', mat); setText($('t-act'), 'SHOP'); }
    return;
  }
  const len = G.len, left = len - G.clock;
  // clock: time left, and what the bank clock says (4:00 PM → 6:30 PM)
  setText($('clock'), mmss(left));
  const mins = G.clock / len * 150; const hh = 4 + Math.floor(mins / 60), mm = Math.floor(mins % 60);
  setText($('banktime'), `${hh}:${String(mm).padStart(2, '0')} PM · VAN LEAVES IN`);
  $('clockpill').classList.toggle('final', left < 120);
  world.clockK = G.clock / len;
  if (Math.floor(G.clock * 2) % 20 === 0) world.setTime(G.clock / len);
  const W = G.wave;
  const ph = $('phase');
  if (!G.alarm) { setText(ph, ME.det > 0.05 ? '⚠️ SOMEONE IS SUSPICIOUS' : '🤫 STEALTH · NOBODY SUSPECTS A THING'); ph.className = ''; }
  else if (W?.k === 'response') { setText(ph, `🚨 POLICE ARRIVE IN ${Math.max(0, Math.ceil(W.t))}s`); ph.className = 'loud'; }
  else if (W?.k === 'assault') { setText(ph, `🚓 ASSAULT WAVE ${W.n} · ${mmss(W.t)}`); ph.className = 'loud'; }
  else if (W?.k === 'break') { setText(ph, `😮‍💨 POLICE REGROUPING · ${mmss(W.t)}`); ph.className = 'brk'; }
  // final countdown ticks
  if (left < 30 && Math.ceil(left) !== G.lastTick) { G.lastTick = Math.ceil(left); if (left > 0) sfx.tick(left < 10); }
  setHTML($('obj'), objectives());
  setText($('t-take'), money(G.secured));
  const v = G.van;
  setHTML($('t-van'), v.state === 'here' ? `🚐 Van in the alley · ${v.load}/${VAN_CAP} bags` : `🚐 Van dropping off loot · back in ${G.vanT || '…'}s`);
  setHTML($('t-host'), G.hostages ? `🙌 ${G.hostages} hostage${G.hostages > 1 ? 's' : ''}` : '');
  // crew
  const rows = [...G.ents.values()].map(e => {
    const f = e.id === myId ? (ME.down ? 4 : 0) | (ME.custody ? 16 : 0) : e.flags;
    const hp = e.id === myId ? ME.hp : e.hp, carry = e.id === myId ? ME.carry : CARRY_KINDS[e.carry];
    const st = f & 16 ? `🚓 ${e.timer}s` : f & 4 ? `🆘 DOWN ${e.id === myId ? Math.ceil(ME.down) : e.timer}s` : carry ? BAG[carry]?.emoji + ' ' + carry : '';
    return `<div class="cm ${f & 4 ? 'down' : ''} ${f & 16 ? 'jail' : ''} ${e.id === myId ? 'me' : ''}"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}<div class="hp"><i style="width:${Math.max(0, Math.min(100, hp))}%;background:${hp < 35 ? '#ff5a5a' : '#7dff9a'}"></i></div><span class="st">${esc(st)}</span></div>`;
  });
  setHTML($('crew'), rows.join(''));
  // vitals
  setBar('b-hp', ME.hp, HP_MAX, ME.hp < 30); setBar('b-armor', ME.armor, ARMOR_MAX, false);
  setText($('a-mag'), ME.reload > 0 ? '…' : String(ME.mag)); setText($('a-res'), '/ ' + ME.ammo);
  $('ammo').classList.toggle('low', ME.mag < 8);
  setHTML($('carry'), (ME.carry ? `${BAG[ME.carry].emoji} ${BAG[ME.carry].name}${BAG[ME.carry].heavy ? ' (heavy)' : ''}` : '') + (ME.key ? ' · 🗝 keycard' : '') + (ME.pocket ? ` · 💵 ${money(ME.pocket)} in pocket` : ''));
  $('vitals').style.display = ME.masked ? '' : 'none';
  $('hud').classList.toggle('masked', !!ME.masked); $('hud').classList.toggle('unmasked', !ME.masked); $('hud').classList.toggle('carrying', !!ME.carry);
  $('cross').style.display = ME.masked && !ME.down && !ME.custody ? '' : 'none';
  $('cross').classList.toggle('dot', !!(ME.carry && BAG[ME.carry]?.heavy));
  // suspicion meter: how close someone is to calling it in on you
  const det = G.alarm ? 0 : Math.max(ME.det || 0, 0);
  $('detm').style.opacity = det > 0.03 ? 1 : 0; $('detm').querySelector('i').style.width = Math.round(det * 100) + '%';
  // hold-to-use ring
  const ring = $('ring');
  const act = ME.act;
  if (act && acting) { ring.classList.remove('hidden'); $('ring-fg').style.strokeDashoffset = String(264 * (1 - Math.min(1, act[1]))); setText($('ring-t'), ACT_LABEL[act[0]] || ''); }
  else if (maskT > 0) { ring.classList.remove('hidden'); $('ring-fg').style.strokeDashoffset = String(264 * (1 - maskT / 0.6)); setText($('ring-t'), 'Putting on your mask…'); }
  else ring.classList.add('hidden');
  // what can I do here?
  const tg = target();
  let pr = '';
  if (tg && !acting) {
    if (tg.info) pr = `${tg.label}${tg.sub ? `<small>${tg.sub}</small>` : ''}`;
    else if (tg.needMask) pr = `Hold <span class="k">${kk('G')}</span> to put your mask on<small>then you can ${tg.label.replace(/<[^>]+>/g, '')}</small>`;
    else pr = `Hold <span class="k">${kk('E')}</span> ${tg.label}${tg.sub ? `<small>${tg.sub}</small>` : ''}`;
  }
  if (!pr && ME.carry && !acting) pr = `<span class="k">${kk('Q')}</span> throw the ${ME.carry === 'drill' ? 'drill' : 'bag'}<small>${G.van.state === 'here' ? 'take it to the back of the van in the alley' : 'the van is away — pile bags behind where it parks'}</small>`;
  setHTML($('prompt'), pr);
  if (mobile) { setText($('t-act'), tg && !tg.info ? ({ revive: 'HELP', pick: 'PICK UP', bag: 'BAG IT', load: 'LOAD', cuff: 'TIE UP', lockpick: 'PICK', keycard: 'SWIPE', pickpocket: 'STEAL', takeKey: 'TAKE KEY', deposit: 'CRACK', fixDrill: 'FIX', placeDrill: 'DRILL' }[tg.k] || 'USE') : 'USE'); $('t-act').classList.toggle('ready', !!tg && !tg.info && !tg.needMask); }
  // hints
  let hint = '';
  if (!ME.masked && G.settings.plan === 'stealth' && !G.alarm && G.clock > 25 && G.clock < 200) hint = `You look like a customer. The keycard, the cameras, then masks on — or just hold ${kk('G')} and go!`;
  else if (ME.hp < 30 && G.van.state === 'here') hint = '❤️ Low health! First aid at the back of the van';
  else if (ME.mag + ME.ammo < 20 && ME.masked) hint = '🔫 Low ammo! More at the back of the van';
  else if (G.drill.state === 'jammed' && Math.hypot(me.x - G.drill.x, me.z - G.drill.z) > 3) hint = '⚠️ The drill jammed! Go fix it (the round vault door)';
  setText($('hint'), hint);
  $('keys').textContent = ME.masked ? 'WASD move · Mouse aim · Click shoot · Right-click zoom · R reload · E (hold) use · F shout · Q throw · C crouch · Tab crew · T chat' : 'WASD move · Mouse look · E (hold) use · G (hold) mask up · Tab crew · T chat · Esc menu';
  // down / custody overlay
  const ds = $('downscr');
  if (ME.custody) { ds.classList.remove('hidden'); ds.classList.add('jail'); $('down-h').textContent = 'ARRESTED'; $('down-p').textContent = `Your crew is bailing you out… back in ${Math.ceil(ME.custody)}s`; ds.querySelector('.em').textContent = '🚓'; }
  else if (ME.down) { ds.classList.remove('hidden', 'jail'); $('down-h').textContent = "YOU'RE DOWN"; $('down-p').textContent = ME.arrest > 0.3 ? `A cop is cuffing you!! (${Math.max(0, 3 - ME.arrest).toFixed(1)}s)` : `A teammate can help you up · ${Math.ceil(ME.down)}s`; ds.querySelector('.em').textContent = '😵'; }
  else ds.classList.add('hidden');
  // scoreboard
  const showBoard = keys.has('Tab') || touch.board;
  $('board').classList.toggle('hidden', !showBoard);
  if (showBoard) $('board').innerHTML = `<table><tr><th>ROBBER</th><th class="r">❤️</th><th>DOING</th></tr>${[...G.ents.values()].map(e => `<tr class="${e.id === myId ? 'me' : ''}"><td><span class="dot" style="background:${esc(e.color)}"></span> ${esc(e.name)}${e.bot ? ' <small>(CPU)</small>' : ''}</td><td class="r">${e.id === myId ? Math.round(ME.hp) : e.hp}</td><td>${e.flags & 16 ? 'arrested' : e.flags & 4 ? 'DOWN' : CARRY_KINDS[e.carry] ? 'carrying ' + CARRY_KINDS[e.carry] : e.flags & 1 ? 'masked' : 'casing the bank'}</td></tr>`).join('')}</table><p class="tiny">${local ? 'solo heist' : 'crew ' + esc(room?.code || '')} · police ${DIFF_NAMES[G.settings.diff]} · secured ${money(G.secured)} · ${G.hostages} hostages</p>`;
  drawMinimap();
  // vignette
  G.hurtT = Math.max(0, (G.hurtT || 0) - dt);
  let va = 0;
  if (ME.hp < 35) { va = (35 - ME.hp) / 35; $('vign').style.setProperty('--vc', '#ff1a3a'); }
  if (G.hurtT > 0) va = Math.max(va, G.hurtT * 1.4);
  $('vign').style.opacity = Math.min(0.85, va) * (0.75 + Math.sin(performance.now() / 300) * 0.15);
  if (ME.hp < 30 && !ME.down) { G.hbT = (G.hbT || 0) - dt; if (G.hbT <= 0) { G.hbT = 1.1; sfx.heartbeat(0.7); } }
}
const ACT_LABEL = { lockpick: 'Picking the lock…', keycard: 'Swiping…', openBack: 'Opening…', takeKey: 'Taking the keycard…', pickpocket: 'Pickpocketing…', cuff: 'Tying up…', placeDrill: 'Setting up the drill…', fixDrill: 'Fixing the drill…', takeDrill: 'Grabbing the drill…', bag: 'Bagging…', truckbag: 'Grabbing gold…', pick: 'Picking up…', load: 'Loading…', deposit: 'Cracking the box…', drawer: 'Emptying the drawer…', atm: 'Cracking the ATM…', safe: 'Cracking the safe…', cams: 'Switching off cameras…', revive: 'Helping up…', ammo: 'Grabbing ammo…', medic: 'Patching up…', truck: 'Prying the truck open…' };

// ------------------------------------------------------------------ end of the heist
function showEnd(m) {
  G.state = 'end'; G.endRows = m.rows;
  unlock(); acting = null;
  if (local) { store.del('solo'); drawContinue(); }
  const mine = m.rows.find(r => r.id === myId);
  const escaped = mine?.escaped;
  $('end-grade').textContent = m.grade;
  $('end-title').innerHTML = escaped ? (m.take > 0 ? '🚐 CLEAN GETAWAY!' : '🚐 YOU GOT AWAY… WITH NOTHING') : '🚓 YOU GOT LEFT BEHIND';
  $('end-sub').textContent = `${m.stealth ? '🤫 Nobody ever called the police!' : '🚨 It went loud'} · ${m.bags} bags secured · ${m.rows.filter(r => r.escaped).length}/4 made it to the van`;
  $('end-take').textContent = `TOTAL TAKE: ${money(m.take)}`;
  $('end-awards').innerHTML = m.awards.map(a => { const e = m.rows.find(r => r.id === a.id); return `<div class="award"><span class="em">${a.emoji}</span>${a.title}<small><span style="color:${esc(e?.color || '#fff')}">${esc(e?.name || '')}</span> · ${esc(a.val)}</small></div>`; }).join('');
  $('end-list').innerHTML = `<div class="stand head"><span>#</span><span>ROBBER</span><span class="r">TO THE VAN</span><span class="r">POCKET</span><span class="r">⚡</span><span class="r">🩹</span></div>` + m.rows.map((r, i) => `<div class="stand ${i === 0 ? 'first' : ''} ${r.id === myId ? 'me' : ''}"><span>${i === 0 ? '⭐' : i + 1}</span><span class="n"><span class="dot" style="background:${esc(r.color)}"></span>${esc(r.name)}${r.bot ? ' <small>(CPU)</small>' : ''} ${r.escaped ? '' : '<small class="left">left behind</small>'}</span><span class="r money">${money(r.secured)}</span><span class="r">${money(r.pocket)}</span><span class="r">${r.zaps}</span><span class="r">${r.revives}</span></div>`).join('');
  const cut = escaped ? m.share : 0;
  if (cut > 0) addCash(cut);
  const el = $('end-cut'); el.classList.remove('hidden');
  el.innerHTML = escaped ? `Your cut: <span class="cash">${money(cut)}</span> — you now have ${money(prof.cash)} stashed. Spend it on masks and skins in the SHOP!` : 'You weren\'t in the van when it left, so you get no cut this time. Next time, be in the alley at 30:00!';
  $('end-again').classList.toggle('hidden', !(local || amHost()));
  $('end-lobby').classList.toggle('hidden', !!local || !amHost());
  if (escaped && m.take > 0) { sfx.win(); world.confetti(new THREE.Vector3(me.x, me.y + 2, me.z), 80); music.play('win'); } else { sfx.lose(); music.play('bust'); }
  setTimeout(() => sfx.grade(m.grade), 600);
  show('scr-end');
  clearInterval(showEnd.iv);
  if (!local) { let n = 20; $('end-t').textContent = `Back to the Hideout in ${n}…`; showEnd.iv = setInterval(() => { n--; $('end-t').textContent = n > 0 ? `Back to the Hideout in ${n}…` : 'Back to the Hideout…'; if (n <= 0 || !G) clearInterval(showEnd.iv); }, 1000); }
  else $('end-t').textContent = '';
}
$('end-again').onclick = () => { sfx.click(); show(null); if (local) { const set = { diff: G.settings.diff, plan: G.settings.plan }; leaveWorld(); local = null; startSolo(set); } else send({ t: 'start' }); };
$('end-lobby').onclick = () => { sfx.click(); send({ t: 'lobby' }); };
$('end-leave').onclick = () => { sfx.click(); leaveAll(); };

// ------------------------------------------------------------------ title backdrop: the crew around the planning table in the Hideout
let preview = null;
function showPreview() {
  world.load(HIDEOUT);
  world.setTime(0.3);
  const fig = new Googly({ color: prof.color, skin: prof.skin, local: true, role: 'crew' });
  fig.setMask(prof.mask); fig.setArmed(true);
  fig.group.position.set(0.2, 0, -0.8); world.actors.add(fig.group);
  preview = { fig, t: 0, pals: [] };
  [['#ff6fb5', -2.6, -1.2, 'clown', 'cash'], ['#2f7bff', 2.8, -1.4, 'skull', null], ['#7bd13b', -1.6, -5.6, 'tiger', 'gold']].forEach(([c, x, z, mask, bag]) => {
    const g = new Googly({ color: c, local: true, role: 'crew' }); g.setMask(mask); g.setArmed(!bag); g.setBag(bag);
    g.group.position.set(x, 0, z); g.group.rotation.y = Math.atan2(3.4 - x, 5.2 - z) * 0.6 + Math.atan2(-x, -3 - z) * 0.4; world.actors.add(g.group); preview.pals.push(g);
  });
}
function menuUpdate(dt) {
  if (!preview) return;
  const P = preview; P.t += dt;
  const fig = P.fig, cam = world.camera, wide = innerWidth > 900;
  fig.group.rotation.y = 0.5 + Math.sin(P.t * 0.5) * 0.25;
  fig.update(dt, { speed: 0, pose: Math.sin(P.t * 0.6) > 0.7 ? 'aim' : 'idle', aimPitch: 0.1 });
  if (Math.sin(P.t * 0.8) > 0.995 && fig.shoutT <= 0) fig.shout();
  P.pals.forEach((g, i) => { if (Math.sin(P.t * 0.9 + i * 2) > 0.995) g.reach(); g.update(dt, { speed: 0, pose: i === 1 && Math.sin(P.t * 0.7 + 1) > 0.5 ? 'aim' : 'idle' }); });
  if (Q.has('cam')) { const v = Q.get('cam').split(',').map(Number); cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]); cam.fov = +(Q.get('fov') || 60); cam.updateProjectionMatrix(); return; }
  if (shopOpen) { cam.position.set(0.2 + 0.8, 1.45, -0.8 + 2.9); cam.lookAt(0.2 + (wide ? -1.2 : 0), 1.0, -0.8); cam.fov = 48; }
  else { const sway = Math.sin(P.t * 0.12) * 0.8; cam.position.set(3.4 + sway, 2.6, 5.2 - sway * 0.5); cam.lookAt(wide ? -2.2 : -0.4, 1.0, -2.2); cam.fov = 52; }
  cam.updateProjectionMatrix();
  setListener(cam.position.x, cam.position.y, cam.position.z, 0);
}

// ------------------------------------------------------------------ test hooks (?solo=1&plan=&diff=&clock=S&pos=x,z&yaw=&pitch=&vault=1&gate=1&alarm=1&carry=kind&cage=1&truck=1&end=1)
let hooksDone = false;
function applyTestHooks() {
  if (hooksDone || !local) return; hooksDone = true;
  const R = local.room, p = local.p;
  if (Q.has('clock')) R.clock = +Q.get('clock');
  if (Q.has('mask')) R.maskUp(p);
  if (Q.has('alarm')) R.raiseAlarm('Test alarm');
  if (Q.has('gate')) { R.setDoor('staff', true); R.setDoor('gate', true); R.setDoor('back', true); }
  if (Q.has('vault')) { R.setDoor('staff', true); R.setDoor('gate', true); R.setDoor('back', true); R.setDoor('vault', true); }
  if (Q.has('cage')) { R.cageOpened = true; R.setDoor('cage', true); }
  if (Q.has('truck')) { R.truck.state = 'here'; R.setDoor('truck', false); R.bcast({ t: 'truck', state: 'here', bags: 0 }); }
  if (Q.has('carry')) { const b = R.addBag(Q.get('carry'), p.x, 1, p.z); b.by = p.id; p.carry = b.id; R.bcast({ t: 'bag', add: [R.bagPub(b)] }); }
  if (Q.has('pos')) { const [x, z] = Q.get('pos').split(',').map(Number); p.x = me.x = x; p.z = me.z = z; p.y = me.y = 0; p.tpGrace = true; }
  if (Q.has('yaw')) me.camYaw = me.yaw = +Q.get('yaw');
  if (Q.has('pitch')) me.camPitch = +Q.get('pitch');
  if (Q.has('aim')) aimHeld = true;
  if (Q.has('end')) setTimeout(() => R.endGame(false), 800);
  if (Q.has('freeze')) R.tick = () => { };
}

// ------------------------------------------------------------------ what you can hear
function feedAmbience(dt) {
  if (G.mapId === HIDEOUT) { ambience.update(dt, { place: 'hideout', inside: true, people: 0, drill: -1, alarm: 0, sirens: 0, heli: -1 }); return; }
  const inside = G.map.inside(camPos.x, camPos.z);
  let people = 0; for (const n of G.npcs.values()) if (n.kind !== 'cop' && Math.hypot(n.x - camPos.x, n.z - camPos.z) < 18 && !(n.flags & (1 | 2 | 8))) people++;
  const drillOn = G.drill.state === 'running';
  const dd = G.drill.on ? Math.hypot(G.drill.x - camPos.x, G.drill.z - camPos.z) : -1;
  const pan = G.drill.on ? ((G.drill.x - camPos.x) * Math.cos(me.camYaw) - (G.drill.z - camPos.z) * Math.sin(me.camYaw)) / (dd || 1) : 0;
  const alarm = G.alarm ? (G.clock - (G.alarmAt ?? G.clock) < 90 ? 1 : 0.4) : 0;
  const sirens = G.alarm ? (G.wave?.k === 'assault' ? 1 : 0.55) : 0;
  const heli = G.heli ? 30 : -1;
  ambience.update(dt, { place: 'bank', inside, people, drill: dd, drillOn, drillPan: pan, alarm, sirens, heli });
  // music follows the heist
  const left = G.len - G.clock;
  if (G.state === 'end') return;
  music.play(left < 120 ? 'final' : !G.alarm ? 'stealth' : G.wave?.k === 'assault' ? 'assault' : G.wave?.k === 'break' ? 'brk' : 'loud');
}

// ------------------------------------------------------------------ main loop
function frame() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  const T0 = performance.now();
  pump();
  const T1 = performance.now();
  if (G && soloPaused()) {
    ambience.update(dt, { place: 'bank', inside: true, people: 0, drill: -1, alarm: 0, sirens: 0, heli: -1 });
  } else if (G) {
    updateLocal(dt);
    updateEnts(dt);
    updateCamera(dt);
    updateHUD(dt);
    feedAmbience(dt);
    world.update(dt, t, V.set(me.x, me.y, me.z));
  } else { menuUpdate(dt); world.update(dt, t, V.set(0, 0, 0)); ambience.update(dt, { place: 'menu', inside: true, people: 0, drill: -1, alarm: 0, sirens: 0, heli: -1 }); }
  const T2 = performance.now();
  world.renderer.render(world.scene, world.camera);
  const T3 = performance.now(); frame.prof = [T1 - T0, T2 - T1, T3 - T2].map(v => +v.toFixed(1));
  frame.n = (frame.n || 0) + 1; if (t - (frame.t0 ?? 0) > 1) { frame.fps = frame.n / (t - (frame.t0 ?? 0)); frame.n = 0; frame.t0 = t; }
  if (Q.has('dbg')) { const d = $('dbg') || document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'dbg', style: 'position:fixed;left:0;bottom:160px;z-index:99;color:#0f0;background:#000a;font-size:12px;pointer-events:none' })); d.textContent = JSON.stringify({ myId, map: G?.mapId, state: G?.state, clock: G?.clock?.toFixed(1), me: [me.x, me.y, me.z].map(v => +v.toFixed(2)), fps: frame.fps?.toFixed(1), prof: frame.prof, ME: { ...ME, stats: undefined }, draws: world.renderer.info.render.calls, tris: world.renderer.info.render.triangles }); }
  requestAnimationFrame(frame);
}
if (!Q.has('icon') && !Q.has('audiotest')) {
  showPreview(); frame();
  if (pendingRoom) setTimeout(() => { if (prof.name) openOnline(); }, 200);
  if (Q.has('lobby')) { if (!prof.name) prof.name = 'TESTER'; openOnline(); }
  if (Q.has('solo')) { if (!prof.name) prof.name = 'TESTER'; startSolo({ diff: +(Q.get('diff') ?? 1), plan: Q.get('plan') || 'stealth' }); }
  if (Q.has('shop')) openShop();
  if (Q.has('help')) show('scr-help');
  if (Q.has('soloscreen')) { show('scr-solo'); drawPlans(); }
}
window.__gh = { get G() { return G; }, pause, resume: () => $('p-resume').click(), me, ME, world, send, get room() { return room; }, get local() { return local; }, prof, touch, target };
if (Q.has('icon')) import('./icon.js').then(m => m.renderIcon());
if (Q.has('audiotest')) import('./sfx.js').then(async m => {
  document.body.innerHTML = '<pre id="at" style="position:fixed;inset:0;margin:0;padding:10px;background:#000;color:#0f0;font:12px monospace;column-count:3;z-index:999"></pre>';
  const pre = document.getElementById('at'), t0 = performance.now();
  const res = await m.audioTest((k, r) => { pre.textContent += `${r.err ? 'ERR ' + r.err : (r.rms < 0.001 ? 'SILENT ' : 'ok ') + 'rms ' + r.rms + ' peak ' + r.peak} ${k}\n`; });
  pre.textContent = `DONE ${Object.keys(res).length} sounds in ${((performance.now() - t0) / 1000).toFixed(1)}s\n` + pre.textContent;
  window.__audio = res; document.title = 'AUDIO DONE';
});
