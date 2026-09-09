import {
  OPAQUE_WIDGETS_KEY,
  applyOps,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import {
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: vi.fn()
}))

class PromotedWidgetNode extends LGraphNode {
  constructor() {
    super('promoted-widget')
    const input = this.addInput('value', 'NUMBER')
    input.widget = { name: 'value' }
    this.addWidget('number', 'value', 1, () => {})
  }
}

class SourceNode extends LGraphNode {
  constructor() {
    super('source')
    this.addOutput('value', 'NUMBER')
  }
}

const INTERIOR_DEFAULT_VALUE = 1
const HOST_INITIAL_VALUE = 3

const CATALOG: WidgetCatalog = {
  types: {
    'promoted-widget': { widget_order: ['value'] },
    source: { widget_order: [] }
  }
}

function operation(id: string, version: number, payload: GraphOperation): Op {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: version,
    stamp: [version, 'agent:test'],
    ...payload
  }
}

interface FixtureOptions {
  /** Declare a second input `extra` ahead of `value` in the definition. */
  extraInput?: boolean
  /** Strip the host instance's serialized inputs (cmp claimPromotedInput premise). */
  stripHostInputs?: boolean
  /**
   * Serialize the host with `widgets_values: []`. cmp mints such a host with
   * an empty named `widgets` map and converts it to opaque storage on the
   * first promoted write (`hostWriteStorage`), deleting `widgets` and setting
   * `__widgets_opaque` in one transaction.
   */
  emptyHostWidgets?: boolean
  /** Add a root-level (non-host) `promoted-widget` node with id 3. */
  rootWidgetNode?: boolean
}

function promotedWorkflow(options: FixtureOptions = {}): WorkflowJSON {
  const graph = new LGraph()
  const subgraph = createTestSubgraph({
    rootGraph: graph,
    inputs: options.extraInput
      ? [
          { name: 'extra', type: 'NUMBER' },
          { name: 'value', type: 'NUMBER' }
        ]
      : [{ name: 'value', type: 'NUMBER' }]
  })
  // createTestSubgraph never registers on the root; serialize() only emits
  // definitions for subgraphs present in graph.subgraphs (LGraph.ts ~2761).
  graph.subgraphs.set(subgraph.id, subgraph)
  // `new PromotedWidgetNode()` leaves `type` unset; only `createNode` stamps
  // it, and cmp's mint drops nodes whose serialized `type` is empty.
  const interior = LiteGraph.createNode('promoted-widget')!
  interior.id = toNodeId(7)
  subgraph.add(interior)
  const valueSlot = subgraph.inputNode.slots[options.extraInput ? 1 : 0]
  valueSlot.connect(interior.inputs[0], interior)

  const host = createTestSubgraphNode(subgraph, { id: 1 })
  graph.add(host)
  // Host value differs from the interior default (1) so an initial load that
  // silently falls back to the definition's default is caught.
  host.widgets[0].value = HOST_INITIAL_VALUE

  const source = LiteGraph.createNode('source')!
  source.id = toNodeId(2)
  graph.add(source)
  if (options.rootWidgetNode) {
    const rootWidget = LiteGraph.createNode('promoted-widget')!
    rootWidget.id = toNodeId(3)
    graph.add(rootWidget)
  }
  const serialized = graph.serialize()
  const hostNode = serialized.nodes.find((n) => n.id === 1)
  if (options.stripHostInputs && hostNode) hostNode.inputs = []
  if (options.emptyHostWidgets && hostNode) hostNode.widgets_values = []
  // Same cast the production path takes: serialized litegraph JSON is the
  // workflow shape cmp mints from.
  return serialized as unknown as WorkflowJSON
}

