const ADDON_ID = "fastread@example.com";

const PREF_KEYS = Object.freeze({
  syncMode: "extensions.fastread.viewer.syncMode",
  remoteBaseURL: "extensions.fastread.remote.baseURL",
  remoteApiKey: "extensions.fastread.remote.apiKey",
  remoteSourceLang: "extensions.fastread.remote.sourceLang",
  remoteTargetLang: "extensions.fastread.remote.targetLang",
  remoteModelConfig: "extensions.fastread.remote.modelConfig",
  remotePollIntervalMs: "extensions.fastread.remote.pollIntervalMs",
  remotePollTimeoutSec: "extensions.fastread.remote.pollTimeoutSec"
});

const PREF_DEFAULTS = Object.freeze({
  [PREF_KEYS.syncMode]: "ratio",
  [PREF_KEYS.remoteBaseURL]: "",
  [PREF_KEYS.remoteApiKey]: "",
  [PREF_KEYS.remoteSourceLang]: "en",
  [PREF_KEYS.remoteTargetLang]: "zh",
  [PREF_KEYS.remoteModelConfig]: "",
  [PREF_KEYS.remotePollIntervalMs]: "700",
  [PREF_KEYS.remotePollTimeoutSec]: "600"
});

const PREF_PANE_ID = "fastread-prefpane";
const PREF_PANE_LABEL = "fastRead 设置";
const FASTREAD_SIDEBAR_TRIGGER_ID = "fastread-sidebar-trigger";
const FASTREAD_CONTEXT_MENU_ITEM_ID = "fastread-context-menu-item";
const FASTREAD_BATCH_TOOLS_MENU_ITEM_ID = "fastread-tools-batch-menu-item";
const FASTREAD_BATCH_DIALOG_ID = "fastread-batch-dialog";
const ITEM_POPUP_ID = "zotero-itemmenu";
const FASTREAD_ICON_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMyNTYzZWIiLz48cmVjdCB4PSIxMiIgeT0iMTQiIHdpZHRoPSIxNiIgaGVpZ2h0PSIzNiIgcng9IjMiIGZpbGw9IiNmZmZmZmYiLz48cmVjdCB4PSIzNiIgeT0iMTQiIHdpZHRoPSIxNiIgaGVpZ2h0PSIzNiIgcng9IjMiIGZpbGw9IiNkYmVhZmUiLz48cGF0aCBkPSJNMzAgMjJoNHY0aC00em0wIDhoNHY0aC00em0wIDhoNHY0aC00eiIgZmlsbD0iIzkzYzVmZCIvPjwvc3ZnPg==";
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
const BACKEND_SCRIPT_ZIP_ENTRY_PATH = "server.py";
const BACKEND_BINARY_ZIP_ENTRY_BY_OS = Object.freeze({
  WINNT: "bin/fastread-server.exe",
  Linux: "bin/fastread-server-linux",
  Darwin: "bin/fastread-server-macos"
});
const BACKEND_TEMP_DIR_NAME = "fastread-server";
const SIDEBAR_GUARD_INTERVAL_MS = 350;
const MAIN_WINDOW_SETUP_RETRY_INTERVAL_MS = 120;
const MAIN_WINDOW_SETUP_MAX_ATTEMPTS = 120;

const PREF_PANE_FRAGMENT = `
<html:div id="zdr-pref-root" class="main-section">
  <html:style>
    #zdr-pref-root {
      --zdr-bg: color-mix(in srgb, var(--material-background) 92%, #f4f6fb 8%);
      --zdr-card-bg: color-mix(in srgb, var(--material-background) 88%, #ffffff 12%);
      --zdr-border: color-mix(in srgb, var(--material-foreground) 12%, transparent);
      --zdr-soft: color-mix(in srgb, var(--material-foreground) 65%, transparent);
      --zdr-title: var(--material-foreground);
      --zdr-primary: #2f6df6;
      --zdr-danger: #b61c3a;
      --zdr-success: #1d8f5d;
      margin-top: 10px;
    }

    #zdr-pref-root .zdr-pref-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      padding: 8px 0;
    }

    #zdr-pref-root .zdr-pref-card {
      background: var(--zdr-card-bg);
      border: 1px solid var(--zdr-border);
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 1px 1px rgba(0, 0, 0, 0.02), 0 8px 28px rgba(0, 0, 0, 0.05);
    }

    #zdr-pref-root .zdr-card-title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--zdr-title);
      line-height: 1.35;
    }

    #zdr-pref-root .zdr-card-subtitle {
      margin: 6px 0 14px;
      color: var(--zdr-soft);
      font-size: 12px;
      line-height: 1.4;
    }

    #zdr-pref-root .zdr-form-grid {
      display: grid;
      grid-template-columns: minmax(150px, 210px) minmax(260px, 1fr);
      column-gap: 12px;
      row-gap: 10px;
      align-items: center;
    }

    #zdr-pref-root .zdr-label {
      font-size: 12px;
      color: var(--zdr-soft);
      font-weight: 600;
      letter-spacing: 0.01em;
    }

    #zdr-pref-root .zdr-input {
      width: 100%;
      min-height: 30px;
      box-sizing: border-box;
      border-radius: 8px;
      border: 1px solid var(--zdr-border);
      background: var(--zdr-bg);
      color: var(--zdr-title);
      padding: 6px 9px;
      font-size: 13px;
      line-height: 1.2;
    }

    #zdr-pref-root .zdr-input:focus {
      outline: none;
      border-color: var(--zdr-primary);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--zdr-primary) 20%, transparent);
    }

    #zdr-pref-root .zdr-action-row {
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    #zdr-pref-root .zdr-btn {
      border: 1px solid color-mix(in srgb, var(--zdr-primary) 40%, transparent);
      background: color-mix(in srgb, var(--zdr-primary) 12%, var(--zdr-bg));
      color: var(--zdr-title);
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 999px;
      cursor: pointer;
      transition: background-color 130ms ease, border-color 130ms ease;
    }

    #zdr-pref-root .zdr-btn:hover {
      background: color-mix(in srgb, var(--zdr-primary) 20%, var(--zdr-bg));
      border-color: color-mix(in srgb, var(--zdr-primary) 55%, transparent);
    }

    #zdr-pref-root .zdr-btn[disabled] {
      opacity: 0.7;
      cursor: wait;
    }

    #zdr-pref-root .zdr-status {
      margin: 0;
      font-size: 12px;
      color: var(--zdr-soft);
      min-height: 1em;
    }

    #zdr-pref-root .zdr-status.is-success {
      color: var(--zdr-success);
    }

    #zdr-pref-root .zdr-status.is-error {
      color: var(--zdr-danger);
    }
  </html:style>

  <html:section class="zdr-pref-grid">
    <html:article class="zdr-pref-card" id="zdr-remote-api-card">
      <html:h2 class="zdr-card-title">AI 翻译配置</html:h2>
      <html:p class="zdr-card-subtitle">填写 X-API-Key 与语言配置。插件会优先使用本地译文，缺失时自动提交任务。</html:p>
      <html:div class="zdr-form-grid">
        <html:label class="zdr-label" for="zdr-remote-api-key">X-API-Key（必填）</html:label>
        <html:input
          id="zdr-remote-api-key"
          class="zdr-input"
          type="password"
          autocomplete="off"
          preference="${PREF_KEYS.remoteApiKey}" />

        <html:label class="zdr-label" for="zdr-remote-source-lang">源语言</html:label>
        <html:input
          id="zdr-remote-source-lang"
          class="zdr-input"
          type="text"
          placeholder="en"
          preference="${PREF_KEYS.remoteSourceLang}" />

        <html:label class="zdr-label" for="zdr-remote-target-lang">目标语言</html:label>
        <html:input
          id="zdr-remote-target-lang"
          class="zdr-input"
          type="text"
          placeholder="zh"
          preference="${PREF_KEYS.remoteTargetLang}" />

        <html:label class="zdr-label" for="zdr-remote-model-config">Model Config JSON（可选）</html:label>
        <html:input
          id="zdr-remote-model-config"
          class="zdr-input"
          type="text"
          placeholder='{"model":"gpt-4o-mini"}'
          preference="${PREF_KEYS.remoteModelConfig}" />
      </html:div>

      <html:div class="zdr-action-row">
        <html:button id="zdr-remote-api-test-btn" class="zdr-btn" type="button">测试 API 连接</html:button>
        <html:p id="zdr-remote-api-status" class="zdr-status" />
      </html:div>
    </html:article>

    <html:article class="zdr-pref-card" id="zdr-advanced-card">
      <html:h2 class="zdr-card-title">高级设置</html:h2>
      <html:p class="zdr-card-subtitle">同步策略、任务 API 地址与轮询参数。</html:p>
      <html:div class="zdr-form-grid">
        <html:label class="zdr-label" for="zdr-sync-mode">同步策略</html:label>
        <html:select id="zdr-sync-mode" class="zdr-input" preference="${PREF_KEYS.syncMode}">
          <html:option value="ratio">滚动比例同步（推荐）</html:option>
          <html:option value="page">页号同步（PDF.js 视图）</html:option>
        </html:select>

        <html:label class="zdr-label" for="zdr-remote-base-url">任务 API Base URL（可留空自动探测）</html:label>
        <html:input
          id="zdr-remote-base-url"
          class="zdr-input"
          type="url"
          placeholder="留空自动探测本地服务"
          preference="${PREF_KEYS.remoteBaseURL}" />

        <html:label class="zdr-label" for="zdr-remote-poll-interval">轮询间隔 ms</html:label>
        <html:input
          id="zdr-remote-poll-interval"
          class="zdr-input"
          type="number"
          min="500"
          step="100"
          preference="${PREF_KEYS.remotePollIntervalMs}" />

        <html:label class="zdr-label" for="zdr-remote-poll-timeout">超时 s</html:label>
        <html:input
          id="zdr-remote-poll-timeout"
          class="zdr-input"
          type="number"
          min="30"
          step="10"
          preference="${PREF_KEYS.remotePollTimeoutSec}" />
      </html:div>
    </html:article>
  </html:section>
</html:div>
`;

let _rootURI = "";
let _prefPaneRegistrationID = null;
let _prefWindowListener = null;
let _readerScriptLoaded = false;
const _prefWindowCleanup = new WeakMap();
let _sidebarTabRegistered = false;
const _sidebarGuardIntervals = new WeakMap();
let _mainWindowListener = null;
const _mainWindowCleanup = new WeakMap();
const _mainWindowPendingSetup = new WeakMap();
let _backendProcess = null;
let _backendProcessObserver = null;
let _backendStartPromise = null;
let _backendExePath = "";
let _backendExtractedExePath = "";
let _backendManagedByAddon = false;
let _lastBackendHealthyBaseURL = "";
const BACKEND_BRIDGE_GLOBAL_NAME = "ZoteroFastReadEnsureLocalBackend";

function install() {}

async function startup(addonData) {
  const rawRootURI = String(addonData?.rootURI || "");
  _rootURI = rawRootURI && !rawRootURI.endsWith("/") ? `${rawRootURI}/` : rawRootURI;
  installBackendBridge();
  startBackendServerInBackground();
  initializePrefs();
  try {
    Services.scriptloader.loadSubScript(`${_rootURI}reader-script.js`);
    if (!Zotero.FastRead) {
      throw new Error("Zotero.FastRead was not attached.");
    }
    _readerScriptLoaded = true;
  }
  catch (error) {
    Zotero.logError(`Failed to load reader-script.js: ${error}`);
    _readerScriptLoaded = false;
  }

  try {
    _prefPaneRegistrationID = await Zotero.PreferencePanes.register({
      pluginID: ADDON_ID,
      id: PREF_PANE_ID,
      label: PREF_PANE_LABEL,
      image: "bg.svg",
      src: toDataURI(PREF_PANE_FRAGMENT)
    });
  }
  catch (error) {
    _prefPaneRegistrationID = null;
    Zotero.logError(error);
  }

  try {
    attachPreferenceWindowHooks();
    attachMainWindowHooks();
    registerReaderHooks();
  }
  catch (error) {
    Zotero.logError(`Failed to attach hooks: ${error}`);
  }
}

