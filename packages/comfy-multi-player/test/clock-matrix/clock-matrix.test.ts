import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type Op, type WorkflowJSON, type WorkflowNode } from "../../src/index.js";
import { loadCatalog, loadSession, sessionFiles } from "../helpers.js";

const catalog = loadCatalog();
const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMES = ["base_version_actor", "lamport_doc_derived", "vector_reference"] as const;
type Scheme = (typeof SCHEMES)[number];

interface VectorClock {
  [actor: string]: number;
}

interface LogicalOp {
  op: Op;
  lamport: number;
  vector: VectorClock;
  family: string;
}

interface MatrixCase {
  id: string;
  name: string;
  family: string;
  seed?: number;
  workflow: WorkflowJSON;
  ops: LogicalOp[];
}

interface SchemeResult {
  application_order: string[];
  rejected: string[];
  final_state_hash: string;
  divergence_class: "identical" | "equivalent-semantics" | "DIVERGENT";
}

const DIVERGENCE_ALLOWLIST: Record<string, string> = {
  "agent-add-human-connect":
    "base_version has no happened-before edge and can attempt the dependent connect before A exists; Lamport preserves the observed add-before-connect relation.",
  "same-widget-true-concurrency":
    "base_version and Lamport choose deterministic scalar winners for a concurrent edit; the vector reference intentionally reports the concurrency instead of claiming the edits were ordered.",
  "dependent-producer-edits":
    "the legacy fallback can let equal-base dependent edits resolve by op identity, while Lamport preserves the producer's edit-1-before-edit-2 order.",
  "reconnect-restart":
    "a restart continuation has equal shared revision metadata in the legacy stream; the doc-derived counter preserves the observed continuation order.",
  "stale-base-human-edit":
    "the stale human base revision is intentionally compared with the Lamport observed-event order; the differing scalar winner is a rollout-review signal.",
  "reconnect-input-register":
    "same-input reconnect writes expose the difference between legacy actor fallback and producer Lamport order; this is an explicit register-policy review case.",
  "delete-vs-edit-race":
    "the scalar schemes expose different arrival-sensitive delete/edit outcomes; DQ-11 and explicit product policy must classify this before rollout.",
  "session-large-build":
    "real comfy_cli stream, two registers: three same-base_version cfg writes are tiebroken lexicographically by actor under the legacy scheme but by causal-history depth under derived Lamport (winner 6 vs 9.5), and the vector reference resurrects a stale straggler prompt (base_version 40 arriving after the version-81 write) that the scalar schemes both bury; these are corpus instances of the stale-base and true-concurrency review families.",
  "session-subgraph":
    "host-path (57) and interior-path (57/27) writes race on the same promoted subgraph register: base_version favors the later-minted host write, while Lamport and the vector reference see the two writes as causally tied/concurrent and the actor tiebreak resurrects the stale interior write against the fixture's authored intent; an explicit register-policy review case on real fixture data.",
};

/**
 * Which allowlist entries actually fire on the current corpus. An entry pinned
 * to `false` is silent slack: it permits a divergence no case produces, and a
 * regression that re-introduces it would otherwise pass unnoticed.
 */
