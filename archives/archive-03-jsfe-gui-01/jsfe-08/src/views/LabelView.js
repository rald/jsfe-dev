import { WidgetView } from './WidgetView.js';

export class LabelView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme');
    const align = m.get('align');

    ctx.save();
    ctx.fillStyle = theme.text;
    ctx.font = theme.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;

    let tx = absX;
    if (align === 'center') tx = absX + w / 2;
    else if (align === 'right') tx = absX + w;

    ctx.fillText(m.get('text'), tx, absY + h / 2);
    ctx.restore();
  }
}
