import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  CMP_EVENT_SCHEMA_VERSION,
  MAX_OPS_PER_BATCH,
  appliedOpIds,
  applyOps,
  mint,
  readGraph,
  type CmpEvent,
  type Op,
  type WidgetCatalog,
} from "../src/index.js";
import { loadCatalog, loadLwwVectors } from "./helpers.js";

// Compile-time regression: ordinary callbacks, including one already typed as
// returning void, must be assignable to the public sink type.
const pretypedVoidCallback: (event: CmpEvent) => void = (_event) => {};
const ordinaryCallback = (event: CmpEvent) => event.type;
const compatibleSinks: import("../src/index.js").CmpEventSink[] = [
  pretypedVoidCallback,
  ordinaryCallback,
];

const catalog: WidgetCatalog = { types: {} };
const lwwCatalog = loadCatalog();
const lww = loadLwwVectors();

const malformed = {
  op: "not_a_real_op",
  op_id: "00000000000000000000000000000001",
  actor: "agent:event-test",
  base_version: 1,
  stamp: [1, "agent:event-test"],
} as unknown as Op;

const validClear = {
  op: "clear", op_id: "00000000000000000000000000000002",
  actor: "agent:event-test", base_version: 2, stamp: [2, "agent:event-test"], removed_nodes: [],
} as unknown as Op;

const newerWrite = {
  op: "set_widget",
  op_id: "00000000000000000000000000000004",
  actor: "agent:event-test",
  base_version: 4,
  stamp: [4, "agent:event-test"],
  node_id: 3308598398221244,
  widget: "steps",
  value: 30,
} as unknown as Op;

const olderWrite = {
  ...newerWrite,
  op_id: "00000000000000000000000000000005",
  base_version: 3,
  stamp: [3, "agent:event-test"],
  value: 20,
} as unknown as Op;

const applierFailure = {
  ...validClear,
  op_id: "00000000000000000000000000000003",
  get removed_nodes() { throw new Error("boom"); },
} as unknown as Op;

