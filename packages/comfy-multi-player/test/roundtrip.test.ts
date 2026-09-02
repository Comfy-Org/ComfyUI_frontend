/**
 * Projection round-trip property (schema §7): for every fixture workflow W,
 * `project(mint(W, catalog), catalog)` deep-equals `canonical(W)` — the
 * projection invents nothing (no default fields, no coerced nulls, no
 * dropped passthrough keys) and loses nothing but array order.
 *
 * Also pins migrate() (schema §10): validate the doc's own schema_version on
 * every read, then an EXACT no-op at v1 that materializes no root type;
 * fail-closed on anything newer, unknown, contradictory, or unreadable.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { metaMap } from "../src/doc.js";
import {
  SCHEMA_VERSION,
  SchemaVersionError,
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

    // Byte-level fidelity, not just deep equality: the canonical serialization
    // (schema §7 rule 3) of every node's widgets_values must come back
    // character-for-character. This is what pins OPAQUE storage for classes the
    // pinned catalog cannot describe (§1.2) — an opaque array is re-emitted
    // verbatim, so any re-keying, padding, or re-typing shows up here.
    it(`${name}: every widgets_values projects byte-identically`, () => {
      const projected = project(mint(wf, catalog), catalog);
      const byId = new Map(projected.nodes.map((n) => [String(n.id), n]));
      for (const src of wf.nodes) {
        if (!("widgets_values" in src)) continue;
        expect(
          JSON.stringify(byId.get(String(src.id))!.widgets_values),
          `node ${String(src.id)} (${src.type})`,
        ).toBe(JSON.stringify(src.widgets_values));
      }
    });
  }

  /**
   * Anti-vacuity guard for the byte-identity check above: the corpus must keep
   * carrying frontend-only classes, and the pinned catalog must keep NOT
   * describing them. Adding `Note: ["text"]` to fixtures/catalog.json would
   * make the opaque path unreachable and every assertion above vacuous — and
   * that is the rejected alternative (a hand-maintained list that the next
   * frontend-only node breaks identically).
   */
  it("the corpus pins frontend-only classes that the catalog cannot describe", () => {
    const frontendOnly = corpus().flatMap(([, wf]) =>
      wf.nodes.filter((n) => n.type === "Note" || n.type === "MarkdownNote"),
    );
    expect(frontendOnly.length).toBeGreaterThan(0);
    expect(new Set(frontendOnly.map((n) => n.type))).toEqual(new Set(["Note", "MarkdownNote"]));
    for (const n of frontendOnly) {
      expect(catalog.types[n.type], `${n.type} must stay ABSENT from the pinned catalog`).toBeUndefined();
      expect((n.widgets_values as unknown[]).length, `${n.type} needs non-empty values`).toBeGreaterThan(0);
    }
  });

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
    const before = Y.encodeStateAsUpdate(doc);
    const rootsBefore = [...doc.share.keys()];
    migrate(doc, SCHEMA_VERSION);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect([...doc.share.keys()]).toEqual(rootsBefore);
  });

  // #20: the current-version path used to "validate" by calling the
  // nodes/links/definitions/meta helpers, and `Y.Doc#getMap` CREATES an absent
  // root. That silently repaired an incomplete doc instead of leaving it alone.
  it("materializes no root map on the current-version path", () => {
    // Carries a readable schema and nothing else — the three other roots are
    // absent, which is what the old implementation would have conjured.
    const doc = new Y.Doc();
    doc.getMap("meta").set("schema_version", SCHEMA_VERSION);
    const before = Y.encodeStateAsUpdate(doc);

    migrate(doc, SCHEMA_VERSION);

    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect([...doc.share.keys()]).toEqual(["meta"]);
  });

  // The realistic host path (schema §9/§10): a replica forks from a seeded
  // snapshot, so its roots arrive as untyped Yjs `AbstractType`s and `meta` is
  // typed for the first time by this very read. Typing an already-present root
  // adds no struct and no share key, so validating still costs zero bytes.
  it("validates a snapshot-seeded doc without materializing anything", () => {
    const source = mint(loadSession(sessionFiles()[0]!).header.base_workflow, catalog);
    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(source));
    const before = Y.encodeStateAsUpdate(replica);
    const rootsBefore = [...replica.share.keys()];

    migrate(replica, SCHEMA_VERSION);

    expect(Y.encodeStateAsUpdate(replica)).toEqual(before);
    expect([...replica.share.keys()]).toEqual(rootsBefore);
    // And the fail-closed gate is live on this path too, not bypassed.
    expect(() => migrate(replica, SCHEMA_VERSION + 1)).toThrow(SchemaVersionError);
  });

  // KA-11 fail-closed: a doc whose schema cannot be read is rejected, NOT
  // assumed to be current. Reading the claim must not create `meta` either.
  it("fails closed on a doc with no readable schema_version, materializing nothing", () => {
    const empty = new Y.Doc();
    const before = Y.encodeStateAsUpdate(empty);
    expect(() => migrate(empty, SCHEMA_VERSION)).toThrow(SchemaVersionError);
    expect(() => migrate(empty, SCHEMA_VERSION)).toThrow(/no readable meta\.schema_version/);
    expect(Y.encodeStateAsUpdate(empty)).toEqual(before);
    expect([...empty.share.keys()]).toEqual([]);

    // A `meta` root that exists but carries no version is equally unreadable.
    const versionless = new Y.Doc();
    versionless.getMap("meta").set("catalog_version", "deadbeef");
    const versionlessBefore = Y.encodeStateAsUpdate(versionless);
    expect(() => migrate(versionless, SCHEMA_VERSION)).toThrow(SchemaVersionError);
    expect(() => migrate(versionless, SCHEMA_VERSION)).toThrow(/no readable meta\.schema_version/);
    expect(Y.encodeStateAsUpdate(versionless)).toEqual(versionlessBefore);
    expect([...versionless.share.keys()]).toEqual(["meta"]);

    // And the case the helper's own reasoning turns on: a `meta` root that is
    // REGISTERED in doc.share but carries nothing, which is what a caller who
    // merely touched `metaMap(doc)` leaves behind. `share.has("meta")` is true
    // here, so the guard falls through to the key read and must still reject.
    const registeredEmpty = new Y.Doc();
    registeredEmpty.getMap("meta");
    expect([...registeredEmpty.share.keys()]).toEqual(["meta"]);
    expect(() => migrate(registeredEmpty, SCHEMA_VERSION)).toThrow(SchemaVersionError);
    expect(() => migrate(registeredEmpty, SCHEMA_VERSION)).toThrow(
      /no readable meta\.schema_version/,
    );
  });

  it("fails closed on a doc newer than this package", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    expect(() => migrate(doc, SCHEMA_VERSION + 1)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, SCHEMA_VERSION + 1)).toThrow(/fail-closed/);
  });

  // The message regexes are load-bearing, not decoration: a doc minted at v1
  // ALSO trips the stored-vs-fromVersion comparison for these inputs, so an
  // assertion that only checks the error TYPE stays green with the
  // integer/lower-bound guard deleted. Pinning the message is what makes this
  // test name the guard it is about.
  it("rejects versions below the first layout", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    expect(() => migrate(doc, 0)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, 0)).toThrow(/no migration path from schema v0/);
    expect(() => migrate(doc, Number.NaN)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, Number.NaN)).toThrow(/no migration path from schema vNaN/);
  });

  // KA-11: the caller's `fromVersion` is a claim; the doc's stored version is
  // the trusted value. The current-version path must not skip this check —
  // that is exactly what an exact-no-op shortcut placed before it would do.
  it("rejects a fromVersion that contradicts the doc's own schema_version", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    metaMap(doc).set("schema_version", SCHEMA_VERSION + 5);
    const before = Y.encodeStateAsUpdate(doc);
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(/does not match fromVersion/);
    // Rejection is itself byte-exact: fail-closed never half-writes.
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });
});
