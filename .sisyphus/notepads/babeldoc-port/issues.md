## 2026-02-19T00:00:00Z Task: init
No issues recorded yet.

## 2026-02-19T10:54:00Z Task: reader-sidebar-toggle
- Added a dedicated fastRead toggle button injection path with selector priority: `#sidebar-stack` -> `.sidebar-toolbar` -> panel header fallback.
- Implemented ON/OFF mode transitions that disable split view by restoring the original viewer container and re-enable split view with pipeline resume.
- Added active-state UI and Chinese tooltip `开启/关闭 fastRead 对照模式` for discoverability.

## 2026-02-19T13:26:00Z Task: silent-fail-trigger-debug
- Silent-fail likely occurred when menu trigger opened reader but iframe script wasn’t ready; command returned without visible feedback.
- Hardened strategy: menu action now uses `open -> getByTabID -> 20x(100ms) wait loop` and only toggles after `reader._iframeWindow.toggleFastRead` exists.
- Timeout now logs `[fastRead] Error: Reader script not ready after 2s.` and alerts user to retry.

## BabelDoc Port: silent-fail trigger in bootstrap.js (analysis)
- Issue: openResult -> reader not toggling fastRead; waitForReaderToggle sometimes returns null; silent path sets zdr-fastread-enable and aborts.
- Affected file: /root/fastRead/bootstrap.js (lines around 605, 631-639, 680-689)
- Related wiring: /root/fastRead/reader-script.js defines window.toggleFastRead on the reader iframe; ensure readyWindow points to that object.
### Entry: CSP/bootstrap (auto)
- Basic findings captured.

## 2026-02-19T15:02:00Z Task: trigger-timeout-hardening
- Extended `waitForReader` polling from 20 to 40 attempts (from ~2s to ~4s) to reduce false timeout on slow reader initialization.
- Added toggle resolution helper that accepts both `readerWindow.toggleFastRead` and `readerWindow.wrappedJSObject.toggleFastRead`.
- Added periodic debug telemetry in the wait loop (`window/doc/scoped/toggle`) to make future failures diagnosable.

## 2026-02-19T15:36:00Z Task: reader-candidate-fallback
- Added robust reader candidate collection in `bootstrap.js` that no longer depends only on `tab.id/tab.tabID -> getByTabID`.
- New fallback scans `Zotero.Reader._readers` with itemID preference, then all readers, and attempts toggle on first candidate exposing a valid toggle function.
- Timeout warning now uses `showTriggerWarning` wrapper to reduce alert-path side effects while keeping user feedback unchanged.

## 2026-02-20T00:00:00Z Task: multi-engine-prefs-bootstrap
- Added new prefs `extensions.fastread.engine`, `extensions.fastread.tmt.secretId`, `extensions.fastread.tmt.secretKey` with defaults.
- Added engine selector (`zdr-engine-select`) and Tencent credential card (`zdr-tmt-card`) with SecretId/SecretKey fields.
- Added preference-window visibility logic to toggle Tencent card vs OpenAI primary/fallback cards based on selected engine.

## 2026-02-20T00:00:00Z Task: reader-tmt-dispatch
- Added reader pref keys for engine/TMT credentials and switched `translateBlocks` to engine-based dispatch.
- Implemented Web Crypto helpers (`hashSha256`, `hmacSha256`) and TC3 signature flow for Tencent `TextTranslateBatch` requests.
- TMT branch now maps `TargetTextList` back to `{ id, translation }` preserving original block ordering.

## 2026-02-20T00:00:00Z Task: ux-visible-split-and-tmt-test
- Added TMT test connection button/status in preferences and wired `kind: "tmt"` click flow.
- Implemented bootstrap-side minimal TMT signed test request (`Hello` -> `zh`) with immediate `Services.prompt.alert` success/error feedback.
- Overhauled reader panel to show an obvious side-by-side layout, explicit start button, and status updates for extraction/translation/render stages.
