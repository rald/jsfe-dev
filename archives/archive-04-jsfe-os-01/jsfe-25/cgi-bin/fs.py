#!/usr/bin/env python3
import json
import os
import sys
import urllib.parse

print("Content-Type: application/json; charset=utf-8")
print("Cache-Control: no-store")
print()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DATA_DIR = os.path.realpath(os.path.join(BASE_DIR, "root"))
os.makedirs(ROOT_DATA_DIR, exist_ok=True)


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


method = os.environ.get("REQUEST_METHOD", "GET").upper()
qs = urllib.parse.parse_qs(os.environ.get("QUERY_STRING", ""))
action = (qs.get("action", [""])[0] or "").strip()

raw_body = ""
if method == "POST":
    body_len = int(os.environ.get("CONTENT_LENGTH") or "0")
    if body_len > 0:
        raw_body = sys.stdin.read(body_len)

try:
    if method == "GET" and action == "list":
        entries = []
        for fname in sorted(os.listdir(ROOT_DATA_DIR)):
            full = os.path.join(ROOT_DATA_DIR, fname)
            if os.path.isfile(full):
                entries.append({"name": fname, "size": os.path.getsize(full)})
        print(json.dumps({"ok": True, "files": entries}))

    elif method == "GET" and action == "read":
        name = qs.get("name", [""])[0]
        target = safe_root_path(name)
        if not os.path.isfile(target):
            print(json.dumps({"ok": False, "error": f"not found in root/: {name}"}))
        else:
            with open(target, "r", encoding="utf-8") as fh:
                content = fh.read()
            print(json.dumps({"ok": True, "name": os.path.basename(target), "content": content}))

    elif method == "POST":
        data = json.loads(raw_body or "{}")
        post_action = data.get("action", "write")
        if post_action == "write":
            name = data.get("name", "")
            content = data.get("content", "")
            target = safe_root_path(name)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "w", encoding="utf-8") as fh:
                fh.write(str(content))
            print(json.dumps({"ok": True, "name": os.path.relpath(target, ROOT_DATA_DIR)}))
        elif post_action == "delete":
            name = data.get("name", "")
            target = safe_root_path(name)
            if os.path.isfile(target):
                os.remove(target)
            print(json.dumps({"ok": True, "deleted": name}))
        else:
            print(json.dumps({"ok": False, "error": f"unknown action: {post_action}"}))
    else:
        print(json.dumps({"ok": False, "error": "unsupported request"}))
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
