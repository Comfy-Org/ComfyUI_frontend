import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assert, describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distEntry = join(root, "dist", "index.js");

describe("purity", () => {
  it("has exactly yjs as its declared and resolved production dependency root", () => {
    const pnpmCli = process.env.npm_execpath;
    assert(pnpmCli && isAbsolute(pnpmCli), "Run tests through pnpm test");
    const run = spawnSync(process.execPath, [pnpmCli, "--filter", "@comfyorg/comfy-multi-player", "list", "--prod", "--depth", "Infinity", "--json"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(run.error, `pnpm list failed: ${run.stderr}`).toBeUndefined();
    expect(run.status, `pnpm list exited ${String(run.status)}: ${run.stderr}`).toBe(0);
    const trees = JSON.parse(run.stdout) as {
      name?: string;
      dependencies?: Record<
        string,
        { version?: string; resolved?: string; missing?: boolean; invalid?: boolean; extraneous?: boolean }
      >;
    }[];
    expect(trees).toHaveLength(1);
    const [tree] = trees;
    assert(tree);
    expect(tree.name).toBe("@comfyorg/comfy-multi-player");
    const roots = Object.entries(tree.dependencies ?? {});
    for (const [name, dependency] of roots) {
      expect(dependency.version, `${name} must have npm installation metadata`).toBeTruthy();
      expect(dependency.missing, `${name} must be installed`).not.toBe(true);
      expect(dependency.invalid, `${name} must satisfy its declared range`).toBeFalsy();
      expect(dependency.extraneous, `${name} must not be extraneous`).not.toBe(true);
    }
    const resolvedRoots = roots.map(([name]) => name).sort();
    expect(resolvedRoots).toEqual(["yjs"]);

    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual(["yjs"]);
  });

  it("makes the production gate fail on a planted framework dependency", () => {
    const fixture = mkdtempSync(join(tmpdir(), "purity-"));
    try {
      writeFileSync(
        join(fixture, "package.json"),
        JSON.stringify({ dependencies: { react: "^19.0.0", yjs: "^13.6.27" } }),
      );
      const run = spawnSync(process.execPath, [join(root, "scripts", "check-purity.mjs")], {
        encoding: "utf8",
        env: { ...process.env, PURITY_ROOT: fixture },
      });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("runtime dependencies must be exactly {yjs}");
      expect(run.stderr).toContain("{react, yjs}");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("test environment itself is bare node (no DOM globals)", () => {
    expect(typeof (globalThis as Record<string, unknown>)["window"]).toBe("undefined");
    expect(typeof (globalThis as Record<string, unknown>)["document"]).toBe("undefined");
  });

  it("built output imports cleanly in a bare Node subprocess", () => {
    // dist/ is produced by `npm run build`; CI builds before testing.
    expect(existsSync(distEntry), "dist/index.js missing — run `npm run build` first").toBe(true);

    const probe = `
      const mod = await import(${JSON.stringify(pathToFileURL(distEntry).href)});
      if (typeof mod.SCHEMA_VERSION !== "number") process.exit(2);
      if (typeof globalThis.window !== "undefined" || typeof globalThis.document !== "undefined") process.exit(3);
    `;
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      encoding: "utf8",
    });
    expect(run.status, run.stderr).toBe(0);
  });
});
