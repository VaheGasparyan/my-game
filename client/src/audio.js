// All sound is synthesised with WebAudio — no asset files needed.

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
  }

  /** Call from a user gesture (browsers block audio until then). */
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, len);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  suspend() { this.ctx?.suspend?.(); }
  resume() { this.ctx?.resume?.(); }

  _out(vol, pan) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(this.master);
    } else g.connect(this.master);
    return g;
  }

  _noise(out, dur, freq, type = 'lowpass', q = 0.7, peak = 1) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  _tone(out, f0, f1, dur, type = 'sine', peak = 1, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  shot(kind = 'rifle', vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.01) return;
    const out = this._out(vol * 0.55, pan);
    switch (kind) {
      case 'pistol':
        this._noise(out, 0.11, 2600, 'lowpass', 0.5, 1);
        this._tone(out, 240, 60, 0.09, 'triangle', 0.9);
        break;
      case 'ak47': // heavier, lower crack
        this._noise(out, 0.17, 1350, 'lowpass', 0.7, 1.15);
        this._noise(out, 0.05, 4200, 'highpass', 0.5, 0.3);
        this._tone(out, 130, 38, 0.14, 'square', 0.7);
        break;
      case 'smg':
        this._noise(out, 0.08, 3000, 'lowpass', 0.6, 0.85);
        this._tone(out, 260, 90, 0.06, 'square', 0.35);
        break;
      case 'shotgun':
        this._noise(out, 0.32, 900, 'lowpass', 0.5, 1.5);
        this._noise(out, 0.1, 3000, 'highpass', 0.5, 0.4);
        this._tone(out, 95, 30, 0.26, 'sine', 1.1);
        break;
      case 'launcher': // hollow "thoomp"
        this._tone(out, 210, 55, 0.22, 'sine', 1.3);
        this._noise(out, 0.12, 700, 'lowpass', 0.8, 0.7);
        break;
      case 'sniper':
        this._noise(out, 0.4, 1600, 'lowpass', 0.5, 1.4);
        this._noise(out, 0.08, 6000, 'highpass', 0.5, 0.6);
        this._tone(out, 150, 30, 0.3, 'triangle', 1);
        break;
      default:
        this._noise(out, 0.13, 1900, 'lowpass', 0.6, 1);
        this._noise(out, 0.05, 5200, 'highpass', 0.5, 0.35);
        this._tone(out, 170, 45, 0.1, 'square', 0.5);
    }
  }

  hit(head) {
    if (!this.ctx) return;
    const out = this._out(0.32, 0);
    this._tone(out, head ? 1500 : 980, head ? 1100 : 700, 0.07, 'square', 0.6);
  }

  kill() {
    if (!this.ctx) return;
    const out = this._out(0.3, 0);
    this._tone(out, 660, 660, 0.09, 'triangle', 0.8);
    this._tone(out, 990, 990, 0.16, 'triangle', 0.8, 0.08);
  }

  hurt() {
    if (!this.ctx) return;
    const out = this._out(0.4, 0);
    this._noise(out, 0.12, 500, 'lowpass', 1, 1);
    this._tone(out, 130, 60, 0.12, 'sine', 0.9);
  }

  reload() {
    if (!this.ctx) return;
    const out = this._out(0.3, 0.2);
    this._noise(out, 0.04, 3200, 'bandpass', 3, 1);
    setTimeout(() => this.ctx && this._noise(this._out(0.3, 0.2), 0.05, 1800, 'bandpass', 3, 1), 420);
    setTimeout(() => this.ctx && this._noise(this._out(0.36, 0.2), 0.06, 2600, 'bandpass', 2, 1), 900);
  }

  empty() {
    if (!this.ctx) return;
    this._noise(this._out(0.25, 0), 0.03, 4000, 'bandpass', 4, 1);
  }

  dash() {
    if (!this.ctx) return;
    const out = this._out(0.35, 0);
    this._noise(out, 0.28, 900, 'bandpass', 0.8, 1);
    this._tone(out, 300, 900, 0.2, 'sine', 0.25);
  }

  throw() {
    if (!this.ctx) return;
    this._noise(this._out(0.2, 0), 0.14, 1400, 'bandpass', 1, 1);
  }

  explosion(vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.01) return;
    const out = this._out(vol * 0.9, pan);
    this._noise(out, 0.7, 700, 'lowpass', 0.5, 1);
    this._tone(out, 110, 28, 0.55, 'sine', 1);
  }

  step(vol = 1) {
    if (!this.ctx) return;
    this._noise(this._out(0.1 * vol, 0), 0.06, 320 + Math.random() * 120, 'lowpass', 1, 1);
  }

  ui() {
    if (!this.ctx) return;
    this._tone(this._out(0.15, 0), 720, 900, 0.05, 'square', 0.5);
  }

  horn(win) {
    if (!this.ctx) return;
    const out = this._out(0.3, 0);
    const notes = win ? [523, 659, 784, 1047] : [392, 349, 311, 262];
    notes.forEach((f, i) => this._tone(out, f, f, 0.3, 'triangle', 0.7, i * 0.16));
  }
}

export const sfx = new Sfx();
