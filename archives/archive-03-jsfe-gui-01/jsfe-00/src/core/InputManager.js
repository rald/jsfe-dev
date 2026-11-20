/**
 * Mediates DOM pointer events on the canvas into scene-graph hit testing, focus, and capture.
 */
export class InputManager {
  constructor(canvas, rootNode) {
    this.canvas = canvas;
    this.root = rootNode;
    this._hoveredWidget = null;
    this._capturedWidget = null;
    this._focusedWidget = null;

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
      if (!node.model.get('visible') || !node.model.get('enabled')) return null;

      // If a window is minimized, do not hit-test children inside its body
      if (node.model.get('minimized') === true) {
        const abs = node.getAbsolutePosition();
        const titleH = node.model.get('titleBarHeight') ?? 32;
        if (y > abs.y + titleH) return null;
      }

      const abs = node.getAbsolutePosition();
      const localX = x - abs.x;
      const localY = y - abs.y;
      if (node.controller.hitTest(localX, localY)) {
        return { widget: node, localX, localY };
      }
      return null;
    });
  }

  _setFocus(widget) {
    if (this._focusedWidget === widget) return;
    if (this._focusedWidget && this._focusedWidget.model) {
      this._focusedWidget.model.set('focused', false);
    }
    this._focusedWidget = widget;
    if (this._focusedWidget && this._focusedWidget.model) {
      this._focusedWidget.model.set('focused', true);
    }
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
      // Find top-level or window ancestor for focus ring
      let focusTarget = hit.widget;
      let curr = hit.widget;
      while (curr) {
        if (curr.model && curr.model.get('titleBarHeight') !== undefined) {
          focusTarget = curr;
          break;
        }
        curr = curr.parent;
      }
      this._setFocus(focusTarget);
      this._capturedWidget = hit.widget;
      hit.widget.controller.onPointerDown(hit.localX, hit.localY);
    } else {
      this._setFocus(null);
      this.root.traverse((node) => {
        if (typeof node.closeAll === 'function') {
          node.closeAll();
        } else if (typeof node.close === 'function' && node.model && node.model.get('open')) {
          node.close();
        }
      });
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
