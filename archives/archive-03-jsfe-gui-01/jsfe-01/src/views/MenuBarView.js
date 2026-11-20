import { WidgetView } from './WidgetView.js';

export class MenuBarView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme');

    ctx.save();
    ctx.fillStyle = theme.bg;
    ctx.fillRect(absX, absY, w, h);

    ctx.beginPath();
    ctx.moveTo(absX, absY + h - 0.5);
    ctx.lineTo(absX + w, absY + h - 0.5);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}
