import { Dialog } from '../dialog.js';

export class HelpDialog {
  constructor({ container }) {
    this.container = container;
    this._mounted = false;

    this.dialog = new Dialog({
      title: 'Hotkeys',
      className: 'help-dialog',
      onClose: () => { this._mounted = false; },
    });

    const body = document.createElement('div');
    body.innerHTML = `
      <table>
        <tr><td><kbd>O</kbd></td><td>Open dialog (URL / file)</td></tr>
        <tr><td><kbd>C</kbd></td><td>Crop / Pad</td></tr>
        <tr><td><kbd>S</kbd></td><td>Save current view as PNG</td></tr>
        <tr><td><kbd>F</kbd></td><td>Toggle fullscreen</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Close dialog / exit fullscreen</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Undo crop/pad</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Redo</td></tr>
        <tr><td><kbd>?</kbd></td><td>Show this help</td></tr>
        <tr><td colspan="2" style="padding-top:8px; opacity:0.7;">Hold <kbd>Ctrl</kbd> while dragging a crop/pad slider for fine (1px per pointer pixel) control.</td></tr>
        <tr><td colspan="2" style="opacity:0.7;">Drop, paste, or pick to load an image — anywhere, anytime.</td></tr>
        <tr><td colspan="2" style="opacity:0.7;">Drag / arrows / wheel to look around.</td></tr>
      </table>
    `;
    this.dialog.setContent(body);
  }

  isOpen() { return this._mounted; }

  open(x = 24, y = 60) {
    if (this._mounted) return;
    this.dialog.mount(this.container, x, y);
    this._mounted = true;
  }

  close() {
    if (!this._mounted) return;
    this.dialog.close();
    this._mounted = false;
  }

  toggle() { if (this._mounted) this.close(); else this.open(); }
}
