// Translates pointer / wheel / keys into yaw / pitch / fov changes on the viewer.
// Touch comes through as pointer events too: 1 active pointer = drag rotate,
// 2 active pointers = pinch FOV.

export class Controls {
  constructor(viewer, canvas) {
    this.viewer = viewer;
    this.canvas = canvas;
    this.pointers = new Map();
    this.lastPinchDist = 0;
    this.keys = new Set();
    this._lastFrame = performance.now();

    canvas.addEventListener('pointerdown', e => this._onDown(e));
    canvas.addEventListener('pointermove', e => this._onMove(e));
    canvas.addEventListener('pointerup', e => this._onUp(e));
    canvas.addEventListener('pointercancel', e => this._onUp(e));
    canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', e => this._onKeyDown(e));
    window.addEventListener('keyup', e => this._onKeyUp(e));
    window.addEventListener('blur', () => this.keys.clear());

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this._lastFrame) / 1000);
      this._lastFrame = now;
      this._applyKeys(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _sensitivity() { return Math.max(0.1, this.viewer.fov / 75); }

  _onDown(e) {
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.lastPinchDist = Math.hypot(b.x - a.x, b.y - a.y);
    }
  }

  _onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 1) {
      const scale = (Math.PI / 180) * this._sensitivity() * 0.25;
      this.viewer.rotate(dx * scale, dy * scale);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const delta = dist - this.lastPinchDist;
      this.viewer.zoomFov(-delta * 0.15);
      this.lastPinchDist = dist;
    }
  }

  _onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.lastPinchDist = 0;
  }

  _onWheel(e) {
    e.preventDefault();
    this.viewer.zoomFov(e.deltaY > 0 ? 3 : -3);
  }

  _isTextInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  _onKeyDown(e) {
    if (this._isTextInputFocused()) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      this.keys.add(e.key);
      e.preventDefault();
    }
  }

  _onKeyUp(e) { this.keys.delete(e.key); }

  _applyKeys(dt) {
    if (this.keys.size === 0) return;
    const speed = (Math.PI / 180) * 60 * this._sensitivity();
    let dyaw = 0, dpitch = 0;
    if (this.keys.has('ArrowLeft')) dyaw += speed * dt;
    if (this.keys.has('ArrowRight')) dyaw -= speed * dt;
    if (this.keys.has('ArrowUp')) dpitch += speed * dt;
    if (this.keys.has('ArrowDown')) dpitch -= speed * dt;
    if (dyaw || dpitch) this.viewer.rotate(dyaw, dpitch);
  }
}
