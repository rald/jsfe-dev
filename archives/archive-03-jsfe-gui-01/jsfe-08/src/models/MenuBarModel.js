import { WidgetModel } from './WidgetModel.js';

export class MenuBarModel extends WidgetModel {
  constructor(options = {}) {
    super({
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? 640,
      height: options.height ?? 28,
      ...options,
      theme: {
        bg: '#18191c',
        border: '#2b2d31',
        radius: 0,
        ...(options.theme || {})
      }
    });
    this._state.activeIndex = -1;
  }
}
