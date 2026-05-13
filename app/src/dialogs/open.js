import { Dialog } from '../dialog.js';

export class OpenDialog {
  constructor({ input, container }) {
    this.input = input;
    this.container = container;
    this._mounted = false;

    this.dialog = new Dialog({
      title: 'Open Panorama',
      className: 'open-dialog',
      onClose: () => { this._mounted = false; },
    });

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="row">
        <input type="text" placeholder="Paste an image URL…" />
        <button class="load" type="button">Load</button>
      </div>
      <div class="row">
        <button class="pick" type="button">Choose file…</button>
        <span class="hint">…or drop / paste anywhere on the page.</span>
      </div>
      <div class="error"></div>
    `;
    this.dialog.setContent(body);

    this.urlInput = body.querySelector('input');
    this.errorEl = body.querySelector('.error');

    body.querySelector('.load').addEventListener('click', () => this._submitURL());
    body.querySelector('.pick').addEventListener('click', () => this._pickFile());
    this.urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._submitURL(); }
    });
  }

  isOpen() { return this._mounted; }

  open(x = 24, y = 60) {
    if (this._mounted) return;
    this.errorEl.textContent = '';
    this.dialog.mount(this.container, x, y);
    this._mounted = true;
    setTimeout(() => this.urlInput.focus(), 0);
  }

  close() {
    if (!this._mounted) return;
    this.dialog.close();
    this._mounted = false;
  }

  toggle() { if (this._mounted) this.close(); else this.open(); }

  async _submitURL() {
    const url = this.urlInput.value.trim();
    if (!url) return;
    this.errorEl.textContent = 'Loading…';
    const orig = this.input.onError;
    this.input.onError = msg => { this.errorEl.textContent = msg; };
    const ok = await this.input.loadURL(url);
    this.input.onError = orig;
    if (ok) {
      this.errorEl.textContent = '';
      this.close();
    }
  }

  async _pickFile() {
    this.errorEl.textContent = '';
    const orig = this.input.onError;
    this.input.onError = msg => { this.errorEl.textContent = msg; };
    const ok = await this.input.pickFile();
    this.input.onError = orig;
    if (ok) this.close();
  }
}
