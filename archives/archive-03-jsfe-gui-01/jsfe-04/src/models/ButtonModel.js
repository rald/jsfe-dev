import { WidgetModel } from './WidgetModel.js';

export class ButtonModel extends WidgetModel {
  constructor(options = {}) {
    super({
      width: 120,
      height: 36,
      ...options
    });
    this._state.label = options.label ?? 'Button';
  }
}
