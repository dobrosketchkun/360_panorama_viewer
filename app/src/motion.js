// WASD / QE translate the eye inside a small sphere around the panorama centre.
// Only active while a depth map is loaded — without displacement, translating a
// camera inside a plain sphere changes nothing.
//
// Keys drive a *target* offset, the eye springs toward it, and the target
// decays back to centre when nothing is held. That makes it read as leaning
// rather than walking: the budget is a few percent of the nearest surface, so a
// walk metaphor would hit an invisible wall within half a second, while an
// elastic lean is self-limiting and always returns to a pose known to look
// right. It also happens to be the better way to judge a depth map — a static
// offset just looks like an odd photo, it's the motion that shows the parallax.

const RETURN_TAU = 0.55;  // s, target decay back to centre
const FOLLOW_TAU = 0.12;  // s, eye lag behind target
const CROSS_TIME = 0.8;   // s to travel the full limit laterally
const FWD_GAIN = 0.5;     // forward opens disocclusions all around the periphery
const FINE = 0.3;         // shift means precision here, not speed — the range is tiny

const CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'];

export class Motion {
  constructor(viewer) {
    this.viewer = viewer;
    this.keys = new Set();
    this.shift = false;
    this.tx = 0; this.ty = 0; this.tz = 0;
    this.px = 0; this.py = 0; this.pz = 0;
    this._last = performance.now();

    window.addEventListener('keydown', e => this._onKey(e, true));
    window.addEventListener('keyup', e => this._onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this._last) / 1000);
      this._last = now;
      this._step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  isActive() { return this.viewer.hasDepth(); }

  _onKey(e, down) {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    this.shift = e.shiftKey;
    if (!CODES.includes(e.code)) return;
    if (!this.isActive()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    e.preventDefault();
  }

  _step(dt) {
    if (!this.isActive()) {
      if (this.keys.size) this.keys.clear();
      if (this.tx || this.ty || this.tz || this.px || this.py || this.pz) {
        this.tx = this.ty = this.tz = this.px = this.py = this.pz = 0;
        this.viewer.setEyeOffset(0, 0, 0);
      }
      return;
    }

    const limit = this.viewer.eyeLimit();
    const yaw = this.viewer.yaw;
    const sinY = Math.sin(yaw), cosY = Math.cos(yaw);

    let f = 0, s = 0, u = 0;
    if (this.keys.has('KeyW')) f += 1;
    if (this.keys.has('KeyS')) f -= 1;
    if (this.keys.has('KeyD')) s += 1;
    if (this.keys.has('KeyA')) s -= 1;
    if (this.keys.has('KeyE')) u += 1;
    if (this.keys.has('KeyQ')) u -= 1;

    if (f || s || u) {
      // camera-relative but yaw-only: W walks where you're looking, not where
      // you're tilted, which stays predictable when you're pitched at the sky.
      const speed = (limit / CROSS_TIME) * (this.shift ? FINE : 1);
      this.tx += (-sinY * f * FWD_GAIN + cosY * s) * speed * dt;
      this.tz += (-cosY * f * FWD_GAIN - sinY * s) * speed * dt;
      this.ty += u * speed * dt;
      const len = Math.hypot(this.tx, this.ty, this.tz);
      if (len > limit) {
        const k = limit / len;
        this.tx *= k; this.ty *= k; this.tz *= k;
      }
    } else {
      const decay = Math.exp(-dt / RETURN_TAU);
      this.tx *= decay; this.ty *= decay; this.tz *= decay;
    }

    const a = 1 - Math.exp(-dt / FOLLOW_TAU);
    this.px += (this.tx - this.px) * a;
    this.py += (this.ty - this.py) * a;
    this.pz += (this.tz - this.pz) * a;
    this.viewer.setEyeOffset(this.px, this.py, this.pz);
  }
}
