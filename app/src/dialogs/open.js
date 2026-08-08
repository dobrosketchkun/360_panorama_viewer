import { Dialog } from '../dialog.js';
import { parsePair } from '../panospec.js';

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
        <input type="text" placeholder="Image URL… (append &d=<depth-url> for depth)" />
        <button class="load" type="button">Load</button>
      </div>
      <div class="row">
        <button class="pick-color" type="button">Panorama…</button>
        <span class="hint name-color">none</span>
      </div>
      <div class="row">
        <button class="pick-depth" type="button">Depth map…</button>
        <span class="hint name-depth">none</span>
        <button class="clear-depth" type="button" style="display:none;">Clear</button>
      </div>
      <div class="row hint">…or drop / paste a panorama anywhere on the page.</div>
      <div class="error"></div>
    `;
    this.dialog.setContent(body);

    this.urlInput = body.querySelector('input');
    this.errorEl = body.querySelector('.error');
    this.nameColor = body.querySelector('.name-color');
    this.nameDepth = body.querySelector('.name-depth');
    this.clearDepthBtn = body.querySelector('.clear-depth');
    // Two explicit slots rather than one multi-select: which file is which is
    // then unambiguous, and it doesn't depend on picker ordering.
    this.colorFile = null;
    this.depthFile = null;

    body.querySelector('.load').addEventListener('click', () => this._submitURL());
    body.querySelector('.pick-color').addEventListener('click', () => this._pickSlot('color'));
    body.querySelector('.pick-depth').addEventListener('click', () => this._pickSlot('depth'));
    this.clearDepthBtn.addEventListener('click', () => {
      this.depthFile = null;
      this._apply();
    });
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
    // Same notation as the direct link, so one form works in both places.
    const spec = parsePair(this.urlInput.value);
    if (!spec) return;
    this.errorEl.textContent = 'Loading…';
    const orig = this.input.onError;
    this.input.onError = msg => { this.errorEl.textContent = msg; };
    const ok = await this.input.loadURL(spec.url, spec.depth);
    this.input.onError = orig;
    if (ok) {
      this.errorEl.textContent = '';
      this.close();
    }
  }

  async _pickSlot(slot) {
    this.errorEl.textContent = '';
    const files = await this.input.pickFiles(false);
    if (!files.length) return;
    if (slot === 'color') this.colorFile = files[0];
    else this.depthFile = files[0];
    await this._apply();
  }

  async _apply() {
    this.nameColor.textContent = this.colorFile ? this.colorFile.name : 'none';
    this.nameDepth.textContent = this.depthFile ? this.depthFile.name : 'none';
    this.clearDepthBtn.style.display = this.depthFile ? '' : 'none';
    if (!this.colorFile) {
      this.errorEl.textContent = 'Pick a panorama first.';
      return;
    }
    this.errorEl.textContent = 'Loading…';
    const orig = this.input.onError;
    this.input.onError = msg => { this.errorEl.textContent = msg; };
    // Reloads both together: the depth map has to enter the pipeline alongside
    // the colour it belongs to, not be bolted on after.
    const ok = await this.input.loadBlobs(this.colorFile, this.depthFile);
    this.input.onError = orig;
    if (ok) this.errorEl.textContent = '';
  }
}
