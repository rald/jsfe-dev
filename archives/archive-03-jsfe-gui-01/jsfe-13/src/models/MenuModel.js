import { WidgetModel } from './WidgetModel.js';

export class MenuModel extends WidgetModel {
  constructor(options = {}) {
    super({
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? 190,
      height: options.height ?? 32,
      visible: options.visible ?? false,
      ...options,
      theme: {
        bg: '#232428',
        border: '#3f4147',
        radius: 6,
        ...(options.theme || {})
      }
    });
    this._state.open = Boolean(options.open ?? this._state.visible);
    this._state.padding = options.padding ?? 4;
  }

  open(x = null, y = null) {
    if (x !== null) this.set('x', x);
    if (y !== null) this.set('y', y);
    this._state.open = true;
    this.set('visible', true);
    this.emit('open', { model: this });
  }

  close() {
    this._state.open = false;
    this.set('visible', false);
    this.emit('close', { model: this });
  }
}
