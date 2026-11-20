/**
 * ============================================================================
 * REPL UI Controller & Event Handlers
 * ============================================================================
 */

// DOM Elements
const replOutputEl = document.getElementById("repl-output");
const replInputEl = document.getElementById("repl-input");
const parenStatusEl = document.getElementById("paren-status");
const jsExtEditorEl = document.getElementById("js-ext-editor");
const extStatusEl = document.getElementById("ext-status");
const toastContainerEl = document.getElementById("toast-container");

// Command History State
const history = [];
let historyIndex = -1;
let draftInput = "";

// Initialize Global fe Context
function createVm() {
  const ctx = new FeContext({
    onPrint: (text) => appendLog("print", text)
  });
  window.fe = ctx;
  return ctx;
}

let fe = createVm();

/* --------------------------------------------------------------------------
 * UI Notifications (Non-blocking Toast)
 * -------------------------------------------------------------------------- */
function showToast(message, type = "info") {
  const colors = {
    info: "bg-terminal-panel border-terminal-accent text-blue-200",
    success: "bg-terminal-panel border-terminal-green text-emerald-200",
    error: "bg-terminal-panel border-terminal-red text-red-200"
  };
  const toast = document.createElement("div");
  toast.className = `pointer-events-auto px-3.5 py-2 rounded-lg border shadow-lg font-sans text-xs flex items-center gap-2 transition-opacity duration-300 ${colors[type] || colors.info}`;
  toast.textContent = message;
  toastContainerEl.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

/* --------------------------------------------------------------------------
 * REPL Output Rendering
 * -------------------------------------------------------------------------- */
function appendLog(kind, text, trace = []) {
  const entry = document.createElement("div");

  if (kind === "input") {
    entry.className = "pt-1 border-t border-white/5";
    const row = document.createElement("div");
    row.className = "flex items-start gap-2 text-gray-100";
    const prompt = document.createElement("span");
    prompt.className = "text-terminal-accent font-bold select-none";
    prompt.textContent = ">";
    const code = document.createElement("pre");
    code.className = "whitespace-pre-wrap break-words font-mono text-gray-100 flex-1";
    code.textContent = text;
    row.append(prompt, code);
    entry.appendChild(row);
  } else if (kind === "result") {
    entry.className = "flex items-start gap-2 pl-4 text-terminal-green";
    const arrow = document.createElement("span");
    arrow.className = "select-none opacity-75";
    arrow.textContent = "=>";
    const val = document.createElement("pre");
    val.className = "whitespace-pre-wrap break-words font-mono flex-1";
    val.textContent = text;
    entry.append(arrow, val);
  } else if (kind === "print") {
    entry.className = "pl-4 text-gray-300 whitespace-pre-wrap break-words";
    entry.textContent = text;
  } else if (kind === "system") {
    entry.className = "p-3 rounded-lg bg-terminal-panel/80 border border-terminal-border text-xs text-terminal-muted whitespace-pre-wrap";
    entry.textContent = text;
  } else if (kind === "error") {
    entry.className = "p-2.5 rounded-lg bg-red-950/30 border border-red-500/30 text-terminal-red text-xs space-y-1";
    const msg = document.createElement("div");
    msg.className = "font-semibold";
    msg.textContent = `error: ${text}`;
    entry.appendChild(msg);

    if (trace && trace.length > 0) {
      const traceBox = document.createElement("div");
      traceBox.className = "pl-2 border-l border-red-500/30 text-red-300/80 space-y-0.5 text-[11px]";
      trace.forEach((frame) => {
        const line = document.createElement("div");
        line.textContent = `=> ${frame}`;
        traceBox.appendChild(line);
      });
      entry.appendChild(traceBox);
    }
  }

  replOutputEl.appendChild(entry);
  replOutputEl.scrollTop = replOutputEl.scrollHeight;
}

/* --------------------------------------------------------------------------
 * Parenthesis Balance Checker (ignoring strings & comments)
 * -------------------------------------------------------------------------- */
function countParenBalance(code) {
  let depth = 0;
  let inString = false;
  let inComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inComment) {
      if (ch === "\n") inComment = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++; // skip escaped char
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === ";") {
      inComment = true;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    }
  }
  return { depth, inString };
}

