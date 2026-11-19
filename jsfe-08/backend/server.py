"""
WebOS Backend Server built with Python Bottle-0.12 and SQLite3.
Includes a lightweight `cgi` compatibility shim for Python 3.13+ where PEP 594
removed the standard-library `cgi` module used by Bottle 0.12.
"""

import html
import os
import re
import sqlite3
import sys
import threading
import types
from urllib.parse import parse_qs
from datetime import datetime, timezone


def _install_py313_cgi_shim():
    if "cgi" in sys.modules:
        return
    cgi_shim = types.ModuleType("cgi")
    cgi_shim.escape = lambda s, quote=False: html.escape(s, quote=quote)
    cgi_shim.parse_header = lambda line: (
        line.split(";", 1)[0].strip().lower(),
        {
            k.strip().lower(): v.strip().strip('"')
            for part in line.split(";")[1:]
            if "=" in part
            for k, v in [part.split("=", 1)]
        },
    )
    cgi_shim.parse_qs = parse_qs
    sys.modules["cgi"] = cgi_shim


_install_py313_cgi_shim()

from bottle import Bottle, request, response, static_file, abort


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(BASE_DIR, "webos_sexpr.db")
STATIC_DIR = os.path.join(PROJECT_ROOT, "static")
FE_SRC_DIR = os.path.join(PROJECT_ROOT, "fe_src")


class SExprCodec:
    """Strategy Pattern: Converts Python structures to/from canonical S-expression strings."""

    @staticmethod
    def escape_str(val: str) -> str:
        escaped = (
            val.replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
        )
        return f'"{escaped}"'

    @classmethod
    def encode(cls, obj) -> str:
        if obj is None or obj is False:
            return "nil"
        if obj is True:
            return "t"
        if isinstance(obj, (int, float)):
            return str(obj)
        if isinstance(obj, str):
            return cls.escape_str(obj)
        if isinstance(obj, dict):
            pairs = " ".join(
                f"({cls.escape_str(str(k))} {cls.encode(v)})" for k, v in obj.items()
            )
            return f"(dict {pairs})"
        if isinstance(obj, (list, tuple)):
            return "(" + " ".join(cls.encode(item) for item in obj) + ")"
        return cls.escape_str(str(obj))

    @classmethod
    def tokenize(cls, sexpr_text: str):
        token_pattern = re.compile(r'\s*(;[^\n]*|"(\\.|[^"\\])*"|\(|\)|[^\s()";]+)')
        tokens = []
        for match in token_pattern.finditer(sexpr_text):
            tok = match.group(1)
            if tok and not tok.startswith(";"):
                tokens.append(tok)
        return tokens

    @classmethod
    def parse(cls, sexpr_text: str):
        tokens = cls.tokenize(sexpr_text)
        if not tokens:
            return None
        idx = 0

        def parse_atom(tok: str):
            if tok == "nil":
                return None
            if tok == "t":
                return True
            if tok.startswith('"') and tok.endswith('"'):
                inner = tok[1:-1]
                return (
                    inner.replace("\\n", "\n")
                    .replace("\\r", "\r")
                    .replace("\\t", "\t")
                    .replace('\\"', '"')
                    .replace("\\\\", "\\")
                )
            try:
                if "." in tok:
                    return float(tok)
                return int(tok)
            except ValueError:
                return tok

        def parse_expr():
            nonlocal idx
            if idx >= len(tokens):
                return None
            tok = tokens[idx]
            idx += 1
            if tok == "(":
                items = []
                while idx < len(tokens) and tokens[idx] != ")":
                    items.append(parse_expr())
                if idx < len(tokens) and tokens[idx] == ")":
                    idx += 1
                if items and items[0] == "dict":
                    d = {}
                    for pair in items[1:]:
                        if isinstance(pair, list) and len(pair) == 2:
                            d[str(pair[0])] = pair[1]
                    return d
                return items
            if tok == ")":
                return None
            return parse_atom(tok)

        return parse_expr()


