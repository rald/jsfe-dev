import { WidgetView } from './WidgetView.js';

export class MenuItemView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = m.get('theme') || {};

    const bgHover = theme.bgHover || '#29366f';
    const accent = theme.accent || '#41a6f6';
    const border = theme.border || '#566c86';
    const textColor = theme.text || '#f4f4f4';
    const mutedColor = theme.textMuted || '#94b0c2';
    const font = theme.font || '13px "Courier New", Courier, monospace';

    ctx.save();
    if (m.get('separator')) {
      const midY = absY + h / 2;
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(absX + 8, midY);
      ctx.lineTo(absX + w - 8, midY);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const enabled = m.get('enabled') !== false;
    const hovered = Boolean(m.get('hovered') || m.get('submenuOpen'));

    if (hovered && enabled) {
      this.roundRect(ctx, absX + 4, absY + 1, w - 8, h - 2, 4);
      ctx.fillStyle = accent;
      ctx.fill();
    }

    const checked = m.get('checked');
    const prefix = checked === true ? '✓ ' : checked === false ? '  ' : '';
    const label = String(m.get('label') ?? '');

    ctx.fillStyle = !enabled ? mutedColor : (hovered ? '#f4f4f4' : textColor);
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${prefix}${label}`, absX + 12, absY + h / 2);

    const shortcut = m.get('shortcut');
    if (shortcut && !m.get('hasSubmenu')) {
      ctx.fillStyle = !enabled ? mutedColor : (hovered ? '#f4f4f4' : mutedColor);
      ctx.font = font;
      ctx.textAlign = 'right';
      ctx.fillText(String(shortcut), absX + w - 12, absY + h / 2);
    }

    if (m.get('hasSubmenu')) {
      ctx.fillStyle = !enabled ? mutedColor : (hovered ? '#f4f4f4' : mutedColor);
      ctx.font = font;
      ctx.textAlign = 'right';
      ctx.fillText('▸', absX + w - 10, absY + h / 2);
    }

    ctx.restore();
  }
}
