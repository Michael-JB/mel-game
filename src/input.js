const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const JUMP = ['ArrowUp', 'KeyW', 'Space'];
const DOWN = ['ArrowDown', 'KeyS'];

/** Keyboard and thumbs, feeding the same four signals. */
export class Input {
  constructor() {
    this.held = new Set();
    this.pad = { left: false, right: false, jump: false, down: false };
    this.jumpPressedAt = -Infinity;
    this.onRestart = () => {};

    addEventListener('keydown', (e) => {
      if (JUMP.includes(e.code) || DOWN.includes(e.code) || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'KeyR') this.onRestart();
      if (JUMP.includes(e.code)) this.pressJump();
      this.held.add(e.code);
    });

    addEventListener('keyup', (e) => this.held.delete(e.code));
    addEventListener('blur', () => {
      this.held.clear();
      for (const k of Object.keys(this.pad)) this.pad[k] = false;
    });
  }

  pressJump() {
    this.jumpPressedAt = performance.now() / 1000;
  }

  /**
   * Wire up the on-screen pad. Pointer capture keeps a button held while your
   * thumb drifts off it, which is most of what makes touch controls bearable.
   */
  bindPad(root) {
    for (const el of root.querySelectorAll('[data-act]')) {
      const act = el.dataset.act;
      const set = (on) => {
        this.pad[act] = on;
        el.classList.toggle('down', on);
        if (on && act === 'jump') this.pressJump();
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* older engines manage without */
        }
        set(true);
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        el.addEventListener(ev, (e) => {
          e.preventDefault();
          set(false);
        });
      }
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  any(codes) {
    return codes.some((c) => this.held.has(c));
  }

  // -1, 0 or 1
  get moveX() {
    const right = this.any(RIGHT) || this.pad.right;
    const left = this.any(LEFT) || this.pad.left;
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  get jumpHeld() {
    return this.any(JUMP) || this.pad.jump;
  }

  get downHeld() {
    return this.any(DOWN) || this.pad.down;
  }

  /** True once per press, within `window` seconds of the press. */
  consumeJump(now, window) {
    if (now - this.jumpPressedAt <= window) {
      this.jumpPressedAt = -Infinity;
      return true;
    }
    return false;
  }
}
