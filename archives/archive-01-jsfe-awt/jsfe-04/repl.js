class FeRepl {
  constructor(inputEl, outputEl) {
    this.txtinput = inputEl;
    this.txtoutput = outputEl;
    this.rafId = null;

    this.fe = new FeContext({
      onPrint: (text) => {
        console.log(text);
        this.appendOutput(`[print] ${text}`);
      }
    });
  }

  appendOutput(line) {
    if (!this.txtoutput) return;
    this.txtoutput.value += line + "\n";
    this.txtoutput.scrollTop = this.txtoutput.scrollHeight;
  }

  formatLoc(err, stream) {
    const line = err && err.line != null ? err.line : (stream && stream.line != null ? stream.line : "?");
    const col = err && err.col != null ? err.col : (stream && stream.col != null ? stream.col : "?");
    return `${line}:${col}`;
  }

  startFrameLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const drawSym = this.fe.symbol("draw");
    const drawFn = this.fe.get(drawSym);
    if (!drawFn || drawFn.type !== FE_TYPE.FUNC) return;

    const stepFrame = () => {
      try {
        const currentDraw = this.fe.get(drawSym);
        if (!currentDraw || (currentDraw.type !== FE_TYPE.FUNC && currentDraw.type !== FE_TYPE.CFUNC && currentDraw.type !== FE_TYPE.PRIM)) {
          this.rafId = null;
          return;
        }
        this.fe.calllist = this.fe.nil;
        this.fe.eval(this.fe.cons(drawSym, this.fe.nil));
        this.rafId = requestAnimationFrame(stepFrame);
      } catch (err) {
        this.fe.calllist = this.fe.nil;
        this.rafId = null;
        const msg = err && err.message ? err.message : String(err);
        this.appendOutput(`Frame Error: ${msg}`);
      }
    };

    this.rafId = requestAnimationFrame(stepFrame);
  }

  run() {
    if (!this.txtinput || !this.txtoutput) return;
    this.txtoutput.value = "";

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.fe._resetLookahead();
    this.fe.calllist = this.fe.nil;
    const stream = new StringStream(this.txtinput.value);
    let step = 1;

    try {
      let expr;
      while ((expr = this.fe.read(stream)) !== null) {
        const sourceExpr = this.fe.toString(expr, true);
        const exprLoc = expr.line != null && expr.col != null ? ` @ ${expr.line}:${expr.col}` : "";
        const result = this.fe.eval(expr);
        this.appendOutput(`Step ${step}${exprLoc}: ${sourceExpr} => ${this.fe.toString(result, true)}`);
        step++;
      }
      this.startFrameLoop();
    } catch (err) {
      this.fe.calllist = this.fe.nil;
      const loc = this.formatLoc(err, stream);
      const msg = err && err.message ? err.message : String(err);
      this.appendOutput(`Error at ${loc}: ${msg}`);
    }
  }
}

// Initialization
const repl = new FeRepl(
  document.getElementById("txtinput"),
  document.getElementById("txtoutput")
);

document.getElementById("btnrun")?.addEventListener("click", () => repl.run());
