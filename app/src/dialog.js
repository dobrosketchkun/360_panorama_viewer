// Floating draggable popup primitive. Dialogs are appended to the viewer's
// container so they survive a fullscreen request on that element (though by
// product policy main.js closes them on enter-fullscreen anyway).

export class Dialog {
  constructor({ title, className = '', onClose }) {
    this.el = document.createElement('div');
    this.el.className = 'dialog ' + className;
    this.el.innerHTML = `
      <div class="dialog-header">
        <span class="title"></span>
        <span class="close" role="button" aria-label="Close">×</span>
      </div>
      <div class="dialog-body"></div>
    `;
    this.titleEl = this.el.querySelector('.title');
    this.bodyEl = this.el.querySelector('.dialog-body');
    this.headerEl = this.el.querySelector('.dialog-header');
    this.closeBtn = this.el.querySelector('.close');
    this.titleEl.textContent = title || '';

    this.onClose = onClose || (() => {});
    this.closeBtn.addEventListener('click', () => this.close());

    this._dragging = false;
    this._dragStart = null;
    this.headerEl.addEventListener('pointerdown', e => this._onDragStart(e));
    this._onMove = e => this._onDragMove(e);
    this._onUp = e => this._onDragEnd(e);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
  }

  setContent(node) {
    this.bodyEl.innerHTML = '';
    if (node) this.bodyEl.appendChild(node);
  }

  mount(parent, x = 24, y = 24) {
    parent.appendChild(this.el);
    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
  }

  close() {
    if (!this.el.parentNode) return;
    this.el.parentNode.removeChild(this.el);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    this.onClose();
  }

  _onDragStart(e) {
    if (e.target === this.closeBtn) return;
    this._dragging = true;
    const rect = this.el.getBoundingClientRect();
    this._dragStart = { px: e.clientX, py: e.clientY, x: rect.left, y: rect.top };
    if (this.headerEl.setPointerCapture) {
      try { this.headerEl.setPointerCapture(e.pointerId); } catch {}
    }
  }
  _onDragMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._dragStart.px;
    const dy = e.clientY - this._dragStart.py;
    this.el.style.left = (this._dragStart.x + dx) + 'px';
    this.el.style.top = (this._dragStart.y + dy) + 'px';
  }
  _onDragEnd() { this._dragging = false; }
}
