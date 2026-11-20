import { WidgetView } from './WidgetView.js';

export class SliderView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme');
    const norm = m.normalized;
    const label = m.get('label');
    const val = m.get('value');

    ctx.save();
    const trackY = label ? absY + h - 8 : absY + h / 2;
    const trackH = 4;
    const knobR = 7;

    if (label) {
      ctx.fillStyle = theme.text;
      ctx.font = theme.font;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(label, absX, absY);

      ctx.fillStyle = theme.textMuted;
      ctx.textAlign = 'right';
      ctx.fillText(String(val), absX + w, absY);
    }

    this.roundRect(ctx, absX, trackY - trackH / 2, w, trackH, 2);
    ctx.fillStyle = theme.bgActive;
    ctx.fill();

    const fillW = Math.max(0, w * norm);
    if (fillW > 0) {
      this.roundRect(ctx, absX, trackY - trackH / 2, fillW, trackH, 2);
      ctx.fillStyle = theme.accent;
      ctx.fill();
    }

    const knobX = absX + fillW;
    ctx.beginPath();
    ctx.arc(knobX, trackY, m.get('hovered') || m.get('pressed') ? knobR + 1.5 : knobR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.accent;
    ctx.stroke();

    ctx.restore();
  }
}
