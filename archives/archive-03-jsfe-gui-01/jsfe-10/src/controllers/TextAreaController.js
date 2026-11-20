import { WidgetController } from './WidgetController.js';

export class TextAreaController extends WidgetController {
  _getLineColFromLocal(localX, localY) {
    const gutterWidth = this.model.get('showLineNumbers') ? 48 : 8;
    const textStartX = gutterWidth + 8;
    const textStartY = 8;
    const lineHeight = 20;
    const charWidth = 7.8;

    const line = Math.max(0, Math.floor((localY - textStartY) / lineHeight));
    const col = Math.max(0, Math.round((localX - textStartX) / charWidth));
    return { line, col };
  }

  _getPageLines() {
    const h = this.model.get('height') || 360;
    const lineHeight = 20;
    return Math.max(1, Math.floor((h - 16) / lineHeight));
  }

  onPointerDown(localX, localY) {
    super.onPointerDown(localX, localY);
    const { line, col } = this._getLineColFromLocal(localX, localY);
    this.model.beginSelectionAt(line, col);
  }

  onPointerMove(localX, localY) {
    if (this.model.get('pressed')) {
      const { line, col } = this._getLineColFromLocal(localX, localY);
      this.model.updateSelectionTo(line, col);
    }
  }

  onKeyDown(e) {
    if (!this.model.get('enabled')) return;
    const shift = e.shiftKey;
    const mod = e.ctrlKey || e.metaKey;
    const keyLower = (e.key || '').toLowerCase();

    // Basic clipboard & selection shortcuts
    if (mod && keyLower === 'a') {
      e.preventDefault();
      this.model.selectAll();
      return;
    }
    if (mod && keyLower === 'c') {
      e.preventDefault();
      this.model.copy();
      return;
    }
    if (mod && keyLower === 'x') {
      e.preventDefault();
      this.model.cut();
      return;
    }
    if (mod && keyLower === 'v') {
      e.preventDefault();
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then((clipText) => {
          if (clipText) this.model.paste(clipText);
          else this.model.paste();
        }).catch(() => {
          this.model.paste();
        });
      } else {
        this.model.paste();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      this.model.clearSelection();
      return;
    }

    // Document & line navigation shortcuts
    if (e.key === 'Home') {
      e.preventDefault();
      if (mod) this.model.moveToDocumentStart(shift);
      else this.model.moveToLineStart(shift);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      if (mod) this.model.moveToDocumentEnd(shift);
      else this.model.moveToLineEnd(shift);
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      this.model.pageUp(this._getPageLines(), shift);
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      this.model.pageDown(this._getPageLines(), shift);
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.model.moveCursor(0, -1, shift);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.model.moveCursor(0, 1, shift);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.model.moveCursor(-1, 0, shift);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.model.moveCursor(1, 0, shift);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.model.insertNewLine();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      this.model.backspace();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      if (shift && this.model._getOrderedSelection()) {
        this.model.cut();
      } else {
        this.model.deleteForward();
      }
    } else if (e.key === 'Insert') {
      if (mod) {
        e.preventDefault();
        this.model.copy();
      } else if (shift) {
        e.preventDefault();
        this.model.paste();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.model.insertText('  ');
    } else if (!mod && e.key.length === 1) {
      e.preventDefault();
      this.model.insertText(e.key);
    }
  }
}
