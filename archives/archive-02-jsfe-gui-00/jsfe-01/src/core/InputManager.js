/**
 * Mediates DOM pointer events on the canvas into scene-graph hit testing and capture.
 */
export class InputManager {
  constructor(canvas, rootNode) {
    this.canvas = canvas;
    this.root = rootNode;
    this._hoveredWidget = null;
    this._capturedWidget = null;

    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);

    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  _getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  _hitTestTree(x, y) {
    return this.root.traverseReverse((node) => {
      if (!node.model || !node.controller) return null;
      const abs = node.getAbsolutePosition();
      const localX = x - abs.x;
      const localY = y - abs.y;
      if (node.controller.hitTest(localX, localY)) {
        return { widget: node, localX, localY };
      }
      return null;
    });
  }

  _handlePointerMove(e) {
    const { x, y } = this._getCanvasCoords(e);

    if (this._capturedWidget) {
      const abs = this._capturedWidget.getAbsolutePosition();
      this._capturedWidget.controller.onPointerMove(x - abs.x, y - abs.y);
      return;
    }

    const hit = this._hitTestTree(x, y);
    const target = hit ? hit.widget : null;

    if (target !== this._hoveredWidget) {
      if (this._hoveredWidget) {
        this._hoveredWidget.controller.onPointerLeave();
      }
      this._hoveredWidget = target;
      if (this._hoveredWidget) {
        this._hoveredWidget.controller.onPointerEnter();
        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }

    if (target && hit) {
      target.controller.onPointerMove(hit.localX, hit.localY);
    }
  }

  _handlePointerDown(e) {
    const { x, y } = this._getCanvasCoords(e);
    const hit = this._hitTestTree(x, y);
    if (hit) {
      this._capturedWidget = hit.widget;
      hit.widget.controller.onPointerDown(hit.localX, hit.localY);
    }
  }

  _handlePointerUp(e) {
    if (!this._capturedWidget) return;
    const { x, y } = this._getCanvasCoords(e);
    const abs = this._capturedWidget.getAbsolutePosition();
    const localX = x - abs.x;
    const localY = y - abs.y;
    const inside = this._capturedWidget.controller.hitTest(localX, localY);

    this._capturedWidget.controller.onPointerUp(localX, localY, inside);
    this._capturedWidget = null;
  }

  destroy() {
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);
  }
}
