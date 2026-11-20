import { Widget } from './Widget.js';
import { MenuBarModel } from '../models/MenuBarModel.js';
import { MenuBarView } from '../views/MenuBarView.js';
import { MenuBarController } from '../controllers/MenuBarController.js';
import { Menu } from './Menu.js';

/**
 * Top-level application MenuBar ("friends" with Menu & MenuItem) coordinating dropdown menus.
 */
export class MenuBar extends Widget {
  constructor(options = {}) {
    const model = new MenuBarModel(options);
    const view = new MenuBarView(model);
    let controller = null;
    super(model, view, null);
    controller = new MenuBarController(model, this);
    this.controller = controller;

    this._entries = []; // { label, menu, x, width }
    this._hoveredIndex = -1;
    this._nextX = 8;

    if (Array.isArray(options.menus)) {
      for (const mCfg of options.menus) {
        this.addMenu(mCfg.label, mCfg.items || [], mCfg.menuOptions || {});
      }
    }
  }

  addMenu(label, items = [], menuOptions = {}) {
    const font = this.model.get('theme').font;
    const width = Math.max(56, label.length * 8 + 24);
    const entryX = this._nextX;
    this._nextX += width + 4;

    const menu = new Menu({
      x: entryX,
      y: this.model.get('height'),
      visible: false,
      items,
      _onCloseRoot: () => this.closeAll(),
      ...menuOptions
    });

    const entry = { label, menu, x: entryX, width };
    this._entries.push(entry);
    return menu;
  }

  findEntryAt(localX, localY) {
    const h = this.model.get('height');
    if (localY < 0 || localY > h) return null;
    for (let i = 0; i < this._entries.length; i++) {
      const e = this._entries[i];
      if (localX >= e.x && localX <= e.x + e.width) {
        return { entry: e, index: i };
      }
    }
    return null;
  }

  openEntry(index) {
    for (let i = 0; i < this._entries.length; i++) {
      const e = this._entries[i];
      if (i === index) {
        const abs = this.getAbsolutePosition();
        e.menu.open(abs.x + e.x, abs.y + this.model.get('height'));
      } else {
        e.menu.close();
      }
    }
    this.model.set('activeIndex', index);
  }

  toggleEntry(index) {
    if (this.model.get('activeIndex') === index) {
      this.closeAll();
    } else {
      this.openEntry(index);
    }
  }

  closeAll() {
    for (const e of this._entries) {
      e.menu.close();
    }
    this.model.set('activeIndex', -1);
  }

  renderTree(ctx) {
    if (!this.model.get('visible')) return;
    const { x, y } = this.getAbsolutePosition();
    this.view.render(ctx, x, y);
    this.model.markClean();

    const h = this.model.get('height');
    const theme = this.model.get('theme');
    const activeIdx = this.model.get('activeIndex');

    for (let i = 0; i < this._entries.length; i++) {
      const e = this._entries[i];
      const isOpen = i === activeIdx;

      ctx.save();
      if (isOpen) {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x + e.x, y + 2, e.width, h - 4);
      }
      ctx.fillStyle = isOpen ? '#ffffff' : theme.text;
      ctx.font = theme.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, x + e.x + e.width / 2, y + h / 2);
      ctx.restore();
    }

    for (const child of this.children) {
      child.renderTree(ctx);
    }
  }
}
