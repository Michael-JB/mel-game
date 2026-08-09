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

  // walls
  SLIDE_SPEED: 130, // fall speed while hugging a wall
  WALL_JUMP_VY: 820,
  WALL_JUMP_VX: 380,
  WALL_LOCK: 0.12, // steering is disabled this long after a wall jump
  WALL_COYOTE: 0.1,
  PROBE: 3, // how far to reach when looking for a wall

  // ledge grabs
  GRAB_UP: 6, // how far above our head a lip can be and still be caught
  GRAB_DOWN: 20, // ...and how far below
  GRAB_HANG: 2, // where our head sits relative to the lip once we're on it
  GRAB_COOLDOWN: 0.28,
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
    this.groundedAt = -Infinity;
    this.wallDir = 0; // 1 = wall on the right, -1 = wall on the left
    this.wallAt = -Infinity;
    this.lastWallDir = 0;
    this.sliding = false;
    this.lockUntil = -Infinity;
    this.hang = null; // the block whose lip we're hanging from
    this.hangDir = 0;
    this.grabBlockedUntil = -Infinity;
  }

  get box() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  /** Is there a solid face just beyond our left (-1) or right (1) edge? */
  wallOn(dir, blocks) {
    const probe = {
      x: dir > 0 ? this.x + this.w : this.x - P.PROBE,
      y: this.y + 8,
      w: P.PROBE,
      h: this.h - 16, // ignore the corners so floors and ceilings don't count
    };
    return blocks.some((b) => !b.oneWay && overlaps(probe, b));
  }

  /** A block whose top edge is level with our hands, with room to climb onto. */
  findLedge(dir, blocks) {
    const edge = dir > 0 ? this.x + this.w : this.x;
    for (const b of blocks) {
      if (b.oneWay) continue;
      const face = dir > 0 ? b.x : b.x + b.w;
      if (Math.abs(face - edge) > P.PROBE + 1) continue;
      if (b.y < this.y - P.GRAB_UP || b.y > this.y + P.GRAB_DOWN) continue;
      if (b.y + b.h < this.y + this.h * 0.5) continue; // a sliver, not a wall
      const landing = {
        x: dir > 0 ? b.x + 4 : b.x + b.w - this.w - 4,
        y: b.y - this.h,
        w: this.w,
        h: this.h,
      };
      if (blocks.some((o) => o !== b && !o.oneWay && overlaps(landing, o))) continue;
      return b;
    }
    return null;
  }

  grab(b, dir) {
    this.hang = b;
    this.hangDir = dir;
    this.facing = dir;
    this.vx = 0;
    this.vy = 0;
    this.x = dir > 0 ? b.x - this.w : b.x + b.w;
    this.y = b.y + P.GRAB_HANG;
    this.sliding = false;
  }

  letGo(now) {
    this.hang = null;
    this.hangDir = 0;
    this.grabBlockedUntil = now + P.GRAB_COOLDOWN;
  }

  /** Returns true if we stayed on the ledge and should skip the rest of the step. */
  updateHang(now, input, dir) {
    this.vx = 0;
    this.vy = 0;
    this.facing = this.hangDir;
    this.wallDir = this.hangDir;
    const away = dir === -this.hangDir;

    if (input.consumeJump(now, P.BUFFER)) {
      const b = this.hang;
      if (away) {
        this.vy = -P.WALL_JUMP_VY;
        this.vx = -this.hangDir * P.WALL_JUMP_VX;
        this.facing = -this.hangDir;
        this.lockUntil = now + P.WALL_LOCK;
      } else {
        // climb up over the lip
        this.x = this.hangDir > 0 ? b.x + 4 : b.x + b.w - this.w - 4;
        this.y = b.y - this.h;
        this.grounded = true;
        this.groundedAt = now;
      }
      this.letGo(now);
      return true;
    }

    if (away || input.downHeld) {
      this.letGo(now);
      return false;
    }
    return true;
  }

  update(dt, now, input, blocks) {
    const dir = input.moveX;

    if (this.hang) {
      if (this.updateHang(now, input, dir)) return;
    }

    if (dir !== 0 && now >= this.lockUntil) this.facing = dir;

    this.wallDir = 0;
    if (!this.grounded) {
      if (this.wallOn(1, blocks)) this.wallDir = 1;
      else if (this.wallOn(-1, blocks)) this.wallDir = -1;
    }
    if (this.wallDir !== 0) {
      this.wallAt = now;
      this.lastWallDir = this.wallDir;
    }

    // hugging a wall: face it and slow the fall
    this.sliding = this.wallDir !== 0 && this.vy > 0 && dir === this.wallDir;
    if (this.sliding) {
      this.facing = this.wallDir;
      this.vy = Math.min(this.vy, P.SLIDE_SPEED);
    }

    // horizontal, unless a wall jump has just taken control away
    if (now >= this.lockUntil) {
      const accel = this.grounded ? P.ACCEL : P.AIR_ACCEL;
      if (dir !== 0) {
        this.vx = Math.max(-P.MAX_RUN, Math.min(P.MAX_RUN, this.vx + dir * accel * dt));
      } else {
        const drag = (this.grounded ? P.FRICTION : P.AIR_DRAG) * dt;
        this.vx = Math.abs(this.vx) <= drag ? 0 : this.vx - Math.sign(this.vx) * drag;
      }
    }

    const canGroundJump = this.grounded || now - this.groundedAt <= P.COYOTE;
    const canWallJump =
      !this.grounded && (this.wallDir !== 0 || now - this.wallAt <= P.WALL_COYOTE);

    if ((canGroundJump || canWallJump) && input.consumeJump(now, P.BUFFER)) {
      if (canGroundJump) {
        this.vy = -P.JUMP_V;
      } else {
        const away = -(this.wallDir || this.lastWallDir);
        this.vy = -P.WALL_JUMP_VY;
        this.vx = away * P.WALL_JUMP_VX;
        this.facing = away;
        this.lockUntil = now + P.WALL_LOCK;
        this.wallAt = -Infinity;
        this.sliding = false;
      }
      this.grounded = false;
      this.groundedAt = -Infinity;
    }

    const cut = -P.JUMP_V * P.JUMP_CUT;
    if (!input.jumpHeld && this.vy < cut) this.vy = cut;

    this.vy = Math.min(P.MAX_FALL, this.vy + P.GRAVITY * dt);
    if (this.sliding) this.vy = Math.min(this.vy, P.SLIDE_SPEED);

    this.moveX(this.vx * dt, blocks);
    this.moveY(this.vy * dt, blocks, input.downHeld);

    if (this.grounded) {
      this.groundedAt = now;
      this.stride += (Math.abs(this.vx) / P.MAX_RUN) * dt * 13;
    } else if (this.vy >= 0 && now >= this.grabBlockedUntil && !input.downHeld) {
      const side = dir !== 0 ? dir : this.facing;
      let b = this.findLedge(side, blocks);
      let grabDir = side;
      if (!b) {
        b = this.findLedge(-side, blocks);
        grabDir = -side;
      }
      if (b) this.grab(b, grabDir);
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
    const f = this.facing;

    let legA, legB, armA, armB;
    if (this.hang) {
      // hands hooked over the lip, legs dangling
      legA = { x: cx + 4, y: feet };
      legB = { x: cx - 4, y: feet - 3 };
      armA = { x: cx + f * 11, y: top - 1 };
      armB = { x: cx + f * 7, y: top + 1 };
    } else if (this.sliding) {
      // clinging: both arms toward the wall, legs braced against it
      legA = { x: cx + f * 10, y: feet - 4 };
      legB = { x: cx + f * 2, y: feet };
      armA = { x: cx + f * 11, y: shoulder - 6 };
      armB = { x: cx + f * 9, y: shoulder + 6 };
    } else if (!this.grounded) {
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
    ctx.arc(cx + f * 4, top + 6, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
