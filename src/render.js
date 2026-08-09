const INK = '#1a1a1a';
const PAPER = '#f2f0eb';

export function drawBackground(ctx, cam, view, world) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, view.w, view.h);

  // two parallax bands of hills, drawn in world space via the camera transform
  ctx.save();
  ctx.translate(-cam.x * 0.3, -cam.y * 0.15);
  hills(ctx, world.w, 880, 220, 520, 'rgba(26,26,26,0.07)');
  ctx.restore();

  ctx.save();
  ctx.translate(-cam.x * 0.55, -cam.y * 0.3);
  hills(ctx, world.w, 900, 150, 380, 'rgba(26,26,26,0.11)');
  ctx.restore();
}

function hills(ctx, worldW, baseY, height, spacing, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-500, baseY);
  for (let x = -500; x < worldW + 1000; x += spacing) {
    ctx.quadraticCurveTo(x + spacing / 2, baseY - height, x + spacing, baseY);
  }
  ctx.lineTo(worldW + 1000, baseY + 400);
  ctx.lineTo(-500, baseY + 400);
  ctx.closePath();
  ctx.fill();
}

export function drawLevel(ctx, level) {
  for (const b of level.solids) {
    if (b.hidden) continue;
    ctx.fillStyle = INK;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x, b.y, b.w, 4);
  }

  ctx.lineWidth = 3;
  for (const p of level.platforms) {
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
  }
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

export function drawDoor(ctx, door, unlocked, t) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.fillStyle = unlocked ? '#ffd23f' : PAPER;
  ctx.strokeStyle = INK;
  ctx.fillRect(door.x, door.y, door.w, door.h);
  ctx.strokeRect(door.x + 1.5, door.y + 1.5, door.w - 3, door.h - 3);

  // arched panel
  ctx.beginPath();
  ctx.moveTo(door.x + 12, door.y + door.h - 8);
  ctx.lineTo(door.x + 12, door.y + 30);
  ctx.quadraticCurveTo(door.x + door.w / 2, door.y + 8, door.x + door.w - 12, door.y + 30);
  ctx.lineTo(door.x + door.w - 12, door.y + door.h - 8);
  ctx.stroke();

  // keyhole / handle
  ctx.beginPath();
  if (unlocked) {
    ctx.arc(door.x + door.w - 20, door.y + door.h / 2, 4, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.arc(door.x + door.w / 2, door.y + door.h / 2, 5, 0, Math.PI * 2);
    ctx.moveTo(door.x + door.w / 2, door.y + door.h / 2 + 4);
    ctx.lineTo(door.x + door.w / 2, door.y + door.h / 2 + 14);
    ctx.stroke();
  }

  if (unlocked) {
    ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.15;
    ctx.strokeStyle = '#c99700';
    ctx.lineWidth = 4;
    ctx.strokeRect(door.x - 4, door.y - 4, door.w + 8, door.h + 8);
  }
  ctx.restore();
}
