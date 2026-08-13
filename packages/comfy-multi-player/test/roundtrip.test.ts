/**
 * Projection round-trip property (schema §7): for every fixture workflow W,
 * `project(mint(W, catalog), catalog)` deep-equals `canonical(W)` — the
 * projection invents nothing (no default fields, no coerced nulls, no
 * dropped passthrough keys) and loses nothing but array order.
 *
 * Also pins migrate() (schema §10): validate + no-op at v1, fail-closed on
 * anything newer or unknown.
 */
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  SchemaVersionError,
  metaMap,
  migrate,
  mint,
  project,
  type WorkflowJSON,
} from "../src/index.js";
import { canonicalize, loadCatalog, loadLwwVectors, loadSession, sessionFiles } from "./helpers.js";

const catalog = loadCatalog();

function corpus(): [string, WorkflowJSON][] {
  const out: [string, WorkflowJSON][] = [];
  for (const file of sessionFiles()) {
    const { header } = loadSession(file);
    out.push([`${file} base_workflow`, header.base_workflow]);
    out.push([`${file} workflow_final`, header.workflow_final]);
  }
  const lww = loadLwwVectors();
  out.push(["lww base_workflow", lww.base_workflow]);
  out.push(["lww subgraph_base_workflow", lww.subgraph_base_workflow]);
  return out;
}

describe("mint→project round trip", () => {
  for (const [name, wf] of corpus()) {
    it(`${name}: project(mint(w)) === canonical(w)`, () => {
      const projected = project(mint(wf, catalog), catalog);
      expect(canonicalize(projected)).toEqual(canonicalize(wf));
    });
  }

  it("projection is deterministic (byte-stable across repeated reads)", () => {
    const { header } = loadSession(sessionFiles()[0]!);
    const doc = mint(header.base_workflow, catalog);
    expect(JSON.stringify(project(doc, catalog))).toBe(JSON.stringify(project(doc, catalog)));
  });

  it("mint pins schema_version and the catalog version", () => {
    const doc = mint({ nodes: [], links: [] }, catalog, "object_info@test");
    expect(metaMap(doc).get("schema_version")).toBe(SCHEMA_VERSION);
    expect(metaMap(doc).get("catalog_version")).toBe("object_info@test");
    // Doc-internal meta never leaks into the projection.
    const wf = project(doc, catalog);
    expect("schema_version" in wf).toBe(false);
    expect("catalog_version" in wf).toBe(false);
  });
});

describe("migrate (schema §10)", () => {
  it("is an exact no-op at the current version", () => {
    const doc = mint(loadSession(sessionFiles()[0]!).header.base_workflow, catalog);
    const before = JSON.stringify(project(doc, catalog));
    migrate(doc, SCHEMA_VERSION);
    expect(JSON.stringify(project(doc, catalog))).toBe(before);
  });

  it("fails closed on a doc newer than this package", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    expect(() => migrate(doc, SCHEMA_VERSION + 1)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, SCHEMA_VERSION + 1)).toThrow(/fail-closed/);
  });

  it("rejects versions below the first layout", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    expect(() => migrate(doc, 0)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, Number.NaN)).toThrow(SchemaVersionError);
  });

  it("rejects a fromVersion that contradicts the doc's own schema_version", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    metaMap(doc).set("schema_version", SCHEMA_VERSION + 5);
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(SchemaVersionError);
  });
});
