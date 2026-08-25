import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { LLink } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import type { RerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'

/**
 * Characterisation baseline for QA-1 / invariant I2: undo after a *compound*
 * edit.
 *
 * Links, reroutes, widget values and positions each already have their own
 * tests. Nothing asserts that they still agree with one another after a single
 * transaction spanning all of them. That is what this file pins down, so that a
 * change which makes two of them disagree fails here rather than in a user
 * report.
 *
 * ## Why this does not drive `ChangeTracker`
 *
 * Real undo lives in `src/scripts/changeTracker.ts` and is app-layer: it keeps
 * a 50-deep queue of `app.rootGraph.serialize()` snapshots and restores one by
 * calling `app.loadGraphData(prevState, ...)`, which bottoms out in
 * `this.rootGraph.configure(graphData)` — on the *same* LGraph instance.
 * Reaching `ChangeTracker` from a unit test means mocking `app`, `api`, the
 * workflow store and the node-output store, at which point `loadGraphData` is a
 * stub and no graph behaviour is under test at all (see
 * `src/scripts/changeTracker.test.ts`, where `loadGraphData` is
 * `vi.fn(() => Promise.resolve())`).
 *
 * So these tests drive the layer underneath, unmocked: snapshot with
 * `serialize()`, mutate, restore with `configure()` on the same graph object.
 * That is precisely the pair of calls `ChangeTracker` makes, and it is the same
 * invariant one layer down. What it deliberately does *not* cover is the
 * app-layer orchestration around those calls — canvas view state, subgraph
 * navigation, node outputs. Those need a browser-level test.
 *
 * These assertions describe what `main` does **today**. They are a baseline,
 * not a specification: where current behaviour looks questionable it is
 * asserted as-is and called out in a comment.
 */

const NODE_TYPE = 'test/compound-undo'

/** A node with an input, an output and two serialised widgets. */
class CompoundNode extends LGraphNode {
  static override title = 'CompoundUndoNode'

  constructor() {
    super('CompoundUndoNode')
    this.serialize_widgets = true
    this.addInput('in', 'NUMBER')
    this.addOutput('out', 'NUMBER')
    this.addWidget('number', 'steps', 20, () => {}, {})
    this.addWidget('text', 'prompt', 'default prompt', () => {}, {})
  }
}

interface CompoundGraph {
  graph: LGraph
  sourceId: NodeId
  /** The node under test: links in and out, a reroute, widgets, geometry. */
  middleId: NodeId
  sinkId: NodeId
  /** Link Source.out[0] -> Middle.in[0]; the one carrying the reroute. */
  inboundLinkId: LinkId
  /** Link Middle.out[0] -> Sink.in[0]. */
  outboundLinkId: LinkId
  rerouteId: RerouteId
}

const MIDDLE_POS: [number, number] = [321, 654]
const MIDDLE_SIZE: [number, number] = [270, 130]
const REROUTE_POS: [number, number] = [180, 240]
const STEPS_VALUE = 37
const PROMPT_VALUE = 'a very specific prompt'

function addNode(graph: LGraph, pos: [number, number]): LGraphNode {
  const node = LiteGraph.createNode(NODE_TYPE)!
  node.pos = pos
  graph.add(node)
  return node
}

/**
 * Source -> Middle -> Sink, where `Middle` simultaneously has an inbound link,
 * an outbound link, a reroute on the inbound link, two non-default widget
 * values, and a non-default position and size.
 */
function buildCompoundGraph(): CompoundGraph {
  const graph = new LGraph()
  // A workflow always carries a real id. `configure` promotes the zero UUID of
  // a bare `new LGraph()` to a fresh one, which would make graph identity move
  // on the first restore for reasons unrelated to the edit under test.
  graph.id = createUuidv4()

  const source = addNode(graph, [0, 0])
  const middle = addNode(graph, [...MIDDLE_POS])
  const sink = addNode(graph, [800, 0])

  middle.size = [...MIDDLE_SIZE]

  const inbound = source.connect(0, middle, 0)!
  const outbound = middle.connect(0, sink, 0)!

  const reroute = graph.createReroute([...REROUTE_POS], inbound)!

  middle.widgets![0].value = STEPS_VALUE
  middle.widgets![1].value = PROMPT_VALUE

  return {
    graph,
    sourceId: source.id,
    middleId: middle.id,
    sinkId: sink.id,
    inboundLinkId: inbound.id,
    outboundLinkId: outbound.id,
    rerouteId: reroute.id
  }
}

/** What `ChangeTracker.captureCanvasState` pushes onto the undo queue. */
function snapshot(graph: LGraph): ISerialisedGraph {
  return JSON.parse(JSON.stringify(graph.serialize())) as ISerialisedGraph
}

/** What `ChangeTracker.updateState` does with a popped snapshot. */
function restore(graph: LGraph, state: ISerialisedGraph): void {
  graph.configure(JSON.parse(JSON.stringify(state)) as ISerialisedGraph)
}

/** Describes a link by the endpoints a user cares about, not by its id. */
function endpoints(link: LLink | undefined) {
  if (!link) return undefined
  return {
    origin_id: link.origin_id,
    origin_slot: link.origin_slot,
    target_id: link.target_id,
    target_slot: link.target_slot
  }
}

function linkInto(
  graph: LGraph,
  targetId: NodeId,
  targetSlot: number
): LLink | undefined {
  return [...graph.links.values()].find(
    (link) => link.target_id === targetId && link.target_slot === targetSlot
  )
}

function serialisedReroutes(state: ISerialisedGraph) {
  return state.extra?.reroutes ?? []
}

describe('compound undo', () => {
  beforeEach(() => {
    LiteGraph.registerNodeType(NODE_TYPE, CompoundNode)
    vi.spyOn(LiteGraph, 'isValidConnection').mockReturnValue(true)
  })

  afterEach(() => {
    LiteGraph.unregisterNodeType(NODE_TYPE)
  })

  describe('removing a node that links, reroutes, widgets and geometry all depend on', () => {
    test('the edit tears every concern down in one transaction', () => {
      const { graph, middleId, inboundLinkId, outboundLinkId, rerouteId } =
        buildCompoundGraph()

      expect(graph.nodes.length).toBe(3)
      expect(graph.links.size).toBe(2)
      expect(graph.reroutes.size).toBe(1)

      graph.remove(graph.getNodeById(middleId)!)

      // Shared precondition for everything below: one call removed the node and
      // both of its links.
      expect(graph.getNodeById(middleId)).toBeFalsy()
      expect(graph.links.get(inboundLinkId)).toBeUndefined()
      expect(graph.links.get(outboundLinkId)).toBeUndefined()

      // The reroute is *not* removed with the link it was on. It stays in the
      // graph, and the floating-link id it holds resolves to a real registered
      // floating link — the store migration made the preserved reroute chain
      // authoritative instead of leaving a dangling id (see ADR-0003).
      const orphan = graph.reroutes.get(rerouteId)!
      expect(orphan).toBeDefined()
      expect([...orphan.linkIds]).toEqual([])
      expect([...orphan.floatingLinkIds].length).toBe(1)
      expect(graph.floatingLinks.size).toBe(1)
    })

    test('undo restores the node with its own id, position and size', () => {
      const { graph, middleId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      graph.remove(graph.getNodeById(middleId)!)
      restore(graph, undoState)

      const restored = graph.getNodeById(middleId)
      expect(restored).toBeDefined()
      expect(restored!.type).toBe(NODE_TYPE)
      expect([...restored!.pos]).toEqual(MIDDLE_POS)
      expect([...restored!.size]).toEqual(MIDDLE_SIZE)
      expect(graph.nodes.length).toBe(3)
    })

    test('undo reconnects both links to the same slots on the same nodes', () => {
      const { graph, sourceId, middleId, sinkId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      graph.remove(graph.getNodeById(middleId)!)
      restore(graph, undoState)

      // The relationship, not the count: same origin node, same origin slot,
      // same target node, same target slot.
      expect(endpoints(linkInto(graph, middleId, 0))).toEqual({
        origin_id: sourceId,
        origin_slot: 0,
        target_id: middleId,
        target_slot: 0
      })
      expect(endpoints(linkInto(graph, sinkId, 0))).toEqual({
        origin_id: middleId,
        origin_slot: 0,
        target_id: sinkId,
        target_slot: 0
      })
      expect(graph.links.size).toBe(2)
      expect(graph.floatingLinks.size).toBe(0)

      // The node's own slot bookkeeping agrees with the link table.
      const middle = graph.getNodeById(middleId)!
      expect(middle.inputs[0].link).toBe(linkInto(graph, middleId, 0)!.id)
      expect(middle.outputs[0].links).toEqual([linkInto(graph, sinkId, 0)!.id])
    })

    test('undo puts the reroute back on the inbound link, not merely back in the graph', () => {
      const { graph, middleId, rerouteId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      graph.remove(graph.getNodeById(middleId)!)
      restore(graph, undoState)

      const reroute = graph.reroutes.get(rerouteId)
      expect(reroute).toBeDefined()
      expect([...reroute!.pos]).toEqual(REROUTE_POS)
      expect(reroute!.parentId).toBeUndefined()

      // Both directions of the relationship: the reroute claims the inbound
      // link, and the inbound link routes through the reroute.
      const inbound = linkInto(graph, middleId, 0)!
      expect([...reroute!.linkIds]).toEqual([inbound.id])
      expect(inbound.parentId).toBe(rerouteId)
      expect(reroute!.floating).toBeUndefined()
      expect([...reroute!.floatingLinkIds]).toEqual([])
      expect(graph.reroutes.size).toBe(1)
    })

    test('undo restores widget values, matched by widget name', () => {
      const { graph, middleId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      graph.remove(graph.getNodeById(middleId)!)
      restore(graph, undoState)

      const widgets = graph.getNodeById(middleId)!.widgets!
      expect(
        Object.fromEntries(widgets.map((widget) => [widget.name, widget.value]))
      ).toEqual({ steps: STEPS_VALUE, prompt: PROMPT_VALUE })
    })

    test('undo produces a serialisation deeply equal to the pre-edit one', () => {
      const { graph, middleId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      graph.remove(graph.getNodeById(middleId)!)
      restore(graph, undoState)

      // The strongest available form of "everything came back": every concern
      // at once, including graph id, node order, link ids, reroute ids and the
      // `extra.linkExtensions` parent mapping. Compared structurally rather
      // than as bytes only because `extra` key order is not stable.
      expect(snapshot(graph)).toEqual(undoState)
    })
  })

  describe('redo of the removal', () => {
    test('redo reapplies the removal: node, links and slot references all go', () => {
      const { graph, middleId, sinkId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      graph.remove(graph.getNodeById(middleId)!)
      const redoState = snapshot(graph)

      restore(graph, undoState)
      expect(graph.getNodeById(middleId)).toBeDefined()

      restore(graph, redoState)

      expect(graph.getNodeById(middleId)).toBeFalsy()
      expect(graph.nodes.length).toBe(2)
      expect(linkInto(graph, middleId, 0)).toBeUndefined()
      expect(linkInto(graph, sinkId, 0)).toBeUndefined()
      expect(graph.links.size).toBe(0)
      // The preserved reroute chain's floating link is serialised and restored
      // with the snapshot, so redo reproduces the post-delete state exactly.
      expect(graph.floatingLinks.size).toBe(1)
      expect(graph.getNodeById(sinkId)!.inputs[0].link).toBeNull()
    })

    test('redo preserves the floating reroute that the in-memory removal kept', () => {
      const { graph, middleId, rerouteId } = buildCompoundGraph()

      graph.remove(graph.getNodeById(middleId)!)
      const redoState = snapshot(graph)

      // The post-removal snapshot still carries the orphan, with no links.
      expect(
        serialisedReroutes(redoState).map((reroute) => reroute.id)
      ).toEqual([rerouteId])

      restore(graph, redoState)

      // The snapshot carries the floating link alongside the reroute, so the
      // reroute survives validation on reload: redo and the original delete
      // now leave the same graph. (The dedicated stores made the preserved
      // chain a real floating link where it used to be a dangling id that
      // reload validation discarded; see ADR-0003.)
      expect(graph.reroutes.size).toBe(1)
      expect(
        serialisedReroutes(snapshot(graph)).map((reroute) => reroute.id)
      ).toEqual([rerouteId])
    })

    test('a redone state is stable under a further redo of itself', () => {
      const { graph, middleId } = buildCompoundGraph()

      graph.remove(graph.getNodeById(middleId)!)
      restore(graph, snapshot(graph))

      // Once the orphan has been dropped, re-applying the state is a fixed
      // point — the loss above happens once, not on every redo.
      const settled = snapshot(graph)
      restore(graph, settled)
      expect(snapshot(graph)).toEqual(settled)
    })

    test('undo after redo returns to the restored state, not a third state', () => {
      const { graph, middleId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      graph.remove(graph.getNodeById(middleId)!)
      const redoState = snapshot(graph)

      restore(graph, undoState)
      restore(graph, redoState)
      restore(graph, undoState)

      const reroute = [...graph.reroutes.values()][0]
      const inbound = linkInto(graph, middleId, 0)!
      expect(graph.getNodeById(middleId)!.widgets![0].value).toBe(STEPS_VALUE)
      expect(inbound.parentId).toBe(reroute.id)
      expect([...reroute.linkIds]).toEqual([inbound.id])
      expect(snapshot(graph)).toEqual(undoState)
    })
  })

  describe('replacing a node, reusing its id', () => {
    /**
     * The second QA-1 variant. Reusing the id means undo cannot detect the edit
     * by the id being absent.
     */
    function replaceMiddle(graph: LGraph, middleId: NodeId): LGraphNode {
      graph.remove(graph.getNodeById(middleId)!)

      const replacement = LiteGraph.createNode(NODE_TYPE)!
      replacement.id = middleId
      replacement.pos = [10, 10]
      graph.add(replacement)
      replacement.widgets![0].value = 1
      replacement.widgets![1].value = 'replacement prompt'
      return replacement
    }

    test('undo restores the original widget values and geometry over the replacement', () => {
      const { graph, middleId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      const replacement = replaceMiddle(graph, middleId)
      expect(replacement.widgets![0].value).toBe(1)

      restore(graph, undoState)

      const restored = graph.getNodeById(middleId)!
      expect(restored.widgets![0].value).toBe(STEPS_VALUE)
      expect(restored.widgets![1].value).toBe(PROMPT_VALUE)
      expect([...restored.pos]).toEqual(MIDDLE_POS)
      expect([...restored.size]).toEqual(MIDDLE_SIZE)
    })

    test('undo rewires links and the reroute around a replaced node', () => {
      const { graph, sourceId, middleId, sinkId, rerouteId } =
        buildCompoundGraph()
      const undoState = snapshot(graph)

      replaceMiddle(graph, middleId)
      // Reusing the id does not re-adopt the old links; the replacement is
      // unwired, which is what undo has to repair.
      expect(linkInto(graph, middleId, 0)).toBeUndefined()
      expect(linkInto(graph, sinkId, 0)).toBeUndefined()

      restore(graph, undoState)

      const inbound = linkInto(graph, middleId, 0)!
      expect(endpoints(inbound)).toEqual({
        origin_id: sourceId,
        origin_slot: 0,
        target_id: middleId,
        target_slot: 0
      })
      expect(endpoints(linkInto(graph, sinkId, 0))).toEqual({
        origin_id: middleId,
        origin_slot: 0,
        target_id: sinkId,
        target_slot: 0
      })

      const reroute = graph.reroutes.get(rerouteId)!
      expect([...reroute.linkIds]).toEqual([inbound.id])
      expect(inbound.parentId).toBe(rerouteId)
      expect(reroute.floating).toBeUndefined()
    })

    test('undo of a replacement produces a serialisation deeply equal to the pre-edit one', () => {
      const { graph, middleId } = buildCompoundGraph()
      const undoState = snapshot(graph)

      replaceMiddle(graph, middleId)
      restore(graph, undoState)

      expect(snapshot(graph)).toEqual(undoState)
    })
  })
})
