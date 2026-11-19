/**
 * ============================================================================
 * os.js — Browser REPL / Runner Shell Controller for `fe`
 * ============================================================================
 */

class ConsoleView {
  #inputEl;
  #outputEl;
  #runButtonEl;

  constructor({ inputEl, outputEl, runButtonEl }) {
    this.#inputEl = inputEl;
    this.#outputEl = outputEl;
    this.#runButtonEl = runButtonEl;
  }

  get input() {
    return this.#inputEl?.value ?? "";
  }

  clearOutput() {
    if (!this.#outputEl) return;
    this.#outputEl.value = "";
  }

  appendLine(line) {
    if (!this.#outputEl) return;
    this.#outputEl.value += `${line}\n`;
    this.#outputEl.scrollTop = this.#outputEl.scrollHeight;
  }

  onRun(handler) {
    this.#runButtonEl?.addEventListener("click", () => handler());
  }
}

class FeShell {
  #view;
  #fe;

  constructor(view) {
    this.#view = view;
    this.#fe = new FeContext({
      onPrint: (text) => {
        console.log(text);
        this.#view.appendLine(`[print] ${text}`);
      }
    });
  }

  get context() {
    return this.#fe;
  }

  #formatLocation(err, stream) {
    const line = err.line ?? stream?.line ?? "?";
    const col = err.col ?? stream?.col ?? "?";
    return `${line}:${col}`;
  }

  evalSource(source, { logSteps = true } = {}) {
    this.#fe.resetLookahead();
    const stream = new StringStream(source);
    let step = 1;
    let lastResult = this.#fe.nil;
    let expr;

    while ((expr = this.#fe.read(stream)) !== null) {
      const sourceExpr = this.#fe.toString(expr, true);
      const exprLoc = expr.locationText ? ` @ ${expr.locationText}` : "";
      lastResult = this.#fe.eval(expr);

      if (logSteps) {
        this.#view.appendLine(
          `Step ${step}${exprLoc}: ${sourceExpr} => ${this.#fe.toString(lastResult, true)}`
        );
      }
      step++;
    }

    return lastResult;
  }

  run() {
    this.#view.clearOutput();
    try {
      return this.evalSource(this.#view.input, { logSteps: true });
    } catch (err) {
      const loc = this.#formatLocation(err, null);
      this.#view.appendLine(`Error at ${loc}: ${err.message}`);
      if (err.trace?.length > 0) {
        this.#view.appendLine(`Trace: ${err.trace.join(" <- ")}`);
      }
      return null;
    }
  }
}

const shell = new FeShell(
  new ConsoleView({
    inputEl: document.getElementById("txtinput"),
    outputEl: document.getElementById("txtoutput"),
    runButtonEl: document.getElementById("btnrun")
  })
);

shell.view?.onRun?.(() => shell.run());
// Wire run button directly through a public method on FeShell
document.getElementById("btnrun")?.addEventListener("click", () => shell.run());
