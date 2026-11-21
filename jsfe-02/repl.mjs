#!/usr/bin/env node
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FeContext, FeRuntimeError, PRIM_NAMES, StringStream } from "./fe.mjs";

// ANSI color helpers (respects NO_COLOR)
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  reset: useColor ? "\x1b[0m" : "",
  dim: useColor ? "\x1b[2m" : "",
  bold: useColor ? "\x1b[1m" : "",
  cyan: useColor ? "\x1b[36m" : "",
  green: useColor ? "\x1b[32m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  red: useColor ? "\x1b[31m" : "",
  magenta: useColor ? "\x1b[35m" : ""
};

const HISTORY_FILE = path.join(os.homedir(), ".fe_repl_history");
const MAX_HISTORY = 500;

/**
 * Checks whether an input buffer has balanced parentheses and closed strings.
 */
function analyzeBuffer(src) {
  let depth = 0;
  let inString = false;
  let escape = false;
  let inComment = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inComment) {
      if (ch === "\n") inComment = false;
      continue;
    }

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === ";") {
      inComment = true;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth < 0) {
        return { complete: true, depth, inString: false };
      }
    }
  }

  return {
    complete: !inString && depth === 0,
    depth: Math.max(0, depth),
    inString
  };
}

/**
 * Collects all interned symbols in the FeContext for tab-completion.
 */
function getDefinedSymbols(ctx) {
  const symbols = new Set([...PRIM_NAMES, "nil", "t", "load", "quit", "exit"]);
  let cur = ctx.symlist;
  while (!ctx.isNil(cur)) {
    const sym = cur.car;
    const name = ctx.toString(sym, false);
    if (name) symbols.add(name);
    cur = cur.cdr;
  }
  return Array.from(symbols).sort();
}

/**
 * Creates and configures a fresh FeContext with useful REPL bindings.
 */
function createContext() {
  const ctx = new FeContext({
    onPrint: (text) => {
      process.stdout.write(`${text}\n`);
    }
  });

  ctx.define("exit", () => process.exit(0));
  ctx.define("quit", () => process.exit(0));
  ctx.define("time", async (c, exprFn) => {
    const start = performance.now();
    let val = exprFn;
    if (exprFn && (exprFn.type === 6 || exprFn.type === 8 || exprFn.type === 9)) {
      val = await c.eval(c.list([exprFn]));
    }
    const elapsed = (performance.now() - start).toFixed(3);
    console.log(`${c.dim}[time: ${elapsed}ms]${c.reset}`);
    return val;
  });

  return ctx;
}

function formatError(err) {
  if (err instanceof FeRuntimeError) {
    const loc = err.line != null && err.col != null ? ` at ${err.line}:${err.col}` : "";
    console.error(`${c.red}${c.bold}Error${loc}:${c.reset} ${c.red}${err.message}${c.reset}`);
    if (Array.isArray(err.trace) && err.trace.length > 0) {
      for (const frame of err.trace) {
        console.error(`${c.dim}  in ${frame}${c.reset}`);
      }
    }
  } else {
    console.error(`${c.red}Error:${c.reset}`, err);
  }
}

async function evaluateAll(ctx, source) {
  ctx._resetLookahead();
  const stream = new StringStream(source);
  let lastResult = null;
  let count = 0;

  let expr;
  while ((expr = ctx.read(stream)) !== null) {
    lastResult = await ctx.eval(expr);
    count++;
  }

  return { lastResult, count };
}

function printHelp() {
  console.log(`
${c.bold}REPL Commands:${c.reset}
  ${c.cyan}:help${c.reset}            Show this help message
  ${c.cyan}:load <file>${c.reset}     Evaluate a .fe source file in the current context
  ${c.cyan}:env${c.reset}             List all bound global symbols
  ${c.cyan}:reset${c.reset}           Reset the interpreter state to a clean environment
  ${c.cyan}:clear${c.reset}           Clear the terminal screen
  ${c.cyan}:quit${c.reset} / ${c.cyan}:exit${c.reset}    Exit the REPL
`);
}

