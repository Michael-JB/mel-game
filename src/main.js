import { Input } from './input.js';
import { Player } from './player.js';
import { Robot } from './robot.js';
import { LEVELS, activeBlocks, moverAt } from './levels.js';
import { drawBackground, drawSceneShell, drawLevel, drawKey, drawPortal, drawGrade } from './render.js';
import { groundBelow } from './scene.js';
import { drawJail } from './jail.js';
import { buildTuner } from './tuner.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const levelLabel = document.getElementById('level-label');
const keyStatus = document.getElementById('key-status');
const banner = document.getElementById('banner');
const bannerText = document.getElementById('banner-text');
const toast = document.getElementById('toast');

// Zoom: aim for VIEW_H units of height, but never show less than MIN_VIEW_W
// across (phones in landscape) and never zoom out past MAX_VIEW_H (portrait,
// where the runner would otherwise end up the size of an ant).
const VIEW_H = 620;
const MIN_VIEW_W = 820;
const MAX_VIEW_H = 900;
const STEP = 1 / 120;

const input = new Input();
const player = new Player(LEVELS[0].spawnLeft);
const robot = new Robot(LEVELS[0].spawnLeft);
const cam = { x: 0, y: 0 };
const GRACE = 3.5; // head start before the drone drops in
const TRAIL_BACK = 280; // how far back down your own trail it appears

const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));

let level, index, progress, blocks;
let clock = 0; // drives the platform cycles; never resets, so they stay predictable
let won = false;
let arrest = null; // the arrest-and-jail sequence, once it has you
let graceLeft = 0; // head start remaining — only counts down once you move
let started = false; // whether you have taken a step yet
let chasing = false; // whether the drone has actually dropped in
let trail = []; // where you have recently had both feet down
let trailAt = 0;
let toastUntil = 0;
let view, scale;

function say(text, seconds = 2) {
  toast.textContent = text;
  toast.classList.remove('hidden');
  toastUntil = clock + seconds;
}

function hud() {
  levelLabel.textContent = `Level ${index + 1}/${LEVELS.length} — ${level.name}`;
  const has = progress[index].hasKey;
  keyStatus.textContent = has ? 'Key!' : 'No key';
  keyStatus.className = has ? 'chip have' : 'chip locked';
}

function loadLevel(i, entry) {
  index = i;
  level = LEVELS[i];
  const spawn = entry === 'right' ? level.spawnRight : level.spawnLeft;
  player.reset(spawn);
  // It drops in where you came in — the only spot the level guarantees is
  // standable — and stays inert until you have had a head start.
  trail = [];
  armChase(GRACE);
  blocks = activeBlocks(level, clock, progress[i].hasKey); // so the first frame can draw
  cam.x = player.x + player.w / 2 - view.w / 2;
  cam.y = player.y + player.h / 2 - view.h / 2;
  hud();
}

/**
 * Arm the chase. The drone doesn't appear until there is somewhere behind you to
 * put it — a spot you actually stood on, far enough back to be fair — so it can
 * never materialise on top of you, and standing still merely postpones it.
 */
function armChase(delay, already = false) {
  chasing = false;
  started = already;
  graceLeft = delay;
}

function newRun() {
  progress = LEVELS.map(() => ({ hasKey: false }));
  won = false;
  arrest = null;
  banner.classList.add('hidden');
  loadLevel(0, 'left');
}
input.onRestart = () => (arrest ? releaseFromJail() : newRun());

function die() {
  newRun();
  say('You fell. Back to the start.', 2.5);
}

function releaseFromJail() {
  player.arrested = false;
  newRun();
}

function resize() {
  const vv = window.visualViewport;
  const cssW = Math.round(vv ? vv.width : innerWidth);
  const cssH = Math.round(vv ? vv.height : innerHeight);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  scale = Math.max(cssH / MAX_VIEW_H, Math.min(cssH / VIEW_H, cssW / MIN_VIEW_W));
  view = { w: cssW / scale, h: cssH / scale };
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 150));
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
resize();
newRun();
buildTuner(document.getElementById('tuner'), document.getElementById('tuner-toggle'));
input.bindPad(document.getElementById('touch'));
document.getElementById('restart').addEventListener('click', () => input.onRestart());
addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
if (innerHeight > innerWidth) say('Turn the phone sideways for more room.', 4);

function followCamera(dt) {
  const targetX = player.x + player.w / 2 - view.w / 2;
  const targetY = player.y + player.h / 2 - view.h / 2 + 30;
  const k = 1 - Math.pow(0.0015, dt);
  cam.x += (targetX - cam.x) * k;
  cam.y += (targetY - cam.y) * k;
  cam.x = clamp(cam.x, 0, level.world.w - view.w);
  cam.y = clamp(cam.y, 0, level.world.h - view.h);
}