const ALLOWLIST_FIRING: Record<string, boolean> = {
  "agent-add-human-connect": false,
  "same-widget-true-concurrency": false,
  "dependent-producer-edits": true,
  "reconnect-restart": true,
  "stale-base-human-edit": true,
  "reconnect-input-register": true,
  "delete-vs-edit-race": false,
  "session-large-build": true,
  "session-subgraph": true,
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function node(id: number, type: string, inputs: unknown[] = [], outputs: unknown[] = [], widgets_values: unknown[] = []): WorkflowNode {
  return { id, type, pos: [id, id], inputs, outputs, widgets_values };
}

function workflow(nodes: WorkflowNode[]): WorkflowJSON {
  return { nodes, links: [], groups: [], extra: {}, last_node_id: Math.max(0, ...nodes.map((candidate) => Number(candidate.id))), last_link_id: 0, version: 0.4 };
}

function opId(label: string): string {
  return hash(label).slice(0, 32);
}

function baseEnvelope(label: string, actor: string, base_version: number): Pick<Op, "op_id" | "actor" | "base_version" | "stamp"> {
  return { op_id: opId(label), actor, base_version, stamp: [base_version, actor] };
}

function logical(op: Op, family: string, lamport: number, vector: VectorClock): LogicalOp {
  return { op, family, lamport, vector };
}

function setWidget(label: string, actor: string, value: unknown, base_version: number, lamport: number, vector: VectorClock, node_id = 1, node_incarnation = "0"): LogicalOp {
  return logical({ op: "set_widget", ...baseEnvelope(label, actor, base_version), node_id, widget: "steps", value, node_incarnation }, "named", lamport, vector);
}

function addPreview(label: string, actor: string, base_version: number, lamport: number, vector: VectorClock, node_id = 2): LogicalOp {
  return logical({
    op: "add_node", ...baseEnvelope(label, actor, base_version), node_id, class_type: "PreviewImage", pos: [20, 20],
    node: node(node_id, "PreviewImage", [{ name: "images", type: "IMAGE", link: null }]), node_incarnation: opId(label),
  }, "dependency", lamport, vector);
}

function connect(label: string, actor: string, base_version: number, lamport: number, vector: VectorClock, link_id = 20, from_node = 1, to_node = 2): LogicalOp {
  return logical({ op: "connect", ...baseEnvelope(label, actor, base_version), link_id, from_node, from_slot: 0, to_node, to_slot: 0, link_type: "IMAGE" }, "dependency", lamport, vector);
}

function deleteNode(label: string, actor: string, base_version: number, lamport: number, vector: VectorClock, node_id = 1, node_incarnation?: string): LogicalOp {
  return logical({ op: "delete_node", ...baseEnvelope(label, actor, base_version), node_id, removed_links: [], ...(node_incarnation === undefined ? {} : { node_incarnation }) }, "delete", lamport, vector);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareBase(a: LogicalOp, b: LogicalOp): number {
  return Number(a.op.base_version) - Number(b.op.base_version) || compareStrings(a.op.actor, b.op.actor) || compareStrings(a.op.op_id, b.op.op_id);
}

function happensBefore(a: VectorClock, b: VectorClock): boolean {
  const actors = new Set([...Object.keys(a), ...Object.keys(b)]);
  let strictlyLower = false;
  for (const actor of actors) {
    const left = a[actor] ?? 0;
    const right = b[actor] ?? 0;
    if (left > right) return false;
    if (left < right) strictlyLower = true;
  }
  return strictlyLower;
}

function compareVector(a: LogicalOp, b: LogicalOp): number {
  if (happensBefore(a.vector, b.vector)) return -1;
  if (happensBefore(b.vector, a.vector)) return 1;
  return compareStrings(a.op.actor, b.op.actor) || compareStrings(a.op.op_id, b.op.op_id);
}

function orderFor(caseData: MatrixCase, scheme: Scheme): LogicalOp[] {
  const ordered = [...caseData.ops];
  if (scheme === "base_version_actor") return ordered.sort(compareBase);
  if (scheme === "lamport_doc_derived") return ordered.sort((a, b) => a.lamport - b.lamport || compareStrings(a.op.actor, b.op.actor) || compareStrings(a.op.op_id, b.op.op_id));
  return ordered.sort(compareVector);
}

function vectorRelations(ops: LogicalOp[]): { ordered_pairs: number; concurrent_pairs: number } {
  let ordered_pairs = 0;
  let concurrent_pairs = 0;
  for (let left = 0; left < ops.length; left++) for (let right = left + 1; right < ops.length; right++) {
    const first = ops[left]!.vector;
    const second = ops[right]!.vector;
    if (happensBefore(first, second) || happensBefore(second, first)) ordered_pairs++;
    else concurrent_pairs++;
  }
  return { ordered_pairs, concurrent_pairs };
}

function schemeStamp(item: LogicalOp, scheme: Scheme, order: LogicalOp[]): [number, string] {
  if (scheme === "base_version_actor") return [item.op.base_version, item.op.actor];
  if (scheme === "lamport_doc_derived") return [item.lamport, item.op.actor];
  return [order.indexOf(item) + 1, item.op.actor];
}

function canonicalProjection(doc: Y.Doc): WorkflowJSON {
  const value = structuredClone(project(doc, catalog));
  value.nodes.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  value.links.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return value;
}

function replay(caseData: MatrixCase, scheme: Scheme): Omit<SchemeResult, "divergence_class"> {
  const ordered = orderFor(caseData, scheme);
  const ops = ordered.map((item) => ({ ...item.op, stamp: schemeStamp(item, scheme, ordered) })) as Op[];
  const doc = mint(caseData.workflow, catalog);
  const result = applyOps(doc, ops, catalog);
  const projection = canonicalProjection(doc);
  return {
    application_order: ordered.map((item) => item.op.op_id),
    rejected: result.outcomes.filter((outcome) => outcome.outcome === "rejected").map((outcome) => outcome.op_id),
    final_state_hash: hash(projection),
  };
}

function withDivergence(results: Record<Scheme, Omit<SchemeResult, "divergence_class">>): Record<Scheme, SchemeResult> {
  const baseline = results.base_version_actor;
  return Object.fromEntries(SCHEMES.map((scheme) => {
    const candidate = results[scheme];
    const sameOrder = JSON.stringify(candidate.application_order) === JSON.stringify(baseline.application_order);
    const divergence_class = candidate.final_state_hash !== baseline.final_state_hash ? "DIVERGENT" : sameOrder ? "identical" : "equivalent-semantics";
    return [scheme, { ...candidate, divergence_class }];
  })) as Record<Scheme, SchemeResult>;
}

function namedCases(): MatrixCase[] {
  const b = (actor: string, counter: number): VectorClock => ({ [actor]: counter });
  const load = node(1, "LoadImage", [], [{ name: "IMAGE", type: "IMAGE", links: [] }], ["input.png"]);
  const sampler = node(1, "KSampler", [{ name: "model", type: "MODEL", link: null }], [{ name: "LATENT", type: "LATENT", links: [] }], [0, "fixed", 20, 7, "euler", "normal", 1]);
  return [
    {
      id: "agent-add-human-connect", name: "Agent adds node A, human observes it, then connects B to A", family: "named", workflow: workflow([load]),
      ops: [addPreview("add-A", "producer:add", 5, 1, b("producer:add", 1)), connect("connect-B-A", "producer:connect", 5, 2, { "producer:add": 1, "producer:connect": 1 })],
    },
    {
      id: "dependent-producer-edits", name: "Dependent producer edit-1 then edit-2 before shared revision advances", family: "named", workflow: workflow([sampler]),
      ops: [setWidget("edit-1", "agent:producer", "first", 9, 10, b("agent:producer", 1)), setWidget("edit-2", "agent:producer", "second", 9, 11, b("agent:producer", 2))],
    },
    {
      id: "reconnect-restart", name: "Agent edits, reconnects after restart, observes the doc, and continues monotonically", family: "named", workflow: workflow([sampler]),
      ops: [setWidget("restart-1", "agent:restart", "before-restart", 4, 5, b("agent:restart", 1)), setWidget("restart-2", "agent:restart", "after-restart", 4, 6, b("agent:restart", 2))],
    },
    {
      id: "stale-base-human-edit", name: "Stale-base human edit races after agent changed related state", family: "named", workflow: workflow([sampler]),
      ops: [setWidget("agent-related", "agent:z", "agent", 12, 20, b("agent:z", 1)), setWidget("human-stale", "human:a", "human-stale", 3, 13, b("human:a", 1))],
    },
    {
      id: "same-widget-true-concurrency", name: "Human and agent independently change the same widget", family: "named", workflow: workflow([sampler]),
      ops: [setWidget("human-concurrent", "human:alice", "human", 7, 8, b("human:alice", 1)), setWidget("agent-concurrent", "agent:bot", "agent", 7, 8, b("agent:bot", 1))],
    },
    {
      id: "intentional-overwrite", name: "Human changes the agent value after seeing it", family: "named", workflow: workflow([sampler]),
      ops: [setWidget("seen-agent", "agent:bot", "agent", 1, 1, b("agent:bot", 1)), setWidget("intentional-human", "human:alice", "intentional-human", 2, 2, { "agent:bot": 1, "human:alice": 1 })],
    },
    {
      id: "delete-vs-edit-race", name: "Delete-versus-edit race on a related node", family: "named", workflow: workflow([sampler]),
      ops: [setWidget("edit-before-delete", "agent:edit", "edited", 8, 8, b("agent:edit", 1)), deleteNode("delete-race", "human:delete", 8, 9, b("human:delete", 1))],
    },
    {
      id: "reconnect-input-register", name: "Reconnect races on the same input register", family: "named", workflow: workflow([load, node(2, "PreviewImage", [{ name: "images", type: "IMAGE", link: null }])]),
      ops: [connect("reconnect-old", "agent:old", 3, 4, b("agent:old", 1), 30), connect("reconnect-new", "agent:new", 3, 5, b("agent:new", 1), 31)],
    },
    {
      id: "dq-11-incarnation-transition", name: "DQ-11 incarnation transition occurs mid-stream", family: "named", workflow: workflow([sampler]),
      ops: [setWidget("life-1-edit", "human:stale", "old-life", 10, 10, b("human:stale", 1)), deleteNode("life-1-delete", "agent:delete", 11, 11, b("agent:delete", 1)), addPreview("life-2-readd", "agent:readd", 12, 12, b("agent:readd", 1), 2), setWidget("life-2-edit", "human:fresh", "new-life", 13, 13, b("human:fresh", 1), 1, opId("life-2-readd"))],
    },
  ];
}

class Rng {
  public constructor(private state: number) {}
  public next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state;
  }
  public value(): number { return (this.next() % 10000) - 5000; }
}

function generatedCase(family: number, seed: number): MatrixCase {
  const rng = new Rng((0x5eed1105 + family * 1000 + seed) >>> 0);
  const actorA = `agent:seed-${family}-${seed}`;
  const actorB = `human:seed-${family}-${seed}`;
  const base = workflow([node(1, "KSampler", [{ name: "model", type: "MODEL", link: null }], [{ name: "LATENT", type: "LATENT", links: [] }], [0, "fixed", 20, 7, "euler", "normal", 1])]);
  let ops: LogicalOp[];
  if (family === 0) {
    ops = [setWidget(`f0-${seed}-a`, actorA, rng.value(), 10, 11, { [actorA]: 1 }), setWidget(`f0-${seed}-b`, actorB, rng.value(), 10, 12, { [actorB]: 1 })];
  } else if (family === 1) {
    ops = [setWidget(`f1-${seed}-a`, actorA, rng.value(), 4, 5, { [actorA]: 1 }), setWidget(`f1-${seed}-b`, actorA, rng.value(), 5, 6, { [actorA]: 2 })];
  } else if (family === 2) {
    ops = [setWidget(`f2-${seed}-edit`, actorA, rng.value(), 8, 9, { [actorA]: 1 }), deleteNode(`f2-${seed}-delete`, actorB, 8, 10, { [actorB]: 1 })];
  } else {
    ops = [setWidget(`f3-${seed}-old`, actorA, rng.value(), 2, 3, { [actorA]: 1 }), setWidget(`f3-${seed}-new`, actorB, rng.value(), 2, 4, { [actorB]: 1 })];
  }
  return { id: `generated-family-${family}-seed-${seed}`, name: `Generated family ${family + 1} seed ${seed}`, family: `generated-family-${family + 1}`, seed, workflow: base, ops };
}

/**
 * Real comfy_cli-generated fixture session streams replayed as matrix cases.
 *
 * Fixture ops carry only `base_version`/`stamp`, so the logical clocks are
 * derived causally rather than from arrival position: an op minted at
 * `base_version` b observed the document state produced by the first b ops in
 * stream (arrival) order, plus its own actor's earlier ops. Lamport follows
 * observe = max / tick = max + 1; the vector merges the observed ops' vectors
 * and increments the op's own actor. Arrival-position clocks would fabricate a
 * happened-before edge for the deliberately stale straggler writes these
 * fixtures contain, and that missing edge is exactly the relation under test.
 */
function sessionCases(): MatrixCase[] {
  return sessionFiles().map((file) => {
    const session = loadSession(file);
    const lamports: number[] = [];
    const vectors: VectorClock[] = [];
    const ops = session.ops.map((op, index) => {
      const observed: number[] = [];
      for (let prior = 0; prior < index; prior++) {
        if (prior < op.base_version || session.ops[prior]!.actor === op.actor) observed.push(prior);
      }
      const lamport = observed.reduce((max, i) => Math.max(max, lamports[i]!), 0) + 1;
      const vector: VectorClock = {};
      for (const i of observed) for (const [actor, count] of Object.entries(vectors[i]!)) vector[actor] = Math.max(vector[actor] ?? 0, count);
      vector[op.actor] = (vector[op.actor] ?? 0) + 1;
      lamports.push(lamport);
      vectors.push(vector);
      return logical(op, "session-corpus", lamport, vector);
    });
    return { id: session.header.session, name: `Fixture session ${session.header.session} (${file})`, family: "session-corpus", workflow: session.header.base_workflow, ops };
  });
}

function allCases(): MatrixCase[] {
  const cases = namedCases();
  for (let family = 0; family < 4; family++) for (let seed = 0; seed < 100; seed++) cases.push(generatedCase(family, seed));
  cases.push(...sessionCases());
  return cases;
}

interface SessionCorpusSection {
  files: string[];
  ops_total: number;
  cases: { id: string; ops: number; vector_relations: { ordered_pairs: number; concurrent_pairs: number }; divergent_schemes: Scheme[] }[];
}

function renderMarkdown(matrix: { cases: { id: string; name: string; family: string; seed?: number; vector_relations: { ordered_pairs: number; concurrent_pairs: number }; schemes: Record<Scheme, SchemeResult> }[]; summary: Record<string, number>; session_corpus: SessionCorpusSection; allowlist_firing: Record<string, boolean> }): string {
  const lines = ["# Clock ordering matrix", "", "Generated by `npm run test:clock-matrix`; final-state hashes cover canonical projected graph state only. Vector relations are pair counts from the test-only causal reference.", "", `Cases: ${matrix.summary.cases}; rows: ${matrix.summary.rows}; divergent rows: ${matrix.summary.divergent_rows}`, ""];
  lines.push("## Session corpus", "", "The SHA-pinned comfy_cli-generated fixture sessions replayed through the same three schemes with causally derived logical clocks (see `sessionCases`).", "", "| Session | Ops | Vector ordered/concurrent pairs | Divergent schemes |", "|---|---:|---:|---|");
  for (const entry of matrix.session_corpus.cases) lines.push(`| ${entry.id} | ${entry.ops} | ${entry.vector_relations.ordered_pairs}/${entry.vector_relations.concurrent_pairs} | ${entry.divergent_schemes.length === 0 ? "none" : entry.divergent_schemes.join(", ")} |`);
  lines.push("", "## Divergence allowlist firing", "", "An entry that never fires is silent slack: it permits a divergence the corpus no longer produces.", "", "| Allowlist entry | Fires |", "|---|---|");
  for (const [id, fires] of Object.entries(matrix.allowlist_firing)) lines.push(`| ${id} | ${fires ? "yes" : "no"} |`);
  lines.push("", "| Case | Family | Seed | Vector ordered/concurrent pairs | Scheme | Application order | Final-state hash | Divergence |", "|---|---|---:|---:|---|---|---|---|");
  for (const row of matrix.cases) for (const scheme of SCHEMES) {
    const result = row.schemes[scheme];
    lines.push(`| ${row.name} | ${row.family} | ${row.seed ?? "-"} | ${row.vector_relations.ordered_pairs}/${row.vector_relations.concurrent_pairs} | ${scheme} | ${result.application_order.join(" → ")} | ${result.final_state_hash} | ${result.divergence_class} |`);
  }
  return `${lines.join("\n")}\n`;
}

function runMatrix() {
  const cases = allCases();
  const opCounts = new Map(cases.map((caseData) => [caseData.id, caseData.ops.length]));
  const rows = cases.map((caseData) => {
    const raw = Object.fromEntries(SCHEMES.map((scheme) => [scheme, replay(caseData, scheme)])) as Record<Scheme, Omit<SchemeResult, "divergence_class">>;
    return { id: caseData.id, name: caseData.name, family: caseData.family, ...(caseData.seed === undefined ? {} : { seed: caseData.seed }), vector_relations: vectorRelations(caseData.ops), schemes: withDivergence(raw) };
  });
  const divergentRows = rows.filter((row) => Object.values(row.schemes).some((result) => result.divergence_class === "DIVERGENT"));
  const unallowlisted = divergentRows.filter((row) => !(row.id in DIVERGENCE_ALLOWLIST));
  if (unallowlisted.length > 0) throw new Error(`unallowlisted clock divergence: ${unallowlisted.map((row) => row.id).join(", ")}`);
  const sessionRows = rows.filter((row) => row.family === "session-corpus");
  const session_corpus: SessionCorpusSection = {
    files: sessionFiles(),
    ops_total: sessionRows.reduce((total, row) => total + (opCounts.get(row.id) ?? 0), 0),
    cases: sessionRows.map((row) => ({ id: row.id, ops: opCounts.get(row.id) ?? 0, vector_relations: row.vector_relations, divergent_schemes: SCHEMES.filter((scheme) => row.schemes[scheme].divergence_class === "DIVERGENT") })),
  };
  const allowlist_firing = Object.fromEntries(Object.keys(DIVERGENCE_ALLOWLIST).map((id) => [id, divergentRows.some((row) => row.id === id)]));
  const matrix = {
    schema_version: 2,
    schemes: SCHEMES,
    divergence_allowlist: DIVERGENCE_ALLOWLIST,
    allowlist_firing,
    summary: { cases: rows.length, rows: rows.length * SCHEMES.length, session_cases: sessionRows.length, divergent_rows: divergentRows.length, divergent_rows_allowlisted: divergentRows.length - unallowlisted.length },
    session_corpus,
    cases: rows,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "matrix.json"), `${JSON.stringify(matrix, null, 2)}\n`);
  writeFileSync(join(OUT_DIR, "matrix.md"), renderMarkdown(matrix));
  return matrix;
}

