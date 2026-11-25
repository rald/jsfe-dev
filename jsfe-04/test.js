import test from "node:test";
import assert from "node:assert/strict";
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

test("nil and false behave consistently in equality and formatting", () => {
  const ctx = new FeContext();
  assert.equal(ctx.evalString("(is nil false)"), true);
  assert.equal(feFormat(NIL), "nil");
  assert.equal(feFormat(false), "nil");
});

test("numeric equality (==) and division by zero error", () => {
  const ctx = new FeContext();
  assert.equal(ctx.evalString("(== 15 15)"), true);
  assert.equal(ctx.evalString("(== 15 14)"), false);
  assert.throws(() => ctx.evalString("(/ 1 0)"), FeError);
  assert.throws(() => ctx.evalString("(/ 0)"), FeError);
});

test("invalid syntax throws FeError", () => {
  const ctx = new FeContext();
  assert.throws(() => ctx.evalString("(+ 1 2"), FeError);
  assert.throws(() => ctx.evalString(")"), FeError);
  assert.throws(() => ctx.evalString("(a . )"), FeError);
  assert.throws(() => ctx.evalString('"unterminated'), FeError);
});

test("sequential and top-level let bindings persist", () => {
  const ctx = new FeContext();
  const res = ctx.evalString(`
    (let base 10)
    (= make-acc (fn (start)
      (let step 2)
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
