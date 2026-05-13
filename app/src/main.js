import { Viewer } from './viewer.js';
import { Controls } from './controls.js';
import { Pipeline } from './pipeline.js';
import { InputHandler } from './input.js';
import { Compass } from './compass.js';
import { FullscreenManager } from './fullscreen.js';
import { Hotkeys } from './hotkeys.js';
import { CropPadDialog } from './dialogs/cropPad.js';
import { OpenDialog } from './dialogs/open.js';
import { HelpDialog } from './dialogs/help.js';

const root = document.getElementById('app');

const emptyHint = document.createElement('div');
emptyHint.className = 'empty-state';
emptyHint.innerHTML = `
  <div>
    Drop an equirectangular 360 image, paste from clipboard,<br>
    or press <kbd>O</kbd> to open.<br>
    <span style="opacity:0.6; font-size:12px; display:inline-block; margin-top:8px;">
      Press <kbd>?</kbd> for hotkeys.
    </span>
  </div>
`;
root.appendChild(emptyHint);

const dropOverlay = document.createElement('div');
dropOverlay.className = 'drop-overlay';
dropOverlay.textContent = 'Drop 360 image';
document.body.appendChild(dropOverlay);

const helpBadge = document.createElement('div');
helpBadge.className = 'chrome help-badge';
helpBadge.textContent = '?';
helpBadge.setAttribute('title', 'Show hotkeys');
root.appendChild(helpBadge);

const toast = document.createElement('div');
toast.className = 'toast fade';
root.appendChild(toast);
let toastTimer = null;
function showToast(msg, ms = 4000) {
  toast.textContent = msg;
  toast.classList.remove('fade');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('fade'), ms);
}

const viewer = new Viewer(root);
const canvas = viewer.renderer.domElement;

let cropPad = null;
const pipeline = new Pipeline(canvasEl => {
  viewer.setSourceCanvas(canvasEl);
  if (cropPad && cropPad.isOpen()) cropPad.refresh();
});

const input = new InputHandler(pipeline, {
  onLoad: (bitmap) => {
    emptyHint.classList.add('hidden');
    const maxSize = viewer.maxTextureSize;
    if (bitmap.width > maxSize || bitmap.height > maxSize) {
      showToast(`Image ${bitmap.width}×${bitmap.height} exceeds GPU max texture size (${maxSize}). May render distorted.`);
    }
  },
  onError: msg => showToast(msg),
  dropOverlay,
});

new Controls(viewer, canvas);

const openDlg = new OpenDialog({ input, container: root });
cropPad = new CropPadDialog({ pipeline, container: root });
const helpDlg = new HelpDialog({ container: root });

const fs = new FullscreenManager({
  container: root,
  onEnter: () => {
    cropPad?.close();
    openDlg?.close();
    helpDlg?.close();
  },
});

const compass = new Compass(viewer, root);
fs.registerChrome(helpBadge);
fs.registerChrome(compass.el);
fs.bump();

helpBadge.addEventListener('click', () => helpDlg.toggle());

const hotkeys = new Hotkeys();
hotkeys.bind('o', () => openDlg.toggle());
hotkeys.bind('c', () => {
  if (!pipeline.hasImage()) { showToast('Load an image first.'); return; }
  cropPad.toggle();
});
hotkeys.bind('s', async () => {
  if (!pipeline.hasImage()) { showToast('Nothing to save.'); return; }
  const blob = await pipeline.exportPNG();
  if (!blob) { showToast('Export failed.'); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pano-edited-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
hotkeys.bind('f', () => fs.toggle());
hotkeys.bind('escape', () => {
  if (helpDlg.isOpen()) { helpDlg.close(); return; }
  if (cropPad.isOpen()) { cropPad.close(); return; }
  if (openDlg.isOpen()) { openDlg.close(); return; }
  if (fs.isFullscreen()) { fs.exit(); return; }
});
hotkeys.bind('ctrl+z', () => {
  if (pipeline.undo() && cropPad.isOpen()) cropPad.refresh();
});
hotkeys.bind('ctrl+shift+z', () => {
  if (pipeline.redo() && cropPad.isOpen()) cropPad.refresh();
});
hotkeys.bind('shift+/', () => helpDlg.toggle());

function parseInitialURL() {
  const search = window.location.search;
  if (!search || search.length < 2) return null;
  const rest = search.slice(1);
  if (/^https?(:|%3a)/i.test(rest)) {
    try { return decodeURIComponent(rest); } catch { return rest; }
  }
  return new URLSearchParams(search).get('url');
}

const initialURL = parseInitialURL();
if (initialURL) input.loadURL(initialURL);