async function shutdown() {
  if (_prefPaneRegistrationID) {
    Zotero.PreferencePanes.unregister(_prefPaneRegistrationID);
    _prefPaneRegistrationID = null;
  }

  detachPreferenceWindowHooks();
  detachMainWindowHooks();
  unregisterReaderHooks();
  await stopBackendServer();
  uninstallBackendBridge();

  if (Zotero.FastRead && typeof Zotero.FastRead.teardownAll === "function") {
    try {
      Zotero.FastRead.teardownAll();
    }
    catch (error) {
      Zotero.logError(error);
    }
  }

  delete Zotero.FastRead;

  _readerScriptLoaded = false;
}

async function uninstall() {
  uninstallBackendBridge();
  await stopBackendServer();
}

function installBackendBridge() {
  globalThis[BACKEND_BRIDGE_GLOBAL_NAME] = async function ensureFastReadLocalBackend() {
    return ensureBackendServerStarted();
  };
}

function uninstallBackendBridge() {
  try {
    delete globalThis[BACKEND_BRIDGE_GLOBAL_NAME];
  }
  catch (_error) {
  }
}

function startBackendServerInBackground() {
  void ensureBackendServerStarted();
}

async function ensureBackendServerStarted() {
  if (_backendStartPromise) {
    await _backendStartPromise;
    return isBackendHealthy();
  }

  _backendStartPromise = (async () => {
    const requireBundledBackend = shouldRequireBundledBackendForCurrentOS();

    if (!_backendExePath) {
      _backendExePath = await resolveBackendExePath(_rootURI);
    }

    if (!_backendExePath) {
      return;
    }

    if (requireBundledBackend) {
      await shutdownExistingLocalBackendServer();
    }

    await startBackendServer(_backendExePath, {
      allowReuseExisting: !requireBundledBackend,
    });
  })()
    .catch((error) => {
      Zotero.logError(`fastRead: ensure backend startup failed: ${error}`);
    })
    .finally(() => {
      _backendStartPromise = null;
    });

  await _backendStartPromise;
  return isBackendHealthy();
}

async function resolveBackendExePath(rootURI) {
  const fileURIPath = resolveBackendExePathFromFileURI(rootURI);
  if (fileURIPath) {
    return fileURIPath;
  }

  const extractedPath = materializeBackendExecutable(rootURI);
  if (extractedPath) {
    return extractedPath;
  }

  return "";
}

function resolveBundledBackendEntryPathForCurrentOS() {
  return BACKEND_BINARY_ZIP_ENTRY_BY_OS[String(Services.appinfo.OS || "")] || "";
}

function shouldRequireBundledBackendForCurrentOS() {
  const currentOS = String(Services.appinfo.OS || "");
  return currentOS === "WINNT" || currentOS === "Darwin";
}

function resolveAddonRelativeFile(addonRoot, relativePath) {
  if (!addonRoot || typeof addonRoot.clone !== "function") {
    return null;
  }

  const normalized = String(relativePath || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!normalized.length) {
    return null;
  }

  const target = addonRoot.clone();
  for (const segment of normalized) {
    target.append(segment);
  }
  return target;
}

function ensureBackendFileExecutable(file) {
  if (!file || Services.appinfo.OS === "WINNT") {
    return;
  }

  try {
    file.permissions = 0o755;
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to mark backend file as executable: ${error}`);
  }
}

function extractBackendEntry(zipReader, tempDir, entryPath, { executable = false } = {}) {
  const entryName = String(entryPath || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .pop();
  if (!entryName) {
    return "";
  }

  const extractedFile = tempDir.clone();
  extractedFile.append(`fastread-backend-${Date.now()}-${Math.floor(Math.random() * 1000000)}-${entryName}`);
  zipReader.extract(entryPath, extractedFile);
  if (executable) {
    ensureBackendFileExecutable(extractedFile);
  }

  _backendExtractedExePath = extractedFile.path;
  return extractedFile.path;
}

function resolveBackendExePathFromFileURI(rootURI) {
  try {
    const uri = Services.io.newURI(String(rootURI || ""));
    if (!uri || uri.scheme !== "file") {
      return "";
    }
    const fileURL = uri.QueryInterface(Ci.nsIFileURL);
    const addonRoot = fileURL.file;

    const bundledBackendEntryPath = resolveBundledBackendEntryPathForCurrentOS();
    const bundledBackendFile = resolveAddonRelativeFile(addonRoot, bundledBackendEntryPath);
    if (bundledBackendFile?.exists()) {
      ensureBackendFileExecutable(bundledBackendFile);
      return bundledBackendFile.path;
    }

    if (shouldRequireBundledBackendForCurrentOS()) {
      Zotero.logError(`fastRead: required bundled backend is missing for ${Services.appinfo.OS}. Expected ${bundledBackendEntryPath || "(unknown)"}.`);
      return "";
    }

    const scriptFile = resolveAddonRelativeFile(addonRoot, BACKEND_SCRIPT_ZIP_ENTRY_PATH);
    if (scriptFile?.exists()) {
      return scriptFile.path;
    }

    return "";
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to resolve backend executable path: ${error}`);
    return "";
  }
}

function materializeBackendExecutable(rootURI) {
  let zipReader = null;
  try {
    const uri = Services.io.newURI(String(rootURI || ""));
    if (!uri || uri.scheme !== "jar") {
      return "";
    }

    const jarURI = uri.QueryInterface(Ci.nsIJARURI);
    const jarFileURL = jarURI?.JARFile?.QueryInterface(Ci.nsIFileURL);
    const jarFile = jarFileURL?.file || null;
    if (!jarFile || !jarFile.exists()) {
      return "";
    }

    zipReader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    zipReader.open(jarFile);

    const tempDir = Services.dirsvc.get("TmpD", Ci.nsIFile);
    tempDir.append(BACKEND_TEMP_DIR_NAME);
    if (!tempDir.exists()) {
      tempDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o700);
    }

    const bundledBackendEntryPath = resolveBundledBackendEntryPathForCurrentOS();
    if (bundledBackendEntryPath && zipReader.hasEntry(bundledBackendEntryPath)) {
      return extractBackendEntry(zipReader, tempDir, bundledBackendEntryPath, { executable: true });
    }

    if (shouldRequireBundledBackendForCurrentOS()) {
      Zotero.logError(`fastRead: required bundled backend entry is missing for ${Services.appinfo.OS}. Expected ${bundledBackendEntryPath || "(unknown)"}.`);
      return "";
    }

    if (!zipReader.hasEntry(BACKEND_SCRIPT_ZIP_ENTRY_PATH)) {
      Zotero.debug(`fastRead: ${BACKEND_SCRIPT_ZIP_ENTRY_PATH} is missing in packaged addon.`);
      return "";
    }

    return extractBackendEntry(zipReader, tempDir, BACKEND_SCRIPT_ZIP_ENTRY_PATH);
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to extract backend executable from addon package: ${error}`);
    return "";
  }
  finally {
    if (zipReader) {
      try {
        zipReader.close();
      }
      catch (error) {
        Zotero.logError(`fastRead: failed to close zip reader: ${error}`);
      }
    }
  }
}

function toExistingLocalFile(path) {
  const target = String(path || "").trim();
  if (!target) {
    return null;
  }
  try {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(target);
    if (file.exists()) {
      return file;
    }
  }
  catch (_error) {
  }
  return null;
}

function resolvePythonCommandForServer() {
  const isWindows = Services.appinfo.OS === "WINNT";
  if (isWindows) {
    const localAppData = Services.env?.get("LOCALAPPDATA") || "";
    const candidates = [
      localAppData ? `${localAppData}\\Programs\\Python\\Python312\\pythonw.exe` : "",
      localAppData ? `${localAppData}\\Programs\\Python\\Python312\\python.exe` : "",
      localAppData ? `${localAppData}\\Programs\\Python\\Python311\\pythonw.exe` : "",
      localAppData ? `${localAppData}\\Programs\\Python\\Python311\\python.exe` : "",
      "C:\\Windows\\py.exe",
      "C:\\Windows\\System32\\py.exe"
    ].filter(Boolean);

    for (const candidate of candidates) {
      const file = toExistingLocalFile(candidate);
      if (!file) {
        continue;
      }
      const path = String(file.path || "");
      if (/\\py\.exe$/i.test(path)) {
        return { executable: file, argsPrefix: ["-3"] };
      }
      return { executable: file, argsPrefix: [] };
    }

    return null;
  }

  for (const candidate of ["/usr/bin/python3", "/usr/local/bin/python3", "/opt/homebrew/bin/python3"]) {
    const file = toExistingLocalFile(candidate);
    if (file) {
      return { executable: file, argsPrefix: [] };
    }
  }

  const envFile = toExistingLocalFile("/usr/bin/env");
  if (envFile) {
    return { executable: envFile, argsPrefix: ["python3"] };
  }

  return null;
}

async function shutdownExistingLocalBackendServer() {
  for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
    const base = trimTrailingSlash(candidate);
    if (!base) {
      continue;
    }
    try {
      await fetchWithTimeout(`${base}/shutdown`, { method: "POST", cache: "no-store" }, 1200);
    }
    catch (_error) {
    }
  }
}

async function startBackendServer(scriptPath, options = {}) {
  const allowReuseExisting = options.allowReuseExisting !== false;

  if (_backendProcess) {
    return;
  }

  if (allowReuseExisting) {
    const alreadyHealthy = await isBackendHealthy();
    if (alreadyHealthy) {
      _backendManagedByAddon = false;
      if (_lastBackendHealthyBaseURL) {
        Zotero.Prefs.set(PREF_KEYS.remoteBaseURL, _lastBackendHealthyBaseURL, true);
      }
      return;
    }
  }

  if (!scriptPath) {
    return;
  }

  const backendFile = toExistingLocalFile(scriptPath);
  if (!backendFile) {
    Zotero.debug(`fastRead: backend executable is missing at ${scriptPath}`);
    return;
  }
  ensureBackendFileExecutable(backendFile);

  const backendPath = String(backendFile.path || "");
  const isPythonScript = /\.py$/i.test(backendPath);

  let processExecutable = null;
  let args = [];
  if (isPythonScript) {
    if (shouldRequireBundledBackendForCurrentOS()) {
      Zotero.logError("fastRead: Python fallback is disabled on Windows/macOS. Please package bundled backend binary in the XPI.");
      return;
    }

    const pythonCommand = resolvePythonCommandForServer();
    if (!pythonCommand?.executable) {
      Zotero.logError("fastRead: Python runtime not found, cannot start server.py");
      return;
    }

    processExecutable = pythonCommand.executable;
    args = [...pythonCommand.argsPrefix, backendPath];
  }
  else {
    processExecutable = backendFile;
    args = [];
  }

  try {
    const process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    process.init(processExecutable);

    const processObserver = {
      observe(_subject, topic) {
        if (topic !== "process-finished" && topic !== "process-failed") {
          return;
        }
        if (_backendProcess === process) {
          _backendProcess = null;
        }
        _backendProcessObserver = null;
        _backendManagedByAddon = false;
      }
    };

    _backendProcess = process;
    _backendProcessObserver = processObserver;
    _backendManagedByAddon = true;

    if (typeof process.runwAsync === "function") {
      process.runwAsync(args, args.length, processObserver, false);
    }
    else {
      process.runAsync(args, args.length, processObserver, false);
    }

    const healthy = await waitForBackendHealth();
    if (!healthy) {
      Zotero.logError("fastRead: backend process started but /health did not become ready.");
      await stopBackendServer();
      return;
    }

    const resolvedBaseURL = _lastBackendHealthyBaseURL || LOCAL_REMOTE_BASE_URL_CANDIDATES[0];
    if (!readPref(PREF_KEYS.remoteBaseURL) || _backendManagedByAddon) {
      Zotero.Prefs.set(PREF_KEYS.remoteBaseURL, resolvedBaseURL, true);
    }
  }
  catch (error) {
    _backendProcess = null;
    _backendProcessObserver = null;
    _backendManagedByAddon = false;
    Zotero.logError(`fastRead: failed to start backend process: ${error}`);
  }
}

async function stopBackendServer() {
  const processRef = _backendProcess;
  const managedByAddon = _backendManagedByAddon;
  _backendProcess = null;
  _backendProcessObserver = null;
  _backendManagedByAddon = false;

  if (!processRef) {
    cleanupMaterializedBackendExecutable();
    return;
  }

  try {
    if (managedByAddon) {
      const shutdownTargets = _lastBackendHealthyBaseURL
        ? [_lastBackendHealthyBaseURL, ...LOCAL_REMOTE_BASE_URL_CANDIDATES]
        : [...LOCAL_REMOTE_BASE_URL_CANDIDATES];
      for (const candidate of shutdownTargets) {
        const base = trimTrailingSlash(candidate);
        if (!base) {
          continue;
        }
        try {
          await fetchWithTimeout(`${base}/shutdown`, { method: "POST", cache: "no-store" }, 1200);
          break;
        }
        catch (_error) {
        }
      }
    }

    if (managedByAddon && typeof processRef.kill === "function") {
      const down = await waitForBackendDown(3000, 150);
      if (!down) {
        processRef.kill();
      }
    }

    if (managedByAddon) {
      await waitForBackendDown();
    }
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to stop backend process: ${error}`);
  }
  finally {
    cleanupMaterializedBackendExecutable();
  }
}

