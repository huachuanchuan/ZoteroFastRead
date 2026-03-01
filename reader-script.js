(function() {
  if (Zotero.FastRead) {
    Zotero.debug("[fastRead] Zotero.FastRead already exists, skipping reload.");
    return;
  }

  const PREF_KEYS = Object.freeze({
    translatedPdfURL: "extensions.fastread.viewer.translatedPdfURL",
    translatedPdfTemplate: "extensions.fastread.viewer.translatedPdfTemplate",
    autoLoadTranslatedPdf: "extensions.fastread.viewer.autoLoadTranslatedPdf",
    syncEnabled: "extensions.fastread.viewer.syncEnabled",
    syncMode: "extensions.fastread.viewer.syncMode",
    remoteBaseURL: "extensions.fastread.remote.baseURL",
    remoteAuthToken: "extensions.fastread.remote.authToken",
    remoteApiKey: "extensions.fastread.remote.apiKey",
    remoteAutoTranslateOnOpen: "extensions.fastread.remote.autoTranslateOnOpen",
    remoteSourceLang: "extensions.fastread.remote.sourceLang",
    remoteTargetLang: "extensions.fastread.remote.targetLang",
    remoteEngine: "extensions.fastread.remote.engine",
    remotePriority: "extensions.fastread.remote.priority",
    remoteProviderConfigId: "extensions.fastread.remote.providerConfigId",
    remoteModelConfig: "extensions.fastread.remote.modelConfig",
    remotePollIntervalMs: "extensions.fastread.remote.pollIntervalMs",
    remotePollTimeoutSec: "extensions.fastread.remote.pollTimeoutSec"
  });

  const STYLE_ID = "zdr-reader-style";
  const INNER_VIEWER_STYLE_ID = "zdr-inner-viewer-style";
  const SPLIT_ROOT_ID = "zdr-split-root";
  const PANEL_ID = "zdr-translation-panel";
  const STATUS_ID = "zdr-status-area";
  const BODY_ID = "zdr-panel-body";
  const TRANSLATED_URL_INPUT_ID = "zdr-translated-url-input";
  const TRANSLATED_LOAD_BUTTON_ID = "zdr-load-translated-btn";
  const TRANSLATED_SYNC_BADGE_ID = "zdr-sync-badge";
  const TRANSLATED_FRAME_ID = "zdr-translated-pdf-frame";
  const TRANSLATED_PLACEHOLDER_ID = "zdr-translated-placeholder";
  const INTERNAL_READER_FRAME_URL = "resource://zotero/reader/reader.html";
  const LOCAL_REMOTE_BASE_URL_CANDIDATES = Object.freeze([
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:18000",
    "http://localhost:18000",
    "http://127.0.0.1:28000",
    "http://localhost:28000",
    "http://127.0.0.1:38000",
    "http://localhost:38000"
  ]);

  const _sessionsByReader = new WeakMap();
  const _sessions = new Set();

  function ensureReader(reader, doc) {
    if (!reader || !doc) {
      return;
    }

    const existingSession = _sessionsByReader.get(reader);
    if (existingSession && existingSession.doc !== doc) {
      teardownSession(existingSession);
    }
    else if (existingSession && !existingSession.destroyed) {
      bindWindowToggle(existingSession);
      return;
    }

    const session = {
      reader,
      doc,
      splitRoot: null,
      leftPane: null,
      panel: null,
      statusNode: null,
      bodyNode: null,
      translatedOnce: false,
      fastReadEnabled: false,
      destroyed: false,
      windowToggleHandler: null,
      translatedURL: "",
      translatedBlobURL: "",
      translatedAttachmentItem: null,
      translatedAttachmentPath: "",
      translatedInternalReader: null,
      translatedReaderWindow: null,
      translatedURLInput: null,
      translatedLoadButton: null,
      translatedFrame: null,
      translatedPlaceholder: null,
      translatedViewerContainer: null,
      translatedScrollRoot: null,
      leftScrollRoot: null,
      leftPDFDoc: null,
      scrollSyncSource: "",
      scrollSyncReleaseTimer: 0,
      leftScrollRAF: 0,
      rightScrollRAF: 0,
      suppressSyncUntil: 0,
      scaleSyncSource: "",
      scaleSyncReleaseTimer: 0,
      suppressScaleSyncUntil: 0,
      leftScrollListener: null,
      rightScrollListener: null,
      _leftZoomListener: null,
      _rightZoomListener: null,
      _leftEventBus: null,
      _rightEventBus: null,
      remoteTaskID: null,
      remoteTaskPolling: false,
      sidebarWorkflowStarted: false,
      translatedLoadRetryCount: 0,
      translatedLoadToken: 0
    };

    _sessions.add(session);
    _sessionsByReader.set(reader, session);
    bindWindowToggle(session);
  }

  function initSplitViewForReader(reader, doc) {
    if (!reader || !doc) {
      return false;
    }

    ensureReader(reader, doc);
    const session = _sessionsByReader.get(reader);
    if (!session || session.destroyed) {
      return false;
    }

    toggleFastReadMode(session, true).catch((error) => {
      Zotero.logError(error);
    });
    return true;
  }

  function teardownAll() {
    for (const session of Array.from(_sessions)) {
      teardownSession(session);
    }
  }

  function teardownSession(session) {
    if (!session || session.destroyed) {
      return;
    }
    session.destroyed = true;
    session.translatedLoadToken = Number(session.translatedLoadToken || 0) + 1;

    clearHighlight(session);
    detachSync(session);
    revokeTranslatedBlobURL(session);
    try {
      session.translatedInternalReader?.destroy?.();
    }
    catch (_error) {
    }
    session.translatedInternalReader = null;
    session.translatedReaderWindow = null;
    session.translatedAttachmentItem = null;
    session.translatedAttachmentPath = "";

    if (session.splitRoot && session.leftPane && session.splitRoot.parentElement) {
      const parent = session.splitRoot.parentElement;
      parent.insertBefore(session.leftPane, session.splitRoot);
      session.leftPane.classList.remove("zdr-left-pane");
      session.splitRoot.remove();
    }

    const style = session.doc?.getElementById(STYLE_ID);
    if (style) {
      style.remove();
    }

    const readerWindow = session.doc?.defaultView;
    if (readerWindow && session.windowToggleHandler && readerWindow.toggleFastRead === session.windowToggleHandler) {
      delete readerWindow.toggleFastRead;
    }
    if (readerWindow?.wrappedJSObject && readerWindow.wrappedJSObject.toggleFastRead === session.windowToggleHandler) {
      delete readerWindow.wrappedJSObject.toggleFastRead;
    }

    _sessions.delete(session);
    _sessionsByReader.delete(session.reader);
  }

  function ensureSplitLayout(doc) {
    injectStyles(doc);

    let splitRoot = doc.getElementById(SPLIT_ROOT_ID);
    let panel = doc.getElementById(PANEL_ID);

    if (splitRoot && panel && splitRoot.firstElementChild) {
      return {
        splitRoot,
        leftPane: splitRoot.firstElementChild,
        panel,
        pdfDoc: resolvePDFDocFromLeftPane(splitRoot.firstElementChild, doc)
      };
    }

    const viewerContext = resolveViewerMount(doc);
    const mountElement = viewerContext?.mountElement || null;
    if (!mountElement || !mountElement.parentElement) {
      return null;
    }

    splitRoot = doc.createElement("div");
    splitRoot.id = SPLIT_ROOT_ID;

    panel = createPanel(doc);

    mountElement.parentElement.insertBefore(splitRoot, mountElement);
    splitRoot.appendChild(mountElement);
    splitRoot.appendChild(panel);

    mountElement.classList.add("zdr-left-pane");

    return {
      splitRoot,
      leftPane: mountElement,
      panel,
      pdfDoc: viewerContext.pdfDoc || doc
    };
  }

  function getActiveReaderHostDoc(session) {
    const activeDoc = session?.reader?._iframeWindow?.document || null;
    return activeDoc || session?.doc || null;
  }

  async function ensureSplitLayoutWithRetry(session, maxAttempts = 100) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const activeDoc = getActiveReaderHostDoc(session);
      if (activeDoc && session.doc !== activeDoc) {
        session.doc = activeDoc;
      }
      const layout = activeDoc ? ensureSplitLayout(activeDoc) : null;
      if (layout) {
        return layout;
      }
      await delay(120);
    }
    return null;
  }

  function findDirectViewerContainer(doc) {
    if (!doc) {
      return null;
    }

    const direct = doc.getElementById("viewerContainer")
      || doc.querySelector(".pdfViewerContainer")
      || doc.querySelector(".viewerContainer");
    if (direct) {
      return direct;
    }

    const page = doc.querySelector(".page[data-page-number], .page");
    if (!page) {
      return null;
    }

    return page.closest("#viewerContainer, .pdfViewerContainer, .viewerContainer") || page.parentElement;
  }

  function findViewerContainer(doc) {
    return findDirectViewerContainer(doc);
  }

  function findEmbeddedViewerFrame(doc) {
    if (!doc) {
      return null;
    }

    const candidates = Array.from(doc.querySelectorAll("iframe, browser"));
    for (const frame of candidates) {
      try {
        const frameDoc = frame.contentDocument;
        if (!frameDoc) {
          continue;
        }
        if (findDirectViewerContainer(frameDoc)) {
          return frame;
        }
      }
      catch (_error) {
      }
    }

    return null;
  }

  function resolvePDFDocFromLeftPane(leftPane, hostDoc) {
    const tag = String(leftPane?.tagName || "").toLowerCase();
    if (tag === "iframe" || tag === "browser") {
      try {
        return leftPane.contentDocument || hostDoc;
      }
      catch (_error) {
        return hostDoc;
      }
    }
    return hostDoc;
  }

  function resolveViewerMount(doc) {
    const direct = findDirectViewerContainer(doc);
    if (direct) {
      return {
        mountElement: direct,
        pdfDoc: doc
      };
    }

    const frame = findEmbeddedViewerFrame(doc);
    if (frame) {
      return {
        mountElement: frame,
        pdfDoc: resolvePDFDocFromLeftPane(frame, doc)
      };
    }

    return null;
  }

  function createPanel(doc) {
    const panel = doc.createElement("div");
    panel.id = PANEL_ID;
    panel.setAttribute(
      "style",
      "width: 50%; height: 100%; float: right; background: #fff; box-sizing: border-box;"
    );
    panel.innerHTML = `
      <div class="zdr-panel-header" style="display:none;">
        <button id="${TRANSLATED_LOAD_BUTTON_ID}" type="button"></button>
      </div>
      <div class="zdr-panel-toolbar" style="display:none;">
        <input id="${TRANSLATED_URL_INPUT_ID}" type="url" />
        <span id="${TRANSLATED_SYNC_BADGE_ID}"></span>
      </div>
      <div id="${STATUS_ID}" style="display:none;"></div>
      <div id="${BODY_ID}" class="zdr-panel-body">
        <div id="${TRANSLATED_PLACEHOLDER_ID}" class="zdr-translated-placeholder">
          <div class="zdr-wait-card">
            <div class="zdr-wait-spinner" aria-hidden="true"></div>
            <h3 class="zdr-wait-title">等待译文加载</h3>
            <p class="zdr-wait-subtitle">正在连接本地翻译服务，完成后会自动显示译文 PDF。</p>
            <div class="zdr-wait-pulse" aria-hidden="true"></div>
          </div>
        </div>
        <iframe id="${TRANSLATED_FRAME_ID}" class="zdr-translated-frame" title="Translated PDF" loading="eager"></iframe>
      </div>
    `;
    return panel;
  }

  function createSidebarPanel(doc) {
    const panel = doc.createElement("div");
    panel.id = PANEL_ID;
    panel.setAttribute("style", "width: 100%; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background: #fff;");
    panel.innerHTML = `
      <div class="zdr-panel-header" style="display:none;">
        <button id="${TRANSLATED_LOAD_BUTTON_ID}" type="button"></button>
      </div>
      <div class="zdr-panel-toolbar" style="display:none;">
        <input id="${TRANSLATED_URL_INPUT_ID}" type="url" />
        <span id="${TRANSLATED_SYNC_BADGE_ID}"></span>
      </div>
      <div id="${STATUS_ID}" style="display:none;"></div>
      <div id="${BODY_ID}" class="zdr-panel-body">
        <div id="${TRANSLATED_PLACEHOLDER_ID}" class="zdr-translated-placeholder">
          <div class="zdr-wait-card">
            <div class="zdr-wait-spinner" aria-hidden="true"></div>
            <h3 class="zdr-wait-title">等待译文加载</h3>
            <p class="zdr-wait-subtitle">正在连接本地翻译服务，完成后会自动显示译文 PDF。</p>
            <div class="zdr-wait-pulse" aria-hidden="true"></div>
          </div>
        </div>
        <iframe id="${TRANSLATED_FRAME_ID}" class="zdr-translated-frame" title="Translated PDF" loading="eager"></iframe>
      </div>
    `;
    return panel;
  }

  async function mountSidebarPanel(reader, doc, sidebarPanel, options = {}) {
    if (!reader || !doc || !sidebarPanel) {
      return false;
    }

    ensureReader(reader, doc);
    const session = _sessionsByReader.get(reader);
    if (!session || session.destroyed) {
      return false;
    }

    const existing = sidebarPanel.querySelector(`#${PANEL_ID}`);
    const mountedPanel = existing || createSidebarPanel(doc);
    if (!existing) {
      sidebarPanel.replaceChildren(mountedPanel);
    }

    if (sidebarPanel?.style) {
      sidebarPanel.style.width = "100%";
      sidebarPanel.style.height = "100%";
      sidebarPanel.style.overflow = "hidden";
      sidebarPanel.style.display = "block";
    }

    session.doc = doc;
    session.panel = sidebarPanel;
    session.leftPane = findViewerContainer(doc) || doc.scrollingElement || doc.documentElement || doc.body || null;
    session.leftPDFDoc = doc;
    session.statusNode = sidebarPanel.querySelector(`#${STATUS_ID}`);
    session.bodyNode = sidebarPanel.querySelector(`#${BODY_ID}`);
    session.fastReadEnabled = true;

    wirePanel(session);

    const autoTrigger = !!options?.autoTrigger;
    if (autoTrigger && !session.sidebarWorkflowStarted) {
      session.sidebarWorkflowStarted = true;
      try {
        await autoLoadTranslatedPDFIfNeeded(session);
      }
      catch (error) {
        setStatus(session, `自动加载失败: ${getSafeErrorText(error)}`, "error");
        Zotero.logError(error);
      }
    }

    return true;
  }

  function injectStyles(doc) {
    if (doc.getElementById(STYLE_ID)) {
      return;
    }

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${SPLIT_ROOT_ID} {
        display: flex;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        background: color-mix(in srgb, var(--material-background) 92%, #f4f7fb 8%);
      }

      #${SPLIT_ROOT_ID} > .zdr-left-pane {
        flex: 0 0 50%;
        max-width: 50%;
        min-width: 0;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      #${SPLIT_ROOT_ID} > .zdr-left-pane iframe,
      #${PANEL_ID} iframe {
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        outline: none !important;
        box-shadow: none !important;
      }

      #${SPLIT_ROOT_ID} .splitter,
      #${SPLIT_ROOT_ID} splitter,
      #${SPLIT_ROOT_ID} [class*="splitter"],
      #${SPLIT_ROOT_ID} [class*="divider"],
      #${SPLIT_ROOT_ID} [class*="resizer"] {
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        background: transparent !important;
      }

      #${SPLIT_ROOT_ID} > .zdr-left-pane #viewerContainer,
      #${SPLIT_ROOT_ID} > .zdr-left-pane .pdfViewer,
      #${SPLIT_ROOT_ID} > .zdr-left-pane .pdfViewer .page,
      #${PANEL_ID} #viewerContainer,
      #${PANEL_ID} .pdfViewer,
      #${PANEL_ID} .pdfViewer .page {
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        inset: 0 !important;
        top: 0 !important;
      }

      #${PANEL_ID} {
        flex: 0 0 50%;
        max-width: 50%;
        min-width: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        background: #fff;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        overflow: hidden;
      }

      #${PANEL_ID} > .zdr-panel-header,
      #${PANEL_ID} > .zdr-panel-toolbar,
      #${PANEL_ID} > #${STATUS_ID} {
        display: none !important;
      }

      #${PANEL_ID} .zdr-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 14px 14px 10px;
        border-bottom: 1px solid color-mix(in srgb, var(--material-foreground) 10%, transparent);
      }

      #${PANEL_ID} .zdr-panel-title {
        margin: 0;
        font-size: 16px;
        line-height: 1.3;
        font-weight: 700;
      }

      #${PANEL_ID} .zdr-panel-subtitle {
        margin: 3px 0 0;
        font-size: 12px;
        color: color-mix(in srgb, var(--material-foreground) 60%, transparent);
      }

      #${PANEL_ID} .zdr-panel-button {
        border: 1px solid color-mix(in srgb, #2f6df6 40%, transparent);
        background: color-mix(in srgb, #2f6df6 12%, var(--material-background));
        border-radius: 999px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 12px;
      }

      #${PANEL_ID} .zdr-panel-button[disabled] {
        opacity: 0.7;
        cursor: wait;
      }

      #${PANEL_ID} .zdr-panel-toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px 14px;
        border-bottom: 1px solid color-mix(in srgb, var(--material-foreground) 8%, transparent);
      }

      #${PANEL_ID} .zdr-panel-url {
        flex: 1;
        min-width: 0;
        border: 1px solid color-mix(in srgb, var(--material-foreground) 12%, transparent);
        border-radius: 8px;
        padding: 6px 8px;
        font-size: 12px;
        background: color-mix(in srgb, var(--material-background) 92%, #ffffff 8%);
      }

      #${PANEL_ID} .zdr-sync-badge {
        flex: none;
        font-size: 11px;
        border-radius: 999px;
        padding: 4px 8px;
        border: 1px solid color-mix(in srgb, var(--material-foreground) 12%, transparent);
        color: color-mix(in srgb, var(--material-foreground) 70%, transparent);
      }

      #${PANEL_ID} .zdr-panel-status {
        margin: 0;
        min-height: 18px;
        font-size: 12px;
        padding: 8px 14px;
        color: color-mix(in srgb, var(--material-foreground) 70%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--material-foreground) 8%, transparent);
      }

      #${PANEL_ID} .zdr-panel-status.is-error {
        color: #b61c3a;
      }

      #${PANEL_ID} .zdr-panel-status.is-success {
        color: #1d8f5d;
      }

      #${BODY_ID} {
        flex: 1 !important;
        min-height: 0 !important;
        height: 100% !important;
        overflow: hidden;
        padding: 0 !important;
        position: relative;
      }

      #${BODY_ID} .zdr-translated-placeholder {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: color-mix(in srgb, var(--material-foreground) 65%, transparent);
        padding: 22px;
        font-size: 12px;
        line-height: 1.6;
        background: color-mix(in srgb, var(--material-background) 96%, #f4f6fb 4%);
      }

      #${BODY_ID} .zdr-wait-card {
        width: min(94%, 420px);
        border-radius: 16px;
        border: 1px solid color-mix(in srgb, var(--material-foreground) 10%, transparent);
        background: linear-gradient(
          160deg,
          color-mix(in srgb, var(--material-background) 92%, #ffffff 8%),
          color-mix(in srgb, var(--material-background) 84%, #eef3ff 16%)
        );
        box-shadow:
          0 10px 28px color-mix(in srgb, #173b8f 10%, transparent),
          inset 0 1px 0 color-mix(in srgb, #ffffff 70%, transparent);
        padding: 18px 16px;
        display: grid;
        gap: 10px;
        text-align: left;
      }

      #${BODY_ID} .zdr-wait-spinner {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid color-mix(in srgb, #2f6df6 28%, transparent);
        border-top-color: color-mix(in srgb, #2f6df6 88%, #a8c1ff 12%);
        animation: zdr-wait-spin 0.9s linear infinite;
      }

      #${BODY_ID} .zdr-wait-title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: color-mix(in srgb, var(--material-foreground) 86%, transparent);
      }

      #${BODY_ID} .zdr-wait-subtitle {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: color-mix(in srgb, var(--material-foreground) 62%, transparent);
      }

      #${BODY_ID} .zdr-wait-pulse {
        height: 5px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--material-foreground) 10%, transparent);
        overflow: hidden;
        position: relative;
      }

      #${BODY_ID} .zdr-wait-pulse::before {
        content: "";
        position: absolute;
        inset: 0;
        width: 42%;
        border-radius: inherit;
        background: linear-gradient(90deg, #2f6df6, #8fb0ff);
        animation: zdr-loading-progress 1.15s ease-in-out infinite;
      }

      #${BODY_ID} .zdr-translated-placeholder[data-zdr-state="error"] .zdr-wait-card {
        border-color: color-mix(in srgb, #d44a61 45%, transparent);
        background: linear-gradient(
          160deg,
          color-mix(in srgb, var(--material-background) 90%, #fff3f5 10%),
          color-mix(in srgb, var(--material-background) 84%, #ffe9ee 16%)
        );
      }

      #${BODY_ID} .zdr-translated-placeholder[data-zdr-state="error"] .zdr-wait-spinner {
        border-color: color-mix(in srgb, #d44a61 26%, transparent);
        border-top-color: #d44a61;
        animation-duration: 1.2s;
      }

      #${BODY_ID} .zdr-translated-placeholder[data-zdr-state="error"] .zdr-wait-title {
        color: color-mix(in srgb, #a02d44 84%, transparent);
      }

      #${BODY_ID} .zdr-translated-placeholder[data-zdr-state="error"] .zdr-wait-subtitle {
        color: color-mix(in srgb, #8b2438 72%, transparent);
      }

      #${BODY_ID} .zdr-translated-placeholder[data-zdr-state="error"] .zdr-wait-pulse::before {
        background: linear-gradient(90deg, #d44a61, #f08a9c);
      }

      #${BODY_ID} .zdr-translated-frame {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }

      #${BODY_ID} .zdr-translated-frame.is-ready {
        visibility: visible;
      }

      #${BODY_ID} .zdr-translation-block {
        border: 1px solid color-mix(in srgb, var(--material-foreground) 12%, transparent);
        border-radius: 12px;
        background: color-mix(in srgb, var(--material-background) 90%, #f8fbff 10%);
        padding: 10px 11px;
        cursor: pointer;
      }

      #${BODY_ID} .zdr-translation-block:hover {
        border-color: color-mix(in srgb, #2f6df6 45%, transparent);
        box-shadow: 0 0 0 1px color-mix(in srgb, #2f6df6 24%, transparent);
      }

      #${BODY_ID} .zdr-translation-id {
        margin: 0;
        font-size: 11px;
        color: color-mix(in srgb, var(--material-foreground) 55%, transparent);
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      #${BODY_ID} .zdr-translation-text {
        margin: 5px 0 0;
        font-size: 13px;
        line-height: 1.55;
        white-space: pre-wrap;
      }

      #${BODY_ID} .zdr-note {
        margin: 0;
        font-size: 12px;
        color: color-mix(in srgb, var(--material-foreground) 65%, transparent);
      }

      #${BODY_ID} .zdr-progress-wrap {
        border: 1px solid color-mix(in srgb, var(--material-foreground) 12%, transparent);
        border-radius: 12px;
        background: color-mix(in srgb, var(--material-background) 90%, #f8fbff 10%);
        padding: 12px;
        display: grid;
        gap: 8px;
      }

      #${BODY_ID} .zdr-progress-text {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
      }

      #${BODY_ID} .zdr-progress-track {
        height: 6px;
        border-radius: 999px;
        overflow: hidden;
        background: color-mix(in srgb, var(--material-foreground) 14%, transparent);
      }

      #${BODY_ID} .zdr-progress-bar {
        width: 42%;
        height: 100%;
        border-radius: 999px;
        background: color-mix(in srgb, #2f6df6 76%, #8fb0ff 24%);
        animation: zdr-loading-progress 1.1s ease-in-out infinite;
      }

      @keyframes zdr-loading-progress {
        0% {
          transform: translateX(-105%);
        }
        50% {
          transform: translateX(60%);
        }
        100% {
          transform: translateX(215%);
        }
      }

      @keyframes zdr-wait-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .zdr-bbox-highlight {
        position: absolute;
        pointer-events: none;
        background: rgba(255, 223, 0, 0.4);
        border: 1px solid rgba(255, 196, 0, 0.75);
        border-radius: 2px;
        box-sizing: border-box;
        z-index: 6;
      }

    `;

    doc.head.appendChild(style);
  }

  function injectViewerChromeStyle(doc) {
    let head = null;
    try {
      head = doc?.head || null;
    }
    catch (_error) {
      return;
    }
    if (!head) {
      return;
    }

    let style = null;
    try {
      style = doc.getElementById(INNER_VIEWER_STYLE_ID);
    }
    catch (_error) {
      return;
    }

    if (!style) {
      try {
        style = doc.createElement("style");
        style.id = INNER_VIEWER_STYLE_ID;
        head.appendChild(style);
      }
      catch (_error) {
        return;
      }
    }

    try {
      style.textContent = `
      html, body,
      #outerContainer, #mainContainer,
      #viewerContainer, #viewer, .pdfViewer {
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        outline: none !important;
        box-shadow: none !important;
      }

      #toolbarContainer {
        display: none !important;
      }

      #viewerContainer {
        top: 0 !important;
        left: 0 !important;
        inset: 0 !important;
        padding-top: 0 !important;
        margin-top: 0 !important;
        height: 100% !important;
      }

      .pdfViewer .page,
      .pdfViewer .spread {
        border: 0 !important;
        box-shadow: none !important;
      }

      .pdfViewer .page + .page {
        margin-top: 0 !important;
      }

      .pdfViewer .page::before,
      .pdfViewer .page::after {
        content: none !important;
      }

      .splitToolbarButtonSeparator,
      .horizontalToolbarSeparator,
      .verticalToolbarSeparator,
      .splitter,
      [class*="splitter"],
      [class*="divider"],
      [class*="resizer"] {
        border: 0 !important;
        box-shadow: none !important;
        background: transparent !important;
      }
    `;
    }
    catch (_error) {
    }
  }

  function wirePanel(session) {
    if (!session.panel) {
      return;
    }

    const loadButton = session.panel.querySelector(`#${TRANSLATED_LOAD_BUTTON_ID}`);
    const urlInput = session.panel.querySelector(`#${TRANSLATED_URL_INPUT_ID}`);
    const frame = session.panel.querySelector(`#${TRANSLATED_FRAME_ID}`);
    const placeholder = session.panel.querySelector(`#${TRANSLATED_PLACEHOLDER_ID}`);

    session.translatedLoadButton = loadButton;
    session.translatedURLInput = urlInput;
    session.translatedFrame = frame;
    session.translatedPlaceholder = placeholder;
    setPlaceholderState(session, "loading");

    if (session.translatedLoadButton && !session.translatedLoadButton.dataset.zdrBound) {
      session.translatedLoadButton.dataset.zdrBound = "1";
      session.translatedLoadButton.addEventListener("click", async () => {
        const raw = String(session.translatedURLInput?.value || "").trim();
        if (raw) {
          writePref(PREF_KEYS.translatedPdfURL, raw);
        }

        if (session.translatedLoadButton) {
          session.translatedLoadButton.disabled = true;
        }

        try {
          if (raw) {
            await loadTranslatedPDF(session, raw);
          }
          else {
            await requestTranslatedPDFViaAPI(session);
          }
        }
        catch (error) {
          setStatus(session, `加载失败: ${getSafeErrorText(error)}`, "error");
          Zotero.logError(error);
        }
        finally {
          if (session.translatedLoadButton) {
            session.translatedLoadButton.disabled = false;
          }
        }
      });
    }

    if (session.translatedURLInput && !session.translatedURLInput.dataset.zdrBound) {
      session.translatedURLInput.dataset.zdrBound = "1";
      session.translatedURLInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          session.translatedLoadButton?.click();
        }
      });
    }
  }

  function updateSyncBadge(session, text) {
    const badge = session.panel?.querySelector?.(`#${TRANSLATED_SYNC_BADGE_ID}`);
    if (badge) {
      badge.textContent = text;
    }
  }

  function isTruePref(prefKey, fallback = false) {
    const value = readPref(prefKey);
    if (!value) {
      return fallback;
    }
    return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
  }

  function writePref(prefKey, value) {
    Zotero.Prefs.set(prefKey, String(value || ""), true);
  }

  function getSyncMode() {
    const value = readPref(PREF_KEYS.syncMode).toLowerCase();
    return value === "page" ? "page" : "ratio";
  }

  function resolveTranslatedPdfURL(session) {
    const explicit = readPref(PREF_KEYS.translatedPdfURL);
    if (explicit) {
      return explicit;
    }

    const template = readPref(PREF_KEYS.translatedPdfTemplate);
    if (!template) {
      return "";
    }

    const title = String(session?.reader?._title || session?.reader?._item?.getDisplayTitle?.() || "").trim();
    const fileName = title || "document.pdf";
    const fileStem = fileName.replace(/\.[^./\\]+$/, "") || "document";
    const itemID = String(session?.reader?._itemID || session?.reader?._item?.id || "").trim();

    return template
      .replaceAll("{fileName}", encodeURIComponent(fileName))
      .replaceAll("{fileStem}", encodeURIComponent(fileStem))
      .replaceAll("{itemID}", encodeURIComponent(itemID));
  }

  function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  function trimTrailingSlash(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function appendCacheBust(url) {
    const target = String(url || "").trim();
    if (!target) {
      return "";
    }
    if (!/^https?:\/\//i.test(target)) {
      return target;
    }
    const ts = `_ts=${Date.now()}`;
    return target.includes("?") ? `${target}&${ts}` : `${target}?${ts}`;
  }

  function isSessionAlive(session) {
    return !!(session && !session.destroyed && session.translatedFrame);
  }

  function normalizeTranslatedPDFURL(rawURL) {
    const target = String(rawURL || "").trim();
    if (!target) {
      return "";
    }

    try {
      const parsed = new URL(target);
      if (parsed.hostname && parsed.hostname.toLowerCase() === "localhost") {
        parsed.hostname = "127.0.0.1";
      }
      return parsed.toString();
    }
    catch (_error) {
      return target;
    }
  }

  function revokeTranslatedBlobURL(session) {
    const blobURL = String(session?.translatedBlobURL || "").trim();
    if (!blobURL) {
      return;
    }

    try {
      URL.revokeObjectURL(blobURL);
    }
    catch (error) {
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] revoke blob URL failed: ${getSafeErrorText(error)}`);
      }
    }

    session.translatedBlobURL = "";
  }

  async function probeTranslatedURLStatus(url) {
    const target = String(url || "").trim();
    if (!target) {
      return {
        ok: false,
        status: 0,
        statusText: "invalid-url",
        contentType: "",
        contentDisposition: "",
        error: "invalid-url"
      };
    }

    if (!/^https?:\/\//i.test(target)) {
      return {
        ok: false,
        status: 0,
        statusText: "non-http-url",
        contentType: "",
        contentDisposition: "",
        error: ""
      };
    }

    try {
      const response = await fetch(target, {
        method: "HEAD",
        credentials: "include"
      });
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText || "",
        contentType: response.headers?.get("content-type") || "",
        contentDisposition: response.headers?.get("content-disposition") || "",
        error: ""
      };
    }
    catch (error) {
      return {
        ok: false,
        status: 0,
        statusText: "",
        contentType: "",
        contentDisposition: "",
        error: getSafeErrorText(error, "head-failed")
      };
    }
  }

  function isLikelyLocalTranslatedFileURL(url) {
    const normalized = String(url || "").trim();
    return /^https?:\/\/(127\.0\.0\.1|localhost):\d+\/files\/.+\.pdf(?:[?#].*)?$/i.test(normalized);
  }

  async function loadTranslatedFrameSource(frame, sourceURL, timeoutMs = 30000) {
    if (!frame || !sourceURL || !frame.ownerDocument) {
      throw new Error("Invalid translated frame target");
    }

    if (typeof Zotero?.debug === "function") {
      Zotero.debug(`[fastRead] loading translated frame: ${sourceURL}`);
    }
    await new Promise((resolve, reject) => {
      let settled = false;
      const win = frame.ownerDocument?.defaultView || globalThis;
      const cleanup = () => {
        frame.removeEventListener("load", onLoad);
        frame.removeEventListener("error", onError);
      };
      const timer = win?.setTimeout?.(() => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error(`Load timeout (${sourceURL})`));
      }, timeoutMs);

      const onLoad = () => {
        if (settled) {
          return;
        }
        if (!frame.ownerDocument || frame.isConnected === false) {
          settled = true;
          if (timer) {
            win?.clearTimeout?.(timer);
          }
          cleanup();
          reject(new Error("Translated frame was detached before load completed"));
          return;
        }
        settled = true;
        if (timer) {
          win?.clearTimeout?.(timer);
        }
        cleanup();
        if (typeof Zotero?.debug === "function") {
          Zotero.debug(`[fastRead] translated frame loaded: ${sourceURL}`);
        }
        resolve();
      };
      const onError = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          win?.clearTimeout?.(timer);
        }
        cleanup();
        reject(new Error(`Network or viewer load error (${sourceURL})`));
      };

      frame.addEventListener("load", onLoad, { once: true });
      frame.addEventListener("error", onError, { once: true });
      frame.src = sourceURL;
    });
  }

  async function waitForTranslatedCreateReader(frame, timeoutMs = 10000, intervalMs = 100) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
      if (!frame || !frame.contentWindow || frame.isConnected === false) {
        throw new Error("Translated frame unavailable while waiting for createReader");
      }

      const iframeWindow = frame.contentWindow;
      const wrappedWindow = iframeWindow.wrappedJSObject || iframeWindow;
      if (typeof wrappedWindow?.createReader === "function") {
        return iframeWindow;
      }

      await delay(intervalMs);
    }

    throw new Error(`createReader init timeout (${timeoutMs}ms)`);
  }

  function buildTranslatedReaderConfig(iframeWindow, attachmentURL) {
    const noop = () => {};
    const noopFalse = () => false;
    const noopNull = () => null;
    const noopEmptyArray = () => [];
    const asyncNoop = async () => {};
    const onChangeViewState = async (_state, _primary) => {};

    const config = {
      type: "pdf",
      data: {
        url: attachmentURL
      },
      annotations: [],
      primaryViewState: {
        pageIndex: 0,
        scale: "page-width",
        scrollMode: 0,
        spreadMode: 0
      },
      secondaryViewState: undefined,
      location: undefined,
      readOnly: true,
      preview: false,
      authorName: "",
      showContextPaneToggle: false,
      sidebarWidth: 0,
      sidebarOpen: false,
      bottomPlaceholderHeight: 0,
      contextPaneOpen: false,
      rtl: !!Zotero?.rtl,
      fontSize: Zotero?.Prefs?.get?.("fontSize"),
      localizedStrings: {
        ...(Zotero?.Intl?.getPrefixedStrings?.("general.") || {}),
        ...(Zotero?.Intl?.getPrefixedStrings?.("pdfReader.") || {})
      },
      showAnnotations: false,
      textSelectionAnnotationMode: Zotero?.Prefs?.get?.("reader.textSelectionAnnotationMode"),
      useDarkModeForContent: Zotero?.Prefs?.get?.("reader.contentDarkMode"),
      fontFamily: Zotero?.Prefs?.get?.("reader.ebookFontFamily"),
      hyphenate: Zotero?.Prefs?.get?.("reader.ebookHyphenate"),
      autoDisableNoteTool: true,
      autoDisableTextTool: true,
      autoDisableImageTool: true,
      onChangeViewState,
      onChangeViewStats: noop,
      onUpdateViewState: noop,
      onUpdateViewStats: noop,
      onViewUpdate: noop,
      onToggleSidebar: noop,
      onChangeSidebarWidth: noop,
      onToggleContextPane: noop,
      onOpenContextMenu: noop,
      onOpenAnnotationContextMenu: noop,
      onOpenViewContextMenu: noop,
      onOpenLink: noop,
      onOpenURL: noop,
      onSetDataTransferAnnotations: noop,
      onAddToNote: noop,
      onSaveAnnotations: async (_annotations, callback) => {
        if (typeof callback === "function") {
          callback([]);
        }
      },
      onDeleteAnnotations: noop,
      onUpdateAnnotations: noop,
      onSelectAnnotations: noop,
      onDeselectAnnotations: noop,
      onFocusAnnotation: noop,
      onSetAnnotationPopup: noop,
      onSetSelectionPopup: noop,
      onSetOverlayPopup: noop,
      onOpenTagsPopup: noop,
      onSetOutline: noop,
      onSetThumbnails: noop,
      onSetPageLabels: noop,
      onSetFindState: noop,
      onRotatePages: noop,
      onDeletePages: noop,
      onSetZoom: noop,
      onFindResult: noop,
      onRender: noop,
      onUpdate: noop,
      onPushHistoryPoint: noop,
      onTextSelectionAnnotationModeChange: noop,
      onCreateNode: noopNull,
      onDelete: noop,
      onCreateScope: noopNull,
      onDestroyScope: noop,
      onLocalDeclaration: noop,
      onRequestPassword: asyncNoop,
      onEPUBEncrypted: noop,
      onConfirm: noopFalse,
      onFocus: noop,
      onBringReaderToFront: noop,
      onIframeTab: noop,
      onTabOut: noop,
      onToolbarShiftTab: noop,
      onKeyDown: noop,
      onKeyUp: noop,
      onOpenPageLabelPopup: noop,
      onOpenAnnotationPopup: noop,
      onOpenColorContextMenu: noop,
      onClosePopup: noop,
      onSave: asyncNoop,
      onChangeFilter: noop,
      onCopyImage: noop,
      onSaveImageAs: noop,
      onAddAnnotation: noop,
      onSetState: noop,
      onGetState: noopEmptyArray
    };

    return Components.utils.cloneInto(config, iframeWindow, { cloneFunctions: true });
  }

  async function waitForTranslatedInternalReaderReady(session, internalReader, loadToken, timeoutMs = 10000, intervalMs = 100) {
    let attempts = 0;
    const maxAttempts = Math.max(1, Math.ceil(timeoutMs / Math.max(1, intervalMs)));

    while (attempts < maxAttempts) {
      attempts += 1;
      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-before-internal-ready");
      }

      const primaryView = internalReader?._primaryView;
      if (primaryView?.initializedPromise && typeof primaryView.initializedPromise.then === "function") {
        try {
          await Promise.race([primaryView.initializedPromise, delay(intervalMs)]);
        }
        catch (_error) {
        }
      }

      const app = primaryView?._iframeWindow?.PDFViewerApplication;
      if (app && typeof app.open === "function" && (app.initialized === true || !!app.pdfViewer)) {
        return true;
      }

      await delay(intervalMs);
    }

    return false;
  }

  async function fallbackTranslatedReaderWithIOUtils(session, internalReader, localFilePath, loadToken, timeoutMs = 10000, intervalMs = 100) {
    if (!localFilePath) {
      throw new Error("无法读取译文本地文件路径，IOUtils 降级不可用");
    }
    if (typeof IOUtils === "undefined" || typeof IOUtils.read !== "function") {
      throw new Error("当前环境不支持 IOUtils.read，无法执行降级加载");
    }

    const uint8Array = await IOUtils.read(localFilePath);
    if (!uint8Array || !uint8Array.byteLength) {
      throw new Error("IOUtils.read 返回空数据");
    }

    let attempts = 0;
    const maxAttempts = Math.max(1, Math.ceil(timeoutMs / Math.max(1, intervalMs)));
    while (attempts < maxAttempts) {
      attempts += 1;
      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-before-io-fallback-open");
      }

      const iframeWindow = internalReader?._primaryView?._iframeWindow;
      const app = iframeWindow?.PDFViewerApplication;
      if (app && typeof app.open === "function" && (app.initialized === true || !!app.pdfViewer)) {
        const clonedData = Components.utils.cloneInto(uint8Array, iframeWindow);
        await app.open({ data: clonedData });
        return;
      }

      await delay(intervalMs);
    }

    throw new Error("等待 PDFViewerApplication 超时，IOUtils 降级失败");
  }

  function hideTranslatedReaderUI(internalReader) {
    try {
      const viewerWindow = internalReader?._primaryView?._iframeWindow;
      const doc = viewerWindow?.document;
      if (!doc) {
        return;
      }

      injectViewerChromeStyle(doc);

      const toolbar = doc.getElementById("toolbarContainer");
      if (toolbar) {
        toolbar.style.display = "none";
      }

      const viewerContainer = doc.getElementById("viewerContainer");
      if (viewerContainer) {
        viewerContainer.style.top = "0";
      }

      const sidebar = doc.getElementById("sidebarContainer");
      if (sidebar) {
        sidebar.style.display = "none";
      }
    }
    catch (_error) {
    }

    try {
      internalReader?.toggleSidebar?.(false);
    }
    catch (_error) {
    }
  }

  async function resolveTranslatedAttachmentItem(session, attachmentUrl) {
    const current = session?.translatedAttachmentItem;
    if (current && typeof current.isAttachment === "function" && current.isAttachment()) {
      return current;
    }

    const normalized = String(attachmentUrl || "").trim();
    const match = normalized.match(/^zotero:\/\/attachment\/(?:users|groups)\/\d+\/items\/([A-Z0-9]{8})\/?/i);
    if (match && match[1]) {
      const key = String(match[1]).trim().toUpperCase();
      const libraries = Array.isArray(Zotero?.Libraries?.getAll?.()) ? Zotero.Libraries.getAll() : [];
      for (const library of libraries) {
        const libraryID = Number(library?.libraryID || library?.id || 0);
        if (!libraryID) {
          continue;
        }
        const item = Zotero?.Items?.getByLibraryAndKey?.(libraryID, key) || null;
        if (item && typeof item.isAttachment === "function" && item.isAttachment()) {
          return item;
        }
      }
    }

    return null;
  }

  async function loadPdfDataIntoIframe(session, attachmentUrl, loadToken, timeoutMs = 15000, intervalMs = 100) {
    const frame = session?.translatedFrame;
    const targetURL = String(attachmentUrl || "").trim();
    if (!frame || !targetURL) {
      throw new Error("Invalid translated PDF source for reader mount");
    }

    const isLocalFile = /^file:\/\//i.test(targetURL)
      || /^[A-Za-z]:[\\/]/.test(targetURL)
      || targetURL.startsWith("/");

    let localFilePath = "";
    if (/^file:\/\//i.test(targetURL)) {
      localFilePath = toFilePath(targetURL);
    }
    else if (/^[A-Za-z]:[\\/]/.test(targetURL) || targetURL.startsWith("/")) {
      localFilePath = targetURL;
    }
    if (!localFilePath) {
      localFilePath = String(session?.translatedAttachmentPath || "").trim();
    }

    if (isLocalFile && localFilePath) {
      if (typeof IOUtils === "undefined" || typeof IOUtils.read !== "function") {
        throw new Error("当前环境不支持 IOUtils.read，无法加载本地译文 PDF");
      }

      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] loading local translated PDF via direct viewer: ${localFilePath}`);
      }

      const uint8Array = await IOUtils.read(localFilePath);
      if (!uint8Array || !uint8Array.byteLength) {
        throw new Error(`读取译文 PDF 失败，文件为空: ${localFilePath}`);
      }
      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-after-local-read");
      }

      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] read ${uint8Array.byteLength} bytes from translated PDF`);
      }

      try {
        session.translatedInternalReader?.destroy?.();
      }
      catch (_error) {
      }
      session.translatedInternalReader = null;
      session.translatedReaderWindow = null;
      session.translatedAttachmentItem = null;

      const directViewerURL = "resource://zotero/reader/pdf/web/viewer.html";
      await loadTranslatedFrameSource(frame, directViewerURL);
      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-after-viewer-load");
      }

      if (typeof Zotero?.debug === "function") {
        Zotero.debug("[fastRead] viewer.html loaded, waiting for PDFViewerApplication...");
      }

      let app = null;
      let iframeWindow = null;
      const maxAttempts = Math.max(1, Math.ceil(timeoutMs / Math.max(1, intervalMs)));

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
          throw new Error("stale-load-aborted-waiting-for-app");
        }

        try {
          iframeWindow = frame.contentWindow;
          app = iframeWindow?.wrappedJSObject?.PDFViewerApplication
            || iframeWindow?.PDFViewerApplication;
        }
        catch (_error) {
        }

        if (app && typeof app.open === "function") {
          if (app.initialized === true || !!app.pdfViewer) {
            break;
          }
          if (app.initializedPromise && typeof app.initializedPromise.then === "function") {
            try {
              await Promise.race([app.initializedPromise, delay(2000)]);
              if (app.initialized === true || !!app.pdfViewer) {
                break;
              }
            }
            catch (_error) {
            }
          }
        }

        await delay(intervalMs);

        if (attempt > 0 && attempt % 20 === 0 && typeof Zotero?.debug === "function") {
          Zotero.debug(`[fastRead] waiting for PDFViewerApplication... attempt ${attempt}/${maxAttempts}, app=${!!app}, initialized=${app?.initialized}`);
        }
      }

      if (!app || typeof app.open !== "function") {
        throw new Error(`PDFViewerApplication 未就绪 (app=${!!app}, initialized=${app?.initialized})`);
      }

      if (typeof Zotero?.debug === "function") {
        Zotero.debug("[fastRead] PDFViewerApplication ready, injecting PDF data...");
      }

      const wrappedWindow = iframeWindow?.wrappedJSObject || iframeWindow;
      let openPayload = { data: uint8Array };
      try {
        if (typeof Components !== "undefined" && Components.utils?.cloneInto) {
          const clonedData = Components.utils.cloneInto(uint8Array, wrappedWindow);
          openPayload = Components.utils.cloneInto({ data: clonedData }, wrappedWindow, { cloneFunctions: true });
        }
      }
      catch (_error) {
      }

      await app.open(openPayload);
      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-after-local-open");
      }

      if (typeof Zotero?.debug === "function") {
        Zotero.debug("[fastRead] PDF data loaded into viewer successfully");
      }

      try {
        const viewerDoc = (iframeWindow.wrappedJSObject || iframeWindow).document;
        injectViewerChromeStyle(viewerDoc);
        const toolbar = viewerDoc?.getElementById("toolbarContainer");
        if (toolbar) {
          toolbar.style.display = "none";
        }
        const viewerContainer = viewerDoc?.getElementById("viewerContainer");
        if (viewerContainer) {
          viewerContainer.style.top = "0";
        }
        const sidebar = viewerDoc?.getElementById("sidebarContainer");
        if (sidebar) {
          sidebar.style.display = "none";
        }
        const secondaryToolbar = viewerDoc?.getElementById("secondaryToolbar");
        if (secondaryToolbar) {
          secondaryToolbar.style.display = "none";
        }
      }
      catch (_error) {
      }

      session.translatedReaderWindow = wrappedWindow;
      session.translatedAttachmentPath = localFilePath;
    }
    else {
      const translatedItem = await resolveTranslatedAttachmentItem(session, targetURL);
      let readerURL = translatedItem ? toZoteroAttachmentURI(translatedItem) : "";
      if (!readerURL) {
        readerURL = targetURL;
      }

      if (!localFilePath && translatedItem) {
        localFilePath = String(await getAttachmentFilePath(translatedItem) || "").trim();
      }
      if (!localFilePath) {
        localFilePath = String(session?.translatedAttachmentPath || "").trim();
      }

      if (!readerURL) {
        throw new Error("无法构造可加载的译文 URL");
      }
      if (!localFilePath && !/^https?:\/\//i.test(readerURL)) {
        throw new Error("译文附件本地路径为空，无法执行降级加载");
      }

      try {
        session.translatedInternalReader?.destroy?.();
      }
      catch (_error) {
      }
      session.translatedInternalReader = null;

      await loadTranslatedFrameSource(frame, INTERNAL_READER_FRAME_URL);
      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-before-create-reader");
      }

      const iframeWindow = await waitForTranslatedCreateReader(frame, timeoutMs, intervalMs);
      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-before-create-reader-call");
      }

      const wrappedWindow = iframeWindow.wrappedJSObject || iframeWindow;
      const readerConfig = buildTranslatedReaderConfig(iframeWindow, readerURL);
      const internalReader = wrappedWindow.createReader(readerConfig);
      if (!internalReader) {
        throw new Error("createReader 返回空对象，无法继续渲染译文");
      }

      session.translatedInternalReader = internalReader;
      session.translatedReaderWindow = iframeWindow;
      session.translatedAttachmentItem = translatedItem || null;
      session.translatedAttachmentPath = localFilePath;

      const viewerReady = await waitForTranslatedInternalReaderReady(session, internalReader, loadToken, timeoutMs, intervalMs);
      if (!viewerReady) {
        if (!localFilePath) {
          throw new Error("译文附件未就绪，且无本地文件路径可用于降级加载");
        }
        await fallbackTranslatedReaderWithIOUtils(session, internalReader, localFilePath, loadToken, timeoutMs, intervalMs);
      }

      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-after-reader-open");
      }

      hideTranslatedReaderUI(internalReader);
    }
  }

  function getRemoteTaskConfig() {
    const baseURL = trimTrailingSlash(readPref(PREF_KEYS.remoteBaseURL));
    return {
      baseURL,
      authToken: readPref(PREF_KEYS.remoteAuthToken),
      apiKey: readPref(PREF_KEYS.remoteApiKey),
      sourceLang: readPref(PREF_KEYS.remoteSourceLang) || "en",
      targetLang: readPref(PREF_KEYS.remoteTargetLang) || "zh",
      engine: readPref(PREF_KEYS.remoteEngine) || "openai",
      priority: readPref(PREF_KEYS.remotePriority) || "normal",
      providerConfigId: readPref(PREF_KEYS.remoteProviderConfigId),
      modelConfig: readPref(PREF_KEYS.remoteModelConfig),
      pollIntervalMs: Math.max(500, toPositiveInt(readPref(PREF_KEYS.remotePollIntervalMs), 1500)),
      pollTimeoutMs: Math.max(30000, toPositiveInt(readPref(PREF_KEYS.remotePollTimeoutSec), 600) * 1000)
    };
  }

  function isRemoteAutoTranslateEnabled() {
    return isTruePref(PREF_KEYS.remoteAutoTranslateOnOpen, true);
  }

  function buildRemoteCreateTaskURL(config) {
    if (!config?.baseURL) {
      return "";
    }
    const base = trimTrailingSlash(config.baseURL);
    if (/\/api\/tasks$/i.test(base)) {
      return base;
    }
    if (/\/api$/i.test(base)) {
      return `${base}/tasks`;
    }
    return `${base}/api/tasks`;
  }

  function buildRemoteTaskDetailURL(config, taskID) {
    if (!config?.baseURL || !taskID) {
      return "";
    }
    const base = trimTrailingSlash(config.baseURL);
    const encodedID = encodeURIComponent(String(taskID));
    if (/\/api\/tasks$/i.test(base)) {
      return `${base}/${encodedID}`;
    }
    if (/\/api$/i.test(base)) {
      return `${base}/tasks/${encodedID}`;
    }
    return `${base}/api/tasks/${encodedID}`;
  }

  function extractPortFromURL(rawURL) {
    const value = String(rawURL || "").trim();
    if (!value) {
      return "";
    }

    try {
      const parsed = new URL(value);
      if (parsed.port) {
        return parsed.port;
      }
      return parsed.protocol === "https:" ? "443" : "80";
    }
    catch (_error) {
      const match = value.match(/^https?:\/\/[^/:?#]+:(\d+)(?:[/?#]|$)/i);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    }
  }

  function debugRemoteEndpoint(session, stage, url) {
    const normalizedURL = String(url || "").trim();
    if (!normalizedURL) {
      return;
    }

    const port = extractPortFromURL(normalizedURL) || "(unknown)";
    if (typeof Zotero?.debug === "function") {
      Zotero.debug(`[fastRead] ${stage}: ${normalizedURL} (port ${port})`);
    }

    if (session?.statusNode && stage === "任务提交") {
      setStatus(session, `任务提交地址: ${normalizedURL}（端口 ${port}）`, "info");
    }
  }

  function buildRemoteHeaders(config) {
    const headers = {};
    if (config?.authToken) {
      headers.Authorization = `Bearer ${config.authToken}`;
    }
    if (config?.apiKey) {
      headers["X-API-Key"] = config.apiKey;
    }
    return headers;
  }

  function isReachableTaskAPIResponse(response) {
    if (!response) {
      return false;
    }
    return response.ok || response.status === 401 || response.status === 403;
  }

  async function probeLocalHealth(baseURL) {
    const normalized = trimTrailingSlash(baseURL);
    if (!normalized) {
      return false;
    }

    try {
      const response = await fetch(`${normalized}/health?_ts=${Date.now()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      });
      if (!response.ok) {
        return false;
      }

      const payload = await response.json().catch(() => ({}));
      return String(payload?.service || "").toLowerCase() === "fastread-server"
        && String(payload?.status || "").toLowerCase() === "ok";
    }
    catch (_error) {
      return false;
    }
  }

  async function waitForLocalCandidateReachable(baseURL, headers) {
    const normalized = trimTrailingSlash(baseURL);
    if (!normalized) {
      return false;
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const healthOK = await probeLocalHealth(normalized);
      if (healthOK) {
        const probe = await probeRemoteTasksEndpoint(normalized, headers);
        if (!probe || probe.reachable) {
          return true;
        }
      }

      await delay(300);
    }

    return false;
  }

  async function probeRemoteTasksEndpoint(baseURL, headers) {
    const endpoint = buildRemoteCreateTaskURL({ baseURL });
    if (!endpoint) {
      return null;
    }
    const url = `${endpoint}?page=1&pageSize=1&_ts=${Date.now()}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include"
      });
      return {
        endpoint,
        response,
        reachable: isReachableTaskAPIResponse(response)
      };
    }
    catch (_error) {
      return {
        endpoint,
        response: null,
        reachable: false
      };
    }
  }

  async function resolveRemoteTaskBaseURL(config, session) {
    const headers = buildRemoteHeaders(config);
    const explicit = trimTrailingSlash(config?.baseURL);
    if (explicit) {
      if (LOCAL_REMOTE_BASE_URL_CANDIDATES.includes(explicit)) {
        const localReady = await waitForLocalCandidateReachable(explicit, headers);
        if (localReady) {
          return explicit;
        }
      }
      else {
        const probe = await probeRemoteTasksEndpoint(explicit, headers);
        if (probe?.reachable) {
          return explicit;
        }
      }

      const explicitCreateURL = buildRemoteCreateTaskURL({ baseURL: explicit });
      setStatus(
        session,
        `已配置任务 API 不可用（${explicitCreateURL || explicit}），正在回退本地服务...`,
        "info"
      );

      for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
        const normalized = trimTrailingSlash(candidate);
        if (!normalized || normalized === explicit) {
          continue;
        }
        const fallbackReady = await waitForLocalCandidateReachable(normalized, headers);
        if (!fallbackReady) {
          continue;
        }
        writePref(PREF_KEYS.remoteBaseURL, normalized);
        setStatus(session, `已自动切换到本地任务服务: ${normalized}`, "success");
        return normalized;
      }

      return "";
    }

    setStatus(session, "未填写任务 API URL，正在自动探测本地服务...", "info");

    for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
      const localReady = await waitForLocalCandidateReachable(candidate, headers);
      if (!localReady) {
        continue;
      }
      const resolved = trimTrailingSlash(candidate);
      writePref(PREF_KEYS.remoteBaseURL, resolved);
      setStatus(session, `已自动连接本地任务服务: ${resolved}`, "success");
      return resolved;
    }

    return "";
  }

  function sanitizeMultipartToken(value) {
    return String(value || "").replace(/["\r\n]/g, "_");
  }

  function toUint8Array(value) {
    if (!value) {
      return new Uint8Array(0);
    }
    if (value instanceof Uint8Array) {
      return value;
    }
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }
    return new Uint8Array(0);
  }

  function buildMultipartRequestBody(file, fields) {
    const boundary = `----fastread-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    const encoder = getTextEncoder();
    const chunks = [];

    const pushText = (text) => {
      chunks.push(encoder.encode(String(text || "")));
    };

    for (const [name, rawValue] of Object.entries(fields || {})) {
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        continue;
      }
      const safeName = sanitizeMultipartToken(name);
      pushText(`--${boundary}\r\n`);
      pushText(`Content-Disposition: form-data; name="${safeName}"\r\n\r\n`);
      pushText(`${String(rawValue)}\r\n`);
    }

    const safeFileName = sanitizeMultipartToken(file?.fileName || "document.pdf");
    const fileBytes = toUint8Array(file?.bytes);

    pushText(`--${boundary}\r\n`);
    pushText(`Content-Disposition: form-data; name="file"; filename="${safeFileName}"\r\n`);
    pushText("Content-Type: application/pdf\r\n\r\n");
    chunks.push(fileBytes);
    pushText("\r\n");
    pushText(`--${boundary}--\r\n`);

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return {
      body,
      contentType: `multipart/form-data; boundary=${boundary}`
    };
  }

  function basenameFromPath(path) {
    const normalized = String(path || "").trim();
    const parts = normalized.split(/[\\/]/);
    const last = parts[parts.length - 1] || "";
    return last || "document.pdf";
  }

  function getAttachmentItemForSession(session) {
    const direct = session?.reader?._item || null;
    if (direct && typeof direct.isAttachment === "function" && direct.isAttachment()) {
      return direct;
    }

    const fallbackID = session?.reader?._itemID || session?.reader?.itemID || null;
    if (fallbackID && Zotero?.Items?.get) {
      const item = Zotero.Items.get(fallbackID);
      if (item && typeof item.isAttachment === "function" && item.isAttachment()) {
        return item;
      }
    }
    return null;
  }

  async function readAttachmentPDFBinary(session) {
    const attachment = getAttachmentItemForSession(session);
    if (!attachment) {
      throw new Error("未找到当前 PDF 附件，无法提交翻译任务。");
    }

    let filePath = "";
    if (typeof attachment.getFilePathAsync === "function") {
      filePath = await attachment.getFilePathAsync();
    }
    else if (typeof attachment.getFilePath === "function") {
      filePath = attachment.getFilePath();
    }

    if (!filePath) {
      throw new Error("无法获取附件文件路径，请确认该 PDF 已下载到本地。");
    }
    if (typeof IOUtils === "undefined" || typeof IOUtils.read !== "function") {
      throw new Error("当前环境不支持读取本地文件 (IOUtils.read unavailable)。");
    }

    const bytes = await IOUtils.read(filePath);
    if (!bytes || !bytes.length) {
      throw new Error("读取 PDF 文件失败：文件为空。");
    }

    return {
      bytes,
      fileName: basenameFromPath(filePath),
      attachment
    };
  }

  function joinFilePath(basePath, fileName) {
    const base = String(basePath || "").trim();
    const leaf = String(fileName || "").trim();
    if (!base) {
      return leaf;
    }
    if (!leaf) {
      return base;
    }
    if (typeof PathUtils !== "undefined" && typeof PathUtils.join === "function") {
      return PathUtils.join(base, leaf);
    }
    return `${base.replace(/[\\/]+$/, "")}/${leaf.replace(/^[\\/]+/, "")}`;
  }

  function getParentDirectory(filePath) {
    const normalized = String(filePath || "").trim();
    if (!normalized) {
      return "";
    }

    if (typeof PathUtils !== "undefined" && typeof PathUtils.parent === "function") {
      try {
        return PathUtils.parent(normalized) || "";
      }
      catch (_error) {
      }
    }

    const lastSep = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
    if (lastSep > 0) {
      return normalized.substring(0, lastSep);
    }

    return "";
  }

  async function fileExists(filePath) {
    const target = String(filePath || "").trim();
    if (!target) {
      return false;
    }

    try {
      if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {
        return !!(await IOUtils.exists(target));
      }
    }
    catch (_error) {
    }

    try {
      if (Zotero?.File?.pathToFile) {
        const nsFile = Zotero.File.pathToFile(target);
        return !!nsFile?.exists?.();
      }
    }
    catch (_error) {
    }

    return false;
  }

  async function getAttachmentFilePath(attachment) {
    if (!attachment) {
      return "";
    }

    if (typeof attachment.getFilePathAsync === "function") {
      return String(await attachment.getFilePathAsync() || "").trim();
    }

    if (typeof attachment.getFilePath === "function") {
      return String(attachment.getFilePath() || "").trim();
    }

    return "";
  }

  function getParentItemIDForAttachment(attachment) {
    const maybeParent = Number(attachment?.parentItemID || attachment?.parentID || 0);
    if (Number.isFinite(maybeParent) && maybeParent > 0) {
      return maybeParent;
    }
    return 0;
  }

  function toFileURI(filePath) {
    const raw = String(filePath || "").trim();
    if (!raw) {
      return "";
    }

    if (/^file:\/\//i.test(raw)) {
      return raw;
    }

    try {
      if (typeof PathUtils !== "undefined" && typeof PathUtils.toFileURI === "function") {
        return PathUtils.toFileURI(raw);
      }
    }
    catch (error) {
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] PathUtils.toFileURI failed: ${getSafeErrorText(error)}`);
      }
    }

    try {
      if (Zotero?.File?.pathToFile && typeof Services !== "undefined" && Services?.io?.newFileURI) {
        const nsFile = Zotero.File.pathToFile(raw);
        return Services.io.newFileURI(nsFile).spec;
      }
    }
    catch (error) {
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] Services.io.newFileURI failed: ${getSafeErrorText(error)}`);
      }
    }

    const normalized = raw.replace(/\\/g, "/");
    return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
  }

  function toFilePath(fileURI) {
    const target = String(fileURI || "").trim();
    if (!target || !/^file:\/\//i.test(target)) {
      return "";
    }

    try {
      if (typeof PathUtils !== "undefined" && typeof PathUtils.toFilePath === "function") {
        return String(PathUtils.toFilePath(target) || "").trim();
      }
    }
    catch (_error) {
    }

    try {
      const withoutScheme = target.replace(/^file:\/\//i, "");
      if (/^\/[A-Za-z]:\//.test(withoutScheme)) {
        return decodeURIComponent(withoutScheme.slice(1)).replace(/\//g, "\\");
      }
      if (/^[A-Za-z]:\//.test(withoutScheme)) {
        return decodeURIComponent(withoutScheme).replace(/\//g, "\\");
      }
      return decodeURIComponent(withoutScheme);
    }
    catch (_error) {
      return "";
    }
  }

  function toZoteroAttachmentURI(attachment) {
    const item = attachment || null;
    const key = String(item?.key || "").trim();
    const libraryID = Number(item?.libraryID || 0);
    if (!key || !Number.isFinite(libraryID) || libraryID <= 0) {
      return "";
    }

    const libraryPrefix = String(Zotero?.API?.getLibraryPrefix?.(libraryID) || "").trim();
    if (!libraryPrefix) {
      return "";
    }

    return `zotero://attachment/${libraryPrefix}/items/${key}/`;
  }

  async function writeBinaryFile(filePath, bytes) {
    if (typeof IOUtils !== "undefined" && typeof IOUtils.write === "function") {
      await IOUtils.write(filePath, bytes);
      return;
    }

    if (Zotero?.File?.putContentsAsync) {
      await Zotero.File.putContentsAsync(filePath, bytes);
      return;
    }

    throw new Error("当前环境不支持写入临时文件（缺少 IOUtils.write / Zotero.File.putContentsAsync）。");
  }

  async function downloadAndImportPDF(session, monoOutputUrl) {
    const sourceAttachment = getAttachmentItemForSession(session);
    if (!sourceAttachment) {
      throw new Error("未找到当前原文附件，无法保存译文。\n请先在左侧打开一个本地 PDF 附件。");
    }

    const sourcePath = await getAttachmentFilePath(sourceAttachment);
    if (!sourcePath) {
      throw new Error("无法获取原文 PDF 路径。");
    }
    const sourceDir = getParentDirectory(sourcePath);
    if (!sourceDir) {
      throw new Error("无法获取原文 PDF 所在目录。");
    }

    setStatus(session, "正在从本地服务拉取译文...", "info");
    const response = await fetch(monoOutputUrl, {
      method: "GET",
      credentials: "include"
    });
    if (!response.ok) {
      throw new Error(`下载译文 PDF 失败: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer || new ArrayBuffer(0));
    if (!bytes.length) {
      throw new Error("下载译文 PDF 失败：返回内容为空。\n请检查服务端输出文件是否存在。");
    }

    const translatedFileName = "[fastRead 译文] PDF.pdf";
    const translatedFilePath = joinFilePath(sourceDir, translatedFileName);

    setStatus(session, "正在保存译文到原文目录...", "info");
    await writeBinaryFile(translatedFilePath, bytes);

    return {
      attachmentItem: null,
      localFilePath: translatedFilePath,
      source: "saved-to-source-dir"
    };
  }

  function extractTaskPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return payload.task || payload.data?.task || payload.data || payload;
  }

  function extractTaskID(payload) {
    const task = extractTaskPayload(payload);
    return task?.id || task?.taskId || task?.task_id || null;
  }

  function extractDualOutputUrl(payload) {
    const task = extractTaskPayload(payload) || payload || {};
    return task?.monoOutputUrl
      || task?.mono_output_url
      || task?.output?.monoOutputUrl
      || task?.output?.mono_output_url
      || task?.dualOutputUrl
      || task?.dual_output_url
      || task?.output?.dualOutputUrl
      || task?.output?.dual_output_url
      || "";
  }

  function extractTaskStatus(payload) {
    const task = extractTaskPayload(payload) || payload || {};
    return String(task?.status || "").trim().toLowerCase();
  }

  function extractTaskProgress(payload) {
    const task = extractTaskPayload(payload) || payload || {};
    const value = Number(task?.progress || task?.progressPct || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function extractTaskError(payload) {
    const task = extractTaskPayload(payload) || payload || {};
    const err = task?.error || task?.message || payload?.message || "";
    return String(err || "").trim();
  }

  async function requestTranslatedPDFViaAPI(session) {
    try {
      const sourceAttachment = getAttachmentItemForSession(session);
      if (sourceAttachment) {
        const sourcePath = await getAttachmentFilePath(sourceAttachment);
        if (sourcePath) {
          const sourceDir = getParentDirectory(sourcePath);
          if (sourceDir) {
            const translatedPath = joinFilePath(sourceDir, "[fastRead 译文] PDF.pdf");
            let exists = false;
            try {
              if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {
                exists = !!(await IOUtils.exists(translatedPath));
              }
            }
            catch (_error) {
            }

            if (exists) {
              const fileURI = toFileURI(translatedPath);
              if (fileURI) {
                setStatus(session, "检测到本地译文，跳过翻译...", "info");
                session.translatedAttachmentItem = null;
                session.translatedAttachmentPath = translatedPath;
                await loadTranslatedPDF(session, fileURI);
                return;
              }
            }
          }
        }
      }
    }
    catch (_error) {
    }

    const config = getRemoteTaskConfig();
    const resolvedBaseURL = await resolveRemoteTaskBaseURL(config, session);
    if (!resolvedBaseURL) {
      throw new Error("未配置任务 API Base URL，且未在本机发现可用服务。请在 Windows 侧访问本地服务端口（建议 0.0.0.0:8000 / :18000 / :28000），或在首选项手动填写 Base URL。");
    }
    config.baseURL = resolvedBaseURL;

    const createURL = buildRemoteCreateTaskURL(config);
    if (!createURL) {
      throw new Error("任务 API URL 无效。");
    }

    const selectedPort = extractPortFromURL(createURL) || "(unknown)";
    if (session?.statusNode) {
      setStatus(session, `已选择任务服务端口 ${selectedPort}，准备提交任务...`, "info");
    }
    debugRemoteEndpoint(session, "任务提交", createURL);

    setStatus(session, "正在读取本地 PDF，并提交翻译任务...", "info");

    const file = await readAttachmentPDFBinary(session);
    const multipartFields = {
      documentName: file.fileName,
      taskType: "translation",
      sourceLang: config.sourceLang,
      targetLang: config.targetLang,
      engine: config.engine,
      priority: config.priority
    };
    if (config.providerConfigId) {
      multipartFields.providerConfigId = config.providerConfigId;
    }
    if (config.modelConfig) {
      multipartFields.modelConfig = config.modelConfig;
    }
    const multipart = buildMultipartRequestBody(file, multipartFields);

    session.remoteTaskPolling = true;
    try {
      const submitCreateTask = async (targetConfig) => {
        const headers = buildRemoteHeaders(targetConfig);
        headers["Content-Type"] = multipart.contentType;
        const targetCreateURL = buildRemoteCreateTaskURL(targetConfig);
        if (!targetCreateURL) {
          throw new Error("任务 API URL 无效。");
        }

        const response = await fetch(targetCreateURL, {
          method: "POST",
          headers,
          body: multipart.body,
          credentials: "include"
        });
        const payload = await response.json().catch(() => ({}));
        return { response, payload, targetCreateURL };
      };

      let { response: createResponse, payload: createPayload, targetCreateURL } = await submitCreateTask(config);

      if (!createResponse.ok && createResponse.status === 404) {
        setStatus(session, `任务接口返回 404（${targetCreateURL}），正在自动回退本地服务...`, "info");
        writePref(PREF_KEYS.remoteBaseURL, "");

        const fallbackBaseURL = await resolveRemoteTaskBaseURL({ ...config, baseURL: "" }, session);
        if (fallbackBaseURL) {
          config.baseURL = fallbackBaseURL;
          ({ response: createResponse, payload: createPayload, targetCreateURL } = await submitCreateTask(config));
        }
      }

      if (!createResponse.ok) {
        const message = extractTaskError(createPayload) || `${createResponse.status} ${createResponse.statusText}`;
        throw new Error(`创建翻译任务失败: ${message}`);
      }

      const taskID = extractTaskID(createPayload);
      if (!taskID) {
        throw new Error("创建任务成功，但响应中没有任务 ID。");
      }

      session.remoteTaskID = taskID;
      setStatus(session, `任务已创建 (#${taskID})，正在等待译文 PDF...`, "info");

      const startedAt = Date.now();
      let detailEndpointLogged = false;
      while (Date.now() - startedAt < config.pollTimeoutMs) {
        const detailURL = `${buildRemoteTaskDetailURL(config, taskID)}?_ts=${Date.now()}`;
        if (!detailEndpointLogged) {
          debugRemoteEndpoint(session, "任务状态查询", detailURL);
          detailEndpointLogged = true;
        }
        const detailResponse = await fetch(detailURL, {
          method: "GET",
          headers: buildRemoteHeaders(config),
          credentials: "include"
        });
        const detailPayload = await detailResponse.json().catch(() => ({}));

        if (!detailResponse.ok) {
          const message = extractTaskError(detailPayload) || `${detailResponse.status} ${detailResponse.statusText}`;
          throw new Error(`查询任务状态失败: ${message}`);
        }

        const dualUrl = extractDualOutputUrl(detailPayload);
        if (dualUrl) {
          const resolvedOutputURL = normalizeTranslatedPDFURL(dualUrl);
          const imported = await downloadAndImportPDF(session, resolvedOutputURL);
          session.translatedAttachmentItem = null;
          session.translatedAttachmentPath = String(imported.localFilePath || "").trim();
          const trustedLocalURL = toFileURI(imported.localFilePath);
          if (!trustedLocalURL) {
            throw new Error("译文已保存，但无法转换为本地文件 URL。");
          }

          setStatus(session, "译文已保存到原文目录，正在加载本地译文...", "info");
          await loadTranslatedPDF(session, trustedLocalURL);
          return;
        }

        const status = extractTaskStatus(detailPayload);
        const progress = extractTaskProgress(detailPayload);
        if (["failed", "error", "cancelled", "canceled"].includes(status)) {
          const message = extractTaskError(detailPayload) || `状态: ${status}`;
          throw new Error(`远程翻译任务失败: ${message}`);
        }

        setStatus(session, `任务 #${taskID} 状态: ${status || "running"} (${Math.max(0, Math.min(100, Math.round(progress)))}%)`, "info");
        await delay(config.pollIntervalMs);
      }

      throw new Error("等待翻译输出 URL 超时。请检查任务中心是否仍在运行。");
    }
    finally {
      session.remoteTaskPolling = false;
    }
  }

  async function loadTranslatedPDF(session, rawURL) {
    const url = normalizeTranslatedPDFURL(rawURL);
    if (!url || !isSessionAlive(session)) {
      throw new Error("Invalid translated PDF URL.");
    }

    session.translatedURL = url;
    const loadToken = Number(session.translatedLoadToken || 0) + 1;
    session.translatedLoadToken = loadToken;
    revokeTranslatedBlobURL(session);
    detachSync(session);
    updateSyncBadge(session, "Sync: loading");

    setPlaceholderState(session, "loading");
    session.translatedFrame.classList.remove("is-ready");
    setStatus(session, "正在加载译文 PDF...", "info");

    if (typeof Zotero?.debug === "function") {
      Zotero.debug(`[fastRead] translated URL requested: ${url}; loading by raw data injection`);
    }

    let loadError = null;
    try {
      await loadPdfDataIntoIframe(session, url, loadToken, 15000, 100);

      if (!isSessionAlive(session)) {
        throw new Error("Reader session disposed while loading translated PDF");
      }
    }
    catch (primaryError) {
      if (String(primaryError?.message || "").startsWith("stale-load-aborted")) {
        return;
      }
      loadError = primaryError;
    }

    if (loadError) {
      const urlProbe = await probeTranslatedURLStatus(url);
      const probeText = urlProbe.error
        ? `HEAD failed: ${urlProbe.error}`
        : `HEAD ${urlProbe.status} ${urlProbe.statusText}; content-type=${urlProbe.contentType || "<none>"}; content-disposition=${urlProbe.contentDisposition || "<none>"}`;
      Zotero.logError(`[fastRead] translated PDF load failed: ${url}; reason: ${loadError.message}; probe: ${probeText}`);

      const isHTTPProbe = /^https?:\/\//i.test(String(url || "").trim());
      const headUnsupported = urlProbe.status === 405 || urlProbe.status === 501;
      const isLikelyMissingFile = isHTTPProbe && !headUnsupported && (urlProbe.status === 404 || urlProbe.status === 410);
      const canRecoverByRetranslate = isLikelyLocalTranslatedFileURL(url)
        && isRemoteAutoTranslateEnabled()
        && !session._recoveringLocalTranslatedURL
        && isLikelyMissingFile
        && Number(session.translatedLoadRetryCount || 0) < 2;

      if (loadError && canRecoverByRetranslate) {
        session._recoveringLocalTranslatedURL = true;
        session.translatedLoadRetryCount = Number(session.translatedLoadRetryCount || 0) + 1;
        writePref(PREF_KEYS.translatedPdfURL, "");
        setStatus(session, `右侧译文加载失败，正在自动重新提交翻译任务（重试 ${session.translatedLoadRetryCount}/2）...`, "info");
        if (typeof Zotero?.debug === "function") {
          Zotero.debug(`[fastRead] retrying translation task because viewer load failed for: ${url}`);
        }
        try {
          await requestTranslatedPDFViaAPI(session);
          return;
        }
        finally {
          session._recoveringLocalTranslatedURL = false;
        }
      }

      if (loadError) {
        if (session.translatedPlaceholder) {
          setPlaceholderState(session, "error");
        }

        throw new Error(`Network or viewer load error (${url}): ${getSafeErrorText(loadError)}`);
      }

    }

    session.translatedFrame.classList.add("is-ready");
    setPlaceholderState(session, "ready");
    session.translatedLoadRetryCount = 0;

    const syncReady = setupSync(session);
    if (syncReady) {
      setStatus(session, "译文 PDF 已加载，双向同步已开启。", "success");
      updateSyncBadge(session, `Sync: ${getSyncMode()}`);
    }
    else {
      setStatus(session, "译文 PDF 已加载。当前页面跨域，仅支持原文->译文单向同步。", "info");
      updateSyncBadge(session, "Sync: limited");
    }
  }

  function getScrollableRoot(doc, fallbackElement) {
    try {
      if (!doc) {
        return fallbackElement || null;
      }

      const viewerContainer = doc.getElementById("viewerContainer")
        || doc.querySelector(".pdfViewerContainer")
        || doc.querySelector(".viewerContainer");
      if (viewerContainer) {
        return viewerContainer;
      }

      return doc.scrollingElement || doc.documentElement || doc.body || fallbackElement || null;
    }
    catch (_error) {
      return fallbackElement || null;
    }
  }

  function getTranslatedViewerDoc(session) {
    try {
      const internalDoc = session?.translatedInternalReader?._primaryView?._iframeWindow?.document || null;
      if (internalDoc) {
        return internalDoc;
      }
    }
    catch (_error) {
    }

    try {
      const frameWindow = session?.translatedFrame?.contentWindow;
      const wrappedDoc = (frameWindow?.wrappedJSObject || frameWindow)?.document;
      if (wrappedDoc) {
        return wrappedDoc;
      }
      return session?.translatedFrame?.contentDocument || null;
    }
    catch (_error) {
      return null;
    }
  }

  function getScrollRatio(scrollRoot) {
    if (!scrollRoot) {
      return 0;
    }
    const max = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    if (!max) {
      return 0;
    }
    return scrollRoot.scrollTop / max;
  }

  function applyScrollRatio(scrollRoot, ratio) {
    if (!scrollRoot) {
      return;
    }
    const max = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    scrollRoot.scrollTop = Math.max(0, Math.min(max, ratio * max));
  }

  function getCurrentPageNumberFromDoc(doc) {
    try {
      const view = doc?.defaultView;
      const app = view?.wrappedJSObject?.PDFViewerApplication
        || view?.PDFViewerApplication;
      const number = Number(app?.pdfViewer?.currentPageNumber || app?.page || 0);
      if (Number.isFinite(number) && number > 0) {
        return number;
      }
    }
    catch (_error) {
    }
    return 0;
  }

  function setCurrentPageNumberInDoc(doc, pageNumber) {
    if (!doc || !pageNumber) {
      return false;
    }
    try {
      const view = doc.defaultView;
      const app = view?.wrappedJSObject?.PDFViewerApplication
        || view?.PDFViewerApplication;
      const viewer = app?.pdfViewer;
      if (!viewer) {
        return false;
      }
      if (typeof viewer.scrollPageIntoView === "function") {
        viewer.scrollPageIntoView({ pageNumber });
      }
      viewer.currentPageNumber = pageNumber;
      return true;
    }
    catch (_error) {
      return false;
    }
  }

  function getSafeErrorText(error, fallback = "unknown-error") {
    try {
      if (error === null || error === undefined) {
        return fallback;
      }
      if (typeof error === "string") {
        return error;
      }

      let message = "";
      let name = "";
      let stack = "";
      try {
        message = typeof error.message === "string" ? error.message : "";
      }
      catch (_inner) {
      }
      try {
        name = typeof error.name === "string" ? error.name : "";
      }
      catch (_inner) {
      }
      try {
        stack = typeof error.stack === "string" ? error.stack : "";
      }
      catch (_inner) {
      }

      if (name && message) {
        return `${name}: ${message}`;
      }
      if (message) {
        return message;
      }
      if (stack) {
        return String(stack).split("\n")[0] || stack;
      }

      try {
        return String(error);
      }
      catch (_inner) {
      }
    }
    catch (_error) {
    }

    return fallback;
  }

  function setupSync(session) {
    if (!isSessionAlive(session)) {
      return false;
    }

    const sourcePDFDoc = session.leftPDFDoc || session.doc;
    if (!sourcePDFDoc) {
      return false;
    }

    const rightDoc = getTranslatedViewerDoc(session);

    injectViewerChromeStyle(sourcePDFDoc);
    injectViewerChromeStyle(rightDoc);

    const syncEnabled = isTruePref(PREF_KEYS.syncEnabled, true);
    if (!syncEnabled) {
      updateSyncBadge(session, "Sync: off");
      return false;
    }

    const leftRoot = getScrollableRoot(sourcePDFDoc, session.leftPane);

    session.leftScrollRoot = leftRoot;
    let rightViewerContainer = null;
    try {
      rightViewerContainer = rightDoc?.getElementById?.("viewerContainer") || null;
    }
    catch (_error) {
    }
    session.translatedViewerContainer = rightViewerContainer;
    session.translatedScrollRoot = rightViewerContainer || getScrollableRoot(rightDoc, null);

    if (!leftRoot || !session.translatedScrollRoot) {
      return false;
    }

    const syncMode = getSyncMode();
    const syncByRatio = (source, target) => {
      const ratio = getScrollRatio(source);
      applyScrollRatio(target, ratio);
    };
    const syncByPage = (sourceDoc, targetDoc, fallbackSource, fallbackTarget) => {
      const pageNumber = getCurrentPageNumberFromDoc(sourceDoc);
      const success = setCurrentPageNumberInDoc(targetDoc, pageNumber);
      if (!success) {
        syncByRatio(fallbackSource, fallbackTarget);
      }
    };

    const getNodeWindow = (node, fallbackDoc) => {
      try {
        return node?.ownerDocument?.defaultView || fallbackDoc?.defaultView || null;
      }
      catch (_error) {
        try {
          return fallbackDoc?.defaultView || null;
        }
        catch (_inner) {
          return null;
        }
      }
    };

    const scheduleScrollUnlock = (side, sourceRoot) => {
      if (session.scrollSyncReleaseTimer) {
        clearTimeout(session.scrollSyncReleaseTimer);
        session.scrollSyncReleaseTimer = 0;
      }

      session.scrollSyncSource = side;
      const sourceWin = getNodeWindow(sourceRoot, sourcePDFDoc) || globalThis;
      const setTimer = typeof sourceWin?.setTimeout === "function"
        ? sourceWin.setTimeout.bind(sourceWin)
        : setTimeout;
      session.scrollSyncReleaseTimer = setTimer(() => {
        if (session.scrollSyncSource === side) {
          session.scrollSyncSource = "";
        }
        session.scrollSyncReleaseTimer = 0;
      }, 90);
    };

    const runScrollSync = (side, sourceRoot, targetRoot, sourceDoc, targetDoc) => {
      if (session.scrollSyncSource && session.scrollSyncSource !== side) {
        return;
      }

      scheduleScrollUnlock(side, sourceRoot);

      if (syncMode === "page") {
        syncByPage(sourceDoc, targetDoc, sourceRoot, targetRoot);
      }
      else {
        syncByRatio(sourceRoot, targetRoot);
      }
    };

    const queueScrollSync = (side, root, callback) => {
      const view = getNodeWindow(root, sourcePDFDoc);
      const rafKey = side === "left" ? "leftScrollRAF" : "rightScrollRAF";

      if (!view || typeof view.requestAnimationFrame !== "function") {
        callback();
        return;
      }

      if (session[rafKey]) {
        try {
          view.cancelAnimationFrame(session[rafKey]);
        }
        catch (_error) {
        }
      }

      session[rafKey] = view.requestAnimationFrame(() => {
        session[rafKey] = 0;
        callback();
      });
    };

    const syncFromLeft = () => {
      if (!isSessionAlive(session) || !leftRoot || !session.translatedScrollRoot) {
        detachSync(session);
        return;
      }
      try {
        queueScrollSync("left", leftRoot, () => {
          if (!isSessionAlive(session) || !leftRoot || !session.translatedScrollRoot) {
            return;
          }
          runScrollSync("left", leftRoot, session.translatedScrollRoot, sourcePDFDoc, rightDoc);
        });
      }
      catch (_error) {
        detachSync(session);
      }
    };

    const syncFromRight = () => {
      if (!isSessionAlive(session) || !leftRoot || !session.translatedScrollRoot) {
        detachSync(session);
        return;
      }
      try {
        queueScrollSync("right", session.translatedScrollRoot, () => {
          if (!isSessionAlive(session) || !leftRoot || !session.translatedScrollRoot) {
            return;
          }
          runScrollSync("right", session.translatedScrollRoot, leftRoot, rightDoc, sourcePDFDoc);
        });
      }
      catch (_error) {
        detachSync(session);
      }
    };

    leftRoot.addEventListener("scroll", syncFromLeft, { passive: true });
    session.leftScrollListener = syncFromLeft;

    session.translatedScrollRoot.addEventListener("scroll", syncFromRight, { passive: true });
    session.rightScrollListener = syncFromRight;

    let leftApp = null;
    let rightApp = null;
    try {
      const leftWin = sourcePDFDoc?.defaultView;
      leftApp = leftWin?.wrappedJSObject?.PDFViewerApplication || leftWin?.PDFViewerApplication || null;
    }
    catch (_error) {
    }
    try {
      const rightWin = rightDoc?.defaultView;
      rightApp = rightWin?.wrappedJSObject?.PDFViewerApplication || rightWin?.PDFViewerApplication || null;
    }
    catch (_error) {
    }

    if (leftApp?.pdfViewer && rightApp?.pdfViewer) {
      try {
        const leftScale = leftApp.pdfViewer.currentScale;
        if (Number.isFinite(leftScale) && leftScale > 0) {
          rightApp.pdfViewer.currentScaleValue = leftApp.pdfViewer.currentScaleValue;
        }
      }
      catch (_error) {
      }

      const scheduleScaleUnlock = (side, sourceDoc) => {
        if (session.scaleSyncReleaseTimer) {
          clearTimeout(session.scaleSyncReleaseTimer);
          session.scaleSyncReleaseTimer = 0;
        }

        session.scaleSyncSource = side;
        const scopeWin = sourceDoc?.defaultView || globalThis;
        const setTimer = typeof scopeWin?.setTimeout === "function"
          ? scopeWin.setTimeout.bind(scopeWin)
          : setTimeout;
        session.scaleSyncReleaseTimer = setTimer(() => {
          if (session.scaleSyncSource === side) {
            session.scaleSyncSource = "";
          }
          session.scaleSyncReleaseTimer = 0;
        }, 120);
      };

      const pickScaleValue = (app, evt) => {
        const presetValue = evt?.presetValue;
        if (presetValue !== undefined && presetValue !== null && String(presetValue).trim()) {
          return presetValue;
        }

        const rawScale = Number(evt?.scale);
        if (Number.isFinite(rawScale) && rawScale > 0) {
          return rawScale;
        }

        return app?.pdfViewer?.currentScaleValue || app?.pdfViewer?.currentScale || "";
      };

      const syncScale = (side, sourceApp, targetApp, sourceDoc, evt) => {
        if (!isSessionAlive(session)) {
          return;
        }
        if (session.scaleSyncSource && session.scaleSyncSource !== side) {
          return;
        }

        const scaleValue = pickScaleValue(sourceApp, evt);
        if (!scaleValue) {
          return;
        }

        const targetViewer = targetApp?.pdfViewer;
        if (!targetViewer) {
          return;
        }

        const currentTargetScale = targetViewer.currentScaleValue;
        if (String(currentTargetScale) === String(scaleValue)) {
          return;
        }

        scheduleScaleUnlock(side, sourceDoc);

        if (typeof scaleValue === "number") {
          targetViewer.currentScale = scaleValue;
          return;
        }
        targetViewer.currentScaleValue = scaleValue;
      };

      const syncZoomFromLeft = (evt) => {
        try {
          syncScale("left", leftApp, rightApp, sourcePDFDoc, evt);
        }
        catch (_error) {
        }
      };

      const syncZoomFromRight = (evt) => {
        try {
          syncScale("right", rightApp, leftApp, rightDoc, evt);
        }
        catch (_error) {
        }
      };

      const leftEventBus = leftApp.eventBus || leftApp.pdfViewer?.eventBus;
      const rightEventBus = rightApp.eventBus || rightApp.pdfViewer?.eventBus;

      if (leftEventBus && typeof leftEventBus.on === "function") {
        leftEventBus.on("scalechanging", syncZoomFromLeft);
        leftEventBus.on("scalechange", syncZoomFromLeft);
        session._leftZoomListener = syncZoomFromLeft;
        session._leftEventBus = leftEventBus;
      }

      if (rightEventBus && typeof rightEventBus.on === "function") {
        rightEventBus.on("scalechanging", syncZoomFromRight);
        rightEventBus.on("scalechange", syncZoomFromRight);
        session._rightZoomListener = syncZoomFromRight;
        session._rightEventBus = rightEventBus;
      }
    }

    syncFromLeft();
    return true;
  }

  function detachSync(session) {
    try {
      if (session.leftScrollRoot && session.leftScrollListener) {
        session.leftScrollRoot.removeEventListener("scroll", session.leftScrollListener);
      }
    }
    catch (error) {
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] detachSync(left) failed: ${getSafeErrorText(error)}`);
      }
    }
    try {
      if (session.translatedScrollRoot && session.rightScrollListener) {
        session.translatedScrollRoot.removeEventListener("scroll", session.rightScrollListener);
      }
    }
    catch (error) {
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] detachSync(right) failed: ${getSafeErrorText(error)}`);
      }
    }

    try {
      if (session._leftEventBus && session._leftZoomListener && typeof session._leftEventBus.off === "function") {
        session._leftEventBus.off("scalechanging", session._leftZoomListener);
        session._leftEventBus.off("scalechange", session._leftZoomListener);
      }
    }
    catch (_error) {
    }

    try {
      if (session._rightEventBus && session._rightZoomListener && typeof session._rightEventBus.off === "function") {
        session._rightEventBus.off("scalechanging", session._rightZoomListener);
        session._rightEventBus.off("scalechange", session._rightZoomListener);
      }
    }
    catch (_error) {
    }

    try {
      if (session.leftScrollRAF && session.leftScrollRoot?.ownerDocument?.defaultView?.cancelAnimationFrame) {
        session.leftScrollRoot.ownerDocument.defaultView.cancelAnimationFrame(session.leftScrollRAF);
      }
    }
    catch (_error) {
    }

    try {
      if (session.rightScrollRAF && session.translatedScrollRoot?.ownerDocument?.defaultView?.cancelAnimationFrame) {
        session.translatedScrollRoot.ownerDocument.defaultView.cancelAnimationFrame(session.rightScrollRAF);
      }
    }
    catch (_error) {
    }

    if (session.scrollSyncReleaseTimer) {
      clearTimeout(session.scrollSyncReleaseTimer);
    }
    if (session.scaleSyncReleaseTimer) {
      clearTimeout(session.scaleSyncReleaseTimer);
    }

    session.leftScrollListener = null;
    session.rightScrollListener = null;
    session._leftZoomListener = null;
    session._rightZoomListener = null;
    session._leftEventBus = null;
    session._rightEventBus = null;
    session.scrollSyncSource = "";
    session.scaleSyncSource = "";
    session.scrollSyncReleaseTimer = 0;
    session.scaleSyncReleaseTimer = 0;
    session.leftScrollRAF = 0;
    session.rightScrollRAF = 0;
    session.suppressSyncUntil = 0;
    session.suppressScaleSyncUntil = 0;
    session.leftScrollRoot = null;
    session.translatedScrollRoot = null;
    session.translatedViewerContainer = null;
  }

  async function autoLoadTranslatedPDFIfNeeded(session) {
    if (session.translatedURLInput) {
      session.translatedURLInput.value = "";
    }

    const sourceAttachment = getAttachmentItemForSession(session);
    if (!sourceAttachment) {
      if (isRemoteAutoTranslateEnabled()) {
        await requestTranslatedPDFViaAPI(session);
        return;
      }
      updateSyncBadge(session, "Sync: idle");
      return;
    }

    const sourcePath = await getAttachmentFilePath(sourceAttachment);
    if (!sourcePath) {
      if (isRemoteAutoTranslateEnabled()) {
        await requestTranslatedPDFViaAPI(session);
        return;
      }
      updateSyncBadge(session, "Sync: idle");
      return;
    }

    const sourceDir = getParentDirectory(sourcePath);
    if (sourceDir) {
      const translatedPath = joinFilePath(sourceDir, "[fastRead 译文] PDF.pdf");

      setStatus(session, "正在检查本地已有译文...", "info");

      let exists = false;
      try {
        if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {
          exists = !!(await IOUtils.exists(translatedPath));
        }
      }
      catch (_error) {
      }

      if (exists) {
        const fileURI = toFileURI(translatedPath);
        if (fileURI) {
          setStatus(session, "检测到本地译文，正在加载...", "info");
          writePref(PREF_KEYS.translatedPdfURL, "");
          session.translatedAttachmentItem = null;
          session.translatedAttachmentPath = translatedPath;
          await loadTranslatedPDF(session, fileURI);
          return;
        }
      }
    }

    if (isRemoteAutoTranslateEnabled()) {
      await requestTranslatedPDFViaAPI(session);
      return;
    }

    updateSyncBadge(session, "Sync: idle");
  }

  function bindWindowToggle(session) {
    const readerWindow = session?.doc?.defaultView;
    if (!readerWindow) {
      return;
    }

    const toggleHandler = (enable) => {
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] Toggle command received: ${enable}`);
      }
      return toggleFastReadMode(session, enable);
    };
    readerWindow.toggleFastRead = toggleHandler;
    if (readerWindow.wrappedJSObject) {
      readerWindow.wrappedJSObject.toggleFastRead = toggleHandler;
    }
    session.windowToggleHandler = toggleHandler;

    if (readerWindow.sessionStorage?.getItem("zdr-fastread-enable") === "1") {
      readerWindow.sessionStorage.removeItem("zdr-fastread-enable");
      toggleFastReadMode(session, true).catch((error) => {
        Zotero.logError(error);
      });
    }
  }

  function disableFastReadMode(session) {
    clearHighlight(session);
    detachSync(session);
    revokeTranslatedBlobURL(session);
    session.translatedLoadToken = Number(session.translatedLoadToken || 0) + 1;
    try {
      session.translatedInternalReader?.destroy?.();
    }
    catch (_error) {
    }

    if (session.splitRoot && session.leftPane && session.splitRoot.parentElement) {
      const parent = session.splitRoot.parentElement;
      parent.insertBefore(session.leftPane, session.splitRoot);
      session.leftPane.classList.remove("zdr-left-pane");
      session.splitRoot.remove();
    }

    session.splitRoot = null;
    session.panel = null;
    session.statusNode = null;
    session.bodyNode = null;
    session.translatedLoadButton = null;
    session.translatedURLInput = null;
    session.translatedFrame = null;
    session.translatedPlaceholder = null;
    session.translatedURL = "";
    session.translatedBlobURL = "";
    session.translatedAttachmentItem = null;
    session.translatedAttachmentPath = "";
    session.translatedInternalReader = null;
    session.translatedReaderWindow = null;
    session.leftPDFDoc = null;
    session.remoteTaskID = null;
    session.remoteTaskPolling = false;
    session.sidebarWorkflowStarted = false;
    session.translatedOnce = false;
    session.fastReadEnabled = false;
  }

  async function initSplitView(session) {
    const layout = await ensureSplitLayoutWithRetry(session);
    if (!layout) {
      throw new Error("未能定位 PDF 阅读区域，请稍后重试。");
    }

    session.splitRoot = layout.splitRoot;
    session.leftPane = layout.leftPane;
    session.leftPDFDoc = layout.pdfDoc || session.doc;
    session.panel = layout.panel;
    session.statusNode = layout.panel.querySelector(`#${STATUS_ID}`);
    session.bodyNode = layout.panel.querySelector(`#${BODY_ID}`);
    session.fastReadEnabled = true;

    wirePanel(session);
    setStatus(session, "等待加载译文 PDF...", "info");
    try {
      await autoLoadTranslatedPDFIfNeeded(session);
    }
    catch (error) {
      setStatus(session, `自动加载失败: ${getSafeErrorText(error)}`, "error");
      Zotero.logError(error);
    }
  }

  async function toggleFastReadMode(session, enable) {
    if (!session || session.destroyed) {
      return;
    }

    const shouldEnable = typeof enable === "boolean"
      ? enable
      : !session.fastReadEnabled;

    if (!shouldEnable) {
      disableFastReadMode(session);
      return;
    }

    await initSplitView(session);
  }

  function toggleFastReadForWindow(enable = true, targetWindow = null, targetReader = null, targetDoc = null) {
    let reader = targetReader || null;
    let doc = targetDoc || targetWindow?.document || null;

    if (!reader && targetWindow && Array.isArray(Zotero.Reader?._readers)) {
      reader = Zotero.Reader._readers.find((candidate) => candidate?._iframeWindow === targetWindow) || null;
    }

    if (!reader || !doc) {
      return false;
    }

    ensureReader(reader, doc);
    const session = _sessionsByReader.get(reader);
    if (!session || session.destroyed) {
      return false;
    }

    toggleFastReadMode(session, enable).catch((error) => {
      Zotero.logError(error);
      showReaderAlert(`fastRead 启动失败: ${getSafeErrorText(error)}`);
    });
    return true;
  }

  function launchSplitView(reader, doc, options = {}) {
    if (!reader || !doc) {
      return false;
    }

    ensureReader(reader, doc);
    const session = _sessionsByReader.get(reader);
    if (!session || session.destroyed) {
      return false;
    }

    if (options?.autoTrigger) {
      session.sidebarWorkflowStarted = false;
    }

    toggleFastReadMode(session, true).catch((error) => {
      Zotero.logError(error);
      showReaderAlert(`fastRead 启动失败: ${getSafeErrorText(error)}`);
    });
    return true;
  }

  function readPref(prefKey) {
    const value = Zotero.Prefs.get(prefKey, true);
    return typeof value === "string" ? value.trim() : "";
  }

  function clearHighlight(_session) {
  }

  function setStatus(session, message, level) {
    if (!session.statusNode) {
      return;
    }
    session.statusNode.textContent = message;
    session.statusNode.classList.remove("is-error", "is-success");

    if (level === "error") {
      session.statusNode.classList.add("is-error");
    }
    else if (level === "success") {
      session.statusNode.classList.add("is-success");
    }

    if (level === "error") {
      setPlaceholderState(session, "error");
    }
    else if (level === "success") {
      setPlaceholderState(session, "ready");
    }
  }

  function setPlaceholderState(session, state) {
    const placeholder = session?.translatedPlaceholder;
    if (!placeholder) {
      return;
    }
    const titleNode = placeholder.querySelector(".zdr-wait-title");
    const subtitleNode = placeholder.querySelector(".zdr-wait-subtitle");
    placeholder.dataset.zdrState = state || "loading";
    placeholder.style.display = state === "ready" ? "none" : "flex";

    if (state === "error") {
      if (titleNode) {
        titleNode.textContent = "译文加载失败";
      }
      if (subtitleNode) {
        subtitleNode.textContent = "请检查服务状态，系统会在可恢复场景下自动重试。";
      }
      return;
    }

    if (titleNode) {
      titleNode.textContent = "等待译文加载";
    }
    if (subtitleNode) {
      subtitleNode.textContent = "正在连接本地翻译服务，完成后会自动显示译文 PDF。";
    }
  }

  function showReaderAlert(message) {
    try {
      const promptService = globalThis?.Services?.prompt;
      if (promptService && typeof promptService.alert === "function") {
        promptService.alert(null, "fastRead", String(message || ""));
      }
    }
    catch (_error) {
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getTextEncoder() {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder();
    }
    if (typeof window !== "undefined" && typeof window.TextEncoder !== "undefined") {
      return new window.TextEncoder();
    }
    throw new Error("TextEncoder is not available in this environment.");
  }

  Zotero.FastRead = {
    initSplitView: initSplitViewForReader,
    ensureReader,
    teardownAll,
    toggleFastReadForWindow,
    mountSidebarPanel,
    launchSplitView
  };

  Zotero.debug("[fastRead] Successfully attached API to Zotero.FastRead");
})();
