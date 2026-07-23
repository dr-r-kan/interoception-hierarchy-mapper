#!/usr/bin/env python3
"""Serve the pre-built app locally; no participant data are received or stored."""

from __future__ import annotations

import argparse
import functools
import socket
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def local_ipv4_addresses() -> list[str]:
    addresses: set[str] = set()
    try:
        hostname = socket.gethostname()
        for address in socket.gethostbyname_ex(hostname)[2]:
            if address and not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass

    # This UDP socket does not transmit data; it asks the OS which interface it would use.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 80))
            address = probe.getsockname()[0]
            if address and not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass
    return sorted(addresses)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the Interoceptive Hierarchy Mapper.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=8000, help="TCP port (default: 8000).")
    parser.add_argument(
        "--lan",
        action="store_true",
        help="Bind to all network interfaces so devices on the same network can open the app.",
    )
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser automatically.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(__file__).resolve().parent
    dist = root / "dist"
    if not (dist / "index.html").is_file():
        print("The pre-built dist/index.html file is missing. Run 'npm install' then 'npm run build'.", file=sys.stderr)
        return 1

    host = "0.0.0.0" if args.lan else args.host
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(dist))
    try:
        server = ThreadingHTTPServer((host, args.port), handler)
    except OSError as error:
        print(f"Could not start the server on {host}:{args.port}: {error}", file=sys.stderr)
        return 1

    local_url = f"http://127.0.0.1:{args.port}/"
    print("\nInteroceptive Hierarchy Mapper")
    print(f"Local browser: {local_url}")
    if args.lan:
        addresses = local_ipv4_addresses()
        if addresses:
            print("Other devices on the same network can try:")
            for address in addresses:
                print(f"  http://{address}:{args.port}/")
        else:
            print("LAN mode is active, but no non-loopback IPv4 address was detected.")
    print("Press Ctrl+C to stop.\n")

    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(local_url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
