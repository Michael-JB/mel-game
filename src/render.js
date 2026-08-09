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

export function drawGate(ctx, gate, open, t) {
  const lift = open ? gate.h * 0.62 : 0; // bars retract upward once unlocked
  ctx.save();
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;

  // posts stay put
  ctx.beginPath();
  ctx.moveTo(gate.x - 6, gate.y - 8);
  ctx.lineTo(gate.x - 6, gate.y + gate.h);
  ctx.moveTo(gate.x + gate.w + 6, gate.y - 8);
  ctx.lineTo(gate.x + gate.w + 6, gate.y + gate.h);
  ctx.moveTo(gate.x - 12, gate.y - 8);
  ctx.lineTo(gate.x + gate.w + 12, gate.y - 8);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(gate.x - 4, gate.y - 8, gate.w + 8, gate.h + 8);
  ctx.clip();
  ctx.translate(0, -lift);
  ctx.strokeStyle = open ? '#c99700' : INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 2; i++) {
    const x = gate.x + 3 + (i * (gate.w - 6)) / 2;
    ctx.moveTo(x, gate.y);
    ctx.lineTo(x, gate.y + gate.h);
  }
  for (let i = 1; i <= 2; i++) {
    const y = gate.y + (i * gate.h) / 3;
    ctx.moveTo(gate.x, y);
    ctx.lineTo(gate.x + gate.w, y);
  }
  ctx.stroke();
  ctx.restore();

  if (open) {
    ctx.globalAlpha = 0.3 + Math.sin(t * 4) * 0.15;
    ctx.strokeStyle = '#c99700';
    ctx.lineWidth = 4;
    ctx.strokeRect(gate.x - 10, gate.y - 10, gate.w + 20, gate.h + 20);
  } else {
    // padlock
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    const cx = gate.x + gate.w / 2;
    const cy = gate.y + gate.h / 2;
    ctx.strokeRect(cx - 7, cy - 3, 14, 12);
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 4.5, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}
