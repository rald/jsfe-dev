// ============================================================================
// awt.js — AWT-inspired Retained-Mode Canvas GUI Toolkit
// ============================================================================

class Observable {
  constructor() {
    this.observers = new Set();
  }
  subscribe(observer) {
    this.observers.add(observer);
  }
  unsubscribe(observer) {
    this.observers.delete(observer);
  }
  notify(data) {
    this.observers.forEach((obs) => obs(data));
  }
}

export class Model extends Observable {
  constructor(data = {}) {
    super();
    this.state = { ...data };
  }
  set(key, value) {
    this.state[key] = value;
    this.notify(this.state);
  }
  get(key) {
    return this.state[key];
  }
}

export const Themes = {
  dark: {
    bg: '#1a1c2c',
    panel: '#333c57',
    winTitle: '#29366f',
    winBody: '#333c57',
    btn: '#566c86',
    btnHover: '#3b5dc9',
    btnActive: '#29366f',
    text: '#f4f4f4',
    mutedText: '#94b0c2',
    border: '#94b0c2',
    disabled: '#414a66',
    scrollbarTrack: '#252b3f',
    scrollbarThumb: '#566c86',
    scrollbarThumbHover: '#73eff7',
    menuBar: '#252b3f',
    menuBg: '#2b334c',
    menuHighlight: '#3b5dc9',
    menuSeparator: '#566c86'
  },
  light: {
    bg: '#f4f4f4',
    panel: '#94b0c2',
    winTitle: '#41a6f6',
    winBody: '#f4f4f4',
    btn: '#73eff7',
    btnHover: '#a7f070',
    btnActive: '#38b764',
    text: '#1a1c2c',
    mutedText: '#566c86',
    border: '#333c57',
    disabled: '#b8c7d4',
    scrollbarTrack: '#d8e2ea',
    scrollbarThumb: '#7a95ab',
    scrollbarThumbHover: '#3b5dc9',
    menuBar: '#dce6ee',
    menuBg: '#eef3f7',
    menuHighlight: '#41a6f6',
    menuSeparator: '#7a95ab'
  }
};

export class AWTEvent {
  constructor(source, id) {
    this.source = source;
    this.id = id;
    this.timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._consumed = false;
  }
  consume() {
    this._consumed = true;
  }
  get isConsumed() {
    return this._consumed;
  }
}

export class MouseEvent extends AWTEvent {
  static MOUSE_CLICKED = 500;
  static MOUSE_PRESSED = 501;
  static MOUSE_RELEASED = 502;
  static MOUSE_MOVED = 503;
  static MOUSE_ENTERED = 504;
  static MOUSE_EXITED = 505;
  static MOUSE_DRAGGED = 506;
  static MOUSE_WHEEL = 507;

  constructor(source, id, x, y, button = 0, clickCount = 1, deltaX = 0, deltaY = 0) {
    super(source, id);
    this.x = x;
    this.y = y;
    this.button = button;
    this.clickCount = clickCount;
    this.deltaX = deltaX;
    this.deltaY = deltaY;
  }
}

export class KeyEvent extends AWTEvent {
  static KEY_TYPED = 400;
  static KEY_PRESSED = 401;
  static KEY_RELEASED = 402;

  constructor(source, id, key, code = '', modifiers = {}) {
    super(source, id);
    this.key = key;
    this.code = code;
    this.shiftKey = !!modifiers.shiftKey;
    this.ctrlKey = !!modifiers.ctrlKey;
    this.altKey = !!modifiers.altKey;
    this.metaKey = !!modifiers.metaKey;
  }
}

export class ActionEvent extends AWTEvent {
  static ACTION_PERFORMED = 1001;

  constructor(source, actionCommand = '') {
    super(source, ActionEvent.ACTION_PERFORMED);
    this.actionCommand = actionCommand;
  }
}

export class ItemEvent extends AWTEvent {
  static SELECTED = 1;
  static DESELECTED = 2;

  constructor(source, item, stateChange) {
    super(source, 701);
    this.item = item;
    this.stateChange = stateChange;
  }
}

export class FocusEvent extends AWTEvent {
  static FOCUS_GAINED = 1004;
  static FOCUS_LOST = 1005;

  constructor(source, id, oppositeComponent = null) {
    super(source, id);
    this.oppositeComponent = oppositeComponent;
  }
}

export class WindowEvent extends AWTEvent {
  static WINDOW_OPENED = 200;
  static WINDOW_CLOSING = 201;
  static WINDOW_CLOSED = 202;
  static WINDOW_ICONIFIED = 203;
  static WINDOW_DEICONIFIED = 204;
  static WINDOW_ACTIVATED = 205;
  static WINDOW_DEACTIVATED = 206;

  constructor(source, id, oppositeWindow = null) {
    super(source, id);
    this.oppositeWindow = oppositeWindow;
  }
}

export class Graphics {
  constructor(ctx2d) {
    this.ctx = ctx2d;
  }
  setColor(color) {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
  }
  setFont(font) {
    this.ctx.font = font;
  }
  getFont() {
    return this.ctx.font;
  }
  setLineWidth(width) {
    this.ctx.lineWidth = width;
  }
  fillRect(x, y, w, h) {
    this.ctx.fillRect(x, y, w, h);
  }
  drawRect(x, y, w, h) {
    this.ctx.strokeRect(x, y, w, h);
  }
  clearRect(x, y, w, h) {
    this.ctx.clearRect(x, y, w, h);
  }
  drawString(str, x, y) {
    this.ctx.fillText(str, x, y);
  }
  measureText(str) {
    return this.ctx.measureText(str);
  }
  save() {
    this.ctx.save();
  }
  restore() {
    this.ctx.restore();
  }
  clipRect(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }
}

export class Toolkit {
  static getDefaultToolkit() {
    if (!Toolkit._instance) {
      Toolkit._instance = new Toolkit();
    }
    return Toolkit._instance;
  }
  setCursor(stage, cursor) {
    if (stage && stage.canvas) {
      stage.canvas.style.cursor = cursor || 'default';
    }
  }
  beep() {}
}

export class LayoutManager {
  addLayoutComponent(_name, _comp) {}
  removeLayoutComponent(_comp) {}
  preferredLayoutSize(_parent) {
    return { width: 100, height: 40 };
  }
  layoutContainer(_parent) {}
}

export class FlowLayout extends LayoutManager {
  static LEFT = 'left';
  static CENTER = 'center';
  static RIGHT = 'right';
  static LEADING = 'leading';
  static TRAILING = 'trailing';

  constructor(align = FlowLayout.CENTER, hgap = 8, vgap = 8) {
    super();
    this.setAlignment(align);
    this.setHgap(hgap);
    this.setVgap(vgap);
  }

  _normalizeAlign(align) {
    const val = String(align ?? FlowLayout.CENTER).toLowerCase();
    if (val === 'left' || val === 'leading') return FlowLayout.LEFT;
    if (val === 'right' || val === 'trailing') return FlowLayout.RIGHT;
    if (val === 'center') return FlowLayout.CENTER;
    return FlowLayout.CENTER;
  }

  getAlignment() {
    return this.align;
  }

  setAlignment(align) {
    this.align = this._normalizeAlign(align);
  }

  getHgap() {
    return this.hgap;
  }

  setHgap(hgap) {
    this.hgap = Number.isFinite(Number(hgap)) ? Math.max(0, Number(hgap)) : 8;
  }

  getVgap() {
    return this.vgap;
  }

  setVgap(vgap) {
    this.vgap = Number.isFinite(Number(vgap)) ? Math.max(0, Number(vgap)) : 8;
  }

  _getItemSize(comp) {
    const pref = typeof comp.getPreferredSize === 'function'
      ? comp.getPreferredSize()
      : { width: comp.w || 80, height: comp.h || 24 };
    const w = comp.w > 0 ? comp.w : Math.max(1, pref.width || 80);
    const h = comp.h > 0 ? comp.h : Math.max(1, pref.height || 24);
    return { w, h };
  }

  preferredLayoutSize(parent) {
    const insets = parent.getInsets ? parent.getInsets() : { top: 0, left: 0, right: 0, bottom: 0 };
    const maxInnerW = parent.w > 0 ? Math.max(0, parent.w - insets.left - insets.right) : Infinity;

    let rowW = 0;
    let rowH = 0;
    let maxRowW = 0;
    let totalH = this.vgap;
    let hasItems = false;

    for (const comp of parent.children) {
      if (!comp || !comp.visible) continue;
      const { w, h } = this._getItemSize(comp);
      const nextRowW = hasItems ? rowW + this.hgap + w : w;
      const neededW = nextRowW + this.hgap * 2;

      if (hasItems && neededW > maxInnerW) {
        maxRowW = Math.max(maxRowW, rowW + this.hgap * 2);
        totalH += rowH + this.vgap;
        rowW = w;
        rowH = h;
      } else {
        rowW = nextRowW;
        rowH = Math.max(rowH, h);
        hasItems = true;
      }
    }

    if (hasItems) {
      maxRowW = Math.max(maxRowW, rowW + this.hgap * 2);
      totalH += rowH + this.vgap;
    } else {
      maxRowW = Math.max(maxRowW, this.hgap * 2);
      totalH += this.vgap;
    }

    return {
      width: insets.left + insets.right + maxRowW,
      height: insets.top + insets.bottom + totalH
    };
  }

  layoutContainer(parent) {
    const insets = parent.getInsets ? parent.getInsets() : { top: 0, left: 0, right: 0, bottom: 0 };
    const availW = Math.max(0, parent.w - insets.left - insets.right);
    const alignMode = this._normalizeAlign(this.align);

    let y = insets.top + this.vgap;
    let row = [];
    let contentW = 0;
    let rowH = 0;

    const flushRow = () => {
      if (row.length === 0) return;
      const totalRowSpan = contentW + this.hgap * 2;
      const extraSpace = Math.max(0, availW - totalRowSpan);

      let startX = insets.left + this.hgap;
      if (alignMode === FlowLayout.CENTER) {
        startX = insets.left + this.hgap + extraSpace / 2;
      } else if (alignMode === FlowLayout.RIGHT) {
        startX = insets.left + this.hgap + extraSpace;
      }

      let cursorX = startX;
      for (const item of row) {
        const itemY = y + Math.max(0, (rowH - item.h) / 2);
        item.comp.setBounds(cursorX, itemY, item.w, item.h);
        cursorX += item.w + this.hgap;
      }

      y += rowH + this.vgap;
      row = [];
      contentW = 0;
      rowH = 0;
    };

    for (const comp of parent.children) {
      if (!comp || !comp.visible) continue;
      const { w, h } = this._getItemSize(comp);
      const nextContentW = row.length > 0 ? contentW + this.hgap + w : w;
      const neededW = nextContentW + this.hgap * 2;

      if (row.length > 0 && neededW > availW) {
        flushRow();
        row.push({ comp, w, h });
        contentW = w;
        rowH = h;
      } else {
        row.push({ comp, w, h });
        contentW = nextContentW;
        rowH = Math.max(rowH, h);
      }
    }

    flushRow();
  }
}

export class GridLayout extends LayoutManager {
  constructor(rows = 1, cols = 1, hgap = 6, vgap = 6) {
    super();
    this.rows = Math.max(0, rows);
    this.cols = Math.max(0, cols);
    this.hgap = hgap;
    this.vgap = vgap;
  }

  _gridDims(parent) {
    const visibleChildren = parent.children.filter((c) => c.visible);
    let rCount = this.rows;
    let cCount = this.cols;
    if (rCount > 0 && cCount === 0) {
      cCount = Math.ceil(visibleChildren.length / rCount);
    } else if (cCount > 0 && rCount === 0) {
      rCount = Math.ceil(visibleChildren.length / cCount);
    } else if (rCount === 0 && cCount === 0) {
      rCount = 1;
      cCount = Math.max(1, visibleChildren.length);
    }
    return { visibleChildren, rCount, cCount };
  }

  preferredLayoutSize(parent) {
    const { visibleChildren, rCount, cCount } = this._gridDims(parent);
    const insets = parent.getInsets ? parent.getInsets() : { top: 0, left: 0, right: 0, bottom: 0 };
    let maxW = 60;
    let maxH = 24;
    for (const comp of visibleChildren) {
      const pref = comp.getPreferredSize();
      maxW = Math.max(maxW, comp.w || pref.width);
      maxH = Math.max(maxH, comp.h || pref.height);
    }
    return {
      width: insets.left + insets.right + this.hgap * (cCount + 1) + cCount * maxW,
      height: insets.top + insets.bottom + this.vgap * (rCount + 1) + rCount * maxH
    };
  }

  layoutContainer(parent) {
    const { visibleChildren, rCount, cCount } = this._gridDims(parent);
    if (visibleChildren.length === 0) return;

    const insets = parent.getInsets ? parent.getInsets() : { top: 0, left: 0, right: 0, bottom: 0 };
    const innerW = Math.max(0, parent.w - insets.left - insets.right - this.hgap * (cCount + 1));
    const innerH = Math.max(0, parent.h - insets.top - insets.bottom - this.vgap * (rCount + 1));
    const cellW = cCount > 0 ? innerW / cCount : innerW;
    const cellH = rCount > 0 ? innerH / rCount : innerH;

    visibleChildren.forEach((comp, idx) => {
      const r = Math.floor(idx / cCount);
      const c = idx % cCount;
      const x = insets.left + this.hgap + c * (cellW + this.hgap);
      const y = insets.top + this.vgap + r * (cellH + this.vgap);
      comp.setBounds(x, y, cellW, cellH);
    });
  }
}

export class BorderLayout extends LayoutManager {
  static NORTH = 'North';
  static SOUTH = 'South';
  static EAST = 'East';
  static WEST = 'West';
  static CENTER = 'Center';

  constructor(hgap = 6, vgap = 6) {
    super();
    this.hgap = hgap;
    this.vgap = vgap;
    this.regions = new Map();
  }

  addLayoutComponent(name, comp) {
    this.regions.set(comp, name || BorderLayout.CENTER);
  }

  removeLayoutComponent(comp) {
    this.regions.delete(comp);
  }

  layoutContainer(parent) {
    const insets = parent.getInsets ? parent.getInsets() : { top: 0, left: 0, right: 0, bottom: 0 };
    let top = insets.top + this.vgap;
    let bottom = parent.h - insets.bottom - this.vgap;
    let left = insets.left + this.hgap;
    let right = parent.w - insets.right - this.hgap;

    let north = null, south = null, east = null, west = null, center = null;
    for (const comp of parent.children) {
      if (!comp.visible) continue;
      const constraint = this.regions.get(comp) || BorderLayout.CENTER;
      if (constraint === BorderLayout.NORTH) north = comp;
      else if (constraint === BorderLayout.SOUTH) south = comp;
      else if (constraint === BorderLayout.EAST) east = comp;
      else if (constraint === BorderLayout.WEST) west = comp;
      else center = comp;
    }

    if (north) {
      const h = north.h || north.getPreferredSize().height;
      north.setBounds(left, top, Math.max(0, right - left), h);
      top += h + this.vgap;
    }
    if (south) {
      const h = south.h || south.getPreferredSize().height;
      south.setBounds(left, Math.max(top, bottom - h), Math.max(0, right - left), h);
      bottom -= h + this.vgap;
    }
    if (west) {
      const w = west.w || west.getPreferredSize().width;
      west.setBounds(left, top, w, Math.max(0, bottom - top));
      left += w + this.hgap;
    }
    if (east) {
      const w = east.w || east.getPreferredSize().width;
      east.setBounds(Math.max(left, right - w), top, w, Math.max(0, bottom - top));
      right -= w + this.hgap;
    }
    if (center) {
      center.setBounds(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
    }
  }
}

export class Component {
  constructor(x = 0, y = 0, w = 80, h = 24) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.parent = null;
    this._stage = null;
    this.visible = true;
    this.enabled = true;
    this.focusable = true;
    this.cursor = 'default';
    this.valid = false;

