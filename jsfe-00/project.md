# ./repl.js
```js title="./repl.js"
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { FeContext, FeError, feFormat } from "./fe.js";

export function scanReplInput(str) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  let pendingQuote = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
        pendingQuote = false;
      }
    } else if (ch === ";") {
      while (i < str.length && str[i] !== "\n") i++;
    } else if (/\s/.test(ch)) {
      // Whitespace preserves pendingQuote until a quoted datum starts
    } else if (ch === "'") {
      pendingQuote = true;
    } else if (ch === '"') {
      inStr = true;
      esc = false;
      pendingQuote = false;
    } else if (ch === "(") {
      depth++;
      pendingQuote = false;
    } else if (ch === ")") {
      // Track negative depth so unmatched ')' doesn't cancel out a later '('
      depth--;
      pendingQuote = false;
    } else {
      pendingQuote = false;
    }
  }

  return { depth, inStr, pendingQuote };
}

export function runCode(code, isFile = false, targetCtx = new FeContext()) {
  try {
    return targetCtx.evalString(code);
  } catch (err) {
    if (err instanceof FeError) {
      console.error(`Error: ${err.message}`);
      if (err.stackTrace.length) {
        console.error(`Stack: ${err.stackTrace.join(" <- ")}`);
      }
    } else {
      console.error(err);
    }
    if (isFile) {
      process.exitCode = 1;
    }
    return undefined;
  }
}

export function main(argv = process.argv) {
  const ctx = new FeContext();
  const fileArg = argv[2];

  if (fileArg) {
    try {
      const source = fs.readFileSync(fileArg, "utf8");
      runCode(source, true, ctx);
    } catch (err) {
      console.error(`Failed to read '${fileArg}': ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  if (process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "fe> ",
    });
    let buffer = "";

    rl.on("SIGINT", () => {
      buffer = "";
      console.log("");
      rl.setPrompt("fe> ");
      rl.prompt();
    });

    rl.on("close", () => {
      if (buffer.trim() !== "") {
        const result = runCode(buffer, false, ctx);
        if (result !== undefined) {
          console.log(feFormat(result, true));
        }
        buffer = "";
      }
    });

    rl.prompt();
    rl.on("line", (line) => {
      buffer += (buffer ? "\n" : "") + line;
      const { depth, inStr, pendingQuote } = scanReplInput(buffer);

      // If depth < 0, an unmatched ')' occurred; evaluate immediately to report syntax error
      if (depth >= 0 && (depth > 0 || inStr || pendingQuote)) {
        rl.setPrompt("..> ");
        rl.prompt();
        return;
      }

      if (buffer.trim() === "") {
        buffer = "";
        rl.setPrompt("fe> ");
        rl.prompt();
        return;
      }

      const result = runCode(buffer, false, ctx);
      if (result !== undefined) {
        console.log(feFormat(result, true));
      }
      buffer = "";
      rl.setPrompt("fe> ");
      rl.prompt();
    });
    return;
  }

  let piped = "";
  process.stdin.setEncoding("utf8");
  const onData = (chunk) => {
    piped += chunk;
  };
  const onEnd = () => {
    process.stdin.off("data", onData);
    process.stdin.off("end", onEnd);
    if (piped.trim() !== "") {
      runCode(piped, true, ctx);
    }
  };
  process.stdin.on("data", onData);
  process.stdin.on("end", onEnd);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
```
# ./index.html
```html title="./index.html"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>rxi/fe — JS/ES6 Interpreter</title>
  <style>
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      max-width: 820px;
      margin: 2rem auto;
      padding: 0 1rem;
      background: #141619;
      color: #e6edf3;
    }
    textarea {
      width: 100%;
      height: 220px;
      background: #0d1117;
      color: #e6edf3;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 0.75rem;
      font-family: inherit;
      font-size: 14px;
      box-sizing: border-box;
    }
    button {
      margin-top: 0.75rem;
      padding: 0.5rem 1rem;
      background: #238636;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
    }
    button:hover { background: #2ea043; }
    pre {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 0.75rem;
      min-height: 140px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h2>rxi/fe Interpreter (ES6)</h2>
  <textarea id="code">
(= reverse (fn (lst)
  (= res nil)
  (while lst
    (= res (cons (car lst) res))
    (= lst (cdr lst)))
  res))

(= animals '("cat" "dog" "fox"))
(print (reverse animals))
(+ 10 (* 4 5))
  </textarea>
  <div>
    <button id="run">Run (Ctrl/Cmd + Enter)</button>
  </div>
  <h3>Output</h3>
  <pre id="out"></pre>

  <script type="module">
    const codeEl = document.getElementById("code");
    const outEl = document.getElementById("out");
    const runBtn = document.getElementById("run");

    function appendOutput(text) {
      const prefix = outEl.textContent ? "\n" : "";
      outEl.textContent += `${prefix}${text}`;
    }

    let feModulePromise = null;
    function loadInterpreter() {
      if (!feModulePromise) {
        feModulePromise = import("./fe.js");
      }
      return feModulePromise;
    }

    async function execute() {
      outEl.textContent = "";
      try {
        const { FeContext, FeError, feFormat } = await loadInterpreter();
        const ctx = new FeContext({
          output: (text) => {
            outEl.textContent += text;
          },
        });
        const res = ctx.evalString(codeEl.value);
        appendOutput(`=> ${feFormat(res, true)}`);
      } catch (err) {
        appendOutput(`Error: ${err?.message ?? String(err)}`);
        if (err instanceof FeError && err.stackTrace.length) {
          appendOutput(`Stack: ${err.stackTrace.join(" <- ")}`);
        }
      }
    }

    runBtn.addEventListener("click", execute);
    codeEl.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        execute();
      }
    });
  </script>
