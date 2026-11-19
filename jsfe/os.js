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

function dorun() {
	txtoutput.value="";

  fe.nextchr = "";
  const stream = new StringStream(txtinput.value);
  let step = 1;

  try {
    let expr;
    while ((expr = fe.read(stream)) !== null) {
      const sourceExpr = fe.toString(expr, true);
      const result = fe.eval(expr);
      appendOutput(`Step ${step}: ${sourceExpr} => ${fe.toString(result, true)}`);
      step++;
    }
  } catch (err) {
    appendOutput(`Error at Step ${step}: ${err.message}`);
    if (err.trace && err.trace.length > 0) {
      appendOutput(`Trace: ${err.trace.join(" <- ")}`);
    }
  }
}
