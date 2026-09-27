// Every sound and every note of music in Googly Heist is synthesised live with WebAudio — nothing to download.
// Instruments: plucked strings, horns, brass, pads, piano, vibes, marimba, bells, kits and an 808-ish synth bass.
// Songs: a spy-lounge menu, the Hideout groove, stealth, loud, assault, the final two minutes, and win/bust stingers.
let ctx = null, master = null, comp = null, sfxBus = null, musicBus = null, ambBus = null, ambFilter = null, verb = null, verbIn = null;
const VOL = { music: 0.36, sfx: 1, amb: 0.8 };
let musicOn = true, sfxOn = true;
try {
  musicOn = localStorage.getItem('gh.music') !== '0'; sfxOn = localStorage.getItem('gh.sfx') !== '0';
  for (const k of ['music', 'sfx', 'amb']) { const v = localStorage.getItem('gh.vol.' + k); if (v !== null) VOL[k] = Math.max(0, Math.min(1, +v)); }
} catch { }

function buildGraph(c) {
  ctx = c;
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  // a brick-wall limiter and a soft clipper at the very end: nothing can ever get painfully loud
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  const clip = ctx.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.2) / Math.tanh(1.2); } clip.curve = curve;
  comp.connect(lim); lim.connect(clip); clip.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.85; master.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? VOL.sfx : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? VOL.music : 0; musicBus.connect(master);
  // ambience goes through a filter so it sounds muffled when you're inside your shelter
  ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 18000; ambFilter.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = sfxOn ? VOL.amb : 0; ambBus.connect(ambFilter);
  // an outdoor reverb: a long, soft noise tail
  verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 400 ? i / 400 : 1); }
  verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = 1; verbIn.connect(verb);
  const vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(master);
  noiseBuf = null; ksCache.clear();
}
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { buildGraph(new (window.AudioContext || window.webkitAudioContext)()); } catch { return; }
  music.start();
  ambience.start();
}
export const audioReady = () => !!ctx && ctx.state === 'running';
export function setMusic(on) { musicOn = on; try { localStorage.setItem('gh.music', on ? '1' : '0'); } catch { } if (musicBus) musicBus.gain.setTargetAtTime(on ? VOL.music : 0, ctx.currentTime, 0.1); }
export function setSfx(on) { sfxOn = on; try { localStorage.setItem('gh.sfx', on ? '1' : '0'); } catch { } if (sfxBus) { sfxBus.gain.setTargetAtTime(on ? VOL.sfx : 0, ctx.currentTime, 0.05); ambBus.gain.setTargetAtTime(on ? VOL.amb : 0, ctx.currentTime, 0.05); } }
export function setVolume(kind, v) {
  VOL[kind] = Math.max(0, Math.min(1, v)); try { localStorage.setItem('gh.vol.' + kind, String(VOL[kind])); } catch { }
  if (!ctx) return;
  if (kind === 'music') musicBus.gain.setTargetAtTime(musicOn ? VOL.music : 0, ctx.currentTime, 0.05);
  if (kind === 'sfx') sfxBus.gain.setTargetAtTime(sfxOn ? VOL.sfx : 0, ctx.currentTime, 0.05);
  if (kind === 'amb') ambBus.gain.setTargetAtTime(sfxOn ? VOL.amb : 0, ctx.currentTime, 0.05);
}
export const audioState = () => ({ music: musicOn, sfx: sfxOn, vol: { ...VOL } });
const now = () => ctx ? ctx.currentTime : 0;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ building blocks
let noiseBuf = null;
function nb() { if (!noiseBuf) { const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function env(g, t0, vol, attack, dur, curve = 'exp') {
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur); else { g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.linearRampToValueAtTime(0, t0 + dur); }
}
function sendTo(node, amt) { if (!amt) return; const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(verbIn); }
function tone(f, t0, dur, { type = 'sine', vol = 0.3, attack = 0.004, slide = 0, out = sfxBus, send = 0, vib = 0, vibRate = 6, detune = 0, curve = 'exp' } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
  if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibRate; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * vib, t0 + Math.min(0.25, dur * 0.4)); l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
  env(g, t0, vol, attack, dur, curve);
  o.connect(g); g.connect(out); sendTo(g, send);
  o.start(t0); o.stop(t0 + dur + 0.05);
  return o;
}
function noise(t0, dur, { vol = 0.3, f = 2000, q = 1, type = 'bandpass', slide = 0, out = sfxBus, attack = 0.002, send = 0, rate = 1, curve = 'exp' } = {}) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = nb(); s.playbackRate.value = rate * (0.85 + Math.random() * 0.3);
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t0 + dur);
  const g = ctx.createGain(); env(g, t0, vol, attack, dur, curve);
  s.connect(fl); fl.connect(g); g.connect(out); sendTo(g, send);
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
}
// Karplus-Strong plucked string, cached per note
const ksCache = new Map();
function ksBuffer(m, bright = 0.5, dur = 1.6) {
  const key = m + ':' + bright + ':' + dur;
  if (ksCache.has(key)) return ksCache.get(key);
  const sr = ctx.sampleRate, n = Math.floor(sr * dur), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const f = midi(m), N = Math.max(2, Math.round(sr / f)), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (1 - bright * 0.5) + (i < N / 2 ? bright : -bright) * 0.5;
  const decay = 0.996 - (1 - bright) * 0.004 + Math.min(0.003, f / 200000);
  let p = 0, last = 0;
  for (let i = 0; i < n; i++) { const cur = ring[p], nxt = ring[(p + 1) % N]; const v = (cur + nxt) * 0.5 * decay; ring[p] = v; d[i] = cur; last = v; p = (p + 1) % N; }
  void last;
  ksCache.set(key, buf);
  return buf;
}
function pluck(m, t, { vol = 0.3, out = sfxBus, bright = 0.5, dur = 1.6, send = 0.2, bend = 0 } = {}) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = ksBuffer(Math.round(m), bright, dur);
  if (bend) { s.playbackRate.setValueAtTime(Math.pow(2, -bend / 12), t); s.playbackRate.exponentialRampToValueAtTime(1, t + 0.12); }
  const g = ctx.createGain(); g.gain.value = vol;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
  s.connect(hp); hp.connect(g); g.connect(out); sendTo(g, send);
  s.start(t); s.stop(t + dur);
}
// positional: a gain/pan/lowpass chain for a world position relative to the listener
let listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
export function setListener(x, y, z, yaw) { listener = { x, y, z, rx: Math.cos(yaw), rz: -Math.sin(yaw) }; }
function at(pos, base = 1, reach = 7, bus = sfxBus) {
  if (!ctx) return null;
  if (!pos) { if (base === 1) return bus; const g = ctx.createGain(); g.gain.value = base; g.connect(bus); setTimeout(() => { try { g.disconnect(); } catch { } }, 4000); return g; }
  const dx = pos[0] - listener.x, dy = pos[1] - listener.y, dz = pos[2] - listener.z, d = Math.hypot(dx, dy, dz);
  const g = ctx.createGain(); g.gain.value = base / (1 + d / reach);
  const p = ctx.createStereoPanner(); p.pan.value = d > 0.1 ? Math.max(-1, Math.min(1, (dx * listener.rx + dz * listener.rz) / d)) * 0.9 : 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 / (1 + d / 12);
  g.connect(lp); lp.connect(p); p.connect(bus);
  setTimeout(() => { try { g.disconnect(); lp.disconnect(); p.disconnect(); } catch { } }, 4000);
  return g;
}
const distTo = pos => pos ? Math.hypot(pos[0] - listener.x, pos[2] - listener.z) : 0;

