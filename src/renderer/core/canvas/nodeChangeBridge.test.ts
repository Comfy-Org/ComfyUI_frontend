import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraph as Graph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type {
  NodeChangeScope,
  provideNodeChangeSource
} from '@/platform/nodeApi/nodeChanges'

import { installNodeChangeBridge } from './nodeChangeBridge'

/** The graph on screen, which the bridge follows. */
const currentGraph = ref<LGraph | null>(null)
vi.mock('./canvasStore', () => ({
  useCanvasStore: () => ({
    get currentGraph() {
      return currentGraph.value
    }
  })
}))

type NodeChangeSource = Parameters<typeof provideNodeChangeSource>[0]
type NodeChangeReport = Parameters<Parameters<NodeChangeSource>[1]>[0]

/** Captures the provider the bridge pushes down to the API. */
const captured = vi.hoisted(() => ({
  provider: undefined as NodeChangeSource | undefined
}))
vi.mock('@/platform/nodeApi/nodeChanges', () => ({
  provideNodeChangeSource: (provider: NodeChangeSource) => {
    captured.provider = provider
  }
}))

function graphWithNode() {
  const graph = new Graph()
  const node = new LGraphNode('Sampler')
  graph.add(node)
  return { graph, node }
}

/** Installs the bridge and subscribes exactly as the API does. */
function install(scope: NodeChangeScope = 'visible') {
  installNodeChangeBridge()
  const emitted: NodeChangeReport[] = []
  const stop = captured.provider!(scope, (change) => emitted.push(change))
  return { emitted, stop }
}

/** A definition registered the way `createSubgraph` registers one. */
function addSubgraph(root: LGraph, name: string) {
  const definition = root.createSubgraph(
    createTestSubgraph({ rootGraph: root, name }).asSerialisable()
  )
  const node = new LGraphNode(`${name} node`)
  definition.add(node)
  return { definition, node }
}

describe('nodeChangeBridge', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    captured.provider = undefined
    currentGraph.value = null
  })

  it('reports a tracked change on the graph that is on screen', () => {
    const { graph, node } = graphWithNode()
    currentGraph.value = graph
    const { emitted, stop } = install()

    node.mode = LGraphEventMode.NEVER

    expect(emitted).toEqual([
      {
        graphId: graph.id,
        nodeId: String(node.id),
        property: 'mode',
        from: LGraphEventMode.ALWAYS,
        to: LGraphEventMode.NEVER
      }
    ])
    stop()
  })

  it('follows the user into a subgraph, and lets go of the graph it left', async () => {
    // LGraph.trigger dispatches on the node's OWN graph, so a listener bound to
    // the root reports nothing while the user is inside a subgraph.
    const outer = graphWithNode()
    currentGraph.value = outer.graph
    const { emitted, stop } = install()

    const inner = graphWithNode()
    currentGraph.value = inner.graph
    await nextTick()

    inner.node.mode = LGraphEventMode.NEVER
    expect(emitted).toHaveLength(1)

    outer.node.mode = LGraphEventMode.NEVER
    expect(emitted).toHaveLength(1)
    stop()
  })

  it('ignores a property the published union does not name', () => {
    // The host may start tracking a field before the API names it; that must
    // not leak out as an event packs cannot type.
    const { graph, node } = graphWithNode()
    currentGraph.value = graph
    const { emitted, stop } = install()

    graph.trigger('node:property:changed', {
      nodeId: node.id,
      property: 'somethingNew',
      oldValue: 1,
      newValue: 2
    })

    expect(emitted).toEqual([])
    stop()
  })

  it('detaches from the graph when the subscription ends', () => {
    const { graph, node } = graphWithNode()
    currentGraph.value = graph
    const { emitted, stop } = install()

    stop()
    node.mode = LGraphEventMode.NEVER

    expect(emitted).toEqual([])
  })

  describe('document scope', () => {
    it('reports a change inside a subgraph nobody is looking at', () => {
      // A relay muting a group from inside a subgraph the user has left keeps
      // asserting its last answer: silent, intermittent, and healed by
      // navigating, which is the worst way to find a bug.
      const root = new Graph()
      currentGraph.value = root
      const { definition, node } = addSubgraph(root, 'Upscale')
      const { emitted, stop } = install('document')

      node.mode = LGraphEventMode.NEVER

      expect(emitted).toEqual([
        {
          graphId: definition.id,
          nodeId: String(node.id),
          property: 'mode',
          from: LGraphEventMode.ALWAYS,
          to: LGraphEventMode.NEVER
        }
      ])
      stop()
    })

    it('is not what the default scope reports', () => {
      const root = new Graph()
      currentGraph.value = root
      const { node } = addSubgraph(root, 'Upscale')
      const { emitted, stop } = install()

      node.mode = LGraphEventMode.NEVER

      expect(emitted).toEqual([])
      stop()
    })

    it('picks up a definition created after the subscription', () => {
      const root = new Graph()
      currentGraph.value = root
      const { emitted, stop } = install('document')

      const { node } = addSubgraph(root, 'Late')
      node.mode = LGraphEventMode.NEVER

      expect(emitted).toHaveLength(1)
      stop()
    })

    it('keeps watching a definition whose last instance is removed', () => {
      // The document owns its subgraph definitions: removing the last instance
      // takes the node off the canvas but leaves the definition registered, so
      // edits inside it are still the document's and are still reported.
      const root = new Graph()
      currentGraph.value = root
      const { definition, node } = addSubgraph(root, 'Doomed')
      const instance = createTestSubgraphNode(definition)
      root.add(instance)
      const { emitted, stop } = install('document')

      root.remove(instance)
      node.mode = LGraphEventMode.NEVER

      expect([...root.subgraphs.values()]).toContain(definition)
      expect(emitted).toHaveLength(1)
      stop()
    })
  })
})