    this._mouseListeners = [];
    this._keyListeners = [];
    this._focusListeners = [];
    this._actionListeners = [];
  }

  set stage(s) {
    this._stage = s;
    if (this.children) {
      this.children.forEach((c) => {
        c.stage = s;
      });
    }
  }

  get stage() {
    if (this._stage) return this._stage;
    return this.parent ? this.parent.stage : null;
  }

  get theme() {
    const st = this.stage;
    return st ? Themes[st.theme] || Themes.dark : Themes.dark;
  }

  get hasFocus() {
    return !!(this.stage && this.stage.focused === this);
  }

  get locationOnScreen() {
    if (this.parent && typeof this.parent.getChildScreenOrigin === 'function') {
      const origin = this.parent.getChildScreenOrigin();
      return { x: origin.x + this.x, y: origin.y + this.y };
    }
    if (this.parent) {
      const pLoc = this.parent.locationOnScreen;
      return { x: pLoc.x + this.x, y: pLoc.y + this.y };
    }
    return { x: this.x, y: this.y };
  }

  setLocation(x, y) {
    this.x = x;
    this.y = y;
    this.repaint();
  }

  setSize(w, h) {
    this.w = w;
    this.h = h;
    this.invalidate();
    this.repaint();
  }

  // Does NOT call paint() directly to prevent layout <-> paint recursion
  setBounds(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.valid = false;
  }

  getBounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  getPreferredSize() {
    return { width: this.w || 80, height: this.h || 24 };
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.repaint();
  }

  isEnabled() {
    return this.enabled && (!this.parent || this.parent.isEnabled());
  }

  setVisible(visible) {
    this.visible = !!visible;
    this.invalidate();
    this.repaint();
  }

  requestFocus() {
    if (this.stage && this.visible && this.enabled && this.focusable) {
      this.stage._setFocus(this);
    }
  }

  invalidate() {
    this.valid = false;
    if (this.parent) {
      this.parent.invalidate();
    }
  }

  validate() {
    this.valid = true;
  }

  repaint() {
    if (this.stage) {
      this.stage.schedulePaint();
    }
  }

  isHit(screenX, screenY) {
    if (!this.visible) return false;
    const { x, y } = this.locationOnScreen;
    return screenX >= x && screenX <= x + this.w && screenY >= y && screenY <= y + this.h;
  }

  addMouseListener(fn) {
    this._mouseListeners.push(fn);
  }
  removeMouseListener(fn) {
    this._mouseListeners = this._mouseListeners.filter((l) => l !== fn);
  }
  addKeyListener(fn) {
    this._keyListeners.push(fn);
  }
  removeKeyListener(fn) {
    this._keyListeners = this._keyListeners.filter((l) => l !== fn);
  }
  addFocusListener(fn) {
    this._focusListeners.push(fn);
  }
  removeFocusListener(fn) {
    this._focusListeners = this._focusListeners.filter((l) => l !== fn);
  }
  addActionListener(fn) {
    this._actionListeners.push(fn);
  }
  removeActionListener(fn) {
    this._actionListeners = this._actionListeners.filter((l) => l !== fn);
  }

  fireActionEvent(actionCommand = '') {
    const evt = new ActionEvent(this, actionCommand);
    this._actionListeners.forEach((fn) => fn(evt));
    if (this.onClick) this.onClick(evt);
  }

  paint(g) {
    if (!this.visible) return;
    this.draw(g.ctx);
  }
  draw(_ctx) {}

  onMouseEnter(e) {
    this._mouseListeners.forEach((fn) => fn(e));
  }
  onMouseLeave(e) {
    this._mouseListeners.forEach((fn) => fn(e));
  }
  onMouseDown(x, y, e) {
    this._mouseListeners.forEach((fn) => fn(e || new MouseEvent(this, MouseEvent.MOUSE_PRESSED, x, y)));
  }
  onMouseUp(x, y, e) {
    this._mouseListeners.forEach((fn) => fn(e || new MouseEvent(this, MouseEvent.MOUSE_RELEASED, x, y)));
  }
  onMouseMove(x, y, e) {
    this._mouseListeners.forEach((fn) => fn(e || new MouseEvent(this, MouseEvent.MOUSE_MOVED, x, y)));
  }
  onMouseWheel(deltaX, deltaY, e) {
    this._mouseListeners.forEach((fn) => fn(e || new MouseEvent(this, MouseEvent.MOUSE_WHEEL, 0, 0, 0, 1, deltaX, deltaY)));
  }
  onKeyDown(key, e) {
    this._keyListeners.forEach((fn) => fn(e || new KeyEvent(this, KeyEvent.KEY_PRESSED, key)));
  }
  onFocusGained(e) {
    this._focusListeners.forEach((fn) => fn(e));
  }
  onFocusLost(e) {
    this._focusListeners.forEach((fn) => fn(e));
  }
  handleClick(x, y, e) {
    if (!this.isEnabled()) return;
    this._mouseListeners.forEach((fn) => fn(e || new MouseEvent(this, MouseEvent.MOUSE_CLICKED, x, y)));
    if (this.onClick) this.onClick(e);
  }
}

// ============================================================================
// AWT Menu & Friends: MenuComponent, MenuItem, CheckboxMenuItem, Menu,
// MenuBar, PopupMenu, MenuShortcut
// ============================================================================

export class MenuShortcut {
  constructor(key, usesShiftModifier = false) {
    this.key = String(key ?? '');
    this.usesShiftModifier = !!usesShiftModifier;
  }

  getKey() {
    return this.key;
  }

  usesShift() {
    return this.usesShiftModifier;
  }

  toString() {
    if (!this.key) return '';
    return `${this.usesShiftModifier ? 'Shift+' : ''}${this.key.toUpperCase()}`;
  }

  matches(key, e = null) {
    if (!this.key) return false;
    const k = String(key ?? '').toLowerCase();
    const target = this.key.toLowerCase();
    const shiftOk = this.usesShiftModifier ? !!(e && e.shiftKey) : !(e && e.shiftKey);
    const modPressed = !!(e && (e.ctrlKey || e.metaKey || e.altKey));
    return k === target && shiftOk && !modPressed;
  }
}

export class MenuComponent {
  constructor(label = '') {
    this.label = String(label ?? '');
    this.parent = null; // Menu, MenuBar, or PopupMenu
    this.enabled = true;
    this._actionListeners = [];
    this._itemListeners = [];
  }

  getName() {
    return this.label;
  }

  setName(name) {
    this.label = String(name ?? '');
    this._repaintRoot();
  }

  getParent() {
    return this.parent;
  }

  isEnabled() {
    if (!this.enabled) return false;
    if (this.parent && typeof this.parent.isEnabled === 'function') {
      return this.parent.isEnabled();
    }
    return true;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this._repaintRoot();
  }

  _getRootStage() {
    let curr = this.parent;
    while (curr) {
      if (curr.stage) return curr.stage;
      if (curr.frame && curr.frame.stage) return curr.frame.stage;
      if (curr._ownerComponent && curr._ownerComponent.stage) return curr._ownerComponent.stage;
      curr = curr.parent;
    }
    return null;
  }

  _repaintRoot() {
    const st = this._getRootStage();
    if (st) st.schedulePaint();
  }

  addActionListener(fn) {
    if (typeof fn === 'function') this._actionListeners.push(fn);
  }

  removeActionListener(fn) {
    this._actionListeners = this._actionListeners.filter((l) => l !== fn);
  }

  fireActionEvent(actionCommand = null) {
    const cmd = actionCommand != null ? actionCommand : this.label;
    const evt = new ActionEvent(this, cmd);
    this._actionListeners.forEach((fn) => fn(evt));
    if (this.parent && typeof this.parent._propagateActionEvent === 'function') {
      this.parent._propagateActionEvent(evt);
    }
    return evt;
  }

  addItemListener(fn) {
    if (typeof fn === 'function') this._itemListeners.push(fn);
  }

  removeItemListener(fn) {
    this._itemListeners = this._itemListeners.filter((l) => l !== fn);
  }

  fireItemEvent(stateChange) {
    const evt = new ItemEvent(this, this.label, stateChange);
    this._itemListeners.forEach((fn) => fn(evt));
    if (this.parent && typeof this.parent._propagateItemEvent === 'function') {
      this.parent._propagateItemEvent(evt);
    }
    return evt;
  }
}

export class MenuItem extends MenuComponent {
  static SEPARATOR_LABEL = '-';

  constructor(label = '', shortcut = null, onAction = null) {
    super(label);
    this.shortcut = shortcut instanceof MenuShortcut ? shortcut : shortcut ? new MenuShortcut(shortcut) : null;
    this.actionCommand = null;
    if (typeof onAction === 'function') {
      this.addActionListener(onAction);
    }
    this._bounds = { x: 0, y: 0, w: 0, h: 24 };
  }

  isSeparator() {
    return this.label === MenuItem.SEPARATOR_LABEL;
  }

  getLabel() {
    return this.label;
  }

  setLabel(label) {
    this.label = String(label ?? '');
    this._repaintRoot();
  }

  getActionCommand() {
    return this.actionCommand != null ? this.actionCommand : this.label;
  }

  setActionCommand(command) {
    this.actionCommand = command != null ? String(command) : null;
  }

  getShortcut() {
    return this.shortcut;
  }

  setShortcut(shortcut) {
    this.shortcut = shortcut instanceof MenuShortcut ? shortcut : shortcut ? new MenuShortcut(shortcut) : null;
    this._repaintRoot();
  }

  deleteShortcut() {
    this.shortcut = null;
    this._repaintRoot();
  }

  select() {
    if (!this.isEnabled() || this.isSeparator()) return;
    this.fireActionEvent(this.getActionCommand());
  }

  draw(ctx, x, y, w, h, theme, isHighlighted = false) {
    this._bounds = { x, y, w, h };
    if (this.isSeparator()) {
      const midY = y + Math.floor(h / 2);
      ctx.strokeStyle = theme.menuSeparator || theme.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, midY);
      ctx.lineTo(x + w - 8, midY);
      ctx.stroke();
      return;
    }

    const active = this.isEnabled() && isHighlighted;
    if (active) {
      ctx.fillStyle = theme.menuHighlight || theme.btnHover;
      ctx.fillRect(x + 1, y, Math.max(0, w - 2), h);
    }

    ctx.fillStyle = !this.isEnabled() ? theme.mutedText : active ? '#ffffff' : theme.text;
    ctx.textBaseline = 'middle';
    const textY = y + h / 2;
    ctx.fillText(this.label, x + 22, textY);

    if (this.shortcut) {
      const scText = this.shortcut.toString();
      const scW = ctx.measureText(scText).width;
      ctx.fillStyle = !this.isEnabled()
        ? theme.mutedText
        : active
        ? '#e8f4ff'
        : theme.mutedText;
      ctx.fillText(scText, x + w - scW - 10, textY);
    }
  }
}

export class CheckboxMenuItem extends MenuItem {
  constructor(label = '', state = false, shortcut = null, onItemChange = null) {
    super(label, shortcut, null);
    this.state = !!state;
    if (typeof onItemChange === 'function') {
      this.addItemListener(onItemChange);
    }
  }

  getState() {
    return this.state;
  }

  setState(state) {
    this.state = !!state;
    this._repaintRoot();
  }

  select() {
    if (!this.isEnabled() || this.isSeparator()) return;
    this.state = !this.state;
    this.fireItemEvent(this.state ? ItemEvent.SELECTED : ItemEvent.DESELECTED);
    this.fireActionEvent(this.getActionCommand());
  }

  draw(ctx, x, y, w, h, theme, isHighlighted = false) {
    this._bounds = { x, y, w, h };
    const active = this.isEnabled() && isHighlighted;
    if (active) {
      ctx.fillStyle = theme.menuHighlight || theme.btnHover;
      ctx.fillRect(x + 1, y, Math.max(0, w - 2), h);
    }

    const boxSize = 12;
    const bx = x + 6;
    const by = y + Math.floor((h - boxSize) / 2);

    ctx.strokeStyle = !this.isEnabled() ? theme.mutedText : active ? '#ffffff' : theme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, boxSize, boxSize);

    if (this.state) {
      ctx.strokeStyle = !this.isEnabled() ? theme.mutedText : active ? '#ffffff' : theme.text;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + 2.5, by + 6.5);
      ctx.lineTo(bx + 5.2, by + 9.5);
      ctx.lineTo(bx + 9.8, by + 3);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    ctx.fillStyle = !this.isEnabled() ? theme.mutedText : active ? '#ffffff' : theme.text;
    ctx.textBaseline = 'middle';
    const textY = y + h / 2;
    ctx.fillText(this.label, x + 24, textY);

    if (this.shortcut) {
      const scText = this.shortcut.toString();
      const scW = ctx.measureText(scText).width;
      ctx.fillStyle = !this.isEnabled() ? theme.mutedText : active ? '#e8f4ff' : theme.mutedText;
      ctx.fillText(scText, x + w - scW - 10, textY);
    }
  }
}

export class Menu extends MenuItem {
  constructor(label = '', tearOff = false) {
    super(label, null, null);
    this.tearOff = !!tearOff;
    this.items = [];
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.openSubmenu = null;
    this._popupRect = null;
    this._barRect = null;
  }

  isTearOff() {
    return this.tearOff;
  }

  getItemCount() {
    return this.items.length;
  }

  getItem(index) {
    return this.items[index] ?? null;
  }

  add(item) {
    if (typeof item === 'string') {
      const menuItem = new MenuItem(item);
      menuItem.parent = this;
      this.items.push(menuItem);
      this._repaintRoot();
      return menuItem;
    }
    if (item instanceof MenuComponent) {
      item.parent = this;
      this.items.push(item);
      this._repaintRoot();
      return item;
    }
    return null;
  }

  addSeparator() {
    return this.add(new MenuItem(MenuItem.SEPARATOR_LABEL));
  }

  insert(item, index) {
    const idx = Math.max(0, Math.min(this.items.length, index));
    const comp = typeof item === 'string' ? new MenuItem(item) : item;
    if (!(comp instanceof MenuComponent)) return null;
    comp.parent = this;
    this.items.splice(idx, 0, comp);
    this._repaintRoot();
    return comp;
  }

  insertSeparator(index) {
    return this.insert(new MenuItem(MenuItem.SEPARATOR_LABEL), index);
  }

  remove(indexOrItem) {
    let idx = -1;
    if (typeof indexOrItem === 'number') {
      idx = indexOrItem;
    } else {
      idx = this.items.indexOf(indexOrItem);
    }
    if (idx >= 0 && idx < this.items.length) {
      const [removed] = this.items.splice(idx, 1);
      if (removed) removed.parent = null;
      this._repaintRoot();
      return removed;
    }
    return null;
  }

  removeAll() {
    for (const item of this.items) {
      if (item) item.parent = null;
    }
    this.items = [];
    this.highlightedIndex = -1;
    this.closePopup();
    this._repaintRoot();
  }

  closePopup() {
    this.isOpen = false;
    this.highlightedIndex = -1;
    this._popupRect = null;
    if (this.openSubmenu) {
      this.openSubmenu.closePopup();
      this.openSubmenu = null;
    }
  }

