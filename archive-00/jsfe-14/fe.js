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
  let curA = a === false ? NIL : a;
  let curB = b === false ? NIL : b;

  while (true) {
    if (curA === curB) return true;
    if (curA instanceof Sym && curB instanceof Sym) {
      return curA.name === curB.name;
    }
    if (curA instanceof Cons && curB instanceof Cons) {
      let seenWithB = visited.get(curA);
      if (!seenWithB) {
        seenWithB = new WeakSet();
        visited.set(curA, seenWithB);
      }
      if (seenWithB.has(curB)) return true;
      seenWithB.add(curB);

      if (!feEqual(curA.car, curB.car, visited)) return false;
      curA = curA.cdr === false ? NIL : curA.cdr;
      curB = curB.cdr === false ? NIL : curB.cdr;
      continue;
    }
    return false;
  }
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

    const nextActive = new Set(activeSet);
    nextActive.add(val);

    const parts = [];
    let cur = val;
    while (cur instanceof Cons) {
      parts.push(feFormat(cur.car, true, cycleSet, nextActive));
      const next = cur.cdr;
      if (next instanceof Cons) {
        if (cycleSet.has(next) && nextActive.has(next)) {
          parts.push(".");
          parts.push("(...)");
          return `(${parts.join(" ")})`;
        }
        nextActive.add(next);
      }
      cur = next;
    }
    if (cur !== NIL && cur !== false) {
      parts.push(".");
      parts.push(feFormat(cur, true, cycleSet, nextActive));
    }
    return `(${parts.join(" ")})`;
  }
  return String(val);
}

