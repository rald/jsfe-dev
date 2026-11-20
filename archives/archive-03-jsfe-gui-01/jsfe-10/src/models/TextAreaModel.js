import { WidgetModel } from './WidgetModel.js';

/**
 * Model for a multi-line editable text buffer with cursor, selection,
 * HOME/END/PGUP/PGDN navigation, clipboard support, and line numbers.
 */
export class TextAreaModel extends WidgetModel {
  constructor(options = {}) {
    super({
      width: options.width ?? 600,
      height: options.height ?? 360,
      ...options,
      theme: {
        bg: '#0000aa',
        text: '#ffffff',
        gutterBg: '#000080',
        gutterText: '#80ffff',
        cursorColor: '#ffff55',
        selectionBg: 'rgba(255, 255, 85, 0.28)',
        border: '#55ffff',
        radius: 0,
        font: '14px "Courier New", Courier, monospace',
        ...(options.theme || {})
      }
    });

    const initialText = options.text ?? '';
    this._state.lines = initialText.split('\n');
    this._state.cursorLine = options.cursorLine ?? 0;
    this._state.cursorCol = options.cursorCol ?? 0;
    this._state.scrollLine = 0;
    this._state.scrollCol = 0;
    this._state.showLineNumbers = options.showLineNumbers ?? true;
    this._state.wordWrap = options.wordWrap ?? false;
    this._state.modified = false;
    this._state.cursorVisible = true;
    this._state.selectionStart = null; // { line, col } | null
    this._state.selectionEnd = null;   // { line, col } | null
    this._state.clipboard = '';
  }

  getText() {
    return this._state.lines.join('\n');
  }

  setText(newText, markModified = false) {
    const lines = String(newText ?? '').split('\n');
    this._state.lines = lines;
    this._state.cursorLine = 0;
    this._state.cursorCol = 0;
    this._state.scrollLine = 0;
    this._state.scrollCol = 0;
    this._state.selectionStart = null;
    this._state.selectionEnd = null;
    this._state.modified = markModified;
    this._state.dirty = true;
    this.emit('change:text', { text: this.getText(), lines });
    this.emit('cursor', { line: 1, col: 1 });
    this.emit('change', { key: 'text', value: this.getText() });
  }

  _notifyCursor() {
    this._state.dirty = true;
    this.emit('cursor', {
      line: this._state.cursorLine + 1,
      col: this._state.cursorCol + 1
    });
  }

  _notifyContentChanged() {
    this._state.modified = true;
    this._state.dirty = true;
    this.emit('change:text', {
      text: this.getText(),
      lines: this._state.lines
    });
    this._notifyCursor();
  }

  clearSelection() {
    this._state.selectionStart = null;
    this._state.selectionEnd = null;
    this._state.dirty = true;
  }

  selectAll() {
    const lines = this._state.lines;
    const lastLine = Math.max(0, lines.length - 1);
    const lastCol = (lines[lastLine] ?? '').length;
    this._state.selectionStart = { line: 0, col: 0 };
    this._state.selectionEnd = { line: lastLine, col: lastCol };
    this._state.cursorLine = lastLine;
    this._state.cursorCol = lastCol;
    this._notifyCursor();
  }

  _getOrderedSelection() {
    const s = this._state.selectionStart;
    const e = this._state.selectionEnd;
    if (!s || !e) return null;
    if (s.line < e.line || (s.line === e.line && s.col <= e.col)) {
      return { start: s, end: e };
    }
    return { start: e, end: s };
  }

  getSelectedText() {
    const sel = this._getOrderedSelection();
    if (!sel) return '';
    const lines = this._state.lines;
    if (sel.start.line === sel.end.line) {
      return (lines[sel.start.line] ?? '').slice(sel.start.col, sel.end.col);
    }
    const parts = [(lines[sel.start.line] ?? '').slice(sel.start.col)];
    for (let i = sel.start.line + 1; i < sel.end.line; i++) {
      parts.push(lines[i] ?? '');
    }
    parts.push((lines[sel.end.line] ?? '').slice(0, sel.end.col));
    return parts.join('\n');
  }

