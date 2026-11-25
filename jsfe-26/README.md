# jsfe

A zero-dependency ES6 implementation of an `rxi/fe`-style Lisp interpreter for both **Node.js (CLI/REPL)** and **browsers (Web)**.

## Files Included

- `fe.js` — Core reader, evaluator, special forms, macros (`mac`), closures (`fn`), and builtins.
- `repl.js` — Interactive REPL and script runner for Node.js.
- `test.js` — Unit tests using Node's built-in test runner.
- `index.html` — Browser playground using `<script type="module">`.
- `showcase.fe` — Feature showcase `fe` script demonstrating language constructs and macros.
- `package.json` — Configured with `"type": "module"` for ESM execution.

## Usage

### REPL & Scripts (Node.js)
```bash
node repl.js             # Start interactive REPL
node repl.js showcase.fe # Run a script file
npm test                 # Run unit tests
```

### Browser
Serve the directory over HTTP (ES modules require HTTP rather than `file://`):
```bash
npx serve .
# or
python3 -m http.server
```
