import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FeContext, FeRuntimeError } from "../fe.js";

describe("Macros, Error Traces & Node.js Interop", () => {
  it("expands macros without mutating shared AST forms", async () => {
    const ctx = new FeContext({ onPrint: () => {} });
    const res = await ctx.evalString(`
      (do
        (let when (mac (cond . body)
          (list 'if cond (cons 'do body))))
        (let count 0)
        (when t
          (= count (+ count 10))
          (= count (+ count 5)))
        count)
    `);
    assert.equal(ctx.toJS(res), 15);
  });

  it("unwinds calllist cleanly on runtime errors", async () => {
    const ctx = new FeContext({ onPrint: () => {} });
    await assert.rejects(
      async () => ctx.evalString(`
        (do
          (let boom (fn () (/ 1 0)))
          (boom))
      `),
      (err) => err instanceof FeRuntimeError && err.trace.length > 0
    );
    assert.equal(ctx.isNil(ctx.calllist), true);
  });

  it("bridges async JS functions and Node.js file loading via load", async () => {
    const ctx = new FeContext({ onPrint: () => {} });
    ctx.define("async-double", async (_ctx, n) => n * 2);

    const jsRes = await ctx.evalString("(async-double 21)");
    assert.equal(ctx.toJS(jsRes), 42);

    const tmpFile = path.join(os.tmpdir(), `fe_tdd_${Date.now()}.lisp`);
    fs.writeFileSync(tmpFile, "(+ 100 (async-double 12))\n", "utf8");
    try {
      const loaded = await ctx.evalString(`(load "${tmpFile.replace(/\\/g, "/")}")`);
      assert.equal(ctx.toJS(loaded), 124);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
