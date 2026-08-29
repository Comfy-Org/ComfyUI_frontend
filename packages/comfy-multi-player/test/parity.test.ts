import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type Op, type WidgetCatalog } from "../src/index.js";
import { canonicalize, fixturesDir } from "./helpers.js";
import type { SessionHeader } from "./helpers.js";

interface ConformanceManifest {
  format_version: number;
  /** Catalog path, relative to the manifest file. */
  catalog: string;
  /** Session paths in each case are relative to the manifest file. */
  cases: { name: string; session: string }[];
}

const manifestPath = resolve(fixturesDir, "golden-vectors", "conformance.json");
const manifestDir = dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ConformanceManifest;

/** Load the catalog the manifest actually points at, not the default helper path. */
function manifestCatalog(): WidgetCatalog {
  return JSON.parse(readFileSync(resolve(manifestDir, manifest.catalog), "utf8")) as WidgetCatalog;
}

/** Load a session by the manifest-relative path, resolving `../` explicitly. */
function sessionFromManifest(relPath: string): { header: SessionHeader; ops: Op[] } {
  const lines = readFileSync(resolve(manifestDir, relPath), "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  return {
    header: JSON.parse(lines[0]!) as SessionHeader,
    ops: lines.slice(1).map((l) => JSON.parse(l) as Op),
  };
}

describe("cross-language golden-vector parity contract", () => {
  it("uses the supported conformance format", () => {
    expect(manifest.format_version).toBe(1);
    expect(manifest.cases.length).toBeGreaterThan(0);
  });

  for (const vector of manifest.cases) {
    it(`${vector.name}: TS reference produces the recorded canonical output`, () => {
      const { header, ops } = sessionFromManifest(vector.session);
      const catalog = manifestCatalog();
      const doc = mint(header.base_workflow, catalog);
      const result = applyOps(doc, ops, catalog);

      expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
      expect(result.outcomes.filter((outcome) => outcome.outcome === "no-op").map((outcome) => outcome.op_id)).toEqual([]);
      expect(result.outcomes.filter((outcome) => outcome.outcome !== "rejected")).toHaveLength(ops.length);
      expect(canonicalize(project(doc, catalog))).toEqual(canonicalize(header.workflow_final));
    });
  }
});
