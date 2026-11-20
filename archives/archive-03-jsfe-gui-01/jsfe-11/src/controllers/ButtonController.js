import { WidgetController } from './WidgetController.js';

export class ButtonController extends WidgetController {
  onPointerUp(localX, localY, inside) {
    const wasPressed = this.model.get('pressed');
    super.onPointerUp(localX, localY, inside);
    if (wasPressed && inside && this.model.get('enabled')) {
      this.model.emit('click', { model: this.model });
    }
  }
}