async function startRepl() {
  let ctx = createContext();

  const cliFiles = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const interactive = !process.argv.includes("--no-repl") && process.stdin.isTTY;

  for (const file of cliFiles) {
    try {
      const resolved = path.resolve(file);
      const code = fs.readFileSync(resolved, "utf8");
      await evaluateAll(ctx, code);
    } catch (err) {
      formatError(err);
      if (!interactive) process.exit(1);
    }
  }

  if (cliFiles.length > 0 && !interactive) {
    return;
  }

  let initialHistory = [];
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      initialHistory = fs.readFileSync(HISTORY_FILE, "utf8")
        .split("\n")
        .filter(Boolean)
        .reverse()
        .slice(0, MAX_HISTORY);
    }
  } catch {
    // Ignore history read errors
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    history: initialHistory,
    historySize: MAX_HISTORY,
    completer: (line) => {
      if (line.startsWith(":")) {
        const cmds = [":help", ":load ", ":env", ":reset", ":clear", ":quit", ":exit"];
        const hits = cmds.filter((cmd) => cmd.startsWith(line));
        return [hits.length ? hits : cmds, line];
      }

      const match = line.match(/([^\s()"';]+)$/);
      const partial = match ? match[1] : "";
      const symbols = getDefinedSymbols(ctx);
      const hits = symbols.filter((s) => s.startsWith(partial));
      return [hits, partial];
    }
  });

  const saveHistory = () => {
    try {
      const lines = [...rl.history].reverse().slice(-MAX_HISTORY);
      fs.writeFileSync(HISTORY_FILE, lines.join("\n") + "\n", "utf8");
    } catch {
      // Ignore history write errors
    }
  };

  console.log(`${c.bold}${c.cyan}fe Lisp REPL${c.reset} ${c.dim}(Node.js ${process.version})${c.reset}`);
  console.log(`${c.dim}Type :help for commands, or (quit) / Ctrl+D to exit.${c.reset}\n`);

  let buffer = "";

  const updatePrompt = () => {
    if (!buffer) {
      rl.setPrompt(`${c.cyan}fe>${c.reset} `);
    } else {
      const { depth } = analyzeBuffer(buffer);
      const pad = "  ".repeat(Math.min(depth, 8));
      rl.setPrompt(`${c.dim}..>${c.reset} ${pad}`);
    }
  };

  rl.on("SIGINT", () => {
    if (buffer.length > 0) {
      buffer = "";
      console.log(`\n${c.yellow}(buffer cleared)${c.reset}`);
      updatePrompt();
      rl.prompt();
    } else {
      console.log(`\n${c.dim}(Use :quit or Ctrl+D to exit)${c.reset}`);
      rl.prompt();
    }
  });

  rl.on("close", () => {
    saveHistory();
    console.log(`\n${c.dim}Bye!${c.reset}`);
    process.exit(0);
  });

  updatePrompt();
  rl.prompt();

  for await (const line of rl) {
    const trimmed = line.trim();

    if (!buffer && trimmed.startsWith(":")) {
      const [cmd, ...rest] = trimmed.split(/\s+/);
      const arg = rest.join(" ");

      switch (cmd) {
        case ":help":
        case ":h":
          printHelp();
          break;

        case ":quit":
        case ":exit":
        case ":q":
          rl.close();
          return;

        case ":clear":
        case ":cls":
          console.clear();
          break;

        case ":reset":
          ctx = createContext();
          console.log(`${c.yellow}Interpreter context reset.${c.reset}`);
          break;

        case ":env": {
          const syms = getDefinedSymbols(ctx).filter((s) => !ctx.isNil(ctx.get(s)));
          console.log(`${c.bold}Bound symbols (${syms.length}):${c.reset}`);
          console.log(syms.map((s) => `${c.cyan}${s}${c.reset}`).join(", "));
          break;
        }

        case ":load": {
          if (!arg) {
            console.error(`${c.red}Usage: :load <filepath>${c.reset}`);
            break;
          }
          try {
            const filePath = path.resolve(arg.replace(/^["']|["']$/g, ""));
            const code = fs.readFileSync(filePath, "utf8");
            const { lastResult, count } = await evaluateAll(ctx, code);
            console.log(`${c.dim};; Loaded ${filePath} (${count} expression${count === 1 ? "" : "s"})${c.reset}`);
            if (lastResult !== null) {
              console.log(`${c.green}=> ${ctx.toString(lastResult, true)}${c.reset}`);
            }
          } catch (err) {
            formatError(err);
          }
          break;
        }

        default:
          console.error(`${c.red}Unknown command: ${cmd}. Type :help for available commands.${c.reset}`);
      }

      updatePrompt();
      rl.prompt();
      continue;
    }

    buffer = buffer ? `${buffer}\n${line}` : line;

    if (!buffer.trim()) {
      buffer = "";
      updatePrompt();
      rl.prompt();
      continue;
    }

    const status = analyzeBuffer(buffer);
    if (!status.complete) {
      updatePrompt();
      rl.prompt();
      continue;
    }

    const source = buffer;
    buffer = "";

    try {
      const { lastResult } = await evaluateAll(ctx, source);
      if (lastResult !== null) {
        ctx.set("_", lastResult);
        console.log(`${c.green}=> ${ctx.toString(lastResult, true)}${c.reset}`);
      }
    } catch (err) {
      formatError(err);
    }

    updatePrompt();
    rl.prompt();
  }
}

startRepl();
