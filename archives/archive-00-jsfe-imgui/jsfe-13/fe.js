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
  constructor(type, car = null, cdr = null, line = null, col = null) {
    this.id = _nextObjId++;
    this.type = type;
    this.car = car;
    this.cdr = cdr;
    this.line = line;
    this.col = col;
  }
}

/**
 * Custom Error class carrying source position and the fe evaluation call stack trace
 */
class FeRuntimeError extends Error {
  constructor(message, trace = [], line = null, col = null) {
    super(message);
    this.name = "FeRuntimeError";
    this.trace = trace;
    this.line = line;
    this.col = col;
  }
}

/**
 * Reader state wrapper for string input streams with line:column tracking
 */
class StringStream {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.col = 0;
  }

  readChar() {
    if (this.pos >= this.source.length) return "\0";
    const ch = this.source[this.pos++];
    if (ch === "\n") {
      this.line++;
      this.col = 0;
    } else {
      this.col++;
    }
    return ch;
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
    // Single-char lookahead buffer and its source coordinates for reader
    this.nextchr = "";
    this.nextline = 1;
    this.nextcol = 0;

    // Intern `t` symbol and bind it to itself
    this.t = this.symbol("t");
    this.set(this.t, this.t);

    // Register all 26 built-in primitives
    for (let i = 0; i < PRIM_NAMES.length; i++) {
      const primObj = new FeObject(FE_TYPE.PRIM, null, i);
      this.set(this.symbol(PRIM_NAMES[i]), primObj);
    }
  }

  _resetLookahead() {
    this.nextchr = "";
    this.nextline = 1;
    this.nextcol = 0;
  }

  _readWithPos(stream) {
    if (this.nextchr) {
      const ch = this.nextchr;
      const line = this.nextline;
      const col = this.nextcol;
      this.nextchr = "";
      return { ch, line, col };
    }
    const line = stream.line;
    const col = stream.col + 1;
    const ch = stream.readChar();
    return { ch, line, col };
  }

  _unreadWithPos(ch, line, col) {
    if (ch === "\0") {
      this.nextchr = "";
      return;
    }
    this.nextchr = ch;
    this.nextline = line;
    this.nextcol = col;
  }

  /* ------------------------------------------------------------------------
   * Error Handling & Type Checking
   * ------------------------------------------------------------------------ */

  error(msg, line = null, col = null) {
    const trace = [];
    let cl = this.calllist;
    let resolvedLine = line;
    let resolvedCol = col;

    while (!this.isNil(cl)) {
      const frame = this.car(cl);
      if ((resolvedLine === null || resolvedCol === null) && frame && frame.line != null && frame.col != null) {
        resolvedLine = frame.line;
        resolvedCol = frame.col;
      }
      const loc = frame && frame.line != null && frame.col != null
        ? ` (${frame.line}:${frame.col})`
        : "";
      trace.push(`${this.toString(frame, true)}${loc}`);
      cl = this.cdr(cl);
    }

    this.calllist = this.nil;
    throw new FeRuntimeError(msg, trace, resolvedLine, resolvedCol);
  }

  checkType(obj, expectedType) {
    if (obj.type !== expectedType) {
      this.error(
        `expected ${FE_TYPENAMES[expectedType]}, got ${FE_TYPENAMES[obj.type]}`,
        obj.line ?? null,
        obj.col ?? null
      );
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

  cons(car, cdr, line = null, col = null) {
    return new FeObject(FE_TYPE.PAIR, car, cdr, line, col);
  }

  bool(b) {
    return b ? this.t : this.nil;
  }

  number(n, line = null, col = null) {
    if (typeof n !== "number" || Number.isNaN(n)) {
      this.error("invalid number value", line, col);
    }
    return new FeObject(FE_TYPE.NUMBER, null, n, line, col);
  }

  string(str, line = null, col = null) {
    return new FeObject(FE_TYPE.STRING, null, String(str), line, col);
  }

  /**
   * Interned symbol lookup/creation.
   * In fe.c, a symbol's cdr is a pair `(nameString . globalValue)`
   */
  symbol(name, line = null, col = null) {
    let cur = this.symlist;
    while (!this.isNil(cur)) {
      const sym = cur.car;
      if (sym.cdr.car.cdr === name) {
        return new FeObject(FE_TYPE.SYMBOL, null, sym.cdr, line ?? sym.line, col ?? sym.col);
      }
      cur = cur.cdr;
    }
    const sym = new FeObject(
      FE_TYPE.SYMBOL,
      null,
      this.cons(this.string(name), this.nil),
      line,
      col
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
      if (this.isNil(a)) {
        this.error("too few arguments", argState.line ?? null, argState.col ?? null);
      }
      this.error("dotted pair in argument list", a.line ?? argState.line ?? null, a.col ?? argState.col ?? null);
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
      if (pair.car.cdr.car.cdr === sym.cdr.car.cdr) {
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
    if (obj && obj.obj === this._rparen) {
      this.error("stray ')'", obj.line, obj.col);
    }
    return obj ? obj.obj : null;
  }

  _read(stream) {
    const isDelimiter = (ch) => ch === "\0" || " \n\t\r();".includes(ch);
    let token = this._readWithPos(stream);

    while (token.ch !== "\0" && " \n\t\r".includes(token.ch)) {
      token = this._readWithPos(stream);
    }

    const startLine = token.line;
    const startCol = token.col;

    switch (token.ch) {
      case "\0":
        return null;

      case ";":
        while (token.ch !== "\0" && token.ch !== "\n") {
          token = this._readWithPos(stream);
        }
        return this._read(stream);

      case ")":
        return { obj: this._rparen, line: startLine, col: startCol };

      case "(": {
        let res = this.nil;
        let tail = null;
        let item;
        while ((item = this._read(stream)) === null || item.obj !== this._rparen) {
          if (item === null) {
            this.error("unclosed list", startLine, startCol);
          }
          const v = item.obj;
          if (v.type === FE_TYPE.SYMBOL && v.cdr.car.cdr === ".") {
            const dottedItem = this._read(stream);
            if (!dottedItem || dottedItem.obj === this._rparen) {
              this.error("unclosed list", startLine, startCol);
            }
            const dotted = dottedItem.obj;
            if (tail) {
              tail.cdr = dotted;
            } else {
              res = dotted;
            }
          } else {
            const cell = this.cons(v, this.nil, item.line, item.col);
            if (tail) {
              tail.cdr = cell;
            } else {
              res = cell;
            }
            tail = cell;
          }
        }
        if (res.type === FE_TYPE.PAIR) {
          res.line = startLine;
          res.col = startCol;
        }
        return { obj: res, line: startLine, col: startCol };
      }

      case "'": {
        const vItem = this._read(stream);
        if (!vItem || vItem.obj === this._rparen) {
          this.error("stray '''", startLine, startCol);
        }
        const quoted = this.cons(
          this.symbol("quote", startLine, startCol),
          this.cons(vItem.obj, this.nil, vItem.line, vItem.col),
          startLine,
          startCol
        );
        return { obj: quoted, line: startLine, col: startCol };
      }

      case '"': {
        let str = "";
        let cur = this._readWithPos(stream);
        while (cur.ch !== '"') {
          if (cur.ch === "\0") {
            this.error("unclosed string", startLine, startCol);
          }
          if (cur.ch === "\\") {
            cur = this._readWithPos(stream);
            if (cur.ch === "\0") {
              this.error("unclosed string", startLine, startCol);
            }
            if (cur.ch === "n") cur.ch = "\n";
            else if (cur.ch === "r") cur.ch = "\r";
            else if (cur.ch === "t") cur.ch = "\t";
          }
          str += cur.ch;
          cur = this._readWithPos(stream);
        }
        return {
          obj: this.string(str, startLine, startCol),
          line: startLine,
          col: startCol
        };
      }

      default: {
        let buf = "";
        let cur = token;
        while (!isDelimiter(cur.ch)) {
          buf += cur.ch;
          cur = this._readWithPos(stream);
        }
        this._unreadWithPos(cur.ch, cur.line, cur.col);

        if (buf !== "" && !Number.isNaN(Number(buf))) {
          return {
            obj: this.number(Number(buf), startLine, startCol),
            line: startLine,
            col: startCol
          };
        }
        if (buf === "nil") {
          const nilObj = new FeObject(FE_TYPE.NIL, null, null, startLine, startCol);
          return { obj: nilObj, line: startLine, col: startCol };
        }
        return {
          obj: this.symbol(buf, startLine, startCol),
          line: startLine,
          col: startCol
        };
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
    this._resetLookahead();
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
    const argState = { list: lst, line: lst?.line ?? null, col: lst?.col ?? null };
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
    const argState = { list: lst, line: lst?.line ?? null, col: lst?.col ?? null };
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
    const argState = {
      list: obj.cdr,
      line: obj.line ?? obj.car?.line ?? null,
      col: obj.col ?? obj.car?.col ?? null
    };
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
            const printed = parts.join(" ");
            this.onPrint(printed);
            res = parts.length > 0 ? this.string(printed) : this.nil;
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
        if (expanded.line != null && expanded.col != null) {
          obj.line = expanded.line;
          obj.col = expanded.col;
        }

        this.calllist = this.calllist.cdr;
        return this._eval(obj, env, null);
      }

      default:
        this.error(
          "tried to call non-callable value",
          obj.car?.line ?? obj.line ?? null,
          obj.car?.col ?? obj.col ?? null
        );
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
