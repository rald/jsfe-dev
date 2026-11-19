// Write JavaScript functions and expose them to fe Lisp!
// Signature: fe.define("lisp-name", (ctx, ...args) => returnValue)
// Or bind values directly with fe.set("NAME", jsValue)

// 1. Math constants & functions
fe.set("PI", Math.PI);
fe.set("E", Math.E);

fe.define("sin", (ctx, x) => Math.sin(x));
fe.define("cos", (ctx, x) => Math.cos(x));
fe.define("sqrt", (ctx, x) => Math.sqrt(x));
fe.define("pow", (ctx, x, y) => Math.pow(x, y));
fe.define("rand", () => Math.random());

fe.define("math/sin", (ctx, x) => Math.sin(x));

// 4. Evaluate arbitrary JavaScript or load external JS/fe files from fe
fe.define("js/eval", (ctx, code) => {
  return (0, eval)(String(code));
});

fe.define("js/load", (ctx, url) => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", String(url), false);
  xhr.send(null);
  if (xhr.status >= 200 && xhr.status < 300) {
    const fn = new Function("fe", "FeObject", "FE_TYPE", "showToast", xhr.responseText);
    fn(fe, FeObject, FE_TYPE, showToast);
    return true;
  }
  ctx.error("failed to load js file: " + url + " (HTTP " + xhr.status + ")");
});

fe.define("load", (ctx, url) => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", String(url), false);
  xhr.send(null);
  if (xhr.status >= 200 && xhr.status < 300) {
    return ctx.evalString(xhr.responseText);
  }
  ctx.error("failed to load fe file: " + url + " (HTTP " + xhr.status + ")");
});
