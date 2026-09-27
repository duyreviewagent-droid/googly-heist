// Googly Survival — online server: static files, lobbies (public list, 4-letter codes, invite links), chat relay.
// Each lobby is a core.js Room, the same game that runs in the page for PLAY SOLO.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room, newPlayer, SLOTS } from './public/js/core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const TICK = 1 / 30;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  const file = url.startsWith('/three/addons/') ? path.join(ROOT, 'node_modules/three/examples/jsm', path.normalize(url.slice(14)))
    : url.startsWith('/three/') ? path.join(ROOT, 'node_modules/three/build', path.basename(url))
    : path.join(ROOT, 'public', path.normalize(url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const rooms = new Map();
let nextId = 1;
const clean = (s, n) => String(s ?? '').replace(/[<>&"]/g, '').trim().slice(0, n);
function send(ws, m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function code() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c; do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c)); return c; }
function makeRoom(opts) {
  const r = new Room({ code: code(), pub: !!opts.public, name: opts.name, out: (p, m) => send(p.ws, m) });
  rooms.set(r.code, r);
  return r;
}
function listRooms() { return [...rooms.values()].filter(r => r.public && r.humans().length > 0).map(r => r.listing()); }
function leave(p) {
  const r = p.room; if (!r) return;
  p.room = null; r.leave(p);
  if (!r.humans().length) rooms.delete(r.code);
}
function join(p, r) {
  if (p.room === r) return;
  if (p.room) leave(p);
  if (!r.canJoin()) return send(p.ws, { t: 'err', msg: r.humans().length >= SLOTS ? `That lobby is full (${SLOTS} players).` : 'That game is full right now — try again when it ends.' });
  p.room = r; r.join(p);
}

const wss = new WebSocketServer({ server, maxPayload: 16384 });
wss.on('connection', ws => {
  const p = newPlayer({ id: nextId++, ws });
  send(ws, { t: 'hello', id: p.id });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const r = p.room;
    switch (m.t) {
      case 'me':
        p.name = clean(m.name, 14) || 'GOOGLY'; p.color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#ff6fb5';
        p.skin = clean(m.skin, 16) || 'none'; p.pet = clean(m.pet, 16) || 'none';
        if (r) { r.pushRoom(); r.bcast({ t: 'look', p: r.pub(p) }); }
        break;
      case 'list': send(ws, { t: 'list', rooms: listRooms() }); break;
      case 'create': join(p, makeRoom({ public: m.public, name: m.name })); break;
      case 'join': {
        const nr = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!nr) send(ws, { t: 'err', msg: 'No lobby with that code. Check the letters and try again.' });
        else join(p, nr);
        break;
      }
      case 'leave': leave(p); send(ws, { t: 'left' }); break;
      case 'ping': send(ws, { t: 'pong', c: m.c }); break;
      default: if (r) r.handle(p, m);
    }
  });
  ws.on('close', () => leave(p));
});

let last = performance.now() / 1000;
setInterval(() => {
  const t = performance.now() / 1000, dt = Math.min(0.1, t - last); last = t;
  for (const r of rooms.values()) { try { r.tick(dt); } catch (e) { console.error('tick', e); } }
}, TICK * 1000);
server.listen(PORT, () => console.log(`Googly Survival on http://localhost:${PORT}`));
