const txtinput = document.getElementById("txtinput");
const txtoutput = document.getElementById("txtoutput");
const btnrun = document.getElementById("btnrun");

const appendOutput = (line) => {
  txtoutput.value += line + "\n";
  txtoutput.scrollTop = txtoutput.scrollHeight;
};

const fe = new FeContext({
  onPrint: (text) => {
    console.log(text);
    appendOutput(`[print] ${text}`);
  }
});

btnrun.onclick = dorun;

function formatLoc(err, stream) {
  const line = err.line ?? stream?.line ?? "?";
  const col = err.col ?? stream?.col ?? "?";
  return `${line}:${col}`;
}

function dorun() {
  txtoutput.value = "";

  fe._resetLookahead();
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
    const loc = formatLoc(err, stream);
    appendOutput(`Error at ${loc} (Step ${step}): ${err.message}`);
    if (err.trace && err.trace.length > 0) {
      appendOutput(`Trace: ${err.trace.join(" <- ")}`);
    }
  }
}
