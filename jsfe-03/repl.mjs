#!/usr/bin/env node
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FeContext, FeRuntimeError, PRIM_NAMES, StringStream } from "./fe.mjs";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  reset: useColor ? "\x1b[0m" : "",
  dim: useColor ? "\x1b[2m" : "",
  bold: useColor ? "\x1b[1m" : "",
  cyan: useColor ? "\x1b[36m" : "",
  green: useColor ? "\x1b[32m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  red: useColor ? "\x1b[31m" : ""
};

const HISTORY_FILE = path.join(os.homedir(), ".fe_repl_history");
const MAX_HISTORY = 500;

function printUsage() {
  console.log(`Usage: repl.mjs [options] [script.fe] [arguments...]

Options:
  -e, --eval <code>   Evaluate inline fe code
  -i, --interactive   Enter interactive REPL after running scripts/-e
  -h, --help          Show this help message and exit

Examples:
  repl.mjs                        Start interactive REPL
  repl.mjs app.fe foo bar         Execute app.fe with args ("foo" "bar")
  repl.mjs -e "(+ 1 2 3)"         Evaluate expression and print result
  repl.mjs -i setup.fe            Load setup.fe, then start interactive REPL
  cat app.fe | repl.mjs           Read and execute fe code from stdin`);
}

function parseCliArgs(argv) {
  const opts = {
    evals: [],
    script: null,
    scriptArgs: [],
    interactive: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Once a script file is encountered, all remaining tokens are script arguments
    if (opts.script !== null) {
      opts.scriptArgs.push(arg);
      continue;
    }

    if (arg === "--") {
      if (i + 1 < argv.length) {
        opts.script = argv[i + 1];
        opts.scriptArgs = argv.slice(i + 2);
      }
      break;
    }

    if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "-i" || arg === "--interactive") {
      opts.interactive = true;
    } else if (arg === "-e" || arg === "--eval") {
      if (i + 1 >= argv.length) {
        throw new Error(`Option ${arg} requires an argument`);
      }
      opts.evals.push(argv[++i]);
    } else if (arg.startsWith("--eval=")) {
      opts.evals.push(arg.slice("--eval=".length));
    } else if (arg.startsWith("-e") && arg.length > 2) {
      opts.evals.push(arg.slice(2));
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      opts.script = arg;
    }
  }

  return opts;
}

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

function getDefinedSymbols(ctx) {
  const symbols = new Set([...PRIM_NAMES, "nil", "t", "load", "argv", "program-name", "quit", "exit"]);
  let cur = ctx.symlist;
  while (!ctx.isNil(cur)) {
    const sym = cur.car;
    const name = ctx.toString(sym, false);
    if (name) symbols.add(name);
    cur = cur.cdr;
  }
  return Array.from(symbols).sort();
}

function createContext(programName = "fe", scriptArgs = []) {
  const ctx = new FeContext({
    onPrint: (text) => {
      process.stdout.write(`${text}\n`);
    }
  });

  ctx.set("program-name", ctx.string(programName));
  ctx.set("argv", ctx.list(scriptArgs.map((s) => ctx.string(s))));

  ctx.define("exit", (_c, codeObj) => {
    const code = codeObj && typeof codeObj.cdr === "number" ? codeObj.cdr : 0;
    process.exit(code);
  });
  ctx.define("quit", (_c, codeObj) => {
    const code = codeObj && typeof codeObj.cdr === "number" ? codeObj.cdr : 0;
    process.exit(code);
  });
  ctx.define("time", async (c, exprFn) => {
    const start = performance.now();
    let val = exprFn;
    if (exprFn && (exprFn.type === 6 || exprFn.type === 8 || exprFn.type === 9)) {
      val = await c.eval(c.list([exprFn]));
    }
    const elapsed = (performance.now() - start).toFixed(3);
    console.error(`${c.dim}[time: ${elapsed}ms]${c.reset}`);
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
    console.error(`${c.red}Error:${c.reset}`, err && err.message ? err.message : err);
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

function printReplHelp() {
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

async function runInteractiveRepl(ctx, programName, scriptArgs) {
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
          printReplHelp();
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
          ctx = createContext(programName, scriptArgs);
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

async function main() {
  let opts;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${c.red}Error:${c.reset} ${err.message}\n`);
    printUsage();
    process.exit(1);
  }

  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  const programName = opts.script || (opts.evals.length > 0 ? "-e" : "fe");
  const ctx = createContext(programName, opts.scriptArgs);
  let ranCode = false;

  // 1. Evaluate any -e / --eval snippets in order
  for (const snippet of opts.evals) {
    try {
      ranCode = true;
      const { lastResult } = await evaluateAll(ctx, snippet);
      if (lastResult !== null && !opts.interactive) {
        process.stdout.write(`${ctx.toString(lastResult, false)}\n`);
      }
    } catch (err) {
      formatError(err);
      process.exit(1);
    }
  }

  // 2. Execute script file if provided (standard batch execution, does not auto-open REPL)
  if (opts.script !== null) {
    try {
      ranCode = true;
      const resolved = path.resolve(opts.script);
      const code = fs.readFileSync(resolved, "utf8");
      await evaluateAll(ctx, code);
    } catch (err) {
      formatError(err);
      process.exit(1);
    }
  }

  // 3. If neither -e nor a script was passed and stdin is piped, read and execute stdin
  if (!ranCode && !process.stdin.isTTY) {
    try {
      const stdinCode = fs.readFileSync(0, "utf8");
      if (stdinCode.trim()) {
        ranCode = true;
        await evaluateAll(ctx, stdinCode);
      }
    } catch (err) {
      formatError(err);
      process.exit(1);
    }
  }

  // 4. Enter interactive REPL when requested with -i, or when no script/-e/piped input was given
  if (opts.interactive || (!ranCode && process.stdin.isTTY)) {
    await runInteractiveRepl(ctx, programName, opts.scriptArgs);
  }
}

main();