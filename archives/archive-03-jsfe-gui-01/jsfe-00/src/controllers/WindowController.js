import { WidgetController } from './WidgetController.js';

export class WindowController extends WidgetController {
  constructor(model, widget) {
    super(model);
    this.widget = widget;
    this._dragMode = null; // 'move' | 'resize' | null
    this._startPointer = { x: 0, y: 0 };
    this._startBounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  _getControlRects() {
    const w = this.model.get('width');
    const titleH = this.model.get('titleBarHeight');
    const btnSize = 18;
    const gap = 6;
    const btnY = (titleH - btnSize) / 2;
    let cursorX = w - 10;
    const rects = {};

    const ids = [];
    if (this.model.get('closable')) ids.push('close');
    if (this.model.get('maximizable')) ids.push('maximize');
    if (this.model.get('minimizable')) ids.push('minimize');

    for (const id of ids) {
      cursorX -= btnSize;
      rects[id] = { x: cursorX, y: btnY, width: btnSize, height: btnSize };
      cursorX -= gap;
    }
    return rects;
  }

  _hitControl(localX, localY) {
    const rects = this._getControlRects();
    for (const [id, r] of Object.entries(rects)) {
      if (localX >= r.x && localX <= r.x + r.width && localY >= r.y && localY <= r.y + r.height) {
        return id;
      }
    }
    return null;
  }

  _hitResizeGrip(localX, localY) {
    if (this.model.get('minimized') || !this.model.get('resizable') || this.model.get('maximized')) {
      return false;
    }
    const w = this.model.get('width');
    const h = this.model.get('height');
    return localX >= w - 16 && localX <= w && localY >= h - 16 && localY <= h;
  }

  hitTest(localX, localY) {
    if (!this.model.get('visible') || !this.model.get('enabled')) return false;
    const w = this.model.get('width');
    const h = this.model.get('minimized') ? this.model.get('titleBarHeight') : this.model.get('height');
    return localX >= 0 && localX <= w && localY >= 0 && localY <= h;
  }

  onPointerMove(localX, localY) {
    const abs = this.widget ? this.widget.getAbsolutePosition() : { x: 0, y: 0 };
    const globalX = abs.x + localX;
    const globalY = abs.y + localY;

    if (this._dragMode === 'move') {
      const dx = globalX - this._startPointer.x;
      const dy = globalY - this._startPointer.y;
      if (this.model.get('maximized')) {
        this.model.restore();
      }
      this.model.update({
        x: Math.round(this._startBounds.x + dx),
        y: Math.max(0, Math.round(this._startBounds.y + dy))
      });
      return;
    }

    if (this._dragMode === 'resize') {
      const dx = globalX - this._startPointer.x;
      const dy = globalY - this._startPointer.y;
      const minW = this.model.get('minWidth');
      const minH = this.model.get('minHeight');
      this.model.update({
        width: Math.max(minW, Math.round(this._startBounds.width + dx)),
        height: Math.max(minH, Math.round(this._startBounds.height + dy))
      });
      return;
    }

    const ctrl = this._hitControl(localX, localY);
    this.model.set('hoveredControl', ctrl);
  }

  onPointerDown(localX, localY) {
    super.onPointerDown(localX, localY);

    if (this.widget && this.widget.parent && this.widget.parent.bringToFront) {
      this.widget.parent.bringToFront(this.widget);
    }

    const ctrl = this._hitControl(localX, localY);
    if (ctrl) {
      this.model.set('pressedControl', ctrl);
      return;
    }

    const abs = this.widget ? this.widget.getAbsolutePosition() : { x: 0, y: 0 };
    this._startPointer = { x: abs.x + localX, y: abs.y + localY };
    this._startBounds = {
      x: this.model.get('x'),
      y: this.model.get('y'),
      width: this.model.get('width'),
      height: this.model.get('height')
    };

    if (this._hitResizeGrip(localX, localY)) {
      this._dragMode = 'resize';
      return;
    }

    const titleH = this.model.get('titleBarHeight');
    if (localY >= 0 && localY <= titleH) {
      this._dragMode = 'move';
    }
  }

  onPointerUp(localX, localY, inside) {
    const pressedCtrl = this.model.get('pressedControl');
    this.model.set('pressedControl', null);
    this._dragMode = null;
    super.onPointerUp(localX, localY, inside);

    if (pressedCtrl && inside) {
      const currentCtrl = this._hitControl(localX, localY);
      if (currentCtrl === pressedCtrl) {
        if (pressedCtrl === 'minimize') {
          this.model.minimize();
        } else if (pressedCtrl === 'maximize') {
          const canvas = this.widget?._gui?.canvas;
          const rect = canvas ? canvas.getBoundingClientRect() : { width: 800, height: 600 };
          this.model.maximize({ width: rect.width || 800, height: rect.height || 600 });
        } else if (pressedCtrl === 'close') {
          this.model.close();
        }
      }
    }
  }

  onPointerLeave() {
    this.model.set('hoveredControl', null);
    super.onPointerLeave();
  }
}
