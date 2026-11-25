#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { FeContext, FeError, feFormat } from "./fe.js";

export function scanReplInput(str) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  let pendingQuote = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
        pendingQuote = false;
      }
    } else if (ch === ";") {
      while (i < str.length && str[i] !== "\n") i++;
    } else if (/\s/.test(ch)) {
      // Whitespace preserves pendingQuote until a quoted datum starts
    } else if (ch === "'") {
      pendingQuote = true;
    } else if (ch === '"') {
      inStr = true;
      esc = false;
      pendingQuote = false;
    } else if (ch === "(") {
      depth++;
      pendingQuote = false;
    } else if (ch === ")") {
      // Track negative depth so unmatched ')' doesn't cancel out a later '('
      depth--;
      pendingQuote = false;
    } else {
      pendingQuote = false;
    }
  }

  return { depth, inStr, pendingQuote };
}

export function runCode(code, isFile = false, targetCtx = new FeContext()) {
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

export function main(argv = process.argv) {
  const ctx = new FeContext();
  const fileArg = argv[2];

  if (fileArg) {
    try {
      const source = fs.readFileSync(fileArg, "utf8");
      runCode(source, true, ctx);
    } catch (err) {
      console.error(`Failed to read '${fileArg}': ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  if (process.stdin.isTTY) {
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
      const { depth, inStr, pendingQuote } = scanReplInput(buffer);

      // If depth < 0, an unmatched ')' occurred; evaluate immediately to report syntax error
      if (depth >= 0 && (depth > 0 || inStr || pendingQuote)) {
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
    return;
  }

  let piped = "";
  process.stdin.setEncoding("utf8");
  const onData = (chunk) => {
    piped += chunk;
  };
  const onEnd = () => {
    process.stdin.off("data", onData);
    process.stdin.off("end", onEnd);
    if (piped.trim() !== "") {
      runCode(piped, true, ctx);
    }
  };
  process.stdin.on("data", onData);
  process.stdin.on("end", onEnd);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