function updateParenIndicator() {
  const { depth, inString } = countParenBalance(replInputEl.value);
  if (inString) {
    parenStatusEl.textContent = 'String: unclosed "';
    parenStatusEl.className = "text-xs font-mono text-terminal-orange";
  } else if (depth > 0) {
    parenStatusEl.textContent = `Parens: +${depth} open`;
    parenStatusEl.className = "text-xs font-mono text-terminal-orange";
  } else if (depth < 0) {
    parenStatusEl.textContent = `Parens: ${depth} extra ')'`;
    parenStatusEl.className = "text-xs font-mono text-terminal-red";
  } else {
    parenStatusEl.textContent = "Parens: balanced";
    parenStatusEl.className = "text-xs font-mono text-terminal-muted";
  }
}

/* --------------------------------------------------------------------------
 * Evaluate REPL Expression
 * -------------------------------------------------------------------------- */
function evaluateReplCode(rawCode) {
  const code = rawCode.trim();
  if (!code) return;

  appendLog("input", code);

  // Push to command history
  if (history[history.length - 1] !== code) {
    history.push(code);
  }
  historyIndex = history.length;
  draftInput = "";

  try {
    const resultObj = fe.evalString(code);
    appendLog("result", fe.toString(resultObj, true));
  } catch (err) {
    if (err instanceof FeRuntimeError) {
      appendLog("error", err.message, err.trace);
    } else {
      appendLog("error", err.message || String(err));
    }
  }
}

/* --------------------------------------------------------------------------
 * Execute JavaScript Extensions Editor
 * -------------------------------------------------------------------------- */
function applyJsExtensions(silent = false) {
  const jsCode = jsExtEditorEl.value;
  try {
    const registerFn = new Function("fe", "FeObject", "FE_TYPE", "showToast", jsCode);
    registerFn(fe, FeObject, FE_TYPE, showToast);

    extStatusEl.textContent = "● Extensions Active";
    extStatusEl.className = "text-[11px] font-mono text-terminal-green hidden sm:inline";
    if (!silent) {
      showToast("JavaScript extensions registered in fe!", "success");
    }
  } catch (err) {
    extStatusEl.textContent = "● JS Error";
    extStatusEl.className = "text-[11px] font-mono text-terminal-red hidden sm:inline";
    appendLog("error", `extend.js: ${err.message}`);
    showToast(`JS Extension Error: ${err.message}`, "error");
  }
}

/* --------------------------------------------------------------------------
 * Event Listeners & Keyboard Shortcuts
 * -------------------------------------------------------------------------- */

replInputEl.addEventListener("input", () => {
  updateParenIndicator();
  replInputEl.style.height = "auto";
  replInputEl.style.height = `${Math.min(replInputEl.scrollHeight, 176)}px`;
});

replInputEl.addEventListener("keydown", (e) => {
  // Enter evaluates if parentheses and strings are balanced (unless Shift is held)
  if (e.key === "Enter" && !e.shiftKey) {
    const { depth, inString } = countParenBalance(replInputEl.value);
    if (depth <= 0 && !inString) {
      e.preventDefault();
      const code = replInputEl.value;
      replInputEl.value = "";
      replInputEl.style.height = "auto";
      updateParenIndicator();
      evaluateReplCode(code);
    } else {
      // Auto-indent newline for multi-line S-expressions
      e.preventDefault();
      const start = replInputEl.selectionStart;
      const end = replInputEl.selectionEnd;
      const indent = "  ".repeat(Math.max(0, depth));
      const val = replInputEl.value;
      replInputEl.value = val.slice(0, start) + "\n" + indent + val.slice(end);
      replInputEl.selectionStart = replInputEl.selectionEnd = start + 1 + indent.length;
      updateParenIndicator();
    }
    return;
  }

  // History Up / Down when cursor is on first / last line
  if (e.key === "ArrowUp") {
    const beforeCursor = replInputEl.value.slice(0, replInputEl.selectionStart);
    if (!beforeCursor.includes("\n") && historyIndex > 0) {
      e.preventDefault();
      if (historyIndex === history.length) {
        draftInput = replInputEl.value;
      }
      historyIndex--;
      replInputEl.value = history[historyIndex];
      updateParenIndicator();
    }
  } else if (e.key === "ArrowDown") {
    const afterCursor = replInputEl.value.slice(replInputEl.selectionEnd);
    if (!afterCursor.includes("\n") && historyIndex < history.length) {
      e.preventDefault();
      historyIndex++;
      replInputEl.value = historyIndex === history.length ? draftInput : history[historyIndex];
      updateParenIndicator();
    }
  }
});

