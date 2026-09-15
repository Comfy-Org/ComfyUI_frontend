/** Property coverage for KA-3 and FC-8: generated workflows and minted ops round-trip faithfully. */
import * as fc from "fast-check";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type Op, type WidgetCatalog, type WorkflowJSON, type WorkflowNode } from "../src/index.js";
import { canonicalize } from "./helpers.js";

const FC_OPTIONS = { seed: 0x45c0ffee, numRuns: 100 } as const;
const catalog: WidgetCatalog = {
  types: {
    Known: { widget_order: ["value", "label", "enabled"] },
  },
};

const jsonValueArb = fc.jsonValue().filter((value) => value !== undefined);
const slotArb = fc.record({
  name: fc.string({ maxLength: 8 }),
  type: fc.string({ maxLength: 8 }),
  link: fc.option(fc.integer({ min: 1, max: 1_000 }), { nil: null }),
  links: fc.option(fc.array(fc.integer({ min: 1, max: 1_000 }), { maxLength: 3 }), { nil: null }),
});
const knownNodeArb = fc.record({
  id: fc.integer({ min: 1, max: 1_000_000 }),
  type: fc.constant("Known"),
  pos: fc.tuple(fc.integer(), fc.integer()),
  inputs: fc.array(slotArb, { maxLength: 3 }),
  outputs: fc.array(slotArb, { maxLength: 3 }),
  widgets_values: fc.array(jsonValueArb, { maxLength: 3 }),
});
const opaqueNodeArb = fc.record({
  id: fc.integer({ min: 1, max: 1_000_000 }),
  type: fc.constantFrom("Note", "MarkdownNote"),
  pos: fc.tuple(fc.integer(), fc.integer()),
  widgets_values: fc.array(jsonValueArb, { minLength: 1, maxLength: 3 }),
});
const metadataKeyArb = fc
  .string({ minLength: 1, maxLength: 8 })
  .filter((key) => !["nodes", "links", "definitions", "schema_version", "catalog_version"].includes(key) && !key.startsWith("__"));

const workflowArb: fc.Arbitrary<WorkflowJSON> = fc
  .tuple(
    knownNodeArb,
    opaqueNodeArb,
    fc.array(fc.oneof(knownNodeArb, opaqueNodeArb), { maxLength: 4 }),
    fc.dictionary(metadataKeyArb, jsonValueArb, { maxKeys: 4 }),
    fc.option(
      fc.uniqueArray(knownNodeArb, { maxLength: 3, selector: (node) => String(node.id) }),
      { nil: undefined },
    ),
  )
  .map(([known, opaque, extras, metadata, subgraphNodes]) => {
    const nodes = [known, opaque, ...extras].map((node, index) => ({ ...node, id: index + 1 }));
    return {
      ...metadata,
      nodes: nodes as WorkflowNode[],
      links: [],
      ...(subgraphNodes === undefined
        ? {}
        : {
            definitions: {
              version: 1,
              subgraphs: [{ id: "generated", name: "Generated", nodes: subgraphNodes, links: [] }],
            },
          }),
    };
  });

interface Scenario {
  base: WorkflowJSON;
  additions: WorkflowNode[];
  values: unknown[];
}

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .tuple(
    workflowArb,
    fc.uniqueArray(knownNodeArb, { minLength: 1, maxLength: 5, selector: (node) => String(node.id) }),
    fc.array(jsonValueArb, { minLength: 1, maxLength: 5 }),
  )
  .map(([base, additions, values]) => {
    const occupied = new Set(base.nodes.map((node) => String(node.id)));
    const fresh = additions
      .filter((node) => !occupied.has(String(node.id)))
      .map((node, index) => ({ ...node, id: 2_000_000 + index }));
    return { base, additions: fresh.length > 0 ? fresh : [{ ...additions[0]!, id: 2_000_000 }], values };
  });

function envelope(index: number) {
  const actor = `agent:pbt:${index % 3}`;
  return {
    op_id: index.toString(16).padStart(32, "0"),
    actor,
    base_version: index,
    stamp: [index, actor] as [number, string],
  };
}

function opsFor(scenario: Scenario): Op[] {
  const adds: Op[] = scenario.additions.map((node, index) => ({
    ...envelope(index + 1),
    op: "add_node",
    node_incarnation: (index + 1).toString(16).padStart(32, "0"),
    node_id: node.id,
    class_type: node.type,
    pos: node.pos ?? [0, 0],
    node,
  }));
  const writes: Op[] = scenario.additions.map((node, index) => ({
    ...envelope(scenario.additions.length + index + 1),
    op: "set_widget",
    node_id: node.id,
    widget: "value",
    value: scenario.values[index % scenario.values.length],
    node_incarnation: adds[index]!.op_id,
  }));
  return [...adds, ...writes];
}

function cloneWorkflow(workflow: WorkflowJSON): WorkflowJSON {
  return structuredClone(workflow);
}

describe("property-based mint → apply → project round trips", () => {
  it("round-trips generated metadata, slots, widgets, and subgraphs without mutating input", () => {
    fc.assert(
      fc.property(workflowArb, (workflow) => {
        const before = cloneWorkflow(workflow);
        const projected = project(mint(workflow, catalog), catalog);

        expect(canonicalize(projected)).toEqual(canonicalize(before));
        expect(workflow).toEqual(before);
        expect(project(mint(projected, catalog), catalog)).toEqual(projected);
      }),
      FC_OPTIONS,
    );
  });

    it("preserves minted op identities and is deterministic under apply and retry", { timeout: 15_000 }, () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const source = cloneWorkflow(scenario.base);
        const ops = opsFor(scenario);
        const doc = mint(scenario.base, catalog);
        const result = applyOps(doc, ops, catalog);

        expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
        expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual(ops.map((op) => op.op_id));
        expect(scenario.base).toEqual(source);

        const firstProjection = project(doc, catalog);
        const firstUpdate = Y.encodeStateAsUpdate(doc);
        const retry = applyOps(doc, ops, catalog);

        expect(retry.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
        expect(retry.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
        expect(retry.outcomes.filter((o) => o.outcome === "no-op").map((o) => o.op_id)).toEqual(ops.map((op) => op.op_id));
        expect(project(doc, catalog)).toEqual(firstProjection);
        expect(Y.encodeStateAsUpdate(doc)).toEqual(firstUpdate);
        expect(project(mint(firstProjection, catalog), catalog)).toEqual(firstProjection);
      }),
      FC_OPTIONS,
    );
  });
});
