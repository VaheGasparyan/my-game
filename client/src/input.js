// Keyboard + mouse state with pointer-lock handling.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys that went down since the last endFrame()
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.buttons = [false, false, false];
    this.wheel = 0;
    this.locked = false;
    this.onLockChange = null;

    addEventListener('keydown', (e) => {
      if (this.locked && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
      if (e.code === 'Tab' && !this.isTyping(e)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.reset());

    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // some browsers report a huge bogus delta right after locking
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    addEventListener('mousedown', (e) => { if (this.locked) this.buttons[e.button] = true; });
    addEventListener('mouseup', (e) => { this.buttons[e.button] = false; });
    addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.reset();
      this.onLockChange?.(this.locked);
    });
  }

  isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  }

  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.buttons = [false, false, false];
    this.mouseDX = this.mouseDY = 0;
    this.wheel = 0;
  }

  /** Must be called from a user gesture. Resolves false if the browser refused the lock. */
  async lock() {
    if (this.locked) return true;
    try {
      await this.canvas.requestPointerLock();
      return true;
    } catch {
      return false; // e.g. the ~1 s cooldown after pressing Esc
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = this.mouseDY = 0;
    this.wheel = 0;
  }
}
