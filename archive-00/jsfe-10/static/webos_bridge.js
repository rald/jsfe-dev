/**
 * ============================================================================
 * webos_bridge.js — Host Adapter & Immediate-Mode Renderer for fe WebOS
 * ============================================================================
 */

class SExprBridge {
  constructor(ctx) {
    this.ctx = ctx;
  }

  encode(val) {
    if (val === null || val === undefined || val === false) return "nil";
    if (val === true) return "t";
    if (typeof val === "number") return String(val);
    if (typeof val === "string") {
      return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
    }
    if (Array.isArray(val)) {
      return "(" + val.map((x) => this.encode(x)).join(" ") + ")";
    }
    if (val && typeof val === "object" && val.type !== undefined) {
      return this.ctx.toString(val, true);
    }
    return `"${String(val)}"`;
  }
}

class SqliteSExprRepository {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
    this.cache = new Map();
  }

  syncRequest(method, url, bodyObj = null) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(method, this.baseUrl + url, false);
      if (bodyObj !== null) {
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify(bodyObj));
      } else {
        xhr.send(null);
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        return JSON.parse(xhr.responseText);
      }
    } catch (_) {}
    return null;
  }

  listSExpr() {
    const res = this.syncRequest("GET", "/api/fs?format=json");
    if (res && res.ok && Array.isArray(res.nodes)) {
      this.cache.clear();
      return res.nodes.map((n) => {
        this.cache.set(n.path, n);
        return ["fs-node", ["path", n.path], ["kind", n.kind], ["content", n.sexpr_content], ["meta", n.sexpr_meta]];
      });
    }
    return Array.from(this.cache.values()).map((n) => [
      "fs-node",
      ["path", n.path],
      ["kind", n.kind],
      ["content", n.sexpr_content],
      ["meta", n.sexpr_meta],
    ]);
  }

  saveNode(path, kind, sexprContent) {
    const norm = path.startsWith("/") ? path : "/" + path;
    const res = this.syncRequest("POST", "/api/fs/save", {
      path: norm,
      kind: kind || "file",
      content: sexprContent,
      meta: "(sexpr sqlite3)",
    });
    if (res && res.ok && res.node) {
      this.cache.set(res.node.path, res.node);
      return ["fs-node", ["path", res.node.path], ["kind", res.node.kind], ["content", res.node.sexpr_content]];
    }
    const fallback = { path: norm, kind: kind || "file", sexpr_content: sexprContent };
    this.cache.set(norm, fallback);
    return ["fs-node", ["path", norm], ["kind", kind || "file"], ["content", sexprContent]];
  }

  loadNode(path) {
    const norm = path.startsWith("/") ? path : "/" + path;
    const res = this.syncRequest("GET", `/api/fs/node?path=${encodeURIComponent(norm)}`);
    if (res && res.ok && res.node) {
      this.cache.set(res.node.path, res.node);
      return ["fs-node", ["path", res.node.path], ["kind", res.node.kind], ["content", res.node.sexpr_content]];
    }
    const local = this.cache.get(norm);
    if (local) {
      return ["fs-node", ["path", local.path], ["kind", local.kind], ["content", local.sexpr_content]];
    }
    return null;
  }

  deleteNode(path) {
    const norm = path.startsWith("/") ? path : "/" + path;
    this.syncRequest("POST", "/api/fs/delete", { path: norm });
    this.cache.delete(norm);
    return true;
  }
}

class ImmediateGuiRenderer {
  constructor(ctx, repo) {
    this.ctx = ctx;
    this.repo = repo;
    this.lastTree = null;
  }

  _invokeAction(actionVal) {
    if (!actionVal) return;
    if (typeof actionVal === "function") {
      actionVal(this.ctx);
    } else if (actionVal && actionVal.type === FE_TYPE.SYMBOL) {
      const symName = this.ctx.toString(actionVal, false);
      this.ctx.evalString(`(${symName})`);
    } else if (typeof actionVal === "string") {
      this.ctx.evalString(`(${actionVal})`);
    }
  }

  _nth(lst, idx) {
    let cur = lst;
    let i = 0;
    while (!this.ctx.isNil(cur) && cur.type === FE_TYPE.PAIR) {
      if (i === idx) return this.ctx.car(cur);
      cur = this.ctx.cdr(cur);
      i++;
    }
    return this.ctx.nil;
  }

