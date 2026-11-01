import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  isWidgetInputConnected,
  resolveWidgetInputSource
} from './widgetInputSource'

vi.mock(import('@/scripts/app'))
vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))
vi.mock<unknown>(import('vue-router'), () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}))

function hostedConsumer() {
  const rootGraph = app.rootGraph
  const subgraph = createTestSubgraph({
    rootGraph,
    inputs: [{ name: 'image', type: 'IMAGE' }]
  })
  rootGraph.subgraphs.set(subgraph.id, subgraph)
  const host = createTestSubgraphNode(subgraph)
  rootGraph.add(host)

  const source = new LGraphNode('LoadImage')
  source.addOutput('IMAGE', 'IMAGE')
  rootGraph.add(source)
  source.connect(0, host, 0)

  const consumer = new LGraphNode('Consumer')
  consumer.id = toNodeId(99)
  const input = consumer.addInput('image', 'IMAGE')
  subgraph.add(consumer)
  subgraph.inputNode.slots[0].connect(input, consumer)

  return { subgraph, host, source, consumer }
}

describe('resolveWidgetInputSource', () => {
  beforeEach(() => {
    useSubgraphNavigationStore().restoreState([])
  })

  it('follows the input out through the subgraph node the widget is promoted to', () => {
    const { host, source, consumer } = hostedConsumer()

    expect(resolveWidgetInputSource(consumer, 0, host.id)).toBe(source)
  })

  it('follows the input out through the only instance of the opened subgraph', () => {
    const { subgraph, source, consumer } = hostedConsumer()
    useSubgraphNavigationStore().restoreState([subgraph.id])

    expect(resolveWidgetInputSource(consumer, 0, consumer.id)).toBe(source)
  })

  it('stops at the subgraph boundary when the opened subgraph has several instances', () => {
    const { subgraph, consumer } = hostedConsumer()
    app.rootGraph.add(createTestSubgraphNode(subgraph))
    useSubgraphNavigationStore().restoreState([subgraph.id])

    expect(resolveWidgetInputSource(consumer, 0, consumer.id)).toBeUndefined()
  })

  it('resolves a root graph input directly', () => {
    const source = new LGraphNode('LoadImage')
    source.addOutput('IMAGE', 'IMAGE')
    app.rootGraph.add(source)
    const consumer = new LGraphNode('Consumer')
    consumer.addInput('image', 'IMAGE')
    app.rootGraph.add(consumer)
    source.connect(0, consumer, 0)

    expect(resolveWidgetInputSource(consumer, 0, consumer.id)).toBe(source)
  })
})

describe('isWidgetInputConnected', () => {
  beforeEach(() => {
    useSubgraphNavigationStore().restoreState([])
  })

  it('follows the subgraph node input the widget is promoted to', () => {
    const { host, consumer } = hostedConsumer()
    expect(isWidgetInputConnected(consumer, 0, host.id)).toBe(true)

    host.disconnectInput(0)

    expect(isWidgetInputConnected(consumer, 0, host.id)).toBe(false)
  })

  it('treats a subgraph input as connected when the instance cannot be identified', () => {
    const { subgraph, host, consumer } = hostedConsumer()
    app.rootGraph.add(createTestSubgraphNode(subgraph))
    useSubgraphNavigationStore().restoreState([subgraph.id])
    host.disconnectInput(0)

    expect(isWidgetInputConnected(consumer, 0, consumer.id)).toBe(true)
  })

  it('reports an unlinked input as disconnected', () => {
    const consumer = new LGraphNode('Consumer')
    consumer.addInput('image', 'IMAGE')
    app.rootGraph.add(consumer)

    expect(isWidgetInputConnected(consumer, 0, consumer.id)).toBe(false)
  })
})
