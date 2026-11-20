// Showcase Demo (showcase.js)
// Demonstrates reserving menu space on a Frame and isolating menu clicks
// from underlying child components.

const { Frame } = typeof require !== 'undefined' ? require('./awt.js') : window;

function createShowcaseFrame() {
  const frame = new Frame({
    x: 0,
    y: 0,
    width: 960,
    height: 640,
    reserveMenuSpace: true,
    menuBar: {
      x: 0,
      y: 0,
      width: 960,
      height: Frame.MENU_RESERVED_HEIGHT,
      items: ['File', 'Edit', 'View', 'Help'],
      onMouseDown(px, py) {
        console.log('[MenuBar] Consumed mouseDown at', px, py);
        return true;
      },
      render(ctx) {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#111827';
        ctx.font = '13px sans-serif';
        let cursorX = this.x + 12;
        for (const label of this.items) {
          ctx.fillText(label, cursorX, this.y + 18);
          cursorX += 64;
        }
      }
    }
  });

  // Child component positioned cleanly inside the client area (below reserved menu height)
  const clientBounds = frame.getClientBounds();
  frame.add({
    x: clientBounds.x,
    y: clientBounds.y,
    width: clientBounds.width,
    height: clientBounds.height,
    setBounds(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.width = w;
      this.height = h;
    },
    render(ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = '#374151';
      ctx.font = '14px sans-serif';
      ctx.fillText('Client Area (Menu Space Reserved)', this.x + 20, this.y + 32);
    },
    onMouseDown(px, py) {
      console.log('[Client] Clicked child at', px, py);
      return true;
    }
  });

  frame.layout();
  return frame;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createShowcaseFrame };
}