  openPopup(x, y, ctx = null, stage = null) {
    this.isOpen = true;
    const itemH = 24;
    const sepH = 9;
    const padV = 4;

    let maxLabelW = 70;
    let maxShortcutW = 0;
    let totalH = padV * 2;
    let hasSubmenu = false;

    for (const item of this.items) {
      if (item.isSeparator()) {
        totalH += sepH;
        continue;
      }
      totalH += itemH;
      const lblW = ctx && typeof ctx.measureText === 'function'
        ? ctx.measureText(item.label).width
        : item.label.length * 8;
      maxLabelW = Math.max(maxLabelW, lblW);

      if (item.shortcut) {
        const sc = item.shortcut.toString();
        const scW = ctx && typeof ctx.measureText === 'function'
          ? ctx.measureText(sc).width
          : sc.length * 7;
        maxShortcutW = Math.max(maxShortcutW, scW);
      }
      if (item instanceof Menu) {
        hasSubmenu = true;
      }
    }

    if (this.items.length === 0) {
      totalH = padV * 2 + itemH;
    }

    const rightReserve = Math.max(maxShortcutW + (maxShortcutW > 0 ? 18 : 0), hasSubmenu ? 18 : 0);
    const popupW = Math.max(130, Math.ceil(maxLabelW + 34 + rightReserve));

    let px = x;
    let py = y;
    const canvasW = stage && stage.canvas ? stage.canvas.width : Infinity;
    const canvasH = stage && stage.canvas ? stage.canvas.height : Infinity;

    if (px + popupW > canvasW - 4) {
      px = Math.max(4, canvasW - popupW - 4);
    }
    if (py + totalH > canvasH - 4) {
      py = Math.max(4, canvasH - totalH - 4);
    }

    this._popupRect = { x: px, y: py, w: popupW, h: totalH };
  }

  _getItemRects() {
    if (!this._popupRect) return [];
    const itemH = 24;
    const sepH = 9;
    const padV = 4;
    let curY = this._popupRect.y + padV;
    const rects = [];

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const h = item.isSeparator() ? sepH : itemH;
      rects.push({
        item,
        index: i,
        rect: { x: this._popupRect.x, y: curY, w: this._popupRect.w, h }
      });
      curY += h;
    }
    return rects;
  }

  _propagateActionEvent(evt) {
    this._actionListeners.forEach((fn) => fn(evt));
    if (this.parent && typeof this.parent._propagateActionEvent === 'function') {
      this.parent._propagateActionEvent(evt);
    }
  }

  _propagateItemEvent(evt) {
    this._itemListeners.forEach((fn) => fn(evt));
    if (this.parent && typeof this.parent._propagateItemEvent === 'function') {
      this.parent._propagateItemEvent(evt);
    }
  }

  _findShortcutMatch(key, e = null) {
    for (const item of this.items) {
      if (!item || item.isSeparator() || !item.isEnabled()) continue;
      if (item instanceof Menu) {
        const subMatch = item._findShortcutMatch(key, e);
        if (subMatch) return subMatch;
      } else if (item.shortcut && item.shortcut.matches(key, e)) {
        return item;
      }
    }
    return null;
  }

  drawPopup(ctx, theme, stage = null) {
    if (!this.isOpen || !this._popupRect) return;
    const { x, y, w, h } = this._popupRect;

    ctx.save();
    // Subtle drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x + 3, y + 3, w, h);

    // Popup background
    ctx.fillStyle = theme.menuBg || theme.panel;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    const rects = this._getItemRects();
    for (const entry of rects) {
      const { item, index, rect } = entry;
      const hi = this.highlightedIndex === index;
      item.draw(ctx, rect.x, rect.y, rect.w, rect.h, theme, hi);

      if (item instanceof Menu && !item.isSeparator()) {
        const ax = rect.x + rect.w - 12;
        const ay = rect.y + rect.h / 2;
        ctx.fillStyle = !item.isEnabled() ? theme.mutedText : hi ? '#ffffff' : theme.text;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 4);
        ctx.lineTo(ax + 5, ay);
        ctx.lineTo(ax, ay + 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (this.openSubmenu && this.openSubmenu.isOpen) {
      if (!this.openSubmenu._popupRect) {
        const hiEntry = rects.find((r) => r.item === this.openSubmenu);
        const subX = hiEntry ? hiEntry.rect.x + hiEntry.rect.w - 2 : x + w - 2;
        const subY = hiEntry ? hiEntry.rect.y : y;
        this.openSubmenu.openPopup(subX, subY, ctx, stage);
      }
      this.openSubmenu.drawPopup(ctx, theme, stage);
    }

    ctx.restore();
  }

  handlePopupMouseMove(sx, sy, ctx = null, stage = null) {
    if (!this.isOpen) return false;
    if (this.openSubmenu && this.openSubmenu.isOpen) {
      if (this.openSubmenu.handlePopupMouseMove(sx, sy, ctx, stage)) {
        return true;
      }
    }
    if (!this._popupRect) return false;
    const inside =
      sx >= this._popupRect.x &&
      sx <= this._popupRect.x + this._popupRect.w &&
      sy >= this._popupRect.y &&
      sy <= this._popupRect.y + this._popupRect.h;
    if (!inside) return false;

    const rects = this._getItemRects();
    for (const { item, index, rect } of rects) {
      if (sx >= rect.x && sx <= rect.x + rect.w && sy >= rect.y && sy <= rect.y + rect.h) {
        if (item.isSeparator() || !item.isEnabled()) {
          this.highlightedIndex = index;
          return true;
        }
        this.highlightedIndex = index;
        if (item instanceof Menu) {
          if (this.openSubmenu && this.openSubmenu !== item) {
            this.openSubmenu.closePopup();
          }
          this.openSubmenu = item;
          item.openPopup(rect.x + rect.w - 2, rect.y, ctx, stage);
        } else if (this.openSubmenu) {
          this.openSubmenu.closePopup();
          this.openSubmenu = null;
        }
        return true;
      }
    }
    return true;
  }

  handlePopupMouseDown(sx, sy, ctx = null, stage = null) {
    if (!this.isOpen) return { handled: false, selected: false };
    if (this.openSubmenu && this.openSubmenu.isOpen) {
      const subRes = this.openSubmenu.handlePopupMouseDown(sx, sy, ctx, stage);
      if (subRes.handled) return subRes;
    }
    if (!this._popupRect) return { handled: false, selected: false };

    const inside =
      sx >= this._popupRect.x &&
      sx <= this._popupRect.x + this._popupRect.w &&
      sy >= this._popupRect.y &&
      sy <= this._popupRect.y + this._popupRect.h;
    if (!inside) return { handled: false, selected: false };

    const rects = this._getItemRects();
    for (const { item, rect } of rects) {
      if (sx >= rect.x && sx <= rect.x + rect.w && sy >= rect.y && sy <= rect.y + rect.h) {
        if (item.isSeparator() || !item.isEnabled()) {
          return { handled: true, selected: false };
        }
        if (item instanceof Menu) {
          if (this.openSubmenu && this.openSubmenu !== item) {
            this.openSubmenu.closePopup();
          }
          this.openSubmenu = item;
          item.openPopup(rect.x + rect.w - 2, rect.y, ctx, stage);
          return { handled: true, selected: false };
        }
        item.select();
        return { handled: true, selected: true };
      }
    }
    return { handled: true, selected: false };
  }
}

export class MenuBar extends MenuComponent {
  static BAR_HEIGHT = 24;

  constructor(menus = []) {
    super('');
    this.menus = [];
    this.frame = null;
    this.activeMenu = null;
    this._hoverIndex = -1;
    this._actionListeners = [];
    this._itemListeners = [];
    if (Array.isArray(menus)) {
      menus.forEach((m) => this.add(m));
    }
  }

  getMenuCount() {
    return this.menus.length;
  }

  getMenu(index) {
    return this.menus[index] ?? null;
  }

  add(menu) {
    if (!(menu instanceof Menu)) return null;
    menu.parent = this;
    this.menus.push(menu);
    this._repaintRoot();
    return menu;
  }

  remove(indexOrMenu) {
    let idx = -1;
    if (typeof indexOrMenu === 'number') {
      idx = indexOrMenu;
    } else {
      idx = this.menus.indexOf(indexOrMenu);
    }
    if (idx >= 0 && idx < this.menus.length) {
      const [removed] = this.menus.splice(idx, 1);
      if (removed) {
        removed.closePopup();
        removed.parent = null;
      }
      if (this.activeMenu === removed) this.activeMenu = null;
      this._repaintRoot();
      return removed;
    }
    return null;
  }

  closeAllMenus() {
    for (const m of this.menus) {
      m.closePopup();
    }
    this.activeMenu = null;
  }

  _propagateActionEvent(evt) {
    this._actionListeners.forEach((fn) => fn(evt));
    if (this.frame && Array.isArray(this.frame._actionListeners)) {
      this.frame._actionListeners.forEach((fn) => fn(evt));
    }
  }

  _propagateItemEvent(evt) {
    this._itemListeners.forEach((fn) => fn(evt));
  }

  _findShortcutMatch(key, e = null) {
    for (const menu of this.menus) {
      if (!menu || !menu.isEnabled()) continue;
      const match = menu._findShortcutMatch(key, e);
      if (match) return match;
    }
    return null;
  }

  getBarBounds() {
    if (!this.frame || !this.frame.visible || this.frame.undecorated || this.frame.minimized) {
      return null;
    }
    const { x, y } = this.frame.locationOnScreen;
    return {
      x: x + 1,
      y: y + Frame.TITLE_BAR_HEIGHT,
      w: Math.max(0, this.frame.w - 2),
      h: MenuBar.BAR_HEIGHT
    };
  }

  _getMenuItemRects(ctx = null) {
    const bar = this.getBarBounds();
    if (!bar) return [];
    let cursorX = bar.x + 4;
    const items = [];
    this.menus.forEach((menu, idx) => {
      const textW = ctx && typeof ctx.measureText === 'function'
        ? ctx.measureText(menu.label).width
        : menu.label.length * 8;
      const w = Math.max(44, Math.ceil(textW + 18));
      const rect = { x: cursorX, y: bar.y + 1, w, h: bar.h - 2 };
      menu._barRect = rect;
      items.push({ menu, index: idx, rect });
      cursorX += w + 2;
    });
    return items;
  }

  isHit(sx, sy, ctx = null) {
    const bar = this.getBarBounds();
    if (bar && sx >= bar.x && sx <= bar.x + bar.w && sy >= bar.y && sy <= bar.y + bar.h) {
      return true;
    }
    if (this.activeMenu && this.activeMenu.isOpen) {
      return this._isPointInMenuTree(this.activeMenu, sx, sy);
    }
    return false;
  }

  _isPointInMenuTree(menu, sx, sy) {
    if (!menu || !menu.isOpen) return false;
    if (menu._popupRect) {
      const r = menu._popupRect;
      if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return true;
    }
    if (menu.openSubmenu) {
      return this._isPointInMenuTree(menu.openSubmenu, sx, sy);
    }
    return false;
  }

  handleMouseDown(sx, sy, ctx = null, stage = null) {
    if (this.activeMenu && this.activeMenu.isOpen) {
      const res = this.activeMenu.handlePopupMouseDown(sx, sy, ctx, stage);
      if (res.handled) {
        if (res.selected) {
          this.closeAllMenus();
        }
        return true;
      }
    }

    const menuItems = this._getMenuItemRects(ctx);
    for (const { menu, index, rect } of menuItems) {
      if (sx >= rect.x && sx <= rect.x + rect.w && sy >= rect.y && sy <= rect.y + rect.h) {
        if (!menu.isEnabled()) return true;
        if (this.activeMenu === menu && menu.isOpen) {
          this.closeAllMenus();
        } else {
          this.closeAllMenus();
          this.activeMenu = menu;
          this._hoverIndex = index;
          menu.openPopup(rect.x, rect.y + rect.h, ctx, stage);
        }
        return true;
      }
    }

    if (this.activeMenu && this.activeMenu.isOpen) {
      this.closeAllMenus();
    }
    return false;
  }

  handleMouseMove(sx, sy, ctx = null, stage = null) {
    if (this.activeMenu && this.activeMenu.isOpen) {
      if (this.activeMenu.handlePopupMouseMove(sx, sy, ctx, stage)) {
        return true;
      }
      const menuItems = this._getMenuItemRects(ctx);
      for (const { menu, index, rect } of menuItems) {
        if (sx >= rect.x && sx <= rect.x + rect.w && sy >= rect.y && sy <= rect.y + rect.h) {
          if (menu.isEnabled() && this.activeMenu !== menu) {
            this.closeAllMenus();
            this.activeMenu = menu;
            this._hoverIndex = index;
            menu.openPopup(rect.x, rect.y + rect.h, ctx, stage);
          }
          return true;
        }
      }
      return false;
    }

    const menuItems = this._getMenuItemRects(ctx);
    let nextHover = -1;
    for (const { index, rect } of menuItems) {
      if (sx >= rect.x && sx <= rect.x + rect.w && sy >= rect.y && sy <= rect.y + rect.h) {
        nextHover = index;
        break;
      }
    }
    this._hoverIndex = nextHover;
    return nextHover !== -1;
  }

  drawBar(ctx, theme) {
    const bar = this.getBarBounds();
    if (!bar) return;

    ctx.save();
    ctx.fillStyle = theme.menuBar || theme.panel;
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);

    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bar.x, bar.y + bar.h);
    ctx.lineTo(bar.x + bar.w, bar.y + bar.h);
    ctx.stroke();

    const menuItems = this._getMenuItemRects(ctx);
    for (const { menu, index, rect } of menuItems) {
      const isOpen = this.activeMenu === menu && menu.isOpen;
      const isHover = this._hoverIndex === index;
      if (isOpen || (isHover && menu.isEnabled())) {
        ctx.fillStyle = isOpen ? theme.menuHighlight || theme.btnHover : theme.btnHover;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }

      ctx.fillStyle = !menu.isEnabled()
        ? theme.mutedText
        : isOpen || isHover
        ? '#ffffff'
        : theme.text;
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(menu.label).width;
      ctx.fillText(menu.label, rect.x + Math.max(6, (rect.w - tw) / 2), rect.y + rect.h / 2);
    }

    ctx.restore();
  }

  drawOpenPopups(ctx, theme, stage = null) {
    if (this.activeMenu && this.activeMenu.isOpen) {
      this.activeMenu.drawPopup(ctx, theme, stage);
    }
  }
}

export class PopupMenu extends Menu {
  constructor(label = '') {
    super(label, false);
    this._ownerComponent = null;
  }

  show(originComponent, x, y) {
    this._ownerComponent = originComponent || null;
    const stage = originComponent && originComponent.stage ? originComponent.stage : this._getRootStage();
    const ctx = stage && stage.ctx ? stage.ctx : null;
    let sx = x;
    let sy = y;
    if (originComponent && typeof originComponent.locationOnScreen === 'object') {
      const base = originComponent.locationOnScreen;
      sx = base.x + x;
      sy = base.y + y;
    }
    this.openPopup(sx, sy, ctx, stage);
    if (stage) {
      stage._activePopupMenu = this;
      stage.schedulePaint();
    }
  }

