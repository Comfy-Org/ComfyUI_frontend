import * as Y from "yjs"
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"

import {
  applyOps,
  mint,
  project,
  type DefineSubgraphOp,
  type Op,
  type SubgraphDefinition,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js"
import { appliedMap, definitionsMap, metaMap, stampsMap } from "../src/doc.js"
import { stampKey } from "../src/stamps.js"
import { compareText } from "./helpers.js"

const catalog: WidgetCatalog = {
  types: {
    Inner: { widget_order: ["value"] },
    DuplicateWidgets: { widget_order: ["same", "same"] },
    Other: { widget_order: [] },
  },
}

let sequence = 0
const envelope = () => {
  const op_id = String(++sequence).padStart(32, "0")
  return { op_id, actor: "agent:test", base_version: sequence, stamp: [sequence, "agent:test"] as [number, string] }
}

const subgraphId = "12345678-1234-4123-8123-123456789abc"
const catalogClassId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const collisionCatalog: WidgetCatalog = {
  types: { ...catalog.types, [catalogClassId]: { widget_order: [] } },
}
const definition = (id = subgraphId, value = 1) => ({
  id,
  name: "One",
  inputs: [],
  outputs: [],
  nodes: [{ id: 10, type: "Inner", inputs: [], outputs: [], widgets_values: [value] }],
  links: [],
})

const duplicateWidgetDefinition = (first: unknown, second: unknown): SubgraphDefinition => ({
  id: subgraphId,
  name: "Duplicates",
  inputs: [],
  outputs: [],
  nodes: [{ id: 10, type: "DuplicateWidgets", inputs: [], outputs: [], widgets_values: [first, second] }],
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

const winningReplacement = (incumbent: SubgraphDefinition, replacement: SubgraphDefinition) => {
  const canonical = (value: unknown): string => JSON.stringify(value, (_key, child: unknown) =>
    child && typeof child === "object" && !Array.isArray(child)
      ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => compareText(a, b)))
      : child)
  const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex")
  const incumbentDigest = digest(incumbent)
  for (let nonce = 0; nonce < 1000; nonce++) {
    const candidate: SubgraphDefinition = { ...replacement, name: `replacement-${nonce}` }
    if (digest(candidate) > incumbentDigest) return candidate
  }
  throw new Error("independent test oracle could not construct a winning replacement")
}

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
    const doc = empty()
    const before = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, op)).toBeDefined()
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    expect(appliedMap(doc).has(op.op_id)).toBe(false)
  })

  it("aborts the batch suffix after a rejected definition operation", () => {
    const doc = empty()
    const rejected = { ...define(), subgraph_id: "not-a-uuid" }
    const suffix = {
      op: "add_node", ...envelope(), node_id: 99, class_type: "Other", pos: [0, 0],
      node: { id: 99, type: "Other", inputs: [], outputs: [] },
    } as Op

    expect(applyOps(doc, [rejected, suffix], catalog).outcomes).toEqual([
      expect.objectContaining({ op_id: rejected.op_id, outcome: "rejected" }),
      expect.objectContaining({ op_id: suffix.op_id, outcome: "rejected", reason: expect.objectContaining({ code: "batch_aborted" }) }),
    ])
    expect(appliedMap(doc).has(rejected.op_id)).toBe(false)
    expect(appliedMap(doc).has(suffix.op_id)).toBe(false)
    expect(project(doc, catalog).nodes).toEqual([])
  })

  it.each([
    ["top-level", definition(catalogClassId)],
    ["nested", {
      ...definition(),
      definitions: { subgraphs: [definition(catalogClassId)] },
    }],
  ])("atomically rejects a %s definition id that shadows a UUID-shaped catalog class", (_name, collidingDefinition) => {
    const doc = empty()
    const before = Y.encodeStateAsUpdate(doc)
    const op = { ...define(), subgraph_definition: collidingDefinition, subgraph_id: String(collidingDefinition.id) }

    expect(applyOps(doc, [op], collisionCatalog).outcomes[0]?.outcome).toBe("rejected")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    expect(appliedMap(doc).has(op.op_id)).toBe(false)
  })

  it("accepts a distinct UUID definition while a catalog node retains its class meaning", () => {
    const doc = empty()
    const addCatalogNode = {
      op: "add_node", ...envelope(), node_id: 1, class_type: catalogClassId, pos: [0, 0],
      node: { id: 1, type: catalogClassId, inputs: [], outputs: [] },
    } as Op

    expect(applyOps(doc, [addCatalogNode, define()], collisionCatalog).outcomes.map(({ outcome }) => outcome)).toEqual(["applied", "applied"])
    expect(project(doc, collisionCatalog).nodes[0]?.type).toBe(catalogClassId)
    expect(definitionsMap(doc).has(subgraphId)).toBe(true)
    expect(definitionsMap(doc).has(catalogClassId)).toBe(false)
  })
})

