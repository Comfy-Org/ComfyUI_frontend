/**
 * KA-3 / KA-11 / schema §1 — the doc's WIRE layout, held from three sides.
 *
 * PR #58 found that the schema §1 root-map names and the reserved
 * `__widgets_opaque` node key could be renamed with most of the suite green,
 * and closed that with `test/doc-mint-mutation-survivors.test.ts` "schema §1
 * doc layout: root-map names …", which addresses the roots by literal name
 * through `doc.getMap("nodes")` instead of through `nodesMap()`. The exact
 * prior exposure is recorded in `docs/INVARIANTS.md` KA-3 — four of the seven
 * names had no holder at all, `nodes` reddened 2 tests and `meta` 6 — so "the
 * whole suite was green" is NOT the claim; the claim is that the gap was large
 * but not total. That guard kills the mutants, and it is still only an
 * *in-process TS* pin: it asserts what this package's own `Y.Doc` object looks
 * like in this process.
 *
 * The names are the wire contract. A follower forks from ONE bootstrap
 * snapshot (KA-10) — `Y.applyUpdate(new Y.Doc(), Y.encodeStateAsUpdate(minted))`
 * — and resolves roots BY NAME out of those bytes; so does the Node doc host,
 * which runs this package by SHA pin (ADR-001, ADR-004). So the property that
 * actually matters is not "this Y.Doc has a root called nodes", it is "the
 * encoded update spells these names, and a reader that has only the bytes
 * recovers exactly these roots".
 *
 * Three layers, deliberately, because they fail for DIFFERENT reasons and the
 * difference is the signal a reviewer needs:
 *
 *  1. BYTES — the encoded update literally contains each name as a
 *     length-prefixed UTF-8 token. Fails on a rename in `src/`, and also on a
 *     `yjs` upgrade that changed how root names are spelled on the wire, which
 *     layer 2 would not notice (`yjs` is a caret range).
 *
 *     SCOPED, because a byte scan cannot tell a root name from a payload key
 *     that happens to spell the same string, and this document has two: a
 *     subgraph definition map carries its own `nodes` and `links` keys
 *     (`src/mint.ts` `mintDefinition`), and a node output port carries a
 *     `links` key. Measured: with the `nodes` and `links` ROOTS renamed in
 *     `src/doc.ts`, a rich fixture still spells both tokens twice apiece, so
 *     asserting them on that fixture would have been an assertion that cannot
 *     fail. Layer 1 therefore holds those two names on `collisionFreeDoc()`,
 *     whose payload contains neither key, and the four names with no payload
 *     twin on the rich document. `CONTROL: a byte scan cannot separate a root
 *     name from a payload key` pins the collision itself, so the split cannot
 *     be undone by accident.
 *  2. DECODE — a bare `Y.Doc` fed only those bytes recovers exactly the six
 *     roots, and the opaque-widgets key on the node it decodes. This is the
 *     second implementation, standing in for itself: no helper from this
 *     package is used to find anything.
 *  3. DOCUMENT — the names in `fixtures/golden-vectors/wire-layout.json`, in
 *     `docs/multiplayer-schema.md` §1 and in `docs/INVARIANTS.md` KA-3 all
 *     agree, and the schema document's declared `SCHEMA_VERSION` matches the
 *     code's.
 *
 * Together they separate an ACCIDENTAL rename from a DELIBERATE one. Rename a
 * root in `src/` only and layers 1–2 go red on the wire break. Rename it in
 * `src/` and in the golden vector and layer 3 goes red on the schema document.
 *
 * WHAT THIS FILE DOES NOT HOLD, stated because the wording invites the wider
 * reading. A rename applied CONSISTENTLY to `src/`, the vector, schema §1 and
 * KA-3 leaves every assertion here green: layer 3's last case checks only that
 * the three declarations of `SCHEMA_VERSION` agree with each other, and after a
 * consistent rename they still all read 1. So this file forces a deliberate
 * rename to be a FOUR-FILE edit, which is what makes it visible in review — it
 * does NOT mechanically force the `SCHEMA_VERSION` bump or the `migrate()` step
 * that §1/§10 and KA-11 require. Measured, not argued: renaming the
 * `definitions` root in all four places with `SCHEMA_VERSION` left at 1 reddens
 * `test/doc-mint-mutation-survivors.test.ts`, `test/project.test.ts` and
 * `test/schema-version-on-read.test.ts` — and nothing in this file. The bump
 * obligation is UNGUARDED; only its consistency once taken is held.
 *
 * The golden vector is a JSON file rather than literals in this test on
 * purpose: KA-3 says cross-language implementations pass the vectors in
 * `fixtures/golden-vectors/`, and a Python reader cannot import a `.test.ts`.
 *
 * The mutate/red/restore transcript behind every measured claim above is kept
 * OUTSIDE this repository, in the in-app-agent workspace, so it is not citable
 * from here; each `it` names the invariant and the behaviour it pins so the
 * claim can be re-derived from this tree alone.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  OPAQUE_WIDGETS_KEY,
  NODE_INCARNATION_KEY,
  SCHEMA_VERSION,
  applyOps,
  linksMap,
  mint,
  nodesMap,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import {
  appliedMap,
  definitionsMap,
  metaMap,
  stampsMap,
} from "../src/doc.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

interface WireLayoutVector {
  format_version: number;
  schema_version: number;
  roots: Record<string, string>;
  reserved_node_keys: { opaque_widgets: string; node_incarnation: string };
}

const golden = JSON.parse(
  readFileSync(join(repoRoot, "fixtures", "golden-vectors", "wire-layout.json"), "utf8"),
) as WireLayoutVector;

const goldenRootNames = Object.values(golden.roots).sort();

const catalog: WidgetCatalog = { types: { Inner: { widget_order: ["text"] } } };

let seq = 0;
const env = () => {
  const op_id = ("w" + String(seq++).padStart(4, "0")).padEnd(32, "0");
  return { op_id, actor: "a", base_version: 1, stamp: [1, "a"] as [number, string] };
};

/**
 * A workflow that puts content in EVERY root, because Yjs does not encode an
 * empty root type at all: `doc.getMap("links")` on a doc where nothing wrote a
 * link produces no structs, so a replica built from the bytes has no `links`
 * root and layer 2 would pass while asserting nothing about it. That is also
 * why `initDoc`'s five seeding calls are equivalent mutants, recorded in
 * `docs/INVARIANTS.md` KA-10 correction 1 — "seeding the root maps in
 * `mint()`/`initDoc()` contributes NOTHING to `encodeStateAsUpdate`" — and it
 * is the fixture-too-simple-to-be-sensitive shape.
 * `sparseWorkflow` below is the control that proves the trap is real.
 *
 * Two nodes, two links and two definitions rather than one of each, so a
 * layer-2 assertion cannot pass by coincidence of a single-entry map, and node
 * 2 is a class the catalog does not know so it carries `__widgets_opaque`.
 */
