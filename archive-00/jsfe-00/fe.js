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
    this.params = params; // Array of parameter names (or variadic rest param)
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
  let cur = x;
  while (cur instanceof Cons) cur = cur.cdr;
  return cur === NIL;
}

export function listToArray(x) {
  const out = [];
  let cur = x;
  while (cur instanceof Cons) {
    out.push(cur.car);
    cur = cur.cdr;
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

export function feEqual(a, b) {
  if (a === b) return true;
  if (a instanceof Sym && b instanceof Sym) return a.name === b.name;
  if (a instanceof Cons && b instanceof Cons) {
    return feEqual(a.car, b.car) && feEqual(a.cdr, b.cdr);
  }
  return false;
}

export function feFormat(val, quoted = false) {
  if (val === NIL) return "nil";
  if (val === true) return "t";
  if (val === false) return "nil";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "0";
  if (typeof val === "string") {
    return quoted ? JSON.stringify(val) : val;
  }
  if (val instanceof Sym) return val.name;
  if (val instanceof Closure) {
    return val.isMacro ? "<macro>" : "<fn>";
  }
  if (val instanceof NativeFn) return "<cfunc>";
  if (val instanceof Cons) {
    const parts = [];
    let cur = val;
    while (cur instanceof Cons) {
      parts.push(feFormat(cur.car, true));
      cur = cur.cdr;
    }
    if (cur !== NIL) {
      parts.push(".");
      parts.push(feFormat(cur, true));
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
          const tailObj = parseOne();
          if (tailObj === undefined) {
            throw new FeError("Expected expression after '.'");
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

    // Atom: check if valid finite number (avoid empty string or lone '-' / '+')
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(tok.value)) {
      const num = Number(tok.value);
      if (Number.isFinite(num)) return num;
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
    this.output = options.output ?? ((text) => {
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(text);
      } else {
        console.log(text);
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
    const params = listToArray(paramsList);
    const args = listToArray(argsList);
    let env = baseEnv;

    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (!(p instanceof Sym)) {
        throw new FeError(`Parameter must be a symbol, got ${feFormat(p)}`);
      }
      if (p.name === ".") {
        // Variadic rest parameter: (fn (a . rest) ...)
        const restName = params[i + 1];
        if (!(restName instanceof Sym) || params.length !== i + 2) {
          throw new FeError("Invalid variadic parameter syntax");
        }
        const restList = arrayToList(args.slice(i));
        env = new Cons(new Cons(restName, restList), env);
        break;
      }
      const val = i < args.length ? args[i] : NIL;
      env = new Cons(new Cons(p, val), env);
    }

    return env;
  }

  _lookup(sym, env) {
    let cur = env;
    while (cur instanceof Cons) {
      const entry = cur.car;
      if (entry instanceof Cons && entry.car === sym) {
        return entry; // returns (sym . val) cell so '=' can mutate local bindings
      }
      cur = cur.cdr;
    }
    return null;
  }

  _evalBody(bodyList, env) {
    let res = NIL;
    let cur = bodyList;
    while (cur instanceof Cons) {
      res = this.eval(cur.car, env);
      cur = cur.cdr;
    }
    return res;
  }

  _expandMacroInPlace(pair, macro, env) {
    const rawArgs = pair.cdr;
    const macroEnv = this._bindParams(macro.params, rawArgs, macro.env);
    const expanded = this._evalBody(macro.body, macroEnv);

    // Mutate pair in-place like rxi/fe so subsequent evaluations use expanded code
    if (expanded instanceof Cons) {
      pair.car = expanded.car;
      pair.cdr = expanded.cdr;
    } else {
      pair.car = this.sym("do");
      pair.cdr = new Cons(expanded, NIL);
    }
    return this.eval(pair, env);
  }

  eval(expr, env = NIL) {
    if (expr === NIL || typeof expr === "number" || typeof expr === "string" || typeof expr === "boolean") {
      return expr;
    }

    if (expr instanceof Sym) {
      if (expr.name === "nil") return NIL;
      if (expr.name === "t") return true;
      const local = this._lookup(expr, env);
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
      const val = this.eval(valExpr, env);
      const local = this._lookup(target, env);
      if (local) {
        local.cdr = val;
      } else {
        target.globalVal = val;
      }
      return val;
    }

    if (headName === "let") {
      const nameSym = expr.cdr instanceof Cons ? expr.cdr.car : NIL;
      const valExpr =
        expr.cdr instanceof Cons && expr.cdr.cdr instanceof Cons
          ? expr.cdr.cdr.car
          : NIL;
      if (!(nameSym instanceof Sym)) {
        throw new FeError(`'let' expects a symbol, got ${feFormat(nameSym)}`);
      }
      const val = this.eval(valExpr, env);
      const newEntry = new Cons(nameSym, val);
      // Note: In fe, (let x val) binds in current/enclosing scope; returning new env cell
      // supports sequential bindings in blocks.
      env = new Cons(newEntry, env);
      return val;
    }

    if (headName === "if") {
      const args = listToArray(expr.cdr);
      const cond = args.length > 0 ? this.eval(args[0], env) : NIL;
      if (isTruthy(cond)) {
        return args.length > 1 ? this.eval(args[1], env) : NIL;
      }
      return args.length > 2 ? this._evalBody(arrayToList(args.slice(2)), env) : NIL;
    }

    if (headName === "while") {
      const args = listToArray(expr.cdr);
      if (args.length < 1) throw new FeError("'while' requires a condition");
      const condExpr = args[0];
      const bodyList = arrayToList(args.slice(1));
      let last = NIL;
      while (isTruthy(this.eval(condExpr, env))) {
        last = this._evalBody(bodyList, env);
      }
      return last;
    }

    if (headName === "do") {
      return this._evalBody(expr.cdr, env);
    }

    if (headName === "fn" || headName === "mac") {
      const isMacro = headName === "mac";
      const params = expr.cdr instanceof Cons ? expr.cdr.car : NIL;
      const body = expr.cdr instanceof Cons ? expr.cdr.cdr : NIL;
      return new Closure(params, body, env, isMacro);
    }

    // Evaluate operator
    const fnVal = this.eval(head, env);

    if (fnVal instanceof Closure && fnVal.isMacro) {
      return this._expandMacroInPlace(expr, fnVal, env);
    }

    const argExprs = listToArray(expr.cdr);
    const evalArgs = argExprs.map((a) => this.eval(a, env));

    const label = headName ?? feFormat(head);
    this.callStack.push(label);
    try {
      if (fnVal instanceof NativeFn) {
        return fnVal.fn(evalArgs, this, env);
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

  evalString(src, env = NIL) {
    const exprs = readAll(src, this);
    let last = NIL;
    for (const expr of exprs) {
      last = this.eval(expr, env);
    }
    return last;
  }

  _installBuiltins() {
    // List primitives
    this.setBuiltin("car", ([a]) => (a instanceof Cons ? a.car : NIL));
    this.setBuiltin("cdr", ([a]) => (a instanceof Cons ? a.cdr : NIL));
    this.setBuiltin("cons", ([a, b]) => new Cons(a ?? NIL, b ?? NIL));
    this.setBuiltin("list", (args) => arrayToList(args));

    // Predicates & equality
    this.setBuiltin("atom", ([a]) => !(a instanceof Cons));
    this.setBuiltin("is", ([a, b]) => feEqual(a, b));
    this.setBuiltin("<", ([a, b]) => Number(a) < Number(b));
    this.setBuiltin("<=", ([a, b]) => Number(a) <= Number(b));
    this.setBuiltin("=", ([a, b]) => Number(a) === Number(b));
    this.setBuiltin(">", ([a, b]) => Number(a) > Number(b));
    this.setBuiltin(">=", ([a, b]) => Number(a) >= Number(b));

    // Arithmetic
    this.setBuiltin("+", (args) => {
      if (args.length === 0) return 0;
      return args.reduce((acc, v) => acc + Number(v), 0);
    });
    this.setBuiltin("-", (args) => {
      if (args.length === 0) return 0;
      if (args.length === 1) return -Number(args[0]);
      return args.slice(1).reduce((acc, v) => acc - Number(v), Number(args[0]));
    });
    this.setBuiltin("*", (args) => args.reduce((acc, v) => acc * Number(v), 1));
    this.setBuiltin("/", (args) => {
      if (args.length === 0) return 0;
      if (args.length === 1) return 1 / Number(args[0]);
      return args.slice(1).reduce((acc, v) => acc / Number(v), Number(args[0]));
    });

    // Eval & I/O
    this.setBuiltin("eval", ([a], ctx, env) => ctx.eval(a, env));
    this.setBuiltin("print", (args, ctx) => {
      const line = args.map((v) => feFormat(v, false)).join(" ") + "\n";
      ctx.output(line);
      return args.length > 0 ? args[args.length - 1] : NIL;
    });
  }
}
