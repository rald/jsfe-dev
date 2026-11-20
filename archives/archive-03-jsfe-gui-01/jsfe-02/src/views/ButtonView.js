import { WidgetView } from './WidgetView.js';

export class ButtonView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme');
    const hovered = m.get('hovered');
    const pressed = m.get('pressed');
    const enabled = m.get('enabled');

    let fill = theme.bg;
    if (!enabled) fill = '#232428';
    else if (pressed) fill = theme.bgActive;
    else if (hovered) fill = theme.bgHover;

    ctx.save();
    this.roundRect(ctx, absX, absY, w, h, theme.radius);
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.lineWidth = 1;
    ctx.strokeStyle = hovered && enabled ? theme.accent : theme.border;
    ctx.stroke();

    ctx.fillStyle = enabled ? theme.text : theme.textMuted;
    ctx.font = theme.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.get('label'), absX + w / 2, absY + h / 2);
    ctx.restore();
  }
}