const richWorkflow: WorkflowJSON = {
  nodes: [
    { id: 1, type: "Inner", inputs: [], outputs: [], widgets_values: ["v"] },
    { id: 2, type: "UnknownClass", inputs: [], outputs: [], widgets_values: [7, 8] },
  ],
  links: [
    [11, 1, 0, 2, 0, "X"],
    [12, 2, 0, 1, 0, "X"],
  ],
  definitions: {
    subgraphs: [
      { id: "d1", name: "D1", nodes: [], links: [] },
      { id: "d2", name: "D2", nodes: [], links: [] },
    ],
  },
  extra: { keep: true },
} as unknown as WorkflowJSON;

/** Nothing but meta: the negative control for the empty-root encoding trap. */
const sparseWorkflow = { nodes: [], links: [] } as unknown as WorkflowJSON;

/**
 * Populates `nodes` and `links` while containing NEITHER string anywhere in its
 * payload — no subgraph definitions (whose maps carry literal `nodes`/`links`
 * keys) and no output ports (which carry a literal `links` key). That is what
 * makes the layer-1 byte assertion for those two names capable of failing.
 */
const collisionFreeWorkflow: WorkflowJSON = {
  nodes: [
    { id: 1, type: "Inner", inputs: [], outputs: [], widgets_values: ["v"] },
    { id: 2, type: "Inner", inputs: [], outputs: [], widgets_values: ["w"] },
  ],
  links: [
    [11, 1, 0, 2, 0, "X"],
    [12, 2, 0, 1, 0, "X"],
  ],
} as unknown as WorkflowJSON;

/** Mint `richWorkflow` and land one op, so `__applied` and `__stamps` are non-empty too. */
function populatedDoc(): Y.Doc {
  return minted(richWorkflow);
}

/** The same, on the payload that cannot supply a `nodes`/`links` token itself. */
function collisionFreeDoc(): Y.Doc {
  return minted(collisionFreeWorkflow);
}

