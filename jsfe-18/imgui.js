/**
 * imgui.js — Minimalist Immediate Mode GUI for jsfe (`fe.js`)
 * Supports:
 *   gui-clear, gui-begin, gui-end, gui-label, gui-button,
 *   gui-slider, gui-checkbox, gui-text, gui-textarea
 */
(function (global) {
  "use strict";

  function getContainerSize(el, fallbackW, fallbackH) {
    if (el && el.clientWidth > 0 && el.clientHeight > 0) {
      return {
        width: Math.max(1, Math.floor(el.clientWidth)),
        height: Math.max(1, Math.floor(el.clientHeight))
      };
    }
    var w = global.innerWidth || 360;
    var h = global.innerHeight || 260;
    return {
      width: fallbackW || Math.max(1, Math.floor(w)),
      height: fallbackH || Math.max(1, Math.floor(h))
    };
  }

  function MiniImGui(options) {
    var opts = options || {};
    this.fullscreen = Boolean(opts.fullscreen);
    this.fillContainer = opts.fillContainer !== undefined ? Boolean(opts.fillContainer) : !this.fullscreen;
    this.width = opts.width || 480;
    this.height = opts.height || 400;

    this.canvas = document.createElement("canvas");
    this.canvas.id = "imgui-canvas";
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.display = "block";
    this.canvas.style.backgroundColor = "#12151d";

    if (this.fullscreen) {
      this.canvas.style.position = "fixed";
      this.canvas.style.top = "0";
      this.canvas.style.left = "0";
      this.canvas.style.width = "100vw";
      this.canvas.style.height = "100vh";
      this.canvas.style.margin = "0";
      this.canvas.style.border = "none";
      this.canvas.style.borderRadius = "0";
      this.canvas.style.zIndex = opts.zIndex !== undefined ? String(opts.zIndex) : "9999";
    } else if (this.fillContainer) {
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.border = "1px solid #2b3040";
      this.canvas.style.borderRadius = "6px";
    } else {
      this.canvas.style.marginTop = "14px";
      this.canvas.style.border = "1px solid #2b3040";
      this.canvas.style.borderRadius = "6px";
    }

    this.ctx = this.canvas.getContext("2d");

    // Input state
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;

    // Text editing & scroll state
    this.focusedId = null;
    this.focusType = null; // "text" | "textarea"
    this._keyHandler = null;
    this._pendingTextUpdates = {};
    this.scrollX = 0;
    this.scrollY = 0;
    this.maxScrollX = 0;
    this.maxScrollY = 0;
    this.contentW = 0;
    this.contentH = 0;
    this.dragScrollAxis = null; // "x" | "y" | null
    this.dragScrollOffset = 0;

    // Frame interaction state
    this.hotId = null;
    this.activeId = null;
    this.cursorX = 12;
    this.cursorY = 12;
    this.winX = 12;
    this.winY = 12;
    this.winW = 240;
    this.winH = 220;
    this.titleBarH = 24;
    this.scrollbarSize = 12;
    this.rowHeight = 26;
    this.gap = 6;
    this.frameCount = 0;

    this._bindEvents();
  }

  MiniImGui.prototype.resizeToContainer = function () {
    if (this.fullscreen) {
      var w = global.innerWidth || 360;
      var h = global.innerHeight || 260;
      this.width = Math.max(1, Math.floor(w));
      this.height = Math.max(1, Math.floor(h));
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      return;
    }
    if (!this.fillContainer) return;
    var parent = this.canvas.parentElement;
    if (!parent) return;
    var size = getContainerSize(parent, this.width, this.height);
    if (size.width !== this.width || size.height !== this.height) {
      this.width = size.width;
      this.height = size.height;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
  };

  MiniImGui.prototype._updatePointerPos = function (e) {
    var rect = this.canvas.getBoundingClientRect();
    var scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    var scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
  };

  MiniImGui.prototype._bindEvents = function () {
    var self = this;

    if (global.addEventListener) {
      global.addEventListener("resize", function () {
        self.resizeToContainer();
      });
    }

    this.canvas.addEventListener("mousemove", function (e) {
      self._updatePointerPos(e);
    });

    this.canvas.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      self._updatePointerPos(e);
      self.mouseDown = true;
      self.mouseClicked = true;
    });

    this.canvas.addEventListener("wheel", function (e) {
      var bodyX = self.winX;
      var bodyY = self.winY + self.titleBarH;
      var bodyW = self.winW - self.scrollbarSize;
      var bodyH = self.winH - self.titleBarH - self.scrollbarSize;
      if (self._hit(bodyX, bodyY, bodyW, bodyH)) {
        e.preventDefault();
        var dy = e.deltaY || 0;
        var dx = e.deltaX || 0;
        if (e.shiftKey && dx === 0) {
          dx = dy;
          dy = 0;
        }
        self.scrollY = Math.max(0, Math.min(self.maxScrollY, self.scrollY + dy));
        self.scrollX = Math.max(0, Math.min(self.maxScrollX, self.scrollX + dx));
      }
    }, { passive: false });

    global.addEventListener("mouseup", function (e) {
      if (e.button !== 0) return;
      self._updatePointerPos(e);
      self.mouseDown = false;
      self.mouseClicked = false;
      self.dragScrollAxis = null;
      if (self.activeId !== null) {
        self.activeId = null;
      }
    });

    global.addEventListener("keydown", function (e) {
      if (!self.focusedId) return;
      if (e.key === "Escape") {
        self.focusedId = null;
        self.focusType = null;
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
    this.resizeToContainer();
  };

  MiniImGui.prototype.clear = function () {
    this.resizeToContainer();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#12151d";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.hotId = null;
  };

  MiniImGui.prototype._hit = function (x, y, w, h) {
    return (
      this.mouseX >= x &&
      this.mouseX <= x + w &&
      this.mouseY >= y &&
      this.mouseY <= y + h
    );
  };

  MiniImGui.prototype._widgetRect = function (x, y, w, h) {
    return {
      x: x - this.scrollX,
      y: y - this.scrollY,
      w: w,
      h: h
    };
  };

  MiniImGui.prototype._trackContent = function (x, y, w, h) {
    var relRight = (x - this.winX) + w + this.scrollX;
    var relBottom = (y - this.winY - this.titleBarH) + h + this.scrollY;
    if (relRight > this.contentW) this.contentW = relRight;
    if (relBottom > this.contentH) this.contentH = relBottom;
  };

  MiniImGui.prototype.beginWindow = function (title, x, y, w, h, contentW, contentH) {
    this.frameCount++;
    this.winX = typeof x === "number" ? x : 16;
    this.winY = typeof y === "number" ? y : 16;
    this.winW = typeof w === "number" ? w : 320;
    this.winH = typeof h === "number" ? h : Math.max(140, this.height - this.winY - 16);

    var viewW = Math.max(40, this.winW - this.scrollbarSize);
    var viewH = Math.max(40, this.winH - this.titleBarH - this.scrollbarSize);

    this.contentW = typeof contentW === "number" ? contentW : viewW;
    this.contentH = typeof contentH === "number" ? contentH : viewH;
    this.maxScrollX = Math.max(0, this.contentW - viewW);
    this.maxScrollY = Math.max(0, this.contentH - viewH);
    this.scrollX = Math.max(0, Math.min(this.maxScrollX, this.scrollX));
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY));

    this.cursorX = this.winX + 10;
    this.cursorY = this.winY + this.titleBarH + 10;

    var ctx = this.ctx;
    ctx.save();

    // Window frame
    ctx.fillStyle = "#1b202c";
    ctx.strokeStyle = "#343c52";
    ctx.lineWidth = 1;
    ctx.fillRect(this.winX, this.winY, this.winW, this.winH);
    ctx.strokeRect(this.winX, this.winY, this.winW, this.winH);

    // Title bar
    ctx.fillStyle = "#262d3d";
    ctx.fillRect(this.winX, this.winY, this.winW, this.titleBarH);
    ctx.strokeRect(this.winX, this.winY, this.winW, this.titleBarH);

    ctx.fillStyle = "#e6e9f0";
    ctx.font = "12px monospace";
    ctx.fillText(String(title || "Window"), this.winX + 10, this.winY + 16);

    // Clip to scrollable client area
    var bodyX = this.winX + 1;
    var bodyY = this.winY + this.titleBarH;
    var bodyW = Math.max(1, this.winW - this.scrollbarSize - 1);
    var bodyH = Math.max(1, this.winH - this.titleBarH - this.scrollbarSize - 1);

    ctx.beginPath();
    ctx.rect(bodyX, bodyY, bodyW, bodyH);
    ctx.clip();
  };

  MiniImGui.prototype._drawScrollbars = function () {
    var ctx = this.ctx;
    var sb = this.scrollbarSize;
    var bodyY = this.winY + this.titleBarH;
    var trackW = Math.max(1, this.winW - sb);
    var trackH = Math.max(1, this.winH - this.titleBarH - sb);

    var viewW = Math.max(40, this.winW - sb);
    var viewH = Math.max(40, this.winH - this.titleBarH - sb);
    this.maxScrollX = Math.max(0, this.contentW - viewW);
    this.maxScrollY = Math.max(0, this.contentH - viewH);
    this.scrollX = Math.max(0, Math.min(this.maxScrollX, this.scrollX));
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY));

    // Vertical scrollbar
    var vTrackX = this.winX + this.winW - sb;
    var vTrackY = bodyY;
    ctx.fillStyle = "#151923";
    ctx.fillRect(vTrackX, vTrackY, sb, trackH);
    ctx.strokeStyle = "#2b3245";
    ctx.strokeRect(vTrackX, vTrackY, sb, trackH);

    var vRatio = this.maxScrollY > 0 ? viewH / this.contentH : 1;
    var vThumbH = Math.max(20, Math.floor(trackH * Math.min(1, vRatio)));
    var vThumbY = vTrackY + (this.maxScrollY > 0
      ? Math.floor((this.scrollY / this.maxScrollY) * (trackH - vThumbH))
      : 0);

    if (this.mouseClicked && this._hit(vTrackX, vTrackY, sb, trackH)) {
      this.mouseClicked = false;
      if (this._hit(vTrackX, vThumbY, sb, vThumbH)) {
        this.dragScrollAxis = "y";
        this.dragScrollOffset = this.mouseY - vThumbY;
      } else {
        var clickFracY = (this.mouseY - vTrackY - vThumbH / 2) / Math.max(1, trackH - vThumbH);
        this.scrollY = Math.max(0, Math.min(this.maxScrollY, clickFracY * this.maxScrollY));
        this.dragScrollAxis = "y";
        this.dragScrollOffset = vThumbH / 2;
      }
    }

    if (this.dragScrollAxis === "y" && this.mouseDown) {
      var newThumbY = this.mouseY - this.dragScrollOffset;
      var fracY = (newThumbY - vTrackY) / Math.max(1, trackH - vThumbH);
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, fracY * this.maxScrollY));
      vThumbY = vTrackY + (this.maxScrollY > 0
        ? Math.floor((this.scrollY / this.maxScrollY) * (trackH - vThumbH))
        : 0);
    }

    ctx.fillStyle = this.dragScrollAxis === "y" || this._hit(vTrackX, vThumbY, sb, vThumbH)
      ? "#55648a"
      : "#3a4561";
    ctx.fillRect(vTrackX + 2, vThumbY + 1, sb - 4, Math.max(8, vThumbH - 2));

    // Horizontal scrollbar
    var hTrackX = this.winX;
    var hTrackY = this.winY + this.winH - sb;
    ctx.fillStyle = "#151923";
    ctx.fillRect(hTrackX, hTrackY, trackW, sb);
    ctx.strokeStyle = "#2b3245";
    ctx.strokeRect(hTrackX, hTrackY, trackW, sb);

    var hRatio = this.maxScrollX > 0 ? viewW / this.contentW : 1;
    var hThumbW = Math.max(20, Math.floor(trackW * Math.min(1, hRatio)));
    var hThumbX = hTrackX + (this.maxScrollX > 0
      ? Math.floor((this.scrollX / this.maxScrollX) * (trackW - hThumbW))
      : 0);

    if (this.mouseClicked && this._hit(hTrackX, hTrackY, trackW, sb)) {
      this.mouseClicked = false;
      if (this._hit(hThumbX, hTrackY, hThumbW, sb)) {
        this.dragScrollAxis = "x";
        this.dragScrollOffset = this.mouseX - hThumbX;
      } else {
        var clickFracX = (this.mouseX - hTrackX - hThumbW / 2) / Math.max(1, trackW - hThumbW);
        this.scrollX = Math.max(0, Math.min(this.maxScrollX, clickFracX * this.maxScrollX));
        this.dragScrollAxis = "x";
        this.dragScrollOffset = hThumbW / 2;
      }
    }

    if (this.dragScrollAxis === "x" && this.mouseDown) {
      var newThumbX = this.mouseX - this.dragScrollOffset;
      var fracX = (newThumbX - hTrackX) / Math.max(1, trackW - hThumbW);
      this.scrollX = Math.max(0, Math.min(this.maxScrollX, fracX * this.maxScrollX));
      hThumbX = hTrackX + (this.maxScrollX > 0
        ? Math.floor((this.scrollX / this.maxScrollX) * (trackW - hThumbW))
        : 0);
    }

    ctx.fillStyle = this.dragScrollAxis === "x" || this._hit(hThumbX, hTrackY, hThumbW, sb)
      ? "#55648a"
      : "#3a4561";
    ctx.fillRect(hThumbX + 1, hTrackY + 2, Math.max(8, hThumbW - 2), sb - 4);

    // Bottom-right corner square
    ctx.fillStyle = "#1b202c";
    ctx.fillRect(this.winX + this.winW - sb, this.winY + this.winH - sb, sb, sb);
  };

  MiniImGui.prototype.endWindow = function () {
    this.ctx.restore();
    this._drawScrollbars();
    this.mouseClicked = false;
  };

  MiniImGui.prototype.label = function (text) {
    var baseX = this.cursorX;
    var baseY = this.cursorY;
    var baseW = this.winW - this.scrollbarSize - 20;
    var baseH = this.rowHeight;
    this._trackContent(baseX, baseY, baseW, baseH);

    var r = this._widgetRect(baseX, baseY, baseW, baseH);
    var ctx = this.ctx;
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "12px monospace";
    ctx.fillText(String(text), r.x, r.y + 16);
    this.cursorY += this.rowHeight + this.gap;
  };

  MiniImGui.prototype.button = function (labelText) {
    var id = "btn:" + labelText;
    var baseX = this.cursorX;
    var baseY = this.cursorY;
    var baseW = this.winW - this.scrollbarSize - 20;
    var baseH = this.rowHeight;
    this._trackContent(baseX, baseY, baseW, baseH);

    var r = this._widgetRect(baseX, baseY, baseW, baseH);
    var hovered = this._hit(r.x, r.y, r.w, r.h);
    var clicked = false;

    if (hovered) {
      this.hotId = id;
      if (this.activeId === null && this.mouseClicked) {
        this.activeId = id;
        this.mouseClicked = false;
        this.focusedId = null;
        this.focusType = null;
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

    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#45506b";
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = "#eef2fa";
    ctx.font = "12px monospace";
    ctx.fillText(String(labelText), r.x + 10, r.y + 17);

    this.cursorY += baseH + this.gap;
    return clicked;
  };

  MiniImGui.prototype.slider = function (labelText, value, minVal, maxVal) {
    var id = "slider:" + labelText;
    var min = typeof minVal === "number" ? minVal : 0;
    var max = typeof maxVal === "number" ? maxVal : 100;
    var val = typeof value === "number" ? value : min;

    var baseX = this.cursorX;
    var baseY = this.cursorY;
    var baseW = this.winW - this.scrollbarSize - 20;
    var baseH = this.rowHeight;
    this._trackContent(baseX, baseY, baseW, baseH);

    var r = this._widgetRect(baseX, baseY, baseW, baseH);
    var hovered = this._hit(r.x, r.y, r.w, r.h);

    if (hovered) {
      this.hotId = id;
      if (this.activeId === null && this.mouseClicked) {
        this.activeId = id;
        this.mouseClicked = false;
        this.focusedId = null;
        this.focusType = null;
      }
    }

    if (this.activeId === id && this.mouseDown) {
      var t = (this.mouseX - r.x) / Math.max(1, r.w);
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
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#3e4861";
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = this.activeId === id ? "#4f86f7" : "#2f5299";
    ctx.fillRect(r.x + 1, r.y + 1, (r.w - 2) * ratio, r.h - 2);

    ctx.fillStyle = "#eef2fa";
    ctx.font = "12px monospace";
    ctx.fillText(labelText + ": " + val, r.x + 8, r.y + 17);

    this.cursorY += baseH + this.gap;
    return val;
  };

  MiniImGui.prototype.checkbox = function (labelText, checked) {
    var id = "chk:" + labelText;
    var isChecked = Boolean(checked);
    var baseX = this.cursorX;
    var baseY = this.cursorY;
    var baseW = this.winW - this.scrollbarSize - 20;
    var baseH = this.rowHeight;
    this._trackContent(baseX, baseY, baseW, baseH);

    var r = this._widgetRect(baseX, baseY, baseW, baseH);
    var hovered = this._hit(r.x, r.y, r.w, r.h);

    if (hovered) {
      this.hotId = id;
      if (this.activeId === null && this.mouseClicked) {
        isChecked = !isChecked;
        this.mouseClicked = false;
        this.focusedId = null;
        this.focusType = null;
      }
    }

    var ctx = this.ctx;
    var boxSize = 14;
    var boxY = r.y + Math.floor((r.h - boxSize) / 2);

    ctx.fillStyle = hovered ? "#2c3446" : "#202634";
    ctx.fillRect(r.x + 4, boxY, boxSize, boxSize);
    ctx.strokeStyle = "#4b5775";
    ctx.strokeRect(r.x + 4, boxY, boxSize, boxSize);

    if (isChecked) {
      ctx.fillStyle = "#6ea8fe";
      ctx.fillRect(r.x + 7, boxY + 3, boxSize - 6, boxSize - 6);
    }

    ctx.fillStyle = "#e6e9f0";
    ctx.font = "12px monospace";
    ctx.fillText(String(labelText), r.x + 26, r.y + 17);

    this.cursorY += baseH + this.gap;
    return isChecked;
  };

  MiniImGui.prototype._attachKeyHandler = function (id, mode, currentText, onUpdate) {
    var self = this;
    if (this._keyHandler) {
      global.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
    var latest = currentText;
    this._keyHandler = function (e) {
      if (self.focusedId !== id || self.focusType !== mode) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        latest = latest.slice(0, -1);
        onUpdate(latest);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "textarea") {
          latest += "\n";
          onUpdate(latest);
        } else {
          self.focusedId = null;
          self.focusType = null;
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        self.focusedId = null;
        self.focusType = null;
      } else if (e.key && e.key.length === 1) {
        e.preventDefault();
        latest += e.key;
        onUpdate(latest);
      }
    };
    global.addEventListener("keydown", this._keyHandler);
  };

  MiniImGui.prototype.textField = function (labelText, value) {
    var id = "txt:" + labelText;
    var text = value !== undefined && value !== null ? String(value) : "";

    var baseX = this.cursorX;
    var baseY = this.cursorY;
    var baseW = this.winW - this.scrollbarSize - 20;
    var baseH = this.rowHeight;
    this._trackContent(baseX, baseY, baseW, baseH);

    var r = this._widgetRect(baseX, baseY, baseW, baseH);
    var hovered = this._hit(r.x, r.y, r.w, r.h);

    if (hovered) {
      this.hotId = id;
      if (this.mouseClicked) {
        this.mouseClicked = false;
        this.focusedId = id;
        this.focusType = "text";
      }
    } else if (this.mouseClicked && this.focusedId === id) {
      this.focusedId = null;
      this.focusType = null;
    }

    var isFocused = this.focusedId === id && this.focusType === "text";
    if (isFocused) {
      var self = this;
      this._attachKeyHandler(id, "text", text, function (nextVal) {
        self._pendingTextUpdates[id] = nextVal;
      });
    }

    if (Object.prototype.hasOwnProperty.call(this._pendingTextUpdates, id)) {
      text = this._pendingTextUpdates[id];
      delete this._pendingTextUpdates[id];
    }

    var ctx = this.ctx;
    ctx.fillStyle = isFocused ? "#182032" : "#171b24";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = isFocused ? "#6ea8fe" : (hovered ? "#4b5775" : "#343c52");
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    var display = labelText ? (labelText + ": " + text) : text;
    var cursorBlink = isFocused && Math.floor(Date.now() / 500) % 2 === 0 ? "_" : "";

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 2, r.y + 1, Math.max(1, r.w - 4), r.h - 2);
    ctx.clip();
    ctx.fillStyle = "#eef2fa";
    ctx.font = "12px monospace";
    ctx.fillText(display + cursorBlink, r.x + 8, r.y + 17);
    ctx.restore();

    this.cursorY += baseH + this.gap;
    return text;
  };

  MiniImGui.prototype.textArea = function (labelText, value, areaHeight) {
    var id = "area:" + labelText;
    var text = value !== undefined && value !== null ? String(value) : "";
    var lineH = 15;
    var headerH = labelText ? 18 : 0;

    var baseX = this.cursorX;
    var baseY = this.cursorY;
    var baseW = this.winW - this.scrollbarSize - 20;
    var baseH = (typeof areaHeight === "number" ? areaHeight : 78) + headerH;
    this._trackContent(baseX, baseY, baseW, baseH);

    var r = this._widgetRect(baseX, baseY, baseW, baseH);
    var boxY = r.y + headerH;
    var boxH = Math.max(24, r.h - headerH);
    var hovered = this._hit(r.x, boxY, r.w, boxH);

    if (hovered) {
      this.hotId = id;
      if (this.mouseClicked) {
        this.mouseClicked = false;
        this.focusedId = id;
        this.focusType = "textarea";
      }
    } else if (this.mouseClicked && this.focusedId === id) {
      this.focusedId = null;
      this.focusType = null;
    }

    var isFocused = this.focusedId === id && this.focusType === "textarea";
    if (isFocused) {
      var self = this;
      this._attachKeyHandler(id, "textarea", text, function (nextVal) {
        self._pendingTextUpdates[id] = nextVal;
      });
    }

    if (Object.prototype.hasOwnProperty.call(this._pendingTextUpdates, id)) {
      text = this._pendingTextUpdates[id];
      delete this._pendingTextUpdates[id];
    }

    var ctx = this.ctx;
    if (labelText) {
      ctx.fillStyle = "#c8d0e0";
      ctx.font = "12px monospace";
      ctx.fillText(String(labelText), r.x, r.y + 13);
    }

    ctx.fillStyle = isFocused ? "#182032" : "#171b24";
    ctx.fillRect(r.x, boxY, r.w, boxH);
    ctx.strokeStyle = isFocused ? "#6ea8fe" : (hovered ? "#4b5775" : "#343c52");
    ctx.strokeRect(r.x, boxY, r.w, boxH);

    var lines = text.split("\n");
    var cursorBlink = isFocused && Math.floor(Date.now() / 500) % 2 === 0 ? "_" : "";

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 2, boxY + 1, Math.max(1, r.w - 4), boxH - 2);
    ctx.clip();
    ctx.fillStyle = "#eef2fa";
    ctx.font = "12px monospace";

    var i;
    for (i = 0; i < lines.length; i++) {
      var suffix = i === lines.length - 1 ? cursorBlink : "";
      ctx.fillText(lines[i] + suffix, r.x + 8, boxY + 15 + i * lineH);
    }
    ctx.restore();

    this.cursorY += baseH + this.gap;
    return text;
  };

  /**
   * Registers immediate-mode GUI primitives onto an FeContext instance.
   */
  function attachImGuiToFe(feCtx, imguiInstance, mountTarget) {
    var gui = imguiInstance || new MiniImGui();
    gui.mount(mountTarget || document.getElementById("gui-pane") || document.body);

    feCtx.define("gui-clear", function () {
      gui.clear();
      return null;
    });

    feCtx.define("gui-begin", function (_ctx, title, x, y, w, h, contentW, contentH) {
      gui.beginWindow(title, x, y, w, h, contentW, contentH);
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

    feCtx.define("gui-text", function (_ctx, labelText, val) {
      return gui.textField(labelText, val);
    });

    feCtx.define("gui-textarea", function (_ctx, labelText, val, areaHeight) {
      return gui.textArea(labelText, val, areaHeight);
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
