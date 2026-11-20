const txtinput = document.getElementById("txtinput");
const txtoutput = document.getElementById("txtoutput");
const btnrun = document.getElementById("btnrun");

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

function formatLoc(err, stream) {
  const line = err && err.line != null ? err.line : (stream && stream.line != null ? stream.line : "?");
  const col = err && err.col != null ? err.col : (stream && stream.col != null ? stream.col : "?");
  return `${line}:${col}`;
}

function dorun() {
  if (!txtinput || !txtoutput) return;
  txtoutput.value = "";

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
  } catch (err) {
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
