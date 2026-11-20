import { WidgetController } from './WidgetController.js';

export class MenuBarController extends WidgetController {
  constructor(model, menuBarWidget) {
    super(model);
    this.menuBar = menuBarWidget;
  }

  onPointerDown(localX, localY) {
    super.onPointerDown(localX, localY);
    if (!this.menuBar) return;
    const entry = this.menuBar.findEntryAt(localX, localY);
    if (entry) {
      this.menuBar.toggleEntry(entry.index);
    } else {
      this.menuBar.closeAll();
    }
  }

  onPointerMove(localX, localY) {
    if (!this.menuBar) return;
    const activeIdx = this.model.get('activeIndex');
    if (activeIdx !== -1) {
      const entry = this.menuBar.findEntryAt(localX, localY);
      if (entry && entry.index !== activeIdx) {
        this.menuBar.openEntry(entry.index);
      }
    }
  }
}
