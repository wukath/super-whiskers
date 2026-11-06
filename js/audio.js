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
    honk() { const t = now(); tone('sawtooth', 370, 370, t, 0.18, 0.18); tone('sawtooth', 466, 466, t, 0.18, 0.14); tone('sawtooth', 370, 370, t + 0.22, 0.25, 0.18); tone('sawtooth', 466, 466, t + 0.22, 0.25, 0.14); },
    steam() { noise(now(), 0.3, 0.08, 2500); },
  };

  // ----- background music: a tiny song engine -----
  // A song is 16 bars of 16th-note steps. Chords are [root midi, quality] per bar.
  // Lead notes are [midi, length in steps] (0 = rest). Patterns index steps in a bar.
  const E = 2, Q = 4, H = 8, DQ = 6, WH = 16;
  const ARP = { maj: [0, 4, 7, 12, 7, 4, 0, 7], min: [0, 3, 7, 12, 7, 3, 0, 7], dim: [0, 3, 6, 9, 6, 3, 0, 6], open: [0, 7, 12, 7, 0, 7, 12, 7], dom: [0, 4, 7, 10, 7, 4, 0, 7] };
  const SONGS = {
    meadow: {
      bpm: 152, leadWave: 'square', leadVol: 0.075, arpWave: 'triangle', arpVol: 0.11, bassWave: 'triangle', bassVol: 0.25,
      chords: [[60, 'maj'], [55, 'maj'], [57, 'min'], [53, 'maj'], [60, 'maj'], [55, 'maj'], [53, 'maj'], [60, 'maj'], [60, 'maj'], [55, 'maj'], [57, 'min'], [53, 'maj'], [60, 'maj'], [55, 'maj'], [53, 'maj'], [60, 'maj']],
      lead: [
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
      ],
      arpSteps: 2, bass: { 0: 0, 4: 0, 6: 7, 8: 0, 12: 7, 14: 12 }, bassLen: 3.2,
      drums: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatOpen: [3, 7, 11, 15] },
    },
    caves: {
      bpm: 104, leadWave: 'triangle', leadVol: 0.16, echo: 0.4, arpWave: 'triangle', arpVol: 0.07, bassWave: 'sine', bassVol: 0.3,
      chords: [[57, 'min'], [57, 'min'], [53, 'maj'], [55, 'maj'], [57, 'min'], [52, 'min'], [53, 'maj'], [52, 'maj'], [57, 'min'], [57, 'min'], [53, 'maj'], [55, 'maj'], [57, 'min'], [53, 'maj'], [52, 'maj'], [57, 'min']],
      lead: [
        [69, Q], [72, Q], [76, H],
        [74, Q], [72, Q], [71, H],
        [69, Q], [65, Q], [69, Q], [72, Q],
        [71, H], [67, H],
        [76, Q], [74, E], [72, E], [71, H],
        [67, Q], [71, Q], [76, H],
        [77, Q], [76, Q], [72, Q], [69, Q],
        [68, H], [64, H],
        [69, Q], [72, Q], [76, Q], [81, Q],
        [79, Q], [76, Q], [74, H],
        [72, Q], [69, Q], [65, Q], [69, Q],
        [71, DQ], [74, E], [79, H],
        [81, Q], [79, E], [76, E], [74, H],
        [72, Q], [69, Q], [72, Q], [77, Q],
        [76, H], [68, H],
        [69, WH],
      ],
      arpSteps: 2, arpPattern: 'open', bass: { 0: 0, 8: 0, 12: -5 }, bassLen: 7,
      drums: { kick: [0], snare: [8], hat: [4, 12], hatOpen: [] }, hatVol: 0.03,
    },
    shore: {
      bpm: 126, leadWave: 'sine', leadVol: 0.22, leadDecay: 0.5, arpWave: 'triangle', arpVol: 0.1, bassWave: 'triangle', bassVol: 0.24,
      chords: [[65, 'maj'], [67, 'min'], [60, 'dom'], [65, 'maj'], [70, 'maj'], [69, 'min'], [67, 'min'], [60, 'dom'], [65, 'maj'], [67, 'min'], [60, 'dom'], [65, 'maj'], [70, 'maj'], [69, 'min'], [67, 'min'], [65, 'maj']],
      lead: [
        [69, E], [72, E], [77, 3], [76, 1], [72, Q], [0, Q],
        [70, E], [74, E], [77, 3], [74, 1], [70, Q], [0, Q],
        [76, E], [79, E], [82, 3], [79, 1], [76, Q], [0, Q],
        [77, 3], [76, 1], [74, Q], [72, Q], [0, Q],
        [74, E], [77, E], [82, 3], [81, 1], [77, Q], [0, Q],
        [76, E], [79, E], [84, 3], [81, 1], [76, Q], [0, Q],
        [74, 3], [72, 1], [70, Q], [69, Q], [67, Q],
        [64, Q], [67, Q], [72, H],
        [69, E], [72, E], [77, 3], [76, 1], [72, Q], [0, Q],
        [70, E], [74, E], [77, 3], [74, 1], [70, Q], [0, Q],
        [76, E], [79, E], [82, 3], [79, 1], [76, Q], [0, Q],
        [77, 3], [76, 1], [74, Q], [72, Q], [0, Q],
        [82, 3], [81, 1], [77, Q], [74, Q], [0, Q],
        [81, 3], [79, 1], [76, Q], [72, Q], [0, Q],
        [74, Q], [72, Q], [70, Q], [67, Q],
        [69, H], [77, H],
      ],
      arpSteps: 2, bass: { 0: 0, 3: 0, 6: 7, 8: 0, 11: 0, 14: 7 }, bassLen: 2.5,
      drums: { kick: [0, 6, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatOpen: [] }, hatVol: 0.09, shaker: true,
    },
    mansion: {
      bpm: 92, leadWave: 'sawtooth', leadVol: 0.06, echo: 0.3, arpWave: 'sawtooth', arpVol: 0.035, bassWave: 'square', bassVol: 0.09,
      chords: [[62, 'min'], [63, 'maj'], [62, 'min'], [57, 'maj'], [62, 'min'], [58, 'maj'], [55, 'min'], [61, 'dim'], [62, 'min'], [63, 'maj'], [62, 'min'], [57, 'maj'], [62, 'min'], [58, 'maj'], [61, 'dim'], [62, 'min']],
      lead: [
        [74, Q], [77, Q], [76, Q], [74, Q],
        [75, 12], [74, Q],
        [69, Q], [74, Q], [77, Q], [81, Q],
        [80, H], [76, H],
        [74, E], [77, E], [81, E], [77, E], [74, Q], [73, Q],
        [70, Q], [74, Q], [77, H],
        [79, Q], [77, Q], [75, Q], [74, Q],
        [73, H], [76, Q], [79, Q],
        [86, Q], [89, Q], [88, Q], [86, Q],
        [87, 12], [86, Q],
        [81, Q], [86, Q], [89, Q], [93, Q],
        [92, H], [88, H],
        [86, E], [89, E], [93, E], [89, E], [86, Q], [85, Q],
        [82, Q], [86, Q], [89, H],
        [85, Q], [88, Q], [91, Q], [94, Q],
        [86, WH],
      ],
      arpSteps: 4, bass: { 0: 0, 2: 12, 4: 0, 6: 12, 8: 0, 10: 12, 12: 0, 14: 12 }, bassLen: 1.6,
      drums: { kick: [0, 8], snare: [], hat: [], hatOpen: [] }, tom: [14, 15], bell: [0],
    },
    midtown: {
      bpm: 138, leadWave: 'square', leadVol: 0.06, arpWave: 'triangle', arpVol: 0.09, bassWave: 'triangle', bassVol: 0.3,
      chords: [[60, 'maj'], [57, 'dom'], [62, 'min'], [55, 'dom'], [64, 'min'], [57, 'dom'], [62, 'min'], [55, 'dom'], [60, 'maj'], [60, 'dom'], [65, 'maj'], [66, 'dim'], [60, 'maj'], [57, 'dom'], [62, 'min'], [55, 'dom']],
      lead: [
        [76, 3], [79, 1], [81, Q], [79, E], [76, E], [0, Q],
        [73, 3], [76, 1], [79, Q], [76, E], [73, E], [0, Q],
        [74, 3], [77, 1], [81, Q], [77, E], [74, E], [0, Q],
        [71, 3], [74, 1], [77, Q], [79, E], [77, E], [74, E], [71, E],
        [76, 3], [79, 1], [83, Q], [79, E], [76, E], [0, Q],
        [73, 3], [76, 1], [79, Q], [81, E], [79, E], [76, E], [73, E],
        [74, 3], [77, 1], [81, 3], [77, 1], [74, Q], [72, Q],
        [71, Q], [74, Q], [77, Q], [79, Q],
        [84, 3], [83, 1], [81, 3], [79, 1], [76, Q], [0, Q],
        [82, 3], [81, 1], [79, 3], [76, 1], [72, Q], [0, Q],
        [81, 3], [84, 1], [81, 3], [77, 1], [74, Q], [0, Q],
        [78, 3], [81, 1], [84, 3], [81, 1], [78, Q], [75, Q],
        [76, 3], [79, 1], [81, Q], [79, E], [76, E], [0, Q],
        [73, 3], [76, 1], [79, Q], [76, E], [73, E], [0, Q],
        [74, Q], [77, Q], [81, Q], [86, Q],
        [84, H], [79, Q], [0, Q],
      ],
      arpSteps: 4, bass: { 0: 0, 4: 4, 8: 7, 12: 9 }, bassLen: 3.6,
      drums: { kick: [0, 8], snare: [4, 12], hat: [0, 3, 4, 6, 8, 11, 12, 14], hatOpen: [] }, hatVol: 0.06,
    },
    boss: {
      bpm: 172, leadWave: 'square', leadVol: 0.08, arpWave: 'sawtooth', arpVol: 0.05, bassWave: 'square', bassVol: 0.11,
      chords: [[64, 'min'], [64, 'min'], [60, 'maj'], [62, 'maj'], [64, 'min'], [64, 'min'], [60, 'maj'], [59, 'maj'], [64, 'min'], [64, 'min'], [60, 'maj'], [62, 'maj'], [64, 'min'], [67, 'maj'], [59, 'maj'], [64, 'min']],
      lead: [
        [76, E], [76, E], [79, E], [76, E], [83, E], [81, E], [79, E], [78, E],
        [76, E], [76, E], [79, E], [76, E], [74, E], [76, E], [79, Q],
        [72, E], [72, E], [76, E], [72, E], [79, E], [76, E], [72, E], [79, E],
        [74, E], [74, E], [78, E], [74, E], [81, E], [78, E], [74, E], [81, E],
        [76, E], [76, E], [79, E], [76, E], [83, E], [81, E], [79, E], [78, E],
        [76, E], [83, E], [76, E], [84, E], [76, E], [86, E], [88, Q],
        [84, E], [84, E], [79, E], [84, E], [88, E], [84, E], [79, E], [76, E],
        [83, E], [83, E], [78, E], [83, E], [87, Q], [83, Q],
        [76, E], [76, E], [79, E], [76, E], [83, E], [81, E], [79, E], [78, E],
        [76, E], [76, E], [79, E], [76, E], [74, E], [76, E], [79, Q],
        [72, E], [72, E], [76, E], [72, E], [79, E], [76, E], [72, E], [79, E],
        [74, E], [74, E], [78, E], [74, E], [81, E], [78, E], [74, E], [81, E],
        [88, E], [86, E], [84, E], [83, E], [81, E], [79, E], [78, E], [76, E],
        [79, E], [79, E], [83, E], [79, E], [86, E], [83, E], [79, E], [86, E],
        [83, Q], [87, Q], [90, Q], [87, Q],
        [88, H], [76, Q], [0, Q],
      ],
      arpSteps: 1, arpPattern: 'drive', bass: { 0: 0, 2: 0, 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 14: 0 }, bassLen: 1.6,
      drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hatOpen: [14] }, hatVol: 0.05,
    },
  };
  ARP.drive = [0, 0, 7, 0, 12, 0, 7, 0];
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const music = { on: false, timer: null, step: 0, nextTime: 0, leadIdx: 0, leadLeft: 0, rate: 1, song: 'meadow' };
  const STEPS = 16 * 16;
  function playStep(S, step, t, dt) {
    const bar = Math.floor(step / 16) % 16, inBar = step % 16;
    const [root, qual] = S.chords[bar];
    if (music.leadLeft <= 0) {
      const [m, len] = S.lead[music.leadIdx % S.lead.length];
      music.leadIdx++; music.leadLeft = len;
      if (m) {
        const dur = dt * len * (S.leadDecay || 0.85);
        tone(S.leadWave, midi(m), midi(m), t, dur, S.leadVol, 'exp', musicGain);
        if (S.echo) tone(S.leadWave, midi(m), midi(m), t + dt * 3, dur * 0.8, S.leadVol * S.echo, 'exp', musicGain);
      }
    }
    music.leadLeft--;
    if (inBar % S.arpSteps === 0) {
      const iv = S.arpPattern ? ARP[S.arpPattern] : (ARP[qual] || ARP.maj);
      const m = root + iv[(inBar / S.arpSteps) % iv.length | 0];
      tone(S.arpWave, midi(m), midi(m), t, dt * S.arpSteps * 0.8, S.arpVol, 'exp', musicGain);
    }
    if (S.bass[inBar] !== undefined) { const m = root - 12 + S.bass[inBar]; tone(S.bassWave, midi(m), midi(m), t, dt * S.bassLen, S.bassVol, 'exp', musicGain); }
    const D = S.drums, hv = S.hatVol == null ? 0.07 : S.hatVol;
    if (D.kick.includes(inBar)) tone('sine', 150, 45, t, 0.1, 0.5, 'exp', musicGain);
    if (D.snare.includes(inBar)) noise(t, 0.12, 0.25, 1200, musicGain);
    if (D.hat.includes(inBar)) noise(t, S.shaker ? 0.05 : 0.03, hv, S.shaker ? 4000 : 6000, musicGain);
    if (D.hatOpen.includes(inBar)) noise(t, 0.08, hv * 0.8, 5000, musicGain);
    if (S.tom && S.tom.includes(inBar)) tone('sine', 110, 60, t, 0.25, 0.45, 'exp', musicGain);
    if (S.bell && S.bell.includes(inBar) && bar % 4 === 0) { tone('sine', midi(root + 24), midi(root + 24), t, 1.6, 0.12, 'exp', musicGain); tone('sine', midi(root + 24) * 2.76, midi(root + 24) * 2.76, t, 0.9, 0.04, 'exp', musicGain); }
  }
  function tick() {
    if (!music.on || !ctx) return;
    const S = SONGS[music.song] || SONGS.meadow;
    const dt = (60 / S.bpm / 4) / music.rate;
    while (music.nextTime < ctx.currentTime + 0.25) {
      playStep(S, music.step, music.nextTime, dt);
      music.step = (music.step + 1) % STEPS;
      if (music.step === 0) { music.leadIdx = 0; music.leadLeft = 0; }
      music.nextTime += dt;
    }
  }
  const MUSIC = {
    start(song) {
      if (song && song !== music.song) { music.song = song; if (music.on) { music.step = 0; music.leadIdx = 0; music.leadLeft = 0; music.nextTime = ctx.currentTime + 0.05; return; } }
      if (!ctx || music.on) return;
      music.on = true; music.step = 0; music.leadIdx = 0; music.leadLeft = 0; music.nextTime = ctx.currentTime + 0.05;
      music.timer = setInterval(tick, 80);
    },
    stop() { music.on = false; if (music.timer) clearInterval(music.timer); music.timer = null; },
    setRate(r) { music.rate = r; },
    duck(on) { if (musicGain) musicGain.gain.setTargetAtTime(on ? 0.35 : 1, ctx.currentTime, 0.05); },
    song: () => music.song,
    songs: Object.keys(SONGS),
  };
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.35;
    return muted;
  }

  // Let a host forward every effect it plays to connected guests.
  const hooks = { onSfx: null, suppress: false };
  for (const k of Object.keys(SFX)) { const orig = SFX[k]; SFX[k] = () => { if (hooks.suppress) return; orig(); if (hooks.onSfx) hooks.onSfx(k); }; }

  window.AUDIO = { ensure, SFX, MUSIC, toggleMute, isMuted: () => muted, hooks };
})();
