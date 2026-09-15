/**
 * KA-11 — schema-version discipline is enforced ON READ (#38).
 *
 * `migrate()` used to be the only fail-closed read entrypoint, and nothing
 * forced a caller through it: `project(doc, catalog)` best-effort projected a
 * document minted by a NEWER package as though it were current, which is the
 * silent mis-projection KA-11 exists to prevent. The gate now lives in the
 * read path itself, so a low-context caller cannot skip it.
 *
 * Both entrypoints are pinned here, because the point is that they agree:
 * same failure type (`SchemaVersionError`), same notion of "unreadable" —
 * literally the same, since both call `readSchemaVersion` — and the same
 * byte-exact refusal (fail-closed never half-writes, and reading the claim
 * must not materialize a root — schema §10). The no-materialization assertions
 * read `[...doc.share.keys()]`, never `encodeStateAsUpdate` alone: an empty
 * materialized root encodes to ZERO bytes, so the byte comparison is blind to
 * exactly the violation those assertions exist to catch (A3 "Guarded by").
 *
 * The "same failure type" clause has A3's one exception, and it is asserted
 * below rather than described: a `meta` root integrated as the wrong concrete
 * Y type surfaces Yjs's constructor clash, not a `SchemaVersionError`.
 *
 * NON-VACUOUSNESS. Every fail-closed case below runs against a REAL fixture
 * workflow that projects cleanly one line earlier. An empty `Y.Doc` would
 * satisfy `toThrow()` for any number of reasons, so the assertion has to be
 * shown to fire on a document that is otherwise perfectly readable, with the
 * tampered schema version as the only difference.
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
  readSchemaVersion,
  type WorkflowJSON,
} from "../src/index.js";
import { assertSchemaVersionAgainst } from "../src/schema-version.js";
import { canonicalize, loadCatalog, loadSession, sessionFiles } from "./helpers.js";

const catalog = loadCatalog();
/** A real, non-trivial fixture workflow — see NON-VACUOUSNESS above. */
const baseWorkflow: WorkflowJSON = loadSession(sessionFiles()[0]!).header.base_workflow;

/** A document that reads cleanly, so a later refusal can only be about the schema version. */
function readableDoc(): Y.Doc {
  const doc = mint(baseWorkflow, catalog);
  expect(project(doc, catalog).nodes.length).toBeGreaterThan(0);
  return doc;
}

