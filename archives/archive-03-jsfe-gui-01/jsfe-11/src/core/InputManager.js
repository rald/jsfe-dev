/**
 * Mediates DOM pointer & keyboard events on the canvas into scene-graph hit testing, focus, and capture.
 */
export class InputManager {
  constructor(canvas, rootNode) {
    this.canvas = canvas;
    this.root = rootNode;
    this._hoveredWidget = null;
    this._capturedWidget = null;
    this._focusedWidget = null;

    if (!this.canvas.hasAttribute('tabindex')) {
      this.canvas.setAttribute('tabindex', '0');
    }

    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);

    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('keydown', this._onKeyDown);
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

  _isInsideOpenMenuOrBar(widget) {
    let curr = widget;
    while (curr) {
      if (typeof curr.closeAll === 'function') return true;
      if (typeof curr.addItem === 'function' && Array.isArray(curr.items)) return true;
      if (curr.model && curr.model.get('open')) return true;
      curr = curr.parent;
    }
    return false;
  }

  _closeAllMenus() {
    this.root.traverse((node) => {
      if (typeof node.closeAll === 'function') {
        node.closeAll();
      } else if (typeof node.close === 'function' && node.model && node.model.get('open')) {
        node.close();
      }
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
    this.canvas.focus();
    const { x, y } = this._getCanvasCoords(e);
    const hit = this._hitTestTree(x, y);

    if (hit) {
      if (!this._isInsideOpenMenuOrBar(hit.widget)) {
        this._closeAllMenus();
      }

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
      if (hit.widget !== focusTarget && hit.widget.model) {
        hit.widget.model.set('focused', true);
      }
      this._capturedWidget = hit.widget;
      hit.widget.controller.onPointerDown(hit.localX, hit.localY);
    } else {
      this._setFocus(null);
      this._closeAllMenus();
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

  _handleKeyDown(e) {
    if (this._focusedWidget && this._focusedWidget.controller && typeof this._focusedWidget.controller.onKeyDown === 'function') {
      this._focusedWidget.controller.onKeyDown(e);
    }
  }

  destroy() {
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('keydown', this._onKeyDown);
  }
}
