import { WidgetController } from './WidgetController.js';

export class DialogController extends WidgetController {
  _getButtonRects() {
    const w = this.model.get('width');
    const h = this.model.get('height');
    const buttons = this.model.get('buttons') || [];
    const btnW = 92;
    const btnH = 28;
    const gap = 14;
    const totalW = buttons.length * btnW + Math.max(0, buttons.length - 1) * gap;
    let bx = (w - totalW) / 2;
    const by = h - btnH - 14;
    const rects = [];
    for (const label of buttons) {
      rects.push({ label, x: bx, y: by, width: btnW, height: btnH });
      bx += btnW + gap;
    }
    return rects;
  }

  _hitButton(localX, localY) {
    for (const r of this._getButtonRects()) {
      if (localX >= r.x && localX <= r.x + r.width && localY >= r.y && localY <= r.y + r.height) {
        return r.label;
      }
    }
    return null;
  }

  onPointerMove(localX, localY) {
    this.model.set('hoveredButton', this._hitButton(localX, localY));
  }

  onPointerDown(localX, localY) {
    super.onPointerDown(localX, localY);
    const btn = this._hitButton(localX, localY);
    if (btn) {
      this.model.close(btn);
    }
  }

  onKeyDown(e) {
    if (!this.model.get('visible')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.model.close('Cancel');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const buttons = this.model.get('buttons') || [];
      this.model.close(buttons[0] || 'OK');
    } else if (this.model.get('hasInput')) {
      if (e.key === 'Backspace') {
        e.preventDefault();
        const cur = this.model.get('inputValue') || '';
        this.model.set('inputValue', cur.slice(0, -1));
      } else if (!e.ctrlKey && !e.metaKey && e.key.length === 1) {
        e.preventDefault();
        const cur = this.model.get('inputValue') || '';
        this.model.set('inputValue', cur + e.key);
      }
    }
  }
}
