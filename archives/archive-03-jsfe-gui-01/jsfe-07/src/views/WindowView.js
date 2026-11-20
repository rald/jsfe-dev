import { WidgetView } from './WidgetView.js';

export class WindowView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme');
    const titleH = m.get('titleBarHeight');
    const minimized = m.get('minimized');
    const focused = m.get('focused');
    const hoveredControl = m.get('hoveredControl');
    const totalH = minimized ? titleH : h;

    ctx.save();

    this.roundRect(ctx, absX, absY, w, totalH, theme.radius);
    ctx.fillStyle = theme.bg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = focused ? theme.accent : theme.border;
    ctx.stroke();

    ctx.save();
    this.roundRect(ctx, absX, absY, w, titleH, theme.radius);
    ctx.clip();
    ctx.fillStyle = focused ? theme.titleActiveBg : theme.titleBg;
    ctx.fillRect(absX, absY, w, titleH);

    ctx.beginPath();
    ctx.moveTo(absX, absY + titleH - 0.5);
    ctx.lineTo(absX + w, absY + titleH - 0.5);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = theme.text;
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.get('title'), absX + 12, absY + titleH / 2);

    const btnSize = 18;
    const gap = 6;
    let cursorX = absX + w - 10;
    const btnY = absY + (titleH - btnSize) / 2;

    const controls = [];
    if (m.get('closable')) controls.push({ id: 'close', symbol: '×' });
    if (m.get('maximizable')) controls.push({ id: 'maximize', symbol: m.get('maximized') ? '❐' : '□' });
    if (m.get('minimizable')) controls.push({ id: 'minimize', symbol: '−' });

    for (const ctrl of controls) {
      cursorX -= btnSize;
      const isHovered = hoveredControl === ctrl.id;

      this.roundRect(ctx, cursorX, btnY, btnSize, btnSize, 4);
      if (isHovered) {
        ctx.fillStyle = ctrl.id === 'close' ? theme.danger : theme.bgHover;
        ctx.fill();
      }

      ctx.fillStyle = isHovered ? '#ffffff' : theme.textMuted;
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctrl.symbol, cursorX + btnSize / 2, btnY + btnSize / 2 + 0.5);

      cursorX -= gap;
    }

    if (!minimized && m.get('resizable')) {
      ctx.strokeStyle = theme.textMuted;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(absX + w - 12, absY + totalH - 5);
      ctx.lineTo(absX + w - 5, absY + totalH - 12);
      ctx.moveTo(absX + w - 8, absY + totalH - 5);
      ctx.lineTo(absX + w - 5, absY + totalH - 8);
      ctx.stroke();
    }

    ctx.restore();
  }
}
