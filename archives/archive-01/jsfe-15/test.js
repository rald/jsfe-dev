import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { FeContext, FeError, JsFn, NIL, arrayToList, feEqual, feFormat, feToJs, jsToFe } from "./fe.js";
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

test("let shadows same-scope binding while = mutates existing lexical binding", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= test-shadow-and-set (fn ()
      (let x 1)
      (let x 2)
      (= x (+ x 10))
      x))
    (let before-shadow (test-shadow-and-set))
    (= x 100)
    (let fn-with-global-set (fn ()
      (= x 200)
      x))
    (list before-shadow (fn-with-global-set) x)
  `);
  assert.equal(feFormat(res, true), "(12 200 200)");
});

test("let shadows outer lexical binding without mutating it", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= outer-val 10)
    (= inner-fn (fn ()
      (let outer-val 50)
      (= outer-val (+ outer-val 5))
      outer-val))
    (let inner-res (inner-fn))
    (list inner-res outer-val)
  `);
  assert.equal(feFormat(res, true), "(55 10)");
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
  assert.deepEqual(scanReplInput('"(unclosed \\\" quote'), { depth: 0, inStr: true, pendingQuote: false });
  assert.deepEqual(scanReplInput('"(closed \\\" quote)"'), { depth: 0, inStr: false, pendingQuote: false });
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

test("jsfunc values format as <jsfunc> and invoke cleanly", () => {
  const ctx = new FeContext();
  ctx.setBuiltin("add1", ([n]) => n + 1);
  const fnVal = ctx.evalString("add1");
  assert.ok(fnVal instanceof JsFn);
  assert.equal(feFormat(fnVal), "<jsfunc>");
  assert.equal(feFormat(ctx.evalString("+")), "<jsfunc>");
  assert.equal(ctx.evalString("(add1 41)"), 42);
});

test("JS interop: js-get, js-call, js-fn, js-new, and setJsValue", () => {
  const ctx = new FeContext({
    host: {
      Math,
      Number,
      greeting: { prefix: "hi" },
      Counter: class Counter {
        constructor(start = 0) {
          this.value = start;
        }
        inc(step = 1) {
          this.value += step;
          return this.value;
        }
      },
    },
  });
  ctx.setJsValue("hostSum", (a, b) => a + b);

  assert.equal(ctx.evalString('(js-get "greeting.prefix")'), "hi");
  assert.equal(ctx.evalString('(js-get "missing.path")'), NIL);
  assert.equal(ctx.evalString('(js-call "Math.max" 3 9 2)'), 9);
  assert.equal(ctx.evalString("(js-call hostSum 4 6)"), 10);

  const wrapped = ctx.evalString("(js-fn (fn (x) (+ x 5)))");
  assert.ok(wrapped instanceof JsFn);
  assert.equal(feFormat(wrapped), "<jsfunc>");
  assert.equal(feToJs(wrapped, new WeakSet(), ctx)(12), 17);
  assert.equal(feFormat(jsToFe([1, 2, 3], ctx), true), "(1 2 3)");

  const inst = ctx.evalString('(= inst (js-new "Counter" 10))');
  assert.equal(ctx.evalString('(js-call inst "inc" 5)'), 15);
  assert.equal(inst.value, 15);
});

test("JS interop marshals arrays, callbacks, and returned functions cleanly", () => {
  const ctx = new FeContext({
    host: {
      makeAdder: (base) => (x) => base + x,
      applyToArray: (arr, cb) => cb(arr),
    },
  });

  const fnFromJs = ctx.evalString('(js-call "makeAdder" 10)');
  ctx.setJsValue("fnFromJs", fnFromJs);
  assert.equal(ctx.evalString("(js-call fnFromJs 5)"), 15);

  const len = ctx.evalString('(js-call "applyToArray" \'(1 2 3 4) (js-fn (fn (xs) (js-get xs "length"))))');
  assert.equal(len, 4);
});