describe("project() enforces schema-version on read (KA-11, #38)", () => {
  it("projects a document at the current schema version, unchanged", () => {
    const doc = mint(baseWorkflow, catalog);

    expect(readSchemaVersion(doc)).toBe(SCHEMA_VERSION);
    // The guard is a gate, not a filter: the happy path is byte-for-byte the
    // projection this package produced before the gate existed.
    expect(canonicalize(project(doc, catalog))).toEqual(canonicalize(baseWorkflow));
  });

  it("fails closed on a document NEWER than this reader, instead of best-effort projecting it", () => {
    const doc = readableDoc();
    metaMap(doc).set("schema_version", SCHEMA_VERSION + 1);

    expect(() => project(doc, catalog)).toThrow(SchemaVersionError);
    expect(() => project(doc, catalog)).toThrow(
      new RegExp(`doc schema v${SCHEMA_VERSION + 1} is newer than this package's v${SCHEMA_VERSION}`),
    );
    expect(() => project(doc, catalog)).toThrow(/refusing to read \(fail-closed/);
  });

  it("fails closed on a document whose meta.schema_version is absent", () => {
    const doc = readableDoc();
    metaMap(doc).delete("schema_version");

    expect(readSchemaVersion(doc)).toBeUndefined();
    expect(() => project(doc, catalog)).toThrow(SchemaVersionError);
    expect(() => project(doc, catalog)).toThrow(/no readable meta\.schema_version/);
  });

  it("fails closed on a document with no meta root at all, without creating one", () => {
    const doc = new Y.Doc();
    doc.getMap<Y.Map<unknown>>("nodes").set("1", new Y.Map());
    const before = Y.encodeStateAsUpdate(doc);
    const rootsBefore = [...doc.share.keys()];

    expect(() => project(doc, catalog)).toThrow(/no readable meta\.schema_version/);
    // Reading the claim must not repair the document: `Y.Doc#getMap` CREATES
    // an absent root, and a refusal that conjures `meta` (or `links`, or
    // `definitions`) is a read that writes.
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect([...doc.share.keys()]).toEqual(rootsBefore);
  });

  it.each([
    ["a string", "1"],
    ["null", null],
    ["a float", 1.5],
    ["zero", 0],
    ["a negative integer", -1],
  ])("fails closed when meta.schema_version is %s, not a version", (_label, value) => {
    const doc = readableDoc();
    metaMap(doc).set("schema_version", value);

    expect(readSchemaVersion(doc)).toBeUndefined();
    expect(() => project(doc, catalog)).toThrow(SchemaVersionError);
    expect(() => project(doc, catalog)).toThrow(/no readable meta\.schema_version/);
  });

  it("fails closed on a meta root that is REGISTERED in doc.share but carries nothing", () => {
    // The case the gate's own reasoning turns on, and the one whose absence
    // let a false comment through review: `doc.share.has("meta")` is TRUE
    // here, because `Y.Doc#getMap` registers an empty root immediately. It is
    // NOT the question "does this document carry content" — any earlier reader
    // in the process can have put the key there. The key read is what makes
    // the gate fail closed on this document, not the `share.has` check.
    const doc = new Y.Doc();
    doc.getMap<unknown>("meta");
    expect(doc.share.has("meta")).toBe(true);

    expect(readSchemaVersion(doc)).toBeUndefined();
    expect(() => project(doc, catalog)).toThrow(/no readable meta\.schema_version/);
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(/no readable meta\.schema_version/);
  });

  it("surfaces Yjs's constructor clash, NOT a SchemaVersionError, when meta is the wrong Y type", () => {
    // A3 records this carve-out for `migrate()`; it applies verbatim to
    // `project()`, and a consumer matching on the error TYPE must expect it.
    // Pinned rather than described, because the docs say "refuses with
    // `SchemaVersionError`" and that is not universally true.
    const doc = new Y.Doc();
    doc.getArray<unknown>("meta").push([1]);

    expect(() => project(doc, catalog)).toThrow(/already been defined with a different constructor/);
    expect(() => project(doc, catalog)).not.toThrow(SchemaVersionError);
    // Still fail-closed, and still a throw — which is the property that matters.
    expect(() => project(doc, catalog)).toThrow();
  });

  it("refuses byte-exactly: a rejected read leaves the document untouched", () => {
    const doc = readableDoc();
    metaMap(doc).set("schema_version", SCHEMA_VERSION + 1);
    const before = Y.encodeStateAsUpdate(doc);
    const rootsBefore = [...doc.share.keys()];

    expect(() => project(doc, catalog)).toThrow(SchemaVersionError);

    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect([...doc.share.keys()]).toEqual(rootsBefore);
  });

  it("refuses without materializing on a forked replica, while the ACCEPT path materializes a root", () => {
    // FIXTURE ADEQUACY (P11), and the two cases above do not have it. A minted
    // document already holds every root, so "doc.share unchanged" there cannot
    // be false — there is nothing left for a materializing gate to conjure. A
    // replica forked from the bootstrap snapshot (schema §9) legitimately lacks
    // `links` and `definitions` (an empty root is not encoded — A3's worked
    // example), so it is the production shape on which the claim has room to
    // fail. (This fixture workflow HAS links, so `links` is encoded and only
    // `definitions` is absent — one root is enough for the assertion to have
    // room to be false, and using the real fixture keeps the shape honest.)
    //
    // WHAT THIS TEST IS FOR, stated so it is not mistaken for a second guard on
    // the refusal: every mutant that reddens the assertion below ALSO reddens
    // the hand-built "no meta root" case, so as a guard it is redundant. It
    // earns its place by pinning the CONTRAST, which nothing else pins and
    // which the docs now depend on: the refusal path materializes nothing, and
    // the accept path materializes `definitions`. That asymmetry is
    // the reason `project()` may be called a pure read only with a qualifier
    // (see README) — it is the #20 defect one function over, it is identical on
    // `main`, and it is NOT closed by this change. If a later PR fixes the
    // accept path, the second half of this test is what tells you.
    const source = readableDoc();
    metaMap(source).set("schema_version", SCHEMA_VERSION + 1);
    const refused = new Y.Doc();
    Y.applyUpdate(refused, Y.encodeStateAsUpdate(source));

    const rootsBefore = [...refused.share.keys()].sort();
    expect(rootsBefore).not.toContain("definitions");

    expect(() => project(refused, catalog)).toThrow(SchemaVersionError);
    // The refusal leaves the share key set alone. Note that asserting on
    // `encodeStateAsUpdate` INSTEAD would be vacuous here: an empty
    // materialized root encodes to zero bytes, so the byte comparison cannot
    // see this violation at all. The share-key set is the load-bearing
    // observable (A3 "Guarded by").
    expect([...refused.share.keys()].sort()).toEqual(rootsBefore);

    // …and the same replica shape on the ACCEPT path does materialize.
    const accepted = new Y.Doc();
    Y.applyUpdate(accepted, Y.encodeStateAsUpdate(readableDoc()));
    const acceptedBefore = [...accepted.share.keys()].sort();
    const acceptedBytes = Y.encodeStateAsUpdate(accepted);
    expect(() => project(accepted, catalog)).not.toThrow();
    expect([...accepted.share.keys()].sort()).not.toEqual(acceptedBefore);
    expect([...accepted.share.keys()].sort()).toEqual(
      [...new Set([...acceptedBefore, "definitions"])].sort(),
    );
    // Harmless on the wire, which is why it is a qualifier and not a bug here:
    // nothing was encoded.
    expect(Y.encodeStateAsUpdate(accepted)).toEqual(acceptedBytes);
  });

  it("refuses an OLDER document and points at migrate() rather than projecting or migrating it", () => {
    // v1 is the first layout, so no document older than this reader can be
    // constructed today. The rule is exercised against an explicit reader
    // version instead — the same code path `project()` takes, with the one
    // value that cannot yet vary held to a future value.
    const doc = readableDoc();
    const futureReader = SCHEMA_VERSION + 1;

    expect(() => assertSchemaVersionAgainst(doc, "project", futureReader)).toThrow(SchemaVersionError);
    expect(() => assertSchemaVersionAgainst(doc, "project", futureReader)).toThrow(
      new RegExp(`doc schema v${SCHEMA_VERSION} is older than this package's v${futureReader}`),
    );
    // The remedy is named, and it is NOT "project it anyway" and NOT "migrate
    // it here": `project()` is a pure read and a migration is a host-only
    // write (schema §10).
    expect(() => assertSchemaVersionAgainst(doc, "project", futureReader)).toThrow(
      new RegExp(`call migrate\\(doc, ${SCHEMA_VERSION}\\) first`),
    );
    // …and the read really is refused, not merely warned about.
    expect(() => assertSchemaVersionAgainst(doc, "project", SCHEMA_VERSION)).not.toThrow();
  });

  it("the gate cannot be reached past a wrong catalog: schema is checked first", () => {
    // Ordering matters for the host: a document at an unreadable schema must
    // report THAT, not a catalog-contract error from a projection that should
    // never have started.
    const doc = readableDoc();
    metaMap(doc).set("schema_version", SCHEMA_VERSION + 1);

    expect(() => project(doc, { types: {} })).toThrow(SchemaVersionError);
  });
});

describe("migrate() and project() agree on what is unreadable (KA-11)", () => {
  it("fails closed when the stored schema is newer than this reader", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const futureVersion = SCHEMA_VERSION + 1;
    metaMap(doc).set("schema_version", futureVersion);

    // Reading a doc minted by a newer package must refuse, not best-effort read.
    expect(() => migrate(doc, futureVersion)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, futureVersion)).toThrow(/newer than this package.*refusing to read/);
    // The read path refuses the same document, without a migrate() call.
    expect(() => project(doc, catalog)).toThrow(SchemaVersionError);
  });

  it("rejects a fromVersion that disagrees with the stored schema_version", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    metaMap(doc).set("schema_version", SCHEMA_VERSION + 1);

    // The stored version and the caller's fromVersion must agree, or the read
    // is ambiguous and must fail closed.
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(/does not match fromVersion/);
  });

  it("a document migrate() accepts is a document project() reads", () => {
    const doc = mint(baseWorkflow, catalog);
    expect(() => migrate(doc, SCHEMA_VERSION)).not.toThrow();
    expect(() => project(doc, catalog)).not.toThrow();
  });

  // Pins the SHARED DEFINITION, not merely agreement in outcome. `migrate()`
  // held a private copy of this read while #38 was in flight; both now call
  // `readSchemaVersion`, so "the ONE definition that cannot drift" is a fact
  // about the code rather than a claim in a comment. This test is what makes
  // re-splitting them visible: restore the private copy and `migrate()`
  // reports these documents as a `fromVersion` MISMATCH again, which is the
  // wrong diagnosis — the stored value is not a version at all.
  it.each([
    ["a string", "1"],
    ["null", null],
    ["a float", 1.5],
    ["zero", 0],
    ["a negative integer", -1],
  ])("classifies meta.schema_version = %s as UNREADABLE on both entrypoints", (_label, value) => {
    const doc = readableDoc();
    metaMap(doc).set("schema_version", value);

    expect(readSchemaVersion(doc)).toBeUndefined();
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(/no readable meta\.schema_version/);
    expect(() => project(doc, catalog)).toThrow(/no readable meta\.schema_version/);
    // Same notion of unreadable means the same document set, so neither
    // entrypoint can be talked into the other's diagnosis.
    expect(() => migrate(doc, SCHEMA_VERSION)).not.toThrow(/does not match fromVersion/);
  });
});
