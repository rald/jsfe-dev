import { WidgetView } from './WidgetView.js';

export class TextAreaView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme');
    const lines = m.get('lines');
    const showLineNumbers = m.get('showLineNumbers');
    const cursorLine = m.get('cursorLine');
    const cursorCol = m.get('cursorCol');
    const focused = m.get('focused');

    ctx.save();
    ctx.font = theme.font;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const lineHeight = 20;
    // Measure actual monospace advance width so cursor matches character width
    const measuredW = ctx.measureText('M').width;
    const charWidth = measuredW > 0 ? measuredW : 8.4;

    // Editor background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(absX, absY, w, h);

    // Line numbers gutter
    const gutterWidth = showLineNumbers ? 48 : 8;
    if (showLineNumbers) {
      ctx.fillStyle = theme.gutterBg;
      ctx.fillRect(absX, absY, gutterWidth, h);
    }

    const textStartX = absX + gutterWidth + 8;
    const textStartY = absY + 8;
    const visibleLines = Math.max(1, Math.floor((h - 16) / lineHeight));
    const scrollLine = Math.max(0, Math.min(lines.length - 1, cursorLine - visibleLines + 1));

    for (let i = 0; i < visibleLines; i++) {
      const lineIdx = scrollLine + i;
      if (lineIdx >= lines.length) break;
      const y = textStartY + i * lineHeight;

      if (showLineNumbers) {
        ctx.fillStyle = lineIdx === cursorLine ? '#ffffff' : theme.gutterText;
        ctx.fillText(String(lineIdx + 1).padStart(3, ' '), absX + 6, y);
      }

      const lineStr = lines[lineIdx];
      ctx.fillStyle = theme.text;
      ctx.fillText(lineStr, textStartX, y);

      // Selection highlight on this line
      const selStart = m.get('selectionStart');
      const selEnd = m.get('selectionEnd');
      if (selStart && selEnd) {
        let s = selStart;
        let e = selEnd;
        if (s.line > e.line || (s.line === e.line && s.col > e.col)) {
          [s, e] = [e, s];
        }
        if (lineIdx >= s.line && lineIdx <= e.line) {
          const startCol = lineIdx === s.line ? s.col : 0;
          const endCol = lineIdx === e.line ? e.col : lineStr.length;
          if (endCol > startCol) {
            ctx.fillStyle = theme.selectionBg;
            ctx.fillRect(
              textStartX + startCol * charWidth,
              y - 1,
              (endCol - startCol) * charWidth,
              lineHeight
            );
          }
        }
      }

      // Compact cursor (2px vertical bar or bottom underline) so it doesn't look oversized
      if (focused && lineIdx === cursorLine && m.get('cursorVisible')) {
        const cx = textStartX + cursorCol * charWidth;
        const cursorStyle = m.get('cursorStyle') ?? 'bar'; // 'bar' | 'underline'
        ctx.fillStyle = theme.cursorColor;
        if (cursorStyle === 'underline') {
          ctx.fillRect(cx, y + lineHeight - 5, charWidth, 2);
        } else {
          ctx.fillRect(cx, y + 1, 2, Math.max(12, lineHeight - 5));
        }
      }
    }

    ctx.restore();
  }
}
