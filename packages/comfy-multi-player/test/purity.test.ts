import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distEntry = join(root, "dist", "index.js");

describe("purity", () => {
  it("has exactly yjs as its declared and resolved production dependency root", () => {
    const run = spawnSync("npm", ["ls", "--omit=dev", "--json", "--all"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const tree = JSON.parse(run.stdout) as {
      dependencies?: Record<
        string,
        { version?: string; resolved?: string; missing?: boolean; invalid?: boolean; extraneous?: boolean }
      >;
    };
    // A production root must be installed and valid, not just non-extraneous:
    // a missing/invalid yjs node must fail this assertion, not pass it.
    const resolvedRoots = Object.entries(tree.dependencies ?? {})
      .filter(
        ([, dep]) =>
          (dep.version !== undefined || dep.resolved !== undefined) &&
          !dep.missing &&
          !dep.invalid &&
          !dep.extraneous,
      )
      .map(([name]) => name)
      .sort();
    expect(resolvedRoots).toEqual(["yjs"]);

    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual(["yjs"]);
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
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });
});