const goldenEvents = readFileSync(new URL("../fixtures/cmp-events/v1.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as CmpEvent);

describe("caller-owned cmp event sink", () => {
  it("accepts ordinary and pretyped void callbacks", () => {
    const event = goldenEvents[0]!;
    expect(compatibleSinks.map((sink) => sink(event))).toEqual([
      undefined,
      event.type,
    ]);
  });

  it("emits the void sink return in the public declaration", () => {
    const declaration = readFileSync(new URL("../dist/events.d.ts", import.meta.url), "utf8");
    expect(declaration).toMatch(/CmpEventSink = \(event: CmpEvent\) => void;/);
    expect(declaration).not.toMatch(/CmpEventSink = \(event: CmpEvent\) => undefined;/);
  });

  it("isolates a throwing sink from applier results and document bytes", () => {
    const baselineDoc = mint({ nodes: [], links: [] }, catalog);
    const observedDoc = new Y.Doc();
    Y.applyUpdate(observedDoc, Y.encodeStateAsUpdate(baselineDoc));

    const baseline = applyOps(baselineDoc, [malformed]);
    const withThrowingSink = applyOps(observedDoc, [malformed], undefined, {
      eventSink: () => { throw new Error("host telemetry is down"); },
    });

    expect(withThrowingSink).toEqual(baseline);
    expect(Y.encodeStateAsUpdate(observedDoc)).toEqual(Y.encodeStateAsUpdate(baselineDoc));
  });

  it("emits a versioned JSON-serializable rejection without Error instances", () => {
    const events: CmpEvent[] = [];
    applyOps(mint({ nodes: [], links: [] }, catalog), [malformed], undefined, { eventSink: (event) => { events.push(event); } });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schema_version: CMP_EVENT_SCHEMA_VERSION,
      type: "op_rejected",
      source: "applyOps",
      code: "unknown_op",
      error_name: "OpRejectedError",
      op_id: malformed.op_id,
      batch_index: 0,
    });
    expect(JSON.parse(JSON.stringify(events[0]))).toEqual(events[0]);
    expect(Object.values(events[0]!).some((value) => value instanceof Error)).toBe(false);
  });

  it("reports the existing batch limit once without changing its result", () => {
    const sink = vi.fn((_event: CmpEvent): undefined => undefined);
    const ops = Array.from({ length: MAX_OPS_PER_BATCH + 1 }, () => malformed);
    const result = applyOps(mint({ nodes: [], links: [] }, catalog), ops, undefined, { eventSink: sink });

    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({
      schema_version: 1,
      type: "limit_violation",
      code: "max_ops_per_batch",
    }));
    expect(result.outcomes).toHaveLength(ops.length);
    expect(result.outcomes.every((outcome) => outcome.outcome === "rejected")).toBe(true);
    expect(JSON.parse(JSON.stringify(sink.mock.calls[0]![0]))).toEqual(sink.mock.calls[0]![0]);
  });

  it("emits the generic applier error shape for an unexpected internal failure", () => {
    const sink = vi.fn((_event: CmpEvent): undefined => undefined);
    const result = applyOps(mint({ nodes: [], links: [] }, catalog), [applierFailure], undefined, { eventSink: sink });

    expect(result.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "apply_failed", message: "boom" } });
    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({
      schema_version: 1,
      type: "applier_error",
      source: "applyOps",
      code: "apply_failed",
      error_name: "Error",
      op_id: applierFailure.op_id,
      batch_index: 0,
    }));
    expect(JSON.parse(JSON.stringify(sink.mock.calls[0]![0]))).toEqual(sink.mock.calls[0]![0]);
  });

  it("emits one conflict counter for an LWW drop across arrival orders and retries", () => {
    const sink = vi.fn((_event: CmpEvent): undefined => undefined);
    const reverseSink = vi.fn((_event: CmpEvent): undefined => undefined);
    const seededDoc = mint(lww.base_workflow, lwwCatalog);
    const doc = new Y.Doc();
    const reverseDoc = new Y.Doc();
    const seed = Y.encodeStateAsUpdate(seededDoc);
    Y.applyUpdate(doc, seed);
    Y.applyUpdate(reverseDoc, seed);

    const result = applyOps(doc, [newerWrite, olderWrite], lwwCatalog, { eventSink: sink });
    applyOps(reverseDoc, [olderWrite, newerWrite], lwwCatalog, { eventSink: reverseSink });

    expect(result.outcomes[1]).toEqual({ op_id: olderWrite.op_id, outcome: "lww-dropped" });
    expect(readGraph(reverseDoc)).toEqual(readGraph(doc));
    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith({
      schema_version: CMP_EVENT_SCHEMA_VERSION,
      type: "op_conflict",
      source: "applyOps",
      code: "lww_dropped",
      message: "operation lost last-writer-wins conflict",
      op_id: olderWrite.op_id,
      batch_index: 1,
    });
    expect(reverseSink).not.toHaveBeenCalled();

    const retry = applyOps(doc, [newerWrite, olderWrite], lwwCatalog, { eventSink: sink });
    const reverseRetry = applyOps(reverseDoc, [olderWrite, newerWrite], lwwCatalog, { eventSink: reverseSink });

    expect(retry.outcomes.every((outcome) => outcome.outcome === "no-op")).toBe(true);
    expect(reverseRetry.outcomes.every((outcome) => outcome.outcome === "no-op")).toBe(true);
    expect(sink).toHaveBeenCalledOnce();
    expect(reverseSink).not.toHaveBeenCalled();
  });

  it("lets a host register hooks on its own adapter and pass one sink per call", () => {
    const hooks = new Set<(event: CmpEvent) => void>();
    const seen: CmpEvent[] = [];
    hooks.add((event) => { seen.push(event); });
    const eventSink = (event: CmpEvent): undefined => {
      for (const hook of hooks) hook(event);
      return undefined;
    };

    applyOps(mint({ nodes: [], links: [] }, catalog), [malformed], undefined, { eventSink });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.type).toBe("op_rejected");
  });

  it("keeps the emitted v1 shapes in sync with the language-neutral golden vectors", () => {
    const events: CmpEvent[] = [];
    const eventSink = (event: CmpEvent): undefined => { events.push(event); return undefined; };

    applyOps(mint({ nodes: [], links: [] }, catalog), [malformed], undefined, { eventSink });
    applyOps(mint({ nodes: [], links: [] }, catalog), [applierFailure], undefined, { eventSink });
    applyOps(
      mint({ nodes: [], links: [] }, catalog),
      Array.from({ length: MAX_OPS_PER_BATCH + 1 }, () => malformed),
      undefined,
      { eventSink },
    );
    const seededConflict = mint(lww.base_workflow, lwwCatalog);
    const conflictDoc = new Y.Doc();
    Y.applyUpdate(conflictDoc, Y.encodeStateAsUpdate(seededConflict));
    applyOps(conflictDoc, [newerWrite, olderWrite], lwwCatalog, { eventSink });

    expect(events).toEqual(goldenEvents);
  });

  it("isolates a throwing sink after an applied prefix and abort remainder are fixed", () => {
    const baselineDoc = mint({ nodes: [], links: [] }, catalog);
    const observedDoc = new Y.Doc();
    Y.applyUpdate(observedDoc, Y.encodeStateAsUpdate(baselineDoc));
    const ops = [validClear, malformed, validClear];
    const baseline = applyOps(baselineDoc, ops);
    const observed = applyOps(observedDoc, ops, undefined, {
      eventSink: () => { throw new Error("host telemetry is down"); },
    });
    expect(observed).toEqual(baseline);
    expect(observed.outcomes.map((outcome) => outcome.outcome)).toEqual(["no-op", "rejected", "rejected"]);
    expect(readGraph(observedDoc)).toEqual(readGraph(baselineDoc));
    expect(appliedOpIds(observedDoc)).toEqual(appliedOpIds(baselineDoc));
  });

  it("isolates a throwing sink on the conflict path without altering KA-4 outcomes or abort remainder", () => {
    const baselineDoc = mint(lww.base_workflow, lwwCatalog);
    const observedDoc = new Y.Doc();
    Y.applyUpdate(observedDoc, Y.encodeStateAsUpdate(baselineDoc));

    const baseline = applyOps(baselineDoc, [newerWrite, olderWrite], lwwCatalog);
    const observed = applyOps(observedDoc, [newerWrite, olderWrite], lwwCatalog, {
      eventSink: () => { throw new Error("host telemetry is down"); },
    });

    expect(observed).toEqual(baseline);
    expect(observed.outcomes.map((outcome) => outcome.outcome)).toEqual(["applied", "lww-dropped"]);
    expect(readGraph(observedDoc)).toEqual(readGraph(baselineDoc));
    expect(appliedOpIds(observedDoc)).toEqual(appliedOpIds(baselineDoc));
  });
});
