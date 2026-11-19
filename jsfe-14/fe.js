/**
 * ============================================================================
 * fe.js — Modern OOP JavaScript Port of rxi's `fe` Tiny Lisp Interpreter
 * Faithful to fe.h and fe.c (v1.0) with Seamless JS Interop Bridge
 * ============================================================================
 */

class FeType {
  static PAIR = 0;
  static FREE = 1;
  static NIL = 2;
  static NUMBER = 3;
  static SYMBOL = 4;
  static STRING = 5;
  static FUNC = 6;
  static MACRO = 7;
  static PRIM = 8;
  static CFUNC = 9;
  static PTR = 10;

  static NAMES = Object.freeze([
    "pair", "free", "nil", "number", "symbol", "string",
    "func", "macro", "prim", "cfunc", "ptr"
  ]);

  static nameOf(type) {
    return FeType.NAMES[type] ?? "unknown";
  }
}

class FePrimitive {
  static LET = 0;
  static SET = 1;
  static IF = 2;
  static FN = 3;
  static MAC = 4;
  static WHILE = 5;
  static QUOTE = 6;
  static AND = 7;
  static OR = 8;
  static DO = 9;
  static CONS = 10;
  static CAR = 11;
  static CDR = 12;
  static SETCAR = 13;
  static SETCDR = 14;
  static LIST = 15;
  static NOT = 16;
  static IS = 17;
  static ATOM = 18;
  static PRINT = 19;
  static LT = 20;
  static LTE = 21;
  static ADD = 22;
  static SUB = 23;
  static MUL = 24;
  static DIV = 25;

  static NAMES = Object.freeze([
    "let", "=", "if", "fn", "mac", "while", "quote", "and", "or", "do", "cons",
    "car", "cdr", "setcar", "setcdr", "list", "not", "is", "atom", "print", "<",
    "<=", "+", "-", "*", "/"
  ]);
}

// Preserve legacy constants for any external callers
const FE_TYPE = Object.freeze({ ...FeType });
const FE_TYPENAMES = FeType.NAMES;
const PRIM = Object.freeze({ ...FePrimitive });
const PRIM_NAMES = FePrimitive.NAMES;

/**
 * Represents a tagged fe_Object (analogous to union Value car, cdr in fe.c)
 */
class FeObject {
  static #nextId = 1;

  constructor(type, car = null, cdr = null, line = null, col = null) {
    this.id = FeObject.#nextId++;
    this.type = type;
    this.car = car;
    this.cdr = cdr;
    this.line = line;
    this.col = col;
  }

  get hasLocation() {
    return this.line != null && this.col != null;
  }

  get locationText() {
    return this.hasLocation ? `${this.line}:${this.col}` : null;
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
  #source;
  #pos;

  constructor(source) {
    this.#source = String(source ?? "");
    this.#pos = 0;
    this.line = 1;
    this.col = 0;
  }

  readChar() {
    if (this.#pos >= this.#source.length) return "\0";
    const ch = this.#source[this.#pos++];
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
  #onPrint;
  #rparen;
  #nextchr = "";
  #nextline = 1;
  #nextcol = 0;

  constructor(options = {}) {
    this.#onPrint = options.onPrint ?? ((text) => console.log(text));

    // Singleton nil object (FE_TNIL) and internal sentinel for ')'
    this.nil = new FeObject(FeType.NIL, null, null);
    this.#rparen = new FeObject(FeType.NIL, null, null);

    // Symbol table and evaluation call stack
    this.symlist = this.nil;
    this.calllist = this.nil;

    // Intern `t` symbol and bind it to itself
    this.t = this.symbol("t");
    this.set(this.t, this.t);

    this.#registerPrimitives();
  }

  #registerPrimitives() {
    FePrimitive.NAMES.forEach((name, index) => {
      const primObj = new FeObject(FeType.PRIM, null, index);
      this.set(this.symbol(name), primObj);
    });
  }

  resetLookahead() {
    this.#nextchr = "";
    this.#nextline = 1;
    this.#nextcol = 0;
  }

  #readWithPos(stream) {
    if (this.#nextchr) {
      const token = {
        ch: this.#nextchr,
        line: this.#nextline,
        col: this.#nextcol
      };
      this.#nextchr = "";
      return token;
    }
    const line = stream.line;
    const col = stream.col + 1;
    const ch = stream.readChar();
    return { ch, line, col };
  }

  #unreadWithPos(ch, line, col) {
    if (ch === "\0") {
      this.#nextchr = "";
      return;
    }
    this.#nextchr = ch;
    this.#nextline = line;
    this.#nextcol = col;
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
      if ((resolvedLine === null || resolvedCol === null) && frame?.hasLocation) {
        resolvedLine = frame.line;
        resolvedCol = frame.col;
      }
      const loc = frame?.hasLocation ? ` (${frame.locationText})` : "";
      trace.push(`${this.toString(frame, true)}${loc}`);
      cl = this.cdr(cl);
    }