</body>
</html>
```
# ./fe.js
```js title="./fe.js"
// fe.js — Zero-dependency ES6 implementation of rxi/fe semantics for Web & CLI

export const NIL = Symbol.for("fe.nil");

export class Cons {
  constructor(car = NIL, cdr = NIL) {
    this.car = car;
    this.cdr = cdr;
  }
}

export class Sym {
  constructor(name, globalVal = undefined) {
    this.name = name;
    this.globalVal = globalVal;
  }
  toString() {
    return this.name;
  }
}

export class Closure {
  constructor(params, body, env, isMacro = false) {
    this.params = params; // Cons list of parameter names (or variadic rest param)
    this.body = body;     // Cons list of expressions
    this.env = env;       // Lexical environment (Cons list of (sym . val) pairs)
    this.isMacro = isMacro;
  }
}

export class NativeFn {
  constructor(fn) {
    this.fn = fn;
  }
}

export class FeError extends Error {
  constructor(message, stack = []) {
    super(message);
    this.name = "FeError";
    this.stackTrace = stack;
  }
}

export function isList(x) {
  const seen = new Set();
  let cur = x;
  while (cur instanceof Cons) {
    if (seen.has(cur)) return false;
    seen.add(cur);
    cur = cur.cdr;
  }
  return cur === NIL || cur === false;
}

export function listToArray(x, { requireProper = false } = {}) {
  const out = [];
  const seen = new Set();
  let cur = x;
  while (cur instanceof Cons) {
    if (seen.has(cur)) {
      throw new FeError("Cannot convert cyclic list to array");
    }
    seen.add(cur);
    out.push(cur.car);
    cur = cur.cdr;
  }
  if (requireProper && cur !== NIL && cur !== false) {
    throw new FeError(`Expected proper list, got dotted tail ${feFormat(cur, true)}`);
  }
  return out;
}

export function arrayToList(arr, tail = NIL) {
  let cur = tail;
  for (let i = arr.length - 1; i >= 0; i--) {
    cur = new Cons(arr[i], cur);
  }
  return cur;
}

export function isTruthy(val) {
  return val !== NIL && val !== false && val !== undefined;
}

export function feEqual(a, b, visited = new WeakMap()) {
  const stack = [[a, b]];

  while (stack.length > 0) {
    let [curA, curB] = stack.pop();
    curA = curA === false ? NIL : curA;
    curB = curB === false ? NIL : curB;

    while (true) {
      if (curA === curB) break;
      if (curA instanceof Sym && curB instanceof Sym) {
        if (curA.name !== curB.name) return false;
        break;
      }
      if (curA instanceof Cons && curB instanceof Cons) {
        let seenWithB = visited.get(curA);
        if (!seenWithB) {
          seenWithB = new WeakSet();
          visited.set(curA, seenWithB);
        }
        if (seenWithB.has(curB)) break;
        seenWithB.add(curB);

        stack.push([curA.cdr, curB.cdr]);
        curA = curA.car === false ? NIL : curA.car;
        curB = curB.car === false ? NIL : curB.car;
        continue;
      }
      return false;
    }
  }
  return true;
}

function collectCycleNodes(root) {
  const cycles = new Set();
  const state = new WeakMap(); // 0 = visiting, 1 = visited

  function dfs(node) {
    if (!(node instanceof Cons)) return;
    const st = state.get(node);
    if (st === 0) {
      cycles.add(node);
      return;
    }
    if (st === 1) return;
    state.set(node, 0);
    dfs(node.car);
    dfs(node.cdr);
    state.set(node, 1);
  }

  dfs(root);
  return cycles;
}

export function feFormat(val, quoted = false, cycles = null, active = null) {
  if (val === NIL) return "nil";
  if (val === true) return "t";
  if (val === false) return "nil";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    return quoted ? JSON.stringify(val) : val;
  }
  if (val instanceof Sym) return val.name;
  if (val instanceof Closure) {
    return val.isMacro ? "<macro>" : "<fn>";
  }
  if (val instanceof NativeFn) return "<cfunc>";
  if (val instanceof Cons) {
    const cycleSet = cycles ?? collectCycleNodes(val);
    const activeSet = active ?? new Set();

    if (cycleSet.has(val) && activeSet.has(val)) {
      return "(...)";
    }

    const spineActive = new Set(activeSet);
    spineActive.add(val);

    const parts = [];
    let cur = val;
    while (cur instanceof Cons) {
      parts.push(feFormat(cur.car, true, cycleSet, spineActive));
      const next = cur.cdr;
      if (next instanceof Cons) {
        if (cycleSet.has(next) && spineActive.has(next)) {
          parts.push(".");
          parts.push("(...)");
          return `(${parts.join(" ")})`;
        }
        spineActive.add(next);
      }
      cur = next;
    }
    if (cur !== NIL && cur !== false) {
      parts.push(".");
      parts.push(feFormat(cur, true, cycleSet, spineActive));
    }
    return `(${parts.join(" ")})`;
  }
  return String(val);
}

