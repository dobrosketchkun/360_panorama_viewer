// Global key-combo router. Combos are strings like "c", "escape", "ctrl+z",
// "ctrl+shift+z", "shift+/". The key portion is derived from e.code (so layout
// stays predictable) when it's a letter/digit, and from a small map for
// special keys.

const CODE_MAP = {
  Escape: 'escape',
  Slash: '/',
  Comma: ',',
  Period: '.',
  Minus: '-',
  Equal: '=',
  Space: 'space',
  Enter: 'enter',
  Backspace: 'backspace',
  Tab: 'tab',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
};

function comboFromEvent(e) {
  let key;
  if (e.code && e.code.startsWith('Key')) key = e.code.slice(3).toLowerCase();
  else if (e.code && e.code.startsWith('Digit')) key = e.code.slice(5);
  else key = CODE_MAP[e.code] || (e.key || '').toLowerCase();
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(key);
  return parts.join('+');
}

export class Hotkeys {
  constructor() {
    this.bindings = new Map();
    window.addEventListener('keydown', e => this._onKey(e));
  }

  bind(combo, handler) { this.bindings.set(combo, handler); }

  _onKey(e) {
    const el = document.activeElement;
    const inText = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    const combo = comboFromEvent(e);
    if (inText && combo !== 'escape') return;
    const handler = this.bindings.get(combo);
    if (handler) {
      e.preventDefault();
      handler(e);
    }
  }
}
