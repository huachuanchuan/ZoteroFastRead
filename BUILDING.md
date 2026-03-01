# fastRead Packaging Guide

## Target Artifacts

- `Zotero-DeepRead.xpi`: base plugin package (no bundled native backend)
- `fastRead-Python.xpi`: plugin package with bundled native backend binaries

## Build Bundled Package

Run:

```bash
node build-python.js
```

Behavior:

1. Includes core plugin files (`manifest.json`, `bootstrap.js`, `reader-script.js`, `server.py`, `bg.svg`)
2. Scans `bin/` for prebuilt backend binaries:
   - `bin/fastread-server.exe` (Windows)
   - `bin/fastread-server-macos` (macOS)
3. If current OS is Windows or macOS and its binary is missing, builds it locally with PyInstaller and adds it
4. Produces `fastRead-Python.xpi`

Linux artifacts are intentionally excluded from universal validation and packaging.

By default, the universal target is Windows + macOS.
Missing Windows/macOS binaries are warnings unless strict mode is enabled.

To enforce a strict universal release package, require both Windows/macOS binaries:

```bash
FASTREAD_STRICT_UNIVERSAL=1 node build-python.js
```

## Building Native Backends

Each backend binary must be built on its target OS, then copied into `bin/` using the names above.

- Windows: run `build_server.bat` to produce `bin/fastread-server.exe`
- macOS: run `bash build_server_macos.sh` to produce `bin/fastread-server-macos`

Windows build is configured to use PyInstaller `--noconsole` in `build-python.js`, so launching from Zotero avoids command prompt windows.
