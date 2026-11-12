import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraph as Graph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { provideNodeChangeSource } from '@/platform/nodeApi/nodeChanges'
import type { NodeChangeScope } from '@/platform/nodeApi/nodeChanges'

import { useCanvasStore } from './canvasStore'
import { installNodeChangeBridge } from './nodeChangeBridge'

type CanvasStore = ReturnType<typeof useCanvasStore>

let canvasStore: CanvasStore

type NodeChangeSource = Parameters<typeof provideNodeChangeSource>[0]
type NodeChangeReport = Parameters<Parameters<NodeChangeSource>[1]>[0]

const captured: { provider?: NodeChangeSource } = {}
vi.mock(import('@/platform/nodeApi/nodeChanges'), { spy: true })

function graphWithNode() {
  const graph = new Graph()
  const node = new LGraphNode('Sampler')
  graph.add(node)
  return { graph, node }
}

function install(scope: NodeChangeScope = 'visible') {
  installNodeChangeBridge()
  const emitted: NodeChangeReport[] = []
  const stop = captured.provider!(scope, (change) => emitted.push(change))
  onTestFinished(stop)
  return { emitted, stop }
}

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
    captured.provider = undefined
    vi.mocked(provideNodeChangeSource).mockImplementation((provider) => {
      captured.provider = provider
    })
    canvasStore = useCanvasStore()
    canvasStore.currentGraph = null
  })

  it('reports a tracked change on the graph that is on screen', () => {
    const { graph, node } = graphWithNode()
    canvasStore.currentGraph = graph
    const { emitted } = install()

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
  })

  it('follows a graph switch before the next Vue flush and lets go of the previous graph', async () => {
    const outer = graphWithNode()
    canvasStore.currentGraph = outer.graph
    const { emitted } = install()

    const inner = graphWithNode()
    canvasStore.currentGraph = inner.graph

    inner.node.mode = LGraphEventMode.NEVER
    expect(emitted).toHaveLength(1)

    outer.node.mode = LGraphEventMode.NEVER
    expect(emitted).toHaveLength(1)

    await nextTick()
    inner.node.mode = LGraphEventMode.ALWAYS
    expect(emitted).toHaveLength(2)
  })

  it('ignores a property the published union does not name', () => {
    const { graph, node } = graphWithNode()
    canvasStore.currentGraph = graph
    const { emitted } = install()

    graph.trigger('node:property:changed', {
      nodeId: node.id,
      property: 'somethingNew',
      oldValue: 1,
      newValue: 2
    })

    expect(emitted).toEqual([])
  })

  it('detaches from the graph when the subscription ends', () => {
    const { graph, node } = graphWithNode()
    canvasStore.currentGraph = graph
    const { emitted, stop } = install()

    stop()
    node.mode = LGraphEventMode.NEVER

    expect(emitted).toEqual([])
  })

  describe('document scope', () => {
    it('reports a change inside a subgraph nobody is looking at', () => {
      const root = new Graph()
      canvasStore.currentGraph = root
      const { definition, node } = addSubgraph(root, 'Upscale')
      const { emitted } = install('document')

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
    })

    it('is not what the default scope reports', () => {
      const root = new Graph()
      canvasStore.currentGraph = root
      const { node } = addSubgraph(root, 'Upscale')
      const { emitted } = install()

      node.mode = LGraphEventMode.NEVER

      expect(emitted).toEqual([])
    })

    it('picks up a definition created after the subscription', () => {
      const root = new Graph()
      canvasStore.currentGraph = root
      const { emitted } = install('document')

      const { node } = addSubgraph(root, 'Late')
      node.mode = LGraphEventMode.NEVER

      expect(emitted).toHaveLength(1)
    })

    it('keeps watching a definition whose last instance is removed', () => {
      const root = new Graph()
      canvasStore.currentGraph = root
      const { definition, node } = addSubgraph(root, 'Doomed')
      const instance = createTestSubgraphNode(definition)
      root.add(instance)
      const { emitted } = install('document')

      root.remove(instance)
      node.mode = LGraphEventMode.NEVER

      expect([...root.subgraphs.values()]).toContain(definition)
      expect(emitted).toHaveLength(1)
    })
  })
})
