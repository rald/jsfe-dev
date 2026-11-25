# rxi/fe Interpreter (ES6)

A zero-dependency ES6 implementation of an `rxi/fe`-style Lisp interpreter for both **Node.js (CLI)** and **browsers (Web)**.

## Files Included

- `fe.js` — Core reader, evaluator, special forms, macros (`mac`), closures (`fn`), and builtins.
- `cli.js` — Interactive REPL and script runner for Node.js.
- `index.html` — Browser playground using `<script type="module">`.
- `example.fe` — Sample `fe` program demonstrating closures and list reversal.
- `package.json` — Configured with `"type": "module"` for ESM execution.

## Usage

### CLI / REPL (Node.js)
```bash
node cli.js            # Start interactive REPL
node cli.js example.fe # Run a script file
```

### Browser
Serve the directory over HTTP (ES modules require HTTP rather than `file://`):
```bash
npx serve .
# or
python3 -m http.server
```
