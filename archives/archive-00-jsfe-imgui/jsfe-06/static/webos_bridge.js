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
    } else if (typeof actionVal === "string") {
      this.ctx.evalString(`(${actionVal})`);
    }
  }

  renderTree(treeObj) {
    document.documentElement.classList.add("dark");
    const tree = this.ctx.toJS(treeObj);
    this.lastTree = tree;
    const mount = document.getElementById("webos-imgui-mount");
    if (!mount) return treeObj;

    mount.innerHTML = "";
    const win = Array.isArray(tree) && Array.isArray(tree[1]) ? tree[1] : ["window", "fe WebOS", 1024, 640];
    const widgets = Array.isArray(tree) && Array.isArray(tree[2]) ? tree[2] : [];

    // Check if frame contains desktop layout (only edit.fe launcher icon)
    const desktopLayout = widgets.find((w) => Array.isArray(w) && w[0] === "layout" && w[1] === "desktop");
    if (desktopLayout) {
      const desktopEl = document.createElement("div");
      desktopEl.style.cssText = "height:100%;width:100%;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column;justify-content:space-between;";

      const topBar = document.createElement("div");
      topBar.style.cssText = "background:#161b22;border-bottom:1px solid #30363d;padding:8px 14px;font-size:12px;display:flex;justify-content:space-between;align-items:center;";
      topBar.innerHTML = `<strong style="color:#58a6ff;">${this._esc(win[1] || "fe WebOS Desktop")}</strong><span style="color:#8b949e;">DARK MODE · S-EXPR IMGUI</span>`;
      desktopEl.appendChild(topBar);

      const iconGrid = document.createElement("div");
      iconGrid.style.cssText = "flex:1;padding:24px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:20px;";

      const icons = Array.isArray(desktopLayout[3]) ? desktopLayout[3] : [];
      for (const ic of icons) {
        if (Array.isArray(ic) && ic[0] === "widget" && ic[1] === "icon-launcher") {
          const glyph = String(ic[3] ?? "EDIT");
          const title = String(ic[4] ?? "edit.fe");
          const onLaunch = ic[6];

          const btn = document.createElement("button");
          btn.style.cssText = "width:96px;padding:12px 8px;background:#161b22;border:1px solid #30363d;border-radius:8px;color:#e6edf3;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;font-family:inherit;";
          btn.onmouseenter = () => { btn.style.borderColor = "#58a6ff"; btn.style.background = "#1f2630"; };
          btn.onmouseleave = () => { btn.style.borderColor = "#30363d"; btn.style.background = "#161b22"; };
          btn.onclick = () => this._invokeAction(onLaunch);

          const iconBox = document.createElement("div");
          iconBox.style.cssText = "width:44px;height:44px;border-radius:8px;background:#1f6feb;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;letter-spacing:0.5px;";
          iconBox.textContent = glyph;

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

    // Otherwise render DOS EDIT.COM immediate-mode editor frame
    const shell = document.createElement("div");
    shell.style.cssText = "height:100%;width:100%;display:flex;flex-direction:column;background:#0d1117;color:#e6edf3;font-size:12px;";

    const titleBar = document.createElement("div");
    titleBar.style.cssText = "background:#161b22;border-bottom:1px solid #30363d;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;";
    titleBar.innerHTML = `<strong style="color:#58a6ff;">${this._esc(win[1] || "MS-DOS EDIT")}</strong><button id="webos-back-desktop" style="background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:3px 8px;cursor:pointer;font-family:inherit;font-size:11px;">Desktop</button>`;
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

function bootWebOS() {
  document.documentElement.classList.add("dark");
  const ctx = new FeContext({ onPrint: (t) => console.log("[fe]", t) });
  window.fe = ctx;
  registerWebOSHostBindings(ctx);

  const filesToLoad = ["/fe_src/imgui.fe", "/fe_src/fs.fe", "/fe_src/edit.fe", "/fe_src/webos.fe"];
  for (const url of filesToLoad) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      ctx.evalString(xhr.responseText);
    }
  }
  ctx.evalString("(webos/boot)");

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