// ------------------------------------------------------------------ instruments (used by the music and a few stingers)
const INST = {
  guitar(m, t, d, v, out) { pluck(m, t, { vol: v * 1.1, out, bright: 0.45, dur: Math.max(1, d + 0.6), send: 0.25 }); },
  oud(m, t, d, v, out) { pluck(m, t, { vol: v * 1.2, out, bright: 0.75, dur: 1.2, send: 0.3, bend: Math.random() < 0.3 ? 1 : 0 }); },
  harp(m, t, d, v, out) { pluck(m, t, { vol: v, out, bright: 0.3, dur: 2.4, send: 0.5 }); },
  flute(m, t, d, v, out) {
    const f = midi(m);
    tone(f, t, d + 0.12, { type: 'sine', vol: v * 0.8, attack: 0.06, out, send: 0.45, vib: 0.012, vibRate: 5.2, curve: 'lin' });
    tone(f * 2, t, d + 0.1, { type: 'sine', vol: v * 0.12, attack: 0.07, out, curve: 'lin' });
    noise(t, Math.min(0.25, d), { f: f * 2, q: 4, vol: v * 0.18, out, attack: 0.03 });
  },
  whistle(m, t, d, v, out) { tone(midi(m), t, d + 0.08, { type: 'sine', vol: v * 0.7, attack: 0.03, out, send: 0.35, vib: 0.02, vibRate: 6.5, curve: 'lin' }); },
  horn(m, t, d, v, out) {
    const f = midi(m), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = 7;
    fl.type = 'lowpass'; fl.Q.value = 1.5; fl.frequency.setValueAtTime(f * 1.2, t); fl.frequency.linearRampToValueAtTime(f * 4, t + 0.08); fl.frequency.exponentialRampToValueAtTime(f * 2.2, t + d);
    env(g, t, v * 0.35, 0.05, d + 0.15, 'lin');
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(out); sendTo(g, 0.4);
    for (const o of [o1, o2]) { o.start(t); o.stop(t + d + 0.2); }
  },
  pad(m, t, d, v, out) {
    const f = midi(m), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = 'lowpass'; fl.frequency.value = Math.min(2400, f * 5); fl.Q.value = 0.5;
    env(g, t, v * 0.16, Math.min(0.8, d * 0.4), d + 0.6, 'lin');
    fl.connect(g); g.connect(out); sendTo(g, 0.6);
    for (const dt of [-9, 0, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(fl); o.start(t); o.stop(t + d + 0.7); }
  },
  piano(m, t, d, v, out) {
    const f = midi(m), g = ctx.createGain(); g.connect(out); sendTo(g, 0.35);
    g.gain.value = 1;
    [[1, 1, 1.6], [2, 0.4, 0.9], [3, 0.18, 0.6], [4.01, 0.08, 0.35]].forEach(([k, a, dd]) => tone(f * k, t, Math.max(0.4, dd * (1.4 - m / 120)), { type: 'sine', vol: v * a * 0.5, out: g, attack: 0.003 }));
    noise(t, 0.02, { f: 2500, q: 1, vol: v * 0.08, out: g });
  },
  marimba(m, t, d, v, out) { const f = midi(m); tone(f, t, 0.5, { type: 'sine', vol: v * 0.7, out, send: 0.3 }); tone(f * 4, t, 0.06, { type: 'sine', vol: v * 0.2, out }); tone(f * 10, t, 0.02, { type: 'sine', vol: v * 0.05, out }); },
  kalimba(m, t, d, v, out) { const f = midi(m); tone(f, t, 1.1, { type: 'sine', vol: v * 0.6, out, send: 0.5 }); tone(f * 5.95, t, 0.12, { type: 'sine', vol: v * 0.12, out }); },
  bell(m, t, d, v, out) { const f = midi(m); tone(f, t, 2.2, { type: 'sine', vol: v * 0.45, out, send: 0.7 }); tone(f * 2.76, t, 1.1, { type: 'sine', vol: v * 0.12, out, send: 0.6 }); tone(f * 5.4, t, 0.5, { type: 'sine', vol: v * 0.05, out }); },
  pizz(m, t, d, v, out) { pluck(m, t, { vol: v, out, bright: 0.2, dur: 0.6, send: 0.3 }); },
  bass(m, t, d, v, out) {
    const f = midi(m), o = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f / 2;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(200, t + d);
    env(g, t, v * 0.5, 0.008, d + 0.1);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(out);
    for (const x of [o, o2]) { x.start(t); x.stop(t + d + 0.15); }
  },
  synthbass(m, t, d, v, out) {
    const f = midi(m), o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.Q.value = 7; fl.frequency.setValueAtTime(1400, t); fl.frequency.exponentialRampToValueAtTime(160, t + d);
    env(g, t, v * 0.32, 0.005, d + 0.05); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.1);
  },
  brass(m, t, d, v, out) { INST.horn(m, t, d, v * 1.2, out); INST.horn(m + 12, t, d, v * 0.4, out); },
};
// drums
const DRUM = {
  k(t, v, out) { tone(150, t, 0.28, { vol: v * 0.9, slide: 0.3, out }); noise(t, 0.012, { f: 3500, vol: v * 0.15, out }); },
  s(t, v, out) { noise(t, 0.16, { f: 1900, q: 0.7, vol: v * 0.45, out, send: 0.25 }); tone(200, t, 0.08, { vol: v * 0.22, type: 'triangle', out }); },
  brush(t, v, out) { noise(t, 0.12, { f: 4200, q: 0.6, vol: v * 0.2, out, attack: 0.02 }); },
  h(t, v, out) { noise(t, 0.03, { f: 9000, type: 'highpass', vol: v * 0.12, out }); },
  o(t, v, out) { noise(t, 0.18, { f: 8000, type: 'highpass', vol: v * 0.1, out }); },
  sh(t, v, out) { noise(t, 0.06, { f: 6500, q: 1.2, vol: v * 0.12, out, attack: 0.015 }); },
  dum(t, v, out) { tone(110, t, 0.35, { vol: v * 0.8, slide: 0.55, out, send: 0.2 }); noise(t, 0.05, { f: 400, vol: v * 0.2, out }); },
  tek(t, v, out) { noise(t, 0.05, { f: 3200, q: 3, vol: v * 0.35, out, send: 0.15 }); tone(620, t, 0.04, { vol: v * 0.12, out }); },
  taiko(t, v, out) { tone(95, t, 0.9, { vol: v * 1.1, slide: 0.45, out, send: 0.55 }); noise(t, 0.25, { f: 180, type: 'lowpass', vol: v * 0.5, out }); },
  rim(t, v, out) { noise(t, 0.02, { f: 2600, q: 8, vol: v * 0.3, out }); tone(1700, t, 0.02, { vol: v * 0.1, out }); },
  tim(t, v, out) { tone(82, t, 1.1, { vol: v * 0.7, slide: 0.9, out, send: 0.5 }); noise(t, 0.3, { f: 200, type: 'lowpass', vol: v * 0.25, out }); },
  clap(t, v, out) { for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.09, { f: 1400, q: 1, vol: v * 0.3, out, send: 0.3 }); },
};

