// Crop/Pad dialog — one slider per edge. Negative = pad with black, positive
// = crop pixels. Custom slider so we can implement Ctrl-fine sensitivity:
// when Ctrl is held mid-drag, 1px of pointer movement = 1px of image change
// (instead of span/trackW). The 3D preview is the live feedback.

import { Dialog } from '../dialog.js';

class FineSlider {
  constructor({ onInput, onChange }) {
    this.min = -1000;
    this.max = 1000;
    this.value = 0;
    this.onInput = onInput;
    this.onChange = onChange;
    this._dragging = false;
    this._fineActive = false;
    this._dragStartX = 0;
    this._dragStartValue = 0;
    this._activePointer = null;

    this.el = document.createElement('div');
    this.el.className = 'slider';
    this.el.innerHTML = `
      <div class="track"><div class="zero-mark"></div></div>
      <div class="thumb"></div>
    `;
    this.track = this.el.querySelector('.track');
    this.thumb = this.el.querySelector('.thumb');

    this.el.addEventListener('pointerdown', e => this._onDown(e));
    this._onMove = e => this._handleMove(e);
    this._onUp = e => this._handleUp(e);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  }

  setRange(min, max) {
    this.min = min;
    this.max = max;
    this.value = Math.max(min, Math.min(max, this.value));
    this._updateThumb();
  }

  setValue(v) {
    if (this._dragging) return;
    v = Math.max(this.min, Math.min(this.max, Math.round(v)));
    this.value = v;
    this._updateThumb();
  }

  _trackW() { return this.track.getBoundingClientRect().width; }

  _valueToPos(v) {
    const span = this.max - this.min;
    if (span <= 0) return 0;
    return ((v - this.min) / span) * this._trackW();
  }

  _updateThumb() {
    this.thumb.style.left = this._valueToPos(this.value) + 'px';
    this.el.classList.toggle('fine', this._fineActive && this._dragging);
  }

  _onDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    this._dragging = true;
    this._activePointer = e.pointerId;
    this._fineActive = e.ctrlKey || e.metaKey;
    try { this.el.setPointerCapture(e.pointerId); } catch {}

    if (!this._fineActive) {
      // Click on track jumps to that position (only in coarse mode — fine
      // mode is for tweaking around the current value, so don't jump).
      const rect = this.track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const v = Math.round(this.min + (this.max - this.min) * ratio);
      if (v !== this.value) {
        this.value = v;
        if (this.onInput) this.onInput(this.value);
      }
    }
    this._dragStartX = e.clientX;
    this._dragStartValue = this.value;
    this._updateThumb();
  }

  _handleMove(e) {
    if (!this._dragging || this._activePointer !== e.pointerId) return;
    const fine = e.ctrlKey || e.metaKey;
    if (fine !== this._fineActive) {
      this._fineActive = fine;
      this._dragStartX = e.clientX;
      this._dragStartValue = this.value;
    }
    const dx = e.clientX - this._dragStartX;
    const span = this.max - this.min;
    const trackW = this._trackW();
    const delta = this._fineActive
      ? Math.round(dx)
      : (trackW > 0 ? Math.round((dx / trackW) * span) : 0);
    let v = this._dragStartValue + delta;
    v = Math.max(this.min, Math.min(this.max, v));
    if (v !== this.value) {
      this.value = v;
      if (this.onInput) this.onInput(this.value);
    }
    this._updateThumb();
  }

  _handleUp(e) {
    if (!this._dragging || this._activePointer !== e.pointerId) return;
    this._dragging = false;
    this._fineActive = false;
    this._activePointer = null;
    this._updateThumb();
    if (this.onChange) this.onChange(this.value);
  }
}

const EDGES = [
  { key: 't', name: 'Top' },
  { key: 'b', name: 'Bottom' },
  { key: 'l', name: 'Left' },
  { key: 'r', name: 'Right' },
];