  hide() {
    this.closePopup();
    const stage = this._getRootStage();
    if (stage && stage._activePopupMenu === this) {
      stage._activePopupMenu = null;
    }
    this._repaintRoot();
  }
}

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.graphics = new Graphics(this.ctx);
    this.components = [];
    this.hovered = null;
    this.dragTarget = null;
    this.focused = null;
    this.theme = 'dark';
    this.toolkit = Toolkit.getDefaultToolkit();
    this._paintScheduled = false;
    this._isPainting = false;
    this._activePopupMenu = null;

    this._applyFont();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        let closedAny = false;
        if (this._activePopupMenu && this._activePopupMenu.isOpen) {
          this._activePopupMenu.hide();
          closedAny = true;
        }
        for (const comp of this.components) {
          if (comp instanceof Frame && comp.menuBar && comp.menuBar.activeMenu) {
            comp.menuBar.closeAllMenus();
            closedAny = true;
          }
        }
        if (closedAny) {
          this.paint();
          return;
        }
      }

      if (this._dispatchMenuShortcut(e.key, e)) {
        this.paint();
        return;
      }

      if (this.focused && this.focused.visible && this.focused.isEnabled()) {
        if (this.focused.onKeyDown) {
          this.focused.onKeyDown(e.key, e);
        }
        this.paint();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this._getMousePos(e);

      if (this._activePopupMenu && this._activePopupMenu.isOpen) {
        this._activePopupMenu.handlePopupMouseMove(x, y, this.ctx, this);
        this.paint();
        return;
      }

      for (let i = this.components.length - 1; i >= 0; i--) {
        const comp = this.components[i];
        if (comp instanceof Frame && comp.menuBar && comp.menuBar.activeMenu && comp.menuBar.activeMenu.isOpen) {
          comp.menuBar.handleMouseMove(x, y, this.ctx, this);
          this.paint();
          return;
        }
      }

      if (this.dragTarget) {
        if (this.dragTarget.isEnabled() && this.dragTarget.onMouseMove) {
          this.dragTarget.onMouseMove(x, y, e);
        }
        this.paint();
        return;
      }

      const found = this._findComponent(this.components, x, y);
      if (found !== this.hovered) {
        if (this.hovered && this.hovered.onMouseLeave) {
          this.hovered.onMouseLeave(new MouseEvent(this.hovered, MouseEvent.MOUSE_EXITED, x, y));
        }
        this.hovered = found;
        if (this.hovered && this.hovered.onMouseEnter) {
          this.hovered.onMouseEnter(new MouseEvent(this.hovered, MouseEvent.MOUSE_ENTERED, x, y));
        }
        this._syncCursor();
        this.paint();
      } else {
        if (this.hovered && this.hovered.onMouseMove) {
          this.hovered.onMouseMove(x, y, e);
        }
        this._syncCursor();
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = this._getMousePos(e);

      // Handle active standalone PopupMenu first
      if (this._activePopupMenu && this._activePopupMenu.isOpen) {
        const res = this._activePopupMenu.handlePopupMouseDown(x, y, this.ctx, this);
        if (res.handled) {
          if (res.selected) {
            this._activePopupMenu.hide();
          }
          this.paint();
          return;
        } else {
          this._activePopupMenu.hide();
          this.paint();
        }
      }

      // Check top-to-bottom for Frame menuBars & open popups
      for (let i = this.components.length - 1; i >= 0; i--) {
        const comp = this.components[i];
        if (!comp.visible) continue;
        if (comp instanceof Frame && comp.menuBar) {
          if (comp.menuBar.activeMenu && comp.menuBar.activeMenu.isOpen) {
            this._raiseEnclosingWindow(comp);
            comp.menuBar.handleMouseDown(x, y, this.ctx, this);
            this.paint();
            return;
          }
          if (comp.isHit(x, y) && comp.menuBar.isHit(x, y, this.ctx)) {
            this._raiseEnclosingWindow(comp);
            comp.menuBar.handleMouseDown(x, y, this.ctx, this);
            this.paint();
            return;
          }
        }
      }

      const hit = this._findComponent(this.components, x, y);
      this._raiseEnclosingWindow(hit);
      this.dragTarget = hit;
      this._setFocus(hit && hit.focusable ? hit : null);
      if (this.dragTarget && this.dragTarget.isEnabled() && this.dragTarget.onMouseDown) {
        this.dragTarget.onMouseDown(x, y, e);
      }
      this.paint();
    });

    const handleRelease = (e) => {
      const { x, y } = this._getMousePos(e);
      if (this.dragTarget) {
        if (this.dragTarget.onMouseUp) {
          this.dragTarget.onMouseUp(x, y, e);
        }
        this.dragTarget = null;
        this.paint();
      }
    };

    this.canvas.addEventListener('mouseup', handleRelease);
    window.addEventListener('mouseup', handleRelease);

    this.canvas.addEventListener('click', (e) => {
      const { x, y } = this._getMousePos(e);
      for (let i = this.components.length - 1; i >= 0; i--) {
        const comp = this.components[i];
        if (comp instanceof Frame && comp.menuBar && comp.menuBar.isHit(x, y, this.ctx)) {
          return;
        }
      }
      const comp = this._findComponent(this.components, x, y);
      if (comp && comp.isEnabled() && comp.handleClick) {
        comp.handleClick(x, y, e);
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        const { x, y } = this._getMousePos(e);
        const target = this._findScrollTarget(this.components, x, y);
        if (target && target.isEnabled() && typeof target.onMouseWheel === 'function') {
          e.preventDefault();
          target.onMouseWheel(e.deltaX, e.deltaY, e);
          this.paint();
        }
      },
      { passive: false }
    );
  }

  _dispatchMenuShortcut(key, e) {
    if (this._activePopupMenu && this._activePopupMenu.isOpen) {
      const match = this._activePopupMenu._findShortcutMatch(key, e);
      if (match) {
        match.select();
        this._activePopupMenu.hide();
        return true;
      }
    }
    for (let i = this.components.length - 1; i >= 0; i--) {
      const comp = this.components[i];
      if (comp instanceof Frame && comp.menuBar) {
        const match = comp.menuBar._findShortcutMatch(key, e);
        if (match) {
          match.select();
          comp.menuBar.closeAllMenus();
          return true;
        }
      }
    }
    return false;
  }

  _raiseEnclosingWindow(comp) {
    let curr = comp;
    while (curr) {
      if (curr instanceof Window && typeof curr.toFront === 'function') {
        curr.toFront();
        break;
      }
      curr = curr.parent;
    }
  }

  _applyFont() {
    if (!this.ctx.font || this.ctx.font === '10px sans-serif') {
      this.ctx.font = '14px sans-serif';
    }
  }

  _syncCursor() {
    if (this.hovered && this.hovered.visible && this.hovered.isEnabled()) {
      const activeCursor =
        typeof this.hovered.getCursor === 'function' ? this.hovered.getCursor() : this.hovered.cursor;
      this.toolkit.setCursor(this, activeCursor || 'default');
    } else {
      this.toolkit.setCursor(this, 'default');
    }
  }

  _setFocus(nextComp) {
    const prev = this.focused;
    if (prev === nextComp) return;
    this.focused = nextComp;
    if (prev && prev.onFocusLost) {
      prev.onFocusLost(new FocusEvent(prev, FocusEvent.FOCUS_LOST, nextComp));
    }
    if (nextComp && nextComp.onFocusGained) {
      nextComp.onFocusGained(new FocusEvent(nextComp, FocusEvent.FOCUS_GAINED, prev));
    }
  }

  _findComponent(comps, x, y) {
    for (let i = comps.length - 1; i >= 0; i--) {
      const comp = comps[i];
      if (!comp.visible) continue;
      if (comp.children && comp.children.length > 0) {
        const childHit = this._findComponent(comp.children, x, y);
        if (childHit) return childHit;
      }
      if (comp.isHit(x, y)) {
        return comp;
      }
    }
    return null;
  }

  _findScrollTarget(comps, x, y) {
    for (let i = comps.length - 1; i >= 0; i--) {
      const comp = comps[i];
      if (!comp.visible) continue;
      if (comp.children && comp.children.length > 0) {
        const childTarget = this._findScrollTarget(comp.children, x, y);
        if (childTarget) return childTarget;
      }
      if (comp.isHit(x, y) && (comp instanceof ScrollPane || comp instanceof TextArea || comp instanceof TextField)) {
        return comp;
      }
    }
    return null;
  }

  setTheme(name) {
    if (Themes[name]) {
      this.theme = name;
      this.paint();
    }
  }

  _getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height ? this.canvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  add(comp) {
    comp.parent = null;
    comp.stage = this;
    if (!this.components.includes(comp)) {
      this.components.push(comp);
    }
    if (comp instanceof Window && typeof comp.fireWindowEvent === 'function') {
      comp.fireWindowEvent(WindowEvent.WINDOW_OPENED);
    }
    this.paint();
    return comp;
  }

  remove(comp) {
    const idx = this.components.indexOf(comp);
    if (idx !== -1) {
      this.components.splice(idx, 1);
      comp.parent = null;
      comp._stage = null;
      if (this.focused === comp) this.focused = null;
      if (this.hovered === comp) this.hovered = null;
      this.paint();
    }
  }

  schedulePaint() {
    if (this._isPainting || this._paintScheduled) return;
    this._paintScheduled = true;
    const flush = () => {
      this._paintScheduled = false;
      this.paint();
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(flush);
    } else {
      setTimeout(flush, 0);
    }
  }

  paint() {
    if (this._isPainting) return;
    this._isPainting = true;
    try {
      this._applyFont();
      const t = Themes[this.theme] || Themes.dark;
      this.ctx.save();
      this.ctx.fillStyle = t.bg;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      for (const comp of this.components) {
        if (comp.visible) {
          if (!comp.valid && typeof comp.validate === 'function') {
            comp.validate();
          }
          comp.paint(this.graphics);
        }
      }
      // Draw open Frame menu popups on top of windows
      for (const comp of this.components) {
        if (comp.visible && comp instanceof Frame && comp.menuBar) {
          comp.menuBar.drawOpenPopups(this.graphics.ctx, t, this);
        }
      }
      // Draw standalone PopupMenu at very top
      if (this._activePopupMenu && this._activePopupMenu.isOpen) {
        this._activePopupMenu.drawPopup(this.graphics.ctx, t, this);
      }
      this.ctx.restore();
    } finally {
      this._isPainting = false;
    }
  }
}

export class Container extends Component {
  constructor(x = 0, y = 0, w = 100, h = 100, layout = null) {
    super(x, y, w, h);
    this.children = [];
    this.layout = layout;
  }

  setLayout(layout) {
    this.layout = layout;
    this.invalidate();
    this.repaint();
  }

  getInsets() {
    return { top: 4, left: 4, right: 4, bottom: 4 };
  }

  getChildScreenOrigin() {
    return this.locationOnScreen;
  }

  add(comp, constraints = null) {
    if (comp.parent && comp.parent !== this) {
      comp.parent.remove(comp);
    }
    comp.parent = this;
    comp.stage = this.stage;
    if (!this.children.includes(comp)) {
      this.children.push(comp);
    }
    if (this.layout && typeof this.layout.addLayoutComponent === 'function' && constraints !== null) {
      this.layout.addLayoutComponent(constraints, comp);
    }
    this.invalidate();
    this.repaint();
    return comp;
  }

  remove(comp) {
    const idx = this.children.indexOf(comp);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      if (this.layout && typeof this.layout.removeLayoutComponent === 'function') {
        this.layout.removeLayoutComponent(comp);
      }
      comp.parent = null;
      comp._stage = null;
      this.invalidate();
      this.repaint();
    }
  }

  doLayout() {
    if (this.layout && typeof this.layout.layoutContainer === 'function') {
      this.layout.layoutContainer(this);
    }
  }

  validate() {
    if (!this.valid) {
      this.valid = true;
      this.doLayout();
      for (const child of this.children) {
        if (!child.valid && typeof child.validate === 'function') {
          child.validate();
        }
      }
    }
  }

  draw(ctx) {
    const t = this.theme;
    const { x, y } = this.locationOnScreen;
    ctx.fillStyle = t.panel;
    ctx.fillRect(x, y, this.w, this.h);
    ctx.strokeStyle = t.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, this.w, this.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, Math.max(0, this.w - 2), Math.max(0, this.h - 2));
    ctx.clip();

    for (const child of this.children) {
      if (!child.visible) continue;
      ctx.save();
      child.draw(ctx);
      ctx.restore();
    }
    ctx.restore();
  }
}

export class Panel extends Container {
  constructor(x = 0, y = 0, w = 100, h = 100, layout = null) {
    super(x, y, w, h, layout);
  }
}

export class ScrollPane extends Container {
  static SCROLLBARS_AS_NEEDED = 0;
  static SCROLLBARS_ALWAYS = 1;
  static SCROLLBARS_NEVER = 2;
  static BAR_SIZE = 14;

  constructor(x = 0, y = 0, w = 180, h = 140, scrollbarDisplayPolicy = ScrollPane.SCROLLBARS_AS_NEEDED, layout = null) {
    super(x, y, w, h, layout || null);
    this.scrollbarDisplayPolicy = scrollbarDisplayPolicy;
    this.scrollX = 0;
    this.scrollY = 0;
    this._draggingBar = null; // 'v' | 'h' | null
    this._dragStartMouse = { x: 0, y: 0 };
    this._dragStartScroll = { x: 0, y: 0 };
    this._justDragged = false;
    this._hoverBar = null; // 'v' | 'h' | null
    this.cursor = 'default';
  }

  getCursor() {
    if (this._draggingBar || this._hoverBar) return 'default';
    return this.cursor || 'default';
  }

  getChildScreenOrigin() {
    const { x, y } = this.locationOnScreen;
    return {
      x: x - this.scrollX,
      y: y - this.scrollY
    };
  }

  add(comp, constraints = null) {
    // Java AWT ScrollPane manages a single child component
    for (const existing of [...this.children]) {
      if (existing !== comp) {
        super.remove(existing);
      }
    }
    return super.add(comp, constraints);
  }

  doLayout() {
    const child = this.children[0];
    if (!child || !child.visible) return;
    const pref = child.getPreferredSize ? child.getPreferredSize() : { width: child.w || 100, height: child.h || 100 };
    const metrics = this._getScrollbarMetrics();
    const w = Math.max(metrics.viewW, pref.width);
    const h = Math.max(metrics.viewH, pref.height);
    child.setBounds(0, 0, w, h);
    if (this.layout && typeof this.layout.layoutContainer === 'function') {
      this.layout.layoutContainer(this);
    }
  }

  _getContentSize() {
    const child = this.children[0];
    if (!child || !child.visible) {
      return { width: 0, height: 0 };
    }
    const pref = child.getPreferredSize ? child.getPreferredSize() : { width: child.w || 80, height: child.h || 24 };
    const cw = Math.max(child.w || 0, pref.width);
    const ch = Math.max(child.h || 0, pref.height);
    return { width: cw, height: ch };
  }

  _getScrollbarMetrics() {
    const bar = ScrollPane.BAR_SIZE;
    const content = this._getContentSize();
    const innerW = Math.max(0, this.w - 2);
    const innerH = Math.max(0, this.h - 2);

    let showV = false;
    let showH = false;

    if (this.scrollbarDisplayPolicy === ScrollPane.SCROLLBARS_ALWAYS) {
      showV = true;
      showH = true;
    } else if (this.scrollbarDisplayPolicy === ScrollPane.SCROLLBARS_AS_NEEDED) {
      showV = content.height > innerH;
      showH = content.width > innerW;
      if (showV && !showH && content.width > innerW - bar) showH = true;
      if (showH && !showV && content.height > innerH - bar) showV = true;
    }

    const viewW = Math.max(0, innerW - (showV ? bar : 0));
    const viewH = Math.max(0, innerH - (showH ? bar : 0));
    const maxScrollX = Math.max(0, content.width - viewW);
    const maxScrollY = Math.max(0, content.height - viewH);

    return { bar, content, showV, showH, viewW, viewH, maxScrollX, maxScrollY };
  }

  _clampScroll() {
    const { maxScrollX, maxScrollY } = this._getScrollbarMetrics();
    this.scrollX = Math.max(0, Math.min(maxScrollX, this.scrollX));
    this.scrollY = Math.max(0, Math.min(maxScrollY, this.scrollY));
  }

  setScrollPosition(x, y) {
    this.scrollX = x;
    this.scrollY = y;
    this._clampScroll();
    this.repaint();
  }

  validate() {
    if (!this.valid) {
      this.valid = true;
      this.doLayout();
      for (const child of this.children) {
        if (!child.valid && typeof child.validate === 'function') {
          child.validate();
        }
      }
      this._clampScroll();
    }
  }

