# Super Whiskers

A Super Mario Bros–style platformer starring Whiskers the cat. Plain HTML5 Canvas and
JavaScript — no build step, no dependencies, no asset files. All pixel art and audio
are generated in code at load time.

**Play it:** https://wukath.github.io/super-whiskers/

![Super Whiskers](social-preview.png)

![Gameplay](press/trailer.gif) ![Boss fight](press/trailer-boss.gif)

## Online co-op

Press **O** on the title screen to host a room; friends press **J** and type the 4-letter
code, or open the `?room=CODE` link shown in the lobby. Up to four cats (Whiskers, Mochi,
Biscuit, Blue — pick with ←/→ in the lobby). The host's browser runs the game and streams
state to the others over WebRTC (PeerJS), so there is no game server. Lives, coins and
score are shared; a cat that dies floats back as a bubble that a teammate can pop; warp
pipes and the flag take everyone along.

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys / WASD |
| Jump (hold for higher) | Space / Z / Up |
| Run + throw yarn | Shift / X |
| Pounce dash | C / L |
| Duck / crawl | Down on the ground |
| Ground pound | Down while in the air |
| Enter a warp pipe | Down while standing on it |
| Wall jump | Push into a wall while falling, then jump |
| Pause / mute | P / M |
| Start at a level | 1 – 7 on the title screen |
| Host / join online | O / J on the title screen |

## Levels

1. **Meadow** — grassy intro with a secret bonus cave through the warp pipe.
2. **Crystal Caves** — underground: wall-jump shaft, falling platforms, a wall you must pounce through.
3. **Sunset Shore** — beach at dusk, mostly water crossings on logs and islands.
4. **Evil Mansion** — a haunted house with trapdoors, chandelier lifts and a flooded cellar,
   ending in a locked arena where **Duke** the bulldog waits. Stomp his head three times
   (yarn balls and pounces chip him too) while he charges, slams and lobs bones.
5. **Midtown Rush** — New York at night. Dodge or ride yellow cabs, climb fire escapes to
   the rooftops, ride an elevated train (duck under the signals), surf steam vents over
   open manholes. Rats, swooping pigeons and lid-throwing raccoons.
6. **The Googleplex** — a sunny campus where the terrain spells GOOGLE in Material-colored
   blocks. Ride Street View cars, stomp bugdroids (twice — the first hit only dents them), dodge
   parcels from delivery drones, take a warp pipe into a data center full of blinking racks, then
   survive the "no internet" run: hop the cacti before the Chrome dino wakes up and charges, with
   Stan the T-rex looking on. Climb the office towers past the G totem to a rainbow staircase.
7. **Winter Wonderland** — it snows the whole way. A village of lit pines and string lights, a
   frozen pond (ice is slippery), a ski hill you climb by chairlift platforms and slide down on icy
   steps, a cabin you drop into through the chimney for hot cocoa by the fire, an icicle cave, and
   finally **Frosty** the snowcat on a frozen lake: pounces, slams that shake icicles loose, and
   rolling giant snowballs you can bounce off. Foxes lob snowballs and hop away when you get close.

Power-ups: fish snack (grow), ball of yarn (throw bouncing yarn balls), star (invincible),
milk carton (1-up, hidden in invisible blocks), hot cocoa (grow + a moment of warmth, winter only).

## Running locally

Open `index.html` in a browser. That's it.

## Layout

- `js/pixel.js` — pixel painter, sprite cache, bitmap font
- `js/sprites.js`, `js/sprites_extra.js`, `js/sprites_boss.js`, `js/sprites_city.js`, `js/sprites_plex.js`, `js/sprites_snow.js` — pixel maps and animation frames
- `js/tiles.js` — tiles, blocks, pipes, water, themed backgrounds
- `js/level.js` — level definitions and parser
- `js/entities.js` — player physics, enemies, items, platforms, effects
- `js/audio.js` — synthesized sound effects and music
- `js/net.js` — PeerJS room hosting/joining
- `js/game.js` — game loop, camera, HUD, states, co-op and netcode
