import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FeContext, FeRuntimeError } from "../fe.js";

describe("Core Primitives & Evaluation", () => {
  it("evaluates arithmetic and guards against division by zero", async () => {
    const ctx = new FeContext({ onPrint: () => {} });
    assert.equal(ctx.toJS(await ctx.evalString("(+ 1 2 3 4)")), 10);
    assert.equal(ctx.toJS(await ctx.evalString("(- 10 3 2)")), 5);
    assert.equal(ctx.toJS(await ctx.evalString("(* 2 3 4)")), 24);
    assert.equal(ctx.toJS(await ctx.evalString("(/ 20 2 5)")), 2);

    await assert.rejects(
      async () => ctx.evalString("(/ 10 0)"),
      (err) => err instanceof FeRuntimeError && /division by zero/.test(err.message)
    );
  });

  it("handles symbol and nil equality properly with is", async () => {
    const ctx = new FeContext({ onPrint: () => {} });
    assert.equal(ctx.toJS(await ctx.evalString("(is 'alpha 'alpha)")), true);
    assert.equal(ctx.toJS(await ctx.evalString("(is 'alpha 'beta)")), null);
    assert.equal(ctx.toJS(await ctx.evalString("(is nil 'nil)")), true);
    assert.equal(ctx.toJS(await ctx.evalString("(is 42 42)")), true);
    assert.equal(ctx.toJS(await ctx.evalString('(is "a" "a")')), true);
  });

  it("returns assigned/mutated values from let, =, setcar, setcdr, and print", async () => {
    const outputs = [];
    const ctx = new FeContext({ onPrint: (msg) => outputs.push(msg) });

    assert.equal(ctx.toJS(await ctx.evalString("(do (let x 10) (= x 25))")), 25);
    assert.equal(ctx.toJS(await ctx.evalString("(let y 77)")), 77);

    const carRes = await ctx.evalString("(do (let p (cons 1 2)) (setcar p 9))");
    assert.equal(ctx.toJS(carRes), 9);

    const cdrRes = await ctx.evalString("(do (let p (cons 1 2)) (setcdr p 8))");
    assert.equal(ctx.toJS(cdrRes), 8);

    const printRes = await ctx.evalString('(print "hi" 123)');
    assert.equal(ctx.toJS(printRes), "hi 123");
    assert.deepEqual(outputs, ["hi 123"]);
  });

  it("supports conditionals, loops, closures, and variadic parameters", async () => {
    const ctx = new FeContext({ onPrint: () => {} });
    const res = await ctx.evalString(`
      (do
        (let make-adder (fn (a) (fn (b) (+ a b))))
        (let add5 (make-adder 5))
        (let i 0)
        (let sum 0)
        (while (< i 4)
          (= sum (+ sum (add5 i)))
          (= i (+ i 1)))
        sum)
    `);
    // (5+0) + (5+1) + (5+2) + (5+3) = 26
    assert.equal(ctx.toJS(res), 26);

    const restRes = await ctx.evalString(`
      (do
        (let tail-len (fn (first . rest) rest))
        (tail-len 1 2 3 4))
    `);
    assert.deepEqual(ctx.toJS(restRes), [2, 3, 4]);
  });
});
