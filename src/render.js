import { cycleOn, cycleLeft, moverAt } from './levels.js';
import {
  PAL,
  drawSky,
  drawCity,
  drawStructure,
  drawStructureShadows,
  drawInteriorShell,
  drawDebris,
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

export function drawLevel(ctx, level, t) {
  drawStructureShadows(ctx, level);

  for (const b of level.solids) {
    if (b.hidden) continue;
    drawStructure(ctx, b, level.world, level.setting);
  }
  if (level.setting === 'interior') drawDebris(ctx, level);

  for (const p of level.platforms) {
    if (p.move) {
      drawTrack(ctx, p);
      deck(ctx, moverAt(p, t), 'mover');
      continue;
    }
    if (!p.cycle) {
      deck(ctx, p, 'fixed');
      continue;
    }

    const on = cycleOn(p.cycle, t);
    const left = cycleLeft(p.cycle, t);
    ctx.save();
    if (on) {
      // solid, but flashes for the last stretch before it drops away
      const warn = left < 0.9 && Math.floor(left * 8) % 2 === 0;
      ctx.globalAlpha = warn ? 0.4 : 1;
      deck(ctx, p, 'blink');
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

/** A walkway: steel deck, warm top edge, dark underside. */
function deck(ctx, p, kind) {
  ctx.save();
  ctx.fillStyle = 'rgba(28,20,48,0.3)';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + p.h);
  ctx.lineTo(p.x + p.w, p.y + p.h);
  ctx.lineTo(p.x + p.w - 90, p.y + p.h + 14);
  ctx.lineTo(p.x - 90, p.y + p.h + 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = kind === 'mover' ? '#6d7186' : '#8a8f9f';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = 'rgba(20,22,34,0.55)';
  ctx.fillRect(p.x, p.y + p.h - Math.min(6, p.h * 0.4), p.w, Math.min(6, p.h * 0.4));

  ctx.fillStyle = kind === 'blink' ? PAL.accent : '#ffd6a2';
  ctx.fillRect(p.x, p.y, p.w, 4);

  // grating
  ctx.strokeStyle = 'rgba(20,22,34,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = p.x + 10; x < p.x + p.w - 4; x += 18) {
    ctx.moveTo(x, p.y + 5);
    ctx.lineTo(x, p.y + p.h - 2);
  }
  ctx.stroke();
  ctx.restore();
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
export function drawGrade(ctx, view) {
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