// ------------------------------------------------------------------ googly voices: little formant squeaks
function voice(pos, pitch, pattern, vol = 0.12) {
  if (!ctx) return; const t = now(), o = at(pos, vol * 10, 8);
  for (const [dt, f0, f1, dur, vowel] of pattern) {
    const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * pitch, t + dt); osc.frequency.exponentialRampToValueAtTime(f1 * pitch, t + dt + dur);
    const formants = { a: [800, 1200], e: [500, 1900], i: [300, 2300], o: [500, 900], u: [350, 700] }[vowel || 'a'];
    env(g, t + dt, 0.45, 0.015, dur);
    osc.connect(g);
    for (const ff of formants) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * (0.9 + pitch * 0.1); bp.Q.value = 6; g.connect(bp); bp.connect(o); }
    osc.start(t + dt); osc.stop(t + dt + dur + 0.05);
  }
}
const pitchOf = id => 0.85 + ((id * 37) % 10) / 20;

// ------------------------------------------------------------------ sound effects

// ------------------------------------------------------------------ extra instruments for the heist
INST.vibes = (m, t, d, v, out) => { const f = midi(m); tone(f, t, 1.6, { type: 'sine', vol: v * 0.55, out, send: 0.45, vib: 0.004, vibRate: 5.5 }); tone(f * 4, t, 0.3, { type: 'sine', vol: v * 0.08, out, send: 0.3 }); tone(f * 10.2, t, 0.05, { type: 'sine', vol: v * 0.03, out }); };
INST.mute = (m, t, d, v, out) => {
  const f = midi(m), o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.985, t); o.frequency.linearRampToValueAtTime(f, t + 0.05);
  bp.type = 'bandpass'; bp.frequency.value = f * 2.2; bp.Q.value = 2.2;
  env(g, t, v * 0.42, 0.03, d + 0.1, 'lin'); o.connect(bp); bp.connect(g); g.connect(out); sendTo(g, 0.35); o.start(t); o.stop(t + d + 0.15);
};
INST.stab = (m, t, d, v, out) => { for (const iv of [0, 7, 12, 15]) INST.horn(m + iv, t, Math.min(0.18, d), v * 0.7, out); };
INST.organ = (m, t, d, v, out) => { const f = midi(m); for (const [k, a] of [[1, 0.5], [2, 0.3], [3, 0.15], [4, 0.1]]) tone(f * k, t, d + 0.05, { type: 'sine', vol: v * a * 0.35, out, attack: 0.01, curve: 'lin', send: 0.25 }); };

// ------------------------------------------------------------------ the songs
// chords: one per bar as [root semitone, quality]; mel: 8 notes a bar (semitones above root+24, '.' rest, '-' hold);
// drum patterns are 16 steps a bar; form plays the sections in order and loops.
const Q = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], D7: [0, 4, 7, 10], s4: [0, 5, 7], mM7: [0, 3, 7, 11], m6: [0, 3, 7, 9], dim: [0, 3, 6, 9], M9: [0, 4, 7, 14], ph: [0, 1, 4, 7] };
const mel = s => s.trim().split(/\s+/).map(x => x === '.' ? null : x === '-' ? '-' : +x);
const SONGS = {
  // title screen: a cool spy lounge — walking bass, brushes, vibes and a muted trumpet
  menu: {
    bpm: 98, root: 38, swing: 0.24, lead: 'mute', comp: 'vibes', bass: 'bass', bassPat: 'walk', kit: { k: 'x.......x.......', brush: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, comp_pat: 'block2', form: 'AABA',
    A: { chords: [[0, 'mM7'], [0, 'm6'], [5, 'm7'], [7, 'D7']], mel: mel('12 - 15 - 14 12 . .  17 - - 15 14 - 12 .  10 12 13 - 12 10 8 -  7 - - . . 14 15 17') },
    B: { chords: [[3, 'M7'], [8, 'M7'], [1, 'M7'], [7, 'D7']], mel: mel('19 - 17 15 - 14 15 .  20 - 19 17 - 15 . .  13 - 15 17 - 20 19 17  19 - - - 14 - 15 -') },
  },
  // the Hideout: laid-back boom-bap for planning
  hideout: {
    bpm: 86, root: 41, swing: 0.28, lead: 'vibes', comp: 'piano', bass: 'bass', kit: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx', sh: '..x...x...x...x.' }, comp_pat: 'block', form: 'AB',
    A: { chords: [[0, 'm7'], [5, 'm7'], [-2, 'M7'], [3, 'M7']], mel: mel('15 - 12 - 10 - . .  12 - 15 17 - 15 . .  14 - 10 - 7 - . .  10 - 12 - 15 - . .') },
    B: { chords: [[8, 'M7'], [7, 'm7'], [5, 'm7'], [7, 'D7']], mel: mel('20 - 19 - 15 - . .  19 - 17 - 14 - . .  17 - 15 - 12 - 10 .  11 - - - 14 - - .') },
  },
  // casing the bank: tense and quiet — pizzicato ostinato, soft pulse, a lonely bell
  stealth: {
    bpm: 88, root: 45, swing: 0, lead: 'bell', comp: 'ostinato_low', bass: null, pad: 'pad', kit: { k: 'x.......x.......', h: '....x.......x...', sh: '..x...x...x...x.' }, comp_pat: 'ostinato', form: 'AAB',
    A: { chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-5, 'M']], mel: mel('. . . . 12 - - -  . . . . 15 - 14 -  . . . . 12 - - -  . . . . 11 - - -') },
    B: { chords: [[-7, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'D7']], mel: mel('. . 10 - 12 - - -  . . 15 - 12 - - -  . . 14 - 15 - 17 -  16 - - - . . . .') },
  },
  // it's loud: driving synth bass, brass stabs, big drums
  loud: {
    bpm: 140, root: 40, swing: 0, lead: 'brass', comp: 'stab', bass: 'synthbass', bassPat: 'sixteen', kit: { k: 'x...x...x...x...', clap: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', taiko: 'x.........x.....' }, comp_pat: 'stabs', form: 'AABB',
    A: { chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M']], mel: mel('12 - - 15 - - 14 -  12 - 10 - 7 - . .  12 - - 15 - - 17 -  19 - 17 - 15 - 14 -') },
    B: { chords: [[-4, 'M'], [-2, 'M'], [0, 'm'], [-5, 'M']], mel: mel('20 - - 19 - - 17 -  15 - - 14 - - 12 -  15 - 17 - 19 - 20 -  19 - - - 17 - - .') },
  },
  // an assault wave: faster, heavier
  assault: {
    bpm: 152, root: 40, swing: 0, lead: 'brass', comp: 'stab', bass: 'synthbass', bassPat: 'sixteen', kit: { k: 'x.x.x...x.x.x...', clap: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx', taiko: 'x..x..x...x.x...' }, comp_pat: 'stabs', form: 'AB',
    A: { chords: [[0, 'm'], [1, 'M'], [0, 'm'], [-2, 'M']], mel: mel('12 - 13 - 12 - 10 -  12 - 13 - 15 - 13 -  12 - 13 - 12 - 10 -  7 - - - 10 - - -') },
    B: { chords: [[-4, 'M'], [-2, 'M'], [1, 'M'], [-5, 'D7']], mel: mel('20 - 19 - 17 - 15 -  17 - 15 - 13 - 12 -  13 - 15 - 17 - 19 -  19 - - - - - . .') },
  },
  // between waves: holding your breath
  brk: {
    bpm: 100, root: 40, swing: 0, lead: 'vibes', comp: 'ostinato_low', bass: 'bass', pad: 'pad', kit: { k: 'x.......x.......', h: '..x...x...x...x.' }, comp_pat: 'ostinato', form: 'A',
    A: { chords: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'M']], mel: mel('. . 12 - - - . .  . . 15 - 14 - . .  . . 12 - - - 10 -  . . 11 - - - . .') },
  },
  // the last two minutes: run for the van
  final: {
    bpm: 164, root: 42, swing: 0, lead: 'brass', comp: 'stab', bass: 'synthbass', bassPat: 'sixteen', kit: { k: 'x.x.x.x.x.x.x.x.', clap: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', taiko: 'x...x...x...x...' }, comp_pat: 'stabs', form: 'A',
    A: { chords: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-5, 'M']], mel: mel('19 - 19 - 17 - 15 -  17 - 17 - 15 - 14 -  15 - 15 - 14 - 12 -  14 - - - 11 - - -') },
  },
  // the getaway worked
  win: {
    bpm: 118, root: 43, swing: 0.15, lead: 'brass', comp: 'piano', bass: 'bass', bassPat: 'walk', pad: 'pad', kit: { k: 'x.......x.......', s: '....x.......x.x.', h: 'x.x.x.x.x.x.x.x.' }, comp_pat: 'block', form: 'AB',
    A: { chords: [[0, 'M7'], [5, 'M7'], [2, 'm7'], [7, 'D7']], mel: mel('12 - 16 - 19 - 24 -  21 - 19 - 17 - 16 -  14 - 17 - 21 - 19 17  19 - - - . . . .') },
    B: { chords: [[5, 'M7'], [4, 'm7'], [2, 'm7'], [7, 'D7']], mel: mel('21 - 24 - 21 - 19 -  19 - 16 - 12 - 16 -  14 - 17 - 21 - 24 -  24 - - - . . . .') },
  },
  // busted / left behind
  bust: {
    bpm: 72, root: 38, swing: 0.2, lead: 'mute', comp: 'piano', bass: 'bass', bassPat: 'walk', kit: { brush: 'x...x...x...x...', k: 'x.......x.......' }, comp_pat: 'block', form: 'A',
    A: { chords: [[0, 'm7'], [5, 'm7'], [-2, 'M7'], [-5, 'D7']], mel: mel('15 - 14 - 12 - - -  10 - 12 - 8 - - -  7 - 8 - 10 - 12 -  11 - - - . . . .') },
  },
};
const VOICE_VOL = { mute: 0.22, vibes: 0.26, bell: 0.26, piano: 0.3, brass: 0.16, horn: 0.2 };
export const SONG_NAMES = Object.keys(SONGS);

