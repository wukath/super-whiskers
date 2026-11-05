// Chiptune sound effects and a four-track looping tune, all synthesized with
// Web Audio so the game needs no asset files.
(function () {
  let ctx = null, master = null, musicGain = null, muted = false;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 1; musicGain.connect(master);
  }
  function tone(type, f0, f1, t0, dur, vol = 0.5, slide = 'exp', dest) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) { if (slide === 'exp') o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); else o.frequency.linearRampToValueAtTime(f1, t0 + dur); }
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(t0, dur, vol = 0.3, hp = 800, dest) {
    if (!ctx) return;
    if (!noiseBuf) { const n = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || master); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  const now = () => ctx ? ctx.currentTime : 0;

  const SFX = {
    jump() { tone('square', 300, 700, now(), 0.18, 0.25); },
    walljump() { const t = now(); tone('square', 500, 900, t, 0.12, 0.22); noise(t, 0.05, 0.1, 3000); },
    coin() { const t = now(); tone('square', 988, 988, t, 0.08, 0.25); tone('square', 1319, 1319, t + 0.08, 0.3, 0.25); },
    stomp() { const t = now(); tone('square', 400, 120, t, 0.12, 0.3); noise(t, 0.08, 0.15, 2000); },
    kick() { const t = now(); tone('square', 600, 200, t, 0.1, 0.3); },
    bump() { const t = now(); tone('triangle', 200, 90, t, 0.1, 0.5); },
    brick() { const t = now(); noise(t, 0.2, 0.35, 400); tone('square', 300, 80, t, 0.15, 0.2); },
    rock() { const t = now(); noise(t, 0.3, 0.45, 200); tone('square', 160, 50, t, 0.25, 0.3); },
    powerup() { const t = now(); [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('square', f, f, t + i * 0.06, 0.12, 0.2)); },
    appear() { const t = now(); [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, t + i * 0.05, 0.1, 0.3)); },
    hurt() { const t = now(); [660, 520, 400, 300].forEach((f, i) => tone('square', f, f * 0.9, t + i * 0.08, 0.1, 0.25)); },
    yarn() { tone('square', 900, 300, now(), 0.1, 0.2); },
    dash() { const t = now(); noise(t, 0.15, 0.2, 1500); tone('sawtooth', 200, 600, t, 0.12, 0.12); },
    poundStart() { tone('square', 700, 1100, now(), 0.1, 0.15); },
    pound() { const t = now(); tone('square', 150, 40, t, 0.25, 0.4); noise(t, 0.2, 0.4, 300); },
    boing() { const t = now(); tone('square', 200, 900, t, 0.25, 0.25, 'exp'); tone('triangle', 150, 700, t + 0.03, 0.25, 0.25); },
    pipe() { const t = now(); for (let i = 0; i < 6; i++) tone('square', 400 - i * 40, 380 - i * 40, t + i * 0.07, 0.07, 0.2); },
    die() { const t = now(); tone('square', 500, 900, t, 0.3, 0.25); [600, 500, 400, 300, 220, 160].forEach((f, i) => tone('square', f, f * 0.92, t + 0.4 + i * 0.12, 0.14, 0.25)); },
    oneup() { const t = now(); [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone('square', f, f, t + i * 0.08, 0.12, 0.2)); },
    flag() { const t = now(); for (let i = 0; i < 14; i++) tone('square', 400 + i * 90, 400 + i * 90, t + i * 0.05, 0.08, 0.2); },
    clear() { const t = now(); [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone('square', f, f, t + i * 0.13, 0.2, 0.25)); },
    splash() { const t = now(); noise(t, 0.25, 0.25, 1200); tone('sine', 300, 120, t, 0.2, 0.2); },
    timewarn() { const t = now(); [880, 660, 880, 660].forEach((f, i) => tone('square', f, f, t + i * 0.1, 0.1, 0.2)); },
  };

  // ----- background tune -----
  // One step = a 16th note. Lead and bass are lists of [midi, steps]; 0 = rest.
  // Chords drive the arpeggio: [root midi, major?] per bar.
  const CHORDS = [[60, 1], [55, 1], [57, 0], [53, 1], [60, 1], [55, 1], [53, 1], [60, 1], [60, 1], [55, 1], [57, 0], [53, 1], [60, 1], [55, 1], [53, 1], [60, 1]];
  const E = 2, Q = 4, H = 8;
  const LEAD = [
    [76, E], [79, E], [76, E], [72, E], [74, E], [76, E], [0, E], [67, E],
    [74, E], [77, E], [74, E], [71, E], [72, E], [74, E], [0, E], [67, E],
    [72, E], [76, E], [72, E], [69, E], [71, E], [72, E], [0, E], [64, E],
    [69, E], [72, E], [69, E], [65, E], [67, E], [69, E], [71, E], [72, E],
    [76, E], [79, E], [84, Q], [79, E], [76, E], [79, Q],
    [74, E], [79, E], [83, Q], [79, E], [74, E], [79, Q],
    [77, E], [81, E], [77, E], [74, E], [79, E], [83, E], [79, E], [74, E],
    [84, Q], [79, Q], [76, Q], [72, Q],
    [76, E], [79, E], [76, E], [72, E], [74, E], [76, E], [0, E], [67, E],
    [74, E], [77, E], [74, E], [71, E], [72, E], [74, E], [0, E], [67, E],
    [72, E], [76, E], [72, E], [69, E], [71, E], [72, E], [0, E], [64, E],
    [69, E], [72, E], [69, E], [65, E], [67, E], [69, E], [71, E], [72, E],
    [76, E], [79, E], [84, Q], [79, E], [76, E], [79, Q],
    [74, E], [79, E], [83, Q], [79, E], [74, E], [79, Q],
    [81, Q], [79, Q], [77, Q], [74, Q],
    [72, Q], [0, Q], [76, E], [79, E], [84, Q],
  ];
  const BPM = 152;
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const music = { on: false, timer: null, step: 0, nextTime: 0, leadIdx: 0, leadLeft: 0, rate: 1 };
  const STEPS = 16 * 16;
  function playStep(step, t, dt) {
    const bar = Math.floor(step / 16) % 16, inBar = step % 16;
    const [root, maj] = CHORDS[bar];
    // lead
    if (music.leadLeft <= 0) {
      const [m, len] = LEAD[music.leadIdx % LEAD.length];
      music.leadIdx++; music.leadLeft = len;
      if (m) tone('square', midi(m), midi(m), t, dt * len * 0.85, 0.075, 'exp', musicGain);
    }
    music.leadLeft--;
    // arpeggio on 8ths
    if (inBar % 2 === 0) {
      const iv = maj ? [0, 4, 7, 12, 7, 4, 0, 7] : [0, 3, 7, 12, 7, 3, 0, 7];
      const m = root + iv[(inBar / 2) | 0];
      tone('triangle', midi(m), midi(m), t, dt * 1.6, 0.11, 'exp', musicGain);
    }
    // bass
    const bassPat = [0, null, null, null, 0, null, 7, null, 0, null, null, null, 7, null, 12, null];
    const b = bassPat[inBar];
    if (b !== null) { const m = root - 12 + b; tone('triangle', midi(m), midi(m), t, dt * 3.2, 0.25, 'exp', musicGain); }
    // drums
    if (inBar === 0 || inBar === 8 || inBar === 10) tone('sine', 150, 45, t, 0.1, 0.5, 'exp', musicGain);
    if (inBar === 4 || inBar === 12) noise(t, 0.12, 0.25, 1200, musicGain);
    if (inBar % 2 === 0) noise(t, 0.03, 0.07, 6000, musicGain);
    else if (inBar % 4 === 3) noise(t, 0.05, 0.05, 5000, musicGain);
  }
  function tick() {
    if (!music.on || !ctx) return;
    const dt = (60 / BPM / 4) / music.rate;
    while (music.nextTime < ctx.currentTime + 0.25) {
      playStep(music.step, music.nextTime, dt);
      music.step = (music.step + 1) % STEPS;
      if (music.step === 0) { music.leadIdx = 0; music.leadLeft = 0; }
      music.nextTime += dt;
    }
  }
  const MUSIC = {
    start() {
      if (!ctx || music.on) return;
      music.on = true; music.step = 0; music.leadIdx = 0; music.leadLeft = 0; music.nextTime = ctx.currentTime + 0.05;
      music.timer = setInterval(tick, 80);
    },
    stop() { music.on = false; if (music.timer) clearInterval(music.timer); music.timer = null; },
    setRate(r) { music.rate = r; },
    duck(on) { if (musicGain) musicGain.gain.setTargetAtTime(on ? 0.35 : 1, ctx.currentTime, 0.05); },
  };
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.35;
    return muted;
  }

  // Let a host forward every effect it plays to connected guests.
  const hooks = { onSfx: null };
  for (const k of Object.keys(SFX)) { const orig = SFX[k]; SFX[k] = () => { orig(); if (hooks.onSfx) hooks.onSfx(k); }; }

  window.AUDIO = { ensure, SFX, MUSIC, toggleMute, isMuted: () => muted, hooks };
})();
