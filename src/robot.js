// A police drone that walks the same level you do. It runs the player's physics
// with its own numbers — slower along the ground, but it jumps the same gaps and
// wall-climbs the same shafts — and steers itself with a handful of probes.
import { Player, P } from './player.js';

// scaled off the live player constants, so tuning the player retunes the chase
const SCALE = { MAX_RUN: 0.82, ACCEL: 0.6, AIR_ACCEL: 0.7, FRICTION: 0.8, W: 1.4, H: 1.25 };
const CFG = new Proxy({}, { get: (_, k) => (k in SCALE ? P[k] * SCALE[k] : P[k]) });

/** Stands in for the keyboard: the AI writes to it, the physics reads it. */
class Intent {
  constructor() {
    this.dir = 0;
    this.jump = false;
    this.down = false;
    this.jumpAt = -Infinity;
  }
  get moveX() { return this.dir; }
  get jumpHeld() { return this.jump; }
  get downHeld() { return this.down; }
  consumeJump(now, w) {
    if (now - this.jumpAt <= w) { this.jumpAt = -Infinity; return true; }
    return false;
  }
  press(now) { this.jumpAt = now; this.jump = true; }
}

const solidAt = (blocks, x, y) =>
  blocks.some((b) => !b.hidden && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);

/** Is there anything to land on within `depth` below this point? */
const groundWithin = (blocks, x, y, depth) =>
  blocks.some((b) => x >= b.x && x <= b.x + b.w && b.y >= y && b.y <= y + depth);

export class Robot {
  constructor(spawn) {
    this.body = new Player(spawn, CFG);
    this.intent = new Intent();
    this.spark = 0; // drives the light on top
    this.jumpedAt = -Infinity;
    this.lastProgress = 0;
    this.stuckFor = 0;
  }

  reset(spawn) {
    this.body.reset(spawn);
    this.stuckFor = 0;
  }

  get box() { return this.body.box; }

  update(dt, now, blocks, target, world) {
    const b = this.body;
    const i = this.intent;
    const dx = target.x - b.x;
    const dy = target.y - b.y;
    const ahead = dx >= 0 ? 1 : -1;

    i.dir = Math.abs(dx) > 10 ? ahead : 0;
    i.jump = false;

    const nose = ahead > 0 ? b.x + b.w + 8 : b.x - 8;
    const wallAhead = solidAt(blocks, nose, b.y + b.h * 0.5) || solidAt(blocks, nose, b.y + 6);
    const gapAhead = b.grounded && !groundWithin(blocks, nose + ahead * 20, b.y + b.h, 46);

    // only commit to a gap if you are actually on the far side of it — otherwise
    // it walks off its own rooftop chasing someone standing near the edge
    const across = Math.abs(dx) > 120;
    if (gapAhead && !across) i.dir = 0;

    let wantJump = false;
    if (b.grounded && wallAhead) wantJump = true;
    if (b.grounded && gapAhead && across) wantJump = true;
    if (b.grounded && dy < -70 && Math.abs(dx) < 260) wantJump = true;

    // on a wall with the target overhead: hug it and keep kicking upward
    if (!b.grounded && b.wallDir !== 0 && dy < 20) {
      i.dir = b.wallDir;
      wantJump = true;
    }
    // hanging off a lip: always haul itself up
    if (b.hang) wantJump = true;

    if (wantJump && now - this.jumpedAt > 0.22) {
      i.press(now);
      i.jump = true;
      this.jumpedAt = now;
    }
    i.jump = i.jump || now - this.jumpedAt < 0.3;

    b.update(dt, now, i, blocks);
    this.spark += dt;

    // Give up gracefully: if it drops out of the world or loses the scent for a
    // while, another unit picks up the chase from where you last had ground.
    if (b.y > world.h + 200) this.stuckFor = 99;
    else if (Math.abs(dx) > 1500) this.stuckFor += dt;
    else this.stuckFor = 0;
    return this.stuckFor > 4;
  }

  draw(ctx) {
    const b = this.body;
    const p = b.pose();
    const f = p.f;
    const cx = p.cx;
    const top = p.top;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // legs and arms: same skeleton as the runner, drawn heavier
    ctx.strokeStyle = '#2b3348';
    Player.stroke(ctx, p, 9);
    ctx.strokeStyle = '#5d6c8c';
    Player.stroke(ctx, p, 5);

    // armoured torso over the top of it
    ctx.fillStyle = '#3d485f';
    ctx.fillRect(cx - 11, top + 13, 22, 19);
    ctx.fillStyle = '#59668a';
    ctx.fillRect(cx - 11, top + 13, 22, 4);
    ctx.fillStyle = 'rgba(255,190,130,0.5)';
    ctx.fillRect(cx + 7, top + 13, 4, 19);

    // head unit with a single visor
    ctx.fillStyle = '#333c52';
    ctx.beginPath();
    ctx.roundRect(cx - 9, top - 2, 18, 16, 4);
    ctx.fill();
    const pulse = 0.55 + Math.sin(this.spark * 6) * 0.35;
    ctx.fillStyle = `rgba(255,70,60,${pulse})`;
    ctx.fillRect(cx - 6 + f * 2, top + 3, 11, 4);
    ctx.fillStyle = '#8a97b8';
    ctx.fillRect(cx - 9, top - 2, 18, 3);

    // beacon
    const beacon = ctx.createRadialGradient(cx, top - 8, 1, cx, top - 8, 26);
    beacon.addColorStop(0, `rgba(255,80,70,${pulse * 0.8})`);
    beacon.addColorStop(1, 'rgba(255,60,50,0)');
    ctx.fillStyle = beacon;
    ctx.fillRect(cx - 30, top - 38, 60, 60);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(cx - 3, top - 10, 6, 6);
    ctx.restore();
  }
}
