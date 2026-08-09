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

/** A block of the level, drawn as part of the city. */
export function drawStructure(ctx, b, world, setting) {
  const style = b.style || 'slab';
  const deep = style === 'roof' ? world.h + 400 - b.y : b.h;
  const interior = setting === 'interior';
  const face = interior ? '#c9c6bd' : PAL.concrete;

  ctx.fillStyle = face;
  ctx.fillRect(b.x, b.y, b.w, deep);

  windowGrid(ctx, b, deep, style, interior);

  // cool shade hugging the left flank, sun catching the right
  const shadeW = Math.min(80, b.w * 0.3);
  const left = ctx.createLinearGradient(b.x, 0, b.x + shadeW, 0);
  left.addColorStop(0, 'rgba(58,70,110,0.6)');
  left.addColorStop(1, 'rgba(58,70,110,0)');
  ctx.fillStyle = left;
  ctx.fillRect(b.x, b.y, shadeW, deep);

  const litW = Math.min(110, b.w * 0.4);
  const right = ctx.createLinearGradient(b.x + b.w - litW, 0, b.x + b.w, 0);
  right.addColorStop(0, 'rgba(255,190,130,0)');
  right.addColorStop(1, 'rgba(255,190,130,0.5)');
  ctx.fillStyle = right;
  ctx.fillRect(b.x + b.w - litW, b.y, litW, deep);

  // the deeper you go the less light reaches — streets and wells sit in shade
  const depthShade = ctx.createLinearGradient(0, b.y, 0, world.h + 200);
  depthShade.addColorStop(0, 'rgba(26,22,52,0)');
  depthShade.addColorStop(1, `rgba(26,22,52,${interior ? 0.35 : 0.72})`);
  ctx.fillStyle = depthShade;
  ctx.fillRect(b.x, b.y, b.w, deep);

  // sunlit cap and rim
  ctx.fillStyle = PAL.concreteLit;
  ctx.fillRect(b.x, b.y, b.w, 5);
  ctx.fillStyle = 'rgba(255,222,175,0.9)';
  ctx.fillRect(b.x + b.w - 3, b.y, 3, deep);
  ctx.fillStyle = 'rgba(30,34,60,0.55)';
  ctx.fillRect(b.x, b.y, 2.5, deep);

  if (style === 'roof' && !interior) {
    // a little rooftop clutter to break the silhouette
    const n = Math.floor(b.w / 190);
    for (let i = 0; i < n; i++) {
      const r = hash(b.x + i * 61, b.y, 7);
      const bw = 16 + r * 30;
      const bh = 12 + hash(b.x + i, b.y, 8) * 26;
      const bx = b.x + 30 + ((b.w - 80) * (i + r)) / Math.max(1, n);
      ctx.fillStyle = PAL.concreteShade;
      ctx.fillRect(bx, b.y - bh, bw, bh);
      ctx.fillStyle = PAL.concreteLit;
      ctx.fillRect(bx, b.y - bh, bw, 3);
    }
  }
}

function windowGrid(ctx, b, deep, style, interior) {
  if (b.w < 40 || deep < 40) return;

  // storey lines first — mostly what you read at a distance
  ctx.fillStyle = 'rgba(120,130,160,0.16)';
  for (let y = b.y + 34; y < b.y + deep; y += 34) ctx.fillRect(b.x, y, b.w, 1.5);

  if (b.w < 60) return;
  const stepX = style === 'tower' ? 24 : 36;
  const cols = Math.floor((b.w - 14) / stepX);
  const rows = Math.floor((deep - 22) / 34);
  const ww = Math.min(10, stepX - 12);

  for (let r = 0; r < rows; r++) {
    // leave whole storeys blank: big clean surfaces, detail used sparingly
    if (hash(b.x, r, 12) < 0.45) continue;
    for (let c = 0; c < cols; c++) {
      const x = b.x + 9 + c * stepX;
      const y = b.y + 22 + r * 34;
      const k = hash(x, y, 9);
      if (k < 0.22) continue;
      ctx.fillStyle = interior ? 'rgba(52,58,80,0.16)' : 'rgba(60,64,98,0.22)';
      ctx.fillRect(x, y, ww, 12);
      if (k > 0.94) {
        ctx.fillStyle = 'rgba(255,208,142,0.38)';
        ctx.fillRect(x, y, ww, 12);
      }
    }
  }

  // a single accent stripe, the way the city signs its buildings
  if (b.w > 260 && hash(b.x, b.y, 15) > 0.45) {
    const sx = b.x + b.w * (0.2 + hash(b.x, b.y, 16) * 0.55);
    ctx.fillStyle = 'rgba(217,68,54,0.85)';
    ctx.fillRect(sx, b.y + 8, 9, deep);
  }
}

export function drawStructureShadows(ctx, level) {
  ctx.save();
  ctx.fillStyle = 'rgba(28,20,48,0.34)';
  for (const b of level.solids) {
    if (b.hidden) continue;
    castShadow(ctx, b.x, b.y, b.w, Math.min(b.h, 160), 150);
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

/** Overturned desks and scattered paper, purely decorative. */
export function drawDebris(ctx, level) {
  for (const b of level.solids) {
    if (b.style !== 'floor' || b.w < 200) continue;
    const n = Math.floor(b.w / 150);
    for (let i = 0; i < n; i++) {
      const r = hash(b.x + i * 37, b.y, 21);
      const x = b.x + 40 + ((b.w - 90) * (i + r * 0.7)) / n;
      if (r > 0.55) {
        ctx.fillStyle = 'rgba(60,64,84,0.9)';
        ctx.fillRect(x, b.y - 22, 54, 6);
        ctx.fillRect(x + 4, b.y - 22, 5, 22);
        ctx.fillRect(x + 45, b.y - 22, 5, 22);
        ctx.fillStyle = 'rgba(255,206,150,0.5)';
        ctx.fillRect(x, b.y - 22, 54, 2);
      } else {
        ctx.fillStyle = 'rgba(230,230,235,0.55)';
        for (let k = 0; k < 4; k++) {
          const px = x + hash(x, k, 3) * 60;
          ctx.fillRect(px, b.y - 3, 9, 3);
        }
      }
    }
  }
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
