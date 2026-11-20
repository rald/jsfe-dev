import { WidgetView } from './WidgetView.js';
import { SWEETIE_16_THEME } from '../themes/sweetie16Dark.js';

export class MenuView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = { ...SWEETIE_16_THEME, ...(m.get('theme') || {}) };

    ctx.save();
    this.roundRect(ctx, absX, absY, w, h, theme.radius);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.border;
    ctx.stroke();
    ctx.restore();
  }
}
