// AWT-like Canvas UI Framework (awt.js)
// Updated with menu space reservation and menu event consumption so clicks on
// menu items or open dropdown popups do not fall through to elements underneath.

class Frame {
  static MENU_RESERVED_HEIGHT = 28;

  constructor(options = {}) {
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 800;
    this.height = options.height ?? 600;
    this.reserveMenuSpace = options.reserveMenuSpace !== undefined ? options.reserveMenuSpace : true;
    this.menuBar = options.menuBar || null;
    this.activeMenuPopup = null;
    this.children = [];
    this._menuCapturedPointer = false;
  }

  getMenuReservedHeight() {
    if (!this.reserveMenuSpace && !this.menuBar) {
      return 0;
    }
    const barHeight = this.menuBar && typeof this.menuBar.height === 'number'
      ? this.menuBar.height
      : Frame.MENU_RESERVED_HEIGHT;
    return Math.max(Frame.MENU_RESERVED_HEIGHT, barHeight);
  }

  getClientBounds() {
    const topOffset = this.getMenuReservedHeight();
    return {
      x: this.x,
      y: this.y + topOffset,
      width: this.width,
      height: Math.max(0, this.height - topOffset)
    };
  }

  isInMenuBar(px, py) {
    const topOffset = this.getMenuReservedHeight();
    if (topOffset <= 0) return false;
    return (
      px >= this.x &&
      px <= this.x + this.width &&
      py >= this.y &&
      py < this.y + topOffset
    );
  }

  openMenuPopup(popup) {
    this.activeMenuPopup = popup || null;
  }

  closeMenus() {
    if (this.activeMenuPopup && typeof this.activeMenuPopup.close === 'function') {
      this.activeMenuPopup.close();
    }
    this.activeMenuPopup = null;
    if (this.menuBar && typeof this.menuBar.clearSelection === 'function') {
      this.menuBar.clearSelection();
    }
  }

  add(child) {
    this.children.push(child);
    return child;
  }

  layout() {
    const client = this.getClientBounds();
    if (this.menuBar) {
      this.menuBar.x = this.x;
      this.menuBar.y = this.y;
      this.menuBar.width = this.width;
      this.menuBar.height = this.getMenuReservedHeight();
      if (typeof this.menuBar.layout === 'function') {
        this.menuBar.layout();
      }
    }
    for (const child of this.children) {
      if (typeof child.setBounds === 'function') {
        child.setBounds(client.x, client.y, client.width, client.height);
      }
      if (typeof child.layout === 'function') {
        child.layout();
      }
    }
  }

  render(ctx) {
    const client = this.getClientBounds();

    // Render client/child area clipped below reserved menu space
    ctx.save();
    ctx.beginPath();
    ctx.rect(client.x, client.y, client.width, client.height);
    ctx.clip();

    for (const child of this.children) {
      if (typeof child.render === 'function') {
        child.render(ctx);
      }
    }
    ctx.restore();

    // Render top menu bar inside reserved space
    if (this.menuBar && typeof this.menuBar.render === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x, this.y, this.width, this.getMenuReservedHeight());
      ctx.clip();
      this.menuBar.render(ctx);
      ctx.restore();
    }

    // Render open dropdown popup above client components
    if (this.activeMenuPopup && typeof this.activeMenuPopup.render === 'function') {
      this.activeMenuPopup.render(ctx);
    }
  }

  onMouseDown(px, py, event = null) {
    // 1. Open dropdown popup takes priority (may extend below reserved menu height)
    if (this.activeMenuPopup && typeof this.activeMenuPopup.containsPoint === 'function' && this.activeMenuPopup.containsPoint(px, py)) {
      this._menuCapturedPointer = true;
      if (typeof this.activeMenuPopup.onMouseDown === 'function') {
        this.activeMenuPopup.onMouseDown(px, py, event);
      }
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      return true;
    }

    // 2. Clicking outside an open popup closes menus and consumes the click
    // so elements underneath are not accidentally triggered on dismiss.
    if (this.activeMenuPopup) {
      this.closeMenus();
      this._menuCapturedPointer = true;
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      return true;
    }

    // 3. Clicking within the menu bar consumes the event so children underneath do not receive it
    if (this.isInMenuBar(px, py)) {
      this._menuCapturedPointer = true;
      if (this.menuBar && typeof this.menuBar.onMouseDown === 'function') {
        this.menuBar.onMouseDown(px, py, event);
      }
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      return true;
    }

    // 4. Dispatch to child components inside client bounds
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (typeof child.onMouseDown === 'function' && child.onMouseDown(px, py, event)) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        return true;
      }
    }

    return false;
  }

  onMouseUp(px, py, event = null) {
    // Consume mouseUp if captured by a menu or over an open popup / menu bar
    if (
      this._menuCapturedPointer ||
      (this.activeMenuPopup && typeof this.activeMenuPopup.containsPoint === 'function' && this.activeMenuPopup.containsPoint(px, py)) ||
      this.isInMenuBar(px, py)
    ) {
      if (this.activeMenuPopup && typeof this.activeMenuPopup.onMouseUp === 'function') {
        this.activeMenuPopup.onMouseUp(px, py, event);
      } else if (this.isInMenuBar(px, py) && this.menuBar && typeof this.menuBar.onMouseUp === 'function') {
        this.menuBar.onMouseUp(px, py, event);
      }
      this._menuCapturedPointer = false;
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      return true;
    }

    this._menuCapturedPointer = false;

    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (typeof child.onMouseUp === 'function' && child.onMouseUp(px, py, event)) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        return true;
      }
    }

    return false;
  }

  onClick(px, py, event = null) {
    // Prevent click events on menu bar or active menu popup from falling through to underlying elements
    if (
      this._menuCapturedPointer ||
      (this.activeMenuPopup && typeof this.activeMenuPopup.containsPoint === 'function' && this.activeMenuPopup.containsPoint(px, py)) ||
      this.isInMenuBar(px, py)
    ) {
      if (this.activeMenuPopup && typeof this.activeMenuPopup.onClick === 'function') {
        this.activeMenuPopup.onClick(px, py, event);
      }
      this._menuCapturedPointer = false;
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      return true;
    }

    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (typeof child.onClick === 'function' && child.onClick(px, py, event)) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        return true;
      }
    }

    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Frame };
}
