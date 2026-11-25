import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { FeContext, FeError, NIL, feFormat } from "./fe.js";

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

test("invalid syntax throws FeError", () => {
  const ctx = new FeContext();
  assert.throws(() => ctx.evalString("(+ 1 2"), FeError);
  assert.throws(() => ctx.evalString(")"), FeError);
  assert.throws(() => ctx.evalString("(a . )"), FeError);
  assert.throws(() => ctx.evalString("(a . .)"), FeError);
  assert.throws(() => ctx.evalString('"unterminated'), FeError);
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

test("variadic rest parameters and macros", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (= first-and-rest (fn (head . tail)
      (cons head tail)))
    (first-and-rest "x" 1 2 3)
  `);
  assert.equal(feFormat(res, true), '("x" 1 2 3)');
});

test("cyclic cons lists do not cause stack overflow in format or equality", () => {
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
});

test("cli exits with non-zero code on runtime FeError in script file", () => {
  const tmpFile = path.join(os.tmpdir(), `fe-err-${Date.now()}.fe`);
  fs.writeFileSync(tmpFile, "(/ 1 0)\n", "utf8");
  try {
    assert.throws(() => {
      execFileSync(process.execPath, ["cli.js", tmpFile], {
        stdio: "pipe",
      });
    });
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});