describe("clock shadow-comparison acceptance matrix", () => {
  it("covers named product scenarios and four generator families at 100 seeds each", () => {
    const matrix = runMatrix();
    expect(matrix.summary.cases).toBe(414);
    expect(matrix.summary.rows).toBe(414 * 3);
    expect(matrix.summary.session_cases).toBe(5);
    expect(matrix.session_corpus.ops_total).toBe(243);
    expect(matrix.session_corpus.cases.map((entry) => entry.id).sort()).toEqual(["session-edit-heavy", "session-frontend-only-notes", "session-large-build", "session-promoted-host", "session-subgraph"]);
    expect(matrix.cases.filter((row) => row.family.startsWith("generated-family")).length).toBe(400);
    expect(new Set(matrix.cases.filter((row) => row.family.startsWith("generated-family")).map((row) => row.family))).toEqual(new Set(["generated-family-1", "generated-family-2", "generated-family-3", "generated-family-4"]));
    for (const name of ["Agent adds node A, human observes it, then connects B to A", "Dependent producer edit-1 then edit-2 before shared revision advances", "Agent edits, reconnects after restart, observes the doc, and continues monotonically", "Stale-base human edit races after agent changed related state", "Human and agent independently change the same widget", "Human changes the agent value after seeing it", "Delete-versus-edit race on a related node", "Reconnect races on the same input register", "DQ-11 incarnation transition occurs mid-stream"]) expect(matrix.cases.some((row) => row.name === name)).toBe(true);
    expect(matrix.cases.find((row) => row.id === "agent-add-human-connect")?.vector_relations.ordered_pairs).toBe(1);
    expect(matrix.cases.find((row) => row.id === "same-widget-true-concurrency")?.vector_relations.concurrent_pairs).toBe(1);
    expect(matrix.summary.divergent_rows).toBeGreaterThanOrEqual(0);
    expect(matrix.allowlist_firing).toEqual(ALLOWLIST_FIRING);
  });
});