// --- Tokenizer & Reader ---

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Semicolon comment to end of line
    if (ch === ";") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }

    // Parentheses & quote
    if (ch === "(" || ch === ")" || ch === "'") {
      tokens.push({ type: ch, value: ch });
      i++;
      continue;
    }

    // String literal
    if (ch === '"') {
      i++; // skip opening "
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
          const map = { n: "\n", r: "\r", t: "\t", "\\": "\\", '"': '"' };
          str += esc in map ? map[esc] : esc;
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

    // Atom (number or symbol)
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
      const target = parseOne();
      if (target === undefined) {
        throw new FeError("Unexpected end of input after quote");
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
          pos++; // consume ')'
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
          pos++; // consume ')'
          break;
        }
        items.push(elem);
      }

      return arrayToList(items, dottedTail ?? NIL);
    }

    if (tok.type === "string") {
      return tok.value;
    }

    // Atom: check if valid finite number or malformed numeric literal
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(tok.value)) {
      const num = Number(tok.value);
      if (!Number.isFinite(num)) {
        throw new FeError(`Numeric literal out of range: ${tok.value}`);
      }
      return num;
    }

    if (/^[+-]?[\d.eE]+$/.test(tok.value) && /\d/.test(tok.value)) {
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
    this.envIds = new WeakMap();
    this.nextEnvId = 1;
    this.macroCache = new WeakMap();
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

  _envKey(env) {
    if (env === false || env === undefined) {
      return "false";
    }
    if (env === NIL) {
      return "root-nil";
    }
    if (typeof env === "object" && env !== null) {
      let id = this.envIds.get(env);
      if (!id) {
        id = this.nextEnvId++;
        this.envIds.set(env, id);
      }
      return `env:${id}`;
    }
    return String(env);
  }

  _macroCacheKey(activeEnv, macroEnv) {
    return `${this._envKey(activeEnv)}|${this._envKey(macroEnv)}`;
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
        return entry; // returns (sym . val) cell so '=' can mutate local bindings
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

  _cloneForm(val, cloned = new WeakMap()) {
    if (val instanceof Cons) {
      if (cloned.has(val)) return cloned.get(val);
      const copy = new Cons(NIL, NIL);
      cloned.set(val, copy);
      copy.car = this._cloneForm(val.car, cloned);
      copy.cdr = this._cloneForm(val.cdr, cloned);
      return copy;
    }
    return val;
  }

  _getMacroCacheEntry(pair, activeEnv, macroEnv) {
    const envMap = this.macroCache.get(pair);
    if (!envMap) return undefined;
    return envMap.get(this._macroCacheKey(activeEnv, macroEnv));
  }

  _setMacroCacheEntry(pair, activeEnv, macroEnv, expanded) {
    let envMap = this.macroCache.get(pair);
    if (!envMap) {
      envMap = new Map();
      this.macroCache.set(pair, envMap);
    }
    envMap.set(this._macroCacheKey(activeEnv, macroEnv), expanded);
  }

  _expandMacroInPlace(pair, macro, env, scopeHolder) {
    const activeEnv = scopeHolder ? scopeHolder.env : env;
    const cached = this._getMacroCacheEntry(pair, activeEnv, macro.env);
    if (cached !== undefined) {
      return this.eval(this._cloneForm(cached), activeEnv, scopeHolder);
    }

    const rawArgs = pair.cdr;
    const macroEnv = this._bindParams(macro.params, rawArgs, macro.env);
    const expanded = this._evalBody(macro.body, macroEnv);

    if (expanded instanceof Cons && expanded !== pair) {
      const replacement = this._cloneForm(expanded);
      const targetPair = this._cloneForm(pair);
      targetPair.car = replacement.car;
      targetPair.cdr = replacement.cdr;
      this._setMacroCacheEntry(pair, activeEnv, macro.env, targetPair);
      return this.eval(this._cloneForm(targetPair), activeEnv, scopeHolder);
    }

    const stored = this._cloneForm(expanded);
    this._setMacroCacheEntry(pair, activeEnv, macro.env, stored);
    return this.eval(this._cloneForm(stored), activeEnv, scopeHolder);
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

    // Special forms
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
      while (isTruthy(this.eval(condExpr, activeEnv, scopeHolder))) {
        last = this._evalBody(bodyList, activeEnv);
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

    // Evaluate operator
    const fnVal = this.eval(head, activeEnv, scopeHolder);

    if (fnVal instanceof Closure && fnVal.isMacro) {
      return this._expandMacroInPlace(expr, fnVal, activeEnv, scopeHolder);
    }

    const argExprs = listToArray(expr.cdr, { requireProper: true });
    const evalArgs = argExprs.map((a) => this.eval(a, activeEnv, scopeHolder));

    const label = headName ?? feFormat(head);
    this.callStack.push(label);
    try {
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
    const exprs = readAll(src, this);
    const scope = { env: env === this.rootEnv ? this.rootEnv : env };
    let last = NIL;
    for (const expr of exprs) {
      last = this.eval(expr, scope.env, scope);
      if (env === this.rootEnv) {
        this.rootEnv = scope.env;
      }
    }
    return last;
  }

  _installBuiltins() {
    // List primitives
    this.setBuiltin("car", ([a]) => (a instanceof Cons ? a.car : NIL));
    this.setBuiltin("cdr", ([a]) => (a instanceof Cons ? a.cdr : NIL));
    this.setBuiltin("cons", ([a, b]) => new Cons(a ?? NIL, b ?? NIL));
    this.setBuiltin("setcar", ([pair, val]) => {
      if (!(pair instanceof Cons)) {
        throw new FeError(`'setcar' expects a pair, got ${feFormat(pair)}`);
      }
      pair.car = val ?? NIL;
      return pair.car;
    });
    this.setBuiltin("setcdr", ([pair, val]) => {
      if (!(pair instanceof Cons)) {
        throw new FeError(`'setcdr' expects a pair, got ${feFormat(pair)}`);
      }
      pair.cdr = val ?? NIL;
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

    // Predicates & equality
    this.setBuiltin("atom", ([a]) => (!(a instanceof Cons) ? true : NIL));
    this.setBuiltin("is", ([a, b]) => (feEqual(a, b) ? true : NIL));
    this.setBuiltin("<", ([a, b]) => (toNum(a) < toNum(b) ? true : NIL));
    this.setBuiltin("<=", ([a, b]) => (toNum(a) <= toNum(b) ? true : NIL));
    this.setBuiltin("==", ([a, b]) => (toNum(a) === toNum(b) ? true : NIL));
    this.setBuiltin(">", ([a, b]) => (toNum(a) > toNum(b) ? true : NIL));
    this.setBuiltin(">=", ([a, b]) => (toNum(a) >= toNum(b) ? true : NIL));

    // Arithmetic
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

    // Eval & I/O
    this.setBuiltin("eval", ([a], ctx, env, scopeHolder) => ctx.eval(a, env, scopeHolder));
    this.setBuiltin("print", (args, ctx) => {
      const line = args.map((v) => feFormat(v, false)).join(" ") + "
";
      ctx.output(line);
      return args.length > 0 ? args[args.length - 1] : NIL;
    });
  }
}
