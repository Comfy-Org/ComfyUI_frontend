import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distEntry = join(root, "dist", "index.js");

describe("purity", () => {
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
