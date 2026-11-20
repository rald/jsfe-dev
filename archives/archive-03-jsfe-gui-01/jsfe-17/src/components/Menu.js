import { Widget } from './Widget.js';
import { MenuModel } from '../models/MenuModel.js';
import { MenuView } from '../views/MenuView.js';
import { MenuController } from '../controllers/MenuController.js';
import { MenuItem } from './MenuItem.js';
import { SWEETIE_16_THEME } from '../themes/sweetie16Dark.js';

export class Menu extends Widget {
  constructor(options = {}) {
    const mergedTheme = { ...SWEETIE_16_THEME, ...(options.theme || {}) };
    const model = new MenuModel({ ...options, theme: mergedTheme });
    super(model, new MenuView(model), new MenuController(model));
    this.items = [];
    this._onCloseRoot = options._onCloseRoot ?? (() => this.close());

    if (Array.isArray(options.items)) {
      for (const itemCfg of options.items) {
        this.addItem(itemCfg);
      }
    }
  }

  addItem(itemCfg = {}) {
    const pad = this.model.get('padding');
    const w = this.model.get('width');
    const menuTheme = { ...SWEETIE_16_THEME, ...(this.model.get('theme') || {}) };
    const nextY = this.items.length === 0
      ? pad
      : this.items[this.items.length - 1].model.get('y') + this.items[this.items.length - 1].model.get('height');

    const item = itemCfg instanceof MenuItem
      ? itemCfg
      : new MenuItem({
          ...itemCfg,
          x: pad,
          y: nextY,
          width: w - pad * 2,
          _closeRootMenu: this._onCloseRoot,
          theme: {
            ...menuTheme,
            ...(itemCfg.theme || {})
          }
        });

    if (item.model && !(itemCfg instanceof MenuItem)) {
      item.model.update({
        theme: {
          ...menuTheme,
          ...(itemCfg.theme || {})
        }
      });
    }

    if (item.submenu) {
      item.submenu._onCloseRoot = this._onCloseRoot;
    }

    this.items.push(item);
    this.add(item);
    this._recomputeHeight();
    return item;
  }

  addSeparator() {
    return this.addItem({ separator: true });
  }

  _recomputeHeight() {
    const pad = this.model.get('padding');
    let totalH = pad * 2;
    for (const item of this.items) {
      totalH += item.model.get('height');
    }
    this.model.set('height', Math.max(totalH, pad * 2));
  }

  open(x, y) {
    if (this.parent && this.parent.bringToFront) {
      this.parent.bringToFront(this);
    }
    this.model.open(x, y);
    return this;
  }

  close() {
    for (const item of this.items) {
      item.model.set('submenuOpen', false);
      item.model.set('hovered', false);
      if (item.submenu) {
        item.submenu.close();
      }
    }
    this.model.close();
    return this;
  }
}
