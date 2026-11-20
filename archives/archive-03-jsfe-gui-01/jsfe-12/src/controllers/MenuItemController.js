import { WidgetController } from './WidgetController.js';

export class MenuItemController extends WidgetController {
  constructor(model, menuItemWidget) {
    super(model);
    this.menuItem = menuItemWidget;
  }

  hitTest(localX, localY) {
    if (this.model.get('separator')) return false;
    return super.hitTest(localX, localY);
  }

  onPointerEnter() {
    super.onPointerEnter();
    if (this.menuItem && this.menuItem.submenu) {
      const abs = this.menuItem.getAbsolutePosition();
      const w = this.model.get('width');
      this.model.set('submenuOpen', true);
      this.menuItem.submenu.open(abs.x + w - 2, abs.y);
    }
  }

  onPointerUp(localX, localY, inside) {
    const wasPressed = this.model.get('pressed');
    super.onPointerUp(localX, localY, inside);
    if (wasPressed && inside && this.model.get('enabled') && !this.model.get('separator')) {
      if (typeof this.model.get('checked') === 'boolean') {
        this.model.set('checked', !this.model.get('checked'));
      }
      this.model.emit('select', { item: this.menuItem, model: this.model });
      if (!this.menuItem.submenu && this.menuItem._closeRootMenu) {
        this.menuItem._closeRootMenu();
      }
    }
  }
}
