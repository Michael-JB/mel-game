export const P = {
  W: 22,
  H: 44,
  // Momentum: it takes a beat to wind up to full speed, and a beat to shed it.
  MAX_RUN: 340,
  ACCEL: 1150,
  AIR_ACCEL: 850,
  FRICTION: 1500,
  AIR_DRAG: 200,
  JUMP_V: 700,
  JUMP_CUT: 0.45, // vy kept when the jump key is released early
  MAX_FALL: 1500,
  COYOTE: 0.1,
  BUFFER: 0.12,

  // Weighty arc: normal gravity on the way up, much heavier on the way down,
  // and a lull around the apex so a jump hangs before it drops.
  GRAVITY: 2300,
  FALL_MULT: 1.8,
  APEX_VY: 110,
  APEX_MULT: 0.42,

  // walls
  SLIDE_SPEED: 130, // fall speed while hugging a wall
  WALL_JUMP_VY: 800,
  WALL_JUMP_VX: 190, // a gentle nudge: you can steer back and climb one wall
  WALL_LOCK: 0.09, // steering is disabled this long after a wall jump
  WALL_COYOTE: 0.1,
  PROBE: 3, // how far to reach when looking for a wall

  // ledge grabs
  GRAB_UP: 6, // how far above our head a lip can be and still be caught
  GRAB_DOWN: 20, // ...and how far below
  GRAB_HANG: 2, // where our head sits relative to the lip once we're on it
  GRAB_COOLDOWN: 0.28,
  CLIMB_TIME: 0.42, // pulling up over a lip, start to finish
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v) => 1 - (1 - v) * (1 - v);
const easeInOut = (v) => (v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v));

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
    this.groundId = null; // which platform we are standing on, if it has an id
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
    this.climb = null; // in-progress pull-up over a lip
    this.climbPhase = 0;
  }

  /** Heavier coming down than going up, and light around the apex. */
  gravity() {
    let g = P.GRAVITY;
    if (this.vy > 0) g *= P.FALL_MULT;
    if (Math.abs(this.vy) < P.APEX_VY) g *= P.APEX_MULT;
    return g;
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

  /** Pull up over the lip. Runs to completion — nothing interrupts it. */
  startClimb(b, dir) {
    this.climb = {
      t: 0,
      dir,
      fromX: this.x,
      fromY: this.y,
      toX: dir > 0 ? b.x + 4 : b.x + b.w - this.w - 4,
      toY: b.y - this.h,
    };
    this.hang = null;
    this.hangDir = 0;
    this.climbPhase = 0;
    this.vx = 0;
    this.vy = 0;
  }

  updateClimb(dt, now) {
    const c = this.climb;
    c.t += dt;
    const p = clamp01(c.t / P.CLIMB_TIME);
    // rise first, then shift across onto the ledge
    const up = easeOut(clamp01(p / 0.62));
    const over = easeInOut(clamp01((p - 0.34) / 0.66));
    this.y = c.fromY + (c.toY - c.fromY) * up;
    this.x = c.fromX + (c.toX - c.fromX) * over;
    this.facing = c.dir;
    this.climbPhase = p;

    if (p >= 1) {
      this.climb = null;
      this.grounded = true;
      this.groundedAt = now;
      this.grabBlockedUntil = now + P.GRAB_COOLDOWN;
    }
  }

  /** Returns true if we stayed on the ledge and should skip the rest of the step. */
  updateHang(now, input, dir) {
    this.vx = 0;
    this.vy = 0;
    this.facing = this.hangDir;
    this.wallDir = this.hangDir;
    const away = dir === -this.hangDir;

    if (input.consumeJump(now, P.BUFFER)) {
      if (away) {
        this.vy = -P.WALL_JUMP_VY;
        this.vx = -this.hangDir * P.WALL_JUMP_VX;
        this.facing = -this.hangDir;
        this.lockUntil = now + P.WALL_LOCK;
        this.letGo(now);
      } else {
        this.startClimb(this.hang, this.hangDir);
      }
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

    if (this.climb) {
      this.updateClimb(dt, now);
      return;
    }

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

    this.vy = Math.min(P.MAX_FALL, this.vy + this.gravity() * dt);
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
    this.groundId = null;
    for (const b of blocks) {
      if (!overlaps(this.box, b)) continue;
      if (b.oneWay) {
        if (dy <= 0 || dropThrough || prevBottom > b.y + 1) continue;
        this.y = b.y - this.h;
        this.vy = 0;
        this.grounded = true;
        this.groundId = b.id ?? null;
        continue;
      }
      if (dy > 0) {
        this.y = b.y - this.h;
        this.grounded = true;
        this.groundId = b.id ?? null;
      } else if (dy < 0) {
        this.y = b.y + b.h;
      }
      this.vy = 0;
    }
  }

  /** Where every limb is this frame — shared by the figure and its shadow. */
  pose() {
    const cx = this.x + this.w / 2;
    const top = this.y;
    const hip = top + 28;
    const shoulder = top + 17;
    const feet = top + this.h;
    const f = this.facing;

    let legA, legB, armA, armB;
    if (this.climb) {
      // pull up on straightening arms, swing the near knee onto the lip, stand
      const p = this.climbPhase;
      const pull = clamp01(p / 0.62);
      const step = clamp01((p - 0.34) / 0.66);
      const lip = this.climb.toY + this.h - this.y; // lip height in local coords
      armA = { x: cx + f * 12, y: top + 2 - pull * 6 };
      armB = { x: cx + f * 8, y: top + 5 - pull * 6 };
      legA = { x: cx + f * (4 + step * 10), y: Math.min(feet, top + lip - step * 4) };
      legB = { x: cx - f * (2 + step * 4), y: feet };
    } else if (this.hang) {
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

    return { cx, top, hip, shoulder, feet, f, legA, legB, armA, armB };
  }

  static stroke(ctx, p, width) {
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(p.cx, p.top + 7, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.cx, p.top + 14);
    ctx.lineTo(p.cx, p.hip);
    ctx.moveTo(p.legA.x, p.legA.y);
    ctx.lineTo(p.cx, p.hip);
    ctx.lineTo(p.legB.x, p.legB.y);
    ctx.moveTo(p.armA.x, p.armA.y);
    ctx.lineTo(p.cx, p.shoulder);
    ctx.lineTo(p.armB.x, p.armB.y);
    ctx.stroke();
  }

  draw(ctx) {
    const p = this.pose();
    ctx.save();

    // sun is low and behind on the right: a warm edge on that side...
    ctx.strokeStyle = 'rgba(255,198,130,0.85)';
    ctx.translate(2.2, -1.4);
    Player.stroke(ctx, p, 5);
    ctx.translate(-2.2, 1.4);

    // ...and cool bounce on the other
    ctx.strokeStyle = 'rgba(120,150,205,0.5)';
    ctx.translate(-2, 1);
    Player.stroke(ctx, p, 4.5);
    ctx.translate(2, -1);

    ctx.strokeStyle = '#15161f';
    ctx.fillStyle = '#15161f';
    Player.stroke(ctx, p, 3.2);

    ctx.beginPath();
    ctx.arc(p.cx + p.f * 4, p.top + 6, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Flattened onto whatever surface is underneath, plus a contact patch. */
  drawShadow(ctx, block) {
    const p = this.pose();
    const gy = block.y;
    const drop = Math.max(0, gy - (this.y + this.h));

    ctx.save();
    ctx.beginPath(); // never let a shadow stray off its surface into the sky
    ctx.rect(block.x, gy - 12, block.w, block.h + 40);
    ctx.clip();

    // the long one: a low sun smears the figure sideways and almost flat
    ctx.globalAlpha = Math.max(0.1, 0.42 - drop / 900);
    ctx.strokeStyle = '#191131';
    ctx.save();
    ctx.transform(1, 0, 1.55, 0.1, -1.55 * gy, gy * 0.9);
    Player.stroke(ctx, p, 7);
    ctx.restore();

    // and the dark patch right where he meets it
    ctx.globalAlpha = Math.max(0, 0.5 - drop / 320);
    ctx.fillStyle = '#191131';
    ctx.beginPath();
    ctx.ellipse(p.cx - 5, gy + 2, 15 + drop * 0.03, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
