/**
 * ============================================================================
 * kernel.js — jsfe Web OS Kernel (Main Storage: "root" Folder)
 * Philosophy: "All is a list" — every OS resource, process, window, file,
 * and extension is represented and manipulated as an S-expression list in `fe`.
 * Main storage is the `root/` folder on disk (no virtual filesystem).
 * ============================================================================
 */

import { FeContext, FE_TYPE, StringStream } from "./fe.js";
import { SWEETIE_16, SWEETIE_SWATCHES } from "./sweetie.js";

const ALLOWED_HEX = new Set(SWEETIE_SWATCHES.map((s) => s.hex.toLowerCase()));

export function resolveSweetieColor(colorOrName, fallback = SWEETIE_16.marshmallow) {
  if (!colorOrName || typeof colorOrName !== "string") return fallback;
  const trimmed = colorOrName.trim();
  if (SWEETIE_16[trimmed]) return SWEETIE_16[trimmed];
  const lower = trimmed.toLowerCase();
  for (const sw of SWEETIE_SWATCHES) {
    if (sw.name.toLowerCase() === lower) return sw.hex;
  }
  if (ALLOWED_HEX.has(lower)) return lower;
  return fallback;
}

export function normalizeRootPath(nameOrPath) {
  const cleaned = String(nameOrPath || "").trim().replace(/^\/+/, "");
  if (!cleaned) return "root";
  return cleaned.startsWith("root/") ? cleaned : `root/${cleaned}`;
}

export class JsfeKernel {
  constructor(uiHooks) {
    this.ui = uiHooks;
    this.mainStorageDir = "root";
    this.rootFiles = [];
    this.windows = new Map();
    this.apps = new Map();
    this.procs = [];
    this.nextPid = 1;
    this.zCounter = 20;
    this.canvasOps = [];

    this.ctx = new FeContext({
      onPrint: (msg) => {
        this.ui.onKernelPrint(msg);
      }
    });

    this._installKernelPrimitives();
  }

  toFeList(items) {
    return this.ctx.list(items.map((x) => (x && x.type !== undefined ? x : this.ctx.fromJS(x))));
  }

  parseAllSexp(source) {
    this.ctx._resetLookahead();
    const stream = new StringStream(source);
    const exprs = [];
    let expr;
    while ((expr = this.ctx.read(stream)) !== null) {
      exprs.push(expr);
    }
    return exprs;
  }

  formatSexp(obj) {
    return this.ctx.toString(obj, true);
  }

  plistToMap(plistObj) {
    const map = new Map();
    if (!plistObj || this.ctx.isNil(plistObj)) return map;
    const items = this.ctx.toArray(plistObj);
    for (const item of items) {
      if (Array.isArray(item) && item.length >= 2) {
        map.set(String(item[0]), item[1]);
      }
    }
    return map;
  }