document.getElementById("btn-eval-input").addEventListener("click", () => {
  const code = replInputEl.value;
  replInputEl.value = "";
  replInputEl.style.height = "auto";
  updateParenIndicator();
  evaluateReplCode(code);
  replInputEl.focus();
});

document.getElementById("btn-clear-repl").addEventListener("click", () => {
  replOutputEl.innerHTML = "";
});

// Load local .fe file(s) into the REPL and evaluate immediately
const feFileInputEl = document.getElementById("fe-file-input");
const replPaneEl = document.getElementById("repl-pane");

async function loadFeFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  for (const file of files) {
    try {
      const code = await file.text();
      appendLog("system", `Evaluating fe file: ${file.name}`);
      const resultObj = fe.evalString(code);
      appendLog("result", fe.toString(resultObj, true));
      showToast(`Evaluated ${file.name}`, "success");
    } catch (err) {
      if (err instanceof FeRuntimeError) {
        appendLog("error", `${file.name}: ${err.message}`, err.trace);
      } else {
        appendLog("error", `Failed to load ${file.name}: ${err.message}`);
      }
      showToast(`Error in ${file.name}`, "error");
    }
  }
}

document.getElementById("btn-load-fe-file").addEventListener("click", () => {
  feFileInputEl.click();
});

feFileInputEl.addEventListener("change", async (e) => {
  await loadFeFiles(e.target.files);
  feFileInputEl.value = "";
});

// Drag-and-drop support for .fe and .js files onto the REPL pane
replPaneEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  replPaneEl.classList.add("ring-2", "ring-terminal-accent/60");
});

replPaneEl.addEventListener("dragleave", () => {
  replPaneEl.classList.remove("ring-2", "ring-terminal-accent/60");
});

replPaneEl.addEventListener("drop", async (e) => {
  e.preventDefault();
  replPaneEl.classList.remove("ring-2", "ring-terminal-accent/60");
  if (e.dataTransfer?.files?.length) {
    await loadFeFiles(e.dataTransfer.files);
  }
});

document.getElementById("btn-apply-ext").addEventListener("click", () => {
  applyJsExtensions(false);
});

// Load local .js file(s) into extend.js and execute immediately
const jsFileInputEl = document.getElementById("js-file-input");
document.getElementById("btn-load-js-file").addEventListener("click", () => {
  jsFileInputEl.click();
});

jsFileInputEl.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  for (const file of files) {
    try {
      const content = await file.text();
      const separator = `\n\n// --- Loaded from ${file.name} ---\n`;
      jsExtEditorEl.value += separator + content;
      applyJsExtensions(true);
      appendLog("system", `Loaded and registered JS file: ${file.name}`);
      showToast(`Loaded ${file.name}`, "success");
    } catch (err) {
      appendLog("error", `Failed to read ${file.name}: ${err.message}`);
      showToast(`Error loading ${file.name}`, "error");
    }
  }
  jsFileInputEl.value = "";
});

jsExtEditorEl.addEventListener("keydown", (e) => {
  // Support Tab indentation in JS editor
  if (e.key === "Tab") {
    e.preventDefault();
    const start = jsExtEditorEl.selectionStart;
    const end = jsExtEditorEl.selectionEnd;
    jsExtEditorEl.value =
      jsExtEditorEl.value.slice(0, start) + "  " + jsExtEditorEl.value.slice(end);
    jsExtEditorEl.selectionStart = jsExtEditorEl.selectionEnd = start + 2;
  }
  // Ctrl+Enter / Cmd+Enter runs extensions
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    applyJsExtensions(false);
  }
});