function minted(wf: WorkflowJSON): Y.Doc {
  const doc = mint(wf, catalog);
  const op = { op: "set_widget", ...env(), node_id: 1, widget: "text", value: "w" } as SetWidgetOp;
  expect(
    applyOps(doc, [op], catalog).outcomes.find((outcome) => outcome.outcome === "rejected"),
  ).toBeUndefined();
  return doc;
}

/** Length-prefixed occurrences of `name` in `buf`. */
function tokenCount(buf: Buffer, name: string): number {
  const t = wireToken(name);
  let n = 0;
  for (let i = buf.indexOf(t); i !== -1; i = buf.indexOf(t, i + 1)) n++;
  return n;
}

/**
 * The two §1 root names that a rich document ALSO spells inside its payload,
 * and which layer 1 must therefore assert on `collisionFreeDoc()`.
 */
const PAYLOAD_TWINNED = ["nodes", "links"];

/** The bootstrap snapshot (schema §9 / KA-10): the only thing a follower ever gets. */
const snapshot = (doc: Y.Doc): Buffer => Buffer.from(Y.encodeStateAsUpdate(doc));

/** A follower: a bare Y.Doc that has the bytes and nothing else. */
function replicaOf(doc: Y.Doc): Y.Doc {
  const replica = new Y.Doc();
  Y.applyUpdate(replica, snapshot(doc));
  return replica;
}

/**
 * How Yjs spells a root name on the wire: a varint byte length followed by the
 * UTF-8 bytes. Every name here is short ASCII, so the varint is one byte.
 */
function wireToken(name: string): Buffer {
  const len = Buffer.byteLength(name, "utf8");
  expect(len, `'${name}' is too long for a one-byte varint length`).toBeLessThan(128);
  return Buffer.concat([Buffer.from([len]), Buffer.from(name, "utf8")]);
}

/** The wire name a helper actually addresses, recovered without naming it. */
function rootNameOf(doc: Y.Doc, type: unknown): string | undefined {
  return [...(doc.share as Map<string, unknown>).entries()].find(([, v]) => v === type)?.[0];
}

// ---------------------------------------------------------------------------
// Layer 1 — the bytes spell the names
// ---------------------------------------------------------------------------

