/**
 * Observer Pattern: Decouples state mutations and user events from listeners.
 */
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(listener);
    }
  }

  emit(event, payload) {
    if (!this._listeners.has(event)) return;
    for (const listener of this._listeners.get(event)) {
      listener(payload);
    }
  }

  clear() {
    this._listeners.clear();
  }
}
