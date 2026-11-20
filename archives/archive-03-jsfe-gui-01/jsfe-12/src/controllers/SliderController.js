import { WidgetController } from './WidgetController.js';

export class SliderController extends WidgetController {
  _updateFromLocalX(localX) {
    const w = this.model.get('width');
    const ratio = Math.min(1, Math.max(0, localX / w));
    const min = this.model.get('min');
    const max = this.model.get('max');
    this.model.setValue(min + ratio * (max - min));
  }

  onPointerDown(localX, localY) {
    super.onPointerDown(localX, localY);
    this._updateFromLocalX(localX);
  }

  onPointerMove(localX, localY) {
    if (this.model.get('pressed')) {
      this._updateFromLocalX(localX);
    }
  }
}
