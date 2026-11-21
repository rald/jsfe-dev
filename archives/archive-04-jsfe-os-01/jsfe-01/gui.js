// Retained-Mode GUI Framework (ES6, OOP, MVC, Design Patterns)
// Uses Sweetie-16 dark theme tokens and retained scene graph nodes.

import { SWEETIE_16 } from './sweetie.js';

// --- Observer Pattern (Pub/Sub) ---
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(eventName, handler) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const set = this._listeners.get(eventName);
    if (set) {
      set.delete(handler);
    }
  }

  emit(eventName, payload) {
    const set = this._listeners.get(eventName);
    if (!set) return;
    for (const handler of [...set]) {
      handler(payload);
    }
  }
}

// --- Command Pattern ---
export class Command {
  execute() {
    throw new Error('Command.execute() must be implemented');
  }

  undo() {
    // Optional undo hook
  }
}

export class CommandInvoker extends EventEmitter {
  constructor() {
    super();
    this._history = [];
  }

  run(command) {
    const result = command.execute();
    this._history.push(command);
    this.emit('executed', { command, result });
    return result;
  }
}

// --- Singleton Theme Manager (Dark Theme built on Sweetie-16) ---
export class DarkThemeManager {
  static _instance = null;

  constructor() {
    if (DarkThemeManager._instance) {
      return DarkThemeManager._instance;
    }
    this.tokens = Object.freeze({
      bgDesktop: SWEETIE_16.black,
      bgWindow: SWEETIE_16.darkGrey,
      bgMenu: SWEETIE_16.navy,
      bgMenuActive: SWEETIE_16.blue,
      bgEditor: SWEETIE_16.black,
      bgGutter: SWEETIE_16.darkGrey,
      bgStatus: SWEETIE_16.navy,
      bgDialog: SWEETIE_16.darkGrey,
      bgButton: SWEETIE_16.grey,
      bgButtonHover: SWEETIE_16.blue,
      bgButtonPrimary: SWEETIE_16.darkTeal,
      fgPrimary: SWEETIE_16.white,
      fgMuted: SWEETIE_16.lightGrey,
      fgAccent: SWEETIE_16.cyan,
      fgWarn: SWEETIE_16.yellow,
      fgError: SWEETIE_16.red,
      fgSuccess: SWEETIE_16.lime,
      borderOuter: SWEETIE_16.lightBlue,
      borderInner: SWEETIE_16.grey,
      selectionBg: SWEETIE_16.blue,
      selectionFg: SWEETIE_16.white,
      cursorBg: SWEETIE_16.cyan,
      cursorFg: SWEETIE_16.black,
    });
    DarkThemeManager._instance = this;
  }

  static getInstance() {
    if (!DarkThemeManager._instance) {
      DarkThemeManager._instance = new DarkThemeManager();
    }
    return DarkThemeManager._instance;
  }

