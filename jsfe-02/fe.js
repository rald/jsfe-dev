/**
 * ============================================================================
 * fe.js — Complete JavaScript Port of rxi's `fe` Tiny Lisp Interpreter
 * Faithful to fe.h and fe.c (v1.0) with Seamless JS Interop Bridge
 * ============================================================================
 */

const FE_TYPE = Object.freeze({
  PAIR: 0,
  FREE: 1,
  NIL: 2,
  NUMBER: 3,
  SYMBOL: 4,
  STRING: 5,
  FUNC: 6,
  MACRO: 7,
  PRIM: 8,
  CFUNC: 9,
  PTR: 10
});

const FE_TYPENAMES = [
  "pair", "free", "nil", "number", "symbol", "string",
  "func", "macro", "prim", "cfunc", "ptr"
];

const PRIM = Object.freeze({
  LET: 0, SET: 1, IF: 2, FN: 3, MAC: 4, WHILE: 5, QUOTE: 6,
  AND: 7, OR: 8, DO: 9, CONS: 10, CAR: 11, CDR: 12, SETCAR: 13,
  SETCDR: 14, LIST: 15, NOT: 16, IS: 17, ATOM: 18, PRINT: 19,
  LT: 20, LTE: 21, ADD: 22, SUB: 23, MUL: 24, DIV: 25
});

const PRIM_NAMES = [
  "let", "=", "if", "fn", "mac", "while", "quote", "and", "or", "do", "cons",
  "car", "cdr", "setcar", "setcdr", "list", "not", "is", "atom", "print", "<",
  "<=", "+", "-", "*", "/"
];

let _nextObjId = 1;

/**
 * Represents a tagged fe_Object (analogous to union Value car, cdr in fe.c)
 */
class FeObject {
  constructor(type, car = null, cdr = null) {
    this.id = _nextObjId++;
    this.type = type;
    this.car = car;
    this.cdr = cdr;
  }
}

/**
 * Custom Error class carrying the fe evaluation call stack trace
 */
class FeRuntimeError extends Error {
  constructor(message, trace = []) {
    super(message);
    this.name = "FeRuntimeError";
    this.trace = trace;
  }
}

/**
 * Reader state wrapper for string input streams
 */
class StringStream {
  constructor(source) {
    this.source = source;
    this.pos = 0;
  }
  readChar() {
    if (this.pos >= this.source.length) return "\0";
    return this.source[this.pos++];
  }
}

/**
 * Core fe Virtual Machine & Context (`fe_Context`)
 */
class FeContext {
  constructor(options = {}) {
    this.onPrint = options.onPrint || ((text) => console.log(text));

    // Singleton nil object (FE_TNIL)
    this.nil = new FeObject(FE_TYPE.NIL, null, null);
    // Internal sentinel for ')' in reader
    this._rparen = new FeObject(FE_TYPE.NIL, null, null);

    // Symbol table list: list of interned symbol objects
    this.symlist = this.nil;
    // Evaluation call stack for traceback reporting
    this.calllist = this.nil;
    // Single-char lookahead buffer for reader
    this.nextchr = "";

    // Intern `t` symbol and bind it to itself
    this.t = this.symbol("t");
    this.set(this.t, this.t);

    // Register all 26 built-in primitives
    for (let i = 0; i < PRIM_NAMES.length; i++) {
      const primObj = new FeObject(FE_TYPE.PRIM, null, i);
      this.set(this.symbol(PRIM_NAMES[i]), primObj);
    }
  }

  /* ------------------------------------------------------------------------
   * Error Handling & Type Checking
   * ------------------------------------------------------------------------ */

  error(msg) {
    const trace = [];
    let cl = this.calllist;
    while (!this.isNil(cl)) {
      trace.push(this.toString(this.car(cl), true));
      cl = this.cdr(cl);
    }
    this.calllist = this.nil;
    throw new FeRuntimeError(msg, trace);
  }

  checkType(obj, expectedType) {
    if (obj.type !== expectedType) {
      this.error(`expected ${FE_TYPENAMES[expectedType]}, got ${FE_TYPENAMES[obj.type]}`);
    }
    return obj;
  }

  type(obj) {
    return obj.type;
  }

  isNil(obj) {
    return obj === this.nil || obj.type === FE_TYPE.NIL;
  }