export const music = {
  song: 'menu', step: 0, next: 0, gain: null, started: false,
  start() { if (this.started) return; this.started = true; this.newGain(0.4); this.tick(); },
  newGain(fade) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(1, ctx.currentTime + fade); g.connect(musicBus);
    if (this.gain) { const old = this.gain; old.gain.cancelScheduledValues(ctx.currentTime); old.gain.setValueAtTime(old.gain.value, ctx.currentTime); old.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.4); setTimeout(() => { try { old.disconnect(); } catch { } }, 2500); }
    this.gain = g;
  },
  play(name) {
    if (this.song === name) return;
    this.song = name; this.step = 0;
    if (ctx && this.started) { this.newGain(['loud', 'assault', 'final'].includes(name) ? 0.5 : 1.6); this.next = ctx.currentTime + 0.1; }
  },
  tick() { if (!ctx) return; if (ctx.state === 'running') this.fill(ctx.currentTime + 0.2); setTimeout(() => this.tick(), 50); },
  fill(until) {
    const S = SONGS[this.song] || SONGS.menu, spb = 60 / S.bpm / 4, out = this.gain;
    if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05;
    while (this.next < until) {
      const step = this.step, s = step % 16, bar = Math.floor(step / 16), secIdx = Math.floor(bar / 4) % S.form.length, sec = S[S.form[secIdx]], b4 = bar % 4;
      const [cr, cq] = sec.chords[b4], chord = Q[cq], root = S.root + cr;
      const t = this.next + (s % 2 ? spb * S.swing : 0);
      for (const k in S.kit) { const p = S.kit[k]; if (p[s] === 'x') DRUM[k](t, (s % 4 === 0 ? 1 : 0.72) * (0.9 + Math.random() * 0.2), out); }
      // bass
      if (S.bass) {
        if (S.bassPat === 'walk') { if (s % 4 === 0) { const seq = [0, chord[1], chord[2], (chord[3] ?? 12) - 1]; INST[S.bass](root - 12 + seq[s / 4], t, spb * 3.6, 0.8, out); } }
        else if (S.bassPat === 'sixteen') { if (s % 2 === 0) INST[S.bass](root - 12 + (s % 8 === 6 ? 12 : s === 14 ? 7 : 0), t, spb * 1.6, s % 4 === 0 ? 0.9 : 0.6, out); }
        else if (s === 0 || s === 6 || s === 10 || (s === 14 && b4 === 3)) { const iv = s === 0 ? 0 : s === 6 ? 7 : s === 10 ? 12 : 10; INST[S.bass](root - 12 + iv, t, spb * (s === 0 ? 5 : 3), s === 0 ? 0.9 : 0.65, out); }
      }
      const pat = S.comp_pat, comp = S.comp;
      if (pat === 'ostinato' && s % 2 === 0) { const seq = [0, 0, 7, 0, 3, 0, 7, 12]; INST.pizz(root + seq[(s / 2) % 8], t, spb * 2, 0.32, out); }
      if (pat === 'block' && (s === 0 || s === 10)) chord.forEach((iv, i) => INST[comp](root + 12 + iv, t + i * 0.015, spb * 6, 0.09, out));
      if (pat === 'block2' && (s === 2 || s === 11)) chord.forEach((iv, i) => INST[comp](root + 12 + iv, t + i * 0.01, spb * 4, 0.1, out));
      if (pat === 'stabs' && (s === 3 || s === 6 || s === 11) && bar % 2 === 0) INST.stab(root + 12, t, spb * 1.5, 0.28, out);
      if (S.pad && s === 0) chord.forEach(iv => INST.pad(root + 12 + iv, t, spb * 16, 0.3, out));
      if (s % 2 === 0) {
        const mi = b4 * 8 + s / 2, note = sec.mel[mi];
        if (note !== null && note !== '-' && note !== undefined) {
          let len = 1; while (sec.mel[mi + len] === '-' && (mi + len) % 8 !== 0) len++;
          INST[S.lead](S.root + 24 + note, t, spb * 2 * len - 0.02, VOICE_VOL[S.lead] || 0.22, out);
        }
      }
      this.next += spb; this.step++;
    }
  },
};

