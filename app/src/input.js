// Always-on global handlers for drag-drop and clipboard paste, plus helpers
// for the open dialog (URL fetch, file picker).

export class InputHandler {
  constructor(pipeline, { onLoad, onError, onWarn, dropOverlay }) {
    this.pipeline = pipeline;
    this.onLoad = onLoad || (() => {});
    this.onError = onError || (() => {});
    // Non-fatal: the panorama loaded but something optional alongside it didn't.
    // Kept separate from onError because the open dialog swaps onError out and
    // clears its error line on success, which would swallow the warning.
    this.onWarn = onWarn || (() => {});
    this.dropOverlay = dropOverlay;
    this._dragCounter = 0;

    window.addEventListener('dragenter', e => this._onDragEnter(e));
    window.addEventListener('dragover', e => this._onDragOver(e));
    window.addEventListener('dragleave', e => this._onDragLeave(e));
    window.addEventListener('drop', e => this._onDrop(e));
    window.addEventListener('paste', e => this._onPaste(e));
  }

  // depthBlob is optional; drop and paste always pass null, so a single image
  // behaves exactly as before.
  async loadBlobs(blob, depthBlob = null) {
    try {
      if (!blob) { this.onError('No data.'); return false; }
      for (const b of [blob, depthBlob]) {
        if (b && b.type && !b.type.startsWith('image/')) {
          this.onError('Not an image: ' + b.type);
          return false;
        }
      }
      const bitmap = await createImageBitmap(blob);
      const depth = depthBlob ? await createImageBitmap(depthBlob) : null;
      this.pipeline.setOriginal(bitmap, depth);
      this.onLoad(bitmap, depth);
      return true;
    } catch (err) {
      this.onError('Decode failed: ' + (err.message || err));
      return false;
    }
  }

  async loadBlob(blob) { return await this.loadBlobs(blob, null); }

  async loadURL(url, depthURL = null) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) { this.onError(`HTTP ${res.status}`); return false; }
      const blob = await res.blob();
      // A failed depth map must not take the panorama down with it — but it
      // does have to be said out loud, or a link that half-loaded just looks
      // like the depth feature is broken.
      let depthBlob = null;
      if (depthURL) {
        try {
          const dres = await fetch(depthURL, { mode: 'cors' });
          if (dres.ok) depthBlob = await dres.blob();
          else this.onWarn(`Depth map failed: HTTP ${dres.status}. Loaded panorama only.`);
        } catch (err) {
          this.onWarn('Depth map fetch failed (likely CORS). Loaded panorama only.');
        }
      }
      return await this.loadBlobs(blob, depthBlob);
    } catch (err) {
      this.onError('Fetch failed (likely CORS): ' + (err.message || err));
      return false;
    }
  }

  async loadFile(file) { return await this.loadBlob(file); }

  // Returns the picked File objects without loading them — the caller decides
  // which is the panorama and which is the depth map, and may want to swap.
  pickFiles(multiple = false) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = multiple;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const files = input.files ? Array.from(input.files) : [];
        document.body.removeChild(input);
        resolve(files);
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