// Example Snippets Loader
document.getElementById("btn-run-snippet").addEventListener("click", () => {
  const key = document.getElementById("snippet-select").value;
  if (!key || !SNIPPETS[key]) {
    showToast("Select a snippet from the dropdown first.", "info");
    return;
  }
  evaluateReplCode(SNIPPETS[key]);
});

document.getElementById("snippet-select").addEventListener("change", (e) => {
  const key = e.target.value;
  if (key && SNIPPETS[key]) {
    replInputEl.value = SNIPPETS[key];
    replInputEl.style.height = "auto";
    replInputEl.style.height = `${Math.min(replInputEl.scrollHeight, 176)}px`;
    updateParenIndicator();
    replInputEl.focus();
  }
});

// Reset VM
document.getElementById("btn-reset-vm").addEventListener("click", () => {
  fe = createVm();
  applyJsExtensions(true);
  appendLog("system", "VM reset to clean state and JS extensions re-applied.");
  showToast("fe VM reset successfully", "info");
});

// Right Pane Tabs Switching
const tabBtnExt = document.getElementById("tab-btn-ext");
const tabBtnRef = document.getElementById("tab-btn-ref");
const tabPanelExt = document.getElementById("tab-panel-ext");
const tabPanelRef = document.getElementById("tab-panel-ref");
const extControls = document.getElementById("ext-controls");

tabBtnExt.addEventListener("click", () => {
  tabBtnExt.className = "px-3.5 py-2 text-xs font-medium rounded-t-lg border-t border-x border-terminal-border bg-terminal-panel text-white flex items-center gap-1.5 cursor-pointer";
  tabBtnRef.className = "px-3.5 py-2 text-xs font-medium rounded-t-lg border-t border-x border-transparent text-terminal-muted hover:text-gray-200 flex items-center gap-1.5 cursor-pointer";
  tabPanelExt.classList.remove("hidden");
  tabPanelRef.classList.add("hidden");
  extControls.classList.remove("hidden");
});

tabBtnRef.addEventListener("click", () => {
  tabBtnRef.className = "px-3.5 py-2 text-xs font-medium rounded-t-lg border-t border-x border-terminal-border bg-terminal-panel text-white flex items-center gap-1.5 cursor-pointer";
  tabBtnExt.className = "px-3.5 py-2 text-xs font-medium rounded-t-lg border-t border-x border-transparent text-terminal-muted hover:text-gray-200 flex items-center gap-1.5 cursor-pointer";
  tabPanelRef.classList.remove("hidden");
  tabPanelExt.classList.add("hidden");
  extControls.classList.add("hidden");
});

// Boot Sequence
async function initApp() {
  try {
    const resp = await fetch("extend.js");
    if (resp.ok) {
      jsExtEditorEl.value = await resp.text();
    }
  } catch (e) {
    // Fallback if opened via file:// protocol where fetch might be blocked
    jsExtEditorEl.value = `// Default extensions loaded from extend.js\nfe.set("PI", Math.PI);\nfe.set("E", Math.E);\nfe.define("sin", (ctx, x) => Math.sin(x));\nfe.define("cos", (ctx, x) => Math.cos(x));\nfe.define("sqrt", (ctx, x) => Math.sqrt(x));\nfe.define("pow", (ctx, x, y) => Math.pow(x, y));\nfe.define("rand", () => Math.random());`;
  }

  appendLog(
    "system",
    "Welcome to fe.js v1.0 — A faithful JavaScript implementation of rxi's tiny Lisp.\n" +
    "• Type expressions below (e.g., (+ 1 2 3), (print PI), or (sin (/ PI 2)))\n" +
    "• Edit extend.js on the right to register new JS-backed functions & constants live!"
  );
  applyJsExtensions(true);
  replInputEl.focus();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
