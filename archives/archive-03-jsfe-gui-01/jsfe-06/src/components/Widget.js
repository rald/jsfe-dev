import { SceneNode } from '../patterns/SceneNode.js';

/**
 * Retained-mode Component Node binding Model + View + Controller into the Scene Graph.
 */
export class Widget extends SceneNode {
  constructor(model, view, controller) {
    super();
    this.model = model;
    this.view = view;
    this.controller = controller;
    this._gui = null;
  }

  getAbsolutePosition() {
    let x = this.model.get('x');
    let y = this.model.get('y');
    let curr = this.parent;
    while (curr && curr.model) {
      x += curr.model.get('x');
      y += curr.model.get('y');
      curr = curr.parent;
    }
    return { x, y };
  }

  on(event, listener) {
    return this.model.on(event, listener);
  }

  setProps(patch) {
    this.model.update(patch);
    return this;
  }

  renderTree(ctx) {
    if (!this.model.get('visible')) return;
    const { x, y } = this.getAbsolutePosition();
    this.view.render(ctx, x, y);
    this.model.markClean();
    for (const child of this.children) {
      child.renderTree(ctx);
    }
  }
}
