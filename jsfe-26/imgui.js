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
    this._selAnchor = {}; // id -> anchor char index (or null)
    this._preferredX = {}; // id -> preferred horizontal pixel X for vertical movement
    this._lastBlinkReset = {}; // id -> timestamp
    this._caretMovedFlag = {}; // id -> boolean
    this._clipboardText = ""; // internal fallback clipboard
    this._lastClickTime = 0;
    this._dragSelect = null; // { id, type }
    this._fieldScroll = {}; // id -> { x, y }
    this._fieldRects = {}; // id -> { boxX, boxY, boxW, boxH, type, lineH }
    this._dragFieldScroll = null; // { id, axis: "x"|"y", offset }

    // Window management state (keyed by window title)
    this._windows = {}; // winId -> { x, y, w, h, minimized, maximized, closed, prevRect, initialized }
    this._dragWindow = null; // { winId, startMouseX, startMouseY, startWinX, startWinY }
    this._currentWinId = null;
    this._currentWinSkipped = false;

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

  MiniImGui.prototype._resetBlinkAndFlagScroll = function (id) {
    this._lastBlinkReset[id] = Date.now();
    this._caretMovedFlag[id] = true;
  };

  MiniImGui.prototype._isCursorVisibleNow = function (id) {
    var now = Date.now();
    var lastReset = Object.prototype.hasOwnProperty.call(this._lastBlinkReset, id)
      ? this._lastBlinkReset[id]
      : 0;
    if (now - lastReset < 550) {
      return true;
    }
    return Math.floor(now / 450) % 2 === 0;
  };

  MiniImGui.prototype._getSelectionRange = function (id, textLen) {
    if (!Object.prototype.hasOwnProperty.call(this._selAnchor, id) || this._selAnchor[id] === null) {
      return null;
    }
    var anchor = Math.max(0, Math.min(textLen, this._selAnchor[id]));
    var caret = Math.max(0, Math.min(textLen, this._cursorPos[id] !== undefined ? this._cursorPos[id] : textLen));
    if (anchor === caret) return null;
    return {
      start: Math.min(anchor, caret),
      end: Math.max(anchor, caret)
    };
  };

  MiniImGui.prototype._clearSelection = function (id) {
    this._selAnchor[id] = null;
  };

  MiniImGui.prototype._deleteSelectionIfAny = function (id, text) {
    var sel = this._getSelectionRange(id, text.length);
    if (!sel) {
      return { text: text, pos: this._getCursorPos(id, text), deleted: false };
    }
    var nextText = text.slice(0, sel.start) + text.slice(sel.end);
    this._fieldValues[id] = nextText;
    this._cursorPos[id] = sel.start;
    this._selAnchor[id] = null;
    return { text: nextText, pos: sel.start, deleted: true };
  };

  MiniImGui.prototype._lineColFromPos = function (text, pos) {
    var clamped = Math.max(0, Math.min(text.length, pos));
    var lines = text.split("\n");
    var lineIdx = 0;
    var lineStart = 0;
    var i;
    for (i = 0; i < lines.length; i++) {
      var lineEnd = lineStart + lines[i].length;
      if (clamped <= lineEnd || i === lines.length - 1) {
        lineIdx = i;
        break;
      }
      lineStart = lineEnd + 1;
    }
    var col = Math.max(0, Math.min(lines[lineIdx].length, clamped - lineStart));
    return { lines: lines, lineIdx: lineIdx, col: col, lineStart: lineStart };
  };

  MiniImGui.prototype._posFromLineCol = function (lines, lineIdx, col) {
    var clampedLine = Math.max(0, Math.min(lines.length - 1, lineIdx));
    var offset = 0;
    var i;
    for (i = 0; i < clampedLine; i++) {
      offset += lines[i].length + 1;
    }
    var clampedCol = Math.max(0, Math.min(lines[clampedLine].length, col));
    return offset + clampedCol;
  };

  MiniImGui.prototype._colFromPixelXOnLine = function (ctx, lineText, targetPixelX) {
    if (targetPixelX <= 0) return 0;
    var idx;
    var prevW = 0;
    for (idx = 1; idx <= lineText.length; idx++) {
      var curW = ctx.measureText(lineText.slice(0, idx)).width;
      if (curW >= targetPixelX) {
        if (targetPixelX - prevW < curW - targetPixelX) {
          return idx - 1;
        }
        return idx;
      }
      prevW = curW;
    }
    return lineText.length;
  };

  MiniImGui.prototype._insertPastedText = function (id, mode, rawText) {
    if (!id || typeof rawText !== "string") return;
    var sanitized = mode === "text" ? rawText.replace(/[\r\n]+/g, " ") : rawText.replace(/\r\n?/g, "\n");
    var current = Object.prototype.hasOwnProperty.call(this._fieldValues, id)
      ? String(this._fieldValues[id])
      : "";
    var delRes = this._deleteSelectionIfAny(id, current);
    var baseText = delRes.text;
    var insertAt = delRes.pos;
    var nextText = baseText.slice(0, insertAt) + sanitized + baseText.slice(insertAt);
    this._fieldValues[id] = nextText;
    this._cursorPos[id] = insertAt + sanitized.length;
    this._clearSelection(id);
    delete this._preferredX[id];
    this._resetBlinkAndFlagScroll(id);
  };

  MiniImGui.prototype._handleKeyDown = function (e) {
    if (!this.focusedId) return;
    var id = this.focusedId;
    var mode = this.focusType;
    var text = Object.prototype.hasOwnProperty.call(this._fieldValues, id)
      ? String(this._fieldValues[id])
      : "";
    var pos = this._getCursorPos(id, text);
    var lines = text.split("\n");

    if (e.altKey) return;

    var self = this;

    // Select All (Ctrl+A / Cmd+A)
    if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "a") {
      e.preventDefault();
      this._selAnchor[id] = 0;
      this._cursorPos[id] = text.length;
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    // Copy (Ctrl+C / Cmd+C)
    if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "c") {
      var selCopy = this._getSelectionRange(id, text.length);
      if (selCopy) {
        e.preventDefault();
        var copiedStr = text.slice(selCopy.start, selCopy.end);
        this._clipboardText = copiedStr;
        if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(copiedStr).catch(function () {});
        }
      }
      return;
    }

    // Cut (Ctrl+X / Cmd+X)
    if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "x") {
      var selCut = this._getSelectionRange(id, text.length);
      if (selCut) {
        e.preventDefault();
        var cutStr = text.slice(selCut.start, selCut.end);
        this._clipboardText = cutStr;
        if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(cutStr).catch(function () {});
        }
        var afterCut = text.slice(0, selCut.start) + text.slice(selCut.end);
        this._fieldValues[id] = afterCut;
        this._cursorPos[id] = selCut.start;
        this._clearSelection(id);
        delete this._preferredX[id];
        this._resetBlinkAndFlagScroll(id);
      }
      return;
    }

    // Paste (Ctrl+V / Cmd+V)
    if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "v") {
      e.preventDefault();
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.readText === "function") {
        navigator.clipboard.readText().then(function (clipText) {
          if (typeof clipText === "string" && clipText.length > 0) {
            self._insertPastedText(id, mode, clipText);
          } else if (self._clipboardText) {
            self._insertPastedText(id, mode, self._clipboardText);
          }
        }).catch(function () {
          if (self._clipboardText) {
            self._insertPastedText(id, mode, self._clipboardText);
          }
        });
      } else if (this._clipboardText) {
        this._insertPastedText(id, mode, this._clipboardText);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) return;

    if (e.key === "Escape") {
      e.preventDefault();
      this._clearSelection(id);
      this.focusedId = null;
      this.focusType = null;
      return;
    }

    if (e.key === "Enter" && mode === "text") {
      e.preventDefault();
      this._clearSelection(id);
      this.focusedId = null;
      this.focusType = null;
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      var selLeft = this._getSelectionRange(id, text.length);
      if (e.shiftKey) {
        if (this._selAnchor[id] === null || this._selAnchor[id] === undefined) {
          this._selAnchor[id] = pos;
        }
        this._cursorPos[id] = Math.max(0, pos - 1);
      } else if (selLeft) {
        this._cursorPos[id] = selLeft.start;
        this._clearSelection(id);
      } else {
        this._cursorPos[id] = Math.max(0, pos - 1);
        this._clearSelection(id);
      }
      delete this._preferredX[id];
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      var selRight = this._getSelectionRange(id, text.length);
      if (e.shiftKey) {
        if (this._selAnchor[id] === null || this._selAnchor[id] === undefined) {
          this._selAnchor[id] = pos;
        }
        this._cursorPos[id] = Math.min(text.length, pos + 1);
      } else if (selRight) {
        this._cursorPos[id] = selRight.end;
        this._clearSelection(id);
      } else {
        this._cursorPos[id] = Math.min(text.length, pos + 1);
        this._clearSelection(id);
      }
      delete this._preferredX[id];
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      var homeTarget = 0;
      if (mode === "textarea") {
        var lineStart = text.lastIndexOf("\n", pos - 1);
        homeTarget = lineStart === -1 ? 0 : lineStart + 1;
      }
      if (e.shiftKey) {
        if (this._selAnchor[id] === null || this._selAnchor[id] === undefined) {
          this._selAnchor[id] = pos;
        }
      } else {
        this._clearSelection(id);
      }
      this._cursorPos[id] = homeTarget;
      delete this._preferredX[id];
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      var endTarget = text.length;
      if (mode === "textarea") {
        var lineEnd = text.indexOf("\n", pos);
        endTarget = lineEnd === -1 ? text.length : lineEnd;
      }
      if (e.shiftKey) {
        if (this._selAnchor[id] === null || this._selAnchor[id] === undefined) {
          this._selAnchor[id] = pos;
        }
      } else {
        this._clearSelection(id);
      }
      this._cursorPos[id] = endTarget;
      delete this._preferredX[id];
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key === "ArrowUp" && mode === "textarea") {
      e.preventDefault();
      if (e.shiftKey) {
        if (this._selAnchor[id] === null || this._selAnchor[id] === undefined) {
          this._selAnchor[id] = pos;
        }
      } else {
        this._clearSelection(id);
      }
      var infoUp = this._lineColFromPos(text, pos);
      var ctxUp = this.ctx;
      ctxUp.font = "12px monospace";
      var prefXUp = this._preferredX[id] !== undefined
        ? this._preferredX[id]
        : ctxUp.measureText((lines[infoUp.lineIdx] || "").slice(0, infoUp.col)).width;
      this._preferredX[id] = prefXUp;

      if (infoUp.lineIdx > 0) {
        var prevLineText = lines[infoUp.lineIdx - 1] || "";
        var nextColUp = this._colFromPixelXOnLine(ctxUp, prevLineText, prefXUp);
        this._cursorPos[id] = this._posFromLineCol(lines, infoUp.lineIdx - 1, nextColUp);
      } else {
        this._cursorPos[id] = 0;
      }
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key === "ArrowDown" && mode === "textarea") {
      e.preventDefault();
      if (e.shiftKey) {
        if (this._selAnchor[id] === null || this._selAnchor[id] === undefined) {
          this._selAnchor[id] = pos;
        }
      } else {
        this._clearSelection(id);
      }
      var infoDn = this._lineColFromPos(text, pos);
      var ctxDn = this.ctx;
      ctxDn.font = "12px monospace";
      var prefXDn = this._preferredX[id] !== undefined
        ? this._preferredX[id]
        : ctxDn.measureText((lines[infoDn.lineIdx] || "").slice(0, infoDn.col)).width;
      this._preferredX[id] = prefXDn;

      if (infoDn.lineIdx < lines.length - 1) {
        var nextLineText = lines[infoDn.lineIdx + 1] || "";
        var nextColDn = this._colFromPixelXOnLine(ctxDn, nextLineText, prefXDn);
        this._cursorPos[id] = this._posFromLineCol(lines, infoDn.lineIdx + 1, nextColDn);
      } else {
        this._cursorPos[id] = text.length;
      }
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      var delBack = this._deleteSelectionIfAny(id, text);
      if (delBack.deleted) {
        text = delBack.text;
        this._cursorPos[id] = delBack.pos;
      } else if (pos > 0) {
        text = text.slice(0, pos - 1) + text.slice(pos);
        this._fieldValues[id] = text;
        this._cursorPos[id] = pos - 1;
      }
      delete this._preferredX[id];
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      var delFwd = this._deleteSelectionIfAny(id, text);
      if (delFwd.deleted) {
        text = delFwd.text;
        this._cursorPos[id] = delFwd.pos;
      } else if (pos < text.length) {
        text = text.slice(0, pos) + text.slice(pos + 1);
        this._fieldValues[id] = text;
        this._cursorPos[id] = pos;
      }
      delete this._preferredX[id];
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key === "Enter" && mode === "textarea") {
      e.preventDefault();
      var insEnter = this._deleteSelectionIfAny(id, text);
      text = insEnter.text;
      pos = insEnter.pos;
      text = text.slice(0, pos) + "\n" + text.slice(pos);
      this._fieldValues[id] = text;
      this._cursorPos[id] = pos + 1;
      delete this._preferredX[id];
      this._resetBlinkAndFlagScroll(id);
      return;
    }

    if (e.key && e.key.length === 1) {
      e.preventDefault();
      var insChar = this._deleteSelectionIfAny(id, text);
      text = insChar.text;
      pos = insChar.pos;
      text = text.slice(0, pos) + e.key + text.slice(pos);
      this._fieldValues[id] = text;
      this._cursorPos[id] = pos + 1;
      delete this._preferredX[id];
      this._resetBlinkAndFlagScroll(id);
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
      self._dragSelect = null;
      self._dragWindow = null;
      if (self.activeId !== null) {
        self.activeId = null;
      }
    });

    global.addEventListener("mousemove", function (e) {
      if (self._dragSelect || self._dragWindow) {
        self._updatePointerPos(e);
      }
    });

    global.addEventListener("paste", function (e) {
      if (!self.focusedId) return;
      var clipData = e.clipboardData || (global.clipboardData || null);
      var pasted = clipData && typeof clipData.getData === "function"
        ? clipData.getData("text/plain")
        : "";
      if (typeof pasted === "string" && pasted.length > 0) {
        e.preventDefault();
        self._insertPastedText(self.focusedId, self.focusType, pasted);
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

  MiniImGui.prototype._getWindowState = function (winId, defaultX, defaultY, defaultW, defaultH) {
    if (!Object.prototype.hasOwnProperty.call(this._windows, winId)) {
      this._windows[winId] = {
        x: defaultX,
        y: defaultY,
        w: defaultW,
        h: defaultH,
        minimized: false,
        maximized: false,
        closed: false,
        prevRect: null
      };
    }
    return this._windows[winId];
  };

  MiniImGui.prototype.reopenWindow = function (title) {
    var winId = "win:" + String(title || "Window");
    if (Object.prototype.hasOwnProperty.call(this._windows, winId)) {
      this._windows[winId].closed = false;
      this._windows[winId].minimized = false;
    }
  };

  MiniImGui.prototype.beginWindow = function (title, x, y, w, h) {
    this.frameCount++;
    var winTitle = String(title || "Window");
    var winId = "win:" + winTitle;
    this._currentWinId = winId;
    this._currentWinSkipped = false;

    var initX = typeof x === "number" ? x : 16;
    var initY = typeof y === "number" ? y : 16;
    var initW = typeof w === "number" ? w : Math.max(260, this.width - initX - 24);
    var initH = typeof h === "number" ? h : Math.max(220, this.height - initY - 24);

    var wState = this._getWindowState(winId, initX, initY, initW, initH);

    if (wState.closed) {
      this._currentWinSkipped = true;
      return;
    }

    // Handle active titlebar drag
    if (this._dragWindow && this._dragWindow.winId === winId && this.mouseDown && !wState.maximized) {
      var dx = this.mouseX - this._dragWindow.startMouseX;
      var dy = this.mouseY - this._dragWindow.startMouseY;
      wState.x = Math.max(0, Math.min(Math.max(0, this.width - 60), this._dragWindow.startWinX + dx));
      wState.y = Math.max(0, Math.min(Math.max(0, this.height - this.titleBarH), this._dragWindow.startWinY + dy));
    }

    var drawX = wState.x;
    var drawY = wState.y;
    var drawW = wState.maximized ? Math.max(160, this.width - 16) : wState.w;
    var drawH = wState.maximized
      ? Math.max(80, this.height - 16)
      : (wState.minimized ? this.titleBarH : wState.h);

    if (wState.maximized) {
      drawX = 8;
      drawY = 8;
    }

    this.winX = drawX;
    this.winY = drawY;
    this.winW = drawW;
    this.winH = drawH;
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
    var isDraggingThisWin = Boolean(this._dragWindow && this._dragWindow.winId === winId);
    ctx.fillStyle = isDraggingThisWin ? "#323c52" : "#262d3d";
    ctx.fillRect(this.winX, this.winY, this.winW, this.titleBarH);
    ctx.strokeRect(this.winX, this.winY, this.winW, this.titleBarH);

    // Titlebar control buttons: Close [x], Maximize [max], Minimize [-]
    var btnSize = 16;
    var btnGap = 4;
    var btnY = this.winY + Math.floor((this.titleBarH - btnSize) / 2);

    var closeBtnX = this.winX + this.winW - btnSize - 4;
    var maxBtnX = closeBtnX - btnSize - btnGap;
    var minBtnX = maxBtnX - btnSize - btnGap;

    var minHover = this._hit(minBtnX, btnY, btnSize, btnSize);
    var maxHover = this._hit(maxBtnX, btnY, btnSize, btnSize);
    var closeHover = this._hit(closeBtnX, btnY, btnSize, btnSize);
    var anyBtnHover = minHover || maxHover || closeHover;

    var titleBarHover = !anyBtnHover && this._hit(this.winX, this.winY, Math.max(0, minBtnX - this.winX), this.titleBarH);

    if (this.mouseClicked) {
      if (minHover) {
        this.mouseClicked = false;
        wState.minimized = !wState.minimized;
      } else if (maxHover) {
        this.mouseClicked = false;
        if (!wState.maximized) {
          wState.prevRect = { x: wState.x, y: wState.y, w: wState.w, h: wState.h };
          wState.minimized = false;
          wState.maximized = true;
        } else {
          wState.maximized = false;
          if (wState.prevRect) {
            wState.x = wState.prevRect.x;
            wState.y = wState.prevRect.y;
            wState.w = wState.prevRect.w;
            wState.h = wState.prevRect.h;
          }
        }
      } else if (closeHover) {
        this.mouseClicked = false;
        wState.closed = true;
        this._currentWinSkipped = true;
        ctx.restore();
        return;
      } else if (titleBarHover && !wState.maximized) {
        this.focusedId = null;
        this.focusType = null;
        this._dragWindow = {
          winId: winId,
          startMouseX: this.mouseX,
          startMouseY: this.mouseY,
          startWinX: wState.x,
          startWinY: wState.y
        };
      }
    }

    // Draw window title text (clipped before buttons)
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.winX + 4, this.winY + 1, Math.max(10, minBtnX - this.winX - 8), this.titleBarH - 2);
    ctx.clip();
    ctx.fillStyle = "#e6e9f0";
    ctx.font = "12px monospace";
    ctx.fillText(winTitle, this.winX + 10, this.winY + 16);
    ctx.restore();

    // Draw Minimize button (-)
    ctx.fillStyle = minHover ? "#3b4661" : "#2e374d";
    ctx.fillRect(minBtnX, btnY, btnSize, btnSize);
    ctx.strokeStyle = "#526082";
    ctx.strokeRect(minBtnX, btnY, btnSize, btnSize);
    ctx.strokeStyle = "#eef2fa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(minBtnX + 4, btnY + btnSize - 4.5);
    ctx.lineTo(minBtnX + btnSize - 4, btnY + btnSize - 4.5);
    ctx.stroke();

    // Draw Maximize / Restore button ([])
    ctx.fillStyle = maxHover ? "#3b4661" : "#2e374d";
    ctx.fillRect(maxBtnX, btnY, btnSize, btnSize);
    ctx.strokeStyle = "#526082";
    ctx.strokeRect(maxBtnX, btnY, btnSize, btnSize);
    ctx.strokeStyle = "#eef2fa";
    ctx.lineWidth = 1.2;
    if (wState.maximized) {
      ctx.strokeRect(maxBtnX + 5, btnY + 4, btnSize - 9, btnSize - 9);
      ctx.strokeRect(maxBtnX + 3.5, btnY + 6, btnSize - 9, btnSize - 9);
    } else {
      ctx.strokeRect(maxBtnX + 4, btnY + 4, btnSize - 8, btnSize - 8);
    }

    // Draw Close button (x)
    ctx.fillStyle = closeHover ? "#9e343e" : "#3a2a33";
    ctx.fillRect(closeBtnX, btnY, btnSize, btnSize);
    ctx.strokeStyle = closeHover ? "#e06c75" : "#664752";
    ctx.strokeRect(closeBtnX, btnY, btnSize, btnSize);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(closeBtnX + 4.5, btnY + 4.5);
    ctx.lineTo(closeBtnX + btnSize - 4.5, btnY + btnSize - 4.5);
    ctx.moveTo(closeBtnX + btnSize - 4.5, btnY + 4.5);
    ctx.lineTo(closeBtnX + 4.5, btnY + btnSize - 4.5);
    ctx.stroke();

    if (wState.minimized) {
      this._currentWinSkipped = true;
      ctx.restore();
      return;
    }

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
    if (this._currentWinSkipped) {
      this._currentWinSkipped = false;
      this._currentWinId = null;
      this.mouseClicked = false;
      return;
    }
    this._currentWinId = null;
    this.ctx.restore();
    this.mouseClicked = false;
  };

  MiniImGui.prototype.label = function (text) {
    if (this._currentWinSkipped) { return; }
    var x = this.cursorX;
    var y = this.cursorY;
    var ctx = this.ctx;
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "12px monospace";
    ctx.fillText(String(text), x, y + 16);
    this.cursorY += this.rowHeight + this.gap;
  };

  MiniImGui.prototype.button = function (labelText) {
    if (this._currentWinSkipped) { return false; }
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
    if (this._currentWinSkipped) { return typeof value === 'number' ? value : (typeof minVal === 'number' ? minVal : 0); }
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
    if (this._currentWinSkipped) { return Boolean(checked); }
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
    if (this._currentWinSkipped) { return value !== undefined && value !== null ? String(value) : ''; }
    var id = "txt:" + labelText;
    var incoming = value !== undefined && value !== null ? String(value) : "";
    var self = this;

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

    function computeTfPos(px) {
      var clickTextX = (px - fieldX) + sc.x;
      return self._colFromPixelXOnLine(ctx, text, clickTextX);
    }

    var hoveredBox = this._hit(x, y, w, h);
    var isDragSelectingTf = Boolean(this._dragSelect && this._dragSelect.id === id && this.mouseDown);

    if (hoveredBox || isDragSelectingTf) {
      this.hotId = id;
      if (hoveredBox && this.mouseClicked) {
        var nowClick = Date.now();
        var isDoubleClick = (nowClick - this._lastClickTime) < 350 && this.focusedId === id;
        this._lastClickTime = nowClick;

        this.mouseClicked = false;
        this.focusedId = id;
        this.focusType = "text";
        this._fieldValues[id] = text;

        var clickedPos = computeTfPos(this.mouseX);
        if (isDoubleClick) {
          var wStart = clickedPos;
          var wEnd = clickedPos;
          while (wStart > 0 && /[A-Za-z0-9_.-]/.test(text.charAt(wStart - 1))) {
            wStart--;
          }
          while (wEnd < text.length && /[A-Za-z0-9_.-]/.test(text.charAt(wEnd))) {
            wEnd++;
          }
          this._selAnchor[id] = wStart;
          this._cursorPos[id] = wEnd;
          this._dragSelect = null;
        } else {
          this._cursorPos[id] = clickedPos;
          this._selAnchor[id] = clickedPos;
          this._dragSelect = { id: id, type: "text" };
        }
        this._resetBlinkAndFlagScroll(id);

        if (this.canvas && typeof this.canvas.focus === "function") {
          this.canvas.setAttribute("tabindex", "0");
          this.canvas.focus();
        }
      }
    } else if (this.mouseClicked && this.focusedId === id) {
      this._clearSelection(id);
      this.focusedId = null;
      this.focusType = null;
    }

    if (isDragSelectingTf && this.focusedId === id) {
      var dragPos = computeTfPos(this.mouseX);
      if (this._cursorPos[id] !== dragPos) {
        this._cursorPos[id] = dragPos;
        this._resetBlinkAndFlagScroll(id);
      }
    }

    isFocused = this.focusedId === id && this.focusType === "text";
    if (isFocused && Object.prototype.hasOwnProperty.call(this._fieldValues, id)) {
      text = this._fieldValues[id];
      textW = ctx.measureText(text).width;
    }

    var caretIdx = this._getCursorPos(id, text);
    var caretX = ctx.measureText(text.slice(0, caretIdx)).width;

    // Auto-scroll horizontally when caret moved/typed
    if (this._caretMovedFlag[id]) {
      this._caretMovedFlag[id] = false;
      if (caretX - sc.x > fieldW - 10) {
        sc.x = caretX - (fieldW - 10);
      } else if (caretX - sc.x < 0) {
        sc.x = Math.max(0, caretX);
      }
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

    var tfSel = isFocused ? this._getSelectionRange(id, text.length) : null;
    if (tfSel) {
      var sx1 = fieldX + ctx.measureText(text.slice(0, tfSel.start)).width - sc.x;
      var sx2 = fieldX + ctx.measureText(text.slice(0, tfSel.end)).width - sc.x;
      ctx.fillStyle = "rgba(110, 168, 254, 0.35)";
      ctx.fillRect(Math.min(sx1, sx2), y + 4, Math.max(2, Math.abs(sx2 - sx1)), h - 8);
    }

    ctx.fillStyle = "#eef2fa";
    ctx.fillText(text, fieldX - sc.x, y + 17);

    if (isFocused && this._isCursorVisibleNow(id)) {
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
    ctx.restore();

    this.cursorY += h + this.gap;
    return text;
  };

  MiniImGui.prototype.textArea = function (labelText, value, areaHeight) {
    if (this._currentWinSkipped) { return value !== undefined && value !== null ? String(value) : ''; }
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
    var isDragSelectingThis = Boolean(this._dragSelect && this._dragSelect.id === id && this.mouseDown);

    function computePosFromPointer(px, py) {
      var relY = (py - textAreaRectY) + sc.y;
      var lineIdx = Math.max(0, Math.min(lines.length - 1, Math.floor(relY / lineH)));
      var relX = (px - textAreaRectX) + sc.x;
      var targetLine = lines[lineIdx] || "";
      var charInLine = self._colFromPixelXOnLine(ctx, targetLine, relX);
      return self._posFromLineCol(lines, lineIdx, charInLine);
    }

    var self = this;

    if (hovered || vHovered || hHovered || vDragging || hDragging || isDragSelectingThis) {
      this.hotId = id;
      if (hovered && this.mouseClicked) {
        var nowClick = Date.now();
        var isDoubleClick = (nowClick - this._lastClickTime) < 350 && this.focusedId === id;
        this._lastClickTime = nowClick;

        this.mouseClicked = false;
        this.focusedId = id;
        this.focusType = "textarea";
        this._fieldValues[id] = text;

        var clickedPos = computePosFromPointer(this.mouseX, this.mouseY);
        if (isDoubleClick) {
          // Select word around clickedPos
          var wStart = clickedPos;
          var wEnd = clickedPos;
          while (wStart > 0 && /[A-Za-z0-9_.-]/.test(text.charAt(wStart - 1))) {
            wStart--;
          }
          while (wEnd < text.length && /[A-Za-z0-9_.-]/.test(text.charAt(wEnd))) {
            wEnd++;
          }
          this._selAnchor[id] = wStart;
          this._cursorPos[id] = wEnd;
          this._dragSelect = null;
        } else {
          this._cursorPos[id] = clickedPos;
          this._selAnchor[id] = clickedPos;
          this._dragSelect = { id: id, type: "textarea" };
        }
        delete this._preferredX[id];
        this._resetBlinkAndFlagScroll(id);

        if (this.canvas && typeof this.canvas.focus === "function") {
          this.canvas.setAttribute("tabindex", "0");
          this.canvas.focus();
        }
      }
    } else if (this.mouseClicked && this.focusedId === id) {
      this._clearSelection(id);
      this.focusedId = null;
      this.focusType = null;
    }

    if (isDragSelectingThis && this.focusedId === id) {
      var dragPos = computePosFromPointer(this.mouseX, this.mouseY);
      if (this._cursorPos[id] !== dragPos) {
        this._cursorPos[id] = dragPos;
        this._resetBlinkAndFlagScroll(id);
      }
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
    var caretInfo = this._lineColFromPos(text, caretPos);
    var caretLineIdx = caretInfo.lineIdx;
    var caretCol = caretInfo.col;
    var caretPixelX = ctx.measureText((lines[caretLineIdx] || "").slice(0, caretCol)).width;
    var caretPixelYTop = caretLineIdx * lineH;
    var caretPixelYBot = caretPixelYTop + lineH;

    // Auto-scroll caret into view only when caret just moved/typed and user isn't dragging scrollbar
    if (!vDragging && !hDragging && this._caretMovedFlag[id]) {
      this._caretMovedFlag[id] = false;
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

    // Draw selection highlight if text is selected
    var selRange = isFocused ? this._getSelectionRange(id, text.length) : null;
    if (selRange) {
      var startInfo = this._lineColFromPos(text, selRange.start);
      var endInfo = this._lineColFromPos(text, selRange.end);
      ctx.fillStyle = "rgba(110, 168, 254, 0.35)";
      var sLine;
      for (sLine = startInfo.lineIdx; sLine <= endInfo.lineIdx; sLine++) {
        var lineStr = lines[sLine] || "";
        var selStartCol = sLine === startInfo.lineIdx ? startInfo.col : 0;
        var selEndCol = sLine === endInfo.lineIdx ? endInfo.col : lineStr.length;
        var sx1 = textAreaRectX + ctx.measureText(lineStr.slice(0, selStartCol)).width - sc.x;
        var sx2 = textAreaRectX + ctx.measureText(lineStr.slice(0, selEndCol)).width - sc.x;
        if (selEndCol === lineStr.length && sLine < endInfo.lineIdx) {
          sx2 += 6;
        }
        var sy = textAreaRectY + sLine * lineH - sc.y + 1;
        ctx.fillRect(Math.min(sx1, sx2), sy, Math.max(2, Math.abs(sx2 - sx1)), lineH);
      }
    }

    ctx.fillStyle = "#eef2fa";
    for (i = 0; i < lines.length; i++) {
      var drawY = textAreaRectY + 12 + i * lineH - sc.y;
      if (drawY + lineH >= textAreaRectY && drawY - lineH <= textAreaRectY + innerH) {
        ctx.fillText(lines[i], textAreaRectX - sc.x, drawY);
      }
    }

    if (isFocused && this._isCursorVisibleNow(id)) {
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