  _getVThumbRect(metrics) {
    const { x, y } = this.locationOnScreen;
    const trackX = x + this.w - metrics.bar - 1;
    const trackY = y + 1;
    const trackH = Math.max(10, metrics.viewH);
    const ratio = metrics.content.height > 0 ? Math.min(1, metrics.viewH / metrics.content.height) : 1;
    const thumbH = Math.max(20, Math.floor(trackH * ratio));
    const scrollableH = Math.max(1, trackH - thumbH);
    const thumbY =
      metrics.maxScrollY > 0
        ? trackY + Math.round((this.scrollY / metrics.maxScrollY) * scrollableH)
        : trackY;
    return { trackX, trackY, trackW: metrics.bar, trackH, thumbX: trackX + 2, thumbY, thumbW: metrics.bar - 4, thumbH, scrollableH };
  }

  _getHThumbRect(metrics) {
    const { x, y } = this.locationOnScreen;
    const trackX = x + 1;
    const trackY = y + this.h - metrics.bar - 1;
    const trackW = Math.max(10, metrics.viewW);
    const ratio = metrics.content.width > 0 ? Math.min(1, metrics.viewW / metrics.content.width) : 1;
    const thumbW = Math.max(20, Math.floor(trackW * ratio));
    const scrollableW = Math.max(1, trackW - thumbW);
    const thumbX =
      metrics.maxScrollX > 0
        ? trackX + Math.round((this.scrollX / metrics.maxScrollX) * scrollableW)
        : trackX;
    return { trackX, trackY, trackW, trackH: metrics.bar, thumbX, thumbY: trackY + 2, thumbW, thumbH: metrics.bar - 4, scrollableW };
  }

  onMouseDown(screenX, screenY, e) {
    this._justDragged = false;
    const metrics = this._getScrollbarMetrics();
    if (metrics.showV) {
      const vt = this._getVThumbRect(metrics);
      if (screenX >= vt.trackX && screenX <= vt.trackX + vt.trackW && screenY >= vt.trackY && screenY <= vt.trackY + vt.trackH) {
        if (screenY >= vt.thumbY && screenY <= vt.thumbY + vt.thumbH) {
          this._draggingBar = 'v';
          this._dragStartMouse = { x: screenX, y: screenY };
          this._dragStartScroll = { x: this.scrollX, y: this.scrollY };
        } else {
          const step = Math.max(24, Math.floor(metrics.viewH * 0.8));
          this.setScrollPosition(this.scrollX, this.scrollY + (screenY < vt.thumbY ? -step : step));
        }
        return;
      }
    }

    if (metrics.showH) {
      const ht = this._getHThumbRect(metrics);
      if (screenX >= ht.trackX && screenX <= ht.trackX + ht.trackW && screenY >= ht.trackY && screenY <= ht.trackY + ht.trackH) {
        if (screenX >= ht.thumbX && screenX <= ht.thumbX + ht.thumbW) {
          this._draggingBar = 'h';
          this._dragStartMouse = { x: screenX, y: screenY };
          this._dragStartScroll = { x: this.scrollX, y: this.scrollY };
        } else {
          const step = Math.max(24, Math.floor(metrics.viewW * 0.8));
          this.setScrollPosition(this.scrollX + (screenX < ht.thumbX ? -step : step), this.scrollY);
        }
        return;
      }
    }

    super.onMouseDown(screenX, screenY, e);
  }

  onMouseMove(screenX, screenY, e) {
    if (this._draggingBar === 'v') {
      this._justDragged = true;
      const metrics = this._getScrollbarMetrics();
      const vt = this._getVThumbRect(metrics);
      const dy = screenY - this._dragStartMouse.y;
      const deltaScroll = vt.scrollableH > 0 ? (dy / vt.scrollableH) * metrics.maxScrollY : 0;
      this.setScrollPosition(this.scrollX, this._dragStartScroll.y + deltaScroll);
      return;
    }
    if (this._draggingBar === 'h') {
      this._justDragged = true;
      const metrics = this._getScrollbarMetrics();
      const ht = this._getHThumbRect(metrics);
      const dx = screenX - this._dragStartMouse.x;
      const deltaScroll = ht.scrollableW > 0 ? (dx / ht.scrollableW) * metrics.maxScrollX : 0;
      this.setScrollPosition(this._dragStartScroll.x + deltaScroll, this.scrollY);
      return;
    }

    const metrics = this._getScrollbarMetrics();
    let nextHover = null;
    if (metrics.showV) {
      const vt = this._getVThumbRect(metrics);
      if (screenX >= vt.trackX && screenX <= vt.trackX + vt.trackW && screenY >= vt.trackY && screenY <= vt.trackY + vt.trackH) {
        nextHover = 'v';
      }
    }
    if (!nextHover && metrics.showH) {
      const ht = this._getHThumbRect(metrics);
      if (screenX >= ht.trackX && screenX <= ht.trackX + ht.trackW && screenY >= ht.trackY && screenY <= ht.trackY + ht.trackH) {
        nextHover = 'h';
      }
    }
    if (nextHover !== this._hoverBar) {
      this._hoverBar = nextHover;
      this.repaint();
    }

    super.onMouseMove(screenX, screenY, e);
  }

  onMouseLeave(e) {
    if (this._hoverBar) {
      this._hoverBar = null;
      this.repaint();
    }
    super.onMouseLeave(e);
  }

  onMouseUp(screenX, screenY, e) {
    this._draggingBar = null;
    super.onMouseUp(screenX, screenY, e);
  }

  handleClick(x, y, e) {
    if (this._justDragged) {
      this._justDragged = false;
      return;
    }
    super.handleClick(x, y, e);
  }

  onMouseWheel(deltaX, deltaY, e) {
    if (this.scrollbarDisplayPolicy === ScrollPane.SCROLLBARS_NEVER) return;
    this.setScrollPosition(this.scrollX + deltaX, this.scrollY + deltaY);
    super.onMouseWheel(deltaX, deltaY, e);
  }

  draw(ctx) {
    const t = this.theme;
    const metrics = this._getScrollbarMetrics();
    const { x, y } = this.locationOnScreen;

    ctx.fillStyle = t.panel;
    ctx.fillRect(x, y, this.w, this.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, Math.max(0, metrics.viewW), Math.max(0, metrics.viewH));
    ctx.clip();

    for (const child of this.children) {
      if (!child.visible) continue;
      ctx.save();
      child.draw(ctx);
      ctx.restore();
    }
    ctx.restore();

    if (metrics.showV) {
      const vt = this._getVThumbRect(metrics);
      ctx.fillStyle = t.scrollbarTrack || t.bg;
      ctx.fillRect(vt.trackX, vt.trackY, vt.trackW, vt.trackH);
      ctx.fillStyle =
        this._draggingBar === 'v' || this._hoverBar === 'v'
          ? t.scrollbarThumbHover || t.btnHover
          : t.scrollbarThumb || t.btn;
      ctx.fillRect(vt.thumbX, vt.thumbY, vt.thumbW, vt.thumbH);
    }

    if (metrics.showH) {
      const ht = this._getHThumbRect(metrics);
      ctx.fillStyle = t.scrollbarTrack || t.bg;
      ctx.fillRect(ht.trackX, ht.trackY, ht.trackW, ht.trackH);
      ctx.fillStyle =
        this._draggingBar === 'h' || this._hoverBar === 'h'
          ? t.scrollbarThumbHover || t.btnHover
          : t.scrollbarThumb || t.btn;
      ctx.fillRect(ht.thumbX, ht.thumbY, ht.thumbW, ht.thumbH);
    }

    if (metrics.showV && metrics.showH) {
      ctx.fillStyle = t.panel;
      ctx.fillRect(x + 1 + metrics.viewW, y + 1 + metrics.viewH, metrics.bar, metrics.bar);
    }

    ctx.strokeStyle = this.hasFocus ? t.btnHover : t.border;
    ctx.lineWidth = this.hasFocus ? 2 : 1;
    ctx.strokeRect(x, y, this.w, this.h);
    ctx.lineWidth = 1;
  }
}

export class Window extends Container {
  constructor(x = 50, y = 50, w = 200, h = 150, layout = null) {
    super(x, y, w, h, layout);
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.alwaysOnTop = false;
    this.ownedWindows = [];
    this._windowListeners = [];
  }

  addWindowListener(fn) {
    this._windowListeners.push(fn);
  }

  removeWindowListener(fn) {
    this._windowListeners = this._windowListeners.filter((l) => l !== fn);
  }

  fireWindowEvent(id, oppositeWindow = null) {
    const evt = new WindowEvent(this, id, oppositeWindow);
    this._windowListeners.forEach((fn) => fn(evt));
    return evt;
  }

  toFront() {
    const list = this.parent ? this.parent.children : this.stage ? this.stage.components : null;
    if (!Array.isArray(list)) return false;
    const idx = list.indexOf(this);
    if (idx === -1) return false;

    list.splice(idx, 1);
    if (this.alwaysOnTop) {
      list.push(this);
    } else {
      let insertAt = list.length;
      while (insertAt > 0 && list[insertAt - 1] instanceof Window && list[insertAt - 1].alwaysOnTop) {
        insertAt--;
      }
      list.splice(insertAt, 0, this);
    }

    if (idx !== list.length - 1) {
      this.repaint();
      return true;
    }
    return false;
  }

  toBack() {
    const list = this.parent ? this.parent.children : this.stage ? this.stage.components : null;
    if (!Array.isArray(list)) return false;
    const idx = list.indexOf(this);
    if (idx === -1 || idx === 0) return false;

    list.splice(idx, 1);
    list.unshift(this);
    this.repaint();
    return true;
  }

  setAlwaysOnTop(alwaysOnTop) {
    this.alwaysOnTop = !!alwaysOnTop;
    this.toFront();
    this.repaint();
  }

  isAlwaysOnTop() {
    return this.alwaysOnTop;
  }

  getInsets() {
    return { top: 4, left: 4, right: 4, bottom: 4 };
  }

  getChildScreenOrigin() {
    return this.locationOnScreen;
  }

  pack() {
    this.doLayout();
    const insets = this.getInsets();
    let maxRight = 140;
    let maxBottom = insets.top + 40;
    for (const child of this.children) {
      if (!child.visible) continue;
      maxRight = Math.max(maxRight, child.x + child.w + insets.right + 8);
      maxBottom = Math.max(maxBottom, child.y + child.h + insets.bottom + 8);
    }
    this.w = Math.max(this.w, maxRight);
    this.h = Math.max(this.h, maxBottom);
    this.invalidate();
    this.repaint();
  }

  dispose() {
    for (const owned of [...this.ownedWindows]) {
      if (typeof owned.dispose === 'function') {
        owned.dispose();
      }
    }
    this.visible = false;
    if (this.parent && typeof this.parent.remove === 'function') {
      this.parent.remove(this);
    } else if (this.stage && typeof this.stage.remove === 'function') {
      this.stage.remove(this);
    }
    this.fireWindowEvent(WindowEvent.WINDOW_CLOSED);
  }

  onMouseDown(x, y, e) {
    this.toFront();
    super.onMouseDown(x, y, e);
  }

  draw(ctx) {
    if (!this.visible) return;
    const t = this.theme;
    const { x, y } = this.locationOnScreen;

    ctx.fillStyle = t.winBody;
    ctx.fillRect(x, y, this.w, this.h);

    ctx.strokeStyle = t.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, this.w, this.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, Math.max(0, this.w - 2), Math.max(0, this.h - 2));
    ctx.clip();

    for (const child of this.children) {
      if (!child.visible) continue;
      ctx.save();
      child.draw(ctx);
      ctx.restore();
    }
    ctx.restore();
  }
}

export class Frame extends Window {
  static TITLE_BAR_HEIGHT = 25;
  static DEFAULT_CURSOR = 'default';
  static RESIZE_HANDLE_SIZE = 10;
  static MIN_WIDTH = 120;
  static MIN_HEIGHT = 70;

  constructor(title = '', x = 50, y = 50, w = 240, h = 180, layout = null) {
    let resolvedTitle = '';
    let rx = x;
    let ry = y;
    let rw = w;
    let rh = h;
    let rLayout = layout;

    if (typeof title === 'number' && typeof x === 'number') {
      rx = title;
      ry = x;
      rw = typeof y === 'number' ? y : 240;
      rh = typeof w === 'number' ? w : 180;
      resolvedTitle = typeof h === 'string' ? h : 'Frame';
      rLayout = arguments[5] ?? null;
    } else {
      resolvedTitle = title != null ? String(title) : '';
    }

    super(rx, ry, rw, rh, rLayout);
    this.title = resolvedTitle;
    this.resizable = true;
    this.undecorated = false;
    this.minimized = false;
    this.maximized = false;
    this._normalBounds = null;
    this._normalHeightBeforeMinimize = null;
    this.isResizing = false;
    this.resizeStart = { mouseX: 0, mouseY: 0, w: 0, h: 0 };
    this._hoverControl = null; // 'min' | 'max' | 'close' | null
    this.menuBar = null;
  }

  getMenuBar() {
    return this.menuBar;
  }

  setMenuBar(mb) {
    if (this.menuBar && this.menuBar !== mb) {
      this.menuBar.frame = null;
      this.menuBar.closeAllMenus();
    }
    if (mb instanceof MenuBar) {
      this.menuBar = mb;
      mb.frame = this;
    } else {
      this.menuBar = null;
    }
    this.invalidate();
    this.repaint();
  }

  removeMenuBar() {
    this.setMenuBar(null);
  }

  _getMenuBarOffset() {
    if (!this.undecorated && !this.minimized && this.menuBar && this.menuBar.getMenuCount() > 0) {
      return MenuBar.BAR_HEIGHT;
    }
    return 0;
  }

  getTitle() {
    return this.title;
  }

  setTitle(title) {
    this.title = title != null ? String(title) : '';
    this.repaint();
  }

  isResizable() {
    return this.resizable;
  }

  setResizable(resizable) {
    this.resizable = !!resizable;
    this.repaint();
  }

  isUndecorated() {
    return this.undecorated;
  }

  setUndecorated(undecorated) {
    this.undecorated = !!undecorated;
    this.invalidate();
    this.repaint();
  }

  isMinimized() {
    return this.minimized;
  }

  isMaximized() {
    return this.maximized;
  }

  minimize() {
    if (this.undecorated) return;
    if (this.menuBar) this.menuBar.closeAllMenus();
    if (!this.minimized) {
      if (this.maximized) {
        this.restore();
      }
      this._normalHeightBeforeMinimize = this.h;
      this.minimized = true;
      this.h = Frame.TITLE_BAR_HEIGHT;
      this.fireWindowEvent(WindowEvent.WINDOW_ICONIFIED);
      this.invalidate();
      this.repaint();
    } else {
      this.restore();
    }
  }

  maximize() {
    if (this.undecorated || !this.resizable) return;
    if (this.menuBar) this.menuBar.closeAllMenus();
    if (!this.maximized) {
      if (this.minimized) {
        this.minimized = false;
        if (this._normalHeightBeforeMinimize) {
          this.h = this._normalHeightBeforeMinimize;
        }
      }
      this._normalBounds = { x: this.x, y: this.y, w: this.w, h: this.h };
      const parentW = this.parent ? this.parent.w : this.stage && this.stage.canvas ? this.stage.canvas.width : this.w;
      const parentH = this.parent ? this.parent.h : this.stage && this.stage.canvas ? this.stage.canvas.height : this.h;
      this.maximized = true;
      this.setBounds(0, 0, Math.max(Frame.MIN_WIDTH, parentW), Math.max(Frame.MIN_HEIGHT, parentH));
      this.invalidate();
      this.repaint();
    } else {
      this.restore();
    }
  }

  restore() {
    if (this.minimized) {
      this.minimized = false;
      if (this._normalHeightBeforeMinimize) {
        this.h = this._normalHeightBeforeMinimize;
        this._normalHeightBeforeMinimize = null;
      }
      this.fireWindowEvent(WindowEvent.WINDOW_DEICONIFIED);
      this.invalidate();
      this.repaint();
      return;
    }
    if (this.maximized && this._normalBounds) {
      const { x, y, w, h } = this._normalBounds;
      this.maximized = false;
      this._normalBounds = null;
      this.setBounds(x, y, w, h);
      this.invalidate();
      this.repaint();
    }
  }