function hits(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(dt, now) {
  if (won) return;
  if (arrest) {
    arrest.t += dt;
    return;
  }
  const here = progress[index];
  blocks = activeBlocks(level, clock, here.hasKey);

  // a platform you are standing on takes you with it
  if (player.groundId) {
    const ride = level.platforms.find((p) => p.id === player.groundId);
    if (ride && ride.move) {
      const was = moverAt(ride, clock - dt);
      const is = moverAt(ride, clock);
      player.x += is.x - was.x;
      player.y += is.y - was.y;
    }
  }

  player.update(dt, now, input, blocks);

  // breadcrumbs: the route you actually took, which is the route it will take
  if (player.grounded && clock - trailAt > 0.25) {
    trailAt = clock;
    trail.push({ x: player.x, y: player.y });
    if (trail.length > 40) trail.shift();
  }

  if (!chasing) {
    // the city only notices you once you move; standing at the door is free
    if (!started && (input.moveX !== 0 || input.jumpHeld)) {
      started = true;
      say('Patrol drone inbound — keep moving.', 2.4);
    }
    if (started) graceLeft -= dt;
    if (graceLeft <= 0) {
      const behind = trail.find(
        (p) =>
          Math.hypot(p.x - player.x, p.y - player.y) > TRAIL_BACK &&
          !blocks.some((b) => hits({ x: p.x, y: p.y, w: robot.body.w, h: robot.body.h }, b))
      );
      if (behind) {
        robot.reset(behind);
        chasing = true;
      }
    }
  } else {
    const lost = robot.update(dt, now, blocks, player, level.world);
    if (lost) {
      armChase(1.5, true);
      say('Another unit picks up the chase.', 1.8);
    } else if (hits(player.box, robot.box)) {
      arrest = { t: 0, x: player.x, y: player.y };
      player.arrested = true;
      return;
    }
  }

  if (player.y > level.world.h + 200) {
    die();
    return;
  }

  if (!here.hasKey) {
    const k = level.key;
    if (hits(player.box, { x: k.x - k.r, y: k.y - k.r, w: k.r * 2, h: k.r * 2 })) {
      here.hasKey = true;
      hud();
      say('Key! The gate is at the far right.');
    }
  }

  // the left edge is the way back
  if (index > 0 && player.x <= 0) {
    loadLevel(index - 1, 'right');
    return;
  }

  // the right edge is the way on — sealed by an invisible wall until you have
  // the key, so without it you can only ever touch it
  const atEdge = player.x + player.w >= level.world.w - 2;
  if (atEdge) {
    if (!here.hasKey) {
      if (clock > toastUntil) say('Sealed. The key is somewhere near the top.');
    } else if (index + 1 < LEVELS.length) {
      loadLevel(index + 1, 'left');
      return;
    } else {
      won = true;
      bannerText.innerHTML = 'All three levels cleared<small>press R, or the arrow button, to start over</small>';
      banner.classList.remove('hidden');
    }
  }
}

let acc = 0;
let last = performance.now() / 1000;

function frame() {
  const now = performance.now() / 1000;
  const frameDt = Math.min(0.05, now - last);
  acc += Math.min(0.25, now - last);
  last = now;
  if (toastUntil && clock > toastUntil) {
    toast.classList.add('hidden');
    toastUntil = 0;
  }

  while (acc >= STEP) {
    clock += STEP; // stays in lockstep with the physics so platforms are exact
    update(STEP, now);
    acc -= STEP;
  }
  followCamera(frameDt);

  drawBackground(ctx, cam, view, level);
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawSceneShell(ctx, level, cam, view);
  drawLevel(ctx, level, clock);
  if (!progress[index].hasKey) drawKey(ctx, level.key, clock);
  drawPortal(ctx, level, 1, progress[index].hasKey, clock);
  if (index > 0) drawPortal(ctx, level, -1, true, clock);

  if (chasing) {
    const rFloor = groundBelow(blocks, robot.box);
    if (rFloor) robot.body.drawShadow(ctx, rFloor);
    robot.draw(ctx);
  }

  const floor = groundBelow(blocks, player.box);
  if (floor) player.drawShadow(ctx, floor);
  player.draw(ctx);
  ctx.restore();
  drawGrade(ctx, cam, view, level);
  if (arrest) drawJail(ctx, view, arrest.t);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy while we iterate on the levels
window.__game = {
  player,
  robot,
  input,
  cam,
  LEVELS,
  at: () => ({ index, level: level.name, progress, clock }),
  goto: (i, entry) => loadLevel(i, entry),
  bust: () => { arrest = { t: 0 }; player.arrested = true; },
  tp: (x, y) => {
    player.reset({ x, y });
    cam.x = clamp(x + player.w / 2 - view.w / 2, 0, level.world.w - view.w);
    cam.y = clamp(y + player.h / 2 - view.h / 2, 0, level.world.h - view.h);
  },
};
