const txtinput = document.getElementById("txtinput");
const txtoutput = document.getElementById("txtoutput");
const btnrun = document.getElementById("btnrun");

const fe = new FeContext({
  onPrint: (text) => {
    console.log(text);
  }
});

btnrun.onclick = dorun;

function dorun() {
  try {
    const result = fe.evalString(txtinput.value);
    txtoutput.innerHTML += fe.toString(result, false) + "\n";
  } catch (err) {
    alert(err.message);
  }
}