  _extractTreeParts(treeObj) {
    const rawWin = this._nth(treeObj, 1);
    const rawWidgets = this._nth(treeObj, 2);
    const win = this.ctx.toJS(rawWin);
    const widgets = [];
    let cur = rawWidgets;
    while (!this.ctx.isNil(cur) && cur.type === FE_TYPE.PAIR) {
      const item = this.ctx.car(cur);
      const jsItem = this.ctx.toJS(item);
      if (Array.isArray(jsItem) && jsItem[0] === "widget" && jsItem[1] === "icon-launcher") {
        jsItem[6] = this._nth(item, 6);
      }
      if (Array.isArray(jsItem) && jsItem[0] === "layout" && jsItem[1] === "desktop") {
        const rawIconsList = this._nth(item, 3);
        const iconsArr = [];
        let icCur = rawIconsList;
        while (!this.ctx.isNil(icCur) && icCur.type === FE_TYPE.PAIR) {
          const rawIc = this.ctx.car(icCur);
          const jsIc = this.ctx.toJS(rawIc);
          if (Array.isArray(jsIc)) {
            jsIc[6] = this._nth(rawIc, 6);
          }
          iconsArr.push(jsIc);
          icCur = this.ctx.cdr(icCur);
        }
        jsItem[3] = iconsArr;
      }
      widgets.push(jsItem);
      cur = this.ctx.cdr(cur);
    }
    return { win, widgets };
  }

