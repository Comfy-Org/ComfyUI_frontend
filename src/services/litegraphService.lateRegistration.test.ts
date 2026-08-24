import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LayoutOperation } from '@/renderer/core/layout/types'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

/**
 * Characterises what happens when a node definition is registered while a
 * workflow is already open — the "user installs an extension mid-session"
 * case. The registration path under test is the one the app actually uses:
 * `app.registerNodeDef` delegates straight to
 * `useLitegraphService().registerNodeDef`, which builds the `ComfyNode` class
 * from the definition and hands it to `LiteGraph.registerNodeType`. Testing
 * `LiteGraph.registerNodeType` alone would exercise the registry mutation but
 * none of the slot/widget construction that makes the "and then a node of it
 * serialises correctly" half meaningful.
 *
 * The load-bearing half is what registration must *not* do. Registration adds
 * a type to a global registry; it has no business touching entities that
 * already exist. A late registration pass that re-registered or re-synced the
 * open graph would be invisible to a type-level check and would corrupt
 * exactly the ownership this migration is establishing.
 *
 * Program context: invariant I2 (no silent authority split); QA-11.
 */

const GRAPH_ID = '44444444-4444-4444-8444-444444444444'
const INSTALLED = 'TestAlreadyInstalled'
const LATE = 'TestInstalledMidSession'

function nodeDef(name: string): ComfyNodeDefV1 {
  return {
    name,
    display_name: name,
    category: 'testing',
    python_module: 'nodes',
    description: '',
    input: {
      required: {
        latent: ['LATENT', {}],
        seed: ['INT', { default: 0 }]
      }
    },
    output: ['LATENT'],
    output_name: ['LATENT'],
    output_node: false
  }
}

function serialisedNode(id: number, type: string): ISerialisedNode {
  return {
    id,
    type,
    pos: [id * 100, 0],
    size: [140, 60],
    flags: {},
    order: id - 1,
    mode: 0,
    inputs: [{ name: 'latent', type: 'LATENT', link: null }],
    outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
    properties: {},
    widgets_values: [id]
  }
}

/**
 * Two nodes of a type that is registered before the load, and one of a type
 * that is not registered until afterwards. The third node is what makes this a
 * mid-session install rather than a bare registry mutation.
 */
const workflow = (): SerialisableGraph => ({
  id: GRAPH_ID,
  version: 1,
  revision: 0,
  state: { lastNodeId: 3, lastLinkId: 1, lastGroupId: 0, lastRerouteId: 0 },
  nodes: [
    serialisedNode(1, INSTALLED),
    serialisedNode(2, INSTALLED),
    serialisedNode(3, LATE)
  ],
  links: [
    {
      id: 1,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'LATENT'
    }
  ],
  extra: {}
})

/**
 * A graph loaded and populated the way the app leaves it: `LGraph.add` (via
 * `configure`) attaches each node to the layout and shell stores, so the
 * layout entities the registration must not disturb actually exist.
 */
function loadedSession() {
  const graph = new LGraph()
  graph.configure(workflow())
  return graph
}

function installLateDefinition() {
  return useLitegraphService().registerNodeDef(LATE, nodeDef(LATE))
}

/**
 * Layout operations emitted while `action` runs. `onChange` notifications are
 * deferred to a microtask, so flush before unsubscribing.
 */
async function operationsAddedBy(
  action: () => void | Promise<void>
): Promise<LayoutOperation[]> {
  const operations: LayoutOperation[] = []
  const unsubscribe = layoutStore.onChange((change) => {
    operations.push(change.operation)
  })
  try {
    await action()
    await new Promise((resolve) => setTimeout(resolve, 0))
  } finally {
    unsubscribe()
  }
  return operations
}

/** Per-node layout entities plus the store-wide count, as a comparable snapshot. */
function layoutEntities(graph: LGraph) {
  return {
    nodeCount: layoutStore.nodeCount,
    layouts: graph.nodes.map((node) =>
      layoutStore.getNodeLayout(graph.rootGraph.id, node.id)
    )
  }
}

beforeEach(async () => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  layoutStore.resetForTests()
  await useLitegraphService().registerNodeDef(INSTALLED, nodeDef(INSTALLED))
})

afterEach(() => {
  Reflect.deleteProperty(LiteGraph, 'onNodeTypeRegistered')
  Reflect.deleteProperty(LiteGraph, 'onNodeTypeReplaced')
  for (const type of [INSTALLED, LATE]) {
    if (LiteGraph.registered_node_types[type]) {
      LiteGraph.unregisterNodeType(type)
    }
  }
})