export class CropPadDialog {
  constructor({ pipeline, container }) {
    this.pipeline = pipeline;
    this.container = container;
    this._mounted = false;
    this._draggingEdge = null;
    this._dragStartCommitted = 0;

    this.dialog = new Dialog({
      title: 'Crop / Pad',
      className: 'croppad',
      onClose: () => { this._mounted = false; this._draggingEdge = null; },
    });

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="legend"><span>← pad</span><span>crop →</span></div>
      ${EDGES.map(e => `
        <div class="row" data-edge="${e.key}">
          <span class="name">${e.name}</span>
          <div class="slider-wrap"></div>
          <span class="value" title="Click to reset this edge">0</span>
          <button class="reset" type="button" title="Reset">↺</button>
        </div>
      `).join('')}
      <div class="actions">
        <button class="reset-all" type="button">Reset all</button>
        <span class="info">—</span>
      </div>
    `;
    this.dialog.setContent(body);
    this.body = body;

    this.rows = {};
    for (const e of EDGES) {
      const row = body.querySelector(`.row[data-edge="${e.key}"]`);
      const slider = new FineSlider({
        onInput: v => this._onSliderInput(e.key, v),
        onChange: () => this._onSliderChange(e.key),
      });
      row.querySelector('.slider-wrap').appendChild(slider.el);
      this.rows[e.key] = {
        slider,
        value: row.querySelector('.value'),
        reset: row.querySelector('.reset'),
      };
      this.rows[e.key].value.addEventListener('click', () => this._resetEdge(e.key));
      this.rows[e.key].reset.addEventListener('click', () => this._resetEdge(e.key));
    }

    body.querySelector('.reset-all').addEventListener('click', () => this._resetAll());
    this.info = body.querySelector('.info');
  }

  isOpen() { return this._mounted; }

  open(x = 24, y = 60) {
    if (this._mounted) return;
    this.dialog.mount(this.container, x, y);
    this._mounted = true;
    this._updateUI();
  }

  close() {
    if (!this._mounted) return;
    this.dialog.close();
    this._mounted = false;
    this._draggingEdge = null;
  }

  toggle() { if (this._mounted) this.close(); else this.open(); }

  refresh() {
    if (!this._mounted) return;
    if (!this._draggingEdge) this._updateUI();
    else this._updateInfo();
  }

  _onSliderInput(edge, newVal) {
    if (!this.pipeline.hasImage()) return;
    if (this._draggingEdge !== edge) {
      const committed = this.pipeline.getCommitted();
      this._draggingEdge = edge;
      this._dragStartCommitted = committed[edge];
    }
    const delta = { t: 0, b: 0, l: 0, r: 0 };
    delta[edge] = newVal - this._dragStartCommitted;
    this.pipeline.setLive(delta);
    this._updateValues();
    this._updateInfo();
  }

  _onSliderChange(edge) {
    if (this._draggingEdge !== edge) return;
    this.pipeline.commitLive();
    this._draggingEdge = null;
    this._updateUI();
  }

  _resetEdge(edge) {
    if (!this.pipeline.hasImage()) return;
    const c = this.pipeline.getCommitted();
    if (!c[edge]) return;
    const delta = { t: 0, b: 0, l: 0, r: 0 };
    delta[edge] = -c[edge];
    this.pipeline.setLive(delta);
    this.pipeline.commitLive();
    this._updateUI();
  }

  _resetAll() {
    if (!this.pipeline.hasImage()) return;
    const c = this.pipeline.getCommitted();
    if (!c.t && !c.b && !c.l && !c.r) return;
    this.pipeline.setLive({ t: -c.t, b: -c.b, l: -c.l, r: -c.r });
    this.pipeline.commitLive();
    this._updateUI();
  }

  _setSliderRanges() {
    const { w, h } = this.pipeline.getOriginalDimensions();
    if (!w || !h) return;
    this.rows.t.slider.setRange(-h, h - 1);
    this.rows.b.slider.setRange(-h, h - 1);
    this.rows.l.slider.setRange(-w, w - 1);
    this.rows.r.slider.setRange(-w, w - 1);
  }

  _fmt(v) { return v === 0 ? '0' : (v > 0 ? `+${v}` : `${v}`); }

  _updateValues() {
    const cum = this.pipeline.getAccumulated();
    for (const k of ['t', 'b', 'l', 'r']) {
      this.rows[k].slider.setValue(cum[k]);
      this.rows[k].value.textContent = this._fmt(cum[k]);
    }
  }

  _updateInfo() {
    const cum = this.pipeline.getAccumulated();
    const { w, h } = this.pipeline.getOriginalDimensions();
    if (w && h) {
      const cw = Math.max(1, w - cum.l - cum.r);
      const ch = Math.max(1, h - cum.t - cum.b);
      this.info.textContent = `${w}×${h} → ${cw}×${ch}`;
    } else {
      this.info.textContent = 'No image';
    }
  }

  _updateUI() {
    if (!this._mounted) return;
    this._setSliderRanges();
    this._updateValues();
    this._updateInfo();
  }
}