async function waitForBackendHealth(timeoutMs = 25000, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBackendHealthy()) {
      const endpoint = trimTrailingSlash(_lastBackendHealthyBaseURL);
      const port = extractPortFromURL(endpoint) || "(unknown)";
      if (endpoint) {
        Zotero.debug(`fastRead: backend health ready at ${endpoint}/health (port ${port})`);
      }
      return true;
    }
    await delay(intervalMs);
  }
  return false;
}

async function waitForBackendDown(timeoutMs = 5000, intervalMs = 200) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isBackendHealthy())) {
      return true;
    }
    await delay(intervalMs);
  }
  return false;
}

async function isBackendHealthy() {
  const probeTargets = [];
  const pushProbeTarget = (value) => {
    const normalized = trimTrailingSlash(value);
    if (!normalized || probeTargets.includes(normalized)) {
      return;
    }
    probeTargets.push(normalized);
  };

  pushProbeTarget(_lastBackendHealthyBaseURL);
  const prefBaseURL = trimTrailingSlash(readPref(PREF_KEYS.remoteBaseURL));
  if (isLocalFastReadBaseURL(prefBaseURL)) {
    pushProbeTarget(prefBaseURL);
  }
  for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
    pushProbeTarget(candidate);
  }

  for (const candidate of probeTargets) {
    const target = trimTrailingSlash(candidate);
    if (!target) {
      continue;
    }

    try {
      const response = await fetchWithTimeout(`${target}/health?_ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store"
      }, 1200);
      if (!response.ok) {
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      const service = String(payload?.service || "").toLowerCase();
      const status = String(payload?.status || "").toLowerCase();
      if (service === "fastread-server" && status === "ok") {
        _lastBackendHealthyBaseURL = target;
        return true;
      }
    }
    catch (_error) {
      continue;
    }
  }

  _lastBackendHealthyBaseURL = "";
  return false;
}

function cleanupMaterializedBackendExecutable() {
  if (!_backendExtractedExePath) {
    return;
  }

  const extractedPath = _backendExtractedExePath;

  try {
    const extractedFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    extractedFile.initWithPath(extractedPath);
    if (!extractedFile.exists()) {
      _backendExtractedExePath = "";
      return;
    }

    if (extractedFile.exists()) {
      extractedFile.remove(false);
      _backendExtractedExePath = "";
    }
  }
  catch (error) {
    const message = String(error || "");
    if (message.includes("NS_ERROR_FILE_ACCESS_DENIED")) {
      Zotero.debug(`fastRead: extracted backend is still locked; cleanup will be retried later (${extractedPath}).`);
      return;
    }

    _backendExtractedExePath = "";
    Zotero.logError(`fastRead: failed to clean extracted backend executable: ${error}`);
  }
}

function initializePrefs() {
  for (const [key, value] of Object.entries(PREF_DEFAULTS)) {
    const current = Zotero.Prefs.get(key, true);
    if (current === undefined || current === null) {
      Zotero.Prefs.set(key, value, true);
    }
  }

  Zotero.Prefs.set("extensions.fastread.viewer.autoLoadTranslatedPdf", "true", true);
  Zotero.Prefs.set("extensions.fastread.viewer.syncEnabled", "true", true);
  Zotero.Prefs.set("extensions.fastread.remote.autoTranslateOnOpen", "true", true);
  Zotero.Prefs.set("extensions.fastread.remote.engine", "openai", true);
  Zotero.Prefs.set("extensions.fastread.remote.priority", "normal", true);
}

function toDataURI(text) {
  return `data:application/xhtml+xml;charset=utf-8,${encodeURIComponent(text)}`;
}

function registerReaderHooks() {
  if (typeof Zotero?.Reader?.registerEventListener !== "function") {
    Zotero.logError("fastRead: Zotero.Reader.registerEventListener is unavailable; sidebar trigger cannot be registered.");
    return;
  }

  if (_sidebarTabRegistered) {
    return;
  }

  Zotero.Reader.registerEventListener("renderReader", onReaderRenderReader, ADDON_ID);
  Zotero.Reader.registerEventListener("renderSidebar", onReaderRenderSidebar, ADDON_ID);

  if (Array.isArray(Zotero.Reader?._readers)) {
    for (const reader of Zotero.Reader._readers) {
      const doc = reader?._iframeWindow?.document || null;
      if (doc) {
        ensureSidebarTriggerForReader(reader, doc);
        startSidebarGuard(reader, doc);
      }
    }
  }

  _sidebarTabRegistered = true;
}

function unregisterReaderHooks() {
  if (typeof Zotero.Reader._unregisterEventListenerByPluginID === "function") {
    Zotero.Reader._unregisterEventListenerByPluginID(ADDON_ID);
  }

  if (Array.isArray(Zotero.Reader?._readers)) {
    for (const reader of Zotero.Reader._readers) {
      const doc = reader?._iframeWindow?.document || null;
      if (!doc) {
        continue;
      }
      cleanupSidebarInjection(doc);
    }
  }

  _sidebarTabRegistered = false;
}
async function onReaderRenderSidebar(event) {
  const context = resolveReaderContextFromEvent(event);
  if (!context) {
    return;
  }
  ensureSidebarTriggerForReader(context.reader, context.doc);
}

function onReaderRenderReader(event) {
  const context = resolveReaderContextFromEvent(event);
  if (!context) {
    return;
  }
  ensureSidebarTriggerForReader(context.reader, context.doc);
}

function resolveReaderFromDoc(doc) {
  if (!doc || !Array.isArray(Zotero.Reader?._readers)) {
    return null;
  }
  return Zotero.Reader._readers.find((candidate) => candidate?._iframeWindow?.document === doc) || null;
}

function resolveReaderContextFromEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const doc = event.doc
    || event.document
    || event.target?.ownerDocument
    || event.panel?.ownerDocument
    || event.container?.ownerDocument
    || null;
  const reader = event.reader || resolveReaderFromDoc(doc);

  if (!reader || !doc) {
    return null;
  }

  return { reader, doc };
}

function findSidebarTabsContainer(doc) {
  if (!doc) {
    return null;
  }

  const selectors = [
    "#zotero-context-pane-sidenav .tabs",
    "#zotero-context-pane-sidenav tabs",
    "#zotero-reader-sidebar-pane .tabs",
    "#zotero-reader-sidebar-pane tabs",
    "[id*=reader][id*=sidebar] .tabs",
    "[id*=reader][id*=sidebar] tabs",
    ".reader-sidebar .tabs",
    ".sidebar-tabs",
    "tabbox tabs"
  ];

  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    if (node) {
      return node;
    }
  }

  return null;
}

function createSidebarTriggerNode(doc) {
  const button = doc.createElement("button");
  button.id = FASTREAD_SIDEBAR_TRIGGER_ID;
  button.type = "button";
  button.setAttribute("aria-label", "fastRead 双屏对照");
  button.setAttribute("title", "fastRead 双屏对照");
  button.style.width = "24px";
  button.style.height = "24px";
  button.style.minWidth = "24px";
  button.style.minHeight = "24px";
  button.style.padding = "0";
  button.style.margin = "2px";
  button.style.border = "0";
  button.style.borderRadius = "6px";
  button.style.backgroundImage = `url(${FASTREAD_ICON_BASE64})`;
  button.style.backgroundSize = "16px 16px";
  button.style.backgroundRepeat = "no-repeat";
  button.style.backgroundPosition = "center";
  button.style.backgroundColor = "transparent";
  button.style.cursor = "pointer";
  button.style.flex = "0 0 auto";
  return button;
}

function cleanupSidebarInjection(doc) {
  if (!doc) {
    return;
  }
  const timer = _sidebarGuardIntervals.get(doc);
  if (timer) {
    clearInterval(timer);
    _sidebarGuardIntervals.delete(doc);
  }
  doc.getElementById(FASTREAD_SIDEBAR_TRIGGER_ID)?.remove();
}

function ensureSidebarTriggerForReader(reader, doc) {
  if (!reader || !doc) {
    return;
  }

  const existing = doc.getElementById(FASTREAD_SIDEBAR_TRIGGER_ID);
  if (existing) {
    return;
  }

  const container = findSidebarTabsContainer(doc);
  if (!container) {
    startSidebarGuard(reader, doc);
    return;
  }

  const trigger = createSidebarTriggerNode(doc);
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    launchSplitViewFromSidebar(reader, doc);
  }, true);

  container.appendChild(trigger);
  startSidebarGuard(reader, doc);
}

function startSidebarGuard(reader, doc) {
  if (!reader || !doc || _sidebarGuardIntervals.has(doc)) {
    return;
  }

  const timer = doc.defaultView.setInterval(() => {
    if (!doc.defaultView || doc.defaultView.closed) {
      cleanupSidebarInjection(doc);
      return;
    }

    const container = findSidebarTabsContainer(doc);
    if (!container) {
      return;
    }

    if (!container.querySelector(`#${FASTREAD_SIDEBAR_TRIGGER_ID}`)) {
      const trigger = createSidebarTriggerNode(doc);
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        launchSplitViewFromSidebar(reader, doc);
      }, true);
      container.appendChild(trigger);
    }
  }, SIDEBAR_GUARD_INTERVAL_MS);

  _sidebarGuardIntervals.set(doc, timer);
}

function attachMainWindowHooks() {
  if (_mainWindowListener) {
    return;
  }

  _mainWindowListener = {
    onOpenWindow(xulWindow) {
      const win = xulWindow?.docShell?.domWindow;
      if (!win) {
        return;
      }

      const onLoad = () => {
        win.removeEventListener("load", onLoad, false);
        scheduleMainWindowSetup(win);
      };

      win.addEventListener("load", onLoad, false);
    },
    onCloseWindow(xulWindow) {
      const win = xulWindow?.docShell?.domWindow;
      if (win) {
        cleanupMainWindow(win);
      }
    }
  };

  Services.wm.addListener(_mainWindowListener);
  const mainWin = Zotero.getMainWindow?.() || null;
  if (mainWin) {
    scheduleMainWindowSetup(mainWin);
  }
}

function detachMainWindowHooks() {
  if (_mainWindowListener) {
    Services.wm.removeListener(_mainWindowListener);
    _mainWindowListener = null;
  }

  const maybeCleanup = (enumerator) => {
    while (enumerator.hasMoreElements()) {
      cleanupMainWindow(enumerator.getNext());
    }
  };

  maybeCleanup(Services.wm.getEnumerator("navigator:browser"));
  maybeCleanup(Services.wm.getEnumerator("zotero:main"));
  const mainWin = Zotero.getMainWindow?.() || null;
  if (mainWin) {
    cleanupMainWindow(mainWin);
  }
}

function isMainWindow(win) {
  return !!(win?.document && win?.ZoteroPane);
}