describe('registering a node definition while a graph is already loaded', () => {
  it('adds the new type without re-registering the installed one', async () => {
    loadedSession()
    const installedClass = LiteGraph.registered_node_types[INSTALLED]
    const registered = vi.fn()
    const replaced = vi.fn()
    LiteGraph.onNodeTypeRegistered = registered
    LiteGraph.onNodeTypeReplaced = replaced

    await installLateDefinition()

    expect(registered).toHaveBeenCalledOnce()
    expect(registered).toHaveBeenCalledWith(LATE, expect.anything())
    expect(replaced).not.toHaveBeenCalled()
    expect(LiteGraph.registered_node_types[INSTALLED]).toBe(installedClass)
  })

  it('creates no layout entity operations', async () => {
    const graph = loadedSession()

    // Control: the change channel is live and wired to this graph's entities,
    // so an empty diff below is an observation rather than a dead channel.
    const control = await operationsAddedBy(() => {
      graph.nodes[0].pos = [500, 500]
    })
    expect(control.map((operation) => operation.type)).toEqual(['moveNode'])

    const entitiesBefore = layoutEntities(graph)
    const operations = await operationsAddedBy(installLateDefinition)

    expect(operations).toEqual([])
    expect(layoutEntities(graph)).toEqual(entitiesBefore)
  })

  it('re-registers no widget entity belonging to the loaded graph', async () => {
    const graph = loadedSession()
    const store = useWidgetValueStore()
    const seedState = store.getWidget(widgetId(GRAPH_ID, toNodeId(1), 'seed'))
    const widgetNamesByNode = () =>
      graph.nodes.map((node) =>
        store.getNodeWidgets(GRAPH_ID, node.id).map((state) => state.name)
      )
    expect(seedState).toBeDefined()
    const namesBefore = widgetNamesByNode()

    await installLateDefinition()

    expect(store.getWidget(widgetId(GRAPH_ID, toNodeId(1), 'seed'))).toBe(
      seedState
    )
    expect(widgetNamesByNode()).toEqual(namesBefore)
  })

  it('leaves the loaded graph serialising identically', async () => {
    const graph = loadedSession()
    const serialisedBefore = graph.serialize()
    const versionBefore = graph._version
    const nodesBefore = [...graph.nodes]
    const classesBefore = nodesBefore.map((node) => node.constructor)

    await installLateDefinition()

    expect(graph.serialize()).toEqual(serialisedBefore)
    expect(graph._version).toBe(versionBefore)
    expect(
      graph.nodes.every((node, index) => node === nodesBefore[index])
    ).toBe(true)
    expect(graph.nodes.map((node) => node.constructor)).toEqual(classesBefore)
  })

  it('can then add a node of the new type that connects and serialises', async () => {
    const graph = loadedSession()
    await installLateDefinition()

    const added = LiteGraph.createNode(LATE)
    expect(added).not.toBeNull()
    graph.add(added!)
    const link = graph.nodes[0].connect(0, added!, 0)
    expect(link).toBeTruthy()

    expect(added!.widgets?.map((widget) => widget.name)).toEqual([
      'seed',
      'control_after_generate'
    ])
    const serialised = added!.serialize()
    expect(serialised.type).toBe(LATE)
    expect(serialised.widgets_values).toEqual([0, 'randomize'])
    expect(serialised.inputs?.[0]).toMatchObject({
      name: 'latent',
      type: 'LATENT',
      link: link?.id
    })
    expect(graph.serialize().nodes).toHaveLength(4)
  })
})

describe('a node whose type was unknown when the graph loaded', () => {
  it('is preserved as an errored placeholder that round-trips its original data', () => {
    const graph = loadedSession()
    const unknown = graph.getNodeById(toNodeId(3))

    // Not dropped: `configure` substitutes a bare LGraphNode carrying the
    // original serialisation, so saving the workflow cannot silently discard a
    // node belonging to an extension the user has not installed yet.
    expect(unknown).toBeDefined()
    expect(unknown!.constructor).toBe(LGraphNode)
    expect(unknown!.has_errors).toBe(true)
    expect(unknown!.widgets?.map((widget) => widget.name)).toEqual(['UNKNOWN'])
    expect(graph.serialize().nodes?.[2]).toEqual(serialisedNode(3, LATE))
  })

  it('is not retroactively upgraded by the registration alone', async () => {
    const graph = loadedSession()

    await installLateDefinition()

    const unknown = graph.getNodeById(toNodeId(3))
    expect(unknown!.constructor).toBe(LGraphNode)
    expect(unknown!.has_errors).toBe(true)
    expect(unknown!.widgets?.map((widget) => widget.name)).toEqual(['UNKNOWN'])
  })

  it('becomes a real node once the workflow is reloaded', async () => {
    const graph = loadedSession()

    await installLateDefinition()
    graph.configure(workflow())

    const reloaded = graph.getNodeById(toNodeId(3))
    expect(reloaded!.has_errors).toBeFalsy()
    expect(
      reloaded!.widgets?.map((widget) => [widget.name, widget.value])
    ).toEqual([
      ['seed', 3],
      ['control_after_generate', 'randomize']
    ])
  })
})
