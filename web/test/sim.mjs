// Headless heist: four computer robbers play a whole game. node test/sim.mjs [diff] [plan] [secs] [runs]
import { Room } from '../public/js/core.js';
const diff = +(process.argv[2] ?? 1), plan = process.argv[3] || 'stealth', secs = +(process.argv[4] || 1800), runs = +(process.argv[5] || 1);
for (let r = 0; r < runs; r++) {
  const log = [];
  const R = new Room({ code: 'TEST', solo: true, settings: { diff, plan, cpus: true }, out: () => {} });
  const orig = R.bcast.bind(R);
  R.bcast = m => {
    if (m.t === 'chat' && m.sys) log.push(`${fmt(R.clock)} ${m.text}`);
    if (m.t === 'door') log.push(`${fmt(R.clock)} door ${m.id} ${m.open ? 'open' : 'shut'}`);
    if (m.t === 'fx' && ['down', 'custody', 'spotted'].includes(m.k)) log.push(`${fmt(R.clock)} fx ${m.k} ${m.id || m.npc}`);
    if (m.t === 'wave') log.push(`${fmt(R.clock)} wave ${m.k} ${m.n}`);
    if (m.t === 'end') log.push(`END take $${m.take.toLocaleString()} grade ${m.grade} bags ${m.bags} stealth ${m.stealth} rows ${m.rows.map(x => `${x.name}:${x.escaped ? 'esc' : 'LEFT'} sec$${x.secured} z${x.zaps} d${x.downs} c${x.custody}`).join(' | ')}`);
    orig(m);
  };
  R.start();
  const t0 = performance.now(); let maxTick = 0, lastRep = 0;
  const dt = 1 / 30;
  for (let i = 0; i < secs / dt && R.state === 'play'; i++) {
    const a = performance.now(); R.tick(dt); maxTick = Math.max(maxTick, performance.now() - a);
    if (R.clock - lastRep > 60) {
      lastRep = R.clock;
      let cops = 0, civ = 0; for (const n of R.npcs.values()) { if (['cop', 'swat', 'heavy'].includes(n.kind)) cops++; else civ++; }
      log.push(`${fmt(R.clock)} [status] secured $${R.secured.toLocaleString()} cops ${cops} people ${civ} tasks ${R.crew().map(p => `${p.name}:${p.down ? 'DOWN' : p.custodyT > 0 ? 'JAIL' : (p.brain?.task?.key || '-') + (p.act ? '*' + p.act.k : '')}@${p.x.toFixed(0)},${p.z.toFixed(0)}`).join(' ')} drill ${R.drill.state} ${R.drill.t.toFixed(0)}`);
    }
  }
  console.log(log.join('\n'));
  console.log(`run ${r}: ${((performance.now() - t0) / 1000).toFixed(1)}s wall, worst tick ${maxTick.toFixed(1)}ms`);
}
function fmt(t) { return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }
