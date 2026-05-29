(function() {
  const FASTREAD_READER_SCRIPT_VERSION = "0.2.14-stable-anchor-cancel-20260529";
  const FASTREAD_DEBUG_PREFIX = `[fastRead][reader ${FASTREAD_READER_SCRIPT_VERSION}]`;

  function fastReadLog(message, level = "debug") {
    const text = `${FASTREAD_DEBUG_PREFIX} ${String(message || "")}`;
    try {
      if (typeof Zotero !== "undefined" && typeof Zotero.debug === "function") {
        Zotero.debug(text);
      }
    }
    catch (_error) {
    }

    try {
      const targetConsole = typeof console !== "undefined" ? console : null;
      const method = level === "error" ? "error" : level === "warn" ? "warn" : "debug";
      if (targetConsole && typeof targetConsole[method] === "function") {
        targetConsole[method](text);
      }
      else if (targetConsole && typeof targetConsole.log === "function") {
        targetConsole.log(text);
      }
    }
    catch (_error) {
    }
  }

  if (Zotero.FastRead) {
    fastReadLog(`existing Zotero.FastRead detected (version=${Zotero.FastRead.__fastReadScriptVersion || "unknown"}); replacing it.`);
    try {
      if (typeof Zotero.FastRead.teardownAll === "function") {
        Zotero.FastRead.teardownAll();
      }
    }
    catch (error) {
      fastReadLog(`teardown of existing API failed before reload: ${String(error?.message || error)}`, "warn");
    }
    try {
      delete Zotero.FastRead;
    }
    catch (_error) {
      Zotero.FastRead = null;
    }
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
  const TOGGLE_ORIGINAL_BUTTON_ID = "zdr-toggle-original-btn";
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
  const TRANSLATED_PDF_FILE_NAME = "[fastRead 译文].pdf";
  const LEGACY_TRANSLATED_PDF_FILE_NAMES = Object.freeze([
    "[fastRead 译文] PDF.pdf"
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
      originalHidden: false,
      translatedViewerContainer: null,
      translatedScrollRoot: null,
      leftScrollRoot: null,
      leftPDFDoc: null,
      scrollSyncSource: "",
      scrollSyncReleaseTimer: 0,
      leftScrollRAF: 0,
      rightScrollRAF: 0,
      syncPollInterval: 0,
      syncRetryTimer: 0,
      _syncPollWindow: null,
      _syncRetryWindow: null,
      _lastLeftScrollTop: 0,
      _lastLeftScrollLeft: 0,
      _lastRightScrollTop: 0,
      _lastRightScrollLeft: 0,
      suppressSyncUntil: 0,
      _leftSuppressUntil: 0,
      _rightSuppressUntil: 0,
      scaleSyncSource: "",
      scaleSyncReleaseTimer: 0,
      suppressScaleSyncUntil: 0,
      leftScrollListener: null,
      rightScrollListener: null,
      _leftZoomListener: null,
      _rightZoomListener: null,
      _leftEventBus: null,
      _rightEventBus: null,
      _leftViewListener: null,
      _rightViewListener: null,
      _leftViewEventBus: null,
      _rightViewEventBus: null,
      remoteTaskID: null,
      remoteTaskPolling: false,
      remoteTaskConfig: null,
      _translationCancelRequested: false,
      sidebarWorkflowStarted: false,
      translatedLoadRetryCount: 0,
      translatedLoadToken: 0,
      translatedFrameResetCount: 0,
      translationProgress: 0
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
      if (isCancellationLikeError(session, error)) {
        showReaderAlert("翻译服务已取消");
        return;
      }
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
    void cancelActiveTranslation(session, { forceBackend: true, notify: true });
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
        const frameDoc = frame.contentDocument || frame.contentWindow?.document || null;
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

  function getDocumentFromFrameLike(node) {
    try {
      const tag = String(node?.tagName || "").toLowerCase();
      if (tag !== "iframe" && tag !== "browser") {
        return null;
      }
      return node.contentDocument || node.contentWindow?.document || null;
    }
    catch (_error) {
      return null;
    }
  }

  function resolvePDFDocFromLeftPane(leftPane, hostDoc) {
    const frameDoc = getDocumentFromFrameLike(leftPane);
    if (frameDoc) {
      return frameDoc;
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
        <button id="${TOGGLE_ORIGINAL_BUTTON_ID}" class="zdr-original-toggle" type="button" title="隐藏原文">隐藏原文</button>
        <div id="${TRANSLATED_PLACEHOLDER_ID}" class="zdr-translated-placeholder">
          <div class="zdr-wait-card">
            <div class="zdr-wait-spinner" aria-hidden="true"></div>
            <h3 class="zdr-wait-title">等待译文加载</h3>
            <p class="zdr-wait-subtitle">正在连接本地翻译服务，完成后会自动显示译文 PDF。</p>
            <div class="zdr-single-progress" aria-live="polite">
              <p class="zdr-single-progress-label">准备中 0%</p>
              <div class="zdr-single-progress-track" aria-hidden="true">
                <div class="zdr-single-progress-bar"></div>
              </div>
            </div>
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
        <button id="${TOGGLE_ORIGINAL_BUTTON_ID}" class="zdr-original-toggle" type="button" title="隐藏原文">隐藏原文</button>
        <div id="${TRANSLATED_PLACEHOLDER_ID}" class="zdr-translated-placeholder">
          <div class="zdr-wait-card">
            <div class="zdr-wait-spinner" aria-hidden="true"></div>
            <h3 class="zdr-wait-title">等待译文加载</h3>
            <p class="zdr-wait-subtitle">正在连接本地翻译服务，完成后会自动显示译文 PDF。</p>
            <div class="zdr-single-progress" aria-live="polite">
              <p class="zdr-single-progress-label">准备中 0%</p>
              <div class="zdr-single-progress-track" aria-hidden="true">
                <div class="zdr-single-progress-bar"></div>
              </div>
            </div>
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
    session.leftPane = findViewerContainer(doc) || findEmbeddedViewerFrame(doc) || doc.scrollingElement || doc.documentElement || doc.body || null;
    session.leftPDFDoc = resolvePDFDocFromLeftPane(session.leftPane, doc);
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
        if (isCancellationLikeError(session, error)) {
          try {
            setStatus(session, "翻译服务已取消", "info");
          }
          catch (_innerError) {
          }
          return;
        }
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

      #${SPLIT_ROOT_ID}.zdr-original-hidden > .zdr-left-pane {
        display: none !important;
        flex: 0 0 0 !important;
        max-width: 0 !important;
        width: 0 !important;
      }

      #${SPLIT_ROOT_ID}.zdr-original-hidden > #${PANEL_ID} {
        flex: 1 1 100% !important;
        max-width: 100% !important;
        width: 100% !important;
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

      #${BODY_ID} .zdr-original-toggle {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 20;
        border: 1px solid color-mix(in srgb, var(--material-foreground) 14%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, var(--material-background) 92%, #ffffff 8%);
        color: var(--material-foreground);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        padding: 7px 10px;
      }

      #${BODY_ID} .zdr-original-toggle:hover {
        border-color: color-mix(in srgb, #2f6df6 45%, transparent);
        background: color-mix(in srgb, #2f6df6 10%, var(--material-background));
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

      #${BODY_ID} .zdr-single-progress {
        display: grid;
        gap: 6px;
      }

      #${BODY_ID} .zdr-single-progress-label {
        margin: 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        font-weight: 600;
        color: color-mix(in srgb, var(--material-foreground) 68%, transparent);
      }

      #${BODY_ID} .zdr-single-progress-track {
        height: 7px;
        border-radius: 999px;
        overflow: hidden;
        background: color-mix(in srgb, var(--material-foreground) 12%, transparent);
      }

      #${BODY_ID} .zdr-single-progress-bar {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #2f6df6 0%, #46a0ff 100%);
        transition: width 200ms ease;
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

      #viewerContainer,
      #viewer,
      .pdfViewer,
      .pdfViewer .page,
      .textLayer,
      .textLayer span {
        pointer-events: auto !important;
        user-select: text !important;
        -moz-user-select: text !important;
        cursor: text;
      }
    `;
    }
    catch (_error) {
    }
  }

  function applyOriginalVisibility(session) {
    const hidden = !!session?.originalHidden;
    try {
      session?.splitRoot?.classList?.toggle("zdr-original-hidden", hidden);
    }
    catch (_error) {
    }

    try {
      if (session?.leftPane?.style) {
        session.leftPane.style.display = hidden ? "none" : "";
      }
      if (session?.panel?.style && session?.splitRoot) {
        session.panel.style.flexBasis = hidden ? "100%" : "";
        session.panel.style.maxWidth = hidden ? "100%" : "";
        session.panel.style.width = hidden ? "100%" : "";
      }
    }
    catch (_error) {
    }

    const button = session?.panel?.querySelector?.(`#${TOGGLE_ORIGINAL_BUTTON_ID}`);
    if (button) {
      button.textContent = hidden ? "显示原文" : "隐藏原文";
      button.setAttribute("title", hidden ? "显示原文" : "隐藏原文");
      button.setAttribute("aria-pressed", hidden ? "true" : "false");
    }
  }

  function wirePanel(session) {
    if (!session.panel) {
      return;
    }

    const loadButton = session.panel.querySelector(`#${TRANSLATED_LOAD_BUTTON_ID}`);
    const urlInput = session.panel.querySelector(`#${TRANSLATED_URL_INPUT_ID}`);
    const toggleOriginalButton = session.panel.querySelector(`#${TOGGLE_ORIGINAL_BUTTON_ID}`);
    const frame = session.panel.querySelector(`#${TRANSLATED_FRAME_ID}`);
    const placeholder = session.panel.querySelector(`#${TRANSLATED_PLACEHOLDER_ID}`);

    session.translatedLoadButton = loadButton;
    session.translatedURLInput = urlInput;
    session.translatedFrame = frame;
    session.translatedPlaceholder = placeholder;
    setPlaceholderState(session, "loading");
    applyOriginalVisibility(session);

    if (toggleOriginalButton && !toggleOriginalButton.dataset.zdrBound) {
      toggleOriginalButton.dataset.zdrBound = "1";
      toggleOriginalButton.addEventListener("click", () => {
        session.originalHidden = !session.originalHidden;
        applyOriginalVisibility(session);
        if (session.fastReadEnabled && session.translatedFrame?.classList?.contains("is-ready")) {
          detachSync(session);
          if (!session.originalHidden) {
            try {
              setupSync(session);
            }
            catch (error) {
              Zotero.logError(`[fastRead] setupSync after original toggle failed: ${getSafeErrorText(error)}`);
              updateSyncBadge(session, "Sync: error");
            }
          }
        }
      });
    }

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
          if (session._translationCancelRequested || session.destroyed) {
            setStatus(session, "翻译服务已取消", "info");
            return;
          }
          if (isDeadObjectError(error)) {
            showReaderAlert("翻译服务已取消");
            return;
          }
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
    return value === "ratio" ? "ratio" : "page";
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

  function resetTranslatedFrame(session) {
    const oldFrame = session?.translatedFrame;
    const doc = oldFrame?.ownerDocument || session?.doc || null;
    if (!oldFrame || !doc || !oldFrame.parentElement) {
      return false;
    }

    try {
      oldFrame.removeAttribute("src");
      oldFrame.src = "about:blank";
    }
    catch (_error) {
    }

    const nextFrame = doc.createElement("iframe");
    nextFrame.id = TRANSLATED_FRAME_ID;
    nextFrame.className = "zdr-translated-frame";
    nextFrame.setAttribute("title", "Translated PDF");
    nextFrame.setAttribute("loading", "eager");
    oldFrame.parentElement.replaceChild(nextFrame, oldFrame);

    try {
      session.translatedInternalReader?.destroy?.();
    }
    catch (_error) {
    }
    session.translatedInternalReader = null;
    session.translatedReaderWindow = null;
    session.translatedFrame = nextFrame;
    session.translatedFrameResetCount = Number(session.translatedFrameResetCount || 0) + 1;
    fastReadLog(`translated iframe reset; resetCount=${session.translatedFrameResetCount}`);
    return true;
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
    fastReadLog(`loading translated iframe source: ${sourceURL}, timeout=${timeoutMs}`);
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
        fastReadLog(`translated iframe load event received: ${sourceURL}`);
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
        fastReadLog(`translated iframe error event: ${sourceURL}`, "error");
        reject(new Error(`Network or viewer load error (${sourceURL})`));
      };

      frame.addEventListener("load", onLoad, { once: true });
      frame.addEventListener("error", onError, { once: true });
      frame.src = sourceURL;
    });
  }

  async function waitForTranslatedCreateReader(frame, timeoutMs = 10000, intervalMs = 100) {
    const startedAt = Date.now();
    let lastLoggedAt = 0;
    while (Date.now() - startedAt <= timeoutMs) {
      if (!frame || !frame.contentWindow || frame.isConnected === false) {
        throw new Error("Translated frame unavailable while waiting for createReader");
      }

      const iframeWindow = frame.contentWindow;
      const wrappedWindow = iframeWindow.wrappedJSObject || iframeWindow;
      if (typeof wrappedWindow?.createReader === "function") {
        fastReadLog(`createReader became available after ${Date.now() - startedAt}ms`);
        return iframeWindow;
      }

      if (Date.now() - lastLoggedAt > 1000) {
        lastLoggedAt = Date.now();
        fastReadLog(`waiting for createReader... elapsed=${Date.now() - startedAt}ms`);
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

  function enablePDFTextSelection(target) {
    let win = null;
    let doc = null;
    try {
      win = target?.defaultView
        ? target.defaultView
        : target?.contentWindow
          || target?._iframeWindow
          || target
          || null;
      const wrappedWin = win?.wrappedJSObject || win;
      doc = wrappedWin?.document || target?.ownerDocument || null;
      if (doc) {
        injectViewerChromeStyle(doc);
      }

      const app = wrappedWin?.PDFViewerApplication || null;
      const cursorTools = app?.pdfCursorTools || app?.pdfViewer?.pdfCursorTools || null;
      if (cursorTools && typeof cursorTools.switchTool === "function") {
        cursorTools.switchTool(0);
      }
      if (app?.eventBus && typeof app.eventBus.dispatch === "function") {
        app.eventBus.dispatch("switchcursortool", {
          source: app,
          tool: 0
        });
      }
    }
    catch (error) {
      fastReadLog(`enablePDFTextSelection failed: ${getSafeErrorText(error)}`, "warn");
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

    if (typeof Zotero?.debug === "function") {
      Zotero.debug(`[fastRead] loadPdfDataIntoIframe: target=${targetURL}, timeout=${timeoutMs}`);
    }
    fastReadLog(`loadPdfDataIntoIframe begin: target=${targetURL}, timeout=${timeoutMs}, token=${loadToken}`);

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
      fastReadLog(`using local PDF data injection: path=${localFilePath}`);
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
      await loadTranslatedFrameSource(frame, directViewerURL, Math.min(timeoutMs, 12000));
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
      fastReadLog(`PDF data injected successfully: bytes=${uint8Array.byteLength}`);

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
        enablePDFTextSelection(viewerDoc);
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
      fastReadLog(`using internal reader route: readerURL=${readerURL}, translatedItem=${!!translatedItem}`);

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

      await loadTranslatedFrameSource(frame, INTERNAL_READER_FRAME_URL, Math.min(timeoutMs, 12000));
      if (!isSessionAlive(session) || Number(session.translatedLoadToken || 0) !== Number(loadToken)) {
        throw new Error("stale-load-aborted-before-create-reader");
      }

      const iframeWindow = await waitForTranslatedCreateReader(frame, timeoutMs, intervalMs);
      if (typeof Zotero?.debug === "function") {
        Zotero.debug("[fastRead] translated internal reader frame created");
      }
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
      enablePDFTextSelection(internalReader?._primaryView?._iframeWindow || iframeWindow);
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

  async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
    const requestOptions = { ...(options || {}) };
    const normalizedTimeout = Math.max(500, Number(timeoutMs) || 2500);
    if (typeof AbortController !== "function") {
      return fetch(url, requestOptions);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), normalizedTimeout);
    try {
      return await fetch(url, {
        ...requestOptions,
        signal: requestOptions.signal || controller.signal
      });
    }
    finally {
      clearTimeout(timer);
    }
  }

  async function stopLocalBackendFromReader() {
    const bridgeName = "ZoteroFastReadStopLocalBackend";
    const candidates = [];
    try {
      candidates.push(globalThis, globalThis?.wrappedJSObject);
    }
    catch (_error) {
    }
    try {
      const mainWin = Zotero.getMainWindow?.() || null;
      candidates.push(mainWin, mainWin?.wrappedJSObject);
    }
    catch (_error) {
    }

    for (const candidate of candidates) {
      try {
        const stopBridge = candidate?.[bridgeName];
        if (typeof stopBridge === "function") {
          await stopBridge();
          return true;
        }
      }
      catch (error) {
        fastReadLog(`stop backend bridge failed: ${getSafeErrorText(error)}`, "warn");
      }
    }

    let requested = false;
    for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
      const base = trimTrailingSlash(candidate);
      if (!base) {
        continue;
      }
      try {
        await fetchWithTimeout(`${base}/shutdown`, { method: "POST", cache: "no-store" }, 1200);
        requested = true;
      }
      catch (_error) {
      }
    }
    return requested;
  }

  async function cancelActiveTranslation(session, options = {}) {
    if (!session || session._translationCancelRequested) {
      return false;
    }

    const taskID = String(session.remoteTaskID || "").trim();
    const active = !!taskID || !!session.remoteTaskPolling;
    if (!active) {
      return false;
    }

    session._translationCancelRequested = true;
    session.remoteTaskPolling = false;
    try {
      setStatus(session, "翻译服务已取消", "info");
      setTranslationProgress(session, session.translationProgress || 0, "翻译服务已取消", false);
    }
    catch (_error) {
    }
    if (options.notify) {
      showReaderAlert("翻译服务已取消");
    }

    const config = session.remoteTaskConfig || getRemoteTaskConfig();
    let taskCancelled = false;
    if (taskID) {
      const detailURL = buildRemoteTaskDetailURL(config, taskID);
      if (detailURL) {
        try {
          const response = await fetchWithTimeout(detailURL, {
            method: "DELETE",
            headers: buildRemoteHeaders(config),
            credentials: "include"
          }, 2500);
          taskCancelled = response.ok;
        }
        catch (error) {
          fastReadLog(`cancel task ${taskID} failed: ${getSafeErrorText(error)}`, "warn");
        }
      }
    }

    if (options.forceBackend || !taskCancelled) {
      await stopLocalBackendFromReader();
    }

    session.remoteTaskID = null;
    session.remoteTaskConfig = null;
    return true;
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
    const reader = session?.reader || null;

    const getAttachmentByID = (itemID) => {
      const normalizedID = Number(itemID || 0);
      if (!Number.isFinite(normalizedID) || normalizedID <= 0 || !Zotero?.Items?.get) {
        return null;
      }
      const item = Zotero.Items.get(normalizedID);
      if (item && typeof item.isAttachment === "function" && item.isAttachment()) {
        return item;
      }
      return null;
    };

    const directCandidates = [
      reader?._fastReadLaunchAttachment,
      reader?._attachmentItem,
      reader?.attachmentItem,
      reader?.item,
      reader?._item
    ];
    for (const direct of directCandidates) {
      if (direct && typeof direct.isAttachment === "function" && direct.isAttachment()) {
        return direct;
      }
    }

    const idCandidates = [
      reader?._fastReadLaunchItemID,
      reader?._itemID,
      reader?.itemID,
      reader?._state?.itemID,
      reader?._state?.attachmentID,
      reader?._state?.primaryViewState?.itemID
    ];
    for (const fallbackID of idCandidates) {
      const item = getAttachmentByID(fallbackID);
      if (item) {
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
      if (Zotero?.File?.pathToFile) {
        const nsFile = Zotero.File.pathToFile(target);
        return !!nsFile?.exists?.();
      }
    }
    catch (_error) {
    }

    try {
      if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {
        return !!(await IOUtils.exists(target));
      }
    }
    catch (_error) {
    }

    return false;
  }

  async function promiseWithTimeout(promise, timeoutMs, fallbackValue) {
    let timer = 0;
    try {
      return await Promise.race([
        promise,
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(fallbackValue), Math.max(250, Number(timeoutMs) || 1000));
        })
      ]);
    }
    finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  function getTranslatedPdfPathCandidates(sourceDir, sourcePath = "") {
    const base = String(sourceDir || "").trim();
    if (!base) {
      return [];
    }

    const fileNames = [
      TRANSLATED_PDF_FILE_NAME,
      ...LEGACY_TRANSLATED_PDF_FILE_NAMES
    ];

    const sourceFileName = basenameFromPath(sourcePath);
    if (sourceFileName && sourceFileName !== "document.pdf") {
      fileNames.push(`[fastRead 译文] ${sourceFileName}`);
    }

    const candidates = fileNames
      .map((fileName) => joinFilePath(base, fileName))
      .filter(Boolean);

    return Array.from(new Set(candidates));
  }

  async function findExistingTranslatedPdfPath(sourceDir, sourcePath = "") {
    const candidates = getTranslatedPdfPathCandidates(sourceDir, sourcePath);
    if (typeof Zotero?.debug === "function") {
      Zotero.debug(`[fastRead] translated PDF candidates: ${candidates.join(" | ")}`);
    }
    fastReadLog(`checking existing translated PDF candidates: count=${candidates.length}, sourceDir=${sourceDir}`);
    for (const candidate of candidates) {
      fastReadLog(`checking translated PDF candidate: ${candidate}`);
      const exists = await promiseWithTimeout(fileExists(candidate), 1200, false);
      if (exists) {
        if (typeof Zotero?.debug === "function") {
          Zotero.debug(`[fastRead] found translated PDF: ${candidate}`);
        }
        fastReadLog(`found existing translated PDF: ${candidate}`);
        return candidate;
      }
    }
    if (typeof Zotero?.debug === "function") {
      Zotero.debug("[fastRead] no existing translated PDF found in source directory.");
    }
    fastReadLog("no existing translated PDF found beside source PDF");
    return "";
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

  async function getSourcePDFPathForSession(session) {
    const attachment = getAttachmentItemForSession(session);
    const attachmentPath = await getAttachmentFilePath(attachment);
    fastReadLog(`resolved source PDF path: attachmentID=${attachment?.id || attachment?.itemID || ""}, hasPath=${!!attachmentPath}, path=${attachmentPath || "(empty)"}`);
    return String(attachmentPath || "").trim();
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
    const sourcePath = await getSourcePDFPathForSession(session);
    if (!sourcePath) {
      throw new Error("无法获取原文 PDF 路径。");
    }
    const sourceDir = getParentDirectory(sourcePath);
    if (!sourceDir) {
      throw new Error("无法获取原文 PDF 所在目录。");
    }

    setStatus(session, "正在从本地服务拉取译文...", "info");
    setTranslationProgress(session, 92, "正在下载译文", true);
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

    const translatedFileName = TRANSLATED_PDF_FILE_NAME;
    const translatedFilePath = joinFilePath(sourceDir, translatedFileName);

    setStatus(session, "正在保存译文到原文目录...", "info");
    setTranslationProgress(session, 96, "正在保存译文", true);
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

  function extractTaskStage(payload) {
    const task = extractTaskPayload(payload) || payload || {};
    return String(task?.stage || task?.stageLabel || task?.message || "").trim();
  }

  function extractTaskError(payload) {
    const task = extractTaskPayload(payload) || payload || {};
    const err = task?.error || task?.message || payload?.message || "";
    return String(err || "").trim();
  }

  async function requestTranslatedPDFViaAPI(session) {
    session._translationCancelRequested = false;
    try {
      const sourcePath = await getSourcePDFPathForSession(session);
      if (sourcePath) {
        const sourceDir = getParentDirectory(sourcePath);
        if (sourceDir) {
          const translatedPath = await findExistingTranslatedPdfPath(sourceDir, sourcePath);
          if (translatedPath) {
            const fileURI = toFileURI(translatedPath);
            if (fileURI) {
              setStatus(session, "检测到本地译文，跳过翻译...", "info");
              setTranslationProgress(session, 100, "检测到本地译文", true);
              session.translatedAttachmentItem = null;
              session.translatedAttachmentPath = translatedPath;
              await loadTranslatedPDF(session, fileURI);
              return;
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
    session.remoteTaskConfig = { ...config };

    const createURL = buildRemoteCreateTaskURL(config);
    if (!createURL) {
      throw new Error("任务 API URL 无效。");
    }

    const selectedPort = extractPortFromURL(createURL) || "(unknown)";
    if (session?.statusNode) {
      setStatus(session, `已选择任务服务端口 ${selectedPort}，准备提交任务...`, "info");
    }
    setTranslationProgress(session, 3, "准备提交任务", true);
    debugRemoteEndpoint(session, "任务提交", createURL);

    setStatus(session, "正在读取本地 PDF，并提交翻译任务...", "info");
    setTranslationProgress(session, 6, "正在读取 PDF", true);

    const file = await readAttachmentPDFBinary(session);
    setTranslationProgress(session, 10, "正在创建翻译任务", true);
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
      session.remoteTaskConfig = { ...config };
      const initialStage = extractTaskStage(createPayload) || `任务已创建 (#${taskID})，正在等待译文 PDF`;
      const initialProgress = Math.max(0, Math.min(100, Math.round(extractTaskProgress(createPayload))));
      setStatus(session, `${initialStage} (${initialProgress}%)`, "info");
      setTranslationProgress(session, Math.max(10, initialProgress), initialStage, true);

      const startedAt = Date.now();
      let detailEndpointLogged = false;
      while (Date.now() - startedAt < config.pollTimeoutMs) {
        if (session._translationCancelRequested || session.destroyed) {
          return;
        }
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
          setTranslationProgress(session, 98, "正在加载译文", true);
          await loadTranslatedPDF(session, trustedLocalURL);
          session.remoteTaskID = null;
          session.remoteTaskConfig = null;
          return;
        }

        const status = extractTaskStatus(detailPayload);
        const progress = extractTaskProgress(detailPayload);
        const stage = extractTaskStage(detailPayload);
        if (["failed", "error", "cancelled", "canceled"].includes(status)) {
          const message = extractTaskError(detailPayload) || `状态: ${status}`;
          throw new Error(`远程翻译任务失败: ${message}`);
        }

        const pct = Math.max(0, Math.min(100, Math.round(progress)));
        setStatus(session, `${stage || `任务 #${taskID} 状态: ${status || "running"}`} (${pct}%)`, "info");
        setTranslationProgress(session, Math.max(10, Math.min(91, pct)), stage || "正在翻译", true);
        await delay(config.pollIntervalMs);
        if (session._translationCancelRequested || session.destroyed) {
          return;
        }
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
    setTranslationProgress(session, Math.max(1, session.translationProgress || 0), "正在加载译文 PDF", true);

    if (typeof Zotero?.debug === "function") {
      Zotero.debug(`[fastRead] translated URL requested: ${url}; loading by raw data injection`);
      Zotero.debug(`[fastRead] loadTranslatedPDF: token=${loadToken}, existingFrame=${!!session.translatedFrame}`);
    }
    fastReadLog(`loadTranslatedPDF start: token=${loadToken}, url=${url}, frameConnected=${session.translatedFrame?.isConnected !== false}`);

    let loadError = null;
    const isLocalTranslatedSource = /^file:\/\//i.test(url)
      || /^[A-Za-z]:[\\/]/.test(url)
      || url.startsWith("/");
    const loadTimeouts = isLocalTranslatedSource
      ? [15000, 15000, 15000]
      : [15000, 15000];
    for (let attempt = 0; attempt < loadTimeouts.length; attempt += 1) {
      try {
        fastReadLog(`translated PDF load attempt ${attempt + 1}/${loadTimeouts.length}: timeout=${loadTimeouts[attempt]}, local=${isLocalTranslatedSource}`);
        if (attempt > 0) {
          setStatus(session, `译文阅读器首次初始化未完成，正在快速重试（${attempt + 1}/${loadTimeouts.length}）...`, "info");
          setTranslationProgress(session, Math.max(1, session.translationProgress || 0), "正在重试加载译文", true);
          if (isLocalTranslatedSource) {
            resetTranslatedFrame(session);
          }
          await delay(700 + attempt * 300);
        }

        await loadPdfDataIntoIframe(session, url, loadToken, loadTimeouts[attempt], 100);

        if (!isSessionAlive(session)) {
          throw new Error("Reader session disposed while loading translated PDF");
        }
        loadError = null;
        break;
      }
      catch (primaryError) {
        if (String(primaryError?.message || "").startsWith("stale-load-aborted")) {
          return;
        }
        loadError = primaryError;
        if (typeof Zotero?.debug === "function") {
          Zotero.debug(`[fastRead] translated PDF load attempt ${attempt + 1} failed: ${getSafeErrorText(primaryError)}`);
        }
        fastReadLog(`translated PDF load attempt ${attempt + 1} failed: ${getSafeErrorText(primaryError)}`, "warn");
      }
    }

    if (loadError) {
      const urlProbe = await probeTranslatedURLStatus(url);
      const probeText = urlProbe.error
        ? `HEAD failed: ${urlProbe.error}`
        : `HEAD ${urlProbe.status} ${urlProbe.statusText}; content-type=${urlProbe.contentType || "<none>"}; content-disposition=${urlProbe.contentDisposition || "<none>"}`;
      Zotero.logError(`[fastRead] translated PDF load failed: ${url}; reason: ${loadError.message}; probe: ${probeText}`);
      fastReadLog(`translated PDF load failed after retries: reason=${getSafeErrorText(loadError)}, probe=${probeText}`, "error");

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
    setTranslationProgress(session, 100, "译文已加载", false);
    session.translatedLoadRetryCount = 0;
    fastReadLog(`translated PDF load completed: token=${loadToken}, url=${url}`);

    let syncReady = false;
    try {
      syncReady = setupSync(session);
    }
    catch (error) {
      syncReady = false;
      Zotero.logError(`[fastRead] setupSync after translated load failed: ${getSafeErrorText(error)}`);
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] setupSync after load failed but translated PDF remains visible: ${getSafeErrorText(error)}`);
      }
      fastReadLog(`setupSync failed after translated load; right PDF kept visible: ${getSafeErrorText(error)}`, "warn");
    }
    if (syncReady) {
      setStatus(session, "译文 PDF 已加载，双向同步已开启。", "success");
      updateSyncBadge(session, `Sync: ${getSyncMode()}`);
    }
    else {
      setStatus(session, "译文 PDF 已加载。当前页面跨域，仅支持原文->译文单向同步。", "info");
      scheduleSyncRetry(session);
      updateSyncBadge(session, "Sync: limited");
    }
  }

  function scheduleSyncRetry(session, delayMs = 450, attempt = 1) {
    if (!isSessionAlive(session) || attempt > 10) {
      return;
    }

    if (session.syncRetryTimer) {
      try {
        const clearTimer = typeof session._syncRetryWindow?.clearTimeout === "function"
          ? session._syncRetryWindow.clearTimeout.bind(session._syncRetryWindow)
          : clearTimeout;
        clearTimer(session.syncRetryTimer);
      }
      catch (_error) {
      }
      session.syncRetryTimer = 0;
    }

    const scopeWin = session.doc?.defaultView || globalThis;
    session._syncRetryWindow = scopeWin;
    const setTimer = typeof scopeWin?.setTimeout === "function"
      ? scopeWin.setTimeout.bind(scopeWin)
      : setTimeout;

    session.syncRetryTimer = setTimer(() => {
      session.syncRetryTimer = 0;
      if (!isSessionAlive(session)) {
        return;
      }
      let ready = false;
      try {
        ready = setupSync(session);
      }
      catch (error) {
        ready = false;
        Zotero.logError(`[fastRead] scheduled setupSync retry failed: ${getSafeErrorText(error)}`);
      }
      if (ready) {
        updateSyncBadge(session, `Sync: ${getSyncMode()}`);
        return;
      }
      scheduleSyncRetry(session, Math.min(delayMs + 350, 2500), attempt + 1);
    }, delayMs);
  }

  function getScrollableRoot(doc, fallbackElement) {
    try {
      if (!doc) {
        return fallbackElement || null;
      }

      const app = getPDFAppFromDoc(doc);
      const appContainer = app?.pdfViewer?.container || app?.appConfig?.mainContainer || null;
      if (appContainer) {
        return appContainer;
      }

      const viewerContainer = doc.getElementById("viewerContainer")
        || doc.querySelector(".pdfViewerContainer")
        || doc.querySelector(".viewerContainer");
      if (viewerContainer) {
        return viewerContainer;
      }

      if (fallbackElement && isUsefulScrollRoot(fallbackElement)) {
        return fallbackElement;
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
      const readerDoc = session?.translatedReaderWindow?.document || null;
      if (readerDoc) {
        return readerDoc;
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

  function hasPDFPages(doc) {
    try {
      return !!doc?.querySelector?.(".page[data-page-number], .page[id^='pageContainer'], #viewer .page, .pdfViewer .page");
    }
    catch (_error) {
      return false;
    }
  }

  function isUsefulScrollRoot(root) {
    if (!root) {
      return false;
    }
    try {
      return (Number(root.scrollHeight || 0) - Number(root.clientHeight || 0) > 2)
        || (Number(root.scrollWidth || 0) - Number(root.clientWidth || 0) > 2);
    }
    catch (_error) {
      return false;
    }
  }

  function resolvePDFSurface(doc, fallbackElement = null) {
    if (typeof Zotero?.debug === "function") {
      Zotero.debug("[fastRead] resolvePDFSurface: probing PDF surface");
    }
    const candidates = [];
    const pushDoc = (candidateDoc) => {
      try {
        if (!candidateDoc || candidates.some((entry) => entry.doc === candidateDoc)) {
          return;
        }
        candidates.push({ doc: candidateDoc });
      }
      catch (error) {
        if (typeof Zotero?.debug === "function") {
          Zotero.debug(`[fastRead] resolvePDFSurface: skipped stale candidate (${getSafeErrorText(error)})`);
        }
      }
    };

    pushDoc(doc);
    pushDoc(getDocumentFromFrameLike(fallbackElement));

    try {
      const frames = Array.from(doc?.querySelectorAll?.("iframe, browser") || []);
      for (const frame of frames) {
        pushDoc(getDocumentFromFrameLike(frame));
      }
    }
    catch (_error) {
    }

    let fallback = null;
    for (const candidate of candidates) {
      try {
        const candidateDoc = candidate.doc;
        const app = getPDFAppFromDoc(candidateDoc);
        const appRoot = app?.pdfViewer?.container || app?.appConfig?.mainContainer || null;
        const directRoot = appRoot || getScrollableRoot(candidateDoc, null);
        const candidateRoot = directRoot || candidateDoc?.scrollingElement || candidateDoc?.documentElement || candidateDoc?.body || null;
        if (!candidateRoot) {
          continue;
        }

        const surface = {
          doc: candidateDoc,
          root: candidateRoot,
          app
        };
        if (!fallback) {
          fallback = surface;
        }
        const rootClassName = String(candidateRoot.className || "");
        const looksLikePDFRoot = candidateRoot.id === "viewerContainer"
          || rootClassName.includes("pdfViewerContainer")
          || rootClassName.includes("viewerContainer")
          || !!candidateDoc?.getElementById?.("viewer")
          || !!candidateDoc?.querySelector?.(".pdfViewer");
        if (app?.pdfViewer || hasPDFPages(candidateDoc) || looksLikePDFRoot) {
          if (typeof Zotero?.debug === "function") {
            Zotero.debug(`[fastRead] resolvePDFSurface: selected root=${candidateRoot.id || candidateRoot.className || candidateRoot.tagName}`);
          }
          return surface;
        }
      }
      catch (error) {
        if (typeof Zotero?.debug === "function") {
          Zotero.debug(`[fastRead] resolvePDFSurface: candidate failed (${getSafeErrorText(error)})`);
        }
      }
    }

    let fallbackRoot = null;
    try {
      fallbackRoot = fallbackElement && isUsefulScrollRoot(fallbackElement)
        ? fallbackElement
        : null;
    }
    catch (error) {
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] resolvePDFSurface: fallback element failed (${getSafeErrorText(error)})`);
      }
    }
    if (fallbackRoot) {
      try {
        return {
          doc: fallbackRoot.ownerDocument || doc,
          root: fallbackRoot,
          app: getPDFAppFromDoc(fallbackRoot.ownerDocument || doc)
        };
      }
      catch (error) {
        if (typeof Zotero?.debug === "function") {
          Zotero.debug(`[fastRead] resolvePDFSurface: fallback root failed (${getSafeErrorText(error)})`);
        }
      }
    }

    return fallback;
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

  function getHorizontalScrollRatio(scrollRoot) {
    if (!scrollRoot) {
      return 0;
    }
    const max = Math.max(0, scrollRoot.scrollWidth - scrollRoot.clientWidth);
    if (!max) {
      return 0;
    }
    return scrollRoot.scrollLeft / max;
  }

  function applyScrollRatio(scrollRoot, ratio) {
    if (!scrollRoot) {
      return;
    }
    const max = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    const nextTop = Math.max(0, Math.min(max, ratio * max));
    if (Math.abs(Number(scrollRoot.scrollTop || 0) - nextTop) > 0.5) {
      scrollRoot.scrollTop = nextTop;
    }
  }

  function applyHorizontalScrollRatio(scrollRoot, ratio) {
    if (!scrollRoot) {
      return;
    }
    const max = Math.max(0, scrollRoot.scrollWidth - scrollRoot.clientWidth);
    const nextLeft = Math.max(0, Math.min(max, Number(ratio || 0) * max));
    if (Math.abs(Number(scrollRoot.scrollLeft || 0) - nextLeft) > 1.5) {
      scrollRoot.scrollLeft = nextLeft;
    }
  }

  function getPDFAppFromDoc(doc) {
    try {
      const view = doc?.defaultView;
      return view?.wrappedJSObject?.PDFViewerApplication
        || view?.PDFViewerApplication
        || null;
    }
    catch (_error) {
      return null;
    }
  }

  function getCurrentPageNumberFromDoc(doc) {
    try {
      const app = getPDFAppFromDoc(doc);
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
    const normalized = Number(pageNumber);
    if (!doc || !Number.isFinite(normalized) || normalized <= 0) {
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
      viewer.currentPageNumber = normalized;
      return true;
    }
    catch (_error) {
      return false;
    }
  }

  function getAppScaleValue(app) {
    try {
      const value = app?.pdfViewer?.currentScaleValue || app?.pdfViewer?.currentScale || "";
      return value === "auto" || value === "page-width" || value === "page-fit" || value === "page-actual"
        ? value
        : Number(value) || value || "";
    }
    catch (_error) {
      return "";
    }
  }

  function clampRatio(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.max(0, Math.min(1, number));
  }

  function getScrollViewportRect(doc, scrollRoot) {
    try {
      if (!scrollRoot) {
        const view = doc?.defaultView || null;
        return {
          top: 0,
          left: 0,
          right: Number(view?.innerWidth || 0),
          bottom: Number(view?.innerHeight || 0),
          width: Number(view?.innerWidth || 0),
          height: Number(view?.innerHeight || 0)
        };
      }

      if (
        scrollRoot === doc?.scrollingElement
        || scrollRoot === doc?.documentElement
        || scrollRoot === doc?.body
      ) {
        const view = doc?.defaultView || null;
        const width = Number(view?.innerWidth || scrollRoot.clientWidth || 0);
        const height = Number(view?.innerHeight || scrollRoot.clientHeight || 0);
        return {
          top: 0,
          left: 0,
          right: width,
          bottom: height,
          width,
          height
        };
      }

      return scrollRoot.getBoundingClientRect();
    }
    catch (_error) {
      return null;
    }
  }

  function getPDFPageElements(doc) {
    try {
      return Array.from(doc?.querySelectorAll?.(".page[data-page-number], .page[id^='pageContainer']") || []);
    }
    catch (_error) {
      return [];
    }
  }

  function getPageNumberFromElement(pageElement) {
    const raw = pageElement?.getAttribute?.("data-page-number")
      || String(pageElement?.id || "").replace(/^pageContainer/, "");
    const pageNumber = Number(raw);
    return Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 0;
  }

  function getPDFPageElement(doc, pageNumber) {
    const normalized = Number(pageNumber);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    try {
      const direct = doc?.querySelector?.(`.page[data-page-number="${normalized}"], #pageContainer${normalized}`);
      if (direct) {
        return direct;
      }
    }
    catch (_error) {
    }

    try {
      const app = getPDFAppFromDoc(doc);
      const view = app?.pdfViewer?.getPageView?.(normalized - 1);
      return view?.div || null;
    }
    catch (_error) {
      return null;
    }
  }

  function getVisiblePagePosition(doc, scrollRoot) {
    const root = scrollRoot || getScrollableRoot(doc, null);
    if (!doc || !root) {
      return null;
    }

    const rootRect = getScrollViewportRect(doc, root);
    if (!rootRect || !rootRect.height || !rootRect.width) {
      return null;
    }

    const anchorViewportRatio = 0.18;
    const anchorY = rootRect.top + Math.max(1, rootRect.height * anchorViewportRatio);
    let best = null;
    let bestByArea = null;
    let nearest = null;
    for (const pageElement of getPDFPageElements(doc)) {
      const pageNumber = getPageNumberFromElement(pageElement);
      if (!pageNumber) {
        continue;
      }

      const pageRect = pageElement.getBoundingClientRect();
      if (!pageRect.width || !pageRect.height) {
        continue;
      }

      const distanceToAnchor = anchorY < pageRect.top
        ? pageRect.top - anchorY
        : anchorY > pageRect.bottom
          ? anchorY - pageRect.bottom
          : 0;
      const visibleWidth = Math.max(0, Math.min(rootRect.right, pageRect.right) - Math.max(rootRect.left, pageRect.left));
      const visibleHeight = Math.max(0, Math.min(rootRect.bottom, pageRect.bottom) - Math.max(rootRect.top, pageRect.top));
      const visibleArea = visibleWidth * visibleHeight;
      const candidate = {
        pageNumber,
        pageRect,
        visibleArea,
        distanceToAnchor
      };

      if (!nearest || distanceToAnchor < nearest.distanceToAnchor) {
        nearest = candidate;
      }
      if (visibleArea && (!bestByArea || visibleArea > bestByArea.visibleArea)) {
        bestByArea = candidate;
      }
      if (distanceToAnchor === 0) {
        best = candidate;
        break;
      }
    }

    if (!best) {
      best = bestByArea || nearest;
    }

    if (!best) {
      const currentPageNumber = getCurrentPageNumberFromDoc(doc);
      return currentPageNumber
        ? {
            pageNumber: currentPageNumber,
            topRatio: 0,
            anchorViewportRatio,
            horizontalRatio: getHorizontalScrollRatio(root),
            scaleValue: getAppScaleValue(getPDFAppFromDoc(doc))
          }
        : null;
    }

    return {
      pageNumber: best.pageNumber,
      topRatio: clampRatio((anchorY - best.pageRect.top) / best.pageRect.height),
      anchorViewportRatio,
      leftRatio: clampRatio((rootRect.left - best.pageRect.left) / best.pageRect.width),
      horizontalRatio: getHorizontalScrollRatio(root),
      scaleValue: getAppScaleValue(getPDFAppFromDoc(doc))
    };
  }

  function applyVisiblePagePosition(doc, scrollRoot, position) {
    const pageNumber = Number(position?.pageNumber || 0);
    if (!doc || !scrollRoot || !Number.isFinite(pageNumber) || pageNumber <= 0) {
      return false;
    }

    const pageElement = getPDFPageElement(doc, pageNumber);
    if (!pageElement) {
      return setCurrentPageNumberInDoc(doc, pageNumber);
    }

    const rootRect = getScrollViewportRect(doc, scrollRoot);
    const pageRect = pageElement.getBoundingClientRect();
    if (!rootRect || !pageRect.height) {
      return setCurrentPageNumberInDoc(doc, pageNumber);
    }

    const maxTop = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    const anchorViewportRatio = Number.isFinite(Number(position.anchorViewportRatio))
      ? clampRatio(position.anchorViewportRatio)
      : 0.18;
    const anchorY = rootRect.top + Math.max(1, rootRect.height * anchorViewportRatio);
    const nextTop = scrollRoot.scrollTop
      + (pageRect.top - anchorY)
      + clampRatio(position.topRatio) * pageRect.height;
    const clampedTop = Math.max(0, Math.min(maxTop, nextTop));
    if (Math.abs(Number(scrollRoot.scrollTop || 0) - clampedTop) > 0.5) {
      scrollRoot.scrollTop = clampedTop;
    }

    return true;
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

  function isDeadObjectError(error) {
    const text = getSafeErrorText(error, "");
    return /dead object/i.test(text) || /can't access/i.test(text);
  }

  function isCancellationLikeError(session, error) {
    return !!(
      session?._translationCancelRequested
      || session?.destroyed
      || isDeadObjectError(error)
    );
  }

  function setupSync(session) {
    if (!isSessionAlive(session)) {
      return false;
    }

    detachSync(session);
    fastReadLog(`setupSync begin: originalHidden=${!!session.originalHidden}, hasTranslatedFrame=${!!session.translatedFrame}`);

    let sourcePDFDoc = session.leftPDFDoc || session.reader?._iframeWindow?.document || session.doc;
    if (!sourcePDFDoc) {
      fastReadLog("setupSync unavailable: source PDF document missing", "warn");
      return false;
    }

    let rightDoc = getTranslatedViewerDoc(session);
    if (!rightDoc) {
      updateSyncBadge(session, "Sync: waiting");
      fastReadLog("setupSync waiting: translated viewer document missing", "warn");
      return false;
    }

    injectViewerChromeStyle(sourcePDFDoc);
    injectViewerChromeStyle(rightDoc);

    const syncEnabled = isTruePref(PREF_KEYS.syncEnabled, true);
    if (!syncEnabled) {
      updateSyncBadge(session, "Sync: off");
      return false;
    }

    let leftSurface = null;
    let rightSurface = null;
    try {
      leftSurface = resolvePDFSurface(sourcePDFDoc, session.leftPane);
    }
    catch (error) {
      Zotero.logError(`[fastRead] resolve left PDF surface failed: ${getSafeErrorText(error)}`);
    }
    try {
      rightSurface = resolvePDFSurface(rightDoc, session.translatedFrame);
    }
    catch (error) {
      Zotero.logError(`[fastRead] resolve right PDF surface failed: ${getSafeErrorText(error)}`);
    }
    if (leftSurface?.doc) {
      sourcePDFDoc = leftSurface.doc;
    }
    if (rightSurface?.doc) {
      rightDoc = rightSurface.doc;
    }

    const leftApp = leftSurface?.app || getPDFAppFromDoc(sourcePDFDoc);
    const rightApp = rightSurface?.app || getPDFAppFromDoc(rightDoc);
    const leftRoot = leftSurface?.root || getScrollableRoot(sourcePDFDoc, leftApp?.pdfViewer?.container || session.leftPane);

    session.leftScrollRoot = leftRoot;
    let rightViewerContainer = null;
    try {
      rightViewerContainer = rightApp?.pdfViewer?.container || rightDoc?.getElementById?.("viewerContainer") || null;
    }
    catch (_error) {
    }
    session.translatedViewerContainer = rightViewerContainer;
    session.translatedScrollRoot = rightSurface?.root || rightViewerContainer || getScrollableRoot(rightDoc, null);

    if (!leftRoot || !session.translatedScrollRoot) {
      if (typeof Zotero?.debug === "function") {
        Zotero.debug(`[fastRead] sync unavailable: leftRoot=${!!leftRoot}, rightRoot=${!!session.translatedScrollRoot}`);
      }
      fastReadLog(`sync unavailable: leftRoot=${!!leftRoot}, rightRoot=${!!session.translatedScrollRoot}, leftPages=${getPDFPageElements(sourcePDFDoc).length}, rightPages=${getPDFPageElements(rightDoc).length}`, "warn");
      return false;
    }

    if (typeof Zotero?.debug === "function") {
      Zotero.debug(`[fastRead] sync attached: left=${leftRoot.id || leftRoot.className || leftRoot.tagName}, right=${session.translatedScrollRoot.id || session.translatedScrollRoot.className || session.translatedScrollRoot.tagName}, leftPages=${getPDFPageElements(sourcePDFDoc).length}, rightPages=${getPDFPageElements(rightDoc).length}`);
    }
    fastReadLog(`sync attached: mode=${getSyncMode()}, left=${leftRoot.id || leftRoot.className || leftRoot.tagName}, right=${session.translatedScrollRoot.id || session.translatedScrollRoot.className || session.translatedScrollRoot.tagName}, leftPages=${getPDFPageElements(sourcePDFDoc).length}, rightPages=${getPDFPageElements(rightDoc).length}, leftScroll=${leftRoot.scrollWidth}x${leftRoot.scrollHeight}, rightScroll=${session.translatedScrollRoot.scrollWidth}x${session.translatedScrollRoot.scrollHeight}`);

    const syncMode = getSyncMode();
    const syncByRatio = (source, target) => {
      const ratio = getScrollRatio(source);
      applyScrollRatio(target, ratio);
      applyHorizontalScrollRatio(target, getHorizontalScrollRatio(source));
    };

    const syncByPagePosition = (sourceDoc, targetDoc, fallbackSource, fallbackTarget) => {
      const position = getVisiblePagePosition(sourceDoc, fallbackSource);
      const success = position
        ? applyVisiblePagePosition(targetDoc, fallbackTarget, position)
        : false;

      if (success) {
        if (Number.isFinite(Number(position?.horizontalRatio))) {
          applyHorizontalScrollRatio(fallbackTarget, position.horizontalRatio);
        }
        return;
      }

      const pageNumber = getCurrentPageNumberFromDoc(sourceDoc);
      const pageSuccess = setCurrentPageNumberInDoc(targetDoc, pageNumber);
      if (!pageSuccess) {
        syncByRatio(fallbackSource, fallbackTarget);
      }
      else {
        applyHorizontalScrollRatio(fallbackTarget, getHorizontalScrollRatio(fallbackSource));
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
      }, 450);
    };

    const rememberCurrentScrollState = () => {
      try {
        session._lastLeftScrollTop = Number(leftRoot?.scrollTop || 0);
        session._lastLeftScrollLeft = Number(leftRoot?.scrollLeft || 0);
        session._lastRightScrollTop = Number(session.translatedScrollRoot?.scrollTop || 0);
        session._lastRightScrollLeft = Number(session.translatedScrollRoot?.scrollLeft || 0);
      }
      catch (_error) {
      }
    };

    const getSideSuppressKey = (side) => side === "left" ? "_leftSuppressUntil" : "_rightSuppressUntil";
    const isSideSuppressed = (side) => Date.now() < Number(session[getSideSuppressKey(side)] || 0);
    const suppressSide = (side, durationMs = 650) => {
      session[getSideSuppressKey(side)] = Date.now() + durationMs;
    };

    const runScrollSync = (side, sourceRoot, targetRoot, sourceDoc, targetDoc) => {
      if (session.scrollSyncSource && session.scrollSyncSource !== side) {
        return;
      }

      scheduleScrollUnlock(side, sourceRoot);
      suppressSide(side === "left" ? "right" : "left");

      if (syncMode === "page") {
        syncByPagePosition(sourceDoc, targetDoc, sourceRoot, targetRoot);
      }
      else {
        syncByRatio(sourceRoot, targetRoot);
      }
      rememberCurrentScrollState();
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
      if (isSideSuppressed("left")) {
        rememberCurrentScrollState();
        return;
      }
      try {
        queueScrollSync("left", leftRoot, () => {
          if (!isSessionAlive(session) || !leftRoot || !session.translatedScrollRoot) {
            return;
          }
          if (isSideSuppressed("left")) {
            rememberCurrentScrollState();
            return;
          }
          runScrollSync("left", leftRoot, session.translatedScrollRoot, sourcePDFDoc, rightDoc);
        });
      }
      catch (error) {
        fastReadLog(`left scroll sync failed; detaching sync: ${getSafeErrorText(error)}`, "warn");
        detachSync(session);
      }
    };

    const syncFromRight = () => {
      if (!isSessionAlive(session) || !leftRoot || !session.translatedScrollRoot) {
        detachSync(session);
        return;
      }
      if (isSideSuppressed("right")) {
        rememberCurrentScrollState();
        return;
      }
      try {
        queueScrollSync("right", session.translatedScrollRoot, () => {
          if (!isSessionAlive(session) || !leftRoot || !session.translatedScrollRoot) {
            return;
          }
          if (isSideSuppressed("right")) {
            rememberCurrentScrollState();
            return;
          }
          runScrollSync("right", session.translatedScrollRoot, leftRoot, rightDoc, sourcePDFDoc);
        });
      }
      catch (error) {
        fastReadLog(`right scroll sync failed; detaching sync: ${getSafeErrorText(error)}`, "warn");
        detachSync(session);
      }
    };

    leftRoot.addEventListener("scroll", syncFromLeft, { passive: true });
    session.leftScrollListener = syncFromLeft;

    session.translatedScrollRoot.addEventListener("scroll", syncFromRight, { passive: true });
    session.rightScrollListener = syncFromRight;

    session._lastLeftScrollTop = Number(leftRoot.scrollTop || 0);
    session._lastLeftScrollLeft = Number(leftRoot.scrollLeft || 0);
    session._lastRightScrollTop = Number(session.translatedScrollRoot.scrollTop || 0);
    session._lastRightScrollLeft = Number(session.translatedScrollRoot.scrollLeft || 0);

    const syncPollWindow = getNodeWindow(leftRoot, sourcePDFDoc) || globalThis;
    session._syncPollWindow = syncPollWindow;
    const setPollInterval = typeof syncPollWindow?.setInterval === "function"
      ? syncPollWindow.setInterval.bind(syncPollWindow)
      : setInterval;
    session.syncPollInterval = setPollInterval(() => {
      if (!isSessionAlive(session) || !leftRoot || !session.translatedScrollRoot) {
        detachSync(session);
        return;
      }

      const leftTop = Number(leftRoot.scrollTop || 0);
      const leftLeft = Number(leftRoot.scrollLeft || 0);
      const rightTop = Number(session.translatedScrollRoot.scrollTop || 0);
      const rightLeft = Number(session.translatedScrollRoot.scrollLeft || 0);
      const leftChanged = Math.abs(leftTop - Number(session._lastLeftScrollTop || 0)) > 0.5
        || Math.abs(leftLeft - Number(session._lastLeftScrollLeft || 0)) > 0.5;
      const rightChanged = Math.abs(rightTop - Number(session._lastRightScrollTop || 0)) > 0.5
        || Math.abs(rightLeft - Number(session._lastRightScrollLeft || 0)) > 0.5;

      session._lastLeftScrollTop = leftTop;
      session._lastLeftScrollLeft = leftLeft;
      session._lastRightScrollTop = rightTop;
      session._lastRightScrollLeft = rightLeft;

      if (session.scrollSyncSource) {
        return;
      }
      if (leftChanged && isSideSuppressed("left")) {
        return;
      }
      if (rightChanged && isSideSuppressed("right")) {
        return;
      }
      if (leftChanged && !rightChanged) {
        syncFromLeft();
      }
      else if (rightChanged && !leftChanged) {
        syncFromRight();
      }
    }, 160);

    const leftViewEventBus = leftApp?.eventBus || leftApp?.pdfViewer?.eventBus || null;
    const rightViewEventBus = rightApp?.eventBus || rightApp?.pdfViewer?.eventBus || null;
    if (leftViewEventBus && typeof leftViewEventBus.on === "function") {
      leftViewEventBus.on("updateviewarea", syncFromLeft);
      leftViewEventBus.on("pagechanging", syncFromLeft);
      session._leftViewListener = syncFromLeft;
      session._leftViewEventBus = leftViewEventBus;
    }

    if (rightViewEventBus && typeof rightViewEventBus.on === "function") {
      rightViewEventBus.on("updateviewarea", syncFromRight);
      rightViewEventBus.on("pagechanging", syncFromRight);
      session._rightViewListener = syncFromRight;
      session._rightViewEventBus = rightViewEventBus;
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
        }
        else {
          targetViewer.currentScaleValue = scaleValue;
        }

        const scopeWin = sourceDoc?.defaultView || globalThis;
        const setTimer = typeof scopeWin?.setTimeout === "function"
          ? scopeWin.setTimeout.bind(scopeWin)
          : setTimeout;
        const resync = side === "left" ? syncFromLeft : syncFromRight;
        setTimer(resync, 80);
        setTimer(resync, 220);
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

      const leftEventBus = leftViewEventBus;
      const rightEventBus = rightViewEventBus;

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
      if (session._leftViewEventBus && session._leftViewListener && typeof session._leftViewEventBus.off === "function") {
        session._leftViewEventBus.off("updateviewarea", session._leftViewListener);
        session._leftViewEventBus.off("pagechanging", session._leftViewListener);
      }
    }
    catch (_error) {
    }

    try {
      if (session._rightViewEventBus && session._rightViewListener && typeof session._rightViewEventBus.off === "function") {
        session._rightViewEventBus.off("updateviewarea", session._rightViewListener);
        session._rightViewEventBus.off("pagechanging", session._rightViewListener);
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
    if (session.syncPollInterval) {
      try {
        const clearPollInterval = typeof session._syncPollWindow?.clearInterval === "function"
          ? session._syncPollWindow.clearInterval.bind(session._syncPollWindow)
          : clearInterval;
        clearPollInterval(session.syncPollInterval);
      }
      catch (_error) {
      }
    }
    if (session.syncRetryTimer) {
      try {
        const clearRetryTimer = typeof session._syncRetryWindow?.clearTimeout === "function"
          ? session._syncRetryWindow.clearTimeout.bind(session._syncRetryWindow)
          : clearTimeout;
        clearRetryTimer(session.syncRetryTimer);
      }
      catch (_error) {
      }
    }

    session.leftScrollListener = null;
    session.rightScrollListener = null;
    session._leftZoomListener = null;
    session._rightZoomListener = null;
    session._leftEventBus = null;
    session._rightEventBus = null;
    session._leftViewListener = null;
    session._rightViewListener = null;
    session._leftViewEventBus = null;
    session._rightViewEventBus = null;
    session.scrollSyncSource = "";
    session.scaleSyncSource = "";
    session.scrollSyncReleaseTimer = 0;
    session.scaleSyncReleaseTimer = 0;
    session.leftScrollRAF = 0;
    session.rightScrollRAF = 0;
    session.syncPollInterval = 0;
    session.syncRetryTimer = 0;
    session._syncPollWindow = null;
    session._syncRetryWindow = null;
    session._lastLeftScrollTop = 0;
    session._lastLeftScrollLeft = 0;
    session._lastRightScrollTop = 0;
    session._lastRightScrollLeft = 0;
    session.suppressSyncUntil = 0;
    session._leftSuppressUntil = 0;
    session._rightSuppressUntil = 0;
    session.suppressScaleSyncUntil = 0;
    session.leftScrollRoot = null;
    session.translatedScrollRoot = null;
    session.translatedViewerContainer = null;
  }

  async function autoLoadTranslatedPDFIfNeeded(session) {
    fastReadLog("autoLoadTranslatedPDFIfNeeded begin");
    if (session.translatedURLInput) {
      session.translatedURLInput.value = "";
    }

    setTranslationProgress(session, 0, "正在定位原文 PDF", true);
    const sourcePath = await getSourcePDFPathForSession(session);
    if (!sourcePath) {
      fastReadLog("autoLoad: source path missing");
      if (isRemoteAutoTranslateEnabled()) {
        await requestTranslatedPDFViaAPI(session);
        return;
      }
      updateSyncBadge(session, "Sync: idle");
      return;
    }

    const sourceDir = getParentDirectory(sourcePath);
    if (sourceDir) {
      setStatus(session, "正在检查本地已有译文...", "info");
      setTranslationProgress(session, 2, "正在检查本地译文", true);

      const translatedPath = await findExistingTranslatedPdfPath(sourceDir, sourcePath);
      if (translatedPath) {
        const fileURI = toFileURI(translatedPath);
        if (fileURI) {
          fastReadLog(`autoLoad: loading existing translated PDF via fileURI=${fileURI}`);
          setStatus(session, "检测到本地译文，正在加载...", "info");
          setTranslationProgress(session, 100, "检测到本地译文", true);
          writePref(PREF_KEYS.translatedPdfURL, "");
          session.translatedAttachmentItem = null;
          session.translatedAttachmentPath = translatedPath;
          await loadTranslatedPDF(session, fileURI);
          return;
        }
      }
    }

    if (isRemoteAutoTranslateEnabled()) {
      fastReadLog("autoLoad: no local translated PDF, submitting remote/local translation task");
      await requestTranslatedPDFViaAPI(session);
      return;
    }

    fastReadLog("autoLoad: no local translated PDF and auto translate disabled");
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
    void cancelActiveTranslation(session, { forceBackend: true, notify: true });
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
    session.originalHidden = false;
    session.leftPDFDoc = null;
    session.remoteTaskID = null;
    session.remoteTaskPolling = false;
    session.sidebarWorkflowStarted = false;
    session.translatedOnce = false;
    session.fastReadEnabled = false;
  }

  async function initSplitView(session) {
    fastReadLog("initSplitView begin");
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
    fastReadLog(`initSplitView layout ready: hasLeftPane=${!!session.leftPane}, hasPanel=${!!session.panel}, hasPDFDoc=${!!session.leftPDFDoc}`);

    wirePanel(session);
    setStatus(session, "等待加载译文 PDF...", "info");
    try {
      await autoLoadTranslatedPDFIfNeeded(session);
    }
    catch (error) {
      if (isCancellationLikeError(session, error)) {
        try {
          setStatus(session, "翻译服务已取消", "info");
        }
        catch (_innerError) {
        }
        return;
      }
      fastReadLog(`autoLoadTranslatedPDFIfNeeded failed: ${getSafeErrorText(error)}`, "error");
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
    fastReadLog(`toggleFastReadMode: shouldEnable=${shouldEnable}, current=${!!session.fastReadEnabled}`);

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
      if (isCancellationLikeError(session, error)) {
        showReaderAlert("翻译服务已取消");
        return;
      }
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
      if (isCancellationLikeError(session, error)) {
        showReaderAlert("翻译服务已取消");
        return;
      }
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

  function setTranslationProgress(session, percent, message = "", visible = true) {
    const placeholder = session?.translatedPlaceholder;
    if (!placeholder) {
      return;
    }

    const progressNode = placeholder.querySelector(".zdr-single-progress");
    const labelNode = placeholder.querySelector(".zdr-single-progress-label");
    const barNode = placeholder.querySelector(".zdr-single-progress-bar");
    if (!progressNode || !barNode) {
      return;
    }

    const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
    session.translationProgress = clamped;
    progressNode.style.display = visible ? "grid" : "none";
    barNode.style.width = `${clamped}%`;
    if (labelNode) {
      const text = String(message || "处理中").trim();
      labelNode.textContent = `${text} ${Math.round(clamped)}%`;
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
      setTranslationProgress(session, session.translationProgress || 0, "处理失败", false);
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
    if (state === "ready") {
      setTranslationProgress(session, 100, "已完成", false);
    }
    else {
      setTranslationProgress(session, session.translationProgress || 0, "准备中", true);
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
    __fastReadScriptVersion: FASTREAD_READER_SCRIPT_VERSION,
    initSplitView: initSplitViewForReader,
    ensureReader,
    teardownAll,
    toggleFastReadForWindow,
    mountSidebarPanel,
    launchSplitView
  };

  fastReadLog("Successfully attached API to Zotero.FastRead");
})();