  renderTree(treeObj) {
    document.documentElement.classList.add("dark");
    const { win, widgets } = this._extractTreeParts(treeObj);
    this.lastTree = { win, widgets };
    const mount = document.getElementById("webos-imgui-mount");
    if (!mount) return treeObj;

    mount.innerHTML = "";

    const desktopLayout = widgets.find((w) => Array.isArray(w) && w[0] === "layout" && w[1] === "desktop");
    if (desktopLayout) {
      const desktopEl = document.createElement("div");
      desktopEl.style.cssText = "height:100%;width:100%;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column;justify-content:space-between;";

      const topBar = document.createElement("div");
      topBar.style.cssText = "background:#161b22;border-bottom:1px solid #30363d;padding:8px 14px;font-size:12px;display:flex;justify-content:space-between;align-items:center;";
      topBar.innerHTML = `<strong style="color:#58a6ff;">${this._esc(Array.isArray(win) ? win[1] : "fe WebOS Desktop")}</strong><span style="color:#8b949e;">DARK MODE · S-EXPR IMGUI</span>`;
      desktopEl.appendChild(topBar);

      const iconGrid = document.createElement("div");
      iconGrid.style.cssText = "flex:1;padding:24px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:20px;";

      const icons = Array.isArray(desktopLayout[3]) ? desktopLayout[3] : [];
      for (const ic of icons) {
        if (Array.isArray(ic) && ic[0] === "widget" && ic[1] === "icon-launcher") {
          const svgMarkup = String(ic[3] ?? "");
          const title = String(ic[4] ?? "edit.fe");
          const onLaunch = ic[6];

          const btn = document.createElement("button");
          btn.id = String(ic[2] || "launch-edit-fe");
          btn.style.cssText = "width:104px;padding:14px 8px;background:#161b22;border:1px solid #30363d;border-radius:8px;color:#ffffff;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;font-family:inherit;";
          btn.onmouseenter = () => { btn.style.borderColor = "#58a6ff"; btn.style.background = "#1f2630"; };
          btn.onmouseleave = () => { btn.style.borderColor = "#30363d"; btn.style.background = "#161b22"; };
          btn.onclick = () => this._invokeAction(onLaunch);

          const iconBox = document.createElement("div");
          iconBox.style.cssText = "width:48px;height:48px;border-radius:8px;background:#1f6feb;color:#ffffff;display:flex;align-items:center;justify-content:center;";
          iconBox.innerHTML = svgMarkup;

          const labelEl = document.createElement("span");
          labelEl.style.cssText = "font-size:12px;color:#e6edf3;word-break:break-all;";
          labelEl.textContent = title;

          btn.append(iconBox, labelEl);
          iconGrid.appendChild(btn);
        }
      }

      desktopEl.appendChild(iconGrid);
      mount.appendChild(desktopEl);
      return treeObj;
    }

    const shell = document.createElement("div");
    shell.style.cssText = "height:100%;width:100%;display:flex;flex-direction:column;background:#0d1117;color:#e6edf3;font-size:12px;";

    const titleBar = document.createElement("div");
    titleBar.style.cssText = "background:#161b22;border-bottom:1px solid #30363d;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;";
    titleBar.innerHTML = `<strong style="color:#58a6ff;">${this._esc(Array.isArray(win) ? win[1] : "MS-DOS EDIT")}</strong><button id="webos-back-desktop" style="background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:3px 8px;cursor:pointer;font-family:inherit;font-size:11px;">Desktop</button>`;
    shell.appendChild(titleBar);

    const body = document.createElement("div");
    body.style.cssText = "flex:1;display:flex;flex-direction:column;padding:10px;gap:8px;overflow:hidden;";

    const mainRow = document.createElement("div");
    mainRow.style.cssText = "flex:1;display:flex;gap:10px;overflow:hidden;";

    const sidebar = document.createElement("div");
    sidebar.style.cssText = "width:220px;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:6px;overflow-y:auto;";

    const editorCol = document.createElement("div");
    editorCol.style.cssText = "flex:1;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:8px;overflow:hidden;";

    let statusLeft = "Ready";
    let statusRight = "Line:1 Col:0";

    for (const w of widgets) {
      if (!Array.isArray(w)) continue;
      const kind = w[0];
      const wtype = w[1];

      if (kind === "widget" && wtype === "label") {
        const id = w[2];
        const text = String(w[3] ?? "");
        if (id === "dos-menubar") {
          const bar = document.createElement("div");
          bar.style.cssText = "background:#21262d;color:#e6edf3;border:1px solid #30363d;padding:5px 10px;border-radius:4px;font-weight:600;";
          bar.textContent = text;
          body.appendChild(bar);
        } else if (id === "dos-files-hdr") {
          const hdr = document.createElement("div");
          hdr.style.cssText = "font-size:11px;font-weight:700;color:#ffa657;border-bottom:1px solid #30363d;padding-bottom:4px;";
          hdr.textContent = text;
          sidebar.appendChild(hdr);
        } else {
          const lbl = document.createElement("div");
          lbl.style.cssText = "color:#58a6ff;font-weight:600;";
          lbl.textContent = text;
          editorCol.appendChild(lbl);
        }
      } else if (kind === "widget" && wtype === "list-box") {
        const items = Array.isArray(w[3]) ? w[3] : [];
        const onSelectSym = w[5];
        for (const item of items) {
          if (Array.isArray(item) && item[0] === "fs-node") {
            const pPair = item.find((x) => Array.isArray(x) && x[0] === "path");
            const kPair = item.find((x) => Array.isArray(x) && x[0] === "kind");
            const nodePath = pPair ? pPair[1] : "/";
            const nodeKind = kPair ? kPair[1] : "file";
            if (nodeKind === "file") {
              const btn = document.createElement("button");
              btn.style.cssText = "text-align:left;padding:5px 8px;border-radius:4px;background:transparent;border:none;color:#3fb950;cursor:pointer;font-family:inherit;font-size:12px;";
              btn.textContent = nodePath;
              btn.onclick = () => {
                if (onSelectSym) {
                  this.ctx.evalString(`(${onSelectSym} "${nodePath.replace(/"/g, '\\"')}") (edit/render)`);
                }
              };
              sidebar.appendChild(btn);
            }
          }
        }
      } else if (kind === "widget" && wtype === "button") {
        const label = String(w[3] ?? "Button");
        const actionFn = w[4];
        const btn = document.createElement("button");
        btn.style.cssText = "padding:6px 10px;border-radius:4px;background:#21262d;border:1px solid #30363d;color:#e6edf3;font-size:12px;text-align:left;cursor:pointer;font-family:inherit;";
        btn.textContent = label;
        btn.onclick = () => {
          this._invokeAction(actionFn);
          this.ctx.evalString("(edit/render)");
        };
        sidebar.appendChild(btn);
      } else if (kind === "widget" && wtype === "textarea") {
        const content = String(w[3] ?? "");
        const onChangeSym = w[7];
        const ta = document.createElement("textarea");
        ta.style.cssText = "flex:1;width:100%;background:#090d12;color:#79c0ff;padding:10px;border-radius:4px;border:1px solid #30363d;font-family:inherit;font-size:12px;line-height:1.5;resize:none;outline:none;box-sizing:border-box;";
        ta.value = content;
        ta.spellcheck = false;
        ta.oninput = () => {
          if (onChangeSym) {
            const escaped = ta.value
              .replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"')
              .replace(/\n/g, "\\n");
            this.ctx.evalString(`(${onChangeSym} "${escaped}")`);
          }
        };
        editorCol.appendChild(ta);
      } else if (kind === "widget" && wtype === "status-bar") {
        statusLeft = String(w[3] ?? "");
        statusRight = String(w[4] ?? "");
      }
    }

    mainRow.append(sidebar, editorCol);
    body.appendChild(mainRow);

    const statusBar = document.createElement("div");
    statusBar.style.cssText = "background:#161b22;color:#8b949e;border:1px solid #30363d;padding:5px 10px;border-radius:4px;font-size:11px;display:flex;justify-content:space-between;";
    statusBar.innerHTML = `<span>${this._esc(statusLeft)}</span><span>${this._esc(statusRight)}</span>`;
    body.appendChild(statusBar);

    shell.appendChild(body);
    mount.appendChild(shell);

    const backBtn = document.getElementById("webos-back-desktop");
    if (backBtn) {
      backBtn.onclick = () => this.ctx.evalString("(webos/render-desktop)");
    }

    return treeObj;
  }

