import { WidgetView } from './WidgetView.js';

export class ToggleView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const h = m.get('height');
    const theme = m.get('theme');
    const checked = m.get('checked');

    const pillW = 38;
    const pillH = 20;
    const pillY = absY + (h - pillH) / 2;

    ctx.save();
    this.roundRect(ctx, absX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = checked ? theme.accent : theme.bgActive;
    ctx.fill();

    const knobR = 7;
    const knobX = checked ? absX + pillW - pillH / 2 : absX + pillH / 2;
    ctx.beginPath();
    ctx.arc(knobX, pillY + pillH / 2, knobR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.fillStyle = theme.text;
    ctx.font = theme.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.get('label'), absX + pillW + 10, absY + h / 2);
    ctx.restore();
  }
}
