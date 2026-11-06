// Pixel maps and palettes for the core cast, plus the animation frames built
// from them. Frames are offscreen canvases; `.r` faces right, `.l` faces left.
(function () {
  const { render, spriteFromMap, flipH, flipV, makeCanvas } = PX;

  const MAPS = {
    CAT: [
      '.....K........................K.....',
      '.....KK......................KK.....',
      '.....KHK....................KHK.....',
      '.....KHHKK................KKHHK.....',
      '.....KPPHOK..KKKKKKKKK...KOOPPK.....',
      '....KHPPPOKKKHHHHSSHHHKKKDDPPPHK....',
      '....KHPPKKHHHSSHHSSHHSSOHKKPPPHK....',
      '....KOpKHHHHHSHHOSSHOSOOOOOKppOK....',
      '....KpKHHHHHHHHHHHHOHOOOOOOOKppK....',
      '....KKHHHHHHHHOHOHOOOOOOOOOODKKK....',
      '.....KHHHHHHHOHOHOOOOOOOOOOOOK......',
      '....KHHHOKKKKOOOOOOOOOOKKKKODDK.....',
      '....KHHHKVVEEKOOOOOOOOKVVEEKODK.....',
      'ZZ..KSSSKVVEEKOOOOOOOOKVVEEKSSK...ZZ',
      '..ZZKOHOKEEEEKOOOOOOODKEEEEKDDK.ZZ..',
      '....KSSOKEEGGKOWWWWWDDKEEGGKDSK.....',
      '..ZZ.KOOOKKKKWWWnLNnWWDKKKKDDK..ZZ..',
      'ZZ...KBBBBBOWWWWWNnWWWWDBBBBBK....ZZ',
      '....K.KBBBBWWWmWWmmWWmWWBBBBK..K....',
      '...KKK.KBBDWWWWmmWWmmWWWRBBK..KKK...',
      '.....K..KKOWWWWWWWWWWWWWDKK...K.....',
      '..........KKKWWWWWWWWWKKK...........',
      '....KKKK.....KKKKKKKKK..............',
      '..KKOOOWKK...KKKKKKKKK..............',
      '.KSOOOOWWK.KKHHHHHHHHOKK............',
      '.KSSDDWWWwKHHHHHHHOHOOOOK...........',
      '.KSSSKKKwKSSHHHWWWWWOOOOSK..........',
      'KHOSK...KKHHHHWWWWWWWOOODK..........',
      'KOODK...KHHHHWWWWWWWWWOOODK.........',
      'KOOOK...KSSSOWWWWWWWWWDSSSK.........',
      '.KSSK...KHHOWWWWWWWWWWWDDDK.........',
      '.KSSSK..KHOOWWWWWWWWWWWDDDK.........',
      '.KSSOK..KOSSWWWWWWWWWWWSSSK.........',
      '.KOOOOK..KOOWWWWWWWWWWwDDK..........',
      '..KOOOOKKKOOOWWWWWWWWwDDDK..........',
      '...KOOOOOOKKKKKKwWwWKKKKK...........',
      '...KKOOOOOOKOODKWwWwKOODK...........',
      '.....KKODDKKWWWKKKKKKWWWK...........',
      '.......KKKKWWwWWK..KWWwWWK..........',
      '..........KKKKKKK..KKKKKKK..........',
    ],
    MOUSE: [
      '........KKKKK...................',
      '.......KHHHHGK..KKK.............',
      '......KHHPPPHGKKDDDK............',
      '......KHPPPPPGKDDDDDK...........',
      '......KHPPPPPDKDpppDDK..........',
      '......KHPPPPPDKpppppDK..........',
      '......KGpppppDKpppppDK..........',
      '.....KKKKGppKKKKKKKKKKK.........',
      '....KKKHHKKKHKKHHHHHHHHKK.......',
      '...KHHHKKHGHGGGKHHHHGHGHGK......',
      '..KHHHVEHHHGGGGKHHHGHGHGGGKKKKK.',
      '..KHHHEEGHGGGGDKGHGGGGGGGGGK.KK.',
      '.KKKKKEEGGGGGGGKHGHGGGGGGGGK.KPK',
      'KKKHGGGKGGGGDDDKGGGGGGGGDGDK..KK',
      'KpVGGGGKBBBDGDDKHHHGGGGDGDGK.KPK',
      '.KKGDGDKGBDDDDDKHHHHDGDDDDDK.KK.',
      '..KKKKKGGDDDDKKHHHHHHDGDDDKKKKK.',
      '.....KKGDDDKKHHHHHHHHDDDDDKK....',
      '.......KKKKHHHHHHHHHDDDDKK......',
      '.......KKKKKKHHHHHHKKKKK........',
      '......KPPPPK.KKKKKKPPPPK........',
      '.......KKKK........KKKK.........',
    ],
    FISH: [
      '..........K...............KK',
      '.........KDK.KKK.........KRK',
      '........KDDDKDDDK.......KRRK',
      '......KKKKKKKKKDK......KRRRK',
      '....KKHWwHHHHHWKK.....KRRRDK',
      '..KKHHHWwHOHOOWwOKK.KKRRRDRK',
      '.KHHHHHWwOHOOOWwOOOKRRRRDRK.',
      '.KHVEHOWwOOOOOWwDODKRRRDRK..',
      'KHHEEOHWwOOOOOWwODODKRDRK...',
      'KHOHOOOWwOOOOOWwDDDDKDRRK...',
      'KKKOOOOWwORRRRRwDDDDKRRRRK..',
      '.KOOOOOWwODRRRWwDDDKRRRRDRK.',
      '.KOOOOLWwLLLRLWwDDDKKKRDRRRK',
      '..KKLLLWwLLLRLWwLKK...KRRRRK',
      '....KKLWwLLLLLWKK......KRRDK',
      '......KKKKKKKKK.........KDRK',
      '.........................KRK',
      '..........................KK',
    ],
    COIN: [
      '.....KK.....', '...KKHHKK...', '..KHHHHHHK..', '..KHHYDHHK..', '.KHVYYDDHHK.', '.KHVYHDDDHK.', '.KHYYHDDDYK.',
      'KHHYYHDDDYYK', 'KHHYYHDDDYYK', 'KHHYYHDDDYYK', 'KHHYYHDDDYYK', 'KHHYYYDDDYDK', 'KHHYYYDDDYYK', '.KYYYYDDDYK.',
      '.KHYYYDDDDK.', '.KYYYYDDDDK.', '..KYYYDDYK..', '..KYYYDDDK..', '...KKDYKK...', '.....KK.....',
    ],
    SCOIN: ['...KK...', '.KKHHKK.', '.KHHHHK.', 'KHVHDYYK', 'KHHHDYYK', 'KHYYDYYK', 'KHHYDYYK', '.KYYDYK.', '.KKYYKK.', '...KK...'],
    HCAT: [
      '..K............K..', '..KK..........KK..', '..POK.KKKKKK.KOP..', '..KOKKHHHHOHKKOK..', '..KKHHHHHHHOHOKK..',
      '..KHHHOHOHOOOOOK..', '.KHHVEHOOOOOVEODK.', '.KHHEEOOOOOOEEDDK.', '.KHOHOOOOOODODDDK.', '.KOBOOOOnnDDDDBDK.',
      '..KOOOODODDDDDDK..', '..KKDODDDDDDRDKK..', '....KKDDDDDDKK....', '......KKKKKK......',
    ],
  };

  const catPal = {
    K: '#4a2519', H: '#ffc67a', O: '#f4a145', D: '#d27a35', R: '#a85a28', S: '#a24c1f',
    W: '#fffaf2', w: '#ebdcd2', v: '#cdb8b3', P: '#ffa4b6', p: '#d9627f', B: '#ff8fa3',
    E: '#2a1830', G: '#5cc4a8', V: '#ffffff', N: '#e8607e', n: '#b8405e', L: '#ffbccb', m: '#6b2f3a', Z: '#fff4e6',
  };
  // Yarn form: cream coat, rose stripes, blue collar.
  const yarnPal = Object.assign({}, catPal, {
    H: '#fff6e4', O: '#ffe3bd', D: '#f0c08d', R: '#d49a60', S: '#e86f9b', B: '#5a9bff', K: '#4b2a3a', G: '#4f9fe0',
  });
  // Star palettes cycle while invincible.
  const starPals = [
    Object.assign({}, catPal, { H: '#fff6b0', O: '#ffe15a', D: '#f5b821', S: '#d6871a', B: '#ffffff' }),
    Object.assign({}, catPal, { H: '#ffd6f2', O: '#ff9fd8', D: '#e86fc0', S: '#b74a9a', B: '#fff6b0' }),
    Object.assign({}, catPal, { H: '#d6f6ff', O: '#8fdcff', D: '#5ab4f0', S: '#2f86c8', B: '#ffd6f2' }),
  ];
  const mousePal = {
    K: '#37314d', H: '#e4e0f0', G: '#b0aac4', D: '#8a84a3', R: '#615c7d', P: '#f7aebf', p: '#d57a92',
    E: '#2a1830', V: '#ffffff', B: '#ff9fb2',
  };
  const fishPal = {
    K: '#7a2a1c', H: '#ffcf86', O: '#ff9a3c', D: '#f0662a', R: '#c9441f', L: '#ffd9a8', W: '#ffffff', w: '#ffe3d0',
    E: '#2a1830', V: '#ffffff',
  };
  const coinPal = { K: '#7a3f0c', H: '#fff3a8', Y: '#ffd23f', D: '#e8a022', R: '#b8670f', V: '#ffffff' };

  // ----- cat frames -----
  // The body/feet split lets walk and jump frames move each foot separately.
  const FEET_ROW = 37;          // first row of the feet block in MAPS.CAT
  const FEET_SPLIT = 18;        // column separating the left and right foot
  // The big form keeps the head, inserts 16 rows of torso, and moves the tail
  // down with the hips so it still attaches there.
  function bigRows() {
    const r = MAPS.CAT;
    const tailSplit = i => i <= 25 ? 10 : i === 26 ? 9 : 8;
    const bodyOnly = i => '.'.repeat(tailSplit(i)) + r[i].slice(tailSplit(i));
    const overlay = (tail, body) => body.split('').map((ch, k) => ch !== '.' ? ch : tail[k]).join('');
    const plain = [28, 28, 29, 28, 28, 28, 27, 28].map(bodyOnly);
    const out = r.slice(0, 22);
    for (let i = 22; i <= 29; i++) out.push(bodyOnly(i));
    out.push(...plain);
    for (let i = 22; i <= 29; i++) out.push(overlay(r[i].slice(0, tailSplit(i)) + '.'.repeat(r[i].length - tailSplit(i)), plain[i - 22]));
    return out.concat(r.slice(30));
  }
  function catFrame(rows, pal, o) {
    const w = rows[0].length, h = rows.length + 2;
    const feetRow = rows.length - (MAPS.CAT.length - FEET_ROW);
    const body = rows.slice(0, feetRow);
    const feet = rows.slice(feetRow);
    const lf = feet.map(s => s.slice(0, FEET_SPLIT));
    const rf = feet.map(s => '.'.repeat(FEET_SPLIT) + s.slice(FEET_SPLIT));
    return render(w, h, p => {
      p.blit(body, pal, 0, o.by);
      p.blit(lf, pal, o.lx, feetRow + o.ly);
      p.blit(rf, pal, o.rx, feetRow + o.ry);
      if (o.eyesClosed) {
        // squint lines for the hurt/dead frame
        const ey = o.by + 13;
        p.rect(9, ey, 4, 1, pal.E); p.rect(23, ey, 4, 1, pal.E);
        p.rect(9, ey + 1, 4, 3, pal.O); p.rect(23, ey + 1, 4, 3, pal.O);
        p.rect(9, ey + 1, 1, 1, pal.E); p.rect(12, ey + 1, 1, 1, pal.E); p.rect(23, ey + 1, 1, 1, pal.E); p.rect(26, ey + 1, 1, 1, pal.E);
      }
    });
  }
  function catSet(rows, pal) {
    const F = (o) => { const cv = catFrame(rows, pal, Object.assign({ by: 2, lx: 0, ly: 2, rx: 0, ry: 2 }, o)); return { r: cv, l: flipH(cv) }; };
    return {
      idle: F({}),
      walk: [F({ by: 1, lx: 2, ly: 2, rx: -2, ry: 2 }), F({}), F({ by: 1, lx: -2, ly: 2, rx: 2, ry: 2 }), F({})],
      jump: F({ by: 0, lx: 1, ly: 1, rx: -2, ry: 3 }),
      swim: [F({ by: 1, lx: 1, ly: 1, rx: -1, ry: 2 }), F({ by: 1, lx: -1, ly: 2, rx: 1, ry: 1 })],
      skid: F({ by: 2, lx: 3, ly: 2, rx: 3, ry: 2 }),
      dead: F({ by: 2, lx: -2, ly: 0, rx: 2, ry: 0, eyesClosed: true }),
      h: rows.length + 2, w: rows[0].length,
    };
  }
  // The four playable cats are palette swaps of the same pixel map.
  const mochiPal = Object.assign({}, catPal, { K: '#15121c', H: '#5e5870', O: '#3c3748', D: '#2b2736', R: '#201c2a', S: '#4c4660', G: '#ffd25e', B: '#ff6b8a' });
  const biscuitPal = Object.assign({}, catPal, { K: '#5a3a2a', H: '#fff3dc', O: '#f7e2bc', D: '#e5bf90', R: '#cf9a6a', S: '#ee8e4a', G: '#4f9fe0', B: '#7ad17a' });
  const bluePal = Object.assign({}, catPal, { K: '#2a2f44', H: '#d0d6e8', O: '#a2abc6', D: '#7f89a6', R: '#636c88', S: '#737ea0', G: '#ffb347', B: '#ffd25e' });
  const CAT_PALS = [catPal, mochiPal, biscuitPal, bluePal];
  const CAT_NAMES = ['WHISKERS', 'MOCHI', 'BISCUIT', 'BLUE'];
  const yarnify = p => Object.assign({}, p, { S: '#e86f9b', B: '#5a9bff', G: '#4f9fe0' });
  const starify = p => [
    Object.assign({}, p, { H: '#fff6b0', O: '#ffe15a', D: '#f5b821', S: '#d6871a', B: '#ffffff' }),
    Object.assign({}, p, { H: '#ffd6f2', O: '#ff9fd8', D: '#e86fc0', S: '#b74a9a', B: '#fff6b0' }),
    Object.assign({}, p, { H: '#d6f6ff', O: '#8fdcff', D: '#5ab4f0', S: '#2f86c8', B: '#ffd6f2' }),
  ];
  const makeCat = (pal, i) => ({
    small: catSet(MAPS.CAT, pal),
    big: catSet(bigRows(), pal),
    yarn: catSet(bigRows(), i === 0 ? yarnPal : yarnify(pal)),
    starSmall: starify(pal).map(p => catSet(MAPS.CAT, p)),
    starBig: starify(pal).map(p => catSet(bigRows(), p)),
    hcat: spriteFromMap(MAPS.HCAT, pal),
    name: CAT_NAMES[i],
  });
  const cats = CAT_PALS.map(makeCat);
  const cat = cats[0];

  // ----- mouse -----
  function mouseFrame(dx) {
    const rows = MAPS.MOUSE, w = rows[0].length, h = rows.length;
    const body = rows.slice(0, h - 2), feet = rows.slice(h - 2);
    const lf = feet.map(s => s.slice(0, 13)), rf = feet.map(s => '.'.repeat(13) + s.slice(13));
    const cv = render(w, h, p => { p.blit(body, mousePal, 0, 0); p.blit(lf, mousePal, dx, h - 2); p.blit(rf, mousePal, -dx, h - 2); });
    return { l: cv, r: flipH(cv) };
  }
  const ratPal = Object.assign({}, mousePal, { H: '#9a8a78', G: '#6e5e50', D: '#4e4036', R: '#362a24', P: '#d89aa0', p: '#a86a74', K: '#241a16' });
  const ratSquish = render(32, 22, (p, ctx) => { ctx.drawImage(spriteFromMap(MAPS.MOUSE, ratPal), 0, 12, 32, 10); });
  const rat = { walk: [0, 1].map(k => { const rows = MAPS.MOUSE, w = rows[0].length, h = rows.length, dx = k ? -1 : 1; const body = rows.slice(0, h - 2), feet = rows.slice(h - 2); const lf = feet.map(s => s.slice(0, 13)), rf = feet.map(s => '.'.repeat(13) + s.slice(13)); const cv = render(w, h, p => { p.blit(body, ratPal, 0, 0); p.blit(lf, ratPal, dx, h - 2); p.blit(rf, ratPal, -dx, h - 2); }); return { l: cv, r: flipH(cv) }; }), squish: { l: ratSquish, r: flipH(ratSquish) } };
  const squishSrc = spriteFromMap(MAPS.MOUSE, mousePal);
  const squish = render(32, 22, (p, ctx) => { ctx.drawImage(squishSrc, 0, 12, 32, 10); });
  const mouse = { walk: [mouseFrame(1), mouseFrame(-1)], squish: { l: squish, r: flipH(squish) }, w: 32, h: 22 };

  // ----- fish -----
  function fishFrame(tailDy) {
    const rows = MAPS.FISH, w = rows[0].length, h = rows.length;
    const body = rows.map(s => s.slice(0, 20) + '.'.repeat(8)), tail = rows.map(s => '.'.repeat(20) + s.slice(20));
    const cv = render(w, h, p => { p.blit(tail, fishPal, 0, tailDy); p.blit(body, fishPal, 0, 0); });
    return { l: cv, r: flipH(cv) };
  }
  const fish = { swim: [fishFrame(0), fishFrame(-1), fishFrame(0), fishFrame(1)], w: 28, h: 18 };

  // ----- coin -----
  const coinFull = spriteFromMap(MAPS.COIN, coinPal);
  function coinFrame(w) {
    return render(12, 20, (p, ctx) => {
      if (w <= 2) { p.rect(5, 1, 2, 18, coinPal.H); p.rect(5, 0, 2, 1, coinPal.K); p.rect(5, 19, 2, 1, coinPal.K); return; }
      ctx.drawImage(coinFull, Math.round((12 - w) / 2), 0, w, 20);
    });
  }
  const coin = { spin: [coinFrame(12), coinFrame(8), coinFrame(2), coinFrame(8)], w: 12, h: 20 };
  const scoin = spriteFromMap(MAPS.SCOIN, coinPal);
  const hcat = spriteFromMap(MAPS.HCAT, catPal);

  // ----- extras from sprites_extra.js (hedgehog, items, flag, house) -----
  function ex(name) {
    const s = window.SPR_EXTRA && window.SPR_EXTRA[name];
    if (!s) {
      const cv = render(24, 24, p => { p.rect(0, 0, 24, 24, '#ff00ff'); p.rect(4, 4, 16, 16, '#000000'); });
      return { r: cv, l: cv, w: 24, h: 24 };
    }
    const cv = spriteFromMap(s.rows, s.pal);
    return { r: cv, l: flipH(cv), w: s.w, h: s.h };
  }
  const extras = {};
  for (const n of ['HEDGEHOG', 'HEDGEHOG_BALL', 'FISH_ITEM', 'YARN_ITEM', 'YARN_BALL', 'YARN_BALL2', 'FLAG', 'HOUSE', 'STAR']) extras[n] = ex(n);
  for (const n of ['TAXI', 'TAXI2', 'TRAIN_FRONT', 'TRAIN_CAR', 'PIGEON', 'PIGEON2', 'RACCOON', 'RACCOON_THROW', 'LID', 'VENT', 'WATER_TOWER', 'HOTDOG_CART']) {
    const sb = window.SPR_CITY && window.SPR_CITY[n];
    if (sb) { const cv = spriteFromMap(sb.rows, sb.pal); extras[n] = { l: cv, r: flipH(cv), w: sb.w, h: sb.h }; }
    else { const cv = render(32, 16, p => { p.rect(0, 0, 32, 16, '#ff00ff'); p.rect(4, 4, 24, 8, '#000000'); }); extras[n] = { l: cv, r: cv, w: 32, h: 16 }; }
  }
  for (const n of ['BOSS', 'BOSS_WALK', 'BOSS_HURT', 'BOSS_CHARGE', 'BONE', 'CANDLE', 'PORTRAIT']) {
    const sb = window.SPR_BOSS && window.SPR_BOSS[n];
    if (sb) { const cv = spriteFromMap(sb.rows, sb.pal); extras[n] = { l: cv, r: flipH(cv), w: sb.w, h: sb.h }; }
    else { const cv = render(64, 48, p => { p.rect(0, 0, 64, 48, '#ff00ff'); p.rect(8, 8, 48, 32, '#000000'); }); extras[n] = { l: cv, r: cv, w: 64, h: 48 }; }
  }
  // Hedgehog art faces left like the mouse, so swap sides.
  const hedgehog = { walk: [extras.HEDGEHOG, extras.HEDGEHOG], ball: extras.HEDGEHOG_BALL, w: extras.HEDGEHOG.w, h: extras.HEDGEHOG.h };
  hedgehog.walk[0] = { l: extras.HEDGEHOG.r, r: extras.HEDGEHOG.l };
  hedgehog.walk[1] = render(extras.HEDGEHOG.w, extras.HEDGEHOG.h, (p, ctx) => { ctx.drawImage(extras.HEDGEHOG.r, 0, -1); });
  hedgehog.walk[1] = { l: hedgehog.walk[1], r: flipH(hedgehog.walk[1]) };

  // fragments of a broken brick / cracked rock
  const frag = render(10, 10, p => {
    p.rect(0, 0, 10, 10, '#5b2a1c'); p.rect(1, 1, 8, 8, '#cf6a40'); p.rect(1, 1, 8, 1, '#f5a278'); p.rect(1, 7, 8, 2, '#a64a2a');
  });
  const rockFrag = render(10, 10, p => {
    p.rect(0, 0, 10, 10, '#3f3a4a'); p.rect(1, 1, 8, 8, '#9a93a8'); p.rect(1, 1, 8, 1, '#cfc8dc'); p.rect(1, 7, 8, 2, '#6c6578');
  });

  // ----- bouncy mushroom -----
  const MUSH = [
    '..........KKKKKKKKKKKK..........',
    '.......KKKRRRRRRRRRRRRKKK.......',
    '.....KKRRRRWWWRRRRRRRRRRKK......',
    '....KRRRRRWWWWWRRRRWWRRRRRK.....',
    '...KRRRRRRRWWWRRRRRWWWWRRRRK....',
    '..KRRRRRRRRRRRRRRRRRWWRRRRRRK...',
    '.KRRRRWWRRRRRRRRRRRRRRRRRRRRRK..',
    'KRRRRRWWWRRRRRRRRRRRRRRRRWWRRRK.',
    'KRRRRRRWWRRRRRRRRRRRRRRRRWWRRRRK',
    'KDRRRRRRRRRRRRRRRRRRRRRRRRRRRDDK',
    'KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK',
    '.KKKKKKKKKCCCCCCCCCCCCKKKKKKKKK.',
    '.........KCCCCCCCCCCCcK.........',
    '.........KCCCCCCCCCCccK.........',
    '.........KCCCCCCCCCcccK.........',
    '.........KCCCCCCCCCcccK.........',
    '.........KCCCCCCCCccccK.........',
    '........KCCCCCCCCCcccccK........',
    '........KcccccccccccccK.........',
    '........KKKKKKKKKKKKKKK.........',
  ];
  const mushPal = { K: '#4a1d2a', R: '#ff5a6e', D: '#c8364e', W: '#fff4f4', C: '#fff0d8', c: '#e8c9a6' };
  const mushFull = spriteFromMap(MUSH, mushPal);
  const mushroom = {
    idle: mushFull,
    squash: render(32, 20, (p, ctx) => { ctx.drawImage(mushFull, -3, 8, 38, 12); }),
    w: 32, h: 20,
  };

  // ----- 1-up: a little milk carton -----
  const MILK = [
    '.....KKKKKK.....',
    '....KWWWWWWK....',
    '...KWWWWWWWWK...',
    '..KWWWWWWWWWWK..',
    '.KBBBBBBBBBBBBK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWKKKWWKKKWWK.',
    '.KWWKEKWWKEKWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWWWWPPWWWWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KBBBBBBBBBBBBK.',
    '.KBBBBBBBBBBBBK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KwwwwwwwwwwwwK.',
    '.KKKKKKKKKKKKKK.',
  ];
  const milkPal = { K: '#2a3a5a', W: '#ffffff', w: '#d8e2f0', B: '#4a9bff', E: '#2a1830', P: '#ff8fa3' };
  const milk = spriteFromMap(MILK, milkPal);

  window.SPRITES = { MAPS, catPal, yarnPal, mousePal, fishPal, coinPal, cat, cats, CAT_NAMES, mouse, rat, fish, coin, scoin, hcat, hedgehog, extras, frag, rockFrag, mushroom, milk };
})();
