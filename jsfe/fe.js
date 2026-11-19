/**
 * ============================================================================
 * fe.es5.js — ES5 Port of rxi's `fe` Tiny Lisp Interpreter
 * Faithful to fe.h and fe.c (v1.0) with Seamless JS Interop Bridge
 * ============================================================================
 */

(function (global) {
  "use strict";

  function freezeEnum(obj) {
    if (Object.freeze) {
      return Object.freeze(obj);
    }
    return obj;
  }

  function inherits(Child, Parent) {
    function Surrogate() {
      this.constructor = Child;
    }
    Surrogate.prototype = Parent.prototype;
    Child.prototype = new Surrogate();
  }

  var FE_TYPE = freezeEnum({
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

  var FE_TYPENAMES = [
    "pair", "free", "nil", "number", "symbol", "string",
    "func", "macro", "prim", "cfunc", "ptr"
  ];

  var PRIM = freezeEnum({
    LET: 0, SET: 1, IF: 2, FN: 3, MAC: 4, WHILE: 5, QUOTE: 6,
    AND: 7, OR: 8, DO: 9, CONS: 10, CAR: 11, CDR: 12, SETCAR: 13,
    SETCDR: 14, LIST: 15, NOT: 16, IS: 17, ATOM: 18, PRINT: 19,
    LT: 20, LTE: 21, ADD: 22, SUB: 23, MUL: 24, DIV: 25
  });

  var PRIM_NAMES = [
    "let", "=", "if", "fn", "mac", "while", "quote", "and", "or", "do", "cons",
    "car", "cdr", "setcar", "setcdr", "list", "not", "is", "atom", "print", "<",
    "<=", "+", "-", "*", "/"
  ];

  var _nextObjId = 1;

  /**
   * Represents a tagged fe_Object (analogous to union Value car, cdr in fe.c)
   */
  function FeObject(type, car, cdr, line, col) {
    this.id = _nextObjId++;
    this.type = type;
    this.car = car !== undefined ? car : null;
    this.cdr = cdr !== undefined ? cdr : null;
    this.line = line !== undefined ? line : null;
    this.col = col !== undefined ? col : null;
  }

  /**
   * Custom Error class carrying source position and the fe evaluation call stack trace
   */
  function FeRuntimeError(message, trace, line, col) {
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FeRuntimeError);
    }
    this.name = "FeRuntimeError";
    this.message = message;
    this.trace = trace || [];
    this.line = line !== undefined ? line : null;
    this.col = col !== undefined ? col : null;
  }
  inherits(FeRuntimeError, Error);

  /**
   * Reader state wrapper for string input streams with line:column tracking
   */
  function StringStream(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.col = 0;
  }

  StringStream.prototype.readChar = function () {
    if (this.pos >= this.source.length) return "\0";
    var ch = this.source.charAt(this.pos++);
    if (ch === "\n") {
      this.line++;
      this.col = 0;
    } else {
      this.col++;
    }
    return ch;
  };

  /**
   * Core fe Virtual Machine & Context (`fe_Context`)
   */
  function FeContext(options) {
    var opts = options || {};
    this.onPrint = opts.onPrint || function (text) {
      if (typeof console !== "undefined" && console.log) {
        console.log(text);
      }
    };

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
    var i;
    for (i = 0; i < PRIM_NAMES.length; i++) {
      var primObj = new FeObject(FE_TYPE.PRIM, null, i);
      this.set(this.symbol(PRIM_NAMES[i]), primObj);
    }
  }

  FeContext.prototype._resetLookahead = function () {
    this.nextchr = "";
    this.nextline = 1;
    this.nextcol = 0;
  };

  FeContext.prototype._readWithPos = function (stream) {
    if (this.nextchr) {
      var bufferedCh = this.nextchr;
      var bufferedLine = this.nextline;
      var bufferedCol = this.nextcol;
      this.nextchr = "";
      return { ch: bufferedCh, line: bufferedLine, col: bufferedCol };
    }
    var line = stream.line;
    var col = stream.col + 1;
    var ch = stream.readChar();
    return { ch: ch, line: line, col: col };
  };

  FeContext.prototype._unreadWithPos = function (ch, line, col) {
    if (ch === "\0") {
      this.nextchr = "";
      return;
    }
    this.nextchr = ch;
    this.nextline = line;
    this.nextcol = col;
  };

  /* ------------------------------------------------------------------------
   * Error Handling & Type Checking
   * ------------------------------------------------------------------------ */

  FeContext.prototype.error = function (msg, line, col) {
    var trace = [];
    var cl = this.calllist;
    var resolvedLine = line !== undefined ? line : null;
    var resolvedCol = col !== undefined ? col : null;

    while (!this.isNil(cl)) {
      var frame = this.car(cl);
      if ((resolvedLine === null || resolvedCol === null) &&
          frame && frame.line !== null && frame.line !== undefined &&
          frame.col !== null && frame.col !== undefined) {
        resolvedLine = frame.line;
        resolvedCol = frame.col;
      }
      var loc = (frame && frame.line !== null && frame.line !== undefined &&
                 frame.col !== null && frame.col !== undefined)
        ? " (" + frame.line + ":" + frame.col + ")"
        : "";
      trace.push(this.toString(frame, true) + loc);
      cl = this.cdr(cl);
    }

    this.calllist = this.nil;
    throw new FeRuntimeError(msg, trace, resolvedLine, resolvedCol);
  };

  FeContext.prototype.checkType = function (obj, expectedType) {
    if (obj.type !== expectedType) {
      this.error(
        "expected " + FE_TYPENAMES[expectedType] + ", got " + FE_TYPENAMES[obj.type],
        obj.line !== undefined ? obj.line : null,
        obj.col !== undefined ? obj.col : null
      );
    }
    return obj;
  };

  FeContext.prototype.type = function (obj) {
    return obj.type;
  };

  FeContext.prototype.isNil = function (obj) {
    return obj === this.nil || obj.type === FE_TYPE.NIL;
  };

  /* ------------------------------------------------------------------------
   * Constructors & List Operations
   * ------------------------------------------------------------------------ */

  FeContext.prototype.cons = function (car, cdr, line, col) {
    return new FeObject(FE_TYPE.PAIR, car, cdr, line, col);
  };

  FeContext.prototype.bool = function (b) {
    return b ? this.t : this.nil;
  };

  FeContext.prototype.number = function (n, line, col) {
    if (typeof n !== "number" || isNaN(n)) {
      this.error("invalid number value", line, col);
    }
    return new FeObject(FE_TYPE.NUMBER, null, n, line, col);
  };

  FeContext.prototype.string = function (str, line, col) {
    return new FeObject(FE_TYPE.STRING, null, String(str), line, col);
  };

  /**
   * Interned symbol lookup/creation.
   * In fe.c, a symbol's cdr is a pair `(nameString . globalValue)`
   */
  FeContext.prototype.symbol = function (name, line, col) {
    var cur = this.symlist;
    while (!this.isNil(cur)) {
      var existingSym = cur.car;
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
    var sym = new FeObject(
      FE_TYPE.SYMBOL,
      null,
      this.cons(this.string(name), this.nil),
      line,
      col
    );
    this.symlist = this.cons(sym, this.symlist);
    return sym;
  };

  FeContext.prototype.cfunc = function (fn) {
    return new FeObject(FE_TYPE.CFUNC, null, fn);
  };

  FeContext.prototype.ptr = function (val) {
    return new FeObject(FE_TYPE.PTR, null, val);
  };

  FeContext.prototype.list = function (objs) {
    var res = this.nil;
    var i;
    for (i = objs.length - 1; i >= 0; i--) {
      res = this.cons(objs[i], res);
    }
    return res;
  };

  FeContext.prototype.car = function (obj) {
    if (this.isNil(obj)) return obj;
    return this.checkType(obj, FE_TYPE.PAIR).car;
  };

  FeContext.prototype.cdr = function (obj) {
    if (this.isNil(obj)) return obj;
    return this.checkType(obj, FE_TYPE.PAIR).cdr;
  };

  FeContext.prototype.nextArg = function (argState) {
    var a = argState.list;
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
  };

  FeContext.prototype.toNumber = function (obj) {
    return this.checkType(obj, FE_TYPE.NUMBER).cdr;
  };

  FeContext.prototype.toPtr = function (obj) {
    return this.checkType(obj, FE_TYPE.PTR).cdr;
  };

  /* ------------------------------------------------------------------------
   * Environment Lookup & Global Binding
   * ------------------------------------------------------------------------ */

  FeContext.prototype._getBound = function (sym, env) {
    var cur = env;
    while (!this.isNil(cur)) {
      var pair = cur.car;
      if (pair.car.cdr.car.cdr === sym.cdr.car.cdr) {
        return pair;
      }
      cur = cur.cdr;
    }
    // Fallback to global binding cell stored in sym.cdr
    return sym.cdr;
  };

  FeContext.prototype.set = function (symOrName, val) {
    var sym = typeof symOrName === "string" ? this.symbol(symOrName) : symOrName;
    var feVal = val instanceof FeObject ? val : this.fromJS(val);
    this._getBound(sym, this.nil).cdr = feVal;
    return feVal;
  };

  FeContext.prototype.get = function (symOrName) {
    var sym = typeof symOrName === "string" ? this.symbol(symOrName) : symOrName;
    var val = this._getBound(sym, this.nil).cdr;
    return val && val.type !== undefined ? val : this.nil;
  };

  /* ------------------------------------------------------------------------
   * Reader & Printer (fe_read / fe_write)
   * ------------------------------------------------------------------------ */

  FeContext.prototype.toString = function (obj, qt) {
    if (qt === undefined) qt = true;
    if (!obj || obj.type === undefined) return "nil";
    switch (obj.type) {
      case FE_TYPE.NIL:
        return "nil";
      case FE_TYPE.NUMBER:
        return String(Number(obj.cdr.toPrecision(7)));
      case FE_TYPE.PAIR: {
        var parts = [];
        var cur = obj;
        while (cur.type === FE_TYPE.PAIR) {
          parts.push(this.toString(cur.car, true));
          cur = cur.cdr;
        }
        if (!this.isNil(cur)) {
          parts.push(".");
          parts.push(this.toString(cur, true));
        }
        return "(" + parts.join(" ") + ")";
      }
      case FE_TYPE.SYMBOL:
        return obj.cdr.car.cdr;
      case FE_TYPE.STRING:
        if (!qt) return obj.cdr;
        return '"' +
          obj.cdr
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t") +
          '"';
      default:
        return "[" + FE_TYPENAMES[obj.type] + " #" + obj.id + "]";
    }
  };

  FeContext.prototype.read = function (stream) {
    var obj = this._read(stream);
    if (obj && obj.obj === this._rparen) {
      this.error("stray ')'", obj.line, obj.col);
    }
    return obj ? obj.obj : null;
  };

  FeContext.prototype._read = function (stream) {
    var isDelimiter = function (ch) {
      return ch === "\0" || " \n\t\r();".indexOf(ch) !== -1;
    };
    var token;

    while (true) {
      token = this._readWithPos(stream);
      while (token.ch !== "\0" && " \n\t\r".indexOf(token.ch) !== -1) {
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

    var startLine = token.line;
    var startCol = token.col;

    switch (token.ch) {
      case "\0":
        return null;

      case ")":
        return { obj: this._rparen, line: startLine, col: startCol };

      case "(": {
        var res = this.nil;
        var tail = null;
        var item;
        while ((item = this._read(stream)) === null || item.obj !== this._rparen) {
          if (item === null) {
            this.error("unclosed list", startLine, startCol);
          }
          var v = item.obj;
          if (v.type === FE_TYPE.SYMBOL && v.cdr.car.cdr === ".") {
            var dottedItem = this._read(stream);
            if (!dottedItem || dottedItem.obj === this._rparen) {
              this.error("unclosed list", startLine, startCol);
            }
            var dotted = dottedItem.obj;
            if (tail) {
              tail.cdr = dotted;
            } else {
              res = dotted;
            }
          } else {
            var cell = this.cons(v, this.nil, item.line, item.col);
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
        var vItem = this._read(stream);
        if (!vItem || vItem.obj === this._rparen) {
          this.error("stray '''", startLine, startCol);
        }
        var quoted = this.cons(
          this.symbol("quote", startLine, startCol),
          this.cons(vItem.obj, this.nil, vItem.line, vItem.col),
          startLine,
          startCol
        );
        return { obj: quoted, line: startLine, col: startCol };
      }

      case '"': {
        var str = "";
        var cur = this._readWithPos(stream);
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
        var buf = "";
        var curAtom = token;
        while (!isDelimiter(curAtom.ch)) {
          buf += curAtom.ch;
          curAtom = this._readWithPos(stream);
        }
        this._unreadWithPos(curAtom.ch, curAtom.line, curAtom.col);

        if (buf !== "" && !isNaN(Number(buf))) {
          return {
            obj: this.number(Number(buf), startLine, startCol),
            line: startLine,
            col: startCol
          };
        }
        if (buf === "nil") {
          var nilObj = new FeObject(FE_TYPE.NIL, null, null, startLine, startCol);
          return { obj: nilObj, line: startLine, col: startCol };
        }
        return {
          obj: this.symbol(buf, startLine, startCol),
          line: startLine,
          col: startCol
        };
      }
    }
  };

  /* ------------------------------------------------------------------------
   * Evaluator (fe_eval)
   * ------------------------------------------------------------------------ */

  FeContext.prototype.eval = function (obj) {
    return this._eval(obj, this.nil, null);
  };

  FeContext.prototype.evalString = function (source) {
    this._resetLookahead();
    var stream = new StringStream(source);
    var result = this.nil;
    var expr;
    while ((expr = this.read(stream)) !== null) {
      result = this.eval(expr);
    }
    return result;
  };

  FeContext.prototype._evalList = function (lst, env) {
    var res = this.nil;
    var tail = null;
    var argState = {
      list: lst,
      line: lst && lst.line !== undefined ? lst.line : null,
      col: lst && lst.col !== undefined ? lst.col : null
    };
    while (!this.isNil(argState.list)) {
      var item = this.nextArg(argState);
      var evaluated = this._eval(item, env, null);
      var cell = this.cons(evaluated, this.nil);
      if (tail) {
        tail.cdr = cell;
      } else {
        res = cell;
      }
      tail = cell;
    }
    return res;
  };

  FeContext.prototype._doList = function (lst, env) {
    var res = this.nil;
    var curEnv = env;
    var argState = {
      list: lst,
      line: lst && lst.line !== undefined ? lst.line : null,
      col: lst && lst.col !== undefined ? lst.col : null
    };
    while (!this.isNil(argState.list)) {
      var item = this.nextArg(argState);
      var envBox = { env: curEnv };
      res = this._eval(item, curEnv, envBox);
      curEnv = envBox.env;
    }
    return res;
  };

  FeContext.prototype._argsToEnv = function (prm, arg, env) {
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
  };

  FeContext.prototype._eval = function (obj, env, newEnvBox) {
    var self = this;

    if (!obj || obj.type === undefined) {
      return this.nil;
    }
    if (obj.type === FE_TYPE.SYMBOL) {
      var boundVal = this._getBound(obj, env).cdr;
      return boundVal && boundVal.type !== undefined ? boundVal : this.nil;
    }
    if (obj.type !== FE_TYPE.PAIR) {
      return obj;
    }

    // Push onto call stack for tracebacks
    this.calllist = this.cons(obj, this.calllist);

    var fn = this._eval(obj.car, env, null);
    var argState = {
      list: obj.cdr,
      line: obj.line !== undefined && obj.line !== null ? obj.line : (obj.car && obj.car.line !== undefined ? obj.car.line : null),
      col: obj.col !== undefined && obj.col !== null ? obj.col : (obj.car && obj.car.col !== undefined ? obj.car.col : null)
    };
    var res = this.nil;

    function evalArg() {
      return self._eval(self.nextArg(argState), env, null);
    }

    switch (fn.type) {
      case FE_TYPE.PRIM: {
        switch (fn.cdr) {
          case PRIM.LET: {
            var letSym = this.checkType(this.nextArg(argState), FE_TYPE.SYMBOL);
            var letVal = evalArg();
            if (newEnvBox) {
              newEnvBox.env = this.cons(this.cons(letSym, letVal), env);
            }
            break;
          }

          case PRIM.SET: {
            var setSym = this.checkType(this.nextArg(argState), FE_TYPE.SYMBOL);
            var setVal = evalArg();
            this._getBound(setSym, env).cdr = setVal;
            break;
          }

          case PRIM.IF: {
            while (!this.isNil(argState.list)) {
              var cond = evalArg();
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
            var closureBody = this.cons(env, argState.list);
            this.nextArg(argState); // validate param list presence
            res = new FeObject(
              fn.cdr === PRIM.FN ? FE_TYPE.FUNC : FE_TYPE.MACRO,
              null,
              closureBody
            );
            break;
          }

          case PRIM.WHILE: {
            var condExpr = this.nextArg(argState);
            var bodyList = argState.list;
            while (!this.isNil(this._eval(condExpr, env, null))) {
              res = this._doList(bodyList, env);
            }
            break;
          }

          case PRIM.QUOTE:
            res = this.nextArg(argState);
            break;

          case PRIM.AND:
            while (!this.isNil(argState.list) && !this.isNil(res = evalArg())) {}
            break;

          case PRIM.OR:
            while (!this.isNil(argState.list) && this.isNil(res = evalArg())) {}
            break;

          case PRIM.DO:
            res = this._doList(argState.list, env);
            break;

          case PRIM.CONS: {
            var consA = evalArg();
            res = this.cons(consA, evalArg());
            break;
          }

          case PRIM.CAR:
            res = this.car(evalArg());
            break;

          case PRIM.CDR:
            res = this.cdr(evalArg());
            break;

          case PRIM.SETCAR: {
            var setcarPair = this.checkType(evalArg(), FE_TYPE.PAIR);
            setcarPair.car = evalArg();
            break;
          }

          case PRIM.SETCDR: {
            var setcdrPair = this.checkType(evalArg(), FE_TYPE.PAIR);
            setcdrPair.cdr = evalArg();
            break;
          }

          case PRIM.LIST:
            res = this._evalList(argState.list, env);
            break;

          case PRIM.NOT:
            res = this.bool(this.isNil(evalArg()));
            break;

          case PRIM.IS: {
            var isA = evalArg();
            var isB = evalArg();
            res = this.bool(this._equal(isA, isB));
            break;
          }

          case PRIM.ATOM:
            res = this.bool(evalArg().type !== FE_TYPE.PAIR);
            break;

          case PRIM.PRINT: {
            var parts = [];
            while (!this.isNil(argState.list)) {
              parts.push(this.toString(evalArg(), false));
            }
            this.onPrint(parts.join(" "));
            break;
          }

          case PRIM.LT: {
            var ltA = this.toNumber(evalArg());
            var ltB = this.toNumber(evalArg());
            res = this.bool(ltA < ltB);
            break;
          }

          case PRIM.LTE: {
            var lteA = this.toNumber(evalArg());
            var lteB = this.toNumber(evalArg());
            res = this.bool(lteA <= lteB);
            break;
          }

          case PRIM.ADD: {
            var addAcc = this.toNumber(evalArg());
            while (!this.isNil(argState.list)) addAcc += this.toNumber(evalArg());
            res = this.number(addAcc);
            break;
          }

          case PRIM.SUB: {
            var subAcc = this.toNumber(evalArg());
            while (!this.isNil(argState.list)) subAcc -= this.toNumber(evalArg());
            res = this.number(subAcc);
            break;
          }

          case PRIM.MUL: {
            var mulAcc = this.toNumber(evalArg());
            while (!this.isNil(argState.list)) mulAcc *= this.toNumber(evalArg());
            res = this.number(mulAcc);
            break;
          }

          case PRIM.DIV: {
            var divAcc = this.toNumber(evalArg());
            while (!this.isNil(argState.list)) {
              var divisor = this.toNumber(evalArg());
              divAcc /= divisor;
            }
            res = this.number(divAcc);
            break;
          }
        }
        break;
      }

      case FE_TYPE.CFUNC: {
        var evaledArgs = this._evalList(argState.list, env);
        res = fn.cdr(this, evaledArgs);
        if (!(res instanceof FeObject)) {
          res = this.fromJS(res);
        }
        break;
      }

      case FE_TYPE.FUNC: {
        var funcArgs = this._evalList(argState.list, env);
        var funcCapturedEnv = fn.cdr.car;
        var funcParamsAndBody = fn.cdr.cdr;
        var funcLocalEnv = this._argsToEnv(funcParamsAndBody.car, funcArgs, funcCapturedEnv);
        res = this._doList(funcParamsAndBody.cdr, funcLocalEnv);
        break;
      }

      case FE_TYPE.MACRO: {
        var macCapturedEnv = fn.cdr.car;
        var macParamsAndBody = fn.cdr.cdr;
        var macLocalEnv = this._argsToEnv(macParamsAndBody.car, argState.list, macCapturedEnv);
        var expanded = this._doList(macParamsAndBody.cdr, macLocalEnv);

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
        return this._eval(obj, env, null);
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
  };

  FeContext.prototype._equal = function (a, b) {
    if (a === b) return true;
    if (a.type !== b.type) return false;
    if (a.type === FE_TYPE.NUMBER || a.type === FE_TYPE.STRING) {
      return a.cdr === b.cdr;
    }
    return false;
  };

  /* ------------------------------------------------------------------------
   * JavaScript Interop & Extension Bridge
   * ------------------------------------------------------------------------ */

  FeContext.prototype.toArray = function (pair) {
    var arr = [];
    var cur = pair;
    while (!this.isNil(cur)) {
      if (cur.type !== FE_TYPE.PAIR) {
        arr.push(this.toJS(cur));
        break;
      }
      arr.push(this.toJS(cur.car));
      cur = cur.cdr;
    }
    return arr;
  };

  FeContext.prototype.toJS = function (obj) {
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
  };

  FeContext.prototype.fromJS = function (val) {
    var self = this;
    if (val instanceof FeObject) return val;
    if (val === null || val === undefined || val === false) return this.nil;
    if (val === true) return this.t;
    if (typeof val === "number") return this.number(val);
    if (typeof val === "string") return this.string(val);
    if (Object.prototype.toString.call(val) === "[object Array]") {
      var mapped = [];
      var i;
      for (i = 0; i < val.length; i++) {
        mapped.push(this.fromJS(val[i]));
      }
      return this.list(mapped);
    }
    if (typeof val === "function") {
      return this.cfunc(function (ctx, argsPair) {
        var jsArgs = ctx.toArray(argsPair);
        var callArgs = [ctx].concat(jsArgs);
        return ctx.fromJS(val.apply(null, callArgs));
      });
    }
    return this.ptr(val);
  };

  FeContext.prototype.defineRaw = function (name, cfunc) {
    var fnObj = this.cfunc(cfunc);
    this.set(this.symbol(name), fnObj);
    return fnObj;
  };

  FeContext.prototype.define = function (name, jsFn) {
    return this.defineRaw(name, function (ctx, argsPair) {
      var jsArgs = ctx.toArray(argsPair);
      var callArgs = [ctx].concat(jsArgs);
      var result = jsFn.apply(null, callArgs);
      return ctx.fromJS(result);
    });
  };

  // Export for CommonJS, AMD, or browser globals
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      FE_TYPE: FE_TYPE,
      FE_TYPENAMES: FE_TYPENAMES,
      PRIM: PRIM,
      PRIM_NAMES: PRIM_NAMES,
      FeObject: FeObject,
      FeRuntimeError: FeRuntimeError,
      StringStream: StringStream,
      FeContext: FeContext
    };
  } else {
    global.FE_TYPE = FE_TYPE;
    global.FE_TYPENAMES = FE_TYPENAMES;
    global.PRIM = PRIM;
    global.PRIM_NAMES = PRIM_NAMES;
    global.FeObject = FeObject;
    global.FeRuntimeError = FeRuntimeError;
    global.StringStream = StringStream;
    global.FeContext = FeContext;
  }
})(typeof window !== "undefined" ? window : this);