  copy() {
    const selected = this.getSelectedText();
    if (!selected) return '';
    this._state.clipboard = selected;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(selected).catch(() => {});
    }
    this.emit('copy', { text: selected });
    return selected;
  }

  cut() {
    const selected = this.getSelectedText();
    if (!selected) return '';
    this._state.clipboard = selected;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(selected).catch(() => {});
    }
    this.deleteSelection();
    this.emit('cut', { text: selected });
    return selected;
  }

  paste(externalText = null) {
    const textToInsert = externalText !== null && externalText !== undefined
      ? String(externalText)
      : this._state.clipboard;
    if (!textToInsert) return;
    this.insertText(textToInsert);
    this.emit('paste', { text: textToInsert });
  }

  deleteSelection() {
    const sel = this._getOrderedSelection();
    if (!sel) return false;
    const lines = this._state.lines;
    const before = (lines[sel.start.line] ?? '').slice(0, sel.start.col);
    const after = (lines[sel.end.line] ?? '').slice(sel.end.col);
    lines.splice(sel.start.line, sel.end.line - sel.start.line + 1, before + after);
    this._state.cursorLine = sel.start.line;
    this._state.cursorCol = sel.start.col;
    this.clearSelection();
    this._notifyContentChanged();
    return true;
  }

  insertText(str) {
    if (!str) return;
    if (this._getOrderedSelection()) {
      this.deleteSelection();
    }
    const lines = this._state.lines;
    const lineIdx = this._state.cursorLine;
    const colIdx = this._state.cursorCol;
    const current = lines[lineIdx] ?? '';
    const before = current.slice(0, colIdx);
    const after = current.slice(colIdx);

    const parts = String(str).split('\n');
    if (parts.length === 1) {
      lines[lineIdx] = before + parts[0] + after;
      this._state.cursorCol = colIdx + parts[0].length;
    } else {
      lines[lineIdx] = before + parts[0];
      const middle = parts.slice(1, -1);
      const lastLine = parts[parts.length - 1] + after;
      lines.splice(lineIdx + 1, 0, ...middle, lastLine);
      this._state.cursorLine = lineIdx + parts.length - 1;
      this._state.cursorCol = parts[parts.length - 1].length;
    }
    this._notifyContentChanged();
  }

  insertNewLine() {
    this.insertText('\n');
  }

  backspace() {
    if (this.deleteSelection()) return;
    const lines = this._state.lines;
    const lineIdx = this._state.cursorLine;
    const colIdx = this._state.cursorCol;

    if (colIdx > 0) {
      const cur = lines[lineIdx];
      lines[lineIdx] = cur.slice(0, colIdx - 1) + cur.slice(colIdx);
      this._state.cursorCol = colIdx - 1;
      this._notifyContentChanged();
    } else if (lineIdx > 0) {
      const prevLen = lines[lineIdx - 1].length;
      lines[lineIdx - 1] = lines[lineIdx - 1] + lines[lineIdx];
      lines.splice(lineIdx, 1);
      this._state.cursorLine = lineIdx - 1;
      this._state.cursorCol = prevLen;
      this._notifyContentChanged();
    }
  }

  deleteForward() {
    if (this.deleteSelection()) return;
    const lines = this._state.lines;
    const lineIdx = this._state.cursorLine;
    const colIdx = this._state.cursorCol;
    const cur = lines[lineIdx];

    if (colIdx < cur.length) {
      lines[lineIdx] = cur.slice(0, colIdx) + cur.slice(colIdx + 1);
      this._notifyContentChanged();
    } else if (lineIdx < lines.length - 1) {
      lines[lineIdx] = cur + lines[lineIdx + 1];
      lines.splice(lineIdx + 1, 1);
      this._notifyContentChanged();
    }
  }

  _setCursorPosition(nextLine, nextCol, extendSelection = false) {
    if (extendSelection && !this._state.selectionStart) {
      this._state.selectionStart = {
        line: this._state.cursorLine,
        col: this._state.cursorCol
      };
    } else if (!extendSelection) {
      this.clearSelection();
    }

    const lines = this._state.lines;
    const clampedLine = Math.min(lines.length - 1, Math.max(0, nextLine));
    const clampedCol = Math.min((lines[clampedLine] ?? '').length, Math.max(0, nextCol));

    this._state.cursorLine = clampedLine;
    this._state.cursorCol = clampedCol;

    if (extendSelection) {
      this._state.selectionEnd = { line: clampedLine, col: clampedCol };
    }
    this._notifyCursor();
  }

  moveCursor(dLine, dCol, extendSelection = false) {
    const lines = this._state.lines;
    let nextLine = Math.min(lines.length - 1, Math.max(0, this._state.cursorLine + dLine));
    let nextCol = this._state.cursorCol + dCol;

    if (nextCol < 0 && nextLine > 0) {
      nextLine -= 1;
      nextCol = (lines[nextLine] ?? '').length;
    } else if (nextCol > (lines[nextLine] ?? '').length && nextLine < lines.length - 1) {
      nextLine += 1;
      nextCol = 0;
    } else {
      nextCol = Math.min((lines[nextLine] ?? '').length, Math.max(0, nextCol));
    }

    this._setCursorPosition(nextLine, nextCol, extendSelection);
  }

  moveToLineStart(extendSelection = false) {
    this._setCursorPosition(this._state.cursorLine, 0, extendSelection);
  }

  moveToLineEnd(extendSelection = false) {
    const lineLen = (this._state.lines[this._state.cursorLine] ?? '').length;
    this._setCursorPosition(this._state.cursorLine, lineLen, extendSelection);
  }

  moveToDocumentStart(extendSelection = false) {
    this._setCursorPosition(0, 0, extendSelection);
  }

  moveToDocumentEnd(extendSelection = false) {
    const lines = this._state.lines;
    const lastLine = Math.max(0, lines.length - 1);
    const lastCol = (lines[lastLine] ?? '').length;
    this._setCursorPosition(lastLine, lastCol, extendSelection);
  }

  pageUp(pageSize = 10, extendSelection = false) {
    const step = Math.max(1, pageSize);
    this._setCursorPosition(this._state.cursorLine - step, this._state.cursorCol, extendSelection);
  }

  pageDown(pageSize = 10, extendSelection = false) {
    const step = Math.max(1, pageSize);
    this._setCursorPosition(this._state.cursorLine + step, this._state.cursorCol, extendSelection);
  }

  beginSelectionAt(line, col) {
    const lines = this._state.lines;
    const clampedLine = Math.min(lines.length - 1, Math.max(0, line));
    const clampedCol = Math.min((lines[clampedLine] ?? '').length, Math.max(0, col));
    this._state.cursorLine = clampedLine;
    this._state.cursorCol = clampedCol;
    this._state.selectionStart = { line: clampedLine, col: clampedCol };
    this._state.selectionEnd = { line: clampedLine, col: clampedCol };
    this._notifyCursor();
  }

  updateSelectionTo(line, col) {
    if (!this._state.selectionStart) {
      this.beginSelectionAt(line, col);
      return;
    }
    const lines = this._state.lines;
    const clampedLine = Math.min(lines.length - 1, Math.max(0, line));
    const clampedCol = Math.min((lines[clampedLine] ?? '').length, Math.max(0, col));
    this._state.cursorLine = clampedLine;
    this._state.cursorCol = clampedCol;
    this._state.selectionEnd = { line: clampedLine, col: clampedCol };
    this._notifyCursor();
  }

  setCursor(line, col) {
    this.clearSelection();
    this._setCursorPosition(line, col, false);
  }

  findAndSelect(query, fromLine = 0, fromCol = 0) {
    if (!query) return false;
    const lines = this._state.lines;
    for (let i = fromLine; i < lines.length; i++) {
      const startSearchCol = i === fromLine ? fromCol : 0;
      const idx = lines[i].indexOf(query, startSearchCol);
      if (idx !== -1) {
        this._state.selectionStart = { line: i, col: idx };
        this._state.selectionEnd = { line: i, col: idx + query.length };
        this._state.cursorLine = i;
        this._state.cursorCol = idx + query.length;
        this._notifyCursor();
        return true;
      }
    }
    return false;
  }
}
