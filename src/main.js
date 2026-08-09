import { Input } from './input.js';
import { Player } from './player.js';
import { level, allBlocks } from './level.js';
import { drawBackground, drawLevel, drawKey, drawDoor } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const keyStatus = document.getElementById('key-status');
const banner = document.getElementById('banner');
const bannerText = document.getElementById('banner-text');

const VIEW_H = 620; // world units visible vertically; sets the zoom
const STEP = 1 / 120;

const input = new Input();
const blocks = allBlocks();
const player = new Player(level.spawn);
const cam = { x: 0, y: 0 };

let state, view, scale;

function restart() {
  player.reset(level.spawn);
  state = { hasKey: false, won: false, time: 0 };
  cam.x = player.x - view.w / 2;
  cam.y = player.y - view.h / 2;
  keyStatus.textContent = 'No key';
  keyStatus.className = 'chip locked';
  banner.classList.add('hidden');
}
input.onRestart = restart;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cssW = innerWidth;
  const cssH = innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  scale = cssH / VIEW_H;
  view = { w: cssW / scale, h: VIEW_H };
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
}
addEventListener('resize', resize);
resize();
restart();

const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));

function followCamera(dt) {
  const targetX = player.x + player.w / 2 - view.w / 2;
  const targetY = player.y + player.h / 2 - view.h / 2 + 40;
  const k = 1 - Math.pow(0.0015, dt);
  cam.x += (targetX - cam.x) * k;
  cam.y += (targetY - cam.y) * k;
  cam.x = clamp(cam.x, 0, level.world.w - view.w);
  cam.y = clamp(cam.y, -120, level.world.h - view.h);
}

function hits(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(dt, now) {
  state.time += dt;
  if (state.won) return;

  player.update(dt, now, input, blocks);

  if (player.y > level.world.h + 200) player.reset(level.spawn);

  if (!state.hasKey) {
    const k = level.key;
    if (hits(player.box, { x: k.x - k.r, y: k.y - k.r, w: k.r * 2, h: k.r * 2 })) {
      state.hasKey = true;
      keyStatus.textContent = 'Key!';
      keyStatus.className = 'chip have';
    }
  }

  if (state.hasKey && hits(player.box, level.door)) {
    state.won = true;
    bannerText.innerHTML = 'Level complete<small>Press R to play again</small>';
    banner.classList.remove('hidden');
  }
}

let acc = 0;
let last = performance.now() / 1000;

function frame() {
  const now = performance.now() / 1000;
  const frameDt = Math.min(0.05, now - last);
  acc += Math.min(0.25, now - last);
  last = now;
  while (acc >= STEP) {
    update(STEP, now);
    acc -= STEP;
  }
  followCamera(frameDt);

  drawBackground(ctx, cam, view, level.world);
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawLevel(ctx, level);
  if (!state.hasKey) drawKey(ctx, level.key, state.time);
  drawDoor(ctx, level.door, state.hasKey, state.time);
  player.draw(ctx);
  ctx.restore();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy while we iterate on the level
window.__game = { player, input, cam, level, getState: () => state };
