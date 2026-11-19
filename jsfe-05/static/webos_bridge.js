/**
 * ============================================================================
 * webos_bridge.js — Host Adapter & Immediate-Mode Renderer for fe WebOS
 * Connects FeContext (fe.js) to:
 *   1. imgui.fe immediate-mode S-expr UI tree -> DOM / DOS EDIT.COM canvas
 *   2. fs.fe S-expr filesystem -> Bottle 0.12 + SQLite3 REST API
 *   3. edit.fe MVC model/view/controller
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

  toJSValue(obj) {
    return this.ctx.toJS(obj);
  }
}

class SqliteSExprRepository {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
    this.cache = new Map();
  }

  syncRequest(method, url, bodyObj = null) {
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
    return null;
  }

  listSExpr() {
    const res = this.syncRequest("GET", "/api/fs?format=json");
    if (res && res.ok && Array.isArray(res.nodes)) {
      this.cache.clear();
      const feNodes = [];
      for (const n of res.nodes) {
        this.cache.set(n.path, n);
        feNodes.push(["fs-node", ["path", n.path], ["kind", n.kind], ["content", n.sexpr_content], ["meta", n.sexpr_meta]]);
      }
      return feNodes;
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

  renderTree(treeObj) {
    const tree = this.ctx.toJS(treeObj);
    this.lastTree = tree;
    const mount = document.getElementById("webos-imgui-mount");
    if (!mount) return treeObj;

    mount.innerHTML = "";
    const shell = document.createElement("div");
    shell.className = "h-full flex flex-col bg-[#1b263b] text-[#e0e1dd] font-mono text-xs border border-[#415a77] rounded-lg overflow-hidden select-none";

    const win = Array.isArray(tree) && Array.isArray(tree[1]) ? tree[1] : ["window", "MS-DOS EDIT", 1024, 640];
    const widgets = Array.isArray(tree) && Array.isArray(tree[2]) ? tree[2] : [];

    const titleBar = document.createElement("div");
    titleBar.className = "bg-[#0d1b2a] text-[#778da9] px-3 py-1.5 flex items-center justify-between border-b border-[#415a77]";
    titleBar.innerHTML = `<span class="font-bold text-white">${this._esc(win[1] || "WebOS")}</span><span>S-EXPR IMMEDIATE MODE</span>`;
    shell.appendChild(titleBar);

    const body = document.createElement("div");
    body.className = "flex-1 flex flex-col overflow-hidden p-2 gap-2";

    const sidebar = document.createElement("div");
    sidebar.className = "w-full md:w-64 shrink-0 bg-[#0d1b2a]/80 border border-[#415a77]/70 rounded p-2 flex flex-col gap-1.5 overflow-y-auto";

    const editorCol = document.createElement("div");
    editorCol.className = "flex-1 flex flex-col bg-[#0d1b2a] border border-[#415a77]/70 rounded p-2 gap-2 overflow-hidden";

    const mainRow = document.createElement("div");
    mainRow.className = "flex-1 flex flex-col md:flex-row gap-2 overflow-hidden";

    let statusLeft = "Ready";
    let statusRight = "Ln:1 Col:0";

    for (const w of widgets) {
      if (!Array.isArray(w)) continue;
      const kind = w[0];
      const wtype = w[1];

      if (kind === "widget" && wtype === "label") {
        const id = w[2];
        const text = String(w[3] ?? "");
        if (id === "dos-menubar") {
          const bar = document.createElement("div");
          bar.className = "bg-[#e0e1dd] text-[#0d1b2a] font-bold px-2.5 py-1 rounded text-xs flex justify-between";
          bar.textContent = text;
          body.appendChild(bar);
        } else if (id === "dos-files-hdr") {
          const hdr = document.createElement("div");
          hdr.className = "text-[11px] font-bold text-amber-300 border-b border-[#415a77]/60 pb-1";
          hdr.textContent = text;
          sidebar.appendChild(hdr);
        } else {
          const lbl = document.createElement("div");
          lbl.className = "text-sky-300 font-semibold text-xs";
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
              btn.className = "text-left px-2 py-1 rounded hover:bg-[#415a77]/40 text-emerald-300 truncate cursor-pointer";
              btn.textContent = `📄 ${nodePath}`;
              btn.onclick = () => {
                if (onSelectSym) {
                  this.ctx.evalString(`(${onSelectSym} "${nodePath.replace(/"/g, '\\"')}")`);
                  this.ctx.evalString("(edit/render)");
                }
              };
              sidebar.appendChild(btn);
            }
          }
        }
      } else if (kind === "widget" && wtype === "button") {
        const label = String(w[3] ?? "Button");
        const actionFn = w[6];
        const btn = document.createElement("button");
        btn.className = "px-2.5 py-1 rounded bg-[#415a77]/50 hover:bg-[#415a77] text-white text-xs font-semibold text-left transition cursor-pointer";
        btn.textContent = label;
        btn.onclick = () => {
          if (typeof actionFn === "function") {
            actionFn(this.ctx);
            this.ctx.evalString("(edit/render)");
          } else if (typeof actionFn === "string") {
            this.ctx.evalString(`(${actionFn})`);
            this.ctx.evalString("(edit/render)");
          }
        };
        sidebar.appendChild(btn);
      } else if (kind === "widget" && wtype === "textarea") {
        const content = String(w[3] ?? "");
        const onChangeSym = w[7];
        const ta = document.createElement("textarea");
        ta.className = "flex-1 w-full bg-[#071019] text-[#72efdd] p-3 rounded border border-[#415a77] font-mono text-xs leading-relaxed resize-none focus:outline-none focus:border-amber-300";
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

    mainRow.appendChild(sidebar);
    mainRow.appendChild(editorCol);
    body.appendChild(mainRow);

    const statusBar = document.createElement("div");
    statusBar.className = "bg-[#e0e1dd] text-[#0d1b2a] px-2.5 py-1 rounded text-[11px] font-bold flex items-center justify-between";
    statusBar.innerHTML = `<span>${this._esc(statusLeft)}</span><span>${this._esc(statusRight)}</span>`;
    body.appendChild(statusBar);

    shell.appendChild(body);
    mount.appendChild(shell);
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
  registerWebOSHostBindings(fe);
  const filesToLoad = ["/fe_src/imgui.fe", "/fe_src/fs.fe", "/fe_src/edit.fe", "/fe_src/webos.fe"];
  for (const url of filesToLoad) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      fe.evalString(xhr.responseText);
    }
  }
  fe.evalString("(webos/boot)");

  window.addEventListener("keydown", (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      fe.evalString("(edit/cmd-save) (edit/render)");
    } else if (e.key === "F5") {
      e.preventDefault();
      fe.evalString("(edit/cmd-run) (edit/render)");
    } else if (e.key === "F4") {
      e.preventDefault();
      fe.evalString('(edit/cmd-new "/new.fe") (edit/render)');
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(bootWebOS, 50);
});
