import { WidgetView } from './WidgetView.js';
import { SWEETIE_16_THEME } from '../themes/sweetie16Dark.js';

export class MenuItemView extends WidgetView {
  render(ctx, absX, absY) {
    const m = this.model;
    const w = m.get('width');
    const h = m.get('height');
    const theme = { ...SWEETIE_16_THEME, ...(m.get('theme') || {}) };

    ctx.save();
    if (m.get('separator')) {
      const midY = absY + h / 2;
      ctx.strokeStyle = theme.border;
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
      this.roundRect(ctx, absX + 4, absY + 1, w - 8, h - 2, theme.radius);
      ctx.fillStyle = theme.accent;
      ctx.fill();
    }

    const checked = m.get('checked');
    const prefix = checked === true ? '✓ ' : checked === false ? '  ' : '';
    const label = String(m.get('label') ?? '');

    ctx.fillStyle = !enabled ? theme.textMuted : theme.text;
    ctx.font = theme.uiFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${prefix}${label}`, absX + 12, absY + h / 2);

    const shortcut = m.get('shortcut');
    if (shortcut && !m.get('hasSubmenu')) {
      ctx.fillStyle = !enabled ? theme.textMuted : theme.textMuted;
      ctx.font = theme.uiFont;
      ctx.textAlign = 'right';
      ctx.fillText(String(shortcut), absX + w - 12, absY + h / 2);
    }

    if (m.get('hasSubmenu')) {
      ctx.fillStyle = !enabled ? theme.textMuted : theme.textMuted;
      ctx.font = theme.uiFont;
      ctx.textAlign = 'right';
      ctx.fillText('▸', absX + w - 10, absY + h / 2);
    }

    ctx.restore();
  }
}