// ------------------------------------------------------------------ ambience and the long sounds: lobby murmur, traffic, the drill,
// the alarm bell, sirens and the helicopter. Persistent nodes (no feedback anywhere), faded by update().
function loopNoise(f, q, type = 'bandpass', rate = 1) {
  const s = ctx.createBufferSource(); s.buffer = nb(); s.loop = true; s.playbackRate.value = rate;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); s.start();
  return { s, fl, g };
}
export const ambience = {
  loops: null, st: {}, bellT: 0, babbleT: 2, carT: 4, radioT: 6, tickT: 0,
  start() {
    if (!ctx || this.loops) return;
    const L = this.loops = {};
    // the lobby: a room full of quiet chatter
    L.murmur = loopNoise(520, 0.9); L.murmur.g.connect(ambBus);
    // traffic outside
    L.traffic = loopNoise(160, 0.6, 'lowpass', 0.7); L.traffic.g.connect(ambBus);
    // the thermal drill: a whine and a grind
    L.drillPan = ctx.createStereoPanner(); L.drillPan.connect(sfxBus);
    L.drillG = ctx.createGain(); L.drillG.gain.value = 0; L.drillG.connect(L.drillPan);
    const dw = ctx.createOscillator(); dw.type = 'sawtooth'; dw.frequency.value = 196; const dwf = ctx.createBiquadFilter(); dwf.type = 'bandpass'; dwf.frequency.value = 1600; dwf.Q.value = 3; dw.connect(dwf); dwf.connect(L.drillG); dw.start();
    const dl = ctx.createOscillator(); dl.frequency.value = 9; const dlg = ctx.createGain(); dlg.gain.value = 14; dl.connect(dlg); dlg.connect(dw.frequency); dl.start();
    L.drillGrind = loopNoise(2800, 2); L.drillGrind.g.connect(L.drillG); L.drillGrind.g.gain.value = 0.35;
    // sirens: a slow wail and a faster yelp, far away and muffled
    L.sirenLP = ctx.createBiquadFilter(); L.sirenLP.type = 'lowpass'; L.sirenLP.frequency.value = 2500; L.sirenLP.connect(ambBus);
    L.sirenG = ctx.createGain(); L.sirenG.gain.value = 0; L.sirenG.connect(L.sirenLP);
    for (const [base, depth, rate] of [[900, 380, 0.22], [1150, 300, 2.8]]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = base;
      const l = ctx.createOscillator(); l.type = rate > 1 ? 'triangle' : 'sine'; l.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = depth; l.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(L.sirenG); o.start(); l.start();
    }
    // the helicopter: chopped low noise
    L.heli = loopNoise(220, 0.8, 'lowpass', 0.8);
    L.heliAM = ctx.createGain(); L.heliAM.gain.value = 0.5; L.heli.g.connect(L.heliAM); L.heliAM.connect(ambBus);
    const hl = ctx.createOscillator(); hl.type = 'square'; hl.frequency.value = 17; const hlg = ctx.createGain(); hlg.gain.value = 0.5; hl.connect(hlg); hlg.connect(L.heliAM.gain); hl.start();
  },
  /** s: { place:'bank'|'hideout'|'menu', inside, people, drill(dist or -1), drillOn, alarm, sirens 0..1, heli(dist or -1), listener pan helpers } */
  update(dt, s) {
    if (!ctx || !this.loops) return;
    const L = this.loops, t = ctx.currentTime, set = (g, v, k = 0.4) => g.gain.setTargetAtTime(v, t, k);
    const bank = s.place === 'bank';
    set(L.murmur.g, bank && s.inside ? Math.min(0.09, 0.012 * s.people) : 0);
    set(L.traffic.g, bank ? (s.inside ? 0.05 : 0.14) : s.place === 'hideout' ? 0.03 : 0.02);
    ambFilter.frequency.setTargetAtTime(s.inside ? 5000 : 18000, t, 0.3);
    // the drill
    const dd = s.drill;
    set(L.drillG, dd >= 0 && s.drillOn ? 0.5 / (1 + dd / 5) : 0, 0.08);
    if (dd >= 0) L.drillPan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, s.drillPan || 0)), t, 0.1);
    set(L.sirenG, (s.sirens || 0) * (s.inside ? 0.05 : 0.11), 1.2);
    set(L.heli.g, s.heli >= 0 ? Math.min(0.5, 12 / (8 + s.heli)) : 0, 0.8);
    // the bank alarm bell: an electric bell hammering away
    if (s.alarm > 0) {
      this.bellT = Math.max(this.bellT, t);
      while (this.bellT < t + 0.12) { const v = 0.028 * s.alarm * (s.inside ? 1 : 0.4); tone(2350, this.bellT, 0.05, { type: 'triangle', vol: v, out: ambBus }); tone(3480, this.bellT, 0.04, { type: 'sine', vol: v * 0.6, out: ambBus }); noise(this.bellT, 0.01, { f: 5000, q: 3, vol: v * 0.5, out: ambBus }); this.bellT += 0.055; }
    }
    // chatter, cars going by, police radio, the lobby clock
    this.babbleT -= dt;
    if (bank && s.inside && !s.alarm && this.babbleT <= 0 && s.people > 2) { this.babbleT = rnd(0.8, 2.6); const pan = ctx.createStereoPanner(); pan.pan.value = rnd(-0.8, 0.8); const g = ctx.createGain(); g.gain.value = 0.35; g.connect(pan); pan.connect(ambBus); const p = rnd(0.8, 1.3), n = 3 + Math.floor(Math.random() * 5); const vs = 'aeiou'; const pat = []; for (let i = 0; i < n; i++) { const f = rnd(200, 320); pat.push([i * 0.12, f, f * rnd(0.85, 1.15), 0.1, vs[Math.random() * 5 | 0]]); } voiceTo(g, p, pat, 0.05); }
    this.carT -= dt;
    if (bank && this.carT <= 0) { this.carT = rnd(3, 9); const dir = Math.random() < 0.5 ? -1 : 1, pan = ctx.createStereoPanner(); pan.connect(ambBus); pan.pan.setValueAtTime(-dir, t); pan.pan.linearRampToValueAtTime(dir, t + 3); noise(t, 3, { f: 380, q: 0.7, vol: s.inside ? 0.04 : 0.1, out: pan, attack: 1.2, curve: 'lin' }); tone(rnd(70, 100), t, 3, { type: 'sawtooth', vol: s.inside ? 0.008 : 0.02, out: pan, attack: 1.2, curve: 'lin', slide: 0.8 }); if (Math.random() < 0.12) { tone(420, t + 1.4, 0.35, { type: 'square', vol: 0.03, out: pan }); tone(530, t + 1.4, 0.35, { type: 'square', vol: 0.03, out: pan }); } }
    this.radioT -= dt;
    if (bank && (s.sirens || 0) > 0.3 && this.radioT <= 0) { this.radioT = rnd(5, 12); const g = ctx.createGain(); g.gain.value = 1; g.connect(ambBus); noise(t, 0.08, { f: 2000, q: 1, vol: 0.05, out: g }); const pat = []; for (let i = 0; i < 6; i++) pat.push([0.1 + i * 0.1, rnd(160, 240), rnd(160, 240), 0.09, 'aeou'[i % 4]]); voiceTo(g, 0.9, pat, 0.05, true); noise(t + 0.75, 0.12, { f: 2400, q: 1, vol: 0.05, out: g }); }
    this.tickT -= dt;
    if (bank && s.inside && !s.alarm && this.tickT <= 0) { this.tickT = 1; tone(3200, t, 0.01, { type: 'square', vol: 0.006, out: ambBus }); }
  },
};
function voiceTo(out, pitch, pattern, vol, radio = false) {
  const t = now();
  for (const [dt, f0, f1, dur, vowel] of pattern) {
    const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * pitch, t + dt); osc.frequency.exponentialRampToValueAtTime(f1 * pitch, t + dt + dur);
    const formants = { a: [800, 1200], e: [500, 1900], i: [300, 2300], o: [500, 900], u: [350, 700] }[vowel || 'a'];
    env(g, t + dt, vol * 3, 0.015, dur); osc.connect(g);
    for (const ff of formants) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = radio ? 3 : 6; g.connect(bp); bp.connect(out); }
    osc.start(t + dt); osc.stop(t + dt + dur + 0.05);
  }
}