  getInsets() {
    if (this.undecorated) {
      return { top: 4, left: 4, right: 4, bottom: 4 };
    }
    if (this.minimized) {
      return { top: Frame.TITLE_BAR_HEIGHT, left: 0, right: 0, bottom: 0 };
    }
    const mbOff = this._getMenuBarOffset();
    return { top: Frame.TITLE_BAR_HEIGHT + mbOff + 4, left: 4, right: 4, bottom: 4 };
  }

  isHit(screenX, screenY) {
    if (!this.visible) return false;
    const { x, y } = this.locationOnScreen;
    const hitH = this.minimized && !this.undecorated ? Frame.TITLE_BAR_HEIGHT : this.h;
    return screenX >= x && screenX <= x + this.w && screenY >= y && screenY <= y + hitH;
  }

  isHitTitleBar(screenX, screenY) {
    if (this.undecorated) return false;
    const { x, y } = this.locationOnScreen;
    return (
      screenX >= x &&
      screenX <= x + this.w &&
      screenY >= y &&
      screenY <= y + Frame.TITLE_BAR_HEIGHT
    );
  }

  _getTitleBarControls() {
    const { x, y } = this.locationOnScreen;
    const size = 16;
    const gap = 4;
    const by = y + Math.floor((Frame.TITLE_BAR_HEIGHT - size) / 2);

    const closeRect = { x: x + this.w - size - 5, y: by, w: size, h: size };
    const maxRect = { x: closeRect.x - gap - size, y: by, w: size, h: size };
    const minRect = { x: maxRect.x - gap - size, y: by, w: size, h: size };

    return { minRect, maxRect, closeRect };
  }

  _hitControlAt(screenX, screenY) {
    if (this.undecorated) return null;
    const { minRect, maxRect, closeRect } = this._getTitleBarControls();
    const inside = (r) => screenX >= r.x && screenX <= r.x + r.w && screenY >= r.y && screenY <= r.y + r.h;
    if (inside(closeRect)) return 'close';
    if (inside(maxRect)) return 'max';
    if (inside(minRect)) return 'min';
    return null;
  }

  isHitCloseButton(screenX, screenY) {
    return this._hitControlAt(screenX, screenY) === 'close';
  }

  isHitMaximizeButton(screenX, screenY) {
    return this._hitControlAt(screenX, screenY) === 'max';
  }

  isHitMinimizeButton(screenX, screenY) {
    return this._hitControlAt(screenX, screenY) === 'min';
  }

  isHitResizeHandle(screenX, screenY) {
    if (!this.resizable || this.minimized || this.maximized || this.undecorated) return false;
    const { x, y } = this.locationOnScreen;
    const s = Frame.RESIZE_HANDLE_SIZE;
    return (
      screenX >= x + this.w - s &&
      screenX <= x + this.w + 2 &&
      screenY >= y + this.h - s &&
      screenY <= y + this.h + 2
    );
  }

  getCursor() {
    if (this.isResizing) return 'nwse-resize';
    if (this._hoverControl) return 'pointer';
    return super.getCursor ? super.getCursor() : 'default';
  }

  onMouseDown(x, y, e) {
    this.toFront();

    const ctrl = this._hitControlAt(x, y);
    if (ctrl === 'close') {
      if (this.menuBar) this.menuBar.closeAllMenus();
      const evt = this.fireWindowEvent(WindowEvent.WINDOW_CLOSING);
      if (!evt.isConsumed) {
        this.dispose();
      }
      return;
    }
    if (ctrl === 'min') {
      this.minimize();
      return;
    }
    if (ctrl === 'max') {
      this.maximize();
      return;
    }

    if (!this.minimized && this.menuBar && this.menuBar.isHit(x, y, this.stage ? this.stage.ctx : null)) {
      this.menuBar.handleMouseDown(x, y, this.stage ? this.stage.ctx : null, this.stage);
      return;
    }

    if (this.menuBar && this.menuBar.activeMenu) {
      this.menuBar.closeAllMenus();
    }

    if (this.isHitResizeHandle(x, y)) {
      this.isResizing = true;
      this.isDragging = false;
      this.resizeStart = { mouseX: x, mouseY: y, w: this.w, h: this.h };
      return;
    }

    if (this.isHitTitleBar(x, y) && !this.maximized) {
      const origin = this.locationOnScreen;
      this.isDragging = true;
      this.dragOffset = { x: x - origin.x, y: y - origin.y };
    }

    if (!this.minimized) {
      super.onMouseDown(x, y, e);
    }
  }

  onMouseMove(x, y, e) {
    if (this.isResizing) {
      if (this.menuBar) this.menuBar.closeAllMenus();
      const nextW = Math.max(Frame.MIN_WIDTH, this.resizeStart.w + (x - this.resizeStart.mouseX));
      const nextH = Math.max(Frame.MIN_HEIGHT, this.resizeStart.h + (y - this.resizeStart.mouseY));
      this.setBounds(this.x, this.y, nextW, nextH);
      this.repaint();
      return;
    }

    if (this.isDragging) {
      if (this.menuBar) this.menuBar.closeAllMenus();
      const parentOrigin =
        this.parent && typeof this.parent.getChildScreenOrigin === 'function'
          ? this.parent.getChildScreenOrigin()
          : { x: 0, y: 0 };
      this.x = x - this.dragOffset.x - parentOrigin.x;
      this.y = y - this.dragOffset.y - parentOrigin.y;
      this.repaint();
      return;
    }

    const nextCtrl = this._hitControlAt(x, y);
    if (nextCtrl !== this._hoverControl) {
      this._hoverControl = nextCtrl;
      this.repaint();
    }

    if (this.stage) {
      if (this.isHitResizeHandle(x, y)) {
        this.stage.toolkit.setCursor(this.stage, 'nwse-resize');
      } else if (nextCtrl) {
        this.stage.toolkit.setCursor(this.stage, 'pointer');
      } else {
        this.stage.toolkit.setCursor(this.stage, 'default');
      }
    }

    if (!this.minimized) {
      super.onMouseMove(x, y, e);
    }
  }

  onMouseUp(x, y, e) {
    this.isDragging = false;
    this.isResizing = false;
    if (this.stage) {
      this.stage._syncCursor();
    }
    super.onMouseUp(x, y, e);
  }

  draw(ctx) {
    if (!this.visible) return;
    if (this.undecorated) {
      super.draw(ctx);
      return;
    }

    const t = this.theme;
    const { x, y } = this.locationOnScreen;
    const titleH = Frame.TITLE_BAR_HEIGHT;
    const mbOff = this._getMenuBarOffset();
    const bodyTop = y + titleH + mbOff;

    ctx.save();

    // Title bar
    ctx.fillStyle = this.isDragging ? '#666' : t.winTitle;
    ctx.fillRect(x, y, this.w, titleH);

    // Title text vertically centered
    ctx.fillStyle = t.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, x + 8, y + titleH / 2);

    const { minRect, maxRect, closeRect } = this._getTitleBarControls();

    // Minimize button [-]
    ctx.fillStyle = this._hoverControl === 'min' ? t.btnHover : t.btn;
    ctx.fillRect(minRect.x, minRect.y, minRect.w, minRect.h);
    ctx.strokeStyle = t.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(minRect.x, minRect.y, minRect.w, minRect.h);
    ctx.strokeStyle = t.text;
    ctx.beginPath();
    ctx.moveTo(minRect.x + 4, minRect.y + minRect.h - 4);
    ctx.lineTo(minRect.x + minRect.w - 4, minRect.y + minRect.h - 4);
    ctx.stroke();

    // Maximize / Restore button [□]
    ctx.fillStyle = this._hoverControl === 'max' ? t.btnHover : t.btn;
    ctx.fillRect(maxRect.x, maxRect.y, maxRect.w, maxRect.h);
    ctx.strokeStyle = t.border;
    ctx.strokeRect(maxRect.x, maxRect.y, maxRect.w, maxRect.h);
    ctx.strokeStyle = t.text;
    if (this.maximized) {
      ctx.strokeRect(maxRect.x + 5, maxRect.y + 4, maxRect.w - 9, maxRect.h - 9);
      ctx.strokeRect(maxRect.x + 3.5, maxRect.y + 5.5, maxRect.w - 9, maxRect.h - 9);
    } else {
      ctx.strokeRect(maxRect.x + 4, maxRect.y + 4, maxRect.w - 8, maxRect.h - 8);
    }

    // Close button [x]
    ctx.fillStyle = this._hoverControl === 'close' ? t.btnHover : t.btn;
    ctx.fillRect(closeRect.x, closeRect.y, closeRect.w, closeRect.h);
    ctx.strokeStyle = t.border;
    ctx.strokeRect(closeRect.x, closeRect.y, closeRect.w, closeRect.h);
    ctx.strokeStyle = t.text;
    ctx.beginPath();
    ctx.moveTo(closeRect.x + 4, closeRect.y + 4);
    ctx.lineTo(closeRect.x + closeRect.w - 4, closeRect.y + closeRect.h - 4);
    ctx.moveTo(closeRect.x + closeRect.w - 4, closeRect.y + 4);
    ctx.lineTo(closeRect.x + 4, closeRect.y + closeRect.h - 4);
    ctx.stroke();

    if (!this.minimized) {
      // Frame body
      ctx.fillStyle = t.winBody;
      ctx.fillRect(x, bodyTop, this.w, Math.max(0, this.h - titleH - mbOff));

      // Menu bar if attached
      if (mbOff > 0 && this.menuBar) {
        this.menuBar.drawBar(ctx, t);
      }

      // Outer border
      ctx.strokeStyle = t.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, this.w, this.h);

      // Clipped children
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 1, bodyTop, Math.max(0, this.w - 2), Math.max(0, this.h - titleH - mbOff - 1));
      ctx.clip();

      for (const child of this.children) {
        if (!child.visible) continue;
        ctx.save();
        child.draw(ctx);
        ctx.restore();
      }
      ctx.restore();

      // Bottom-right resize grip when resizable
      if (this.resizable && !this.maximized) {
        ctx.strokeStyle = t.mutedText;
        ctx.beginPath();
        ctx.moveTo(x + this.w - 8, y + this.h - 3);
        ctx.lineTo(x + this.w - 3, y + this.h - 8);
        ctx.moveTo(x + this.w - 5, y + this.h - 3);
        ctx.lineTo(x + this.w - 3, y + this.h - 5);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = t.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, this.w, titleH);
    }

    ctx.restore();
  }
}

export class Button extends Component {
  constructor(x = 0, y = 0, w = 90, h = 30, label = 'Button', onClick = null) {
    super(x, y, w, h);
    this.label = label;
    this.actionCommand = label;
    this.onClick = onClick;
    this.isHovered = false;
    this.isPressed = false;
    this.cursor = 'pointer';
  }

  getLabel() {
    return this.label;
  }

  setLabel(label) {
    this.label = String(label ?? '');
    this.repaint();
  }

  getPreferredSize() {
    const measured = this.stage && this.stage.ctx ? this.stage.ctx.measureText(this.label).width : this.label.length * 8;
    return {
      width: Math.max(this.w || 0, Math.ceil(measured + 24)),
      height: Math.max(this.h || 0, 28)
    };
  }

  onMouseEnter(e) {
    this.isHovered = true;
    super.onMouseEnter(e);
  }

  onMouseLeave(e) {
    this.isHovered = false;
    this.isPressed = false;
    super.onMouseLeave(e);
  }

  onMouseDown(x, y, e) {
    if (this.isEnabled()) this.isPressed = true;
    super.onMouseDown(x, y, e);
  }

  onMouseUp(x, y, e) {
    this.isPressed = false;
    super.onMouseUp(x, y, e);
  }

  handleClick(x, y, e) {
    if (!this.isEnabled()) return;
    this._mouseListeners.forEach((fn) => fn(e || new MouseEvent(this, MouseEvent.MOUSE_CLICKED, x, y)));
    this.fireActionEvent(this.actionCommand || this.label);
  }

  draw(ctx) {
    const t = this.theme;
    const { x, y } = this.locationOnScreen;

    ctx.save();

    if (!this.isEnabled()) {
      ctx.fillStyle = t.disabled;
    } else if (this.isPressed) {
      ctx.fillStyle = t.btnActive || t.btnHover;
    } else if (this.isHovered) {
      ctx.fillStyle = t.btnHover;
    } else {
      ctx.fillStyle = t.btn;
    }

    ctx.fillRect(x, y, this.w, this.h);
    ctx.strokeStyle = this.hasFocus ? t.btnHover : t.border;
    ctx.lineWidth = this.hasFocus ? 2 : 1;
    ctx.strokeRect(x, y, this.w, this.h);
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.rect(x + 2, y + 2, Math.max(0, this.w - 4), Math.max(0, this.h - 4));
    ctx.clip();

    ctx.fillStyle = this.isEnabled() ? t.text : t.mutedText;
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(this.label).width;
    const drawX = x + Math.max(8, (this.w - textW) / 2);
    const drawY = y + this.h / 2;
    ctx.fillText(this.label, drawX, drawY);

    ctx.restore();
  }
}

export class Label extends Component {
  static LEFT = 'left';
  static CENTER = 'center';
  static RIGHT = 'right';

  constructor(x = 0, y = 0, text = '', alignment = Label.LEFT) {
    super(x, y, 100, 20);
    this.text = text;
    this.alignment = alignment;
    this.focusable = false;
  }

  getText() {
    return this.text;
  }

  setText(val) {
    this.text = String(val ?? '');
    this.invalidate();
    this.repaint();
  }

  getAlignment() {
    return this.alignment;
  }

  setAlignment(alignment) {
    this.alignment = alignment;
    this.repaint();
  }

  getPreferredSize() {
    const width = this.stage && this.stage.ctx
      ? Math.max(40, Math.ceil(this.stage.ctx.measureText(this.text).width + 8))
      : Math.max(40, this.text.length * 8 + 8);
    return { width, height: Math.max(20, this.h || 20) };
  }

  draw(ctx) {
    const t = this.theme;
    const { x, y } = this.locationOnScreen;
    ctx.save();
    ctx.fillStyle = this.isEnabled() ? t.text : t.mutedText;
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(this.text).width;
    let drawX = x + 2;
    if (this.alignment === Label.CENTER) {
      drawX = x + Math.max(0, (this.w - textW) / 2);
    } else if (this.alignment === Label.RIGHT) {
      drawX = x + Math.max(0, this.w - textW - 2);
    }
    const drawY = y + this.h / 2;
    ctx.fillText(this.text, drawX, drawY);
    ctx.restore();
  }
}

export class TextField extends Component {
  constructor(x = 0, y = 0, w = 140, h = 28, text = '') {
    super(x, y, w, h);
    this.text = String(text);
    this.cursorPos = this.text.length;
    this.scrollX = 0;
    this.paddingX = 6;
    this.cursor = 'text';
    this._textListeners = [];
  }

  getText() {
    return this.text;
  }

  setText(val) {
    this.text = String(val ?? '');
    this.cursorPos = Math.min(this.cursorPos, this.text.length);
    this.scrollX = 0;
    this.repaint();
  }

  addTextListener(fn) {
    this._textListeners.push(fn);
  }

  _emitTextChange() {
    this._textListeners.forEach((fn) => fn(this.text, this));
    if (this.onChange) this.onChange(this.text);
  }

  _measureText(ctx, str) {
    if (ctx && typeof ctx.measureText === 'function') {
      return ctx.measureText(str).width;
    }
    if (this.stage && this.stage.ctx) {
      return this.stage.ctx.measureText(str).width;
    }
    return str.length * 8;
  }

