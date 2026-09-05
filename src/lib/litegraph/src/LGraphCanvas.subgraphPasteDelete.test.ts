import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import type { Reroute } from '@/lib/litegraph/src/litegraph'
import type { LinkId } from '@/types/linkId'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LLink,
  LiteGraph,
  SubgraphNode,
  createUuidv4
} from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import {
  createTestSubgraphData,
  registerTestSubgraphNodeTypes
} from './subgraph/__fixtures__/subgraphHelpers'

/**
 * Copy/paste a subgraph instance that carries a promoted widget and a rerouted
 * external link, then delete the two instances in **both** orders.
 *
 * Order-dependence is the bug class. A cleanup path that works when the copy
 * goes first and corrupts the survivor when the original goes first is
 * invisible to any test that only tries one order, so both orders are asserted
 * separately and then compared.
 *
 * `LGraphCanvas.clipboard.test.ts` already covers the paste-time half —
 * interior id remapping, `proxyWidgets` / `previewExposures` reference
 * rewriting, input reconnection when clipboard ids are strings, legacy
 * `proxyWidgets` clearing and preview auto-exposure. None of that outlives the
 * paste. This file starts where that one stops: what the *deletions* do.
 *
 * These assertions characterise the ECS stores (ADR-CRDT-LAYOUT-0003). Where they differ
 * from pre-ECS `main` — phantom reroute floating entries, widget-store leaks
 * on host deletion — the delta is intended and called out inline.
 */

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

const INTERIOR_TYPE = 'test/qa4-interior'
const PLAIN_TYPE = 'test/qa4-plain'

const ORIGINAL_SEED = 4242
const COPY_SEED = 99

/** Interior node whose `seed` widget is backed by an input slot, so it is promotable. */
class InteriorNode extends LGraphNode {
  constructor() {
    super('QA4 Interior')
    this.serialize_widgets = true
    const seedSlot = this.addInput('seed', 'NUMBER')
    seedSlot.widget = { name: 'seed' }
    this.addInput('image', 'IMAGE')
    this.addOutput('out', 'NUMBER')
    this.addWidget('number', 'seed', 20, () => {})
  }
}

class PlainNode extends LGraphNode {
  constructor() {
    super('QA4 Plain')
    this.addInput('in', '*')
    this.addOutput('out', '*')
  }
}

const canvases: LGraphCanvas[] = []

function createCanvas(graph: LGraph): LGraphCanvas {
  const el = document.createElement('canvas')
  el.width = 800
  el.height = 600
  el.getContext = vi.fn().mockReturnValue(createMockCanvasRenderingContext2D())
  el.getBoundingClientRect = vi
    .fn()
    .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
  // LGraph.remove -> checkPanels dereferences canvas.parentNode.
  document.body.append(el)
  const canvas = new LGraphCanvas(el, graph, { skip_render: true })
  canvases.push(canvas)
  return canvas
}

interface Fixture {
  rootGraph: LGraph
  original: SubgraphNode
  copy: SubgraphNode
  upstream: LGraphNode
  downstream: LGraphNode
  /** Shared by the original's and the copy's inbound external link. */
  reroute: Reroute
  originalDefId: string
  copyDefId: string
  originalInLinkId: LinkId
  originalOutLinkId: LinkId
  copyInLinkId: LinkId
}

/**
 * Root graph:
 *
 * ```
 *   upstream ──┬─(reroute 1)─► original[image]   original[result] ─► downstream
 *              └─(reroute 1)─► copy[image]
 * ```
 *
 * Both instances also carry a promoted `seed` widget projected from their own
 * interior node. `connectInputs` is the Ctrl+Shift+V paste, the only paste that
 * reattaches a copy to the upstream node it was copied from — and therefore the
 * only one that threads two links through a single reroute.
 */
