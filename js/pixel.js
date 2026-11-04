// Low-level pixel painting helpers. Everything is drawn once into offscreen
// canvases at logical resolution and blitted each frame, so per-pixel work
// here only runs at load time.
(function () {
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const bay = (x, y) => (BAY[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return cv;
  }

  class Painter {
    constructor(ctx) { this.c = ctx; }
    rect(x, y, w, h, col) { this.c.fillStyle = col; this.c.fillRect(x, y, w, h); }
    px(x, y, col) { this.c.fillStyle = col; this.c.fillRect(x, y, 1, 1); }
    blit(rows, pal, x, y, flip = false) {
      const c = this.c;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '.' || ch === ' ') continue;
          const col = pal[ch];
          if (!col) continue;
          c.fillStyle = col;
          c.fillRect(x + (flip ? row.length - 1 - i : i), y + r, 1, 1);
        }
      }
    }
    alpha(a, fn) { const o = this.c.globalAlpha; this.c.globalAlpha = a; fn(); this.c.globalAlpha = o; }
    disc(cx, cy, r, col) {
      this.c.fillStyle = col;
      for (let y = -r; y <= r; y++) {
        const w = Math.floor(Math.sqrt(r * r - y * y + 0.25));
        this.c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
      }
    }
    pick(ramp, t, x, y, k = 0.6) {
      const v = t + (bay(x, y) - 0.5) * k;
      return ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v)))];
    }
    // Cluster of discs shaded as one soft shape (clouds, bushes).
    blob(discs, ramp, o = {}) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [cx, cy, r] of discs) { x0 = Math.min(x0, cx - r); x1 = Math.max(x1, cx + r); y0 = Math.min(y0, cy - r); y1 = Math.max(y1, cy + r); }
      const clipY = o.clipY === undefined ? 1e9 : o.clipY;
      const mask = new Map();
      for (let y = Math.floor(y0); y <= Math.min(y1, clipY); y++) for (let x = Math.floor(x0); x <= x1; x++) {
        let best = null;
        for (const [cx, cy, r] of discs) {
          const d = ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) / (r * r);
          if (d <= 1 && (!best || d < best.d)) best = { d, cx, cy, r };
        }
        if (best) mask.set(x + ',' + y, best);
      }
      for (const [k, b] of mask) {
        const [x, y] = k.split(',').map(Number);
        const v = 0.5 * (x + .5 - b.cx) / b.r + 0.75 * (y + .5 - b.cy) / b.r;
        const t = (v + (o.off === undefined ? 0.8 : o.off)) * (o.scale || 1.8);
        let col = this.pick(ramp, t, x, y);
        if (o.outline) {
          const edge = !mask.has((x + 1) + ',' + y) || !mask.has((x - 1) + ',' + y) || !mask.has(x + ',' + (y + 1)) || !mask.has(x + ',' + (y - 1));
          if (edge) col = o.outline;
        }
        this.px(x, y, col);
      }
      return mask;
    }
    glyph(ch, x, y, s, col) {
      const g = FONT[ch] || FONT[' '];
      this.c.fillStyle = col;
      for (let r = 0; r < 7; r++) for (let i = 0; i < 5; i++) if (g[r][i] === '#') this.c.fillRect(x + i * s, y + r * s, s, s);
    }
    text(str, x, y, s, col, shadow) {
      for (let i = 0; i < str.length; i++) {
        const gx = x + i * 6 * s;
        if (shadow) {
          this.glyph(str[i], gx, y + s, s, shadow);
          this.glyph(str[i], gx + s, y + s, s, shadow);
          this.glyph(str[i], gx + s, y, s, shadow);
        }
        this.glyph(str[i], gx, y, s, col);
      }
    }
  }

  // Render into a fresh offscreen canvas of the given size.
  function render(w, h, fn) {
    const cv = makeCanvas(w, h);
    fn(new Painter(cv.getContext('2d')), cv.getContext('2d'));
    return cv;
  }
  function spriteFromMap(rows, pal, flip = false) {
    return render(rows[0].length, rows.length, p => p.blit(rows, pal, 0, 0, flip));
  }
  function flipH(cv) {
    const out = makeCanvas(cv.width, cv.height);
    const ctx = out.getContext('2d');
    ctx.translate(cv.width, 0); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0);
    return out;
  }
  function flipV(cv) {
    const out = makeCanvas(cv.width, cv.height);
    const ctx = out.getContext('2d');
    ctx.translate(0, cv.height); ctx.scale(1, -1); ctx.drawImage(cv, 0, 0);
    return out;
  }
  function textWidth(str, s) { return str.length * 6 * s - s; }

  const FONT = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
    'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
    ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
    ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '>': ['#....', '.#...', '..#..', '...#.', '..#..', '.#...', '#....'],
    '<': ['....#', '...#.', '..#..', '.#...', '..#..', '...#.', '....#'],
    '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
    ')': ['..#..', '...#.', '....#', '....#', '....#', '...#.', '..#..'],
    '\'': ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  };

  window.PX = { bay, hash, makeCanvas, Painter, render, spriteFromMap, flipH, flipV, textWidth, FONT };
})();
