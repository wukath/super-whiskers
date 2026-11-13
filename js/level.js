// Level data. A level is a grid of tile characters built with a few helpers,
// then parsed into solid tiles, entity spawns and decorations.
//
//   #  ground        B  brick            ?  coin block     M  power-up block
//   S  star block    !  hidden 1-up      X  cracked rock   T  pipe (top-left)
//   W  warp pipe     ~  water            C  coin           ^  bouncy mushroom
//   m  mouse         h  hedgehog         f  fish           @  start
//   F  flagpole base H  house (left edge) G  gate (opens when the boss falls)
//   Z  boss spawn    A  arena entrance (gate closes here when the fight starts)
//   r  rat           g  pigeon           k  raccoon
//   d  bugdroid      D  drone            n  dino            c  cactus
//   x  fox           i  icicle (hangs from the tile above)   Y  snowcat boss
//
// Moving platforms and warps are listed separately since they carry ranges.
(function () {
  const ROWS = 12, GROUND_ROW = 9;

  // A level grid. Default 12 rows with the ground at row 9; taller grids
  // scroll vertically and put the ground at H - 3.
  function grid(W, H = ROWS) {
    const g = [];
    let L;
    const GR = H - 3;
    for (let r = 0; r < H; r++) g.push(new Array(W).fill('.'));
    const put = (c, r, ch) => { if (c >= 0 && c < W && r >= 0 && r < H) g[r][c] = ch; };
    L = {
      g, put,
      row: (c, r, s) => { for (let i = 0; i < s.length; i++) if (s[i] !== ' ') put(c + i, r, s[i]); },
      fill: (c0, c1, r0, r1, ch) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch); },
      H, GR,
      pit: (c0, c1) => { for (let c = c0; c <= c1; c++) for (let r = GR; r < H; r++) put(c, r, '.'); },
      water: (c0, c1, r = GR) => { for (let c = c0; c <= c1; c++) { put(c, r, '~'); put(c, r + 1, '~'); } },
      pipe: (c, h, warp, base = GR) => put(c, base - h, warp ? 'W' : 'T'),
      stairsUp: (c, n, base = GR) => { for (let i = 0; i < n; i++) for (let k = 0; k <= i; k++) put(c + i, base - 1 - k, '#'); },
      stairsDown: (c, n, base = GR) => { for (let i = 0; i < n; i++) for (let k = 0; k < n - i; k++) put(c + i, base - 1 - k, '#'); },
      ground: (c0, c1, r = GR) => { for (let c = c0; c <= c1; c++) for (let y = r; y < H; y++) put(c, y, '#'); },
      platform: (c, r, n) => { for (let i = 0; i < n; i++) put(c + i, r, '#'); },
      coins: (c, r, n, step = 1) => { for (let i = 0; i < n; i++) put(c + i * step, r, 'C'); },
      rows: () => g.map(r => r.join('')),
      // paint: per-tile ground theme override, keyed "c,r"
      paint: {},
      block: (c0, c1, r0, r1, theme) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) { put(c, r, '#'); L.paint[c + ',' + r] = theme; } },
    };
    return L;
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

  // Level 2: Crystal Caves, a vertical descent. Stone floors stacked down a
  // cavern, each with its own way down: a drop off the end, a hole guarded by
  // hedgehogs, a cracked floor to pound through, a flooded hall to swim, and
  // lifts over the last pit. The flag waits at the bottom.
  function buildLevel2() {
    const W = 40, H = 60, L = grid(W, H);
    const { put, row, fill, platform, coins } = L;
    const movers = [];
    const floor = (r, c0, c1) => fill(c0, c1, r, r, '#');
    fill(0, W - 1, 0, 0, '#'); fill(0, 0, 0, H - 1, '#'); fill(W - 1, W - 1, 0, H - 1, '#');
    fill(0, W - 1, H - 3, H - 1, '#');
    put(3, 7, '@');
    // 1 (r 8): entrance ledge ending over a drop; stepping stones down the right wall
    floor(8, 1, 28); coins(10, 6, 5, 2); put(18, 7, 'm'); put(24, 7, 'm'); put(14, 4, '?');
    platform(31, 11, 3); coins(31, 10, 3); platform(35, 14, 3);
    // 2 (r 17): wide hall; the hole is on the left, past two hedgehogs; a crystal arch of coins
    floor(17, 7, 38); put(12, 16, 'h'); put(30, 16, 'h'); for (let k = 0; k < 7; k++) put(16 + k, 14 - Math.round(Math.sin(k / 6 * Math.PI) * 2.5), 'C');
    row(22, 13, 'B?B'); put(34, 12, '!');
    movers.push({ type: 'fall', c: 3, r: 20 }, { type: 'fall', c: 1, r: 23 });
    // 3 (r 26): the cracked floor: pound through the X tiles on the right to continue
    floor(26, 1, 38); for (let c = 30; c <= 35; c++) put(c, 26, 'X');
    put(8, 25, 'm'); put(20, 25, 'h'); coins(4, 23, 3); coins(24, 23, 3, 2); put(31, 22, 'M');
    fill(16, 16, 23, 25, '#'); coins(16, 21, 1);
    // 4 (r 34): stalactite pillars; the hole between them drops into the flooded hall
    floor(34, 1, 38); fill(18, 19, 34, 34, '.'); fill(17, 17, 35, 41, '#'); fill(20, 20, 35, 41, '#'); for (let r = 37; r <= 41; r += 2) put(18 + ((r >> 1) & 1), r, 'C');
    put(28, 33, 'm'); put(34, 33, 'm'); put(6, 33, 'h'); put(10, 30, 'S');
    // 5 (r 43-46): the flooded hall: swim right, climb the bank, drop through the gap
    fill(1, 5, 43, 46, '#'); fill(33, 34, 43, 46, '#'); fill(38, 38, 43, 51, '#'); fill(1, 34, 47, 47, '#');
    for (let c = 6; c <= 32; c++) for (let r = 43; r <= 46; r++) put(c, r, '~');
    put(10, 46, 'f'); put(18, 45, 'f'); put(26, 46, 'f'); coins(9, 41, 3, 3); coins(23, 41, 3, 3);
    movers.push({ type: 'log', c: 12, r: 43, range: 8 });
    // 6 (r 52): landing ledge, then lifts down to the crystal garden and the flag
    floor(52, 24, 37); row(27, 49, '?B?'); put(30, 51, 'm');
    movers.push({ type: 'vlift', c: 18, r: 56, range: 4 }, { type: 'vlift', c: 12, r: 56, range: 4, phase: Math.PI });
    coins(19, 53, 2); coins(13, 53, 2); put(26, 56, 'h'); put(14, 56, 'h');
    put(4, 56, 'F');
    put(8, 56, 'H');
    return { rows: L.rows(), movers, warps: [], theme: 'cave', name: 'main', time: 400, title: 'CRYSTAL CAVES', look: 'down' };
  }

  // Level 3: Sunset Shore. The ground itself rises and falls: dunes, a sea
  // cliff, a long pier on stilts, tide pools, a shipwreck, and a lighthouse
  // climb at the end. No two stretches sit at the same height.
  function buildLevel3() {
    const W = 230, L = grid(W);
    const { put, row, fill, pit, water, platform, coins, ground } = L;
    const movers = [];
    ground(0, W - 1);
    put(3, 8, '@');
    // dunes: rolling ground that steps up and down
    ground(8, 13, 8); ground(14, 19, 7); ground(20, 23, 8); put(11, 7, 'm'); put(16, 6, 'm'); coins(14, 5, 6); put(11, 5, '?');
    ground(26, 29, 7); ground(30, 34, 6); ground(35, 37, 7); put(32, 5, 'h'); coins(30, 3, 5); put(22, 4, 'S');
    // tide pools: shallow water between sandbars with fish
    water(40, 43); ground(44, 46); water(47, 52); ground(53, 55); water(56, 58);
    put(41, 10, 'f'); put(49, 9, 'f'); put(57, 10, 'f'); coins(47, 6, 6); put(45, 8, 'm'); put(54, 6, '?');
    // the sea cliff: climb the rock face, run along the top, then drop to the pier
    ground(62, 64, 7); ground(65, 67, 5); ground(68, 84, 4); coins(69, 2, 8, 2); put(74, 3, 'h'); put(80, 3, 'h');
    put(76, 1, 'M');
    // the pier: a boardwalk on stilts over deep water, with gaps where planks are missing
    water(85, 120); for (let c = 85; c <= 116; c++) { if (c % 11 === 7 || c % 11 === 8) continue; put(c, 6, '#'); if (c % 5 === 0) { put(c, 7, '#'); put(c, 8, '#'); } }
    put(88, 10, 'f'); put(93, 9, 'f'); put(96, 9, 'f'); put(104, 10, 'f'); put(108, 9, 'f'); put(112, 9, 'f'); coins(90, 4, 4); coins(101, 4, 4); coins(112, 4, 4); put(99, 5, 'm'); put(108, 5, 'm');
    movers.push({ type: 'log', c: 92, r: 9, range: 3 }, { type: 'log', c: 103, r: 9, range: 3, phase: Math.PI }, { type: 'log', c: 114, r: 9, range: 2 });
    // the shipwreck: a hull of bricks sticking out of the sand, a cracked porthole, a hidden 1-up in the crow's nest
    ground(121, 134, 8); fill(124, 131, 6, 7, 'B'); fill(127, 128, 6, 7, '.'); put(127, 7, 'X'); put(128, 7, 'X'); fill(122, 122, 5, 7, 'B'); put(126, 4, 'B'); put(129, 4, 'B'); put(122, 1, '!'); coins(123, 3, 7, 2); put(133, 7, 'h');
    fill(132, 133, 3, 3, '#'); coins(132, 2, 2);
    // the beach run: sand stepping down to the water, hedgehogs rolling
    ground(135, 140, 7); ground(141, 150); put(137, 6, 'h'); put(144, 8, 'h'); put(147, 8, 'm');
    water(151, 158); movers.push({ type: 'hlift', c: 151, r: 7, range: 3 }); coins(152, 5, 6); put(154, 10, 'f');
    ground(159, 166, 8); put(162, 5, '?'); put(163, 7, 'm');
    pit(167, 169); ground(170, 176, 6); coins(171, 4, 5); put(173, 5, 'h');
    pit(177, 179); movers.push({ type: 'fall', c: 177, r: 5 });
    // the lighthouse: a spiral of ledges up the tower, then the flag on the rocks
    ground(180, 186, 8); fill(190, 195, 2, 8, '#');
    platform(187, 6, 2); platform(185, 4, 2); platform(188, 2, 2); platform(197, 4, 2); coins(187, 5, 2); coins(185, 3, 2); coins(188, 1, 2); coins(197, 3, 2);
    coins(191, 1, 4);
    ground(199, 206, 7); put(203, 6, 'h');
    put(212, 8, 'F');
    put(220, 8, 'H');
    return { rows: L.rows(), movers, warps: [], theme: 'sand', name: 'main', time: 380, title: 'SUNSET SHORE' };
  }

  // Level 4: the evil mansion, a tower you climb floor by floor: a grand
  // staircase, a chandelier lift, trapdoor platforms, bookcase steps and a
  // wall-jump chimney. Duke waits in the attic.
  function buildLevel4() {
    const W = 42, H = 56, L = grid(W, H);
    const { put, row, fill, platform, coins } = L;
    const movers = [];
    const floor = (r, c0, c1) => fill(c0, c1, r, r, '#');
    fill(0, W - 1, 0, 0, '#'); fill(0, 0, 0, H - 1, '#'); fill(W - 1, W - 1, 0, H - 1, '#');
    fill(0, W - 1, H - 3, H - 1, '#');
    put(3, 52, '@');
    // ground floor (r 53): the entrance hall and a grand staircase up on the right
    put(9, 52, 'm'); put(15, 52, 'h'); put(21, 52, 'm'); coins(6, 50, 4, 2); row(18, 49, 'B?B');
    for (let i = 0; i < 7; i++) fill(26 + i, 26 + i, 52 - i, 52, '#'); fill(33, 36, 46, 52, '#');
    coins(28, 44, 3, 2);
    // mezzanine (r 45, right side): a chandelier lift rises from it to the library
    floor(45, 33, 40); put(36, 44, 'h'); put(39, 42, '?');
    movers.push({ type: 'vlift', c: 36, r: 44, range: 7 });
    // library (r 36): walk left through a cracked bookcase; trapdoor platforms climb the left wall
    floor(36, 1, 34); put(14, 35, 'm'); put(20, 35, 'm'); put(26, 35, 'h'); row(16, 32, 'B?MB'); coins(22, 33, 4); fill(30, 30, 33, 35, 'X'); coins(31, 33, 2); coins(8, 33, 3, 2);
    movers.push({ type: 'fall', c: 2, r: 33 }, { type: 'fall', c: 5, r: 30 });
    // 4th floor (r 27): portraits and hedgehogs; bookcase steps up the right side
    floor(27, 8, 40); put(12, 26, 'h'); put(18, 26, 'h'); put(25, 26, 'm'); coins(10, 24, 5, 2); put(16, 23, 'S');
    platform(33, 24, 2); platform(36, 21, 2); platform(32, 20, 2); coins(33, 23, 2); coins(36, 20, 2);
    // 5th floor (r 18): walk left to the chimney
    floor(18, 1, 30); put(10, 17, 'm'); put(14, 17, 'h'); put(18, 17, 'm'); put(26, 17, 'h'); row(20, 14, '?BB?'); put(29, 13, '!'); coins(6, 15, 3);
    fill(1, 1, 10, 17, '#'); fill(4, 4, 10, 15, '#'); for (let r = 11; r <= 17; r += 2) put(2 + (r / 2 % 2 | 0), r, 'C');
    // attic (r 9): the boss arena, the gate, and the exit
    floor(9, 4, 40);
    put(7, 8, 'A');
    put(20, 8, 'Z');
    fill(31, 31, 1, 8, 'G');
    put(35, 8, 'F');
    put(38, 8, 'H');
    return { rows: L.rows(), movers, warps: [], theme: 'mansion', name: 'main', time: 450, title: 'EVIL MANSION', look: 'up' };
  }

  // Level 5: Midtown at night. Streets with cabs, fire-escape shafts, rooftops,
  // an elevated train to ride, and steam vents over open manholes.
  function buildLevel5() {
    const W = 200, L = grid(W);
    const { put, row, fill, pit, stairsUp, platform, coins } = L;
    const movers = [];
    for (let c = 0; c < W; c++) for (let r = GROUND_ROW; r < ROWS; r++) put(c, r, '#');
    put(3, 8, '@');
    // opening block
    row(8, 5, '?B?'); coins(6, 3, 2); put(12, 8, 'r'); put(13, 8, 'r');
    movers.push({ type: 'decor', kind: 'cart', c: 5, r: 8 });
    // avenue 1: cabs, a median and a steam vent up to a ledge
    movers.push({ type: 'taxis', c: 16, r: 8, len: 18, period: 330, dir: -1 });
    platform(24, 7, 2); movers.push({ type: 'vent', c: 21, r: 8, height: 6 }); platform(17, 3, 3); coins(17, 2, 3); coins(29, 6, 3);
    // buildings A and B with a fire-escape shaft between them
    fill(32, 37, 4, 8, '#'); fill(40, 46, 2, 8, '#'); platform(30, 6, 2); coins(32, 2, 3); platform(38, 6, 1); platform(39, 3, 1); put(34, 3, 'k'); coins(38, 5, 1); coins(39, 2, 1); coins(41, 1, 5); put(44, 8, 'r');
    movers.push({ type: 'decor', kind: 'tower', c: 44, r: 2 });
    // rooftop run with cabs on the street below
    movers.push({ type: 'taxis', c: 48, r: 8, len: 22, period: 290, dir: -1, phase: 120 });
    fill(50, 54, 3, 8, '#'); fill(57, 60, 5, 8, '#'); fill(63, 66, 2, 8, '#'); put(52, 2, 'k'); coins(57, 4, 4); coins(63, 1, 4); put(61, 8, 'r');
    movers.push({ type: 'decor', kind: 'tower', c: 64, r: 2 });
    // the El: drop onto the station platform, board the train, duck under the signal boxes
    platform(68, 4, 3); fill(100, 103, 3, 6, '#');
    movers.push({ type: 'taxis', c: 70, r: 8, len: 30, period: 300, dir: -1, phase: 200 });
    put(80, 1, '#'); put(88, 1, '#'); put(96, 1, '#'); coins(84, 2, 1); coins(92, 2, 1); coins(76, 7, 4, 2); coins(88, 7, 4, 2);
    movers.push({ type: 'train', c: 68, r: 3, range: 38, dir: 1 });
    // steam vents over open manholes
    pit(108, 108); pit(113, 113); pit(118, 118);
    movers.push({ type: 'vent', c: 106, r: 8, height: 4, phase: 0 }, { type: 'vent', c: 111, r: 8, height: 4, phase: 50 }, { type: 'vent', c: 116, r: 8, height: 4, phase: 100 }, { type: 'vent', c: 121, r: 8, height: 4, phase: 150 });
    coins(106, 4, 1); coins(111, 4, 1); coins(116, 4, 1); coins(121, 4, 1);
    // building climb with raccoons on the towers
    fill(126, 128, 2, 6, '#'); fill(132, 134, 2, 8, '#'); platform(129, 6, 2); platform(131, 3, 1); put(133, 1, 'k'); coins(129, 5, 1); coins(131, 2, 1); put(130, 7, 'C');
    // Times Square: billboards, rats, cabs
    movers.push({ type: 'taxis', c: 140, r: 8, len: 26, period: 320, dir: -1, phase: 60 });
    row(144, 4, '?BB?BB?'); row(152, 2, 'BMB'); put(146, 8, 'r'); put(147, 8, 'r'); put(160, 8, 'r');
    movers.push({ type: 'decor', kind: 'cart', c: 163, r: 8 });
    // home stretch
    put(168, 8, 'h'); stairsUp(172, 6); fill(178, 178, 3, 8, '#');
    put(184, 8, 'F');
    put(190, 8, 'H');
    return { rows: L.rows(), movers, warps: [], theme: 'nyc', name: 'main', time: 450, title: 'MIDTOWN RUSH' };
  }

  // Level 6: the Googleplex. Terrain spells GOOGLE in Material-colored blocks,
  // a campus road with Street View cars, bugdroids, delivery drones, a
  // data-center detour, the offline dino run, then the rooftop G totem.
  function buildLevel6() {
    const W = 230, L = grid(W);
    const { put, row, fill, pit, water, pipe, stairsUp, stairsDown, platform, coins, block } = L;
    const movers = [], warps = [];
    for (let c = 0; c < W; c++) for (let r = GROUND_ROW; r < ROWS; r++) put(c, r, '#');
    put(3, 8, '@');
    // campus entrance: the sign, a parked gBike, a welcome card and the first droid
    movers.push({ type: 'decor', kind: 'sign', c: 6, r: 8 }, { type: 'decor', kind: 'gbike', c: 10, r: 8 });
    row(11, 6, '?B?B?'); put(13, 3, 'M'); put(17, 8, 'd'); put(20, 8, 'd');
    // the GOOGLE letters: each is a block-letter you climb over, in logo colors
    // G (blue)
    block(24, 29, 3, 3, 'plex0'); block(24, 24, 3, 8, 'plex0'); block(24, 29, 8, 8, 'plex0'); block(29, 29, 6, 8, 'plex0'); block(27, 29, 6, 6, 'plex0');
    coins(25, 2, 5); put(26, 7, 'C'); put(28, 5, 'd'); put(25, 4, '!');
    // O (red)
    block(33, 37, 3, 3, 'plex1'); block(33, 37, 8, 8, 'plex1'); block(33, 33, 4, 7, 'plex1'); block(37, 37, 4, 5, 'plex1');
    coins(34, 2, 3); coins(34, 6, 3); put(35, 1, '!');
    // O (yellow)
    block(41, 45, 3, 3, 'plex2'); block(41, 45, 8, 8, 'plex2'); block(41, 41, 4, 5, 'plex2'); block(45, 45, 4, 7, 'plex2');
    coins(42, 2, 3); coins(42, 6, 3); put(43, 2, 'd');
    // G (blue)
    block(49, 54, 3, 3, 'plex0'); block(49, 49, 4, 8, 'plex0'); block(49, 54, 8, 8, 'plex0'); block(54, 54, 6, 8, 'plex0'); block(52, 54, 6, 6, 'plex0');
    coins(50, 2, 5); put(51, 7, 'C'); put(53, 7, 'C');
    // L (green)
    block(58, 58, 3, 8, 'plex3'); block(58, 62, 8, 8, 'plex3'); coins(59, 2, 1); coins(60, 7, 3); put(61, 4, 'S');
    // E (red)
    block(66, 70, 3, 3, 'plex1'); block(66, 66, 4, 8, 'plex1'); block(66, 69, 6, 6, 'plex1'); block(66, 70, 8, 8, 'plex1');
    coins(67, 2, 4); put(68, 5, 'C'); put(68, 7, 'C'); put(72, 8, 'd');
    // glass pedestals between the letters so a fall into a gap is climbable
    for (const c of [31, 39, 47, 56, 64]) block(c, c, 6, 8, 'plex4');
    // campus road: Street View cars, a crosswalk and a gBike rack
    movers.push({ type: 'taxis', kind: 'svcar', c: 76, r: 8, len: 20, period: 320, dir: -1 });
    platform(80, 6, 2); coins(80, 5, 2); platform(86, 4, 2); coins(86, 3, 2); platform(92, 6, 2); coins(92, 5, 2); put(87, 3, 'd');
    movers.push({ type: 'decor', kind: 'gbike', c: 97, r: 8 }, { type: 'decor', kind: 'gbike', c: 98, r: 8 });
    row(96, 4, '?B?'); put(99, 8, 'd');
    // glass office with a search-bar lift up to the roof, drones overhead
    block(102, 108, 5, 8, 'plex4'); put(104, 4, 'd'); coins(103, 3, 5);
    movers.push({ type: 'vlift', c: 110, r: 8, range: 4 });
    put(110, 2, 'D'); put(114, 1, 'D'); put(122, 2, 'D');
    block(113, 118, 3, 8, 'plex4'); coins(113, 1, 6); put(116, 2, 'd'); put(114, 2, 'd');
    pit(120, 121); platform(121, 5, 2); coins(121, 4, 2);
    movers.push({ type: 'decor', kind: 'sign404', c: 124, r: 8 });
    // data center detour: the warp pipe drops into the server hall
    pipe(128, 3, true); put(126, 8, 'd');
    warps.push({ from: { level: 'main', c: 128, r: 6 }, to: { level: 'dc', c: 2, r: 1, dir: 'drop' } });
    // no internet: the dino run through cacti, with Stan the T-rex looking on
    movers.push({ type: 'decor', kind: 'offline', c: 133, r: 8 });
    put(138, 8, 'c'); put(143, 8, 'c'); coins(140, 6, 2); put(148, 8, 'c'); put(149, 8, 'c'); coins(146, 5, 2); put(153, 8, 'c'); put(158, 8, 'n');
    movers.push({ type: 'decor', kind: 'stan', c: 161, r: 8 });
    pipe(166, 2);
    warps.push({ from: { level: 'dc', c: 36, r: 7 }, to: { level: 'main', c: 166, r: 7, dir: 'rise' } });
    put(171, 8, 'c'); pit(175, 176); put(177, 8, 'c'); put(182, 8, 'n'); row(173, 4, '?B?'); coins(179, 5, 2);
    // rooftop climb: Material towers with droids on the roofs and the G totem on top
    block(186, 189, 5, 8, 'plex3'); block(192, 195, 3, 8, 'plex2'); block(198, 202, 2, 8, 'plex1');
    platform(184, 7, 1); coins(186, 4, 4); put(188, 4, 'd'); put(191, 6, 'C'); coins(192, 2, 4); put(194, 2, 'd'); platform(196, 4, 1); put(196, 3, 'C'); coins(198, 1, 5);
    movers.push({ type: 'decor', kind: 'totem', c: 199, r: 1 });
    movers.push({ type: 'fall', c: 204, r: 3 }, { type: 'fall', c: 207, r: 5 }); coins(205, 2, 1); coins(208, 4, 1); put(205, 8, 'd'); put(209, 8, 'd');
    // rainbow staircase up to the flag
    ['plex0', 'plex1', 'plex2', 'plex3', 'plex0', 'plex1'].forEach((th, i) => block(212 + i, 212 + i, 8 - i, 8, th));
    put(220, 8, 'F');
    put(226, 8, 'H');
    return { rows: L.rows(), paint: L.paint, movers, warps, theme: 'plex', name: 'main', time: 420, title: 'THE GOOGLEPLEX' };
  }

  // Level 7: Winter Wonderland. Snow falls the whole way. A village with lit
  // pines and a snowman, a ski hill of icy steps and jumps, a cozy cabin with
  // cocoa (entered through its chimney), an icicle cave, then Frosty the snowcat.
  function buildLevel7() {
    const W = 240, L = grid(W);
    const { put, row, fill, pit, pipe, platform, coins, block } = L;
    const movers = [], warps = [];
    const ice = (c0, c1, r) => { for (let c = c0; c <= c1; c++) L.paint[c + ',' + r] = 'ice'; };
    for (let c = 0; c < W; c++) for (let r = GROUND_ROW; r < ROWS; r++) put(c, r, '#');
    put(3, 8, '@');
    // village: pines with lights, a snowman, string lights between posts
    movers.push({ type: 'decor', kind: 'pine', c: 7, r: 8 }, { type: 'decor', kind: 'snowman', c: 12, r: 8 }, { type: 'decor', kind: 'lights', c: 6, r: 3, len: 10 });
    block(9, 10, 8, 8, 'snow'); ice(9, 10, 8); block(15, 16, 7, 8, 'snow'); ice(15, 16, 7); coins(9, 6, 2); coins(15, 5, 2); put(12, 4, '!'); put(19, 8, 'x'); put(23, 8, 'x');
    movers.push({ type: 'decor', kind: 'pine', c: 26, r: 8 }, { type: 'decor', kind: 'lights', c: 20, r: 2, len: 12 });
    row(20, 4, 'M?');
    // frozen pond: ice is slippery; foxes on the far bank
    ice(30, 44, GROUND_ROW);
    coins(32, 6, 4, 3); put(37, 5, '?'); put(34, 8, 'x'); put(46, 8, 'x'); put(50, 8, 'x');
    movers.push({ type: 'decor', kind: 'pine', c: 53, r: 8 });
    // ski hill: ride the lift side up (platforms), then slide down icy steps with gaps to jump
    platform(56, 7, 2); platform(60, 5, 2); platform(64, 4, 2); coins(56, 6, 2); coins(60, 4, 2); coins(64, 3, 2);
    movers.push({ type: 'decor', kind: 'lights', c: 55, r: 0, len: 14 });
    block(68, 73, 2, 8, 'snow'); ice(68, 73, 2); put(70, 1, 'C'); put(72, 1, 'C');
    let c = 74;
    for (const [len, rr] of [[4, 3], [4, 4], [5, 5], [5, 6], [6, 7], [6, 8]]) {
      for (let k = 0; k < len; k++) for (let y = rr; y < ROWS; y++) put(c + k, y, '#');
      if (rr < 8) ice(c, c + len - 1, rr); coins(c + 1, rr - 2, len - 2);
      c += len; if (rr < 8) { pit(c, c); c += 1; }
    }
    put(86, 4, 'x'); put(98, 6, 'x');
    // the big jump off the last step down to the cabin clearing
    pit(c, c + 2); c += 4; coins(c - 4, 5, 3); put(c + 1, 8, 'x');
    // the cabin: drop in through the chimney pipe, come out by the door pipe
    const cab = c + 4;
    movers.push({ type: 'decor', kind: 'cabin', c: cab, r: 8 }, { type: 'decor', kind: 'snowman', c: cab - 3, r: 8 });
    put(cab - 2, 8, '^');
    block(cab, cab + 5, 6, 8, 'cabin'); block(cab + 1, cab + 4, 5, 8, 'cabin');
    pipe(cab + 4, 6, true);
    warps.push({ from: { level: 'main', c: cab + 4, r: 3 }, to: { level: 'cabin', c: 2, r: 1, dir: 'drop' } });
    c = cab + 8;
    pipe(c, 2); warps.push({ from: { level: 'cabin', c: 46, r: 7 }, to: { level: 'main', c: c, r: 7, dir: 'rise' } });
    put(c + 3, 5, 'M'); put(c + 5, 8, 'x');
    // icicle cave: a ceiling of icicles over an icy floor
    c += 8;
    fill(c, c + 26, 0, 1, '#'); fill(c, c, 2, 4, '#'); fill(c + 26, c + 26, 2, 4, '#');
    for (let k = c + 2; k <= c + 24; k += 3) put(k, 2, 'i');
    ice(c + 1, c + 25, GROUND_ROW);
    pit(c + 8, c + 9); pit(c + 17, c + 18); coins(c + 4, 7, 3); coins(c + 12, 6, 4); coins(c + 21, 7, 3); put(c + 5, 8, 'x'); put(c + 14, 8, 'x'); put(c + 23, 8, 'x');
    movers.push({ type: 'hlift', c: c + 8, r: 7, range: 1 }, { type: 'hlift', c: c + 17, r: 6, range: 1, phase: Math.PI });
    c += 30;
    // pines and a last cocoa before the arena
    movers.push({ type: 'decor', kind: 'pine', c: c, r: 8 }, { type: 'decor', kind: 'snowman', c: c + 4, r: 8 }, { type: 'decor', kind: 'lights', c: c - 1, r: 3, len: 10 });
    row(c + 6, 5, 'B?MB'); put(c + 9, 8, 'x');
    // boss arena: a frozen lake under an icicle ceiling
    c += 12;
    put(c, 8, 'A');
    fill(c + 2, c + 30, 0, 0, '#'); for (let k = c + 3; k <= c + 29; k += 3) put(k, 1, 'i');
    ice(c, c + 30, GROUND_ROW);
    fill(c + 31, c + 31, 1, 8, 'G');
    put(c + 20, 8, 'Y');
    put(c + 38, 8, 'F');
    movers.push({ type: 'decor', kind: 'pine', c: c + 41, r: 8 }, { type: 'decor', kind: 'lights', c: c + 40, r: 3, len: 10 });
    put(c + 44, 8, 'H');
    return { rows: L.rows(), paint: L.paint, movers, warps, theme: 'snow', name: 'main', time: 450, title: 'WINTER WONDERLAND' };
  }

  // Cabin interior reached from level 7: log walls, a fire, hot cocoa on the table.
  function buildCabin() {
    const W = 50, L = grid(W);
    const { put, fill, pipe, coins, platform, row } = L;
    fill(0, W - 1, GROUND_ROW, ROWS - 1, '#');
    fill(0, 0, 0, ROWS - 1, '#'); fill(W - 1, W - 1, 0, ROWS - 1, '#');
    fill(0, W - 1, 0, 0, '#'); put(2, 0, '.'); put(3, 0, '.');
    const movers = [{ type: 'decor', kind: 'fire', c: 7, r: 8 }];
    // the table with cocoa, bookshelf steps, presents (coins) under the tree
    platform(14, 6, 3); put(15, 5, 'M');
    platform(20, 5, 2); platform(24, 3, 2); coins(20, 4, 2); coins(24, 2, 2);
    platform(28, 5, 2); coins(28, 4, 2); row(30, 3, 'B?B');
    put(35, 8, '^'); coins(34, 2, 6); put(39, 4, 'S');
    movers.push({ type: 'decor', kind: 'pine', c: 40, r: 8 }); coins(40, 8, 4);
    pipe(46, 2, true);
    return { rows: L.rows(), movers, warps: [], theme: 'cabin', name: 'cabin', time: 0 };
  }

  // Data center reached from level 6: a dark server hall with coins between the racks.
  function buildDataCenter() {
    const W = 40, L = grid(W);
    const { put, fill, pipe, coins, platform } = L;
    fill(0, W - 1, GROUND_ROW, ROWS - 1, '#');
    fill(0, 0, 0, ROWS - 1, '#'); fill(W - 1, W - 1, 0, ROWS - 1, '#');
    fill(0, W - 1, 0, 0, '#'); put(2, 0, '.'); put(3, 0, '.');
    // racks to hop between
    fill(7, 7, 6, 8, '#'); fill(11, 11, 4, 8, '#'); fill(15, 15, 6, 8, '#'); fill(19, 19, 3, 8, '#');
    coins(5, 7, 1); coins(9, 5, 1); coins(13, 3, 1); coins(17, 5, 1); coins(21, 2, 1);
    put(8, 8, 'd'); put(13, 8, 'd');
    put(23, 2, 'S');
    platform(26, 5, 3); coins(26, 4, 3); put(30, 7, 'X'); put(30, 8, 'X'); coins(31, 8, 3); put(32, 5, '!');
    put(28, 8, 'd');
    pipe(36, 2, true);
    return { rows: L.rows(), movers: [{ type: 'hlift', c: 22, r: 7, range: 2 }], warps: [], theme: 'dc', name: 'dc', time: 0 };
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
        case '#': tiles[r][c] = { type: 'ground', c, r, paint: def.paint && def.paint[c + ',' + r] }; break;
        case 'B': tiles[r][c] = { type: 'brick', c, r }; break;
        case 'X': tiles[r][c] = { type: 'crack', c, r }; break;
        case '!': tiles[r][c] = { type: 'hidden', item: 'oneup', c, r }; break;
        case 'G': tiles[r][c] = { type: 'gate', c, r }; break;
        case 'A': arena = { c, r }; break;
        case 'Z': spawns.push({ type: 'boss', c, r }); break;
        case 'r': spawns.push({ type: 'rat', c, r }); break;
        case 'g': spawns.push({ type: 'pigeon', c, r }); break;
        case 'k': spawns.push({ type: 'raccoon', c, r }); break;
        case 'd': spawns.push({ type: 'droid', c, r }); break;
        case 'x': spawns.push({ type: 'fox', c, r }); break;
        case 'i': spawns.push({ type: 'icicle', c, r }); break;
        case 'Y': spawns.push({ type: 'snowcat', c, r }); break;
        case 'D': spawns.push({ type: 'drone', c, r }); break;
        case 'n': spawns.push({ type: 'dino', c, r }); break;
        case 'c': spawns.push({ type: 'cactus', c, r }); break;
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
    for (const m of def.movers) { if (m.type === 'decor') decor.push({ kind: m.kind, c: m.c, r: m.r, len: m.len }); else spawns.push(Object.assign({}, m)); }
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
      if (def.theme === 'cave' || def.theme === 'mansion' || def.theme === 'nyc' || def.theme === 'dc' || def.theme === 'cabin' || def.theme === 'snow' || t.paint) continue;
      if (t.top && r === H - 3 && rows[r - 1][c] === '.' && rows[r - 1][c + 1] === '.' && !pipes.some(p => c >= p.c - 1 && c <= p.c + 2) && !decor.some(d => (d.kind === 'sign' || d.kind === 'stan' || d.kind === 'sign404' || d.kind === 'offline' || d.kind === 'gbike') && c >= d.c - 2 && c <= d.c + 4)) {
        const hv = PX.hash(c * 1.31 + 5);
        if (hv > 0.9 && rows[r - 1][c + 2] === '.' && c > 4) decor.push({ kind: 'bush', c, r, s: 0.8 + PX.hash(c) * 0.4 });
        else if (hv < 0.22) decor.push({ kind: 'flower', c, r, kind2: Math.floor(PX.hash(c * 9) * 3), dx: Math.floor(PX.hash(c * 2) * 20) });
      }
    }
    return { W, H, tiles, spawns, pipes, decor, start, flag, house, arena, rows, theme: def.theme, name: def.name, warps: def.warps, time: def.time, title: def.title, look: def.look };
  }

  // Each stage is a main level plus any sub-areas reached through warps.
  const STAGES = [
    { main: buildLevel1, extras: [buildBonus] },
    { main: buildLevel2, extras: [] },
    { main: buildLevel3, extras: [] },
    { main: buildLevel4, extras: [] },
    { main: buildLevel5, extras: [] },
    { main: buildLevel6, extras: [buildDataCenter] },
    { main: buildLevel7, extras: [buildCabin] },
  ];

  window.LEVELS = { ROWS, GROUND_ROW, STAGES, buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildLevel5, buildLevel6, buildLevel7, buildBonus, buildDataCenter, buildCabin, parse };
})();
