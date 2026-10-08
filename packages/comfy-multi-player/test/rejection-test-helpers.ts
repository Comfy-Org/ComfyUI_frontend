import { expect } from "vitest";

import { applyOps, mint, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";
import { loadCatalog } from "./helpers.js";
import { cleanRejection, rejectionEvidence } from "./rejection-oracle.js";

export const rejectionCatalog = loadCatalog();

/** The rejection fixture's catalog with a real `inputcount` grow widget. */
export const countingRejectionCatalog: WidgetCatalog = {
  ...rejectionCatalog,
  types: {
    ...rejectionCatalog.types,
    BatchImagesNode: {
      ...rejectionCatalog.types["BatchImagesNode"]!,
      widget_order: ["inputcount"],
    },
  },
};

/** Build a deterministic 32-character operation ID for rejection fixtures. */
export const rejectionOpId = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

export const rejectedConnectSource = {
  id: 300,
  type: "LoadImage",
  inputs: [],
  outputs: [{ name: "IMAGE", type: "IMAGE", links: [9000] }],
  widgets_values: [],
};

export const rejectedConnectDestination = {
  id: 700,
  type: "BatchImagesNode",
  inputs: [{ name: "images.image0", type: "IMAGE", link: 9000 }],
  outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
  widgets_values: [],
};

export const rejectedConnectWorkflow: WorkflowJSON = {
  nodes: [rejectedConnectSource, rejectedConnectDestination],
  links: [[9000, 300, 0, 700, 0, "IMAGE"]],
  groups: [],
  extra: {},
  last_node_id: 700,
  last_link_id: 9000,
};

/** A valid trailing op used to prove that a rejection aborts the batch remainder. */
const rejectionTrailingOp: Op = {
  op: "add_node",
  op_id: rejectionOpId("trailing"),
  actor: "human:z",
  base_version: 9,
  stamp: [9, "human:z"],
  node_id: 990,
  class_type: "LoadImage",
  pos: [],
  node: {
    id: 990,
    type: "LoadImage",
    inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
    widgets_values: [],
  },
};

/** Assert the byte-identity, retry, and batch-abort rejection oracle. */
export function assertRejectedWithoutMutation(
  workflow: WorkflowJSON,
  op: Op,
  code: string,
  withCatalog: WidgetCatalog = rejectionCatalog,
  trailing: Op | undefined = rejectionTrailingOp,
): void {
  if (trailing !== undefined) {
    const alone = mint(workflow, withCatalog);
    try {
      expect(applyOps(alone, [trailing], withCatalog).outcomes.map((outcome) => outcome.outcome))
        .toEqual(["applied"]);
    } finally {
      alone.destroy();
    }
  }
  expect(rejectionEvidence(workflow, op, withCatalog, trailing))
    .toEqual(cleanRejection(code, trailing !== undefined));
}

/** Assert rejection byte identity, retry behavior, and abort-remainder behavior. */
export function assertRejectedWithAbort(
  workflow: WorkflowJSON,
  op: Op,
  code: string,
  withCatalog: WidgetCatalog = rejectionCatalog,
): void {
  assertRejectedWithoutMutation(workflow, op, code, withCatalog, rejectionTrailingOp);
}
