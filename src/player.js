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

/**
 * Two-bone IK: given a shoulder/hip at a, a hand/foot at b, and two bone
 * lengths, find where the elbow or knee has to sit. `bend` picks which way the
 * joint folds.
 */
function joint(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax;
  let dy = by - ay;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
    d = max;
  }
  if (d < 0.01) d = 0.01;
  const a1 = Math.atan2(dy, dx);
  const cos = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const a2 = Math.acos(cos) * bend;
  return { x: ax + Math.cos(a1 + a2) * l1, y: ay + Math.sin(a1 + a2) * l1, ex: ax + dx, ey: ay + dy };
}

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Player {
  constructor(spawn, cfg) {
    this.cfg = cfg || P;
    this.reset(spawn);
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.w = this.cfg.W;
    this.h = this.cfg.H;
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
    let g = this.cfg.GRAVITY;
    if (this.vy > 0) g *= this.cfg.FALL_MULT;
    if (Math.abs(this.vy) < this.cfg.APEX_VY) g *= this.cfg.APEX_MULT;
    return g;
  }

  get box() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  /** Is there a solid face just beyond our left (-1) or right (1) edge? */
  wallOn(dir, blocks) {
    const probe = {
      x: dir > 0 ? this.x + this.w : this.x - this.cfg.PROBE,
      y: this.y + 8,
      w: this.cfg.PROBE,
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
      if (Math.abs(face - edge) > this.cfg.PROBE + 1) continue;
      if (b.y < this.y - this.cfg.GRAB_UP || b.y > this.y + this.cfg.GRAB_DOWN) continue;
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
    this.y = b.y + this.cfg.GRAB_HANG;
    this.sliding = false;
  }

  letGo(now) {
    this.hang = null;
    this.hangDir = 0;
    this.grabBlockedUntil = now + this.cfg.GRAB_COOLDOWN;
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
    const p = clamp01(c.t / this.cfg.CLIMB_TIME);
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
      this.grabBlockedUntil = now + this.cfg.GRAB_COOLDOWN;
    }
  }

  /** Returns true if we stayed on the ledge and should skip the rest of the step. */
  updateHang(now, input, dir) {
    this.vx = 0;
    this.vy = 0;
    this.facing = this.hangDir;
    this.wallDir = this.hangDir;
    const away = dir === -this.hangDir;

    if (input.consumeJump(now, this.cfg.BUFFER)) {
      if (away) {
        this.vy = -this.cfg.WALL_JUMP_VY;
        this.vx = -this.hangDir * this.cfg.WALL_JUMP_VX;
        this.facing = -this.hangDir;
        this.lockUntil = now + this.cfg.WALL_LOCK;
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
      this.vy = Math.min(this.vy, this.cfg.SLIDE_SPEED);
    }

    // horizontal, unless a wall jump has just taken control away
    if (now >= this.lockUntil) {
      const accel = this.grounded ? this.cfg.ACCEL : this.cfg.AIR_ACCEL;
      if (dir !== 0) {
        this.vx = Math.max(-this.cfg.MAX_RUN, Math.min(this.cfg.MAX_RUN, this.vx + dir * accel * dt));
      } else {
        const drag = (this.grounded ? this.cfg.FRICTION : this.cfg.AIR_DRAG) * dt;
        this.vx = Math.abs(this.vx) <= drag ? 0 : this.vx - Math.sign(this.vx) * drag;
      }
    }

    const canGroundJump = this.grounded || now - this.groundedAt <= this.cfg.COYOTE;
    const canWallJump =
      !this.grounded && (this.wallDir !== 0 || now - this.wallAt <= this.cfg.WALL_COYOTE);

    if ((canGroundJump || canWallJump) && input.consumeJump(now, this.cfg.BUFFER)) {
      if (canGroundJump) {
        this.vy = -this.cfg.JUMP_V;
      } else {
        const away = -(this.wallDir || this.lastWallDir);
        this.vy = -this.cfg.WALL_JUMP_VY;
        this.vx = away * this.cfg.WALL_JUMP_VX;
        this.facing = away;
        this.lockUntil = now + this.cfg.WALL_LOCK;
        this.wallAt = -Infinity;
        this.sliding = false;
      }
      this.grounded = false;
      this.groundedAt = -Infinity;
    }

    const cut = -this.cfg.JUMP_V * this.cfg.JUMP_CUT;
    if (!input.jumpHeld && this.vy < cut) this.vy = cut;

    this.vy = Math.min(this.cfg.MAX_FALL, this.vy + this.gravity() * dt);
    if (this.sliding) this.vy = Math.min(this.vy, this.cfg.SLIDE_SPEED);

    this.moveX(this.vx * dt, blocks);
    this.moveY(this.vy * dt, blocks, input.downHeld);

    if (this.grounded) {
      this.groundedAt = now;
      this.stride += (Math.abs(this.vx) / this.cfg.MAX_RUN) * dt * 13;
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
    const f = this.facing;
    let bob = 0;
    let lean = 0;
    const running = this.grounded && Math.abs(this.vx) > 15;
    const phase = this.stride * Math.PI * 2;

    if (running) {
      bob = -Math.abs(Math.sin(phase)) * 2.5;
      lean = (this.vx / this.cfg.MAX_RUN) * 2.6;
    }

    const h = this.h;
    const top = this.y + bob;
    const hipY = top + h * 0.636;
    const shoulderY = top + h * 0.386;
    const feet = this.y + h;
    const head = h * 0.159;
    const bone = { leg: (feet - hipY) * 0.6, arm: h * 0.216 };
    const cx = this.x + this.w / 2 + lean * 0.4;

    let legA, legB, armA, armB;
    if (this.arrested) {
      // hauled up by the collar: legs hanging, one arm pulled overhead
      legA = { x: cx + f * 4, y: feet - 2 };
      legB = { x: cx - f * 5, y: feet - 6 };
      armA = { x: cx + f * 7, y: top - 8 };
      armB = { x: cx - f * 9, y: shoulderY + 10 };
    } else if (this.climb) {
      const p = this.climbPhase;
      const pull = clamp01(p / 0.62);
      const step = clamp01((p - 0.34) / 0.66);
      const lip = this.climb.toY + this.h - this.y;
      armA = { x: cx + f * 13, y: top + 3 - pull * 7 };
      armB = { x: cx + f * 9, y: top + 7 - pull * 5 };
      legA = { x: cx + f * (5 + step * 12), y: Math.min(feet, top + lip - step * 6) };
      legB = { x: cx - f * (3 + step * 5), y: feet };
    } else if (this.hang) {
      // hanging: arms straight overhead, legs swinging gently below
      const sway = Math.sin(performance.now() / 420) * 1.6;
      legA = { x: cx + 5 + sway, y: feet };
      legB = { x: cx - 4 + sway, y: feet - 4 };
      armA = { x: cx + f * 11, y: top - 2 };
      armB = { x: cx + f * 6, y: top - 1 };
    } else if (this.sliding) {
      // braced against the wall: near arm up on it, near leg bent into it
      legA = { x: cx + f * 11, y: feet - 5 };
      legB = { x: cx + f * 3, y: feet };
      armA = { x: cx + f * 12, y: shoulderY - 7 };
      armB = { x: cx + f * 9, y: shoulderY + 8 };
    } else if (!this.grounded) {
      // rising: knees tucked. falling: legs reaching for the ground
      const rising = this.vy < 0;
      const tuck = rising ? 1 : 0.35;
      legA = { x: cx + f * (7 + tuck * 4), y: feet - tuck * 13 };
      legB = { x: cx - f * (6 + tuck * 2), y: feet - tuck * 4 };
      armA = { x: cx + f * 5, y: shoulderY - (rising ? 11 : 4) };
      armB = { x: cx - f * 11, y: shoulderY - (rising ? 3 : 9) };
    } else if (running) {
      // feet trace an ellipse: forward and high, then back along the ground
      const sn = Math.sin(phase);
      const cs = Math.cos(phase);
      legA = { x: cx + sn * 12, y: feet - Math.max(0, cs) * 11 };
      legB = { x: cx - sn * 12, y: feet - Math.max(0, -cs) * 11 };
      armA = { x: cx - sn * 11, y: shoulderY + 11 - Math.max(0, -sn) * 4 };
      armB = { x: cx + sn * 11, y: shoulderY + 11 - Math.max(0, sn) * 4 };
    } else {
      const breathe = Math.sin(performance.now() / 620) * 1.1;
      legA = { x: cx + 4, y: feet };
      legB = { x: cx - 4, y: feet };
      armA = { x: cx + 8, y: shoulderY + 14 + breathe };
      armB = { x: cx - 8, y: shoulderY + 14 + breathe };
    }

    return { cx, top, hip: hipY, shoulder: shoulderY, feet, f, head, bone, legA, legB, armA, armB };
  }

  static stroke(ctx, p, width) {
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(p.cx, p.top + p.head, p.head, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.cx, p.top + 14);
    ctx.lineTo(p.cx, p.hip);
    ctx.stroke();

    // legs bend at the knee, arms at the elbow; the far limb is drawn first so
    // the near one reads in front
    for (const [end, bend] of [[p.legB, -p.f], [p.legA, -p.f]]) {
      const k = joint(p.cx, p.hip, end.x, end.y, p.bone.leg, p.bone.leg, bend);
      ctx.beginPath();
      ctx.moveTo(p.cx, p.hip);
      ctx.lineTo(k.x, k.y);
      ctx.lineTo(k.ex, k.ey);
      ctx.stroke();
    }
    for (const [end, bend] of [[p.armB, p.f], [p.armA, p.f]]) {
      const e = joint(p.cx, p.shoulder, end.x, end.y, p.bone.arm, p.bone.arm, bend);
      ctx.beginPath();
      ctx.moveTo(p.cx, p.shoulder);
      ctx.lineTo(e.x, e.y);
      ctx.lineTo(e.ex, e.ey);
      ctx.stroke();
    }
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
    ctx.arc(p.cx + p.f * p.head * 0.55, p.top + p.head * 0.85, 1.6, 0, Math.PI * 2);
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
