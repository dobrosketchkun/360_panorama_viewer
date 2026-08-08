import { Viewer } from './viewer.js';
import { Controls } from './controls.js';
import { Pipeline } from './pipeline.js';
import { InputHandler } from './input.js';
import { Compass } from './compass.js';
import { FullscreenManager } from './fullscreen.js';
import { Hotkeys } from './hotkeys.js';
import { AutoRotate } from './autorotate.js';
import { Motion } from './motion.js';
import { parseQuery } from './panospec.js';
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
function showToast(msg, ms = 4000, kind = 'warning') {
  toast.textContent = msg;
  toast.classList.toggle('info', kind === 'info');
  toast.classList.remove('fade');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('fade'), ms);
}

function showAutoRotateToast() {
  showToast(autoRotate.statusLabel(), 900, 'info');
}

const viewer = new Viewer(root);
const canvas = viewer.renderer.domElement;
const autoRotate = new AutoRotate(viewer);

let cropPad = null;
const pipeline = new Pipeline((canvasEl, depthEl) => {
  viewer.setSourceCanvas(canvasEl);
  viewer.setDepthCanvas(depthEl);
  if (cropPad && cropPad.isOpen()) cropPad.refresh();
});

const motion = new Motion(viewer);

const input = new InputHandler(pipeline, {
  onLoad: (bitmap, depth) => {
    emptyHint.classList.add('hidden');
    const maxSize = viewer.maxTextureSize;
    if (bitmap.width > maxSize || bitmap.height > maxSize) {
      showToast(`Image ${bitmap.width}×${bitmap.height} exceeds GPU max texture size (${maxSize}). May render distorted.`);
    }
    if (depth) showToast('Depth loaded — WASD / QE to move, [ ] for depth strength.', 5000, 'info');
  },
  onError: msg => showToast(msg),
  onWarn: msg => showToast(msg),
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
// Alt+S, not S: plain S is strafe-back once a depth map is loaded.
hotkeys.bind('alt+s', async () => {
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
hotkeys.bind('r', () => {
  autoRotate.toggle();
  showAutoRotateToast();
});
hotkeys.bind('+', () => {
  if (!autoRotate.enabled) { showToast('Auto-rotate is off. Press R to start.', 900, 'info'); return; }
  autoRotate.increaseSpeed();
  showAutoRotateToast();
});
hotkeys.bind('-', () => {
  if (!autoRotate.enabled) { showToast('Auto-rotate is off. Press R to start.', 900, 'info'); return; }
  autoRotate.decreaseSpeed();
  showAutoRotateToast();
});
hotkeys.bind('alt++', () => {
  if (!autoRotate.enabled) { showToast('Auto-rotate is off. Press R to start.', 900, 'info'); return; }
  autoRotate.increaseSpeed(autoRotate.fineStep());
  showAutoRotateToast();
});
hotkeys.bind('alt+-', () => {
  if (!autoRotate.enabled) { showToast('Auto-rotate is off. Press R to start.', 900, 'info'); return; }
  autoRotate.decreaseSpeed(autoRotate.fineStep());
  showAutoRotateToast();
});
hotkeys.bind('*', () => {
  if (!autoRotate.enabled) { showToast('Auto-rotate is off. Press R to start.', 900, 'info'); return; }
  autoRotate.flipDirection();
  showAutoRotateToast();
});
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
hotkeys.bind('[', () => adjustDepth(1 / 0.85));
hotkeys.bind(']', () => adjustDepth(0.85));

// The knob is the nearest surface's radius, so a *smaller* ratio means a closer
// near plane and more parallax. Stepped multiplicatively — it's a reciprocal.
function adjustDepth(factor) {
  if (!viewer.hasDepth()) { showToast('No depth map loaded.', 900, 'info'); return; }
  const r = viewer.setNearRatio(viewer.getNearRatio() * factor);
  showToast(`Depth strength ${(1 / r).toFixed(1)}×`, 900, 'info');
}

const initial = parseQuery(window.location.search);
if (initial) input.loadURL(initial.url, initial.depth);

