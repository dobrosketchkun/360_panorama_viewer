// Always-on global handlers for drag-drop and clipboard paste, plus helpers
// for the open dialog (URL fetch, file picker).

export class InputHandler {
  constructor(pipeline, { onLoad, onError, dropOverlay }) {
    this.pipeline = pipeline;
    this.onLoad = onLoad || (() => {});
    this.onError = onError || (() => {});
    this.dropOverlay = dropOverlay;
    this._dragCounter = 0;

    window.addEventListener('dragenter', e => this._onDragEnter(e));
    window.addEventListener('dragover', e => this._onDragOver(e));
    window.addEventListener('dragleave', e => this._onDragLeave(e));
    window.addEventListener('drop', e => this._onDrop(e));
    window.addEventListener('paste', e => this._onPaste(e));
  }

  async loadBlob(blob) {
    try {
      if (!blob) { this.onError('No data.'); return false; }
      if (blob.type && !blob.type.startsWith('image/')) {
        this.onError('Not an image: ' + blob.type);
        return false;
      }
      const bitmap = await createImageBitmap(blob);
      this.pipeline.setOriginal(bitmap);
      this.onLoad(bitmap);
      return true;
    } catch (err) {
      this.onError('Decode failed: ' + (err.message || err));
      return false;
    }
  }

  async loadURL(url) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) { this.onError(`HTTP ${res.status}`); return false; }
      const blob = await res.blob();
      return await this.loadBlob(blob);
    } catch (err) {
      this.onError('Fetch failed (likely CORS): ' + (err.message || err));
      return false;
    }
  }

  async loadFile(file) { return await this.loadBlob(file); }

  pickFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0];
        document.body.removeChild(input);
        if (f) {
          const ok = await this.loadFile(f);
          resolve(ok);
        } else {
          resolve(false);
        }
      });
      input.click();
    });
  }

  _hasFiles(e) {
    return !!(e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files'));
  }

  _onDragEnter(e) {
    if (!this._hasFiles(e)) return;
    e.preventDefault();
    this._dragCounter++;
    if (this.dropOverlay) this.dropOverlay.classList.add('active');
  }
  _onDragOver(e) { if (this._hasFiles(e)) e.preventDefault(); }
  _onDragLeave(e) {
    if (!this._hasFiles(e)) return;
    this._dragCounter--;
    if (this._dragCounter <= 0) {
      this._dragCounter = 0;
      if (this.dropOverlay) this.dropOverlay.classList.remove('active');
    }
  }
  _onDrop(e) {
    if (!this._hasFiles(e)) return;
    e.preventDefault();
    this._dragCounter = 0;
    if (this.dropOverlay) this.dropOverlay.classList.remove('active');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) this.loadFile(file);
  }

  _onPaste(e) {
    const el = document.activeElement;
    const inText = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    if (inText) return;
    if (!e.clipboardData) return;
    for (const item of e.clipboardData.items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { this.loadFile(file); return; }
      }
    }
  }
}
