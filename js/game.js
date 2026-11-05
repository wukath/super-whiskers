// Main loop, camera, world rendering, HUD, game states and online co-op.
// In online games the host runs the simulation and streams snapshots;
// guests send inputs and render interpolated snapshots.
(function () {
  const { T, GROUND_OVER } = TILES;
  const VW = 640, VH = 360;
  const E = ENT;
  const SNAP_EVERY = 2;        // host frames between snapshots (30 Hz)
  const FRAME_MS = 1000 / 60;
  const MIN_DELAY = 60, MAX_DELAY = 220;   // ms guests render behind the host, adapted to jitter
  const QUEUE_TARGET = 2, QUEUE_MAX = 10;  // host-side input jitter buffer (frames)

  const newInput = () => ({ left: false, right: false, down: false, run: false, jumpHeld: false, jumpPressed: false, firePressed: false, downPressed: false, dashPressed: false, start: false, counts: [0, 0, 0, 0, 0] });
  // Sounds the guest already played while predicting its own cat.
  const LOCAL_SFX = new Set(['jump', 'walljump', 'dash', 'poundStart', 'pound', 'boing', 'splash', 'yarn']);
  const heldBits = i => (i.left ? 1 : 0) | (i.right ? 2 : 0) | (i.down ? 4 : 0) | (i.run ? 8 : 0) | (i.jumpHeld ? 16 : 0);
  const pressedBits = i => (i.jumpPressed ? 1 : 0) | (i.firePressed ? 2 : 0) | (i.downPressed ? 4 : 0) | (i.dashPressed ? 8 : 0) | (i.start ? 16 : 0);
  function applyBits(i, h, p) {
    i.left = !!(h & 1); i.right = !!(h & 2); i.down = !!(h & 4); i.run = !!(h & 8); i.jumpHeld = !!(h & 16);
    i.jumpPressed = !!(p & 1); i.firePressed = !!(p & 2); i.downPressed = !!(p & 4); i.dashPressed = !!(p & 8); i.start = !!(p & 16);
  }

  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
      this.painter = new PX.Painter(this.ctx);
      this.input = newInput();
      this.state = 'title'; this.lives = 3; this.scoreVal = 0; this.coins = 0; this.frame = 0; this.stage = 0;
      this.cam = { x: 0, y: 0 }; this.shakeT = 0; this.shakeMag = 0; this.helpOpen = false;
      this.mode = 'solo'; this.net = new NET.Net(this); this.myId = 1; this.nextId = 2; this.nid = 1;
      this.slots = [{ id: 1, cat: 0, input: this.input, local: true }];
      this.fxQueue = []; this.sfxQueue = []; this.snaps = []; this.ghosts = new Map(); this.fxLocal = []; this.joinCode = ''; this.netMsg = '';
      this.players = []; this.seq = 0; this.pending = []; this.me = null; this.curPid = 0;
      AUDIO.hooks.onSfx = k => { if (this.mode === 'host') this.sfxQueue.push([k, this.curPid]); };
      this.bindInput();
      this.loadLevel();
      this.resize(); window.addEventListener('resize', () => this.resize());
      this.last = performance.now(); this.acc = 0;
      const room = new URLSearchParams(location.search).get('room');
      if (room) { this.joinCode = room.toUpperCase().slice(0, 4); this.state = 'join'; }
      requestAnimationFrame(t => this.loop(t));
    }
    resize() {
      const s = Math.max(1, Math.floor(Math.min(window.innerWidth / VW, window.innerHeight / VH)));
      this.canvas.style.width = VW * s + 'px'; this.canvas.style.height = VH * s + 'px';
    }
    get player() { return this.players.find(p => p.id === this.myId) || this.players[0]; }
    get isGuest() { return this.mode === 'guest'; }

    // ----- input -----
    bindInput() {
      const map = (code) => {
        switch (code) {
          case 'ArrowLeft': case 'KeyA': return 'left';
          case 'ArrowRight': case 'KeyD': return 'right';
          case 'ArrowDown': case 'KeyS': return 'down';
          case 'ArrowUp': case 'KeyW': case 'Space': case 'KeyZ': case 'KeyK': return 'jump';
          case 'ShiftLeft': case 'ShiftRight': case 'KeyX': case 'KeyJ': return 'run';
          case 'KeyC': case 'KeyL': return 'dash';
          case 'Enter': return 'start';
          case 'Digit1': case 'Digit2': case 'Digit3': return 'lvl' + code[5];
          case 'KeyP': return 'pause';
          case 'KeyH': case 'Slash': case 'F1': return 'help';
          case 'KeyM': return 'mute';
          case 'KeyO': return 'hostgame';
          case 'Escape': return 'esc';
        }
        return null;
      };
      window.addEventListener('keydown', e => {
        AUDIO.ensure();
        if (this.state === 'join') { this.joinTyping(e); e.preventDefault(); return; }
        let k = map(e.code); if (!k) return; e.preventDefault();
        if (e.repeat) return;
        if (this.state === 'title' && e.code === 'KeyJ') k = 'joingame';
        const inp = this.input;
        if (k === 'jump') { inp.jumpPressed = true; inp.jumpHeld = true; inp.counts[0]++; }
        else if (k === 'run') { inp.run = true; inp.firePressed = true; inp.counts[1]++; }
        else if (k === 'down') { inp.down = true; inp.downPressed = true; inp.counts[2]++; }
        else if (k === 'dash') { inp.dashPressed = true; inp.counts[3]++; }
        else if (k === 'start') { inp.start = true; inp.counts[4]++; }
        else if (k.startsWith('lvl')) { if (this.state === 'title') this.startGame(+k[3] - 1); }
        else if (k === 'pause') this.togglePause();
        else if (k === 'help') this.toggleHelp();
        else if (k === 'mute') AUDIO.toggleMute();
        else if (k === 'hostgame') { if (this.state === 'title') this.hostGame(); }
        else if (k === 'joingame') { if (this.state === 'title') { this.joinCode = ''; this.netMsg = ''; this.state = 'join'; } }
        else if (k === 'esc') this.leaveOnline();
        else inp[k] = true;
        if (this.state === 'lobby' && (k === 'left' || k === 'right')) this.cycleCat(k === 'left' ? -1 : 1);
      });
      window.addEventListener('keyup', e => {
        const k = map(e.code); if (!k) return;
        if (k === 'jump') this.input.jumpHeld = false;
        else if (k === 'run') this.input.run = false;
        else if (k === 'left' || k === 'right' || k === 'down') this.input[k] = false;
      });
      window.addEventListener('blur', () => { const i = this.input; i.left = i.right = i.down = i.run = i.jumpHeld = false; });
    }
    joinTyping(e) {
      if (e.code === 'Escape') { this.state = 'title'; return; }
      if (e.code === 'Backspace') { this.joinCode = this.joinCode.slice(0, -1); return; }
      if (e.code === 'Enter') { if (this.joinCode.length === 4) this.joinGame(this.joinCode); return; }
      if (/^Key[A-Z]$/.test(e.code) && this.joinCode.length < 4) this.joinCode += e.code[3];
    }
    togglePause() {
      if (this.isGuest) return;
      if (this.state === 'play') { this.state = 'pause'; AUDIO.MUSIC.stop(); }
      else if (this.state === 'pause') { this.state = 'play'; this.helpOpen = false; AUDIO.MUSIC.start(); }
    }
    toggleHelp() {
      if (this.state === 'title' || this.state === 'intro' || this.state === 'join' || this.state === 'lobby' || this.state === 'connecting') return;
      this.helpOpen = !this.helpOpen;
      if (!this.isGuest) { if (this.helpOpen && this.state === 'play') { this.state = 'pause'; AUDIO.MUSIC.stop(); } else if (!this.helpOpen && this.state === 'pause') { this.state = 'play'; AUDIO.MUSIC.start(); } }
    }

    // ----- online: lobby -----
    hostGame() {
      if (!this.net.available) { this.netMsg = 'ONLINE PLAY UNAVAILABLE'; return; }
      this.mode = 'host'; this.state = 'lobby'; this.netMsg = 'CREATING ROOM...';
      this.slots = [{ id: 1, cat: 0, input: this.input, local: true }]; this.myId = 1; this.nextId = 2;
      this.net.host(code => { this.netMsg = ''; this.roomUrl = location.origin + location.pathname + '?room=' + code; });
    }
    joinGame(code) {
      if (!this.net.available) { this.netMsg = 'ONLINE PLAY UNAVAILABLE'; this.state = 'title'; return; }
      this.mode = 'guest'; this.state = 'connecting'; this.netMsg = 'CONNECTING TO ' + code + '...';
      this.net.join(code, () => { this.net.send({ t: 'J', cat: 1 }); });
    }
    leaveOnline() {
      if (this.mode === 'solo') return;
      if (this.mode === 'host') this.net.broadcast({ t: 'K', why: 'HOST LEFT' });
      this.net.close(); this.mode = 'solo'; this.slots = [{ id: 1, cat: 0, input: this.input, local: true }]; this.myId = 1;
      this.ghosts.clear(); this.snaps = []; this.fxLocal = []; this.netMsg = ''; this.helpOpen = false;
      AUDIO.MUSIC.stop(); this.state = 'title'; this.loadLevel();
      history.replaceState(null, '', location.pathname);
    }
    cycleCat(d) {
      if (this.mode === 'guest') { this.lobbyCat = ((this.lobbyCat == null ? 1 : this.lobbyCat) + d + 4) % 4; this.net.send({ t: 'C', cat: this.lobbyCat }); return; }
      const slot = this.slots.find(s => s.id === this.myId);
      if (slot) { slot.cat = (slot.cat + d + 4) % 4; this.sendLobby(); }
    }
    sendLobby() { this.net.broadcast({ t: 'LB', slots: this.slots.map(s => ({ id: s.id, cat: s.cat })) }); }
    onGuestMessage(conn, d) {
      if (d.t === 'J') {
        if (this.state !== 'lobby' || this.slots.length >= 4) { conn.send({ t: 'K', why: this.state !== 'lobby' ? 'GAME IN PROGRESS' : 'ROOM FULL' }); return; }
        const used = this.slots.map(s => s.cat); let cat = d.cat; while (used.includes(cat)) cat = (cat + 1) % 4;
        const slot = { id: this.nextId++, cat, input: newInput(), conn, lastSeen: this.frame, queue: [], lastSeq: 0, lastQueued: 0, buffering: true };
        this.slots.push(slot); conn.send({ t: 'W', id: slot.id }); this.sendLobby(); AUDIO.SFX.appear();
      } else if (d.t === 'C') {
        const slot = this.slots.find(s => s.conn === conn); if (slot && this.state === 'lobby') { slot.cat = ((d.cat % 4) + 4) % 4; this.sendLobby(); }
      } else if (d.t === 'I') {
        const slot = this.slots.find(s => s.conn === conn); if (!slot) return;
        slot.lastSeen = this.frame;
        for (const r of d.q) if (r.s > (slot.lastQueued || 0)) { slot.queue.push(r); slot.lastQueued = r.s; }
        if (d.rtt != null) { const p = this.players.find(p => p.id === slot.id); if (p) p.lagFrames = Math.max(0, Math.min(20, Math.round((d.rtt + (d.delay || 0)) / FRAME_MS))); }
      }
    }
    onGuestLeft(conn) {
      const slot = this.slots.find(s => s.conn === conn); if (!slot) return;
      this.slots = this.slots.filter(s => s !== slot);
      const p = this.players.find(p => p.id === slot.id); if (p) { p.out = true; p.hidden = true; p.bubbled = false; p.dying = false; }
      if (this.state === 'lobby') this.sendLobby();
    }
    // Drop guests that went silent (closed tabs are not always reported).
    syncRemoteInputs() {
      for (const s of this.slots.slice()) {
        if (s.local) continue;
        if (this.state !== 'lobby' && this.frame - (s.lastSeen || this.frame) > 300) { try { s.conn.close(); } catch (e) { } this.onGuestLeft(s.conn); }
      }
    }
    // Input frames to apply for a guest this tick: normally one, none while the
    // jitter buffer refills, two to catch up on a backlog. Skipping or doubling the
    // guest's own physics step (instead of inventing input) keeps the host's copy
    // identical to what the guest predicted.
    takeInputs(slot) {
      const q = slot.queue;
      if (slot.buffering) { if (q.length >= QUEUE_TARGET) slot.buffering = false; else return []; }
      if (q.length === 0) { slot.buffering = true; return []; }
      const n = q.length > QUEUE_TARGET + 3 ? 2 : 1;
      return q.splice(0, n);
    }
    stepPlayer(p) {
      const slot = this.slots.find(s => s.id === p.id);
      this.curPid = p.id;
      if (!slot || slot.local || !slot.queue) { p.update(this); return; }
      for (const r of this.takeInputs(slot)) {
        applyBits(slot.input, r.h, r.p); slot.lastSeq = r.s; if (r.ts) slot.lastTs = r.ts;
        p.update(this);
        if (this.state !== 'play') break;
      }
    }
    clearPressed() { for (const s of this.slots) { const i = s.input; i.jumpPressed = i.firePressed = i.downPressed = i.dashPressed = i.start = false; } }

    // ----- online: guest side -----
    onHostMessage(d) {
      if (d.t === 'W') { this.myId = d.id; this.state = 'lobby'; this.netMsg = ''; }
      else if (d.t === 'LB') { this.lobbySlots = d.slots; const me = d.slots.find(s => s.id === this.myId); if (me) this.lobbyCat = me.cat; }
      else if (d.t === 'K') { this.net.close(); this.mode = 'solo'; this.netMsg = d.why || 'DISCONNECTED'; this.state = 'title'; this.loadLevel(); }
      else if (d.t === 'L') {
        this.stage = d.stage; this.buildWorlds(); this.lives = d.lives; this.scoreVal = d.score; this.coins = d.coins;
        for (const name of Object.keys(d.tiles)) { const w = this.worlds[name]; if (w) for (const ch of d.tiles[name]) this.applyTile(w.level, ch); }
        this.setWorld(d.world); this.ghosts.clear(); this.snaps = []; this.fxLocal = [];
        this.players = d.slots.map(s => new E.Player(0, 0, { id: s.id, cat: s.cat }));
        this.me = this.players.find(p => p.id === this.myId) || null; if (this.me) { this.me.errX = 0; this.me.errY = 0; }
        this.pending = [];
        const th = this.level.theme;
        this.bg = { sky: TILES.sky(VW, VH, LEVELS.GROUND_ROW * T, th), cave: TILES.caveSky(VW, VH), clouds: TILES.clouds(1280, 200, th), hills: TILES.hills(1280, 140, th) };
        this.state = 'intro'; this.stateTimer = 0;
      } else if (d.t === 'S') {
        d.recv = performance.now(); this.snaps.push(d); if (this.snaps.length > 12) this.snaps.shift();
        this.trackClock(d);
        if (d.w !== this.level.name && this.worlds[d.w]) { this.setWorld(d.w); this.ghosts.clear(); this.fxLocal = []; }
        for (const ch of d.tl) this.applyTile(this.level, ch);
        for (const f of d.fx) { const e = E.fromFx(f, this); if (e) this.fxLocal.push(e); }
        for (const sf of d.sfx) { const [k, pid] = Array.isArray(sf) ? sf : [sf, 0]; if (pid === this.myId && LOCAL_SFX.has(k)) continue; if (AUDIO.SFX[k]) AUDIO.SFX[k](); }
        const mine = d.pl.find(p => p.id === this.myId); if (mine) this.reconcile(mine);
        if (d.st !== this.state) { if (d.st === 'play') AUDIO.MUSIC.start(); else if (d.st !== 'warp') AUDIO.MUSIC.stop(); this.state = d.st; }
      }
    }
    onHostLeft() { if (this.mode === 'guest') { this.mode = 'solo'; this.netMsg = 'HOST LEFT'; this.state = 'title'; this.net.close(); this.loadLevel(); } }
    // One input record per frame; the last few are resent so a late packet is harmless.
    sendInput() {
      const rec = { s: ++this.seq, h: heldBits(this.input), p: pressedBits(this.input), ts: Math.round(performance.now()) };
      this.pending.push(rec); if (this.pending.length > 120) this.pending.shift();
      this.net.send({ t: 'I', q: this.pending.slice(-3), rtt: this.rtt == null ? undefined : Math.round(this.rtt), delay: Math.round(this.delay || MIN_DELAY) });
      return rec;
    }
    // Estimate the host's clock offset (min over a window, so it tracks the fastest
    // packets) and how jittery arrivals are, which sets the interpolation delay.
    trackClock(d) {
      const off = d.recv - d.f * FRAME_MS;
      this.offs = this.offs || []; this.offs.push(off); if (this.offs.length > 90) this.offs.shift();
      const minOff = Math.min(...this.offs), maxOff = Math.max(...this.offs.slice(-45));
      this.hostOffset = this.hostOffset == null ? minOff : this.hostOffset + (minOff - this.hostOffset) * 0.1;
      const jitter = maxOff - minOff;
      const want = Math.max(MIN_DELAY, Math.min(MAX_DELAY, jitter + SNAP_EVERY * FRAME_MS * 1.5));
      this.delay = this.delay == null ? want : this.delay + (want - this.delay) * 0.05;
      const mine = d.pl.find(p => p.id === this.myId);
      if (mine && mine.ts) { const r = d.recv - mine.ts; this.rtt = this.rtt == null ? r : this.rtt * 0.8 + r * 0.2; }
    }
    // A stand-in for the game that lets Player.update run against local state
    // without spawning anything authoritative.
    predictProxy() {
      if (!this.proxy) {
        const g = this;
        this.proxy = {
          get input() { return g.predInput; }, get cam() { return g.cam; }, get players() { return g.players; }, get entities() { return g.entities; },
          get levelW() { return g.levelW; }, get levelH() { return g.levelH; }, get painter() { return g.painter; },
          tileAt: (c, r) => g.tileAt(c, r), isSolid: (c, r) => g.isSolid(c, r), isHidden: (c, r) => g.isHidden(c, r),
          add: () => { }, hitBlock: () => { }, breakWall: () => false, breakTile: () => false, killPlayer: () => { }, countYarn: () => 2,
          shake: (f, m) => g.shake(f, m), splash: () => { AUDIO.SFX.splash(); }, musicNormal: () => { }, nearestAlive: p => g.nearestAlive(p), score: () => { },
        };
        this.predInput = newInput();
      }
      return this.proxy;
    }
    predictStep(rec) {
      if (!this.me) return;
      const proxy = this.predictProxy();
      applyBits(this.predInput, rec.h, rec.p);
      this.me.input = this.predInput;
      this.me.update(proxy);
    }
    // Reset our cat to the host's state and replay the inputs it hasn't seen.
    reconcile(sp) {
      const me = this.me; if (!me) return;
      const ox = me.x + me.errX, oy = me.y + me.errY;
      me.x = sp.x; me.y = sp.y; me.facing = sp.fc; me.t = sp.t;
      for (const k of E.Player.prototype.netFields) me[k] = sp.f[k];
      for (const k of E.Player.prototype.predFields) me[k] = sp.pf[k];
      me.carrier = null;
      this.pending = this.pending.filter(r => r.s > sp.ack);
      if (this.state !== 'play') { me.errX = 0; me.errY = 0; return; }
      AUDIO.hooks.suppress = true;
      for (const r of this.pending) this.predictStep(r);
      AUDIO.hooks.suppress = false;
      const ex = ox - me.x, ey = oy - me.y;
      if (Math.abs(ex) < 48 && Math.abs(ey) < 48) { me.errX = ex; me.errY = ey; } else { me.errX = 0; me.errY = 0; }
    }
    // Interpolate the two newest snapshots into ghost entities for rendering.
    clientStep() {
      this.frame++;
      if (this.shakeT > 0) this.shakeT--;
      if (this.net.status === 'open' && this.state !== 'lobby' && this.state !== 'connecting') {
        const rec = this.sendInput();
        if (this.me && this.state === 'play') { this.predictStep(rec); this.me.errX *= 0.75; this.me.errY *= 0.75; }
      }
      this.input.jumpPressed = this.input.firePressed = this.input.downPressed = this.input.dashPressed = this.input.start = false;
      for (const e of this.fxLocal) e.update(this);
      this.fxLocal = this.fxLocal.filter(e => !e.remove);
      if (this.snaps.length === 0) return;
      if (performance.now() - this.snaps[this.snaps.length - 1].recv > 5000 && this.state !== 'lobby') { this.onHostLeft(); return; }
      // render at a host-frame time slightly in the past so there is always a pair to blend
      const fNow = (performance.now() - this.hostOffset - (this.delay || MIN_DELAY)) / FRAME_MS;
      let s0 = this.snaps[this.snaps.length - 1], s1 = s0;
      for (let i = this.snaps.length - 1; i > 0; i--) if (this.snaps[i - 1].f <= fNow) { s0 = this.snaps[i - 1]; s1 = this.snaps[i]; break; }
      if (s0 === s1 && this.snaps.length > 1 && this.snaps[0].f > fNow) { s0 = this.snaps[0]; s1 = this.snaps[1]; }
      const a = s1 === s0 ? 1 : Math.max(0, Math.min(1, (fNow - s0.f) / Math.max(1, s1.f - s0.f)));
      const lerp = (x, y) => x + (y - x) * a;
      const hostCam = lerp(s0.cam, s1.cam);
      this.lives = s1.lives; this.coins = s1.coins; this.scoreVal = s1.score; this.time = s1.time; this.bumps = s1.bm; this.flagY = s1.fy; this.clearTimer = s1.ct; this.warp = s1.warp;
      if (s1.shake && this.shakeT === 0) { this.shakeT = 2; this.shakeMag = s1.shake; }
      const prevPl = new Map(s0.pl.map(p => [p.id, p]));
      for (const sp of s1.pl) {
        let p = this.players.find(q => q.id === sp.id);
        if (!p) { p = new E.Player(sp.x, sp.y, { id: sp.id, cat: sp.f.catIndex }); this.players.push(p); }
        if (p === this.me) continue;
        const q = prevPl.get(sp.id);
        p.x = q ? lerp(q.x, sp.x) : sp.x; p.y = q ? lerp(q.y, sp.y) : sp.y; p.facing = sp.fc; p.t = sp.t;
        for (const k of E.Player.prototype.netFields) p[k] = sp.f[k];
      }
      const prevEn = new Map(s0.en.map(e => [e.id, e]));
      const seen = new Set();
      for (const se of s1.en) {
        let g = this.ghosts.get(se.id);
        if (!g) { g = E.makeGhost(se.k, se.x, se.y); if (!g) continue; g.active = true; this.ghosts.set(se.id, g); }
        const q = prevEn.get(se.id);
        const nx = q ? lerp(q.x, se.x) : se.x, ny = q ? lerp(q.y, se.y) : se.y;
        g.dx = nx - g.x; g.dy = ny - g.y; g.x = nx; g.y = ny; g.facing = se.fc; g.t = se.t;
        if (g.netFields) for (const k of g.netFields) if (se.f[k] !== undefined) g[k] = se.f[k];
        seen.add(se.id);
      }
      for (const id of [...this.ghosts.keys()]) if (!seen.has(id)) this.ghosts.delete(id);
      this.entities = [...this.ghosts.values(), ...this.fxLocal];
      // camera: follow the group like the host does, but using our predicted cat
      if (this.state === 'play' && this.me) {
        const group = this.players.filter(p => p.alive);
        if (group.length) { const mean = group.reduce((t, p) => t + p.cx, 0) / group.length; this.cam.x += (mean - 300 - this.cam.x) * 0.12; }
        this.cam.x = Math.max(0, Math.min(this.levelW - VW, this.cam.x));
        if (Math.abs(this.cam.x - hostCam) > 48) this.cam.x = hostCam;
      } else this.cam.x = hostCam;
    }
    // ----- online: host side -----
    snapshot() {
      const lv = this.level, cam = this.cam;
      const pack = e => { const f = {}; for (const k of (e.netFields || [])) f[k] = e[k]; return { id: e.nid, k: e.kind, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, fc: e.facing, t: e.t, f }; };
      const en = [];
      for (const e of this.entities) {
        if (!(e.kind || e.isPlatform) || e.remove) continue;
        if (!e.nid) e.nid = this.nid++;
        if (e.x + e.w < cam.x - 160 || e.x > cam.x + VW + 160) continue;
        en.push(pack(e));
      }
      const pl = this.players.map(p => {
        const o = pack(p); o.id = p.id;
        const slot = this.slots.find(s => s.id === p.id); o.ack = slot ? (slot.lastSeq || 0) : 0; o.ts = slot ? slot.lastTs : undefined;
        o.pf = {}; for (const k of E.Player.prototype.predFields) o.pf[k] = p[k];
        return o;
      });
      const w = this.world;
      const tl = w.tileLog.slice(w.tileSent); w.tileSent = w.tileLog.length;
      const s = { t: 'S', f: this.frame, st: this.state, w: lv.name, cam: Math.round(cam.x * 10) / 10, lives: this.lives, coins: this.coins, score: this.scoreVal, time: this.time, shake: this.shakeT > 0 ? this.shakeMag : 0, pl, en, tl, bm: this.bumps, fx: this.fxQueue, sfx: this.sfxQueue, fy: this.flagY, ct: this.clearTimer, warp: this.warp ? { phase: this.warp.phase, t: this.warp.t } : null };
      this.fxQueue = []; this.sfxQueue = [];
      this.net.broadcast(s);
    }
    sendLevel() {
      const tiles = {}; for (const n of Object.keys(this.worlds)) { tiles[n] = this.worlds[n].tileLog; this.worlds[n].tileSent = this.worlds[n].tileLog.length; }
      this.net.broadcast({ t: 'L', stage: this.stage, world: this.level.name, tiles, lives: this.lives, score: this.scoreVal, coins: this.coins, slots: this.slots.map(s => ({ id: s.id, cat: s.cat })) });
    }

    // ----- level -----
    startGame(stage) {
      this.lives = 3; this.scoreVal = 0; this.coins = 0; this.stage = Math.max(0, Math.min(LEVELS.STAGES.length - 1, stage || 0));
      this.state = 'intro'; this.stateTimer = 0;
      for (const s of this.slots) { s.lastSeen = this.frame; s.queue = []; s.buffering = true; }
      this.loadLevel();
    }
    buildWorlds() {
      const st = LEVELS.STAGES[this.stage];
      this.worlds = {}; this.warps = [];
      for (const def of [st.main(), ...st.extras.map(f => f())]) {
        const level = LEVELS.parse(def);
        this.warps.push(...def.warps);
        const entities = [];
        for (const s of level.spawns) {
          const x = s.c * T, y = (s.r + 1) * T;
          let e = null;
          if (s.type === 'coin') e = new E.CoinPickup(x + 10, y - 26);
          else if (s.type === 'mouse') e = new E.Mouse(x + 4, y - 20);
          else if (s.type === 'hedgehog') e = new E.Hedgehog(x + 4, y - 22);
          else if (s.type === 'fish') e = new E.Fish(x + 4, y - 24);
          else if (s.type === 'bouncer') e = new E.Bouncer(x + 2, y - 18);
          else if (s.type === 'hlift' || s.type === 'vlift' || s.type === 'fall' || s.type === 'log') e = new E.Platform(s);
          if (e) { e.nid = this.nid++; entities.push(e); }
        }
        this.worlds[level.name] = { level, entities, bumps: [], tileLog: [], tileSent: 0 };
      }
      this.setWorld('main');
    }
    loadLevel(keepForm) {
      const forms = {}; if (keepForm) for (const p of this.players) forms[p.id] = p.form;
      this.buildWorlds();
      const start = this.level.start;
      this.players = this.slots.map((s, i) => {
        const p = new E.Player(start.c * T + 6 + i * 26, (start.r + 1) * T - 36, { id: s.id, cat: s.cat, input: s.input });
        if (forms[s.id] && forms[s.id] !== 'small') p.setForm(forms[s.id]);
        return p;
      });
      this.time = this.level.time; this.timeTick = 0; this.warned = false;
      this.cam.x = 0; this.flagY = 0; this.clearTimer = 0; this.warp = null; this.fxQueue = []; this.sfxQueue = []; this.flagPlayer = null;
      AUDIO.MUSIC.setRate(1);
      const th = this.level.theme;
      this.bg = { sky: TILES.sky(VW, VH, LEVELS.GROUND_ROW * T, th), cave: TILES.caveSky(VW, VH), clouds: TILES.clouds(1280, 200, th), hills: TILES.hills(1280, 140, th) };
      if (this.mode === 'host' && this.state !== 'lobby' && this.state !== 'title') this.sendLevel();
    }
    setWorld(name) {
      const w = this.worlds[name];
      this.world = w; this.level = w.level; this.entities = w.entities; this.bumps = w.bumps;
      this.levelW = this.level.W * T; this.levelH = this.level.H * T;
    }
    tileAt(c, r) { if (r < 0 || r >= this.level.H || c < 0 || c >= this.level.W) return null; return this.level.tiles[r][c]; }
    isSolid(c, r) {
      if (c < 0) return true;
      const t = this.tileAt(c, r);
      return !!t && t.type !== 'water' && t.type !== 'hidden';
    }
    isHidden(c, r) { const t = this.tileAt(c, r); return !!t && t.type === 'hidden'; }
    add(e) { e.nid = this.nid++; this.entities.push(e); e.active = true; if (e.fxd && this.mode === 'host') this.fxQueue.push(e.fxd); }
    countYarn(owner) { return this.entities.filter(e => e.isYarn && !e.remove && e.owner === owner).length; }
    score(n, x, y) { this.scoreVal += n; if (x !== undefined) this.add(new E.ScorePop(x, y, String(n))); }
    splash(x, y) { this.add(new E.Splash(x, y)); AUDIO.SFX.splash(); }
    shake(frames, mag) { if (frames >= this.shakeT) { this.shakeT = frames; this.shakeMag = mag; } }
    musicStar() { AUDIO.MUSIC.setRate(1.2); }
    musicNormal() { AUDIO.MUSIC.setRate(this.time <= 100 ? 1.25 : 1); }
    alivePlayers() { return this.players.filter(p => p.alive); }
    nearestAlive(p) { let best = null, bd = 1e9; for (const q of this.players) { if (q === p || !q.alive) continue; const d = Math.abs(q.cx - p.cx); if (d < bd) { bd = d; best = q; } } return best; }

    // ----- blocks -----
    logTile(c, r) { const t = this.tileAt(c, r); this.world.tileLog.push({ c, r, type: t ? t.type : null, item: t ? t.item : undefined }); }
    applyTile(level, ch) { if (ch.type === null) level.tiles[ch.r][ch.c] = null; else { const t = level.tiles[ch.r][ch.c] || { c: ch.c, r: ch.r }; t.type = ch.type; t.item = ch.item; level.tiles[ch.r][ch.c] = t; } }
    killOnTop(bx, by) {
      for (const e of this.entities) {
        if (e.isEnemy && !e.flipDead && Math.abs(e.bottom - by) <= 4 && e.x < bx + T && e.x + e.w > bx) e.flipKill(this, e.cx < bx + 16 ? -1 : 1);
        if (e.isItem && Math.abs(e.bottom - by) <= 4 && e.x < bx + T && e.x + e.w > bx) e.vy = -5;
      }
    }
    hitBlock(c, r, player) {
      const t = this.tileAt(c, r);
      if (!t) return;
      const bx = c * T, by = r * T;
      if (t.type === 'q' || t.type === 'hidden') {
        this.bumps.push({ c, r, t: 0 });
        this.killOnTop(bx, by);
        if (t.item === 'coin') { this.add(new E.CoinPop(bx + 10, by - 20)); this.coins++; AUDIO.SFX.coin(); this.coinCheck(); }
        else if (t.item === 'power') { this.add(player.form === 'small' ? new E.FishItem(bx + 4, by) : new E.YarnItem(bx + 5, by)); AUDIO.SFX.appear(); }
        else if (t.item === 'star') { this.add(new E.StarItem(bx + 5, by)); AUDIO.SFX.appear(); }
        else if (t.item === 'oneup') { this.add(new E.OneUp(bx + 8, by)); AUDIO.SFX.appear(); }
        t.type = 'used'; this.logTile(c, r);
      } else if (t.type === 'brick') {
        this.killOnTop(bx, by);
        if (player.big) this.breakTile(c, r);
        else { this.bumps.push({ c, r, t: 0 }); AUDIO.SFX.bump(); }
      } else if (t.type === 'crack') {
        this.killOnTop(bx, by); this.breakTile(c, r);
      } else AUDIO.SFX.bump();
    }
    breakTile(c, r, fromAbove) {
      const t = this.tileAt(c, r);
      if (!t || (t.type !== 'brick' && t.type !== 'crack')) return false;
      const bx = c * T, by = r * T, rock = t.type === 'crack';
      this.level.tiles[r][c] = null; this.logTile(c, r);
      if (rock) AUDIO.SFX.rock(); else AUDIO.SFX.brick();
      this.score(50); this.shake(5, 2);
      for (const [vx, vy, ox, oy] of [[-2, -9, 4, 4], [2, -9, 18, 4], [-1.5, -5, 4, 18], [1.5, -5, 18, 18]]) this.add(new E.Fragment(bx + ox, by + oy, vx, fromAbove ? vy * 0.6 : vy, rock));
      this.add(new E.Poof(bx + 16, by + 16, 0.8));
      if (fromAbove) this.killOnTop(bx, by);
      return true;
    }
    breakWall(c, r0, r1) {
      let any = false;
      for (let r = r0; r <= r1; r++) { const t = this.tileAt(c, r); if (t && t.type === 'crack') any = this.breakTile(c, r) || any; }
      return any;
    }
    coinCheck() { if (this.coins >= 100) { this.coins -= 100; this.lives++; AUDIO.SFX.oneup(); const p = this.player; if (p) this.add(new E.ScorePop(p.x, p.y - 10, '1UP')); } }
    killPlayer(p, fell) {
      if (p.dying || p.bubbled || p.out) return;
      p.dying = true; p.deadTimer = fell ? 60 : 0; p.vy = -9; p.vx = 0; p.pound = null; p.dashTimer = 0; p.carrier = null;
      this.lives = Math.max(0, this.lives - 1);
      AUDIO.SFX.die();
      if (this.alivePlayers().length === 0) { this.state = 'dying'; this.stateTimer = 0; AUDIO.MUSIC.stop(); }
    }

    // ----- update -----
    step() {
      if (this.isGuest) { this.clientStep(); return; }
      this.frame++;
      if (this.shakeT > 0) this.shakeT--;
      if (this.mode === 'host') this.syncRemoteInputs();
      const inp = this.input;
      if (this.state === 'title') {
        if (inp.start || inp.jumpPressed) this.startGame(0);
      } else if (this.state === 'lobby') {
        if (this.mode === 'host' && inp.start && this.net.status === 'open') this.startGame(0);
      } else if (this.state === 'intro') {
        if (++this.stateTimer > 110 || inp.start) { this.state = 'play'; AUDIO.MUSIC.start(); }
      } else if (this.state === 'play') {
        this.updatePlay();
      } else if (this.state === 'warp') {
        this.updateWarp();
      } else if (this.state === 'dying') {
        for (const p of this.players) p.update(this);
        for (const b of this.bumps) b.t++;
        if (++this.stateTimer > 170) {
          if (this.lives <= 0) { this.state = 'gameover'; this.stateTimer = 0; }
          else { this.state = 'intro'; this.stateTimer = 0; this.loadLevel(); }
        }
      } else if (this.state === 'flag') {
        this.updateFlag();
      } else if (this.state === 'clear') {
        this.updateEntities(); this.panToHouse();
        if (this.time > 0) { this.time -= 2; if (this.time < 0) this.time = 0; this.scoreVal += 100; if (this.frame % 4 === 0) AUDIO.SFX.coin(); }
        else if (++this.clearTimer > 240) {
          if (this.stage + 1 < LEVELS.STAGES.length) { this.stage++; this.state = 'intro'; this.stateTimer = 0; this.loadLevel(true); }
          else { this.state = 'ending'; this.stateTimer = 0; }
        }
      } else if (this.state === 'gameover' || this.state === 'ending') {
        if (++this.stateTimer > 60 && (inp.start || inp.jumpPressed)) {
          this.stage = 0;
          if (this.mode === 'host') { this.state = 'lobby'; this.loadLevel(); this.sendLobby(); }
          else { this.state = 'title'; this.loadLevel(); }
        }
      }
      this.clearPressed();
      if (this.mode === 'host' && this.state !== 'lobby' && this.frame % SNAP_EVERY === 0) this.snapshot();
    }
    updatePlay() {
      this.updatePlatforms();
      for (const p of this.players) this.stepPlayer(p);
      this.curPid = 0;
      if (this.state !== 'play') return;
      this.updateEntities();
      // dead teammates come back as bubbles while someone is still alive
      for (const p of this.players) {
        if (p.dying && p.deadTimer > 110 && this.alivePlayers().length > 0) {
          const a = this.nearestAlive(p);
          if (this.lives > 0) { p.dying = false; p.bubbled = true; p.bubbleT = 0; p.x = a ? a.cx - 60 : this.cam.x + 100; p.y = 40; }
          else { p.dying = false; p.out = true; p.hidden = true; }
        }
      }
      for (const p of this.players) {
        if (!p.alive || p.growTimer > 0) continue;
        this.curPid = p.id; this.playerCollisions(p);
      }
      this.curPid = 0;
      // head bounce and bubble popping between players
      for (const a of this.players) for (const b of this.players) {
        if (a === b) continue;
        if (a.alive && b.bubbled && Math.abs(a.cx - b.cx) < 34 && Math.abs(a.y + a.h / 2 - (b.y + 20)) < 40) { b.popBubble(this); b.x = a.x; b.y = a.y - 40; continue; }
        if (a.alive && b.alive && a.vy > 0 && a.prevBottom <= b.y + 8 && a.overlaps(b)) { a.bounce(); a.y = b.y - a.h; b.squash(1.3, 0.75); AUDIO.SFX.stomp(); }
      }
      // warp pipes: press down while standing on one
      for (const p of this.alivePlayers()) {
        const inp = p.input || this.input;
        if (inp.downPressed && p.onGround && !p.dashing) {
          const c = Math.floor(p.cx / T), r = Math.floor((p.bottom + 1) / T);
          const w = this.warps.find(w => w.from.level === this.level.name && w.from.r === r && (w.from.c === c || w.from.c + 1 === c));
          if (w) { this.startWarp(w, p); return; }
        }
      }
      this.updateCamera();
      if (++this.timeTick >= 24) {
        this.timeTick = 0; this.time--;
        if (this.time === 100 && !this.warned) { this.warned = true; AUDIO.SFX.timewarn(); AUDIO.MUSIC.setRate(1.25); }
        if (this.time <= 0) { this.time = 0; for (const p of this.alivePlayers()) this.killPlayer(p, false); }
      }
      const f = this.level.flag;
      if (f) for (const p of this.alivePlayers()) if (p.x + p.w > f.c * T + 14 && p.y < f.r * T) { this.startFlag(p); break; }
    }
    playerCollisions(p) {
      const lag = p.lagFrames || 0;
      for (const e of this.entities) {
        if (e.remove || !e.active) continue;
        if (e.isEnemy) {
          if (e.flipDead || e.squishTimer > 0) continue;
          // Remote players saw this enemy where it was `lag` frames ago; judge the hit there.
          let box = e;
          if (lag > 0 && e.hist && e.hist.length) { const h = e.hist[Math.max(0, e.hist.length - 1 - lag)]; box = { x: h[0], y: h[1], w: e.w, h: e.h }; }
          if (!p.overlaps(box)) continue;
          const falling = p.vy > 0 || p.inWater || p.pounding;
          if (p.starTimer > 0 || p.dashing) { e.flipKill(this, p.dashing ? p.dashDir : p.facing); AUDIO.SFX.kick(); this.shake(4, 2); }
          else if (falling && p.prevBottom <= box.y + 10) { e.stomp(this, p); p.bounce(); }
          else e.touch(this, p);
        } else if (e.isItem) {
          if (e.emerge <= 0 && p.overlaps(e)) e.collect(this, p);
        } else if (e.isCoin) {
          if (p.overlaps(e)) { e.remove = true; this.coins++; this.score(200); AUDIO.SFX.coin(); this.coinCheck(); this.add(new E.Sparkle(e.cx, e.y + 10)); }
        }
      }
    }
    updateCamera() {
      const group = this.players.filter(p => p.alive);
      if (group.length === 0) return;
      if (this.players.length === 1) {
        const tx = group[0].cx;
        if (tx - this.cam.x > 300) this.cam.x = tx - 300;
        if (tx - this.cam.x < 220) this.cam.x = tx - 220;
      } else {
        const mean = group.reduce((s, p) => s + p.cx, 0) / group.length;
        this.cam.x += (mean - 300 - this.cam.x) * 0.12;
      }
      this.cam.x = Math.max(0, Math.min(this.levelW - VW, this.cam.x));
    }
    updatePlatforms() { for (const e of this.entities) if (e.isPlatform || e.isBouncer) e.update(this); }
    updateEntities() {
      const left = this.cam.x - 96, right = this.cam.x + VW + 96;
      for (const e of this.entities) {
        if (e.isPlatform || e.isBouncer) continue;
        if (!e.active) { if (e.x < right && e.x + e.w > left - 200) e.active = true; else continue; }
        if (e.isEnemy && (e.x > right + 200 || e.x + e.w < left - 300)) continue;
        e.update(this);
      }
      this.entities = this.world.entities = this.entities.filter(e => !e.remove);
      for (const b of this.bumps) b.t++;
      this.world.bumps = this.bumps = this.bumps.filter(b => b.t < 14);
    }
    // ----- warp pipes (everyone goes together) -----
    startWarp(w, leader) {
      this.state = 'warp'; this.warp = { def: w, phase: 'enter', t: 0 };
      for (const p of this.players) {
        p.frozen = true; p.vx = 0; p.vy = 0; p.sliding = false; p.carrier = null;
        if (p.bubbled) { p.popBubble(this); p.hurtTimer = 0; }
        if (p.dying) { p.dying = false; }
        if (!p.out) { p.x = w.from.c * T + T - p.w / 2; p.y = Math.min(p.y, leader.y); }
      }
      AUDIO.SFX.pipe(); AUDIO.MUSIC.duck(true);
    }
    updateWarp() {
      const w = this.warp, to = w.def.to;
      w.t++;
      for (const p of this.players) p.t++;
      if (w.phase === 'enter') {
        for (const p of this.players) p.y += 1.3;
        if (w.t > 44) {
          w.phase = 'exit'; w.t = 0;
          this.setWorld(to.level);
          this.players.forEach((p, i) => {
            if (to.dir === 'drop') { p.x = to.c * T + 6 + i * 10; p.y = to.r * T - p.h - i * 20; p.frozen = false; p.vy = 2; }
            else { p.x = to.c * T + T - p.w / 2; p.y = to.r * T + 4; p.frozen = true; }
          });
          this.cam.x = Math.max(0, Math.min(this.levelW - VW, this.players[0].cx - 260));
        }
      } else if (w.phase === 'exit') {
        if (to.dir === 'rise') {
          let done = true;
          for (const p of this.players) { if (p.out) continue; p.y -= 1.3; if (p.bottom <= to.r * T) { p.y = to.r * T - p.h; p.frozen = false; } else done = false; }
          if (done) this.finishWarp();
        } else { for (const p of this.players) p.update(this); if (this.players.every(p => p.onGround || p.out) || w.t > 60) this.finishWarp(); }
        this.updatePlatforms(); this.updateEntities();
      }
    }
    finishWarp() { this.state = 'play'; this.warp = null; AUDIO.MUSIC.duck(false); for (const p of this.players) p.frozen = false; }

    startFlag(p) {
      const f = this.level.flag;
      this.state = 'flag'; this.flagPhase = 0; this.flagPlayer = p; AUDIO.MUSIC.stop(); AUDIO.SFX.flag();
      p.x = f.c * T + 16 - p.w / 2 - 6; p.vx = 0; p.vy = 0; p.sliding = true; p.facing = 1; p.frozen = true; p.pound = null; p.dashTimer = 0;
      const poleTop = T, poleBottom = f.r * T;
      const hgt = (poleBottom - p.bottom) / (poleBottom - poleTop);
      const bonus = hgt > 0.8 ? 5000 : hgt > 0.6 ? 2000 : hgt > 0.4 ? 800 : hgt > 0.2 ? 400 : 100;
      this.score(bonus, p.x + 24, p.y);
      this.flagY = T + 8;
      for (const q of this.players) if (q !== p) { q.frozen = true; if (!q.out && !q.hidden) this.add(new E.Poof(q.cx, q.y + q.h / 2, 1)); q.hidden = true; q.bubbled = false; q.dying = false; }
    }
    updateFlag() {
      const f = this.level.flag, p = this.flagPlayer, h = this.level.house;
      const base = f.r * T;
      p.t++;
      if (this.flagPhase === 0) {
        p.y = Math.min(p.y + 3, base - p.h); this.flagY = Math.min(this.flagY + 3, base - 28);
        if (p.y >= base - p.h && this.flagY >= base - 28) { this.flagPhase = 1; this.stateTimer = 0; p.sliding = false; }
      } else if (this.flagPhase === 1) {
        if (++this.stateTimer > 25) { this.flagPhase = 2; p.x += 14; p.facing = 1; }
      } else {
        p.vx = 2; p.vy = Math.min(p.vy + 0.9, 12); p.moveAndCollide(this); p.anim += 0.2;
        const doorX = h ? h.c * T + 52 : this.levelW - 40;
        if (p.x > doorX) { this.state = 'clear'; this.clearTimer = 0; p.hidden = true; AUDIO.SFX.clear(); }
      }
      this.updateEntities();
      this.panToHouse();
    }
    panToHouse() {
      const h = this.level.house;
      const target = Math.min(this.levelW - VW, (h ? h.c * T + 56 : this.levelW) - 400);
      this.cam.x += (target - this.cam.x) * 0.04;
    }

    // ----- render -----
    render() {
      const ctx = this.ctx, cam = this.cam, lv = this.level, P = this.painter;
      if (this.state === 'join' || this.state === 'connecting' || this.state === 'lobby') { this.drawLobby(); return; }
      const cave = lv.theme === 'cave';
      ctx.drawImage(cave ? this.bg.cave : this.bg.sky, 0, 0);
      ctx.save();
      if (this.shakeT > 0) ctx.translate(Math.round((Math.random() - 0.5) * 2 * this.shakeMag), Math.round((Math.random() - 0.5) * 2 * this.shakeMag));
      if (!cave) {
        const cw = this.bg.clouds.width, cx0 = -((cam.x * 0.25) % cw);
        ctx.drawImage(this.bg.clouds, Math.round(cx0), 0); ctx.drawImage(this.bg.clouds, Math.round(cx0 + cw), 0);
        const hw = this.bg.hills.width, hx0 = -((cam.x * 0.5) % hw), hy = LEVELS.GROUND_ROW * T - this.bg.hills.height;
        ctx.drawImage(this.bg.hills, Math.round(hx0), hy); ctx.drawImage(this.bg.hills, Math.round(hx0 + hw), hy);
      }
      const c0 = Math.max(0, Math.floor(cam.x / T) - 1), c1 = Math.min(lv.W - 1, Math.floor((cam.x + VW) / T) + 1);
      for (const d of lv.decor) {
        if (d.c < c0 - 3 || d.c > c1) continue;
        if (d.kind === 'bush') { const b = TILES.bush(Math.round(d.s * 10) / 10); ctx.drawImage(b, Math.round(d.c * T - cam.x), d.r * T - b.height + 1); }
      }
      if (lv.house) { const hs = SPRITES.extras.HOUSE.r; ctx.drawImage(hs, Math.round(lv.house.c * T - cam.x), (lv.house.r + 1) * T - hs.height); }
      if (lv.flag) {
        const f = lv.flag, poleH = f.r * T - T + 2;
        ctx.drawImage(TILES.pole(poleH), Math.round(f.c * T + 10 - cam.x), T - 2);
        const fl = SPRITES.extras.FLAG.r, fy = this.state === 'flag' || this.state === 'clear' ? this.flagY : T + 8;
        ctx.drawImage(fl, Math.round(f.c * T + 10 - fl.width + 4 - cam.x), Math.round(fy));
      }
      const warping = this.state === 'warp' && !!this.warp && (this.warp.phase === 'enter' || (this.warp.def ? this.warp.def.to.dir === 'rise' : lv.name === 'main'));
      if (warping) this.drawPlayers();
      const wf = Math.floor(this.frame / 10) % 4;
      for (let r = 0; r < lv.H; r++) for (let c = c0; c <= c1; c++) {
        const t = lv.tiles[r][c]; if (!t) continue;
        const x = Math.round(c * T - cam.x), y = r * T;
        if (t.type === 'ground') ctx.drawImage(TILES.ground(t.variant, t.top, t.bottom, t.left, t.right, lv.theme), x, y - GROUND_OVER);
        else if (t.type === 'water') ctx.drawImage(TILES.waterBack(t.depth, wf), x, y);
        else if (t.type === 'hidden') continue;
        else if (t.type === 'brick' || t.type === 'q' || t.type === 'used' || t.type === 'crack') {
          const b = this.bumps.find(b => b.c === c && b.r === r);
          const oy = b ? -Math.round(Math.sin(b.t / 14 * Math.PI) * 8) : 0;
          const img = t.type === 'brick' ? TILES.brick() : t.type === 'used' ? TILES.usedBlock() : t.type === 'crack' ? TILES.crack() : TILES.questionBlock(this.qFrame());
          ctx.drawImage(img, x, y + oy);
        }
      }
      for (const p of lv.pipes) if (p.c + 2 >= c0 && p.c <= c1) ctx.drawImage(TILES.pipe(p.h * T), Math.round(p.c * T - cam.x), p.r * T);
      for (const d of lv.decor) if (d.kind === 'flower' && d.c >= c0 && d.c <= c1) ctx.drawImage(TILES.flower(d.kind2), Math.round(d.c * T + d.dx - cam.x), d.r * T - 10);
      for (const d of lv.decor) if (d.kind === 'lily' && d.c >= c0 && d.c <= c1) ctx.drawImage(TILES.lily(), Math.round(d.c * T + 4 - cam.x), d.r * T - 4 + Math.round(Math.sin(this.frame * 0.05 + d.c) * 1));
      const order = e => (e.isPlatform || e.isBouncer || e.isItem || e.isCoin) ? 0 : e.isEnemy ? 1 : 2;
      const ents = this.entities.filter(e => e.active && e.x + e.w > cam.x - 64 && e.x < cam.x + VW + 64).sort((a, b) => order(a) - order(b));
      let drewPlayer = warping;
      for (const e of ents) {
        if (!drewPlayer && order(e) === 2) { this.drawPlayers(); drewPlayer = true; }
        e.draw(ctx, cam, this);
      }
      if (!drewPlayer) this.drawPlayers();
      for (let r = 0; r < lv.H; r++) for (let c = c0; c <= c1; c++) {
        const t = lv.tiles[r][c]; if (t && t.type === 'water') ctx.drawImage(TILES.waterFront(t.depth, wf), Math.round(c * T - cam.x), r * T);
      }
      ctx.restore();
      if (this.state === 'warp' && this.warp) {
        const w = this.warp, a = w.phase === 'enter' ? Math.min(1, w.t / 44) : Math.max(0, 1 - w.t / 20);
        ctx.fillStyle = `rgba(10,10,20,${a * 0.9})`; ctx.fillRect(0, 0, VW, VH);
      }
      this.drawHUD();
      if (this.state === 'title') this.drawTitle();
      else if (this.state === 'intro') this.drawIntro();
      else if (this.helpOpen) { ctx.fillStyle = 'rgba(20,20,40,0.78)'; ctx.fillRect(0, 60, VW, 270); this.center('CONTROLS', 80, 3, '#ffe27a'); this.center('PRESS H TO CLOSE', 112, 1, '#ffffff'); this.drawControls(140); P.text('TIP: STOMP ENEMIES, POUND CRACKED TILES, POUNCE THROUGH CRACKED WALLS', 56, 300, 1, '#dfe8ff', '#3a2a3a'); }
      else if (this.state === 'pause') { ctx.fillStyle = 'rgba(20,20,40,0.6)'; ctx.fillRect(0, 60, VW, 270); this.center('PAUSED', 80, 3, '#ffe27a'); this.center(this.isGuest ? 'THE HOST PAUSED THE GAME' : 'PRESS P TO CONTINUE', 112, 1, '#ffffff'); this.drawControls(140); }
      else if (this.state === 'gameover') this.banner('GAME OVER', this.isGuest ? 'WAITING FOR THE HOST' : 'PRESS ENTER');
      else if (this.state === 'ending') { this.banner('YOU WIN!', 'ALL CATS ARE HOME'); this.center('FINAL SCORE ' + this.scoreVal, 250, 2, '#ffe27a'); if (!this.isGuest) this.center('PRESS ENTER', 280, 1, '#ffffff'); }
      else if (this.state === 'clear' && this.clearTimer > 0) this.banner('LEVEL CLEAR!', this.players.length > 1 ? 'THE CATS ARE HOME' : 'WHISKERS IS HOME');
      if (this.netMsg && this.state === 'title') this.center(this.netMsg, 346, 1, '#ff9f9f');
    }
    qFrame() { const k = this.frame % 90; return k < 60 ? 0 : k < 70 ? 1 : k < 80 ? 2 : 3; }
    drawPlayers() { for (const p of this.players) p.draw(this.ctx, this.cam, this); }
    drawHUD() {
      const P = this.painter, W = '#ffffff', Sh = '#1c2d5a', Y = '#ffe27a';
      P.text(this.players.length > 1 ? 'CATS' : 'WHISKERS', 24, 10, 2, W, Sh);
      let x = 24;
      for (const p of this.players) { const ic = (SPRITES.cats[p.catIndex] || SPRITES.cat).hcat; this.ctx.globalAlpha = p.out ? 0.3 : 1; this.ctx.drawImage(ic, x, 30); this.ctx.globalAlpha = 1; x += 22; }
      P.text('x' + this.lives, x + 2, 32, 2, W, Sh);
      P.text('COINS', 208, 10, 2, W, Sh);
      this.ctx.drawImage(SPRITES.scoin, 208, 31);
      P.text(String(this.coins).padStart(2, '0'), 224, 32, 2, W, Sh);
      P.text('SCORE', 336, 10, 2, W, Sh);
      P.text(String(this.scoreVal).padStart(6, '0'), 336, 32, 2, Y, Sh);
      P.text('TIME', 512, 10, 2, W, Sh);
      P.text(String(this.time).padStart(3, '0'), 512, 32, 2, this.time <= 100 && this.state === 'play' && (this.frame % 30) < 15 ? '#ff7a7a' : W, Sh);
      if (AUDIO.isMuted()) P.text('MUTED', 576, 340, 1, W, Sh);
      if (this.state === 'play' || this.state === 'warp') P.text('H  HELP', 584, 348, 1, 'rgba(255,255,255,0.75)', Sh);
      if (this.mode !== 'solo' && this.net.code && this.state !== 'title') P.text('ROOM ' + this.net.code, 24, 348, 1, 'rgba(255,255,255,0.75)', Sh);
    }
    drawControls(y) {
      const P = this.painter;
      const rows = [
        ['MOVE', 'ARROWS / WASD'], ['JUMP (HOLD = HIGHER)', 'SPACE / Z / UP'], ['RUN + THROW YARN', 'SHIFT / X'],
        ['POUNCE DASH', 'C / L'], ['GROUND POUND', 'DOWN IN THE AIR'], ['WALL JUMP', 'PUSH INTO A WALL, THEN JUMP'],
        ['ENTER WARP PIPE', 'DOWN ON TOP OF IT'], ['PAUSE / MUTE / HELP', 'P / M / H'],
      ];
      rows.forEach(([a, b], i) => { P.text(a, 96, y + i * 16, 1, '#ffe27a', '#3a2a3a'); P.text(b, 300, y + i * 16, 1, '#ffffff', '#3a2a3a'); });
    }
    banner(a, b) {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(20,20,40,0.55)'; ctx.fillRect(0, 130, VW, 100);
      this.center(a, 150, 3, '#ffe27a');
      if (b) this.center(b, 190, 2, '#ffffff');
    }
    center(s, y, size, col, sh) { this.painter.text(s, Math.round((VW - PX.textWidth(s, size)) / 2), y, size, col, sh || '#3a2a3a'); }
    drawIntro() {
      const ctx = this.ctx;
      ctx.fillStyle = '#0c0c18'; ctx.fillRect(0, 0, VW, VH);
      this.center('WORLD 1-' + (this.stage + 1), 100, 3, '#ffffff');
      this.center(this.level.title || '', 140, 2, '#ffe27a');
      const n = this.players.length, x0 = VW / 2 - (n * 48) / 2;
      this.players.forEach((p, i) => { const cv = (SPRITES.cats[p.catIndex] || SPRITES.cat).small.idle.r; ctx.drawImage(cv, Math.round(x0 + i * 48 + 24 - cv.width / 2), 180); });
      this.center('x ' + this.lives, 232, 2, '#ffffff');
    }
    drawTitle() {
      const ctx = this.ctx, P = this.painter;
      ctx.fillStyle = 'rgba(20,20,40,0.5)'; ctx.fillRect(0, 0, VW, VH);
      const title = 'SUPER WHISKERS';
      P.text(title, Math.round((VW - PX.textWidth(title, 4)) / 2) + 2, 50, 4, '#3a2a3a');
      P.text(title, Math.round((VW - PX.textWidth(title, 4)) / 2), 46, 4, '#ffe27a', '#8a3a2a');
      this.center('A CAT PLATFORMER', 90, 2, '#ffffff');
      SPRITES.cats.forEach((c, i) => { const cv = c.small.idle.r; ctx.drawImage(cv, Math.round(VW / 2 - 90 + i * 48), 118); });
      if ((this.frame % 60) < 40) this.center('ENTER  PLAY SOLO', 176, 2, '#ffffff');
      this.center('O  HOST AN ONLINE CO-OP GAME', 204, 1, '#bfe8ff');
      this.center('J  JOIN A FRIEND\'S ROOM', 218, 1, '#bfe8ff');
      const lines = ['ARROWS / WASD  MOVE      SPACE / Z  JUMP      SHIFT / X  RUN + THROW YARN', 'C  POUNCE      DOWN IN AIR  GROUND POUND      DOWN ON PIPE  ENTER', 'JUMP OFF WALLS      P PAUSE   M MUTE   H HELP      1 / 2 / 3  START AT A LEVEL'];
      lines.forEach((l, i) => this.center(l, 256 + i * 12, 1, '#dfe8ff'));
    }
    drawLobby() {
      const ctx = this.ctx, P = this.painter;
      ctx.drawImage(this.bg.sky, 0, 0); ctx.fillStyle = 'rgba(20,20,40,0.6)'; ctx.fillRect(0, 0, VW, VH);
      if (this.state === 'join') {
        this.center('JOIN A ROOM', 70, 3, '#ffe27a');
        this.center('TYPE THE 4-LETTER ROOM CODE', 120, 1, '#ffffff');
        this.center((this.joinCode + '____').slice(0, 4).split('').join(' '), 150, 4, '#ffffff');
        this.center('ENTER  JOIN        ESC  BACK', 230, 1, '#bfe8ff');
        if (this.netMsg) this.center(this.netMsg, 260, 1, '#ff9f9f');
        return;
      }
      if (this.state === 'connecting') {
        this.center(this.netMsg || 'CONNECTING...', 150, 2, '#ffffff');
        if (this.net.error) { this.center(String(this.net.error).toUpperCase(), 190, 1, '#ff9f9f'); }
        this.center('ESC  BACK', 220, 1, '#bfe8ff');
        return;
      }
      const host = this.mode === 'host';
      this.center(host ? 'YOUR ROOM' : 'ROOM', 40, 2, '#ffffff');
      if (this.net.code && this.net.status === 'open') {
        this.center(this.net.code.split('').join(' '), 62, 4, '#ffe27a');
        if (host && this.roomUrl) { this.center('FRIENDS PRESS J AND TYPE THE CODE, OR OPEN:', 104, 1, '#bfe8ff'); this.center(this.roomUrl.replace(/^https?:\/\//, '').toUpperCase(), 118, 1, '#ffffff'); }
      } else this.center(this.netMsg || 'CONNECTING...', 70, 2, '#ffffff');
      const slots = host ? this.slots.map(s => ({ id: s.id, cat: s.cat })) : (this.lobbySlots || []);
      this.center('CATS IN THE ROOM', 146, 1, '#ffffff');
      slots.forEach((s, i) => {
        const cv = SPRITES.cats[s.cat].small.idle.r, x = Math.round(VW / 2 - (slots.length * 70) / 2 + i * 70 + 35);
        ctx.drawImage(cv, x - cv.width / 2, 164);
        P.text(SPRITES.CAT_NAMES[s.cat], x - Math.round(PX.textWidth(SPRITES.CAT_NAMES[s.cat], 1) / 2), 210, 1, s.id === this.myId ? '#ffe27a' : '#ffffff', '#3a2a3a');
        if (s.id === this.myId) P.text('YOU', x - 9, 222, 1, '#ffe27a', '#3a2a3a');
      });
      this.center('LEFT / RIGHT  CHANGE YOUR CAT', 250, 1, '#bfe8ff');
      if (host) this.center(this.net.status === 'open' ? 'ENTER  START THE GAME' : 'WAITING FOR THE ROOM...', 268, 1, '#ffffff');
      else this.center('WAITING FOR THE HOST TO START...', 268, 1, '#ffffff');
      this.center('ESC  LEAVE', 286, 1, '#bfe8ff');
      if (this.net.error) this.center(String(this.net.error).toUpperCase(), 310, 1, '#ff9f9f');
    }

    loop(now) {
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.acc += dt;
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 4) { this.step(); this.acc -= 1 / 60; steps++; }
      this.render();
      requestAnimationFrame(t => this.loop(t));
    }
  }

  window.addEventListener('load', () => { window.game = new Game(document.getElementById('screen')); });
})();