function setupMainWindow(win) {
  if (!isMainWindow(win) || _mainWindowCleanup.has(win)) {
    return false;
  }

  const doc = win.document;
  const popup = doc.getElementById(ITEM_POPUP_ID);
  if (!popup) {
    return false;
  }
  const toolsPopup = findMainWindowToolsPopup(doc);
  if (!toolsPopup) {
    Zotero.debug("fastRead: tools menu popup not found, batch menu item will be unavailable in this window.");
  }

  const menuItem = createMainWindowContextMenuItem(doc);
  const batchToolsMenuItem = createMainWindowBatchToolsMenuItem(doc);
  const onCommand = () => {
    void launchFastReadFromSelectedItem(win);
  };
  const onBatchCommand = () => {
    void openBatchTranslateDialog(win);
  };
  const onPopupShowing = () => {
    updateContextMenuVisibility(win, menuItem);
  };

  menuItem.addEventListener("command", onCommand);
  popup.addEventListener("popupshowing", onPopupShowing);
  popup.appendChild(menuItem);
  if (toolsPopup) {
    batchToolsMenuItem.addEventListener("command", onBatchCommand);
    toolsPopup.appendChild(batchToolsMenuItem);
    Zotero.debug("fastRead: batch translate menu item attached to Tools menu.");
  }
  updateContextMenuVisibility(win, menuItem);

  _mainWindowCleanup.set(win, () => {
    popup.removeEventListener("popupshowing", onPopupShowing);
    menuItem.removeEventListener("command", onCommand);
    menuItem.remove();
    if (toolsPopup) {
      batchToolsMenuItem.removeEventListener("command", onBatchCommand);
      batchToolsMenuItem.remove();
    }
    closeBatchTranslateDialog(win.document);
  });

  win.addEventListener("unload", () => cleanupMainWindow(win), { once: true });
  return true;
}

function cleanupMainWindow(win) {
  cancelPendingMainWindowSetup(win);

  const cleanup = _mainWindowCleanup.get(win);
  if (cleanup) {
    cleanup();
    _mainWindowCleanup.delete(win);
  }
}

function scheduleMainWindowSetup(win) {
  if (!isMainWindow(win) || _mainWindowCleanup.has(win) || _mainWindowPendingSetup.has(win)) {
    return;
  }

  let attempts = 0;
  const trySetup = () => {
    if (!isMainWindow(win) || win.closed) {
      cancelPendingMainWindowSetup(win);
      return;
    }

    const ready = setupMainWindow(win);
    attempts += 1;
    if (ready || attempts >= MAIN_WINDOW_SETUP_MAX_ATTEMPTS) {
      cancelPendingMainWindowSetup(win);
      return;
    }

    const timer = win.setTimeout(trySetup, MAIN_WINDOW_SETUP_RETRY_INTERVAL_MS);
    _mainWindowPendingSetup.set(win, timer);
  };

  const timer = win.setTimeout(trySetup, 0);
  _mainWindowPendingSetup.set(win, timer);
}

function cancelPendingMainWindowSetup(win) {
  const timer = _mainWindowPendingSetup.get(win);
  if (timer) {
    try {
      win.clearTimeout(timer);
    }
    catch (_error) {
    }
    _mainWindowPendingSetup.delete(win);
  }
}

function createMainWindowContextMenuItem(doc) {
  const existing = doc.getElementById(FASTREAD_CONTEXT_MENU_ITEM_ID);
  if (existing) {
    return existing;
  }

  const menuitem = typeof doc.createXULElement === "function"
    ? doc.createXULElement("menuitem")
    : doc.createElement("menuitem");
  menuitem.id = FASTREAD_CONTEXT_MENU_ITEM_ID;
  menuitem.setAttribute("label", "fastRead 对照阅读");
  menuitem.setAttribute("class", "menuitem-iconic");
  menuitem.setAttribute("image", FASTREAD_ICON_BASE64);
  return menuitem;
}

function createMainWindowBatchToolsMenuItem(doc) {
  const existing = doc.getElementById(FASTREAD_BATCH_TOOLS_MENU_ITEM_ID);
  if (existing) {
    return existing;
  }

  const menuitem = typeof doc.createXULElement === "function"
    ? doc.createXULElement("menuitem")
    : doc.createElement("menuitem");
  menuitem.id = FASTREAD_BATCH_TOOLS_MENU_ITEM_ID;
  menuitem.setAttribute("label", "fastRead批量翻译");
  menuitem.setAttribute("class", "menuitem-iconic");
  menuitem.setAttribute("image", FASTREAD_ICON_BASE64);
  return menuitem;
}

function findMainWindowToolsPopup(doc) {
  if (!doc) {
    return null;
  }

  const popupIDs = [
    "menu_ToolsPopup",
    "toolsMenuPopup",
    "menuToolsPopup"
  ];
  for (const id of popupIDs) {
    const node = doc.getElementById(id);
    if (node) {
      return node;
    }
  }

  const toolsMenu = doc.getElementById("menu_Tools") || doc.getElementById("tools-menu");
  if (!toolsMenu) {
    return null;
  }

  const popup = toolsMenu.querySelector("menupopup");
  return popup || null;
}

function createHTMLElement(doc, tagName) {
  if (typeof doc?.createElementNS === "function") {
    return doc.createElementNS("http://www.w3.org/1999/xhtml", tagName);
  }
  return doc.createElement(tagName);
}

function buildBatchTranslateDialogNode(doc) {
  const overlay = createHTMLElement(doc, "div");
  overlay.id = FASTREAD_BATCH_DIALOG_ID;

  const styleNode = createHTMLElement(doc, "style");
  styleNode.textContent = `
    #${FASTREAD_BATCH_DIALOG_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, #0b1020 32%, transparent);
      backdrop-filter: blur(2px);
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-card {
      width: min(760px, calc(100vw - 56px));
      max-height: min(80vh, 760px);
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 18px;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--material-foreground) 15%, transparent);
      background: color-mix(in srgb, var(--material-background) 90%, #ffffff 10%);
      box-shadow: 0 12px 38px rgba(0, 0, 0, 0.2);
      color: var(--material-foreground);
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-title {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 700;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-subtitle {
      margin: 0;
      font-size: 12px;
      color: color-mix(in srgb, var(--material-foreground) 65%, transparent);
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-library-row {
      display: grid;
      grid-template-columns: 90px minmax(0, 1fr) auto auto;
      gap: 8px;
      align-items: center;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-label {
      font-size: 12px;
      font-weight: 600;
      color: color-mix(in srgb, var(--material-foreground) 70%, transparent);
      letter-spacing: 0.01em;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-select {
      width: 100%;
      min-height: 30px;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--material-foreground) 16%, transparent);
      background: color-mix(in srgb, var(--material-background) 92%, #ffffff 8%);
      color: var(--material-foreground);
      padding: 4px 8px;
      font-size: 12px;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-select:focus {
      outline: none;
      border-color: #2f6df6;
      box-shadow: 0 0 0 2px color-mix(in srgb, #2f6df6 18%, transparent);
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-btn {
      border: 1px solid color-mix(in srgb, #2f6df6 42%, transparent);
      background: color-mix(in srgb, #2f6df6 12%, var(--material-background));
      color: var(--material-foreground);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-btn[disabled] {
      opacity: 0.68;
      cursor: wait;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-progress-wrap {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: color-mix(in srgb, var(--material-foreground) 10%, transparent);
      transition: opacity 180ms ease;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-progress {
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #2f6df6 0%, #46a0ff 100%);
      transition: width 200ms ease;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-status {
      margin: 0;
      font-size: 12px;
      color: color-mix(in srgb, var(--material-foreground) 70%, transparent);
      min-height: 1em;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-list {
      margin: 0;
      padding: 0;
      list-style: none;
      overflow: auto;
      max-height: min(42vh, 380px);
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--material-foreground) 12%, transparent);
      background: color-mix(in srgb, var(--material-background) 92%, #ffffff 8%);
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid color-mix(in srgb, var(--material-foreground) 8%, transparent);
      font-size: 12px;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item:last-child {
      border-bottom: 0;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item-main {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item-check {
      width: 14px;
      height: 14px;
      margin: 0;
      accent-color: #2f6df6;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item.is-translated,
    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item.is-unavailable {
      opacity: 0.6;
      background: color-mix(in srgb, var(--material-background) 94%, var(--material-foreground) 6%);
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item-state {
      font-weight: 600;
      color: color-mix(in srgb, var(--material-foreground) 66%, transparent);
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item-state.is-success {
      color: #1d8f5d;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-item-state.is-error {
      color: #b61c3a;
    }
  `;

  const card = createHTMLElement(doc, "div");
  card.className = "zdr-batch-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "fastRead批量翻译");

  const title = createHTMLElement(doc, "h2");
  title.className = "zdr-batch-title";
  const icon = createHTMLElement(doc, "img");
  icon.setAttribute("src", FASTREAD_ICON_BASE64);
  icon.setAttribute("alt", "");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  title.appendChild(icon);
  title.appendChild(doc.createTextNode("fastRead批量翻译"));

  const subtitle = createHTMLElement(doc, "p");
  subtitle.className = "zdr-batch-subtitle";
  subtitle.textContent = "先选择 Zotero 文库/子库，再勾选需要翻译的 PDF。已翻译文件会置灰且不可选。";

  const libraryRow = createHTMLElement(doc, "div");
  libraryRow.className = "zdr-batch-library-row";

  const libraryLabel = createHTMLElement(doc, "label");
  libraryLabel.className = "zdr-batch-label";
  libraryLabel.setAttribute("for", "zdr-batch-library");
  libraryLabel.textContent = "文库/子库";

  const librarySelect = createHTMLElement(doc, "select");
  librarySelect.id = "zdr-batch-library";
  librarySelect.className = "zdr-batch-select";

  const reloadBtn = createHTMLElement(doc, "button");
  reloadBtn.id = "zdr-batch-reload";
  reloadBtn.className = "zdr-batch-btn";
  reloadBtn.setAttribute("type", "button");
  reloadBtn.textContent = "刷新列表";

  const selectAllBtn = createHTMLElement(doc, "button");
  selectAllBtn.id = "zdr-batch-select-all";
  selectAllBtn.className = "zdr-batch-btn";
  selectAllBtn.setAttribute("type", "button");
  selectAllBtn.textContent = "全选未翻译";

  libraryRow.appendChild(libraryLabel);
  libraryRow.appendChild(librarySelect);
  libraryRow.appendChild(reloadBtn);
  libraryRow.appendChild(selectAllBtn);

  const actions = createHTMLElement(doc, "div");
  actions.className = "zdr-batch-actions";

  const startBtn = createHTMLElement(doc, "button");
  startBtn.id = "zdr-batch-start";
  startBtn.className = "zdr-batch-btn";
  startBtn.setAttribute("type", "button");
  startBtn.setAttribute("disabled", "true");
  startBtn.textContent = "开始翻译";

  const closeBtn = createHTMLElement(doc, "button");
  closeBtn.id = "zdr-batch-close";
  closeBtn.className = "zdr-batch-btn";
  closeBtn.setAttribute("type", "button");
  closeBtn.textContent = "关闭";

  actions.appendChild(startBtn);
  actions.appendChild(closeBtn);

  const progressWrap = createHTMLElement(doc, "div");
  progressWrap.id = "zdr-batch-progress-wrap";
  progressWrap.className = "zdr-batch-progress-wrap";
  progressWrap.style.opacity = "0";

  const progress = createHTMLElement(doc, "div");
  progress.id = "zdr-batch-progress";
  progress.className = "zdr-batch-progress";
  progressWrap.appendChild(progress);

  const statusNode = createHTMLElement(doc, "p");
  statusNode.id = "zdr-batch-status";
  statusNode.className = "zdr-batch-status";
  statusNode.textContent = "请选择文库/子库并勾选要翻译的 PDF 文件。";

  const listNode = createHTMLElement(doc, "ul");
  listNode.id = "zdr-batch-list";
  listNode.className = "zdr-batch-list";

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(libraryRow);
  card.appendChild(actions);
  card.appendChild(progressWrap);
  card.appendChild(statusNode);
  card.appendChild(listNode);

  overlay.appendChild(styleNode);
  overlay.appendChild(card);
  return overlay;
}

