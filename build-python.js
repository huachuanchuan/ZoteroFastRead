const { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { homedir } = require("node:os");

const root = __dirname;
const output = "fastRead-Python.xpi";
const baseFiles = ["manifest.json", "bootstrap.js", "reader-script.js", "server.py", "bg.svg"];
const pyInstallerWorkDir = join(root, ".build-python-work");
const pyInstallerDistDir = join(pyInstallerWorkDir, "dist");
const pyInstallerBuildDir = join(pyInstallerWorkDir, "build");
const strictUniversal = process.env.FASTREAD_STRICT_UNIVERSAL === "1";

const backendArchivePathByPlatform = {
  win32: "bin/fastread-server.exe",
  linux: "bin/fastread-server-linux",
  darwin: "bin/fastread-server-macos",
};

const backendArtifactNameByPlatform = {
  win32: "fastread-server.exe",
  linux: "fastread-server",
  darwin: "fastread-server",
};

const universalRequiredPlatforms = ["win32"];
const universalRequiredArchivePaths = universalRequiredPlatforms
  .map((platform) => backendArchivePathByPlatform[platform])
  .filter(Boolean);

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function resolvePythonCommand() {
  const windowsPython312 = process.platform === "win32"
    ? join(process.env.USERPROFILE || homedir(), "AppData", "Local", "Programs", "Python", "Python312", "python.exe")
    : "";
  const candidates = process.platform === "win32"
    ? [[windowsPython312, []], ["py", ["-3.12"]], ["python3", []], ["python", []], ["py", ["-3"]]]
    : [["python3", []], ["python", []], ["py", ["-3"]]];

  for (const [command, launcherArgs] of candidates) {
    const runtimeProbe = spawnSync(command, [...launcherArgs, "-c", "import sys; sys.exit(0)"], {
      cwd: root,
      stdio: "pipe",
    });
    if (runtimeProbe.status !== 0) {
      continue;
    }

    const pyInstallerProbe = spawnSync(command, [...launcherArgs, "-m", "PyInstaller", "--version"], {
      cwd: root,
      stdio: "pipe",
    });
    if (pyInstallerProbe.status !== 0) {
      continue;
    }

    return { command, launcherArgs };
  }

  return null;
}

function runPython(python, args, label, options = {}) {
  const result = spawnSync(python.command, [...python.launcherArgs, ...args], {
    cwd: root,
    stdio: options.stdio || "inherit",
    encoding: options.encoding,
  });
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status || 1}.`, result.status || 1);
  }
  return result;
}

function ensureInputFiles(files) {
  for (const file of files) {
    if (!existsSync(join(root, file))) {
      fail(`Missing required file: ${file}`);
    }
  }
}

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function clearPath(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

function uniqByArchivePath(members) {
  const byArchivePath = new Map();
  for (const member of members) {
    byArchivePath.set(member.archivePath, member);
  }
  return Array.from(byArchivePath.values());
}

function discoverBundledBackendsInWorkspace(archivePaths) {
  const discovered = [];
  for (const archivePath of archivePaths) {
    const sourcePath = join(root, archivePath);
    if (existsSync(sourcePath)) {
      discovered.push({ sourcePath, archivePath });
    }
  }
  return discovered;
}

function missingBackendArchivePaths(discoveredMembers, archivePaths) {
  const present = new Set(discoveredMembers.map((member) => member.archivePath));
  return archivePaths.filter((archivePath) => !present.has(archivePath));
}

function stopRunningBundledBackendOnWindows() {
  if (process.platform !== "win32") {
    return;
  }

  spawnSync("taskkill", ["/IM", "fastread-server.exe", "/T", "/F"], {
    cwd: root,
    stdio: "ignore",
  });
}

function buildBundledBackend(python) {
  const backendArchivePath = backendArchivePathByPlatform[process.platform];
  if (!backendArchivePath) {
    fail(`Unsupported platform for bundled backend: ${process.platform}`);
  }

  clearPath(pyInstallerWorkDir);
  ensureDir(pyInstallerDistDir);
  ensureDir(pyInstallerBuildDir);
  ensureDir(join(homedir(), ".cache", "babeldoc"));

  const backendArtifactName = backendArtifactNameByPlatform[process.platform];
  if (!backendArtifactName) {
    fail(`Unsupported backend artifact for platform: ${process.platform}`);
  }

  const pyInstallerArgs = [
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--name",
    "fastread-server",
    "--specpath",
    pyInstallerWorkDir,
    "--distpath",
    pyInstallerDistDir,
    "--workpath",
    pyInstallerBuildDir,
    "--exclude-module",
    "PyQt6",
    "--exclude-module",
    "PySide6",
    "--exclude-module",
    "PySide6_Essentials",
    "--exclude-module",
    "PySide6_Addons",
    "--exclude-module",
    "IPython",
    "--exclude-module",
    "jupyter",
    "--exclude-module",
    "matplotlib",
    "--exclude-module",
    "pandas",
    "--exclude-module",
    "dask",
    "--exclude-module",
    "xarray",
    "--exclude-module",
    "openpyxl",
    "--exclude-module",
    "h5py",
    "--collect-all",
    "babeldoc",
    "--collect-all",
    "tiktoken",
    "--collect-all",
    "tiktoken_ext",
    "--collect-all",
    "rich",
    "--collect-all",
    "skimage",
    "--collect-all",
    "sklearn",
    "server.py",
  ];

  if (process.platform === "win32") {
    pyInstallerArgs.splice(5, 0, "--noconsole");
  }

  runPython(
    python,
    pyInstallerArgs,
    "PyInstaller backend build"
  );

  const generatedPath = join(pyInstallerDistDir, backendArtifactName);
  if (!existsSync(generatedPath)) {
    fail(`PyInstaller output not found: ${generatedPath}`);
  }

  const targetPath = join(root, backendArchivePath);
  ensureDir(join(root, "bin"));
  stopRunningBundledBackendOnWindows();
  let packageSource = generatedPath;
  try {
    try {
      clearPath(targetPath);
    }
    catch (_error) {
    }

    copyFileSync(generatedPath, targetPath);
    packageSource = targetPath;
  }
  catch (error) {
    console.warn(`Warning: failed to update ${backendArchivePath} in workspace; packaging with temporary build output. ${error}`);
  }
  if (process.platform !== "win32" && packageSource === targetPath) {
    chmodSync(targetPath, 0o755);
  }

  return {
    sourcePath: packageSource,
    archivePath: backendArchivePath,
  };
}

function ensurePackageMembers(members) {
  for (const member of members) {
    if (!member || !member.sourcePath || !member.archivePath) {
      fail(`Invalid package member descriptor: ${JSON.stringify(member)}`);
    }
    if (!existsSync(member.sourcePath)) {
      fail(`Missing package source file: ${member.sourcePath}`);
    }
  }
}

function assertBackendPayload(member) {
  if (!member || !member.sourcePath || !member.archivePath) {
    return;
  }

  if (member.archivePath !== "bin/fastread-server.exe") {
    return;
  }

  const binary = readFileSync(member.sourcePath);
  if (!binary.includes(Buffer.from("babeldoc.main"))) {
    fail(
      "Windows backend validation failed: babeldoc payload marker not found in fastread-server.exe. Rebuild backend with Python 3.12 and vendored BabelDOC before packaging."
    );
  }
}

function packageXpi(python, members) {
  const zipScript = [
    "import pathlib, sys, zipfile",
    "out = pathlib.Path(sys.argv[1])",
    "args = sys.argv[2:]",
    "if len(args) % 2 != 0:",
    "    raise SystemExit('Invalid zip arguments: expected source/archive pairs')",
    "with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as zf:",
    "    for idx in range(0, len(args), 2):",
    "        source = args[idx]",
    "        archive = args[idx + 1]",
    "        zf.write(source, arcname=archive.replace('\\\\', '/'))",
  ].join("\n");

  const pairArgs = members.flatMap((member) => [member.sourcePath, member.archivePath]);
  runPython(python, ["-c", zipScript, output, ...pairArgs], "XPI package creation");
}

function validateArchiveEntries(python, members) {
  const listScript = [
    "import sys, zipfile",
    "with zipfile.ZipFile(sys.argv[1], 'r') as zf:",
    "    [print(name) for name in zf.namelist()]",
  ].join("\n");

  const listResult = runPython(
    python,
    ["-c", listScript, output],
    "XPI archive validation",
    { stdio: "pipe", encoding: "utf8" }
  );

  const archiveEntries = listResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\\/g, "/"));

  for (const member of members) {
    const normalized = member.archivePath.replace(/\\/g, "/");
    if (!archiveEntries.includes(normalized)) {
      fail(`Archive validation failed: missing entry ${member.archivePath}`);
    }
  }
}

const python = resolvePythonCommand();
if (!python) {
  fail("No usable Python+PyInstaller runtime found. Install PyInstaller for your active Python (or use the py launcher) to build fastRead-Python.xpi.");
}

ensureInputFiles(baseFiles);

let discoveredBackendMembers = discoverBundledBackendsInWorkspace(universalRequiredArchivePaths);
const currentPlatformArchivePath = backendArchivePathByPlatform[process.platform];

if (
  currentPlatformArchivePath
  && universalRequiredArchivePaths.includes(currentPlatformArchivePath)
) {
  const builtCurrentPlatformMember = buildBundledBackend(python);
  discoveredBackendMembers = uniqByArchivePath([
    ...discoveredBackendMembers,
    builtCurrentPlatformMember,
  ]);
}

const missingBackends = missingBackendArchivePaths(discoveredBackendMembers, universalRequiredArchivePaths);
if (missingBackends.length > 0) {
  const message = `Windows/macOS universal package is missing backend binaries: ${missingBackends.join(", ")}.`;
  if (strictUniversal) {
    fail(`${message} Build these binaries on their target OS and copy them into ./bin before packaging.`);
  }
  console.warn(`[WARN] ${message} The XPI will still be built with available binaries.`);
}

const packageMembers = [
  ...baseFiles.map((file) => ({ sourcePath: file, archivePath: file })),
  ...discoveredBackendMembers,
];
ensurePackageMembers(packageMembers);
for (const member of packageMembers) {
  assertBackendPayload(member);
}

if (existsSync(join(root, output))) {
  rmSync(join(root, output));
}

packageXpi(python, packageMembers);
validateArchiveEntries(python, packageMembers);
clearPath(pyInstallerWorkDir);

console.log(`Built ${output} with ${discoveredBackendMembers.length} bundled backend(s): ${discoveredBackendMembers.map((member) => member.archivePath).join(", ")}`);
