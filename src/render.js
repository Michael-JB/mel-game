import { cycleOn, cycleLeft } from './levels.js';

const INK = '#1a1a1a';
const PAPER = '#f2f0eb';

export function drawBackground(ctx, cam, view, world) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, view.w, view.h);

  // two parallax bands of hills, drawn in world space via the camera transform
  ctx.save();
  ctx.translate(-cam.x * 0.3, -cam.y * 0.15);
  hills(ctx, world.w, world.h - 200, 220, 520, 'rgba(26,26,26,0.07)');
  ctx.restore();

  ctx.save();
  ctx.translate(-cam.x * 0.55, -cam.y * 0.3);
  hills(ctx, world.w, world.h - 160, 150, 380, 'rgba(26,26,26,0.11)');
  ctx.restore();
}

function hills(ctx, worldW, baseY, height, spacing, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-500, baseY);
  for (let x = -500; x < worldW + 1000; x += spacing) {
    ctx.quadraticCurveTo(x + spacing / 2, baseY - height, x + spacing, baseY);
  }
  ctx.lineTo(worldW + 1000, baseY + 600);
  ctx.lineTo(-500, baseY + 600);
  ctx.closePath();
  ctx.fill();
}

export function drawLevel(ctx, level, t) {
  for (const b of level.solids) {
    if (b.hidden) continue;
    ctx.fillStyle = INK;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x, b.y, b.w, 4);
  }

  for (const p of level.platforms) {
    if (!p.cycle) {
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
      continue;
    }

    const on = cycleOn(p.cycle, t);
    const left = cycleLeft(p.cycle, t);
    ctx.save();
    if (on) {
      // solid, but flashes for the last stretch before it drops away
      const warn = left < 0.9 && Math.floor(left * 8) % 2 === 0;
      ctx.globalAlpha = warn ? 0.35 : 1;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
    } else {
      // ghost outline: it is coming back, and you can see when
      ctx.globalAlpha = left < 0.7 ? 0.5 : 0.22;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = INK;
      ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    }
    ctx.restore();
  }
  ctx.setLineDash([]);
}

export function drawKey(ctx, key, t) {
  const bob = Math.sin(t * 2.4) * 4;
  ctx.save();
  ctx.translate(key.x, key.y + bob);
  ctx.strokeStyle = '#c99700';
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
 * The whole map edge is the doorway: side 1 = the right edge (on to the next
 * level), side -1 = the left edge (back to the previous one).
 */
export function drawPortal(ctx, level, side, open, t) {
  const band = 30;
  const x0 = side > 0 ? level.world.w - band : 0;
  const h = level.world.h;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, -400, band, h + 800);
  ctx.clip();

  ctx.fillStyle = open ? 'rgba(201,151,0,0.13)' : 'rgba(26,26,26,0.07)';
  ctx.fillRect(x0, -400, band, h + 800);

  // stripes drift toward the edge when the way is open, and sit still when not
  const drift = open ? (t * 60) % 34 : 0;
  ctx.strokeStyle = open ? 'rgba(201,151,0,0.75)' : 'rgba(26,26,26,0.28)';
  ctx.lineWidth = open ? 4 : 2;
  ctx.beginPath();
  for (let y = -420; y < h + 800; y += 34) {
    const yy = y + drift * side;
    ctx.moveTo(x0 - 6, yy);
    ctx.lineTo(x0 + band + 6, yy + 16 * side);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = open ? '#c99700' : 'rgba(26,26,26,0.45)';
  ctx.lineWidth = open ? 5 : 3;
  ctx.setLineDash(open ? [] : [10, 8]);
  const edge = side > 0 ? level.world.w - 2 : 2;
  ctx.beginPath();
  ctx.moveTo(edge, -400);
  ctx.lineTo(edge, h + 400);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
