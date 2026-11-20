/**
 * Base View (MVC): Renders a WidgetModel onto a 2D Canvas context.
 */
export class WidgetView {
  constructor(model) {
    this.model = model;
  }

  roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  render(ctx, absX, absY) {
    // Subclasses override this method
  }
}
