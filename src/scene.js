// The look: a white-concrete city at sunset. The sun sits low and behind the
// scene, off to the right, so everything is rimmed warm on its right edge, cool
// blue in shadow, and throws long shadows to the left.
//
// All the detail (window grids, skyline shapes, debris) comes from a hash of the
// coordinates rather than Math.random, so it is identical every frame.

export const PAL = {
  skyTop: '#161038',
  skyMid: '#5b2568',
  skyWarm: '#c4425e',
  skyLow: '#ff7f45',
  horizon: '#ffd08a',
  sun: '#fff4d6',

  far: '#3a2a55',
  mid: '#33234b',
  near: '#281a3c',
  lit: 'rgba(255,206,140,0.9)',

  concrete: '#e7e3da',
  concreteLit: '#ffd6a2',
  concreteShade: '#8f97ae',
  concreteDeep: '#59617a',
  accent: '#d94436',
  ink: '#14161c',
  glass: '#2b2a44',
};

// direction a shadow is thrown: long to the left, a little down
const SHADOW = { x: -1.55, y: 0.14 };

const hash = (a, b, c) => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = h ^ (h >>> 13);
  return (Math.imul(h, 1274126177) >>> 0) / 4294967296;
};

/** Screen-space height of the horizon for this camera. */
export function horizonAt(cam, view) {
  return view.h * 0.74 - cam.y * 0.05;
}

// ---------------------------------------------------------------- sky

