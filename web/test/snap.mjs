// Real-time headless Chrome screenshot: node test/snap.mjs "query" OUT.png [waitSec] [WxH] ["js to run before the shot"]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [query = '', out = '/tmp/claude-501/snap.png', wait = '8', size = '1280x800', pre = ''] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const port = 9300 + Math.floor(Math.random() * 500), url = `http://localhost:${process.env.PORT || 8131}/?shim=1&${query}`;
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dir = `/tmp/claude-501/snap-${port}`;
const ch = spawn(CH, ['--headless=new', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-compositing', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${W},${H}`, url], { stdio: 'ignore' });
const done = code => { try { ch.kill('SIGKILL'); } catch { } process.exit(code); };
setTimeout(() => { console.log('TIMEOUT'); done(2); }, (+wait + 90) * 1000);
let list = null;
for (let i = 0; i < 100 && !list; i++) { await new Promise(r => setTimeout(r, 200)); try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); list = l.find(t => t.type === 'page'); } catch { } }
const ws = new WebSocket(list.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', ev => { const d = JSON.parse(ev.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') console.log('PAGE ERROR', JSON.stringify(d.params.exceptionDetails).slice(0, 600)); if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) console.log('console.' + d.params.type, d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400)); });
const call = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await call('Runtime.enable'); await call('Page.enable');
await new Promise(r => setTimeout(r, +wait * 1000));
if (pre) { const r = await call('Runtime.evaluate', { expression: pre, awaitPromise: true, returnByValue: true }); console.log('eval:', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r.result).slice(0, 1500)); await new Promise(r => setTimeout(r, 2500)); }
const shot = await call('Page.captureScreenshot', process.env.CLIP ? { format: 'png', clip: { x: 0, y: 0, width: +process.env.CLIP, height: +process.env.CLIP, scale: 1 } } : { format: 'png' });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('wrote', out);
done(0);
