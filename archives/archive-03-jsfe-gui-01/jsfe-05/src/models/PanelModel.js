import { WidgetModel } from './WidgetModel.js';

export class PanelModel extends WidgetModel {
  constructor(options = {}) {
    super({
      width: 260,
      height: 200,
      ...options,
      theme: {
        bg: '#1e1f22',
        border: '#313338',
        radius: 8,
        ...(options.theme || {})
      }
    });
    this._state.title = options.title ?? '';
    this._state.padding = options.padding ?? 12;
  }
}
