// Owns the source image, the op-log (committed crop/pad edits), and the working
// canvas. Holds a "live" delta separately from the op-log so the cropPad dialog
// can drag without committing. rebuild() throttled to rAF.
//
// An optional depth map rides through the same op-log. It keeps its own (often
// lower) resolution and the crop/pad rect is scaled into it proportionally —
// what has to stay aligned is UV space, not pixels. If the two ever desynced,
// the displaced mesh would tear against the colour it's textured with.

import { prepareDepth } from './depthprep.js';

export class Pipeline {
  constructor(onChange) {
    this.original = null;            // ImageBitmap | null
    this.depthSource = null;         // HTMLCanvasElement | null, conditioned
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2;
    this.canvas.height = 1;
    this.ctx = this.canvas.getContext('2d');
    this.depthCanvas = document.createElement('canvas');
    this.depthCanvas.width = 2;
    this.depthCanvas.height = 1;
    this.depthCtx = this.depthCanvas.getContext('2d');
    this.opLog = [];                 // committed: Array<{t,b,l,r}> signed px
    this.undone = [];                // redo stack
    this.live = null;                // {t,b,l,r} or null
    this.dirty = false;
    this.onChange = onChange;        // (canvas, depthCanvas|null) => void

    const tick = () => {
      if (this.dirty) {
        this.dirty = false;
        this._rebuild();
        this._emit();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  hasImage() { return this.original !== null; }

  hasDepth() { return this.depthSource !== null; }

  _emit() {
    if (this.onChange) this.onChange(this.canvas, this.depthSource ? this.depthCanvas : null);
  }

  setOriginal(bitmap, depthBitmap = null) {
    if (this.original && this.original.close) this.original.close();
    this.original = bitmap;
    this.depthSource = depthBitmap ? prepareDepth(depthBitmap) : null;
    if (depthBitmap && depthBitmap.close) depthBitmap.close();
    this.opLog = [];
    this.undone = [];
    this.live = null;
    this._rebuild();
    this._emit();
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

    const cropL = Math.max(0, l), cropT = Math.max(0, t);
    const cropR = Math.max(0, r), cropB = Math.max(0, b);
    const padL = Math.max(0, -l), padT = Math.max(0, -t);
    const padR = Math.max(0, -r), padB = Math.max(0, -b);
    const rect = { cropL, cropT, cropR, cropB, padL, padT, padR, padB };

    this._blit(this.ctx, this.canvas, this.original, ow, oh, rect, 1, 1);
    if (this.depthSource) {
      this._blit(
        this.depthCtx, this.depthCanvas, this.depthSource, ow, oh, rect,
        this.depthSource.width / ow, this.depthSource.height / oh,
      );
    }
  }

  // kx/ky map the colour image's pixel grid onto the source's own, so the same
  // crop/pad lands on the same place in UV space regardless of resolution.
  _blit(ctx, canvas, source, ow, oh, rect, kx, ky) {
    const w = Math.max(1, Math.round((ow - rect.cropL - rect.cropR + rect.padL + rect.padR) * kx));
    const h = Math.max(1, Math.round((oh - rect.cropT - rect.cropB + rect.padT + rect.padB) * ky));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const sx = rect.cropL * kx;
    const sy = rect.cropT * ky;
    const sw = Math.max(0, (ow - rect.cropL - rect.cropR) * kx);
    const sh = Math.max(0, (oh - rect.cropT - rect.cropB) * ky);
    if (sw > 0 && sh > 0) {
      ctx.drawImage(source, sx, sy, sw, sh, rect.padL * kx, rect.padT * ky, sw, sh);
    }
  }
}
