import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applyOps, mint, project, type Op, type WireOp, type WorkflowJSON } from "../src/index.js";
import { fixturesDir, loadCatalog } from "./helpers.js";

interface ExpectedResult {
  applied: string[];
  skipped: string[];
  failed: { index: number; code: string; op_id: string } | null;
  applied_count: number;
  version: number;
  document_unchanged: boolean;
}

interface RejectionRetryCase {
  name: string;
  /**
   * `WireOp`, not `Op`: `rejection-retry.json` legally contains a deferred
   * `reset_doc`, which since #17 is a `WireOp` and not an `Op`. Typing this
   * `Op[][]` asserted something the manifest one directory away disproves.
   */
  batches: WireOp[][];
  expected: ExpectedResult[];
  final_node_ids: Array<string | number>;
  final_widget_values?: unknown[];
}

interface RejectionRetryVectors {
  format_version: number;
  base_workflow: WorkflowJSON;
  cases: RejectionRetryCase[];
}

const manifestPath = resolve(fixturesDir, "golden-vectors", "conformance.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { result_cases: string };
const vectors = JSON.parse(readFileSync(resolve(dirname(manifestPath), manifest.result_cases), "utf8")) as RejectionRetryVectors;

function bytes(doc: Y.Doc): number[] {
  return Array.from(Y.encodeStateAsUpdate(doc));
}

function observableResult(result: ReturnType<typeof applyOps>): Omit<ExpectedResult, "document_unchanged"> {
  return {
    applied: result.applied,
    skipped: result.skipped,
    failed: result.failed
      ? { index: result.failed.index, code: result.failed.code, op_id: result.failed.op.op_id }
      : null,
    applied_count: result.applied_count,
    version: result.version,
  };
}

describe("rejection/retry golden-vector parity (KA-3, KA-4, FC-7)", () => {
  it("uses the supported deterministic vector format", () => {
    expect(vectors.format_version).toBe(1);
    expect(vectors.cases.length).toBeGreaterThanOrEqual(6);
  });

  for (const vector of vectors.cases) {
    it(`${vector.name}: matches result and byte-mutation expectations`, () => {
      const catalog = loadCatalog();
      const doc = mint(vectors.base_workflow, catalog);

      expect(vector.batches).toHaveLength(vector.expected.length);
      for (const [index, batch] of vector.batches.entries()) {
        const before = bytes(doc);
        // The wire boundary: a host holds received ops before the validator has
        // ruled on them, so the cast is where `WireOp` becomes an apply request.
        const result = applyOps(doc, batch as Op[], catalog);
        const expected = vector.expected[index]!;

        expect(observableResult(result)).toEqual({
          applied: expected.applied,
          skipped: expected.skipped,
          failed: expected.failed,
          applied_count: expected.applied_count,
          version: expected.version,
        });
        if (expected.document_unchanged) {
          expect(bytes(doc)).toEqual(before);
        } else {
          expect(bytes(doc)).not.toEqual(before);
        }
      }

      const workflow = project(doc, catalog);
      expect(workflow.nodes.map((node) => node.id)).toEqual(vector.final_node_ids);
      if (vector.final_widget_values) {
        expect(workflow.nodes[0]?.widgets_values).toEqual(vector.final_widget_values);
      }
    });
  }
});

describe("rejection and retry arrival-order parity", () => {
  const valid = vectors.cases.find((vector) => vector.name === "same-op-id-retry-cross-batch")!
    .batches[0]![0]!;
  const rejected = vectors.cases.find((vector) => vector.name === "rejection-cross-batch-does-not-poison-retry")!
    .batches[0]![0]!;

  it("a same-op_id retry is byte-identical whether duplicated in one batch or a later batch", () => {
    const catalog = loadCatalog();
    const sameBatch = mint(vectors.base_workflow, catalog);
    const crossBatch = mint(vectors.base_workflow, catalog);

    const sameResult = applyOps(sameBatch, [valid, valid], catalog);
    applyOps(crossBatch, [valid], catalog);
    const beforeRetry = bytes(crossBatch);
    const retryResult = applyOps(crossBatch, [valid], catalog);

    expect(sameResult).toMatchObject({ applied: [valid.op_id], skipped: [valid.op_id], failed: null });
    expect(retryResult).toMatchObject({ applied: [], skipped: [valid.op_id], failed: null });
    expect(bytes(crossBatch)).toEqual(beforeRetry);
    expect(project(crossBatch, catalog)).toEqual(project(sameBatch, catalog));
  });

  it("rejects identically in-order and cross-batch while allowing only the cross-batch remainder", () => {
    const catalog = loadCatalog();
    const inOrder = mint(vectors.base_workflow, catalog);
    const crossBatch = mint(vectors.base_workflow, catalog);

    const inOrderBefore = bytes(inOrder);
    const inOrderResult = applyOps(inOrder, [rejected, valid], catalog);
    const crossBefore = bytes(crossBatch);
    const crossRejected = applyOps(crossBatch, [rejected], catalog);

    expect(observableResult(inOrderResult)).toEqual(observableResult(crossRejected));
    expect(bytes(inOrder)).toEqual(inOrderBefore);
    expect(bytes(crossBatch)).toEqual(crossBefore);

    expect(applyOps(crossBatch, [valid], catalog).applied).toEqual([valid.op_id]);
    expect(project(inOrder, catalog).nodes).toEqual([]);
    expect(project(crossBatch, catalog).nodes.map((node) => node.id)).toEqual([4]);
  });
});
