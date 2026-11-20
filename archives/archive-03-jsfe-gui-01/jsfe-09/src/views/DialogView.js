import { WidgetView } from './WidgetView.js';

export class DialogView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    if (!m.get('visible')) return;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme');

    ctx.save();
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';

    // Dialog box fill & double/sharp border
    ctx.fillStyle = theme.bg;
    ctx.fillRect(absX, absY, w, h);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(absX, absY, w, h);

    // Header bar
    const headerH = 26;
    ctx.fillStyle = theme.headerBg;
    ctx.fillRect(absX + 2, absY + 2, w - 4, headerH);
    ctx.fillStyle = theme.headerText;
    ctx.textAlign = 'center';
    ctx.fillText(m.get('title'), absX + w / 2, absY + 2 + headerH / 2);

    // Message
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'left';
    ctx.fillText(m.get('message'), absX + 18, absY + 52);

    // Optional input box
    if (m.get('hasInput')) {
      const ix = absX + 18;
      const iy = absY + 70;
      const iw = w - 36;
      const ih = 26;
      ctx.fillStyle = theme.inputBg;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeStyle = theme.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(ix, iy, iw, ih);

      ctx.fillStyle = theme.inputText;
      ctx.fillText(m.get('inputValue') + '_', ix + 8, iy + ih / 2);
    }

    // Buttons at bottom
    const buttons = m.get('buttons') || [];
    const btnW = 92;
    const btnH = 28;
    const gap = 14;
    const totalW = buttons.length * btnW + Math.max(0, buttons.length - 1) * gap;
    let bx = absX + (w - totalW) / 2;
    const by = absY + h - btnH - 14;

    for (const label of buttons) {
      const hovered = m.get('hoveredButton') === label;
      ctx.fillStyle = hovered ? theme.btnActive : theme.btnBg;
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeStyle = theme.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, btnW, btnH);

      ctx.fillStyle = theme.btnText;
      ctx.textAlign = 'center';
      ctx.fillText(label, bx + btnW / 2, by + btnH / 2);
      bx += btnW + gap;
    }

    ctx.restore();
  }
}
