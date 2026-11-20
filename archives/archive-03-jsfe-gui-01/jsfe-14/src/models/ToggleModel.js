import { WidgetModel } from './WidgetModel.js';

export class ToggleModel extends WidgetModel {
  constructor(options = {}) {
    super({
      width: 160,
      height: 28,
      ...options
    });
    this._state.checked = Boolean(options.checked ?? false);
    this._state.label = options.label ?? 'Toggle';
  }

  toggle() {
    this.set('checked', !this._state.checked);
  }
}