  _ensureCaretVisible(ctx = null) {
    const innerW = Math.max(10, this.w - this.paddingX * 2);
    const beforeCursor = this.text.slice(0, this.cursorPos);
    const caretOffset = this._measureText(ctx, beforeCursor);
    const totalW = this._measureText(ctx, this.text);

    if (caretOffset - this.scrollX > innerW - 2) {
      this.scrollX = caretOffset - (innerW - 2);
    } else if (caretOffset - this.scrollX < 0) {
      this.scrollX = caretOffset;
    }

    const maxScrollX = Math.max(0, totalW - innerW);
    this.scrollX = Math.max(0, Math.min(maxScrollX, this.scrollX));
  }

  onMouseDown(screenX, screenY, e) {
    if (this.isEnabled()) {
      const { x } = this.locationOnScreen;
      const localX = screenX - (x + this.paddingX) + this.scrollX;
      const ctx = this.stage ? this.stage.ctx : null;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i <= this.text.length; i++) {
        const w = this._measureText(ctx, this.text.slice(0, i));
        const d = Math.abs(w - localX);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      this.cursorPos = bestIdx;
      this._ensureCaretVisible(ctx);
    }
    super.onMouseDown(screenX, screenY, e);
  }

  onMouseWheel(deltaX, deltaY, e) {
    const ctx = this.stage ? this.stage.ctx : null;
    const innerW = Math.max(10, this.w - this.paddingX * 2);
    const totalW = this._measureText(ctx, this.text);
    const maxScrollX = Math.max(0, totalW - innerW);
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    this.scrollX = Math.max(0, Math.min(maxScrollX, this.scrollX + delta));
    super.onMouseWheel(deltaX, deltaY, e);
  }

  onKeyDown(key, e) {
    if (!this.isEnabled()) return;
    if (key === 'Backspace') {
      if (this.cursorPos > 0) {
        this.text = this.text.slice(0, this.cursorPos - 1) + this.text.slice(this.cursorPos);
        this.cursorPos--;
        this._emitTextChange();
      }
    } else if (key === 'Delete') {
      if (this.cursorPos < this.text.length) {
        this.text = this.text.slice(0, this.cursorPos) + this.text.slice(this.cursorPos + 1);
        this._emitTextChange();
      }
    } else if (key === 'ArrowLeft') {
      this.cursorPos = Math.max(0, this.cursorPos - 1);
    } else if (key === 'ArrowRight') {
      this.cursorPos = Math.min(this.text.length, this.cursorPos + 1);
    } else if (key === 'Home') {
      this.cursorPos = 0;
    } else if (key === 'End') {
      this.cursorPos = this.text.length;
    } else if (key === 'Enter') {
      this.fireActionEvent(this.text);
    } else if (key && key.length === 1 && !(e && (e.ctrlKey || e.metaKey))) {
      this.text = this.text.slice(0, this.cursorPos) + key + this.text.slice(this.cursorPos);
      this.cursorPos++;
      this._emitTextChange();
    }
    this._ensureCaretVisible(this.stage ? this.stage.ctx : null);
    super.onKeyDown(key, e);
    this.repaint();
  }

  draw(ctx) {
    const t = this.theme;
    const focused = this.hasFocus;
    const { x, y } = this.locationOnScreen;

    this._ensureCaretVisible(ctx);

    ctx.fillStyle = this.isEnabled() ? t.bg : t.disabled;
    ctx.fillRect(x, y, this.w, this.h);

    ctx.strokeStyle = focused ? t.btnHover : t.border;
    ctx.lineWidth = focused ? 2 : 1;
    ctx.strokeRect(x, y, this.w, this.h);
    ctx.lineWidth = 1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, Math.max(0, this.w - 4), Math.max(0, this.h - 4));
    ctx.clip();

    const textX = x + this.paddingX - this.scrollX;
    const textY = y + Math.min(this.h - 6, Math.max(15, Math.floor(this.h / 2) + 5));
    ctx.fillStyle = this.isEnabled() ? t.text : t.mutedText;
    ctx.fillText(this.text, textX, textY);