function startFollower(options: FixtureOptions = {}) {
  const graph = new LGraph()
  const disableSubgraphNodeCreation = enableSubgraphNodeCreation(graph)
  const hostDoc = mint(promotedWorkflow(options), CATALOG)
  const follower = new FollowerDoc()
  const adapter = new EcsFollowerAdapter(
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: () => {}, deleteNodes: () => {} }
    })
  )
  adapter.bind('workflow', follower)
  const update = Y.encodeStateAsUpdate(hostDoc)
  follower.applyRemoteUpdate(update)
  expect(adapter.applyFrame({ workflowId: 'workflow', seq: 1, update })).toBe(
    true
  )
  reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))
  const instance = graph.getNodeById(toNodeId(1)) as SubgraphNode
  expect(instance).toBeInstanceOf(SubgraphNode)
  expect(instance.widgets[0]?.value).toBe(
    options.emptyHostWidgets ? INTERIOR_DEFAULT_VALUE : HOST_INITIAL_VALUE
  )
  expect(instance.inputs.map((i) => i.name)).toEqual(
    options.extraInput ? ['extra', 'value'] : ['value']
  )
  onTestFinished(disableSubgraphNodeCreation)
  return {
    graph,
    hostDoc,
    follower,
    adapter,
    instance,
    disableSubgraphNodeCreation
  }
}

function deliver(
  state: ReturnType<typeof startFollower>,
  payload: GraphOperation,
  seq: number
) {
  const vector = Y.encodeStateVector(state.hostDoc)
  const id = `op-${seq}`
  const result = applyOps(state.hostDoc, [operation(id, seq, payload)], CATALOG)
  expect(result.outcomes).toEqual([{ op_id: id, outcome: 'applied' }])
  const update = Y.encodeStateAsUpdate(state.hostDoc, vector)
  state.follower.applyRemoteUpdate(update)
  expect(
    state.adapter.applyFrame({
      workflowId: 'workflow',
      seq: seq + 1,
      update,
      actor: 'agent:test',
      opIds: [id]
    })
  ).toBe(true)
  reconcileAgentAdapters(
    state.graph,
    readSubgraphDefinitions(state.follower.doc)
  )
}

/**
 * Forward a raw Y.Doc mutation (no cmp op) to the follower. Models doc shapes
 * cmp's validated op path never produces, so the follower's defensive
 * branches are exercised directly.
 */
function forwardRaw(
  state: ReturnType<typeof startFollower>,
  mutate: (nodes: ReturnType<typeof nodesMap>) => void,
  seq: number
) {
  const vector = Y.encodeStateVector(state.hostDoc)
  state.hostDoc.transact(() => mutate(nodesMap(state.hostDoc)))
  const update = Y.encodeStateAsUpdate(state.hostDoc, vector)
  state.follower.applyRemoteUpdate(update)
  expect(
    state.adapter.applyFrame({ workflowId: 'workflow', seq: seq + 1, update })
  ).toBe(true)
  reconcileAgentAdapters(
    state.graph,
    readSubgraphDefinitions(state.follower.doc)
  )
}

beforeEach(() => {
  vi.mocked(reportError).mockClear()
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('promoted-widget', PromotedWidgetNode)
  LiteGraph.registerNodeType('source', SourceNode)
})

