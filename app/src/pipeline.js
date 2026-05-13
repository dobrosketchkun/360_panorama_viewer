// Owns the source image, the op-log (committed crop/pad edits), and the working
// canvas. Holds a "live" delta separately from the op-log so the cropPad dialog
// can drag without committing. rebuild() throttled to rAF.

export class Pipeline {
  constructor(onChange) {
    this.original = null;            // ImageBitmap | null
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2;
    this.canvas.height = 1;
    this.ctx = this.canvas.getContext('2d');
    this.opLog = [];                 // committed: Array<{t,b,l,r}> signed px
    this.undone = [];                // redo stack
    this.live = null;                // {t,b,l,r} or null
    this.dirty = false;
    this.onChange = onChange;        // (canvas) => void

    const tick = () => {
      if (this.dirty) {
        this.dirty = false;
        this._rebuild();
        if (this.onChange) this.onChange(this.canvas);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  hasImage() { return this.original !== null; }

  setOriginal(bitmap) {
    if (this.original && this.original.close) this.original.close();
    this.original = bitmap;
    this.opLog = [];
    this.undone = [];
    this.live = null;
    this._rebuild();
    if (this.onChange) this.onChange(this.canvas);
  }

  getAccumulated() {
    let t = 0, b = 0, l = 0, r = 0;
    for (const op of this.opLog) { t += op.t; b += op.b; l += op.l; r += op.r; }
    if (this.live) { t += this.live.t; b += this.live.b; l += this.live.l; r += this.live.r; }
    return { t, b, l, r };
  }

  getCommitted() {
    let t = 0, b = 0, l = 0, r = 0;
    for (const op of this.opLog) { t += op.t; b += op.b; l += op.l; r += op.r; }
    return { t, b, l, r };
  }

  setLive(delta) {
    this.live = { t: delta.t | 0, b: delta.b | 0, l: delta.l | 0, r: delta.r | 0 };
    this.dirty = true;
  }

  commitLive() {
    if (!this.live) return;
    const op = this.live;
    this.live = null;
    if (op.t || op.b || op.l || op.r) {
      this.opLog.push(op);
      this.undone = [];
    }
    this.dirty = true;
  }

  cancelLive() {
    if (this.live) {
      this.live = null;
      this.dirty = true;
    }
  }

  undo() {
    if (this.opLog.length === 0) return false;
    this.undone.push(this.opLog.pop());
    this.dirty = true;
    return true;
  }

  redo() {
    if (this.undone.length === 0) return false;
    this.opLog.push(this.undone.pop());
    this.dirty = true;
    return true;
  }

  getDimensions() {
    return { w: this.canvas.width, h: this.canvas.height };
  }

  getOriginalDimensions() {
    if (!this.original) return { w: 0, h: 0 };
    return { w: this.original.width, h: this.original.height };
  }

  exportPNG() {
    return new Promise(resolve => this.canvas.toBlob(b => resolve(b), 'image/png'));
  }

  _rebuild() {
    if (!this.original) return;
    const { t, b, l, r } = this.getAccumulated();
    const ow = this.original.width;
    const oh = this.original.height;
    const w = Math.max(1, ow - l - r);
    const h = Math.max(1, oh - t - b);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, w, h);

    const cropL = Math.max(0, l), cropT = Math.max(0, t);
    const cropR = Math.max(0, r), cropB = Math.max(0, b);
    const padL = Math.max(0, -l), padT = Math.max(0, -t);
    const sx = cropL;
    const sy = cropT;
    const sw = Math.max(0, ow - cropL - cropR);
    const sh = Math.max(0, oh - cropT - cropB);
    if (sw > 0 && sh > 0) {
      this.ctx.drawImage(this.original, sx, sy, sw, sh, padL, padT, sw, sh);
    }
  }
}
