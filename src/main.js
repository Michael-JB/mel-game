import { Input } from './input.js';
import { Player } from './player.js';
import { LEVELS, activeBlocks } from './levels.js';
import { drawBackground, drawLevel, drawKey, drawGate } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const levelLabel = document.getElementById('level-label');
const keyStatus = document.getElementById('key-status');
const banner = document.getElementById('banner');
const bannerText = document.getElementById('banner-text');
const toast = document.getElementById('toast');

const VIEW_H = 620; // world units visible vertically; sets the zoom
const STEP = 1 / 120;

const input = new Input();
const player = new Player(LEVELS[0].spawnLeft);
const cam = { x: 0, y: 0 };

let level, index, progress, blocks;
let clock = 0; // drives the platform cycles; never resets, so they stay predictable
let won = false;
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
  player.reset(entry === 'right' ? level.spawnRight : level.spawnLeft);
  cam.x = player.x + player.w / 2 - view.w / 2;
  cam.y = player.y + player.h / 2 - view.h / 2;
  hud();
}

function newRun() {
  progress = LEVELS.map(() => ({ hasKey: false }));
  won = false;
  banner.classList.add('hidden');
  loadLevel(0, 'left');
}
input.onRestart = newRun;

function die() {
  newRun();
  say('You fell. Back to the start.', 2.5);
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  scale = innerHeight / VIEW_H;
  view = { w: innerWidth / scale, h: VIEW_H };
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
}
addEventListener('resize', resize);
resize();
newRun();

const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));

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
  const here = progress[index];
  blocks = activeBlocks(level, clock, here.hasKey);
  player.update(dt, now, input, blocks);

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

  // back to the previous level through the left edge
  if (index > 0 && player.x < 0) {
    loadLevel(index - 1, 'right');
    return;
  }

  // a locked gate is solid, so test a slightly padded box for the "locked" nudge
  const g = level.gate;
  const near = here.hasKey ? g : { x: g.x - 6, y: g.y - 6, w: g.w + 12, h: g.h + 12 };
  if (hits(player.box, near)) {
    if (!here.hasKey) {
      if (clock > toastUntil) say('Locked. Find the key — try higher up.');
    } else if (index + 1 < LEVELS.length) {
      loadLevel(index + 1, 'left');
      return;
    } else {
      won = true;
      bannerText.innerHTML = 'All three levels cleared<small>Press R to start over</small>';
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
  clock += frameDt;
  if (toastUntil && clock > toastUntil) {
    toast.classList.add('hidden');
    toastUntil = 0;
  }

  while (acc >= STEP) {
    update(STEP, now);
    acc -= STEP;
  }
  followCamera(frameDt);

  drawBackground(ctx, cam, view, level.world);
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawLevel(ctx, level, clock);
  if (!progress[index].hasKey) drawKey(ctx, level.key, clock);
  drawGate(ctx, level.gate, progress[index].hasKey, clock);
  player.draw(ctx);
  ctx.restore();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy while we iterate on the levels
window.__game = {
  player,
  input,
  cam,
  LEVELS,
  at: () => ({ index, level: level.name, progress, clock }),
  goto: (i, entry) => loadLevel(i, entry),
  tp: (x, y) => player.reset({ x, y }),
};
