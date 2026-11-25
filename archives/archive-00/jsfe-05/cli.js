#!/usr/bin/env node
import fs from "node:fs";
import readline from "node:readline";
import { FeContext, FeError, feFormat } from "./fe.js";

const ctx = new FeContext();

function runCode(code) {
  try {
    return ctx.evalString(code);
  } catch (err) {
    if (err instanceof FeError) {
      console.error(`Error: ${err.message}`);
      if (err.stackTrace.length) {
        console.error(`Stack: ${err.stackTrace.join(" <- ")}`);
      }
    } else {
      console.error(err);
    }
    return undefined;
  }
}

const fileArg = process.argv[2];
if (fileArg) {
  try {
    const source = fs.readFileSync(fileArg, "utf8");
    runCode(source);
  } catch (err) {
    console.error(`Failed to read '${fileArg}': ${err.message}`);
    process.exitCode = 1;
  }
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "fe> ",
  });
  let buffer = "";

  function scanInput(str) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === ";") {
        while (i < str.length && str[i] !== "\n") i++;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
    }
    return { depth, inStr };
  }

  rl.prompt();
  rl.on("line", (line) => {
    buffer += (buffer ? "\n" : "") + line;
    const { depth, inStr } = scanInput(buffer);

    if (depth > 0 || inStr) {
      rl.setPrompt("..> ");
      rl.prompt();
      return;
    }

    const result = runCode(buffer);
    if (result !== undefined) {
      console.log(feFormat(result, true));
    }
    buffer = "";
    rl.setPrompt("fe> ");
    rl.prompt();
  });
}
