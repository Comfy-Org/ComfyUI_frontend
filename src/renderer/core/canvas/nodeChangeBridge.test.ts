import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraph as Graph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'

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

/** Captures the provider the bridge pushes down to the API. */
const captured = vi.hoisted(() => ({
  provider: undefined as
    | ((emit: (...args: unknown[]) => void) => () => void)
    | undefined
}))
vi.mock('@/platform/nodeApi/nodeChanges', () => ({
  provideNodeChangeSource: (provider: never) => {
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
function install() {
  installNodeChangeBridge()
  const emitted: unknown[][] = []
  const stop = captured.provider!((...args) => emitted.push(args))
  return { emitted, stop }
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
      [String(node.id), 'mode', LGraphEventMode.ALWAYS, LGraphEventMode.NEVER]
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
})
