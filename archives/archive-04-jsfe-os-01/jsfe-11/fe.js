/**
 * ============================================================================
 * fe.js — ES6 Port of rxi's `fe` Tiny Lisp Interpreter
 * Faithful to fe.h and fe.c (v1.0) with Seamless JS Interop Bridge
 * Updated with async fetch() support in `load` and async evaluation
 * ============================================================================
 */

export const FE_TYPE = Object.freeze({
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

export const FE_TYPENAMES = Object.freeze([
  "pair", "free", "nil", "number", "symbol", "string",
  "func", "macro", "prim", "cfunc", "ptr"
]);

export const PRIM = Object.freeze({
  LET: 0, SET: 1, IF: 2, FN: 3, MAC: 4, WHILE: 5, QUOTE: 6,
  AND: 7, OR: 8, DO: 9, CONS: 10, CAR: 11, CDR: 12, SETCAR: 13,
  SETCDR: 14, LIST: 15, NOT: 16, IS: 17, ATOM: 18, PRINT: 19,
  LT: 20, LTE: 21, ADD: 22, SUB: 23, MUL: 24, DIV: 25
});

export const PRIM_NAMES = Object.freeze([
  "let", "=", "if", "fn", "mac", "while", "quote", "and", "or", "do", "cons",
  "car", "cdr", "setcar", "setcdr", "list", "not", "is", "atom", "print", "<",
  "<=", "+", "-", "*", "/"
]);

let _nextObjId = 1;

export class FeObject {
  constructor(type, car, cdr, line, col) {
    this.id = _nextObjId++;
    this.type = type;
    this.car = car !== undefined ? car : null;
    this.cdr = cdr !== undefined ? cdr : null;
    this.line = line !== undefined ? line : null;
    this.col = col !== undefined ? col : null;
  }
}

export class FeRuntimeError extends Error {
  constructor(message, trace, line, col) {
    super(message);
    this.name = "FeRuntimeError";
    this.trace = trace || [];
    this.line = line !== undefined ? line : null;
    this.col = col !== undefined ? col : null;
  }
}

export class StringStream {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.col = 0;
  }

  readChar() {
    if (this.pos >= this.source.length) return "\0";
    const ch = this.source.charAt(this.pos++);
    if (ch === "\n") {
      this.line++;
      this.col = 0;
    } else {
      this.col++;
    }
    return ch;
  }
}

export class FeContext {
  constructor(options = {}) {
    this.onPrint = options.onPrint || ((text) => {
      if (typeof console !== "undefined" && console.log) {
        console.log(text);
      }
    });

    this.nil = new FeObject(FE_TYPE.NIL, null, null);
    this._rparen = new FeObject(FE_TYPE.NIL, null, null);

    this.symlist = this.nil;
    this.calllist = this.nil;
    this.nextchr = "";
    this.nextline = 1;
    this.nextcol = 0;

    this.t = this.symbol("t");
    this.set(this.t, this.t);

    for (const name of PRIM_NAMES) {
      const primObj = new FeObject(FE_TYPE.PRIM, null, PRIM_NAMES.indexOf(name));
      this.set(this.symbol(name), primObj);
    }

    const readSourceFile = async (ctx, filePath, line, col) => {
      if (typeof fetch === "function") {
        let response;
        try {
          response = await fetch(filePath);
        } catch (e) {
          ctx.error(
            `failed to load "${filePath}": ${e && e.message ? e.message : String(e)}`,
            line,
            col
          );
        }
        if (!response.ok) {
          ctx.error(
            `failed to load "${filePath}" (status ${response.status})`,
            line,
            col
          );
        }
        return await response.text();
      }

      if (typeof require === "function") {
        try {
          const fs = require("fs");
          return fs.readFileSync(filePath, "utf8");
        } catch (err) {
          ctx.error(
            `failed to load "${filePath}": ${err && err.message ? err.message : String(err)}`,
            line,
            col
          );
        }
      }

      ctx.error("load is not supported in this environment", line, col);
    };

    this.defineRaw("load", async (ctx, argsPair) => {
      const argState = {
        list: argsPair,
        line: argsPair && argsPair.line !== undefined ? argsPair.line : null,
        col: argsPair && argsPair.col !== undefined ? argsPair.col : null
      };
      const pathObj = ctx.checkType(ctx.nextArg(argState), FE_TYPE.STRING);
      const filePath = pathObj.cdr;
      const source = await readSourceFile(ctx, filePath, pathObj.line, pathObj.col);

      const savedNextChr = ctx.nextchr;
      const savedNextLine = ctx.nextline;
      const savedNextCol = ctx.nextcol;

      ctx._resetLookahead();
      const stream = new StringStream(source);
      let result = ctx.nil;

      try {
        let expr;
        while ((expr = ctx.read(stream)) !== null) {
          result = await ctx.eval(expr);
        }
      } finally {
        ctx.nextchr = savedNextChr;
        ctx.nextline = savedNextLine;
        ctx.nextcol = savedNextCol;
      }

      return result;
    });
  }

  _resetLookahead() {
    this.nextchr = "";
    this.nextline = 1;
    this.nextcol = 0;
  }

  _readWithPos(stream) {
    if (this.nextchr) {
      const bufferedCh = this.nextchr;
      const bufferedLine = this.nextline;
      const bufferedCol = this.nextcol;
      this.nextchr = "";
      return { ch: bufferedCh, line: bufferedLine, col: bufferedCol };
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

  error(msg, line, col) {
    const trace = [];
    let cl = this.calllist;
    let resolvedLine = line !== undefined ? line : null;
    let resolvedCol = col !== undefined ? col : null;

    while (!this.isNil(cl)) {
      const frame = this.car(cl);
      if ((resolvedLine === null || resolvedCol === null) &&
          frame && frame.line !== null && frame.line !== undefined &&
          frame.col !== null && frame.col !== undefined) {
        resolvedLine = frame.line;
        resolvedCol = frame.col;
      }
      const loc = (frame && frame.line !== null && frame.line !== undefined &&
                 frame.col !== null && frame.col !== undefined)
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
        obj.line !== undefined ? obj.line : null,
        obj.col !== undefined ? obj.col : null
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

  cons(car, cdr, line, col) {
    return new FeObject(FE_TYPE.PAIR, car, cdr, line, col);
  }

  bool(b) {
    return b ? this.t : this.nil;
  }

  number(n, line, col) {
    if (typeof n !== "number" || isNaN(n)) {
      this.error("invalid number value", line, col);
    }
    return new FeObject(FE_TYPE.NUMBER, null, n, line, col);
  }

  string(str, line, col) {
    return new FeObject(FE_TYPE.STRING, null, String(str), line, col);
  }

  symbol(name, line, col) {
    let cur = this.symlist;
    while (!this.isNil(cur)) {
      const existingSym = cur.car;
      if (existingSym.cdr.car.cdr === name) {
        return new FeObject(
          FE_TYPE.SYMBOL,
          null,
          existingSym.cdr,
          line !== undefined && line !== null ? line : existingSym.line,
          col !== undefined && col !== null ? col : existingSym.col
        );
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
        this.error(
          "too few arguments",
          argState.line !== undefined ? argState.line : null,
          argState.col !== undefined ? argState.col : null
        );
      }
      this.error(
        "dotted pair in argument list",
        a.line !== undefined && a.line !== null ? a.line : (argState.line !== undefined ? argState.line : null),
        a.col !== undefined && a.col !== null ? a.col : (argState.col !== undefined ? argState.col : null)
      );
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

  _getBound(sym, env) {
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
    this._getBound(sym, this.nil).cdr = feVal;
    return feVal;
  }

  get(symOrName) {
    const sym = typeof symOrName === "string" ? this.symbol(symOrName) : symOrName;
    const val = this._getBound(sym, this.nil).cdr;
    return val && val.type !== undefined ? val : this.nil;
  }

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
        return `"${obj.cdr
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t")}"`;
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
    let token;

    while (true) {
      token = this._readWithPos(stream);
      while (token.ch !== "\0" && " \n\t\r".includes(token.ch)) {
        token = this._readWithPos(stream);
      }
      if (token.ch === ";") {
        while (token.ch !== "\0" && token.ch !== "\n") {
          token = this._readWithPos(stream);
        }
        continue;
      }
      break;
    }

    const startLine = token.line;
    const startCol = token.col;

    switch (token.ch) {
      case "\0":
        return null;

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
        let curAtom = token;
        while (!isDelimiter(curAtom.ch)) {
          buf += curAtom.ch;
          curAtom = this._readWithPos(stream);
        }
        this._unreadWithPos(curAtom.ch, curAtom.line, curAtom.col);

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

  async eval(obj) {
    return await this._eval(obj, this.nil, null);
  }

  async evalString(source) {
    this._resetLookahead();
    const stream = new StringStream(source);
    let result = this.nil;
    let expr;
    while ((expr = this.read(stream)) !== null) {
      result = await this.eval(expr);
    }
    return result;
  }

  async _evalList(lst, env) {
    let res = this.nil;
    let tail = null;
    const argState = {
      list: lst,
      line: lst && lst.line !== undefined ? lst.line : null,
      col: lst && lst.col !== undefined ? lst.col : null
    };
    while (!this.isNil(argState.list)) {
      const item = this.nextArg(argState);
      const evaluated = await this._eval(item, env, null);
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

  async _doList(lst, env) {
    let res = this.nil;
    let curEnv = env;
    const argState = {
      list: lst,
      line: lst && lst.line !== undefined ? lst.line : null,
      col: lst && lst.col !== undefined ? lst.col : null
    };
    while (!this.isNil(argState.list)) {
      const item = this.nextArg(argState);
      const envBox = { env: curEnv };
      res = await this._eval(item, curEnv, envBox);
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

  async _eval(obj, env, newEnvBox) {
    if (!obj || obj.type === undefined) {
      return this.nil;
    }
    if (obj.type === FE_TYPE.SYMBOL) {
      const boundVal = this._getBound(obj, env).cdr;
      return boundVal && boundVal.type !== undefined ? boundVal : this.nil;
    }
    if (obj.type !== FE_TYPE.PAIR) {
      return obj;
    }

    this.calllist = this.cons(obj, this.calllist);

    const fn = await this._eval(obj.car, env, null);
    const argState = {
      list: obj.cdr,
      line: obj.line !== undefined && obj.line !== null ? obj.line : (obj.car && obj.car.line !== undefined ? obj.car.line : null),
      col: obj.col !== undefined && obj.col !== null ? obj.col : (obj.car && obj.car.col !== undefined ? obj.car.col : null)
    };
    let res = this.nil;

    const evalArg = async () => await this._eval(this.nextArg(argState), env, null);

    switch (fn.type) {
      case FE_TYPE.PRIM: {
        switch (fn.cdr) {
          case PRIM.LET: {
            const letSym = this.checkType(this.nextArg(argState), FE_TYPE.SYMBOL);
            const letVal = await evalArg();
            if (newEnvBox) {
              newEnvBox.env = this.cons(this.cons(letSym, letVal), env);
            }
            break;
          }

          case PRIM.SET: {
            const setSym = this.checkType(this.nextArg(argState), FE_TYPE.SYMBOL);
            const setVal = await evalArg();
            this._getBound(setSym, env).cdr = setVal;
            break;
          }

          case PRIM.IF: {
            while (!this.isNil(argState.list)) {
              const cond = await evalArg();
              if (!this.isNil(cond)) {
                res = this.isNil(argState.list) ? cond : await evalArg();
                break;
              }
              if (this.isNil(argState.list)) break;
              argState.list = argState.list.cdr;
            }
            break;
          }

          case PRIM.FN:
          case PRIM.MAC: {
            const paramsObj = this.nextArg(argState);
            const bodyObj = argState.list;
            const closureBody = this.cons(env, this.cons(paramsObj, bodyObj));
            res = new FeObject(
              fn.cdr === PRIM.FN ? FE_TYPE.FUNC : FE_TYPE.MACRO,
              null,
              closureBody
            );
            break;
          }

          case PRIM.WHILE: {
            const condExpr = this.nextArg(argState);
            const bodyList = argState.list;
            while (!this.isNil(await this._eval(condExpr, env, null))) {
              res = await this._doList(bodyList, env);
            }
            break;
          }

          case PRIM.QUOTE:
            res = this.nextArg(argState);
            break;

          case PRIM.AND:
            while (!this.isNil(argState.list) && !this.isNil(res = await evalArg())) {}
            break;

          case PRIM.OR:
            while (!this.isNil(argState.list) && this.isNil(res = await evalArg())) {}
            break;

          case PRIM.DO:
            res = await this._doList(argState.list, env);
            break;

          case PRIM.CONS: {
            const consA = await evalArg();
            res = this.cons(consA, await evalArg());
            break;
          }

          case PRIM.CAR:
            res = this.car(await evalArg());
            break;

          case PRIM.CDR:
            res = this.cdr(await evalArg());
            break;

          case PRIM.SETCAR: {
            const setcarPair = this.checkType(await evalArg(), FE_TYPE.PAIR);
            setcarPair.car = await evalArg();
            break;
          }

          case PRIM.SETCDR: {
            const setcdrPair = this.checkType(await evalArg(), FE_TYPE.PAIR);
            setcdrPair.cdr = await evalArg();
            break;
          }

          case PRIM.LIST:
            res = await this._evalList(argState.list, env);
            break;

          case PRIM.NOT:
            res = this.bool(this.isNil(await evalArg()));
            break;

          case PRIM.IS: {
            const isA = await evalArg();
            const isB = await evalArg();
            res = this.bool(this._equal(isA, isB));
            break;
          }

          case PRIM.ATOM:
            res = this.bool((await evalArg()).type !== FE_TYPE.PAIR);
            break;

          case PRIM.PRINT: {
            const parts = [];
            while (!this.isNil(argState.list)) {
              parts.push(this.toString(await evalArg(), false));
            }
            this.onPrint(parts.join(" "));
            break;
          }

          case PRIM.LT: {
            const ltA = this.toNumber(await evalArg());
            const ltB = this.toNumber(await evalArg());
            res = this.bool(ltA < ltB);
            break;
          }

          case PRIM.LTE: {
            const lteA = this.toNumber(await evalArg());
            const lteB = this.toNumber(await evalArg());
            res = this.bool(lteA <= lteB);
            break;
          }

          case PRIM.ADD: {
            let addAcc = this.toNumber(await evalArg());
            while (!this.isNil(argState.list)) addAcc += this.toNumber(await evalArg());
            res = this.number(addAcc);
            break;
          }

          case PRIM.SUB: {
            let subAcc = this.toNumber(await evalArg());
            while (!this.isNil(argState.list)) subAcc -= this.toNumber(await evalArg());
            res = this.number(subAcc);
            break;
          }

          case PRIM.MUL: {
            let mulAcc = this.toNumber(await evalArg());
            while (!this.isNil(argState.list)) mulAcc *= this.toNumber(await evalArg());
            res = this.number(mulAcc);
            break;
          }

          case PRIM.DIV: {
            let divAcc = this.toNumber(await evalArg());
            while (!this.isNil(argState.list)) {
              const divisor = this.toNumber(await evalArg());
              divAcc /= divisor;
            }
            res = this.number(divAcc);
            break;
          }
        }
        break;
      }

      case FE_TYPE.CFUNC: {
        const evaledArgs = await this._evalList(argState.list, env);
        res = await fn.cdr(this, evaledArgs);
        if (!(res instanceof FeObject)) {
          res = this.fromJS(res);
        }
        break;
      }

      case FE_TYPE.FUNC: {
        const funcArgs = await this._evalList(argState.list, env);
        const funcCapturedEnv = fn.cdr.car;
        const funcParamsAndBody = fn.cdr.cdr;
        const funcLocalEnv = this._argsToEnv(funcParamsAndBody.car, funcArgs, funcCapturedEnv);
        res = await this._doList(funcParamsAndBody.cdr, funcLocalEnv);
        break;
      }

      case FE_TYPE.MACRO: {
        const macCapturedEnv = fn.cdr.car;
        const macParamsAndBody = fn.cdr.cdr;
        const macLocalEnv = this._argsToEnv(macParamsAndBody.car, argState.list, macCapturedEnv);
        const expanded = await this._doList(macParamsAndBody.cdr, macLocalEnv);

        if (this.isNil(expanded)) {
          obj.type = FE_TYPE.NIL;
          obj.car = null;
          obj.cdr = null;
        } else {
          obj.type = expanded.type;
          obj.car = expanded.car;
          obj.cdr = expanded.cdr;
        }
        if (expanded && expanded.line !== null && expanded.line !== undefined &&
            expanded.col !== null && expanded.col !== undefined) {
          obj.line = expanded.line;
          obj.col = expanded.col;
        }

        this.calllist = this.calllist.cdr;
        return await this._eval(obj, env, null);
      }

      default:
        this.error(
          "tried to call non-callable value",
          obj.car && obj.car.line !== undefined ? obj.car.line : (obj.line !== undefined ? obj.line : null),
          obj.car && obj.car.col !== undefined ? obj.car.col : (obj.col !== undefined ? obj.col : null)
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
      const mapped = val.map((item) => this.fromJS(item));
      return this.list(mapped);
    }
    if (typeof val === "function") {
      return this.cfunc(async (ctx, argsPair) => {
        const jsArgs = ctx.toArray(argsPair);
        return ctx.fromJS(await val.apply(null, [ctx, ...jsArgs]));
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
    return this.defineRaw(name, async (ctx, argsPair) => {
      const jsArgs = ctx.toArray(argsPair);
      const result = await jsFn.apply(null, [ctx, ...jsArgs]);
      return ctx.fromJS(result);
    });
  }
}

if (typeof window !== "undefined") {
  window.FE_TYPE = FE_TYPE;
  window.FE_TYPENAMES = FE_TYPENAMES;
  window.PRIM = PRIM;
  window.PRIM_NAMES = PRIM_NAMES;
  window.FeObject = FeObject;
  window.FeRuntimeError = FeRuntimeError;
  window.StringStream = StringStream;
  window.FeContext = FeContext;
}
