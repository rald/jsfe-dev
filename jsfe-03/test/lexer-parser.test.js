import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FeContext, FE_TYPE, FeRuntimeError } from "../fe.js";

describe("Lexer & Parser", () => {
  it("parses numbers strictly and rejects non-standard numeric tokens as symbols", async () => {
    const ctx = new FeContext({ onPrint: () => {} });

    assert.equal(ctx.toJS(await ctx.evalString("42")), 42);
    assert.equal(ctx.toJS(await ctx.evalString("-3.14")), -3.14);
    assert.equal(ctx.toJS(await ctx.evalString("1e3")), 1000);
    assert.equal(ctx.toJS(await ctx.evalString("123456789")), 123456789);

    assert.equal((await ctx.evalString("'0x10")).type, FE_TYPE.SYMBOL);
    assert.equal((await ctx.evalString("'1_000")).type, FE_TYPE.SYMBOL);
    assert.equal((await ctx.evalString("'Infinity")).type, FE_TYPE.SYMBOL);
  });

  it("parses strings with escape sequences and reports unclosed strings", async () => {
    const ctx = new FeContext({ onPrint: () => {} });
    const res = await ctx.evalString('"hello\\nworld\\t!"');
    assert.equal(ctx.toJS(res), "hello\nworld\t!");

    await assert.rejects(
      async () => ctx.evalString('"unterminated'),
      (err) => err instanceof FeRuntimeError && /unclosed string/.test(err.message)
    );
  });

  it("parses lists, quotes, dotted pairs, and comments", async () => {
    const ctx = new FeContext({ onPrint: () => {} });
    const res = await ctx.evalString(`
      ; comment line
      '(1 2 3)
    `);
    assert.deepEqual(ctx.toJS(res), [1, 2, 3]);

    const dotted = await ctx.evalString("'(1 . 2)");
    assert.equal(ctx.toJS(ctx.car(dotted)), 1);
    assert.equal(ctx.toJS(ctx.cdr(dotted)), 2);

    await assert.rejects(
      async () => ctx.evalString("(1 . 2 3)"),
      (err) => err instanceof FeRuntimeError && /expected '\)'/.test(err.message)
    );

    await assert.rejects(
      async () => ctx.evalString(")"),
      (err) => err instanceof FeRuntimeError && /stray '\)'/.test(err.message)
    );
  });
});
