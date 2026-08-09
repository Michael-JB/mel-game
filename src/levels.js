// Three levels. The rule for every one of them: there is a single route, and
// every platform on it is load-bearing — take any one away and the level cannot
// be finished. Gaps that must be crossed are wider than a jump (~190 units);
// gaps that must be jumpable are 130 or less.
//
//   solid   — blocks you can stand on, bonk into, wall-jump off and grab the lip of
//   ledge   — one-way: you pass up through it and land on top
//   blinker — a one-way ledge that comes and goes on a fixed cycle
//   mover   — a one-way ledge that slides back and forth along a fixed track
//
// Every level hides its key at the top of a chimney. The whole right edge of the
// map is the way out: with the key it is a portal, without it a wall. The left
// edge takes you back to the previous level.

// `kind` is purely visual, and says what the block is in the city: a building
// (its facade runs on down out of sight), the street, a chimney stack, a
// billboard you duck through the legs of, a rooftop plant room, or — inside the
// office block — a floor slab or a lift shaft.
const solid = (x, y, w, h, kind = 'slab', extra) => ({ x, y, w, h, oneWay: false, kind, ...extra });
const ledge = (x, y, w, h = 20) => ({ x, y, w, h, oneWay: true });
const blinker = (x, y, w, period, on, offset, h = 20) => ({
  x, y, w, h,
  oneWay: true,
  cycle: { period, on, offset },
});
const mover = (x, y, w, h, dx, dy, period, offset = 0) => ({
  x, y, w, h,
  oneWay: true,
  move: { dx, dy, period, offset },
});

const bound = (x, h = 2600) => solid(x, -700, 40, h, 'slab', { hidden: true });

/** Is a cycling platform solid right now? */
export function cycleOn(cycle, t) {
  return (t + cycle.offset) % cycle.period < cycle.on;
}

/** Seconds until a cycling platform next changes state. */
export function cycleLeft(cycle, t) {
  const p = (t + cycle.offset) % cycle.period;
  return p < cycle.on ? cycle.on - p : cycle.period - p;
}

/** Where a moving platform is right now — a smooth there-and-back. */
export function moverAt(p, t) {
  const phase = ((t + p.move.offset) / p.move.period) % 1;
  const s = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  return { ...p, x: p.x + p.move.dx * s, y: p.y + p.move.dy * s };
}

/** Everything the physics should collide with this frame. */
export function activeBlocks(level, t, hasKey) {
  const out = level.solids.slice();
  for (const p of level.platforms) {
    if (p.cycle && !cycleOn(p.cycle, t)) continue;
    out.push(p.move ? moverAt(p, t) : p);
  }
  // the exit is sealed until you have the key
  if (!hasKey) out.push(bound(level.world.w, level.world.h + 1600));
  return out;
}

// ---------------------------------------------------------------- level 1
// Wall-climb out of the well, cross two voids on blinkers, climb the tower.

const one = {
  name: 'The Well',
  setting: 'exterior',
  world: { w: 3200, h: 1500 },
  spawnLeft: { x: 350, y: 1230 },
  spawnRight: { x: 3140, y: 830 },

  solids: [
    bound(-40),

    // You start at the bottom of the alley between two blocks. The 100-unit slot
    // between their walls is the only way up to the roofs.
    solid(0, 900, 320, 700, 'building'),
    solid(0, 1300, 460, 200, 'street'),
    solid(420, 900, 680, 700, 'building'), // (void from 1100 to 1420)

    solid(1420, 900, 520, 700, 'building'), // (void from 1940 to 2260)

    // on its roof: a sign on a lattice mast, and the stack of the old boiler
    // house next to it. The 120 between them is the climb to the key.
    solid(1600, 180, 60, 640, 'billboard'),
    solid(1780, 240, 60, 660, 'chimney'),

    solid(2260, 900, 940, 700, 'building'), // the run-out to the portal
  ],

  platforms: [
    blinker(1200, 860, 120, 3.6, 2.2, 0.0, 22),
    blinker(2040, 860, 120, 3.2, 2.0, 1.4, 22),
  ],

  key: { x: 1630, y: 110, r: 14 },
};

// ---------------------------------------------------------------- level 2
// No ground at all. Six blinkers, each one the only way past its gap.

const two = {
  name: 'The Chasm',
  setting: 'exterior',
  world: { w: 2800, h: 1400 },
  spawnLeft: { x: 60, y: 720 },
  spawnRight: { x: 2730, y: 620 },

  solids: [
    solid(0, 800, 300, 700, 'building'),
    solid(1380, 780, 420, 720, 'building'), // the far side

    // the climb to the key: a sign mast and a stack, 120 apart
    solid(1560, 200, 60, 500, 'billboard'),
    solid(1740, 260, 60, 520, 'chimney'),

    solid(2400, 700, 400, 800, 'building'), // the roof the window opens off
  ],

  platforms: [
    // the crossing — staggered so consecutive pairs are up together for about
    // a second: long enough to keep moving, not long enough to wait
    blinker(430, 780, 110, 3.4, 2.4, 0.0, 24),
    blinker(670, 740, 100, 3.4, 2.4, 1.1, 18),
    blinker(900, 790, 120, 3.4, 2.4, 2.2, 30),
    blinker(1150, 730, 100, 3.4, 2.4, 0.6, 16),

    // the way down to the portal
    blinker(1930, 420, 110, 3.2, 2.2, 0.4, 26),
    blinker(2170, 560, 100, 3.2, 2.2, 1.7, 20),
  ],

  key: { x: 1590, y: 130, r: 14 },
  // you leave this one by diving through a window into the block next door
  exit: { style: 'window', y: 700, h: 210 },
};

// ---------------------------------------------------------------- level 3
// Moving platforms. Three of them, each ferrying you over a gap nothing else
// reaches, plus one ledge to break the fall out of the spire.

const three = {
  name: 'The Vacant Floors',
  setting: 'interior',
  // the back wall of the office block, and the panes punched into it
  windows: { from: 0, spacing: 340, mullion: 52, top: 260, bottom: 1240 },
  world: { w: 2600, h: 1800 },
  spawnLeft: { x: 60, y: 1320 },
  spawnRight: { x: 2520, y: 830 },

  solids: [
    solid(0, 1400, 700, 200, 'floor'),
    solid(1180, 1400, 420, 200, 'floor'),

    // twin lift shafts, doors standing open — a 1100-unit climb to the key
    solid(1250, 300, 60, 1020, 'liftshaft'),
    solid(1430, 360, 60, 1040, 'liftshaft'),

    solid(1600, 560, 110, 20, 'slab'), // the one static step on the way down
    solid(2500, 900, 100, 200, 'floor'), // the mezzanine the portal opens off
  ],

  platforms: [
    mover(760, 1360, 120, 24, 300, 0, 7.0, 0.0), // ferry across the entry void
    mover(1780, 660, 110, 22, 320, 0, 6.4, 1.2), // ferry east over the deep
    mover(2280, 1100, 110, 22, 0, -280, 5.0, 0.5), // lift up to the shelf
  ],

  key: { x: 1280, y: 230, r: 14 },
  // ...and arrive on the inside of that same broken pane
  entry: { style: 'window', y: 1400, h: 210, inside: true },
};

export const LEVELS = [one, two, three];

// stable ids so the player can tell which platform it is riding
LEVELS.forEach((lv, li) => lv.platforms.forEach((p, pi) => (p.id = `${li}:${pi}`)));