// ------------------------------------------------------------------ sound effects
const STEP_SURF = { marble: [2600, 0.18, 0.05], carpet: [700, 0.07, 0.07], wood: [1300, 0.14, 0.06], steel: [3200, 0.2, 0.04], asphalt: [1500, 0.12, 0.05], concrete: [1700, 0.13, 0.05] };
export const sfx = {
  click() { if (!ctx) return; const t = now(); tone(1800, t, 0.03, { vol: 0.07 }); noise(t, 0.012, { f: 4000, q: 2, vol: 0.05 }); },
  hover() { if (!ctx) return; tone(1400, now(), 0.02, { vol: 0.025 }); },
  nope() { if (!ctx) return; const t = now(); tone(220, t, 0.12, { type: 'square', vol: 0.07 }); tone(180, t + 0.12, 0.2, { type: 'square', vol: 0.07 }); },
  panel(open = true) { if (!ctx) return; noise(now(), 0.18, { f: open ? 900 : 2200, q: 0.8, vol: 0.1, slide: open ? 2.4 : 0.4, attack: 0.03 }); },
  buy() { if (!ctx) return; const t = now(); noise(t, 0.05, { f: 3000, q: 2, vol: 0.2 }); [76, 79, 84, 88].forEach((m, i) => INST.marimba(m, t + 0.05 + i * 0.07, 0.3, 0.4, sfxBus)); },
  coin(n = 1) { if (!ctx) return; const t = now(); for (let i = 0; i < Math.min(n, 14); i++) { tone(midi(88), t + i * 0.07, 0.08, { type: 'square', vol: 0.04 }); tone(midi(95), t + i * 0.07 + 0.05, 0.25, { type: 'square', vol: 0.04, send: 0.2 }); } },
  chat() { if (!ctx) return; tone(1200, now(), 0.05, { vol: 0.05 }); },
  join() { if (!ctx) return; const t = now(); INST.vibes(76, t, 0.2, 0.3, sfxBus); INST.vibes(83, t + 0.08, 0.2, 0.3, sfxBus); },
  step(pos, v = 1, surf = 'marble') {
    if (!ctx) return; const t = now(), o = at(pos, 0.7 * v, 6), [f, vol, d] = STEP_SURF[surf] || STEP_SURF.marble;
    noise(t, d, { f: f * rnd(0.85, 1.15), q: 1.4, vol: vol * v, out: o, send: surf === 'marble' || surf === 'steel' ? 0.2 : 0.05 }); tone(rnd(90, 130), t, 0.05, { vol: 0.08 * v, out: o });
  },
  jump(pos) { if (!ctx) return; noise(now(), 0.1, { f: 1400, q: 1, vol: 0.08, out: at(pos, 0.8), slide: 1.6 }); },
  land(v = 1, pos) { if (!ctx) return; const t = now(), o = at(pos, 1); tone(90, t, 0.14, { vol: 0.25 * v, slide: 0.5, out: o }); noise(t, 0.1, { f: 700, vol: 0.18 * v, out: o }); },
  // the crew's stun blaster: a zappy crack with a short electric tail
  blaster(pos, mine = false) {
    if (!ctx) return; const t = now(), o = at(pos, mine ? 1.1 : 1.3, 12);
    tone(1500, t, 0.09, { type: 'sawtooth', vol: 0.12, slide: 0.18, out: o, send: 0.12 });
    tone(620, t, 0.07, { type: 'square', vol: 0.05, slide: 0.3, out: o });
    noise(t, 0.05, { f: 3500, q: 0.8, vol: 0.28, out: o, send: 0.15 });
    noise(t + 0.02, 0.12, { f: 7000, q: 4, vol: 0.05, out: o, slide: 0.5 });
    tone(80, t, 0.08, { vol: 0.25, slide: 0.5, out: o });
  },
  // the police taser rifles: lower, harder
  copShot(pos) {
    if (!ctx) return; const t = now(), o = at(pos, 1.3, 12);
    noise(t, 0.06, { f: 1800, q: 0.7, vol: 0.34, out: o, send: 0.25 }); tone(900, t, 0.1, { type: 'sawtooth', vol: 0.08, slide: 0.25, out: o }); tone(65, t, 0.1, { vol: 0.28, slide: 0.5, out: o });
  },
  whiz(pos) { if (!ctx) return; const t = now(), o = at(pos, 0.9, 5); noise(t, 0.12, { f: 3000, q: 6, vol: 0.12, out: o, slide: 0.5, attack: 0.03 }); },
  hitmark(head = false) { if (!ctx) return; const t = now(); tone(head ? 2400 : 1700, t, 0.05, { type: 'square', vol: 0.05 }); if (head) tone(3200, t + 0.04, 0.08, { type: 'sine', vol: 0.05 }); },
  zap(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.3, 10); for (let i = 0; i < 6; i++) noise(t + i * 0.03, 0.03, { f: rnd(2000, 6000), q: 3, vol: 0.18, out: o }); tone(120, t, 0.4, { type: 'sawtooth', vol: 0.07, vib: 0.5, vibRate: 40, out: o }); },
  ouch() { if (!ctx) return; voice(null, 1, [[0, 600, 380, 0.13, 'o']], 0.09); noise(now(), 0.06, { f: 900, q: 1, vol: 0.2 }); },
  armor() { if (!ctx) return; const t = now(); tone(1900, t, 0.1, { type: 'triangle', vol: 0.06, slide: 0.7 }); noise(t, 0.05, { f: 5000, q: 3, vol: 0.12 }); },
  armorGone() { if (!ctx) return; const t = now(); for (let i = 0; i < 3; i++) tone(1400 - i * 300, t + i * 0.06, 0.12, { type: 'square', vol: 0.04 }); },
  heartbeat(v = 1) { if (!ctx) return; const t = now(); tone(58, t, 0.16, { vol: 0.5 * v, slide: 0.6 }); tone(52, t + 0.2, 0.2, { vol: 0.38 * v, slide: 0.6 }); },
  reload(pos) { if (!ctx) return; const t = now(), o = at(pos, 0.9, 5); noise(t, 0.04, { f: 2200, q: 3, vol: 0.2, out: o }); noise(t + 0.5, 0.05, { f: 1600, q: 3, vol: 0.2, out: o }); tone(300, t + 0.5, 0.05, { type: 'square', vol: 0.05, out: o }); noise(t + 1.7, 0.04, { f: 3000, q: 3, vol: 0.24, out: o }); tone(900, t + 1.9, 0.12, { type: 'sine', vol: 0.06, slide: 1.5, out: o }); },
  empty() { if (!ctx) return; noise(now(), 0.02, { f: 3000, q: 4, vol: 0.12 }); },
  // "GET DOWN!" — a big googly bark
  shout(pos, id = 1) { if (!ctx) return; const p = 0.85 + ((id * 37) % 10) / 30; voice(pos, p, [[0, 220, 260, 0.16, 'e'], [0.18, 280, 200, 0.32, 'a'], [0.52, 240, 170, 0.28, 'o']], 0.2); },
  scream(pos) { if (!ctx) return; voice(pos, rnd(1.1, 1.4), [[0, 700, 1100, 0.5, 'a'], [0.5, 1000, 700, 0.3, 'i']], 0.1); },
  gasp(pos) { if (!ctx) return; voice(pos, rnd(1, 1.3), [[0, 500, 800, 0.2, 'o']], 0.08); },
  hmm(pos) { if (!ctx) return; voice(pos, 1, [[0, 260, 330, 0.3, 'u']], 0.07); },
  spotted() { if (!ctx) return; const t = now(); tone(880, t, 0.1, { type: 'square', vol: 0.06 }); tone(1320, t + 0.1, 0.25, { type: 'square', vol: 0.06, send: 0.3 }); DRUM.taiko(t, 0.6, sfxBus); },
  sus(k = 0.5) { if (!ctx) return; tone(400 + k * 600, now(), 0.06, { type: 'sine', vol: 0.03 }); },
  alarmStart() { if (!ctx) return; const t = now(); for (let i = 0; i < 4; i++) { tone(660, t + i * 0.4, 0.2, { type: 'square', vol: 0.06, send: 0.3 }); tone(880, t + i * 0.4 + 0.2, 0.2, { type: 'square', vol: 0.06, send: 0.3 }); } DRUM.taiko(t, 1, sfxBus); DRUM.taiko(t + 0.8, 1, sfxBus); },
  mask() { if (!ctx) return; const t = now(); noise(t, 0.25, { f: 700, q: 2, vol: 0.18, slide: 2.5, attack: 0.05 }); tone(180, t + 0.25, 0.08, { vol: 0.2, slide: 0.5 }); noise(t + 0.25, 0.03, { f: 3000, q: 2, vol: 0.2 }); INST.mute(62, t + 0.35, 0.18, 0.3, sfxBus); INST.mute(65, t + 0.55, 0.4, 0.3, sfxBus); },
  cuff(pos) { if (!ctx) return; const t = now(), o = at(pos, 1, 6); for (let i = 0; i < 5; i++) noise(t + i * 0.05, 0.02, { f: 4200, q: 6, vol: 0.2, out: o }); tone(2600, t + 0.3, 0.1, { type: 'triangle', vol: 0.06, out: o }); },
  beep(ok = true) { if (!ctx) return; const t = now(); tone(ok ? 1320 : 440, t, 0.08, { type: 'square', vol: 0.05 }); if (ok) tone(1760, t + 0.09, 0.12, { type: 'square', vol: 0.05 }); },
  pick() { if (!ctx) return; const t = now(); for (let i = 0; i < 2; i++) noise(t + i * rnd(0.05, 0.12), 0.012, { f: rnd(3000, 6000), q: 8, vol: 0.12 }); },
  unlock(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.3, 8); noise(t, 0.05, { f: 1800, q: 3, vol: 0.3, out: o }); tone(160, t, 0.12, { vol: 0.25, slide: 0.6, out: o }); noise(t + 0.2, 0.7, { f: 500, q: 6, vol: 0.06, slide: 1.4, out: o, attack: 0.1 }); },
  work() { if (!ctx) return; const t = now(); noise(t, 0.04, { f: rnd(1500, 3500), q: 3, vol: 0.06 }); },
  drillOn(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.3, 10); tone(90, t, 0.8, { type: 'sawtooth', vol: 0.12, slide: 2.2, out: o }); noise(t, 0.6, { f: 1200, q: 2, vol: 0.12, slide: 2, out: o }); },
  drillJam(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.3, 10); tone(260, t, 0.8, { type: 'sawtooth', vol: 0.14, slide: 0.25, out: o }); noise(t, 0.5, { f: 600, q: 1, vol: 0.2, out: o }); for (let i = 0; i < 3; i++) tone(440, t + 0.8 + i * 0.3, 0.15, { type: 'square', vol: 0.05, out: o }); },
  vaultOpen(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.8, 16); for (let i = 0; i < 6; i++) { tone(70 - i * 4, t + i * 0.35, 0.3, { vol: 0.5, slide: 0.6, out: o, send: 0.5 }); noise(t + i * 0.35, 0.08, { f: 900, q: 2, vol: 0.35, out: o, send: 0.4 }); } noise(t + 2.2, 1.6, { f: 3000, q: 0.5, vol: 0.12, slide: 0.3, out: o, attack: 0.05 }); noise(t + 2.6, 4, { f: 140, q: 8, vol: 0.12, slide: 1.3, out: o, attack: 0.5, send: 0.6 }); [57, 64, 69, 76].forEach((m, i) => INST.brass(m, t + 3 + i * 0.12, i === 3 ? 1 : 0.2, 0.3, sfxBus)); },
  cage(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.5, 14); noise(t, 0.6, { f: 800, q: 3, vol: 0.2, out: o }); for (let i = 0; i < 4; i++) noise(t + 0.6 + i * 0.1, 0.05, { f: 2500, q: 5, vol: 0.2, out: o }); [72, 76, 79, 84].forEach((m, i) => INST.bell(m, t + 0.8 + i * 0.12, 1, 0.25, sfxBus)); },
  zip(pos) { if (!ctx) return; const t = now(), o = at(pos, 1, 6); noise(t, 0.3, { f: 3500, q: 5, vol: 0.14, slide: 1.8, out: o }); },
  bagged(kind) { if (!ctx) return; const t = now(); sfx.zip(null); if (kind === 'gold') { for (let i = 0; i < 4; i++) tone(rnd(2000, 3000), t + 0.1 + i * 0.05, 0.3, { type: 'triangle', vol: 0.05, send: 0.3 }); } else if (kind === 'diamond') [84, 88, 91, 96, 100].forEach((m, i) => INST.bell(m, t + i * 0.08, 1, 0.2, sfxBus)); else for (let i = 0; i < 6; i++) noise(t + 0.1 + i * 0.04, 0.04, { f: 2500, q: 2, vol: 0.12 }); },
  throwBag(pos) { if (!ctx) return; noise(now(), 0.3, { f: 900, q: 1, vol: 0.14, slide: 0.4, out: at(pos, 1), attack: 0.05 }); },
  thud(pos, heavy = false) { if (!ctx) return; const t = now(), o = at(pos, 1.2, 8); tone(heavy ? 60 : 90, t, 0.2, { vol: 0.35, slide: 0.5, out: o }); noise(t, 0.1, { f: 500, q: 1, vol: 0.25, out: o }); if (heavy) for (let i = 0; i < 3; i++) tone(rnd(1800, 2800), t + 0.02 + i * 0.03, 0.2, { type: 'triangle', vol: 0.03, out: o }); },
  secured(big = false) { if (!ctx) return; const t = now(); noise(t, 0.05, { f: 5000, q: 4, vol: 0.18 }); tone(midi(88), t, 0.12, { type: 'square', vol: 0.05 }); tone(midi(95), t + 0.07, 0.45, { type: 'square', vol: 0.05, send: 0.3 }); for (let i = 0; i < (big ? 10 : 5); i++) { tone(rnd(3000, 4200), t + 0.12 + i * 0.045, 0.06, { vol: 0.035 }); } if (big) [67, 71, 74, 79].forEach((m, i) => INST.brass(m, t + 0.3 + i * 0.1, 0.3, 0.3, sfxBus)); },
  cash(n = 1) { if (!ctx) return; const t = now(); for (let i = 0; i < 5; i++) noise(t + i * 0.035, 0.03, { f: rnd(2500, 4000), q: 2, vol: 0.12 }); sfx.coin(Math.min(8, n)); },
  glass(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.2, 10); noise(t, 0.08, { f: 5000, q: 1, vol: 0.3, out: o }); for (let i = 0; i < 5; i++) tone(rnd(3000, 6000), t + i * 0.02, 0.2, { type: 'sine', vol: 0.03, out: o, send: 0.3 }); },
  ricochet(pos) { if (!ctx) return; const t = now(), o = at(pos, 0.8, 8); noise(t, 0.03, { f: 3000, q: 2, vol: 0.14, out: o }); if (Math.random() < 0.3) tone(rnd(2500, 3500), t, 0.25, { type: 'sine', vol: 0.03, slide: 0.7, out: o }); },
  door(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.1, 8); noise(t, 0.6, { f: 400, q: 5, vol: 0.08, slide: 1.6, out: o, attack: 0.1 }); tone(120, t + 0.6, 0.12, { vol: 0.2, slide: 0.6, out: o }); },
  breach(pos) { if (!ctx) return; const t = now(), o = at(pos, 2, 16); tone(55, t, 0.6, { vol: 0.7, slide: 0.5, out: o, send: 0.5 }); noise(t, 0.4, { f: 400, q: 0.6, vol: 0.6, out: o, send: 0.5 }); noise(t + 0.05, 1.2, { f: 2000, q: 0.5, vol: 0.12, slide: 0.3, out: o }); },
  down() { if (!ctx) return; const t = now(); voice(null, 1, [[0, 420, 200, 0.7, 'o']], 0.1); tone(440, t, 1, { type: 'sawtooth', vol: 0.05, slide: 0.25, send: 0.4 }); tone(220, t + 0.1, 1, { type: 'triangle', vol: 0.12, slide: 0.3 }); },
  up() { if (!ctx) return; const t = now(); [60, 64, 67, 72].forEach((m, i) => INST.vibes(m, t + i * 0.08, 1, 0.25, sfxBus)); voice(null, 1, [[0.1, 300, 450, 0.3, 'a']], 0.06); },
  custody() { if (!ctx) return; const t = now(); sfx.cuff(null); [62, 58, 55].forEach((m, i) => INST.mute(m, t + 0.4 + i * 0.3, 0.3, 0.3, sfxBus)); },
  van(pos, leaving = true) { if (!ctx) return; const t = now(), o = at(pos, 1.4, 16); tone(55, t, 2.5, { type: 'sawtooth', vol: 0.08, slide: leaving ? 1.8 : 0.6, out: o, attack: 0.2, curve: 'lin' }); noise(t, 2.5, { f: 300, q: 0.7, vol: 0.14, out: o, attack: 0.3, curve: 'lin' }); if (!leaving) { tone(400, t + 1.6, 0.25, { type: 'square', vol: 0.04, out: o }); tone(500, t + 1.6, 0.25, { type: 'square', vol: 0.04, out: o }); } },
  truck(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.6, 20); tone(45, t, 3, { type: 'sawtooth', vol: 0.1, slide: 0.7, out: o, attack: 0.3, curve: 'lin' }); noise(t + 2.6, 0.8, { f: 3000, q: 0.6, vol: 0.12, slide: 0.4, out: o }); },
  warn() { if (!ctx) return; const t = now(); for (let i = 0; i < 3; i++) { tone(660, t + i * 0.5, 0.25, { type: 'square', vol: 0.06, send: 0.3 }); tone(440, t + i * 0.5 + 0.25, 0.25, { type: 'square', vol: 0.06, send: 0.3 }); } },
  tick(hi = false) { if (!ctx) return; tone(hi ? 1760 : 1320, now(), 0.05, { type: 'square', vol: 0.05 }); },
  wave() { if (!ctx) return; const t = now(); DRUM.taiko(t, 1, sfxBus); DRUM.taiko(t + 0.3, 0.8, sfxBus); DRUM.taiko(t + 0.6, 1, sfxBus); [52, 55, 58].forEach((m, i) => INST.brass(m, t + i * 0.3, 0.25, 0.35, sfxBus)); },
  calm() { if (!ctx) return; const t = now(); [64, 67, 71].forEach((m, i) => INST.vibes(m, t + i * 0.15, 1, 0.25, sfxBus)); },
  win() { if (!ctx) return; const t = now(); [67, 72, 76, 79, 84].forEach((m, i) => INST.brass(m, t + i * 0.12, i === 4 ? 1.2 : 0.2, 0.4, sfxBus)); [0, 0.36, 0.6].forEach(d => DRUM.tim(t + d, 0.9, sfxBus)); for (let i = 0; i < 24; i++) noise(t + 0.8 + Math.random() * 1.4, 0.05, { f: 3000 + Math.random() * 3000, q: 6, vol: 0.08 }); voice(null, 1.1, [[0.6, 400, 650, 0.2, 'a'], [0.82, 650, 800, 0.4, 'i']], 0.09); },
  lose() { if (!ctx) return; const t = now(); [67, 63, 60, 55].forEach((m, i) => INST.horn(m, t + i * 0.25, 0.45 + (i === 3 ? 0.6 : 0), 0.35, sfxBus)); voice(null, 1, [[1, 420, 260, 0.8, 'o']], 0.07); },
  grade(g) { if (!ctx) return; const t = now(); const up = 'FDCBAS'.indexOf(g); for (let i = 0; i <= up; i++) INST.vibes(64 + i * 3, t + i * 0.1, 0.5, 0.3, sfxBus); DRUM.tim(t + up * 0.1 + 0.1, 1, sfxBus); },
  yay(pos, id = 1) { if (!ctx) return; voice(pos, 0.85 + ((id * 37) % 10) / 20, [[0, 400, 600, 0.15, 'a'], [0.17, 600, 750, 0.25, 'i']], 0.09); },
  babble(pos, id = 2, n = 4) { if (!ctx) return; const p = 0.85 + ((id * 37) % 10) / 20, pat = []; const vs = 'aeiou'; for (let i = 0; i < n; i++) { const f = rnd(260, 420); pat.push([i * 0.11, f, f * rnd(0.8, 1.2), 0.09, vs[Math.random() * 5 | 0]]); } voice(pos, p, pat, 0.07); },
};
export function setListener2(x, y, z, yaw) { setListener(x, y, z, yaw); }

