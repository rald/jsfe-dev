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

    // Text editing & per-widget scroll state
    this.focusedId = null;
    this.focusType = null; // "text" | "textarea"
    this._fieldValues = {};
    this._cursorPos = {};
    this._fieldScroll = {}; // id -> { x, y }
    this._fieldRects = {}; // id -> { boxX, boxY, boxW, boxH, type, lineH }
    this._dragFieldScroll = null; // { id, axis: "x"|"y", offset }

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
    this.scrollbarSize = 10;
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

  MiniImGui.prototype._getFieldScroll = function (id) {
    if (!Object.prototype.hasOwnProperty.call(this._fieldScroll, id)) {
      this._fieldScroll[id] = { x: 0, y: 0 };
    }
    return this._fieldScroll[id];
  };

  MiniImGui.prototype._getCursorPos = function (id, text) {
    var len = text ? text.length : 0;
    if (!Object.prototype.hasOwnProperty.call(this._cursorPos, id)) {
      this._cursorPos[id] = len;
    }
    if (this._cursorPos[id] < 0) this._cursorPos[id] = 0;
    if (this._cursorPos[id] > len) this._cursorPos[id] = len;
    return this._cursorPos[id];
  };

  MiniImGui.prototype._handleKeyDown = function (e) {
    if (!this.focusedId) return;
    var id = this.focusedId;
    var mode = this.focusType;
    var text = Object.prototype.hasOwnProperty.call(this._fieldValues, id)
      ? String(this._fieldValues[id])
      : "";
    var pos = this._getCursorPos(id, text);

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "Escape") {
      e.preventDefault();
      this.focusedId = null;
      this.focusType = null;
      return;
    }

    if (e.key === "Enter" && mode === "text") {
      e.preventDefault();
      this.focusedId = null;
      this.focusType = null;
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      this._cursorPos[id] = Math.max(0, pos - 1);
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      this._cursorPos[id] = Math.min(text.length, pos + 1);
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      if (mode === "textarea") {
        var lineStart = text.lastIndexOf("\n", pos - 1);
        this._cursorPos[id] = lineStart === -1 ? 0 : lineStart + 1;
      } else {
        this._cursorPos[id] = 0;
      }
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      if (mode === "textarea") {
        var lineEnd = text.indexOf("\n", pos);
        this._cursorPos[id] = lineEnd === -1 ? text.length : lineEnd;
      } else {
        this._cursorPos[id] = text.length;
      }
      return;
    }

    if (e.key === "ArrowUp" && mode === "textarea") {
      e.preventDefault();
      var prevBreak = text.lastIndexOf("\n", pos - 1);
      if (prevBreak !== -1) {
        var col = pos - (prevBreak + 1);
        var beforePrev = text.lastIndexOf("\n", prevBreak - 1);
        var prevLineStart = beforePrev === -1 ? 0 : beforePrev + 1;
        var prevLineLen = prevBreak - prevLineStart;
        this._cursorPos[id] = prevLineStart + Math.min(col, prevLineLen);
      }
      return;
    }

    if (e.key === "ArrowDown" && mode === "textarea") {
      e.preventDefault();
      var nextBreak = text.indexOf("\n", pos);
      if (nextBreak !== -1) {
        var curLineStart = text.lastIndexOf("\n", pos - 1) + 1;
        var curCol = pos - curLineStart;
        var nextLineStart = nextBreak + 1;
        var afterNextBreak = text.indexOf("\n", nextLineStart);
        var nextLineEnd = afterNextBreak === -1 ? text.length : afterNextBreak;
        var nextLineLen = nextLineEnd - nextLineStart;
        this._cursorPos[id] = nextLineStart + Math.min(curCol, nextLineLen);
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      if (pos > 0) {
        text = text.slice(0, pos - 1) + text.slice(pos);
        this._fieldValues[id] = text;
        this._cursorPos[id] = pos - 1;
      }
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      if (pos < text.length) {
        text = text.slice(0, pos) + text.slice(pos + 1);
        this._fieldValues[id] = text;
        this._cursorPos[id] = pos;
      }
      return;
    }

    if (e.key === "Enter" && mode === "textarea") {
      e.preventDefault();
      text = text.slice(0, pos) + "\n" + text.slice(pos);
      this._fieldValues[id] = text;
      this._cursorPos[id] = pos + 1;
      return;
    }

    if (e.key && e.key.length === 1) {
      e.preventDefault();
      text = text.slice(0, pos) + e.key + text.slice(pos);
      this._fieldValues[id] = text;
      this._cursorPos[id] = pos + 1;
    }
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
      var dy = e.deltaY || 0;
      var dx = e.deltaX || 0;
      if (e.shiftKey && dx === 0) {
        dx = dy;
        dy = 0;
      }

      var keys = Object.keys(self._fieldRects);
      var i;
      for (i = 0; i < keys.length; i++) {
        var fid = keys[i];
        var meta = self._fieldRects[fid];
        if (self._hit(meta.boxX, meta.boxY, meta.boxW, meta.boxH)) {
          e.preventDefault();
          var sc = self._getFieldScroll(fid);
          var maxX = Math.max(0, (meta.maxContentW || meta.boxW) - meta.innerW);
          var maxY = Math.max(0, (meta.maxContentH || meta.boxH) - meta.innerH);
          sc.x = Math.max(0, Math.min(maxX, sc.x + dx));
          sc.y = Math.max(0, Math.min(maxY, sc.y + dy));
          return;
        }
      }
    }, { passive: false });

    global.addEventListener("mouseup", function (e) {
      if (e.button !== 0) return;
      self._updatePointerPos(e);
      self.mouseDown = false;
      self.mouseClicked = false;
      self._dragFieldScroll = null;
      if (self.activeId !== null) {
        self.activeId = null;
      }
    });

    global.addEventListener("keydown", function (e) {
      self._handleKeyDown(e);
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
    this._fieldRects = {};
  };

  MiniImGui.prototype._hit = function (x, y, w, h) {
    return (
      this.mouseX >= x &&
      this.mouseX <= x + w &&
      this.mouseY >= y &&
      this.mouseY <= y + h
    );
  };

  MiniImGui.prototype.beginWindow = function (title, x, y, w, h) {
    this.frameCount++;
    this.winX = typeof x === "number" ? x : 16;
    this.winY = typeof y === "number" ? y : 16;
    this.winW = typeof w === "number" ? w : Math.max(260, this.width - this.winX - 24);
    this.winH = typeof h === "number" ? h : Math.max(220, this.height - this.winY - 24);
    this.cursorX = this.winX + 10;
    this.cursorY = this.winY + this.titleBarH + 10;

    var ctx = this.ctx;
    ctx.save();

    // Window frame (no window-level scrollbars)
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

    // Clip to window client area
    ctx.beginPath();
    ctx.rect(
      this.winX + 1,
      this.winY + this.titleBarH,
      Math.max(1, this.winW - 2),
      Math.max(1, this.winH - this.titleBarH - 1)
    );
    ctx.clip();
  };

  MiniImGui.prototype.endWindow = function () {
    this.ctx.restore();
    this.mouseClicked = false;
  };

  MiniImGui.prototype.label = function (text) {
    var x = this.cursorX;
    var y = this.cursorY;
    var ctx = this.ctx;
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "12px monospace";
    ctx.fillText(String(text), x, y + 16);
    this.cursorY += this.rowHeight + this.gap;
  };

  MiniImGui.prototype.button = function (labelText) {
    var id = "btn:" + labelText;
    var x = this.cursorX;
    var y = this.cursorY;
    var w = Math.max(80, this.winW - 20);
    var h = this.rowHeight;
    var hovered = this._hit(x, y, w, h);
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
    var w = Math.max(80, this.winW - 20);
    var h = this.rowHeight;
    var hovered = this._hit(x, y, w, h);

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
    var w = Math.max(80, this.winW - 20);
    var h = this.rowHeight;
    var hovered = this._hit(x, y, w, h);

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

  MiniImGui.prototype.textField = function (labelText, value) {
    var id = "txt:" + labelText;
    var incoming = value !== undefined && value !== null ? String(value) : "";

    var x = this.cursorX;
    var y = this.cursorY;
    var w = Math.max(100, this.winW - 20);
    var h = this.rowHeight;
    var prefix = labelText ? (labelText + ": ") : "";

    var isFocused = this.focusedId === id && this.focusType === "text";
    var text;
    if (isFocused) {
      if (!Object.prototype.hasOwnProperty.call(this._fieldValues, id)) {
        this._fieldValues[id] = incoming;
      }
      text = this._fieldValues[id];
    } else {
      text = incoming;
      this._fieldValues[id] = incoming;
    }

    var ctx = this.ctx;
    ctx.font = "12px monospace";
    var prefixW = ctx.measureText(prefix).width;
    var fieldX = x + 8 + prefixW;
    var fieldW = Math.max(24, (x + w - 8) - fieldX);
    var textW = ctx.measureText(text).width;
    var sc = this._getFieldScroll(id);

    var hoveredBox = this._hit(x, y, w, h);
    if (hoveredBox) {
      this.hotId = id;
      if (this.mouseClicked) {
        this.mouseClicked = false;
        this.focusedId = id;
        this.focusType = "text";
        this._fieldValues[id] = text;

        // Place caret based on click X inside scrollable text
        var clickTextX = (this.mouseX - fieldX) + sc.x;
        var bestIdx = text.length;
        var idx;
        for (idx = 0; idx <= text.length; idx++) {
          var cw = ctx.measureText(text.slice(0, idx)).width;
          if (cw >= clickTextX) {
            bestIdx = idx;
            break;
          }
        }
        this._cursorPos[id] = bestIdx;

        if (this.canvas && typeof this.canvas.focus === "function") {
          this.canvas.setAttribute("tabindex", "0");
          this.canvas.focus();
        }
      }
    } else if (this.mouseClicked && this.focusedId === id) {
      this.focusedId = null;
      this.focusType = null;
    }

    isFocused = this.focusedId === id && this.focusType === "text";
    if (isFocused && Object.prototype.hasOwnProperty.call(this._fieldValues, id)) {
      text = this._fieldValues[id];
      textW = ctx.measureText(text).width;
    }

    var caretIdx = this._getCursorPos(id, text);
    var caretX = ctx.measureText(text.slice(0, caretIdx)).width;

    // Auto-scroll horizontally to keep caret visible
    if (caretX - sc.x > fieldW - 10) {
      sc.x = caretX - (fieldW - 10);
    } else if (caretX - sc.x < 0) {
      sc.x = Math.max(0, caretX);
    }
    var maxScrollX = Math.max(0, textW + 12 - fieldW);
    sc.x = Math.max(0, Math.min(maxScrollX, sc.x));

    this._fieldRects[id] = {
      boxX: x,
      boxY: y,
      boxW: w,
      boxH: h,
      innerW: fieldW,
      innerH: h,
      maxContentW: textW + 12,
      maxContentH: h
    };

    ctx.fillStyle = isFocused ? "#182032" : "#171b24";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = isFocused ? "#6ea8fe" : (hoveredBox ? "#4b5775" : "#343c52");
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#c8d0e0";
    ctx.fillText(prefix, x + 8, y + 17);

    ctx.save();
    ctx.beginPath();
    ctx.rect(fieldX, y + 1, fieldW, h - 2);
    ctx.clip();
    ctx.fillStyle = "#eef2fa";
    ctx.fillText(text, fieldX - sc.x, y + 17);

    if (isFocused) {
      var blinkOn = Math.floor(Date.now() / 350) % 2 === 0;
      if (blinkOn) {
        var tfCx = Math.round(fieldX + caretX - sc.x);
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(tfCx - 1, y + 4, 2, h - 8);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tfCx + 0.5, y + 4);
        ctx.lineTo(tfCx + 0.5, y + h - 4);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    this.cursorY += h + this.gap;
    return text;
  };

  MiniImGui.prototype.textArea = function (labelText, value, areaHeight) {
    var id = "area:" + labelText;
    var incoming = value !== undefined && value !== null ? String(value) : "";
    var lineH = 16;
    var headerH = labelText ? 18 : 0;
    var sb = this.scrollbarSize;

    var x = this.cursorX;
    var y = this.cursorY;
    var w = Math.max(120, this.winW - 20);
    var totalH = (typeof areaHeight === "number" ? areaHeight : 96) + headerH;
    var boxY = y + headerH;
    var boxH = Math.max(40, totalH - headerH);

    var isFocused = this.focusedId === id && this.focusType === "textarea";
    var text;
    if (isFocused) {
      if (!Object.prototype.hasOwnProperty.call(this._fieldValues, id)) {
        this._fieldValues[id] = incoming;
      }
      text = this._fieldValues[id];
    } else {
      text = incoming;
      this._fieldValues[id] = incoming;
    }

    var ctx = this.ctx;
    ctx.font = "12px monospace";

    var lines = text.split("\n");
    var longestLineW = 0;
    var i;
    for (i = 0; i < lines.length; i++) {
      var lw = ctx.measureText(lines[i]).width;
      if (lw > longestLineW) longestLineW = lw;
    }

    var contentW = longestLineW + 24;
    var contentH = lines.length * lineH + 14;
    var viewW = Math.max(24, w - sb - 8);
    var viewH = Math.max(20, boxH - sb - 6);
    var hasVScroll = contentH > viewH;
    var hasHScroll = contentW > viewW;
    var padRight = hasVScroll ? sb : 0;
    var padBottom = hasHScroll ? sb : 0;
    var innerW = Math.max(20, w - padRight - 16);
    var innerH = Math.max(16, boxH - padBottom - 8);

    var sc = this._getFieldScroll(id);
    var maxScrollX = Math.max(0, contentW - innerW);
    var maxScrollY = Math.max(0, contentH - innerH);
    sc.x = Math.max(0, Math.min(maxScrollX, sc.x));
    sc.y = Math.max(0, Math.min(maxScrollY, sc.y));

    var textAreaRectX = x + 8;
    var textAreaRectY = boxY + 4;
    var vTrackX = x + w - sb;
    var vTrackY = boxY;
    var vTrackH = Math.max(1, boxH - padBottom);
    var hTrackX = x;
    var hTrackY = boxY + boxH - sb;
    var hTrackW = Math.max(1, w - padRight);

    var vThumbH = Math.max(16, Math.floor(vTrackH * Math.min(1, innerH / Math.max(1, contentH))));
    var vThumbY = vTrackY + (maxScrollY > 0
      ? Math.floor((sc.y / maxScrollY) * Math.max(0, vTrackH - vThumbH))
      : 0);

    var hThumbW = Math.max(16, Math.floor(hTrackW * Math.min(1, innerW / Math.max(1, contentW))));
    var hThumbX = hTrackX + (maxScrollX > 0
      ? Math.floor((sc.x / maxScrollX) * Math.max(0, hTrackW - hThumbW))
      : 0);

    // Handle ordinary scrollbar interactions (thumb drag, track page jump, hover)
    var vTrackRange = Math.max(1, vTrackH - vThumbH);
    var hTrackRange = Math.max(1, hTrackW - hThumbW);
    var vHovered = hasVScroll && this._hit(vTrackX, vTrackY, sb, vTrackH);
    var hHovered = hasHScroll && this._hit(hTrackX, hTrackY, hTrackW, sb);
    var vThumbHovered = hasVScroll && this._hit(vTrackX, vThumbY, sb, vThumbH);
    var hThumbHovered = hasHScroll && this._hit(hThumbX, hTrackY, hThumbW, sb);
    var vDragging = Boolean(this._dragFieldScroll && this._dragFieldScroll.id === id && this._dragFieldScroll.axis === "y");
    var hDragging = Boolean(this._dragFieldScroll && this._dragFieldScroll.id === id && this._dragFieldScroll.axis === "x");

    if (this.mouseClicked && vHovered) {
      this.mouseClicked = false;
      this.focusedId = id;
      this.focusType = "textarea";
      this._fieldValues[id] = text;
      if (vThumbHovered) {
        this._dragFieldScroll = {
          id: id,
          axis: "y",
          startMouseY: this.mouseY,
          startScrollY: sc.y,
          trackRange: vTrackRange,
          maxScroll: maxScrollY
        };
        vDragging = true;
      } else {
        // Ordinary track click: page up or page down
        var pageStepY = Math.max(lineH * 2, innerH - lineH);
        if (this.mouseY < vThumbY) {
          sc.y = Math.max(0, sc.y - pageStepY);
        } else {
          sc.y = Math.min(maxScrollY, sc.y + pageStepY);
        }
      }
    } else if (this.mouseClicked && hHovered) {
      this.mouseClicked = false;
      this.focusedId = id;
      this.focusType = "textarea";
      this._fieldValues[id] = text;
      if (hThumbHovered) {
        this._dragFieldScroll = {
          id: id,
          axis: "x",
          startMouseX: this.mouseX,
          startScrollX: sc.x,
          trackRange: hTrackRange,
          maxScroll: maxScrollX
        };
        hDragging = true;
      } else {
        // Ordinary track click: page left or page right
        var pageStepX = Math.max(40, innerW - 24);
        if (this.mouseX < hThumbX) {
          sc.x = Math.max(0, sc.x - pageStepX);
        } else {
          sc.x = Math.min(maxScrollX, sc.x + pageStepX);
        }
      }
    }

    if (this._dragFieldScroll && this._dragFieldScroll.id === id && this.mouseDown) {
      if (this._dragFieldScroll.axis === "y") {
        var deltaMY = this.mouseY - this._dragFieldScroll.startMouseY;
        var scrollDeltaY = (deltaMY / Math.max(1, this._dragFieldScroll.trackRange)) * this._dragFieldScroll.maxScroll;
        sc.y = Math.max(0, Math.min(maxScrollY, this._dragFieldScroll.startScrollY + scrollDeltaY));
        vDragging = true;
      } else if (this._dragFieldScroll.axis === "x") {
        var deltaMX = this.mouseX - this._dragFieldScroll.startMouseX;
        var scrollDeltaX = (deltaMX / Math.max(1, this._dragFieldScroll.trackRange)) * this._dragFieldScroll.maxScroll;
        sc.x = Math.max(0, Math.min(maxScrollX, this._dragFieldScroll.startScrollX + scrollDeltaX));
        hDragging = true;
      }
    }

    vThumbY = vTrackY + (maxScrollY > 0
      ? Math.round((sc.y / maxScrollY) * Math.max(0, vTrackH - vThumbH))
      : 0);
    hThumbX = hTrackX + (maxScrollX > 0
      ? Math.round((sc.x / maxScrollX) * Math.max(0, hTrackW - hThumbW))
      : 0);

    var hovered = !vHovered && !hHovered && !vDragging && !hDragging && this._hit(x, boxY, w, boxH);
    if (hovered || vHovered || hHovered || vDragging || hDragging) {
      this.hotId = id;
      if (hovered && this.mouseClicked) {
        this.mouseClicked = false;
        this.focusedId = id;
        this.focusType = "textarea";
        this._fieldValues[id] = text;

        // Compute clicked character index in multi-line text
        var relY = (this.mouseY - textAreaRectY) + sc.y;
        var lineIdx = Math.max(0, Math.min(lines.length - 1, Math.floor(relY / lineH)));
        var relX = (this.mouseX - textAreaRectX) + sc.x;
        var targetLine = lines[lineIdx] || "";
        var charInLine = targetLine.length;
        var cIdx;
        for (cIdx = 0; cIdx <= targetLine.length; cIdx++) {
          if (ctx.measureText(targetLine.slice(0, cIdx)).width >= relX) {
            charInLine = cIdx;
            break;
          }
        }
        var absPos = 0;
        var lScan;
        for (lScan = 0; lScan < lineIdx; lScan++) {
          absPos += lines[lScan].length + 1;
        }
        this._cursorPos[id] = absPos + charInLine;

        if (this.canvas && typeof this.canvas.focus === "function") {
          this.canvas.setAttribute("tabindex", "0");
          this.canvas.focus();
        }
      }
    } else if (this.mouseClicked && this.focusedId === id) {
      this.focusedId = null;
      this.focusType = null;
    }

    isFocused = this.focusedId === id && this.focusType === "textarea";
    if (isFocused && Object.prototype.hasOwnProperty.call(this._fieldValues, id)) {
      text = this._fieldValues[id];
      lines = text.split("\n");
      longestLineW = 0;
      for (i = 0; i < lines.length; i++) {
        var lw2 = ctx.measureText(lines[i]).width;
        if (lw2 > longestLineW) longestLineW = lw2;
      }
      contentW = longestLineW + 24;
      contentH = lines.length * lineH + 14;
      maxScrollX = Math.max(0, contentW - innerW);
      maxScrollY = Math.max(0, contentH - innerH);
    }

    var caretPos = this._getCursorPos(id, text);
    var caretLineIdx = 0;
    var lineStartOffset = 0;
    for (i = 0; i < lines.length; i++) {
      var nextStart = lineStartOffset + lines[i].length + 1;
      if (caretPos <= lineStartOffset + lines[i].length || i === lines.length - 1) {
        caretLineIdx = i;
        break;
      }
      lineStartOffset = nextStart;
    }
    var caretCol = Math.max(0, Math.min(lines[caretLineIdx].length, caretPos - lineStartOffset));
    var caretPixelX = ctx.measureText((lines[caretLineIdx] || "").slice(0, caretCol)).width;
    var caretPixelYTop = caretLineIdx * lineH;
    var caretPixelYBot = caretPixelYTop + lineH;

    // Only auto-scroll caret into view when NOT manually scrolling via thumb drag
    if (!vDragging && !hDragging) {
      if (caretPixelYBot - sc.y > innerH) {
        sc.y = caretPixelYBot - innerH;
      } else if (caretPixelYTop - sc.y < 0) {
        sc.y = Math.max(0, caretPixelYTop);
      }
      if (caretPixelX - sc.x > innerW - 10) {
        sc.x = caretPixelX - (innerW - 10);
      } else if (caretPixelX - sc.x < 0) {
        sc.x = Math.max(0, caretPixelX);
      }
    }
    sc.x = Math.max(0, Math.min(maxScrollX, sc.x));
    sc.y = Math.max(0, Math.min(maxScrollY, sc.y));

    vThumbH = Math.max(18, Math.round(vTrackH * Math.min(1, innerH / Math.max(1, contentH))));
    vThumbY = vTrackY + (maxScrollY > 0
      ? Math.round((sc.y / maxScrollY) * Math.max(0, vTrackH - vThumbH))
      : 0);
    hThumbW = Math.max(18, Math.round(hTrackW * Math.min(1, innerW / Math.max(1, contentW))));
    hThumbX = hTrackX + (maxScrollX > 0
      ? Math.round((sc.x / maxScrollX) * Math.max(0, hTrackW - hThumbW))
      : 0);

    this._fieldRects[id] = {
      boxX: x,
      boxY: boxY,
      boxW: w,
      boxH: boxH,
      innerW: innerW,
      innerH: innerH,
      maxContentW: contentW,
      maxContentH: contentH
    };

    if (labelText) {
      ctx.fillStyle = "#c8d0e0";
      ctx.fillText(String(labelText), x, y + 13);
    }

    ctx.fillStyle = isFocused ? "#182032" : "#171b24";
    ctx.fillRect(x, boxY, w, boxH);
    ctx.strokeStyle = isFocused ? "#6ea8fe" : (hovered || vHovered || hHovered ? "#4b5775" : "#343c52");
    ctx.strokeRect(x, boxY, w, boxH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(textAreaRectX, textAreaRectY, innerW, innerH);
    ctx.clip();
    ctx.fillStyle = "#eef2fa";

    for (i = 0; i < lines.length; i++) {
      var drawY = textAreaRectY + 12 + i * lineH - sc.y;
      if (drawY + lineH >= textAreaRectY && drawY - lineH <= textAreaRectY + innerH) {
        ctx.fillText(lines[i], textAreaRectX - sc.x, drawY);
      }
    }

    if (isFocused) {
      var taBlinkOn = Math.floor(Date.now() / 350) % 2 === 0;
      if (taBlinkOn) {
        var cx = Math.round(textAreaRectX + caretPixelX - sc.x);
        var cyTop = Math.round(textAreaRectY + caretLineIdx * lineH - sc.y + 2);
        var cyBot = Math.round(cyTop + lineH - 3);
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - 1, cyTop, 2, Math.max(4, cyBot - cyTop));
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 0.5, cyTop);
        ctx.lineTo(cx + 0.5, cyBot);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    // Vertical scrollbar on textarea
    if (hasVScroll) {
      ctx.fillStyle = "#12161f";
      ctx.fillRect(vTrackX, vTrackY, sb, vTrackH);
      ctx.strokeStyle = "#2b3245";
      ctx.strokeRect(vTrackX, vTrackY, sb, vTrackH);
      ctx.fillStyle = vDragging
        ? "#8ab4f8"
        : (vThumbHovered ? "#6b7ea8" : "#435173");
      ctx.fillRect(vTrackX + 1, vThumbY, sb - 2, Math.max(12, vThumbH));
    }

    // Horizontal scrollbar on textarea
    if (hasHScroll) {
      ctx.fillStyle = "#12161f";
      ctx.fillRect(hTrackX, hTrackY, hTrackW, sb);
      ctx.strokeStyle = "#2b3245";
      ctx.strokeRect(hTrackX, hTrackY, hTrackW, sb);
      ctx.fillStyle = hDragging
        ? "#8ab4f8"
        : (hThumbHovered ? "#6b7ea8" : "#435173");
      ctx.fillRect(hThumbX, hTrackY + 1, Math.max(12, hThumbW), sb - 2);
    }

    if (hasVScroll && hasHScroll) {
      ctx.fillStyle = "#1b202c";
      ctx.fillRect(x + w - sb, boxY + boxH - sb, sb, sb);
    }

    this.cursorY += totalH + this.gap;
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

    feCtx.define("gui-begin", function (_ctx, title, x, y, w, h) {
      gui.beginWindow(title, x, y, w, h);
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
