export class Renderer {
  constructor(canvas, rootNode, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.root = rootNode;
    this.clearColor = options.clearColor ?? '#1a1c2c';
    this._running = false;
    this._rafId = null;
    this._resize();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || this.canvas.width || 800);
    const height = Math.max(1, rect.height || this.canvas.height || 520);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.logicalWidth = width;
    this.logicalHeight = height;
  }

  _hasDirtyNodes() {
    let dirty = false;
    this.root.traverse((node) => {
      if (node.model && node.model.isDirty) {
        dirty = true;
      }
      if (node.model && node.model.get('open') && node.model.get('visible')) {
        dirty = true;
      }
    });
    return dirty;
  }

  renderFrame() {
    if (!this.ctx) return;
    this.ctx.fillStyle = this.clearColor;
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    for (const child of this.root.children) {
      if (typeof child.renderTree === 'function') {
        child.renderTree(this.ctx);
      }
    }
  }

  start() {
    if (this._running) return;
    this._running = true;
    const loop = () => {
      if (!this._running) return;
      if (this._hasDirtyNodes()) {
        this.renderFrame();
      }
      this._rafId = requestAnimationFrame(loop);
    };
    this.renderFrame();
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
}