// ------------------------------------------------------------------ ?audiotest=1: render every sound offline and measure it
export async function audioTest(onRow) {
  const out = {}, saved = { ctx, master, comp, sfxBus, musicBus, ambBus, ambFilter, verb, verbIn, noiseBuf, song: music.song, gain: music.gain, loops: ambience.loops };
  const wasOn = [musicOn, sfxOn]; musicOn = sfxOn = true;
  const run = async (name, secs, fn) => {
    const oc = new OfflineAudioContext(2, Math.floor(44100 * secs), 44100);
    buildGraph(oc); music.gain = null; ambience.loops = null;
    try { fn(); } catch (e) { out[name] = { err: e.message }; onRow?.(name, out[name]); return; }
    const buf = await oc.startRendering(), d = buf.getChannelData(0);
    let s = 0, pk = 0; for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; pk = Math.max(pk, Math.abs(d[i])); }
    out[name] = { rms: +Math.sqrt(s / d.length).toFixed(4), peak: +pk.toFixed(3) };
    onRow?.(name, out[name]);
  };
  for (const k of Object.keys(sfx)) await run('sfx.' + k, 2.6, () => sfx[k](k === 'step' ? null : undefined));
  for (const n of Object.keys(SONGS)) await run('song.' + n, 8, () => { music.song = n; music.step = 0; music.next = 0; music.gain = ctx.createGain(); music.gain.connect(musicBus); music.fill(7.8); });
  for (const [k, st] of [['lobby', { place: 'bank', inside: true, people: 12, drill: -1, alarm: 0, sirens: 0, heli: -1 }], ['loud', { place: 'bank', inside: true, people: 0, drill: 4, drillOn: true, alarm: 1, sirens: 1, heli: 20 }], ['street', { place: 'bank', inside: false, people: 0, drill: -1, alarm: 0, sirens: 0.5, heli: -1 }]])
    await run('amb.' + k, 5, () => { ambience.start(); for (let i = 0; i < 40; i++) ambience.update(0.1, st); });
  Object.assign(music, { song: saved.song, gain: saved.gain }); ambience.loops = saved.loops;
  ({ ctx, master, comp, sfxBus, musicBus, ambBus, ambFilter, verb, verbIn, noiseBuf } = saved);
  [musicOn, sfxOn] = wasOn;
  return out;
}