async function openBatchTranslateDialog(win) {
  const doc = win?.document;
  if (!doc) {
    return;
  }

  const existing = doc.getElementById(FASTREAD_BATCH_DIALOG_ID);
  if (existing) {
    const startBtn = existing.querySelector("#zdr-batch-start");
    if (startBtn && typeof startBtn.focus === "function") {
      startBtn.focus();
    }
    return;
  }

  const root = doc.documentElement || doc.body;
  if (!root) {
    return;
  }

  const overlay = buildBatchTranslateDialogNode(doc);

  root.appendChild(overlay);
  Zotero.debug("fastRead: batch translate dialog opened.");

  const state = {
    sources: [],
    sourceKey: "",
    files: [],
    loading: false,
    running: false,
    cancelled: false
  };

  const librarySelect = overlay.querySelector("#zdr-batch-library");
  const reloadBtn = overlay.querySelector("#zdr-batch-reload");
  const selectAllBtn = overlay.querySelector("#zdr-batch-select-all");
  const startBtn = overlay.querySelector("#zdr-batch-start");
  const closeBtn = overlay.querySelector("#zdr-batch-close");
  const statusNode = overlay.querySelector("#zdr-batch-status");
  const listNode = overlay.querySelector("#zdr-batch-list");
  const progressWrap = overlay.querySelector("#zdr-batch-progress-wrap");
  const progressNode = overlay.querySelector("#zdr-batch-progress");

  const getSelectedQueue = () => state.files.filter((item) => item.selectable && item.selected);

  const setStatus = (text) => {
    if (statusNode) {
      statusNode.textContent = String(text || "");
    }
  };

  const setProgress = (percent, visible) => {
    const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
    if (progressNode) {
      progressNode.style.width = `${clamped}%`;
    }
    if (progressWrap) {
      progressWrap.style.opacity = visible ? "1" : "0";
    }
  };

  const renderList = () => {
    if (!listNode) {
      return;
    }
    listNode.textContent = "";

    if (!state.files.length) {
      const empty = createHTMLElement(doc, "li");
      empty.className = "zdr-batch-item is-unavailable";

      const emptyName = createHTMLElement(doc, "span");
      emptyName.className = "zdr-batch-item-name";
      emptyName.textContent = "当前文库/子库暂无可处理的 PDF 文件。";

      const emptyStatus = createHTMLElement(doc, "span");
      emptyStatus.className = "zdr-batch-item-state";
      emptyStatus.textContent = "空";

      empty.appendChild(emptyName);
      empty.appendChild(emptyStatus);
      listNode.appendChild(empty);
      return;
    }

    for (const item of state.files) {
      const entry = createHTMLElement(doc, "li");
      entry.className = "zdr-batch-item";
      if (!item.selectable) {
        entry.classList.add(item.translated ? "is-translated" : "is-unavailable");
      }

      const main = createHTMLElement(doc, "label");
      main.className = "zdr-batch-item-main";

      const checkbox = createHTMLElement(doc, "input");
      checkbox.className = "zdr-batch-item-check";
      checkbox.setAttribute("type", "checkbox");
      checkbox.checked = !!item.selected;
      checkbox.disabled = state.running || state.loading || !item.selectable;
      checkbox.addEventListener("change", () => {
        item.selected = !!checkbox.checked;
        if (item.selectable && item.state === "pending") {
          item.stateLabel = item.selected ? "待翻译" : "未选中";
        }
        updateActionButtons();
      });

      const name = createHTMLElement(doc, "span");
      name.className = "zdr-batch-item-name";
      name.textContent = item.fileName;
      main.appendChild(checkbox);
      main.appendChild(name);

      const status = createHTMLElement(doc, "span");
      status.className = "zdr-batch-item-state";
      status.textContent = item.stateLabel || "待处理";
      if (item.state === "done") {
        status.classList.add("is-success");
      }
      else if (item.state === "error") {
        status.classList.add("is-error");
      }

      entry.appendChild(main);
      entry.appendChild(status);
      listNode.appendChild(entry);
    }
  };

  const updateActionButtons = () => {
    const selectedCount = getSelectedQueue().length;

    if (librarySelect) {
      librarySelect.disabled = state.running || state.loading || !state.sources.length;
    }
    if (reloadBtn) {
      reloadBtn.disabled = state.running || state.loading || !state.sourceKey;
    }
    if (selectAllBtn) {
      const hasSelectable = state.files.some((item) => item.selectable && !item.selected);
      selectAllBtn.disabled = state.running || state.loading || !hasSelectable;
    }

    if (startBtn) {
      startBtn.disabled = state.running || state.loading || selectedCount <= 0;
      startBtn.textContent = state.running ? "翻译中..." : "开始翻译";
    }
    if (closeBtn) {
      closeBtn.textContent = state.running ? "停止并关闭" : "关闭";
    }
  };

  const setRunning = (running) => {
    state.running = !!running;
    updateActionButtons();
    renderList();
  };

  const setLoading = (loading) => {
    state.loading = !!loading;
    updateActionButtons();
    renderList();
  };

  const closeDialog = () => {
    if (state.running) {
      state.cancelled = true;
      setStatus("正在停止当前任务，请稍候...");
      return;
    }
    closeBatchTranslateDialog(doc);
  };

  const applySelectAllPending = () => {
    for (const item of state.files) {
      if (!item.selectable) {
        continue;
      }
      item.selected = true;
      if (item.state === "pending") {
        item.stateLabel = "待翻译";
      }
    }
    renderList();
    updateActionButtons();
  };

  const updateSourceSelectOptions = () => {
    if (!librarySelect) {
      return;
    }
    librarySelect.textContent = "";

    for (const source of state.sources) {
      const option = createHTMLElement(doc, "option");
      option.setAttribute("value", source.key);
      option.textContent = source.label;
      librarySelect.appendChild(option);
    }

    if (state.sourceKey) {
      librarySelect.value = state.sourceKey;
    }
  };

  const loadSourceFiles = async (sourceKey) => {
    const source = resolveBatchSourceByKey(state.sources, sourceKey);
    state.sourceKey = source?.key || "";
    updateActionButtons();

    if (!source) {
      state.files = [];
      renderList();
      setStatus("请选择可用文库/子库。");
      return;
    }

    setLoading(true);
    setStatus(`正在读取 ${source.label} 的 PDF 文件...`);
    setProgress(0, false);

    try {
      const loadedFiles = await listBatchPdfFilesBySource(source);
      state.files = loadedFiles;

      const translatableCount = loadedFiles.filter((item) => item.selectable).length;
      const translatedCount = loadedFiles.filter((item) => item.translated).length;
      if (!loadedFiles.length) {
        setStatus(`当前 ${source.label} 没有本地 PDF 文件。请先确保 PDF 已下载。`, "info");
      }
      else {
        setStatus(`${source.label}: 共 ${loadedFiles.length} 个 PDF，可翻译 ${translatableCount} 个，已翻译 ${translatedCount} 个。`);
      }
    }
    catch (error) {
      state.files = [];
      setStatus(`读取文库失败: ${error?.message || error}`);
      Zotero.logError(`fastRead: failed to load library PDFs: ${error}`);
    }
    finally {
      setLoading(false);
    }
  };

  const initializeSources = async () => {
    state.sources = getBatchSources();
    if (!state.sources.length) {
      state.sourceKey = "";
      state.files = [];
      updateSourceSelectOptions();
      renderList();
      setStatus("未找到可用 Zotero 文库/子库。请确认当前账号下存在文库。", "error");
      return;
    }

    const preferredSourceKey = getBatchPreferredSourceKey(win, state.sources);
    state.sourceKey = preferredSourceKey || state.sources[0].key;
    updateSourceSelectOptions();
    await loadSourceFiles(state.sourceKey);
  };

  const startBatchTranslate = async () => {
    if (state.running || state.loading) {
      return;
    }

    const queue = getSelectedQueue();
    if (!queue.length) {
      setStatus("请先勾选至少一个待翻译 PDF。", "info");
      updateActionButtons();
      return;
    }

    state.cancelled = false;
    setRunning(true);
    setProgress(0, true);

    let done = 0;
    let failed = 0;

    try {
      const config = getBatchTranslateConfig();
      const baseURL = await resolveBatchRemoteBaseURL(config);
      if (!baseURL) {
        throw new Error("未探测到可用的任务服务，请先检查本地 fastRead 服务状态。");
      }

      config.baseURL = baseURL;
      setStatus(`已连接任务服务: ${baseURL}`);

      let completedCount = 0;
      let nextIndex = 0;
      const maxParallel = Math.max(1, Math.min(queue.length, 2));

      const runNextTask = async () => {
        while (!state.cancelled) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= queue.length) {
            return;
          }

          const item = queue[index];
          item.state = "running";
          item.stateLabel = "翻译中";
          renderList();
          setStatus(`正在翻译 ${Math.min(completedCount + 1, queue.length)}/${queue.length}: ${item.fileName}`);

          try {
            const createResult = await submitBatchTranslationTask(config, item);
            const completedTask = await pollBatchTaskUntilComplete(config, createResult.taskID);
            await downloadBatchTaskOutput(config, item, completedTask);
            item.state = "done";
            item.stateLabel = "完成";
            item.translated = true;
            item.selectable = false;
            item.selected = false;
            done += 1;
          }
          catch (error) {
            item.state = "error";
            item.stateLabel = `失败: ${truncateForUser(error?.message || String(error || "未知错误"), 36)}`;
            failed += 1;
            Zotero.logError(`fastRead batch translate failed for ${item.filePath}: ${error}`);
          }

          completedCount += 1;
          renderList();
          updateActionButtons();
          setProgress((completedCount / queue.length) * 100, true);
        }
      };

      await Promise.all(Array.from({ length: maxParallel }, () => runNextTask()));

      if (state.cancelled) {
        setStatus(`任务已停止。已完成 ${done} 个，失败 ${failed} 个。`);
      }
      else {
        setStatus(`批量翻译完成：成功 ${done} 个，失败 ${failed} 个。`);
      }
    }
    catch (error) {
      setStatus(`批量翻译启动失败: ${error?.message || error}`);
      Zotero.logError(`fastRead batch translate startup failed: ${error}`);
    }
    finally {
      setRunning(false);
      if (!state.running) {
        win.setTimeout(() => setProgress(100, false), 500);
      }
    }
  };

  librarySelect?.addEventListener("change", () => {
    const nextSourceKey = String(librarySelect.value || "").trim();
    void loadSourceFiles(nextSourceKey);
  });
  reloadBtn?.addEventListener("click", () => {
    void loadSourceFiles(state.sourceKey);
  });
  selectAllBtn?.addEventListener("click", () => {
    applySelectAllPending();
  });
  startBtn?.addEventListener("click", () => {
    void startBatchTranslate();
  });
  closeBtn?.addEventListener("click", closeDialog);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && !state.running) {
      closeDialog();
    }
  });

  await initializeSources();

  if (startBtn && typeof startBtn.focus === "function") {
    startBtn.focus();
  }
}

function closeBatchTranslateDialog(doc) {
  const node = doc?.getElementById?.(FASTREAD_BATCH_DIALOG_ID);
  if (node) {
    node.remove();
  }
}

function updateContextMenuVisibility(win, menuItem) {
  const selected = getSelectedPDFAttachment(win);
  const visible = !!selected;
  menuItem.hidden = !visible;
  menuItem.disabled = !visible;
}

function getSelectedPDFAttachment(win) {
  const items = win?.ZoteroPane?.getSelectedItems?.() || [];
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const first = items[0];
  if (!first || typeof first.isAttachment !== "function" || !first.isAttachment()) {
    return null;
  }

  const contentType = String(first.attachmentContentType || "").toLowerCase();
  if (!contentType.includes("application/pdf")) {
    return null;
  }

  return first;
}

async function launchFastReadFromSelectedItem(win) {
  const pdfItem = getSelectedPDFAttachment(win);
  if (!pdfItem) {
    showConnectionAlert("请选择 PDF 附件后再启动 fastRead。");
    return;
  }

  const itemID = pdfItem.id || pdfItem.itemID;
  if (!itemID) {
    showConnectionAlert("无法解析 PDF 条目 ID。");
    return;
  }

  await Zotero.Reader.open(itemID);
  await delay(120);

  const reader = await waitForReaderByItemID(itemID);
  const doc = reader?._iframeWindow?.document || null;
  if (!reader || !doc) {
    notifyReaderScriptNotReady();
    return;
  }

  launchSplitViewFromSidebar(reader, doc);
}

