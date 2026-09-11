import * as Y from "yjs"
import { describe, expect, it } from "vitest"

import {
  applyOps,
  mint,
  project,
  type DefineSubgraphOp,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js"
import { definitionsMap } from "../src/doc.js"

const catalog: WidgetCatalog = {
  types: {
    Inner: { widget_order: ["value"] },
    Other: { widget_order: [] },
  },
}

let sequence = 0
const envelope = () => {
  const op_id = String(++sequence).padStart(32, "0")
  return { op_id, actor: "agent:test", base_version: sequence, stamp: [sequence, "agent:test"] as [number, string] }
}

const subgraphId = "12345678-1234-4123-8123-123456789abc"
const definition = (id = subgraphId, value = 1) => ({
  id,
  name: "One",
  inputs: [],
  outputs: [],
  nodes: [{ id: 10, type: "Inner", inputs: [], outputs: [], widgets_values: [value] }],
  links: [],
})

const define = (id = subgraphId, value = 1): DefineSubgraphOp => ({
  op: "define_subgraph",
  ...envelope(),
  subgraph_id: id,
  subgraph_definition: definition(id, value),
})

const empty = () => mint({ nodes: [], links: [] } as unknown as WorkflowJSON, catalog)
const rejectionCode = (doc: Y.Doc, op: Op) =>
  applyOps(doc, [op], catalog).outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code

describe("define_subgraph schema", () => {
  const forbidden = [
    ["add_node with subgraph_definition", { op: "add_node", node_id: 1, class_type: "Inner", pos: [0, 0], node: { id: 1, type: "Inner" }, subgraph_definition: definition() }],
    ["add_node with definitions", { op: "add_node", node_id: 1, class_type: "Inner", pos: [0, 0], node: { id: 1, type: "Inner" }, definitions: { subgraphs: [] } }],
    ["node-property op with definition payload", { op: "set_widget", node_id: 1, widget: "value", value: 2, subgraph_definition: definition() }],
    ["widget op with definitions payload", { op: "set_widget", node_id: 1, widget: "value", value: 2, definitions: {} }],
    ["connect with definition payload", { op: "connect", link_id: 1, from_node: 1, from_slot: 0, to_node: 2, to_slot: 0, link_type: "X", subgraph_definition: definition() }],
    ["disconnect with definition payload", { op: "disconnect", link_id: 1, subgraph_definition: definition() }],
    ["layout op with definition payload", { op: "add_node", node_id: 1, class_type: "Inner", pos: [0, 0], node: { id: 1, type: "Inner" }, layout: {}, subgraph_definition: definition() }],
    ["remove-node with definition payload", { op: "delete_node", node_id: 1, removed_links: [], subgraph_definition: definition() }],
    ["subgraph_id cannot substitute for a node target", { op: "set_widget", subgraph_id: subgraphId, widget: "value", value: 2 }],
  ] as const

  it.each(forbidden)("rejects %s", (_name, fields) => {
    const op = { ...fields, ...envelope() } as unknown as Op
    expect(rejectionCode(empty(), op)).toBeDefined()
  })
})

describe("define_subgraph application", () => {
  it("projects a newly defined subgraph", () => {
    const doc = empty()
    expect(applyOps(doc, [define()], catalog).outcomes[0]?.outcome).toBe("applied")
    expect((project(doc, catalog).definitions as { subgraphs: unknown[] }).subgraphs).toEqual([definition()])
  })

  it("is byte-idempotent on exact replay", () => {
    const doc = empty()
    const op = define()
    applyOps(doc, [op], catalog)
    const before = Y.encodeStateAsUpdate(doc)
    expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).toBe("no-op")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })

  it("does not revert an intervening interior edit when the exact op is replayed", () => {
    const doc = empty()
    const op = define()
    applyOps(doc, [op], catalog)
    applyOps(doc, [
      { op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "10"], inner_widget: "value", widget: "value", value: 2 },
    ], catalog)
    const before = Y.encodeStateAsUpdate(doc)

    expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).toBe("no-op")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    const projected = (project(doc, catalog).definitions as { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> }).subgraphs[0]!
    expect(projected.nodes[0]!.widgets_values).toEqual([2])
  })

  it("drops a losing definition conflict without changing the winner", () => {
    const doc = empty()
    applyOps(doc, [define()], catalog)
    expect(applyOps(doc, [define(subgraphId, 2)], catalog).outcomes[0]?.outcome).toBe("lww-dropped")
    expect((project(doc, catalog).definitions as { subgraphs: unknown[] }).subgraphs).toEqual([definition()])
  })

  it("projects the same deterministic winner for conflicting definitions in either delivery order", () => {
    const a = define(subgraphId, 1)
    const b = define(subgraphId, 2)
    const projections = [[a, b], [b, a]].map((ops) => {
      const doc = empty()
      for (const op of ops) applyOps(doc, [op], catalog)
      return project(doc, catalog)
    })

    expect(projections[0]).toEqual(projections[1])
  })

  it("keeps applying a batch suffix after the deterministic conflict loser", () => {
    const a = define(subgraphId, 1)
    const b = define(subgraphId, 2)
    const suffix = { op: "add_node", ...envelope(), node_id: 99, class_type: "Other", pos: [0, 0], node: { id: 99, type: "Other", inputs: [], outputs: [] } } as Op
    const projections = [[a, b], [b, a]].map((ops) => {
      const doc = empty()
      applyOps(doc, [ops[0]!], catalog)
      applyOps(doc, [ops[1]!, suffix], catalog)
      return project(doc, catalog)
    })
    expect(projections[0]).toEqual(projections[1])
    expect(projections[0]!.nodes.some((node) => node.id === 99)).toBe(true)
  })

  it.each([
    ["missing nodes", { ...definition(), nodes: undefined }],
    ["invalid definition id", definition("not-a-uuid")],
    ["duplicate normalized node ids", { ...definition(), nodes: [{ id: 1, type: "Inner" }, { id: "1", type: "Inner" }] }],
    ["missing interior node id", { ...definition(), nodes: [{ type: "Inner" }] }],
    ["reserved structural key", { ...definition(), node_order: [] }],
    ["duplicate normalized nested definition ids", {
      ...definition(),
      definitions: {
        subgraphs: [
          definition("abcdefab-cdef-4abc-8def-abcdefabcdef"),
          definition("abcdefab-cdef-4abc-8def-abcdefabcdef"),
        ],
      },
    }],
  ])("rejects %s without creating a partial definition", (_name, malformed) => {
    const doc = empty()
    const before = Y.encodeStateAsUpdate(doc)
    const op = { ...define(), subgraph_id: String(malformed.id), subgraph_definition: malformed } as DefineSubgraphOp

    expect(rejectionCode(doc, op)).toBe("malformed_op")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    expect(definitionsMap(doc).size).toBe(0)
  })

  it("projects nested definitions", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const nested = definition(nestedId, 4)
    const outer = { ...definition(), definitions: { subgraphs: [nested] } }
    const doc = empty()

    expect(applyOps(doc, [{ ...define(), subgraph_definition: outer }], catalog).outcomes[0]?.outcome).toBe("applied")
    const projected = (project(doc, catalog).definitions as { subgraphs: Array<Record<string, unknown>> }).subgraphs[0]!
    expect(projected.definitions).toEqual({ subgraphs: [nested] })
  })

  it("applies an id-addressed widget edit to a nested definition", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const outer = { ...definition(), definitions: { subgraphs: [definition(nestedId, 4)] } }
    const doc = empty()
    applyOps(doc, [{ ...define(), subgraph_definition: outer }], catalog)

    const outcome = applyOps(doc, [{
      op: "set_widget", ...envelope(), node_id: 10, path: [nestedId, "10"], inner_widget: "value", widget: "value", value: 9,
    }], catalog).outcomes[0]?.outcome
    const projected = (project(doc, catalog).definitions as { subgraphs: Array<{ definitions: { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> } }> }).subgraphs[0]!

    expect(outcome).toBe("applied")
    expect(projected.definitions.subgraphs[0]!.nodes[0]!.widgets_values).toEqual([9])
  })

  it("rejects a direct edit to a definition with multiple live instances", () => {
    const doc = empty()
    applyOps(doc, [define()], catalog)
    applyOps(doc, [
      { op: "add_node", ...envelope(), node_id: 1, class_type: subgraphId, pos: [0, 0], node: { id: 1, type: subgraphId, inputs: [], outputs: [] } },
      { op: "add_node", ...envelope(), node_id: 2, class_type: subgraphId, pos: [0, 0], node: { id: 2, type: subgraphId, inputs: [], outputs: [] } },
    ], catalog)
    expect(rejectionCode(doc, { op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "10"], inner_widget: "value", widget: "value", value: 9 })).toBe("shared_definition_unforked")
  })

  it("rejects an unprojectable named widget in an interior node atomically", () => {
    const doc = empty()
    const malformed = { ...definition(), nodes: [{ id: 10, type: "Inner", inputs: [], outputs: [], widgets_values: { missing: 1 } }] }
    const before = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, { ...define(), subgraph_definition: malformed })).toBe("unknown_widget")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })

  it.each([
    ["ancestor", () => ({ ...definition(), definitions: { subgraphs: [definition(subgraphId)] } })],
    ["cross-branch", () => {
      const duplicate = "abcdefab-cdef-4abc-8def-abcdefabcdef"
      const left = { ...definition("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), definitions: { subgraphs: [definition(duplicate)] } }
      const right = { ...definition("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), definitions: { subgraphs: [definition(duplicate)] } }
      return { ...definition(), definitions: { subgraphs: [left, right] } }
    }],
  ])("rejects a duplicate definition id against an %s atomically", (_name, makeDefinition) => {
    const doc = empty()
    const before = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, { ...define(), subgraph_definition: makeDefinition() } as DefineSubgraphOp)).toBe("malformed_op")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })

  it("never projects internal definition digests, including sender-supplied nested keys", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const nested = { ...definition(nestedId), __definition_digest: "sender-value" }
    const outer = { ...definition(), definitions: { subgraphs: [nested] } }
    const doc = empty()

    expect(rejectionCode(doc, { ...define(), subgraph_definition: outer } as DefineSubgraphOp)).toBe("malformed_op")
    applyOps(doc, [{ ...define(), subgraph_definition: {
      ...definition(), definitions: { subgraphs: [definition(nestedId)] },
    } }], catalog)
    expect(JSON.stringify(project(doc, catalog))).not.toContain("__definition_digest")
  })

  it("uses the same unknown-node outcome for UUID and non-UUID interior targets", () => {
    const outcomes = ["abcdefab-cdef-4abc-8def-abcdefabcdef", "missing"].map((target) => {
      const doc = empty()
      return applyOps(doc, [{
        op: "set_widget", ...envelope(), node_id: 10, path: [target, "10"], inner_widget: "value", widget: "value", value: 2,
      }], catalog).outcomes[0]
    })

    expect(outcomes.map((outcome) => outcome?.outcome)).toEqual(["no-op", "no-op"])
  })

  it("uses a key-order-independent definition digest", () => {
    const doc = empty()
    const first = definition()
    const reordered = {
      links: first.links,
      nodes: first.nodes,
      outputs: first.outputs,
      inputs: first.inputs,
      name: first.name,
      id: first.id,
    }

    expect(applyOps(doc, [{ ...define(), subgraph_definition: first }], catalog).outcomes[0]?.outcome).toBe("applied")
    const digest = definitionsMap(doc).get(subgraphId)?.get("__definition_digest")
    expect(applyOps(doc, [{ ...define(), subgraph_definition: reordered }], catalog).outcomes[0]?.outcome).toBe("no-op")
    expect(definitionsMap(doc).get(subgraphId)?.get("__definition_digest")).toBe(digest)
  })

  it("applies define, interior edit, then instance in one batch", () => {
    const doc = empty()
    const ops: Op[] = [
      define(),
      { op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "10"], inner_widget: "value", widget: "value", value: 2 },
      { op: "add_node", ...envelope(), node_id: 1, class_type: subgraphId, pos: [0, 0], node: { id: 1, type: subgraphId, inputs: [], outputs: [] } },
    ]
    expect(applyOps(doc, ops, catalog).outcomes.map((outcome) => outcome.outcome)).toEqual(["applied", "applied", "applied"])
    const subgraph = (project(doc, catalog).definitions as { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> }).subgraphs[0]!
    expect(subgraph.nodes[0]!.widgets_values).toEqual([2])
  })

  it("accepts an opaque UUID-shaped node type before its definition arrives", () => {
    const doc = empty()
    const missing = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const instance = { op: "add_node", ...envelope(), node_id: 1, class_type: missing, pos: [0, 0], node: { id: 1, type: missing, inputs: [], outputs: [] } } as Op
    expect(applyOps(doc, [instance], catalog).outcomes[0]?.outcome).toBe("applied")
  })

  it("has root/interior widget-edit parity", () => {
    const root = mint({ nodes: [{ id: 10, type: "Inner", inputs: [], outputs: [], widgets_values: [1] }], links: [] } as unknown as WorkflowJSON, catalog)
    const nested = empty()
    applyOps(nested, [define()], catalog)
    const rootOp = { op: "set_widget", ...envelope(), node_id: 10, widget: "value", value: 3 } as Op
    const nestedOp = { op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "10"], inner_widget: "value", widget: "value", value: 3 } as Op
    expect(applyOps(root, [rootOp], catalog).outcomes[0]?.outcome).toBe("applied")
    expect(applyOps(nested, [nestedOp], catalog).outcomes[0]?.outcome).toBe("applied")
    expect(project(root, catalog).nodes[0]!.widgets_values).toEqual(
      (project(nested, catalog).definitions as { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> }).subgraphs[0]!.nodes[0]!.widgets_values,
    )
  })
})
