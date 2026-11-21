# jsfe — Extensible S-Expression Web OS (Sweetie-16)

`jsfe` is a browser-native Web OS powered by the `fe` tiny Lisp interpreter (`fe.js`), styled exclusively with the **Sweetie-16** color palette (`sweetie.js` / `style.css`), and governed by a strict rule: **all is a list**.

## Core Architecture (Root Folder)
- `index.html` — Web OS desktop shell, topbar, status bar, canvas layer, and window manager.
- `style.css` — Window, launcher, log, and swatch styles using only Sweetie-16 hex colors (`#1a1c2c` through `#333c57`).
- `sweetie.js` — Canonical Sweetie-16 palette definitions and semantic theme tokens.
- `fe.js` — Async-capable `fe` Lisp interpreter with `load`, macros, closures, lists (`cons`/`car`/`cdr`), and JS interop.
- `kernel.js` — S-expression state store, virtual filesystem (`auto.fe`, `sys.fe`, `apps.fe`, `notes.sexp`), process list, Sweetie-16 color validator, and UI bridge primitives (`os-def-app`, `os-open-app`, `os-canvas-*`, `os-win-*`).

## Extending the OS in `fe`
Open the **REPL** or **OS Extender** app and evaluate S-expression lists directly:

```lisp
(def greet-os (who)
  (list (quote hello) who (quote from-fe)))

(os-def-app (quote hello-app)
  (title "Hello Ext")
  (icon "HI")
  (width 320)
  (height 200)
  (render (fn (wid)
    (os-win-clear wid)
    (os-win-add-text wid (os-sexp->str (greet-os "Desktop")) "pistachio"))))

(os-open-app (quote hello-app))
```
