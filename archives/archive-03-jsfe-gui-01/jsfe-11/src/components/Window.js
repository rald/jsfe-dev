import { Widget } from './Widget.js';
import { WindowModel } from '../models/WindowModel.js';
import { WindowView } from '../views/WindowView.js';
import { WindowController } from '../controllers/WindowController.js';

export class Window extends Widget {
  constructor(options = {}) {
    const model = new WindowModel(options);
    const view = new WindowView(model);
    let controller = null;
    super(model, view, null);
    controller = new WindowController(model, this);
    this.controller = controller;
  }

  addContent(child) {
    const bounds = this.model.getContentBounds();
    const curX = child.model ? child.model.get('x') : 0;
    const curY = child.model ? child.model.get('y') : 0;
    if (child.model) {
      child.model.update({
        x: bounds.x + curX,
        y: bounds.y + curY
      });
    }
    this.add(child);
    return child;
  }

  minimize() {
    this.model.minimize();
    return this;
  }

  maximize(viewport) {
    this.model.maximize(viewport);
    return this;
  }

  restore() {
    this.model.restore();
    return this;
  }

  close() {
    this.model.close();
    return this;
  }

  renderTree(ctx) {
    if (!this.model.get('visible')) return;
    const { x, y } = this.getAbsolutePosition();
    this.view.render(ctx, x, y);
    this.model.markClean();

    if (this.model.get('minimized')) return;

    const titleH = this.model.get('titleBarHeight');
    const w = this.model.get('width');
    const h = Math.max(0, this.model.get('height') - titleH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + titleH, w, h);
    ctx.clip();
    for (const child of this.children) {
      child.renderTree(ctx);
    }
    ctx.restore();
  }
}