async function waitForReaderByItemID(itemID, maxAttempts = 25, intervalMs = 120) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (Array.isArray(Zotero.Reader?._readers)) {
      for (const candidate of Zotero.Reader._readers) {
        const candidateID = candidate?._item?.id || candidate?._itemID || candidate?.itemID || null;
        if (candidateID === itemID && candidate?._iframeWindow?.document) {
          return candidate;
        }
      }
    }
    await delay(intervalMs);
  }
  return null;
}

function launchSplitViewFromSidebar(reader, doc) {
  if (!reader || !doc) {
    return;
  }

  if (!Zotero.FastRead) {
    notifyReaderScriptNotReady();
    return;
  }

  if (typeof Zotero.FastRead.launchSplitView === "function") {
    Zotero.FastRead.launchSplitView(reader, doc, { autoTrigger: true });
    return;
  }

  const readerWindow = reader._iframeWindow || null;
  if (typeof Zotero.FastRead.toggleFastReadForWindow === "function") {
    Zotero.FastRead.toggleFastReadForWindow(true, readerWindow, reader, doc);
    return;
  }

  notifyReaderScriptNotReady();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutError(timeoutMs) {
  const error = new Error(`Request timed out after ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const normalizedTimeout = Math.max(500, Number(timeoutMs) || 2500);
  const requestOptions = { ...(options || {}) };

  if (typeof AbortController === "function") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), normalizedTimeout);
    try {
      return await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });
    }
    finally {
      clearTimeout(timer);
    }
  }

  let timer = 0;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(createTimeoutError(normalizedTimeout)), normalizedTimeout);
    });
    return await Promise.race([fetch(url, requestOptions), timeoutPromise]);
  }
  finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function attachPreferenceWindowHooks() {
  _prefWindowListener = {
    onOpenWindow(xulWindow) {
      const win = xulWindow.docShell?.domWindow;
      if (!win) {
        return;
      }

      const onLoad = () => {
        win.removeEventListener("load", onLoad, false);
        if (isPreferencesWindow(win)) {
          setupPreferencesWindow(win);
        }
      };

      win.addEventListener("load", onLoad, false);
    },
    onCloseWindow(xulWindow) {
      const win = xulWindow.docShell?.domWindow;
      if (win) {
        cleanupPreferencesWindow(win);
      }
    }
  };

  Services.wm.addListener(_prefWindowListener);

  const openPrefWindows = Services.wm.getEnumerator("zotero:pref");
  while (openPrefWindows.hasMoreElements()) {
    setupPreferencesWindow(openPrefWindows.getNext());
  }
}

function detachPreferenceWindowHooks() {
  if (_prefWindowListener) {
    Services.wm.removeListener(_prefWindowListener);
    _prefWindowListener = null;
  }

  const openPrefWindows = Services.wm.getEnumerator("zotero:pref");
  while (openPrefWindows.hasMoreElements()) {
    cleanupPreferencesWindow(openPrefWindows.getNext());
  }
}

function isPreferencesWindow(win) {
  return win?.location?.href === "chrome://zotero/content/preferences/preferences.xhtml";
}

function setupPreferencesWindow(win) {
  if (!isPreferencesWindow(win) || _prefWindowCleanup.has(win)) {
    return;
  }

  const observer = new win.MutationObserver(() => {
    attachPreferenceButtons(win.document);
  });

  observer.observe(win.document.documentElement, { childList: true, subtree: true });
  attachPreferenceButtons(win.document);

  _prefWindowCleanup.set(win, () => {
    observer.disconnect();
  });

  win.addEventListener(
    "unload",
    () => {
      cleanupPreferencesWindow(win);
    },
    { once: true }
  );
}

function cleanupPreferencesWindow(win) {
  const cleanup = _prefWindowCleanup.get(win);
  if (cleanup) {
    cleanup();
    _prefWindowCleanup.delete(win);
  }
}

function attachPreferenceButtons(doc) {
  attachButtonHandler(doc, {
    buttonID: "zdr-remote-api-test-btn",
    statusID: "zdr-remote-api-status",
    kind: "remoteApi"
  });
}

function attachButtonHandler(doc, { buttonID, statusID, kind }) {
  const button = doc.getElementById(buttonID);
  if (!button || button.dataset.zdrBound === "1") {
    return;
  }

  button.dataset.zdrBound = "1";
  button.addEventListener("click", () => {
    testConnection(kind, button, doc.getElementById(statusID));
  });
}

async function testConnection(kind, button, statusNode) {
  if (kind === "remoteApi") {
    await testRemoteAPIConnection(button, statusNode);
    return;
  }

  setStatus(statusNode, `未知连接测试类型: ${kind}`, "error");
}

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
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
    return match && match[1] ? match[1] : "";
  }
}

function isLocalFastReadBaseURL(value) {
  const normalized = trimTrailingSlash(value);
  if (!normalized) {
    return false;
  }
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(?:\/.*)?$/i.test(normalized);
}

function buildRemoteTasksAPIURL(baseURL) {
  const base = trimTrailingSlash(baseURL);
  if (!base) {
    return "";
  }
  if (/\/api\/tasks$/i.test(base)) {
    return base;
  }
  if (/\/api$/i.test(base)) {
    return `${base}/tasks`;
  }
  return `${base}/api/tasks`;
}

function isReachableRemoteAPIResponse(response) {
  if (!response) {
    return false;
  }
  return response.ok || response.status === 401 || response.status === 403;
}

async function probeRemoteTasksAPI(baseURL, headers) {
  const normalizedBase = trimTrailingSlash(baseURL);
  const endpoint = buildRemoteTasksAPIURL(normalizedBase);
  if (!endpoint) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(`${endpoint}?page=1&pageSize=1&_ts=${Date.now()}`, {
      method: "GET",
      headers,
      credentials: "include"
    }, 4000);
    const payload = await response.json().catch(() => ({}));
    return {
      baseURL: normalizedBase,
      endpoint,
      response,
      payload,
      reachable: isReachableRemoteAPIResponse(response)
    };
  }
  catch (error) {
    return {
      baseURL: normalizedBase,
      endpoint,
      response: null,
      payload: {},
      reachable: false,
      error
    };
  }
}

function buildRemoteAPIHeaders() {
  const headers = {};
  const apiKey = readPref(PREF_KEYS.remoteApiKey);
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

async function testRemoteAPIConnection(button, statusNode) {
  const configuredBaseURL = trimTrailingSlash(readPref(PREF_KEYS.remoteBaseURL));
  const headers = buildRemoteAPIHeaders();
  const autoDetect = !configuredBaseURL;
  setStatus(statusNode, autoDetect
    ? "未填写 URL，正在自动探测本地任务服务..."
    : "正在测试任务 API 连接...", "info");
  button.disabled = true;

  try {
    if (!configuredBaseURL || isLocalFastReadBaseURL(configuredBaseURL)) {
      await ensureBackendServerStarted();
    }

    let probe = null;

    if (configuredBaseURL) {
      probe = await probeRemoteTasksAPI(configuredBaseURL, headers);
    }
    else {
      for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
        probe = await probeRemoteTasksAPI(candidate, headers);
        if (probe?.reachable) {
          break;
        }
      }
      if (probe?.reachable && probe.baseURL) {
        Zotero.Prefs.set(PREF_KEYS.remoteBaseURL, probe.baseURL, true);
      }
    }

    if (!probe) {
      setStatus(statusNode, "连接失败: 任务 API URL 无效。", "error");
      return;
    }

    if (!probe.response) {
      if (!configuredBaseURL) {
        setStatus(statusNode, "未探测到本地任务服务。请确认 fastRead 插件服务已随 Zotero 启动，或重启 Zotero 后重试。", "error");
      }
      else {
        setStatus(statusNode, `连接失败: 无法访问 ${probe.endpoint}`, "error");
      }
      return;
    }

    if (probe.response.ok) {
      const suffix = configuredBaseURL ? "" : `（自动探测: ${probe.baseURL}）`;
      setStatus(statusNode, `任务 API 连接成功${suffix}。`, "success");
      return;
    }

    if (probe.response.status === 401 || probe.response.status === 403) {
      const suffix = configuredBaseURL ? "" : `（自动探测: ${probe.baseURL}）`;
      setStatus(statusNode, `服务可达${suffix}，但鉴权失败。请检查 Token / API Key。`, "error");
      return;
    }

    const message = probe.payload?.message || probe.payload?.error || probe.response.statusText || "Request failed";
    setStatus(statusNode, `连接失败: HTTP ${probe.response.status} ${message} (${probe.endpoint})`, "error");
  }
  catch (error) {
    setStatus(statusNode, `连接失败: ${error.message}`, "error");
  }
  finally {
    button.disabled = false;
  }
}

function normalizeLibraryID(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return numeric;
}

function getBatchLibraryName(library) {
  const explicitName = String(library?.name || library?.libraryName || "").trim();
  if (explicitName) {
    return explicitName;
  }

  const type = String(library?.libraryType || "").trim().toLowerCase();
  if (type === "user") {
    return "我的文库";
  }
  if (type === "group") {
    return `群组文库 ${normalizeLibraryID(library?.libraryID || library?.id)}`;
  }
  return `文库 ${normalizeLibraryID(library?.libraryID || library?.id)}`;
}

function buildBatchSourceKey(type, id) {
  return `${String(type || "").trim()}:${Number(id || 0)}`;
}

function parseBatchSourceKey(key) {
  const raw = String(key || "").trim();
  const match = raw.match(/^(library|collection):(\d+)$/i);
  if (!match) {
    return { type: "", id: 0 };
  }
  return {
    type: String(match[1] || "").toLowerCase(),
    id: normalizeLibraryID(match[2])
  };
}

function resolveBatchSourceByKey(sources, key) {
  const raw = String(key || "").trim();
  if (!raw || !Array.isArray(sources)) {
    return null;
  }
  return sources.find((source) => source?.key === raw) || null;
}

function toBatchCollectionLabel(name, level) {
  const normalized = String(name || "").trim() || "未命名子库";
  const depth = Math.max(0, Number(level) || 0);
  const prefix = depth > 0 ? "  ".repeat(depth) : "";
  return `${prefix}${normalized}`;
}

function getBatchLibraries() {
  const libraries = Array.isArray(Zotero?.Libraries?.getAll?.())
    ? Zotero.Libraries.getAll()
    : [];

  const byID = new Map();
  for (const library of libraries) {
    const libraryID = normalizeLibraryID(library?.libraryID || library?.id);
    if (!libraryID) {
      continue;
    }

    const name = getBatchLibraryName(library);
    if (!name) {
      continue;
    }

    byID.set(libraryID, {
      libraryID,
      name
    });
  }

  return Array.from(byID.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

function getBatchSources() {
  const libraries = getBatchLibraries();
  const sources = [];

  for (const library of libraries) {
    const libraryID = normalizeLibraryID(library.libraryID);
    if (!libraryID) {
      continue;
    }

    sources.push({
      key: buildBatchSourceKey("library", libraryID),
      type: "library",
      id: libraryID,
      libraryID,
      collectionID: 0,
      label: library.name,
      sortKey: `${library.name}::0`
    });

    const collections = typeof Zotero?.Collections?.getByLibrary === "function"
      ? normalizeItemCollection(Zotero.Collections.getByLibrary(libraryID, true, false))
      : [];

    for (const collection of collections) {
      const collectionID = normalizeLibraryID(collection?.id || collection?.collectionID);
      if (!collectionID) {
        continue;
      }

      const level = Number(collection?.level || 0);
      const name = String(collection?.name || collection?.collectionName || "").trim();
      sources.push({
        key: buildBatchSourceKey("collection", collectionID),
        type: "collection",
        id: collectionID,
        libraryID,
        collectionID,
        label: `${library.name} · ${toBatchCollectionLabel(name, level)}`,
        sortKey: `${library.name}::1::${String(level).padStart(3, "0")}::${name}`
      });
    }
  }

  return sources.sort((left, right) => String(left.sortKey || "").localeCompare(String(right.sortKey || ""), "zh-CN"));
}

function getBatchPreferredSourceKey(win, sources) {
  const selectedAttachment = getSelectedPDFAttachment(win);
  const selectedLibraryID = normalizeLibraryID(selectedAttachment?.libraryID);
  if (!selectedLibraryID || !Array.isArray(sources) || !sources.length) {
    return String(sources?.[0]?.key || "").trim();
  }

  const preferredLibraryKey = buildBatchSourceKey("library", selectedLibraryID);
  if (sources.some((source) => source.key === preferredLibraryKey)) {
    return preferredLibraryKey;
  }

  return String(sources[0].key || "").trim();
}

function normalizeItemCollection(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value[Symbol.iterator] === "function") {
    return Array.from(value).filter(Boolean);
  }
  return [value].filter(Boolean);
}

async function getItemsByIDs(itemIDs) {
  const ids = Array.isArray(itemIDs)
    ? itemIDs.map((id) => Number(id || 0)).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  if (!ids.length) {
    return [];
  }

  if (typeof Zotero?.Items?.getAsync === "function") {
    try {
      const loaded = await Zotero.Items.getAsync(ids);
      return normalizeItemCollection(loaded);
    }
    catch (_error) {
    }
  }

  if (typeof Zotero?.Items?.get === "function") {
    try {
      return normalizeItemCollection(Zotero.Items.get(ids));
    }
    catch (_error) {
    }
  }

  return [];
}

function isPdfAttachmentItem(item) {
  if (!item || typeof item.isAttachment !== "function" || !item.isAttachment()) {
    return false;
  }

  const contentType = String(item.attachmentContentType || item.attachmentMIMEType || "").toLowerCase();
  if (contentType.includes("application/pdf")) {
    return true;
  }

  const fileName = String(item.attachmentFilename || item.attachmentFilenameNormalized || "").toLowerCase();
  return fileName.endsWith(".pdf");
}

async function listLibraryPdfAttachments(libraryID) {
  const normalizedLibraryID = normalizeLibraryID(libraryID);
  if (!normalizedLibraryID) {
    return [];
  }

  const byItemID = new Map();
  try {
    const search = new Zotero.Search();
    search.libraryID = normalizedLibraryID;
    search.addCondition("itemType", "is", "attachment");
    search.addCondition("deleted", "false");
    const itemIDs = await search.search();
    const items = await getItemsByIDs(itemIDs);
    for (const item of items) {
      const itemID = Number(item?.id || item?.itemID || 0);
      if (!itemID || !isPdfAttachmentItem(item)) {
        continue;
      }
      byItemID.set(itemID, item);
    }
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to query library PDFs by search: ${error}`);
  }

  if (!byItemID.size && typeof Zotero?.Items?.getAll === "function") {
    try {
      const fallbackItems = await Zotero.Items.getAll(normalizedLibraryID);
      for (const item of normalizeItemCollection(fallbackItems)) {
        const itemID = Number(item?.id || item?.itemID || 0);
        if (!itemID || !isPdfAttachmentItem(item)) {
          continue;
        }
        byItemID.set(itemID, item);
      }
    }
    catch (error) {
      Zotero.logError(`fastRead: failed fallback listing for library PDFs: ${error}`);
    }
  }

  return Array.from(byItemID.values());
}

