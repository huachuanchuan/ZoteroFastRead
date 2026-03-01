const { existsSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = __dirname;
const output = "Zotero-DeepRead.xpi";
const files = ["manifest.json", "bootstrap.js", "reader-script.js", "server.py", "bg.svg"];

for (const file of files) {
  if (!existsSync(join(root, file))) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
}

if (existsSync(join(root, output))) {
  rmSync(join(root, output));
}

function resolvePythonCommand() {
  const candidates = [
    ["python3", ["-c", "import sys; sys.exit(0)"]],
    ["python", ["-c", "import sys; sys.exit(0)"]],
    ["py", ["-3", "-c", "import sys; sys.exit(0)"]],
  ];

  for (const [command, args] of candidates) {
    const result = spawnSync(command, args, { cwd: root });
    if (result.status === 0) {
      return { command, launcherArgs: command === "py" ? ["-3"] : [] };
    }
  }

  return null;
}

const python = resolvePythonCommand();
if (!python) {
  console.error("Missing Python runtime. Install python3/python (or py launcher) to build the XPI.");
  process.exit(1);
}

const zipScript = [
  "import pathlib, sys, zipfile",
  "out = pathlib.Path(sys.argv[1])",
  "members = sys.argv[2:]",
  "with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as zf:",
  "    for member in members:",
  "        zf.write(member, arcname=member.replace('\\\\', '/'))",
].join("\n");

const createResult = spawnSync(
  python.command,
  [...python.launcherArgs, "-c", zipScript, output, ...files],
  { cwd: root, stdio: "inherit" }
);

if (createResult.status !== 0) {
  process.exit(createResult.status || 1);
}

const listScript = [
  "import sys, zipfile",
  "with zipfile.ZipFile(sys.argv[1], 'r') as zf:",
  "    [print(name) for name in zf.namelist()]",
].join("\n");

const listResult = spawnSync(
  python.command,
  [...python.launcherArgs, "-c", listScript, output],
  { cwd: root, encoding: "utf8" }
);

if (listResult.status !== 0) {
  console.error(listResult.stderr || "Failed to inspect archive contents");
  process.exit(listResult.status || 1);
}

const archiveEntries = listResult.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.replace(/\\/g, "/"));

for (const file of files) {
  const normalized = file.replace(/\\/g, "/");
  if (!archiveEntries.includes(normalized)) {
    console.error(`Archive validation failed: missing entry ${file}`);
    process.exit(1);
  }
}

console.log(`Built ${output} with ${files.length} entries.`);