export function drawSky(ctx, cam, view) {
  const hz = horizonAt(cam, view);
  const g = ctx.createLinearGradient(0, hz - view.h * 1.15, 0, hz + 90);
  g.addColorStop(0, PAL.skyTop);
  g.addColorStop(0.42, PAL.skyMid);
  g.addColorStop(0.68, PAL.skyWarm);
  g.addColorStop(0.88, PAL.skyLow);
  g.addColorStop(1, PAL.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

  // the sun, sitting just above the horizon
  const sx = view.w * 0.74 - cam.x * 0.015;
  const sy = hz - 54;
  const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 320);
  glow.addColorStop(0, 'rgba(255,244,214,0.95)');
  glow.addColorStop(0.16, 'rgba(255,196,120,0.5)');
  glow.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 340, sy - 340, 680, 680);

  ctx.fillStyle = PAL.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 34, 0, Math.PI * 2);
  ctx.fill();

  // haze bands stacked on the horizon
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgba(255,${170 - i * 12},${110 - i * 8},${0.1 - i * 0.015})`;
    ctx.fillRect(0, hz - 120 + i * 26, view.w, 12);
  }
  return { hz, sx, sy };
}

/** One parallax band of skyline. Depth 0 = painted on the sky, 1 = in the level. */
export function drawSkyline(ctx, cam, view, opts) {
  const { depth, seed, colour, spacing, minH, maxH, lift = 0, windows = 0 } = opts;
  const hz = horizonAt(cam, view) + lift;
  const offX = -cam.x * depth;
  const offY = -cam.y * depth * 0.22;
  const first = Math.floor((-offX - spacing) / spacing);
  const count = Math.ceil(view.w / spacing) + 3;

  for (let i = first; i < first + count; i++) {
    const w = spacing * (0.5 + hash(i, seed, 1) * 0.42);
    const h = minH + hash(i, seed, 2) * (maxH - minH);
    const x = i * spacing + offX;
    const y = hz + offY - h;

    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h + 400);

    // a rim of sun on the right-hand edge
    ctx.fillStyle = 'rgba(255,180,120,0.22)';
    ctx.fillRect(x + w - 2.5, y, 2.5, h + 400);

    if (hash(i, seed, 3) > 0.72) {
      const mw = Math.max(3, w * 0.06);
      ctx.fillStyle = colour;
      ctx.fillRect(x + w * 0.45, y - 40 - hash(i, seed, 4) * 60, mw, 60);
    }

    if (!windows) continue;
    const cols = Math.max(1, Math.floor(w / 16));
    const rows = Math.floor(h / 22);
    for (let cx = 0; cx < cols; cx++) {
      for (let ry = 0; ry < rows; ry++) {
        const r = hash(i * 97 + cx, seed + ry, 5);
        if (r > windows) continue;
        ctx.fillStyle = r > windows * 0.45 ? 'rgba(255,208,140,0.5)' : 'rgba(255,170,110,0.28)';
        ctx.fillRect(x + 5 + cx * 16, y + 8 + ry * 22, 7, 10);
      }
    }
  }
}

export function drawCity(ctx, cam, view) {
  drawSkyline(ctx, cam, view, { depth: 0.08, seed: 11, colour: PAL.far, spacing: 190, minH: 120, maxH: 420 });
  drawSkyline(ctx, cam, view, { depth: 0.2, seed: 27, colour: PAL.mid, spacing: 250, minH: 200, maxH: 620, lift: 26, windows: 0.14 });
  drawSkyline(ctx, cam, view, { depth: 0.42, seed: 53, colour: PAL.near, spacing: 330, minH: 300, maxH: 900, lift: 60, windows: 0.2 });
}

// ---------------------------------------------------------------- shadows

/** The silhouette of a rect, stretched along the light direction. */
function castShadow(ctx, x, y, w, h, len) {
  const dx = SHADOW.x * len;
  const dy = SHADOW.y * len;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w + dx, y + dy);
  ctx.lineTo(x + dx, y + h + dy);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
}

/**
 * Squash a drawing onto the surface at `groundY`, as if lit from low and behind
 * on the right. Call, draw, then ctx.restore().
 */
export function beginGroundShadow(ctx, groundY) {
  const K = 1.5;
  const S = 0.12;
  ctx.save();
  ctx.transform(1, 0, K, S, -K * groundY, groundY * (1 - S));
}

/** The nearest surface below a box — the thing its shadow lands on. */
export function groundBelow(blocks, box) {
  let best = null;
  for (const b of blocks) {
    if (b.hidden) continue;
    if (b.x >= box.x + box.w || b.x + b.w <= box.x) continue;
    if (b.y < box.y + box.h - 2) continue;
    if (best === null || b.y < best.y) best = b;
  }
  return best;
}

// ---------------------------------------------------------------- structures
//
// Everything here is drawn at human scale. A storey is STOREY units tall and the
// stickman is 44, so a window is about his size — which is what makes a wall
// read as a building rather than as a big rectangle with speckles on it.

const STOREY = 88;
const WIN_W = 42;
const WIN_H = 48;
const PITCH = 62;

/** Which sort of building this is — stable for a given footprint. */
function buildingKind(b) {
  const r = hash(b.x, b.y, 41);
  if (r > 0.66) return 'glass';
  if (r > 0.33) return 'concrete';
  return 'brick';
}

const SKIN = {
  glass: { wall: '#cfd4d6', band: 'rgba(70,90,110,0.35)', pane: '#33566b', frame: 'rgba(240,246,250,0.5)' },
  concrete: { wall: '#e2ddd2', band: 'rgba(120,116,104,0.22)', pane: '#3d4358', frame: 'rgba(255,255,255,0.35)' },
  brick: { wall: '#bd8a70', band: 'rgba(90,54,40,0.3)', pane: '#37303c', frame: 'rgba(255,225,200,0.3)' },
};
SKIN.brick.wall = '#bd8a70';

export function drawStructure(ctx, b, world, setting) {
  switch (b.kind) {
    case 'chimney': return drawChimney(ctx, b);
    case 'billboard': return drawBillboard(ctx, b);
    case 'housing': return drawHousing(ctx, b);
    case 'street': return drawStreet(ctx, b, world);
    case 'floor': return drawInteriorFloor(ctx, b, world);
    case 'liftshaft': return drawLiftShaft(ctx, b);
    case 'slab': return drawSlab(ctx, b);
    default: return drawBuilding(ctx, b, world, setting);
  }
}

/** Lighting every vertical face shares: cool on the left, sun on the right. */
function shadeFace(ctx, x, y, w, h, world, strength = 1) {
  const shadeW = Math.min(90, w * 0.32);
  const left = ctx.createLinearGradient(x, 0, x + shadeW, 0);
  left.addColorStop(0, `rgba(52,64,104,${0.62 * strength})`);
  left.addColorStop(1, 'rgba(52,64,104,0)');
  ctx.fillStyle = left;
  ctx.fillRect(x, y, shadeW, h);

  const litW = Math.min(130, w * 0.45);
  const right = ctx.createLinearGradient(x + w - litW, 0, x + w, 0);
  right.addColorStop(0, 'rgba(255,190,130,0)');
  right.addColorStop(1, `rgba(255,190,130,${0.55 * strength})`);
  ctx.fillStyle = right;
  ctx.fillRect(x + w - litW, y, litW, h);

  if (!world) return;
  const depth = ctx.createLinearGradient(0, y, 0, world.h + 260);
  depth.addColorStop(0, 'rgba(26,22,52,0)');
  depth.addColorStop(1, 'rgba(26,22,52,0.75)');
  ctx.fillStyle = depth;
  ctx.fillRect(x, y, w, h);
}

function drawBuilding(ctx, b, world, setting) {
  const deep = world.h + 400 - b.y;
  const kind = buildingKind(b);
  const skin = SKIN[kind];
  const parapet = 22;

  ctx.fillStyle = skin.wall;
  ctx.fillRect(b.x, b.y, b.w, deep);

  const top = b.y + parapet;
  const inset = 26;
  const usable = b.w - inset * 2;
  const cols = Math.max(1, Math.floor((usable + 20) / PITCH));
  const spare = usable - (cols * PITCH - 20);
  const x0 = b.x + inset + spare / 2;

  for (let s = 0; ; s++) {
    const sy = top + 24 + s * STOREY;
    if (sy > b.y + deep) break;

    // spandrel: the band of solid wall between one row of glass and the next
    ctx.fillStyle = skin.band;
    ctx.fillRect(b.x, sy + WIN_H, b.w, 7);

    if (kind === 'glass') {
      // ribbon glazing: one long band of glass, split by mullions
      ctx.fillStyle = skin.pane;
      ctx.fillRect(x0 - 8, sy, cols * PITCH - 20 + 16, WIN_H);
      ctx.fillStyle = skin.frame;
      for (let c = 0; c <= cols; c++) ctx.fillRect(x0 - 8 + c * PITCH, sy, 5, WIN_H);
      ctx.fillRect(x0 - 8, sy, cols * PITCH - 4, 3);
    } else {
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * PITCH;
        ctx.fillStyle = skin.pane;
        ctx.fillRect(x, sy, WIN_W, WIN_H);
        ctx.fillStyle = skin.frame;
        ctx.fillRect(x, sy, WIN_W, 3);
        ctx.fillRect(x + WIN_W / 2 - 1.5, sy, 3, WIN_H);
        ctx.fillRect(x, sy + WIN_H / 2 - 1.5, WIN_W, 3);
      }
    }

    // a few rooms with the lights on, and blinds down in others
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * PITCH;
      const k = hash(x, sy, 9);
      if (k > 0.88) {
        ctx.fillStyle = 'rgba(255,206,142,0.5)';
        ctx.fillRect(x, sy, WIN_W, WIN_H);
      } else if (k < 0.16) {
        ctx.fillStyle = 'rgba(228,224,214,0.6)';
        ctx.fillRect(x, sy, WIN_W, WIN_H * 0.55);
      }
      // sun sliding across the glass
      ctx.fillStyle = 'rgba(255,186,120,0.16)';
      ctx.fillRect(x + WIN_W * 0.55, sy, WIN_W * 0.45, WIN_H);
    }
  }

  // structural piers breaking up the elevation
  if (b.w > 420) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let x = b.x + b.w * 0.33; x < b.x + b.w; x += b.w * 0.34) ctx.fillRect(x, b.y, 16, deep);
  }

  shadeFace(ctx, b.x, b.y, b.w, deep, world);

  // parapet: the lip you actually land on
  ctx.fillStyle = kind === 'brick' ? '#c9a087' : '#eceae2';
  ctx.fillRect(b.x, b.y, b.w, parapet);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(b.x, b.y + parapet - 4, b.w, 4);
  ctx.fillStyle = PAL.concreteLit;
  ctx.fillRect(b.x, b.y, b.w, 5);
  ctx.fillStyle = 'rgba(255,226,180,0.9)';
  ctx.fillRect(b.x + b.w - 4, b.y, 4, deep);
  ctx.fillStyle = 'rgba(30,34,60,0.5)';
  ctx.fillRect(b.x, b.y, 3, deep);
}

function drawStreet(ctx, b, world) {
  ctx.fillStyle = '#4a4757';
  ctx.fillRect(b.x, b.y, b.w, b.h + 400);
  ctx.fillStyle = '#5d5a6c';
  ctx.fillRect(b.x, b.y, b.w, 8);
  ctx.fillStyle = 'rgba(255,214,160,0.25)';
  ctx.fillRect(b.x, b.y, b.w, 3);
  // wet patches and drain
  ctx.fillStyle = 'rgba(255,180,120,0.08)';
  for (let i = 0; i < 5; i++) {
    const x = b.x + hash(b.x, i, 5) * b.w;
    ctx.fillRect(x, b.y + 4, 30 + hash(i, b.y, 6) * 70, 5);
  }
  ctx.strokeStyle = 'rgba(20,18,32,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + b.w * 0.4, b.y + 12, 34, 20);
}

/** A brick stack, tapering, with iron bands and a lipped cap. */
function drawChimney(ctx, b) {
  const taper = b.w * 0.16;
  ctx.beginPath();
  ctx.moveTo(b.x + taper * 0.2, b.y);
  ctx.lineTo(b.x + b.w - taper * 0.2, b.y);
  ctx.lineTo(b.x + b.w + taper, b.y + b.h);
  ctx.lineTo(b.x - taper, b.y + b.h);
  ctx.closePath();
  ctx.fillStyle = '#a8705a';
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(60,38,44,0.35)';
  for (let y = b.y + 40; y < b.y + b.h; y += 46) ctx.fillRect(b.x - taper, y, b.w + taper * 2, 3);
  ctx.fillStyle = 'rgba(40,34,60,0.55)';
  ctx.fillRect(b.x - taper, b.y, b.w * 0.34, b.h);
  ctx.fillStyle = 'rgba(255,186,120,0.5)';
  ctx.fillRect(b.x + b.w - b.w * 0.3, b.y, b.w * 0.3 + taper, b.h);
  // iron hoops
  ctx.fillStyle = 'rgba(48,40,56,0.75)';
  for (let y = b.y + 90; y < b.y + b.h; y += 150) ctx.fillRect(b.x - taper, y, b.w + taper * 2, 8);
  ctx.restore();

  // cap
  ctx.fillStyle = '#8d6152';
  ctx.fillRect(b.x - 9, b.y - 14, b.w + 18, 16);
  ctx.fillStyle = '#ffd6a2';
  ctx.fillRect(b.x - 9, b.y - 14, b.w + 18, 4);
  ctx.fillStyle = '#1d1a2c';
  ctx.fillRect(b.x + 4, b.y - 11, b.w - 8, 6);

  // aircraft warning light
  ctx.fillStyle = '#ff5a4a';
  ctx.beginPath();
  ctx.arc(b.x + b.w / 2, b.y - 20, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** A sign on a lattice mast — you duck through the legs underneath it. */
function drawBillboard(ctx, b) {
  const legTop = b.y + b.h;
  const panelH = Math.min(230, b.h * 0.42);

  // lattice mast
  ctx.strokeStyle = '#575a6e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(b.x + 4, b.y + panelH);
  ctx.lineTo(b.x + 4, legTop + 90);
  ctx.moveTo(b.x + b.w - 4, b.y + panelH);
  ctx.lineTo(b.x + b.w - 4, legTop + 90);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#4b4e60';
  ctx.beginPath();
  for (let y = b.y + panelH; y < legTop + 90; y += 46) {
    ctx.moveTo(b.x + 4, y);
    ctx.lineTo(b.x + b.w - 4, y + 23);
    ctx.moveTo(b.x + b.w - 4, y);
    ctx.lineTo(b.x + 4, y + 23);
  }
  ctx.stroke();

  // the sign itself
  ctx.fillStyle = '#2a2740';
  ctx.fillRect(b.x - 46, b.y, b.w + 92, panelH);
  ctx.fillStyle = PAL.accent;
  ctx.fillRect(b.x - 46, b.y, b.w + 92, 10);
  ctx.fillStyle = 'rgba(255,196,130,0.9)';
  ctx.fillRect(b.x - 46, b.y + panelH - 6, b.w + 92, 6);
  ctx.fillStyle = 'rgba(255,236,200,0.75)';
  for (let i = 0; i < 4; i++) ctx.fillRect(b.x - 32, b.y + 34 + i * 34, (b.w + 64) * (0.35 + hash(b.x, i, 7) * 0.5), 12);
  ctx.fillStyle = 'rgba(30,34,60,0.45)';
  ctx.fillRect(b.x - 46, b.y, 26, panelH);

  // walkway across the top of the mast, where the key sits
  ctx.fillStyle = '#6d7186';
  ctx.fillRect(b.x - 12, b.y - 8, b.w + 24, 8);
}

/** Roof access / lift motor room. */
function drawHousing(ctx, b) {
  ctx.fillStyle = '#d8d3c8';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  shadeFace(ctx, b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#b9b3a6';
  ctx.fillRect(b.x + b.w * 0.28, b.y + b.h * 0.3, b.w * 0.34, b.h * 0.7);
  ctx.fillStyle = 'rgba(40,44,70,0.6)';
  ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.34, b.w * 0.3, b.h * 0.66);
  ctx.fillStyle = PAL.concreteLit;
  ctx.fillRect(b.x - 6, b.y, b.w + 12, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(b.x - 6, b.y + 7, b.w + 12, 4);
}

function drawSlab(ctx, b) {
  ctx.fillStyle = '#8a8f9f';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(20,22,34,0.5)';
  ctx.fillRect(b.x, b.y + b.h - 5, b.w, 5);
  ctx.fillStyle = '#ffd6a2';
  ctx.fillRect(b.x, b.y, b.w, 4);
}

function drawInteriorFloor(ctx, b, world) {
  const deep = Math.max(b.h, 40);
  ctx.fillStyle = '#4f4c58';
  ctx.fillRect(b.x, b.y, b.w, deep);
  // slab edge, then the coffered underside
  ctx.fillStyle = '#8d8a94';
  ctx.fillRect(b.x, b.y, b.w, 16);
  ctx.fillStyle = '#ffd6a2';
  ctx.fillRect(b.x, b.y, b.w, 4);
  ctx.fillStyle = 'rgba(20,18,30,0.35)';
  for (let x = b.x + 20; x < b.x + b.w - 10; x += 64) ctx.fillRect(x, b.y + 22, 40, 8);
  const depth = ctx.createLinearGradient(0, b.y, 0, world.h);
  depth.addColorStop(0, 'rgba(20,18,38,0)');
  depth.addColorStop(1, 'rgba(20,18,38,0.6)');
  ctx.fillStyle = depth;
  ctx.fillRect(b.x, b.y, b.w, deep);
}

/** Interior lift shaft: steel frame with the doors standing open at the bottom. */
function drawLiftShaft(ctx, b) {
  ctx.fillStyle = '#3f3d4c';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(b.x + 4, b.y, 4, b.h);
  ctx.fillStyle = 'rgba(255,206,140,0.35)';
  ctx.fillRect(b.x + b.w - 4, b.y, 4, b.h);
  // floor-by-floor door openings
  for (let y = b.y + 60; y < b.y + b.h - 40; y += 260) {
    ctx.fillStyle = '#20202e';
    ctx.fillRect(b.x + 6, y, b.w - 12, 96);
    ctx.fillStyle = 'rgba(255,196,130,0.28)';
    ctx.fillRect(b.x + 6, y, b.w - 12, 4);
    ctx.fillStyle = 'rgba(120,130,160,0.5)';
    ctx.fillRect(b.x + b.w / 2 - 1.5, y, 3, 96);
  }
  ctx.fillStyle = '#6f7488';
  ctx.fillRect(b.x - 4, b.y, b.w + 8, 10);
}

// ---------------------------------------------------------------- rooftops

const PROPS = ['ac', 'vent', 'hut', 'tank', 'dish', 'pipes', 'skylight'];

/** Clutter along the top of every roof: what makes it a place, not a ledge. */
export function drawRooftops(ctx, level) {
  for (const b of level.solids) {
    if (b.hidden || (b.kind || 'building') !== 'building') continue;
    const step = 190;
    for (let x = b.x + 60; x < b.x + b.w - 90; x += step) {
      const r = hash(x, b.y, 61);
      const px = x + r * 60;
      if (blocked(level, px, b.y)) continue;
      const prop = PROPS[Math.floor(hash(px, b.y, 62) * PROPS.length)];
      drawProp(ctx, prop, px, b.y, hash(px, b.y, 63));
    }
    railing(ctx, b);
  }
}

/** Don't stack clutter where a chimney or a sign already stands. */
function blocked(level, x, roofY) {
  return level.solids.some(
    (o) => o.kind && o.kind !== 'building' && o.y + o.h >= roofY - 4 && x > o.x - 70 && x < o.x + o.w + 70
  );
}

function drawProp(ctx, prop, x, y, r) {
  ctx.save();
  const steel = '#8e93a6';
  const dark = '#5a5f74';
  switch (prop) {
    case 'ac': {
      const w = 60 + r * 40;
      const h = 34 + r * 16;
      ctx.fillStyle = steel;
      ctx.fillRect(x, y - h, w, h);
      ctx.fillStyle = dark;
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 6, y - h + 7 + i * ((h - 12) / 5), w - 12, 3);
      ctx.fillStyle = '#ffd6a2';
      ctx.fillRect(x, y - h, w, 4);
      ctx.fillStyle = 'rgba(40,46,74,0.5)';
      ctx.fillRect(x, y - h, 8, h);
      break;
    }
    case 'vent': {
      const h = 40 + r * 26;
      ctx.fillStyle = steel;
      ctx.fillRect(x + 6, y - h, 26, h);
      ctx.beginPath();
      ctx.ellipse(x + 19, y - h, 22, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(x + 19, y - h - 2, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'hut': {
      const w = 74 + r * 26;
      const h = 74 + r * 20;
      ctx.fillStyle = '#ddd8cd';
      ctx.fillRect(x, y - h, w, h);
      ctx.fillStyle = 'rgba(52,64,104,0.45)';
      ctx.fillRect(x, y - h, w * 0.3, h);
      ctx.fillStyle = '#3a3648';
      ctx.fillRect(x + w * 0.32, y - h * 0.72, w * 0.36, h * 0.72);
      ctx.fillStyle = 'rgba(255,206,140,0.5)';
      ctx.fillRect(x + w * 0.32, y - h * 0.72, w * 0.36, 3);
      ctx.fillStyle = PAL.concreteLit;
      ctx.fillRect(x - 5, y - h - 7, w + 10, 8);
      break;
    }
    case 'tank': {
      const w = 66 + r * 24;
      const h = 60 + r * 24;
      const legs = 30;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + 16, y - legs);
      ctx.moveTo(x + w - 8, y);
      ctx.lineTo(x + w - 16, y - legs);
      ctx.stroke();
      ctx.fillStyle = '#7f6a58';
      ctx.fillRect(x, y - legs - h, w, h);
      ctx.fillStyle = 'rgba(255,196,130,0.45)';
      ctx.fillRect(x + w * 0.62, y - legs - h, w * 0.38, h);
      ctx.fillStyle = '#5d4c3f';
      ctx.beginPath();
      ctx.moveTo(x - 6, y - legs - h);
      ctx.lineTo(x + w / 2, y - legs - h - 26);
      ctx.lineTo(x + w + 6, y - legs - h);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'dish': {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 16, y);
      ctx.lineTo(x + 16, y - 40);
      ctx.stroke();
      ctx.fillStyle = '#c9ccd8';
      ctx.beginPath();
      ctx.ellipse(x + 24, y - 52, 26, 20, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(52,64,104,0.4)';
      ctx.beginPath();
      ctx.ellipse(x + 20, y - 52, 20, 15, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'pipes': {
      ctx.strokeStyle = steel;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const px = x + i * 17;
        ctx.moveTo(px, y);
        ctx.lineTo(px, y - 34 - hash(px, y, 8) * 40);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,196,130,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    default: {
      const w = 80 + r * 40;
      ctx.fillStyle = '#4a5570';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y - 22);
      ctx.lineTo(x, y - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,214,160,0.55)';
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 2);
      ctx.lineTo(x + w - 4, y - 20);
      ctx.lineTo(x + w - 4, y - 14);
      ctx.lineTo(x + 4, y + 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Safety rail along the roof edge — drawn low so it never hides the player. */
function railing(ctx, b) {
  ctx.save();
  ctx.strokeStyle = 'rgba(60,66,90,0.8)';
  ctx.lineWidth = 3;
  for (const side of [b.x + 14, b.x + b.w - 14]) {
    ctx.beginPath();
    ctx.moveTo(side, b.y);
    ctx.lineTo(side, b.y - 30);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(b.x + 14, b.y - 28);
  ctx.lineTo(b.x + b.w - 14, b.y - 28);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,206,140,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawStructureShadows(ctx, level) {
  const inside = level.setting === 'interior';
  ctx.save();
  ctx.fillStyle = inside ? 'rgba(16,12,30,0.4)' : 'rgba(28,20,48,0.34)';
  for (const b of level.solids) {
    if (b.hidden) continue;
    castShadow(ctx, b.x, b.y, b.w, Math.min(b.h, 160), inside ? 44 : 150);
  }
  ctx.restore();
}
// ---------------------------------------------------------------- interior

/**
 * The abandoned floor: a back wall with big windows punched through it, the city
 * burning outside, and shafts of sun landing on the concrete.
 */
export function drawInteriorShell(ctx, level, cam, view) {
  const { w, h } = level.world;
  const win = level.windows;
  const holes = [];
  for (let x = win.from; x < w; x += win.spacing) {
    holes.push({ x: x + win.mullion, y: win.top, w: win.spacing - win.mullion * 2, h: win.bottom - win.top });
  }

  // wall with the windows cut out of it
  const wall = new Path2D();
  wall.rect(-400, -500, w + 800, h + 1000);
  for (const g of holes) wall.rect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = '#3b3a46';
  ctx.fill(wall, 'evenodd');

  // grime and floor lines on the wall
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 3;
  for (let y = win.top - 220; y < h; y += 220) {
    ctx.beginPath();
    ctx.moveTo(-400, y);
    ctx.lineTo(w + 400, y);
    ctx.stroke();
  }

  // window frames, and the light they throw across the floor
  for (const g of holes) {
    ctx.strokeStyle = 'rgba(255,214,160,0.5)';
    ctx.lineWidth = 5;
    ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = 'rgba(20,18,30,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x + g.w / 2, g.y);
    ctx.lineTo(g.x + g.w / 2, g.y + g.h);
    ctx.stroke();

    const beam = ctx.createLinearGradient(g.x, g.y, g.x - 520, g.y + 900);
    beam.addColorStop(0, 'rgba(255,198,130,0.20)');
    beam.addColorStop(1, 'rgba(255,170,110,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + g.w, g.y);
    ctx.lineTo(g.x + g.w - 470, g.y + 880);
    ctx.lineTo(g.x - 540, g.y + 880);
    ctx.closePath();
    ctx.fill();
  }
}

/** What is left of the office: furniture, partitions, cable, a dead ceiling. */
export function drawFurniture(ctx, level) {
  for (const b of level.solids) {
    if (b.kind !== 'floor' || b.w < 200) continue;
    const y = b.y;

    // suspended ceiling over this floor, half of it on the deck already
    const ceil = y - 320;
    if (ceil > 60) {
      ctx.fillStyle = '#2b2936';
      ctx.fillRect(b.x, ceil - 26, b.w, 26);
      ctx.fillStyle = 'rgba(255,206,150,0.18)';
      ctx.fillRect(b.x, ceil - 26, b.w, 3);
      for (let x = b.x; x < b.x + b.w; x += 62) {
        const gone = hash(x, ceil, 71) > 0.68;
        ctx.fillStyle = gone ? '#15141d' : '#514f5e';
        ctx.fillRect(x + 3, ceil - 24, 56, 22);
        if (gone) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x + 3, ceil - 24, 56, 2);
      }
      // strip lights, one still flickering on
      for (let x = b.x + 90; x < b.x + b.w - 60; x += 260) {
        const alive = hash(x, ceil, 73) > 0.55;
        ctx.fillStyle = alive ? 'rgba(255,228,180,0.75)' : '#3c3a48';
        ctx.fillRect(x, ceil - 6, 96, 7);
        if (!alive) continue;
        const g = ctx.createRadialGradient(x + 48, ceil, 4, x + 48, ceil, 150);
        g.addColorStop(0, 'rgba(255,220,160,0.16)');
        g.addColorStop(1, 'rgba(255,200,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 100, ceil - 20, 296, 220);
      }
      ctx.strokeStyle = 'rgba(24,22,32,0.9)';
      ctx.lineWidth = 3;
      for (let x = b.x + 40; x < b.x + b.w; x += 170) {
        if (hash(x, ceil, 72) < 0.45) continue;
        ctx.beginPath(); // cable spilling out of a gap in the grid
        ctx.moveTo(x, ceil - 4);
        ctx.quadraticCurveTo(x + 16, ceil + 76, x - 8, ceil + 140);
        ctx.stroke();
      }
    }

    const step = 132;
    for (let x = b.x + 30; x < b.x + b.w - 96; x += step) {
      const r = hash(x, y, 21);
      const px = x + r * 40;
      const item = Math.floor(hash(px, y, 22) * 5);

      if (item === 0) desk(ctx, px, y, r, false);
      else if (item === 1) desk(ctx, px, y, r, true);
      else if (item === 2) cabinet(ctx, px, y, r);
      else if (item === 3) partition(ctx, px, y, r);
      else chair(ctx, px, y, r);

      // paper, always
      ctx.fillStyle = 'rgba(226,224,214,0.5)';
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(px + 90 + hash(px, k, 23) * 60, y - 3, 10, 3);
      }
    }
  }
}

function desk(ctx, x, y, r, wrecked) {
  const w = 92 + r * 26;
  if (wrecked) {
    // tipped on its side: top vertical, legs sticking out
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(x, y - 62, 9, 62);
    ctx.fillStyle = '#7d6a56';
    ctx.fillRect(x, y - 62, w * 0.55, 8);
    ctx.strokeStyle = '#4b4e60';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 9, y - 54);
    ctx.lineTo(x + 44, y - 46);
    ctx.moveTo(x + 9, y - 14);
    ctx.lineTo(x + 44, y - 22);
    ctx.stroke();
    return;
  }
  const h = 44;
  ctx.fillStyle = '#4b4e60';
  ctx.fillRect(x + 6, y - h, 6, h);
  ctx.fillRect(x + w - 12, y - h, 6, h);
  ctx.fillStyle = '#7d6a56';
  ctx.fillRect(x, y - h, w, 9);
  ctx.fillStyle = 'rgba(255,206,150,0.55)';
  ctx.fillRect(x, y - h, w, 3);
  // monitor
  if (r > 0.4) {
    ctx.fillStyle = '#33303f';
    ctx.fillRect(x + w * 0.42, y - h - 34, 38, 28);
    ctx.fillStyle = 'rgba(120,150,190,0.35)';
    ctx.fillRect(x + w * 0.42 + 3, y - h - 31, 32, 22);
    ctx.fillStyle = '#33303f';
    ctx.fillRect(x + w * 0.42 + 16, y - h - 8, 7, 8);
  }
}

function cabinet(ctx, x, y, r) {
  const h = 74 + r * 30;
  ctx.fillStyle = '#5d6273';
  ctx.fillRect(x, y - h, 54, h);
  ctx.fillStyle = 'rgba(30,32,46,0.55)';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 5, y - h + 9 + i * (h / 3), 44, h / 3 - 12);
  ctx.fillStyle = 'rgba(255,206,150,0.5)';
  ctx.fillRect(x, y - h, 54, 3);
  if (r > 0.6) {
    // top drawer hanging open
    ctx.fillStyle = '#6f7488';
    ctx.fillRect(x - 22, y - h + 12, 26, 18);
  }
}

function partition(ctx, x, y, r) {
  const h = 96 + r * 40;
  const w = 106;
  const lean = r > 0.5 ? 0 : 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, lean, 1, 0, 0);
  ctx.fillStyle = '#57606e';
  ctx.fillRect(0, -h, w, h);
  ctx.fillStyle = 'rgba(255,206,150,0.35)';
  ctx.fillRect(0, -h, w, 4);
  ctx.fillStyle = 'rgba(24,26,40,0.35)';
  ctx.fillRect(0, -h, 16, h);
  ctx.restore();
}

function chair(ctx, x, y, r) {
  const tipped = r > 0.55;
  ctx.fillStyle = '#3f4356';
  if (tipped) {
    ctx.fillRect(x, y - 14, 46, 9);
    ctx.fillRect(x + 38, y - 46, 9, 34);
    ctx.strokeStyle = '#3f4356';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 5);
    ctx.lineTo(x - 12, y);
    ctx.stroke();
    return;
  }
  ctx.fillRect(x + 6, y - 44, 34, 8);
  ctx.fillRect(x + 6, y - 78, 8, 38);
  ctx.strokeStyle = '#3f4356';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 22, y - 36);
  ctx.lineTo(x + 22, y - 12);
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 22, y - 12);
  ctx.lineTo(x + 40, y);
  ctx.stroke();
}

/** Sun through the windows, landing on the concrete. Drawn over the floors. */
export function drawInteriorLight(ctx, level) {
  const win = level.windows;
  ctx.save();
  for (const b of level.solids) {
    if (b.kind !== 'floor') continue;
    for (let wx = win.from; wx < level.world.w; wx += win.spacing) {
      const holeX = wx + win.mullion;
      const holeW = win.spacing - win.mullion * 2;
      const throwX = holeX - (b.y - win.bottom) * 0.55;
      if (throwX + holeW < b.x || throwX > b.x + b.w) continue;
      const g = ctx.createLinearGradient(0, b.y - 6, 0, b.y + 46);
      g.addColorStop(0, 'rgba(255,206,140,0.42)');
      g.addColorStop(1, 'rgba(255,180,110,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x, b.y - 6, b.w, 52);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(throwX, b.y - 6);
      ctx.lineTo(throwX + holeW, b.y - 6);
      ctx.lineTo(throwX + holeW - 30, b.y + 46);
      ctx.lineTo(throwX - 30, b.y + 46);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the window

/**
 * The broken window between levels 2 and 3 — a punched-out pane in a facade,
 * drawn from outside on level 2 and from inside on level 3.
 */
export function drawBrokenWindow(ctx, level, spec, open, t) {
  const edge = spec.side > 0 ? level.world.w : 0;
  const depth = 150;
  const x0 = spec.side > 0 ? edge - depth : edge;
  const holeY = spec.y - spec.h;

  // the facade the window sits in
  ctx.fillStyle = spec.inside ? '#3b3a46' : PAL.concrete;
  ctx.fillRect(x0, -500, depth, level.world.h + 1000);
  if (!spec.inside) {
    const shade = ctx.createLinearGradient(x0, 0, x0 + depth, 0);
    shade.addColorStop(0, 'rgba(80,92,130,0.5)');
    shade.addColorStop(1, 'rgba(255,196,140,0.4)');
    ctx.fillStyle = shade;
    ctx.fillRect(x0, -500, depth, level.world.h + 1000);
  }

  // the opening
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 4, holeY, depth + 8, spec.h);
  ctx.clip();
  const inner = ctx.createLinearGradient(x0, holeY, x0 + depth, holeY + spec.h);
  inner.addColorStop(0, open ? 'rgba(255,196,120,0.85)' : 'rgba(18,16,28,0.92)');
  inner.addColorStop(1, open ? 'rgba(255,140,80,0.6)' : 'rgba(28,26,42,0.92)');
  ctx.fillStyle = inner;
  ctx.fillRect(x0 - 4, holeY, depth + 8, spec.h);
  ctx.restore();

  // frame
  ctx.strokeStyle = spec.inside ? 'rgba(255,214,160,0.55)' : 'rgba(60,66,90,0.8)';
  ctx.lineWidth = 6;
  ctx.strokeRect(x0 - 3, holeY, depth + 6, spec.h);

  // shards clinging to the frame
  ctx.fillStyle = open ? 'rgba(255,226,180,0.75)' : 'rgba(170,196,215,0.6)';
  for (let i = 0; i < 14; i++) {
    const along = hash(i, spec.y, 31);
    const top = i % 2 === 0;
    const px = x0 + along * depth;
    const py = top ? holeY : holeY + spec.h;
    const dep = 12 + hash(i, spec.y, 32) * 34;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 16, py);
    ctx.lineTo(px + 8, py + (top ? dep : -dep));
    ctx.closePath();
    ctx.fill();
  }

  if (open) {
    ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.12;
    ctx.strokeStyle = '#ffd08a';
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 - 8, holeY - 5, depth + 16, spec.h + 10);
    ctx.globalAlpha = 1;
  }
}
