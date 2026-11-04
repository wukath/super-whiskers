// Main loop, camera, world rendering, HUD and game states.
(function () {
  const { T, GROUND_OVER } = TILES;
  const VW = 640, VH = 360;
  const E = ENT;

  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
      this.painter = new PX.Painter(this.ctx);
      this.input = { left: false, right: false, down: false, run: false, jumpHeld: false, jumpPressed: false, firePressed: false, downPressed: false, dashPressed: false, start: false };
      this.state = 'title'; this.lives = 3; this.scoreVal = 0; this.coins = 0; this.frame = 0; this.stage = 0;
      this.cam = { x: 0, y: 0 }; this.shakeT = 0; this.shakeMag = 0;
      this.bindInput();
      this.loadLevel();
      this.resize(); window.addEventListener('resize', () => this.resize());
      this.last = performance.now(); this.acc = 0;
      requestAnimationFrame(t => this.loop(t));
    }
    resize() {
      const s = Math.max(1, Math.floor(Math.min(window.innerWidth / VW, window.innerHeight / VH)));
      this.canvas.style.width = VW * s + 'px'; this.canvas.style.height = VH * s + 'px';
    }
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
          case 'KeyM': return 'mute';
        }
        return null;
      };
      window.addEventListener('keydown', e => {
        const k = map(e.code); if (!k) return; e.preventDefault();
        AUDIO.ensure();
        if (e.repeat) return;
        if (k === 'jump') { this.input.jumpPressed = true; this.input.jumpHeld = true; }
        else if (k === 'run') { this.input.run = true; this.input.firePressed = true; }
        else if (k === 'down') { this.input.down = true; this.input.downPressed = true; }
        else if (k === 'dash') this.input.dashPressed = true;
        else if (k === 'start') this.input.start = true;
        else if (k.startsWith('lvl')) { if (this.state === 'title') this.startGame(+k[3] - 1); }
        else if (k === 'pause') this.togglePause();
        else if (k === 'mute') { AUDIO.toggleMute(); }
        else this.input[k] = true;
      });
      window.addEventListener('keyup', e => {
        const k = map(e.code); if (!k) return;
        if (k === 'jump') this.input.jumpHeld = false;
        else if (k === 'run') this.input.run = false;
        else if (k === 'left' || k === 'right' || k === 'down') this.input[k] = false;
      });
      window.addEventListener('blur', () => { this.input.left = this.input.right = this.input.down = this.input.run = this.input.jumpHeld = false; });
    }
    togglePause() {
      if (this.state === 'play') { this.state = 'pause'; AUDIO.MUSIC.stop(); }
      else if (this.state === 'pause') { this.state = 'play'; AUDIO.MUSIC.start(); }
    }

    // ----- level -----
    startGame(stage) {
      this.lives = 3; this.scoreVal = 0; this.coins = 0; this.stage = Math.max(0, Math.min(LEVELS.STAGES.length - 1, stage || 0));
      this.loadLevel(); this.state = 'intro'; this.stateTimer = 0;
    }
    loadLevel(keepForm) {
      const form = keepForm && this.player ? this.player.form : 'small';
      const st = LEVELS.STAGES[this.stage];
      this.worlds = {}; this.warps = [];
      for (const def of [st.main(), ...st.extras.map(f => f())]) {
        const level = LEVELS.parse(def);
        this.warps.push(...def.warps);
        const entities = [];
        for (const s of level.spawns) {
          const x = s.c * T, y = (s.r + 1) * T;
          if (s.type === 'coin') entities.push(new E.CoinPickup(x + 10, y - 26));
          else if (s.type === 'mouse') entities.push(new E.Mouse(x + 4, y - 20));
          else if (s.type === 'hedgehog') entities.push(new E.Hedgehog(x + 4, y - 22));
          else if (s.type === 'fish') entities.push(new E.Fish(x + 4, y - 24));
          else if (s.type === 'bouncer') entities.push(new E.Bouncer(x + 2, y - 18));
          else if (s.type === 'hlift' || s.type === 'vlift' || s.type === 'fall' || s.type === 'log') entities.push(new E.Platform(s));
        }
        this.worlds[level.name] = { level, entities, bumps: [] };
      }
      this.setWorld('main');
      const start = this.level.start;
      this.player = new E.Player(start.c * T + 6, (start.r + 1) * T - 36);
      if (form !== 'small') this.player.setForm(form);
      this.time = this.level.time; this.timeTick = 0; this.warned = false;
      this.cam.x = 0; this.flagY = 0; this.clearTimer = 0; this.playerHidden = false; this.warp = null;
      AUDIO.MUSIC.setRate(1);
      const th = this.level.theme;
      this.bg = { sky: TILES.sky(VW, VH, LEVELS.GROUND_ROW * T, th), cave: TILES.caveSky(VW, VH), clouds: TILES.clouds(1280, 200, th), hills: TILES.hills(1280, 140, th) };
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
    add(e) { this.entities.push(e); e.active = true; }
    countYarn() { return this.entities.filter(e => e.isYarn && !e.remove).length; }
    score(n, x, y) { this.scoreVal += n; if (x !== undefined) this.add(new E.ScorePop(x, y, String(n))); }
    splash(x, y) { this.add(new E.Splash(x, y)); AUDIO.SFX.splash(); }
    shake(frames, mag) { if (frames >= this.shakeT) { this.shakeT = frames; this.shakeMag = mag; } }
    musicStar() { AUDIO.MUSIC.setRate(1.2); }
    musicNormal() { AUDIO.MUSIC.setRate(this.time <= 100 ? 1.25 : 1); }

    // ----- blocks -----
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
        t.type = 'used';
      } else if (t.type === 'brick') {
        this.killOnTop(bx, by);
        if (player.big) this.breakTile(c, r);
        else { this.bumps.push({ c, r, t: 0 }); AUDIO.SFX.bump(); }
      } else if (t.type === 'crack') {
        this.killOnTop(bx, by); this.breakTile(c, r);
      } else AUDIO.SFX.bump();
    }
    // Smash a brick or cracked rock. Returns true if something broke.
    breakTile(c, r, fromAbove) {
      const t = this.tileAt(c, r);
      if (!t || (t.type !== 'brick' && t.type !== 'crack')) return false;
      const bx = c * T, by = r * T, rock = t.type === 'crack';
      this.level.tiles[r][c] = null;
      if (rock) AUDIO.SFX.rock(); else AUDIO.SFX.brick();
      this.score(50); this.shake(5, 2);
      for (const [vx, vy, ox, oy] of [[-2, -9, 4, 4], [2, -9, 18, 4], [-1.5, -5, 4, 18], [1.5, -5, 18, 18]]) this.add(new E.Fragment(bx + ox, by + oy, vx, fromAbove ? vy * 0.6 : vy, rock));
      this.add(new E.Poof(bx + 16, by + 16, 0.8));
      if (fromAbove) this.killOnTop(bx, by);
      return true;
    }
    // Cracked rock hit from the side by a pounce or a rolling ball.
    breakWall(c, r0, r1, dir) {
      let any = false;
      for (let r = r0; r <= r1; r++) { const t = this.tileAt(c, r); if (t && t.type === 'crack') any = this.breakTile(c, r) || any; }
      return any;
    }
    coinCheck() { if (this.coins >= 100) { this.coins -= 100; this.lives++; AUDIO.SFX.oneup(); this.add(new E.ScorePop(this.player.x, this.player.y - 10, '1UP')); } }
    killPlayer(fell) {
      if (this.player.dying) return;
      this.player.dying = true; this.player.deadTimer = fell ? 60 : 0; this.player.vy = -9; this.player.vx = 0; this.player.pound = null; this.player.dashTimer = 0;
      this.state = 'dying'; this.stateTimer = 0; AUDIO.MUSIC.stop(); AUDIO.SFX.die();
    }

    // ----- update -----
    step() {
      this.frame++;
      if (this.shakeT > 0) this.shakeT--;
      const inp = this.input;
      if (this.state === 'title') {
        if (inp.start || inp.jumpPressed) this.startGame(0);
      } else if (this.state === 'intro') {
        if (++this.stateTimer > 110 || inp.start) { this.state = 'play'; AUDIO.MUSIC.start(); }
      } else if (this.state === 'play') {
        this.updatePlay();
      } else if (this.state === 'warp') {
        this.updateWarp();
      } else if (this.state === 'dying') {
        this.player.update(this);
        for (const b of this.bumps) b.t++;
        if (++this.stateTimer > 170) {
          this.lives--;
          if (this.lives <= 0) { this.state = 'gameover'; this.stateTimer = 0; }
          else { this.loadLevel(); this.state = 'intro'; this.stateTimer = 0; }
        }
      } else if (this.state === 'flag') {
        this.updateFlag();
      } else if (this.state === 'clear') {
        this.updateEntities(); this.panToHouse();
        if (this.time > 0) { this.time -= 2; if (this.time < 0) this.time = 0; this.scoreVal += 100; if (this.frame % 4 === 0) AUDIO.SFX.coin(); }
        else if (++this.clearTimer > 240) {
          if (this.stage + 1 < LEVELS.STAGES.length) { this.stage++; this.loadLevel(true); this.state = 'intro'; this.stateTimer = 0; }
          else { this.state = 'ending'; this.stateTimer = 0; }
        }
      } else if (this.state === 'gameover' || this.state === 'ending') {
        if (++this.stateTimer > 60 && (inp.start || inp.jumpPressed)) { this.state = 'title'; this.stage = 0; this.loadLevel(); }
      }
      inp.jumpPressed = false; inp.firePressed = false; inp.downPressed = false; inp.dashPressed = false; inp.start = false;
    }
    updatePlay() {
      const p = this.player;
      this.updatePlatforms();
      p.update(this);
      if (this.state !== 'play') return;
      this.updateEntities();
      // collisions with the player
      if (!p.dying && p.growTimer === 0) {
        for (const e of this.entities) {
          if (e.remove || !e.active) continue;
          if (e.isEnemy) {
            if (e.flipDead || e.squishTimer > 0 || !p.overlaps(e)) continue;
            const falling = p.vy > 0 || p.inWater || p.pounding;
            if (p.starTimer > 0 || p.dashing) { e.flipKill(this, p.dashing ? p.dashDir : p.facing); AUDIO.SFX.kick(); this.shake(4, 2); }
            else if (falling && p.prevBottom <= e.y + 10) { e.stomp(this, p); p.bounce(); }
            else e.touch(this, p);
          } else if (e.isItem) {
            if (e.emerge <= 0 && p.overlaps(e)) e.collect(this, p);
          } else if (e.isCoin) {
            if (p.overlaps(e)) { e.remove = true; this.coins++; this.score(200); AUDIO.SFX.coin(); this.coinCheck(); this.add(new E.Sparkle(e.cx, e.y + 10)); }
          }
        }
      }
      // warp pipes: press down while standing on one
      if (this.input.downPressed && p.onGround && !p.dashing) {
        const c = Math.floor(p.cx / T), r = Math.floor((p.bottom + 1) / T);
        const w = this.warps.find(w => w.from.level === this.level.name && w.from.r === r && (w.from.c === c || w.from.c + 1 === c));
        if (w) this.startWarp(w);
      }
      // camera: dead zone, clamped to the level
      const tx = p.cx;
      if (tx - this.cam.x > 300) this.cam.x = tx - 300;
      if (tx - this.cam.x < 220) this.cam.x = tx - 220;
      this.cam.x = Math.max(0, Math.min(this.levelW - VW, this.cam.x));
      // timer
      if (++this.timeTick >= 24) {
        this.timeTick = 0; this.time--;
        if (this.time === 100 && !this.warned) { this.warned = true; AUDIO.SFX.timewarn(); AUDIO.MUSIC.setRate(1.25); }
        if (this.time <= 0) { this.time = 0; this.killPlayer(false); }
      }
      // flagpole
      const f = this.level.flag;
      if (f && p.x + p.w > f.c * T + 14 && p.y < (f.r) * T) this.startFlag();
    }
    updatePlatforms() {
      for (const e of this.entities) if (e.isPlatform || e.isBouncer) e.update(this);
    }
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
    // ----- warp pipes -----
    startWarp(w) {
      const p = this.player;
      this.state = 'warp'; this.warp = { def: w, phase: 'enter', t: 0 };
      p.frozen = true; p.vx = 0; p.vy = 0; p.sliding = false;
      p.x = w.from.c * T + T - p.w / 2; AUDIO.SFX.pipe(); AUDIO.MUSIC.duck(true);
    }
    updateWarp() {
      const w = this.warp, p = this.player, to = w.def.to;
      w.t++;
      p.t++;
      if (w.phase === 'enter') {
        p.y += 1.3;
        if (w.t > 44) {
          w.phase = 'exit'; w.t = 0;
          this.setWorld(to.level);
          if (to.dir === 'drop') { p.x = to.c * T + 6; p.y = to.r * T - p.h; p.frozen = false; p.vy = 2; }
          else { p.x = to.c * T + T - p.w / 2; p.y = to.r * T + 4; p.frozen = true; }
          this.cam.x = Math.max(0, Math.min(this.levelW - VW, p.cx - 260));
        }
      } else if (w.phase === 'exit') {
        if (to.dir === 'rise') { p.y -= 1.3; if (p.bottom <= to.r * T) { p.y = to.r * T - p.h; p.frozen = false; this.finishWarp(); } }
        else { p.update(this); if (p.onGround || w.t > 60) this.finishWarp(); }
        this.updatePlatforms(); this.updateEntities();
      }
    }
    finishWarp() { this.state = 'play'; this.warp = null; AUDIO.MUSIC.duck(false); }

    startFlag() {
      const f = this.level.flag, p = this.player;
      this.state = 'flag'; this.flagPhase = 0; AUDIO.MUSIC.stop(); AUDIO.SFX.flag();
      p.x = f.c * T + 16 - p.w / 2 - 6; p.vx = 0; p.vy = 0; p.sliding = true; p.facing = 1; p.frozen = true; p.pound = null; p.dashTimer = 0;
      const poleTop = T, poleBottom = f.r * T;
      const hgt = (poleBottom - p.bottom) / (poleBottom - poleTop);
      const bonus = hgt > 0.8 ? 5000 : hgt > 0.6 ? 2000 : hgt > 0.4 ? 800 : hgt > 0.2 ? 400 : 100;
      this.score(bonus, p.x + 24, p.y);
      this.flagY = T + 8;
    }
    updateFlag() {
      const f = this.level.flag, p = this.player, h = this.level.house;
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
        if (p.x > doorX) { this.state = 'clear'; this.clearTimer = 0; this.playerHidden = true; AUDIO.SFX.clear(); }
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
      // the player goes behind the pipes while warping
      const warping = this.state === 'warp' && (this.warp.phase === 'enter' || this.warp.def.to.dir === 'rise');
      if (warping) this.drawPlayer();
      // tiles
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
      // entities: platforms and items, then enemies, then player, then effects
      const order = e => (e.isPlatform || e.isBouncer || e.isItem || e.isCoin) ? 0 : e.isEnemy ? 1 : 2;
      const ents = this.entities.filter(e => e.active && e.x + e.w > cam.x - 64 && e.x < cam.x + VW + 64).sort((a, b) => order(a) - order(b));
      let drewPlayer = warping;
      for (const e of ents) {
        if (!drewPlayer && order(e) === 2) { this.drawPlayer(); drewPlayer = true; }
        e.draw(ctx, cam, this);
      }
      if (!drewPlayer) this.drawPlayer();
      for (let r = 0; r < lv.H; r++) for (let c = c0; c <= c1; c++) {
        const t = lv.tiles[r][c]; if (t && t.type === 'water') ctx.drawImage(TILES.waterFront(t.depth, wf), Math.round(c * T - cam.x), r * T);
      }
      ctx.restore();
      // warp fade
      if (this.state === 'warp') {
        const w = this.warp, a = w.phase === 'enter' ? Math.min(1, w.t / 44) : Math.max(0, 1 - w.t / 20);
        ctx.fillStyle = `rgba(10,10,20,${a * 0.9})`; ctx.fillRect(0, 0, VW, VH);
      }
      this.drawHUD();
      if (this.state === 'title') this.drawTitle();
      else if (this.state === 'intro') this.drawIntro();
      else if (this.state === 'pause') this.banner('PAUSED', 'PRESS P TO CONTINUE');
      else if (this.state === 'gameover') this.banner('GAME OVER', 'PRESS ENTER');
      else if (this.state === 'ending') { this.banner('YOU WIN!', 'WHISKERS IS HOME FOR GOOD'); P.text('FINAL SCORE ' + this.scoreVal, Math.round((VW - PX.textWidth('FINAL SCORE ' + this.scoreVal, 2)) / 2), 250, 2, '#ffe27a', '#3a2a3a'); P.text('PRESS ENTER', Math.round((VW - PX.textWidth('PRESS ENTER', 1)) / 2), 280, 1, '#ffffff', '#3a2a3a'); }
      else if (this.state === 'clear' && this.clearTimer > 0) this.banner('LEVEL CLEAR!', 'WHISKERS IS HOME');
    }
    drawIntro() {
      const ctx = this.ctx, P = this.painter;
      ctx.fillStyle = '#0c0c18'; ctx.fillRect(0, 0, VW, VH);
      const w = 'WORLD 1-' + (this.stage + 1), t = this.level.title || '';
      P.text(w, Math.round((VW - PX.textWidth(w, 3)) / 2), 110, 3, '#ffffff', '#3a2a3a');
      P.text(t, Math.round((VW - PX.textWidth(t, 2)) / 2), 150, 2, '#ffe27a', '#3a2a3a');
      const ic = SPRITES.cat.small.idle.r;
      ctx.drawImage(ic, VW / 2 - 40, 190);
      P.text('x ' + this.lives, VW / 2 + 6, 206, 2, '#ffffff', '#3a2a3a');
    }
    qFrame() { const k = this.frame % 90; return k < 60 ? 0 : k < 70 ? 1 : k < 80 ? 2 : 3; }
    drawPlayer() { if (!this.playerHidden || this.state !== 'clear') this.player.draw(this.ctx, this.cam, this); }
    drawHUD() {
      const P = this.painter, W = '#ffffff', Sh = '#1c2d5a', Y = '#ffe27a';
      P.text('WHISKERS', 24, 10, 2, W, Sh);
      this.ctx.drawImage(SPRITES.hcat, 24, 30);
      P.text('x' + this.lives, 48, 32, 2, W, Sh);
      P.text('COINS', 208, 10, 2, W, Sh);
      this.ctx.drawImage(SPRITES.scoin, 208, 31);
      P.text(String(this.coins).padStart(2, '0'), 224, 32, 2, W, Sh);
      P.text('SCORE', 336, 10, 2, W, Sh);
      P.text(String(this.scoreVal).padStart(6, '0'), 336, 32, 2, Y, Sh);
      P.text('TIME', 512, 10, 2, W, Sh);
      P.text(String(this.time).padStart(3, '0'), 512, 32, 2, this.time <= 100 && this.state === 'play' && (this.frame % 30) < 15 ? '#ff7a7a' : W, Sh);
      if (AUDIO.isMuted()) P.text('MUTED', 576, 340, 1, W, Sh);
    }
    banner(a, b) {
      const ctx = this.ctx, P = this.painter;
      ctx.fillStyle = 'rgba(20,20,40,0.55)'; ctx.fillRect(0, 130, VW, 100);
      P.text(a, Math.round((VW - PX.textWidth(a, 3)) / 2), 150, 3, '#ffe27a', '#3a2a3a');
      if (b) P.text(b, Math.round((VW - PX.textWidth(b, 2)) / 2), 190, 2, '#ffffff', '#3a2a3a');
    }
    drawTitle() {
      const ctx = this.ctx, P = this.painter;
      ctx.fillStyle = 'rgba(20,20,40,0.5)'; ctx.fillRect(0, 0, VW, VH);
      const title = 'SUPER WHISKERS';
      P.text(title, Math.round((VW - PX.textWidth(title, 4)) / 2) + 2, 66, 4, '#3a2a3a');
      P.text(title, Math.round((VW - PX.textWidth(title, 4)) / 2), 62, 4, '#ffe27a', '#8a3a2a');
      const sub = 'A CAT PLATFORMER';
      P.text(sub, Math.round((VW - PX.textWidth(sub, 2)) / 2), 106, 2, '#ffffff', '#3a2a3a');
      const big = SPRITES.cat.big.idle.r;
      ctx.drawImage(big, Math.round(VW / 2 - big.width / 2), 140);
      if ((this.frame % 60) < 40) { const s = 'PRESS ENTER TO START'; P.text(s, Math.round((VW - PX.textWidth(s, 2)) / 2), 222, 2, '#ffffff', '#3a2a3a'); }
      const lines = ['ARROWS / WASD  MOVE      SPACE / Z  JUMP', 'SHIFT / X  RUN + THROW YARN      C  POUNCE', 'DOWN IN AIR  GROUND POUND      DOWN ON PIPE  ENTER', 'JUMP OFF WALLS      P PAUSE   M MUTE', '1 / 2 / 3  START AT A LEVEL'];
      lines.forEach((l, i) => P.text(l, Math.round((VW - PX.textWidth(l, 1)) / 2), 258 + i * 12, 1, '#dfe8ff', '#3a2a3a'));
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
