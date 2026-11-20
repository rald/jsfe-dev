import { WidgetModel } from './WidgetModel.js';

export class MenuItemModel extends WidgetModel {
  constructor(options = {}) {
    super({
      width: options.width ?? 180,
      height: options.separator ? 9 : (options.height ?? 28),
      ...options
    });
    this._state.label = options.label ?? '';
    this._state.shortcut = options.shortcut ?? '';
    this._state.separator = Boolean(options.separator ?? false);
    this._state.checked = options.checked ?? null; // null | boolean
    this._state.hasSubmenu = Boolean(options.hasSubmenu ?? false);
    this._state.submenuOpen = false;
  }
}