  applyToDocument(doc = document) {
    const root = doc.documentElement;
    if (!root) return;
    for (const [key, val] of Object.entries(this.tokens)) {
      const cssVar = `--dos-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, val);
    }
  }
}

// --- Retained-Mode Scene Graph Node (Composite Pattern) ---
export class GuiNode extends EventEmitter {
  constructor(id, options = {}) {
    super();
    this.id = id;
    this.className = options.className || '';
    this.visible = options.visible !== undefined ? options.visible : true;
    this.disabled = Boolean(options.disabled);
    this.attributes = { ...(options.attributes || {}) };
    this.parent = null;
    this.children = [];
    this.el = null;
    this._dirty = true;
    this._mounted = false;
  }

  createElement(doc) {
    const tag = this._tagName();
    const el = doc.createElement(tag);
    el.dataset.nodeId = this.id;
    return el;
  }

  _tagName() {
    return 'div';
  }

  add(child) {
    if (!(child instanceof GuiNode)) {
      throw new Error('Child must be an instance of GuiNode');
    }
    if (child.parent) {
      child.parent.remove(child);
    }
    child.parent = this;
    this.children.push(child);
    this.markDirty();
    if (this._mounted && this.el) {
      child.mount(this.el);
    }
    return this;
  }

  remove(child) {
    const idx = this.children.indexOf(child);
    if (idx === -1) return this;
    this.children.splice(idx, 1);
    child.parent = null;
    if (child.el && child.el.parentNode) {
      child.el.parentNode.removeChild(child.el);
    }
    child._mounted = false;
    this.markDirty();
    return this;
  }

  clearChildren() {
    while (this.children.length > 0) {
      this.remove(this.children[0]);
    }
  }

  markDirty() {
    this._dirty = true;
    this.emit('dirty', this);
  }

  setVisible(visible) {
    const next = Boolean(visible);
    if (this.visible !== next) {
      this.visible = next;
      this.markDirty();
    }
  }

  setDisabled(disabled) {
    const next = Boolean(disabled);
    if (this.disabled !== next) {
      this.disabled = next;
      this.markDirty();
    }
  }

  mount(parentEl) {
    const doc = parentEl.ownerDocument || document;
    if (!this.el) {
      this.el = this.createElement(doc);
      this._bindDomEvents();
    }
    if (this.el.parentNode !== parentEl) {
      parentEl.appendChild(this.el);
    }
    this._mounted = true;
    this.sync();
    for (const child of this.children) {
      child.mount(this.el);
    }
    return this.el;
  }

  _bindDomEvents() {
    // Subclasses override to attach DOM listeners
  }

  sync() {
    if (!this.el) return;
    this.el.hidden = !this.visible;
    this.el.style.display = this.visible ? '' : 'none';
    if (this.className) {
      this.el.className = this.className;
    }
    for (const [k, v] of Object.entries(this.attributes)) {
      if (v === null || v === undefined || v === false) {
        this.el.removeAttribute(k);
      } else {
        this.el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    this._syncSelf();
    this._dirty = false;
  }

  _syncSelf() {
    // Subclasses override to update retained visual state
  }

  renderTree() {
    if (this._dirty) {
      this.sync();
    }
    for (const child of this.children) {
      child.renderTree();
    }
  }
}

// --- Concrete Retained Widgets ---
export class PanelNode extends GuiNode {
  constructor(id, options = {}) {
    super(id, { ...options, className: `dos-panel ${options.className || ''}`.trim() });
  }
}

export class LabelNode extends GuiNode {
  constructor(id, text = '', options = {}) {
    super(id, { ...options, className: `dos-label ${options.className || ''}`.trim() });
    this._text = String(text);
  }

  setText(text) {
    const next = String(text);
    if (this._text !== next) {
      this._text = next;
      this.markDirty();
    }
  }

  getText() {
    return this._text;
  }

  _syncSelf() {
    if (this.el) {
      this.el.textContent = this._text;
    }
  }
}

export class ButtonNode extends GuiNode {
  constructor(id, label = '', options = {}) {
    super(id, { ...options, className: `dos-btn ${options.className || ''}`.trim() });
    this._label = String(label);
    this.onClick = options.onClick || null;
  }

  _tagName() {
    return 'button';
  }

  setLabel(label) {
    const next = String(label);
    if (this._label !== next) {
      this._label = next;
      this.markDirty();
    }
  }

  _bindDomEvents() {
    if (!this.el) return;
    this.el.addEventListener('click', (ev) => {
      if (this.disabled) {
        ev.preventDefault();
        return;
      }
      this.emit('click', ev);
      if (typeof this.onClick === 'function') {
        this.onClick(ev);
      }
    });
  }

  _syncSelf() {
    if (!this.el) return;
    this.el.type = 'button';
    this.el.disabled = this.disabled;
    this.el.textContent = this._label;
  }
}

export class TextInputNode extends GuiNode {
  constructor(id, value = '', options = {}) {
    super(id, { ...options, className: `dos-input ${options.className || ''}`.trim() });
    this._value = String(value);
    this.placeholder = options.placeholder || '';
  }

  _tagName() {
    return 'input';
  }

  setValue(val) {
    const next = String(val);
    if (this._value !== next) {
      this._value = next;
      if (this.el && this.el.value !== next) {
        this.el.value = next;
      }
      this.markDirty();
    }
  }

  getValue() {
    if (this.el) {
      this._value = this.el.value;
    }
    return this._value;
  }

  focus() {
    if (this.el) {
      this.el.focus();
    }
  }

  _bindDomEvents() {
    if (!this.el) return;
    this.el.addEventListener('input', (ev) => {
      this._value = ev.target.value;
      this.emit('change', this._value);
    });
    this.el.addEventListener('keydown', (ev) => {
      this.emit('keydown', ev);
    });
  }

  _syncSelf() {
    if (!this.el) return;
    this.el.type = 'text';
    this.el.disabled = this.disabled;
    this.el.placeholder = this.placeholder;
    if (this.el.value !== this._value) {
      this.el.value = this._value;
    }
  }
}

export class TextAreaNode extends GuiNode {
  constructor(id, value = '', options = {}) {
    super(id, { ...options, className: `dos-textarea ${options.className || ''}`.trim() });
    this._value = String(value);
    this.spellcheck = options.spellcheck ?? false;
    this.wrap = options.wrap ?? 'off';
  }

  _tagName() {
    return 'textarea';
  }

  setValue(val) {
    const next = String(val);
    if (this._value !== next) {
      this._value = next;
      if (this.el && this.el.value !== next) {
        this.el.value = next;
      }
      this.markDirty();
    }
  }

  getValue() {
    if (this.el) {
      this._value = this.el.value;
    }
    return this._value;
  }

  setSelectionRange(start, end) {
    if (this.el && typeof this.el.setSelectionRange === 'function') {
      this.el.setSelectionRange(start, end);
    }
  }

  getSelection() {
    if (!this.el) {
      return { start: 0, end: 0, text: '' };
    }
    const start = this.el.selectionStart ?? 0;
    const end = this.el.selectionEnd ?? 0;
    const text = this._value.slice(start, end);
    return { start, end, text };
  }

  focus() {
    if (this.el) {
      this.el.focus();
    }
  }

  _bindDomEvents() {
    if (!this.el) return;
    const updateCaretAndText = () => {
      this._value = this.el.value;
      this.emit('input', {
        value: this._value,
        selectionStart: this.el.selectionStart ?? 0,
        selectionEnd: this.el.selectionEnd ?? 0,
      });
    };
    const updateCursor = () => {
      this.emit('cursor', {
        selectionStart: this.el.selectionStart ?? 0,
        selectionEnd: this.el.selectionEnd ?? 0,
      });
    };

    this.el.addEventListener('input', updateCaretAndText);
    this.el.addEventListener('click', updateCursor);
    this.el.addEventListener('keyup', updateCursor);
    this.el.addEventListener('select', updateCursor);
    this.el.addEventListener('scroll', () => {
      this.emit('scroll', {
        scrollTop: this.el.scrollTop,
        scrollLeft: this.el.scrollLeft,
      });
    });
    this.el.addEventListener('keydown', (ev) => {
      this.emit('keydown', ev);
    });
  }

  _syncSelf() {
    if (!this.el) return;
    this.el.disabled = this.disabled;
    this.el.spellcheck = this.spellcheck;
    this.el.wrap = this.wrap;
    if (this.el.value !== this._value) {
      this.el.value = this._value;
    }
  }
}

// --- Factory Pattern for Retained GUI Nodes ---
export class GuiNodeFactory {
  static create(type, id, ...args) {
    switch (type) {
      case 'panel':
        return new PanelNode(id, ...args);
      case 'label':
        return new LabelNode(id, ...args);
      case 'button':
        return new ButtonNode(id, ...args);
      case 'input':
        return new TextInputNode(id, ...args);
      case 'textarea':
        return new TextAreaNode(id, ...args);
      default:
        throw new Error(`Unknown GUI node type: ${type}`);
    }
  }
}

// --- MVC Base Classes ---
export class BaseModel extends EventEmitter {
  constructor() {
    super();
  }
}

export class BaseView extends EventEmitter {
  constructor(rootContainer, themeManager = DarkThemeManager.getInstance()) {
    super();
    this.rootContainer = rootContainer;
    this.theme = themeManager;
    this.rootNode = new PanelNode('gui-root', { className: 'dos-root' });
    this._rafId = null;
  }

  init() {
    this.theme.applyToDocument(this.rootContainer.ownerDocument || document);
    this.buildRetainedTree();
    this.rootNode.mount(this.rootContainer);
    this.scheduleRender();
  }

  buildRetainedTree() {
    // Subclasses build retained scene graph
  }

  scheduleRender() {
    if (this._rafId !== null) return;
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => setTimeout(cb, 0);
    this._rafId = raf(() => {
      this._rafId = null;
      this.rootNode.renderTree();
    });
  }

  renderNow() {
    if (this._rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.rootNode.renderTree();
  }
}

export class BaseController {
  constructor(model, view, invoker = new CommandInvoker()) {
    this.model = model;
    this.view = view;
    this.invoker = invoker;
  }

  bind() {
    // Subclasses wire model, view, and commands
  }
}