    this.calllist = this.nil;
    throw new FeRuntimeError(msg, trace, resolvedLine, resolvedCol);
  }

  checkType(obj, expectedType) {
    if (obj.type !== expectedType) {
      this.error(
        `expected ${FeType.nameOf(expectedType)}, got ${FeType.nameOf(obj.type)}`,
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
    return obj === this.nil || obj?.type === FeType.NIL;
  }

  /* ------------------------------------------------------------------------
   * Constructors & List Operations
   * ------------------------------------------------------------------------ */

  cons(car, cdr, line = null, col = null) {
    return new FeObject(FeType.PAIR, car, cdr, line, col);
  }

  bool(b) {
    return b ? this.t : this.nil;
  }

  number(n, line = null, col = null) {
    if (typeof n !== "number" || Number.isNaN(n)) {
      this.error("invalid number value", line, col);
    }
    return new FeObject(FeType.NUMBER, null, n, line, col);
  }

  string(str, line = null, col = null) {
    return new FeObject(FeType.STRING, null, String(str), line, col);
  }

  /**
   * Interned symbol lookup/creation.
   * A symbol's cdr is a pair `(nameString . globalValue)`
   */
  symbol(name, line = null, col = null) {
    let cur = this.symlist;
    while (!this.isNil(cur)) {
      const sym = cur.car;
      if (sym.cdr.car.cdr === name) {
        return new FeObject(
          FeType.SYMBOL,
          null,
          sym.cdr,
          line ?? sym.line,
          col ?? sym.col
        );
      }
      cur = cur.cdr;
    }

    const sym = new FeObject(
      FeType.SYMBOL,
      null,
      this.cons(this.string(name), this.nil),
      line,
      col
    );
    this.symlist = this.cons(sym, this.symlist);
    return sym;
  }

  cfunc(fn) {
    return new FeObject(FeType.CFUNC, null, fn);
  }

  ptr(val) {
    return new FeObject(FeType.PTR, null, val);
  }

  list(objs) {
    return objs.reduceRight((acc, item) => this.cons(item, acc), this.nil);
  }

  car(obj) {
    if (this.isNil(obj)) return obj;
    return this.checkType(obj, FeType.PAIR).car;
  }

  cdr(obj) {
    if (this.isNil(obj)) return obj;
    return this.checkType(obj, FeType.PAIR).cdr;
  }

  nextArg(argState) {
    const a = argState.list;
    if (a.type !== FeType.PAIR) {
      if (this.isNil(a)) {
        this.error("too few arguments", argState.line ?? null, argState.col ?? null);
      }
      this.error(
        "dotted pair in argument list",
        a.line ?? argState.line ?? null,
        a.col ?? argState.col ?? null
      );
    }
    argState.list = a.cdr;
    return a.car;
  }

  toNumber(obj) {
    return this.checkType(obj, FeType.NUMBER).cdr;
  }

  toPtr(obj) {
    return this.checkType(obj, FeType.PTR).cdr;
  }

  /* ------------------------------------------------------------------------
   * Environment Lookup & Global Binding
   * ------------------------------------------------------------------------ */

  #getBound(sym, env) {
    let cur = env;
    while (!this.isNil(cur)) {
      const pair = cur.car;
      if (pair.car.cdr.car.cdr === sym.cdr.car.cdr) {
        return pair;
      }
      cur = cur.cdr;
    }
    return sym.cdr;
  }

  set(symOrName, val) {
    const sym = typeof symOrName === "string" ? this.symbol(symOrName) : symOrName;
    const feVal = val instanceof FeObject ? val : this.fromJS(val);
    this.#getBound(sym, this.nil).cdr = feVal;
    return feVal;
  }

  get(symOrName) {
    const sym = typeof symOrName === "string" ? this.symbol(symOrName) : symOrName;
    const val = this.#getBound(sym, this.nil).cdr;
    return val && val.type !== undefined ? val : this.nil;
  }

  /* ------------------------------------------------------------------------
   * Reader & Printer (fe_read / fe_write)
   * ------------------------------------------------------------------------ */

  toString(obj, qt = true) {
    if (!obj || obj.type === undefined) return "nil";

    switch (obj.type) {
      case FeType.NIL:
        return "nil";

      case FeType.NUMBER:
        return String(Number(obj.cdr.toPrecision(7)));

      case FeType.PAIR: {
        const parts = [];
        let cur = obj;
        while (cur.type === FeType.PAIR) {
          parts.push(this.toString(cur.car, true));
          cur = cur.cdr;
        }
        if (!this.isNil(cur)) {
          parts.push(".", this.toString(cur, true));
        }
        return `(${parts.join(" ")})`;
      }

      case FeType.SYMBOL:
        return obj.cdr.car.cdr;

      case FeType.STRING:
        if (!qt) return obj.cdr;
        return `"${obj.cdr
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t")}"`;

      default:
        return `[${FeType.nameOf(obj.type)} #${obj.id}]`;
    }
  }

  read(stream) {
    const entry = this.#readEntry(stream);
    if (entry?.obj === this.#rparen) {
      this.error("stray ')'", entry.line, entry.col);
    }
    return entry ? entry.obj : null;
  }

  #readEntry(stream) {
    const isDelimiter = (ch) => ch === "\0" || " \n\t\r();".includes(ch);
    let token = this.#readWithPos(stream);

    while (token.ch !== "\0" && " \n\t\r".includes(token.ch)) {
      token = this.#readWithPos(stream);
    }

    const startLine = token.line;
    const startCol = token.col;

    switch (token.ch) {
      case "\0":
        return null;

      case ";":
        while (token.ch !== "\0" && token.ch !== "\n") {
          token = this.#readWithPos(stream);
        }
        return this.#readEntry(stream);

      case ")":
        return { obj: this.#rparen, line: startLine, col: startCol };

      case "(":
        return this.#readListEntry(stream, startLine, startCol);

      case "'":
        return this.#readQuoteEntry(stream, startLine, startCol);

      case '"':
        return this.#readStringEntry(stream, startLine, startCol);

      default:
        return this.#readAtomEntry(stream, token, isDelimiter, startLine, startCol);
    }
  }

  #readListEntry(stream, startLine, startCol) {
    let res = this.nil;
    let tail = null;
    let item;

    while ((item = this.#readEntry(stream)) === null || item.obj !== this.#rparen) {
      if (item === null) {
        this.error("unclosed list", startLine, startCol);
      }

      const v = item.obj;
      if (v.type === FeType.SYMBOL && v.cdr.car.cdr === ".") {
        const dottedItem = this.#readEntry(stream);
        if (!dottedItem || dottedItem.obj === this.#rparen) {
          this.error("unclosed list", startLine, startCol);
        }
        if (tail) {
          tail.cdr = dottedItem.obj;
        } else {
          res = dottedItem.obj;
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

    if (res.type === FeType.PAIR) {
      res.line = startLine;
      res.col = startCol;
    }
    return { obj: res, line: startLine, col: startCol };
  }

  #readQuoteEntry(stream, startLine, startCol) {
    const vItem = this.#readEntry(stream);
    if (!vItem || vItem.obj === this.#rparen) {
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

  #readStringEntry(stream, startLine, startCol) {
    const escapes = { n: "\n", r: "\r", t: "\t" };
    let str = "";
    let cur = this.#readWithPos(stream);

    while (cur.ch !== '"') {
      if (cur.ch === "\0") {
        this.error("unclosed string", startLine, startCol);
      }
      if (cur.ch === "\\") {
        cur = this.#readWithPos(stream);
        if (cur.ch === "\0") {
          this.error("unclosed string", startLine, startCol);
        }
        str += escapes[cur.ch] ?? cur.ch;
      } else {
        str += cur.ch;
      }
      cur = this.#readWithPos(stream);
    }

    return {
      obj: this.string(str, startLine, startCol),
      line: startLine,
      col: startCol
    };
  }

  #readAtomEntry(stream, startToken, isDelimiter, startLine, startCol) {
    let buf = "";
    let cur = startToken;

    while (!isDelimiter(cur.ch)) {
      buf += cur.ch;
      cur = this.#readWithPos(stream);
    }
    this.#unreadWithPos(cur.ch, cur.line, cur.col);

    if (buf !== "" && !Number.isNaN(Number(buf))) {
      return {
        obj: this.number(Number(buf), startLine, startCol),
        line: startLine,
        col: startCol
      };
    }

    if (buf === "nil") {
      return {
        obj: new FeObject(FeType.NIL, null, null, startLine, startCol),
        line: startLine,
        col: startCol
      };
    }

    return {
      obj: this.symbol(buf, startLine, startCol),
      line: startLine,
      col: startCol
    };
  }

  /* ------------------------------------------------------------------------
   * Evaluator (fe_eval)
   * ------------------------------------------------------------------------ */

  eval(obj) {
    return this.#eval(obj, this.nil, null);
  }

  evalString(source) {
    this.resetLookahead();
    const stream = new StringStream(source);
    let result = this.nil;
    let expr;

    while ((expr = this.read(stream)) !== null) {
      result = this.eval(expr);
    }
    return result;
  }

  #evalList(lst, env) {
    let res = this.nil;
    let tail = null;
    const argState = { list: lst, line: lst?.line ?? null, col: lst?.col ?? null };

    while (!this.isNil(argState.list)) {
      const item = this.nextArg(argState);
      const evaluated = this.#eval(item, env, null);
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

  #doList(lst, env) {
    let res = this.nil;
    let curEnv = env;
    const argState = { list: lst, line: lst?.line ?? null, col: lst?.col ?? null };

    while (!this.isNil(argState.list)) {
      const item = this.nextArg(argState);
      const envBox = { env: curEnv };
      res = this.#eval(item, curEnv, envBox);
      curEnv = envBox.env;
    }
    return res;
  }

  #argsToEnv(prm, arg, env) {
    while (!this.isNil(prm)) {
      if (prm.type !== FeType.PAIR) {
        env = this.cons(this.cons(prm, arg), env);
        break;
      }
      env = this.cons(this.cons(prm.car, this.car(arg)), env);
      prm = prm.cdr;
      arg = this.cdr(arg);
    }
    return env;
  }

  #evalPrimitive(primCode, argState, env, newEnvBox, evalArg) {
    let res = this.nil;

    switch (primCode) {
      case FePrimitive.LET: {
        const sym = this.checkType(this.nextArg(argState), FeType.SYMBOL);
        const val = evalArg();
        if (newEnvBox) {
          newEnvBox.env = this.cons(this.cons(sym, val), env);
        }
        break;
      }

      case FePrimitive.SET: {
        const sym = this.checkType(this.nextArg(argState), FeType.SYMBOL);
        const val = evalArg();
        this.#getBound(sym, env).cdr = val;
        break;
      }

      case FePrimitive.IF: {
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

      case FePrimitive.FN:
      case FePrimitive.MAC: {
        const closureBody = this.cons(env, argState.list);
        this.nextArg(argState);
        res = new FeObject(
          primCode === FePrimitive.FN ? FeType.FUNC : FeType.MACRO,
          null,
          closureBody
        );
        break;
      }

      case FePrimitive.WHILE: {
        const condExpr = this.nextArg(argState);
        while (!this.isNil(this.#eval(condExpr, env, null))) {
          this.#doList(argState.list, env);
        }
        break;
      }

      case FePrimitive.QUOTE:
        res = this.nextArg(argState);
        break;

      case FePrimitive.AND:
        while (!this.isNil(argState.list) && !this.isNil(res = evalArg()));
        break;

      case FePrimitive.OR:
        while (!this.isNil(argState.list) && this.isNil(res = evalArg()));
        break;

      case FePrimitive.DO:
        res = this.#doList(argState.list, env);
        break;

      case FePrimitive.CONS: {
        const a = evalArg();
        res = this.cons(a, evalArg());
        break;
      }

      case FePrimitive.CAR:
        res = this.car(evalArg());
        break;

      case FePrimitive.CDR:
        res = this.cdr(evalArg());
        break;

      case FePrimitive.SETCAR: {
        const pair = this.checkType(evalArg(), FeType.PAIR);
        pair.car = evalArg();
        break;
      }

      case FePrimitive.SETCDR: {
        const pair = this.checkType(evalArg(), FeType.PAIR);
        pair.cdr = evalArg();
        break;
      }

      case FePrimitive.LIST:
        res = this.#evalList(argState.list, env);
        break;

      case FePrimitive.NOT:
        res = this.bool(this.isNil(evalArg()));
        break;

      case FePrimitive.IS: {
        const a = evalArg();
        const b = evalArg();
        res = this.bool(this.#equal(a, b));
        break;
      }

      case FePrimitive.ATOM:
        res = this.bool(evalArg().type !== FeType.PAIR);
        break;

      case FePrimitive.PRINT: {
        const parts = [];
        while (!this.isNil(argState.list)) {
          parts.push(this.toString(evalArg(), false));
        }
        const printed = parts.join(" ");
        this.#onPrint(printed);
        res = parts.length > 0 ? this.string(printed) : this.nil;
        break;
      }

      case FePrimitive.LT: {
        const a = this.toNumber(evalArg());
        const b = this.toNumber(evalArg());
        res = this.bool(a < b);
        break;
      }

      case FePrimitive.LTE: {
        const a = this.toNumber(evalArg());
        const b = this.toNumber(evalArg());
        res = this.bool(a <= b);
        break;
      }

      case FePrimitive.ADD: {
        let acc = this.toNumber(evalArg());
        while (!this.isNil(argState.list)) acc += this.toNumber(evalArg());
        res = this.number(acc);
        break;
      }

      case FePrimitive.SUB: {
        let acc = this.toNumber(evalArg());
        while (!this.isNil(argState.list)) acc -= this.toNumber(evalArg());
        res = this.number(acc);
        break;
      }

      case FePrimitive.MUL: {
        let acc = this.toNumber(evalArg());
        while (!this.isNil(argState.list)) acc *= this.toNumber(evalArg());
        res = this.number(acc);
        break;
      }

      case FePrimitive.DIV: {
        let acc = this.toNumber(evalArg());
        while (!this.isNil(argState.list)) {
          acc /= this.toNumber(evalArg());
        }
        res = this.number(acc);
        break;
      }
    }

    return res;
  }

  #eval(obj, env, newEnvBox) {
    if (!obj || obj.type === undefined) {
      return this.nil;
    }
    if (obj.type === FeType.SYMBOL) {
      const val = this.#getBound(obj, env).cdr;
      return val && val.type !== undefined ? val : this.nil;
    }
    if (obj.type !== FeType.PAIR) {
      return obj;
    }

    this.calllist = this.cons(obj, this.calllist);

    const fn = this.#eval(obj.car, env, null);
    const argState = {
      list: obj.cdr,
      line: obj.line ?? obj.car?.line ?? null,
      col: obj.col ?? obj.car?.col ?? null
    };
    const evalArg = () => this.#eval(this.nextArg(argState), env, null);

    let res = this.nil;

    switch (fn.type) {
      case FeType.PRIM:
        res = this.#evalPrimitive(fn.cdr, argState, env, newEnvBox, evalArg);
        break;

      case FeType.CFUNC: {
        const evaledArgs = this.#evalList(argState.list, env);
        const rawResult = fn.cdr(this, evaledArgs);
        res = rawResult instanceof FeObject ? rawResult : this.fromJS(rawResult);
        break;
      }

      case FeType.FUNC: {
        const evaledArgs = this.#evalList(argState.list, env);
        const capturedEnv = fn.cdr.car;
        const paramsAndBody = fn.cdr.cdr;
        const localEnv = this.#argsToEnv(paramsAndBody.car, evaledArgs, capturedEnv);
        res = this.#doList(paramsAndBody.cdr, localEnv);
        break;
      }

      case FeType.MACRO: {
        const capturedEnv = fn.cdr.car;
        const paramsAndBody = fn.cdr.cdr;
        const localEnv = this.#argsToEnv(paramsAndBody.car, argState.list, capturedEnv);
        const expanded = this.#doList(paramsAndBody.cdr, localEnv);

        // Mutate caller AST node in-place just like `*obj = *expanded` in fe.c
        obj.type = expanded.type;
        obj.car = expanded.car;
        obj.cdr = expanded.cdr;
        if (expanded.hasLocation) {
          obj.line = expanded.line;
          obj.col = expanded.col;
        }

        this.calllist = this.calllist.cdr;
        return this.#eval(obj, env, null);
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

  #equal(a, b) {
    if (a === b) return true;
    if (a.type !== b.type) return false;
    if (a.type === FeType.NUMBER || a.type === FeType.STRING) {
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
      if (cur.type !== FeType.PAIR) {
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
      case FeType.NUMBER:
      case FeType.STRING:
      case FeType.PTR:
        return obj.cdr;
      case FeType.SYMBOL:
        return obj.cdr.car.cdr;
      case FeType.PAIR:
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
      return ctx.fromJS(jsFn(ctx, ...jsArgs));
    });
  }
}