    if (focused && this.isEnabled()) {
      const beforeCursor = this.text.slice(0, this.cursorPos);
      const caretX = textX + this._measureText(ctx, beforeCursor);
      ctx.strokeStyle = t.text;
      ctx.beginPath();
      ctx.moveTo(caretX, y + 5);
      ctx.lineTo(caretX, y + this.h - 5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class TextArea extends Component {
  static SCROLLBARS_BOTH = 0;
  static SCROLLBARS_VERTICAL_ONLY = 1;
  static SCROLLBARS_HORIZONTAL_ONLY = 2;
  static SCROLLBARS_NONE = 3;
  static BAR_SIZE = 14;

  constructor(text = '', rows = 5, columns = 20, scrollbars = TextArea.SCROLLBARS_BOTH) {
    let initialText = '';
    let initialRows = 5;
    let initialCols = 20;
    let initialScrollbars = TextArea.SCROLLBARS_BOTH;
    let x = 0;
    let y = 0;
    let w = 0;
    let h = 0;

    if (typeof text === 'number' && typeof rows === 'number') {
      x = text;
      y = rows;
      w = typeof columns === 'number' ? columns : 150;
      h = typeof scrollbars === 'number' ? scrollbars : 80;
      initialText = arguments.length >= 5 && arguments[4] != null ? String(arguments[4]) : '';
      initialRows = Math.max(1, Math.round(h / 20));
      initialCols = Math.max(4, Math.round(w / 8));
    } else {
      initialText = String(text ?? '');
      initialRows = Math.max(1, Number.isFinite(rows) ? rows : 5);
      initialCols = Math.max(1, Number.isFinite(columns) ? columns : 20);
      initialScrollbars = scrollbars;
    }

    super(x, y, w, h);
    this.text = initialText;
    this.rows = initialRows;
    this.columns = initialCols;
    this.scrollbarVisibility = initialScrollbars;
    this.editable = true;
    this.caretPosition = this.text.length;
    this.selectionStart = this.caretPosition;
    this.selectionEnd = this.caretPosition;
    this.scrollX = 0;
    this.scrollY = 0;
    this.lineHeight = 20;
    this.paddingX = 6;
    this.paddingY = 5;
    this.cursor = 'text';
    this._textListeners = [];
    this._selecting = false;
    this._draggingBar = null; // 'v' | 'h' | null
    this._dragStartMouse = { x: 0, y: 0 };
    this._dragStartScroll = { x: 0, y: 0 };
    this._hoverBar = null;

    const pref = this.getPreferredSize();
    if (!this.w) this.w = pref.width;
    if (!this.h) this.h = pref.height;
  }

  getCursor() {
    if (this._draggingBar || this._hoverBar) return 'default';
    return this.cursor || 'default';
  }

  get cursorPos() {
    return this.caretPosition;
  }

  set cursorPos(pos) {
    this.setCaretPosition(pos);
  }

  getText() {
    return this.text;
  }

  setText(val) {
    this.text = String(val ?? '');
    const clamped = Math.max(0, Math.min(this.text.length, this.caretPosition));
    this.caretPosition = clamped;
    this.selectionStart = clamped;
    this.selectionEnd = clamped;
    this._ensureCaretVisible(this.stage ? this.stage.ctx : null);
    this.invalidate();
    this.repaint();
  }

  append(str) {
    const addition = String(str ?? '');
    this.text += addition;
    this.caretPosition = this.text.length;
    this.selectionStart = this.caretPosition;
    this.selectionEnd = this.caretPosition;
    this._ensureCaretVisible(this.stage ? this.stage.ctx : null);
    this.invalidate();
    this.repaint();
  }

  insert(str, pos) {
    const idx = Math.max(0, Math.min(this.text.length, pos));
    const insertion = String(str ?? '');
    this.text = this.text.slice(0, idx) + insertion + this.text.slice(idx);
    this.caretPosition = idx + insertion.length;
    this.selectionStart = this.caretPosition;
    this.selectionEnd = this.caretPosition;
    this._ensureCaretVisible(this.stage ? this.stage.ctx : null);
    this.invalidate();
    this.repaint();
  }

  replaceRange(str, start, end) {
    const s = Math.max(0, Math.min(this.text.length, Math.min(start, end)));
    const eIdx = Math.max(0, Math.min(this.text.length, Math.max(start, end)));
    const replacement = String(str ?? '');
    this.text = this.text.slice(0, s) + replacement + this.text.slice(eIdx);
    this.caretPosition = s + replacement.length;
    this.selectionStart = this.caretPosition;
    this.selectionEnd = this.caretPosition;
    this._ensureCaretVisible(this.stage ? this.stage.ctx : null);
    this.invalidate();
    this.repaint();
  }

  getCaretPosition() {
    return this.caretPosition;
  }

  setCaretPosition(pos, extendSelection = false) {
    const clamped = Math.max(0, Math.min(this.text.length, pos));
    this.caretPosition = clamped;
    if (extendSelection) {
      this.selectionEnd = clamped;
    } else {
      this.selectionStart = clamped;
      this.selectionEnd = clamped;
    }
    this._ensureCaretVisible(this.stage ? this.stage.ctx : null);
    this.repaint();
  }

  getSelectionStart() {
    return Math.min(this.selectionStart, this.selectionEnd);
  }

  getSelectionEnd() {
    return Math.max(this.selectionStart, this.selectionEnd);
  }

  getSelectedText() {
    return this.text.slice(this.getSelectionStart(), this.getSelectionEnd());
  }

  select(start, end) {
    this.selectionStart = Math.max(0, Math.min(this.text.length, start));
    this.selectionEnd = Math.max(0, Math.min(this.text.length, end));
    this.caretPosition = this.selectionEnd;
    this._ensureCaretVisible(this.stage ? this.stage.ctx : null);
    this.repaint();
  }

  selectAll() {
    this.select(0, this.text.length);
  }

  setEditable(editable) {
    this.editable = !!editable;
    this.cursor = this.editable ? 'text' : 'default';
    this.repaint();
  }

  isEditable() {
    return this.editable && this.isEnabled();
  }

  getRows() {
    return this.rows;
  }

  setRows(rows) {
    this.rows = Math.max(1, rows);
    const pref = this.getPreferredSize();
    this.h = pref.height;
    this.invalidate();
    this.repaint();
  }

  getColumns() {
    return this.columns;
  }

  setColumns(columns) {
    this.columns = Math.max(1, columns);
    const pref = this.getPreferredSize();
    this.w = pref.width;
    this.invalidate();
    this.repaint();
  }

  addTextListener(fn) {
    this._textListeners.push(fn);
  }

  removeTextListener(fn) {
    this._textListeners = this._textListeners.filter((l) => l !== fn);
  }

  _emitTextChange() {
    this._textListeners.forEach((fn) => fn(this.text, this));
    if (this.onChange) this.onChange(this.text);
  }

  _measureText(ctx, str) {
    if (ctx && typeof ctx.measureText === 'function') {
      return ctx.measureText(str).width;
    }
    if (this.stage && this.stage.ctx) {
      return this.stage.ctx.measureText(str).width;
    }
    return str.length * 8;
  }

  _charWidth(ctx = null) {
    const w = this._measureText(ctx, 'M');
    return w > 0 ? w : 8;
  }

  getPreferredSize() {
    const ctx = this.stage && this.stage.ctx ? this.stage.ctx : null;
    const cw = this._charWidth(ctx);
    const barPad = this.scrollbarVisibility === TextArea.SCROLLBARS_NONE ? 0 : TextArea.BAR_SIZE;
    const w = Math.ceil(this.columns * cw) + this.paddingX * 2 + 8 + barPad;
    const h = this.rows * this.lineHeight + this.paddingY * 2 + 6 + barPad;
    return { width: w, height: h };
  }

  _getMetrics(ctx = null) {
    const lines = this.text.split('\n');
    let maxLineW = 0;
    for (const line of lines) {
      maxLineW = Math.max(maxLineW, this._measureText(ctx, line));
    }
    const contentW = Math.ceil(maxLineW) + this.paddingX * 2 + 8;
    const contentH = lines.length * this.lineHeight + this.paddingY * 2 + 4;

    const bar = TextArea.BAR_SIZE;
    const innerW = Math.max(0, this.w - 2);
    const innerH = Math.max(0, this.h - 2);

    const allowV =
      this.scrollbarVisibility === TextArea.SCROLLBARS_BOTH ||
      this.scrollbarVisibility === TextArea.SCROLLBARS_VERTICAL_ONLY;
    const allowH =
      this.scrollbarVisibility === TextArea.SCROLLBARS_BOTH ||
      this.scrollbarVisibility === TextArea.SCROLLBARS_HORIZONTAL_ONLY;

    let showV = allowV && contentH > innerH;
    let showH = allowH && contentW > innerW;
    if (showV && !showH && allowH && contentW > innerW - bar) showH = true;
    if (showH && !showV && allowV && contentH > innerH - bar) showV = true;

    const viewW = Math.max(0, innerW - (showV ? bar : 0));
    const viewH = Math.max(0, innerH - (showH ? bar : 0));
    const textViewW = Math.max(10, viewW - this.paddingX * 2);
    const textViewH = Math.max(this.lineHeight, viewH - this.paddingY * 2);

    const maxScrollX = allowH ? Math.max(0, contentW - this.paddingX * 2 - textViewW) : 0;
    const maxScrollY = allowV ? Math.max(0, contentH - this.paddingY * 2 - textViewH) : 0;

    return {
      bar,
      contentW,
      contentH,
      showV,
      showH,
      allowV,
      allowH,
      viewW,
      viewH,
      textViewW,
      textViewH,
      maxScrollX,
      maxScrollY
    };
  }

  _clampScroll(ctx = null) {
    const m = this._getMetrics(ctx);
    this.scrollX = Math.max(0, Math.min(m.maxScrollX, this.scrollX));
    this.scrollY = Math.max(0, Math.min(m.maxScrollY, this.scrollY));
  }

  _ensureCaretVisible(ctx = null) {
    const m = this._getMetrics(ctx);
    const { row, lineText } = this._getLineAndCol(this.caretPosition);
    const caretX = this._measureText(ctx, lineText);
    const caretTop = row * this.lineHeight;
    const caretBottom = caretTop + this.lineHeight;

    if (m.allowH) {
      if (caretX - this.scrollX > m.textViewW - 4) {
        this.scrollX = caretX - (m.textViewW - 4);
      } else if (caretX - this.scrollX < 0) {
        this.scrollX = caretX;
      }
    } else {
      this.scrollX = 0;
    }

    if (m.allowV) {
      if (caretBottom - this.scrollY > m.textViewH) {
        this.scrollY = caretBottom - m.textViewH;
      } else if (caretTop - this.scrollY < 0) {
        this.scrollY = caretTop;
      }
    } else {
      this.scrollY = 0;
    }

    this._clampScroll(ctx);
  }

  _getVThumbRect(metrics) {
    const { x, y } = this.locationOnScreen;
    const trackX = x + this.w - metrics.bar - 1;
    const trackY = y + 1;
    const trackH = Math.max(10, metrics.viewH);
    const ratio = metrics.contentH > 0 ? Math.min(1, metrics.viewH / metrics.contentH) : 1;
    const thumbH = Math.max(18, Math.floor(trackH * ratio));
    const scrollableH = Math.max(1, trackH - thumbH);
    const thumbY =
      metrics.maxScrollY > 0
        ? trackY + Math.round((this.scrollY / metrics.maxScrollY) * scrollableH)
        : trackY;
    return { trackX, trackY, trackW: metrics.bar, trackH, thumbX: trackX + 2, thumbY, thumbW: metrics.bar - 4, thumbH, scrollableH };
  }

  _getHThumbRect(metrics) {
    const { x, y } = this.locationOnScreen;
    const trackX = x + 1;
    const trackY = y + this.h - metrics.bar - 1;
    const trackW = Math.max(10, metrics.viewW);
    const ratio = metrics.contentW > 0 ? Math.min(1, metrics.viewW / metrics.contentW) : 1;
    const thumbW = Math.max(18, Math.floor(trackW * ratio));
    const scrollableW = Math.max(1, trackW - thumbW);
    const thumbX =
      metrics.maxScrollX > 0
        ? trackX + Math.round((this.scrollX / metrics.maxScrollX) * scrollableW)
        : trackX;
    return { trackX, trackY, trackW, trackH: metrics.bar, thumbX, thumbY: trackY + 2, thumbW, thumbH: metrics.bar - 4, scrollableW };
  }

  _getLineAndCol(pos = this.caretPosition) {
    const before = this.text.slice(0, Math.max(0, Math.min(this.text.length, pos)));
    const lines = before.split('\n');
    const row = lines.length - 1;
    const col = lines[row].length;
    return { row, col, lineText: lines[row] };
  }

  _getPosFromLineCol(row, col) {
    const lines = this.text.split('\n');
    const clampedRow = Math.max(0, Math.min(lines.length - 1, row));
    const clampedCol = Math.max(0, Math.min(lines[clampedRow].length, col));
    let pos = 0;
    for (let i = 0; i < clampedRow; i++) {
      pos += lines[i].length + 1;
    }
    return pos + clampedCol;
  }

  _posFromScreen(screenX, screenY, ctx) {
    const { x, y } = this.locationOnScreen;
    const lines = this.text.split('\n');
    const localY = screenY - (y + this.paddingY) + this.scrollY;
    const targetRow = Math.max(0, Math.min(lines.length - 1, Math.floor(localY / this.lineHeight)));
    const localX = screenX - (x + this.paddingX) + this.scrollX;

    let bestCol = 0;
    let bestDist = Infinity;
    const lineStr = lines[targetRow];
    for (let c = 0; c <= lineStr.length; c++) {
      const w = this._measureText(ctx, lineStr.slice(0, c));
      const d = Math.abs(w - localX);
      if (d < bestDist) {
        bestDist = d;
        bestCol = c;
      }
    }
    return this._getPosFromLineCol(targetRow, bestCol);
  }

  _deleteSelection() {
    const start = this.getSelectionStart();
    const end = this.getSelectionEnd();
    if (start === end) return false;
    this.text = this.text.slice(0, start) + this.text.slice(end);
    this.caretPosition = start;
    this.selectionStart = start;
    this.selectionEnd = start;
    this._emitTextChange();
    this.invalidate();
    return true;
  }

  onMouseDown(screenX, screenY, e) {
    const ctx = this.stage ? this.stage.ctx : null;
    const metrics = this._getMetrics(ctx);

    if (metrics.showV) {
      const vt = this._getVThumbRect(metrics);
      if (screenX >= vt.trackX && screenX <= vt.trackX + vt.trackW && screenY >= vt.trackY && screenY <= vt.trackY + vt.trackH) {
        if (screenY >= vt.thumbY && screenY <= vt.thumbY + vt.thumbH) {
          this._draggingBar = 'v';
          this._dragStartMouse = { x: screenX, y: screenY };
          this._dragStartScroll = { x: this.scrollX, y: this.scrollY };
        } else {
          const step = Math.max(this.lineHeight, Math.floor(metrics.textViewH * 0.8));
          this.scrollY = Math.max(0, Math.min(metrics.maxScrollY, this.scrollY + (screenY < vt.thumbY ? -step : step)));
          this.repaint();
        }
        return;
      }
    }

    if (metrics.showH) {
      const ht = this._getHThumbRect(metrics);
      if (screenX >= ht.trackX && screenX <= ht.trackX + ht.trackW && screenY >= ht.trackY && screenY <= ht.trackY + ht.trackH) {
        if (screenX >= ht.thumbX && screenX <= ht.thumbX + ht.thumbW) {
          this._draggingBar = 'h';
          this._dragStartMouse = { x: screenX, y: screenY };
          this._dragStartScroll = { x: this.scrollX, y: this.scrollY };
        } else {
          const step = Math.max(24, Math.floor(metrics.textViewW * 0.8));
          this.scrollX = Math.max(0, Math.min(metrics.maxScrollX, this.scrollX + (screenX < ht.thumbX ? -step : step)));
          this.repaint();
        }
        return;
      }
    }

    if (this.isEnabled()) {
      const pos = this._posFromScreen(screenX, screenY, ctx);
      this._selecting = true;
      this.setCaretPosition(pos, !!(e && e.shiftKey));
    }
    super.onMouseDown(screenX, screenY, e);
  }

  onMouseMove(screenX, screenY, e) {
    const ctx = this.stage ? this.stage.ctx : null;
    if (this._draggingBar === 'v') {
      const metrics = this._getMetrics(ctx);
      const vt = this._getVThumbRect(metrics);
      const dy = screenY - this._dragStartMouse.y;
      const deltaScroll = vt.scrollableH > 0 ? (dy / vt.scrollableH) * metrics.maxScrollY : 0;
      this.scrollY = Math.max(0, Math.min(metrics.maxScrollY, this._dragStartScroll.y + deltaScroll));
      return;
    }
    if (this._draggingBar === 'h') {
      const metrics = this._getMetrics(ctx);
      const ht = this._getHThumbRect(metrics);
      const dx = screenX - this._dragStartMouse.x;
      const deltaScroll = ht.scrollableW > 0 ? (dx / ht.scrollableW) * metrics.maxScrollX : 0;
      this.scrollX = Math.max(0, Math.min(metrics.maxScrollX, this._dragStartScroll.x + deltaScroll));
      return;
    }

    const metrics = this._getMetrics(ctx);
    let nextHover = null;
    if (metrics.showV) {
      const vt = this._getVThumbRect(metrics);
      if (screenX >= vt.trackX && screenX <= vt.trackX + vt.trackW && screenY >= vt.trackY && screenY <= vt.trackY + vt.trackH) {
        nextHover = 'v';
      }
    }
    if (!nextHover && metrics.showH) {
      const ht = this._getHThumbRect(metrics);
      if (screenX >= ht.trackX && screenX <= ht.trackX + ht.trackW && screenY >= ht.trackY && screenY <= ht.trackY + ht.trackH) {
        nextHover = 'h';
      }
    }
    if (nextHover !== this._hoverBar) {
      this._hoverBar = nextHover;
      this.repaint();
    }

    if (this._selecting && this.isEnabled()) {
      const pos = this._posFromScreen(screenX, screenY, ctx);
      this.setCaretPosition(pos, true);
    }
    super.onMouseMove(screenX, screenY, e);
  }

  onMouseUp(screenX, screenY, e) {
    this._draggingBar = null;
    this._selecting = false;
    super.onMouseUp(screenX, screenY, e);
  }

  onMouseWheel(deltaX, deltaY, e) {
    const ctx = this.stage ? this.stage.ctx : null;
    const m = this._getMetrics(ctx);
    if (m.allowV && deltaY) {
      this.scrollY = Math.max(0, Math.min(m.maxScrollY, this.scrollY + deltaY));
    }
    if (m.allowH && deltaX) {
      this.scrollX = Math.max(0, Math.min(m.maxScrollX, this.scrollX + deltaX));
    }
    super.onMouseWheel(deltaX, deltaY, e);
  }

  onKeyDown(key, e) {
    if (!this.isEnabled()) return;
    const shift = !!(e && e.shiftKey);

    if (key === 'Backspace') {
      if (this.isEditable()) {
        if (!this._deleteSelection() && this.caretPosition > 0) {
          this.text = this.text.slice(0, this.caretPosition - 1) + this.text.slice(this.caretPosition);
          this.setCaretPosition(this.caretPosition - 1);
          this._emitTextChange();
          this.invalidate();
        }
      }
    } else if (key === 'Delete') {
      if (this.isEditable()) {
        if (!this._deleteSelection() && this.caretPosition < this.text.length) {
          this.text = this.text.slice(0, this.caretPosition) + this.text.slice(this.caretPosition + 1);
          this.setCaretPosition(this.caretPosition);
          this._emitTextChange();
          this.invalidate();
        }
      }
    } else if (key === 'ArrowLeft') {
      this.setCaretPosition(Math.max(0, this.caretPosition - 1), shift);
    } else if (key === 'ArrowRight') {
      this.setCaretPosition(Math.min(this.text.length, this.caretPosition + 1), shift);
    } else if (key === 'ArrowUp') {
      const { row, col } = this._getLineAndCol(this.caretPosition);
      this.setCaretPosition(this._getPosFromLineCol(row - 1, col), shift);
    } else if (key === 'ArrowDown') {
      const { row, col } = this._getLineAndCol(this.caretPosition);
      this.setCaretPosition(this._getPosFromLineCol(row + 1, col), shift);
    } else if (key === 'Home') {
      const { row } = this._getLineAndCol(this.caretPosition);
      this.setCaretPosition(this._getPosFromLineCol(row, 0), shift);
    } else if (key === 'End') {
      const { row } = this._getLineAndCol(this.caretPosition);
      const allLines = this.text.split('\n');
      this.setCaretPosition(this._getPosFromLineCol(row, allLines[row].length), shift);
    } else if (key === 'Enter') {
      if (this.isEditable()) {
        this._deleteSelection();
        this.text = this.text.slice(0, this.caretPosition) + '\n' + this.text.slice(this.caretPosition);
        this.setCaretPosition(this.caretPosition + 1);
        this._emitTextChange();
        this.invalidate();
      }
    } else if (key && key.length === 1 && !(e && (e.ctrlKey || e.metaKey))) {
      if (this.isEditable()) {
        this._deleteSelection();
        this.text = this.text.slice(0, this.caretPosition) + key + this.text.slice(this.caretPosition);
        this.setCaretPosition(this.caretPosition + 1);
        this._emitTextChange();
        this.invalidate();
      }
    }
    super.onKeyDown(key, e);
    this.repaint();
  }

  draw(ctx) {
    const t = this.theme;
    const focused = this.hasFocus;
    const { x, y } = this.locationOnScreen;
    const lines = this.text.split('\n');
    const metrics = this._getMetrics(ctx);
    this._clampScroll(ctx);

    ctx.fillStyle = this.isEnabled() ? t.bg : t.disabled;
    ctx.fillRect(x, y, this.w, this.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, Math.max(0, metrics.viewW), Math.max(0, metrics.viewH));
    ctx.clip();

    const selStart = this.getSelectionStart();
    const selEnd = this.getSelectionEnd();
    const baseX = x + this.paddingX - this.scrollX;
    const textBaseY = y + this.paddingY + 14 - this.scrollY;

    if (selEnd > selStart) {
      ctx.fillStyle = t.btnHover;
      ctx.globalAlpha = 0.35;
      let lineStartIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineStr = lines[i];
        const lineEndIdx = lineStartIdx + lineStr.length;
        const overlapStart = Math.max(selStart, lineStartIdx);
        const overlapEnd = Math.min(selEnd, lineEndIdx);
        if (overlapEnd > overlapStart) {
          const sx = baseX + this._measureText(ctx, lineStr.slice(0, overlapStart - lineStartIdx));
          const ex = baseX + this._measureText(ctx, lineStr.slice(0, overlapEnd - lineStartIdx));
          const rectY = y + this.paddingY + i * this.lineHeight - this.scrollY;
          ctx.fillRect(sx, rectY, Math.max(2, ex - sx), this.lineHeight - 2);
        }
        lineStartIdx = lineEndIdx + 1;
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = this.isEnabled() ? t.text : t.mutedText;
    lines.forEach((line, i) => {
      ctx.fillText(line, baseX, textBaseY + i * this.lineHeight);
    });

    if (focused && this.isEditable()) {
      const { row, lineText } = this._getLineAndCol(this.caretPosition);
      const caretX = baseX + this._measureText(ctx, lineText);
      const caretY = y + this.paddingY + 1 + row * this.lineHeight - this.scrollY;
      ctx.strokeStyle = t.text;
      ctx.beginPath();
      ctx.moveTo(caretX, caretY);
      ctx.lineTo(caretX, caretY + 14);
      ctx.stroke();
    }
    ctx.restore();

    if (metrics.showV) {
      const vt = this._getVThumbRect(metrics);
      ctx.fillStyle = t.scrollbarTrack || t.bg;
      ctx.fillRect(vt.trackX, vt.trackY, vt.trackW, vt.trackH);
      ctx.fillStyle =
        this._draggingBar === 'v' || this._hoverBar === 'v'
          ? t.scrollbarThumbHover || t.btnHover
          : t.scrollbarThumb || t.btn;
      ctx.fillRect(vt.thumbX, vt.thumbY, vt.thumbW, vt.thumbH);
    }

    if (metrics.showH) {
      const ht = this._getHThumbRect(metrics);
      ctx.fillStyle = t.scrollbarTrack || t.bg;
      ctx.fillRect(ht.trackX, ht.trackY, ht.trackW, ht.trackH);
      ctx.fillStyle =
        this._draggingBar === 'h' || this._hoverBar === 'h'
          ? t.scrollbarThumbHover || t.btnHover
          : t.scrollbarThumb || t.btn;
      ctx.fillRect(ht.thumbX, ht.thumbY, ht.thumbW, ht.thumbH);
    }

    if (metrics.showV && metrics.showH) {
      ctx.fillStyle = t.panel;
      ctx.fillRect(x + 1 + metrics.viewW, y + 1 + metrics.viewH, metrics.bar, metrics.bar);
    }

    ctx.strokeStyle = focused ? t.btnHover : t.border;
    ctx.lineWidth = focused ? 2 : 1;
    ctx.strokeRect(x, y, this.w, this.h);
    ctx.lineWidth = 1;
  }
}

export class Checkbox extends Component {
  constructor(x = 0, y = 0, w = 16, h = 16, label = '', checked = false, onChange = null) {
    super(x, y, w, h);
    this.label = label;
    this.checked = !!checked;
    this.onChange = onChange;
    this.cursor = 'pointer';
    this._itemListeners = [];
  }

  getState() {
    return this.checked;
  }

  setState(val) {
    this.checked = !!val;
    this.repaint();
  }

  addItemListener(fn) {
    this._itemListeners.push(fn);
  }

  handleClick(x, y, e) {
    if (!this.isEnabled()) return;
    this.checked = !this.checked;
    const itemEvt = new ItemEvent(
      this,
      this.label,
      this.checked ? ItemEvent.SELECTED : ItemEvent.DESELECTED
    );
    this._itemListeners.forEach((fn) => fn(itemEvt));
    if (this.onChange) this.onChange(this.checked, itemEvt);
    this._mouseListeners.forEach((fn) => fn(e || new MouseEvent(this, MouseEvent.MOUSE_CLICKED, x, y)));
    this.repaint();
  }

  draw(ctx) {
    const t = this.theme;
    const { x, y } = this.locationOnScreen;

    ctx.fillStyle = this.isEnabled() ? t.bg : t.disabled;
    ctx.fillRect(x, y, this.w, this.h);

    ctx.strokeStyle = this.hasFocus ? t.btnHover : t.border;
    ctx.lineWidth = this.hasFocus ? 2 : 1;
    ctx.strokeRect(x, y, this.w, this.h);
    ctx.lineWidth = 1;

    if (this.checked) {
      ctx.fillStyle = this.isEnabled() ? t.text : t.mutedText;
      ctx.fillRect(x + 4, y + 4, Math.max(0, this.w - 8), Math.max(0, this.h - 8));
    }

    ctx.fillStyle = this.isEnabled() ? t.text : t.mutedText;
    ctx.fillText(this.label, x + this.w + 10, y + Math.max(14, this.h - 2));
  }
}

export class Controller {
  constructor(model, viewComponent, stage) {
    this.model = model;
    this.view = viewComponent;
    this.stage = stage;
    this.model.subscribe(() => {
      this.updateView();
      if (this.stage) this.stage.paint();
    });
  }
  updateView() {}
}
