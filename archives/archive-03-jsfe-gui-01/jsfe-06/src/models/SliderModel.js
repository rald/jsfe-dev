import { WidgetModel } from './WidgetModel.js';

export class SliderModel extends WidgetModel {
  constructor(options = {}) {
    super({
      width: 180,
      height: 28,
      ...options
    });
    this._state.min = options.min ?? 0;
    this._state.max = options.max ?? 100;
    this._state.step = options.step ?? 1;
    const initial = options.value ?? this._state.min;
    this._state.value = this._clamp(initial);
    this._state.label = options.label ?? '';
  }

  _clamp(val) {
    const min = this._state.min;
    const max = this._state.max;
    const step = this._state.step;
    const clamped = Math.min(max, Math.max(min, val));
    return Math.round((clamped - min) / step) * step + min;
  }

  setValue(rawVal) {
    const next = this._clamp(rawVal);
    this.set('value', Number(next.toFixed(6)));
  }

  get normalized() {
    const { min, max, value } = this._state;
    if (max === min) return 0;
    return (value - min) / (max - min);
  }
}
