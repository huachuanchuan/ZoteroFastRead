## 2026-02-19T00:00:00Z Task: init
Initialized notepad for BabelDOC port effort.

## 2026-02-19T09:58:00Z Task: reader-script-babeldoc-port
- Prioritized visible pages first during `.textLayer span` extraction and retained fallback extraction for non-visible pages.
- Switched block IDs to deterministic `pdf-block-p####-b####` format while preserving BBox pixel + ratio mapping.
- Added explicit `data-block-id` on translated blocks and made hover mapping resolve ID from dataset before drawing overlay.
