// Tile, block, pipe, water and background renderers. Each returns a cached
// offscreen canvas so the per-frame cost is a drawImage.
(function () {
  const { render, bay, hash, makeCanvas } = PX;
  const T = 32;
  const cache = new Map();
  function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

  const THEMES = {
    grass: {
      dirt: ['#d49a62', '#bd7d45', '#9d6236', '#7b4a2b'], grass: ['#b5f26a', '#7ddb4e', '#52b83f', '#34922f'],
      grassLine: '#2a7a35', dark: '#5d3a24', mid: '#7b4a2b', blades: ['#c9fb86', '#8fe358', '#5cc443'],
      pebble: ['#e2bf93', '#7e5a40', '#b99069'],
    },
    cave: {
      dirt: ['#8e8aa0', '#6e6a82', '#524e66', '#3a3650'], grass: ['#8af0d8', '#4fc8ac', '#2f9a84', '#1f6a5c'],
      grassLine: '#174a40', dark: '#262238', mid: '#3a3650', blades: ['#b8ffee', '#6fe0c8', '#3fb8a0'],
      pebble: ['#c4bfd4', '#3f3a4a', '#8a8498'],
    },
    sand: {
      dirt: ['#fbe9b8', '#efd28e', '#d6b26a', '#b08a48'], grass: ['#d8f08a', '#aed46a', '#86b452', '#5f8f3a'],
      grassLine: '#4e7a30', dark: '#8a6a34', mid: '#b08a48', blades: ['#eaff9a', '#c0e070', '#8fc050'],
      pebble: ['#fff6e0', '#a07a48', '#e0c090'],
    },
  };
  const grassDepth = x => 9 + Math.round(Math.sin(x * 0.45) * 1.5 + Math.sin(x * 1.3 + 1) * 1.2 + (hash(x) - 0.5) * 2.5);

  // Ground tile canvas is 32x38: 6 px of grass blades overhang above the tile.
  const GROUND_OVER = 6;
  function ground(variant, top, bottom, left, right, theme = 'grass') {
    const th = THEMES[theme], dirtRamp = th.dirt, grassRamp = th.grass;
    return memo(`g${theme}${variant}${+top}${+bottom}${+left}${+right}`, () => render(T, T + GROUND_OVER, p => {
      const ox = variant * T;
      for (let i = 0; i < T; i++) {
        const x = ox + i, gd = top ? grassDepth(x) : 0;
        for (let j = 0; j < T; j++) {
          const y = j + GROUND_OVER;
          if (j < gd) {
            const t = j < 2 ? 0 : j < 4 ? 0.9 + bay(x, j) * 0.3 : j < gd - 3 ? 1.3 : j < gd - 1 ? 1.9 : 2.7;
            p.px(i, y, p.pick(grassRamp, t, x, j, 0.5));
            if (j === gd - 1) p.px(i, y, th.grassLine);
          } else {
            const dd = j - gd;
            const t = top ? (dd < 5 ? 3.1 - dd * 0.45 : 0.9 + (j - 14) / 22) : 1.4 + Math.sin((variant * 7 + j) * 0.2) * 0.5;
            p.px(i, y, p.pick(dirtRamp, t, x, j + variant * 3, 0.9));
          }
        }
        if (top) {
          const bh = hash(x * 3.3);
          if (bh > 0.45) {
            const h = 2 + Math.floor(hash(x + 91) * 4), lean = hash(x + 17) > 0.5 ? 1 : -1;
            for (let k = 1; k <= h; k++) {
              const bx = i + (k > h / 2 ? lean : 0);
              if (bx >= 0 && bx < T) p.px(bx, GROUND_OVER - k, k === h ? th.blades[0] : (k > h * 0.5 ? th.blades[1] : th.blades[2]));
            }
          }
        }
      }
      // pebbles and roots
      for (let k = 0; k < 3; k++) {
        const px0 = 2 + Math.floor(hash(variant * 5.1 + k * 3.7) * 24), py0 = (top ? 16 : 4) + Math.floor(hash(variant * 2.3 + k) * 12);
        const w = 4 + Math.floor(hash(variant + k) * 3), h = 3;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const dx = (i + .5 - w / 2) / (w / 2), dy = (j + .5 - h / 2) / (h / 2);
          if (dx * dx + dy * dy > 1.05) continue;
          p.px(px0 + i, GROUND_OVER + py0 + j, (dx + dy < -0.5) ? th.pebble[0] : (dx + dy > 0.6 ? th.pebble[1] : th.pebble[2]));
        }
        for (let i = 0; i < w; i++) p.px(px0 + i, GROUND_OVER + py0 + h, th.dark);
        const rx = Math.floor(hash(variant * 9.7 + k) * 28), ry = 6 + Math.floor(hash(variant * 4.9 + k * 2) * 22);
        p.rect(rx, GROUND_OVER + ry, 3, 1, th.mid); p.px(rx + 1, GROUND_OVER + ry + 1, th.dark);
      }
      // exposed edges
      if (bottom) { p.rect(0, GROUND_OVER + T - 2, T, 2, th.dark); p.rect(0, GROUND_OVER + T - 3, T, 1, th.mid); }
      if (left) { p.rect(0, GROUND_OVER + (top ? 2 : 0), 1, T, top ? th.grassLine : th.dark); p.rect(0, GROUND_OVER + (top ? grassDepth(ox) : 0), 1, T, th.dark); }
      if (right) { p.rect(T - 1, GROUND_OVER + (top ? grassDepth(ox + T - 1) : 0), 1, T, th.dark); }
    }));
  }

  // ----- blocks -----
  function bevelBlock(p, x, y, body, hi, hi2, lo, lo2, edge) {
    p.rect(x, y, 32, 32, edge);
    p.rect(x + 1, y + 1, 30, 30, body);
    for (let j = 0; j < 30; j++) for (let i = 0; i < 30; i++) {
      const d = (i + j) / 58;
      if (d > 0.55 && bay(x + i, y + j) < (d - 0.5) * 3) p.px(x + 1 + i, y + 1 + j, lo2);
    }
    p.rect(x + 1, y + 1, 30, 2, hi); p.rect(x + 1, y + 1, 2, 30, hi);
    p.rect(x + 1, y + 1, 30, 1, hi2); p.rect(x + 1, y + 1, 1, 30, hi2);
    p.rect(x + 3, y + 29, 28, 2, lo); p.rect(x + 29, y + 3, 2, 28, lo);
    p.rect(x + 30, y + 1, 1, 30, lo2); p.rect(x + 1, y + 30, 30, 1, lo2);
    p.px(x + 1, y + 30, hi); p.px(x + 30, y + 1, hi);
  }
  const QG = ['..QQQQQQQQ..', '.QQQQQQQQQQ.', 'QQQQ....QQQQ', 'QQQQ....QQQQ', '........QQQQ', '.......QQQQ.', '......QQQQ..', '.....QQQQ...', '.....QQQQ...', '............', '.....QQQQ...', '.....QQQQ...'];
  function rivets(p, x, y, body) {
    for (const [rx, ry] of [[3, 3], [26, 3], [3, 26], [26, 26]]) { p.rect(x + rx, y + ry, 3, 3, '#c97a18'); p.px(x + rx, y + ry, '#fff0b0'); p.px(x + rx + 1, y + ry + 1, body); p.px(x + rx + 2, y + ry + 2, '#7a410c'); }
  }
  function questionBlock(frame) {
    return memo('q' + frame, () => render(T, T, p => {
      bevelBlock(p, 0, 0, '#f9b934', '#ffd569', '#fff0b0', '#d98a1c', '#a85d10', '#5e2f0e');
      p.rect(5, 5, 22, 1, '#d98a1c'); p.rect(5, 5, 1, 22, '#d98a1c');
      p.rect(6, 26, 21, 1, '#ffd569'); p.rect(26, 6, 1, 21, '#ffd569');
      rivets(p, 0, 0, '#f9b934');
      const gx = 10, gy = 9;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [1, 2], [0, 2]]) p.blit(QG, { Q: '#6a3410' }, gx + ox + 1, gy + oy + 1);
      p.blit(QG, { Q: frame === 2 ? '#ffffff' : '#fff6cf' }, gx + 1, gy + 1);
      for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) if (QG[j][i] === 'Q' && (i > 6 || j > 9)) p.px(gx + 1 + i, gy + 1 + j, frame === 2 ? '#fff6cf' : '#f1d68a');
      // travelling glint
      if (frame > 0) { const gx2 = 4 + frame * 7; p.alpha(0.5, () => { p.rect(gx2, 3, 2, 26, '#ffffff'); p.rect(gx2 + 3, 3, 1, 26, '#ffffff'); }); }
    }));
  }
  function usedBlock() {
    return memo('used', () => render(T, T, p => {
      bevelBlock(p, 0, 0, '#b47a4a', '#d9a06a', '#ecc294', '#8a5630', '#6a3d20', '#4a2816');
      for (const [rx, ry] of [[3, 3], [26, 3], [3, 26], [26, 26]]) { p.rect(rx, ry, 3, 3, '#8a5630'); p.px(rx, ry, '#ecc294'); p.px(rx + 2, ry + 2, '#4a2816'); }
      // paw print
      const paw = ['..##..##..', '.####.####', '..##..##..', '##......##', '####.####.', '.##.####..', '...####...', '..######..', '..######..', '...####...'];
      p.blit(paw, { '#': '#7a4a2a' }, 11, 11);
    }));
  }
  function brick() {
    return memo('brick', () => render(T, T, p => {
      const x = 0, y = 0;
      p.rect(x, y, 32, 32, '#5b2a1c');
      const bricks = [];
      for (let r = 0; r < 4; r++) {
        const y0 = y + r * 8;
        if (r % 2 === 0) bricks.push([x + 1, y0, 14, 7], [x + 16, y0, 15, 7]);
        else bricks.push([x + 1, y0, 6, 7], [x + 8, y0, 15, 7], [x + 24, y0, 7, 7]);
      }
      for (const [bx, by, bw, bh] of bricks) {
        p.rect(bx, by, bw, bh, '#cf6a40');
        p.rect(bx, by, bw, 1, '#f5a278'); p.rect(bx, by, 1, bh, '#ec8a60');
        p.rect(bx, by + bh - 2, bw, 2, '#a64a2a'); p.rect(bx + bw - 1, by, 1, bh, '#b8532f');
        p.px(bx + bw - 1, by, '#cf6a40'); p.px(bx, by + bh - 1, '#a64a2a');
        for (let i = 2; i < bw - 2; i++) if (hash(bx * 3 + by * 7 + i) > 0.82) p.px(bx + i, by + 2 + (i % 3), '#e0805a');
        for (let i = 2; i < bw - 2; i++) if (hash(bx * 5 + by * 3 + i) > 0.88) p.px(bx + i, by + 3, '#b8532f');
      }
      p.rect(x, y, 32, 1, '#3a170f'); p.rect(x, y, 1, 32, '#3a170f'); p.rect(x + 31, y, 1, 32, '#3a170f'); p.rect(x, y + 31, 32, 1, '#3a170f');
    }));
  }

  // Cracked stone block: breaks under a pounce, ground pound or rolling ball.
  function crack() {
    return memo('crack', () => render(T, T, p => {
      bevelBlock(p, 0, 0, '#9a93a8', '#c4bfd4', '#e2def0', '#6c6578', '#4a4558', '#2e2a3a');
      const lines = [[6, 4, 10, 9], [10, 9, 9, 15], [9, 15, 14, 20], [14, 20, 13, 27], [18, 3, 21, 8], [21, 8, 26, 10], [26, 10, 28, 16], [4, 22, 8, 24], [8, 24, 7, 29], [22, 24, 27, 27]];
      for (const [x0, y0, x1, y1] of lines) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n); p.px(x, y, '#3a3548'); p.px(x + 1, y, '#c4bfd4'); }
      }
    }));
  }
  // Moving platform: a grassy slab.
  function lift() {
    return memo('lift', () => render(64, 16, p => {
      p.rect(0, 2, 64, 14, '#5d3a24'); p.rect(1, 3, 62, 12, '#9d6236'); p.rect(2, 10, 60, 4, '#7b4a2b');
      for (let x = 0; x < 64; x++) { const gd = 4 + Math.round(Math.sin(x * 0.6) * 1); for (let y = 0; y < gd; y++) p.px(x, 2 + y, y < 1 ? '#b5f26a' : y < 2 ? '#7ddb4e' : '#52b83f'); p.px(x, 2 + gd, '#2a7a35'); if (hash(x * 3.3) > 0.5) { p.px(x, 1, '#8fe358'); if (hash(x) > 0.6) p.px(x, 0, '#c9fb86'); } }
      p.rect(0, 2, 1, 14, '#5d3a24'); p.rect(63, 2, 1, 14, '#5d3a24'); p.rect(0, 15, 64, 1, '#3f2616');
      for (const [x, y] of [[8, 11], [30, 12], [50, 11]]) { p.rect(x, y, 3, 2, '#b99069'); p.rect(x, y + 2, 3, 1, '#5d3a24'); }
    }));
  }
  // Floating log.
  function log() {
    return memo('log', () => render(64, 16, p => {
      p.rect(2, 2, 60, 13, '#5a3418'); p.rect(3, 3, 58, 11, '#9a5e2e'); p.rect(3, 3, 58, 2, '#c98a4e'); p.rect(3, 11, 58, 3, '#7a4620');
      for (let x = 6; x < 60; x += 9) { p.rect(x, 5, 1, 7, '#7a4620'); p.rect(x + 3, 4, 1, 8, '#b87438'); }
      p.rect(0, 4, 3, 9, '#5a3418'); p.rect(1, 5, 2, 7, '#d9a66a'); p.rect(1, 7, 1, 3, '#9a5e2e');
      p.rect(61, 4, 3, 9, '#5a3418'); p.rect(61, 5, 2, 7, '#c98a4e');
      p.rect(2, 2, 60, 1, '#e6c08a');
    }));
  }
  function caveSky(w, h) {
    return memo('cavesky', () => render(w, h, (p, c) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#12152b'); g.addColorStop(0.6, '#1f2446'); g.addColorStop(1, '#2a3058');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // glowing crystals
      for (let k = 0; k < 26; k++) {
        const x = Math.floor(hash(k * 7.1) * w), y = Math.floor(hash(k * 3.3) * h * 0.8), col = k % 3 === 0 ? '#7fe8ff' : k % 3 === 1 ? '#c58dff' : '#8fffd0';
        p.alpha(0.12, () => p.disc(x, y, 6, col)); p.alpha(0.6, () => { p.px(x, y, col); p.px(x + 1, y, col); p.px(x, y + 1, col); });
      }
      // stalactites along the top
      for (let x = 0; x < w; x += 9) { const hh = 6 + Math.floor(hash(x) * 22); for (let y = 0; y < hh; y++) { const ww = Math.max(1, Math.round(4 * (1 - y / hh))); p.rect(x - ww, y, ww * 2, 1, y < 2 ? '#3a3650' : '#262238'); } }
    }));
  }

  // ----- pipe -----
  const PIPE_BANDS = [[0.07, '#2f9a3e'], [0.13, '#76dd5a'], [0.2, '#c7f9a2'], [0.27, '#92ec70'], [0.52, '#4fc64a'], [0.74, '#3aa840'], [0.9, '#2c8a38'], [1.01, '#216d30']];
  function pipeRect(p, x, y, w, h, outline) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w;
      let k = 0; while (u > PIPE_BANDS[k][0]) k++;
      let col = PIPE_BANDS[k][1];
      if (k > 0 && u - PIPE_BANDS[k - 1][0] < 0.035 && bay(x + i, y + j) < 0.5) col = PIPE_BANDS[k - 1][1];
      if (k < PIPE_BANDS.length - 1 && PIPE_BANDS[k][0] - u < 0.035 && bay(x + i, y + j) < 0.35) col = PIPE_BANDS[k + 1][1];
      p.px(x + i, y + j, col);
    }
    p.rect(x, y, w, 1, outline); p.rect(x, y + h - 1, w, 1, outline); p.rect(x, y, 1, h, outline); p.rect(x + w - 1, y, 1, h, outline);
  }
  function pipe(hPx) {
    return memo('pipe' + hPx, () => render(64, hPx, p => {
      pipeRect(p, 4, 18, 56, hPx - 18, '#143f1d');
      p.alpha(0.35, () => p.rect(5, 20, 54, 5, '#0e3a18'));
      p.alpha(0.18, () => p.rect(5, 25, 54, 3, '#0e3a18'));
      pipeRect(p, 0, 0, 64, 20, '#143f1d');
      p.rect(1, 1, 62, 1, '#d8ffb8'); p.rect(1, 17, 62, 2, '#1d6a2e'); p.rect(1, 16, 62, 1, '#2a8a38');
    }));
  }

  // ----- water -----
  // Back layer sits behind entities; the front layer is a translucent tint
  // with the surface line and caustics drawn over them.
  const WATER_COLS = ['#54b4f4', '#3b93e6', '#2a6fc8', '#1f5aa8'];
  function waterBack(depth, frame) {
    return memo(`wb${depth}${frame}`, () => render(T, T, p => {
      const col = WATER_COLS[Math.min(depth, 3)], nxt = WATER_COLS[Math.min(depth + 1, 3)];
      p.rect(0, 0, T, T, col);
      for (let x = 0; x < T; x++) for (let k = -1; k <= 1; k++) p.px(x, T - 2 + k, bay(x, k) < (k + 2) / 4 ? nxt : col);
      if (depth === 0) {
        // surface: the top 4 px are air so the wavy line can sit inside the tile
        p.c.clearRect(0, 0, T, 4);
        for (let x = 0; x < T; x++) {
          const wy = 4 + Math.round(Math.sin((x + frame * 8) * 0.28) * 1.4);
          p.c.clearRect(x, 0, 1, wy);
          p.px(x, wy, '#f1fcff'); p.px(x, wy + 1, '#a8e4ff'); p.px(x, wy + 2, '#78c8f8');
          if (((x >> 2) & 1) === 0) p.px(x, wy + 3, '#8fd6ff');
        }
      }
    }));
  }
  function waterFront(depth, frame) {
    return memo(`wf${depth}${frame}`, () => render(T, T, p => {
      const ctx = p.c;
      ctx.clearRect(0, 0, T, T);
      p.alpha(0.3, () => p.rect(0, depth === 0 ? 4 : 0, T, depth === 0 ? T - 4 : T, '#2f86dd'));
      if (depth === 0) {
        for (let x = 0; x < T; x++) {
          const wy = 4 + Math.round(Math.sin((x + frame * 8) * 0.28) * 1.4);
          p.px(x, wy, '#f1fcff'); p.alpha(0.6, () => p.px(x, wy + 1, '#a8e4ff'));
        }
      }
      for (let k = 0; k < 4; k++) {
        const x = 4 + Math.floor(hash(k * 7.7 + depth) * 24), y = 6 + Math.floor(hash(k * 3.1 + depth * 5 + frame) * 22);
        p.alpha(0.45, () => { p.px(x, y, '#d8f6ff'); p.px(x + 1, y, '#d8f6ff'); p.px(x, y + 1, '#bfeaff'); });
      }
    }));
  }

  // ----- background layers -----
  const BG = {
    grass: {
      sky: [[0, '#4a97ee'], [0.45, '#7cc0fa'], [0.78, '#b4e2ff'], [1, '#d6f1ff']], haze: 'rgba(255,248,225,0.30)', sun: { x: 560, y: 60, r: 22, cols: ['#fff6c0', '#ffe98a', '#fff2a8', '#fff9cf', '#fffdea', '#ffd96a'] },
      cloud: ['#ffffff', '#f2f9ff', '#d6eafa', '#b4d4ee'],
      hillA: ['#9beb83', '#6dd16f', '#48ae62', '#32895a'], hillB: ['#b0f28f', '#84e07e', '#5ec46e', '#42a064'], rimA: '#3f9f5e', rimB: '#4aa966', dot: '#3f9f5e',
    },
    sand: {
      sky: [[0, '#5a4a9e'], [0.35, '#c86a8e'], [0.65, '#ff9a6a'], [0.88, '#ffcf8a'], [1, '#fff0c0']], haze: 'rgba(255,230,180,0.35)', sun: { x: 470, y: 150, r: 34, cols: ['#ffd0a0', '#ff9a4a', '#ffb060', '#ffd080', '#fff0b0', '#ff8a3a'] },
      cloud: ['#fff4f2', '#ffdce0', '#ffbccc', '#e894ac'],
      hillA: ['#ffe9b0', '#f2cf80', '#d9ad5c', '#b58a40'], hillB: ['#fff0c4', '#f7d994', '#e0ba6a', '#c0964a'], rimA: '#c89a4a', rimB: '#d4a858', dot: '#b58a40',
    },
  };
  function sky(w, h, groundY, theme = 'grass') {
    const th = BG[theme] || BG.grass;
    return memo('sky' + theme, () => render(w, h, (p, c) => {
      const g = c.createLinearGradient(0, 0, 0, groundY);
      for (const [k, col] of th.sky) g.addColorStop(k, col);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const hz = c.createLinearGradient(0, groundY - 106, 0, groundY);
      hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(0.6, 'rgba(255,255,255,0.22)'); hz.addColorStop(1, th.haze);
      c.fillStyle = hz; c.fillRect(0, groundY - 106, w, 106);
      const { x: sx, y: sy, r, cols } = th.sun;
      p.alpha(0.10, () => p.disc(sx, sy, r * 2.4, cols[0])); p.alpha(0.14, () => p.disc(sx, sy, r * 1.8, cols[0])); p.alpha(0.22, () => p.disc(sx, sy, r * 1.35, cols[0]));
      p.disc(sx, sy, r, cols[1]); p.disc(sx, sy, r - 2, cols[2]); p.disc(sx - 1, sy - 1, Math.round(r * 0.68), cols[3]); p.disc(sx - 3, sy - 3, Math.round(r * 0.4), cols[4]);
      const r2 = (r - 2) * (r - 2), r1 = r2 * 0.82;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r2 && x * x + y * y > r1 && bay(x, y) > 0.5) p.px(sx + x, sy + y, cols[5]);
      if (theme === 'sand') for (let y = sy + 4; y < groundY; y += 6) p.alpha(0.18, () => p.rect(sx - 40 + Math.round(Math.sin(y) * 6), y, 80, 2, '#fff0b0'));
    }));
  }
  function cloudInto(p, x, y, w, ramp) {
    const k = w / 92;
    const Td = [[18, 9, 11], [38, 2, 16], [60, 5, 14], [77, 11, 10], [44, 12, 14], [27, 13, 12], [64, 13, 12], [52, 6, 15]];
    const d = Td.map(([a, b, r]) => [Math.round(x + a * k), Math.round(y + b * k), Math.round(r * k)]);
    p.blob(d, ramp, { clipY: y + Math.round(21 * k), off: 0.6, scale: 1.75 });
  }
  // A horizontally repeating strip of clouds.
  function clouds(w, h, theme = 'grass') {
    const ramp = (BG[theme] || BG.grass).cloud;
    return memo('clouds' + theme, () => render(w, h, p => {
      const list = [[40, 50, 92], [280, 86, 74], [470, 60, 108], [700, 40, 80], [900, 96, 60], [1080, 56, 96]];
      for (const [x, y, cw] of list) { cloudInto(p, x, y, cw, ramp); if (x + cw * 1.1 > w) cloudInto(p, x - w, y, cw, ramp); }
    }));
  }
  function hillInto(p, cx, r, hgt, ramp, rim, G, dot) {
    const top = G - hgt;
    for (let x = cx - r; x <= cx + r; x++) {
      const u = (x + .5 - cx) / r;
      const h = Math.sqrt(Math.max(0, 1 - u * u)) * hgt;
      const y0 = Math.floor(G - h);
      for (let y = y0; y < G; y++) {
        const fy = (y - top) / hgt;
        let t = 0.9 + u * 0.9 + (fy - 0.4) * 1.3;
        if (((x * 7 + y * 3) % 23) === 0 && y > y0 + 6) t += 0.9;
        p.px(x, y, p.pick(ramp, t, x, y, 0.8));
      }
      if (y0 < G) p.px(x, y0, rim);
    }
    for (let k = 0; k < 4; k++) {
      const hx = cx + Math.round((hash(cx + k) - 0.5) * r * 1.2), hy = G - Math.round(hgt * (0.15 + hash(cx * 2 + k) * 0.5));
      p.px(hx, hy, dot); p.px(hx + 1, hy - 1, dot); p.px(hx - 1, hy - 1, dot); p.px(hx, hy - 1, dot); p.px(hx, hy - 2, dot);
    }
  }
  // Repeating strip of hills; the bottom of the strip is the ground line.
  function hills(w, h, theme = 'grass') {
    const th = BG[theme] || BG.grass;
    return memo('hills' + theme, () => render(w, h, p => {
      const G = h;
      const list = [[300, 80, 80, th.hillB, th.rimB], [120, 88, 88, th.hillA, th.rimA], [530, 56, 56, th.hillA, th.rimA], [760, 70, 64, th.hillB, th.rimB], [980, 96, 92, th.hillA, th.rimA], [1180, 60, 52, th.hillB, th.rimB]];
      for (const [cx, r, hg, ramp, rim] of list) { hillInto(p, cx, r, hg, ramp, rim, G, th.dot); if (cx + r > w) hillInto(p, cx - w, r, hg, ramp, rim, G, th.dot); if (cx - r < 0) hillInto(p, cx + w, r, hg, ramp, rim, G, th.dot); }
    }));
  }

  // ----- decorations (drawn in the world layer, sitting on the ground) -----
  const bushRamp = ['#a4f085', '#6fd45c', '#46b04a', '#2c8a3c'];
  function bush(s) {
    const w = Math.round(60 * s), h = Math.round(34 * s);
    return memo('bush' + s, () => render(w, h, p => {
      const x = 0, y = h;
      const d = [[x + 12 * s, y - 14 * s, 10 * s], [x + 28 * s, y - 20 * s, 13 * s], [x + 46 * s, y - 14 * s, 11 * s], [x + 22 * s, y - 8 * s, 10 * s], [x + 38 * s, y - 8 * s, 10 * s]].map(a => a.map(Math.round));
      p.blob(d, bushRamp, { clipY: y - 1, outline: '#1f6a35', off: 0.75, scale: 1.8 });
      for (const [lx, ly] of [[14, -20], [26, -28], [36, -24], [46, -20], [20, -12]]) {
        p.px(x + lx * s, y + ly * s, '#c8ffb0'); p.px(x + lx * s + 1, y + ly * s, '#c8ffb0'); p.px(x + lx * s, y + ly * s + 1, '#9af080');
      }
    }));
  }
  const FLOWER = ['...ooo...', '..ooCoo..', '.ooCCCoo.', '..ooCoo..', '...ooo...', '....s....', '..l.s.l..', '...lsl...', '....s....'];
  function flower(kind) {
    const cols = kind === 0 ? ['#ff7aa6', '#d9456f'] : kind === 1 ? ['#ffffff', '#cfd9f0'] : ['#ffd25e', '#e0a020'];
    return memo('flower' + kind, () => render(9, 9, p => {
      p.blit(FLOWER, { o: cols[0], O: cols[1], C: '#ffe27a', s: '#2f9438', l: '#58c548' }, 0, 0);
      p.px(3, 1, '#ffffff'); p.px(2, 2, '#ffffff');
    }));
  }
  function lily() {
    return memo('lily', () => render(24, 12, p => {
      const x = 0, y = 5;
      const pad = ['#7de05a', '#4cbc45', '#2f9438'];
      for (let j = 0; j < 7; j++) for (let i = 0; i < 24; i++) {
        const dx = (i + .5 - 12) / 12, dy = (j + .5 - 3.5) / 3.5;
        if (dx * dx + dy * dy > 1) continue;
        if (i >= 12 && i <= 15 && j >= 2 && j <= 3 && dy < 0.2) continue;
        p.px(x + i, y + j, p.pick(pad, 1.2 + dy * 1.3 - dx * 0.2, x + i, y + j, 0.5));
      }
      for (let i = 0; i < 24; i++) { const dx = (i + .5 - 12) / 12; const h = Math.round(3.5 * Math.sqrt(Math.max(0, 1 - dx * dx))); if (h > 0) p.px(x + i, y + 3 + h, '#1f6e32'); }
      p.rect(x + 5, y - 1, 5, 1, '#ffd0e0'); p.rect(x + 4, y, 7, 2, '#ff8fb4'); p.rect(x + 6, y - 3, 3, 3, '#ffb3cc'); p.px(x + 7, y - 4, '#ffdfe8'); p.rect(x + 6, y, 3, 1, '#ffe27a');
    }));
  }
  // Flagpole: a tall pole with a ball on top, height in px.
  function pole(hPx) {
    return memo('pole' + hPx, () => render(12, hPx, p => {
      p.rect(4, 10, 4, hPx - 10, '#4a5a66'); p.rect(5, 10, 1, hPx - 10, '#c8d6e0'); p.rect(4, 10, 1, hPx - 10, '#8aa0b0'); p.rect(7, 10, 1, hPx - 10, '#2f3a44');
      p.disc(6, 6, 5, '#2f8a3a'); p.disc(6, 6, 4, '#58c84a'); p.disc(5, 5, 2, '#b8f29a'); p.px(4, 4, '#ffffff');
      p.rect(2, hPx - 4, 8, 4, '#5a6a76'); p.rect(2, hPx - 4, 8, 1, '#c8d6e0');
    }));
  }
  function shadow(rx) {
    return memo('shadow' + rx, () => render(rx * 2, 4, p => {
      p.alpha(0.25, () => { for (let y = -2; y <= 1; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / 4.01)); p.rect(rx - w, 2 + y, w * 2, 1, '#1a3a1a'); } });
    }));
  }

  window.TILES = { T, GROUND_OVER, THEMES, ground, crack, lift, log, caveSky, questionBlock, usedBlock, brick, pipe, waterBack, waterFront, sky, clouds, hills, bush, flower, lily, pole, shadow };
})();
