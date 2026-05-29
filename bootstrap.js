const ADDON_ID = "fastread@example.com";
const FASTREAD_BOOTSTRAP_VERSION = "0.2.14-stable-anchor-cancel-20260529";

function fastReadBootstrapLog(message, level = "debug") {
  const text = `[fastRead][bootstrap ${FASTREAD_BOOTSTRAP_VERSION}] ${String(message || "")}`;
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

const PREF_KEYS = Object.freeze({
  syncMode: "extensions.fastread.viewer.syncMode",
  remoteBaseURL: "extensions.fastread.remote.baseURL",
  remoteApiKey: "extensions.fastread.remote.apiKey",
  remoteProvider: "extensions.fastread.remote.providerConfigId",
  remoteModel: "extensions.fastread.remote.model",
  remoteActiveModelId: "extensions.fastread.remote.activeModelId",
  remoteSourceLang: "extensions.fastread.remote.sourceLang",
  remoteTargetLang: "extensions.fastread.remote.targetLang",
  remoteModelConfig: "extensions.fastread.remote.modelConfig",
  remotePollIntervalMs: "extensions.fastread.remote.pollIntervalMs",
  remotePollTimeoutSec: "extensions.fastread.remote.pollTimeoutSec"
});

const PREF_DEFAULTS = Object.freeze({
  [PREF_KEYS.syncMode]: "page",
  [PREF_KEYS.remoteBaseURL]: "",
  [PREF_KEYS.remoteApiKey]: "",
  [PREF_KEYS.remoteProvider]: "deepseek",
  [PREF_KEYS.remoteModel]: "deepseek-chat",
  [PREF_KEYS.remoteActiveModelId]: "",
  [PREF_KEYS.remoteSourceLang]: "en",
  [PREF_KEYS.remoteTargetLang]: "zh",
  [PREF_KEYS.remoteModelConfig]: "",
  [PREF_KEYS.remotePollIntervalMs]: "700",
  [PREF_KEYS.remotePollTimeoutSec]: "7200"
});

const AI_PROVIDER_PRESETS = Object.freeze([
  {
    id: "deepseek",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"]
  },
  {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "o3-mini"]
  },
  {
    id: "qwen",
    label: "Qwen (DashScope)",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen2.5-72b-instruct"]
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "deepseek/deepseek-chat", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash"]
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    endpoint: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct", "meta-llama/Meta-Llama-3.1-70B-Instruct"]
  },
  {
    id: "moonshot",
    label: "Moonshot",
    endpoint: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]
  },
  {
    id: "together",
    label: "Together",
    endpoint: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    models: ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3"]
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    endpoint: "https://api.x.ai/v1",
    defaultModel: "grok-2-latest",
    models: ["grok-2-latest", "grok-2-vision-latest"]
  }
]);

const MAINSTREAM_MODEL_OPTIONS = Object.freeze(Array.from(new Set(
  AI_PROVIDER_PRESETS.flatMap((preset) => preset.models || [])
)));

const PROVIDER_OPTIONS_HTML = AI_PROVIDER_PRESETS
  .map((preset) => `<html:option value="${preset.id}">${preset.label}</html:option>`)
  .join("\n");

const MODEL_OPTIONS_HTML = MAINSTREAM_MODEL_OPTIONS
  .map((model) => `<html:option value="${model}">${model}</html:option>`)
  .join("\n");

const MODEL_CONFIG_SAMPLE_JSON = `{
  "endpoint": "https://api.deepseek.com/v1",
  "model": "deepseek-chat",
  "systemPrompt": "You are a professional academic translator. Translate accurately and naturally.",
  "apiKey": "sk-optional-if-you-prefer-json-key"
}`;

const PROVIDER_TEST_TIMEOUT_MS = 60000;
const PROVIDER_TEST_RETRY_TIMEOUT_MS = 120000;
const LEGACY_FALLBACK_TASK_WAIT_MS = 45000;
const TRANSLATED_PDF_FILE_NAME = "[fastRead 译文].pdf";
const LEGACY_TRANSLATED_PDF_FILE_NAMES = Object.freeze([
  "[fastRead 译文] PDF.pdf"
]);

const AI_TEST_MINIMAL_PDF_CONTENT = `%PDF-1.3
%FASTREAD
1 0 obj
<<
/Producer (pypdf)
>>
endobj
2 0 obj
<<
/Type /Pages
/Count 1
/Kids [ 4 0 R ]
>>
endobj
3 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
4 0 obj
<<
/Type /Page
/Resources <<
>>
/MediaBox [ 0.0 0.0 612 792 ]
/Parent 2 0 R
>>
endobj
xref
0 5
0000000000 65535 f 
0000000015 00000 n 
0000000054 00000 n 
0000000113 00000 n 
0000000162 00000 n 
trailer
<<
/Size 5
/Root 3 0 R
/Info 1 0 R
>>
startxref
256
%%EOF
`;

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

    #zdr-pref-root .zdr-json-example {
      margin: 0;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--zdr-border);
      background: color-mix(in srgb, var(--zdr-bg) 88%, #111827 12%);
      color: var(--zdr-title);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }

    #zdr-pref-root .zdr-profile-list {
      margin-top: 10px;
      display: grid;
      gap: 8px;
    }

    #zdr-pref-root .zdr-profile-row {
      border: 1px solid var(--zdr-border);
      border-radius: 10px;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--zdr-bg) 94%, #0f172a 6%);
      display: grid;
      gap: 8px;
    }

    #zdr-pref-root .zdr-profile-title {
      margin: 0;
      color: var(--zdr-title);
      font-size: 13px;
      font-weight: 600;
      word-break: break-all;
    }

    #zdr-pref-root .zdr-profile-meta {
      margin: 0;
      color: var(--zdr-subtitle);
      font-size: 12px;
      line-height: 1.35;
      word-break: break-all;
    }

    #zdr-pref-root .zdr-profile-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
  </html:style>

  <html:section class="zdr-pref-grid">
    <html:article class="zdr-pref-card" id="zdr-active-model-card">
      <html:h2 class="zdr-card-title">当前启用模型</html:h2>
      <html:p class="zdr-card-subtitle">从已配置模型中选择本次翻译默认使用的模型配置。</html:p>
      <html:div class="zdr-form-grid">
        <html:label class="zdr-label" for="zdr-active-model-select">启用模型</html:label>
        <html:select id="zdr-active-model-select" class="zdr-input" preference="${PREF_KEYS.remoteActiveModelId}">
          <html:option value="">默认（当前提供商 / 模型）</html:option>
        </html:select>
      </html:div>
      <html:p id="zdr-active-model-status" class="zdr-status" />
    </html:article>

    <html:article class="zdr-pref-card" id="zdr-remote-api-card">
      <html:h2 class="zdr-card-title">AI 翻译配置</html:h2>
      <html:p class="zdr-card-subtitle">选择 AI 提供商与模型。插件会优先使用本地译文，缺失时自动提交任务。</html:p>
      <html:div class="zdr-form-grid">
        <html:label class="zdr-label" for="zdr-remote-api-key">X-API-Key（必填）</html:label>
        <html:input
          id="zdr-remote-api-key"
          class="zdr-input"
          type="password"
          autocomplete="off"
          preference="${PREF_KEYS.remoteApiKey}" />

        <html:label class="zdr-label" for="zdr-remote-provider">AI 提供商</html:label>
        <html:select id="zdr-remote-provider" class="zdr-input" preference="${PREF_KEYS.remoteProvider}">
          ${PROVIDER_OPTIONS_HTML}
        </html:select>

        <html:label class="zdr-label" for="zdr-remote-model">模型名称</html:label>
        <html:input
          id="zdr-remote-model"
          class="zdr-input"
          type="text"
          list="zdr-remote-model-list"
          placeholder="deepseek-chat"
          preference="${PREF_KEYS.remoteModel}" />
        <html:datalist id="zdr-remote-model-list">
          ${MODEL_OPTIONS_HTML}
        </html:datalist>

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

      </html:div>

      <html:div class="zdr-action-row">
        <html:button id="zdr-remote-api-test-btn-primary" class="zdr-btn" type="button">测试 AI 连接</html:button>
        <html:p id="zdr-remote-api-status-primary" class="zdr-status" />
      </html:div>

    </html:article>

    <html:article class="zdr-pref-card" id="zdr-provider-json-card">
      <html:h2 class="zdr-card-title">AI 源配置 JSON</html:h2>
      <html:p class="zdr-card-subtitle">每次输入一个 JSON 配置并添加到列表；列表中的每项都可单独测试连接。</html:p>
      <html:pre class="zdr-json-example">${MODEL_CONFIG_SAMPLE_JSON}</html:pre>
      <html:div class="zdr-form-grid">
        <html:label class="zdr-label" for="zdr-json-profile-input">新增 JSON 配置</html:label>
        <html:textarea
          id="zdr-json-profile-input"
          class="zdr-input"
          rows="6"
          placeholder='${MODEL_CONFIG_SAMPLE_JSON}' />
      </html:div>

      <html:div class="zdr-action-row">
        <html:button id="zdr-json-profile-add-btn" class="zdr-btn" type="button">添加到列表</html:button>
        <html:p id="zdr-json-profile-add-status" class="zdr-status" />
      </html:div>

      <html:div id="zdr-json-profile-list" class="zdr-profile-list" />
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
const BACKEND_STOP_BRIDGE_GLOBAL_NAME = "ZoteroFastReadStopLocalBackend";

function install() {}

