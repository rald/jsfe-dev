const txtinput = document.getElementById("txtinput");
const txtoutput = document.getElementById("txtoutput");
const btnrun = document.getElementById("btnrun");
const guiPane = document.getElementById("gui-pane");

let rafId = null;

const appendOutput = (line) => {
  if (!txtoutput) return;
  txtoutput.value += line + "\n";
  txtoutput.scrollTop = txtoutput.scrollHeight;
};

const fe = new FeContext({
  onPrint: (text) => {
    console.log(text);
    appendOutput(`[print] ${text}`);
  }
});

const imgui = typeof attachImGuiToFe === "function"
  ? attachImGuiToFe(
      fe,
      new MiniImGui({ fullscreen: false, fillContainer: true }),
      guiPane
    )
  : null;

function formatLoc(err, stream) {
  const line = err && err.line != null ? err.line : (stream && stream.line != null ? stream.line : "?");
  const col = err && err.col != null ? err.col : (stream && stream.col != null ? stream.col : "?");
  return `${line}:${col}`;
}

function startFrameLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const drawSym = fe.symbol("draw");
  const drawFn = fe.get(drawSym);
  if (!drawFn || drawFn.type !== FE_TYPE.FUNC) return;

  const stepFrame = () => {
    try {
      const currentDraw = fe.get(drawSym);
      if (!currentDraw || (currentDraw.type !== FE_TYPE.FUNC && currentDraw.type !== FE_TYPE.CFUNC && currentDraw.type !== FE_TYPE.PRIM)) {
        rafId = null;
        return;
      }
      if (imgui && typeof imgui.resizeToContainer === "function") {
        imgui.resizeToContainer();
      }
      fe.calllist = fe.nil;
      fe.eval(fe.cons(drawSym, fe.nil));
      if (imgui) {
        imgui.mouseClicked = false;
      }
      rafId = requestAnimationFrame(stepFrame);
    } catch (err) {
      if (imgui) {
        imgui.mouseClicked = false;
      }
      fe.calllist = fe.nil;
      rafId = null;
      const msg = err && err.message ? err.message : String(err);
      appendOutput(`Frame Error: ${msg}`);
    }
  };

  rafId = requestAnimationFrame(stepFrame);
}

function dorun() {
  if (!txtinput || !txtoutput) return;
  txtoutput.value = "";

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (imgui && typeof imgui.resizeToContainer === "function") {
    imgui.resizeToContainer();
  }

  fe._resetLookahead();
  fe.calllist = fe.nil;
  const stream = new StringStream(txtinput.value);
  let step = 1;

  try {
    let expr;
    while ((expr = fe.read(stream)) !== null) {
      const sourceExpr = fe.toString(expr, true);
      const exprLoc = expr.line != null && expr.col != null ? ` @ ${expr.line}:${expr.col}` : "";
      const result = fe.eval(expr);
      appendOutput(`Step ${step}${exprLoc}: ${sourceExpr} => ${fe.toString(result, true)}`);
      step++;
    }
    if (imgui) {
      imgui.mouseClicked = false;
    }
    startFrameLoop();
  } catch (err) {
    if (imgui) {
      imgui.mouseClicked = false;
    }
    fe.calllist = fe.nil;
    const loc = formatLoc(err, stream);
    const msg = err && err.message ? err.message : String(err);
    appendOutput(`Error at ${loc} (Step ${step}): ${msg}`);
    if (err && Array.isArray(err.trace) && err.trace.length > 0) {
      appendOutput(`Trace: ${err.trace.join(" <- ")}`);
    }
  }
}

if (btnrun) {
  btnrun.onclick = dorun;
}
