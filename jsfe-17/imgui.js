/**
 * imgui.js — Minimalist Immediate Mode GUI for jsfe (`fe.js`)
 * Supports: gui-clear, gui-begin, gui-end, gui-label, gui-button, gui-slider, gui-checkbox
 */
(function (global) {
  "use strict";

  function MiniImGui(options) {
    var opts = options || {};
    this.width = opts.width || 360;
    this.height = opts.height || 260;

    this.canvas = document.createElement("canvas");
    this.canvas.id = "imgui-canvas";
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.display = "block";
    this.canvas.style.marginTop = "14px";
    this.canvas.style.border = "1px solid #2b3040";
    this.canvas.style.borderRadius = "6px";
    this.canvas.style.backgroundColor = "#12151d";
    this.ctx = this.canvas.getContext("2d");

    // Input state
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;

    // Frame interaction state
    this.hotId = null;
    this.activeId = null;
    this.cursorX = 12;
    this.cursorY = 12;
    this.winX = 12;
    this.winY = 12;
    this.winW = 240;
    this.rowHeight = 26;
    this.gap = 6;
    this.frameCount = 0;

    this._bindEvents();
  }

  MiniImGui.prototype._bindEvents = function () {
    var self = this;

    this.canvas.addEventListener("mousemove", function (e) {
      var rect = self.canvas.getBoundingClientRect();
      self.mouseX = e.clientX - rect.left;
      self.mouseY = e.clientY - rect.top;
    });

    this.canvas.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      var rect = self.canvas.getBoundingClientRect();
      self.mouseX = e.clientX - rect.left;
      self.mouseY = e.clientY - rect.top;
      self.mouseDown = true;
      self.mouseClicked = true;
    });

    global.addEventListener("mouseup", function (e) {
      if (e.button !== 0) return;
      self.mouseDown = false;
      if (self.activeId !== null) {
        self.activeId = null;
      }
    });
  };

  MiniImGui.prototype.mount = function (parentEl) {
    var self = this;
    var target = parentEl || document.body;
    if (!target) {
      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("DOMContentLoaded", function () {
          self.mount(document.body);
        });
      }
      return;
    }
    if (!this.canvas.parentNode) {
      target.appendChild(this.canvas);
    }
  };

  MiniImGui.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#12151d";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.hotId = null;
    this.mouseClicked = false;
  };

  MiniImGui.prototype._hit = function (x, y, w, h) {
    return (
      this.mouseX >= x &&
      this.mouseX <= x + w &&
      this.mouseY >= y &&
      this.mouseY <= y + h
    );
  };

  MiniImGui.prototype.beginWindow = function (title, x, y, w) {
    this.frameCount++;
    this.winX = typeof x === "number" ? x : 16;
    this.winY = typeof y === "number" ? y : 16;
    this.winW = typeof w === "number" ? w : 220;
    this.cursorX = this.winX + 10;
    this.cursorY = this.winY + 34;

    var ctx = this.ctx;
    ctx.fillStyle = "#1b202c";
    ctx.strokeStyle = "#343c52";
    ctx.lineWidth = 1;
    ctx.fillRect(this.winX, this.winY, this.winW, this.height - this.winY - 12);
    ctx.strokeRect(this.winX, this.winY, this.winW, this.height - this.winY - 12);

    // Title bar
    ctx.fillStyle = "#262d3d";
    ctx.fillRect(this.winX, this.winY, this.winW, 24);
    ctx.strokeRect(this.winX, this.winY, this.winW, 24);

    ctx.fillStyle = "#e6e9f0";
    ctx.font = "12px monospace";
    ctx.fillText(String(title || "Window"), this.winX + 10, this.winY + 16);
  };

  MiniImGui.prototype.endWindow = function () {
    this.mouseClicked = false;
  };

  MiniImGui.prototype.label = function (text) {
    var ctx = this.ctx;
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "12px monospace";
    ctx.fillText(String(text), this.cursorX, this.cursorY + 16);
    this.cursorY += this.rowHeight + this.gap;
  };

  MiniImGui.prototype.button = function (labelText) {
    var id = "btn:" + labelText;
    var x = this.cursorX;
    var y = this.cursorY;
    var w = this.winW - 20;
    var h = this.rowHeight;
    var hovered = this._hit(x, y, w, h);
    var clicked = false;

    if (hovered) {
      this.hotId = id;
      if (this.activeId === null && this.mouseClicked) {
        this.activeId = id;
      }
    }

    if (this.activeId === id && !this.mouseDown) {
      if (hovered) {
        clicked = true;
      }
      this.activeId = null;
    }

    var ctx = this.ctx;
    if (this.activeId === id) {
      ctx.fillStyle = "#3b6fd8";
    } else if (this.hotId === id) {
      ctx.fillStyle = "#343e54";
    } else {
      ctx.fillStyle = "#252b3a";
    }

    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#45506b";
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#eef2fa";
    ctx.font = "12px monospace";
    ctx.fillText(String(labelText), x + 10, y + 17);

    this.cursorY += h + this.gap;
    return clicked;
  };

  MiniImGui.prototype.slider = function (labelText, value, minVal, maxVal) {
    var id = "slider:" + labelText;
    var min = typeof minVal === "number" ? minVal : 0;
    var max = typeof maxVal === "number" ? maxVal : 100;
    var val = typeof value === "number" ? value : min;

    var x = this.cursorX;
    var y = this.cursorY;
    var w = this.winW - 20;
    var h = this.rowHeight;

    if (this._hit(x, y, w, h)) {
      this.hotId = id;
      if (this.activeId === null && this.mouseClicked) {
        this.activeId = id;
      }
    }

    if (this.activeId === id) {
      var t = (this.mouseX - x) / Math.max(1, w);
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      val = min + t * (max - min);
      val = Math.round(val * 100) / 100;
    }

    var ratio = (val - min) / Math.max(0.0001, max - min);
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;

    var ctx = this.ctx;
    ctx.fillStyle = "#1d222e";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#3e4861";
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = this.activeId === id ? "#4f86f7" : "#2f5299";
    ctx.fillRect(x + 1, y + 1, (w - 2) * ratio, h - 2);

    ctx.fillStyle = "#eef2fa";
    ctx.font = "12px monospace";
    ctx.fillText(labelText + ": " + val, x + 8, y + 17);

    this.cursorY += h + this.gap;
    return val;
  };

  MiniImGui.prototype.checkbox = function (labelText, checked) {
    var id = "chk:" + labelText;
    var isChecked = Boolean(checked);
    var x = this.cursorX;
    var y = this.cursorY;
    var w = this.winW - 20;
    var h = this.rowHeight;
    var hovered = this._hit(x, y, w, h);

    if (hovered) {
      this.hotId = id;
      if (this.mouseClicked) {
        isChecked = !isChecked;
      }
    }

    var ctx = this.ctx;
    var boxSize = 14;
    var boxY = y + Math.floor((h - boxSize) / 2);

    ctx.fillStyle = hovered ? "#2c3446" : "#202634";
    ctx.fillRect(x + 4, boxY, boxSize, boxSize);
    ctx.strokeStyle = "#4b5775";
    ctx.strokeRect(x + 4, boxY, boxSize, boxSize);

    if (isChecked) {
      ctx.fillStyle = "#6ea8fe";
      ctx.fillRect(x + 7, boxY + 3, boxSize - 6, boxSize - 6);
    }

    ctx.fillStyle = "#e6e9f0";
    ctx.font = "12px monospace";
    ctx.fillText(String(labelText), x + 26, y + 17);

    this.cursorY += h + this.gap;
    return isChecked;
  };

  /**
   * Registers immediate-mode GUI primitives onto an FeContext instance.
   */
  function attachImGuiToFe(feCtx, imguiInstance) {
    var gui = imguiInstance || new MiniImGui();
    gui.mount(document.body);

    feCtx.define("gui-clear", function () {
      gui.clear();
      return null;
    });

    feCtx.define("gui-begin", function (_ctx, title, x, y, w) {
      gui.beginWindow(title, x, y, w);
      return null;
    });

    feCtx.define("gui-end", function () {
      gui.endWindow();
      return null;
    });

    feCtx.define("gui-label", function (_ctx, text) {
      gui.label(text);
      return null;
    });

    feCtx.define("gui-button", function (_ctx, text) {
      return gui.button(text);
    });

    feCtx.define("gui-slider", function (_ctx, text, val, minVal, maxVal) {
      return gui.slider(text, val, minVal, maxVal);
    });

    feCtx.define("gui-checkbox", function (_ctx, text, checked) {
      return gui.checkbox(text, checked);
    });

    return gui;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { MiniImGui: MiniImGui, attachImGuiToFe: attachImGuiToFe };
  } else {
    global.MiniImGui = MiniImGui;
    global.attachImGuiToFe = attachImGuiToFe;
  }
})(typeof window !== "undefined" ? window : this);