async function startup(addonData) {
  const rawRootURI = String(addonData?.rootURI || "");
  _rootURI = rawRootURI && !rawRootURI.endsWith("/") ? `${rawRootURI}/` : rawRootURI;
  fastReadBootstrapLog(`startup begin: rootURI=${_rootURI}`);
  installBackendBridge();
  startBackendServerInBackground();
  initializePrefs();
  try {
    fastReadBootstrapLog("loading reader-script.js");
    Services.scriptloader.loadSubScript(`${_rootURI}reader-script.js`);
    if (!Zotero.FastRead) {
      throw new Error("Zotero.FastRead was not attached.");
    }
    fastReadBootstrapLog(`reader-script loaded: apiVersion=${Zotero.FastRead.__fastReadScriptVersion || "unknown"}`);
    _readerScriptLoaded = true;
  }
  catch (error) {
    fastReadBootstrapLog(`failed to load reader-script.js: ${error?.message || error}`, "error");
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
    fastReadBootstrapLog("startup hooks attached");
  }
  catch (error) {
    fastReadBootstrapLog(`failed to attach hooks: ${error?.message || error}`, "error");
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
  const ensureBridge = async function ensureFastReadLocalBackend() {
    return ensureBackendServerStarted();
  };
  const stopBridge = async function stopFastReadLocalBackend() {
    await forceStopBackendServer();
    return true;
  };

  try {
    globalThis[BACKEND_BRIDGE_GLOBAL_NAME] = ensureBridge;
    globalThis[BACKEND_STOP_BRIDGE_GLOBAL_NAME] = stopBridge;
  }
  catch (_error) {
  }

  try {
    const mainWin = Zotero.getMainWindow?.() || null;
    if (mainWin) {
      mainWin[BACKEND_BRIDGE_GLOBAL_NAME] = ensureBridge;
      mainWin[BACKEND_STOP_BRIDGE_GLOBAL_NAME] = stopBridge;
      if (mainWin.wrappedJSObject) {
        mainWin.wrappedJSObject[BACKEND_BRIDGE_GLOBAL_NAME] = ensureBridge;
        mainWin.wrappedJSObject[BACKEND_STOP_BRIDGE_GLOBAL_NAME] = stopBridge;
      }
    }
  }
  catch (_error) {
  }
}

function uninstallBackendBridge() {
  try {
    delete globalThis[BACKEND_BRIDGE_GLOBAL_NAME];
  }
  catch (_error) {
  }
  try {
    delete globalThis[BACKEND_STOP_BRIDGE_GLOBAL_NAME];
  }
  catch (_error) {
  }
  try {
    const mainWin = Zotero.getMainWindow?.() || null;
    if (mainWin) {
      delete mainWin[BACKEND_BRIDGE_GLOBAL_NAME];
      delete mainWin[BACKEND_STOP_BRIDGE_GLOBAL_NAME];
      if (mainWin.wrappedJSObject) {
        delete mainWin.wrappedJSObject[BACKEND_BRIDGE_GLOBAL_NAME];
        delete mainWin.wrappedJSObject[BACKEND_STOP_BRIDGE_GLOBAL_NAME];
      }
    }
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

async function resolveBackendScriptPath(rootURI) {
  const fileURIPath = resolveBackendScriptPathFromFileURI(rootURI);
  if (fileURIPath) {
    return fileURIPath;
  }

  return materializeBackendScript(rootURI);
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

function resolveBackendScriptPathFromFileURI(rootURI) {
  try {
    const uri = Services.io.newURI(String(rootURI || ""));
    if (!uri || uri.scheme !== "file") {
      return "";
    }
    const fileURL = uri.QueryInterface(Ci.nsIFileURL);
    const addonRoot = fileURL.file;
    const scriptFile = resolveAddonRelativeFile(addonRoot, BACKEND_SCRIPT_ZIP_ENTRY_PATH);
    if (scriptFile?.exists()) {
      return scriptFile.path;
    }

    return "";
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to resolve backend script path: ${error}`);
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

function materializeBackendScript(rootURI) {
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
    if (!zipReader.hasEntry(BACKEND_SCRIPT_ZIP_ENTRY_PATH)) {
      return "";
    }

    const tempDir = Services.dirsvc.get("TmpD", Ci.nsIFile);
    tempDir.append(BACKEND_TEMP_DIR_NAME);
    if (!tempDir.exists()) {
      tempDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o700);
    }

    return extractBackendEntry(zipReader, tempDir, BACKEND_SCRIPT_ZIP_ENTRY_PATH);
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to extract backend script from addon package: ${error}`);
    return "";
  }
  finally {
    if (zipReader) {
      try {
        zipReader.close();
      }
      catch (_error) {
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
  const allowPythonFallbackOnBundledOS = options.allowPythonFallbackOnBundledOS === true;

  if (_backendProcess) {
    return true;
  }

  if (allowReuseExisting) {
    const alreadyHealthy = await isBackendHealthy();
    if (alreadyHealthy) {
      _backendManagedByAddon = false;
      if (_lastBackendHealthyBaseURL) {
        Zotero.Prefs.set(PREF_KEYS.remoteBaseURL, _lastBackendHealthyBaseURL, true);
      }
      return true;
    }
  }

  if (!scriptPath) {
    return false;
  }

  const backendFile = toExistingLocalFile(scriptPath);
  if (!backendFile) {
    Zotero.debug(`fastRead: backend executable is missing at ${scriptPath}`);
    return false;
  }
  ensureBackendFileExecutable(backendFile);

  const backendPath = String(backendFile.path || "");
  const isPythonScript = /\.py$/i.test(backendPath);

  let processExecutable = null;
  let args = [];
  if (isPythonScript) {
    if (shouldRequireBundledBackendForCurrentOS() && !allowPythonFallbackOnBundledOS) {
      Zotero.logError("fastRead: Python fallback is disabled on Windows/macOS. Please package bundled backend binary in the XPI.");
      return false;
    }

    const pythonCommand = resolvePythonCommandForServer();
    if (!pythonCommand?.executable) {
      Zotero.logError("fastRead: Python runtime not found, cannot start server.py");
      return false;
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
      return false;
    }

    const resolvedBaseURL = _lastBackendHealthyBaseURL || LOCAL_REMOTE_BASE_URL_CANDIDATES[0];
    if (!readPref(PREF_KEYS.remoteBaseURL) || _backendManagedByAddon) {
      Zotero.Prefs.set(PREF_KEYS.remoteBaseURL, resolvedBaseURL, true);
    }
    return true;
  }
  catch (error) {
    _backendProcess = null;
    _backendProcessObserver = null;
    _backendManagedByAddon = false;
    Zotero.logError(`fastRead: failed to start backend process: ${error}`);
    return false;
  }
}

async function tryUpgradeBackendToLatestServerScript() {
  try {
    const scriptPath = await resolveBackendScriptPath(_rootURI);
    if (!scriptPath) {
      return false;
    }

    await shutdownExistingLocalBackendServer();
    const started = await startBackendServer(scriptPath, {
      allowReuseExisting: false,
      allowPythonFallbackOnBundledOS: true
    });
    if (!started) {
      return false;
    }

    _backendExePath = scriptPath;
    return true;
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to upgrade backend to latest server.py: ${error}`);
    return false;
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

async function forceStopBackendServer() {
  const processRef = _backendProcess;
  _backendProcess = null;
  _backendProcessObserver = null;
  _backendManagedByAddon = false;
  _backendStartPromise = null;

  fastReadBootstrapLog("force stopping local backend after translation cancellation", "warn");

  try {
    await shutdownExistingLocalBackendServer();
  }
  catch (error) {
    Zotero.debug(`fastRead: backend shutdown request during force stop failed: ${error}`);
  }

  try {
    const down = await waitForBackendDown(1800, 150);
    if (!down && processRef && typeof processRef.kill === "function") {
      processRef.kill();
    }
  }
  catch (error) {
    if (processRef && typeof processRef.kill === "function") {
      try {
        processRef.kill();
      }
      catch (_innerError) {
      }
    }
    Zotero.debug(`fastRead: backend force kill failed or was unnecessary: ${error}`);
  }
  finally {
    try {
      await waitForBackendDown(2500, 150);
    }
    catch (_error) {
    }
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
  Zotero.Prefs.set(PREF_KEYS.syncMode, "page", true);
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

    #${FASTREAD_BATCH_DIALOG_ID}.is-minimized {
      inset: auto 18px 18px auto;
      width: min(420px, calc(100vw - 36px));
      height: auto;
      background: transparent;
      pointer-events: none;
      backdrop-filter: none;
    }

    #${FASTREAD_BATCH_DIALOG_ID}.is-minimized .zdr-batch-card {
      width: 100%;
      max-height: none;
      pointer-events: auto;
      cursor: pointer;
    }

    #${FASTREAD_BATCH_DIALOG_ID}.is-minimized #zdr-batch-body {
      display: none !important;
    }

    #${FASTREAD_BATCH_DIALOG_ID}.is-minimized .zdr-batch-mini {
      display: grid;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-title {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 700;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-window-btn {
      width: 26px;
      height: 26px;
      min-width: 26px;
      padding: 0;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--material-foreground) 15%, transparent);
      background: color-mix(in srgb, var(--material-background) 88%, #ffffff 12%);
      color: var(--material-foreground);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-window-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 0 0 auto;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-window-btn.is-close {
      font-size: 18px;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-window-btn.is-close:hover {
      background: #d92d45;
      color: #fff;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
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

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-mini {
      display: none;
      gap: 8px;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-mini p {
      margin: 0;
      font-size: 12px;
      color: color-mix(in srgb, var(--material-foreground) 72%, transparent);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-mini-progress-wrap {
      height: 6px;
      border-radius: 999px;
      overflow: hidden;
      background: color-mix(in srgb, var(--material-foreground) 12%, transparent);
    }

    #${FASTREAD_BATCH_DIALOG_ID} .zdr-batch-mini-progress {
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #2f6df6 0%, #46a0ff 100%);
      transition: width 200ms ease;
    }
  `;

  const card = createHTMLElement(doc, "div");
  card.id = "zdr-batch-card";
  card.className = "zdr-batch-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "fastRead批量翻译");

  const header = createHTMLElement(doc, "div");
  header.className = "zdr-batch-header";

  const title = createHTMLElement(doc, "h2");
  title.className = "zdr-batch-title";
  const icon = createHTMLElement(doc, "img");
  icon.setAttribute("src", FASTREAD_ICON_BASE64);
  icon.setAttribute("alt", "");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  title.appendChild(icon);
  title.appendChild(doc.createTextNode("fastRead批量翻译"));

  const minimizeBtn = createHTMLElement(doc, "button");
  minimizeBtn.id = "zdr-batch-minimize";
  minimizeBtn.className = "zdr-batch-window-btn";
  minimizeBtn.setAttribute("type", "button");
  minimizeBtn.setAttribute("title", "最小化");
  minimizeBtn.setAttribute("aria-label", "最小化批量翻译窗口");
  minimizeBtn.textContent = "−";

  const headerCloseBtn = createHTMLElement(doc, "button");
  headerCloseBtn.id = "zdr-batch-window-close";
  headerCloseBtn.className = "zdr-batch-window-btn is-close";
  headerCloseBtn.setAttribute("type", "button");
  headerCloseBtn.setAttribute("title", "关闭");
  headerCloseBtn.setAttribute("aria-label", "关闭批量翻译窗口");
  headerCloseBtn.textContent = "×";

  const windowActions = createHTMLElement(doc, "div");
  windowActions.className = "zdr-batch-window-actions";
  windowActions.appendChild(minimizeBtn);
  windowActions.appendChild(headerCloseBtn);

  header.appendChild(title);
  header.appendChild(windowActions);

  const body = createHTMLElement(doc, "div");
  body.id = "zdr-batch-body";
  body.className = "zdr-batch-body";

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

  actions.appendChild(startBtn);

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

  const mini = createHTMLElement(doc, "div");
  mini.id = "zdr-batch-mini";
  mini.className = "zdr-batch-mini";

  const miniStatus = createHTMLElement(doc, "p");
  miniStatus.id = "zdr-batch-mini-status";
  miniStatus.textContent = "等待开始";

  const miniProgressWrap = createHTMLElement(doc, "div");
  miniProgressWrap.className = "zdr-batch-mini-progress-wrap";

  const miniProgress = createHTMLElement(doc, "div");
  miniProgress.id = "zdr-batch-mini-progress";
  miniProgress.className = "zdr-batch-mini-progress";
  miniProgressWrap.appendChild(miniProgress);
  mini.appendChild(miniStatus);
  mini.appendChild(miniProgressWrap);

  body.appendChild(subtitle);
  body.appendChild(libraryRow);
  body.appendChild(actions);
  body.appendChild(progressWrap);
  body.appendChild(statusNode);
  body.appendChild(listNode);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(mini);

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
    cancelled: false,
    cancelInProgress: false,
    savedConfig: null,
    activeTaskIDs: new Set()
  };

  const librarySelect = overlay.querySelector("#zdr-batch-library");
  const reloadBtn = overlay.querySelector("#zdr-batch-reload");
  const selectAllBtn = overlay.querySelector("#zdr-batch-select-all");
  const startBtn = overlay.querySelector("#zdr-batch-start");
  const statusNode = overlay.querySelector("#zdr-batch-status");
  const listNode = overlay.querySelector("#zdr-batch-list");
  const progressWrap = overlay.querySelector("#zdr-batch-progress-wrap");
  const progressNode = overlay.querySelector("#zdr-batch-progress");
  const minimizeBtn = overlay.querySelector("#zdr-batch-minimize");
  const headerCloseBtn = overlay.querySelector("#zdr-batch-window-close");
  const miniStatusNode = overlay.querySelector("#zdr-batch-mini-status");
  const miniProgressNode = overlay.querySelector("#zdr-batch-mini-progress");
  let batchProgressPercent = 0;
  let loadSourceSeq = 0;
  let _minimized = false;

  const getSelectedQueue = () => state.files.filter((item) => item.selectable && item.selected);

  const setStatus = (text) => {
    const value = String(text || "");
    if (statusNode) {
      statusNode.textContent = value;
    }
    if (miniStatusNode) {
      miniStatusNode.textContent = value || "等待开始";
    }
  };

  const setProgress = (percent, visible) => {
    const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
    batchProgressPercent = clamped;
    if (progressNode) {
      progressNode.style.width = `${clamped}%`;
    }
    if (miniProgressNode) {
      miniProgressNode.style.width = `${clamped}%`;
    }
    if (progressWrap) {
      progressWrap.style.opacity = visible ? "1" : "0";
    }
  };

  const toggleMinimize = () => {
    const card = overlay.querySelector("#zdr-batch-card");
    if (!card) {
      return;
    }

    _minimized = !_minimized;

    if (_minimized) {
      overlay.classList.add("is-minimized");
      card.setAttribute("title", "点击展开批量翻译窗口");
      setProgress(batchProgressPercent, true);
      if (!state.running) {
        setStatus("已最小化，点击展开");
      }
      return;
    }

    overlay.classList.remove("is-minimized");
    card.removeAttribute("title");
    updateActionButtons();
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
      librarySelect.disabled = state.running || !state.sources.length;
    }
    if (reloadBtn) {
      reloadBtn.disabled = state.running || !state.sourceKey;
    }
    if (selectAllBtn) {
      const hasSelectable = state.files.some((item) => item.selectable && !item.selected);
      selectAllBtn.disabled = state.running || state.loading || !hasSelectable;
    }

    if (startBtn) {
      startBtn.disabled = state.running || state.loading || selectedCount <= 0;
      startBtn.textContent = state.running ? "翻译中..." : "开始翻译";
    }
    if (minimizeBtn) {
      minimizeBtn.disabled = false;
      minimizeBtn.textContent = _minimized ? "□" : "−";
      minimizeBtn.setAttribute("title", _minimized ? "还原" : "最小化");
      minimizeBtn.setAttribute("aria-label", _minimized ? "还原批量翻译窗口" : "最小化批量翻译窗口");
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
      void cancelBatchAndClose();
      setStatus("正在停止当前任务，请稍候...");
      return;
    }
    closeBatchTranslateDialog(doc);
  };

  const cancelBatchAndClose = async () => {
    if (state.cancelInProgress) {
      return;
    }
    state.cancelInProgress = true;
    state.cancelled = true;
    setStatus("正在取消翻译任务并停止后台进程，请稍候...", "info");
    updateActionButtons();

    const taskIDs = state.activeTaskIDs
      ? Array.from(state.activeTaskIDs.values()).filter(Boolean)
      : [];

    try {
      if (state.savedConfig && taskIDs.length) {
        await Promise.allSettled(taskIDs.map((taskID) => cancelBatchTranslationTask(state.savedConfig, taskID)));
      }
      await forceStopBackendServer();
    }
    catch (error) {
      Zotero.debug(`fastRead: batch cancellation cleanup failed: ${error}`);
    }
    finally {
      setStatus("翻译已取消", "info");
      showConnectionAlert("翻译已取消");
      closeBatchTranslateDialog(doc);
    }
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
    const seq = loadSourceSeq + 1;
    loadSourceSeq = seq;
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
      if (seq !== loadSourceSeq || state.sourceKey !== source.key) {
        return;
      }
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
      if (seq !== loadSourceSeq) {
        return;
      }
      state.files = [];
      setStatus(`读取文库失败: ${error?.message || error}`);
      Zotero.logError(`fastRead: failed to load library PDFs: ${error}`);
    }
    finally {
      if (seq === loadSourceSeq) {
        setLoading(false);
      }
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
    state.activeTaskIDs.clear();
    state.savedConfig = null;
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
      state.savedConfig = config;
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

          let activeTaskID = "";
          try {
            const createResult = await submitBatchTranslationTask(config, item);
            activeTaskID = createResult.taskID || "";
            item.taskID = activeTaskID;
            if (activeTaskID) {
              state.activeTaskIDs.add(activeTaskID);
            }
            item.stateLabel = "任务已提交，等待服务端";
            renderList();
            const completedTask = await pollBatchTaskUntilComplete(config, activeTaskID, () => state.cancelled, ({ progress, stage, status }) => {
              const pct = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
              item.stateLabel = `${stage || status || "翻译中"} ${pct}%`;
              renderList();
              setStatus(`正在翻译 ${Math.min(completedCount + 1, queue.length)}/${queue.length}: ${item.fileName} - ${stage || status || "处理中"} ${pct}%`);
            });
            item.stateLabel = "正在下载译文";
            renderList();
            await downloadBatchTaskOutput(config, item, completedTask);
            item.state = "done";
            item.stateLabel = "完成";
            item.translated = true;
            item.selectable = false;
            item.selected = false;
            done += 1;
          }
          catch (error) {
            if (state.cancelled) {
              item.state = "pending";
              item.stateLabel = "已停止";
              continue;
            }
            item.state = "error";
            item.stateLabel = `失败: ${truncateForUser(error?.message || String(error || "未知错误"), 36)}`;
            failed += 1;
            Zotero.logError(`fastRead batch translate failed for ${item.filePath}: ${error}`);
          }
          finally {
            if (activeTaskID) {
              state.activeTaskIDs.delete(activeTaskID);
            }
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
  minimizeBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMinimize();
  });
  headerCloseBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.running) {
      void cancelBatchAndClose();
      return;
    }
    closeDialog();
  });
  overlay.querySelector("#zdr-batch-card")?.addEventListener("click", () => {
    if (_minimized) {
      toggleMinimize();
    }
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      if (!state.running && !_minimized) {
        closeDialog();
      }
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
  fastReadBootstrapLog(`context-menu launch requested: itemID=${itemID || "(empty)"}, key=${pdfItem.key || ""}`);
  if (!itemID) {
    showConnectionAlert("无法解析 PDF 条目 ID。");
    return;
  }

  await Zotero.Reader.open(itemID);
  fastReadBootstrapLog(`Zotero.Reader.open returned for itemID=${itemID}`);
  await delay(120);

  const reader = await waitForReaderByItemID(itemID);
  const doc = reader?._iframeWindow?.document || null;
  if (!reader || !doc) {
    fastReadBootstrapLog(`reader lookup failed after open: itemID=${itemID}, hasReader=${!!reader}, hasDoc=${!!doc}`, "warn");
    notifyReaderScriptNotReady();
    return;
  }

  try {
    reader._fastReadLaunchItemID = itemID;
    reader._fastReadLaunchAttachment = pdfItem;
  }
  catch (_error) {
  }

  await waitForReaderPDFSurfaceReady(reader, doc, 40, 100);
  fastReadBootstrapLog(`launching split view after PDF surface wait: itemID=${itemID}, apiVersion=${Zotero.FastRead?.__fastReadScriptVersion || "unknown"}`);
  launchSplitViewFromSidebar(reader, reader?._iframeWindow?.document || doc);
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

async function waitForReaderPDFSurfaceReady(reader, doc, maxAttempts = 80, intervalMs = 150) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const activeDoc = reader?._iframeWindow?.document || doc || null;
    try {
      const hasViewer = !!(
        activeDoc?.getElementById?.("viewerContainer")
        || activeDoc?.querySelector?.(".pdfViewerContainer, .viewerContainer, .page[data-page-number], .page")
      );
      const app = activeDoc?.defaultView?.wrappedJSObject?.PDFViewerApplication
        || activeDoc?.defaultView?.PDFViewerApplication
        || null;
      const appReady = !app || app.initialized === true || !!app.pdfViewer;
      if (hasViewer && appReady) {
        fastReadBootstrapLog(`reader PDF surface ready: attempt=${attempt + 1}, hasViewer=${hasViewer}, appReady=${appReady}`);
        return true;
      }
    }
    catch (_error) {
    }
    await delay(intervalMs);
  }
  fastReadBootstrapLog(`reader PDF surface wait timed out: attempts=${maxAttempts}`, "warn");
  return false;
}

function launchSplitViewFromSidebar(reader, doc) {
  if (!reader || !doc) {
    fastReadBootstrapLog(`launchSplitViewFromSidebar aborted: hasReader=${!!reader}, hasDoc=${!!doc}`, "warn");
    return;
  }

  if (!Zotero.FastRead) {
    fastReadBootstrapLog("launchSplitViewFromSidebar aborted: Zotero.FastRead missing", "error");
    notifyReaderScriptNotReady();
    return;
  }

  if (typeof Zotero.FastRead.launchSplitView === "function") {
    fastReadBootstrapLog(`calling Zotero.FastRead.launchSplitView: apiVersion=${Zotero.FastRead.__fastReadScriptVersion || "unknown"}`);
    Zotero.FastRead.launchSplitView(reader, doc, { autoTrigger: true });
    return;
  }

  const readerWindow = reader._iframeWindow || null;
  if (typeof Zotero.FastRead.toggleFastReadForWindow === "function") {
    fastReadBootstrapLog(`calling Zotero.FastRead.toggleFastReadForWindow: apiVersion=${Zotero.FastRead.__fastReadScriptVersion || "unknown"}`);
    Zotero.FastRead.toggleFastReadForWindow(true, readerWindow, reader, doc);
    return;
  }

  fastReadBootstrapLog("launchSplitViewFromSidebar aborted: no launch API available", "error");
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
  const requestOptions = { ...(options || {}) };
  const rawTimeout = Number(timeoutMs);
  if (Number.isFinite(rawTimeout) && rawTimeout <= 0) {
    return fetch(url, requestOptions);
  }

  const normalizedTimeout = Math.max(500, Number.isFinite(rawTimeout) ? rawTimeout : 2500);

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
  bindProviderInputs(doc);
  bindActiveModelInputs(doc);
  bindJSONProfileManager(doc);
  attachButtonHandler(doc, {
    buttonID: "zdr-remote-api-test-btn-primary",
    statusID: "zdr-remote-api-status-primary",
    kind: "remoteApi"
  });
}

function bindProviderInputs(doc) {
  const providerSelect = doc?.getElementById?.("zdr-remote-provider");
  const modelInput = doc?.getElementById?.("zdr-remote-model");
  if (!providerSelect || providerSelect.dataset.zdrBound === "1") {
    return;
  }

  providerSelect.dataset.zdrBound = "1";
  providerSelect.addEventListener("change", () => {
    const providerID = String(providerSelect.value || "").trim();
    const preset = getProviderPresetByID(providerID);
    if (!preset) {
      return;
    }

    if (modelInput) {
      const currentModel = String(modelInput.value || "").trim();
      if (!currentModel || currentModel === readPref(PREF_KEYS.remoteModel)) {
        modelInput.value = preset.defaultModel;
        Zotero.Prefs.set(PREF_KEYS.remoteModel, preset.defaultModel, true);
      }
    }

    refreshActiveModelOptions(doc);
    renderConfiguredProfileList(doc);
  });

  if (modelInput && modelInput.dataset.zdrBound !== "1") {
    modelInput.dataset.zdrBound = "1";
    modelInput.addEventListener("change", () => {
      refreshActiveModelOptions(doc);
      renderConfiguredProfileList(doc);
    });
  }
}

function bindActiveModelInputs(doc) {
  const activeSelect = doc?.getElementById?.("zdr-active-model-select");
  if (!activeSelect) {
    return;
  }

  let newlyBound = false;
  if (activeSelect.dataset.zdrBound !== "1") {
    activeSelect.dataset.zdrBound = "1";
    newlyBound = true;
    activeSelect.addEventListener("change", () => {
      const selected = String(activeSelect.value || "").trim();
      const valueToSave = selected === "__default__" ? "" : selected;
      Zotero.Prefs.set(PREF_KEYS.remoteActiveModelId, valueToSave, true);
      refreshActiveModelOptions(doc);
    });
  }

  if (newlyBound || activeSelect.dataset.zdrHydrated !== "1") {
    refreshActiveModelOptions(doc);
    activeSelect.dataset.zdrHydrated = "1";
  }
}

function bindJSONProfileManager(doc) {
  const addButton = doc?.getElementById?.("zdr-json-profile-add-btn");
  const inputNode = doc?.getElementById?.("zdr-json-profile-input");
  const statusNode = doc?.getElementById?.("zdr-json-profile-add-status");
  const listNode = doc?.getElementById?.("zdr-json-profile-list");

  if (addButton && addButton.dataset.zdrBound !== "1") {
    addButton.dataset.zdrBound = "1";
    addButton.addEventListener("click", () => {
      void addJSONProfileFromInput(doc, inputNode, statusNode);
    });
  }

  if (listNode && listNode.dataset.zdrHydrated !== "1") {
    renderConfiguredProfileList(doc);
  }
}

function readStoredModelConfigObject() {
  return parseModelConfigJSON(readPref(PREF_KEYS.remoteModelConfig));
}

function writeStoredModelConfigObject(configObject) {
  const payload = (configObject && typeof configObject === "object" && !Array.isArray(configObject))
    ? configObject
    : {};
  Zotero.Prefs.set(PREF_KEYS.remoteModelConfig, safeJSONStringifyModelConfig(payload), true);
}

function detectProviderIDFromEndpoint(rawEndpoint) {
  const endpoint = String(rawEndpoint || "").trim().toLowerCase();
  if (!endpoint) {
    return "";
  }
  if (endpoint.includes("deepseek")) {
    return "deepseek";
  }
  if (endpoint.includes("openrouter")) {
    return "openrouter";
  }
  if (endpoint.includes("siliconflow")) {
    return "siliconflow";
  }
  if (endpoint.includes("dashscope") || endpoint.includes("aliyuncs")) {
    return "qwen";
  }
  if (endpoint.includes("moonshot")) {
    return "moonshot";
  }
  if (endpoint.includes("together")) {
    return "together";
  }
  if (endpoint.includes("x.ai") || endpoint.includes("grok")) {
    return "xai";
  }
  if (endpoint.includes("openai")) {
    return "openai";
  }
  return "";
}

function buildStoredProfileFromInput(profileInput, fallbackID, fallbackProviderID, fallbackModelName, fallbackSourceLang, fallbackTargetLang) {
  if (!profileInput || typeof profileInput !== "object" || Array.isArray(profileInput)) {
    return null;
  }

  const endpointProvider = detectProviderIDFromEndpoint(profileInput.endpoint || profileInput.apiBase || profileInput.baseURL);
  const providerID = String(
    profileInput.providerConfigId
    || profileInput.provider
    || endpointProvider
    || fallbackProviderID
    || "deepseek"
  ).trim().toLowerCase();
  const modelName = String(profileInput.model || profileInput.modelName || fallbackModelName || "deepseek-chat").trim() || "deepseek-chat";
  const sourceLang = String(profileInput.sourceLang || profileInput.source_lang || fallbackSourceLang || "en").trim() || "en";
  const targetLang = String(profileInput.targetLang || profileInput.target_lang || fallbackTargetLang || "zh").trim() || "zh";
  const profileID = toSafeProfileID(profileInput.id || profileInput.key, fallbackID);
  const fallbackLabel = toCompactModelName(modelName) || modelName;
  const label = String(profileInput.label || profileInput.name || fallbackLabel).trim() || fallbackLabel;

  const stored = {
    ...profileInput,
    id: profileID,
    label,
    providerConfigId: providerID,
    model: modelName,
    sourceLang,
    targetLang
  };
  delete stored.key;
  delete stored.provider;
  delete stored.modelName;
  delete stored.source_lang;
  delete stored.target_lang;
  return stored;
}

function normalizeProfilesFromInputObject(parsedInput, fallbackProviderID, fallbackModelName, fallbackSourceLang, fallbackTargetLang) {
  const profileCandidates = [];
  if (Array.isArray(parsedInput)) {
    profileCandidates.push(...parsedInput);
  }
  else if (parsedInput && typeof parsedInput === "object") {
    if (Array.isArray(parsedInput.profiles)) {
      profileCandidates.push(...parsedInput.profiles);
    }
    else if (Array.isArray(parsedInput.models)) {
      profileCandidates.push(...parsedInput.models);
    }
    else {
      profileCandidates.push(parsedInput);
    }
  }

  const now = Date.now();
  const normalized = [];
  profileCandidates.forEach((item, index) => {
    const profile = buildStoredProfileFromInput(
      item,
      `json-${now}-${index + 1}`,
      fallbackProviderID,
      fallbackModelName,
      fallbackSourceLang,
      fallbackTargetLang
    );
    if (profile) {
      normalized.push(profile);
    }
  });
  return normalized;
}

async function addJSONProfileFromInput(doc, inputNode, statusNode) {
  const raw = String(inputNode?.value || "").trim();
  if (!raw) {
    setStatus(statusNode, "请先输入 JSON 配置。", "error");
    return;
  }

  let parsedInput = null;
  try {
    parsedInput = JSON.parse(raw);
  }
  catch (error) {
    setStatus(statusNode, `JSON 解析失败: ${error?.message || error}`, "error");
    return;
  }

  const fallbackProviderID = readPref(PREF_KEYS.remoteProvider) || "deepseek";
  const fallbackModelName = readPref(PREF_KEYS.remoteModel) || "deepseek-chat";
  const fallbackSourceLang = readPref(PREF_KEYS.remoteSourceLang) || "en";
  const fallbackTargetLang = readPref(PREF_KEYS.remoteTargetLang) || "zh";

  const newProfiles = normalizeProfilesFromInputObject(
    parsedInput,
    fallbackProviderID,
    fallbackModelName,
    fallbackSourceLang,
    fallbackTargetLang
  );
  if (!newProfiles.length) {
    setStatus(statusNode, "未识别到有效模型配置，请检查 JSON 字段。", "error");
    return;
  }

  const stored = readStoredModelConfigObject();
  const existingProfiles = Array.isArray(stored.profiles)
    ? stored.profiles.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
  const existingIDs = new Set(existingProfiles.map((item) => String(item.id || "").trim()).filter(Boolean));

  for (const profile of newProfiles) {
    let profileID = String(profile.id || "").trim();
    if (!profileID) {
      profileID = `json-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    while (existingIDs.has(profileID)) {
      profileID = `${profileID}-dup`;
    }
    profile.id = profileID;
    existingIDs.add(profileID);
    existingProfiles.push(profile);
  }

  const nextStored = {
    ...stored,
    profiles: existingProfiles
  };
  delete nextStored.models;
  writeStoredModelConfigObject(nextStored);

  if (inputNode) {
    inputNode.value = "";
  }
  setStatus(statusNode, `已添加 ${newProfiles.length} 个配置。`, "success");
  refreshActiveModelOptions(doc);
  renderConfiguredProfileList(doc);
}

function resolveConnectionSelectionForProfile(profile, fallbackProviderID, fallbackModelName, fallbackSourceLang, fallbackTargetLang, rawJSON) {
  const providerID = String(profile?.providerID || fallbackProviderID || "deepseek").trim().toLowerCase() || "deepseek";
  const modelName = String(profile?.modelName || fallbackModelName || "deepseek-chat").trim() || "deepseek-chat";
  const sourceLang = String(profile?.sourceLang || fallbackSourceLang || "en").trim() || "en";
  const targetLang = String(profile?.targetLang || fallbackTargetLang || "zh").trim() || "zh";
  const mergedBase = composeRemoteModelConfigObject(providerID, modelName, rawJSON);
  const modelConfigObject = normalizeModelConfigPayload({
    ...mergedBase,
    ...(profile?.overrides || {})
  });
  if (!String(modelConfigObject.model || "").trim()) {
    modelConfigObject.model = modelName;
  }

  return {
    providerID,
    modelName,
    sourceLang,
    targetLang,
    modelConfigObject
  };
}

function resolveTopLevelConnectionSelection(rawJSON, providerID, modelName, sourceLang, targetLang) {
  const normalizedProviderID = String(providerID || "deepseek").trim().toLowerCase() || "deepseek";
  const normalizedModelName = String(modelName || "deepseek-chat").trim() || "deepseek-chat";
  const normalizedSourceLang = String(sourceLang || "en").trim() || "en";
  const normalizedTargetLang = String(targetLang || "zh").trim() || "zh";

  const preset = getProviderPresetByID(normalizedProviderID);
  const parsedJSON = normalizeModelConfigPayload(parseModelConfigJSON(rawJSON));
  const sanitizedJSON = {
    ...parsedJSON
  };
  delete sanitizedJSON.model;
  delete sanitizedJSON.modelName;
  delete sanitizedJSON.provider;
  delete sanitizedJSON.providerConfigId;
  delete sanitizedJSON.sourceLang;
  delete sanitizedJSON.source_lang;
  delete sanitizedJSON.targetLang;
  delete sanitizedJSON.target_lang;

  const modelConfigObject = {
    model: normalizedModelName,
    ...(preset?.endpoint ? { endpoint: preset.endpoint } : {}),
    ...sanitizedJSON
  };
  modelConfigObject.model = normalizedModelName;

  return {
    providerID: normalizedProviderID,
    modelName: normalizedModelName,
    sourceLang: normalizedSourceLang,
    targetLang: normalizedTargetLang,
    modelConfigObject
  };
}

function renderConfiguredProfileList(doc) {
  const listNode = doc?.getElementById?.("zdr-json-profile-list");
  if (!listNode) {
    return;
  }

  while (listNode.firstChild) {
    listNode.removeChild(listNode.firstChild);
  }

  const fallbackProviderID = readPref(PREF_KEYS.remoteProvider) || "deepseek";
  const fallbackModelName = readPref(PREF_KEYS.remoteModel) || "deepseek-chat";
  const fallbackSourceLang = readPref(PREF_KEYS.remoteSourceLang) || "en";
  const fallbackTargetLang = readPref(PREF_KEYS.remoteTargetLang) || "zh";
  const rawJSON = readPref(PREF_KEYS.remoteModelConfig);
  const profiles = extractConfiguredModelProfiles(rawJSON, fallbackProviderID, fallbackModelName);

  if (!profiles.length) {
    const emptyNode = listNode.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "p");
    emptyNode.className = "zdr-profile-meta";
    emptyNode.textContent = "暂未添加自定义 JSON 配置。";
    listNode.appendChild(emptyNode);
    listNode.dataset.zdrHydrated = "1";
    return;
  }

  for (const profile of profiles) {
    const row = listNode.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "div");
    row.className = "zdr-profile-row";

    const title = listNode.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "p");
    title.className = "zdr-profile-title";
    title.textContent = String(profile.label || toCompactModelName(profile.modelName) || profile.modelName);
    row.appendChild(title);

    const endpoint = String(profile?.overrides?.endpoint || profile?.overrides?.apiBase || profile?.overrides?.baseURL || "").trim();
    const meta = listNode.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "p");
    meta.className = "zdr-profile-meta";
    meta.textContent = endpoint ? `endpoint: ${endpoint}` : "endpoint: 使用当前提供商默认地址";
    row.appendChild(meta);

    const actions = listNode.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "div");
    actions.className = "zdr-profile-actions";

    const testButton = listNode.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "button");
    testButton.className = "zdr-btn";
    testButton.setAttribute("type", "button");
    testButton.textContent = "测试连接";
    actions.appendChild(testButton);

    const removeButton = listNode.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "button");
    removeButton.className = "zdr-btn";
    removeButton.setAttribute("type", "button");
    removeButton.textContent = "移除";
    actions.appendChild(removeButton);

    row.appendChild(actions);

    const statusNode = listNode.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "p");
    statusNode.className = "zdr-status";
    row.appendChild(statusNode);

    testButton.addEventListener("click", () => {
      const selectionOverride = resolveConnectionSelectionForProfile(
        profile,
        fallbackProviderID,
        fallbackModelName,
        fallbackSourceLang,
        fallbackTargetLang,
        rawJSON
      );
      void testRemoteAPIConnection(testButton, statusNode, selectionOverride);
    });

    removeButton.addEventListener("click", () => {
      const stored = readStoredModelConfigObject();
      const existingProfiles = Array.isArray(stored.profiles) ? stored.profiles : [];
      const profileID = String(profile.id || "");
      const nextProfiles = existingProfiles.filter((item) => String(item?.id || "") !== profileID);
      const nextStored = {
        ...stored
      };

      if (nextProfiles.length) {
        nextStored.profiles = nextProfiles;
      }
      else {
        delete nextStored.profiles;
      }

      if (Array.isArray(nextStored.models)) {
        const remainingModels = nextStored.models.filter((item) => {
          const id = String(item?.id || item?.key || "");
          return id !== profileID;
        });
        if (remainingModels.length) {
          nextStored.models = remainingModels;
        }
        else {
          delete nextStored.models;
        }
      }

      if (profileID === "json-inline") {
        delete nextStored.endpoint;
        delete nextStored.apiBase;
        delete nextStored.api_base;
        delete nextStored.baseURL;
        delete nextStored.base_url;
        delete nextStored.model;
        delete nextStored.modelName;
        delete nextStored.systemPrompt;
        delete nextStored.apiKey;
        delete nextStored.provider;
        delete nextStored.providerConfigId;
        delete nextStored.sourceLang;
        delete nextStored.source_lang;
        delete nextStored.targetLang;
        delete nextStored.target_lang;
      }

      writeStoredModelConfigObject(nextStored);
      if (String(readPref(PREF_KEYS.remoteActiveModelId) || "") === profileID) {
        Zotero.Prefs.set(PREF_KEYS.remoteActiveModelId, "", true);
      }
      refreshActiveModelOptions(doc);
      renderConfiguredProfileList(doc);
      setStatus(statusNode, "已移除。", "success");
    });

    listNode.appendChild(row);
  }

  listNode.dataset.zdrHydrated = "1";
}

function refreshActiveModelOptions(doc) {
  const activeSelect = doc?.getElementById?.("zdr-active-model-select");
  const statusNode = doc?.getElementById?.("zdr-active-model-status");
  if (!activeSelect) {
    return;
  }

  const providerID = readPref(PREF_KEYS.remoteProvider) || "deepseek";
  const modelName = readPref(PREF_KEYS.remoteModel) || "deepseek-chat";
  const sourceLang = readPref(PREF_KEYS.remoteSourceLang) || "en";
  const targetLang = readPref(PREF_KEYS.remoteTargetLang) || "zh";
  const selection = resolveActiveModelSelection(
    readPref(PREF_KEYS.remoteModelConfig),
    readPref(PREF_KEYS.remoteActiveModelId),
    providerID,
    modelName,
    sourceLang,
    targetLang
  );

  while (activeSelect.firstChild) {
    activeSelect.removeChild(activeSelect.firstChild);
  }

  for (const option of selection.options) {
    const node = activeSelect.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "option");
    node.value = String(option.id || "");
    node.textContent = String(option.label || node.value || "");
    activeSelect.appendChild(node);
  }

  activeSelect.value = selection.activeModelID;
  const prefValue = selection.activeModelID === "__default__" ? "" : selection.activeModelID;
  if ((readPref(PREF_KEYS.remoteActiveModelId) || "") !== prefValue) {
    Zotero.Prefs.set(PREF_KEYS.remoteActiveModelId, prefValue, true);
  }

  if (statusNode) {
    const compactModelName = toCompactModelName(selection.modelName) || selection.modelName;
    setStatus(statusNode, `当前生效：${compactModelName}（${selection.sourceLang} -> ${selection.targetLang}）`, "info");
  }
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

function buildRemoteProviderTestAPIURL(baseURL) {
  const base = trimTrailingSlash(baseURL);
  if (!base) {
    return "";
  }
  if (/\/api\/tasks$/i.test(base)) {
    return base.replace(/\/api\/tasks$/i, "/api/providers/test");
  }
  if (/\/api\/providers\/test$/i.test(base)) {
    return base;
  }
  if (/\/api$/i.test(base)) {
    return `${base}/providers/test`;
  }
  return `${base}/api/providers/test`;
}

function buildRemoteMetaAPIURL(baseURL) {
  const base = trimTrailingSlash(baseURL);
  if (!base) {
    return "";
  }
  if (/\/api\/meta$/i.test(base)) {
    return base;
  }
  if (/\/api\/tasks$/i.test(base)) {
    return base.replace(/\/api\/tasks$/i, "/api/meta");
  }
  if (/\/api$/i.test(base)) {
    return `${base}/meta`;
  }
  return `${base}/api/meta`;
}

async function probeRemoteBackendMeta(baseURL, headers) {
  const metaURL = buildRemoteMetaAPIURL(baseURL);
  if (!metaURL) {
    return {
      ok: false,
      metaURL: "",
      supportsProviderTest: false,
      payload: {}
    };
  }

  try {
    const response = await fetchWithTimeout(metaURL, {
      method: "GET",
      headers: headers || {},
      credentials: "include",
      cache: "no-store"
    }, 5000);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        metaURL,
        supportsProviderTest: false,
        payload
      };
    }

    const capabilities = Array.isArray(payload?.capabilities) ? payload.capabilities : [];
    const supportsProviderTest = capabilities.includes("provider_test") || capabilities.includes("providers_test") || payload?.supportsProviderTest === true;
    return {
      ok: true,
      metaURL,
      supportsProviderTest,
      payload
    };
  }
  catch (_error) {
    return {
      ok: false,
      metaURL,
      supportsProviderTest: false,
      payload: {}
    };
  }
}

function getProviderPresetByID(providerID) {
  const normalized = String(providerID || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return AI_PROVIDER_PRESETS.find((preset) => preset.id === normalized) || null;
}

function parseModelConfigJSON(rawJSON) {
  const raw = String(rawJSON || "").trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }
  catch (_error) {
    return {};
  }
}

function resolveEffectiveAPIKey(modelConfigObject, fallbackKey) {
  const modelConfig = modelConfigObject && typeof modelConfigObject === "object" && !Array.isArray(modelConfigObject)
    ? modelConfigObject
    : {};
  for (const keyName of ["apiKey", "api_key", "deepseekApiKey", "deepseek_api_key"]) {
    const value = String(modelConfig[keyName] || "").trim();
    if (value) {
      return value;
    }
  }
  return String(fallbackKey || "").trim();
}

function normalizeModelConfigPayload(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return {};
  }

  const cleaned = {
    ...rawConfig
  };
  delete cleaned.models;
  delete cleaned.profiles;
  delete cleaned.activeModelId;
  delete cleaned.activeModelID;
  delete cleaned.selectedModelId;
  delete cleaned.selectedProfileId;
  return cleaned;
}

function toSafeProfileID(raw, fallback) {
  const value = String(raw || "").trim();
  if (value) {
    return value;
  }
  return String(fallback || "").trim() || "profile-1";
}

function toCompactModelName(rawModel) {
  const normalized = String(rawModel || "").trim();
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("/").map((part) => String(part || "").trim()).filter(Boolean);
  if (!parts.length) {
    return normalized;
  }
  return parts[parts.length - 1];
}

function extractConfiguredModelProfiles(rawJSON, fallbackProviderID, fallbackModelName) {
  const parsed = parseModelConfigJSON(rawJSON);
  const list = [];
  const pushProfile = (profileInput, fallbackID) => {
    if (!profileInput || typeof profileInput !== "object" || Array.isArray(profileInput)) {
      return;
    }
    const providerID = String(profileInput.providerConfigId || profileInput.provider || fallbackProviderID || "").trim().toLowerCase() || String(fallbackProviderID || "deepseek").trim().toLowerCase();
    const modelName = String(profileInput.model || profileInput.modelName || fallbackModelName || "").trim() || String(fallbackModelName || "deepseek-chat").trim();
    const profileID = toSafeProfileID(profileInput.id || profileInput.key, fallbackID);
    const compactModelName = toCompactModelName(modelName) || modelName;
    const profileLabel = compactModelName;
    const sourceLang = String(profileInput.sourceLang || profileInput.source_lang || "").trim();
    const targetLang = String(profileInput.targetLang || profileInput.target_lang || "").trim();

    const overrides = {
      ...profileInput
    };
    delete overrides.id;
    delete overrides.key;
    delete overrides.label;
    delete overrides.name;
    delete overrides.provider;
    delete overrides.providerConfigId;
    delete overrides.model;
    delete overrides.modelName;
    delete overrides.sourceLang;
    delete overrides.source_lang;
    delete overrides.targetLang;
    delete overrides.target_lang;

    list.push({
      id: profileID,
      label: profileLabel,
      providerID,
      modelName,
      sourceLang,
      targetLang,
      overrides: normalizeModelConfigPayload(overrides)
    });
  };

  const profileArray = Array.isArray(parsed.profiles) ? parsed.profiles : Array.isArray(parsed.models) ? parsed.models : [];
  profileArray.forEach((item, index) => {
    pushProfile(item, `profile-${index + 1}`);
  });

  if (list.length === 0) {
    const normalizedRoot = normalizeModelConfigPayload(parsed);
    const hasRootModel = String(parsed.model || parsed.modelName || "").trim();
    const hasRootProvider = String(parsed.providerConfigId || parsed.provider || "").trim();
    const hasRootEndpoint = String(parsed.endpoint || parsed.apiBase || parsed.baseURL || "").trim();
    if (hasRootModel || hasRootProvider || hasRootEndpoint) {
      pushProfile(parsed, "json-inline");
      if (list.length && Object.keys(normalizedRoot).length) {
        list[list.length - 1].overrides = normalizedRoot;
      }
    }
  }

  return list;
}

function resolveActiveModelSelection(rawJSON, preferredActiveID, fallbackProviderID, fallbackModelName, fallbackSourceLang, fallbackTargetLang) {
  const profiles = extractConfiguredModelProfiles(rawJSON, fallbackProviderID, fallbackModelName);
  const defaultID = "__default__";
  const selectedByPref = String(preferredActiveID || "").trim();
  const parsed = parseModelConfigJSON(rawJSON);
  const selectedByJSON = String(parsed.activeModelId || parsed.activeModelID || parsed.selectedModelId || parsed.selectedProfileId || "").trim();
  const candidateID = selectedByPref || selectedByJSON;
  const selectedProfile = profiles.find((item) => item.id === candidateID) || null;

  const providerID = selectedProfile?.providerID || String(fallbackProviderID || "deepseek").trim().toLowerCase();
  const modelName = selectedProfile?.modelName || String(fallbackModelName || "deepseek-chat").trim();
  const sourceLang = selectedProfile?.sourceLang || String(fallbackSourceLang || "en").trim() || "en";
  const targetLang = selectedProfile?.targetLang || String(fallbackTargetLang || "zh").trim() || "zh";
  const mergedBase = composeRemoteModelConfigObject(providerID, modelName, rawJSON);
  const modelConfigObject = {
    ...mergedBase,
    ...(selectedProfile?.overrides || {})
  };
  if (!String(modelConfigObject.model || "").trim()) {
    modelConfigObject.model = modelName;
  }

  return {
    activeModelID: selectedProfile?.id || defaultID,
    providerID,
    modelName,
    sourceLang,
    targetLang,
    modelConfigObject: normalizeModelConfigPayload(modelConfigObject),
    options: [
      {
        id: defaultID,
        label: `默认：${toCompactModelName(fallbackModelName || "deepseek-chat") || String(fallbackModelName || "deepseek-chat").trim()}`
      },
      ...profiles.map((item) => ({ id: item.id, label: item.label }))
    ]
  };
}

function safeJSONStringifyModelConfig(configObject) {
  try {
    return JSON.stringify(configObject || {});
  }
  catch (_error) {
    return "{}";
  }
}

function composeRemoteModelConfigObject(providerID, modelName, rawJSON) {
  const preset = getProviderPresetByID(providerID);
  const selectedModel = String(modelName || "").trim() || String(preset?.defaultModel || "").trim() || "deepseek-chat";
  const baseConfig = {
    model: selectedModel
  };

  if (preset?.endpoint) {
    baseConfig.endpoint = preset.endpoint;
  }

  const userConfig = normalizeModelConfigPayload(parseModelConfigJSON(rawJSON));
  const merged = {
    ...baseConfig,
    ...userConfig
  };

  if (!String(merged.model || "").trim()) {
    merged.model = selectedModel;
  }
  return merged;
}

function buildAITestPdfBytes() {
  const encoder = getTextEncoder();
  return encoder.encode(AI_TEST_MINIMAL_PDF_CONTENT);
}

async function runLegacyProviderTestViaTasksAPI(serviceBaseURL, headers, providerID, modelConfigObject, sourceLang, targetLang) {
  const createURL = buildBatchCreateTaskURL(serviceBaseURL) || buildRemoteTasksAPIURL(serviceBaseURL);
  if (!createURL) {
    throw new Error("任务接口地址无效。请检查 Base URL 配置。");
  }

  const modelConfigJSON = safeJSONStringifyModelConfig(modelConfigObject);
  const fields = {
    documentName: "fastread-ai-test.pdf",
    taskType: "translation",
    sourceLang,
    targetLang,
    engine: "openai",
    priority: "normal",
    providerConfigId: providerID,
    modelConfig: modelConfigJSON
  };

  const multipart = buildMultipartPayload("fastread-ai-test.pdf", buildAITestPdfBytes(), fields);
  const requestHeaders = {
    ...(headers || {})
  };
  if (multipart.contentType) {
    requestHeaders["Content-Type"] = multipart.contentType;
  }

  const createResponse = await fetchWithTimeout(createURL, {
    method: "POST",
    headers: requestHeaders,
    credentials: "include",
    body: multipart.body
  }, 45000);
  const createPayload = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok) {
    const message = extractTaskError(createPayload) || `${createResponse.status} ${createResponse.statusText}`;
    throw new Error(`创建测试任务失败: ${message}`);
  }

  const taskID = extractTaskID(createPayload);
  if (!taskID) {
    throw new Error("创建测试任务成功，但未返回任务 ID。请稍后重试。");
  }

  const detailURL = buildBatchDetailTaskURL(serviceBaseURL, taskID);
  if (!detailURL) {
    throw new Error("测试任务详情地址无效。请检查 Base URL。");
  }

  const startedAt = Date.now();
  const timeoutMs = LEGACY_FALLBACK_TASK_WAIT_MS;
  while (Date.now() - startedAt < timeoutMs) {
    const detailResponse = await fetchWithTimeout(`${detailURL}?_ts=${Date.now()}`, {
      method: "GET",
      headers: headers || {},
      credentials: "include"
    }, 20000);
    const detailPayload = await detailResponse.json().catch(() => ({}));
    if (!detailResponse.ok) {
      const message = extractTaskError(detailPayload) || `${detailResponse.status} ${detailResponse.statusText}`;
      throw new Error(`查询测试任务状态失败: ${message}`);
    }

    const status = extractTaskStatus(detailPayload);
    if (status === "completed") {
      return {
        taskID,
        outputURL: String(extractMonoOutputUrl(detailPayload) || "").trim()
      };
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      const message = extractTaskError(detailPayload) || status;
      throw new Error(`测试翻译任务失败: ${message}`);
    }

    await delay(1200);
  }

  throw new Error("测试任务等待超时（旧版服务）。请先尝试翻译 1-2 页 PDF 验证连通性。\n如果可行，请升级到新版本后再使用 AI 测试接口。");
}

function isReachableRemoteAPIResponse(response) {
  if (!response) {
    return false;
  }
  return response.ok || response.status === 401 || response.status === 403;
}

async function probeFastReadHealth(baseURL) {
  const normalizedBase = trimTrailingSlash(baseURL);
  if (!normalizedBase) {
    return false;
  }

  try {
    const response = await fetchWithTimeout(`${normalizedBase}/health?_ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store"
    }, 2500);
    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => ({}));
    const service = String(payload?.service || "").toLowerCase();
    const status = String(payload?.status || "").toLowerCase();
    return service === "fastread-server" && status === "ok";
  }
  catch (_error) {
    return false;
  }
}

async function probeRemoteTasksAPI(baseURL, headers, options = {}) {
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
    let reachable = isReachableRemoteAPIResponse(response);
    if (reachable && options.requireFastReadHealth) {
      const healthy = await probeFastReadHealth(normalizedBase);
      if (!healthy) {
        reachable = false;
      }
    }

    return {
      baseURL: normalizedBase,
      endpoint,
      response,
      payload,
      reachable
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

function buildRemoteAPIHeaders(apiKeyOverride = null) {
  const headers = {};
  const candidate = apiKeyOverride === null || apiKeyOverride === undefined
    ? readPref(PREF_KEYS.remoteApiKey)
    : apiKeyOverride;
  const apiKey = String(candidate || "").trim();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

function isRequestTimeoutError(error) {
  const message = String(error?.message || error || "");
  return /timed out/i.test(message);
}

async function postProviderTestRequest(testURL, headers, requestPayload, timeoutMs) {
  const response = await fetchWithTimeout(testURL, {
    method: "POST",
    headers: {
      ...(headers || {}),
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(requestPayload || {})
  }, timeoutMs);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function testRemoteAPIConnection(button, statusNode, selectionOverride = null) {
  const configuredBaseURL = trimTrailingSlash(readPref(PREF_KEYS.remoteBaseURL));
  const topLevelProviderID = readPref(PREF_KEYS.remoteProvider) || "deepseek";
  const topLevelModelName = readPref(PREF_KEYS.remoteModel) || "deepseek-chat";
  const topLevelSourceLang = readPref(PREF_KEYS.remoteSourceLang) || "en";
  const topLevelTargetLang = readPref(PREF_KEYS.remoteTargetLang) || "zh";
  const topLevelSelection = resolveTopLevelConnectionSelection(
    readPref(PREF_KEYS.remoteModelConfig),
    topLevelProviderID,
    topLevelModelName,
    topLevelSourceLang,
    topLevelTargetLang
  );
  const activeSelection = selectionOverride && typeof selectionOverride === "object"
    ? selectionOverride
    : topLevelSelection;
  const providerID = activeSelection.providerID;
  const modelName = activeSelection.modelName;
  const sourceLang = activeSelection.sourceLang;
  const targetLang = activeSelection.targetLang;
  const modelConfigObject = activeSelection.modelConfigObject;
  const apiKey = resolveEffectiveAPIKey(modelConfigObject, readPref(PREF_KEYS.remoteApiKey));
  const headers = buildRemoteAPIHeaders(apiKey);
  const autoDetect = !configuredBaseURL;
  if (!apiKey) {
    setStatus(statusNode, "请先填写 X-API-Key，或在 JSON 配置中提供 apiKey。", "error");
    return;
  }

  setStatus(statusNode, autoDetect
    ? "未填写 URL，正在自动探测本地服务并测试 AI 连接..."
    : "正在测试 AI 连接...", "info");
  button.disabled = true;

  try {
    if (!configuredBaseURL || isLocalFastReadBaseURL(configuredBaseURL)) {
      await ensureBackendServerStarted();
    }

    let probe = null;
    let serviceBaseURL = "";

    if (configuredBaseURL) {
      const strictLocalProbe = isLocalFastReadBaseURL(configuredBaseURL);
      probe = await probeRemoteTasksAPI(configuredBaseURL, headers, {
        requireFastReadHealth: strictLocalProbe
      });
      if (probe?.reachable) {
        serviceBaseURL = trimTrailingSlash(probe.baseURL || configuredBaseURL);
      }
    }
    else {
      for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
        probe = await probeRemoteTasksAPI(candidate, headers, {
          requireFastReadHealth: true
        });
        if (probe?.reachable) {
          serviceBaseURL = trimTrailingSlash(probe.baseURL || candidate);
          break;
        }
      }
      if (probe?.reachable && probe.baseURL) {
        Zotero.Prefs.set(PREF_KEYS.remoteBaseURL, probe.baseURL, true);
      }
    }

    if (!serviceBaseURL && isLocalFastReadBaseURL(configuredBaseURL)) {
      serviceBaseURL = configuredBaseURL;
    }

    if (!serviceBaseURL && _lastBackendHealthyBaseURL) {
      serviceBaseURL = trimTrailingSlash(_lastBackendHealthyBaseURL);
    }

    if (!serviceBaseURL) {
      if (!configuredBaseURL) {
        setStatus(statusNode, "未探测到本地服务。请确认 Zotero 已重启并加载 fastRead。", "error");
      }
      else {
        setStatus(statusNode, `连接失败: 无法访问 ${configuredBaseURL}`, "error");
      }
      return;
    }

    let testURL = buildRemoteProviderTestAPIURL(serviceBaseURL);
    if (!testURL) {
      setStatus(statusNode, "连接失败: 测试接口地址无效。", "error");
      return;
    }

    let metaProbe = await probeRemoteBackendMeta(serviceBaseURL, headers);
    if (!metaProbe.supportsProviderTest && isLocalFastReadBaseURL(serviceBaseURL)) {
      const upgraded = await tryUpgradeBackendToLatestServerScript();
      if (upgraded) {
        if (_lastBackendHealthyBaseURL) {
          serviceBaseURL = trimTrailingSlash(_lastBackendHealthyBaseURL);
        }
        testURL = buildRemoteProviderTestAPIURL(serviceBaseURL);
        metaProbe = await probeRemoteBackendMeta(serviceBaseURL, headers);
      }
    }

    const providerTestPayload = {
      engine: "openai",
      providerConfigId: providerID,
      modelConfig: modelConfigObject,
      sourceLang,
      targetLang
    };

    let providerTestResponse = null;
    let providerPayload = {};
    try {
      const firstAttempt = await postProviderTestRequest(testURL, headers, providerTestPayload, PROVIDER_TEST_TIMEOUT_MS);
      providerTestResponse = firstAttempt.response;
      providerPayload = firstAttempt.payload;
    }
    catch (firstError) {
      if (!isRequestTimeoutError(firstError)) {
        throw firstError;
      }

      setStatus(statusNode, "AI 测试响应较慢，正在重试（最长 120s）...", "info");
      const secondAttempt = await postProviderTestRequest(testURL, headers, providerTestPayload, PROVIDER_TEST_RETRY_TIMEOUT_MS);
      providerTestResponse = secondAttempt.response;
      providerPayload = secondAttempt.payload;
    }

    if (!providerTestResponse.ok || !providerPayload?.ok) {
      const reason = providerPayload?.detail || providerPayload?.message || providerPayload?.error || `${providerTestResponse.status} ${providerTestResponse.statusText}`;
      if (providerTestResponse.status === 404) {
        if (isLocalFastReadBaseURL(serviceBaseURL) && metaProbe.supportsProviderTest) {
          const upgraded = await tryUpgradeBackendToLatestServerScript();
          if (upgraded) {
            if (_lastBackendHealthyBaseURL) {
              serviceBaseURL = trimTrailingSlash(_lastBackendHealthyBaseURL);
            }
            testURL = buildRemoteProviderTestAPIURL(serviceBaseURL);
            const retriedAttempt = await postProviderTestRequest(testURL, headers, providerTestPayload, PROVIDER_TEST_TIMEOUT_MS);
            const retriedResponse = retriedAttempt.response;
            const retriedPayload = retriedAttempt.payload;
            if (retriedResponse.ok && retriedPayload?.ok) {
              const suffix = autoDetect ? `（自动探测: ${serviceBaseURL}）` : "";
              setStatus(statusNode, `连接成功${suffix}：服务已升级到最新接口（${providerID} / ${retriedPayload?.model || modelName}）。`, "success");
              return;
            }
          }
        }

        const legacyProbe = await probeRemoteTasksAPI(serviceBaseURL, headers, {
          requireFastReadHealth: false
        });
        if (!legacyProbe?.response) {
          setStatus(statusNode, "连接失败: 旧版服务不可达，请确认本地服务已启动。", "error");
          return;
        }

        if (legacyProbe.response.status === 401 || legacyProbe.response.status === 403) {
          setStatus(statusNode, "连接失败: 旧版服务鉴权失败，请检查 API Key。", "error");
          return;
        }

        if (!legacyProbe.response.ok) {
          const message = legacyProbe.payload?.detail || legacyProbe.payload?.message || legacyProbe.payload?.error || `${legacyProbe.response.status} ${legacyProbe.response.statusText}`;
          setStatus(statusNode, `连接失败: 旧版服务任务接口异常 (${message})`, "error");
          return;
        }

        const suffix = autoDetect ? `（自动探测: ${serviceBaseURL}）` : "";
        setStatus(statusNode, `连接成功${suffix}：旧版服务（兼容模式）任务接口可用。若需完整 AI 连通性校验，请直接翻译 1-2 页 PDF。`, "success");
        return;
      }

      if (providerTestResponse.status === 401 || /invalid_api_key|token\s+expired/i.test(String(reason))) {
        setStatus(statusNode, "AI 测试失败: API Key 无效或已过期，请在 AI 源配置中更换可用密钥后重试。", "error");
        return;
      }

      setStatus(statusNode, `AI 测试失败: ${reason}`, "error");
      return;
    }

    const suffix = autoDetect ? `（自动探测: ${serviceBaseURL}）` : "";
    setStatus(statusNode, `连接成功${suffix}：${providerID} / ${providerPayload?.model || modelName}`, "success");
  }
  catch (error) {
    if (isRequestTimeoutError(error)) {
      setStatus(statusNode, "连接失败: AI 测试超时。请检查 endpoint 可达性、网络代理，或稍后重试。", "error");
      return;
    }
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

function normalizeBatchLibraries(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value[Symbol.iterator] === "function") {
    return Array.from(value).filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.values(value).filter(Boolean);
  }
  return [];
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
  const byID = new Map();

  const addLibrary = (library, fallbackID = 0, fallbackName = "") => {
    const libraryID = normalizeLibraryID(library?.libraryID || library?.id || fallbackID);
    if (!libraryID) {
      return;
    }

    const name = getBatchLibraryName(library || { libraryID, name: fallbackName }) || fallbackName;
    if (!name) {
      return;
    }

    byID.set(libraryID, {
      libraryID,
      name
    });
  };

  let libraries = [];
  try {
    libraries = normalizeBatchLibraries(Zotero?.Libraries?.getAll?.());
  }
  catch (error) {
    Zotero.logError(`fastRead: failed to enumerate Zotero libraries: ${error}`);
  }

  for (const library of libraries) {
    addLibrary(library);
  }

  const userLibraryID = normalizeLibraryID(
    Zotero?.Libraries?.userLibraryID
    || Zotero?.Libraries?.userLibrary?.libraryID
    || Zotero?.Libraries?.userLibrary?.id
  );
  if (userLibraryID && !byID.has(userLibraryID)) {
    let userLibrary = Zotero?.Libraries?.userLibrary || null;
    try {
      userLibrary = userLibrary || Zotero?.Libraries?.get?.(userLibraryID) || null;
    }
    catch (_error) {
    }
    addLibrary(userLibrary || { libraryID: userLibraryID, libraryType: "user" }, userLibraryID, "我的文库");
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
    joinPath(sourceDir, TRANSLATED_PDF_FILE_NAME),
    joinPath(sourceDir, `[fastRead 译文] ${parts.baseName}.${parts.ext || "pdf"}`),
    ...LEGACY_TRANSLATED_PDF_FILE_NAMES.map((name) => joinPath(sourceDir, name))
  ];

  const seen = new Set();
  for (const candidate of translatedCandidates) {
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
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
  const timeoutSec = Math.max(7200, Number(readPref(PREF_KEYS.remotePollTimeoutSec)) || 7200);
  const activeSelection = resolveActiveModelSelection(
    readPref(PREF_KEYS.remoteModelConfig),
    readPref(PREF_KEYS.remoteActiveModelId),
    readPref(PREF_KEYS.remoteProvider) || "deepseek",
    readPref(PREF_KEYS.remoteModel) || "deepseek-chat",
    readPref(PREF_KEYS.remoteSourceLang) || "en",
    readPref(PREF_KEYS.remoteTargetLang) || "zh"
  );
  return {
    baseURL: trimTrailingSlash(readPref(PREF_KEYS.remoteBaseURL)),
    apiKey: resolveEffectiveAPIKey(activeSelection.modelConfigObject, readPref(PREF_KEYS.remoteApiKey)),
    providerConfigId: activeSelection.providerID,
    sourceLang: activeSelection.sourceLang,
    targetLang: activeSelection.targetLang,
    modelConfig: safeJSONStringifyModelConfig(activeSelection.modelConfigObject),
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
    const explicitProbe = await probeRemoteTasksAPI(explicit, headers, {
      requireFastReadHealth: isLocalFastReadBaseURL(explicit)
    });
    if (explicitProbe?.reachable) {
      return explicit;
    }
  }

  await ensureBackendServerStarted();
  for (const candidate of LOCAL_REMOTE_BASE_URL_CANDIDATES) {
    const probe = await probeRemoteTasksAPI(candidate, headers, {
      requireFastReadHealth: true
    });
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

async function cancelBatchTranslationTask(config, taskID) {
  const detailURL = buildBatchDetailTaskURL(config?.baseURL, taskID);
  if (!detailURL) {
    return false;
  }

  try {
    const response = await fetchWithTimeout(detailURL, {
      method: "DELETE",
      headers: buildBatchRemoteHeaders(config),
      credentials: "include"
    }, 2500);
    return response.ok;
  }
  catch (error) {
    Zotero.debug(`fastRead: failed to cancel batch task ${taskID}: ${error}`);
    return false;
  }
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

function extractTaskProgress(payload) {
  const task = payload?.task || payload?.data?.task || payload?.data || payload || {};
  const value = Number(task?.progress || task?.progressPct || task?.progress_pct || 0);
  return Number.isFinite(value) ? value : 0;
}

function extractTaskStage(payload) {
  const task = payload?.task || payload?.data?.task || payload?.data || payload || {};
  return String(task?.stage || task?.stageLabel || task?.message || "").trim();
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
    providerConfigId: config.providerConfigId,
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

async function pollBatchTaskUntilComplete(config, taskID, shouldCancel = null, onProgress = null) {
  const detailURL = buildBatchDetailTaskURL(config?.baseURL, taskID);
  if (!detailURL) {
    throw new Error("任务详情 URL 无效。");
  }

  const startedAt = Date.now();
  const detailRequestTimeoutMs = resolveBatchDetailRequestTimeoutMs(config);
  while (Date.now() - startedAt < config.pollTimeoutMs) {
    if (typeof shouldCancel === "function" && shouldCancel()) {
      await cancelBatchTranslationTask(config, taskID);
      throw new Error("batch task cancelled");
    }

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
    if (typeof onProgress === "function") {
      try {
        onProgress({
          progress: extractTaskProgress(payload),
          stage: extractTaskStage(payload),
          status
        });
      }
      catch (_error) {
      }
    }
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

  const outputName = TRANSLATED_PDF_FILE_NAME;
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