  /* ------------------------------------------------------------------------
   * Constructors & List Operations
   * ------------------------------------------------------------------------ */

  cons(car, cdr) {
    return new FeObject(FE_TYPE.PAIR, car, cdr);
  }

  bool(b) {
    return b ? this.t : this.nil;
  }

  number(n) {
    if (typeof n !== "number" || Number.isNaN(n)) {
      this.error("invalid number value");
    }
    return new FeObject(FE_TYPE.NUMBER, null, n);
  }

  string(str) {
    return new FeObject(FE_TYPE.STRING, null, String(str));
  }

  /**
   * Interned symbol lookup/creation.
   * In fe.c, a symbol's cdr is a pair `(nameString . globalValue)`
   */
  symbol(name) {
    let cur = this.symlist;
    while (!this.isNil(cur)) {
      const sym = cur.car;
      if (sym.cdr.car.cdr === name) {
        return sym;
      }
      cur = cur.cdr;
    }
    const sym = new FeObject(
      FE_TYPE.SYMBOL,
      null,
      this.cons(this.string(name), this.nil)
    );
    this.symlist = this.cons(sym, this.symlist);
    return sym;
  }

  cfunc(fn) {
    return new FeObject(FE_TYPE.CFUNC, null, fn);
  }

  ptr(val) {
    return new FeObject(FE_TYPE.PTR, null, val);
  }

  list(objs) {
    let res = this.nil;
    for (let i = objs.length - 1; i >= 0; i--) {
      res = this.cons(objs[i], res);
    }
    return res;
  }

  car(obj) {
    if (this.isNil(obj)) return obj;
    return this.checkType(obj, FE_TYPE.PAIR).car;
  }

  cdr(obj) {
    if (this.isNil(obj)) return obj;
    return this.checkType(obj, FE_TYPE.PAIR).cdr;
  }

  nextArg(argState) {
    const a = argState.list;
    if (a.type !== FE_TYPE.PAIR) {
      if (this.isNil(a)) this.error("too few arguments");
      this.error("dotted pair in argument list");
    }
    argState.list = a.cdr;
    return a.car;
  }

  toNumber(obj) {
    return this.checkType(obj, FE_TYPE.NUMBER).cdr;
  }

  toPtr(obj) {
    return this.checkType(obj, FE_TYPE.PTR).cdr;
  }

  /* ------------------------------------------------------------------------
   * Environment Lookup & Global Binding
   * ------------------------------------------------------------------------ */

  _getBound(sym, env) {
    let cur = env;
    while (!this.isNil(cur)) {
      const pair = cur.car;
      if (pair.car === sym) {
        return pair;
      }
      cur = cur.cdr;
    }
    // Fallback to global binding cell stored in sym.cdr
    return sym.cdr;
  }

  set(symOrName, val) {
    const sym = typeof symOrName === "string" ? this.symbol(symOrName) : symOrName;
    const feVal = val instanceof FeObject ? val : this.fromJS(val);
    this._getBound(sym, this.nil).cdr = feVal;
    return feVal;
  }

  get(symOrName) {
    const sym = typeof symOrName === "string" ? this.symbol(symOrName) : symOrName;
    const val = this._getBound(sym, this.nil).cdr;
    return val && val.type !== undefined ? val : this.nil;
  }

  /* ------------------------------------------------------------------------
   * Reader & Printer (fe_read / fe_write)
   * ------------------------------------------------------------------------ */

