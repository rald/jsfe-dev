import { EventEmitter } from '../patterns/EventEmitter.js';

/**
 * Base Model (MVC): Stores retained geometric, visual, and interaction state.
 */
export class WidgetModel extends EventEmitter {
  constructor(options = {}) {
    super();
    this._state = {
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? 100,
      height: options.height ?? 32,
      visible: options.visible ?? true,
      enabled: options.enabled ?? true,
      hovered: false,
      pressed: false,
      focused: false,
      dirty: true,
      theme: {
        bg: '#2b2d31',
        bgHover: '#35373c',
        bgActive: '#404249',
        border: '#4e5058',
        accent: '#5865f2',
        text: '#f2f3f5',
        textMuted: '#949ba4',
        danger: '#da373c',
        warning: '#f0b232',
        success: '#23a55a',
        radius: 6,
        font: '13px Inter, system-ui, -apple-system, sans-serif',
        ...(options.theme || {})
      }
    };
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    if (this._state[key] === value) return;
    const oldValue = this._state[key];
    this._state[key] = value;
    this._state.dirty = true;
    this.emit('change', { key, value, oldValue });
    this.emit(`change:${key}`, { value, oldValue });
  }

  update(patch) {
    for (const [k, v] of Object.entries(patch)) {
      this.set(k, v);
    }
  }

  markClean() {
    this._state.dirty = false;
  }

  get isDirty() {
    return this._state.dirty;
  }
}
