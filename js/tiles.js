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
    // nyc buildings: brownstone brick with concrete ledges; streets use nycroad
    nyc: {
      dirt: ['#a8655a', '#8a4e44', '#683a32', '#46261f'], grass: ['#d4d4dc', '#b4b4c0', '#8c8c9a', '#606070'],
      grassLine: '#4a4a58', dark: '#2e1a16', mid: '#46261f', blades: ['#d4d4dc', '#b4b4c0', '#8c8c9a'], noBlades: true,
      pebble: ['#c08a7a', '#3a201a', '#8a5a4a'],
    },
    nycroad: {
      dirt: ['#50505c', '#40404a', '#30303a', '#202028'], grass: ['#cfcfd8', '#aeaeba', '#848492', '#5a5a68'],
      grassLine: '#44444f', dark: '#16161c', mid: '#202028', blades: ['#cfcfd8', '#aeaeba', '#848492'], noBlades: true,
      pebble: ['#6a6a78', '#16161c', '#3c3c48'],
    },
    // plex: campus lawn over warm concrete; the data center is dark raised flooring
    plex: {
      dirt: ['#e6e3dc', '#cfcbc2', '#aaa59a', '#7e7a70'], grass: ['#c8f58a', '#8fdc5a', '#5ebf45', '#3c9a36'],
      grassLine: '#2d7a30', dark: '#5c584f', mid: '#7e7a70', blades: ['#d8ff9a', '#9ae860', '#62c84a'],
      pebble: ['#f4f2ee', '#8a867c', '#c4c0b6'],
    },
    // plex buildings: flat Material slabs in the four logo colors (plex0..3) and glass (plex4)
    plex0: { dirt: ['#7baaf7', '#4285f4', '#3367d6', '#2a56c6'], grass: ['#c6dafc', '#a1c2fa', '#7baaf7', '#4285f4'], grassLine: '#2a56c6', dark: '#1c3aa9', mid: '#2a56c6', blades: [], noBlades: true, pebble: ['#c6dafc', '#1c3aa9', '#3367d6'], flat: true },
    plex1: { dirt: ['#f07b72', '#ea4335', '#d93025', '#c5221f'], grass: ['#fad2cf', '#f6aea9', '#f07b72', '#ea4335'], grassLine: '#c5221f', dark: '#a50e0e', mid: '#c5221f', blades: [], noBlades: true, pebble: ['#fad2cf', '#a50e0e', '#d93025'], flat: true },
    plex2: { dirt: ['#fdd663', '#fbbc04', '#f9ab00', '#f29900'], grass: ['#feefc3', '#fde293', '#fdd663', '#fbbc04'], grassLine: '#e37400', dark: '#b06000', mid: '#e37400', blades: [], noBlades: true, pebble: ['#feefc3', '#b06000', '#f29900'], flat: true },
    plex3: { dirt: ['#5bb974', '#34a853', '#1e8e3e', '#188038'], grass: ['#ceead6', '#a8dab5', '#81c995', '#34a853'], grassLine: '#188038', dark: '#0d652d', mid: '#188038', blades: [], noBlades: true, pebble: ['#ceead6', '#0d652d', '#1e8e3e'], flat: true },
    plex4: { dirt: ['#e8f0fe', '#d2e3fc', '#aecbfa', '#8ab4f8'], grass: ['#ffffff', '#f1f3f4', '#e8eaed', '#dadce0'], grassLine: '#9aa0a6', dark: '#5f6368', mid: '#9aa0a6', blades: [], noBlades: true, pebble: ['#ffffff', '#5f6368', '#aecbfa'], flat: true },
    // snow: packed snow over frozen earth; ice is slick (handled in physics); cabin is log walls
    snow: {
      dirt: ['#b9c6dc', '#95a6c4', '#7384a4', '#55657f'], grass: ['#ffffff', '#f2f7ff', '#dde8f8', '#c3d3ec'],
      grassLine: '#a9bbd8', dark: '#44536b', mid: '#55657f', blades: ['#ffffff', '#eaf2ff', '#d0deF4'], noBlades: true,
      pebble: ['#ffffff', '#55657f', '#95a6c4'],
    },
    ice: {
      dirt: ['#bfeaff', '#8fd3ff', '#5fb8f5', '#3a93d6'], grass: ['#ffffff', '#e6f7ff', '#bfeaff', '#8fd3ff'],
      grassLine: '#5fb8f5', dark: '#2a6ea8', mid: '#3a93d6', blades: [], noBlades: true, flat: true,
      pebble: ['#ffffff', '#2a6ea8', '#8fd3ff'],
    },
    cabin: {
      dirt: ['#b07a4a', '#8c5a32', '#6a4024', '#4a2c18'], grass: ['#d8a06a', '#b07a4a', '#8c5a32', '#6a4024'],
      grassLine: '#4a2c18', dark: '#2e1a0e', mid: '#4a2c18', blades: [], noBlades: true, flat: true,
      pebble: ['#d8a06a', '#2e1a0e', '#8c5a32'],
    },
    dc: {
      dirt: ['#4a5068', '#3a4058', '#2c3146', '#1e2234'], grass: ['#aeb8d0', '#8a96b4', '#66708c', '#464e68'],
      grassLine: '#2c3146', dark: '#141828', mid: '#1e2234', blades: ['#aeb8d0', '#8a96b4', '#66708c'], noBlades: true,
      pebble: ['#6a748c', '#141828', '#3a4058'],
    },
    // mansion: purple stone blocks under a red carpet runner
    mansion: {
      dirt: ['#7a5a8e', '#5e4472', '#463256', '#30213c'], grass: ['#ff7a86', '#d8445a', '#a82e46', '#6e1e30'],
      grassLine: '#4a1424', dark: '#231830', mid: '#30213c', blades: ['#ffd36a', '#ffb347', '#d8445a'],
      pebble: ['#a88ab8', '#2a1c3a', '#6e5480'],
    },
  };
  const grassDepth = x => 9 + Math.round(Math.sin(x * 0.45) * 1.5 + Math.sin(x * 1.3 + 1) * 1.2 + (hash(x) - 0.5) * 2.5);
  const flatDepth = () => 4;

  // Ground tile canvas is 32x38: 6 px of grass blades overhang above the tile.
  const GROUND_OVER = 6;
  function ground(variant, top, bottom, left, right, theme = 'grass') {
    const th = THEMES[theme], dirtRamp = th.dirt, grassRamp = th.grass;
    return memo(`g${theme}${variant}${+top}${+bottom}${+left}${+right}`, () => render(T, T + GROUND_OVER, p => {
      const ox = variant * T;
      for (let i = 0; i < T; i++) {
        const x = ox + i, gd = top ? (th.flat ? flatDepth() : grassDepth(x)) : 0;
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
        if (top && !th.noBlades) {
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
      for (let k = 0; k < (th.flat ? 0 : 3); k++) {
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
      if (th.flat) {
        p.rect(0, GROUND_OVER + (top ? grassDepth(ox) : 0), T, 1, th.grass[0]); p.rect(0, GROUND_OVER + T - 1, T, 1, th.dark);
        if (theme === 'plex4') { for (let j = 6; j < T - 4; j += 10) for (let i = 4; i < T - 4; i += 10) { p.rect(i, GROUND_OVER + j, 7, 6, hash(ox + i + j * 3) > 0.35 ? '#fff8d6' : '#aecbfa'); p.rect(i, GROUND_OVER + j, 7, 1, '#ffffff'); } }
        else if (!top) { p.rect(0, GROUND_OVER + 15, T, 1, th.dark); p.rect(16 * ((variant) % 2), GROUND_OVER, 1, 16, th.dark); p.rect(16 * ((variant + 1) % 2), GROUND_OVER + 16, 1, 16, th.dark); }
      }
      if (theme === 'snow' && top) { for (let i = 0; i < T; i += 5) if (hash(ox + i) > 0.5) p.px(i, GROUND_OVER + 1 + (i % 3), '#ffffff'); }
      if (theme === 'ice') { for (let k = 0; k < 3; k++) { const gx = 4 + Math.floor(hash(variant * 3.1 + k) * 20), gy = 8 + Math.floor(hash(variant + k * 2) * 18); p.alpha(0.7, () => { p.px(gx, GROUND_OVER + gy, '#ffffff'); p.px(gx + 1, GROUND_OVER + gy + 1, '#ffffff'); p.px(gx + 2, GROUND_OVER + gy + 2, '#ffffff'); }); } }
      if (theme === 'cabin') { for (let j = 0; j < T; j += 8) { p.rect(0, GROUND_OVER + j, T, 1, '#4a2c18'); p.rect(0, GROUND_OVER + j + 1, T, 1, '#d8a06a'); p.rect(0, GROUND_OVER + j + 6, T, 1, '#6a4024'); } p.rect(14 + (variant % 2) * 8, GROUND_OVER + 2, 1, 5, '#6a4024'); }
      if (theme === 'nyc') for (let j = (top ? 12 : 0); j < T; j += 6) { p.rect(0, GROUND_OVER + j, T, 1, '#5a3028'); for (let i = ((j / 6) % 2) * 8; i < T; i += 16) p.rect(i, GROUND_OVER + j, 1, 6, '#5a3028'); }
      if (theme === 'nycroad' && top) { p.rect(0, GROUND_OVER + 7, T, 1, '#f2c84a'); if (variant % 2 === 0) p.rect(4, GROUND_OVER + 20, 18, 2, '#e8e8d0'); }
      // data center: raised floor tiles with a status LED on the top edge
      if (theme === 'dc') { p.rect(0, GROUND_OVER + (top ? 8 : 0), 1, T, '#141828'); p.rect(0, GROUND_OVER + 16, T, 1, '#141828'); if (top) p.rect(6 + variant * 6, GROUND_OVER + 3, 2, 2, ['#34a853', '#4285f4', '#fbbc04', '#ea4335'][variant]); }
      // exposed edges
      if (bottom) { p.rect(0, GROUND_OVER + T - 2, T, 2, th.dark); p.rect(0, GROUND_OVER + T - 3, T, 1, th.mid); }
      if (left) { p.rect(0, GROUND_OVER + (top ? 2 : 0), 1, T, top ? th.grassLine : th.dark); p.rect(0, GROUND_OVER + (top ? (th.flat ? flatDepth() : grassDepth(ox)) : 0), 1, T, th.dark); }
      if (right) { p.rect(T - 1, GROUND_OVER + (top ? (th.flat ? flatDepth() : grassDepth(ox + T - 1)) : 0), 1, T, th.dark); }
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
  const GCOLS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
  function card(p) { p.rect(0, 0, 32, 32, '#9aa0a6'); p.rect(1, 1, 30, 30, '#ffffff'); p.rect(1, 29, 30, 2, '#dadce0'); p.rect(29, 1, 2, 30, '#e8eaed'); p.rect(1, 1, 30, 1, '#ffffff'); }
  function plexQuestion(frame) {
    return memo('pq' + frame, () => render(T, T, p => {
      card(p);
      for (let i = 0; i < 4; i++) p.rect(4 + i * 6, 25, 6, 3, GCOLS[i]);
      const gx = 10, gy = 6;
      for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) if (QG[j][i] === 'Q') p.px(gx + i, gy + j, GCOLS[(Math.floor((i + j + frame * 3) / 6)) % 4]);
      if (frame > 0) { const gx2 = 4 + frame * 7; p.alpha(0.45, () => { p.rect(gx2, 3, 2, 20, '#ffffff'); p.rect(gx2 + 3, 3, 1, 20, '#ffffff'); }); }
    }));
  }
  function plexUsed() {
    return memo('pused', () => render(T, T, p => {
      p.rect(0, 0, 32, 32, '#9aa0a6'); p.rect(1, 1, 30, 30, '#f1f3f4'); p.rect(1, 29, 30, 2, '#dadce0');
      for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const d = x * x + y * y; if (d > 81 || d < 36) continue; if (x > 1 && Math.abs(y) < 4) continue; const a = Math.atan2(y, x); p.px(16 + x, 16 + y, a < -Math.PI / 2 ? '#ea4335' : a < 0 ? '#fbbc04' : a < Math.PI / 2 ? '#34a853' : '#4285f4'); }
      p.rect(16, 14, 9, 3, '#4285f4');
    }));
  }
  function plexBrick() {
    return memo('pbrick', () => render(T, T, p => {
      card(p); p.rect(1, 1, 30, 4, '#4285f4'); p.rect(1, 5, 30, 1, '#3367d6');
      p.rect(5, 10, 22, 2, '#dadce0'); p.rect(5, 15, 16, 2, '#dadce0'); p.rect(5, 20, 20, 2, '#dadce0');
      p.rect(22, 15, 5, 2, '#34a853');
    }));
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
  // Iron gate bars that seal the boss arena.
  function gate() {
    return memo('gate', () => render(T, T, p => {
      p.rect(0, 0, T, T, '#1a1024');
      for (const x of [4, 13, 22]) { p.rect(x, 0, 5, T, '#5a5a6e'); p.rect(x, 0, 1, T, '#8a8aa0'); p.rect(x + 4, 0, 1, T, '#2e2e3c'); }
      p.rect(0, 6, T, 3, '#4a4a5c'); p.rect(0, 6, T, 1, '#7a7a90'); p.rect(0, 22, T, 3, '#4a4a5c'); p.rect(0, 22, T, 1, '#7a7a90');
      for (const x of [4, 13, 22]) { p.rect(x + 1, 2, 3, 2, '#c9a04a'); p.px(x + 2, 1, '#ffd36a'); }
    }));
  }
  // Moving platform: a grassy slab.
  function lift(theme) {
    // plex: a floating search bar
    if (theme === 'plex' || theme === 'dc') return memo('lift' + theme, () => render(64, 16, p => {
      p.rect(0, 2, 64, 14, '#9aa0a6'); p.rect(1, 3, 62, 12, '#ffffff'); p.rect(1, 3, 62, 1, '#e8eaed'); p.rect(1, 13, 62, 2, '#dadce0');
      p.rect(0, 8, 1, 2, '#9aa0a6'); p.rect(63, 8, 1, 2, '#9aa0a6'); p.px(0, 2, '#ffffff'); p.px(63, 2, '#ffffff'); p.px(0, 15, '#ffffff'); p.px(63, 15, '#ffffff');
      p.rect(6, 6, 1, 6, '#4285f4'); p.rect(10, 8, 18, 2, '#dadce0');
      // magnifying glass
      p.rect(50, 5, 5, 1, '#4285f4'); p.rect(50, 10, 5, 1, '#4285f4'); p.rect(49, 6, 1, 4, '#4285f4'); p.rect(55, 6, 1, 4, '#4285f4'); p.rect(55, 11, 2, 1, '#4285f4'); p.rect(57, 12, 2, 1, '#4285f4');
    }));
    if (theme === 'snow' || theme === 'cabin') return memo('lift' + theme, () => render(64, 16, p => {
      p.rect(0, 2, 64, 14, '#2a6ea8'); p.rect(1, 3, 62, 12, '#8fd3ff'); p.rect(1, 3, 62, 3, '#ffffff'); p.rect(1, 6, 62, 2, '#e6f7ff'); p.rect(1, 12, 62, 3, '#5fb8f5');
      for (let x = 6; x < 64; x += 14) { p.rect(x, 8, 1, 3, '#ffffff'); p.rect(x + 1, 9, 1, 3, '#ffffff'); }
      for (let x = 2; x < 64; x += 9) { p.rect(x, 0, 4, 3, '#ffffff'); p.rect(x + 1, -1, 2, 2, '#ffffff'); }
    }));
    if (theme === 'mansion' || theme === 'cave') return memo('lift' + theme, () => render(64, 16, p => {
      const wood = theme === 'mansion' ? ['#8a5a3a', '#6a4028', '#4a2c1c', '#2a1810'] : ['#7a7490', '#5c566e', '#443e52', '#2a2636'];
      p.rect(0, 3, 64, 12, wood[3]); p.rect(1, 4, 62, 10, wood[1]); p.rect(1, 4, 62, 2, wood[0]); p.rect(1, 12, 62, 2, wood[2]);
      for (let x = 9; x < 64; x += 11) p.rect(x, 5, 1, 8, wood[2]);
      if (theme === 'mansion') { p.rect(0, 3, 64, 1, '#c9a04a'); p.rect(0, 14, 64, 1, '#c9a04a'); p.rect(2, 1, 3, 3, '#c9a04a'); p.rect(59, 1, 3, 3, '#c9a04a'); }
      else for (let x = 2; x < 64; x += 7) p.px(x, 4, '#8af0d8');
    }));
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
  // Haunted mansion interior: striped wallpaper, moonlit windows, portraits, candles.
  function mansionSky(w, h) {
    return memo('mansionsky', () => render(w, h, (p, c) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a1024'); g.addColorStop(0.7, '#2c1a3c'); g.addColorStop(1, '#3a2450');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 24) { p.alpha(0.18, () => p.rect(x, 24, 10, h - 24, '#5a3a78')); p.alpha(0.08, () => p.rect(x + 14, 24, 3, h - 24, '#ffffff')); }
      // crown moulding and dado rail
      p.rect(0, 20, w, 6, '#4a2c5a'); p.rect(0, 20, w, 1, '#7a5290'); p.rect(0, 26, w, 2, '#2a1a36');
      p.rect(0, 228, w, 5, '#4a2c5a'); p.rect(0, 228, w, 1, '#7a5290'); p.rect(0, 233, w, 55, '#3a2448');
      for (let x = 0; x < w; x += 16) { p.rect(x, 240, 1, 48, '#2a1a36'); p.rect(x + 8, 236, 1, 52, '#4a3058'); }
      // moonlit arched windows
      for (const wx of [96, 420]) {
        for (let y = 0; y < 80; y++) for (let x = 0; x < 52; x++) {
          const dx = (x - 26) / 26, dy = y < 26 ? (26 - y) / 26 : 0;
          if (dx * dx + dy * dy > 1) continue;
          const t = (x + y * 0.5) / 80;
          p.px(wx + x, 60 + y, t < 0.35 ? '#9ab8ff' : t < 0.7 ? '#6f86d8' : '#4a5aa8');
        }
        for (let y = 0; y < 80; y++) { const dy = y < 26 ? (26 - y) / 26 : 0, hw = Math.floor(26 * Math.sqrt(Math.max(0, 1 - dy * dy))); p.px(wx + 26 - hw, 60 + y, '#1a1024'); p.px(wx + 25 + hw, 60 + y, '#1a1024'); }
        p.rect(wx + 25, 60, 2, 80, '#1a1024'); p.rect(wx, 100, 52, 2, '#1a1024'); p.rect(wx - 2, 138, 56, 4, '#5a3a78');
        p.alpha(0.12, () => p.rect(wx - 10, 140, 72, 90, '#9ab8ff'));
      }
      // moon in the first window
      p.disc(118, 78, 9, '#fff6d0'); p.disc(122, 76, 7, '#9ab8ff');
      // portraits
      for (const px0 of [230, 560]) { p.rect(px0, 70, 30, 40, '#8a6a30'); p.rect(px0 + 2, 72, 26, 36, '#c9a04a'); p.rect(px0 + 4, 74, 22, 32, '#1a1024'); p.rect(px0 + 10, 84, 10, 14, '#2e1e3e'); p.px(px0 + 12, 88, '#ff5a5a'); p.px(px0 + 17, 88, '#ff5a5a'); }
      // wall candles with glow
      for (const cx of [40, 300, 340, 600]) {
        p.alpha(0.14, () => p.disc(cx + 2, 150, 26, '#ffb347')); p.alpha(0.1, () => p.disc(cx + 2, 150, 14, '#ffd36a'));
        p.rect(cx, 160, 5, 14, '#f2e2c0'); p.rect(cx - 2, 174, 9, 4, '#a07a30'); p.rect(cx + 1, 152, 3, 8, '#ffb347'); p.rect(cx + 2, 150, 1, 4, '#fff3a6');
      }
      // cobwebs in the top corners
      for (let i = 0; i < 24; i++) { p.alpha(0.5, () => { p.px(i, 28 + i, '#bba8cc'); p.px(w - 1 - i, 28 + i, '#bba8cc'); p.px(2 * i, 28 + Math.floor(i / 2), '#bba8cc'); p.px(w - 1 - 2 * i, 28 + Math.floor(i / 2), '#bba8cc'); }); }
    }));
  }
  // Night-time Manhattan: deep blue sky, moon, and two parallax skyline strips.
  function citySky(w, h) {
    return memo('citysky', () => render(w, h, (p, c) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#07091c'); g.addColorStop(0.55, '#1a1540'); g.addColorStop(1, '#3a2458');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 60; k++) { const x = Math.floor(hash(k * 3.1) * w), y = Math.floor(hash(k * 7.7) * 150); p.alpha(0.5 + hash(k) * 0.5, () => p.px(x, y, k % 5 === 0 ? '#fff6d0' : '#c8d8ff')); }
      p.alpha(0.12, () => p.disc(530, 58, 40, '#fff6d0')); p.disc(530, 58, 22, '#fff1b8'); p.disc(538, 52, 18, '#1a1540'); p.alpha(0.35, () => p.disc(538, 52, 18, '#2a2050'));
    }));
  }
  function skyline(w, h, far) {
    return memo('skyline' + (far ? 'f' : 'n'), () => render(w, h, p => {
      const base = far ? ['#181838', '#202048'] : ['#262040', '#2e2650'];
      const win = far ? ['#5a5a80', '#8a7a60'] : ['#ffe9a0', '#ffd36a', '#9ad7ff'];
      let x = 0, k = 0;
      while (x < w) {
        const bw = (far ? 18 : 28) + Math.floor(hash(k * 1.7 + (far ? 9 : 0)) * (far ? 26 : 44));
        const bh = (far ? 40 : 30) + Math.floor(hash(k * 2.3 + (far ? 5 : 1)) * (far ? 90 : 110));
        const col = base[k % 2];
        p.rect(x, h - bh, bw, bh, col);
        p.rect(x, h - bh, bw, 1, far ? '#2a2a58' : '#4a4070');
        if (!far && hash(k * 4.1) > 0.6) { p.rect(x + Math.floor(bw / 2) - 1, h - bh - 10, 2, 10, col); p.px(x + Math.floor(bw / 2) - 1, h - bh - 11, '#ff5a5a'); }
        if (far && hash(k * 5.3) > 0.7) { const sp = Math.floor(bw * 0.3); p.rect(x + sp, h - bh - 12, bw - sp * 2, 12, col); }
        for (let wy = h - bh + 4; wy < h - 6; wy += far ? 5 : 7) for (let wx = x + 3; wx < x + bw - 3; wx += far ? 4 : 6) {
          const r = hash(wx * 0.37 + wy * 1.91 + k);
          if (r > (far ? 0.55 : 0.45)) p.rect(wx, wy, far ? 1 : 2, far ? 2 : 3, win[Math.floor(r * 10) % win.length]);
        }
        x += bw + (far ? 2 : 4); k++;
      }
    }));
  }
  // Cabin interior: log walls, a rug, a wreath, string lights and a window onto the snow.
  function cabinSky(w, h) {
    return memo('cabinsky', () => render(w, h, p => {
      for (let y = 0; y < h; y += 12) { p.rect(0, y, w, 12, (y / 12) % 2 ? '#a06a3e' : '#96623a'); p.rect(0, y, w, 1, '#c88a56'); p.rect(0, y + 10, w, 2, '#6a4024'); }
      for (let x = 0; x < w; x += 160) p.rect(x + 30, 0, 2, h, '#6a4024');
      // window with snow outside
      p.rect(380, 70, 90, 70, '#4a2c18'); p.rect(385, 75, 80, 60, '#9fb6dd'); p.rect(385, 75, 80, 20, '#7f98c8'); p.rect(385, 120, 80, 15, '#ffffff'); p.rect(424, 75, 2, 60, '#4a2c18'); p.rect(385, 104, 80, 2, '#4a2c18');
      for (let k = 0; k < 20; k++) p.px(388 + Math.floor(hash(k * 3.3) * 74), 78 + Math.floor(hash(k * 7.1) * 50), '#ffffff');
      // wreath
      p.disc(150, 100, 22, '#1e6a36'); p.disc(150, 100, 12, '#96623a'); for (let k = 0; k < 10; k++) { const a = k * 0.63; p.px(150 + Math.round(Math.cos(a) * 17), 100 + Math.round(Math.sin(a) * 17), k % 2 ? '#ff3b3b' : '#ffd23f'); } p.rect(144, 118, 12, 6, '#d9343c'); p.rect(148, 112, 4, 6, '#d9343c');
      // string lights along the top
      for (let x = 10; x < w; x += 18) { p.rect(x, 20 + (x / 18 % 2) * 4, 18, 1, '#2a1a10'); const c = ['#ff3b3b', '#ffd23f', '#4aa3ff', '#4dff88'][(x / 18) % 4 | 0]; p.rect(x + 8, 21 + (x / 18 % 2) * 4, 3, 4, c); p.alpha(0.25, () => p.disc(x + 9, 23 + (x / 18 % 2) * 4, 6, c)); }
      // shelf with mugs
      p.rect(520, 150, 100, 4, '#4a2c18'); for (let x = 530; x < 610; x += 22) { p.rect(x, 138, 12, 12, x % 44 ? '#e04848' : '#4aa3ff'); p.rect(x + 12, 141, 3, 6, x % 44 ? '#e04848' : '#4aa3ff'); }
      // floor rug
      p.rect(0, 240, w, 48, '#6a4024'); p.rect(60, 250, 300, 36, '#b23a3a'); p.rect(66, 256, 288, 24, '#d9545a'); for (let x = 70; x < 350; x += 12) p.rect(x, 264, 6, 8, '#f0c060');
    }));
  }
  // Data center hall: rows of server racks with blinking LEDs and cable trays.
  function dcSky(w, h) {
    return memo('dcsky', () => render(w, h, (p, c) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0c1020'), g.addColorStop(0.7, '#141a30'), g.addColorStop(1, '#1c2240');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // overhead cable trays and cold-aisle lights
      p.rect(0, 14, w, 4, '#2a3050'); p.rect(0, 14, w, 1, '#3e4668');
      for (let x = 20; x < w; x += 80) { p.rect(x, 18, 40, 3, '#e8f0ff'); p.alpha(0.08, () => p.rect(x - 20, 21, 80, 200, '#9ab8ff')); }
      const leds = ['#34a853', '#4285f4', '#fbbc04', '#ea4335'];
      for (let x = 8; x < w; x += 44) {
        p.rect(x, 60, 36, 228, '#1a1f36'); p.rect(x, 60, 36, 1, '#3e4668'); p.rect(x, 60, 1, 228, '#2c3350'); p.rect(x + 35, 60, 1, 228, '#0a0d18');
        for (let y = 66; y < 280; y += 12) {
          p.rect(x + 3, y, 30, 8, '#242b48'); p.rect(x + 3, y, 30, 1, '#343c5c');
          for (let k = 0; k < 4; k++) if (hash(x * 1.3 + y * 0.7 + k) > 0.45) p.rect(x + 6 + k * 3, y + 3, 2, 2, leds[(k + Math.floor(hash(x + y) * 4)) % 4]);
          if (hash(x + y * 2.1) > 0.8) p.rect(x + 20, y + 2, 10, 4, '#2e3658');
        }
      }
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
    // snow: dim overcast afternoon, snowy pine hills
    snow: {
      sky: [[0, '#5a6fa8'], [0.45, '#8fa3d0'], [0.8, '#c9d6ee'], [1, '#e8eef9']], haze: 'rgba(255,255,255,0.35)', sun: { x: 540, y: 70, r: 16, cols: ['#ffffff', '#f4f6ff', '#ffffff', '#ffffff', '#ffffff', '#e8ecff'] },
      cloud: ['#f4f6fb', '#e4e9f4', '#cdd6e8', '#b0bdd6'],
      hillA: ['#ffffff', '#e8eef9', '#c9d6ee', '#a4b6d8'], hillB: ['#ffffff', '#f0f4fb', '#d6e0f2', '#b4c4e0'], rimA: '#ffffff', rimB: '#ffffff', dot: '#2f6a46',
    },
    // plex: bright California noon, rolling green hills
    plex: {
      sky: [[0, '#3f8ff0'], [0.5, '#7cc4ff'], [0.8, '#c6e8ff'], [1, '#eaf7ff']], haze: 'rgba(255,255,240,0.30)', sun: { x: 560, y: 60, r: 20, cols: ['#fff8d0', '#fbbc04', '#ffd54a', '#ffe48a', '#fff4c0', '#f4a800'] },
      cloud: ['#ffffff', '#f4f9ff', '#dcecfb', '#bcd6ee'],
      hillA: ['#a8ee8a', '#78d46c', '#4fb45e', '#378e55'], hillB: ['#bdf59a', '#92e182', '#68c86e', '#48a262'], rimA: '#3f9f5e', rimB: '#4aa966', dot: '#3f9f5e',
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

  // Googleplex campus strip: low glass buildings with solar roofs, the Android
  // statue, the big sign, and the Bay hills behind. Bottom of the strip is the ground line.
  function campus(w, h) {
    return memo('campus', () => render(w, h, p => {
      const G = h;
      for (const [cx, r, hg] of [[200, 160, 50], [620, 220, 64], [1040, 180, 56]]) { for (let x = cx - r; x <= cx + r; x++) { const u = (x + .5 - cx) / r, hh = Math.sqrt(Math.max(0, 1 - u * u)) * hg; for (let y = Math.floor(G - 30 - hh); y < G - 30; y++) p.px(x, y, y < G - 30 - hh + 2 ? '#b9d8a8' : '#9cc48c'); if (cx + r > w) { for (let y = Math.floor(G - 30 - hh); y < G - 30; y++) p.px(x - w, y, '#9cc48c'); } } }
      p.rect(0, G - 30, w, 30, '#8fbf7c');
      // buildings
      const bl = [[20, 120, 70, '#e8eaed', '#4285f4'], [160, 90, 56, '#f1f3f4', '#ea4335'], [270, 150, 80, '#e8eaed', '#fbbc04'], [470, 100, 60, '#f8f9fa', '#34a853'], [600, 170, 72, '#e8eaed', '#4285f4'], [800, 110, 58, '#f1f3f4', '#ea4335'], [940, 140, 76, '#e8eaed', '#34a853'], [1110, 96, 54, '#f8f9fa', '#fbbc04']];
      for (const [x, bw, bh, body, trim] of bl) {
        const y0 = G - 24 - bh;
        p.rect(x, y0, bw, bh + 4, body); p.rect(x, y0, bw, 1, '#ffffff'); p.rect(x + bw - 1, y0, 1, bh + 4, '#bdc1c6'); p.rect(x, G - 21, bw, 1, '#bdc1c6');
        // solar panels on the roof
        for (let sx = x + 4; sx < x + bw - 10; sx += 12) { p.rect(sx, y0 - 5, 9, 4, '#1a2a5a'); p.rect(sx, y0 - 5, 9, 1, '#5b8def'); p.rect(sx + 4, y0 - 1, 1, 1, '#5f6368'); }
        // glass rows
        for (let wy = y0 + 6; wy < G - 28; wy += 10) { p.rect(x + 3, wy, bw - 6, 6, '#aecbfa'); p.rect(x + 3, wy, bw - 6, 1, '#d2e3fc'); for (let wx = x + 3; wx < x + bw - 3; wx += 9) p.rect(wx, wy, 1, 6, body); }
        p.rect(x, y0 + bh - 10, bw, 4, trim);
        // trees in front
        for (let tx = x + 6; tx < x + bw; tx += 34) { p.rect(tx + 3, G - 30, 2, 8, '#6b4a2b'); p.disc(tx + 4, G - 33, 6, '#5bb974'); p.disc(tx + 2, G - 35, 4, '#81c995'); }
      }
      // the big sign and the Android statue
      p.rect(390, G - 60, 6, 38, '#9aa0a6'); p.rect(360, G - 84, 66, 26, '#ffffff'); p.rect(360, G - 84, 66, 1, '#dadce0'); p.rect(360, G - 59, 66, 1, '#bdc1c6');
      GCOLS.forEach((c, i) => p.disc(371 + i * 15, G - 71, 5, c));
      const ax = 740, ay = G - 24;
      p.rect(ax - 10, ay - 38, 20, 22, '#3ddc84'); p.rect(ax - 12, ay - 16, 24, 2, '#27b468'); p.disc(ax, ay - 42, 10, '#3ddc84'); p.rect(ax - 10, ay - 42, 20, 4, '#3ddc84');
      p.px(ax - 4, ay - 45, '#ffffff'); p.px(ax + 4, ay - 45, '#ffffff'); p.rect(ax - 14, ay - 36, 3, 16, '#3ddc84'); p.rect(ax + 11, ay - 36, 3, 16, '#3ddc84'); p.rect(ax - 7, ay - 16, 5, 10, '#3ddc84'); p.rect(ax + 2, ay - 16, 5, 10, '#3ddc84');
      p.rect(ax - 6, ay - 52, 1, 4, '#27b468'); p.rect(ax + 6, ay - 52, 1, 4, '#27b468');
      p.rect(ax - 20, ay - 6, 40, 6, '#bdc1c6'); p.rect(ax - 20, ay - 6, 40, 1, '#e8eaed');
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
  // Googleplex campus sign: four colored balls on a white board, plus a
  // tall rainbow "G" totem for the big rooftop landmark.
  function plexSign() {
    return memo('plexsign', () => render(72, 40, p => {
      p.rect(2, 36, 68, 4, '#7e7a70'); p.rect(32, 20, 8, 16, '#9aa0a6'); p.rect(33, 20, 1, 16, '#dadce0');
      p.rect(0, 0, 72, 22, '#5f6368'); p.rect(1, 1, 70, 20, '#ffffff'); p.rect(1, 1, 70, 1, '#e8eaed');
      const cols = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
      cols.forEach((c, i) => { p.disc(11 + i * 17, 11, 6, c); p.px(9 + i * 17, 8, '#ffffff'); p.px(10 + i * 17, 8, '#ffffff'); p.px(9 + i * 17, 9, '#ffffff'); });
    }));
  }
  function gTotem() {
    return memo('gtotem', () => render(64, 64, p => {
      p.rect(28, 50, 8, 14, '#7e7a70'); p.rect(28, 50, 1, 14, '#aaa59a'); p.rect(22, 60, 20, 4, '#5c584f');
      const ring = fn => { for (let y = -22; y <= 22; y++) for (let x = -22; x <= 22; x++) { const d = x * x + y * y; if (d > 484 || d < 196) continue; if (x > 2 && Math.abs(y) < 10) continue; fn(x, y); } };
      ring((x, y) => { const a = Math.atan2(y, x); p.px(32 + x, 28 + y, a < -Math.PI / 2 ? '#ea4335' : a < 0 ? '#fbbc04' : a < Math.PI / 2 ? '#34a853' : '#4285f4'); });
      ring((x, y) => { if (x + y < -24 && hash(x * 3 + y) > 0.55) p.px(32 + x, 28 + y, '#ffffff'); });
      p.rect(34, 24, 20, 8, '#4285f4'); p.rect(34, 24, 20, 1, '#6fa3ff'); p.rect(34, 31, 20, 1, '#2a63c4');
    }));
  }
  // A string of holiday lights, w px wide, hung in a shallow swag.
  function lights(w) {
    return memo('lights' + w, () => render(w, 16, p => {
      const cols = ['#ff3b3b', '#ffd23f', '#4aa3ff', '#4dff88', '#ff8ad8'];
      for (let x = 0; x < w; x++) { const y = 2 + Math.round(Math.sin(x / w * Math.PI) * 5); p.px(x, y, '#1a2a1a'); if (x % 14 === 7) { const c = cols[(x / 14 | 0) % 5]; p.rect(x - 1, y + 1, 3, 5, c); p.px(x, y + 1, '#ffffff'); p.alpha(0.3, () => p.disc(x, y + 3, 6, c)); } }
    }));
  }
  // Falling snow: a tiling 320x320 layer with two sizes of flakes; scrolled in render.
  function snowLayer(k) {
    return memo('snowlayer' + k, () => render(320, 320, p => {
      for (let i = 0; i < 70; i++) { const x = Math.floor(hash(i * 4.7 + k * 99) * 320), y = Math.floor(hash(i * 9.1 + k * 7) * 320); if (k === 0) { p.rect(x, y, 2, 2, '#ffffff'); } else p.alpha(0.6, () => p.px(x, y, '#ffffff')); }
    }));
  }
  // Freestanding boards: the "404 NOT FOUND" sign and the offline dino banner.
  function plexBoard(kind) {
    return memo('board' + kind, () => render(96, 44, p => {
      p.rect(44, 30, 4, 14, '#9aa0a6'); p.rect(44, 30, 1, 14, '#dadce0');
      p.rect(0, 0, 96, 32, '#5f6368'); p.rect(1, 1, 94, 30, '#ffffff'); p.rect(1, 1, 94, 1, '#f1f3f4'); p.rect(1, 29, 94, 2, '#dadce0');
      if (kind === 'sign404') { p.text('404', 30, 5, 2, '#ea4335'); p.text('NOT FOUND', 22, 21, 1, '#5f6368'); }
      else { p.text('NO INTERNET', 15, 5, 1, '#202124'); p.text('PRESS SPACE', 15, 15, 1, '#5f6368'); p.text('TO PLAY', 27, 23, 1, '#5f6368'); }
    }));
  }
  function shadow(rx) {
    return memo('shadow' + rx, () => render(rx * 2, 4, p => {
      p.alpha(0.25, () => { for (let y = -2; y <= 1; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / 4.01)); p.rect(rx - w, 2 + y, w * 2, 1, '#1a3a1a'); } });
    }));
  }

  window.TILES = { T, GROUND_OVER, THEMES, ground, crack, gate, lift, log, caveSky, mansionSky, citySky, dcSky, skyline, questionBlock, usedBlock, brick, pipe, waterBack, waterFront, sky, clouds, hills, campus, bush, flower, lily, pole, shadow, plexSign, gTotem, plexQuestion, plexUsed, plexBrick, plexBoard, GCOLS, cabinSky, lights, snowLayer };
})();
