// Game objects: the cat, enemies, items, platforms, projectiles and effects.
// Units are pixels per frame at a fixed 60 Hz step.
(function () {
  const { T } = TILES;
  const S = () => SPRITES;

  const PHYS = {
    gravity: 0.9, gravityHold: 0.36, maxFall: 12,
    walkMax: 2.6, runMax: 4.6, accel: 0.16, airAccel: 0.14, decel: 0.3, skidDecel: 0.5, crawlMax: 1.3,
    jumpV: -10.2, runJumpBonus: -1.2,
    wallSlideMax: 1.4, wallJumpV: -9.6, wallJumpVx: 5.2,
    dashSpeed: 7, dashFrames: 12, dashCooldown: 22, dashExitSpeed: 2.6,
    poundFreeze: 8, poundSpeed: 13,
    bounceV: -19.5, bouncePoundV: -21,
    waterGravity: 0.08, waterMaxFall: 1.1, swimV: -3.0, waterMax: 1.9, waterAccel: 0.1, surfaceJumpV: -8.5,
  };

  class Entity {
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.vx = 0; this.vy = 0; this.onGround = false; this.remove = false; this.facing = 1; this.t = 0; this.hitWall = 0; }
    get cx() { return this.x + this.w / 2; }
    get bottom() { return this.y + this.h; }
    overlaps(o) { return this.x < o.x + o.w && this.x + this.w > o.x && this.y < o.y + o.h && this.y + this.h > o.y; }
    // Axis-separated tile collision. Returns the tile hit with the head, if any.
    moveAndCollide(game, opts = {}) {
      const solid = (c, r) => game.isSolid(c, r);
      const headSolid = opts.headSolid || solid;
      let headTile = null;
      this.hitWall = 0;
      this.x += this.vx;
      if (this.vx > 0) {
        const c = Math.floor((this.x + this.w) / T);
        for (let r = Math.floor(this.y / T); r <= Math.floor((this.y + this.h - 1) / T); r++) if (solid(c, r)) { this.x = c * T - this.w; this.hitWall = 1; this.wallCol = c; if (opts.bounce) this.vx = -this.vx; else this.vx = 0; break; }
      } else if (this.vx < 0) {
        const c = Math.floor(this.x / T);
        for (let r = Math.floor(this.y / T); r <= Math.floor((this.y + this.h - 1) / T); r++) if (solid(c, r)) { this.x = (c + 1) * T; this.hitWall = -1; this.wallCol = c; if (opts.bounce) this.vx = -this.vx; else this.vx = 0; break; }
      }
      this.y += this.vy;
      this.onGround = false;
      if (this.vy > 0) {
        const r = Math.floor((this.y + this.h) / T);
        for (let c = Math.floor((this.x + 1) / T); c <= Math.floor((this.x + this.w - 2) / T); c++) if (solid(c, r)) { this.y = r * T - this.h; this.vy = 0; this.onGround = true; this.groundRow = r; break; }
      } else if (this.vy < 0) {
        const r = Math.floor(this.y / T);
        let best = null, bestOv = 0;
        for (let c = Math.floor((this.x + 2) / T); c <= Math.floor((this.x + this.w - 3) / T); c++) if (headSolid(c, r)) {
          const ov = Math.min(this.x + this.w, (c + 1) * T) - Math.max(this.x, c * T);
          if (ov > bestOv) { bestOv = ov; best = c; }
        }
        if (best !== null) { this.y = (r + 1) * T; this.vy = 0; headTile = { c: best, r }; }
      }
      return headTile;
    }
    draw(ctx, cam, img, ox = 0, oy = 0) {
      const cv = this.facing < 0 ? img.l : img.r;
      ctx.drawImage(cv, Math.round(this.x + this.w / 2 - cv.width / 2 - cam.x + ox), Math.round(this.y + this.h - cv.height - cam.y + oy));
    }
  }

  // ---------------- Player ----------------
  const FORMS = { small: { w: 20, h: 36, crouch: 22 }, big: { w: 20, h: 52, crouch: 30 }, yarn: { w: 20, h: 52, crouch: 30 } };
  class Player extends Entity {
    constructor(x, y, opts = {}) {
      super(x, y, FORMS.small.w, FORMS.small.h);
      this.input = opts.input || null; this.catIndex = opts.cat || 0; this.id = opts.id || 0; this.name = opts.name || SPRITES.CAT_NAMES[this.catIndex];
      this.bubbled = false; this.out = false; this.hidden = false; this.bubbleT = 0; this.errX = 0; this.errY = 0;
      this.form = 'small'; this.facing = 1; this.anim = 0; this.hurtTimer = 0; this.starTimer = 0; this.growTimer = 0; this.growTo = null;
      this.dying = false; this.deadTimer = 0; this.inWater = false; this.wasInWater = false; this.jumpHeld = false; this.coyote = 0; this.jumpBuffer = 0; this.skidding = false; this.sliding = false; this.frozen = false;
      this.sx = 1; this.sy = 1; this.wallDir = 0; this.wallSlide = false; this.wallCoyote = 0; this.inputLock = 0;
      this.dashTimer = 0; this.dashCooldown = 0; this.dashDir = 1; this.airDashUsed = false;
      this.pound = null; this.poundTimer = 0; this.carrier = null; this.prevBottom = this.bottom; this.wasOnGround = false; this.crouch = false;
    }
    get big() { return this.form !== 'small'; }
    get dashing() { return this.dashTimer > 0; }
    get pounding() { return this.pound === 'fall'; }
    setForm(f) {
      const old = FORMS[this.form], nu = FORMS[f];
      const oh = this.crouch ? old.crouch : old.h, nh = this.crouch ? nu.crouch : nu.h;
      this.y += oh - nh; this.h = nh; this.w = nu.w; this.form = f;
    }
    setHeight(h) { this.y += this.h - h; this.h = h; }
    // Is there room to stand up here?
    canStand(game) {
      const standH = FORMS[this.form].h;
      const top = this.bottom - standH;
      for (let r = Math.floor(top / T); r <= Math.floor((this.y - 1) / T); r++)
        for (let c = Math.floor((this.x + 2) / T); c <= Math.floor((this.x + this.w - 3) / T); c++) if (game.isSolid(c, r)) return false;
      return true;
    }
    squash(sx, sy) { this.sx = sx; this.sy = sy; }
    get alive() { return !this.dying && !this.bubbled && !this.out; }
    update(game) {
      const inp = this.input || game.input;
      this.t++;
      this.sx += (1 - this.sx) * 0.18; this.sy += (1 - this.sy) * 0.18;
      if (this.bubbled) { this.updateBubble(game); return; }
      if (this.out) return;
      if (this.dying) {
        this.deadTimer++;
        if (this.deadTimer > 20) { this.vy = Math.min(this.vy + 0.5, 10); this.y += this.vy; }
        return;
      }
      if (this.growTimer > 0) { this.growTimer--; if (this.growTimer === 0 && this.growTo) { this.setForm(this.growTo); this.growTo = null; } return; }
      if (this.frozen) return;
      if (this.hurtTimer > 0) this.hurtTimer--;
      if (this.starTimer > 0) { this.starTimer--; if (this.starTimer === 0) game.musicNormal(); }
      if (this.dashCooldown > 0) this.dashCooldown--;
      if (this.inputLock > 0) this.inputLock--;
      if (this.wallCoyote > 0) this.wallCoyote--;

      // ride a moving platform
      if (this.carrier) { this.x += this.carrier.dx; this.y += this.carrier.dy; }
      const wasCarried = !!this.carrier;
      this.carrier = null;
      this.prevBottom = this.bottom;
      this.wasOnGround = this.onGround || wasCarried;

      // water check at the hitbox center
      const wt = game.tileAt(Math.floor(this.cx / T), Math.floor((this.y + this.h * 0.6) / T));
      this.inWater = !!wt && wt.type === 'water';
      if (this.inWater && !this.wasInWater && this.vy > 2) { game.splash(this.cx, Math.floor((this.y + this.h * 0.6) / T) * T + 4); this.pound = null; this.dashTimer = 0; }
      if (!this.inWater && this.wasInWater && this.vy < -2) { game.splash(this.cx, Math.floor((this.y + this.h * 0.6) / T + 1) * T + 4); }
      this.wasInWater = this.inWater;

      // ground pound: brief hang, then slam
      if (this.pound === 'start') {
        if (--this.poundTimer <= 0) this.pound = 'fall';
        this.vx = 0; this.vy = 0;
        return;
      }
      if (this.pound === 'fall') {
        this.vx = 0; this.vy = PHYS.poundSpeed;
        this.moveAndCollide(game);
        this.landOn(game);
        if (this.onGround) this.poundLand(game);
        return;
      }
      if (!this.onGround && !this.inWater && inp.downPressed && !this.dashing && !this.wasOnGround) {
        this.pound = 'start'; this.poundTimer = PHYS.poundFreeze; this.squash(1.25, 0.8); AUDIO.SFX.poundStart();
        return;
      }

      // pounce dash
      if (inp.dashPressed && this.dashCooldown === 0 && !this.dashing && !this.inWater && !this.crouch && !(this.airDashUsed && !this.wasOnGround)) {
        this.dashTimer = PHYS.dashFrames; this.dashDir = this.facing; this.dashCooldown = PHYS.dashCooldown + PHYS.dashFrames;
        if (!this.wasOnGround) this.airDashUsed = true;
        this.squash(1.3, 0.75); AUDIO.SFX.dash();
        game.add(new Dust(this.cx - this.dashDir * 8, this.bottom - 4, -this.dashDir, 3));
      }
      if (this.dashing) {
        this.dashTimer--;
        this.vx = this.dashDir * PHYS.dashSpeed; this.vy = Math.min(this.vy, 0) * 0.5;
        if (this.dashTimer === 0) this.vx = this.dashDir * PHYS.dashExitSpeed;
        if (this.t % 2 === 0) game.add(new Afterimage(this));
        this.moveAndCollide(game);
        if (this.hitWall) { game.breakWall(this.wallCol, Math.floor(this.y / T), Math.floor((this.y + this.h - 1) / T), this.dashDir); this.dashTimer = 0; this.vx = -this.dashDir * 1.5; game.shake(4, 2); }
        this.landOn(game);
        if (this.onGround) this.airDashUsed = false;
        this.anim += 0.3;
        return;
      }

      // crouching: hold down on the ground; stay down while something is overhead
      const wantCrouch = inp.down && this.wasOnGround && !this.inWater;
      if (!this.crouch && wantCrouch) { this.crouch = true; this.setHeight(FORMS[this.form].crouch); }
      else if (this.crouch && !wantCrouch && this.canStand(game)) { this.crouch = false; this.setHeight(FORMS[this.form].h); }

      // horizontal
      const dir = this.inputLock > 0 ? 0 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      const max = this.crouch ? PHYS.crawlMax : this.inWater ? PHYS.waterMax : (inp.run ? PHYS.runMax : PHYS.walkMax);
      const acc = this.inWater ? PHYS.waterAccel : (this.wasOnGround ? PHYS.accel : PHYS.airAccel);
      this.skidding = false;
      if (dir !== 0) {
        if (this.wasOnGround && Math.sign(this.vx) === -dir && Math.abs(this.vx) > 1.5) {
          this.skidding = true; this.vx += dir * PHYS.skidDecel;
          if (this.t % 4 === 0) game.add(new Dust(this.cx + Math.sign(this.vx) * 6, this.bottom - 3, Math.sign(this.vx), 2));
        } else {
          if (Math.abs(this.vx) < max || Math.sign(this.vx) !== dir) this.vx += dir * acc;
          if (Math.abs(this.vx) > max) this.vx = Math.sign(this.vx) * Math.max(max, Math.abs(this.vx) - 0.1);
        }
        this.facing = dir;
      } else if (this.wasOnGround || this.inWater) {
        const d = this.inWater ? 0.05 : PHYS.decel;
        if (Math.abs(this.vx) <= d) this.vx = 0; else this.vx -= Math.sign(this.vx) * d;
      }

      // jumping
      if (inp.jumpPressed) this.jumpBuffer = 6; else if (this.jumpBuffer > 0) this.jumpBuffer--;
      if (this.wasOnGround) this.coyote = 5; else if (this.coyote > 0) this.coyote--;
      if (this.inWater) {
        if (inp.jumpPressed) {
          const surfaceTile = game.tileAt(Math.floor(this.cx / T), Math.floor((this.y + 4) / T));
          const nearSurface = !surfaceTile || surfaceTile.type !== 'water';
          this.vy = nearSurface ? PHYS.surfaceJumpV : PHYS.swimV;
          this.swimKick = 12;
          AUDIO.SFX.jump();
        }
        this.vy += PHYS.waterGravity;
        if (this.vy > PHYS.waterMaxFall) this.vy = PHYS.waterMaxFall;
        this.jumpHeld = false;
      } else {
        if (this.jumpBuffer > 0 && this.coyote > 0) {
          if (this.crouch && this.canStand(game)) { this.crouch = false; this.setHeight(FORMS[this.form].h); }
          this.vy = PHYS.jumpV + PHYS.runJumpBonus * Math.min(1, Math.abs(this.vx) / PHYS.runMax);
          this.jumpHeld = true; this.coyote = 0; this.jumpBuffer = 0; this.onGround = false;
          this.squash(0.78, 1.22); AUDIO.SFX.jump();
          game.add(new Dust(this.cx, this.bottom - 2, 0, 2));
        } else if (this.jumpBuffer > 0 && (this.wallSlide || this.wallCoyote > 0) && !this.wasOnGround) {
          const wd = this.wallDir;
          this.vy = PHYS.wallJumpV; this.vx = -wd * PHYS.wallJumpVx; this.facing = -wd; this.inputLock = 9;
          this.jumpHeld = true; this.jumpBuffer = 0; this.wallCoyote = 0; this.wallSlide = false; this.airDashUsed = false;
          this.squash(0.8, 1.2); AUDIO.SFX.walljump();
          game.add(new Dust(this.x + (wd > 0 ? this.w : 0), this.y + this.h / 2, -wd, 3));
        }
        if (!inp.jumpHeld) this.jumpHeld = false;
        const g = (this.jumpHeld && this.vy < 0) ? PHYS.gravityHold : PHYS.gravity;
        this.vy += g;
        if (this.vy > PHYS.maxFall) this.vy = PHYS.maxFall;
      }
      if (this.swimKick > 0) this.swimKick--;

      // yarn ball
      if (inp.firePressed && this.form === 'yarn' && game.countYarn(this) < 2) {
        game.add(new YarnBall(this.facing > 0 ? this.x + this.w : this.x - 12, this.y + 14, this.facing, this));
        this.throwTimer = 10; AUDIO.SFX.yarn();
      }
      if (this.throwTimer > 0) this.throwTimer--;

      const head = this.moveAndCollide(game, { headSolid: (c, r) => game.isSolid(c, r) || game.isHidden(c, r) });
      if (head) game.hitBlock(head.c, head.r, this);
      this.landOn(game);

      // wall slide
      const pressingWall = this.hitWall !== 0 && dir === this.hitWall;
      this.wallSlide = false;
      if (pressingWall && !this.onGround && !this.inWater && this.vy > 0) {
        this.wallSlide = true; this.wallDir = this.hitWall; this.wallCoyote = 7; this.airDashUsed = false;
        if (this.vy > PHYS.wallSlideMax) this.vy = PHYS.wallSlideMax;
        if (this.t % 5 === 0) game.add(new Dust(this.x + (this.wallDir > 0 ? this.w : 0), this.y + this.h - 6, 0, 1));
      } else if (this.hitWall !== 0 && !this.onGround) { this.wallDir = this.hitWall; this.wallCoyote = 7; }

      // landing
      if (this.onGround && !this.wasOnGround) {
        this.airDashUsed = false;
        const fall = this.prevBottom < this.bottom ? (this.bottom - this.prevBottom) : 0;
        if (fall > 6) { this.squash(1 + fall * 0.03, 1 - fall * 0.025); game.add(new Dust(this.cx - 8, this.bottom - 2, -1, 2)); game.add(new Dust(this.cx + 8, this.bottom - 2, 1, 2)); }
      }

      if (this.x < game.cam.x) { this.x = game.cam.x; if (this.vx < 0) this.vx = 0; }
      if (game.players.length > 1 && this.x + this.w > game.cam.x + 640) { this.x = game.cam.x + 640 - this.w; if (this.vx > 0) this.vx = 0; }
      if (this.x + this.w > game.levelW) { this.x = game.levelW - this.w; this.vx = 0; }
      if (this.y > game.levelH + 40) game.killPlayer(this, true);
      if (this.onGround || this.inWater) this.anim += Math.abs(this.vx) * 0.09 + (this.inWater ? 0.05 : 0);
    }
    // Land on moving platforms and bouncy mushrooms (one-way, from above).
    landOn(game) {
      if (this.vy < 0 && !this.pounding) return;
      for (const e of game.entities) {
        if (!(e.isPlatform || e.isBouncer) || e.remove || !e.active) continue;
        if (this.x + this.w <= e.x + 3 || this.x >= e.x + e.w - 3) continue;
        const topPrev = e.y - (e.dy || 0);
        if (e.isBouncer) { if (this.prevBottom <= e.y + e.h && this.bottom >= e.y) { e.bounce(game, this); return; } continue; }
        if (this.prevBottom > topPrev + 3 || this.bottom < e.y) continue;
        this.y = e.y - this.h; this.vy = 0; this.onGround = true; this.carrier = e; e.ridden(this);
        return;
      }
    }
    poundLand(game) {
      this.pound = null; this.squash(1.45, 0.6);
      game.shake(10, 4); AUDIO.SFX.pound();
      for (let i = 0; i < 3; i++) { game.add(new Dust(this.cx - 10 - i * 6, this.bottom - 2, -1, 3)); game.add(new Dust(this.cx + 10 + i * 6, this.bottom - 2, 1, 3)); }
      for (const e of game.entities) {
        if (!e.isEnemy || e.flipDead || e.squishTimer > 0) continue;
        if (Math.abs(e.cx - this.cx) < 64 && Math.abs(e.bottom - this.bottom) < 12) e.flipKill(game, e.cx < this.cx ? -1 : 1);
      }
      const r = Math.floor((this.bottom + 1) / T);
      for (let c = Math.floor((this.x + 2) / T); c <= Math.floor((this.x + this.w - 3) / T); c++) game.breakTile(c, r, true);
    }
    // Enemy contact: stomp if we're falling onto it, otherwise take damage.
    hurt(game) {
      if (this.hurtTimer > 0 || this.starTimer > 0 || this.dying || this.growTimer > 0) return;
      if (this.form === 'small') { game.killPlayer(this, false); return; }
      this.growTo = 'small'; this.growTimer = 40; this.hurtTimer = 150; AUDIO.SFX.hurt(); game.shake(6, 2);
    }
    grow(game, to) {
      if (to === 'big' && this.form !== 'small') { game.score(1000, this.x, this.y); return; }
      this.growTo = to; this.growTimer = 40; AUDIO.SFX.powerup(); game.score(1000, this.x, this.y);
    }
    bounce() { this.vy = -7; this.jumpHeld = true; this.pound = null; this.squash(0.8, 1.2); }
    sprite(game) {
      const c = S().cats[this.catIndex] || S().cat;
      let set;
      if (this.starTimer > 0 && (Math.floor(this.t / 3) % 4) !== 3) {
        const pals = this.big ? c.starBig : c.starSmall;
        set = pals[Math.floor(this.t / 3) % 3];
      } else set = this.form === 'small' ? c.small : this.form === 'big' ? c.big : c.yarn;
      if (this.growTimer > 0) {
        const alt = this.growTo === 'small' ? c.small : (this.growTo === 'yarn' ? c.yarn : c.big);
        set = (Math.floor(this.growTimer / 4) % 2) ? alt : set;
        return set.idle;
      }
      if (this.dying) return set.dead;
      if (this.sliding || this.pound) return set.jump;
      if (this.dashing) return set.skid;
      if (this.inWater) return set.swim[this.swimKick > 6 ? 0 : Math.floor(this.anim) % 2];
      if (this.wallSlide) return set.skid;
      if (this.crouch) return Math.abs(this.vx) > 0.3 ? set.walk[Math.floor(this.anim) % 4] : set.idle;
      if (!this.onGround) return set.jump;
      if (this.skidding) return set.skid;
      if (Math.abs(this.vx) > 0.3) return set.walk[Math.floor(this.anim) % 4];
      return set.idle;
    }
    // Dead teammate floating back toward the nearest living cat.
    updateBubble(game) {
      this.bubbleT++;
      const target = game.nearestAlive(this);
      if (target) {
        const tx = target.cx - 40 * Math.sign(target.cx - this.cx || 1), ty = target.y - 50;
        this.x += Math.max(-1.2, Math.min(1.2, (tx - this.cx) * 0.03)); this.y += Math.max(-1, Math.min(1, (ty - this.y) * 0.03));
      }
      if (this.x < game.cam.x + 22) this.x = game.cam.x + 22;
      if (this.x + this.w > game.cam.x + 618) this.x = game.cam.x + 618 - this.w;
      if (this.y < 20) this.y = 20;
    }
    popBubble(game) {
      this.bubbled = false; this.dying = false; this.deadTimer = 0; this.hurtTimer = 120; this.vx = 0; this.vy = -4; this.pound = null; this.dashTimer = 0;
      if (this.crouch) { this.crouch = false; this.setHeight(FORMS[this.form].h); }
      if (this.form !== 'small') this.setForm('small');
      this.squash(0.7, 1.3); AUDIO.SFX.appear(); game.add(new Sparkle(this.cx, this.y + 10, '#bfe8ff'));
    }
    drawBubble(ctx, cam) {
      const set = (S().cats[this.catIndex] || S().cat).small, cv = set.idle.r;
      const bx = Math.round(this.cx - cam.x), by = Math.round(this.y + 20 + Math.sin(this.bubbleT * 0.08) * 3 - cam.y);
      ctx.save(); ctx.translate(bx, by); ctx.scale(0.75, 0.75); ctx.drawImage(cv, -cv.width / 2, -cv.height / 2 - 2); ctx.restore();
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(bx, by, 24, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 12, by - 16, 5, 3); ctx.fillRect(bx - 15, by - 12, 3, 5);
      ctx.globalAlpha = 1;
    }
    draw(ctx, cam, game) {
      if (this.out || this.hidden) return;
      if (this.bubbled) { this.drawBubble(ctx, cam); return; }
      if (this.hurtTimer > 0 && (Math.floor(this.t / 3) % 2) === 0 && !this.dying) return;
      const img = this.sprite(game);
      const sh = TILES.shadow(12);
      if (this.onGround && !this.dying) ctx.drawImage(sh, Math.round(this.cx - 12 - cam.x), Math.round(this.bottom - 2 - cam.y));
      let cv = this.facing < 0 ? img.l : img.r;
      if (this.wallSlide) cv = this.wallDir > 0 ? img.l : img.r;
      const bx = this.cx - cam.x + (this.errX || 0), by = this.bottom - cam.y + (this.errY || 0);
      const crouchScale = this.crouch ? (this.h + 6) / FORMS[this.form].h : 1;
      if (game && game.players.length > 1 && !this.dying) { const row = game.players.indexOf(this) % 2; game.painter.text(this.name, Math.round(bx - PX.textWidth(this.name, 1) / 2), Math.round(by - cv.height - 12 - row * 11), 1, '#ffffff', '#3a2a3a'); }
      if (Math.abs(this.sx - 1) < 0.02 && Math.abs(this.sy - 1) < 0.02 && !this.pound && !this.crouch) { ctx.drawImage(cv, Math.round(bx - cv.width / 2), Math.round(by - cv.height)); return; }
      ctx.save(); ctx.translate(Math.round(bx), Math.round(by));
      if (this.pound === 'start') ctx.rotate(Math.sin(this.poundTimer * 0.8) * 0.3);
      ctx.scale(this.sx * (this.crouch ? 1.15 : 1), this.sy * crouchScale);
      ctx.drawImage(cv, Math.round(-cv.width / 2), -cv.height); ctx.restore();
    }
  }

  // ---------------- Enemies ----------------
  class Enemy extends Entity {
    constructor(x, y, w, h) { super(x, y, w, h); this.isEnemy = true; this.squishTimer = 0; this.flipDead = false; this.active = false; }
    update(game) {
      this.t++;
      if (this.flipDead) { this.vy += 0.5; this.y += this.vy; this.x += this.vx; if (this.y > game.levelH + 60) this.remove = true; return; }
      if (this.squishTimer > 0) { this.squishTimer--; if (this.squishTimer === 0) { this.remove = true; game.add(new Poof(this.cx, this.bottom - 6, 1)); } return; }
      this.behave(game);
      if (this.y > game.levelH + 60) this.remove = true;
      if (game.players.length > 1) { (this.hist = this.hist || []).push([this.x, this.y]); if (this.hist.length > 24) this.hist.shift(); }
    }
    flipKill(game, dir) { this.flipDead = true; this.vy = -6; this.vx = (dir || 1) * 1.5; game.score(this.points || 100, this.x, this.y); game.add(new Poof(this.cx, this.y + this.h / 2, 1.2)); }
    drawImg(ctx, cam, img, ox = 0, oy = 0) {
      if (this.flipDead) {
        const cv = this.facing < 0 ? img.l : img.r;
        ctx.save(); ctx.translate(Math.round(this.cx - cam.x), Math.round(this.y + this.h / 2 - cam.y)); ctx.scale(1, -1);
        ctx.drawImage(cv, -cv.width / 2, -cv.height / 2); ctx.restore();
      } else super.draw(ctx, cam, img, ox, oy);
    }
  }

  class Mouse extends Enemy {
    constructor(x, y) { super(x, y, 24, 20); this.vx = -0.9; this.facing = -1; this.points = 100; }
    behave(game) {
      this.vy = Math.min(this.vy + 0.6, 10);
      this.moveAndCollide(game, { bounce: true });
      if (this.vx !== 0) this.facing = Math.sign(this.vx);
    }
    stomp(game, player) { this.squishTimer = 30; game.score(100, this.x, this.y); AUDIO.SFX.stomp(); game.shake(3, 1); game.add(new Poof(this.cx, this.bottom - 4, 0.7)); }
    touch(game, player) { player.hurt(game); }
    draw(ctx, cam) {
      const m = S().mouse;
      if (this.squishTimer > 0) { const cv = this.facing < 0 ? m.squish.l : m.squish.r; ctx.drawImage(cv, Math.round(this.cx - 16 - cam.x), Math.round(this.bottom - 10 - cam.y)); return; }
      this.drawImg(ctx, cam, m.walk[Math.floor(this.t / 8) % 2]);
    }
  }

  class Hedgehog extends Enemy {
    constructor(x, y) { super(x, y, 24, 22); this.vx = -0.8; this.facing = -1; this.state = 'walk'; this.wake = 0; this.points = 100; }
    behave(game) {
      this.vy = Math.min(this.vy + 0.6, 10);
      if (this.state === 'walk') {
        this.moveAndCollide(game, { bounce: true });
        if (this.vx !== 0) this.facing = Math.sign(this.vx);
      } else if (this.state === 'ball') {
        this.vx = 0; this.moveAndCollide(game);
        if (--this.wake <= 0) { this.state = 'walk'; this.vx = -0.8; this.h = 22; this.y -= 2; }
      } else {
        this.moveAndCollide(game, { bounce: true });
        if (this.hitWall) {
          const r0 = Math.floor(this.y / T), r1 = Math.floor((this.y + this.h - 1) / T);
          if (!game.breakWall(this.wallCol, r0, r1, -Math.sign(this.vx))) AUDIO.SFX.bump();
        }
        for (const e of game.entities) if (e !== this && e.isEnemy && !e.flipDead && e.squishTimer === 0 && this.overlaps(e)) e.flipKill(game, Math.sign(this.vx));
      }
    }
    stomp(game, player) {
      if (this.state === 'walk' || this.state === 'roll') { this.state = 'ball'; this.wake = 360; this.vx = 0; this.h = 20; game.score(100, this.x, this.y); AUDIO.SFX.stomp(); this.kickCooldown = 10; game.shake(3, 1); game.add(new Poof(this.cx, this.bottom - 4, 0.7)); }
      else this.kick(game, player.cx < this.cx ? 1 : -1);
    }
    kick(game, dir) { this.state = 'roll'; this.vx = 7 * dir; this.x += dir * 4; this.kickCooldown = 12; game.score(400, this.x, this.y); AUDIO.SFX.kick(); game.add(new Dust(this.cx, this.bottom - 2, -dir, 2)); }
    touch(game, player) {
      if (this.state === 'ball') { if (!(this.kickCooldown > 0)) this.kick(game, player.cx < this.cx ? 1 : -1); return; }
      if (this.state === 'roll' && this.kickCooldown > 0) return;
      player.hurt(game);
    }
    update(game) { if (this.kickCooldown > 0) this.kickCooldown--; super.update(game); }
    draw(ctx, cam) {
      const h = S().hedgehog;
      if (this.state === 'walk' && !this.flipDead) { this.drawImg(ctx, cam, h.walk[Math.floor(this.t / 9) % 2]); return; }
      const img = h.ball;
      if (this.state === 'roll' && !this.flipDead) {
        const cv = img.r; ctx.save(); ctx.translate(Math.round(this.cx - cam.x), Math.round(this.bottom - cv.height / 2 - cam.y));
        ctx.rotate(this.t * 0.35 * Math.sign(this.vx)); ctx.drawImage(cv, -cv.width / 2, -cv.height / 2); ctx.restore(); return;
      }
      const shake = (this.state === 'ball' && this.wake < 90 && (this.wake % 6) < 3) ? 1 : 0;
      this.drawImg(ctx, cam, img, shake, 0);
    }
  }

  class Fish extends Enemy {
    constructor(x, y) { super(x, y, 24, 14); this.vx = -0.7; this.facing = -1; this.baseY = y; this.points = 200; }
    behave(game) {
      const nx = this.x + this.vx;
      const nc = Math.floor((this.vx < 0 ? nx : nx + this.w) / T), r = Math.floor((this.y + this.h / 2) / T);
      const tt = game.tileAt(nc, r);
      // floating logs are solid to fish: turn around instead of swimming through
      const log = game.entities.find(p => p.isPlatform && p.kind === 'log' && p.active && nx < p.x + p.w && nx + this.w > p.x && this.y < p.y + p.h + 4 && this.y + this.h > p.y - 2);
      if (!tt || tt.type !== 'water' || log) { this.vx = -this.vx; } else this.x = nx;
      this.facing = Math.sign(this.vx);
      this.y = this.baseY + Math.sin(this.t * 0.06) * 4;
    }
    stomp(game, player) { this.flipKill(game, player.facing); AUDIO.SFX.stomp(); }
    // A cat standing on a log or the bank is out of reach.
    touch(game, player) { if (player.carrier || (player.onGround && !player.inWater)) return; player.hurt(game); }
    draw(ctx, cam) { this.drawImg(ctx, cam, S().fish.swim[Math.floor(this.t / 7) % 4]); }
  }

  // ---------------- Boss: Duke the bulldog ----------------
  class Boss extends Enemy {
    constructor(x, y) {
      super(x, y, 52, 40); this.isBoss = true; this.active = true; this.hp = 3; this.maxHp = 3; this.state = 'sleep'; this.stateT = 0; this.hurtT = 0; this.facing = -1; this.points = 5000; this.nextMove = 'charge'; this.name = 'DUKE';
    }
    get rage() { return (this.maxHp - this.hp) / this.maxHp; }
    behave(game) {
      this.stateT++;
      if (this.hurtT > 0) this.hurtT--;
      const target = game.alivePlayers().sort((a, b) => Math.abs(a.cx - this.cx) - Math.abs(b.cx - this.cx))[0];
      this.vy = Math.min(this.vy + 0.6, 12);
      if (this.state === 'sleep') { this.vx = 0; this.moveAndCollide(game); return; }
      if (this.state === 'idle') {
        this.vx = 0; if (target) this.facing = target.cx < this.cx ? -1 : 1;
        if (this.stateT > 55 - this.rage * 30) { this.state = this.nextMove; this.nextMove = this.nextMove === 'charge' ? 'slam' : 'charge'; this.stateT = 0; if (this.state === 'slam') { this.vy = -15; this.vx = this.facing * 2.6; AUDIO.SFX.poundStart(); } else AUDIO.SFX.dash(); }
      } else if (this.state === 'charge') {
        this.vx = this.facing * (4.2 + this.rage * 2.2);
        if (this.stateT % 6 === 0) game.add(new Dust(this.cx - this.facing * 20, this.bottom - 2, -this.facing, 2));
      } else if (this.state === 'slam') {
        if (this.onGround && this.stateT > 6) {
          this.state = 'idle'; this.stateT = 0; this.vx = 0; game.shake(12, 5); AUDIO.SFX.pound();
          game.add(new Bone(this.x - 10, this.bottom - 10, -1)); game.add(new Bone(this.x + this.w - 4, this.bottom - 10, 1));
          for (let i = 0; i < 3; i++) { game.add(new Dust(this.cx - 20 - i * 8, this.bottom - 2, -1, 3)); game.add(new Dust(this.cx + 20 + i * 8, this.bottom - 2, 1, 3)); }
        }
      } else if (this.state === 'stun' || this.state === 'hurt') {
        this.vx = 0;
        if (this.stateT > (this.state === 'stun' ? 45 : 55)) { this.state = 'idle'; this.stateT = 0; }
      }
      this.moveAndCollide(game);
      if (this.state === 'charge' && this.hitWall) { this.state = 'stun'; this.stateT = 0; this.vx = 0; game.shake(8, 3); AUDIO.SFX.bump(); game.add(new Poof(this.cx + this.facing * 26, this.y + 10, 0.8)); }
    }
    damage(game, amt, dir) {
      if (this.hurtT > 0 || this.state === 'dead' || this.state === 'sleep') return false;
      this.hp = Math.max(0, this.hp - amt); this.hurtT = 60; this.state = 'hurt'; this.stateT = 0; this.vx = 0;
      game.shake(8, 3); AUDIO.SFX.hurt(); game.add(new Poof(this.cx, this.y + 8, 1.4)); game.score(500, this.cx - 12, this.y - 10);
      if (this.hp <= 0) this.die(game, dir);
      return true;
    }
    die(game, dir) {
      this.state = 'dead'; this.flipDead = true; this.vy = -9; this.vx = (dir || 1) * 1.2; this.hurtT = 0;
      game.score(5000, this.cx - 20, this.y - 20); game.shake(24, 6); AUDIO.SFX.clear();
      for (let i = 0; i < 5; i++) game.add(new Poof(this.x + 10 + i * 10, this.y + 8 + (i % 2) * 20, 1.5));
      game.onBossDefeated(this);
    }
    stomp(game, player) { if (this.damage(game, 1, player.facing)) { player.vy = -12; player.jumpHeld = true; player.squash(0.7, 1.35); } else player.bounce(); }
    flipKill(game, dir) { this.damage(game, 0.5, dir); }
    touch(game, player) {
      if (this.state === 'dead') return;
      if (player.dashing) { this.damage(game, 0.5, player.dashDir); player.dashTimer = 0; player.vx = -player.dashDir * 5; player.vy = -5; player.hurtTimer = Math.max(player.hurtTimer, 20); return; }
      player.hurt(game);
    }
    draw(ctx, cam) {
      const ex = S().extras;
      if (this.hurtT > 0 && this.state !== 'dead' && (Math.floor(this.t / 3) % 2) === 0) return;
      let img = ex.BOSS;
      if (this.state === 'charge' || this.state === 'slam') img = ex.BOSS_CHARGE;
      else if (this.state === 'hurt' || this.state === 'stun' || this.state === 'dead') img = ex.BOSS_HURT;
      else if (this.state === 'sleep' || this.state === 'idle') img = (Math.floor(this.t / 14) % 2) ? ex.BOSS_WALK : ex.BOSS;
      const sh = TILES.shadow(26);
      if (this.onGround && !this.flipDead) ctx.drawImage(sh, Math.round(this.cx - 26 - cam.x), Math.round(this.bottom - 2 - cam.y));
      this.drawImg(ctx, cam, img);
      if (this.state === 'stun') { const st = '*'; ctx.fillStyle = '#ffe27a'; for (let i = 0; i < 3; i++) { const a = this.t * 0.15 + i * 2.1; ctx.fillRect(Math.round(this.cx + Math.cos(a) * 18 - cam.x), Math.round(this.y - 8 + Math.sin(a) * 4 - cam.y), 3, 3); } }
    }
  }
  class Bone extends Enemy {
    constructor(x, y, dir) { super(x, y, 14, 8); this.vx = 3 * dir; this.facing = dir; this.points = 100; this.life = 260; this.active = true; }
    behave(game) {
      this.vy = Math.min(this.vy + 0.5, 8);
      this.moveAndCollide(game);
      if (this.onGround) this.vy = -3.2;
      if (this.hitWall || --this.life <= 0) { this.remove = true; game.add(new Puff(this.cx, this.y + 4)); }
    }
    stomp(game, player) { this.flipKill(game, player.facing); AUDIO.SFX.stomp(); }
    touch(game, player) { player.hurt(game); }
    draw(ctx, cam) {
      const cv = S().extras.BONE.r;
      ctx.save(); ctx.translate(Math.round(this.cx - cam.x), Math.round(this.y + 4 - cam.y)); ctx.rotate(this.t * 0.2 * this.facing); ctx.drawImage(cv, -cv.width / 2, -cv.height / 2); ctx.restore();
    }
  }

  // ---------------- Platforms & bouncers ----------------
  class Platform extends Entity {
    constructor(spec) {
      super(spec.c * T, spec.r * T, 64, 16);
      this.isPlatform = true; this.kind = spec.type; this.x0 = this.x; this.y0 = this.y; this.range = (spec.range || 0) * T;
      this.dx = 0; this.dy = 0; this.active = true; this.fallTimer = 0; this.respawn = 0; this.riders = 0; this.ph = spec.phase || 0;
      if (this.kind === 'log') { this.h = 14; this.y0 = this.y + 4; this.y = this.y0; }
    }
    ridden() { this.riders = 2; }
    update(game) {
      this.t++;
      const px = this.x, py = this.y;
      if (this.kind === 'hlift') this.x = this.x0 + this.range * (0.5 - 0.5 * Math.cos(this.t * 0.025 + this.ph));
      else if (this.kind === 'vlift') this.y = this.y0 - this.range * (0.5 - 0.5 * Math.cos(this.t * 0.022 + this.ph));
      else if (this.kind === 'log') { this.x = this.x0 + this.range * (0.5 - 0.5 * Math.cos(this.t * 0.014 + this.ph)); this.y = this.y0 + Math.sin(this.t * 0.08) * 1.5 + (this.riders > 0 ? 3 : 0); }
      else if (this.kind === 'fall') {
        if (this.respawn > 0) { if (--this.respawn === 0) { this.x = this.x0; this.y = this.y0; this.vy = 0; this.fallTimer = 0; this.active = true; } }
        else if (this.fallTimer > 0 || this.riders > 0) {
          this.fallTimer++;
          if (this.fallTimer > 40) { this.vy = Math.min(this.vy + 0.45, 9); this.y += this.vy; }
          else this.x = this.x0 + ((this.fallTimer % 4) < 2 ? 1 : -1);
          if (this.y > game.levelH + 40) { this.active = false; this.respawn = 150; }
        }
      }
      this.dx = this.x - px; this.dy = this.y - py;
      if (this.riders > 0) this.riders--;
    }
    draw(ctx, cam) {
      if (!this.active) return;
      const img = this.kind === 'log' ? TILES.log() : TILES.lift(this.theme);
      ctx.drawImage(img, Math.round(this.x - cam.x), Math.round(this.y - cam.y - (this.kind === 'log' ? 2 : 0)));
    }
  }
  class Bouncer extends Entity {
    constructor(x, y) { super(x, y, 28, 18); this.isBouncer = true; this.active = true; this.squishTimer = 0; }
    bounce(game, player) {
      const pound = player.pounding;
      player.pound = null; player.y = this.y - player.h; player.vy = pound ? PHYS.bouncePoundV : PHYS.bounceV;
      if (game.input.jumpHeld) player.vy *= 1.08;
      player.jumpHeld = false; player.airDashUsed = false; player.squash(0.7, 1.35);
      this.squishTimer = 14; AUDIO.SFX.boing(); game.shake(pound ? 8 : 3, pound ? 3 : 1);
      game.add(new Dust(this.cx - 10, this.bottom - 2, -1, 2)); game.add(new Dust(this.cx + 10, this.bottom - 2, 1, 2));
    }
    update() { this.t++; if (this.squishTimer > 0) this.squishTimer--; }
    draw(ctx, cam) {
      const m = S().mushroom;
      const img = this.squishTimer > 6 ? m.squash : m.idle;
      const bob = this.squishTimer === 0 ? Math.round(Math.sin(this.t * 0.08)) : 0;
      ctx.drawImage(img, Math.round(this.cx - 16 - cam.x), Math.round(this.bottom - 20 - cam.y + (this.squishTimer > 6 ? 0 : bob)));
    }
  }

  // ---------------- Items ----------------
  class Item extends Entity {
    constructor(x, y, w, h, kind) { super(x, y, w, h); this.kind = kind; this.isItem = true; this.emerge = 32; this.startY = y; }
    update(game) {
      this.t++;
      if (this.emerge > 0) { this.emerge--; this.y -= this.h / 32; return; }
      this.move(game);
      if (this.y > game.levelH + 60) this.remove = true;
    }
    move(game) { }
    collect(game, player) { this.remove = true; }
    draw(ctx, cam) {
      const img = this.img();
      if (this.emerge > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(this.x - 10 - cam.x, this.startY - this.h - 64 - cam.y, this.w + 20, 64 + this.h); ctx.clip();
        super.draw(ctx, cam, img); ctx.restore();
      } else super.draw(ctx, cam, img);
    }
  }
  class FishItem extends Item {
    constructor(x, y) { super(x, y, 24, 18, 'fish'); this.vx = 1.6; }
    move(game) { this.vy = Math.min(this.vy + 0.5, 8); this.moveAndCollide(game, { bounce: true }); this.facing = Math.sign(this.vx) || 1; }
    collect(game, player) { this.remove = true; player.grow(game, 'big'); game.add(new Sparkle(this.cx, this.y, '#8fdcff')); }
    img() { return S().extras.FISH_ITEM; }
  }
  class YarnItem extends Item {
    constructor(x, y) { super(x, y, 22, 22, 'yarn'); }
    collect(game, player) { this.remove = true; player.grow(game, player.form === 'small' ? 'big' : 'yarn'); game.add(new Sparkle(this.cx, this.y, '#ff9fb2')); }
    img() { return S().extras.YARN_ITEM; }
    draw(ctx, cam) { const bob = this.emerge > 0 ? 0 : Math.round(Math.sin(this.t * 0.1) * 2); ctx.save(); ctx.translate(0, bob); super.draw(ctx, cam); ctx.restore(); }
  }
  class StarItem extends Item {
    constructor(x, y) { super(x, y, 22, 22, 'star'); this.vx = 1.8; }
    move(game) { this.vy = Math.min(this.vy + 0.35, 8); this.moveAndCollide(game, { bounce: true }); if (this.onGround) this.vy = -7.5; }
    collect(game, player) { this.remove = true; player.starTimer = 600; game.score(1000, this.x, this.y); game.musicStar(); AUDIO.SFX.powerup(); game.add(new Sparkle(this.cx, this.y, '#fff3a8')); }
    img() { return S().extras.STAR; }
  }
  class OneUp extends Item {
    constructor(x, y) { super(x, y, 16, 18, 'oneup'); this.vx = 1.6; }
    move(game) { this.vy = Math.min(this.vy + 0.5, 8); this.moveAndCollide(game, { bounce: true }); }
    collect(game, player) { this.remove = true; game.lives++; AUDIO.SFX.oneup(); game.add(new ScorePop(this.x, this.y - 10, '1UP')); game.add(new Sparkle(this.cx, this.y, '#8fffc0')); }
    img() { const m = S().milk; return { r: m, l: m }; }
  }
  class CoinPickup extends Entity {
    constructor(x, y) { super(x, y, 12, 20); this.isCoin = true; }
    update(game) { this.t++; }
    draw(ctx, cam) { const f = S().coin.spin[Math.floor(this.t / 6) % 4]; ctx.drawImage(f, Math.round(this.x - cam.x), Math.round(this.y - cam.y)); }
  }
  class CoinPop extends Entity {
    constructor(x, y) { super(x, y, 12, 20); this.vy = -9; this.y0 = y; }
    update(game) { this.t++; this.vy += 0.45; this.y += this.vy; if (this.vy > 0 && this.y >= this.y0 - 8) { this.remove = true; game.score(200, this.x, this.y - 20); game.add(new Sparkle(this.cx, this.y, '#ffd23f')); } }
    draw(ctx, cam) { const f = S().coin.spin[Math.floor(this.t / 3) % 4]; ctx.drawImage(f, Math.round(this.x - cam.x), Math.round(this.y - cam.y)); }
  }

  // ---------------- Projectiles & effects ----------------
  class YarnBall extends Entity {
    constructor(x, y, dir, owner) { super(x, y, 10, 10); this.vx = 6.5 * dir; this.vy = 1; this.isYarn = true; this.life = 110; this.owner = owner; }
    update(game) {
      this.t++; this.life--;
      this.vy = Math.min(this.vy + 0.5, 9);
      this.moveAndCollide(game);
      if (this.onGround) this.vy = -4.6;
      if (this.hitWall || this.life <= 0 || this.x < game.cam.x - 20 || this.x > game.cam.x + 660) { this.remove = true; if (this.hitWall) game.add(new Puff(this.cx, this.y + this.h / 2)); }
      for (const e of game.entities) {
        if (!e.isEnemy || e.flipDead || e.squishTimer > 0) continue;
        if (this.overlaps(e)) { e.flipKill(game, Math.sign(this.vx)); this.remove = true; game.add(new Puff(this.cx, this.y + this.h / 2)); AUDIO.SFX.kick(); break; }
      }
    }
    draw(ctx, cam) { const img = (Math.floor(this.t / 3) % 2) ? S().extras.YARN_BALL2 : S().extras.YARN_BALL; ctx.drawImage(img.r, Math.round(this.x - 1 - cam.x), Math.round(this.y - 1 - cam.y)); }
  }
  class Puff extends Entity {
    constructor(x, y) { super(x, y, 0, 0); this.life = 14; this.fxd = ['puff', x, y]; }
    update() { if (--this.life <= 0) this.remove = true; }
    draw(ctx, cam) {
      const r = 3 + (14 - this.life) * 0.6;
      ctx.globalAlpha = this.life / 14; ctx.fillStyle = '#fff6e6';
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + this.life * 0.2; ctx.fillRect(Math.round(this.x + Math.cos(a) * r - cam.x - 2), Math.round(this.y + Math.sin(a) * r - cam.y - 2), 4, 4); }
      ctx.globalAlpha = 1;
    }
  }
  // Enemy defeat: expanding ring plus a few stars.
  class Poof extends Entity {
    constructor(x, y, s = 1) { super(x, y, 0, 0); this.life = 18; this.s = s; this.fxd = ['poof', x, y, s]; }
    update() { if (--this.life <= 0) this.remove = true; }
    draw(ctx, cam) {
      const k = 1 - this.life / 18, r = (4 + k * 18) * this.s;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const sz = Math.max(1, Math.round(4 * (1 - k))); ctx.fillRect(Math.round(this.x + Math.cos(a) * r - cam.x - sz / 2), Math.round(this.y + Math.sin(a) * r * 0.8 - cam.y - sz / 2), sz, sz); }
      ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6; const rr = r * 0.6; ctx.fillRect(Math.round(this.x + Math.cos(a) * rr - cam.x - 1), Math.round(this.y + Math.sin(a) * rr - cam.y - 1 - k * 6), 2, 2); }
      ctx.globalAlpha = 1;
    }
  }
  // Ground dust: a few soft puffs drifting in a direction.
  class Dust extends Entity {
    constructor(x, y, dir, n = 2) {
      super(x, y, 0, 0); this.life = 22; this.fxd = ['dust', x, y, dir, n];
      this.parts = [];
      for (let i = 0; i < n + 1; i++) this.parts.push({ x: (Math.random() - 0.5) * 6, y: -Math.random() * 3, vx: dir * (0.6 + Math.random() * 0.8) + (dir === 0 ? (Math.random() - 0.5) * 1.6 : 0), vy: -0.4 - Math.random() * 0.6, r: 2 + Math.random() * 2 });
    }
    update() { this.life--; for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.9; p.r += 0.08; } if (this.life <= 0) this.remove = true; }
    draw(ctx, cam) {
      ctx.globalAlpha = Math.min(0.8, this.life / 22);
      for (const p of this.parts) { const r = Math.round(p.r); ctx.fillStyle = '#f4f0e6'; ctx.fillRect(Math.round(this.x + p.x - r - cam.x), Math.round(this.y + p.y - r - cam.y), r * 2, r * 2); ctx.fillStyle = '#d8d2c4'; ctx.fillRect(Math.round(this.x + p.x - cam.x), Math.round(this.y + p.y - cam.y), r, r); }
      ctx.globalAlpha = 1;
    }
  }
  class Sparkle extends Entity {
    constructor(x, y, col = '#ffd23f') { super(x, y, 0, 0); this.life = 20; this.col = col; this.fxd = ['sparkle', x, y, col]; this.parts = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.random() * 0.5, sp = 1.5 + Math.random(); this.parts.push({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1 }); } }
    update() { this.life--; for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; } if (this.life <= 0) this.remove = true; }
    draw(ctx, cam) {
      ctx.globalAlpha = this.life / 20;
      for (const p of this.parts) { const x = Math.round(this.x + p.x - cam.x), y = Math.round(this.y + p.y - cam.y); ctx.fillStyle = this.col; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); }
      ctx.globalAlpha = 1;
    }
  }
  class Afterimage extends Entity {
    constructor(player) { super(player.x, player.y, 0, 0); this.img = player.sprite(); this.facing = player.facing; this.w = player.w; this.h = player.h; this.life = 10; this.fxd = ['after', player.id]; }
    update() { if (--this.life <= 0) this.remove = true; }
    draw(ctx, cam) { ctx.globalAlpha = this.life / 10 * 0.45; const cv = this.facing < 0 ? this.img.l : this.img.r; ctx.drawImage(cv, Math.round(this.x + this.w / 2 - cv.width / 2 - cam.x), Math.round(this.y + this.h - cv.height - cam.y)); ctx.globalAlpha = 1; }
  }
  class Fragment extends Entity {
    constructor(x, y, vx, vy, rock) { super(x, y, 10, 10); this.vx = vx; this.vy = vy; this.rock = rock; this.fxd = ['frag', x, y, vx, vy, rock ? 1 : 0]; }
    update(game) { this.t++; this.vy += 0.5; this.x += this.vx; this.y += this.vy; if (this.y > game.levelH + 40) this.remove = true; }
    draw(ctx, cam) { ctx.save(); ctx.translate(Math.round(this.x - cam.x + 5), Math.round(this.y - cam.y + 5)); ctx.rotate(this.t * 0.25 * Math.sign(this.vx)); ctx.drawImage(this.rock ? S().rockFrag : S().frag, -5, -5); ctx.restore(); }
  }
  class Splash extends Entity {
    constructor(x, y) { super(x, y, 0, 0); this.life = 18; this.fxd = ['splash', x, y]; this.drops = []; for (let i = 0; i < 7; i++) this.drops.push({ x: 0, y: 0, vx: (i - 3) * 0.9 + (Math.random() - 0.5), vy: -3 - Math.random() * 2.5 }); }
    update() { this.life--; for (const d of this.drops) { d.vy += 0.35; d.x += d.vx; d.y += d.vy; } if (this.life <= 0) this.remove = true; }
    draw(ctx, cam) { ctx.fillStyle = '#e8f8ff'; for (const d of this.drops) { if (d.y > 2) continue; ctx.fillRect(Math.round(this.x + d.x - cam.x), Math.round(this.y + d.y - cam.y), 2, 3); } }
  }
  class ScorePop extends Entity {
    constructor(x, y, text) { super(x, y, 0, 0); this.text = text; this.life = 40; this.fxd = ['score', x, y, text]; }
    update() { this.life--; this.y -= 0.8; if (this.life <= 0) this.remove = true; }
    draw(ctx, cam, game) { game.painter.text(this.text, Math.round(this.x - cam.x), Math.round(this.y - cam.y), 1, '#ffffff', '#3a2a3a'); }
  }

  // Fields a host sends for each entity kind; x/y/facing/t are always sent.
  Mouse.prototype.kind = 'mouse'; Mouse.prototype.netFields = ['squishTimer', 'flipDead'];
  Hedgehog.prototype.kind = 'hedgehog'; Hedgehog.prototype.netFields = ['state', 'squishTimer', 'flipDead', 'wake', 'h'];
  Fish.prototype.kind = 'fish'; Fish.prototype.netFields = ['flipDead'];
  Boss.prototype.kind = 'boss'; Boss.prototype.netFields = ['state', 'hp', 'maxHp', 'hurtT', 'flipDead', 'onGround'];
  Bone.prototype.kind = 'bone'; Bone.prototype.netFields = ['flipDead'];
  Platform.prototype.netFields = ['active', 'kind'];
  Bouncer.prototype.kind = 'bouncer'; Bouncer.prototype.netFields = ['squishTimer'];
  FishItem.prototype.kind = 'fishitem'; YarnItem.prototype.kind = 'yarnitem'; StarItem.prototype.kind = 'staritem'; OneUp.prototype.kind = 'oneup';
  Item.prototype.netFields = ['emerge', 'startY'];
  CoinPickup.prototype.kind = 'coin'; CoinPickup.prototype.netFields = [];
  CoinPop.prototype.kind = 'coinpop'; CoinPop.prototype.netFields = [];
  YarnBall.prototype.kind = 'yarn'; YarnBall.prototype.netFields = [];
  Player.prototype.netFields = ['form', 'catIndex', 'name', 'anim', 'dying', 'bubbled', 'out', 'hidden', 'sliding', 'pound', 'poundTimer', 'dashTimer', 'inWater', 'swimKick', 'onGround', 'skidding', 'wallSlide', 'wallDir', 'hurtTimer', 'starTimer', 'growTimer', 'growTo', 'sx', 'sy', 'bubbleT', 'w', 'h', 'crouch'];
  // Extra state a guest needs to continue simulating its own cat from a snapshot.
  Player.prototype.predFields = ['vx', 'vy', 'jumpHeld', 'coyote', 'jumpBuffer', 'wasInWater', 'wallCoyote', 'inputLock', 'dashCooldown', 'dashDir', 'airDashUsed', 'prevBottom', 'wasOnGround', 'frozen', 'throwTimer', 'deadTimer'];
  function makeGhost(kind, x, y) {
    switch (kind) {
      case 'mouse': return new Mouse(x, y);
      case 'hedgehog': return new Hedgehog(x, y);
      case 'fish': return new Fish(x, y);
      case 'boss': return new Boss(x, y);
      case 'bone': return new Bone(x, y, 1);
      case 'bouncer': return new Bouncer(x, y);
      case 'fishitem': return new FishItem(x, y);
      case 'yarnitem': return new YarnItem(x, y);
      case 'staritem': return new StarItem(x, y);
      case 'oneup': return new OneUp(x, y);
      case 'coin': return new CoinPickup(x, y);
      case 'coinpop': return new CoinPop(x, y);
      case 'yarn': return new YarnBall(x, y, 1, null);
      case 'hlift': case 'vlift': case 'fall': case 'log': return new Platform({ c: 0, r: 0, type: kind });
    }
    return null;
  }
  function fromFx(d, game) {
    switch (d[0]) {
      case 'puff': return new Puff(d[1], d[2]);
      case 'poof': return new Poof(d[1], d[2], d[3]);
      case 'dust': return new Dust(d[1], d[2], d[3], d[4]);
      case 'sparkle': return new Sparkle(d[1], d[2], d[3]);
      case 'after': { const p = game.players.find(p => p.id === d[1]); return p ? new Afterimage(p) : null; }
      case 'frag': return new Fragment(d[1], d[2], d[3], d[4], !!d[5]);
      case 'splash': return new Splash(d[1], d[2]);
      case 'score': return new ScorePop(d[1], d[2], d[3]);
    }
    return null;
  }

  window.ENT = { makeGhost, fromFx, PHYS, Entity, Player, Mouse, Hedgehog, Fish, Boss, Bone, Platform, Bouncer, FishItem, YarnItem, StarItem, OneUp, CoinPickup, CoinPop, YarnBall, Puff, Poof, Dust, Sparkle, Afterimage, Fragment, Splash, ScorePop };
})();