function buildFixture(): Fixture {
  const rootGraph = new LGraph()
  rootGraph.id = createUuidv4()
  registerTestSubgraphNodeTypes(rootGraph)
  const canvas = createCanvas(rootGraph)

  const subgraph = rootGraph.createSubgraph(
    createTestSubgraphData({ name: 'QA4 Subgraph' })
  )

  const interior = LiteGraph.createNode(INTERIOR_TYPE)!
  subgraph.add(interior)
  subgraph.addInput('image', 'IMAGE').connect(interior.inputs[1], interior)
  subgraph.addOutput('result', 'NUMBER')
  subgraph.outputNode.slots[0].connect(interior.outputs[0], interior)

  const original = LiteGraph.createNode(subgraph.id)
  if (!(original instanceof SubgraphNode))
    throw new Error('Expected the subgraph type to build a SubgraphNode')
  rootGraph.add(original)

  expect(
    promoteValueWidgetViaSubgraphInput(original, interior, interior.widgets![0])
  ).toStrictEqual({ ok: true })

  const upstream = LiteGraph.createNode(PLAIN_TYPE)!
  rootGraph.add(upstream)
  const downstream = LiteGraph.createNode(PLAIN_TYPE)!
  rootGraph.add(downstream)

  const inbound = upstream.connect(0, original, 0)!
  const reroute = rootGraph.createReroute([200, 200], inbound)!
  const outbound = original.connect(0, downstream, 0)!

  useWidgetValueStore().setValue(original.inputs[1].widgetId!, ORIGINAL_SEED)

  canvas.copyToClipboard([original])
  const pasted = canvas._pasteFromClipboard({
    connectInputs: true,
    position: [700, 700]
  })
  const copy = pasted?.created.find(
    (item): item is SubgraphNode => item instanceof SubgraphNode
  )
  if (!copy) throw new Error('Expected a pasted SubgraphNode')

  return {
    rootGraph,
    original,
    copy,
    upstream,
    downstream,
    reroute,
    originalDefId: subgraph.id,
    copyDefId: copy.type,
    originalInLinkId: inbound.id,
    originalOutLinkId: outbound.id,
    copyInLinkId: copy.inputs[0].link!
  }
}

/** The promoted `seed` value as the host projects it to the canvas. */
function promotedSeed(host: SubgraphNode): unknown {
  return host.getWidgetFromSlot(host.inputs[1])?.value
}

/** Widget states still keyed to this host's node id, as `{ name, value }` pairs. */
function storedWidgets(graph: LGraph, host: SubgraphNode) {
  return useWidgetValueStore()
    .getNodeWidgets(graph.id, host.id)
    .map(({ name, value }) => ({ name, value }))
}

/** Structural facts that must not depend on the order the instances were deleted in. */
function terminalState(f: Fixture) {
  return {
    remainingNodes: f.rootGraph.nodes.map((node) => String(node.id)),
    remainingDefinitions: f.rootGraph.subgraphs.size,
    remainingLinks: [...f.rootGraph.links.keys()],
    remainingFloatingLinks: [...f.rootGraph.floatingLinks.keys()],
    remainingReroutes: [...f.rootGraph.reroutes.values()].map((reroute) => ({
      linkIds: [...reroute.linkIds],
      floatingLinkIds: [...reroute.floatingLinkIds]
    })),
    originalWidgetStates: storedWidgets(f.rootGraph, f.original),
    copyWidgetStates: storedWidgets(f.rootGraph, f.copy)
  }
}

