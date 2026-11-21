#!/usr/bin/env python3
import json
import os
import sys
import time
import urllib.parse

print("Content-Type: application/json; charset=utf-8")
print("Cache-Control: no-store")
print()

method = os.environ.get("REQUEST_METHOD", "GET").upper()
qs = urllib.parse.parse_qs(os.environ.get("QUERY_STRING", ""))
body_len = int(os.environ.get("CONTENT_LENGTH") or "0")
raw_body = sys.stdin.read(body_len) if body_len > 0 else ""

payload = {
    "ok": True,
    "backend": "python-cgi",
    "method": method,
    "timestamp": time.time(),
    "query": qs,
    "received": raw_body,
}
print(json.dumps(payload))
