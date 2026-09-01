/** Current-behavior characterization of the `applyOps` batch-size gate. */
import { encodeStateAsUpdate, type Doc } from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";
import { MAX_OPS_PER_BATCH } from "../src/limits.js";

const catalog: WidgetCatalog = {
  types: {
    KSampler: { widget_order: ["seed", "steps", "cfg", "sampler_name", "scheduler", "denoise"] },
  },
};

function seededDoc(): Doc {
  return mint({
    nodes: [{
      id: 1,
      type: "KSampler",
      inputs: [],
      outputs: [],
      widgets_values: [0, 20, 8, "euler", "normal", 1],
    }],
    links: [],
    last_node_id: 1,
    last_link_id: 0,
  } as unknown as WorkflowJSON, catalog);
}

function setWidgetBatch(size: number, versionOffset = 0): Op[] {
  return Array.from({ length: size }, (_, index) => {
    const baseVersion = versionOffset + index + 1;
    return {
      op: "set_widget",
      op_id: baseVersion.toString(16).padStart(32, "0"),
      actor: "human:batch:test",
      base_version: baseVersion,
      stamp: [baseVersion, "human:batch:test"],
      node_id: 1,
      widget: "steps",
      value: baseVersion,
    };
  });
}

describe("applyOps batch-limit boundary", () => {
  // CURRENT-BEHAVIOR CHARACTERIZATION: this pins the existing all-or-nothing
  // MAX_OPS_PER_BATCH gate; it does not prescribe the desired batch policy.
  it("accepts the limit and rejects the whole batch one op above it without mutating the document", () => {
    const doc = seededDoc();
    const atLimit = applyOps(doc, setWidgetBatch(MAX_OPS_PER_BATCH), catalog);

    expect(atLimit.outcomes).toHaveLength(MAX_OPS_PER_BATCH);
    expect(atLimit.outcomes.filter(({ outcome }) => outcome === "rejected")).toHaveLength(0);

    const beforeOverLimit = encodeStateAsUpdate(doc);
    const overLimitSize = MAX_OPS_PER_BATCH + 1;
    const overLimit = applyOps(
      doc,
      setWidgetBatch(overLimitSize, MAX_OPS_PER_BATCH),
      catalog,
    );
    const expectedMessage = `batch of ${overLimitSize} ops exceeds the ${MAX_OPS_PER_BATCH}-op limit; rejected before any op was processed (#14)`;

    expect(overLimit.outcomes).toHaveLength(overLimitSize);
    for (const outcome of overLimit.outcomes) {
      expect(outcome.outcome).toBe("rejected");
      if (outcome.outcome === "rejected") {
        expect(outcome.reason.code).toBe("malformed_op");
        expect(outcome.reason.message).toContain(expectedMessage);
      }
    }
    expect(encodeStateAsUpdate(doc)).toEqual(beforeOverLimit);
  });
});
