import { WidgetView } from './WidgetView.js';

export class MenuView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme') || {};
    const bg = theme.bg || '#333c57';
    const border = theme.border || '#566c86';
    const radius = theme.radius ?? 4;

    ctx.save();
    this.roundRect(ctx, absX, absY, w, h, radius);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = border;
    ctx.stroke();
    ctx.restore();
  }
}
