#!/usr/bin/env python3
import http.server
import json
import os
import urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
ROOT_DATA_DIR = os.path.realpath(os.path.join(ROOT, "root"))
os.makedirs(ROOT_DATA_DIR, exist_ok=True)
os.chdir(ROOT)


def safe_root_path(rel_name: str) -> str:
    cleaned = (rel_name or "").strip().lstrip("/")
    if cleaned.startswith("root/"):
        cleaned = cleaned[5:]
    if not cleaned:
        raise ValueError("missing filename")
    candidate = os.path.realpath(os.path.join(ROOT_DATA_DIR, cleaned))
    if candidate != ROOT_DATA_DIR and not candidate.startswith(ROOT_DATA_DIR + os.sep):
        raise ValueError("path escapes root folder")
    return candidate


class Handler(http.server.SimpleHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/cgi-bin/fs.py":
            qs = urllib.parse.parse_qs(parsed.query)
            action = (qs.get("action", [""])[0] or "").strip()
            try:
                if action == "list":
                    entries = []
                    for fname in sorted(os.listdir(ROOT_DATA_DIR)):
                        full = os.path.join(ROOT_DATA_DIR, fname)
                        if os.path.isfile(full):
                            entries.append({"name": fname, "size": os.path.getsize(full)})
                    self._send_json({"ok": True, "files": entries})
                    return
                if action == "read":
                    name = qs.get("name", [""])[0]
                    target = safe_root_path(name)
                    if not os.path.isfile(target):
                        self._send_json({"ok": False, "error": f"not found in root/: {name}"})
                        return
                    with open(target, "r", encoding="utf-8") as fh:
                        content = fh.read()
                    self._send_json({"ok": True, "name": os.path.basename(target), "content": content})
                    return
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)})
                return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/cgi-bin/fs.py":
            body_len = int(self.headers.get("Content-Length") or "0")
            raw_body = self.rfile.read(body_len).decode("utf-8") if body_len > 0 else "{}"
            try:
                data = json.loads(raw_body or "{}")
                post_action = data.get("action", "write")
                if post_action == "write":
                    name = data.get("name", "")
                    content = data.get("content", "")
                    target = safe_root_path(name)
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with open(target, "w", encoding="utf-8") as fh:
                        fh.write(str(content))
                    self._send_json({"ok": True, "name": os.path.relpath(target, ROOT_DATA_DIR)})
                    return
                if post_action == "delete":
                    name = data.get("name", "")
                    target = safe_root_path(name)
                    if os.path.isfile(target):
                        os.remove(target)
                    self._send_json({"ok": True, "deleted": name})
                    return
                self._send_json({"ok": False, "error": f"unknown action: {post_action}"})
                return
            except Exception as exc:
                self._send_json({"ok": False, "error": str(exc)})
                return
        self.send_error(404)


class ThreadingHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True


PORT = int(os.environ.get("PORT", "3000"))
with ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Serving '{ROOT}' (main storage: '{ROOT_DATA_DIR}') at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