// --- Tokenizer & Reader ---

const ESCAPE_MAP = Object.freeze({
  n: "\n",
  r: "\r",
  t: "\t",
  "0": "\0",
  "\\": "\\",
  '"': '"',
});

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === ";") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }

    if (ch === "(" || ch === ")" || ch === "'") {
      tokens.push({ type: ch, value: ch });
      i++;
      continue;
    }

    if (ch === '"') {
      i++;
      let str = "";
      let closed = false;
      while (i < n) {
        const c = src[i++];
        if (c === '"') {
          closed = true;
          break;
        }
        if (c === "\\" && i < n) {
          const esc = src[i++];
          str += Object.prototype.hasOwnProperty.call(ESCAPE_MAP, esc) ? ESCAPE_MAP[esc] : esc;
        } else {
          str += c;
        }
      }
      if (!closed) {
        throw new FeError("Unterminated string literal");
      }
      tokens.push({ type: "string", value: str });
      continue;
    }

    let atom = "";
    while (i < n && !/[\s();"']/.test(src[i])) {
      atom += src[i++];
    }
    tokens.push({ type: "atom", value: atom });
  }

  return tokens;
}

export function readAll(src, ctx) {
  const tokens = tokenize(src);
  let pos = 0;

  function parseOne() {
    if (pos >= tokens.length) return undefined;
    const tok = tokens[pos++];

    if (tok.type === ")") {
      throw new FeError("Unexpected ')'");
    }

    if (tok.type === "'") {
      if (pos >= tokens.length || tokens[pos].type === ")") {
        throw new FeError("Expected expression after quote");
      }
      const target = parseOne();
      if (target === undefined) {
        throw new FeError("Expected expression after quote");
      }
      return new Cons(ctx.sym("quote"), new Cons(target, NIL));
    }

    if (tok.type === "(") {
      const items = [];
      let dottedTail = null;

      while (true) {
        if (pos >= tokens.length) {
          throw new FeError("Unterminated '('");
        }
        if (tokens[pos].type === ")") {
          pos++;
          break;
        }
        const elem = parseOne();
        if (elem instanceof Sym && elem.name === ".") {
          if (items.length === 0 || dottedTail !== null) {
            throw new FeError("Invalid dotted pair syntax");
          }
          if (pos >= tokens.length || tokens[pos].type === ")") {
            throw new FeError("Expected expression after '.'");
          }
          const tailObj = parseOne();
          if (tailObj === undefined) {
            throw new FeError("Expected expression after '.'");
          }
          if (tailObj instanceof Sym && tailObj.name === ".") {
            throw new FeError("Invalid dotted pair tail '.'");
          }
          dottedTail = tailObj;
          if (pos >= tokens.length || tokens[pos].type !== ")") {
            throw new FeError("Expected ')' after dotted pair tail");
          }
          pos++;
          break;
        }
        items.push(elem);
      }

      return arrayToList(items, dottedTail ?? NIL);
    }

    if (tok.type === "string") {
      return tok.value;
    }

    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(tok.value)) {
      const num = Number(tok.value);
      if (!Number.isFinite(num)) {
        throw new FeError(`Numeric literal out of range: ${tok.value}`);
      }
      return num;
    }

    if (/^[+-]?(?:\d|\.\d)[\d.eE+-]*$/.test(tok.value) && (tok.value.includes(".") || /[eE]/.test(tok.value))) {
      throw new FeError(`Malformed numeric literal: ${tok.value}`);
    }

    return ctx.sym(tok.value);
  }

  const exprs = [];
  while (pos < tokens.length) {
    const expr = parseOne();
    if (expr !== undefined) exprs.push(expr);
  }
  return exprs;
}

// --- Interpreter Context ---

export class FeContext {
  constructor(options = {}) {
    this.symbols = new Map();
    this.callStack = [];
    this.rootEnv = NIL;
    this.output = options.output ?? ((text) => {
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(text);
      } else {
        console.log(text.replace(/\n$/, ""));
      }
    });

    this.nilSym = this.sym("nil");
    this.nilSym.globalVal = NIL;

    this.tSym = this.sym("t");
    this.tSym.globalVal = true;

