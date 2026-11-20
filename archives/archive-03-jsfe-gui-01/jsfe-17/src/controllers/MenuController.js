import { WidgetController } from './WidgetController.js';

export class MenuController extends WidgetController {
  hitTest(localX, localY) {
    if (!this.model.get('visible') || !this.model.get('enabled')) return false;
    const w = this.model.get('width');
    const h = this.model.get('height');
    return localX >= 0 && localX <= w && localY >= 0 && localY <= h;
  }

  onPointerDown(localX, localY) {
    this.model.set('focused', true);
  }
}
