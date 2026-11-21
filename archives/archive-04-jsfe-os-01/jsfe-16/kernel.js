/**
 * ============================================================================
 * kernel.js — jsfe Web OS Kernel & S-Expression List Store
 * Philosophy: "All is a list" — every OS resource, process, window, file,
 * and extension is represented and manipulated as an S-expression list in `fe`.
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

export class JsfeKernel {
  constructor(uiHooks) {
    this.ui = uiHooks;
    this.storageKey = "jsfe_os_sexp_store_v1";
    this.vfsFiles = new Map();
    this.bootFiles = ["auto.fe", "sys.fe", "apps.fe"];
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

  /**
   * Convert a JS array/value into a proper fe PAIR list
   */
  toFeList(items) {
    return this.ctx.list(items.map((x) => (x && x.type !== undefined ? x : this.ctx.fromJS(x))));
  }

  /**
   * Read all top-level S-expressions from source text into a list of fe objects
   */
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

  /**
   * Serialize any fe object cleanly into canonical S-expression text
   */
  formatSexp(obj) {
    return this.ctx.toString(obj, true);
  }

  /**
   * Extract a list-of-pairs property list `((key val) (key2 val2) ...)` from a fe list
   */
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

  /**
   * Register default virtual files in S-expression list format
   */
  _seedDefaultVfs() {
    this.vfsFiles.clear();

    this.vfsFiles.set("auto.fe", `(os-doc
  (title "jsfe Boot Loader")
  (kind system-boot)
  (philosophy "all is a list"))

(print "[boot] auto.fe evaluating system lists...")
(load "sys.fe")
(load "apps.fe")
(os-log (quote (boot-complete (all-is-a-list t) (palette sweetie-16))))
(quote (booted auto.fe))
`);

    this.vfsFiles.set("sys.fe", `(os-doc
  (title "Core List Utilities & OS Helpers")
  (kind system-lib))

(= def (mac (name args . body)
  (list (quote =) name (list (quote fn) args (cons (quote do) body)))))

(def not-eq (a b)
  (not (is a b)))

(def cadr (xs)
  (car (cdr xs)))

(def caddr (xs)
  (car (cdr (cdr xs))))

(def assoc (key alist)
  (if (not alist)
      nil
      (let head (car alist)
        (if (is (car head) key)
            head
            (assoc key (cdr alist))))))

(def map (f xs)
  (if (not xs)
      nil
      (cons (f (car xs)) (map f (cdr xs)))))

(def filter (pred xs)
  (if (not xs)
      nil
      (if (pred (car xs))
          (cons (car xs) (filter pred (cdr xs)))
          (filter pred (cdr xs)))))

(def foldl (f acc xs)
  (if (not xs)
      acc
      (foldl f (f acc (car xs)) (cdr xs))))

(def length (xs)
  (foldl (fn (n _) (+ n 1)) 0 xs))

(def append (a b)
  (if (not a)
      b
      (cons (car a) (append (cdr a) b))))

(def make-note (title body)
  (list (quote note)
    (list (quote title) title)
    (list (quote body) body)
    (list (quote ts) (os-now))))

(print "[sys] core list combinators loaded")
(quote sys-ready)
`);

    this.vfsFiles.set("apps.fe", `(os-doc
  (title "Extensible S-Expression OS Applications")
  (kind app-registry))

;; 1. S-Expression Inspector & Evaluator App
(os-def-app (quote inspector)
  (title "S-Exp Inspector")
  (icon "()")
  (width 470)
  (height 360)
  (render (fn (win-id)
    (os-win-clear win-id)
    (os-win-add-text win-id "=== S-EXPRESSION LIST INSPECTOR ===" "butterscotch")
    (os-win-add-text win-id "Every OS entity is stored & queried as a list." "frosting")
    (let expr-input (os-win-add-input win-id "(os-state-list)")
      (let out-box (os-win-add-log win-id)
        (do
          (os-win-add-button win-id "Eval List" (fn ()
            (let raw (os-get-value expr-input)
              (let res (os-eval-sexp raw)
                (os-append-log out-box (list (quote eval) raw (quote =>) res) "pistachio")))))
          (os-win-add-button win-id "Dump VFS List" (fn ()
            (os-append-log out-box (os-vfs-list) "cottonCandy")))
          (os-win-add-button win-id "Dump Procs List" (fn ()
            (os-append-log out-box (os-procs-list) "peach"))))
        )
      )
    )
  )
)

;; 2. S-Expression Notes App (stores notes as S-exp lists in VFS)
(os-def-app (quote notes)
  (title "List Notes")
  (icon "LN")
  (width 440)
  (height 370)
  (render (fn (win-id)
    (os-win-clear win-id)
    (os-win-add-text win-id "S-Expression Note List (notes.sexp)" "butterscotch")
    (let title-in (os-win-add-input win-id "Note title")
      (let body-in (os-win-add-textarea win-id "Write note content...")
        (let list-box (os-win-add-log win-id)
          (let refresh (fn ()
            (os-set-log list-box (os-read-file "notes.sexp") "frosting"))
            (do
              (os-win-add-button win-id "Save Note List" (fn ()
                (let t (os-get-value title-in)
                  (let b (os-get-value body-in)
                    (let existing (os-read-sexp "notes.sexp")
                      (let new-note (make-note t b)
                        (let updated (if existing
                                         (append existing (list new-note))
                                         (list (quote notes-db) new-note))
                          (do
                            (os-write-file "notes.sexp" (os-sexp->str updated))
                            (refresh)))))))))
              (os-win-add-button win-id "Reload Notes" refresh)
              (refresh))
            )
          )
        )
      )
    )
  )
)

;; 3. Sweetie-16 Palette & Canvas Demo App
(os-def-app (quote sweetie-lab)
  (title "Sweetie-16 Lab")
  (icon "16")
  (width 450)
  (height 380)
  (render (fn (win-id)
    (os-win-clear win-id)
    (os-win-add-text win-id "Sweetie-16 Hardware Palette & Canvas List" "butterscotch")
    (os-win-add-swatches win-id)
    (do
      (os-win-add-button win-id "Paint Sweetie List Art" (fn ()
        (do
          (os-canvas-clear)
          (os-canvas-rect 40 40 160 90 "blueberry" "frosting")
          (os-canvas-rect 90 70 180 110 "plum" "butterscotch")
          (os-canvas-line 40 210 320 210 "pistachio" 3)
          (os-canvas-text 50 105 "ALL IS A LIST // SWEETIE-16" "marshmallow")
          (os-log (quote (canvas-painted sweetie-16-demo))))))
      (os-win-add-button win-id "Clear Canvas" (fn ()
        (os-canvas-clear))))
    )
  )
)

;; 4. Live Extension Builder App (write new fe apps/macros/commands into S-exp lists)
(os-def-app (quote ext-studio)
  (title "OS Extender")
  (icon "EX")
  (width 490)
  (height 390)
  (render (fn (win-id)
    (os-win-clear win-id)
    (os-win-add-text win-id "Extend jsfe Web OS with fe S-Expressions" "butterscotch")
    (let code-area (os-win-add-textarea win-id "(def greet-os (who) (list (quote hello) who (quote from-fe))) (os-def-app (quote hello-app) (title \"Hello Ext\") (icon \"HI\") (width 320) (height 200) (render (fn (wid) (os-win-clear wid) (os-win-add-text wid (os-sexp->str (greet-os \"Desktop\")) \"pistachio\")))) (os-open-app (quote hello-app))")
      (let status-log (os-win-add-log win-id)
        (do
          (os-win-add-button win-id "Evaluate & Extend OS" (fn ()
            (let src (os-get-value code-area)
              (let r (os-eval-sexp src)
                (os-append-log status-log (list (quote extended) r) "pistachio")))))
          (os-win-add-button win-id "Save to user-ext.fe" (fn ()
            (let src (os-get-value code-area)
              (do
                (os-write-file "user-ext.fe" src)
                (os-append-log status-log (quote (saved "user-ext.fe")) "frosting")))))
          )
        )
      )
    )
  )
)

(print "[apps] built-in S-expression apps registered")
(quote apps-ready)
`);

    this.vfsFiles.set("notes.sexp", `(notes-db
  (note
    (title "Welcome to jsfe")
    (body "All state, code, files, and UI definitions in jsfe are S-expression lists.")
    (ts 0)))
`);
  }

  /**
   * Persist entire OS state as an S-expression list in localStorage
   */
  saveStateToStorage() {
    try {
      const sexpSnapshot = this.buildOsSnapshotSexp();
      localStorage.setItem(this.storageKey, sexpSnapshot);
    } catch (_) {
      // Ignore storage quota/sandbox issues
    }
  }

  /**
   * Load OS state from S-expression list in localStorage, or seed defaults
   */
  loadStateFromStorage() {
    this._seedDefaultVfs();
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw && raw.trim().startsWith("(jsfe-os-state")) {
        const parsed = this.parseAllSexp(raw);
        if (parsed.length > 0) {
          const arr = this.ctx.toArray(parsed[0]);
          for (const entry of arr) {
            if (Array.isArray(entry) && entry[0] === "vfs" && Array.isArray(entry[1])) {
              this.vfsFiles.clear();
              for (const fileEntry of entry[1]) {
                if (Array.isArray(fileEntry) && fileEntry[0] === "file" && typeof fileEntry[1] === "string") {
                  this.vfsFiles.set(fileEntry[1], typeof fileEntry[2] === "string" ? fileEntry[2] : "");
                }
              }
            }
          }
        }
      }
    } catch (_) {
      this._seedDefaultVfs();
    }
  }

  resetStorageToDefault() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (_) {}
    this._seedDefaultVfs();
    this.saveStateToStorage();
  }

  /**
   * Build canonical S-expression list representing the whole OS state
   */
  buildOsSnapshotSexp() {
    const fileLists = [];
    for (const [name, content] of this.vfsFiles.entries()) {
      fileLists.push(`(file ${this.ctx.toString(this.ctx.string(name), true)} ${this.ctx.toString(this.ctx.string(content), true)})`);
    }
    const winLists = [];
    for (const [id, win] of this.windows.entries()) {
      winLists.push(`(window (id ${this.ctx.toString(this.ctx.string(id), true)}) (title ${this.ctx.toString(this.ctx.string(win.title), true)}) (x ${win.x}) (y ${win.y}) (w ${win.w}) (h ${win.h}))`);
    }
    const appNames = Array.from(this.apps.keys()).map((k) => k);
    return `(jsfe-os-state
  (philosophy "all is a list")
  (palette "sweetie-16")
  (apps (${appNames.join(" ")}))
  (windows (${winLists.join(" ")}))
  (vfs (${fileLists.join("\n    ")})))`;
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
    this.loadStateFromStorage();

    // Override `load` so it reads from VFS first, then falls back to fetch/fs
    this.ctx.defineRaw("load", async (ctx, argsPair) => {
      const argState = {
        list: argsPair,
        line: argsPair && argsPair.line !== undefined ? argsPair.line : null,
        col: argsPair && argsPair.col !== undefined ? argsPair.col : null
      };
      const pathObj = ctx.checkType(ctx.nextArg(argState), FE_TYPE.STRING);
      const filePath = pathObj.cdr;

      let source;
      if (this.vfsFiles.has(filePath)) {
        source = this.vfsFiles.get(filePath);
      } else if (typeof fetch === "function") {
        const resp = await fetch(filePath);
        if (!resp.ok) {
          ctx.error(`failed to load "${filePath}" (status ${resp.status})`, pathObj.line, pathObj.col);
        }
        source = await resp.text();
      } else {
        ctx.error(`file not found in VFS: "${filePath}"`, pathObj.line, pathObj.col);
      }

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
    const bootExpr = '(load "auto.fe")';
    this._recordProc("boot", bootExpr);
    const res = await this.ctx.evalString(bootExpr);
    this.saveStateToStorage();
    this.ui.onAppsUpdated(Array.from(this.apps.values()));
    this.ui.onVfsUpdated(Array.from(this.vfsFiles.keys()));
    return res;
  }

  async evalCode(source, label = "eval") {
    this._recordProc(label, source.slice(0, 120));
    const result = await this.ctx.evalString(source);
    this.saveStateToStorage();
    this.ui.onAppsUpdated(Array.from(this.apps.values()));
    this.ui.onVfsUpdated(Array.from(this.vfsFiles.keys()));
    return result;
  }

  _installKernelPrimitives() {
    const ctx = this.ctx;

    // Philosophy & metadata lists
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

    // S-expression string <-> list conversion
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

    // State as lists
    ctx.defineRaw("os-state-list", async (c) => {
      const snap = this.parseAllSexp(this.buildOsSnapshotSexp());
      return snap.length > 0 ? snap[0] : c.nil;
    });

    ctx.defineRaw("os-procs-list", async (c) => {
      return this.toFeList(
        this.procs.map((p) => this.toFeList([c.symbol("proc"), c.number(p.pid), c.string(p.name), c.string(p.expr)]))
      );
    });

    ctx.defineRaw("os-vfs-list", async (c) => {
      const entries = [];
      for (const [name, content] of this.vfsFiles.entries()) {
        entries.push(this.toFeList([c.symbol("file"), c.string(name), c.number(content.length)]));
      }
      return this.toFeList([c.symbol("vfs"), ...entries]);
    });

    // Virtual filesystem operations
    ctx.defineRaw("os-read-file", async (c, argsPair) => {
      const argState = { list: argsPair };
      const nameObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      return c.string(this.vfsFiles.get(nameObj.cdr) || "");
    });

    ctx.defineRaw("os-read-sexp", async (c, argsPair) => {
      const argState = { list: argsPair };
      const nameObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      const content = this.vfsFiles.get(nameObj.cdr) || "";
      const exprs = this.parseAllSexp(content);
      return exprs.length > 0 ? exprs[exprs.length - 1] : c.nil;
    });

    ctx.defineRaw("os-write-file", async (c, argsPair) => {
      const argState = { list: argsPair };
      const nameObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      const dataObj = c.checkType(c.nextArg(argState), FE_TYPE.STRING);
      this.vfsFiles.set(nameObj.cdr, dataObj.cdr);
      this.saveStateToStorage();
      this.ui.onVfsUpdated(Array.from(this.vfsFiles.keys()));
      return c.t;
    });

    // Define an extensible OS App from a list form (via os-def-app macro -> os-def-app-raw):
    // (os-def-app 'app-id (title "...") (icon "...") (width 400) (height 300) (render (fn (win-id) ...)))
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

    // Open an app window
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

    // Window DOM builder primitives callable from fe functions
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

    // Sweetie-16 Canvas drawing primitives (also recorded as S-expression list commands)
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