    this._installBuiltins();
  }

  sym(name) {
    if (name === "nil") {
      if (this.symbols.has("nil")) return this.symbols.get("nil");
    }
    let s = this.symbols.get(name);
    if (!s) {
      s = new Sym(name, NIL);
      this.symbols.set(name, s);
    }
    return s;
  }

  setBuiltin(name, fn) {
    this.sym(name).globalVal = new NativeFn(fn);
  }

  _bindParams(paramsList, argsList, baseEnv) {
    const args = listToArray(argsList, { requireProper: true });
    let env = baseEnv;
    let cur = paramsList;
    let idx = 0;

    while (cur instanceof Cons) {
      const p = cur.car;
      if (!(p instanceof Sym)) {
        throw new FeError(`Parameter must be a symbol, got ${feFormat(p)}`);
      }
      const val = idx < args.length ? args[idx] : NIL;
      env = new Cons(new Cons(p, val), env);
      idx++;
      cur = cur.cdr;
    }

    if (cur !== NIL) {
      if (!(cur instanceof Sym)) {
        throw new FeError(`Rest parameter must be a symbol, got ${feFormat(cur)}`);
      }
      const restList = arrayToList(args.slice(idx));
      env = new Cons(new Cons(cur, restList), env);
    }

    return env;
  }

  _lookup(sym, env) {
    let cur = env;
    const seen = new Set();
    while (cur instanceof Cons) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const entry = cur.car;
      if (entry instanceof Cons && entry.car === sym) {
        return entry;
      }
      cur = cur.cdr;
    }
    return null;
  }

  _bindLet(expr, env, scopeHolder) {
    const nameSym = expr.cdr instanceof Cons ? expr.cdr.car : NIL;
    const valExpr =
      expr.cdr instanceof Cons && expr.cdr.cdr instanceof Cons
        ? expr.cdr.cdr.car
        : NIL;
    if (!(nameSym instanceof Sym)) {
      throw new FeError(`'let' expects a symbol, got ${feFormat(nameSym)}`);
    }
    if (nameSym.name === "nil" || nameSym.name === "t") {
      throw new FeError(`Cannot rebind built-in constant '${nameSym.name}'`);
    }
    const activeEnv = scopeHolder ? scopeHolder.env : env;
    const val = this.eval(valExpr, activeEnv, scopeHolder);
    const targetEnv = scopeHolder ? scopeHolder.env : activeEnv;
    if (scopeHolder?.isolated) {
      scopeHolder.env = new Cons(new Cons(nameSym, val), targetEnv);
    } else if (targetEnv === this.rootEnv) {
      const existing = this._lookup(nameSym, this.rootEnv);
      if (existing) {
        existing.cdr = val;
      } else {
        this.rootEnv = new Cons(new Cons(nameSym, val), this.rootEnv);
      }
      if (scopeHolder) scopeHolder.env = this.rootEnv;
    } else {
      const nextEnv = new Cons(new Cons(nameSym, val), targetEnv);
      if (scopeHolder) {
        scopeHolder.env = nextEnv;
      }
    }
    return val;
  }

  _evalBody(bodyList, env, scopeHolder = null) {
    const scope = scopeHolder ?? { env };
    if (!scopeHolder) scope.env = env;
    let res = NIL;
    let cur = bodyList;
    const seen = new Set();
    while (cur instanceof Cons) {
      if (seen.has(cur)) {
        throw new FeError("Cyclic code list encountered during evaluation");
      }
      seen.add(cur);
      res = this.eval(cur.car, scope.env, scope);
      cur = cur.cdr;
    }
    if (cur !== NIL && cur !== false) {
      throw new FeError(`Expected proper list in body, got dotted tail ${feFormat(cur, true)}`);
    }
    return res;
  }

  _expandMacroInPlace(pair, macro, env, scopeHolder) {
    const activeEnv = scopeHolder ? scopeHolder.env : env;
    const rawArgs = pair.cdr;
    const macroEnv = this._bindParams(macro.params, rawArgs, macro.env);
    const macroScope = { env: macroEnv, isolated: true };
    const expanded = this._evalBody(macro.body, macroScope.env, macroScope);

    if (expanded instanceof Cons) {
      pair.car = expanded.car;
      pair.cdr = expanded.cdr;
      return this.eval(pair, activeEnv, scopeHolder);
    }

    pair.car = this.sym("do");
    pair.cdr = new Cons(expanded, NIL);
    return this.eval(pair, activeEnv, scopeHolder);
  }

  eval(expr, env = this.rootEnv, scopeHolder = null) {
    const activeEnv = scopeHolder ? scopeHolder.env : env;

    if (expr === NIL || typeof expr === "number" || typeof expr === "string" || typeof expr === "boolean") {
      return expr;
    }

    if (expr instanceof Sym) {
      if (expr.name === "nil") return NIL;
      if (expr.name === "t") return true;
      const local = this._lookup(expr, activeEnv);
      if (local) return local.cdr;
      return expr.globalVal;
    }

    if (!(expr instanceof Cons)) {
      return expr;
    }

    const head = expr.car;
    const headName = head instanceof Sym ? head.name : null;

    if (headName === "quote") {
      return expr.cdr instanceof Cons ? expr.cdr.car : NIL;
    }

    if (headName === "=") {
      const target = expr.cdr instanceof Cons ? expr.cdr.car : NIL;
      const valExpr =
        expr.cdr instanceof Cons && expr.cdr.cdr instanceof Cons
          ? expr.cdr.cdr.car
          : NIL;
      if (!(target instanceof Sym)) {
        throw new FeError(`'=' target must be a symbol, got ${feFormat(target)}`);
      }
      if (target.name === "nil" || target.name === "t") {
        throw new FeError(`Cannot assign to built-in constant '${target.name}'`);
      }
      const val = this.eval(valExpr, activeEnv, scopeHolder);
      const local = this._lookup(target, activeEnv);
      if (local) {
        local.cdr = val;
      } else {
        target.globalVal = val;
      }
      return val;
    }

    if (headName === "let") {
      return this._bindLet(expr, activeEnv, scopeHolder);
    }

    if (headName === "if") {
      const args = listToArray(expr.cdr, { requireProper: true });
      const cond = args.length > 0 ? this.eval(args[0], activeEnv, scopeHolder) : NIL;
      if (isTruthy(cond)) {
        return args.length > 1
          ? this.eval(args[1], activeEnv, { env: activeEnv, isolated: true })
          : NIL;
      }
      return args.length > 2
        ? this._evalBody(arrayToList(args.slice(2)), activeEnv, { env: activeEnv, isolated: true })
        : NIL;
    }

    if (headName === "while") {
      const args = listToArray(expr.cdr, { requireProper: true });
      if (args.length < 1) throw new FeError("'while' requires a condition");
      const condExpr = args[0];
      const bodyList = arrayToList(args.slice(1));
      let last = NIL;
      while (true) {
        const curEnv = scopeHolder ? scopeHolder.env : env;
        if (!isTruthy(this.eval(condExpr, curEnv, scopeHolder))) break;
        const loopEnv = scopeHolder ? scopeHolder.env : env;
        const iterScope = { env: loopEnv, isolated: true };
        last = this._evalBody(bodyList, iterScope.env, iterScope);
      }
      return last;
    }

    if (headName === "do") {
      return this._evalBody(expr.cdr, activeEnv, { env: activeEnv, isolated: true });
    }

    if (headName === "fn" || headName === "mac") {
      const isMacro = headName === "mac";
      const params = expr.cdr instanceof Cons ? expr.cdr.car : NIL;
      const body = expr.cdr instanceof Cons ? expr.cdr.cdr : NIL;
      return new Closure(params, body, activeEnv, isMacro);
    }

    const fnVal = this.eval(head, activeEnv, scopeHolder);
    const label = headName ?? feFormat(head);

    this.callStack.push(label);
    try {
      if (fnVal instanceof Closure && fnVal.isMacro) {
        return this._expandMacroInPlace(expr, fnVal, activeEnv, scopeHolder);
      }

      const argExprs = listToArray(expr.cdr, { requireProper: true });
      const evalArgs = argExprs.map((a) => this.eval(a, activeEnv, scopeHolder));

      if (fnVal instanceof NativeFn) {
        return fnVal.fn(evalArgs, this, activeEnv, scopeHolder);
      }
      if (fnVal instanceof Closure) {
        const callEnv = this._bindParams(fnVal.params, arrayToList(evalArgs), fnVal.env);
        return this._evalBody(fnVal.body, callEnv);
      }
      throw new FeError(`Cannot call non-function: ${feFormat(fnVal)}`);
    } catch (err) {
      if (err instanceof FeError) {
        if (err.stackTrace.length === 0) {
          err.stackTrace = [...this.callStack];
        }
        throw err;
      }
      throw new FeError(err.message ?? String(err), [...this.callStack]);
    } finally {
      this.callStack.pop();
    }
  }

  evalString(src, env = this.rootEnv) {
    const isRoot = env === this.rootEnv;
    const scope = { env: isRoot ? this.rootEnv : env };
    const exprs = readAll(src, this);
    let last = NIL;
    for (const expr of exprs) {
      if (isRoot) scope.env = this.rootEnv;
      last = this.eval(expr, scope.env, scope);
      if (isRoot) {
        this.rootEnv = scope.env;
      }
    }
    return last;
  }

  _installBuiltins() {
    const checkArity = (name, args, min, max = min) => {
      if (args.length < min || args.length > max) {
        const expected = min === max ? `${min}` : `${min}..${max}`;
        throw new FeError(`'${name}' expects ${expected} argument(s), got ${args.length}`);
      }
    };

    this.setBuiltin("car", (args) => {
      checkArity("car", args, 1);
      const [a] = args;
      if (a === NIL || a === false) return NIL;
      if (!(a instanceof Cons)) {
        throw new FeError(`'car' expects a pair or nil, got ${feFormat(a, true)}`);
      }
      return a.car;
    });
    this.setBuiltin("cdr", (args) => {
      checkArity("cdr", args, 1);
      const [a] = args;
      if (a === NIL || a === false) return NIL;
      if (!(a instanceof Cons)) {
        throw new FeError(`'cdr' expects a pair or nil, got ${feFormat(a, true)}`);
      }
      return a.cdr;
    });
    this.setBuiltin("cons", (args) => {
      checkArity("cons", args, 2);
      return new Cons(args[0], args[1]);
    });
    this.setBuiltin("setcar", (args) => {
      checkArity("setcar", args, 2);
      const [pair, val] = args;
      if (!(pair instanceof Cons)) {
        throw new FeError(`'setcar' expects a pair, got ${feFormat(pair)}`);
      }
      pair.car = val;
      return pair.car;
    });
    this.setBuiltin("setcdr", (args) => {
      checkArity("setcdr", args, 2);
      const [pair, val] = args;
      if (!(pair instanceof Cons)) {
        throw new FeError(`'setcdr' expects a pair, got ${feFormat(pair)}`);
      }
      pair.cdr = val;
      return pair.cdr;
    });
    this.setBuiltin("list", (args) => arrayToList(args));

    const toNum = (v) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      throw new FeError(`Expected number, got ${feFormat(v, true)}`);
    };

    const checkFinite = (n) => {
      if (!Number.isFinite(n)) {
        throw new FeError("Numeric overflow");
      }
      return n;
    };

    this.setBuiltin("atom", (args) => {
      checkArity("atom", args, 1);
      return !(args[0] instanceof Cons) ? true : NIL;
    });
    this.setBuiltin("is", (args) => {
      checkArity("is", args, 2);
      return feEqual(args[0], args[1]) ? true : NIL;
    });
    this.setBuiltin("<", (args) => {
      checkArity("<", args, 2);
      return toNum(args[0]) < toNum(args[1]) ? true : NIL;
    });
    this.setBuiltin("<=", (args) => {
      checkArity("<=", args, 2);
      return toNum(args[0]) <= toNum(args[1]) ? true : NIL;
    });
    this.setBuiltin("==", (args) => {
      checkArity("==", args, 2);
      return toNum(args[0]) === toNum(args[1]) ? true : NIL;
    });
    this.setBuiltin(">", (args) => {
      checkArity(">", args, 2);
      return toNum(args[0]) > toNum(args[1]) ? true : NIL;
    });
    this.setBuiltin(">=", (args) => {
      checkArity(">=", args, 2);
      return toNum(args[0]) >= toNum(args[1]) ? true : NIL;
    });

    this.setBuiltin("+", (args) => {
      if (args.length === 0) return 0;
      const sum = args.reduce((acc, v) => acc + toNum(v), 0);
      return checkFinite(sum);
    });
    this.setBuiltin("-", (args) => {
      if (args.length === 0) return 0;
      if (args.length === 1) return checkFinite(-toNum(args[0]));
      const diff = args.slice(1).reduce((acc, v) => acc - toNum(v), toNum(args[0]));
      return checkFinite(diff);
    });
    this.setBuiltin("*", (args) => {
      const prod = args.reduce((acc, v) => acc * toNum(v), 1);
      return checkFinite(prod);
    });
    this.setBuiltin("/", (args) => {
      if (args.length === 0) return 0;
      if (args.length === 1) {
        const d = toNum(args[0]);
        if (d === 0) throw new FeError("Division by zero");
        return checkFinite(1 / d);
      }
      const quot = args.slice(1).reduce((acc, v) => {
        const d = toNum(v);
        if (d === 0) throw new FeError("Division by zero");
        return checkFinite(acc / d);
      }, toNum(args[0]));
      return checkFinite(quot);
    });

    this.setBuiltin("eval", (args, ctx, env, scopeHolder) => {
      checkArity("eval", args, 1);
      return ctx.eval(args[0], env, scopeHolder);
    });
    this.setBuiltin("print", (args, ctx) => {
      const line = args.map((v) => feFormat(v, false)).join(" ") + "\n";
      ctx.output(line);
      return args.length > 0 ? args[args.length - 1] : NIL;
    });
  }
}
```
# ./showcase.fe
```fe title="./showcase.fe"
; showcase.fe — Feature showcase for the ES6 rxi/fe interpreter