describe('agent CRDT follower on a SubgraphNode with promoted widgets', () => {
  it('S1 reflects a promoted host widgets_values write on the surface widget', () => {
    const state = startFollower()
    deliver(
      state,
      {
        op: 'set_widget',
        node_id: 1,
        widget: 'value',
        value: 42,
        promoted: {
          instance_path: [1],
          value_index: 0,
          host_widgets_values: [HOST_INITIAL_VALUE]
        }
      },
      1
    )

    // The host owns the promoted value (ADR-SUBGRAPH-PROMOTION-0009):
    // execution reads it from the widget value store, not from the interior
    // node's widget, so the interior default is intentionally untouched.
    const widgetId = state.instance.inputs[0]?.widgetId
    expect(widgetId).toBeDefined()
    expect(state.instance.widgets[0]?.value).toBe(42)
    expect(useWidgetValueStore().getWidget(widgetId!)?.value).toBe(42)
  })

  it('S1b keeps the promoted widget when cmp retires the empty named map in the same transaction', () => {
    // cmp `applyPromotedHostWrite` deletes the host's empty `widgets` Y.Map and
    // sets `__widgets_opaque` in ONE transaction. The follower must treat that
    // as an opaque promoted write, not as a named-map replacement that
    // reconciles the host back to definition defaults.
    const state = startFollower({ emptyHostWidgets: true })
    deliver(
      state,
      {
        op: 'set_widget',
        node_id: 1,
        widget: 'value',
        value: 42,
        promoted: {
          instance_path: [1],
          value_index: 0,
          host_widgets_values: [INTERIOR_DEFAULT_VALUE]
        }
      },
      1
    )

    const widgetId = state.instance.inputs[0]?.widgetId
    expect(widgetId).toBeDefined()
    expect(state.instance.widgets.map((w) => w.name)).toEqual(['value'])
    expect(state.instance.widgets[0]?.value).toBe(42)
    expect(useWidgetValueStore().getWidget(widgetId!)?.value).toBe(42)
  })

  it('S2 materializes and connects a declared promoted host input', () => {
    const state = startFollower()
    deliver(
      state,
      {
        op: 'connect',
        link_id: 9,
        from_node: 2,
        from_slot: 0,
        to_node: 1,
        link_type: 'NUMBER',
        grow: {
          side: 'input',
          slot: 'value',
          name: 'value',
          type: 'NUMBER',
          promoted: true
        }
      },
      1
    )

    expect(state.graph.links.has(toLinkId(9))).toBe(true)
    expect(state.instance.inputs[0]?.link).toBe(9)
    expect(state.graph.getNodeById(toNodeId(2))?.outputs[0]?.links).toContain(9)
  })

  it('S2b wires the promoted input by declared name when the doc host carries no slots', () => {
    const state = startFollower({ extraInput: true, stripHostInputs: true })
    deliver(
      state,
      {
        op: 'connect',
        link_id: 9,
        from_node: 2,
        from_slot: 0,
        to_node: 1,
        link_type: 'NUMBER',
        grow: {
          side: 'input',
          slot: 'value',
          name: 'value',
          type: 'NUMBER',
          promoted: true
        }
      },
      1
    )

    const valueInput = state.instance.inputs.find((i) => i.name === 'value')
    const extraInput = state.instance.inputs.find((i) => i.name === 'extra')
    expect(state.graph.links.has(toLinkId(9))).toBe(true)
    expect({
      target_slot: state.graph.links.get(toLinkId(9))?.target_slot,
      valueLink: valueInput?.link ?? null,
      extraLink: extraInput?.link ?? null
    }).toEqual({
      target_slot: state.instance.inputs.indexOf(valueInput!),
      valueLink: 9,
      extraLink: null
    })
  })

  it('S2e keeps a live host link when the doc host slot list omits that declared slot', () => {
    // cmp writes host slots only as `grow` claims them, so a doc host's slot
    // list can be a strict subset of the definition's declared inputs while a
    // link to an omitted slot is still live. Synthesizing the omitted slot as
    // `link: null` would sever it on the next node change while the link map
    // still holds it; the follower must keep the existing live link instead.
    const state = startFollower({ extraInput: true })
    deliver(
      state,
      {
        op: 'connect',
        link_id: 8,
        from_node: 2,
        from_slot: 0,
        to_node: 1,
        to_slot: 0,
        link_type: 'NUMBER'
      },
      1
    )
    const extraInput = () =>
      state.instance.inputs.find((i) => i.name === 'extra')
    expect(extraInput()?.link).toBe(8)

    forwardRaw(
      state,
      (nodes) => {
        const inputs = nodes.get('1')?.get('inputs') as Y.Array<Y.Map<unknown>>
        expect(inputs.get(0).get('name')).toBe('extra')
        inputs.delete(0, 1)
      },
      2
    )

    expect(state.graph.links.has(toLinkId(8))).toBe(true)
    expect(state.instance.inputs.map((i) => [i.name, i.link ?? null])).toEqual([
      ['extra', 8],
      ['value', null]
    ])
  })

  it('S2c skips a promoted connect whose slot name the definition does not declare', () => {
    // cmp `claimPromotedInput` never validates `grow.name` against the
    // definition: it appends a `{name: 'bogus'}` slot to the doc host. With the
    // doc host otherwise slot-less, that slot sits at doc index 0, which is the
    // live `extra` input. A positional fallback would silently wire the link
    // onto the wrong input; the follower must refuse instead.
    const state = startFollower({ extraInput: true, stripHostInputs: true })
    deliver(
      state,
      {
        op: 'connect',
        link_id: 9,
        from_node: 2,
        from_slot: 0,
        to_node: 1,
        link_type: 'NUMBER',
        grow: {
          side: 'input',
          slot: 'bogus',
          name: 'bogus',
          type: 'NUMBER',
          promoted: true
        }
      },
      1
    )

    expect(state.graph.links.has(toLinkId(9))).toBe(false)
    expect(state.instance.inputs.map((i) => [i.name, i.link ?? null])).toEqual([
      ['extra', null],
      ['value', null]
    ])
    expect(
      state.graph.getNodeById(toNodeId(2))?.outputs[0]?.links ?? []
    ).toEqual([])
    // The doc keeps link 9 while the live graph dropped it, so the drift must
    // be surfaced rather than silently ignored.
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("'bogus'")
      }),
      expect.objectContaining({
        errorType: 'agent_subgraph_host_slot_undeclared',
        context: expect.objectContaining({
          nodeId: '1',
          slot: 0,
          name: 'bogus'
        })
      })
    )
  })

  it('S2d removes a live promoted link when the same link id is retargeted onto an undeclared slot', () => {
    // cmp `claimLinkIdentity` deletes and re-mints link 9 under the new slot in
    // one op, so the doc still holds id 9 but the follower can no longer read
    // it (undeclared name). A changed link that is present in the doc yet
    // unreadable must be retired live, not left connected to its old slot.
    const state = startFollower()
    const connect = {
      op: 'connect' as const,
      link_id: 9,
      from_node: 2,
      from_slot: 0,
      to_node: 1,
      link_type: 'NUMBER'
    }
    deliver(
      state,
      {
        ...connect,
        grow: {
          side: 'input',
          slot: 'value',
          name: 'value',
          type: 'NUMBER',
          promoted: true
        }
      },
      1
    )
    expect(state.instance.inputs[0]?.link).toBe(9)

    deliver(
      state,
      {
        ...connect,
        grow: {
          side: 'input',
          slot: 'bogus',
          name: 'bogus',
          type: 'NUMBER',
          promoted: true
        }
      },
      2
    )

    expect(state.graph.links.has(toLinkId(9))).toBe(false)
    expect(state.instance.inputs.map((i) => [i.name, i.link ?? null])).toEqual([
      ['value', null]
    ])
    expect(
      state.graph.getNodeById(toNodeId(2))?.outputs[0]?.links ?? []
    ).toEqual([])
  })

  it('S1c keeps promoted values and reports drift when the opaque array is longer', () => {
    // The definition declares one promoted name. cmp writes the whole
    // positional array against that same promoted list, so a longer array
    // means writer and reader disagree on the host surface. Mapping the first
    // value positionally could land it on the wrong widget; the host keeps
    // its current value and the mismatch is reported.
    const state = startFollower()
    deliver(state, hostSetWidget(44), 1)
    forwardRaw(
      state,
      (nodes) => nodes.get('1')!.set(OPAQUE_WIDGETS_KEY, [42, 'extra']),
      2
    )

    const widgetId = state.instance.inputs[0]?.widgetId
    expect(widgetId).toBeDefined()
    expect(storedHostWidgets(state)).toEqual([['value', 44]])
    expect(state.instance.widgets.map((w) => w.name)).toEqual(['value'])
    expect(state.instance.widgets[0]?.value).toBe(44)
    expect(useWidgetValueStore().getWidget(widgetId!)?.value).toBe(44)
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('carries 2 opaque widget values')
      }),
      expect.objectContaining({
        errorType: 'agent_subgraph_host_widgets_mismatch',
        context: expect.objectContaining({ expected: 1, actual: 2 })
      })
    )
  })

  it('S1d falls back to reconcileNode for an opaque write on a non-host node', () => {
    // Node 3 is a plain root node (no subgraph definition). Converting its
    // named `widgets` map to opaque storage must take the generic
    // `reconcileNode` path, not the promoted-host path.
    const state = startFollower({ rootWidgetNode: true })
    const rootWidget = state.graph.getNodeById(toNodeId(3))!
    expect(rootWidget).not.toBeInstanceOf(SubgraphNode)
    expect(rootWidget.widgets?.[0]?.value).toBe(INTERIOR_DEFAULT_VALUE)

    forwardRaw(
      state,
      (nodes) => {
        const node = nodes.get('3')!
        node.delete('widgets')
        node.set(OPAQUE_WIDGETS_KEY, [9])
      },
      1
    )

    const after = state.graph.getNodeById(toNodeId(3))!
    expect(after).not.toBeInstanceOf(SubgraphNode)
    // `reconcileNode` registers an array payload under positional names
    // (`widgetEntries` in graphMutations) and clears the named entries. The
    // store is the authoritative contract here; projecting positional values
    // onto a plain node's litegraph widgets is the materializer's concern and
    // out of scope for the follower (see agentNodeMaterializer.ts).
    const stored = useWidgetValueStore()
      .getNodeWidgets(graphScopeOf(state.graph).rootGraphId, toNodeId(3))
      .map((w) => [w.name, w.value])
    expect(stored).toEqual([['0', 9]])
    // The host is untouched: the fallback must not bleed into promoted state.
    expect(state.instance.widgets[0]?.value).toBe(HOST_INITIAL_VALUE)
  })

  it('S1e keeps promoted host widgets when the opaque payload is malformed', () => {
    // A non-array `__widgets_opaque` on a host must be skipped, not routed to
    // `reconcileNode`: `widgetEntries` yields no entries for it and `commit`
    // clears the node's widget store first, which would wipe every promoted
    // value.
    const state = startFollower()
    const widgetId = state.instance.inputs[0]?.widgetId
    expect(widgetId).toBeDefined()

    forwardRaw(
      state,
      (nodes) => nodes.get('1')!.set(OPAQUE_WIDGETS_KEY, 'bogus'),
      1
    )

    expect(state.instance.widgets.map((w) => w.name)).toEqual(['value'])
    expect(state.instance.widgets[0]?.value).toBe(HOST_INITIAL_VALUE)
    expect(useWidgetValueStore().getWidget(widgetId!)?.value).toBe(
      HOST_INITIAL_VALUE
    )
  })

  function storedHostWidgets(state: ReturnType<typeof startFollower>) {
    return useWidgetValueStore()
      .getNodeWidgets(graphScopeOf(state.graph).rootGraphId, toNodeId(1))
      .map((w) => [w.name, w.value])
  }

  it('S1f registers the host under promoted names on initial load', () => {
    // `addNode` reads the host's positional `__widgets_opaque`; a positional
    // store entry ('0') would later collide with the named `setWidget` path
    // and leave the host carrying two widgets for one promoted value.
    const state = startFollower()
    expect(storedHostWidgets(state)).toEqual([['value', HOST_INITIAL_VALUE]])
  })

  it('S1g keeps promoted names across a re-armed reconcile frame', () => {
    const state = startFollower()
    deliver(state, hostSetWidget(42), 1)
    // Re-binding arms `reconcileNextFrame`, which routes every node through
    // `reconcileNode(readSemanticNode)` — the same positional read as add.
    state.adapter.bind('workflow', state.follower)
    deliver(state, hostSetWidget(43), 2)

    expect(storedHostWidgets(state)).toEqual([['value', 43]])
    expect(state.instance.widgets.map((w) => w.name)).toEqual(['value'])
    expect(state.instance.widgets[0]?.value).toBe(43)
  })

  it('S1h keeps promoted names when the host node map is replaced', () => {
    // A wholesale node replacement is an `update` nodeAction: delete then
    // `addNode(readSemanticNode)`, bypassing the opaque host loop entirely.
    const state = startFollower()
    forwardRaw(
      state,
      (nodes) => {
        const previous = nodes.get('1')!.toJSON() as Record<string, unknown>
        const replacement = new Y.Map<unknown>()
        for (const [key, value] of Object.entries(previous)) {
          if (key === OPAQUE_WIDGETS_KEY) continue
          replacement.set(key, value)
        }
        replacement.set(OPAQUE_WIDGETS_KEY, [44])
        replacement.set('title', 'Replaced host')
        nodes.set('1', replacement)
      },
      1
    )

    expect(storedHostWidgets(state)).toEqual([['value', 44]])
    expect(state.instance.widgets.map((w) => w.name)).toEqual(['value'])
    expect(state.instance.widgets[0]?.value).toBe(44)
    // The replacement is not widget-only: non-widget fields must land too.
    expect(state.instance.title).toBe('Replaced host')
  })

  it('S1k resyncs live host fields without rebuilding promoted widgets', () => {
    // A doc edit to a host's non-widget fields (title, mode, flags, ...) must
    // reach the live SubgraphNode. The live-host path used to return after
    // writing promoted values, so these edits were silently dropped.
    const state = startFollower()
    deliver(state, hostSetWidget(47), 1)
    const inputBefore = state.instance.inputs[0]
    forwardRaw(
      state,
      (nodes) => {
        const node = nodes.get('1')!
        node.set('title', 'Renamed host')
        node.set('mode', 2)
        node.set('flags', { collapsed: true })
        node.set('properties', { note: 'kept' })
      },
      2
    )

    expect(state.instance.title).toBe('Renamed host')
    expect(state.instance.mode).toBe(2)
    expect(state.instance.flags.collapsed).toBe(true)
    expect(state.instance.properties.note).toBe('kept')
    // Promoted widget bindings survive: same widget surface, same value, and
    // the input slot object (which carries the `_subgraphSlot`/`widgetId`
    // bindings) is not replaced.
    expect(state.instance.widgets.map((w) => w.name)).toEqual(['value'])
    expect(state.instance.widgets[0]?.value).toBe(47)
    expect(storedHostWidgets(state)).toEqual([['value', 47]])
    expect(state.instance.inputs[0]).toBe(inputBefore)
  })

  it('S1i keeps promoted names when the host flips back to named storage', () => {
    // Deleting `__widgets_opaque` and writing a named `widgets` map lands in
    // the replaced-widget-storage loop, which used to run `reconcileNode` on
    // the host and reset its live inputs.
    const state = startFollower()
    forwardRaw(
      state,
      (nodes) => {
        const node = nodes.get('1')!
        node.delete(OPAQUE_WIDGETS_KEY)
        node.set('widgets', new Y.Map<unknown>([['value', 45]]))
      },
      1
    )

    expect(storedHostWidgets(state)).toEqual([['value', 45]])
    expect(state.instance.widgets.map((w) => w.name)).toEqual(['value'])
    expect(state.instance.widgets[0]?.value).toBe(45)
  })

  it('S1j leaves promoted values unchanged when the opaque array shrinks', () => {
    // A shorter opaque array carries no value for the declared promoted name.
    // The host keeps its current value rather than dropping the widget or
    // resetting it: the definition, not the array length, owns the surface.
    const state = startFollower()
    deliver(state, hostSetWidget(46), 1)
    forwardRaw(state, (nodes) => nodes.get('1')!.set(OPAQUE_WIDGETS_KEY, []), 2)

    expect(storedHostWidgets(state)).toEqual([['value', 46]])
    expect(state.instance.widgets.map((w) => w.name)).toEqual(['value'])
    expect(state.instance.widgets[0]?.value).toBe(46)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'agent_subgraph_host_widgets_mismatch',
        context: expect.objectContaining({ expected: 1, actual: 0 })
      })
    )
  })
})

function hostSetWidget(value: number): GraphOperation {
  return {
    op: 'set_widget',
    node_id: 1,
    widget: 'value',
    value,
    promoted: {
      instance_path: [1],
      value_index: 0,
      host_widgets_values: [HOST_INITIAL_VALUE]
    }
  }
}
