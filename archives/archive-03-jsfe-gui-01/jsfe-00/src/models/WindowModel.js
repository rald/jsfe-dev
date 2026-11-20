import { WidgetModel } from './WidgetModel.js';

/**
 * Model for a draggable, resizable window with titlebar and minimize/maximize/close state.
 */
export class WindowModel extends WidgetModel {
  constructor(options = {}) {
    const width = options.width ?? 360;
    const height = options.height ?? 260;
    const x = options.x ?? 80;
    const y = options.y ?? 60;

    super({
      x,
      y,
      width,
      height,
      ...options,
      theme: {
        bg: '#1e1f22',
        titleBg: '#2b2d31',
        titleActiveBg: '#353842',
        border: '#4e5058',
        radius: 8,
        ...(options.theme || {})
      }
    });

    this._state.title = options.title ?? 'Window';
    this._state.titleBarHeight = options.titleBarHeight ?? 32;
    this._state.minimized = Boolean(options.minimized ?? false);
    this._state.maximized = Boolean(options.maximized ?? false);
    this._state.minimizable = options.minimizable ?? true;
    this._state.maximizable = options.maximizable ?? true;
    this._state.closable = options.closable ?? true;
    this._state.resizable = options.resizable ?? true;
    this._state.minWidth = options.minWidth ?? 200;
    this._state.minHeight = options.minHeight ?? 120;
    this._state.hoveredControl = null; // 'minimize' | 'maximize' | 'close' | null
    this._state.pressedControl = null;
    this._restoreBounds = { x, y, width, height };
  }

  getContentBounds() {
    const titleH = this._state.titleBarHeight;
    const isMin = this._state.minimized;
    return {
      x: 0,
      y: titleH,
      width: this._state.width,
      height: isMin ? 0 : Math.max(0, this._state.height - titleH)
    };
  }

  minimize() {
    if (!this._state.minimizable) return;
    if (this._state.maximized) {
      this.restore();
    }
    const next = !this._state.minimized;
    this.set('minimized', next);
    this.emit(next ? 'minimize' : 'unminimize', { model: this });
  }

  maximize(viewport = { width: 800, height: 600 }) {
    if (!this._state.maximizable) return;
    if (this._state.minimized) {
      this.set('minimized', false);
    }
    if (!this._state.maximized) {
      this._restoreBounds = {
        x: this._state.x,
        y: this._state.y,
        width: this._state.width,
        height: this._state.height
      };
      this.update({
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        maximized: true
      });
      this.emit('maximize', { model: this });
    } else {
      this.restore();
    }
  }

  restore() {
    if (!this._state.maximized) return;
    const { x, y, width, height } = this._restoreBounds;
    this.update({
      x,
      y,
      width,
      height,
      maximized: false
    });
    this.emit('restore', { model: this });
  }

  close() {
    if (!this._state.closable) return;
    this.set('visible', false);
    this.emit('close', { model: this });
  }
}
