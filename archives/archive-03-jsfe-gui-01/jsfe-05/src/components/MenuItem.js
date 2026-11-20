import { Widget } from './Widget.js';
import { MenuItemModel } from '../models/MenuItemModel.js';
import { MenuItemView } from '../views/MenuItemView.js';
import { MenuItemController } from '../controllers/MenuItemController.js';

export class MenuItem extends Widget {
  constructor(options = {}) {
    const model = new MenuItemModel({
      ...options,
      hasSubmenu: Boolean(options.submenu)
    });
    const view = new MenuItemView(model);
    let controller = null;
    super(model, view, null);
    controller = new MenuItemController(model, this);
    this.controller = controller;

    this.submenu = options.submenu ?? null;
    this._closeRootMenu = options._closeRootMenu ?? null;

    if (options.onSelect) {
      this.on('select', options.onSelect);
    }
  }
}