  _esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

function registerWebOSHostBindings(ctx) {
  const bridge = new SExprBridge(ctx);
  const repo = new SqliteSExprRepository("");
  const renderer = new ImmediateGuiRenderer(ctx, repo);

  ctx.define("host/has-renderer", () => true);
  ctx.define("host/render-imgui", (c, tree) => renderer.renderTree(tree));
  ctx.define("host/has-fs-api", () => true);
  ctx.define("host/fs-list-sexpr", () => repo.listSExpr());
  ctx.define("host/fs-save", (c, path, kind, content) => repo.saveNode(path, kind, content));
  ctx.define("host/fs-load", (c, path) => repo.loadNode(path));
  ctx.define("host/fs-delete", (c, path) => repo.deleteNode(path));
  ctx.define("host/now-iso", () => new Date().toISOString());

  ctx.define("host/eval-fe-safe", (c, code) => {
    try {
      return c.evalString(String(code));
    } catch (err) {
      return ["error", String(err.message || err)];
    }
  });

  ctx.define("sexpr/encode", (c, val) => bridge.encode(val));
  ctx.define("read-sexpr", (c, src) => {
    const stream = new StringStream(String(src));
    return c.read(stream);
  });
  ctx.define("type", (c, obj) => FE_TYPENAMES[c.type(obj)] || "unknown");
  ctx.define("str/concat", (c, ...parts) => parts.map((p) => (p === null || p === undefined ? "" : String(p))).join(""));
  ctx.define("str/slice", (c, s, start, end) => String(s).slice(start, end));
  ctx.define("apply", (c, fnObj, argsList) => {
    const arr = c.toArray(argsList);
    const feArgs = arr.map((x) => c.fromJS(x));
    const callForm = c.list([fnObj, ...feArgs]);
    return c.eval(callForm);
  });

  ctx.define("ui/dict-get", (c, alist, key, fallback) => {
    const targetKey = String(key);
    let cur = alist;
    while (!c.isNil(cur)) {
      const entry = c.car(cur);
      if (entry && entry.type === FE_TYPE.PAIR && !c.isNil(entry.car) && !c.isNil(entry.cdr)) {
        const k = entry.car.type === FE_TYPE.SYMBOL ? entry.car.cdr.car.cdr : c.toJS(entry.car);
        if (String(k) === targetKey) {
          return entry.cdr.type === FE_TYPE.PAIR ? c.car(entry.cdr) : entry.cdr;
        }
      }
      cur = c.cdr(cur);
    }
    return fallback !== undefined ? c.fromJS(fallback) : c.nil;
  });

  ctx.define("ui/dict-set", (c, alist, key, val) => {
    const targetKey = String(key);
    const feVal = c.fromJS(val);
    const newEntry = c.list([c.symbol(targetKey), feVal]);
    const items = [];
    let replaced = false;
    let cur = alist;
    while (!c.isNil(cur)) {
      const entry = c.car(cur);
      if (entry && entry.type === FE_TYPE.PAIR && !c.isNil(entry.car)) {
        const k = entry.car.type === FE_TYPE.SYMBOL ? entry.car.cdr.car.cdr : c.toJS(entry.car);
        if (String(k) === targetKey) {
          items.push(newEntry);
          replaced = true;
        } else {
          items.push(entry);
        }
      } else {
        items.push(entry);
      }
      cur = c.cdr(cur);
    }
    if (!replaced) {
      items.push(newEntry);
    }
    return c.list(items);
  });

  ctx.define("ui/append", (c, lst, item) => {
    const arr = c.isNil(lst) ? [] : (() => {
      const out = [];
      let cur = lst;
      while (!c.isNil(cur)) {
        out.push(c.car(cur));
        cur = c.cdr(cur);
      }
      return out;
    })();
    arr.push(c.fromJS(item));
    return c.list(arr);
  });
}


const EMBEDDED_FE_SOURCES = [
  { name: "/fe_src/imgui.fe", code: `
(= imgui-state (list 'imgui-ctx
  (list 'hot nil)
  (list 'active nil)
  (list 'focus nil)
  (list 'widgets nil)
  (list 'dark-mode 't)
  (list 'theme (list 'theme
    (list 'mode 'dark)
    (list 'bg "#0d1117")
    (list 'panel "#161b22")
    (list 'accent "#58a6ff")
    (list 'text "#e6edf3")
    (list 'border "#30363d")))))

(= imgui/begin-frame (fn (title w h)
  (= imgui-state
    (list 'imgui-ctx
      (list 'hot nil)
      (list 'active (ui/dict-get imgui-state 'active nil))
      (list 'focus (ui/dict-get imgui-state 'focus nil))
      (list 'widgets nil)
      (list 'dark-mode 't)
      (list 'theme (ui/dict-get imgui-state 'theme nil))
      (list 'window (list 'window title w h))))
  (list 'frame-begin title w h)))

(= imgui/set-hot (fn (id)
  (let st imgui-state)
  (let cur-active (ui/dict-get st 'active nil))
  (if (not cur-active)
      (= imgui-state (ui/dict-set st 'hot id)))
  id))

(= imgui/emit (fn (node)
  (let st imgui-state)
  (let ws (ui/dict-get st 'widgets nil))
  (= imgui-state (ui/dict-set st 'widgets (ui/append ws node)))
  node))

(= imgui/label (fn (id text)
  (imgui/emit (list 'widget 'label id text))))

(= imgui/button (fn (id label on-click)
  (imgui/set-hot id)
  (imgui/emit (list 'widget 'button id label on-click))))

(= imgui/icon-launcher (fn (id svg-markup title on-launch)
  (imgui/set-hot id)
  (let is-hot (is (ui/dict-get imgui-state 'hot nil) id))
  (imgui/emit (list 'widget 'icon-launcher id svg-markup title (list 'hot is-hot) on-launch))))

(= imgui/desktop (fn (id icons)
  (imgui/emit (list 'layout 'desktop id icons))))

(= imgui/textarea (fn (id content cursor-line cursor-col on-change)
  (imgui/set-hot id)
  (imgui/emit (list 'widget 'textarea id content cursor-line cursor-col on-change))))

(= imgui/list-box (fn (id items selected-idx on-select)
  (imgui/set-hot id)
  (imgui/emit (list 'widget 'list-box id items selected-idx on-select))))

(= imgui/hsplit (fn (id ratio left-node right-node)
  (imgui/emit (list 'layout 'hsplit id ratio left-node right-node))))

(= imgui/vstack (fn (id children)
  (imgui/emit (list 'layout 'vstack id children))))

(= imgui/status-bar (fn (id left-text right-text)
  (imgui/emit (list 'widget 'status-bar id left-text right-text))))

(= imgui/end-frame (fn ()
  (let st imgui-state)
  (let win (ui/dict-get st 'window (list 'window "fe WebOS" 1024 640)))
  (let ws (ui/dict-get st 'widgets nil))
  (let tree (list 'ui-tree win ws (list 'dark-mode 't)))
  (if (host/has-renderer)
      (host/render-imgui tree))
  tree))
` },
  { name: "/fe_src/fs.fe", code: `
(= fs/-cache nil)

(= fs/normalize-path (fn (p)
  (if (or (not p) (is p "") (is p "/"))
      "/"
      (if (is (str/slice p 0 1) "/")
          p
          (str/concat "/" p)))))

(= fs/make-node (fn (path kind content meta)
  (list 'fs-node
    (list 'path (fs/normalize-path path))
    (list 'kind kind)
    (list 'content content)
    (list 'meta meta))))

(= fs/node-path (fn (n) (ui/dict-get n 'path "/")))
(= fs/node-kind (fn (n) (ui/dict-get n 'kind 'file)))
(= fs/node-content (fn (n) (ui/dict-get n 'content nil)))

(= fs/boot (fn ()
  (let root (fs/make-node "/" 'dir '() (list 'format 'sexpr)))
  (= fs/-cache (list root))
  (if (host/has-fs-api)
      (do
        (let remote (host/fs-list-sexpr))
        (if remote
            (= fs/-cache remote))))
  fs/-cache))

(= fs/write-file (fn (path sexpr-content)
  (let norm (fs/normalize-path path))
  (let serialized
    (if (is (type sexpr-content) 'string)
        sexpr-content
        (sexpr/encode sexpr-content)))
  (let node (fs/make-node norm 'file serialized (list 'format 'sexpr)))
  (= fs/-cache (fs/-upsert-cache node))
  (if (host/has-fs-api)
      (host/fs-save norm 'file serialized))
  node))

(= fs/read-file (fn (path)
  (let norm (fs/normalize-path path))
  (let cached (fs/-find-cache norm))
  (if cached
      (fs/node-content cached)
      (if (host/has-fs-api)
          (do
            (let loaded (host/fs-load norm))
            (if loaded
                (do
                  (= fs/-cache (fs/-upsert-cache loaded))
                  (fs/node-content loaded))
                nil))
          nil))))

(= fs/list-entries (fn ()
  (if (host/has-fs-api)
      (do
        (let synced (host/fs-list-sexpr))
        (if synced
            (= fs/-cache synced))))
  fs/-cache))

(= fs/-upsert-cache (fn (new-node)
  (let target-path (fs/node-path new-node))
  (let out nil)
  (let found nil)
  (let cur fs/-cache)
  (while cur
    (do
      (let item (car cur))
      (if (is (fs/node-path item) target-path)
          (do
            (= out (ui/append out new-node))
            (= found 't))
          (= out (ui/append out item)))
      (= cur (cdr cur))))
  (if (not found)
      (= out (ui/append out new-node)))
  out))

(= fs/-find-cache (fn (target-path)
  (let cur fs/-cache)
  (let result nil)
  (while (and cur (not result))
    (do
      (let item (car cur))
      (if (is (fs/node-path item) target-path)
          (= result item))
      (= cur (cdr cur))))
  result))
` },
  { name: "/fe_src/edit.fe", code: `
(= edit-model (list 'edit-model
  (list 'path "/hello.fe")
  (list 'buffer "(print \"Hello from DOS EDIT.COM on WebOS!\")")
  (list 'dirty nil)
  (list 'cursor-line 1)
  (list 'cursor-col 0)
  (list 'status "F2:Save  F5:Run  F4:New")))

(= edit/get (fn (key default-val)
  (ui/dict-get edit-model key default-val)))

(= edit/set (fn (key val)
  (do
    (= edit-model (ui/dict-set edit-model key val))
    edit-model)))

(= edit/cmd-new (fn (new-path)
  (do
    (let target (if (and new-path (not (is new-path ""))) new-path "/untitled.fe"))
    (edit/set 'path (fs/normalize-path target))
    (edit/set 'buffer "()")
    (edit/set 'dirty nil)
    (edit/set 'status (str/concat "New buffer: " (fs/normalize-path target))))))

(= edit/cmd-open (fn (target-path)
  (do
    (let norm (fs/normalize-path target-path))
    (let content (fs/read-file norm))
    (if content
        (do
          (edit/set 'path norm)
          (edit/set 'buffer content)
          (edit/set 'dirty nil)
          (edit/set 'status (str/concat "Opened: " norm)))
        (edit/set 'status (str/concat "Not found: " norm))))))

(= edit/cmd-save (fn ()
  (do
    (let p (edit/get 'path "/untitled.fe"))
    (let buf (edit/get 'buffer ""))
    (fs/write-file p buf)
    (edit/set 'dirty nil)
    (edit/set 'status (str/concat "Saved [" p "] to SQLite S-Expr store")))))

(= edit/cmd-run (fn ()
  (do
    (let buf (edit/get 'buffer ""))
    (let res (host/eval-fe-safe buf))
    (edit/set 'status (str/concat "RUN => " (sexpr/encode res)))
    res)))

(= edit/cmd-set-buffer (fn (new-buf)
  (do
    (edit/set 'buffer new-buf)
    (edit/set 'dirty 't)
    (edit/set 'status "Modified (*)"))))

(= edit/render (fn ()
  (do
    (imgui/begin-frame "MS-DOS EDIT - WebOS S-Expr Editor" 1024 640)
    (let path (edit/get 'path "/untitled.fe"))
    (let dirty (edit/get 'dirty nil))
    (let buf (edit/get 'buffer ""))
    (let cline (edit/get 'cursor-line 1))
    (let ccol (edit/get 'cursor-col 0))
    (let status (edit/get 'status ""))
    (let files (fs/list-entries))

    (let header-label
      (str/concat (if dirty "* " "  ") path "  |  File  Edit  Search  Run  Options"))

    (let top-bar (imgui/label "dos-menubar" header-label))
    (let sidebar
      (imgui/vstack "dos-sidebar"
        (list
          (imgui/label "dos-files-hdr" "S-EXPR FILES (SQLite)")
          (imgui/list-box "dos-file-list" files 0 'edit/cmd-open)
          (imgui/button "dos-btn-new" "[F4] New" (fn () (edit/cmd-new "/new.fe")))
          (imgui/button "dos-btn-save" "[F2] Save" edit/cmd-save)
          (imgui/button "dos-btn-run" "[F5] Run" edit/cmd-run))))

    (let editor-pane
      (imgui/vstack "dos-editor-col"
        (list
          (imgui/label "dos-file-path" (str/concat "Editing: " path))
          (imgui/textarea "dos-code-area" buf cline ccol 'edit/cmd-set-buffer))))

    (let main-split (imgui/hsplit "dos-main-split" 0.26 sidebar editor-pane))
    (let bottom-bar (imgui/status-bar "dos-statusbar" status (str/concat "Line:" cline " Col:" ccol)))
    (imgui/vstack "dos-root" (list top-bar main-split bottom-bar))
    (imgui/end-frame))))
` },
  { name: "/fe_src/webos.fe", code: `
(= webos-state (list 'webos-state
  (list 'running-app 'desktop)))

(= webos/launch-edit (fn ()
  (do
    (= webos-state (ui/dict-set webos-state 'running-app 'edit))
    (edit/cmd-open "/hello.fe")
    (edit/render))))

(= webos/render-desktop (fn ()
  (do
    (imgui/begin-frame "fe WebOS Desktop" 1024 640)
    (let edit-svg "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"28\" height=\"28\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z\"/></svg>")
    (let edit-icon (imgui/icon-launcher "launch-edit-fe" edit-svg "edit.fe" 'webos/launch-edit))
    (imgui/desktop "webos-desktop" (list edit-icon))
    (imgui/end-frame))))

(= webos/boot (fn ()
  (do
    (fs/boot)
    (if (not (fs/read-file "/hello.fe"))
        (fs/write-file "/hello.fe"
          "(do\n  (print \"Welcome to fe WebOS!\")\n  (list 'os 'fe-lisp 'storage 'sqlite-sexpr))"))
    (webos/render-desktop))))
` }
];

function bootWebOS() {
  document.documentElement.classList.add("dark");
  const ctx = new FeContext({ onPrint: (t) => console.log("[fe]", t) });
  window.fe = ctx;
  registerWebOSHostBindings(ctx);

  for (const mod of EMBEDDED_FE_SOURCES) {
    try {
      ctx.evalString(mod.code);
    } catch (err) {
      console.error("[fe] Failed evaluating", mod.name, err);
      return;
    }
  }
  try {
    ctx.evalString("(webos/boot)");
  } catch (err) {
    console.error("[fe] Failed in (webos/boot)", err);
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      ctx.evalString("(edit/cmd-save) (edit/render)");
    } else if (e.key === "F5") {
      e.preventDefault();
      ctx.evalString("(edit/cmd-run) (edit/render)");
    } else if (e.key === "F4") {
      e.preventDefault();
      ctx.evalString('(edit/cmd-new "/new.fe") (edit/render)');
    }
  });
}

window.addEventListener("DOMContentLoaded", bootWebOS);
