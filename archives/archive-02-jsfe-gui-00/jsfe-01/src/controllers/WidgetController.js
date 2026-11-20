/**
 * Base Controller (MVC): Translates pointer/input interactions into Model updates.
 */
export class WidgetController {
  constructor(model) {
    this.model = model;
  }

  hitTest(localX, localY) {
    if (!this.model.get('visible') || !this.model.get('enabled')) return false;
    const w = this.model.get('width');
    const h = this.model.get('height');
    return localX >= 0 && localX <= w && localY >= 0 && localY <= h;
  }

  onPointerEnter() {
    this.model.set('hovered', true);
  }

  onPointerLeave() {
    this.model.set('hovered', false);
    this.model.set('pressed', false);
  }

  onPointerDown(localX, localY) {
    this.model.set('pressed', true);
    this.model.set('focused', true);
  }

  onPointerMove(localX, localY) {}

  onPointerUp(localX, localY, inside) {
    this.model.set('pressed', false);
  }
}
