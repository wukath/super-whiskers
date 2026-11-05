// Level data. A level is a grid of tile characters built with a few helpers,
// then parsed into solid tiles, entity spawns and decorations.
//
//   #  ground        B  brick            ?  coin block     M  power-up block
//   S  star block    !  hidden 1-up      X  cracked rock   T  pipe (top-left)
//   W  warp pipe     ~  water            C  coin           ^  bouncy mushroom
//   m  mouse         h  hedgehog         f  fish           @  start
//   F  flagpole base H  house (left edge) G  gate (opens when the boss falls)
//   Z  boss spawn    A  arena entrance (gate closes here when the fight starts)
//
// Moving platforms and warps are listed separately since they carry ranges.
(function () {
  const ROWS = 12, GROUND_ROW = 9;

  function grid(W) {
    const g = [];
    for (let r = 0; r < ROWS; r++) g.push(new Array(W).fill('.'));
    const put = (c, r, ch) => { if (c >= 0 && c < W && r >= 0 && r < ROWS) g[r][c] = ch; };
    return {
      g, put,
      row: (c, r, s) => { for (let i = 0; i < s.length; i++) if (s[i] !== ' ') put(c + i, r, s[i]); },
      fill: (c0, c1, r0, r1, ch) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch); },
      pit: (c0, c1) => { for (let c = c0; c <= c1; c++) for (let r = GROUND_ROW; r < ROWS; r++) put(c, r, '.'); },
      water: (c0, c1) => { for (let c = c0; c <= c1; c++) { put(c, 9, '~'); put(c, 10, '~'); } },
      pipe: (c, h, warp) => put(c, GROUND_ROW - h, warp ? 'W' : 'T'),
      stairsUp: (c, n) => { for (let i = 0; i < n; i++) for (let k = 0; k <= i; k++) put(c + i, GROUND_ROW - 1 - k, '#'); },
      stairsDown: (c, n) => { for (let i = 0; i < n; i++) for (let k = 0; k < n - i; k++) put(c + i, GROUND_ROW - 1 - k, '#'); },
      platform: (c, r, n) => { for (let i = 0; i < n; i++) put(c + i, r, '#'); },
      coins: (c, r, n, step = 1) => { for (let i = 0; i < n; i++) put(c + i * step, r, 'C'); },
      rows: () => g.map(r => r.join('')),
    };
  }

  function buildLevel1() {
    const W = 220, L = grid(W);
    const { put, row, pit, water, pipe, stairsUp, stairsDown, platform, coins } = L;
    for (let c = 0; c < W; c++) for (let r = GROUND_ROW; r < ROWS; r++) put(c, r, '#');
    const movers = [], warps = [];

    put(3, 8, '@');
    // opening: a bouncy mushroom launches you to a sky coin trail and a hidden 1-up
    put(11, 8, '^'); coins(12, 2, 5); put(8, 5, '!');
    put(16, 5, '?');
    row(20, 5, 'B?BMB'); put(22, 2, '?');
    put(24, 8, 'm');
    pipe(28, 2); pipe(34, 3, true); put(32, 8, 'm'); pipe(40, 4); put(38, 8, 'm');
    warps.push({ from: { level: 'main', c: 34, r: 6 }, to: { level: 'bonus', c: 2, r: 1, dir: 'drop' } });
    water(44, 51); put(46, 10, 'f'); put(49, 9, 'f');
    platform(47, 7, 2); put(47, 4, '?'); coins(45, 4, 1); coins(50, 4, 1);
    put(58, 8, 'h');
    // secret tunnel under the brick row: pound the cracked tile to drop in
    put(60, 9, 'X'); for (let c = 60; c <= 67; c++) put(c, 10, '.'); coins(61, 10, 6); put(67, 9, 'X');
    row(62, 5, 'BBMBBBBB'); coins(63, 3, 3, 2);
    stairsUp(72, 4); pit(76, 79); stairsDown(80, 4);
    movers.push({ type: 'hlift', c: 76, r: 7, range: 2 });
    put(86, 8, 'm'); put(88, 8, 'm');
    // cracked wall across the path
    put(90, 7, 'X'); put(90, 8, 'X'); coins(90, 5, 2);
    platform(92, 6, 4); coins(92, 5, 4); platform(98, 4, 3); coins(98, 3, 3); put(96, 8, 'h');
    water(104, 111); put(106, 10, 'f'); put(109, 9, 'f'); coins(106, 2, 4);
    movers.push({ type: 'vlift', c: 107, r: 7, range: 4 });
    pipe(114, 2);
    warps.push({ from: { level: 'bonus', c: 26, r: 7 }, to: { level: 'main', c: 114, r: 7, dir: 'rise' } });
    row(117, 5, 'B?SB?B'); put(123, 8, 'm');
    pipe(126, 2); put(130, 8, 'h');
    put(131, 8, '^');
    stairsUp(132, 4); pit(136, 138); stairsDown(139, 4);
    put(146, 5, '?'); put(150, 5, 'M'); put(148, 2, '!'); put(148, 8, 'h'); put(152, 8, 'm');
    platform(158, 7, 2); movers.push({ type: 'fall', c: 162, r: 5 }, { type: 'fall', c: 165, r: 4 }); platform(168, 3, 3); coins(168, 2, 3); put(160, 8, 'm'); put(164, 8, 'm');
    water(172, 179); put(174, 10, 'f'); put(177, 9, 'f'); coins(173, 6, 3, 3);
    movers.push({ type: 'log', c: 173, r: 9, range: 3 });
    stairsUp(184, 8); put(192, 8, '#'); put(192, 7, '#');
    put(198, 8, 'F');
    put(206, 8, 'H');
    return { rows: L.rows(), movers, warps, theme: 'grass', name: 'main', time: 400, title: 'MEADOW' };
  }

  // Underground bonus cave reached through the warp pipe.
  function buildBonus() {
    const W = 30, L = grid(W);
    const { put, fill, pipe, coins } = L;
    fill(0, W - 1, GROUND_ROW, ROWS - 1, '#');
    fill(0, 0, 0, ROWS - 1, '#'); fill(W - 1, W - 1, 0, ROWS - 1, '#');
    fill(0, W - 1, 0, 0, '#'); put(2, 0, '.'); put(3, 0, '.');
    put(5, 8, '^'); coins(4, 2, 6);
    for (let k = 0; k < 4; k++) coins(9 + k, 8 - k, 12 - 2 * k);
    put(22, 7, 'X'); put(22, 8, 'X'); coins(23, 8, 2); put(23, 6, '!');
    pipe(26, 2, true);
    return { rows: L.rows(), movers: [], warps: [], theme: 'cave', name: 'bonus', time: 0 };
  }

  // Level 2: an underground cave. Ceiling everywhere, a wall-jump shaft,
  // falling platforms over pits and a wall that must be pounced through.
  function buildLevel2() {
    const W = 190, L = grid(W);
    const { put, row, fill, pit, water, stairsUp, stairsDown, platform, coins } = L;
    const movers = [];
    fill(0, W - 1, GROUND_ROW, ROWS - 1, '#');
    fill(0, W - 1, 0, 0, '#');
    fill(0, 0, 0, ROWS - 1, '#'); fill(W - 1, W - 1, 0, ROWS - 1, '#');
    put(3, 8, '@');
    put(9, 8, '^'); coins(7, 2, 5);
    put(12, 5, '?');
    pit(14, 16); movers.push({ type: 'hlift', c: 14, r: 7, range: 1 });
    // stalagmite pillars
    fill(20, 20, 7, 8, '#'); fill(23, 23, 6, 8, '#'); fill(26, 26, 7, 8, '#'); put(22, 8, 'h'); put(25, 8, 'm'); put(23, 2, 'M');
    // wall-jump shaft: enter at floor level, climb to the top path
    fill(30, 42, 3, 11, '#'); fill(31, 32, 3, 10, '.'); fill(30, 30, 7, 8, '.');
    coins(34, 2, 6); put(40, 2, 'C');
    put(45, 8, 'm');
    // underground lake
    water(48, 58); put(50, 10, 'f'); put(54, 9, 'f'); put(57, 10, 'f');
    movers.push({ type: 'log', c: 49, r: 9, range: 5 }); coins(50, 6, 4, 2); put(54, 4, '?');
    put(61, 8, 'h');
    // pounce wall: too tall to jump
    fill(64, 64, 5, 8, 'X'); coins(66, 7, 2);
    // falling platforms over a long pit
    pit(68, 79);
    movers.push({ type: 'fall', c: 68, r: 7 }, { type: 'fall', c: 72, r: 6 }, { type: 'fall', c: 76, r: 7 });
    coins(70, 4, 1); coins(74, 3, 1); coins(78, 4, 1);
    put(83, 8, 'm'); put(85, 8, 'm'); put(87, 8, 'h'); row(84, 5, 'B?SB');
    stairsUp(90, 3); pit(93, 94); stairsDown(95, 3);
    // vertical lifts across a pit
    pit(100, 112);
    movers.push({ type: 'vlift', c: 101, r: 8, range: 3 }, { type: 'vlift', c: 105, r: 8, range: 3, phase: Math.PI }, { type: 'vlift', c: 109, r: 8, range: 3 });
    coins(103, 4, 1); coins(107, 4, 1); coins(111, 4, 1);
    // hidden tunnel
    put(118, 9, 'X'); for (let c = 118; c <= 124; c++) put(c, 10, '.'); coins(119, 10, 5); put(124, 9, 'X'); put(121, 4, '!');
    put(128, 8, '^'); coins(126, 2, 6); put(131, 8, 'h'); put(134, 8, 'm');
    row(138, 5, 'BBMBB'); put(140, 8, 'm'); put(143, 8, 'h');
    stairsUp(146, 6); fill(152, 152, 7, 8, '#');
    put(156, 8, 'F');
    put(164, 8, 'H');
    return { rows: L.rows(), movers, warps: [], theme: 'cave', name: 'main', time: 350, title: 'CRYSTAL CAVES' };
  }

  // Level 3: a sunset beach, mostly water crossings on logs and islands.
  function buildLevel3() {
    const W = 230, L = grid(W);
    const { put, row, pit, water, stairsUp, stairsDown, platform, coins } = L;
    const movers = [];
    for (let c = 0; c < W; c++) for (let r = GROUND_ROW; r < ROWS; r++) put(c, r, '#');
    put(3, 8, '@');
    put(8, 5, '?'); put(12, 8, 'm');
    water(15, 22); movers.push({ type: 'log', c: 16, r: 9, range: 4 }); put(17, 10, 'f'); put(21, 9, 'f'); coins(16, 5, 4, 2);
    put(25, 8, '^'); coins(24, 2, 5); put(28, 4, '!');
    row(30, 5, 'B?MB'); put(33, 8, 'h');
    water(36, 47); movers.push({ type: 'log', c: 37, r: 9, range: 3 }, { type: 'fall', c: 42, r: 6 }, { type: 'log', c: 44, r: 9, range: 2, phase: Math.PI });
    put(38, 10, 'f'); put(41, 9, 'f'); put(46, 10, 'f'); coins(39, 6, 4, 2);
    platform(50, 6, 3); platform(55, 4, 3); coins(55, 3, 3); put(53, 8, 'm');
    pit(58, 60); movers.push({ type: 'hlift', c: 58, r: 7, range: 1 });
    put(63, 8, 'h'); put(66, 8, 'h'); row(64, 5, '?BB?');
    water(70, 78); put(72, 10, 'f'); put(76, 9, 'f'); movers.push({ type: 'vlift', c: 73, r: 8, range: 4 }); coins(71, 4, 3, 3);
    stairsUp(81, 4); pit(85, 87); stairsDown(88, 4);
    put(93, 8, 'm'); put(95, 8, 'm'); put(97, 8, 'm'); put(96, 5, 'S');
    water(100, 112); movers.push({ type: 'log', c: 101, r: 9, range: 3 }, { type: 'log', c: 107, r: 9, range: 3, phase: Math.PI });
    put(103, 10, 'f'); put(106, 9, 'f'); put(110, 10, 'f'); coins(102, 6, 6, 2);
    put(116, 7, 'X'); put(116, 8, 'X'); coins(116, 4, 2);
    put(119, 8, '^'); platform(122, 3, 3); coins(122, 2, 3); put(127, 2, '!');
    water(130, 139); movers.push({ type: 'fall', c: 131, r: 6 }, { type: 'fall', c: 134, r: 5 }, { type: 'fall', c: 137, r: 6 }); put(133, 10, 'f'); put(137, 9, 'f');
    put(142, 8, 'h'); put(146, 8, 'h'); row(144, 5, 'BSB');
    pit(150, 152); pit(155, 157); movers.push({ type: 'hlift', c: 150, r: 7, range: 1 }, { type: 'hlift', c: 155, r: 6, range: 1, phase: Math.PI }); put(153, 8, 'm');
    water(160, 171); movers.push({ type: 'log', c: 161, r: 9, range: 3 }, { type: 'log', c: 166, r: 9, range: 3, phase: Math.PI });
    put(162, 10, 'f'); put(165, 9, 'f'); put(169, 10, 'f'); platform(165, 5, 2); coins(164, 3, 4);
    put(175, 8, '^'); coins(174, 2, 6);
    row(180, 5, '?M?'); put(183, 8, 'm'); put(186, 8, 'h');
    stairsUp(190, 8); put(198, 8, '#'); put(198, 7, '#');
    put(204, 8, 'F');
    put(212, 8, 'H');
    return { rows: L.rows(), movers, warps: [], theme: 'sand', name: 'main', time: 400, title: 'SUNSET SHORE' };
  }

  // Level 4: the evil mansion, ending in a boss arena.
  function buildLevel4() {
    const W = 186, L = grid(W);
    const { put, row, fill, pit, water, stairsUp, stairsDown, platform, coins } = L;
    const movers = [];
    fill(0, W - 1, GROUND_ROW, ROWS - 1, '#');
    fill(0, W - 1, 0, 0, '#');
    fill(0, 0, 0, ROWS - 1, '#'); fill(W - 1, W - 1, 0, ROWS - 1, '#');
    put(3, 8, '@');
    // entrance hall: bookcase steps
    platform(8, 7, 2); platform(11, 5, 2); platform(14, 3, 2); coins(8, 6, 2); coins(11, 4, 2); coins(14, 2, 2); put(10, 8, 'm');
    pit(17, 20); movers.push({ type: 'fall', c: 17, r: 7 }, { type: 'fall', c: 19, r: 6 });
    row(23, 5, 'B?BMB'); put(24, 8, 'h'); put(27, 8, 'h');
    // chandeliers over the great hall
    pit(31, 40); movers.push({ type: 'vlift', c: 31, r: 7, range: 3 }, { type: 'vlift', c: 35, r: 7, range: 3, phase: Math.PI }, { type: 'vlift', c: 39, r: 7, range: 3 });
    coins(33, 3, 1); coins(37, 2, 1);
    fill(44, 44, 5, 8, 'X'); coins(46, 7, 2); put(48, 8, 'm');
    pit(52, 61); movers.push({ type: 'hlift', c: 52, r: 7, range: 2 }, { type: 'hlift', c: 58, r: 6, range: 2, phase: Math.PI }); coins(55, 4, 3);
    // library
    stairsUp(64, 4); put(68, 2, '?'); put(69, 2, 'S'); fill(68, 69, 5, 8, '#'); stairsDown(70, 4); put(66, 8, 'h');
    put(77, 8, 'm'); put(79, 8, 'm'); put(81, 8, 'm'); row(78, 5, 'BBBB'); put(83, 8, 'h');
    // flooded cellar
    water(87, 95); movers.push({ type: 'log', c: 88, r: 9, range: 4 }); put(89, 10, 'f'); put(93, 9, 'f'); coins(88, 6, 4, 2);
    pit(98, 107); movers.push({ type: 'fall', c: 98, r: 7 }, { type: 'fall', c: 101, r: 6 }, { type: 'fall', c: 104, r: 7 }); coins(100, 4, 1); coins(106, 4, 1);
    put(111, 8, '^'); coins(109, 2, 6); put(114, 3, '!');
    row(121, 5, 'BB?BMB'); put(122, 8, 'h'); put(126, 8, 'h'); put(129, 8, 'm');
    put(133, 7, 'X'); put(133, 8, 'X'); coins(133, 4, 2);
    // boss arena
    put(140, 8, 'A');
    fill(165, 165, 1, 8, 'G');
    put(156, 8, 'Z');
    put(173, 8, 'F');
    put(178, 8, 'H');
    return { rows: L.rows(), movers, warps: [], theme: 'mansion', name: 'main', time: 400, title: 'EVIL MANSION' };
  }

  function parse(def) {
    const rows = def.rows, H = rows.length, W = rows[0].length;
    const tiles = [];
    for (let r = 0; r < H; r++) tiles.push(new Array(W).fill(null));
    const spawns = [], pipes = [], decor = [];
    let start = { c: 2, r: 8 }, flag = null, house = null, arena = null;
    const at = (c, r) => (r >= 0 && r < H && c >= 0 && c < W) ? rows[r][c] : '.';
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const ch = rows[r][c];
      switch (ch) {
        case '#': tiles[r][c] = { type: 'ground', c, r }; break;
        case 'B': tiles[r][c] = { type: 'brick', c, r }; break;
        case 'X': tiles[r][c] = { type: 'crack', c, r }; break;
        case '!': tiles[r][c] = { type: 'hidden', item: 'oneup', c, r }; break;
        case 'G': tiles[r][c] = { type: 'gate', c, r }; break;
        case 'A': arena = { c, r }; break;
        case 'Z': spawns.push({ type: 'boss', c, r }); break;
        case '?': tiles[r][c] = { type: 'q', item: 'coin', c, r }; break;
        case 'M': tiles[r][c] = { type: 'q', item: 'power', c, r }; break;
        case 'S': tiles[r][c] = { type: 'q', item: 'star', c, r }; break;
        case '~': tiles[r][c] = { type: 'water', c, r }; break;
        case 'T': case 'W': {
          let h = 0; while (at(c, r + h) !== '#' && r + h < H) h++;
          pipes.push({ c, r, h, warp: ch === 'W' });
          for (let k = 0; k < h; k++) { tiles[r + k][c] = { type: 'pipe', c, r: r + k }; tiles[r + k][c + 1] = { type: 'pipe', c: c + 1, r: r + k }; }
          break;
        }
        case 'C': spawns.push({ type: 'coin', c, r }); break;
        case '^': spawns.push({ type: 'bouncer', c, r }); break;
        case 'm': spawns.push({ type: 'mouse', c, r }); break;
        case 'h': spawns.push({ type: 'hedgehog', c, r }); break;
        case 'f': spawns.push({ type: 'fish', c, r }); tiles[r][c] = { type: 'water', c, r }; break;
        case '@': start = { c, r }; break;
        case 'F': flag = { c, r }; tiles[r][c] = { type: 'ground', c, r }; break;
        case 'H': house = { c, r }; break;
      }
    }
    for (const m of def.movers) spawns.push(Object.assign({}, m));
    // water: mark depth from the surface, and note surface tiles for lilies
    for (let c = 0; c < W; c++) {
      let d = 0;
      for (let r = 0; r < H; r++) {
        const t = tiles[r][c];
        if (t && t.type === 'water') { t.depth = d; if (d === 0 && PX.hash(c * 3.7) > 0.7) decor.push({ kind: 'lily', c, r }); d++; } else d = 0;
      }
    }
    // ground exposure flags and decorations on grass tops
    const solid = (c, r) => { const t = (r >= 0 && r < H && c >= 0 && c < W) ? tiles[r][c] : null; return !!t && t.type !== 'water' && t.type !== 'hidden'; };
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const t = tiles[r][c];
      if (!t || t.type !== 'ground') continue;
      t.top = !solid(c, r - 1); t.bottom = !solid(c, r + 1); t.left = !solid(c - 1, r); t.right = !solid(c + 1, r);
      t.variant = (c * 7 + r * 3) % 4;
      if (def.theme === 'cave' || def.theme === 'mansion') continue;
      if (t.top && r === GROUND_ROW && rows[r - 1][c] === '.' && rows[r - 1][c + 1] === '.' && !pipes.some(p => c >= p.c - 1 && c <= p.c + 2)) {
        const hv = PX.hash(c * 1.31 + 5);
        if (hv > 0.9 && rows[r - 1][c + 2] === '.' && c > 4) decor.push({ kind: 'bush', c, r, s: 0.8 + PX.hash(c) * 0.4 });
        else if (hv < 0.22) decor.push({ kind: 'flower', c, r, kind2: Math.floor(PX.hash(c * 9) * 3), dx: Math.floor(PX.hash(c * 2) * 20) });
      }
    }
    return { W, H, tiles, spawns, pipes, decor, start, flag, house, arena, rows, theme: def.theme, name: def.name, warps: def.warps, time: def.time, title: def.title };
  }

  // Each stage is a main level plus any sub-areas reached through warps.
  const STAGES = [
    { main: buildLevel1, extras: [buildBonus] },
    { main: buildLevel2, extras: [] },
    { main: buildLevel3, extras: [] },
    { main: buildLevel4, extras: [] },
  ];

  window.LEVELS = { ROWS, GROUND_ROW, STAGES, buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildBonus, parse };
})();
