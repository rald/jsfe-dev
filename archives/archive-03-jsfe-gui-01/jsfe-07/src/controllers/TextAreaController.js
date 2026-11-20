import { WidgetController } from './WidgetController.js';

export class TextAreaController extends WidgetController {
  onPointerDown(localX, localY) {
    super.onPointerDown(localX, localY);
    const gutterWidth = this.model.get('showLineNumbers') ? 48 : 8;
    const textStartX = gutterWidth + 8;
    const textStartY = 8;
    const lineHeight = 20;
    const charWidth = 7.8;

    const line = Math.max(0, Math.floor((localY - textStartY) / lineHeight));
    const col = Math.max(0, Math.round((localX - textStartX) / charWidth));
    this.model.clearSelection();
    this.model.setCursor(line, col);
  }

  onKeyDown(e) {
    if (!this.model.get('enabled')) return;
    const shift = e.shiftKey;

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
      this.model.deleteForward();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.model.insertText('  ');
    } else if (!e.ctrlKey && !e.metaKey && e.key.length === 1) {
      e.preventDefault();
      this.model.insertText(e.key);
    }
  }
}
