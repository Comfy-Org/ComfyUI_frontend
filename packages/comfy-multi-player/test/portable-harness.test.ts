import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { systemExecutable } from "./process-helpers.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary: string[] = [];

function temp(prefix: string) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(path);
  return path;
}

function writeHarnessFakes(bin: string, healthy: boolean) {
  writeFileSync(
    join(bin, "npm"),
    `#!/bin/bash
set -e
[ -z "\${HARNESS_NPM_LOG:-}" ] || printf '%s|%s\n' "$(pwd)" "$*" >> "$HARNESS_NPM_LOG"
if [ "$1" = install ]; then
  tarball="\${!#}"; mkdir -p node_modules/@comfyorg/comfy-multi-player
  tar -xzf "$tarball" -C node_modules/@comfyorg/comfy-multi-player --strip-components=1
elif [ "$1" = ci ]; then
  mkdir -p node_modules/yjs; printf '{"name":"yjs","main":"index.js"}' > node_modules/yjs/package.json; : > node_modules/yjs/index.js
elif [ "$1 $2" = "run build" ]; then
  mkdir -p dist; cat > dist/server.js <<'EOF'
import http from 'node:http';
http.createServer((req,res) => { if (req.url === '/health') { res.end('ok'); } else { res.statusCode=404; res.end(); } }).listen(Number(process.env.PORT), '127.0.0.1');
EOF
fi
`,
  );
  writeFileSync(
    join(bin, "pnpm"),
    `#!/bin/bash
set -e
[ -z "\${HARNESS_NPM_LOG:-}" ] || printf 'pnpm:%s|%s\n' "$(pwd)" "$*" >> "$HARNESS_NPM_LOG"
if [ "$1" = pack ]; then
  while [ "$1" != "--pack-destination" ]; do shift; done; dest="$2"
  work="$(mktemp -d)"; mkdir -p "$work/package/dist"
  printf "export const marker = 'packed';\\n" > "$work/package/dist/index.js"
  printf '{"name":"@comfyorg/comfy-multi-player","version":"0.2.1","type":"module","exports":{".":{"types":"./dist/index.d.ts","import":"./dist/index.js"}},"dependencies":{"yjs":"^13.6.0"}}' > "$work/package/package.json"
  tar -czf "$dest/comfyorg-comfy-multi-player-0.2.1.tgz" -C "$work" package; rm -rf "$work"
  printf '{"name":"@comfyorg/comfy-multi-player","version":"0.2.1","filename":"%s","files":[{"path":"dist/index.js"},{"path":"package.json"}]}' "$dest/comfyorg-comfy-multi-player-0.2.1.tgz"
fi
`,
  );
  writeFileSync(join(bin, "seq"), "#!/bin/sh\necho 1\n");
  writeFileSync(join(bin, "sleep"), "#!/bin/sh\nexit 0\n");
  writeFileSync(
    join(bin, "curl"),
    `#!/bin/sh
countfile="\${HARNESS_CURL_COUNT}"; count=0; [ ! -f "$countfile" ] || count=$(cat "$countfile"); count=$((count+1)); echo "$count" > "$countfile"
[ "$count" -gt 1 ] && exit ${healthy ? 0 : 1}; exit 1
`,
  );
  writeFileSync(join(bin, "node"), `#!/bin/sh\ncase "$1" in *dochost-driver.mjs) echo driver-ran;; *) exec "${process.execPath}" "$@";; esac\n`);
  for (const executable of ["npm", "pnpm", "seq", "sleep", "curl", "node"]) chmodSync(join(bin, executable), 0o755);
}

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("portable harness regressions", () => {
  it("accepts an installed CMP whose complete dist tree matches the packed artifact", () => {
    const root = temp("cmp-identity-");
    const packed = join(root, "packed/package");
    const stage = join(root, "stage");
    mkdirSync(join(packed, "dist/nested"), { recursive: true });
    writeFileSync(join(packed, "dist/index.js"), "export const marker = 'genuine';\n");
    writeFileSync(join(packed, "dist/nested/index.d.ts"), "export declare const marker: string;\n");
    writeFileSync(join(packed, "package.json"), '{"name":"@comfyorg/comfy-multi-player","version":"0.2.1"}');
    const installed = join(stage, "node_modules/@comfyorg/comfy-multi-player");
    mkdirSync(dirname(installed), { recursive: true });
    cpSync(packed, installed, { recursive: true });

    const run = spawnSync(process.execPath, [join(repoRoot, "examples/dochost-poc/verify-package-identity.mjs"), packed, stage], {
      encoding: "utf8",
    });
    expect(run.status, run.stderr).toBe(0);
  });

  it.each(["dist bytes", "manifest"])("rejects same-version installed CMP with tampered %s", (tampered) => {
    const root = temp("cmp-identity-tampered-");
    const packed = join(root, "packed/package");
    const stage = join(root, "stage");
    mkdirSync(join(packed, "dist"), { recursive: true });
    writeFileSync(join(packed, "dist/index.js"), "export const marker = 'genuine';\n");
    writeFileSync(join(packed, "package.json"), '{"name":"@comfyorg/comfy-multi-player","version":"0.2.1"}');
    const installed = join(stage, "node_modules/@comfyorg/comfy-multi-player");
    mkdirSync(join(installed, "dist"), { recursive: true });
    writeFileSync(join(installed, "dist/index.js"), tampered === "dist bytes"
      ? "export const marker = 'stale';\n" : readFileSync(join(packed, "dist/index.js")));
    writeFileSync(join(installed, "package.json"), tampered === "manifest"
      ? '{"name":"@comfyorg/comfy-multi-player","version":"0.2.1","exports":"./wrong.js"}'
      : readFileSync(join(packed, "package.json")));

    const run = spawnSync(process.execPath, [join(repoRoot, "examples/dochost-poc/verify-package-identity.mjs"), packed, stage], {
      encoding: "utf8",
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("package identity mismatch");
  });

  it.each([
    {
      name: "clean complete report",
      eslintStatus: 0,
      output: '[{"filePath":"fixture.ts","messages":[]},{"filePath":"path with spaces.ts","messages":[]}]',
      expected: 0,
      selectedFiles: ["fixture.ts", "path with spaces.ts"],
    },
    {
      name: "partial report",
      eslintStatus: 0,
      output: '[{"filePath":"fixture.ts","messages":[]}]',
      expected: 2,
      selectedFiles: ["fixture.ts", "path with spaces.ts"],
    },
    { name: "omitted inputs", eslintStatus: 0, output: "", expected: 2, selectedFiles: [] },
    {
      name: "findings",
      eslintStatus: 1,
      output:
        '[{"filePath":"fixture.ts","messages":[{"severity":2,"ruleId":"sonarjs/no-identical-expressions","line":17,"message":"Correct one of the identical sub-expressions on both sides of operator."}]}]',
      expected: 1,
    },
    { name: "execution error", eslintStatus: 2, output: '[{"filePath":"fixture.ts","messages":[]}]', expected: 2 },
    { name: "malformed JSON", eslintStatus: 0, output: '{', expected: 2 },
    { name: "empty output", eslintStatus: 0, output: '', expected: 2 },
    { name: "malformed result row", eslintStatus: 0, output: '[{}]', expected: 2 },
    {
      name: "non-array messages",
      eslintStatus: 0,
      output: '[{"filePath":"fixture.ts","messages":{}}]',
      expected: 2,
    },
  ])("the documented SonarJS command classifies $name", ({ name, eslintStatus, output, expected, selectedFiles = ["fixture.ts"] }) => {
    const profile = readFileSync(join(repoRoot, ".agents/checks/sonarjs-lint.md"), "utf8");
    const command = profile.split("```bash\n").slice(1)
      .map((block) => block.split("```")[0])
      .find((block) => block?.includes("npx eslint"));
    expect(command).toBeDefined();
    expect(command).not.toContain("npm i");
    const bin = temp("sonar-command-");
    const ambientBin = temp("hostile-ambient-node-");
    writeFileSync(join(bin, "npx"), `#!/bin/sh\nprintf '%s\\n' "$@" > eslint-arguments\nprintf '%s' '${output}'\nexit ${eslintStatus}\n`);
    symlinkSync(process.execPath, join(bin, "node"));
    writeFileSync(join(ambientBin, "node"), "#!/bin/sh\necho hostile ambient node >&2\nexit 127\n");
    chmodSync(join(bin, "npx"), 0o755);
    chmodSync(join(ambientBin, "node"), 0o755);
    const run = spawnSync(systemExecutable("bash"), ["-c", command!, "sonarjs-lint-test", ...selectedFiles], {
      encoding: "utf8",
      cwd: bin,
      env: { ...process.env, PATH: `${bin}:${ambientBin}:/usr/bin:/bin` },
    });
    expect(run.status, `documented command stderr:\n${run.stderr}`).toBe(expected);
    if (selectedFiles.length > 0) expect(run.stdout).toContain(`eslint exit: ${eslintStatus}`);
    else expect(run.stderr).toContain("INDETERMINATE: no selected files");
    expect(run.stderr).not.toContain("hostile ambient node");
    if (selectedFiles.length > 0) {
      const eslintArguments = readFileSync(join(bin, "eslint-arguments"), "utf8").trimEnd().split("\n");
      expect(eslintArguments.slice(-selectedFiles.length)).toEqual(selectedFiles);
    }
    if (name === "findings") {
      expect(run.stdout).toContain('"severity":2');
      expect(run.stdout).toContain('"ruleId":"sonarjs/no-identical-expressions"');
      expect(run.stdout).toContain('"line":17');
      expect(run.stdout).toContain('"message":"Correct one of the identical sub-expressions on both sides of operator."');
    }
  });

  it("the driver's root calculation decodes a URL-encoded checkout path", () => {
    const checkout = join(temp("dochost path "), "repo root");
    const driver = join(checkout, "examples/dochost-poc/dochost-driver.mjs");
    mkdirSync(dirname(driver), { recursive: true });
    const source = readFileSync(join(repoRoot, "examples/dochost-poc/dochost-driver.mjs"), "utf8");
    // Run the actual setup, stopping before catalog I/O and network operations.
    const boundary = source.indexOf("const catalog =");
    expect(boundary).toBeGreaterThan(0);
    writeFileSync(driver, `${source.slice(0, boundary)}\nprocess.stdout.write(CMP);\n`);
    const env = { ...process.env };
    delete env.CMP_PIN;
    const converted = spawnSync(process.execPath, [driver], { encoding: "utf8", env });
    expect(converted.status).toBe(0);
    expect(converted.stdout.trim()).toBe(`${checkout}/`);
  });

  for (const { name, expectedStatus, healthy } of [
    { name: "unhealthy", expectedStatus: 1, healthy: false },
    { name: "healthy", expectedStatus: 0, healthy: true },
  ]) {
    it(`${name} sidecar controls whether the driver runs`, () => {
      const root = temp("dochost-run-");
      const bin = join(root, "bin");
      const sidecar = join(root, "sidecar");
      mkdirSync(bin);
      mkdirSync(sidecar);
      writeFileSync(join(sidecar, "package.json"), '{"name":"dochost","type":"module"}');
      writeFileSync(join(sidecar, "package-lock.json"), '{"name":"dochost","lockfileVersion":3,"packages":{"":{"name":"dochost"}}}');
      writeFileSync(join(sidecar, "source-marker"), "unchanged\n");
      writeHarnessFakes(bin, healthy);
      const stages = join(root, "stages");
      mkdirSync(stages);
      const npmLog = join(root, "npm.log");
      const run = spawnSync(systemExecutable("bash"), [join(repoRoot, "examples/dochost-poc/run.sh")], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:/usr/bin:/bin`,
          DOCHOST_SRC: sidecar,
          TMPDIR: stages,
          HARNESS_CURL_COUNT: join(root, "curl-count"),
          HARNESS_NPM_LOG: npmLog,
        },
      });
      expect(run.status, run.stderr).toBe(expectedStatus);
      expect(run.stdout.includes("driver-ran")).toBe(healthy);
      if (!healthy) expect(run.stderr).toContain("sidecar did not become healthy");
      expect(readFileSync(join(sidecar, "source-marker"), "utf8")).toBe("unchanged\n");
      const commands = readFileSync(npmLog, "utf8").split("\n");
      expect(commands).toContain(`pnpm:${repoRoot}|run build`);
      expect(commands.filter((line) => line.startsWith(`pnpm:${repoRoot}|pack `))).toEqual([
        expect.stringContaining("pack --config.ignore-scripts=true --json --pack-destination "),
      ]);
      const docHostCommands = commands.filter((line) => /^[^:]+\|(ci|install|run build)/.test(line));
      expect(docHostCommands.some((line) => line.startsWith(`${repoRoot}|`))).toBe(false);
      expect(docHostCommands).not.toHaveLength(0);
      expect(docHostCommands.every((line) => !line.startsWith(`${sidecar}|`))).toBe(true);
      expect(readdirSync(stages)).toEqual([]);
    });
  }

  it("bounds an actual stalled health request", async () => {
    const root = temp("dochost-stalled-");
    const bin = join(root, "bin");
    const sidecar = join(root, "sidecar");
    mkdirSync(bin);
    mkdirSync(sidecar);
    writeFileSync(join(sidecar, "package.json"), '{"name":"dochost","type":"module"}');
    writeFileSync(join(sidecar, "package-lock.json"), '{"name":"dochost","lockfileVersion":3,"packages":{"":{"name":"dochost"}}}');
    writeHarnessFakes(bin, false);
    // Exercise real curl's timeout; the staged child stays alive without binding
    // this port, which is held by the deliberately stalled TCP server below.
    rmSync(join(bin, "curl"));
    writeFileSync(join(bin, "node"), `#!/bin/sh\ncase "$1" in dist/server.js) exec /bin/sleep 30;; *) exec "${process.execPath}" "$@";; esac\n`);

    const serverFile = join(root, "stall.mjs");
    writeFileSync(serverFile, "import net from 'node:net'; net.createServer(() => {}).listen(0, '127.0.0.1', function () { console.log(this.address().port); });\n");
    const server = spawn(process.execPath, [serverFile], { stdio: ["ignore", "pipe", "inherit"] });
    const port = await new Promise<string>((resolve, reject) => {
      server.once("error", reject);
      server.stdout.once("data", (chunk) => resolve(String(chunk).trim()));
    });
    try {
      const started = Date.now();
      const run = spawnSync(systemExecutable("bash"), [join(repoRoot, "examples/dochost-poc/run.sh")], {
        encoding: "utf8",
        timeout: 2_000,
        env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, DOCHOST_SRC: sidecar, PORT: port, HARNESS_CURL_COUNT: join(root, "curl-count") },
      });
      expect(run.error).toBeUndefined();
      expect(run.status).toBe(1);
      expect(Date.now() - started).toBeLessThan(1_500);
      expect(run.stderr).toContain("within 15s");
    } finally {
      server.kill();
    }
  });

  it("rejects equal-count readers with unequal link values", () => {
    const source = readFileSync(join(repoRoot, "scripts/bench-read.mjs"), "utf8");
    const assertion = source.match(/const ok =([\s\S]*?);/)?.[1];
    expect(assertion).toBeDefined();
    const nodes = new Map([["1", { id: "1" }]]);
    const left = { nodes, links: new Map([["7", { id: "7", targetId: "1" }]]) };
    const right = { nodes, links: new Map([["7", { id: "7", targetId: "2" }]]) };
    // eslint-disable-next-line sonarjs/code-eval -- Execute the checked-in benchmark assertion itself to kill its equal-count mutant; never caller input.
    expect(runInNewContext(assertion!, { ra: left, rb: right })).toBe(false);
    // eslint-disable-next-line sonarjs/code-eval -- Same checked-in assertion, positive control proving the harness can accept equal readers.
    expect(runInNewContext(assertion!, { ra: left, rb: left })).toBe(true);
  });
});
