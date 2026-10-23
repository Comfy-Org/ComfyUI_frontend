import { createHash } from "node:crypto";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  COLLAB_TRACE_SCHEMA,
  FROZEN_OPS,
  MAX_OPS_PER_BATCH,
  applyOps,
  appliedOpIds,
  assertCollabReplayTraceV1,
  mint,
  project,
  readStamps,
  stampKey,
  stampTargetKey,
  writeTarget,
  type CollabReplayTraceV1,
  type Op,
  type SemanticDiff,
  type SemanticOpTraceStep,
  type WorkflowJSON,
} from "../src/index.js";
import { compareText, loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const opId = (label: string) => createHash("sha256").update(label).digest("hex").slice(0, 32);

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(",")}}`;
}

function hash(value: unknown) {
  return { algorithm: "sha256" as const, encoding: "canonical-json-v1" as const, value: createHash("sha256").update(canonical(value)).digest("hex") };
}

function normalized(doc: Y.Doc): WorkflowJSON {
  const value = structuredClone(project(doc, catalog));
  value.nodes.sort((a, b) => compareText(String(a.id), String(b.id)));
  value.links.sort((left, right) => {
    const a = left as unknown[];
    const b = right as unknown[];
    return compareText(String(a[0]), String(b[0]));
  });
  return value;
}

function ids(value: WorkflowJSON, kind: "nodes" | "links"): Map<string, unknown> {
  const entries: readonly unknown[] = kind === "nodes" ? value.nodes : value.links;
  return new Map(entries.map((entry) => [String(kind === "nodes" ? (entry as { id: unknown }).id : (entry as unknown[])[0]), entry]));
}

function diff(before: WorkflowJSON, after: WorkflowJSON): SemanticDiff {
  const compare = (kind: "nodes" | "links") => {
    const left = ids(before, kind), right = ids(after, kind);
    return {
      added: [...right.keys()].filter((id) => !left.has(id)),
      removed: [...left.keys()].filter((id) => !right.has(id)),
      changed: [...right.keys()].filter((id) => left.has(id) && canonical(left.get(id)) !== canonical(right.get(id))),
    };
  };
  const nodes = compare("nodes"), links = compare("links");
  return { nodes_added: nodes.added, nodes_removed: nodes.removed, nodes_changed: nodes.changed, links_added: links.added, links_removed: links.removed, links_changed: links.changed };
}

/** Fixture emitter: observes one real applyOps admission and never replays policy. */
function capture(doc: Y.Doc, op: Op, arrival_index: number, parents: SemanticOpTraceStep["causal"]): SemanticOpTraceStep {
  const before = normalized(doc);
  const alreadyApplied = appliedOpIds(doc).includes(op.op_id);
  const result = applyOps(doc, [op], catalog).outcomes[0]!;
  const after = normalized(doc);
  const afterStamps = readStamps(doc);
  const targetKey = stampTargetKey(op);
  const winner = afterStamps[targetKey];
  const incoming = stampKey(op);
  let evidence: SemanticOpTraceStep["decision_evidence"];
  if (result.outcome === "lww-dropped" && Array.isArray(winner)) {
    evidence = { kind: "lww-comparison", winning_stamp: winner as [number, string, string], losing_stamp: incoming };
  } else if (result.outcome === "no-op" && alreadyApplied) {
    evidence = { kind: "dedupe", original_op_id: op.op_id };
  } else if (result.outcome === "rejected") {
    evidence = { kind: "rejection", code: result.reason.code, message: result.reason.message, failing_index: 0 };
  } else {
    evidence = { kind: "none" };
  }
  return {
    step_id: `s-${arrival_index}`,
    kind: "semantic-op",
    actor: op.actor,
    op_id: op.op_id,
    stamp: op.stamp,
    base_version: op.base_version,
    arrival_index,
    causal: parents,
    verb: op.op,
    payload: structuredClone(op),
    before_projection_hash: hash(before),
    after_projection_hash: hash(after),
    semantic_diff: diff(before, after),
    outcome: result.outcome,
    reason_code: result.outcome === "rejected" ? result.reason.code : result.outcome,
    processed: true,
    consumed_op_id: result.outcome !== "rejected",
    targets: [{ kind: "conflict-register", path: writeTarget(op) as (string | number)[], role: "conflict" }],
    decision_evidence: evidence,
  };
}

const workflow: WorkflowJSON = { nodes: [{ id: 1, type: "KSampler", inputs: [], outputs: [], widgets_values: [1, "fixed", 20, 7, "euler", "normal", 1] }], links: [], groups: [], extra: {}, last_node_id: 1, last_link_id: 0, version: 0.4 };
const edit = (label: string, value: number, base_version: number, stampCounter = base_version): Op => ({ op: "set_widget", op_id: opId(label), actor: `human:${label}`, base_version, stamp: [stampCounter, `human:${label}`], node_id: 1, node_incarnation: "0", widget: "steps", value });

function fixture(): CollabReplayTraceV1 {
  const doc = mint(workflow, catalog);
  const first = edit("winner", 25, 4, 40);
  const second = edit("loser", 10, 99, 3);
  const steps = [
    capture(doc, first, 0, { status: "known", parents: [] }),
    capture(doc, second, 1, { status: "known", parents: [{ op_id: first.op_id, relation: "fixture-declared", evidence: "fixture" }] }),
    capture(doc, first, 2, { status: "known", parents: [{ op_id: first.op_id, relation: "observed-before", evidence: "producer-observation" }] }),
  ];
  return {
    schema: COLLAB_TRACE_SCHEMA,
    run: { trace_id: hash(steps).value, test: "lww-evidence-fixture", seed: 1592594695, source: { cmp_sha: "c543d947e3cb6ddf7570709e88a9eae2de031553", harness_sha: "fixture", fixture_sha: hash(workflow).value, catalog_sha: "fixture-catalog", dirty: false, node_version: process.version, yjs_version: "13.6.27" }, workflow_id: "wf-fixture", lineage_id: "lineage-1", ordering_scheme: "explicit-stamp", projection_normalization: "workflow-projection/v1" },
    steps,
    assertions: { converged: true, final_projection_hash: hash(normalized(doc)), final_applied_op_ids_hash: hash([...appliedOpIds(doc)].sort()), failure_step_id: null },
  };
}

function captureRejectedBatch(doc: Y.Doc, ops: Op[]): SemanticOpTraceStep[] {
  const before = normalized(doc);
  const result = applyOps(doc, ops, catalog);
  const after = normalized(doc);
  const failingIndex = result.outcomes.findIndex((outcome) => outcome.outcome === "rejected" && outcome.reason.code !== "batch_aborted");
  const preflightRefusal = ops.length > MAX_OPS_PER_BATCH;
  if (failingIndex < 0) throw new Error("fixture batch did not reject");

  return result.outcomes.map((outcome, index) => {
    if (outcome.outcome !== "rejected") throw new Error(`fixture outcome ${index} did not reject`);
    const op = ops[index]!;
    return {
      step_id: `batch-${index}`,
      kind: "semantic-op",
      actor: op.actor,
      op_id: op.op_id,
      stamp: op.stamp,
      base_version: op.base_version,
      arrival_index: index,
      causal: { status: "known", parents: [] },
      verb: op.op,
      payload: structuredClone(op),
      before_projection_hash: hash(before),
      after_projection_hash: hash(after),
      semantic_diff: diff(before, after),
      outcome: outcome.outcome,
      reason_code: outcome.reason.code,
      processed: !preflightRefusal && outcome.reason.code !== "batch_aborted",
      consumed_op_id: false,
      targets: [{ kind: "conflict-register", path: writeTarget(op) as (string | number)[], role: "conflict" }],
      decision_evidence: { kind: "rejection", code: outcome.reason.code, message: outcome.reason.message, failing_index: preflightRefusal ? null : failingIndex },
      batch: { batch_id: "rejected-batch", index, size: ops.length },
    };
  });
}

function deletePath(value: unknown, path: readonly (string | number)[]): void {
  let owner = value as Record<string | number, unknown>;
  for (const segment of path.slice(0, -1)) owner = owner[segment] as Record<string | number, unknown>;
  delete owner[path.at(-1)!];
}

const invalidJsonValues: readonly (readonly [string, () => unknown])[] = [
  ["undefined", () => undefined],
  ["BigInt", () => 1n],
  ["function", () => () => 1],
  ["symbol", () => Symbol("trace")],
  ["non-finite number", () => Number.NaN],
  ["non-JSON object", () => new Date(0)],
  ["sparse array", () => Array(1)],
  ["reference cycle", () => {
    const cycle: Record<string, unknown> = {};
    cycle["self"] = cycle;
    return cycle;
  }],
];

const requiredTraceFields = ([
  ["schema"],
  ["run"],
  ["run", "trace_id"],
  ["run", "test"],
  ["run", "seed"],
  ["run", "source"],
  ["run", "source", "cmp_sha"],
  ["run", "source", "harness_sha"],
  ["run", "source", "fixture_sha"],
  ["run", "source", "catalog_sha"],
  ["run", "source", "dirty"],
  ["run", "source", "node_version"],
  ["run", "source", "yjs_version"],
  ["run", "workflow_id"],
  ["run", "lineage_id"],
  ["run", "ordering_scheme"],
  ["run", "projection_normalization"],
  ["steps"],
  ["steps", 0, "step_id"],
  ["steps", 0, "kind"],
  ["steps", 0, "actor"],
  ["steps", 0, "op_id"],
  ["steps", 0, "stamp"],
  ["steps", 0, "base_version"],
  ["steps", 0, "arrival_index"],
  ["steps", 0, "causal"],
  ["steps", 0, "causal", "status"],
  ["steps", 0, "causal", "parents"],
  ["steps", 0, "verb"],
  ["steps", 0, "payload"],
  ["steps", 0, "payload", "op"],
  ["steps", 0, "payload", "node_id"],
  ["steps", 0, "payload", "widget"],
  ["steps", 0, "payload", "value"],
  ["steps", 0, "before_projection_hash"],
  ["steps", 0, "before_projection_hash", "algorithm"],
  ["steps", 0, "before_projection_hash", "encoding"],
  ["steps", 0, "before_projection_hash", "value"],
  ["steps", 0, "after_projection_hash"],
  ["steps", 0, "semantic_diff"],
  ["steps", 0, "semantic_diff", "nodes_added"],
  ["steps", 0, "semantic_diff", "nodes_removed"],
  ["steps", 0, "semantic_diff", "nodes_changed"],
  ["steps", 0, "semantic_diff", "links_added"],
  ["steps", 0, "semantic_diff", "links_removed"],
  ["steps", 0, "semantic_diff", "links_changed"],
  ["steps", 0, "outcome"],
  ["steps", 0, "reason_code"],
  ["steps", 0, "processed"],
  ["steps", 0, "consumed_op_id"],
  ["steps", 0, "targets"],
  ["steps", 0, "decision_evidence"],
  ["assertions"],
  ["assertions", "converged"],
  ["assertions", "final_projection_hash"],
  ["assertions", "final_applied_op_ids_hash"],
  ["assertions", "failure_step_id"],
] satisfies readonly (readonly (string | number)[])[]).map((path) => ({ name: path.join("."), path }));

/**
 * A `disconnect` op captured from the real applier, over a pre-wired document.
 *
 * `disconnect` joined `FROZEN_OPS` in #139, after this contract's payload
 * validator was written against the five kinds that preceded it. It is the
 * regression fixture for the terminal-`else` hole: a kind the validator does
 * not enumerate must not be validated as some other kind's payload shape.
 */
const wired: WorkflowJSON = {
  nodes: [
    { id: 100, type: "CLIPTextEncode", pos: [20, 20], inputs: [{ name: "clip", type: "CLIP", link: null }], outputs: [{ name: "CONDITIONING", type: "CONDITIONING", links: [9000] }], widgets_values: ["seed"] },
    { id: 200, type: "KSampler", pos: [320, 20], inputs: [{ name: "positive", type: "CONDITIONING", link: 9000 }], outputs: [{ name: "LATENT", type: "LATENT", links: [] }], widgets_values: [0, "fixed", 20, 8, "euler", "simple", 1] },
  ],
  links: [[9000, 100, 0, 200, 0, "CONDITIONING"]],
  groups: [], extra: {}, last_node_id: 200, last_link_id: 9000, version: 0.4,
};

const sever: Op = { op: "disconnect", op_id: opId("sever"), actor: "human:sever", base_version: 7, stamp: [7, "human:sever"], link_id: 9000, to_node: 200, to_slot: 0 };

function disconnectFixture(): CollabReplayTraceV1 {
  const doc = mint(wired, catalog);
  const steps = [capture(doc, sever, 0, { status: "known", parents: [] })];
  return {
    schema: COLLAB_TRACE_SCHEMA,
    run: { trace_id: hash(steps).value, test: "disconnect-evidence-fixture", seed: 1592594695, source: { cmp_sha: "c543d947e3cb6ddf7570709e88a9eae2de031553", harness_sha: "fixture", fixture_sha: hash(wired).value, catalog_sha: "fixture-catalog", dirty: false, node_version: process.version, yjs_version: "13.6.27" }, workflow_id: "wf-fixture", lineage_id: "lineage-1", ordering_scheme: "explicit-stamp", projection_normalization: "workflow-projection/v1" },
    steps,
    assertions: { converged: true, final_projection_hash: hash(normalized(doc)), final_applied_op_ids_hash: hash([...appliedOpIds(doc)].sort()), failure_step_id: null },
  };
}

describe("collaboration trace v1 contract and fixture emitter", () => {
  it("emits deterministic facts from the real applier and preserves stamp separately from base_version", () => {
    const a = fixture(), b = fixture();
    expect(canonical(a)).toBe(canonical(b));
    expect(a.steps[0]).toMatchObject({ base_version: 4, stamp: [40, "human:winner"], outcome: "applied" });
    expect(a.steps[1]).toMatchObject({ outcome: "lww-dropped", consumed_op_id: true, decision_evidence: { kind: "lww-comparison" } });
    expect(a.steps[2]).toMatchObject({ outcome: "no-op", consumed_op_id: true, decision_evidence: { kind: "dedupe" } });

    const snapshot = Y.encodeStateAsUpdate(mint(workflow, catalog));
    const captureOrder = (ops: readonly Op[]) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      const steps = ops.map((op, index) => capture(doc, op, index, { status: "known", parents: [] }));
      return { projection: normalized(doc), steps };
    };
    const first = edit("winner", 25, 4, 40);
    const second = edit("loser", 10, 99, 3);
    const forward = captureOrder([first, second]);
    const reverse = captureOrder([second, first]);
    expect(reverse.projection).toEqual(forward.projection);
    expect(reverse.steps).toMatchObject([{ outcome: "applied" }, { outcome: "applied" }]);

    assertCollabReplayTraceV1(a);
  });

  it("hashes object keys canonically", () => expect(hash({ b: 2, a: 1 })).toEqual(hash({ a: 1, b: 2 })));

  it.each(FROZEN_OPS)("validates a %s payload against its own shape, not a fallback kind's", (op) => {
    // Strip every kind-specific field, leaving the common envelope, and set the
    // discriminant. Each kind must then be rejected for a field IT declares.
    // `removed_nodes` belongs to `clear` alone, so any other kind rejected for
    // `removed_nodes` is being validated through `clear`'s branch — which is
    // what a terminal `else` does to every kind it does not enumerate.
    const trace = disconnectFixture();
    const step = trace.steps[0]!;
    if (step.kind !== "semantic-op") throw new Error("fixture step must be a semantic op");
    for (const field of ["link_id", "to_node", "to_slot"] as const) deletePath(step.payload, [field]);
    step.verb = op;
    (step.payload as unknown as Record<string, unknown>)["op"] = op;

    let thrown = "";
    try {
      assertCollabReplayTraceV1(trace);
    } catch (error) {
      thrown = String(error);
    }
    expect(thrown, `${op} must reject an envelope-only payload`).not.toBe("");
    expect(/removed_nodes/.test(thrown), `${op} rejected for clear's removed_nodes`).toBe(op === "clear");
  });

  it("accepts real disconnect evidence and pins its required fields", () => {
    const trace = disconnectFixture();
    expect(trace.steps[0]).toMatchObject({ verb: "disconnect", outcome: "applied", consumed_op_id: true });
    expect(trace.steps[0]!.kind === "semantic-op" && trace.steps[0]!.semantic_diff.links_removed).toEqual(["9000"]);
    expect(() => assertCollabReplayTraceV1(trace)).not.toThrow();

    for (const field of ["link_id", "to_node", "to_slot"] as const) {
      const malformed: unknown = disconnectFixture();
      deletePath(malformed, ["steps", 0, "payload", field]);
      expect(() => assertCollabReplayTraceV1(malformed), `disconnect must require ${field}`).toThrow(new RegExp(field));
    }
  });

  it("does not accept a disconnect payload that smuggles clear's removed_nodes in place of its own fields", () => {
    const smuggled = disconnectFixture();
    const step = smuggled.steps[0]!;
    if (step.kind !== "semantic-op") throw new Error("fixture step must be a semantic op");
    const payload = step.payload as unknown as Record<string, unknown>;
    payload["removed_nodes"] = [];
    delete payload["link_id"];
    delete payload["to_node"];
    delete payload["to_slot"];
    expect(() => assertCollabReplayTraceV1(smuggled)).toThrow(/link_id/);
  });

  it("fails closed on unknown schema majors and invalid op identity", () => {
    expect(() => assertCollabReplayTraceV1({ ...fixture(), schema: "comfy.collab-replay/v2" })).toThrow(/unsupported/);
    const bad = structuredClone(fixture());
    if (bad.steps[0]?.kind === "semantic-op") bad.steps[0].op_id = "regenerated";
    expect(() => assertCollabReplayTraceV1(bad)).toThrow(/immutable op_id/);
  });

  it.each(requiredTraceFields)("fails closed when required field $name is absent", ({ path }) => {
    const trace: unknown = structuredClone(fixture());
    deletePath(trace, path);
    const field = String(path.at(-1));
    expect(() => assertCollabReplayTraceV1(trace)).toThrow(new RegExp(field));
  });

  it("rejects duplicate or out-of-order step identity", () => {
    const duplicateId = structuredClone(fixture());
    duplicateId.steps[1]!.step_id = duplicateId.steps[0]!.step_id;
    expect(() => assertCollabReplayTraceV1(duplicateId)).toThrow(/step_id/);

    const duplicateArrival = structuredClone(fixture());
    duplicateArrival.steps[1]!.arrival_index = duplicateArrival.steps[0]!.arrival_index;
    expect(() => assertCollabReplayTraceV1(duplicateArrival)).toThrow(/arrival_index/);

    const original = structuredClone(fixture());
    const outOfOrder = { ...original, steps: [...original.steps].reverse() };
    expect(() => assertCollabReplayTraceV1(outOfOrder)).toThrow(/arrival_index/);
  });

  it("rejects dangling or incoherent failure assertions", () => {
    const dangling = structuredClone(fixture());
    dangling.assertions.converged = false;
    dangling.assertions.failure_step_id = "missing-step";
    expect(() => assertCollabReplayTraceV1(dangling)).toThrow(/failure_step_id/);

    const contradictory = structuredClone(fixture());
    contradictory.assertions.failure_step_id = contradictory.steps[0]!.step_id;
    expect(() => assertCollabReplayTraceV1(contradictory)).toThrow(/converged/);
  });

  it("rejects incoherent outcome evidence and semantic identity", () => {
    const wrongDecision = structuredClone(fixture());
    if (wrongDecision.steps[0]?.kind === "semantic-op") wrongDecision.steps[0].decision_evidence = { kind: "dedupe", original_op_id: wrongDecision.steps[0].op_id };
    expect(() => assertCollabReplayTraceV1(wrongDecision)).toThrow(/decision_evidence/);

    const wrongConsumption = structuredClone(fixture());
    if (wrongConsumption.steps[1]?.kind === "semantic-op") wrongConsumption.steps[1].consumed_op_id = false;
    expect(() => assertCollabReplayTraceV1(wrongConsumption)).toThrow(/consumed_op_id/);

    const wrongReason = structuredClone(fixture());
    if (wrongReason.steps[1]?.kind === "semantic-op") wrongReason.steps[1].reason_code = "applied";
    expect(() => assertCollabReplayTraceV1(wrongReason)).toThrow(/reason_code/);

    const wrongPayload = structuredClone(fixture());
    if (wrongPayload.steps[0]?.kind === "semantic-op") wrongPayload.steps[0].payload.actor = "human:other";
    expect(() => assertCollabReplayTraceV1(wrongPayload)).toThrow(/semantic identity/);
  });

  it("rejects LWW evidence whose claimed winner does not outrank the loser", () => {
    for (const winningStamp of [[3, "human:loser", opId("loser")], [2, "human:winner", opId("winner")]] as const) {
      const trace = structuredClone(fixture());
      if (trace.steps[1]?.kind === "semantic-op" && trace.steps[1].decision_evidence.kind === "lww-comparison") {
        trace.steps[1].decision_evidence.winning_stamp = [...winningStamp];
      }
      expect(() => assertCollabReplayTraceV1(trace)).toThrow(/winning_stamp/);
    }
  });

  it.each(invalidJsonValues)("rejects a persistent payload containing %s", (_name, makeValue) => {
    const trace = structuredClone(fixture());
    if (trace.steps[0]?.kind === "semantic-op" && trace.steps[0].payload.op === "set_widget") {
      trace.steps[0].payload.value = { nested: makeValue() };
    }
    expect(() => assertCollabReplayTraceV1(trace)).toThrow(/JSON/);
  });

  it("validates JSON values nested in grow and promoted payload evidence", () => {
    const grow = structuredClone(fixture());
    if (grow.steps[0]?.kind === "semantic-op") {
      (grow.steps[0].payload as Op & { grow: unknown }).grow = { inputcount: { value: 1n } };
    }
    expect(() => assertCollabReplayTraceV1(grow)).toThrow(/JSON/);

    const promoted = structuredClone(fixture());
    if (promoted.steps[0]?.kind === "semantic-op" && promoted.steps[0].payload.op === "set_widget") {
      promoted.steps[0].payload.value = 1;
      (promoted.steps[0].payload as Op & { promoted: unknown }).promoted = {
        value_index: 0,
        host_widgets_values: [Symbol("trace")],
      };
    }
    expect(() => assertCollabReplayTraceV1(promoted)).toThrow(/JSON/);
  });

  it("captures a real rejected batch without mutating or consuming either op", () => {
    const doc = mint(workflow, catalog);
    const rejected = { ...edit("rejected", 11, 5), widget: "not-in-catalog" };
    const trailing = edit("trailing", 12, 6);
    const before = Y.encodeStateAsUpdate(doc);
    const steps = captureRejectedBatch(doc, [rejected, trailing]);

    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(appliedOpIds(doc)).not.toContain(rejected.op_id);
    expect(appliedOpIds(doc)).not.toContain(trailing.op_id);
    const projected = normalized(doc).nodes[0]?.widgets_values;
    expect(Array.isArray(projected) ? projected[2] : undefined).toBe(20);
    expect(steps).toMatchObject([
      { outcome: "rejected", reason_code: "unknown_widget", processed: true, consumed_op_id: false, decision_evidence: { kind: "rejection", failing_index: 0 } },
      { outcome: "rejected", reason_code: "batch_aborted", processed: false, consumed_op_id: false, decision_evidence: { kind: "rejection", failing_index: 0 } },
    ]);
    const trace = fixture();
    trace.steps = steps;
    trace.assertions.final_projection_hash = steps.at(-1)!.after_projection_hash;
    expect(() => assertCollabReplayTraceV1(trace)).not.toThrow();
  });

  it("rejects missing or mismatched batch failure evidence and non-contiguous aborts", () => {
    const rejected = { ...edit("batch-failure", 11, 5), widget: "not-in-catalog" };
    const trailing = [edit("batch-trailing-1", 12, 6), edit("batch-trailing-2", 13, 7)];
    const makeSteps = () => captureRejectedBatch(mint(workflow, catalog), [rejected, ...trailing]);

    const missingFailure = makeSteps().slice(1);
    missingFailure.forEach((step, index) => { step.arrival_index = index; });
    expect(() => assertCollabReplayTraceV1({ ...fixture(), steps: missingFailure })).toThrow(/batch/);

    const mismatchedBatch = makeSteps();
    mismatchedBatch[1]!.batch!.batch_id = "different-batch";
    expect(() => assertCollabReplayTraceV1({ ...fixture(), steps: mismatchedBatch })).toThrow(/batch/);

    const mismatchedSize = makeSteps();
    mismatchedSize[1]!.batch!.size += 1;
    expect(() => assertCollabReplayTraceV1({ ...fixture(), steps: mismatchedSize })).toThrow(/batch/);

    const abortGap = makeSteps();
    Object.assign(abortGap[1]!, { outcome: "no-op", reason_code: "no-op", processed: true, consumed_op_id: true, decision_evidence: { kind: "none" } });
    expect(() => assertCollabReplayTraceV1({ ...fixture(), steps: abortGap })).toThrow(/batch/);

    const twoFailures = makeSteps();
    Object.assign(twoFailures[1]!, { reason_code: "unknown_widget", processed: true, decision_evidence: { kind: "rejection", code: "unknown_widget", message: "second failure", failing_index: 1 } });
    expect(() => assertCollabReplayTraceV1({ ...fixture(), steps: twoFailures })).toThrow(/batch/);
  });

  it("captures an oversized batch as a preflight refusal with no processed member", () => {
    const doc = mint(workflow, catalog);
    const before = Y.encodeStateAsUpdate(doc);
    const ops = Array.from({ length: MAX_OPS_PER_BATCH + 1 }, (_, index) => edit(`oversized-${index}`, index, index));
    const steps = captureRejectedBatch(doc, ops);

    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(appliedOpIds(doc)).toEqual([]);
    expect(steps).toHaveLength(MAX_OPS_PER_BATCH + 1);
    expect(steps.every((step) => !step.processed && step.reason_code === "malformed_op" && step.decision_evidence.kind === "rejection" && step.decision_evidence.failing_index === null)).toBe(true);
    const trace = fixture();
    trace.steps = steps;
    trace.assertions.final_projection_hash = steps.at(-1)!.after_projection_hash;
    expect(() => assertCollabReplayTraceV1(trace)).not.toThrow();
  });

  it("rejects broken semantic projection continuity", () => {
    const adjacent = structuredClone(fixture());
    const secondStep = adjacent.steps[1]!;
    if (secondStep.kind !== "semantic-op") throw new Error("fixture step must be semantic");
    secondStep.before_projection_hash = { ...secondStep.before_projection_hash, value: "b".repeat(64) };
    secondStep.after_projection_hash = { ...secondStep.after_projection_hash, value: "b".repeat(64) };
    expect(() => assertCollabReplayTraceV1(adjacent)).toThrow(/projection continuity/);

    const final = structuredClone(fixture());
    final.assertions.final_projection_hash = { ...final.assertions.final_projection_hash, value: "c".repeat(64) };
    expect(() => assertCollabReplayTraceV1(final)).toThrow(/final_projection_hash/);
  });

  it("pins projection and applied-op hashes to canonical JSON", () => {
    const cases = [
      ["before_projection_hash", (trace: CollabReplayTraceV1) => {
        const step = trace.steps[0]!;
        if (step.kind !== "semantic-op") throw new Error("fixture step must be semantic");
        step.before_projection_hash = { ...step.before_projection_hash, encoding: "binary" };
      }],
      ["after_projection_hash", (trace: CollabReplayTraceV1) => {
        const step = trace.steps[0]!;
        if (step.kind !== "semantic-op") throw new Error("fixture step must be semantic");
        step.after_projection_hash = { ...step.after_projection_hash, encoding: "binary" };
      }],
      ["final_projection_hash", (trace: CollabReplayTraceV1) => {
        trace.assertions.final_projection_hash = { ...trace.assertions.final_projection_hash, encoding: "binary" };
      }],
      ["final_applied_op_ids_hash", (trace: CollabReplayTraceV1) => {
        trace.assertions.final_applied_op_ids_hash = { ...trace.assertions.final_applied_op_ids_hash, encoding: "binary" };
      }],
    ] as const;

    for (const [name, mutate] of cases) {
      const malformed = structuredClone(fixture());
      mutate(malformed);
      expect(() => assertCollabReplayTraceV1(malformed), name).toThrow(/canonical-json-v1/);
    }
  });

  it("keeps state-vector replay and doc reset as distinct lifecycle events", () => {
    const base = fixture();
    const stateVectorHash = { algorithm: "sha256" as const, encoding: "yjs-state-vector" as const, value: "a".repeat(64) };
    const binaryHash = { algorithm: "sha256" as const, encoding: "binary" as const, value: "b".repeat(64) };
    const trace: CollabReplayTraceV1 = { ...base, steps: [
      { step_id: "life-1", kind: "state-vector-replay", arrival_index: 0, workflow_id: "wf-fixture", before_lineage_id: "lineage-1", after_lineage_id: "lineage-1", before_doc_id: "doc-1", after_doc_id: "doc-1", before_state_vector_hash: stateVectorHash, after_state_vector_hash: stateVectorHash, diagnostic: { direction: "host-to-follower", byte_length: 1, hash: binaryHash }, same_document: true, reason: "reconnect" },
      { step_id: "life-2", kind: "doc-reset", arrival_index: 1, workflow_id: "wf-fixture", before_lineage_id: "lineage-1", after_lineage_id: "lineage-2", before_doc_id: "doc-1", after_doc_id: "doc-2", before_state_vector_hash: stateVectorHash, after_state_vector_hash: stateVectorHash, same_document: false, reset_seq: 9, projectors_notified_before_replace: true },
    ] };
    expect(() => assertCollabReplayTraceV1(trace)).not.toThrow();

    const malformedDiagnostic = structuredClone(trace);
    const diagnosticStep = malformedDiagnostic.steps[0]!;
    if (diagnosticStep.kind === "semantic-op" || diagnosticStep.diagnostic === undefined) throw new Error("fixture step must have a diagnostic");
    diagnosticStep.diagnostic.hash.encoding = "canonical-json-v1";
    expect(() => assertCollabReplayTraceV1(malformedDiagnostic)).toThrow(/binary/);

    for (const encoding of ["canonical-json-v1", "binary"] as const) {
      for (const field of ["before_state_vector_hash", "after_state_vector_hash"] as const) {
        const malformed = structuredClone(trace);
        const firstStep = malformed.steps[0]!;
        if (firstStep.kind === "semantic-op") throw new Error("fixture step must be a lifecycle event");
        firstStep[field].encoding = encoding;
        expect(() => assertCollabReplayTraceV1(malformed), `${field} must reject ${encoding}`).toThrow(/yjs-state-vector/);
      }
    }

    const discontinuous = structuredClone(trace);
    const firstStep = discontinuous.steps[0]!;
    if (firstStep.kind === "semantic-op") throw new Error("fixture step must be a lifecycle event");
    firstStep.after_state_vector_hash = { ...firstStep.after_state_vector_hash, value: "b".repeat(64) };
    expect(() => assertCollabReplayTraceV1(discontinuous)).toThrow(/state-vector continuity/);

    const wrongLineage = structuredClone(trace);
    const secondStep = wrongLineage.steps[1]!;
    if (secondStep.kind === "semantic-op") throw new Error("fixture step must be a lifecycle event");
    secondStep.before_lineage_id = "unrelated-lineage";
    expect(() => assertCollabReplayTraceV1(wrongLineage)).toThrow(/before_lineage_id/);

    const wrongDocument = structuredClone(trace);
    const nextStep = wrongDocument.steps[1]!;
    if (nextStep.kind === "semantic-op") throw new Error("fixture step must be a lifecycle event");
    nextStep.before_doc_id = "unrelated-document";
    expect(() => assertCollabReplayTraceV1(wrongDocument)).toThrow(/before_doc_id/);
  });
});
