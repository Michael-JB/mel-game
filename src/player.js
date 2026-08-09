export const P = {
  W: 22,
  H: 44,
  GRAVITY: 2200,
  MAX_RUN: 330,
  ACCEL: 2400,
  AIR_ACCEL: 1500,
  FRICTION: 2800,
  AIR_DRAG: 300,
  JUMP_V: 760,
  JUMP_CUT: 0.45, // vy kept when the jump key is released early
  MAX_FALL: 1300,
  COYOTE: 0.1,
  BUFFER: 0.12,
};

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Player {
  constructor(spawn) {
    this.reset(spawn);
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.w = P.W;
    this.h = P.H;
    this.grounded = false;
    this.facing = 1;
    this.stride = 0; // run-cycle phase
    this.airTime = 0;
    this.groundedAt = -Infinity;
  }

  get box() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(dt, now, input, blocks) {
    const dir = input.moveX;
    if (dir !== 0) this.facing = dir;

    // horizontal: accelerate toward the target speed, otherwise bleed off
    const accel = this.grounded ? P.ACCEL : P.AIR_ACCEL;
    if (dir !== 0) {
      this.vx += dir * accel * dt;
      this.vx = Math.max(-P.MAX_RUN, Math.min(P.MAX_RUN, this.vx));
    } else {
      const drag = (this.grounded ? P.FRICTION : P.AIR_DRAG) * dt;
      this.vx = Math.abs(this.vx) <= drag ? 0 : this.vx - Math.sign(this.vx) * drag;
    }

    // jump, with coyote time and an input buffer
    const canJump = this.grounded || now - this.groundedAt <= P.COYOTE;
    if (canJump && input.consumeJump(now, P.BUFFER)) {
      this.vy = -P.JUMP_V;
      this.grounded = false;
      this.groundedAt = -Infinity;
    }
    const cut = -P.JUMP_V * P.JUMP_CUT;
    if (!input.jumpHeld && this.vy < cut) this.vy = cut;

    this.vy = Math.min(P.MAX_FALL, this.vy + P.GRAVITY * dt);

    this.moveX(this.vx * dt, blocks);
    this.moveY(this.vy * dt, blocks, input.downHeld);

    if (this.grounded) {
      this.groundedAt = now;
      this.airTime = 0;
      this.stride += (Math.abs(this.vx) / P.MAX_RUN) * dt * 13;
    } else {
      this.airTime += dt;
    }
  }

  moveX(dx, blocks) {
    this.x += dx;
    for (const b of blocks) {
      if (b.oneWay || !overlaps(this.box, b)) continue;
      if (dx > 0) this.x = b.x - this.w;
      else if (dx < 0) this.x = b.x + b.w;
      this.vx = 0;
    }
  }

  moveY(dy, blocks, dropThrough) {
    const prevBottom = this.y + this.h;
    this.y += dy;
    this.grounded = false;
    for (const b of blocks) {
      if (!overlaps(this.box, b)) continue;
      if (b.oneWay) {
        if (dy <= 0 || dropThrough || prevBottom > b.y + 1) continue;
        this.y = b.y - this.h;
        this.vy = 0;
        this.grounded = true;
        continue;
      }
      if (dy > 0) {
        this.y = b.y - this.h;
        this.grounded = true;
      } else if (dy < 0) {
        this.y = b.y + b.h;
      }
      this.vy = 0;
    }
  }

  draw(ctx) {
    const cx = this.x + this.w / 2;
    const top = this.y;
    const hip = top + 28;
    const shoulder = top + 17;
    const feet = top + this.h;

    let legA, legB, armA, armB;
    if (!this.grounded) {
      // tucked front leg, trailing back leg, arms raised
      const f = this.facing;
      legA = { x: cx + f * 9, y: feet - 6 };
      legB = { x: cx - f * 8, y: feet };
      armA = { x: cx + f * 4, y: shoulder - 9 };
      armB = { x: cx - f * 9, y: shoulder - 4 };
    } else if (Math.abs(this.vx) > 15) {
      const s = Math.sin(this.stride * Math.PI * 2);
      const c = Math.cos(this.stride * Math.PI * 2);
      legA = { x: cx + s * 11, y: feet - Math.max(0, c) * 5 };
      legB = { x: cx - s * 11, y: feet - Math.max(0, -c) * 5 };
      armA = { x: cx - s * 9, y: shoulder + 12 };
      armB = { x: cx + s * 9, y: shoulder + 12 };
    } else {
      const bob = Math.sin(performance.now() / 600) * 1.2;
      legA = { x: cx + 6, y: feet + bob };
      legB = { x: cx - 6, y: feet + bob };
      armA = { x: cx + 8, y: shoulder + 13 + bob };
      armB = { x: cx - 8, y: shoulder + 13 + bob };
    }

    ctx.save();
    ctx.strokeStyle = '#1a1a1a';
    ctx.fillStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(cx, top + 7, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, top + 14);
    ctx.lineTo(cx, hip);
    ctx.moveTo(legA.x, legA.y);
    ctx.lineTo(cx, hip);
    ctx.lineTo(legB.x, legB.y);
    ctx.moveTo(armA.x, armA.y);
    ctx.lineTo(cx, shoulder);
    ctx.lineTo(armB.x, armB.y);
    ctx.stroke();

    // eye-line nub so you can tell which way he faces
    ctx.beginPath();
    ctx.arc(cx + this.facing * 4, top + 6, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
