// A solo heist saved mid-way and restored into a fresh Room keeps going.
import { Room, newPlayer } from '../public/js/core.js';
const box = [];
const R = new Room({ code: 'SOLO', solo: true, settings: { diff: 1, plan: 'loud' }, out: (p, m) => box.push(m) });
const me = newPlayer({ id: 1, name: 'ME' }); R.join(me); R.start();
for (let i = 0; i < 30 * 600; i++) R.tick(1 / 30);
const data = JSON.parse(JSON.stringify(R.save()));
console.log('saved at', data.clock.toFixed(0), 's · secured', data.secured, '· npcs', data.npcs.length, '· bags', data.bags.length, '· vault', data.doors.vault, '· size', JSON.stringify(data).length, 'bytes');
const box2 = [];
const R2 = new Room({ code: 'SOLO', solo: true, settings: {}, out: (p, m) => box2.push(m) });
const me2 = newPlayer({ id: 1, name: 'ME' }); R2.restore(data, me2);
for (let i = 0; i < 30 * 300; i++) R2.tick(1 / 30);
console.log('restored and ran 5 more minutes: clock', R2.clock.toFixed(0), '· secured', R2.secured, '· state', R2.state, '· world msg', box2.some(m => m.t === 'world'));
