import { WidgetView } from './WidgetView.js';

export class PanelView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme');
    const title = m.get('title');

    ctx.save();
    this.roundRect(ctx, absX, absY, w, h, theme.radius);
    ctx.fillStyle = theme.bg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.border;
    ctx.stroke();

    if (title) {
      ctx.fillStyle = theme.textMuted;
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(title.toUpperCase(), absX + 12, absY + 10);
    }
    ctx.restore();
  }
}
