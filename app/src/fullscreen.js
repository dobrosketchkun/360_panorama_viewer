// Fullscreen toggle + shared idle-hide controller for all chrome elements
// (compass, exit-fullscreen button, help badge).

export class FullscreenManager {
  constructor({ container, onEnter, onExit, idleMs = 2000 }) {
    this.container = container;
    this.onEnter = onEnter || (() => {});
    this.onExit = onExit || (() => {});
    this.idleMs = idleMs;
    this._timer = null;
    this.chromeElements = [];

    this.exitBtn = document.createElement('div');
    this.exitBtn.className = 'chrome exit-fs';
    this.exitBtn.textContent = '⤢';
    this.exitBtn.setAttribute('title', 'Exit fullscreen (Esc)');
    this.exitBtn.addEventListener('click', () => this.exit());
    container.appendChild(this.exitBtn);
    this.chromeElements.push(this.exitBtn);

    document.addEventListener('fullscreenchange', () => this._onChange());
    document.addEventListener('webkitfullscreenchange', () => this._onChange());

    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => {
      window.addEventListener(ev, () => this.bump(), { passive: true });
    });

    this.bump();
  }

  registerChrome(el) {
    this.chromeElements.push(el);
  }

  isFullscreen() {
    return document.fullscreenElement === this.container ||
           document.webkitFullscreenElement === this.container;
  }

  async enter() {
    if (this.isFullscreen()) return;
    try {
      if (this.container.requestFullscreen) await this.container.requestFullscreen();
      else if (this.container.webkitRequestFullscreen) await this.container.webkitRequestFullscreen();
    } catch {}
  }

  async exit() {
    if (!this.isFullscreen()) return;
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    } catch {}
  }

  async toggle() {
    if (this.isFullscreen()) await this.exit();
    else await this.enter();
  }

  _onChange() {
    if (this.isFullscreen()) {
      this.exitBtn.classList.add('visible');
      this.onEnter();
    } else {
      this.exitBtn.classList.remove('visible');
      this.onExit();
    }
    this.bump();
  }

  bump() {
    for (const el of this.chromeElements) el.classList.remove('hidden');
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      for (const el of this.chromeElements) el.classList.add('hidden');
    }, this.idleMs);
  }
}
