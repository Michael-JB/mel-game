import { cycleOn, cycleLeft, moverAt } from './levels.js';
import {
  PAL,
  drawSky,
  drawCity,
  drawStructure,
  drawStructureShadows,
  drawRooftops,
  drawInteriorShell,
  drawFurniture,
  drawInteriorLight,
  drawForeground,
  drawBrokenWindow,
} from './scene.js';

export function drawBackground(ctx, cam, view, level) {
  drawSky(ctx, cam, view);
  drawCity(ctx, cam, view);
  if (level.setting === 'interior') return;

  // dust and warm air sitting between the city and the level
  const hazeTop = view.h * 0.3;
  const haze = ctx.createLinearGradient(0, hazeTop, 0, view.h);
  haze.addColorStop(0, 'rgba(255,160,110,0)');
  haze.addColorStop(1, 'rgba(255,150,100,0.22)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hazeTop, view.w, view.h - hazeTop);
}

/** Called inside the camera transform, before the level itself. */
export function drawSceneShell(ctx, level, cam, view) {
  if (level.setting === 'interior') drawInteriorShell(ctx, level, cam, view);
}

const seed = (p) => Math.abs(Math.round(p.x * 7 + p.y * 13));

export function drawLevel(ctx, level, t) {
  drawStructureShadows(ctx, level);

  for (const b of level.solids) {
    if (b.hidden) continue;
    drawStructure(ctx, b, level.world, level.setting);
  }
  if (level.setting === 'interior') {
    drawInteriorLight(ctx, level);
    drawFurniture(ctx, level);
  } else {
    drawRooftops(ctx, level);
  }

  for (const p of level.platforms) {
    if (p.move) {
      drawTrack(ctx, p);
      deck(ctx, moverAt(p, t), 'mover', seed(p));
      continue;
    }
    if (!p.cycle) {
      deck(ctx, p, 'fixed', seed(p));
      continue;
    }

    const on = cycleOn(p.cycle, t);
    const left = cycleLeft(p.cycle, t);
    ctx.save();
    if (on) {
      // solid, but flashes for the last stretch before it drops away
      const warn = left < 0.9 && Math.floor(left * 8) % 2 === 0;
      ctx.globalAlpha = warn ? 0.4 : 1;
      deck(ctx, p, 'blink', seed(p));
    } else {
      // ghost outline: it is coming back, and you can see when
      ctx.globalAlpha = left < 0.7 ? 0.7 : 0.3;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = 'rgba(255,196,130,0.9)';
      ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

/** A walkway: hung on cables, braced underneath, and never bare. */
function deck(ctx, p, kind, seed) {
  ctx.save();

  // cables up out of frame, so nothing floats
  ctx.strokeStyle = 'rgba(24,22,38,0.8)';
  ctx.lineWidth = 2.5;
  for (const cx of [p.x + 12, p.x + p.w - 12]) {
    ctx.beginPath();
    ctx.moveTo(cx, p.y + 2);
    ctx.quadraticCurveTo(cx - 8, p.y - 190, cx - 22, p.y - 420);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,206,150,0.35)';
  ctx.lineWidth = 1;
  for (const cx of [p.x + 12, p.x + p.w - 12]) {
    ctx.beginPath();
    ctx.moveTo(cx, p.y + 2);
    ctx.quadraticCurveTo(cx - 8, p.y - 190, cx - 22, p.y - 420);
    ctx.stroke();
  }

  // underside bracing
  ctx.strokeStyle = '#464b60';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x + 6, p.y + p.h);
  ctx.lineTo(p.x + p.w * 0.35, p.y + p.h + 16);
  ctx.lineTo(p.x + p.w - 6, p.y + p.h);
  ctx.moveTo(p.x + p.w * 0.35, p.y + p.h + 16);
  ctx.lineTo(p.x + p.w * 0.7, p.y + p.h + 16);
  ctx.stroke();

  ctx.fillStyle = kind === 'mover' ? '#6d7186' : '#8a8f9f';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = 'rgba(20,22,34,0.55)';
  ctx.fillRect(p.x, p.y + p.h - Math.min(6, p.h * 0.4), p.w, Math.min(6, p.h * 0.4));
  ctx.fillStyle = kind === 'blink' ? PAL.accent : '#ffd6a2';
  ctx.fillRect(p.x, p.y, p.w, 4);

  ctx.strokeStyle = 'rgba(20,22,34,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = p.x + 10; x < p.x + p.w - 4; x += 18) {
    ctx.moveTo(x, p.y + 5);
    ctx.lineTo(x, p.y + p.h - 2);
  }
  ctx.stroke();

  deckClutter(ctx, p, seed);
  ctx.restore();
}

/** Everything left lying on a walkway — a different set on each one. */
function deckClutter(ctx, p, seed) {
  const pick = seed % 5;
  const x = p.x + 12 + (seed % 3) * 14;
  const y = p.y;
  if (pick === 0) {
    // toolbox and a coil of cable
    ctx.fillStyle = '#b5502f';
    ctx.fillRect(x, y - 15, 30, 15);
    ctx.fillStyle = '#7d371f';
    ctx.fillRect(x, y - 15, 30, 4);
    ctx.strokeStyle = '#2f3346';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + 52, y - 8, 8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (pick === 1) {
    // two cones
    for (const cx of [x, x + 34]) {
      ctx.fillStyle = '#e0642f';
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + 16, y);
      ctx.lineTo(cx + 8, y - 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(250,240,225,0.85)';
      ctx.fillRect(cx + 3, y - 15, 10, 4);
    }
  } else if (pick === 2) {
    // a warning lamp on a post
    ctx.strokeStyle = '#3b4055';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + 8, y - 26);
    ctx.stroke();
    ctx.fillStyle = '#ffb03a';
    ctx.beginPath();
    ctx.arc(x + 8, y - 30, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,176,58,0.25)';
    ctx.beginPath();
    ctx.arc(x + 8, y - 30, 15, 0, Math.PI * 2);
    ctx.fill();
  } else if (pick === 3) {
    // stacked crates
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(x, y - 22, 26, 22);
    ctx.fillRect(x + 26, y - 15, 20, 15);
    ctx.fillStyle = 'rgba(255,206,150,0.5)';
    ctx.fillRect(x, y - 22, 26, 3);
    ctx.fillRect(x + 26, y - 15, 20, 3);
    ctx.fillStyle = 'rgba(30,26,44,0.4)';
    ctx.fillRect(x + 11, y - 22, 4, 22);
  } else {
    // a scaffold rail along the back of the deck
    ctx.strokeStyle = '#5c6178';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + 8, y);
    ctx.lineTo(p.x + 8, y - 28);
    ctx.moveTo(p.x + p.w - 8, y);
    ctx.lineTo(p.x + p.w - 8, y - 28);
    ctx.moveTo(p.x + 8, y - 26);
    ctx.lineTo(p.x + p.w - 8, y - 26);
    ctx.moveTo(p.x + 8, y - 13);
    ctx.lineTo(p.x + p.w - 8, y - 13);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,206,150,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** The rail a moving platform runs along, so you can read where it is going. */
function drawTrack(ctx, p) {
  const { dx, dy } = p.move;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,200,140,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 8]);
  ctx.beginPath();
  ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2);
  ctx.lineTo(p.x + dx + p.w / 2, p.y + dy + p.h / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [ex, ey] of [[p.x, p.y], [p.x + dx, p.y + dy]]) {
    ctx.beginPath();
    ctx.arc(ex + p.w / 2, ey + p.h / 2, 3.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawKey(ctx, key, t) {
  const bob = Math.sin(t * 2.4) * 4;
  ctx.save();
  ctx.translate(key.x, key.y + bob);

  const glow = ctx.createRadialGradient(0, 2, 2, 0, 2, 46);
  glow.addColorStop(0, 'rgba(255,220,150,0.55)');
  glow.addColorStop(1, 'rgba(255,180,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-46, -44, 92, 92);

  ctx.strokeStyle = '#8a5a12';
  ctx.fillStyle = '#ffd23f';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(0, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 13);
  ctx.moveTo(0, 8);
  ctx.lineTo(6, 8);
  ctx.moveTo(0, 13);
  ctx.lineTo(5, 13);
  ctx.stroke();
  ctx.restore();
}

/**
 * The map edge you leave through: side 1 = onward, -1 = back. Between levels 2
 * and 3 it is a broken window rather than a band of light.
 */
export function drawPortal(ctx, level, side, open, t) {
  const spec = side > 0 ? level.exit : level.entry;
  if (spec && spec.style === 'window') {
    drawBrokenWindow(ctx, level, { ...spec, side }, open, t);
    return;
  }

  const band = 34;
  const x0 = side > 0 ? level.world.w - band : 0;
  const h = level.world.h;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, -500, band, h + 1000);
  ctx.clip();

  const wash = ctx.createLinearGradient(x0, 0, x0 + band, 0);
  const a = open ? '255,196,120' : '90,100,130';
  wash.addColorStop(side > 0 ? 0 : 1, `rgba(${a},0)`);
  wash.addColorStop(side > 0 ? 1 : 0, `rgba(${a},${open ? 0.55 : 0.3})`);
  ctx.fillStyle = wash;
  ctx.fillRect(x0, -500, band, h + 1000);

  const drift = open ? (t * 70) % 40 : 0;
  ctx.strokeStyle = open ? 'rgba(255,226,170,0.8)' : 'rgba(150,165,200,0.35)';
  ctx.lineWidth = open ? 4 : 2;
  ctx.beginPath();
  for (let y = -520; y < h + 900; y += 40) {
    const yy = y + drift * side;
    ctx.moveTo(x0 - 8, yy);
    ctx.lineTo(x0 + band + 8, yy + 18 * side);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = open ? '#ffd08a' : 'rgba(150,165,200,0.5)';
  ctx.lineWidth = open ? 5 : 3;
  ctx.setLineDash(open ? [] : [12, 9]);
  const edge = side > 0 ? level.world.w - 2 : 2;
  ctx.beginPath();
  ctx.moveTo(edge, -500);
  ctx.lineTo(edge, h + 500);
  ctx.stroke();
  ctx.restore();
}

/** Warm light leaking in from the sun, over the top of everything. */
export function drawGrade(ctx, cam, view, level) {
  if (level.setting !== 'interior') drawForeground(ctx, cam, view);

  const g = ctx.createLinearGradient(view.w, 0, view.w * 0.35, view.h);
  g.addColorStop(0, 'rgba(255,170,90,0.16)');
  g.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

  const v = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.42, view.w / 2, view.h / 2, view.h * 1.1);
  v.addColorStop(0, 'rgba(10,8,24,0)');
  v.addColorStop(1, 'rgba(10,8,24,0.4)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, view.w, view.h);
}