  toString(obj, qt = true) {
    if (!obj || obj.type === undefined) return "nil";
    switch (obj.type) {
      case FE_TYPE.NIL:
        return "nil";
      case FE_TYPE.NUMBER:
        return String(Number(obj.cdr.toPrecision(7)));
      case FE_TYPE.PAIR: {
        const parts = [];
        let cur = obj;
        while (cur.type === FE_TYPE.PAIR) {
          parts.push(this.toString(cur.car, true));
          cur = cur.cdr;
        }
        if (!this.isNil(cur)) {
          parts.push(".");
          parts.push(this.toString(cur, true));
        }
        return `(${parts.join(" ")})`;
      }
      case FE_TYPE.SYMBOL:
        return obj.cdr.car.cdr;
      case FE_TYPE.STRING:
        if (!qt) return obj.cdr;
        return `"${obj.cdr.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
      default:
        return `[${FE_TYPENAMES[obj.type]} #${obj.id}]`;
    }
  }

  read(stream) {
    const obj = this._read(stream);
    if (obj === this._rparen) {
      this.error("stray ')'");
    }
    return obj;
  }

  _read(stream) {
    const isDelimiter = (ch) => ch === "\0" || " \n\t\r();".includes(ch);
    let chr = this.nextchr ? this.nextchr : stream.readChar();
    this.nextchr = "";

    while (chr !== "\0" && " \n\t\r".includes(chr)) {
      chr = stream.readChar();
    }

    switch (chr) {
      case "\0":
        return null;

      case ";":
        while (chr !== "\0" && chr !== "\n") {
          chr = stream.readChar();
        }
        return this._read(stream);

      case ")":
        return this._rparen;

      case "(": {
        let res = this.nil;
        let tail = null;
        let v;
        while ((v = this._read(stream)) !== this._rparen) {
          if (v === null) {
            this.error("unclosed list");
          }
          if (v.type === FE_TYPE.SYMBOL && v.cdr.car.cdr === ".") {
            const dotted = this.read(stream);
            if (!dotted) this.error("unclosed list");
            if (tail) {
              tail.cdr = dotted;
            } else {
              res = dotted;
            }
          } else {
            const cell = this.cons(v, this.nil);
            if (tail) {
              tail.cdr = cell;
            } else {
              res = cell;
            }
            tail = cell;
          }
        }
        return res;
      }

      case "'": {
        const v = this.read(stream);
        if (!v) this.error("stray '''");
        return this.cons(this.symbol("quote"), this.cons(v, this.nil));
      }

      case '"': {
        let str = "";
        chr = stream.readChar();
        while (chr !== '"') {
          if (chr === "\0") this.error("unclosed string");
          if (chr === "\\") {
            chr = stream.readChar();
            if (chr === "n") chr = "\n";
            else if (chr === "r") chr = "\r";
            else if (chr === "t") chr = "\t";
          }
          str += chr;
          chr = stream.readChar();
        }
        return this.string(str);
      }

      default: {
        let buf = "";
        while (!isDelimiter(chr)) {
          buf += chr;
          chr = stream.readChar();
        }
        this.nextchr = chr === "\0" ? "" : chr;

        if (buf !== "" && !Number.isNaN(Number(buf))) {
          return this.number(Number(buf));
        }
        if (buf === "nil") {
          return this.nil;
        }
        return this.symbol(buf);
      }
    }
  }

  /* ------------------------------------------------------------------------
   * Evaluator (fe_eval)
   * ------------------------------------------------------------------------ */

  eval(obj) {
    return this._eval(obj, this.nil, null);
  }

  evalString(source) {
    this.nextchr = "";
    const stream = new StringStream(source);
    let result = this.nil;
    let expr;
    while ((expr = this.read(stream)) !== null) {
      result = this.eval(expr);
    }
    return result;
  }

  _evalList(lst, env) {
    let res = this.nil;
    let tail = null;
    const argState = { list: lst };
    while (!this.isNil(argState.list)) {
      const item = this.nextArg(argState);
      const evaluated = this._eval(item, env, null);
      const cell = this.cons(evaluated, this.nil);
      if (tail) {
        tail.cdr = cell;
      } else {
        res = cell;
      }
      tail = cell;
    }
    return res;
  }

  _doList(lst, env) {
    let res = this.nil;
    let curEnv = env;
    const argState = { list: lst };
    while (!this.isNil(argState.list)) {
      const item = this.nextArg(argState);
      const envBox = { env: curEnv };
      res = this._eval(item, curEnv, envBox);
      curEnv = envBox.env;
    }
    return res;
  }

  _argsToEnv(prm, arg, env) {
    while (!this.isNil(prm)) {
      if (prm.type !== FE_TYPE.PAIR) {
        env = this.cons(this.cons(prm, arg), env);
        break;
      }
      env = this.cons(this.cons(prm.car, this.car(arg)), env);
      prm = prm.cdr;
      arg = this.cdr(arg);
    }
    return env;
  }

  _eval(obj, env, newEnvBox) {
    if (!obj || obj.type === undefined) {
      return this.nil;
    }
    if (obj.type === FE_TYPE.SYMBOL) {
      const val = this._getBound(obj, env).cdr;
      return val && val.type !== undefined ? val : this.nil;
    }
    if (obj.type !== FE_TYPE.PAIR) {
      return obj;
    }

    // Push onto call stack for tracebacks
    this.calllist = this.cons(obj, this.calllist);

    const fn = this._eval(obj.car, env, null);
    const argState = { list: obj.cdr };
    let res = this.nil;

    const evalArg = () => this._eval(this.nextArg(argState), env, null);

    switch (fn.type) {
      case FE_TYPE.PRIM: {
        switch (fn.cdr) {
          case PRIM.LET: {
            const sym = this.checkType(this.nextArg(argState), FE_TYPE.SYMBOL);
            const val = evalArg();
            if (newEnvBox) {
              newEnvBox.env = this.cons(this.cons(sym, val), env);
            }
            break;
          }

          case PRIM.SET: {
            const sym = this.checkType(this.nextArg(argState), FE_TYPE.SYMBOL);
            const val = evalArg();
            this._getBound(sym, env).cdr = val;
            break;
          }

          case PRIM.IF: {
            while (!this.isNil(argState.list)) {
              const cond = evalArg();
              if (!this.isNil(cond)) {
                res = this.isNil(argState.list) ? cond : evalArg();
                break;
              }
              if (this.isNil(argState.list)) break;
              argState.list = argState.list.cdr;
            }
            break;
          }

          case PRIM.FN:
          case PRIM.MAC: {
            const closureBody = this.cons(env, argState.list);
            this.nextArg(argState); // validate param list presence
            res = new FeObject(
              fn.cdr === PRIM.FN ? FE_TYPE.FUNC : FE_TYPE.MACRO,
              null,
              closureBody
            );
            break;
          }

          case PRIM.WHILE: {
            const condExpr = this.nextArg(argState);
            while (!this.isNil(this._eval(condExpr, env, null))) {
              this._doList(argState.list, env);
            }
            break;
          }

          case PRIM.QUOTE:
            res = this.nextArg(argState);
            break;

          case PRIM.AND:
            while (!this.isNil(argState.list) && !this.isNil(res = evalArg()));
            break;

          case PRIM.OR:
            while (!this.isNil(argState.list) && this.isNil(res = evalArg()));
            break;

          case PRIM.DO:
            res = this._doList(argState.list, env);
            break;

          case PRIM.CONS: {
            const a = evalArg();
            res = this.cons(a, evalArg());
            break;
          }

          case PRIM.CAR:
            res = this.car(evalArg());
            break;

          case PRIM.CDR:
            res = this.cdr(evalArg());
            break;

          case PRIM.SETCAR: {
            const pair = this.checkType(evalArg(), FE_TYPE.PAIR);
            pair.car = evalArg();
            break;
          }

          case PRIM.SETCDR: {
            const pair = this.checkType(evalArg(), FE_TYPE.PAIR);
            pair.cdr = evalArg();
            break;
          }

          case PRIM.LIST:
            res = this._evalList(argState.list, env);
            break;

          case PRIM.NOT:
            res = this.bool(this.isNil(evalArg()));
            break;

          case PRIM.IS: {
            const a = evalArg();
            const b = evalArg();
            res = this.bool(this._equal(a, b));
            break;
          }

          case PRIM.ATOM:
            res = this.bool(evalArg().type !== FE_TYPE.PAIR);
            break;

          case PRIM.PRINT: {
            const parts = [];
            while (!this.isNil(argState.list)) {
              parts.push(this.toString(evalArg(), false));
            }
            this.onPrint(parts.join(" "));
            break;
          }

          case PRIM.LT: {
            const a = this.toNumber(evalArg());
            const b = this.toNumber(evalArg());
            res = this.bool(a < b);
            break;
          }

          case PRIM.LTE: {
            const a = this.toNumber(evalArg());
            const b = this.toNumber(evalArg());
            res = this.bool(a <= b);
            break;
          }

          case PRIM.ADD: {
            let acc = this.toNumber(evalArg());
            while (!this.isNil(argState.list)) acc += this.toNumber(evalArg());
            res = this.number(acc);
            break;
          }

          case PRIM.SUB: {
            let acc = this.toNumber(evalArg());
            while (!this.isNil(argState.list)) acc -= this.toNumber(evalArg());
            res = this.number(acc);
            break;
          }

          case PRIM.MUL: {
            let acc = this.toNumber(evalArg());
            while (!this.isNil(argState.list)) acc *= this.toNumber(evalArg());
            res = this.number(acc);
            break;
          }

          case PRIM.DIV: {
            let acc = this.toNumber(evalArg());
            while (!this.isNil(argState.list)) {
              const divisor = this.toNumber(evalArg());
              acc /= divisor;
            }
            res = this.number(acc);
            break;
          }
        }
        break;
      }

      case FE_TYPE.CFUNC: {
        const evaledArgs = this._evalList(argState.list, env);
        res = fn.cdr(this, evaledArgs);
        if (!(res instanceof FeObject)) {
          res = this.fromJS(res);
        }
        break;
      }

      case FE_TYPE.FUNC: {
        const evaledArgs = this._evalList(argState.list, env);
        const capturedEnv = fn.cdr.car;
        const paramsAndBody = fn.cdr.cdr;
        const localEnv = this._argsToEnv(paramsAndBody.car, evaledArgs, capturedEnv);
        res = this._doList(paramsAndBody.cdr, localEnv);
        break;
      }

      case FE_TYPE.MACRO: {
        const capturedEnv = fn.cdr.car;
        const paramsAndBody = fn.cdr.cdr;
        const localEnv = this._argsToEnv(paramsAndBody.car, argState.list, capturedEnv);
        const expanded = this._doList(paramsAndBody.cdr, localEnv);

        // Mutate caller AST node in-place just like `*obj = *expanded` in fe.c
        obj.type = expanded.type;
        obj.car = expanded.car;
        obj.cdr = expanded.cdr;

        this.calllist = this.calllist.cdr;
        return this._eval(obj, env, null);
      }

      default:
        this.error("tried to call non-callable value");
    }

    this.calllist = this.calllist.cdr;
    return res;
  }

  _equal(a, b) {
    if (a === b) return true;
    if (a.type !== b.type) return false;
    if (a.type === FE_TYPE.NUMBER || a.type === FE_TYPE.STRING) {
      return a.cdr === b.cdr;
    }
    return false;
  }

  /* ------------------------------------------------------------------------
   * JavaScript Interop & Extension Bridge
   * ------------------------------------------------------------------------ */

  toArray(pair) {
    const arr = [];
    let cur = pair;
    while (!this.isNil(cur)) {
      if (cur.type !== FE_TYPE.PAIR) {
        arr.push(this.toJS(cur));
        break;
      }
      arr.push(this.toJS(cur.car));
      cur = cur.cdr;
    }
    return arr;
  }

  toJS(obj) {
    if (!obj || this.isNil(obj)) return null;
    if (obj === this.t) return true;
    switch (obj.type) {
      case FE_TYPE.NUMBER:
      case FE_TYPE.STRING:
      case FE_TYPE.PTR:
        return obj.cdr;
      case FE_TYPE.SYMBOL:
        return obj.cdr.car.cdr;
      case FE_TYPE.PAIR:
        return this.toArray(obj);
      default:
        return obj;
    }
  }

  fromJS(val) {
    if (val instanceof FeObject) return val;
    if (val === null || val === undefined || val === false) return this.nil;
    if (val === true) return this.t;
    if (typeof val === "number") return this.number(val);
    if (typeof val === "string") return this.string(val);
    if (Array.isArray(val)) {
      return this.list(val.map((item) => this.fromJS(item)));
    }
    if (typeof val === "function") {
      return this.cfunc((ctx, argsPair) => {
        const jsArgs = ctx.toArray(argsPair);
        return ctx.fromJS(val(ctx, ...jsArgs));
      });
    }
    return this.ptr(val);
  }

  defineRaw(name, cfunc) {
    const fnObj = this.cfunc(cfunc);
    this.set(this.symbol(name), fnObj);
    return fnObj;
  }

  define(name, jsFn) {
    return this.defineRaw(name, (ctx, argsPair) => {
      const jsArgs = ctx.toArray(argsPair);
      const result = jsFn(ctx, ...jsArgs);
      return ctx.fromJS(result);
    });
  }
}