class SQLiteSingletonModel:
    """Singleton + Repository Model managing S-expression persisted nodes in SQLite3 without ResourceWarnings."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, db_path: str = DB_PATH):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self, db_path: str = DB_PATH):
        if self._initialized:
            return
        self.db_path = db_path
        self._conn_lock = threading.Lock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()
        self._seed_defaults()
        self._initialized = True

    def close(self):
        with self._conn_lock:
            if getattr(self, "_conn", None) is not None:
                try:
                    self._conn.close()
                finally:
                    self._conn = None

    def __del__(self):
        try:
            self.close()
        except Exception:
            pass

    def _init_schema(self):
        with self._conn_lock:
            with self._conn:
                self._conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS fs_nodes (
                        path TEXT PRIMARY KEY,
                        kind TEXT NOT NULL CHECK(kind IN ('dir', 'file')),
                        sexpr_content TEXT NOT NULL,
                        sexpr_meta TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                self._conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS editor_sessions (
                        id TEXT PRIMARY KEY,
                        sexpr_state TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )

    def _seed_defaults(self):
        existing = self.list_nodes()
        if existing:
            return
        now = datetime.now(timezone.utc).isoformat()
        starter_files = [
            (
                "/",
                "dir",
                "()",
                SExprCodec.encode({"created": now, "owner": "root", "format": "sexpr"}),
            ),
            (
                "/hello.fe",
                "file",
                SExprCodec.encode(
                    ["do", ["print", "Hello from DOS EDIT.COM on WebOS!"], ["list", "os", "fe-lisp", "sqlite3"]]
                ),
                SExprCodec.encode({"created": now, "format": "sexpr"}),
            ),
            (
                "/factorial.fe",
                "file",
                SExprCodec.encode(
                    [
                        "=",
                        "fact",
                        ["fn", ["n"], ["if", ["<=", "n", 1], 1, ["*", "n", ["fact", ["-", "n", 1]]]]],
                    ]
                ),
                SExprCodec.encode({"created": now, "format": "sexpr"}),
            ),
        ]
        for path, kind, content, meta in starter_files:
            self.upsert_node(path, kind, content, meta)

    def upsert_node(self, path: str, kind: str, sexpr_content: str, sexpr_meta: str = "()"):
        norm_path = path if path.startswith("/") else f"/{path}"
        now = datetime.now(timezone.utc).isoformat()
        with self._conn_lock:
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO fs_nodes (path, kind, sexpr_content, sexpr_meta, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(path) DO UPDATE SET
                        kind = excluded.kind,
                        sexpr_content = excluded.sexpr_content,
                        sexpr_meta = excluded.sexpr_meta,
                        updated_at = excluded.updated_at
                    """,
                    (norm_path, kind, sexpr_content, sexpr_meta, now),
                )
        return self.get_node(norm_path)

    def get_node(self, path: str):
        norm_path = path if path.startswith("/") else f"/{path}"
        with self._conn_lock:
            cur = self._conn.cursor()
            try:
                row = cur.execute(
                    "SELECT path, kind, sexpr_content, sexpr_meta, updated_at FROM fs_nodes WHERE path = ?",
                    (norm_path,),
                ).fetchone()
                return dict(row) if row else None
            finally:
                cur.close()

    def list_nodes(self):
        with self._conn_lock:
            cur = self._conn.cursor()
            try:
                rows = cur.execute(
                    "SELECT path, kind, sexpr_content, sexpr_meta, updated_at FROM fs_nodes ORDER BY path ASC"
                ).fetchall()
                return [dict(r) for r in rows]
            finally:
                cur.close()

    def delete_node(self, path: str) -> bool:
        norm_path = path if path.startswith("/") else f"/{path}"
        if norm_path == "/":
            return False
        with self._conn_lock:
            with self._conn:
                cur = self._conn.cursor()
                try:
                    cur.execute("DELETE FROM fs_nodes WHERE path = ?", (norm_path,))
                    return cur.rowcount > 0
                finally:
                    cur.close()

    def to_sexpr_listing(self) -> str:
        nodes = self.list_nodes()
        encoded_nodes = []
        for n in nodes:
            encoded_nodes.append(
                f'(fs-node (path {SExprCodec.escape_str(n["path"])}) '
                f'(kind {n["kind"]}) '
                f'(content {n["sexpr_content"]}) '
                f'(meta {n["sexpr_meta"]}) '
                f'(updated {SExprCodec.escape_str(n["updated_at"])}))'
            )
        return "(fs-listing (" + " ".join(encoded_nodes) + "))"