function collectCollectionDescendantItemIDs(collection, itemIDs, seenCollectionIDs) {
  if (!collection) {
    return;
  }

  const collectionID = normalizeLibraryID(collection?.id || collection?.collectionID);
  if (collectionID && seenCollectionIDs.has(collectionID)) {
    return;
  }
  if (collectionID) {
    seenCollectionIDs.add(collectionID);
  }

  try {
    const directItemIDs = normalizeItemCollection(collection.getChildItems?.(true, false));
    for (const itemID of directItemIDs) {
      const normalized = normalizeLibraryID(itemID);
      if (normalized) {
        itemIDs.add(normalized);
      }
    }
  }
  catch (_error) {
  }

  try {
    const children = normalizeItemCollection(collection.getChildCollections?.());
    for (const child of children) {
      collectCollectionDescendantItemIDs(child, itemIDs, seenCollectionIDs);
    }
  }
  catch (_error) {
  }
}

function listCollectionDescendantItemIDs(collection) {
  if (!collection) {
    return [];
  }

  const itemIDs = new Set();
  const collectionID = normalizeLibraryID(collection?.id || collection?.collectionID);

  try {
    if (typeof collection.getDescendents === "function") {
      const descendants = normalizeItemCollection(collection.getDescendents(false, "item", false));
      for (const entry of descendants) {
        if (String(entry?.type || "").toLowerCase() !== "item") {
          continue;
        }
        const normalized = normalizeLibraryID(entry?.id);
        if (normalized) {
          itemIDs.add(normalized);
        }
      }
    }
  }
  catch (_error) {
  }

  if (!itemIDs.size && collectionID) {
    collectCollectionDescendantItemIDs(collection, itemIDs, new Set());
  }

  return Array.from(itemIDs.values());
}

function collectAttachmentIDsFromCollectionItems(items) {
  const attachmentIDs = new Set();
  for (const item of normalizeItemCollection(items)) {
    const itemID = normalizeLibraryID(item?.id || item?.itemID);
    if (!itemID) {
      continue;
    }

    const isAttachment = typeof item?.isAttachment === "function" && item.isAttachment();
    if (isAttachment) {
      attachmentIDs.add(itemID);
      continue;
    }

    try {
      if (typeof item?.getAttachments === "function") {
        const children = normalizeItemCollection(item.getAttachments());
        for (const childID of children) {
          const normalized = normalizeLibraryID(childID);
          if (normalized) {
            attachmentIDs.add(normalized);
          }
        }
      }
    }
    catch (_error) {
    }
  }

  return Array.from(attachmentIDs.values());
}

async function getBatchAttachmentFilePath(attachment) {
  if (!attachment) {
    return "";
  }

  try {
    if (typeof attachment.getFilePathAsync === "function") {
      return String(await attachment.getFilePathAsync() || "").trim();
    }
  }
  catch (_error) {
  }

  try {
    if (typeof attachment.getFilePath === "function") {
      return String(attachment.getFilePath() || "").trim();
    }
  }
  catch (_error) {
  }

  return "";
}

function getFileNameFromPath(filePath) {
  const normalized = String(filePath || "").trim();
  if (!normalized) {
    return "";
  }

  const parts = normalized.split(/[\\/]/);
  return String(parts[parts.length - 1] || "").trim();
}

function isTranslatedFileName(fileName) {
  return /^\[fastread\s*译文\]/i.test(String(fileName || "").trim());
}

async function pathExists(filePath) {
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

async function hasBatchTranslatedOutput(filePath, fileName) {
  if (isTranslatedFileName(fileName)) {
    return true;
  }

  const sourceDir = getParentDirectory(filePath);
  if (!sourceDir) {
    return false;
  }

  const parts = splitFileNameAndExt(fileName);
  const translatedCandidates = [
    joinPath(sourceDir, `[fastRead 译文] ${parts.baseName}.${parts.ext || "pdf"}`),
    joinPath(sourceDir, "[fastRead 译文] PDF.pdf")
  ];

  for (const candidate of translatedCandidates) {
    if (!candidate || candidate === filePath) {
      continue;
    }
    if (await pathExists(candidate)) {
      return true;
    }
  }
  return false;
}

async function listBatchLibraryPdfFiles(libraryID) {
  const attachments = await listLibraryPdfAttachments(libraryID);
  const uniqueByPath = new Map();

  for (const attachment of attachments) {
    const itemID = Number(attachment?.id || attachment?.itemID || 0);
    if (!itemID) {
      continue;
    }

    const filePath = await getBatchAttachmentFilePath(attachment);
    const rawName = String(attachment?.attachmentFilename || "").trim();
    const fileName = rawName || getFileNameFromPath(filePath) || `PDF ${itemID}.pdf`;
    const dedupeKey = filePath || `item:${itemID}`;
    if (uniqueByPath.has(dedupeKey)) {
      continue;
    }

    const hasLocalFile = !!filePath;
    const translated = hasLocalFile ? await hasBatchTranslatedOutput(filePath, fileName) : false;
    const selectable = hasLocalFile && !translated;
    let stateLabel = "待翻译";
    if (!hasLocalFile) {
      stateLabel = "未下载";
    }
    else if (translated) {
      stateLabel = "已翻译";
    }

    uniqueByPath.set(dedupeKey, {
      itemID,
      filePath,
      fileName,
      translated,
      selectable,
      selected: false,
      state: "pending",
      stateLabel
    });
  }

  return Array.from(uniqueByPath.values()).sort((left, right) => {
    const leftRank = left.selectable ? 0 : 1;
    const rightRank = right.selectable ? 0 : 1;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.fileName.localeCompare(right.fileName, "zh-CN");
  });
}

async function listBatchCollectionPdfFiles(collectionID) {
  const normalizedCollectionID = normalizeLibraryID(collectionID);
  if (!normalizedCollectionID || typeof Zotero?.Collections?.get !== "function") {
    return [];
  }

  const collection = Zotero.Collections.get(normalizedCollectionID);
  if (!collection) {
    return [];
  }

  const itemIDs = listCollectionDescendantItemIDs(collection);
  const items = await getItemsByIDs(itemIDs);
  const attachmentIDs = collectAttachmentIDsFromCollectionItems(items);
  const attachmentItems = await getItemsByIDs(attachmentIDs);
  const attachments = attachmentItems.filter((item) => isPdfAttachmentItem(item));

  const uniqueByPath = new Map();
  for (const attachment of attachments) {
    const itemID = Number(attachment?.id || attachment?.itemID || 0);
    if (!itemID) {
      continue;
    }

    const filePath = await getBatchAttachmentFilePath(attachment);
    const rawName = String(attachment?.attachmentFilename || "").trim();
    const fileName = rawName || getFileNameFromPath(filePath) || `PDF ${itemID}.pdf`;
    const dedupeKey = filePath || `item:${itemID}`;
    if (uniqueByPath.has(dedupeKey)) {
      continue;
    }

    const hasLocalFile = !!filePath;
    const translated = hasLocalFile ? await hasBatchTranslatedOutput(filePath, fileName) : false;
    const selectable = hasLocalFile && !translated;
    let stateLabel = "待翻译";
    if (!hasLocalFile) {
      stateLabel = "未下载";
    }
    else if (translated) {
      stateLabel = "已翻译";
    }

    uniqueByPath.set(dedupeKey, {
      itemID,
      filePath,
      fileName,
      translated,
      selectable,
      selected: false,
      state: "pending",
      stateLabel
    });
  }

  return Array.from(uniqueByPath.values()).sort((left, right) => {
    const leftRank = left.selectable ? 0 : 1;
    const rightRank = right.selectable ? 0 : 1;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.fileName.localeCompare(right.fileName, "zh-CN");
  });
}

async function listBatchPdfFilesBySource(source) {
  if (!source) {
    return [];
  }

  if (source.type === "collection") {
    return listBatchCollectionPdfFiles(source.collectionID);
  }

  return listBatchLibraryPdfFiles(source.libraryID);
}

function getBatchTranslateConfig() {
  const intervalMs = Math.max(500, Number(readPref(PREF_KEYS.remotePollIntervalMs)) || 1500);
  const timeoutSec = Math.max(30, Number(readPref(PREF_KEYS.remotePollTimeoutSec)) || 600);
  return {
    baseURL: trimTrailingSlash(readPref(PREF_KEYS.remoteBaseURL)),
    apiKey: readPref(PREF_KEYS.remoteApiKey),
    sourceLang: readPref(PREF_KEYS.remoteSourceLang) || "en",
    targetLang: readPref(PREF_KEYS.remoteTargetLang) || "zh",
    modelConfig: readPref(PREF_KEYS.remoteModelConfig),
    engine: "openai",
    priority: "normal",
    pollIntervalMs: intervalMs,
    pollTimeoutMs: timeoutSec * 1000
  };
}

function resolveBatchCreateTimeoutMs(config, fileSizeBytes) {
  const minimumMs = 300000;
  const pollBudgetMs = Math.max(minimumMs, Number(config?.pollTimeoutMs) || 0);
  const estimatedUploadMs = Math.ceil(Math.max(0, Number(fileSizeBytes) || 0) / (256 * 1024)) * 1000;
  const candidateMs = Math.max(minimumMs, 120000 + estimatedUploadMs);
  return Math.min(Math.max(minimumMs, candidateMs), pollBudgetMs);
}

function resolveBatchDetailRequestTimeoutMs(config) {
  const intervalMs = Math.max(500, Number(config?.pollIntervalMs) || 1500);
  return Math.max(10000, Math.min(45000, intervalMs * 4));
}

async function resolveBatchRemoteBaseURL(config) {
  const headers = buildBatchRemoteHeaders(config);
  const forceLocalBackend = shouldRequireBundledBackendForCurrentOS();
  const explicit = trimTrailingSlash(config?.baseURL);
  if (explicit && !forceLocalBackend) {
    if (isLocalFastReadBaseURL(explicit)) {
      await ensureBackendServerStarted();
    }
    const explicitProbe = await probeRemoteTasksAPI(explicit, headers);
    if (explicitProbe?.reachable) {
      return explicit;
    }
  }

  await ensureBackendServerStarted();
  for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
    const probe = await probeRemoteTasksAPI(candidate, headers);
    if (!probe?.reachable || !probe.baseURL) {
      continue;
    }

    Zotero.Prefs.set(PREF_KEYS.remoteBaseURL, probe.baseURL, true);
    return trimTrailingSlash(probe.baseURL);
  }

  return "";
}

