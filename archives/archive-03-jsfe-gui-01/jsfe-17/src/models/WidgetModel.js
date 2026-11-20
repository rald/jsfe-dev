import { EventEmitter } from '../patterns/EventEmitter.js';
import { SWEETIE_16_THEME } from '../themes/sweetie16Dark.js';

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
        ...SWEETIE_16_THEME,
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
