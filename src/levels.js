// Three levels, all built from the same pieces:
//   solid   — blocks you can stand on, bonk into, wall-jump off and grab the lip of
//   ledge   — one-way: you pass up through it and land on top
//   blinker — a one-way ledge that comes and goes on a fixed cycle
//
// Every level hides its key near the top of the map and puts a gate at the right
// edge. Walking off the left edge takes you back to the previous level.

const solid = (x, y, w, h, extra) => ({ x, y, w, h, oneWay: false, ...extra });
const ledge = (x, y, w, h = 20) => ({ x, y, w, h, oneWay: true });
const blinker = (x, y, w, period, on, offset, h = 20) => ({
  x, y, w, h,
  oneWay: true,
  cycle: { period, on, offset },
});

const bound = (x, h = 2600) => solid(x, -700, 40, h, { hidden: true });

/** Is a cycling platform solid right now? */
export function cycleOn(cycle, t) {
  return (t + cycle.offset) % cycle.period < cycle.on;
}

/** Seconds until a cycling platform next changes state. */
export function cycleLeft(cycle, t) {
  const p = (t + cycle.offset) % cycle.period;
  return p < cycle.on ? cycle.on - p : cycle.period - p;
}

/** Everything the physics should collide with this frame. */
export function activeBlocks(level, t, gateOpen) {
  const out = level.solids.slice();
  for (const p of level.platforms) {
    if (!p.cycle || cycleOn(p.cycle, t)) out.push(p);
  }
  if (!gateOpen) out.push(level.gate);
  return out;
}

// ---------------------------------------------------------------- level 1

const one = {
  name: 'The Well',
  world: { w: 3600, h: 1560 },
  spawnLeft: { x: 60, y: 1330 },
  spawnRight: { x: 3260, y: 920 },

  solids: [
    bound(-40),
    bound(3600),

    // the starting well — the chimney out of it is the only exit.
    // Overhangs stop short of the floor so you can walk in underneath them.
    solid(0, 1400, 520, 80),
    solid(240, 1000, 60, 320),
    solid(400, 1000, 60, 400),

    // surface, split by a gap
    solid(460, 1000, 740, 120),
    solid(1400, 1000, 600, 120),

    // two pillars with a chimney between them
    solid(1530, 700, 60, 220),
    solid(1700, 600, 60, 400),

    // stair up to the plateau
    solid(1860, 620, 200, 26),
    solid(2140, 560, 180, 26),
    solid(2360, 660, 400, 120),

    // the tower on the plateau: climb it for the key
    solid(2400, 140, 60, 440),
    solid(2600, 200, 60, 460),

    // the run-out to the gate
    solid(2900, 1000, 700, 120),
  ],

  platforms: [
    ledge(700, 880, 140),
    ledge(940, 780, 140),
    blinker(1240, 940, 130, 3.6, 2.2, 0),
    blinker(2790, 880, 100, 3.0, 1.9, 0.7),
  ],

  // sits above the tower's left wall: top out, then one last hop
  key: { x: 2430, y: 60, r: 14 },
  gate: { x: 3380, y: 860, w: 26, h: 140, oneWay: false },
};

// ---------------------------------------------------------------- level 2

const two = {
  name: 'The Chasm',
  world: { w: 3000, h: 1500 },
  spawnLeft: { x: 60, y: 820 },
  spawnRight: { x: 2740, y: 620 },
  // no ground anywhere: everything here is a fall

  solids: [
    bound(3000),

    solid(0, 900, 320, 40), // arrival ledge
    solid(1180, 860, 500, 40), // the far side of the chasm

    // the chimney to the key
    solid(1440, 200, 60, 580),
    solid(1620, 300, 60, 560),

    solid(2340, 700, 660, 40), // gate platform
  ],

  platforms: [
    // The crossing: nothing under these, and they all come and go. The phases
    // are staggered so consecutive pairs overlap for about a second — enough to
    // cross if you go when the next one appears, not enough to dawdle.
    blinker(400, 880, 110, 3.4, 2.4, 0.0),
    blinker(600, 840, 110, 3.4, 2.4, 1.1),
    blinker(800, 880, 110, 3.4, 2.4, 2.2),
    blinker(1000, 820, 110, 3.4, 2.4, 0.6),

    // the way down to the gate
    blinker(1780, 420, 110, 3.2, 2.2, 0.4),
    blinker(1980, 520, 110, 3.2, 2.2, 1.5),
    blinker(2180, 620, 110, 3.2, 2.2, 2.6),
  ],

  key: { x: 1470, y: 110, r: 14 },
  gate: { x: 2820, y: 560, w: 26, h: 140, oneWay: false },
};

// ---------------------------------------------------------------- level 3

const three = {
  name: 'The Spire',
  world: { w: 2800, h: 1900 },
  spawnLeft: { x: 60, y: 1420 },
  spawnRight: { x: 2600, y: 1420 },

  solids: [
    bound(2800),

    solid(0, 1500, 900, 120),
    solid(1100, 1500, 600, 120),
    solid(1900, 1500, 900, 120),

    // the spire: one long chimney, ~1200 units of climbing
    solid(1300, 320, 60, 1100),
    solid(1480, 200, 60, 1300),
  ],

  platforms: [
    blinker(950, 1400, 120, 3.0, 1.8, 0.0),
    blinker(1750, 1400, 120, 3.0, 1.8, 1.4),

    // rest stops inside the chimney — one-way, so they never block the climb
    blinker(1360, 1120, 120, 4.0, 2.4, 0.0, 16),
    blinker(1360, 760, 120, 4.0, 2.4, 2.0, 16),

    // the descent to the gate
    ledge(1660, 520, 120),
    blinker(1840, 780, 120, 3.4, 2.1, 0.8),
    ledge(2020, 1020, 120),
    blinker(2200, 1260, 120, 3.4, 2.1, 2.0),
  ],

  key: { x: 1510, y: 90, r: 14 },
  gate: { x: 2560, y: 1360, w: 26, h: 140, oneWay: false },
};

export const LEVELS = [one, two, three];
