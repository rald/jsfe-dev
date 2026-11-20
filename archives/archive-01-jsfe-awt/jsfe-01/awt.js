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
    scrollbarThumbHover: '#73eff7'
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
    scrollbarThumbHover: '#3b5dc9'
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

  constructor(align = FlowLayout.LEFT, hgap = 8, vgap = 8) {
    super();
    this.align = align;
    this.hgap = hgap;
    this.vgap = vgap;
  }

  preferredLayoutSize(parent) {
    const insets = parent.getInsets ? parent.getInsets() : { top: 0, left: 0, right: 0, bottom: 0 };
    const maxW = parent.w > 0 ? Math.max(0, parent.w - insets.left - insets.right) : Infinity;
    let x = this.hgap;
    let y = this.vgap;
    let rowH = 0;
    let maxRowW = 0;

    for (const comp of parent.children) {
      if (!comp.visible) continue;
      const pref = comp.getPreferredSize();
      const w = comp.w || pref.width;
      const h = comp.h || pref.height;
      if (x > this.hgap && x + w + this.hgap > maxW) {
        maxRowW = Math.max(maxRowW, x);
        x = this.hgap;
        y += rowH + this.vgap;
        rowH = 0;
      }
      x += w + this.hgap;
      rowH = Math.max(rowH, h);
    }
    maxRowW = Math.max(maxRowW, x);
    return {
      width: insets.left + insets.right + maxRowW,
      height: insets.top + insets.bottom + y + rowH + this.vgap
    };
  }

  layoutContainer(parent) {
    const insets = parent.getInsets ? parent.getInsets() : { top: 0, left: 0, right: 0, bottom: 0 };
    const availW = Math.max(0, parent.w - insets.left - insets.right);
    let y = insets.top + this.vgap;
    let row = [];
    let rowW = 0;
    let rowH = 0;

    const flushRow = () => {
      if (row.length === 0) return;
      let startX = insets.left + this.hgap;
      if (this.align === FlowLayout.CENTER) {
        startX = insets.left + Math.max(0, (availW - rowW) / 2);
      } else if (this.align === FlowLayout.RIGHT) {
        startX = insets.left + Math.max(0, availW - rowW);
      }
      let cursorX = startX;
      for (const item of row) {
        item.comp.setBounds(cursorX, y, item.w, item.h);
        cursorX += item.w + this.hgap;
      }
      y += rowH + this.vgap;
      row = [];
      rowW = 0;
      rowH = 0;
    };

    for (const comp of parent.children) {
      if (!comp.visible) continue;
      const pref = comp.getPreferredSize();
      const w = comp.w || pref.width;
      const h = comp.h || pref.height;
      const itemW = w + this.hgap;
      if (row.length > 0 && rowW + itemW > availW) {
        flushRow();
      }
      row.push({ comp, w, h });
      rowW += itemW;
      rowH = Math.max(rowH, h);
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

    this._applyFont();

    window.addEventListener('keydown', (e) => {
      if (this.focused && this.focused.visible && this.focused.isEnabled()) {
        if (this.focused.onKeyDown) {
          this.focused.onKeyDown(e.key, e);
        }
        this.paint();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this._getMousePos(e);
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
      const hit = this._findComponent(this.components, x, y);
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
    this.components.push(comp);
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
    super(x, y, w, h, layout || new FlowLayout(FlowLayout.LEFT, 6, 6));
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

  _getContentSize() {
    let maxRight = 0;
    let maxBottom = 0;
    for (const child of this.children) {
      if (!child.visible) continue;
      const pref = child.getPreferredSize ? child.getPreferredSize() : { width: 80, height: 24 };
      const cw = child.w || pref.width;
      const ch = child.h || pref.height;
      maxRight = Math.max(maxRight, child.x + cw + 8);
      maxBottom = Math.max(maxBottom, child.y + ch + 8);
    }
    if (this.layout && typeof this.layout.preferredLayoutSize === 'function') {
      const lp = this.layout.preferredLayoutSize(this);
      maxRight = Math.max(maxRight, lp.width);
      maxBottom = Math.max(maxBottom, lp.height);
    }
    return { width: maxRight, height: maxBottom };
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
  static TITLE_BAR_HEIGHT = 25;

  constructor(x = 50, y = 50, w = 200, h = 150, title = 'Window', layout = null) {
    super(x, y, w, h, layout);
    this.title = title;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.resizable = false;
  }

  getInsets() {
    return { top: Window.TITLE_BAR_HEIGHT + 4, left: 4, right: 4, bottom: 4 };
  }

  getChildScreenOrigin() {
    return this.locationOnScreen;
  }

  isHitTitleBar(screenX, screenY) {
    const { x, y } = this.locationOnScreen;
    return (
      screenX >= x &&
      screenX <= x + this.w &&
      screenY >= y &&
      screenY <= y + Window.TITLE_BAR_HEIGHT
    );
  }

  pack() {
    this.doLayout();
    let maxRight = 140;
    let maxBottom = Window.TITLE_BAR_HEIGHT + 40;
    for (const child of this.children) {
      if (!child.visible) continue;
      maxRight = Math.max(maxRight, child.x + child.w + 12);
      maxBottom = Math.max(maxBottom, child.y + child.h + 12);
    }
    this.w = Math.max(this.w, maxRight);
    this.h = Math.max(this.h, maxBottom);
    this.invalidate();
    this.repaint();
  }

  onMouseDown(x, y, e) {
    if (this.isHitTitleBar(x, y)) {
      const origin = this.locationOnScreen;
      this.isDragging = true;
      this.dragOffset = { x: x - origin.x, y: y - origin.y };
    }
    super.onMouseDown(x, y, e);
  }

  onMouseMove(x, y, e) {
    if (this.isDragging) {
      const parentOrigin = this.parent && typeof this.parent.getChildScreenOrigin === 'function'
        ? this.parent.getChildScreenOrigin()
        : { x: 0, y: 0 };
      this.x = x - this.dragOffset.x - parentOrigin.x;
      this.y = y - this.dragOffset.y - parentOrigin.y;
    }
    super.onMouseMove(x, y, e);
  }

  onMouseUp(x, y, e) {
    this.isDragging = false;
    super.onMouseUp(x, y, e);
  }

  draw(ctx) {
    const t = this.theme;
    const { x, y } = this.locationOnScreen;

    ctx.fillStyle = this.isDragging ? '#666' : t.winTitle;
    ctx.fillRect(x, y, this.w, Window.TITLE_BAR_HEIGHT);

    ctx.fillStyle = t.text;
    ctx.fillText(this.title, x + 8, y + 17);

    ctx.fillStyle = t.winBody;
    ctx.fillRect(x, y + Window.TITLE_BAR_HEIGHT, this.w, this.h - Window.TITLE_BAR_HEIGHT);

    ctx.strokeStyle = t.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, this.w, this.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      x + 1,
      y + Window.TITLE_BAR_HEIGHT,
      Math.max(0, this.w - 2),
      Math.max(0, this.h - Window.TITLE_BAR_HEIGHT - 1)
    );
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

    ctx.fillStyle = this.isEnabled() ? t.text : t.mutedText;
    const textY = y + Math.min(this.h - 6, Math.max(15, Math.floor(this.h / 2) + 5));
    ctx.fillText(this.label, x + 10, textY);
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

  getPreferredSize() {
    const width = this.stage && this.stage.ctx
      ? Math.max(40, Math.ceil(this.stage.ctx.measureText(this.text).width + 8))
      : Math.max(40, this.text.length * 8 + 8);
    return { width, height: this.h || 20 };
  }

  draw(ctx) {
    const t = this.theme;
    const { x, y } = this.locationOnScreen;
    ctx.fillStyle = this.isEnabled() ? t.text : t.mutedText;
    let drawX = x;
    if (this.alignment === Label.CENTER) {
      drawX = x + (this.w - ctx.measureText(this.text).width) / 2;
    } else if (this.alignment === Label.RIGHT) {
      drawX = x + this.w - ctx.measureText(this.text).width;
    }
    ctx.fillText(this.text, drawX, y);
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

// Java AWT-style TextArea: a pure multi-line text component that grows to its
// preferred size (rows x columns) and delegates scrolling to a parent ScrollPane.
export class TextArea extends Component {
  static SCROLLBARS_BOTH = 0;
  static SCROLLBARS_VERTICAL_ONLY = 1;
  static SCROLLBARS_HORIZONTAL_ONLY = 2;
  static SCROLLBARS_NONE = 3;

  constructor(text = '', rows = 5, columns = 20, scrollbars = TextArea.SCROLLBARS_BOTH) {
    // Support legacy positional (x, y, w, h, text) signature seamlessly
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
    this.lineHeight = 20;
    this.paddingX = 6;
    this.paddingY = 5;
    this.cursor = 'text';
    this._textListeners = [];
    this._selecting = false;

    const pref = this.getPreferredSize();
    if (!this.w) this.w = pref.width;
    if (!this.h) this.h = pref.height;
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
    this.invalidate();
    this.repaint();
  }

  append(str) {
    const addition = String(str ?? '');
    this.text += addition;
    this.caretPosition = this.text.length;
    this.selectionStart = this.caretPosition;
    this.selectionEnd = this.caretPosition;
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
    const lines = this.text.split('
');
    let longestLineW = 0;
    for (const line of lines) {
      longestLineW = Math.max(longestLineW, this._measureText(ctx, line));
    }
    const colBasedW = Math.ceil(this.columns * cw);
    const contentW = Math.ceil(longestLineW);
    const prefW = Math.max(colBasedW, contentW) + this.paddingX * 2 + 8;

    const rowBasedH = this.rows * this.lineHeight;
    const contentH = lines.length * this.lineHeight;
    const prefH = Math.max(rowBasedH, contentH) + this.paddingY * 2 + 6;

    return { width: prefW, height: prefH };
  }

  _getLineAndCol(pos = this.caretPosition) {
    const before = this.text.slice(0, Math.max(0, Math.min(this.text.length, pos)));
    const lines = before.split('
');
    const row = lines.length - 1;
    const col = lines[row].length;
    return { row, col, lineText: lines[row] };
  }

  _getPosFromLineCol(row, col) {
    const lines = this.text.split('
');
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
    const lines = this.text.split('
');
    const localY = screenY - (y + this.paddingY);
    const targetRow = Math.max(0, Math.min(lines.length - 1, Math.floor(localY / this.lineHeight)));
    const localX = screenX - (x + this.paddingX);

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
    if (this.isEnabled()) {
      const ctx = this.stage ? this.stage.ctx : null;
      const pos = this._posFromScreen(screenX, screenY, ctx);
      this._selecting = true;
      this.setCaretPosition(pos, !!(e && e.shiftKey));
    }
    super.onMouseDown(screenX, screenY, e);
  }

  onMouseMove(screenX, screenY, e) {
    if (this._selecting && this.isEnabled()) {
      const ctx = this.stage ? this.stage.ctx : null;
      const pos = this._posFromScreen(screenX, screenY, ctx);
      this.setCaretPosition(pos, true);
    }
    super.onMouseMove(screenX, screenY, e);
  }

  onMouseUp(screenX, screenY, e) {
    this._selecting = false;
    super.onMouseUp(screenX, screenY, e);
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
      const allLines = this.text.split('
');
      this.setCaretPosition(this._getPosFromLineCol(row, allLines[row].length), shift);
    } else if (key === 'Enter') {
      if (this.isEditable()) {
        this._deleteSelection();
        this.text = this.text.slice(0, this.caretPosition) + '
' + this.text.slice(this.caretPosition);
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
    const lines = this.text.split('
');

    ctx.fillStyle = this.isEnabled() ? t.bg : t.disabled;
    ctx.fillRect(x, y, this.w, this.h);

    ctx.strokeStyle = focused ? t.btnHover : t.border;
    ctx.lineWidth = focused ? 2 : 1;
    ctx.strokeRect(x, y, this.w, this.h);
    ctx.lineWidth = 1;

    const selStart = this.getSelectionStart();
    const selEnd = this.getSelectionEnd();
    const baseX = x + this.paddingX;
    const textBaseY = y + this.paddingY + 14;

    // Draw selection highlight across lines
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
          const rectY = y + this.paddingY + i * this.lineHeight;
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
      const caretY = y + this.paddingY + 1 + row * this.lineHeight;
      ctx.strokeStyle = t.text;
      ctx.beginPath();
      ctx.moveTo(caretX, caretY);
      ctx.lineTo(caretX, caretY + 14);
      ctx.stroke();
    }
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