  async listRootFiles() {
    if (typeof fetch === "function") {
      try {
        const resp = await fetch("/cgi-bin/fs.py?action=list");
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.ok && Array.isArray(data.files)) {
            this.rootFiles = data.files;
            this.ui.onRootFilesUpdated(this.rootFiles);
            return this.rootFiles;
          }
        }
      } catch (_) {}
    }
    this.ui.onRootFilesUpdated(this.rootFiles);
    return this.rootFiles;
  }

  async readRootFile(nameOrPath) {
    const relPath = normalizeRootPath(nameOrPath);
    if (typeof fetch === "function") {
      const resp = await fetch(`/cgi-bin/fs.py?action=read&name=${encodeURIComponent(relPath)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.ok) {
          return String(data.content ?? "");
        }
      }
      const fallbackResp = await fetch(relPath);
      if (fallbackResp.ok) {
        return await fallbackResp.text();
      }
    }
    throw new Error(`Unable to read ${relPath} from root main storage`);
  }

  async writeRootFile(nameOrPath, content) {
    const relPath = normalizeRootPath(nameOrPath);
    if (typeof fetch !== "function") {
      throw new Error("fetch is required to write to root main storage");
    }
    const resp = await fetch("/cgi-bin/fs.py", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "write", name: relPath, content: String(content ?? "") })
    });
    const data = await resp.json();
    if (!resp.ok || !data || !data.ok) {
      throw new Error((data && data.error) || `Failed to write ${relPath}`);
    }
    await this.listRootFiles();
    return relPath;
  }

  async saveSnapshotToRoot(filename = "os-state.sexp") {
    const snap = this.buildOsSnapshotSexp();
    await this.writeRootFile(filename, snap);
    return snap;
  }

  buildOsSnapshotSexp() {
    const fileLists = this.rootFiles.map(
      (f) => `(file ${this.ctx.toString(this.ctx.string(`root/${f.name}`), true)} ${Number(f.size || 0)})`
    );
    const winLists = [];
    for (const [id, win] of this.windows.entries()) {
      winLists.push(
        `(window (id ${this.ctx.toString(this.ctx.string(id), true)}) (title ${this.ctx.toString(this.ctx.string(win.title), true)}) (x ${win.x}) (y ${win.y}) (w ${win.w}) (h ${win.h}))`
      );
    }
    const appNames = Array.from(this.apps.keys());
    return `(jsfe-os-state
  (philosophy "all is a list")
  (palette "sweetie-16")
  (main-storage "root")
  (apps (${appNames.join(" ")}))
  (windows (${winLists.join(" ")}))
  (root-files (${fileLists.join("\n    ")})))`;
  }

  _recordProc(name, exprStr) {
    const pid = this.nextPid++;
    const entry = { pid, name, expr: exprStr, ts: Date.now() };
    this.procs.unshift(entry);
    if (this.procs.length > 60) this.procs.length = 60;
    this.ui.onProcsUpdated(this.procs);
    return pid;
  }

  async boot() {
    await this.listRootFiles();

    // Override `load` so files resolve directly from main storage `root/`
    this.ctx.defineRaw("load", async (ctx, argsPair) => {
      const argState = {
        list: argsPair,
        line: argsPair && argsPair.line !== undefined ? argsPair.line : null,
        col: argsPair && argsPair.col !== undefined ? argsPair.col : null
      };
      const pathObj = ctx.checkType(ctx.nextArg(argState), FE_TYPE.STRING);
      const rawPath = pathObj.cdr;
      const targetPath =
        rawPath.startsWith("root/") || rawPath.startsWith("/cgi-bin/")
          ? rawPath
          : normalizeRootPath(rawPath);

      const source = await this.readRootFile(targetPath);

      const savedNextChr = ctx.nextchr;
      const savedNextLine = ctx.nextline;
      const savedNextCol = ctx.nextcol;

      ctx._resetLookahead();
      const stream = new StringStream(source);
      let result = ctx.nil;
      try {
        let expr;
        while ((expr = ctx.read(stream)) !== null) {
          result = await ctx.eval(expr);
        }
      } finally {
        ctx.nextchr = savedNextChr;
        ctx.nextline = savedNextLine;
        ctx.nextcol = savedNextCol;
      }
      return result;
    });

    await this.ctx.evalString("(= os-doc (mac args nil))");
    await this.ctx.evalString("(= os-def-app (mac (app-id . props) (list (quote os-def-app-raw) app-id (list (quote quote) props))))");
    const bootExpr = '(load "root/auto.fe")';
    this._recordProc("boot", bootExpr);
    const res = await this.ctx.evalString(bootExpr);
    await this.listRootFiles();
    this.ui.onAppsUpdated(Array.from(this.apps.values()));
    return res;
  }

  async evalCode(source, label = "eval") {
    this._recordProc(label, source.slice(0, 120));
    const result = await this.ctx.evalString(source);
    this.ui.onAppsUpdated(Array.from(this.apps.values()));
    return result;
  }

  _installKernelPrimitives() {
    const ctx = this.ctx;

    ctx.defineRaw("os-doc", async (c, argsPair) => {
      const props = this.plistToMap(argsPair);
      return this.toFeList([
        c.symbol("os-doc"),
        c.string(String(props.get("title") || "")),
        c.string(String(props.get("kind") || ""))
      ]);
    });

    ctx.defineRaw("os-philosophy", async (c) => {
      return this.toFeList([c.symbol("philosophy"), c.string("all is a list"), c.string("sweetie-16")]);
    });

    ctx.defineRaw("os-now", async (c) => {
      return c.number(Date.now());
    });

    ctx.defineRaw("os-log", async (c, argsPair) => {
      const items = c.toArray(argsPair);
      const formatted = items.length === 1 && Array.isArray(items[0])
        ? `(${items[0].map((x) => String(x)).join(" ")})`
        : c.toString(argsPair, true);
      this.ui.onKernelPrint(`[os-log] ${formatted}`);
      return argsPair;
    });

    ctx.defineRaw("os-sexp->str", async (c, argsPair) => {
      const argState = { list: argsPair };
      const obj = c.nextArg(argState);
      return c.string(c.toString(obj, true));
    });

    ctx.defineRaw("os-str->sexp", async (c, argsPair) => {
      const argState = { list: argsPair };
      const strObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      const exprs = this.parseAllSexp(strObj.cdr);
      return exprs.length > 0 ? exprs[0] : c.nil;
    });

    ctx.defineRaw("os-eval-sexp", async (c, argsPair) => {
      const argState = { list: argsPair };
      const strObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      return await this.evalCode(strObj.cdr, "os-eval-sexp");
    });

    ctx.defineRaw("os-state-list", async (c) => {
      const snap = this.parseAllSexp(this.buildOsSnapshotSexp());
      return snap.length > 0 ? snap[0] : c.nil;
    });

    ctx.defineRaw("os-procs-list", async (c) => {
      return this.toFeList(
        this.procs.map((p) => this.toFeList([c.symbol("proc"), c.number(p.pid), c.string(p.name), c.string(p.expr)]))
      );
    });

    ctx.defineRaw("os-root-list", async (c) => {
      const entries = this.rootFiles.map((f) =>
        this.toFeList([c.symbol("file"), c.string(`root/${f.name}`), c.number(Number(f.size || 0))])
      );
      return this.toFeList([c.symbol("root"), ...entries]);
    });

    ctx.defineRaw("os-read-file", async (c, argsPair) => {
      const argState = { list: argsPair };
      const nameObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      const content = await this.readRootFile(nameObj.cdr);
      return c.string(content);
    });

    ctx.defineRaw("os-read-sexp", async (c, argsPair) => {
      const argState = { list: argsPair };
      const nameObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      const content = await this.readRootFile(nameObj.cdr);
      const exprs = this.parseAllSexp(content);
      return exprs.length > 0 ? exprs[exprs.length - 1] : c.nil;
    });

    ctx.defineRaw("os-write-file", async (c, argsPair) => {
      const argState = { list: argsPair };
      const nameObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      const dataObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      await this.writeRootFile(nameObj.cdr, dataObj.cdr);
      return c.t;
    });

    ctx.defineRaw("os-def-app-raw", async (c, argsPair) => {
      const argState = { list: argsPair };
      const idObj = c.nextArg(argState);
      const plistObj = !c.isNil(argState.list) ? c.nextArg(argState) : c.nil;
      const appId = idObj.type === FE_TYPE.SYMBOL ? idObj.cdr.car.cdr : String(c.toJS(idObj));
      const props = this.plistToMap(plistObj);

      let renderFnObj = null;
      let curEntry = plistObj;
      while (curEntry && !c.isNil(curEntry) && curEntry.type === FE_TYPE.PAIR) {
        const pair = curEntry.car;
        if (pair && pair.type === FE_TYPE.PAIR && pair.car && pair.car.type === FE_TYPE.SYMBOL && pair.car.cdr.car.cdr === "render") {
          const valObj = pair.cdr && pair.cdr.type === FE_TYPE.PAIR ? pair.cdr.car : c.nil;
          if (!c.isNil(valObj)) {
            renderFnObj = await c.eval(valObj);
          }
          break;
        }
        curEntry = curEntry.cdr;
      }

      const appSpec = {
        id: appId,
        title: String(props.get("title") || appId),
        icon: String(props.get("icon") || "FE"),
        width: Number(props.get("width") || 420),
        height: Number(props.get("height") || 320),
        renderFn: renderFnObj
      };

      this.apps.set(appId, appSpec);
      this.ui.onAppsUpdated(Array.from(this.apps.values()));
      return this.toFeList([c.symbol("app"), c.symbol(appId), c.string(appSpec.title)]);
    });

    ctx.defineRaw("os-open-app", async (c, argsPair) => {
      const argState = { list: argsPair };
      const idObj = c.nextArg(argState);
      const appId = idObj.type === FE_TYPE.SYMBOL ? idObj.cdr.car.cdr : String(c.toJS(idObj));
      const app = this.apps.get(appId);
      if (!app) {
        c.error(`unknown OS app: ${appId}`);
      }
      const winId = this.ui.createWindow({
        title: app.title,
        width: app.width,
        height: app.height,
        appId: app.id
      });
      if (app.renderFn && app.renderFn.type === FE_TYPE.FUNC) {
        const callExpr = c.cons(app.renderFn, c.cons(c.string(winId), c.nil));
        await c.eval(callExpr);
      }
      return c.string(winId);
    });

    ctx.defineRaw("os-win-clear", async (c, argsPair) => {
      const argState = { list: argsPair };
      const winId = String(c.toJS(c.nextArg(argState)));
      this.ui.clearWindowBody(winId);
      return c.t;
    });

    ctx.defineRaw("os-win-add-text", async (c, argsPair) => {
      const argState = { list: argsPair };
      const winId = String(c.toJS(c.nextArg(argState)));
      const text = String(c.toJS(c.nextArg(argState)));
      const color = !c.isNil(argState.list) ? resolveSweetieColor(String(c.toJS(c.nextArg(argState)))) : SWEETIE_16.marshmallow;
      this.ui.addWindowText(winId, text, color);
      return c.t;
    });

    ctx.defineRaw("os-win-add-input", async (c, argsPair) => {
      const argState = { list: argsPair };
      const winId = String(c.toJS(c.nextArg(argState)));
      const placeholder = !c.isNil(argState.list) ? String(c.toJS(c.nextArg(argState))) : "";
      const el = this.ui.addWindowInput(winId, placeholder);
      return c.ptr(el);
    });

    ctx.defineRaw("os-win-add-textarea", async (c, argsPair) => {
      const argState = { list: argsPair };
      const winId = String(c.toJS(c.nextArg(argState)));
      const placeholder = !c.isNil(argState.list) ? String(c.toJS(c.nextArg(argState))) : "";
      const el = this.ui.addWindowTextarea(winId, placeholder);
      return c.ptr(el);
    });

    ctx.defineRaw("os-win-add-log", async (c, argsPair) => {
      const argState = { list: argsPair };
      const winId = String(c.toJS(c.nextArg(argState)));
      const el = this.ui.addWindowLog(winId);
      return c.ptr(el);
    });

    ctx.defineRaw("os-set-log", async (c, argsPair) => {
      const argState = { list: argsPair };
      const el = c.toPtr(c.nextArg(argState));
      const valObj = c.nextArg(argState);
      const color = !c.isNil(argState.list) ? resolveSweetieColor(String(c.toJS(c.nextArg(argState)))) : SWEETIE_16.frosting;
      const text = valObj.type === FE_TYPE.STRING ? valObj.cdr : c.toString(valObj, true);
      if (el) {
        el.textContent = text;
        el.style.color = color;
      }
      return c.t;
    });

    ctx.defineRaw("os-append-log", async (c, argsPair) => {
      const argState = { list: argsPair };
      const el = c.toPtr(c.nextArg(argState));
      const valObj = c.nextArg(argState);
      const color = !c.isNil(argState.list) ? resolveSweetieColor(String(c.toJS(c.nextArg(argState)))) : SWEETIE_16.pistachio;
      const text = valObj.type === FE_TYPE.STRING ? valObj.cdr : c.toString(valObj, true);
      if (el) {
        const line = document.createElement("div");
        line.textContent = text;
        line.style.color = color;
        el.appendChild(line);
        el.scrollTop = el.scrollHeight;
      }
      return c.t;
    });

    ctx.defineRaw("os-get-value", async (c, argsPair) => {
      const argState = { list: argsPair };
      const el = c.toPtr(c.nextArg(argState));
      return c.string(el && typeof el.value === "string" ? el.value : "");
    });

    ctx.defineRaw("os-win-add-button", async (c, argsPair) => {
      const argState = { list: argsPair };
      const winId = String(c.toJS(c.nextArg(argState)));
      const label = String(c.toJS(c.nextArg(argState)));
      const fnObj = c.nextArg(argState);
      this.ui.addWindowButton(winId, label, async () => {
        if (fnObj && (fnObj.type === FE_TYPE.FUNC || fnObj.type === FE_TYPE.CFUNC)) {
          try {
            await c.eval(c.cons(fnObj, c.nil));
          } catch (err) {
            this.ui.onKernelError(err);
          }
        }
      });
      return c.t;
    });

    ctx.defineRaw("os-win-add-swatches", async (c, argsPair) => {
      const argState = { list: argsPair };
      const winId = String(c.toJS(c.nextArg(argState)));
      this.ui.addWindowSwatches(winId);
      return c.t;
    });

    ctx.defineRaw("os-canvas-clear", async (c) => {
      this.canvasOps = [];
      this.ui.clearCanvas();
      return c.t;
    });

    ctx.defineRaw("os-canvas-rect", async (c, argsPair) => {
      const argState = { list: argsPair };
      const x = c.toNumber(c.nextArg(argState));
      const y = c.toNumber(c.nextArg(argState));
      const w = c.toNumber(c.nextArg(argState));
      const h = c.toNumber(c.nextArg(argState));
      const fill = !c.isNil(argState.list) ? resolveSweetieColor(String(c.toJS(c.nextArg(argState))), SWEETIE_16.blueberry) : SWEETIE_16.blueberry;
      const stroke = !c.isNil(argState.list) ? resolveSweetieColor(String(c.toJS(c.nextArg(argState))), SWEETIE_16.frosting) : SWEETIE_16.frosting;
      this.canvasOps.push(["rect", x, y, w, h, fill, stroke]);
      this.ui.drawRect(x, y, w, h, fill, stroke);
      return c.t;
    });

    ctx.defineRaw("os-canvas-line", async (c, argsPair) => {
      const argState = { list: argsPair };
      const x1 = c.toNumber(c.nextArg(argState));
      const y1 = c.toNumber(c.nextArg(argState));
      const x2 = c.toNumber(c.nextArg(argState));
      const y2 = c.toNumber(c.nextArg(argState));
      const color = !c.isNil(argState.list) ? resolveSweetieColor(String(c.toJS(c.nextArg(argState))), SWEETIE_16.pistachio) : SWEETIE_16.pistachio;
      const width = !c.isNil(argState.list) ? c.toNumber(c.nextArg(argState)) : 2;
      this.canvasOps.push(["line", x1, y1, x2, y2, color, width]);
      this.ui.drawLine(x1, y1, x2, y2, color, width);
      return c.t;
    });

    ctx.defineRaw("os-canvas-text", async (c, argsPair) => {
      const argState = { list: argsPair };
      const x = c.toNumber(c.nextArg(argState));
      const y = c.toNumber(c.nextArg(argState));
      const text = String(c.toJS(c.nextArg(argState)));
      const color = !c.isNil(argState.list) ? resolveSweetieColor(String(c.toJS(c.nextArg(argState))), SWEETIE_16.marshmallow) : SWEETIE_16.marshmallow;
      this.canvasOps.push(["text", x, y, text, color]);
      this.ui.drawText(x, y, text, color);
      return c.t;
    });
  }
}