describe("define_subgraph application", () => {
  it("digests accepted private metadata using the same public definition representation as fallback reads", () => {
    const doc = empty()
    const withPrivateMetadata = { ...definition(), __source: "private" }
    const op = { ...define(), subgraph_definition: withPrivateMetadata }

    expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).toBe("applied")
    const expected = createHash("sha256").update(JSON.stringify(definition(), (_key, child: unknown) =>
      child && typeof child === "object" && !Array.isArray(child)
        ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => compareText(a, b)))
        : child)).digest("hex")
    expect((metaMap(doc).get("__definition_digests") as Record<string, string>)[subgraphId]).toBe(expected)
  })

  it("matches the independently derived fixed definition digest and winner vector", () => {
    const seed = Y.encodeStateAsUpdate(empty())
    const winner = define(subgraphId, 1)
    const loser = define(subgraphId, 2)
    // Derived with Python 3 json.dumps(sort_keys=True,separators=(',',':'))
    // and hashlib.sha256, not the production canonicalizer or digest helper.
    // value=2 hashes to 1872feea7ddb573ff68e47b7be0c5b369863cfa2262f6d23d18ae15ecadb9e62.
    for (const ops of [[winner, loser], [loser, winner]]) {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, seed)
      applyOps(doc, ops, catalog)
      expect((project(doc, catalog).definitions as { subgraphs: unknown[] }).subgraphs).toEqual([definition()])
      expect((metaMap(doc).get("__definition_digests") as Record<string, string>)[subgraphId]).toBe(
        "3a0b0a3e10f67853f62d5b56ed2d505449cccd161cca63bfcbd3187d32523eb3",
      )
    }
  })
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

  it("does not revert an intervening interior edit when the definition is replayed with a new envelope", () => {
    const doc = empty()
    const op = define()
    applyOps(doc, [op], catalog)
    applyOps(doc, [
      { op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "10"], inner_widget: "value", widget: "value", value: 2 },
    ], catalog)
    const before = Y.encodeStateAsUpdate(doc)

    expect(applyOps(doc, [{ ...op, ...envelope() }], catalog).outcomes[0]?.outcome).toBe("no-op")
    expect(Y.encodeStateAsUpdate(doc)).not.toEqual(before) // the new op_id is consumed
    const projected = (project(doc, catalog).definitions as { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> }).subgraphs[0]!
    expect(projected.nodes[0]!.widgets_values).toEqual([2])
  })

  it("restores an occurrence-1 interior edit to the same occurrence after definition replacement", () => {
    const doc = empty()
    const incumbent = duplicateWidgetDefinition("old-first", "old-second")
    const replacement = winningReplacement(
      incumbent,
      duplicateWidgetDefinition("new-first", "new-second"),
    )
    const initial = { ...define(), subgraph_definition: incumbent }
    const redefine = { ...define(), subgraph_definition: replacement }
    const edit = {
      op: "set_widget",
      ...envelope(),
      node_id: 10,
      path: [subgraphId, "10"] as [string, ...string[]],
      inner_widget: "same",
      widget: "same",
      widget_occurrence: 1,
      value: "edited-second",
    } as const

    expect(applyOps(doc, [initial, edit, redefine], catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
      "applied",
      "applied",
      "applied",
    ])
    const projected = (project(doc, catalog).definitions as {
      subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }>
    }).subgraphs[0]!
    expect(projected.nodes[0]!.widgets_values).toEqual(["new-first", "edited-second"])
  })

  it("replays an identical definition imported without a private digest and continues the batch", () => {
    const imported = {
      nodes: [],
      links: [],
      definitions: { subgraphs: [definition()] },
    } as unknown as WorkflowJSON
    const doc = mint(imported, catalog)
    const storedDefinition = definitionsMap(doc).get(subgraphId)!
    const storedWidgets = (storedDefinition.get("nodes") as Y.Map<Y.Map<unknown>>).get("10")!.get("widgets")
    const before = project(doc, catalog)
    const replay = define()
    const suffix = {
      op: "add_node", ...envelope(), node_id: 99, class_type: "Other", pos: [0, 0],
      node: { id: 99, type: "Other", inputs: [], outputs: [] },
    } as Op

    expect(storedDefinition.get("__definition_digest")).toBeUndefined()
    expect(metaMap(doc).get("__definition_digests")).toBeUndefined()
    expect(applyOps(doc, [replay, suffix], catalog).outcomes).toEqual([
      { op_id: replay.op_id, outcome: "no-op" },
      { op_id: suffix.op_id, outcome: "applied" },
    ])
    expect(definitionsMap(doc).get(subgraphId)).toBe(storedDefinition)
    expect((storedDefinition.get("nodes") as Y.Map<Y.Map<unknown>>).get("10")!.get("widgets")).toBe(storedWidgets)
    expect((project(doc, catalog).definitions as unknown)).toEqual(before.definitions)
    expect(project(doc, catalog).nodes.map((node) => node.id)).toContain(99)
  })

  it("replays a projected-output definition imported without a private digest as an identity-preserving no-op", () => {
    const importedDefinition = {
      id: subgraphId,
      name: "One2",
      inputs: [],
      outputs: [],
      nodes: [{
        id: 10,
        type: "Inner",
        inputs: [],
        outputs: [{ name: "out", type: "X", links: [9, 3] }],
        widgets_values: [1],
      }],
      links: [],
    }
    const doc = mint({
      nodes: [],
      links: [],
      definitions: { subgraphs: [importedDefinition] },
    } as unknown as WorkflowJSON, catalog)
    const storedDefinition = definitionsMap(doc).get(subgraphId)!
    const storedNode = (storedDefinition.get("nodes") as Y.Map<Y.Map<unknown>>).get("10")!
    const replay = {
      ...define(),
      subgraph_definition: importedDefinition,
    } as DefineSubgraphOp

    expect(applyOps(doc, [replay], catalog).outcomes[0]?.outcome).toBe("no-op")
    expect(definitionsMap(doc).get(subgraphId)).toBe(storedDefinition)
    expect((storedDefinition.get("nodes") as Y.Map<Y.Map<unknown>>).get("10")).toBe(storedNode)
  })

  it("treats instance-ID and definition-ID widget paths as one LWW register", () => {
    const seeded = mint({
      nodes: [{ id: 1, type: subgraphId, inputs: [], outputs: [] }],
      links: [],
      definitions: { subgraphs: [definition()] },
    } as unknown as WorkflowJSON, catalog)
    const snapshot = Y.encodeStateAsUpdate(seeded)
    const lower = {
      op: "set_widget", op_id: "10000000000000000000000000000000", actor: "agent:low",
      base_version: 10, stamp: [10, "agent:low"], node_id: 10,
      path: [subgraphId, "10"], inner_widget: "value", widget: "value", value: "lower-definition-path",
    } as Op
    const higher = {
      op: "set_widget", op_id: "20000000000000000000000000000000", actor: "agent:high",
      base_version: 20, stamp: [20, "agent:high"], node_id: 10,
      path: ["1", "10"], inner_widget: "value", widget: "value", value: "higher-instance-path",
    } as Op

    const results = [[lower, higher], [higher, lower]].map((ops) => {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, snapshot)
      const outcomes = ops.flatMap((op) => applyOps(doc, [op], catalog).outcomes)
      expect(outcomes).toHaveLength(2)
      expect(outcomes.every(({ outcome }) => outcome === "applied" || outcome === "lww-dropped")).toBe(true)
      const projected = (project(doc, catalog).definitions as { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> }).subgraphs[0]!
      const beforeReplay = Y.encodeStateAsUpdate(doc)
      expect(ops.map((op) => applyOps(doc, [op], catalog).outcomes[0]?.outcome)).toEqual(["no-op", "no-op"])
      expect(Y.encodeStateAsUpdate(doc)).toEqual(beforeReplay)
      return { value: projected.nodes[0]!.widgets_values, stamps: [...stampsMap(doc).values()] }
    })

    expect(results.map(({ value }) => value)).toEqual([
      ["higher-instance-path"],
      ["higher-instance-path"],
    ])
    expect(results.map(({ stamps }) => stamps)).toEqual([[stampKey(higher)], [stampKey(higher)]])
  })

  it("retains an instance-routed canonical edit across concurrent deletion in both legal orders", () => {
    const instanceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    const seeded = mint({
      nodes: [{ id: instanceId, type: subgraphId, inputs: [], outputs: [] }],
      links: [],
      definitions: { subgraphs: [definition()] },
    } as unknown as WorkflowJSON, catalog)
    const snapshot = Y.encodeStateAsUpdate(seeded)
    const concurrent = (op: Partial<Op>, actor: string, opId: string) => ({
      ...op, op_id: opId, actor, base_version: 3, stamp: [3, actor],
    }) as Op
    const remove = concurrent(
      { op: "delete_node", node_id: instanceId, removed_links: [] },
      "human:delete",
      "d0000000000000000000000000000000",
    )
    const edit = concurrent(
      { op: "set_widget", node_id: 10, path: [instanceId, "10"], inner_widget: "value", widget: "value", value: 7 },
      "agent:edit",
      "e0000000000000000000000000000000",
    )
    const retainedRouteKey = JSON.stringify(["interior_route", instanceId, "0"])

    const results = [[remove, edit], [edit, remove]].map((ops) => {
      let doc = new Y.Doc()
      Y.applyUpdate(doc, snapshot)
      const outcomes = [applyOps(doc, [ops[0]!], catalog).outcomes[0]?.outcome]
      if (ops[0] === remove) {
        const replayed = new Y.Doc()
        Y.applyUpdate(replayed, Y.encodeStateAsUpdate(doc))
        doc = replayed
      }
      outcomes.push(applyOps(doc, [ops[1]!], catalog).outcomes[0]?.outcome)
      const projection = project(doc, catalog)
      const retainedValue = (projection.definitions as {
        subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }>
      }).subgraphs[0]!.nodes[0]!.widgets_values
      return { outcomes, projection, retainedValue, retainedRoute: stampsMap(doc).get(retainedRouteKey) }
    })

    expect(results.map(({ outcomes }) => outcomes)).toEqual([["applied", "applied"], ["applied", "applied"]])
    expect(results[0]!.projection).toEqual(results[1]!.projection)
    expect(results.map(({ retainedValue }) => retainedValue)).toEqual([[7], [7]])
    expect(results.every(({ projection }) => projection.nodes.length === 0)).toBe(true)
    expect(results.map(({ retainedRoute }) => retainedRoute)).toEqual([subgraphId, subgraphId])
  })

  it("shares the canonical register between a retained instance route and a direct definition path", () => {
    const instanceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    const doc = mint({
      nodes: [{ id: instanceId, type: subgraphId, inputs: [], outputs: [] }],
      links: [], definitions: { subgraphs: [definition()] },
    } as unknown as WorkflowJSON, catalog)
    const remove = { op: "delete_node", ...envelope(), node_id: instanceId, removed_links: [] } as Op
    expect(applyOps(doc, [remove], catalog).outcomes[0]?.outcome).toBe("applied")
    const routed = {
      op: "set_widget", op_id: "61000000000000000000000000000000", actor: "agent:route",
      base_version: 61, stamp: [61, "agent:route"], node_id: 10,
      path: [instanceId, "10"], inner_widget: "value", widget: "value", value: "route",
    } as Op
    const direct = {
      ...routed, op_id: "62000000000000000000000000000000", actor: "agent:direct",
      base_version: 62, stamp: [62, "agent:direct"], path: [subgraphId, "10"], value: "direct",
    } as Op

    expect(applyOps(doc, [routed, direct], catalog).outcomes.map(({ outcome }) => outcome)).toEqual(["applied", "applied"])
    const retained = (project(doc, catalog).definitions as {
      subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }>
    }).subgraphs[0]!.nodes[0]!.widgets_values
    expect(retained).toEqual(["direct"])
  })

  it("does not let an unrelated deletion or a delete/re-add retarget a retained route", () => {
    const instanceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    const unrelatedId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    const doc = mint({
      nodes: [
        { id: instanceId, type: subgraphId, inputs: [], outputs: [] },
        { id: unrelatedId, type: "Other", inputs: [], outputs: [] },
      ],
      links: [], definitions: { subgraphs: [definition()] },
    } as unknown as WorkflowJSON, catalog)
    expect(applyOps(doc, [{ op: "delete_node", ...envelope(), node_id: unrelatedId, removed_links: [] } as Op], catalog).outcomes[0]?.outcome).toBe("applied")
    const edit = {
      op: "set_widget", ...envelope(), node_id: 10, path: [instanceId, "10"],
      inner_widget: "value", widget: "value", value: 8,
    } as Op
    expect(applyOps(doc, [edit], catalog).outcomes[0]?.outcome).toBe("applied")

    expect(applyOps(doc, [{ op: "delete_node", ...envelope(), node_id: instanceId, removed_links: [] } as Op], catalog).outcomes[0]?.outcome).toBe("applied")
    const readd = {
      op: "add_node", ...envelope(), node_id: instanceId, node_incarnation: "replacement",
      class_type: "Other", pos: [0, 0], node: { id: instanceId, type: "Other", inputs: [], outputs: [] },
    } as Op
    expect(applyOps(doc, [readd], catalog).outcomes[0]?.outcome).toBe("applied")
    const stale = { ...edit, ...envelope(), value: 9 } as Op
    expect(applyOps(doc, [stale], catalog).outcomes[0]?.outcome).toBe("rejected")
    const retained = (project(doc, catalog).definitions as {
      subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }>
    }).subgraphs[0]!.nodes[0]!.widgets_values
    expect(retained).toEqual([8])
  })

  it("uses the final owning definition and node as nested alias identity without conflating equal leaf IDs", () => {
    const innerId = "22345678-1234-4123-8123-123456789abc"
    const nestedWorkflow = {
      nodes: [{ id: 1, type: subgraphId, inputs: [], outputs: [] }],
      links: [],
      definitions: { subgraphs: [
        {
          id: subgraphId, name: "Outer", inputs: [], outputs: [], links: [],
          nodes: [
            { id: 10, type: "Inner", inputs: [], outputs: [], widgets_values: ["outer-leaf"] },
            { id: 20, type: innerId, inputs: [], outputs: [] },
          ],
        },
        {
          id: innerId, name: "Nested", inputs: [], outputs: [], links: [],
          nodes: [{ id: 10, type: "Inner", inputs: [], outputs: [], widgets_values: ["nested-leaf"] }],
        },
      ] },
    } as unknown as WorkflowJSON
    const snapshot = Y.encodeStateAsUpdate(mint(nestedWorkflow, catalog))
    const lower = {
      op: "set_widget", op_id: "30000000000000000000000000000000", actor: "agent:low",
      base_version: 30, stamp: [30, "agent:low"], node_id: 10,
      path: [subgraphId, "20", "10"], inner_widget: "value", widget: "value", value: "lower-outer-history",
    } as Op
    const higher = {
      op: "set_widget", op_id: "40000000000000000000000000000000", actor: "agent:high",
      base_version: 40, stamp: [40, "agent:high"], node_id: 10,
      path: [innerId, "10"], inner_widget: "value", widget: "value", value: "higher-final-owner",
    } as Op

    for (const ops of [[lower, higher], [higher, lower]]) {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, snapshot)
      const outcomes = ops.map((op) => applyOps(doc, [op], catalog).outcomes[0]?.outcome)
      expect(outcomes.every((outcome) => outcome === "applied" || outcome === "lww-dropped")).toBe(true)
      const definitions = (project(doc, catalog).definitions as {
        subgraphs: Array<{ id: string; nodes: Array<{ id: unknown; widgets_values?: unknown[] }> }>
      }).subgraphs
      const inner = definitions.find(({ id }) => id === innerId)!
      const outer = definitions.find(({ id }) => id === subgraphId)!
      expect(inner.nodes.find(({ id }) => id === 10)!.widgets_values).toEqual(["higher-final-owner"])
      expect(outer.nodes.find(({ id }) => id === 10)!.widgets_values).toEqual(["outer-leaf"])
      expect([...stampsMap(doc).values()]).toEqual([stampKey(higher)])
    }

    const isolated = new Y.Doc()
    Y.applyUpdate(isolated, snapshot)
    const outerLeaf = {
      ...lower, op_id: "50000000000000000000000000000000", base_version: 50,
      stamp: [50, "agent:low"], path: [subgraphId, "10"], value: "changed-outer-leaf",
    } as Op
    expect(applyOps(isolated, [higher, outerLeaf], catalog).outcomes.map(({ outcome }) => outcome)).toEqual(["applied", "applied"])
    expect(stampsMap(isolated).size).toBe(2)
  })

  it("converges when a definition replay and an interior edit arrive in either legal order", () => {
    const seed = empty()
    const original = define()
    applyOps(seed, [original], catalog)
    const snapshot = Y.encodeStateAsUpdate(seed)
    const replay = { ...original, ...envelope() }
    const edit = {
      op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "10"], inner_widget: "value", widget: "value", value: 7,
    } as Op

    const projections = [[replay, edit], [edit, replay]].map((ops) => {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, snapshot)
      for (const op of ops) applyOps(doc, [op], catalog)
      return project(doc, catalog)
    })

    expect(projections[0]).toEqual(projections[1])
    expect((projections[0]!.definitions as { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> }).subgraphs[0]!.nodes[0]!.widgets_values).toEqual([7])
  })

  it("consumes a losing definition conflict without changing the winner", () => {
    const doc = empty()
    applyOps(doc, [define()], catalog)
    expect(applyOps(doc, [define(subgraphId, 2)], catalog).outcomes[0]?.outcome).toBe("no-op")
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

  it("preserves edits to the deterministic winner and consumes the same conflict in either legal order", () => {
    const a = define(subgraphId, 1)
    const b = define(subgraphId, 2)
    const edit = {
      op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "10"], inner_widget: "value", widget: "value", value: 9,
    } as Op

    const results = [[a, edit, b], [b, edit, a]].map((ops) => {
      const doc = empty()
      const outcomes = ops.map((op) => applyOps(doc, [op], catalog).outcomes[0])
      return { outcomes, projection: project(doc, catalog) }
    })

    expect(results[0]!.projection).toEqual(results[1]!.projection)
    expect(results[0]!.outcomes.find((outcome) => outcome?.outcome === "no-op")?.op_id).toBe(b.op_id)
    const projected = (results[0]!.projection.definitions as { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> }).subgraphs[0]!
    expect(projected.nodes[0]!.widgets_values).toEqual([9])
  })

  it("preserves nested widget edits across a digest-winning replacement in either legal order", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const incumbent = {
      ...definition(),
      nodes: [{ id: 20, type: nestedId, inputs: [], outputs: [], widgets_values: [] }],
      definitions: { subgraphs: [definition(nestedId, 1)] },
    }
    const replacement = winningReplacement(incumbent, {
      ...incumbent,
      definitions: { subgraphs: [definition(nestedId, 2)] },
    })
    const first = { ...define(), subgraph_definition: incumbent }
    const second = { ...define(), subgraph_definition: replacement }
    const edit = {
      op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "20", "10"], inner_widget: "value", widget: "value", value: 80,
    } as Op

    const projections = [[first, edit, second], [second, edit, first]].map((ops) => {
      const doc = empty()
      for (const op of ops) applyOps(doc, [op], catalog)
      return project(doc, catalog)
    })

    expect(projections[0]).toEqual(projections[1])
    const projected = (projections[0]!.definitions as { subgraphs: Array<{ definitions: { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> } }> }).subgraphs[0]!
    expect(projected.definitions.subgraphs[0]!.nodes[0]!.widgets_values).toEqual([80])
  })

  it("restores an instance-ID-addressed widget edit across a digest-winning replacement in both legal orders", () => {
    const incumbent = definition(subgraphId, 2)
    const replacement = winningReplacement(incumbent, definition(subgraphId, 4))
    const incumbentOp = { ...define(), subgraph_definition: incumbent }
    const replacementOp = { ...define(), subgraph_definition: replacement }
    const edit = {
      op: "set_widget", ...envelope(), node_id: 10, path: ["1", "10"],
      inner_widget: "value", widget: "value", value: 9,
    } as Op

    const projections = [[incumbentOp, edit, replacementOp], [replacementOp, edit, incumbentOp]].map((ops) => {
      const doc = mint({
        nodes: [{ id: 1, type: subgraphId, inputs: [], outputs: [] }],
        links: [],
      } as unknown as WorkflowJSON, catalog)
      for (const op of ops) applyOps(doc, [op], catalog)
      return project(doc, catalog)
    })

    expect(projections[0]).toEqual(projections[1])
    const projected = (projections[0]!.definitions as { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> }).subgraphs[0]!
    expect(projected.nodes[0]!.widgets_values).toEqual([9])
  })

  it.each([
    ["number", 7],
    ["object", { forged: "digest" }],
  ])("narrows a malformed replicated %s definition digest before deterministic comparison", (_kind, malformedDigest) => {
    const results = [[1, 2], [2, 1]].map(([firstValue, secondValue]) => {
      const doc = empty()
      applyOps(doc, [define(subgraphId, firstValue)], catalog)
      metaMap(doc).set("__definition_digests", { [subgraphId]: malformedDigest })

      let outcome: string | undefined
      expect(() => {
        outcome = applyOps(doc, [define(subgraphId, secondValue)], catalog).outcomes[0]?.outcome
      }).not.toThrow()
      return {
        outcome,
        projection: project(doc, catalog),
        digest: (metaMap(doc).get("__definition_digests") as Record<string, unknown>)[subgraphId],
      }
    })

    expect(results[0]!.projection).toEqual(results[1]!.projection)
    expect((results[0]!.projection.definitions as { subgraphs: unknown[] }).subgraphs).toEqual([definition(subgraphId, 1)])
    expect(results.map(({ outcome }) => outcome)).toEqual(["no-op", "applied"])
    expect(typeof results[1]!.digest).toBe("string")
  })

  it("rejects an edit to a node that exists only in the replaced definition", () => {
    const first = {
      ...definition(subgraphId, 2),
      nodes: [{ id: 11, type: "Inner", inputs: [], outputs: [], widgets_values: [2] }],
    }
    const second = {
      ...definition(subgraphId, 1),
      nodes: [{ id: 12, type: "Inner", inputs: [], outputs: [], widgets_values: [1] }],
    }
    const doc = empty()
    applyOps(doc, [{ ...define(subgraphId, 2), subgraph_definition: first }], catalog)
    applyOps(doc, [{ ...define(subgraphId, 1), subgraph_definition: second }], catalog)
    const winnerNodes = (project(doc, catalog).definitions as { subgraphs: Array<{ nodes: Array<{ id: number }> }> }).subgraphs[0]!.nodes
    const losingNodeId = winnerNodes[0]!.id === 11 ? 12 : 11

    const outcome = applyOps(doc, [{
      op: "set_widget", ...envelope(), node_id: losingNodeId, path: [subgraphId, String(losingNodeId)], inner_widget: "value", widget: "value", value: 9,
    }], catalog).outcomes[0]

    expect(outcome?.outcome).toBe("rejected")
    expect(outcome?.outcome === "rejected" ? outcome.reason.code : undefined).toBe("interior_node_not_found")
  })

  it("keeps applying a batch suffix after the deterministic conflict loser", () => {
    const a = define(subgraphId, 1)
    const b = define(subgraphId, 2)
    const suffix = { op: "add_node", ...envelope(), node_id: 99, class_type: "Other", pos: [0, 0], node: { id: 99, type: "Other", inputs: [], outputs: [] } } as Op
    const projections = [[a, b], [b, a]].map((ops) => {
      const doc = empty()
      applyOps(doc, [ops[0]!, ops[1]!, suffix], catalog)
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

  it("projects only the valid nested definition beside a malformed scalar child", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const malformedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    const nested = definition(nestedId, 4)
    const outer = { ...definition(), definitions: { subgraphs: [nested] } }
    const doc = empty()
    applyOps(doc, [{ ...define(), subgraph_definition: outer }], catalog)
    const storedOuter = definitionsMap(doc).get(subgraphId)!
    const storedDefinitions = storedOuter.get("definitions") as Y.Map<unknown>
    const storedSubgraphs = storedDefinitions.get("subgraphs") as Y.Map<unknown>
    storedSubgraphs.set(malformedId, "malformed replicated child")
    storedDefinitions.set("subgraph_order", [malformedId, nestedId])

    const projected = (project(doc, catalog).definitions as {
      subgraphs: Array<{ definitions: { subgraphs: unknown[] } }>
    }).subgraphs[0]!
    expect(projected.definitions.subgraphs).toEqual([nested])
  })

  it("rejects fresh reuse of an identical nested definition id while exact replay stays idempotent", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const nested = definition(nestedId, 4)
    const outer = { ...definition(), definitions: { subgraphs: [nested] } }
    const op = { ...define(), subgraph_definition: outer }
    const doc = empty()

    expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).toBe("applied")
    const afterCreate = Y.encodeStateAsUpdate(doc)
    expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).toBe("no-op")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(afterCreate)

    const freshReuse = { ...define(nestedId, 4), subgraph_definition: nested }
    expect(rejectionCode(doc, freshReuse)).toBe("definition_conflict")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(afterCreate)
    expect((project(doc, catalog).definitions as { subgraphs: unknown[] }).subgraphs).toEqual([outer])
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

  it("rejects a new root definition whose id collides with an existing nested definition", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const doc = empty()
    applyOps(doc, [{ ...define(), subgraph_definition: {
      ...definition(), definitions: { subgraphs: [definition(nestedId, 4)] },
    } }], catalog)

    const differing = define(nestedId, 9)
    const beforeDiffering = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, differing)).toBe("definition_conflict")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(beforeDiffering)
    expect(appliedMap(doc).has(differing.op_id)).toBe(false)

    const identical = define(nestedId, 4)
    const beforeIdentical = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, identical)).toBe("definition_conflict")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(beforeIdentical)
    expect(appliedMap(doc).has(identical.op_id)).toBe(false)
  })

  it("rejects a nested definition whose id collides with an existing root definition", () => {
    const newRootId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const doc = empty()
    applyOps(doc, [define()], catalog)
    const colliding = {
      ...definition(newRootId), definitions: { subgraphs: [definition(subgraphId, 9)] },
    }

    const rejected = { ...define(newRootId), subgraph_definition: colliding }
    const before = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, rejected)).toBe("definition_conflict")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    expect(appliedMap(doc).has(rejected.op_id)).toBe(false)
  })

  it("rejects a winning replacement whose nested id collides with another root and preserves the incumbent", () => {
    const otherRootId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const incumbent = definition()
    const replacement = winningReplacement(incumbent, {
      ...definition(), definitions: { subgraphs: [definition(otherRootId, 9)] },
    })
    const doc = empty()
    applyOps(doc, [define(), define(otherRootId, 4)], catalog)

    const rejected = { ...define(), subgraph_definition: replacement }
    const before = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, rejected)).toBe("definition_conflict")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    expect(appliedMap(doc).has(rejected.op_id)).toBe(false)
    expect((project(doc, catalog).definitions as { subgraphs: unknown[] }).subgraphs).toEqual([
      incumbent,
      definition(otherRootId, 4),
    ])
  })

  it.each(["ancestor", "sibling"])("rejects a winning replacement whose nested id collides with an %s branch", (collision) => {
    const branchId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const siblingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const incumbent = definition()
    const otherRootId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    const otherRoot = { ...definition(otherRootId), definitions: { subgraphs: [
      { ...definition(branchId, 2), definitions: { subgraphs: [definition(siblingId, 3)] } },
    ] } }
    const collidingId = collision === "ancestor" ? branchId : siblingId
    const replacement = winningReplacement(incumbent, {
      ...definition(), definitions: { subgraphs: [definition(collidingId, 6)] },
    })
    const doc = empty()
    applyOps(doc, [
      { ...define(), subgraph_definition: incumbent },
      { ...define(otherRootId), subgraph_definition: otherRoot },
    ], catalog)

    const rejected = { ...define(), subgraph_definition: replacement }
    const before = Y.encodeStateAsUpdate(doc)
    expect(rejectionCode(doc, rejected)).toBe("definition_conflict")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
    expect(appliedMap(doc).has(rejected.op_id)).toBe(false)
    expect((project(doc, catalog).definitions as { subgraphs: unknown[] }).subgraphs).toEqual([incumbent, otherRoot])
  })

  it("accepts a winning replacement that reuses only ids owned by the incumbent", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const incumbent = { ...definition(), definitions: { subgraphs: [definition(nestedId, 2)] } }
    const replacement = winningReplacement(incumbent, {
      ...definition(), nodes: [{ id: 11, type: "Inner", inputs: [], outputs: [], widgets_values: [7] }],
      definitions: { subgraphs: [definition(nestedId, 8)] },
    })
    const doc = empty()
    applyOps(doc, [{ ...define(), subgraph_definition: incumbent }], catalog)

    expect(applyOps(doc, [{ ...define(), subgraph_definition: replacement }], catalog).outcomes[0]?.outcome).toBe("applied")
    expect((project(doc, catalog).definitions as { subgraphs: unknown[] }).subgraphs).toEqual([replacement])
  })

  it("projects a rejected colliding winner identically in both op orders", () => {
    const otherRootId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const incumbent = definition()
    const replacement = winningReplacement(incumbent, {
      ...definition(), definitions: { subgraphs: [definition(otherRootId, 9)] },
    })
    const incumbentOp = define()
    const replacementOp = { ...define(), subgraph_definition: replacement }
    const seed = empty()
    applyOps(seed, [define(otherRootId, 4)], catalog)
    const snapshot = Y.encodeStateAsUpdate(seed)

    const projections = [[incumbentOp, replacementOp], [replacementOp, incumbentOp]].map((ops) => {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, snapshot)
      for (const op of ops) applyOps(doc, [op], catalog)
      return project(doc, catalog)
    })

    expect(projections[0]).toEqual(projections[1])
    const projected = (projections[0]!.definitions as { subgraphs: Array<{ id: string }> }).subgraphs
    expect(projected.find(({ id }) => id === subgraphId)).toEqual(incumbent)
    expect(projected.find(({ id }) => id === otherRootId)).toEqual(definition(otherRootId, 4))
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

  it("does not treat a name shared by a root and nested definition as an instance alias", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const root = {
      ...definition(), name: "Shared",
      definitions: { subgraphs: [{ ...definition(nestedId), name: "Shared" }] },
    }
    const doc = mint({
      nodes: [
        { id: 1, type: subgraphId, inputs: [], outputs: [] },
        { id: 2, type: "Shared", inputs: [], outputs: [] },
      ],
      links: [], definitions: { subgraphs: [root] },
    } as unknown as WorkflowJSON, catalog)
    const edit = {
      op: "set_widget", ...envelope(), node_id: 10, path: [subgraphId, "10"],
      inner_widget: "value", widget: "value", value: 9,
    } as Op

    expect(applyOps(doc, [edit], catalog).outcomes[0]?.outcome).toBe("applied")
  })

  it("rejects an edit when instances occur recursively three definition levels down", () => {
    const middleId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const leafId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const leaf = definition(leafId, 3)
    const middle = {
      ...definition(middleId),
      nodes: [
        { id: 21, type: leafId, inputs: [], outputs: [], widgets_values: [] },
        { id: 22, type: leafId, inputs: [], outputs: [], widgets_values: [] },
      ],
      definitions: { subgraphs: [leaf] },
    }
    const outer = { ...definition(), definitions: { subgraphs: [middle] } }
    const doc = empty()
    applyOps(doc, [{ ...define(), subgraph_definition: outer }], catalog)
    const before = Y.encodeStateAsUpdate(doc)

    expect(rejectionCode(doc, {
      op: "set_widget", ...envelope(), node_id: 10, path: [leafId, "10"],
      inner_widget: "value", widget: "value", value: 9,
    })).toBe("shared_definition_unforked")
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
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

  it("never projects arbitrary private definition keys at any depth", () => {
    const nestedId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const doc = empty()
    const privateDefinition = {
      ...definition(),
      __other: "root-secret",
      definitions: {
        subgraphs: [{ ...definition(nestedId), __private_marker: { nested: "secret" } }],
      },
    }

    expect(applyOps(doc, [{ ...define(), subgraph_definition: privateDefinition }], catalog).outcomes[0]?.outcome).toBe("applied")
    const serialized = JSON.stringify(project(doc, catalog))
    expect(serialized).not.toContain("__other")
    expect(serialized).not.toContain("__private_marker")
    expect(serialized).not.toContain("secret")
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