describe('subgraph copy/paste then delete in both orders', () => {
  beforeEach(() => {
    LiteGraph.registerNodeType(INTERIOR_TYPE, InteriorNode)
    LiteGraph.registerNodeType(PLAIN_TYPE, PlainNode)
  })

  afterEach(() => {
    // The constructor binds a `document` keyup listener, which retains the
    // whole fixture graph until it is removed.
    for (const canvas of canvases.splice(0)) {
      canvas.unbindEvents()
      canvas.canvas.remove()
    }
  })

  it('pastes an independent instance that shares the original reroute', () => {
    const f = buildFixture()

    // Paste always clones the definition rather than sharing it, so the two
    // instances are entangled only through the root graph — never through
    // `rootGraph.subgraphs`.
    expect(f.copyDefId).not.toBe(f.originalDefId)
    expect(f.rootGraph.subgraphs.size).toBe(2)
    expect(f.copy.subgraph).not.toBe(f.original.subgraph)
    expect(f.copy.subgraph.nodes).toHaveLength(1)

    // The promoted value rides across the copy/paste...
    expect(promotedSeed(f.copy)).toBe(ORIGINAL_SEED)
    // ...into a widget id of the copy's own, keyed by the pasted node id.
    expect(f.copy.inputs[1].widgetId).not.toBe(f.original.inputs[1].widgetId)

    // Where they *are* entangled: one reroute now carries both inbound links.
    expect([...f.reroute.linkIds]).toStrictEqual([
      f.originalInLinkId,
      f.copyInLinkId
    ])
    expect(
      LLink.getReroutes(f.rootGraph, f.rootGraph.getLink(f.copyInLinkId)!)
    ).toStrictEqual([f.reroute])

    // Only inbound links are serialised, so the copy has no outbound link.
    expect(f.copy.outputs[0].links ?? []).toHaveLength(0)

    // On main, `createReroute` seeded `floatingLinkIds` from a non-floating
    // link, so the reroute claimed a floating link the graph never had. The
    // ECS link store keeps floating membership consistent with the graph:
    // no phantom entry at paste time (ADR-CRDT-LAYOUT-0003).
    expect([...f.reroute.floatingLinkIds]).toStrictEqual([])
    expect(f.rootGraph.floatingLinks.size).toBe(0)
  })

  it('leaves the copy whole when the original is deleted first', () => {
    const f = buildFixture()
    useWidgetValueStore().setValue(f.copy.inputs[1].widgetId!, COPY_SEED)

    f.rootGraph.remove(f.original)

    // Ownership: only the original's definition is released.
    expect(f.rootGraph.subgraphs.has(f.originalDefId)).toBe(false)
    expect(f.rootGraph.subgraphs.get(f.copyDefId)).toBe(f.copy.subgraph)
    expect(f.copy.isDetached).toBe(false)
    expect(f.original.isDetached).toBe(true)
    expect(f.rootGraph.nodes).toContain(f.copy)
    expect(f.rootGraph.nodes).not.toContain(f.original)
    expect(f.rootGraph.getNodeById(f.original.id)).toBeNull()

    // The copy's promoted widget value is untouched by its sibling's removal.
    expect(promotedSeed(f.copy)).toBe(COPY_SEED)

    // Topology: the shared reroute survives holding only the copy's link, and
    // that link still resolves end to end through it.
    expect([...f.reroute.linkIds]).toStrictEqual([f.copyInLinkId])
    const copyInLink = f.rootGraph.getLink(f.copyInLinkId)
    expect(copyInLink).toMatchObject({
      origin_id: f.upstream.id,
      target_id: f.copy.id,
      parentId: f.reroute.id
    })
    expect(LLink.getReroutes(f.rootGraph, copyInLink!)).toStrictEqual([
      f.reroute
    ])
    expect(f.upstream.outputs[0].links).toStrictEqual([f.copyInLinkId])

    // The original's own links are gone, including the outbound one.
    expect(f.rootGraph.getLink(f.originalInLinkId)).toBeUndefined()
    expect(f.rootGraph.getLink(f.originalOutLinkId)).toBeUndefined()
    expect(f.downstream.inputs[0].link).toBeNull()

    // On main, removing a SubgraphNode leaked its promoted widget states in
    // the store. The ECS widget-value store releases the deleted host's
    // registrations, so nothing keyed to the removed instance survives.
    expect(storedWidgets(f.rootGraph, f.original)).toStrictEqual([])
  })

  it('leaves the original whole when the copy is deleted first', () => {
    const f = buildFixture()
    useWidgetValueStore().setValue(f.copy.inputs[1].widgetId!, COPY_SEED)

    f.rootGraph.remove(f.copy)

    expect(f.rootGraph.subgraphs.has(f.copyDefId)).toBe(false)
    expect(f.rootGraph.subgraphs.get(f.originalDefId)).toBe(f.original.subgraph)
    expect(f.original.isDetached).toBe(false)
    expect(f.copy.isDetached).toBe(true)
    expect(f.rootGraph.nodes).toContain(f.original)
    expect(f.rootGraph.nodes).not.toContain(f.copy)
    expect(f.rootGraph.getNodeById(f.copy.id)).toBeNull()

    expect(promotedSeed(f.original)).toBe(ORIGINAL_SEED)

    expect([...f.reroute.linkIds]).toStrictEqual([f.originalInLinkId])
    const originalInLink = f.rootGraph.getLink(f.originalInLinkId)
    expect(originalInLink).toMatchObject({
      origin_id: f.upstream.id,
      target_id: f.original.id,
      parentId: f.reroute.id
    })
    expect(LLink.getReroutes(f.rootGraph, originalInLink!)).toStrictEqual([
      f.reroute
    ])
    expect(f.upstream.outputs[0].links).toStrictEqual([f.originalInLinkId])

    // The original's outbound link is unrelated to the copy and stays put.
    expect(f.rootGraph.getLink(f.originalOutLinkId)).toMatchObject({
      origin_id: f.original.id,
      target_id: f.downstream.id
    })
    expect(f.downstream.inputs[0].link).toBe(f.originalOutLinkId)

    expect(f.rootGraph.getLink(f.copyInLinkId)).toBeUndefined()

    // Same release semantics as above: the deleted copy's widget states are
    // removed from the store rather than leaking (see ADR-CRDT-LAYOUT-0003).
    expect(storedWidgets(f.rootGraph, f.copy)).toStrictEqual([])
  })

  it('reaches the same terminal state whichever instance is deleted first', () => {
    const originalFirst = buildFixture()
    useWidgetValueStore().setValue(
      originalFirst.copy.inputs[1].widgetId!,
      COPY_SEED
    )
    originalFirst.rootGraph.remove(originalFirst.original)
    originalFirst.rootGraph.remove(originalFirst.copy)

    const copyFirst = buildFixture()
    useWidgetValueStore().setValue(
      copyFirst.copy.inputs[1].widgetId!,
      COPY_SEED
    )
    copyFirst.rootGraph.remove(copyFirst.copy)
    copyFirst.rootGraph.remove(copyFirst.original)

    expect(terminalState(copyFirst)).toStrictEqual(terminalState(originalFirst))

    // That shared state is: both definitions released, both instances gone,
    // every real link gone — and the reroute survives on a *real* floating
    // link. Where main kept the reroute alive via a phantom `floatingLinkIds`
    // entry (no matching graph record), the ECS link store materialises the
    // preserved chain as an actual floating link in `graph.floatingLinks`
    // (ADR-CRDT-LAYOUT-0003). Both deleted hosts' widget states are released rather than
    // leaked.
    const [floatingId] = [...originalFirst.rootGraph.floatingLinks.keys()]
    expect(floatingId).toBeDefined()
    expect(terminalState(originalFirst)).toStrictEqual({
      remainingNodes: [
        String(originalFirst.upstream.id),
        String(originalFirst.downstream.id)
      ],
      remainingDefinitions: 0,
      remainingLinks: [],
      remainingFloatingLinks: [floatingId],
      remainingReroutes: [{ linkIds: [], floatingLinkIds: [floatingId] }],
      originalWidgetStates: [],
      copyWidgetStates: []
    })
  })
})
