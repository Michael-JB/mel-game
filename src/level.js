// Level 1 — "The Sunken Key".
// Ground sits at y=820 with two gaps. The right-hand gap is a shaft down into a
// cavern that hides the key; the door is far right on the surface.

const solid = (x, y, w, h) => ({ x, y, w, h, oneWay: false });
const ledge = (x, y, w, h = 18) => ({ x, y, w, h, oneWay: true });

export const level = {
  name: 'The Sunken Key',
  world: { w: 3600, h: 1220 },
  spawn: { x: 80, y: 700 },

  solids: [
    // bounds
    { ...solid(-40, -400, 40, 1620), hidden: true },
    { ...solid(3600, -400, 40, 1620), hidden: true },

    // surface
    solid(0, 820, 900, 100),
    solid(1050, 820, 750, 100),
    solid(1980, 820, 1620, 100),

    // cavern under the surface, reached through the shaft at x 1800..1980
    solid(1360, 1060, 660, 60),
    solid(1360, 920, 40, 140),
    solid(1980, 920, 40, 140),

    // steps back out of the shaft
    solid(1810, 980, 90, 16),
    solid(1890, 890, 80, 16),

    // a chest-high block to bump into on the way to the door
    solid(3060, 740, 40, 80),
  ],

  platforms: [
    ledge(300, 700, 160),
    ledge(560, 600, 170),
    ledge(300, 480, 160),
    ledge(930, 720, 150),
    ledge(1180, 660, 170),
    ledge(1450, 560, 170),
    ledge(1150, 430, 180),
    ledge(2150, 700, 160),
    ledge(2400, 600, 170),
    ledge(2680, 500, 180),
    ledge(2980, 620, 150),
  ],

  key: { x: 1430, y: 1000, r: 14 },
  door: { x: 3320, y: 710, w: 64, h: 110 },
};

export const allBlocks = () => [...level.solids, ...level.platforms];
