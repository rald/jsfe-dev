import { WidgetModel } from './WidgetModel.js';

export class LabelModel extends WidgetModel {
  constructor(options = {}) {
    super({
      width: 140,
      height: 24,
      ...options
    });
    this._state.text = options.text ?? 'Label';
    this._state.align = options.align ?? 'left';
  }
}
