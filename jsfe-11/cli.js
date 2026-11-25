#!/usr/bin/env node
import fs from "node:fs";
import readline from "node:readline";
import { FeContext, FeError, feFormat } from "./fe.js";

const ctx = new FeContext();

export function scanReplInput(str) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
    } else if (ch === ";") {
      while (i < str.length && str[i] !== "\n") i++;
    } else {
      if (ch === '"') {
        inStr = true;
        esc = false;
      } else if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        depth--;
      }
    }
  }
  return { depth, inStr };
}

export function runCode(code, isFile = false, targetCtx = ctx) {
  try {
    return targetCtx.evalString(code);
  } catch (err) {
    if (err instanceof FeError) {
      console.error(`Error: ${err.message}`);
      if (err.stackTrace.length) {
        console.error(`Stack: ${err.stackTrace.join(" <- ")}`);
      }
    } else {
      console.error(err);
    }
    if (isFile) {
      process.exitCode = 1;
    }
    return undefined;
  }
}

const fileArg = process.argv[2];
if (fileArg) {
  try {
    const source = fs.readFileSync(fileArg, "utf8");
    runCode(source, true, ctx);
  } catch (err) {
    console.error(`Failed to read '${fileArg}': ${err.message}`);
    process.exitCode = 1;
  }
} else if (process.stdin.isTTY) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "fe> ",
  });
  let buffer = "";

  rl.on("SIGINT", () => {
    buffer = "";
    console.log("");
    rl.setPrompt("fe> ");
    rl.prompt();
  });

  rl.prompt();
  rl.on("line", (line) => {
    buffer += (buffer ? "\n" : "") + line;
    const { depth, inStr } = scanReplInput(buffer);

    if (depth > 0 || inStr) {
      rl.setPrompt("..> ");
      rl.prompt();
      return;
    }

    if (buffer.trim() === "") {
      buffer = "";
      rl.setPrompt("fe> ");
      rl.prompt();
      return;
    }

    const result = runCode(buffer, false, ctx);
    if (result !== undefined) {
      console.log(feFormat(result, true));
    }
    buffer = "";
    rl.setPrompt("fe> ");
    rl.prompt();
  });
}
