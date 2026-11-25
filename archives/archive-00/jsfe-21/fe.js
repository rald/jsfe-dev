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
    const expanded = this._evalBody(macro.body, macroEnv);

    if (expanded instanceof Cons) {
      pair.car = expanded.car;
      pair.cdr = expanded.cdr;
    } else {
      pair.car = this.sym("do");
      pair.cdr = new Cons(expanded, NIL);
    }

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
