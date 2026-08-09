// What happens after the drone gets a hand on you: a beat of being held, then
// the cell. Drawn in screen space, over the top of everything.

const easeOut = (v) => 1 - (1 - v) * (1 - v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const HOLD = 1.1; // held by the collar
const WIPE = 0.7; // the world goes out

export function drawJail(ctx, view, t) {
  // 1. the grab: everything drains of colour while the drone has you
  if (t < HOLD) {
    ctx.fillStyle = `rgba(70,10,14,${0.1 + (t / HOLD) * 0.22})`;
    ctx.fillRect(0, 0, view.w, view.h);
    if (Math.floor(t * 6) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,60,50,0.1)';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    return;
  }

  // 2. wipe to black
  const wipe = clamp01((t - HOLD) / WIPE);
  ctx.fillStyle = `rgba(8,7,16,${0.32 + wipe * 0.68})`;
  ctx.fillRect(0, 0, view.w, view.h);
  if (wipe < 1) return;

  // 3. the cell
  const cell = clamp01((t - HOLD - WIPE) / 0.9);
  const cx = view.w / 2;
  const floorY = view.h * 0.74;

  ctx.save();
  ctx.globalAlpha = easeOut(cell);

  // back wall and floor
  ctx.fillStyle = '#2a2733';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = '#201e29';
  ctx.fillRect(0, floorY, view.w, view.h - floorY);
  ctx.fillStyle = 'rgba(255,190,120,0.12)';
  ctx.fillRect(0, floorY, view.w, 3);

  // barred window, sunset still going on outside without you
  const wx = cx + 150;
  const wy = view.h * 0.2;
  const g = ctx.createLinearGradient(wx, wy, wx, wy + 120);
  g.addColorStop(0, '#c4425e');
  g.addColorStop(1, '#ff9a53');
  ctx.fillStyle = g;
  ctx.fillRect(wx, wy, 130, 120);
  ctx.strokeStyle = '#15131d';
  ctx.lineWidth = 7;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(wx + (i * 130) / 4, wy);
    ctx.lineTo(wx + (i * 130) / 4, wy + 120);
    ctx.stroke();
  }
  ctx.strokeRect(wx, wy, 130, 120);

  // the light it throws on the floor
  const beam = ctx.createLinearGradient(wx, wy, wx - 210, floorY + 40);
  beam.addColorStop(0, 'rgba(255,190,120,0.20)');
  beam.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(wx, wy + 120);
  ctx.lineTo(wx + 130, wy + 120);
  ctx.lineTo(wx - 90, floorY + 30);
  ctx.lineTo(wx - 250, floorY + 30);
  ctx.closePath();
  ctx.fill();

  // a bench, and him sitting on it with his head down
  const bx = cx - 210;
  ctx.fillStyle = '#3b3746';
  ctx.fillRect(bx, floorY - 46, 190, 12);
  ctx.fillRect(bx + 12, floorY - 34, 10, 34);
  ctx.fillRect(bx + 168, floorY - 34, 10, 34);

  const sx = bx + 86;
  const sy = floorY - 46;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1.5, 1.5);
  ctx.translate(-sx, -sy);
  ctx.strokeStyle = '#15161f';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(sx, sy - 40, 7, 0, Math.PI * 2); // head, dropped forward
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx, sy - 33);
  ctx.lineTo(sx + 3, sy - 12); // spine, slumped
  ctx.moveTo(sx + 3, sy - 12);
  ctx.lineTo(sx + 20, sy); // thigh
  ctx.lineTo(sx + 14, sy + 22); // shin
  ctx.moveTo(sx + 3, sy - 12);
  ctx.lineTo(sx + 24, sy + 2);
  ctx.lineTo(sx + 30, sy + 22);
  ctx.moveTo(sx + 1, sy - 28); // arms hanging over the knees
  ctx.lineTo(sx + 14, sy - 14);
  ctx.lineTo(sx + 22, sy - 2);
  ctx.stroke();
  ctx.restore();

  // and the bars, right in front of the camera
  ctx.fillStyle = '#0e0d16';
  ctx.fillRect(0, 0, view.w, 26);
  ctx.fillRect(0, view.h - 26, view.w, 26);
  for (let x = -40; x < view.w + 60; x += 104) {
    ctx.fillRect(x, 0, 17, view.h);
    ctx.fillStyle = 'rgba(255,190,130,0.18)';
    ctx.fillRect(x + 14, 0, 3, view.h);
    ctx.fillStyle = '#0e0d16';
  }
  ctx.fillRect(0, view.h * 0.34, view.w, 13);

  ctx.restore();

  if (cell < 0.75) return;
  ctx.save();
  ctx.globalAlpha = clamp01((cell - 0.75) / 0.25);
  ctx.fillStyle = '#ffd08a';
  ctx.font = '700 30px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DETAINED', view.w / 2, view.h * 0.5);
  ctx.font = '400 14px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#f2f0eb';
  ctx.fillText('press R, or the arrow button, to run it again', view.w / 2, view.h * 0.5 + 28);
  ctx.restore();
}