(print "--- Atoms, Strings, Escapes & Quotes ---")
(let greeting "Hello, fe!")
(let escaped "tab:\t newline:\n quote:\" slash:\\")
(let sym-val 'symbolic-token)
(let quoted-list '(10 20 30))
(print greeting)
(print escaped)
(print "sym:" sym-val "quoted:" quoted-list)

(print "--- Cons Pairs, Lists & Mutation ---")
(let pair (cons "left" "right"))
(let nums (list 1 2 3 4))
(setcar pair "first")
(setcdr pair "second")
(setcar nums 100)
(setcdr (cdr nums) (list 25 3 4))
(print "pair:" pair "car:" (car pair) "cdr:" (cdr pair))
(print "nums:" nums "atom?:" (atom nums) "100 atom?:" (atom 100))

(let reverse (fn (lst)
  (= acc nil)
  (while lst
    (= acc (cons (car lst) acc))
    (= lst (cdr lst)))
  acc))
(print "reversed:" (reverse (list "a" "b" "c" "d")))

(print "--- Arithmetic, Comparisons & Equality ---")
(let x 12)
(let y 5)
(print "+:" (+ x y) "-:" (- x y) "neg:" (- y))
(print "*:" (* x y) "/:" (/ x y) "recip:" (/ y))
(print "<:" (< y x) "<=:" (<= y 5) "==:" (== x 12) ">:" (> x y) ">=:" (>= x 12))
(print "nil==false:" (is nil false) "list eq:" (is (list 1 2) '(1 2)))

(print "--- Closures, Lexical State & Scoped let ---")
(let make-counter (fn (start step)
  (let count start)
  (fn (delta)
    (if delta
      (= count (+ count delta))
      (= count (+ count step)))
    count)))

(let counter (make-counter 0 2))
(print "c1:" (counter))
(print "c2:" (counter 8))
(print "c3:" (counter))

(let branch-demo (fn (flag)
  (let v 1)
  (if flag
    (do
      (let v 42)
      (print "inner v:" v))
    (print "false branch v:" v))
  v))
(print "outer v:" (branch-demo t))

(print "--- Variadic Functions & Macros ---")
(let join-with-tag (fn (tag . rest)
  (cons tag rest)))
(print "variadic fn:" (join-with-tag "items" "one" "two" "three"))

(let unless (mac (cond body)
  (list 'if (list 'is cond nil) body)))

(let collect (mac args
  (cons 'list args)))

(unless nil
  (print "unless ran because cond is nil"))
(print "variadic mac:" (collect (+ 1 1) (* 3 3) 'done))

(print "--- Dynamic eval ---")
(let program '((fn (n) (* n n)) 9))
(print "eval result:" (eval program))
```
# ./package.json
```json title="./package.json"
{
  "name": "jsfe",
  "version": "1.0.0",
  "description": "Zero-dependency ES6 implementation of rxi/fe for Web and CLI",
  "type": "module",
  "main": "./fe.js",
  "exports": {
    ".": "./fe.js",
    "./repl": "./repl.js"
  },
  "bin": {
    "jsfe": "./repl.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "start": "node repl.js",
    "repl": "node repl.js",
    "showcase": "node repl.js showcase.fe",
    "test": "node --test test.js",
    "serve": "npx serve ."
  },
  "keywords": [
    "lisp",
    "interpreter",
    "fe",
    "rxi-fe",
    "es6",
    "esm",
    "repl"
  ],
  "license": "MIT"
}
```
# ./test.js
```js title="./test.js"
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { FeContext, FeError, NIL, arrayToList, feEqual, feFormat } from "./fe.js";
import { scanReplInput } from "./repl.js";

test("closures capture lexical state and mutate via =", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= make-counter (fn (n)
      (fn () (= n (+ n 1)) n)))
    (= c (make-counter 10))
    (list (c) (c) (c))
  `);
  assert.equal(feFormat(res, true), "(11 12 13)");
});

test("list reversal and cons/car/cdr/setcar/setcdr", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= reverse (fn (lst)
      (= res nil)
      (while lst
        (= res (cons (car lst) res))
        (= lst (cdr lst)))
      res))
    (= p (cons 1 2))
    (setcar p 10)
    (setcdr p 20)
    (list (reverse '("cat" "dog" "fox")) p)
  `);
  assert.equal(feFormat(res, true), '(("fox" "dog" "cat") (10 . 20))');
});

test("macros expand in-place and evaluate", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= unless (mac (cond body)
      (list 'if (list 'is cond nil) body)))
    (unless nil 42)
  `);
  assert.equal(res, 42);
});

test("macros returning atoms work in loops without re-expanding", () => {
  const ctx = new FeContext();
  let expansions = 0;
  ctx.setBuiltin("mark-expand", () => {
    expansions++;
    return 7;
  });
  const res = ctx.evalString(`
    (= const7 (mac () (mark-expand)))
    (= i 0)
    (= acc 0)
    (while (< i 3)
      (= acc (+ acc (const7)))
      (= i (+ i 1)))
    acc
  `);
  assert.equal(res, 21);
  assert.equal(expansions, 1);
});

test("macros respect distinct environments and do not corrupt shared cons cells", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= pick-x (mac () 'x))
    (= f1 (fn (x) (pick-x)))
    (= f2 (fn (x) (pick-x)))
    (list (f1 100) (f2 200))
  `);
  assert.equal(feFormat(res, true), "(100 200)");

  const shared = ctx.evalString(`
    (= template '(+ 1 2))
    (= m (mac () (list 'quote template)))
    (= v1 (m))
    (= v2 (m))
    (list v1 v2 template)
  `);
  assert.equal(feFormat(shared, true), "((+ 1 2) (+ 1 2) (+ 1 2))");
});

test("distinct macro closures expand independently at their own call sites", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= make-m (fn (x)
      (mac () (list 'quote x))))
    (= m1 (make-m "first"))
    (= m2 (make-m "second"))
    (list (m1) (m2))
  `);
  assert.equal(feFormat(res, true), '("first" "second")');
});

test("nil and false behave consistently in equality and formatting", () => {
  const ctx = new FeContext();
  assert.equal(ctx.evalString("(is nil false)"), true);
  assert.equal(ctx.evalString("(atom '(1 2))"), NIL);
  assert.equal(feFormat(NIL), "nil");
  assert.equal(feFormat(false), "nil");
});

test("numeric equality (==), strict type checking, overflow, and division by zero error", () => {
  const ctx = new FeContext();
  assert.equal(ctx.evalString("(== 15 15)"), true);
  assert.equal(ctx.evalString("(== 15 14)"), NIL);
  assert.throws(() => ctx.evalString('(+ "5" 1)'), FeError);
  assert.throws(() => ctx.evalString("(== nil 0)"), FeError);
  assert.throws(() => ctx.evalString("(/ 1 0)"), FeError);
  assert.throws(() => ctx.evalString("(/ 0)"), FeError);
  assert.throws(() => ctx.evalString("(* 1e308 10)"), FeError);
});

test("invalid syntax and improper lists throw FeError", () => {
  const ctx = new FeContext();
  assert.throws(() => ctx.evalString("(+ 1 2"), FeError);
  assert.throws(() => ctx.evalString(")"), FeError);
  assert.throws(() => ctx.evalString("(a . )"), FeError);
  assert.throws(() => ctx.evalString("(a . .)"), FeError);
  assert.throws(() => ctx.evalString('"unterminated'), FeError);
  assert.throws(() => ctx.evalString("((fn (a) a) . 1)"), FeError);
});

test("malformed numeric literals throw FeError", () => {
  const ctx = new FeContext();
  assert.throws(() => ctx.evalString("1.2.3"), FeError);
  assert.throws(() => ctx.evalString("1e2e3"), FeError);
});

test("sequential, conditional, eval, and top-level let bindings", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (let base 10)
    (= make-acc (fn (start)
      (let step 2)
      (if t (let bonus 1))
      (fn (d)
        (if d
          (= start (+ start d))
          (= start (+ start step)))
        start)))
    (= a (make-acc base))
    (list (a) (a 5) (a))
  `);
  assert.equal(feFormat(res, true), "(12 17 19)");
});

test("let inside nested if branch does not leak outside the branch", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (let outer-x 10)
    (= fn-test (fn ()
      (let outer-x 10)
      (if t (do (let outer-x 99) outer-x))
      outer-x))
    (fn-test)
  `);
  assert.equal(res, 10);
});

test("variadic rest parameters and macros", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= first-and-rest (fn (head . tail)
      (cons head tail)))
    (first-and-rest "x" 1 2 3)
  `);
  assert.equal(feFormat(res, true), '("x" 1 2 3)');
});

test("cyclic cons lists and shared DAG substructures format and compare cleanly", () => {
  const ctx = new FeContext();
  ctx.evalString(`
    (= a (list 1 2))
    (setcdr (cdr a) a)
    (= b (list 1 2))
    (setcdr (cdr b) b)
  `);
  const aVal = ctx.evalString("a");
  const bVal = ctx.evalString("b");
  assert.doesNotThrow(() => feFormat(aVal, true));
  assert.equal(ctx.evalString("(is a b)"), true);

  const dag = ctx.evalString(`
    (= shared (list "x" "y"))
    (cons shared shared)
  `);
  assert.equal(feFormat(dag, true), '(("x" "y") "x" "y")');
});

test("deep proper lists compare iteratively without stack overflow", () => {
  const n = 15000;
  const listA = arrayToList(Array.from({ length: n }, (_, i) => i));
  const listB = arrayToList(Array.from({ length: n }, (_, i) => i));
  assert.equal(feEqual(listA, listB), true);
});

test("repl scanner handles comments, escapes, and multiline parens", () => {
  assert.deepEqual(scanReplInput("(+ 1 ; )\n 2)"), { depth: 0, inStr: false, pendingQuote: false });
  assert.deepEqual(scanReplInput('"(unclosed \\" quote'), { depth: 0, inStr: true, pendingQuote: false });
  assert.deepEqual(scanReplInput('"(closed \\" quote)"'), { depth: 0, inStr: false, pendingQuote: false });
});

test("repl exits with non-zero code on runtime FeError in script file", () => {
  const tmpFile = path.join(os.tmpdir(), `fe-err-${Date.now()}.fe`);
  fs.writeFileSync(tmpFile, "(/ 1 0)\n", "utf8");
  try {
    assert.throws(() => {
      execFileSync(process.execPath, ["repl.js", tmpFile], {
        cwd: import.meta.dirname,
        stdio: "pipe",
      });
    });
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});

test("repl executes piped stdin and exits non-zero on error", () => {
  const out = execFileSync(process.execPath, ["repl.js"], {
    cwd: import.meta.dirname,
    input: '(print (+ 20 22))\n',
    encoding: "utf8",
  });
  assert.equal(out.trim(), "42");

  assert.throws(() => {
    execFileSync(process.execPath, ["repl.js"], {
      cwd: import.meta.dirname,
      input: "(/ 1 0)\n",
      stdio: "pipe",
    });
  });
});

test("cannot assign or let-bind built-in constants nil or t", () => {
  const ctx = new FeContext();
  assert.throws(() => ctx.evalString("(= nil 1)"), FeError);
  assert.throws(() => ctx.evalString("(= t nil)"), FeError);
  assert.throws(() => ctx.evalString("(let nil 1)"), FeError);
  assert.throws(() => ctx.evalString("(let t 2)"), FeError);
});

test("let inside while loop is scoped per iteration", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= i 0)
    (= total 0)
    (while (< i 3)
      (let step 10)
      (= total (+ total step))
      (= i (+ i 1)))
    total
  `);
  assert.equal(res, 30);
  assert.equal(ctx.evalString("(is step nil)"), true);
});

test("let inside macro body is isolated and does not clobber macro arguments", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= swap-or-keep (mac (x)
      (let tmp x)
      (let x 999)
      (list 'quote tmp)))
    (= a (swap-or-keep first-arg))
    (= b (swap-or-keep second-arg))
    (list a b)
  `);
  assert.equal(feFormat(res, true), "(first-arg second-arg)");
});

test("macro returning a symbol or atom evaluates directly without extra do scope", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= outer-x 10)
    (= pick-outer (mac () 'outer-x))
    (let outer-x 50)
    (pick-outer)
  `);
  assert.equal(res, 50);
});

test("errors inside macro expansion include the macro name in stackTrace", () => {
  const ctx = new FeContext();
  ctx.evalString(`
    (= boom-mac (mac (n)
      (/ n 0)))
  `);
  let caught = null;
  try {
    ctx.evalString("(boom-mac 5)");
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof FeError);
  assert.ok(caught.stackTrace.includes("boom-mac"));
});
```