describe("layer 1: the bootstrap snapshot literally spells the schema §1 root names (KA-3)", () => {
  it("encodes every root name as a length-prefixed UTF-8 token", () => {
    // Each name is asserted on a document whose PAYLOAD cannot spell it, so
    // every one of these assertions can fail. See the header: on the rich
    // fixture, `nodes` and `links` are spelled by the subgraph definition maps
    // regardless of what the roots are called.
    const rich = snapshot(populatedDoc());
    const clean = snapshot(collisionFreeDoc());
    for (const name of goldenRootNames) {
      const twinned = PAYLOAD_TWINNED.includes(name);
      const update = twinned ? clean : rich;
      expect(update.includes(wireToken(name)), `encoded update must spell the root name '${name}'`).toBe(true);
    }
    // Each document must actually MATERIALIZE the roots it is asked about, or
    // the split above would be silently asserting nothing for the names it
    // moved: an empty root type encodes no struct, so a missing root would
    // simply produce no token and the assertion would have to be met by
    // payload — which is the very failure being fixed. The collision-free
    // document cannot carry `definitions` (any definition map spells `nodes`
    // and `links` itself), which is exactly why only the twinned pair moves.
    const richRoots = [...(replicaOf(populatedDoc()).share as Map<string, unknown>).keys()].sort();
    const cleanRoots = [...(replicaOf(collisionFreeDoc()).share as Map<string, unknown>).keys()].sort();
    expect(richRoots).toEqual(goldenRootNames);
    for (const name of PAYLOAD_TWINNED) {
      expect(cleanRoots, `collision-free document must materialize the '${name}' root`).toContain(name);
    }
  });

  it("CONTROL: a byte scan cannot separate a root name from a payload key, which is why the fixture is split", () => {
    // The measurement the header cites, held as a test: the rich document
    // spells the twinned names MORE often than the collision-free one, because
    // its subgraph definition maps spell them too.
    const rich = snapshot(populatedDoc());
    const clean = snapshot(collisionFreeDoc());
    for (const name of PAYLOAD_TWINNED) {
      expect(
        tokenCount(rich, name),
        `'${name}' must be spelled by the rich payload as well as the root`,
      ).toBeGreaterThan(tokenCount(clean, name));
      expect(tokenCount(clean, name), `'${name}' must still be spelled as a root name`).toBeGreaterThan(0);
    }
  });

  it("CONTROL: the collision-free fixture carries neither structure that spells a root name", () => {
    // The count comparison above is necessary and NOT sufficient: adding ONE
    // subgraph to the collision-free fixture still leaves the two-subgraph rich
    // document ahead, so it would pass while layer 1 quietly went vacuous
    // again. This asserts the structural precondition directly, which is the
    // property that actually matters and which no cardinality can absorb.
    const wf = collisionFreeWorkflow as unknown as {
      nodes: { outputs?: unknown[] }[];
      definitions?: unknown;
    };
    expect(wf.definitions, "a subgraph definition map spells `nodes` and `links` itself (src/mint.ts)").toBeUndefined();
    for (const node of wf.nodes) {
      expect(node.outputs ?? [], "an output port map spells `links` itself (src/doc.ts createNodeMap)").toEqual([]);
    }
  });

  it("encodes the reserved opaque-widgets node key too", () => {
    const update = snapshot(populatedDoc());
    const key = golden.reserved_node_keys.opaque_widgets;
    expect(update.includes(wireToken(key)), `encoded update must spell '${key}'`).toBe(true);
  });

  it("CONTROL: the search is a length-prefixed token match, not a substring scan", () => {
    // Two ways the layer-1 assertions could pass without meaning anything. A
    // plausible rename must not be found; and a SUFFIX of a real name must not
    // be found either, which is what proves the varint length prefix is
    // participating rather than the raw ASCII happening to be somewhere.
    const update = snapshot(populatedDoc());
    expect(update.includes(wireToken("nodes_v2"))).toBe(false);
    expect(update.includes(Buffer.from("odes", "utf8")), "the raw suffix IS present…").toBe(true);
    expect(update.includes(wireToken("odes")), "…but not as a length-prefixed root name").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — a reader that has only the bytes recovers the roots
// ---------------------------------------------------------------------------

describe("layer 2: a replica forked from the snapshot recovers exactly the §1 roots (KA-3, KA-10)", () => {
  it("resolves every root by name, using no helper from this package", () => {
    const replica = replicaOf(populatedDoc());
    expect([...(replica.share as Map<string, unknown>).keys()].sort()).toEqual(goldenRootNames);
  });

  it("finds the document's content under those names, at the right cardinality", () => {
    const replica = replicaOf(populatedDoc());
    expect([...replica.getMap(golden.roots["nodes"]!).keys()].sort()).toEqual(["1", "2"]);
    expect([...replica.getMap(golden.roots["links"]!).keys()].sort()).toEqual(["11", "12"]);
    expect([...replica.getMap(golden.roots["definitions"]!).keys()].sort()).toEqual(["d1", "d2"]);
    expect(replica.getMap(golden.roots["meta"]!).get("schema_version")).toBe(SCHEMA_VERSION);
    expect(replica.getMap(golden.roots["applied"]!).size).toBe(1);
    expect(replica.getMap(golden.roots["stamps"]!).size).toBe(1);
  });

  it("carries no structural or comfy-cli bookkeeping key inside the meta root (schema §6, §4)", () => {
    // The byte-side counterpart of R-D. `test/doc-mint-mutation-survivors.test.ts`
    // asserts mint's `NON_META_KEYS` filter against the document; the harm it
    // prevents is on the wire, where a leaked `_applied_ops` reaches every
    // replica as a SECOND, stale idempotency record next to `__applied` (§4),
    // and a leaked `nodes` ships a whole duplicate document inside the
    // document. Asserted here on the decoded snapshot for the same reason the
    // roots are: this is what a second implementation actually receives.
    const meta = replicaOf(populatedDoc()).getMap(golden.roots["meta"]!);
    expect([...meta.keys()].sort()).toEqual(["__definitions_extra", "catalog_version", "extra", "schema_version"]);
    for (const leaked of ["nodes", "links", "definitions", "_applied_ops", "_widget_stamps"]) {
      expect(meta.has(leaked), `meta must not carry '${leaked}' on the wire`).toBe(false);
    }
  });

  it("finds the opaque-widgets values under the reserved node key", () => {
    const replica = replicaOf(populatedDoc());
    const node2 = replica.getMap(golden.roots["nodes"]!).get("2") as Y.Map<unknown>;
    expect(node2.get(golden.reserved_node_keys.opaque_widgets)).toEqual([7, 8]);
  });

  it("CONTROL: an under-populated document does not carry every root, so the fixture above must be rich", () => {
    // Yjs encodes no struct for an empty root type, so `initDoc`'s seeding
    // calls are invisible on the wire. A one-node/no-link/no-definition
    // fixture would make the layer-2 assertions vacuous for the missing roots.
    const thin = replicaOf(mint(sparseWorkflow, catalog));
    expect([...(thin.share as Map<string, unknown>).keys()].sort()).toEqual(["meta"]);
  });
});

// ---------------------------------------------------------------------------
// Layer 3 — code, golden vector and the normative documents agree
// ---------------------------------------------------------------------------

describe("layer 3: the code, the golden vector and the schema documents agree (KA-3, KA-11)", () => {
  const schemaDoc = readFileSync(join(repoRoot, "docs", "multiplayer-schema.md"), "utf8");
  const invariantsDoc = readFileSync(join(repoRoot, "docs", "INVARIANTS.md"), "utf8");

  it("uses the supported wire-layout vector format", () => {
    expect(golden.format_version).toBe(1);
    expect(goldenRootNames.length).toBe(6);
  });

  it("is reachable from the conformance manifest, so a second implementation finds it", () => {
    // A golden vector nothing points at is a file, not a contract. `KA-3` says
    // cross-language implementations pass the vectors in
    // `fixtures/golden-vectors/`, and `conformance.json` is the entry point
    // `test/parity.test.ts` and `test/rejection-retry-parity.test.ts` use.
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, "fixtures", "golden-vectors", "conformance.json"), "utf8"),
    ) as { wire_layout?: string };
    expect(manifest.wire_layout).toBe("wire-layout.json");
  });

  it("stores each role under the wire name the golden vector gives it", () => {
    // The role→helper mapping is the point: `rootNameOf` recovers the name the
    // helper actually addresses without this test naming it, so a rename in
    // `src/doc.ts` is reported as "role X moved from 'x' to ''".
    const doc = populatedDoc();
    const byRole: Record<string, unknown> = {
      nodes: nodesMap(doc),
      links: linksMap(doc),
      definitions: definitionsMap(doc),
      meta: metaMap(doc),
      applied: appliedMap(doc),
      stamps: stampsMap(doc),
    };
    for (const [role, wireName] of Object.entries(golden.roots)) {
      expect(rootNameOf(doc, byRole[role]), `role '${role}' must live under wire name '${wireName}'`).toBe(wireName);
    }
  });

  it("exports the reserved node key the golden vector names", () => {
    expect(OPAQUE_WIDGETS_KEY).toBe(golden.reserved_node_keys.opaque_widgets);
    expect(NODE_INCARNATION_KEY).toBe(golden.reserved_node_keys.node_incarnation);
  });

  it("matches the layout diagram in docs/multiplayer-schema.md §1", () => {
    const start = schemaDoc.indexOf("## 1. Doc layout");
    const end = schemaDoc.indexOf("### 1.1");
    expect(start, "schema doc must have a '## 1. Doc layout' section").toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const documented = [...schemaDoc.slice(start, end).matchAll(/Y\.Map\s+"([^"]+)"/g)].map((m) => m[1]!).sort();
    expect(documented).toEqual(goldenRootNames);
  });

  it("matches the root names KA-3 lists in docs/INVARIANTS.md", () => {
    const start = invariantsDoc.indexOf("### KA-3");
    const end = invariantsDoc.indexOf("### KA-4");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const ka3 = invariantsDoc.slice(start, end);
    for (const name of [...goldenRootNames, golden.reserved_node_keys.opaque_widgets]) {
      expect(ka3.includes("`" + name + "`"), `KA-3 must name '${name}' as part of the wire layout`).toBe(true);
    }
  });

  it("pins the schema version the layout belongs to, in all three places (KA-11)", () => {
    // The escape hatch a deliberate rename has to walk through: §1 and §10 say
    // a layout change bumps SCHEMA_VERSION and needs a migrate() step. If the
    // documents are edited to rename a root, this assertion is what makes the
    // bump non-optional.
    const declared = /^`SCHEMA_VERSION = (\d+)`$/m.exec(schemaDoc);
    expect(declared, "schema doc must declare `SCHEMA_VERSION = N` at the top").not.toBeNull();
    expect(Number(declared![1])).toBe(SCHEMA_VERSION);
    expect(golden.schema_version).toBe(SCHEMA_VERSION);
    expect(metaMap(populatedDoc()).get("schema_version")).toBe(SCHEMA_VERSION);
  });
});