function buildBatchRemoteHeaders(config) {
  const headers = {};
  const apiKey = String(config?.apiKey || "").trim();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

function buildBatchCreateTaskURL(baseURL) {
  const normalized = trimTrailingSlash(baseURL);
  if (!normalized) {
    return "";
  }
  if (/\/api\/tasks$/i.test(normalized)) {
    return normalized;
  }
  if (/\/api$/i.test(normalized)) {
    return `${normalized}/tasks`;
  }
  return `${normalized}/api/tasks`;
}

function buildBatchDetailTaskURL(baseURL, taskID) {
  const normalized = trimTrailingSlash(baseURL);
  const encodedID = encodeURIComponent(String(taskID || "").trim());
  if (!normalized || !encodedID) {
    return "";
  }
  if (/\/api\/tasks$/i.test(normalized)) {
    return `${normalized}/${encodedID}`;
  }
  if (/\/api$/i.test(normalized)) {
    return `${normalized}/tasks/${encodedID}`;
  }
  return `${normalized}/api/tasks/${encodedID}`;
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

function buildMultipartPayload(fileName, fileBytes, fields) {
  if (typeof FormData === "function" && typeof Blob === "function") {
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields || {})) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      formData.append(String(name), String(value));
    }

    const safeFileName = sanitizeMultipartToken(fileName || "document.pdf");
    const pdfBlob = new Blob([toUint8Array(fileBytes)], { type: "application/pdf" });
    formData.append("file", pdfBlob, safeFileName);
    return {
      body: formData,
      contentType: ""
    };
  }

  const boundary = `----fastread-batch-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const encoder = getTextEncoder();
  const chunks = [];

  const pushText = (text) => {
    chunks.push(encoder.encode(String(text || "")));
  };

  for (const [name, value] of Object.entries(fields || {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const safeName = sanitizeMultipartToken(name);
    pushText(`--${boundary}\r\n`);
    pushText(`Content-Disposition: form-data; name="${safeName}"\r\n\r\n`);
    pushText(`${String(value)}\r\n`);
  }

  const safeFileName = sanitizeMultipartToken(fileName || "document.pdf");
  pushText(`--${boundary}\r\n`);
  pushText(`Content-Disposition: form-data; name="file"; filename="${safeFileName}"\r\n`);
  pushText("Content-Type: application/pdf\r\n\r\n");
  chunks.push(toUint8Array(fileBytes));
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

async function readPdfFileBytes(filePath) {
  if (typeof IOUtils !== "undefined" && typeof IOUtils.read === "function") {
    return IOUtils.read(filePath);
  }
  throw new Error("当前环境不支持读取文件（缺少 IOUtils.read）。");
}

function extractTaskID(payload) {
  const task = payload?.task || payload?.data?.task || payload?.data || payload || {};
  return task?.id || task?.taskId || task?.task_id || "";
}

function extractTaskStatus(payload) {
  const task = payload?.task || payload?.data?.task || payload?.data || payload || {};
  return String(task?.status || "").trim().toLowerCase();
}

function extractTaskError(payload) {
  const task = payload?.task || payload?.data?.task || payload?.data || payload || {};
  const value = task?.error || task?.message || payload?.message || "";
  return String(value || "").trim();
}

function extractMonoOutputUrl(payload) {
  const task = payload?.task || payload?.data?.task || payload?.data || payload || {};
  return task?.monoOutputUrl
    || task?.mono_output_url
    || task?.output?.monoOutputUrl
    || task?.output?.mono_output_url
    || task?.dualOutputUrl
    || task?.dual_output_url
    || "";
}

async function submitBatchTranslationTask(config, fileInfo) {
  const fileBytes = await readPdfFileBytes(fileInfo.filePath);
  if (!fileBytes?.length) {
    throw new Error("读取 PDF 失败，文件内容为空。");
  }

  const fields = {
    documentName: fileInfo.fileName,
    taskType: "translation",
    sourceLang: config.sourceLang,
    targetLang: config.targetLang,
    engine: config.engine,
    priority: config.priority,
    modelConfig: config.modelConfig
  };
  const multipart = buildMultipartPayload(fileInfo.fileName, fileBytes, fields);
  const createTimeoutMs = resolveBatchCreateTimeoutMs(config, fileBytes.length);

  const headers = buildBatchRemoteHeaders(config);
  if (multipart.contentType) {
    headers["Content-Type"] = multipart.contentType;
  }

  const candidateBases = [];
  const seenBase = new Set();
  const pushCandidateBase = (baseValue) => {
    const normalized = trimTrailingSlash(baseValue);
    if (!normalized || seenBase.has(normalized)) {
      return;
    }
    seenBase.add(normalized);
    candidateBases.push(normalized);
  };

  pushCandidateBase(config?.baseURL);
  if (shouldRequireBundledBackendForCurrentOS() || isLocalFastReadBaseURL(config?.baseURL)) {
    for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
      pushCandidateBase(candidate);
    }
  }

  let lastTimeoutError = null;
  for (const candidateBase of candidateBases) {
    const createURL = buildBatchCreateTaskURL(candidateBase);
    if (!createURL) {
      continue;
    }

    if (isLocalFastReadBaseURL(candidateBase)) {
      await ensureBackendServerStarted();
    }

    let response = null;
    try {
      response = await fetchWithTimeout(createURL, {
        method: "POST",
        headers,
        credentials: "include",
        body: multipart.body
      }, createTimeoutMs);
    }
    catch (error) {
      if (error?.name === "TimeoutError") {
        lastTimeoutError = error;
        if (isLocalFastReadBaseURL(candidateBase)) {
          await ensureBackendServerStarted();
          continue;
        }
      }
      throw error;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = extractTaskError(payload) || `${response.status} ${response.statusText}`;
      throw new Error(`创建翻译任务失败: ${message}`);
    }

    const taskID = extractTaskID(payload);
    if (!taskID) {
      throw new Error("创建任务成功，但响应缺少任务 ID。");
    }

    if (config.baseURL !== candidateBase) {
      config.baseURL = candidateBase;
      Zotero.Prefs.set(PREF_KEYS.remoteBaseURL, candidateBase, true);
    }

    return {
      taskID,
      payload
    };
  }

  if (lastTimeoutError) {
    throw new Error(`创建翻译任务超时（${createTimeoutMs}ms）：本地服务未及时响应，请稍后重试。`);
  }
  throw new Error("创建翻译任务失败：未找到可用任务服务地址。");
}

async function pollBatchTaskUntilComplete(config, taskID) {
  const detailURL = buildBatchDetailTaskURL(config?.baseURL, taskID);
  if (!detailURL) {
    throw new Error("任务详情 URL 无效。");
  }

  const startedAt = Date.now();
  const detailRequestTimeoutMs = resolveBatchDetailRequestTimeoutMs(config);
  while (Date.now() - startedAt < config.pollTimeoutMs) {
    const response = await fetchWithTimeout(`${detailURL}?_ts=${Date.now()}`, {
      method: "GET",
      headers: buildBatchRemoteHeaders(config),
      credentials: "include"
    }, detailRequestTimeoutMs);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = extractTaskError(payload) || `${response.status} ${response.statusText}`;
      throw new Error(`查询任务状态失败: ${message}`);
    }

    const status = extractTaskStatus(payload);
    if (status === "completed") {
      return payload;
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      const message = extractTaskError(payload) || status;
      throw new Error(`远程翻译任务失败: ${message}`);
    }

    await delay(config.pollIntervalMs);
  }

  throw new Error("等待任务完成超时。");
}

function resolveBatchOutputURL(baseURL, outputURL) {
  const raw = String(outputURL || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const base = trimTrailingSlash(baseURL);
  if (!base) {
    return raw;
  }
  return `${base}/${raw.replace(/^\/+/, "")}`;
}

function splitFileNameAndExt(fileName) {
  const raw = String(fileName || "").trim() || "document.pdf";
  const dot = raw.lastIndexOf(".");
  if (dot <= 0 || dot === raw.length - 1) {
    return { baseName: raw, ext: "pdf" };
  }
  return {
    baseName: raw.slice(0, dot),
    ext: raw.slice(dot + 1)
  };
}

function getParentDirectory(filePath) {
  const target = String(filePath || "").trim();
  if (!target) {
    return "";
  }
  if (typeof PathUtils !== "undefined" && typeof PathUtils.parent === "function") {
    try {
      return String(PathUtils.parent(target) || "").trim();
    }
    catch (_error) {
    }
  }

  const lastSep = Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"));
  return lastSep > 0 ? target.slice(0, lastSep) : "";
}

function joinPath(basePath, fileName) {
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

async function writeBinaryFile(filePath, bytes) {
  if (typeof IOUtils !== "undefined" && typeof IOUtils.write === "function") {
    await IOUtils.write(filePath, bytes);
    return;
  }
  throw new Error("当前环境不支持写入文件（缺少 IOUtils.write）。");
}

async function downloadBatchTaskOutput(config, fileInfo, payload) {
  const rawOutputURL = extractMonoOutputUrl(payload);
  const outputURL = resolveBatchOutputURL(config?.baseURL, rawOutputURL);
  if (!outputURL) {
    throw new Error("任务已完成，但返回结果缺少输出文件 URL。");
  }

  const response = await fetchWithTimeout(outputURL, {
    method: "GET",
    credentials: "include"
  }, 60000);
  if (!response.ok) {
    throw new Error(`下载译文失败: ${response.status} ${response.statusText}`);
  }

  const sourceDir = getParentDirectory(fileInfo.filePath);
  if (!sourceDir) {
    throw new Error("无法确定原文件目录。\n请确认文件路径可访问。");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) {
    throw new Error("下载译文失败：返回文件为空。");
  }

  const parts = splitFileNameAndExt(fileInfo.fileName);
  const outputName = `[fastRead 译文] ${parts.baseName}.${parts.ext || "pdf"}`;
  const outputPath = joinPath(sourceDir, outputName);
  await writeBinaryFile(outputPath, bytes);
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

function truncateForUser(text, maxLength) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) {
    return "(空响应)";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function extractAPIError(payload, rawResponseText) {
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  if (typeof payload?.error?.message === "string" && payload.error.message.trim()) {
    return payload.error.message.trim();
  }
  return truncateForUser(rawResponseText, 140);
}

function logRawResponse(prefix, rawResponseText) {
  const message = String(rawResponseText || "");
  if (typeof Zotero?.debug === "function") {
    Zotero.debug(`${prefix}: ${message}`);
  }
  if (typeof console !== "undefined" && typeof console.log === "function") {
    console.log(`${prefix}: ${message}`);
  }
}

function showConnectionAlert(message) {
  try {
    Services?.prompt?.alert(null, "fastRead", message);
  }
  catch (_error) {
  }
}

function notifyReaderScriptNotReady(_win) {
  showConnectionAlert("Plugin script not loaded yet, please try again.");
}

function readPref(key) {
  const value = Zotero.Prefs.get(key, true);
  return typeof value === "string" ? value.trim() : "";
}

function setStatus(statusNode, text, level) {
  if (!statusNode) {
    return;
  }
  statusNode.textContent = text;
  statusNode.classList.remove("is-success", "is-error");
  if (level === "success") {
    statusNode.classList.add("is-success");
  }
  else if (level === "error") {
    statusNode.classList.add("is-error");
  }
}
