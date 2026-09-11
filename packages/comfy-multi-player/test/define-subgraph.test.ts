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

const catalog: WidgetCatalog = {
  types: {
    Inner: { widget_order: ["value"] },
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
    ["interior edit cannot implicitly create a definition", { op: "set_widget", node_id: 10, path: ["abcdefab-cdef-4abc-8def-abcdefabcdef", "10"], inner_widget: "value", widget: "value", value: 2 }],
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

  it("rejects same definition id with different content without changing the original", () => {
    const doc = empty()
    applyOps(doc, [define()], catalog)
    const before = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, define(subgraphId, 2))).toBe("malformed_op")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    expect((project(doc, catalog).definitions as { subgraphs: unknown[] }).subgraphs).toEqual([definition()])
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

  it("rejects an instance before its definition through the unknown-node path", () => {
    const doc = empty()
    const missing = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const instance = { op: "add_node", ...envelope(), node_id: 1, class_type: missing, pos: [0, 0], node: { id: 1, type: missing, inputs: [], outputs: [] } } as Op
    expect(rejectionCode(doc, instance)).toBe("invalid_node_payload")
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