class FileSystemController:
    """MVC Controller handling HTTP routes for S-Expression filesystem & editor state."""

    def __init__(self, app: Bottle, model: SQLiteSingletonModel, codec: SExprCodec):
        self.app = app
        self.model = model
        self.codec = codec
        self._register_routes()

    def _register_routes(self):
        self.app.route("/", method="GET", callback=self.serve_index)
        self.app.route("/fe.js", method="GET", callback=lambda: self.serve_static("fe.js"))
        self.app.route("/webos_bridge.js", method="GET", callback=lambda: self.serve_static("webos_bridge.js"))
        self.app.route("/styles.css", method="GET", callback=lambda: self.serve_static("styles.css"))
        self.app.route("/static/<filepath:path>", method="GET", callback=self.serve_static)
        self.app.route("/fe_src/<filepath:path>", method="GET", callback=self.serve_fe_src)
        self.app.route("/api/fs", method="GET", callback=self.api_list_fs)
        self.app.route("/api/fs/node", method="GET", callback=self.api_get_node)
        self.app.route("/api/fs/save", method="POST", callback=self.api_save_node)
        self.app.route("/api/fs/delete", method="POST", callback=self.api_delete_node)

    def serve_index(self):
        return static_file("index.html", root=STATIC_DIR)

    def serve_static(self, filepath):
        return static_file(filepath, root=STATIC_DIR)

    def serve_fe_src(self, filepath):
        return static_file(filepath, root=FE_SRC_DIR)

    def api_list_fs(self):
        fmt = request.query.get("format", "json")
        if fmt == "sexpr":
            response.content_type = "text/plain; charset=utf-8"
            return self.model.to_sexpr_listing()
        response.content_type = "application/json; charset=utf-8"
        return {"ok": True, "nodes": self.model.list_nodes(), "sexpr": self.model.to_sexpr_listing()}

    def api_get_node(self):
        path = request.query.get("path", "/")
        node = self.model.get_node(path)
        if not node:
            abort(404, f"Node not found: {path}")
        response.content_type = "application/json; charset=utf-8"
        return {"ok": True, "node": node}

    def api_save_node(self):
        data = request.json or {}
        path = data.get("path")
        kind = data.get("kind", "file")
        content = data.get("content", "()")
        meta = data.get("meta", "()")

        if not path:
            abort(400, "Missing 'path'")
        if kind not in ("file", "dir"):
            abort(400, "Invalid 'kind'; expected 'file' or 'dir'")

        if not isinstance(content, str):
            sexpr_str = self.codec.encode(content)
        else:
            stripped = content.strip()
            if not stripped.startswith("("):
                sexpr_str = self.codec.encode(content)
            else:
                sexpr_str = stripped

        meta_str = meta if isinstance(meta, str) else self.codec.encode(meta)
        saved = self.model.upsert_node(path, kind, sexpr_str, meta_str)
        response.content_type = "application/json; charset=utf-8"
        return {"ok": True, "node": saved, "listing_sexpr": self.model.to_sexpr_listing()}

    def api_delete_node(self):
        data = request.json or {}
        path = data.get("path")
        if not path:
            abort(400, "Missing 'path'")
        deleted = self.model.delete_node(path)
        response.content_type = "application/json; charset=utf-8"
        return {"ok": deleted, "path": path, "listing_sexpr": self.model.to_sexpr_listing()}


class WebOSServerFacade:
    """Facade tying together Bottle 0.12 application, SQLite model, and MVC controller."""

    def __init__(self, host: str = "127.0.0.1", port: int = 8080):
        self.host = host
        self.port = port
        self.app = Bottle()
        self.codec = SExprCodec()
        self.model = SQLiteSingletonModel(DB_PATH)
        self.controller = FileSystemController(self.app, self.model, self.codec)

    def run(self, debug: bool = True):
        try:
            self.app.run(host=self.host, port=self.port, debug=debug, reloader=False)
        finally:
            self.model.close()


if __name__ == "__main__":
    facade = WebOSServerFacade(host="127.0.0.1", port=8080)
    facade.run(debug=True)
