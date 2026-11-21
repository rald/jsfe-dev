#!/usr/bin/env python3
import http.server
import os
import socketserver

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


class Handler(http.server.CGIHTTPRequestHandler):
    cgi_directories = ["/cgi-bin"]


PORT = int(os.environ.get("PORT", "3000"))
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Serving '{ROOT}' (main storage: '{os.path.join(ROOT, 'root')}') at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
