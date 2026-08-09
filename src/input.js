const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const JUMP = ['ArrowUp', 'KeyW', 'Space'];
const DOWN = ['ArrowDown', 'KeyS'];

export class Input {
  constructor() {
    this.held = new Set();
    this.jumpPressedAt = -Infinity;
    this.onRestart = () => {};

    addEventListener('keydown', (e) => {
      if (JUMP.includes(e.code) || DOWN.includes(e.code) || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'KeyR') this.onRestart();
      if (JUMP.includes(e.code)) this.jumpPressedAt = performance.now() / 1000;
      this.held.add(e.code);
    });

    addEventListener('keyup', (e) => this.held.delete(e.code));
    addEventListener('blur', () => this.held.clear());
  }

  any(codes) {
    return codes.some((c) => this.held.has(c));
  }

  // -1, 0 or 1
  get moveX() {
    return (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0);
  }

  get jumpHeld() {
    return this.any(JUMP);
  }

  get downHeld() {
    return this.any(DOWN);
  }

  /** True once per press, within `window` seconds of the keydown. */
  consumeJump(now, window) {
    if (now - this.jumpPressedAt <= window) {
      this.jumpPressedAt = -Infinity;
      return true;
    }
    return false;
  }
}
