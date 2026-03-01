## 2026-02-19T00:00:00Z Task: init
No decisions recorded yet.

## 2026-02-19T10:55:00Z Task: bootstrap-localization-and-testConnection
- Localized preference pane labels/buttons/subtitles and runtime status strings to Simplified Chinese while preserving pref keys.
- Updated `testConnection` to parse from raw response text first, then JSON decode defensively.
- Added full raw payload logging (`Zotero.debug` + `console.log`) for parse/schema failures.
- Added schema-mismatch alert and status error with first-100-char raw response preview to diagnose non-OpenAI endpoints.

## 2026-02-19T14:08:00Z Task: csp-safe-reader-injection
- Switched reader script loading to frame-scoped injection via `Services.scriptloader.loadSubScript(`${_rootURI}reader-script.js`, win)` where `win` is the reader iframe window.
- Removed startup eager loading into addon scope to avoid CSP-related reader URL loading issues.
- Added per-window idempotency guard `win.fastReadLoaded` and scoped module resolution (`win.FastReadReaderScript || FastReadReaderScript`) before calling `ensureReader`.

## 2026-02-19T18:24:00Z Task: zotero-fastread-singleton-pivot
- Re-architected script boundary: `reader-script.js` now uses an IIFE singleton and attaches API directly to `Zotero.FastRead` with duplicate-load guard.
- Simplified bootstrap call path to direct `Zotero.FastRead` usage (`initSplitView`, `toggleFastReadForWindow`) instead of frame-scoped `FastReadReaderScript` lookup.
- Kept hooks registration independent from script-load success path so UI/menu remains available even when script bootstrap partially fails.
