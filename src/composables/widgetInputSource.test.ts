import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  isWidgetInputConnected,
  resolveWidgetInputSource
} from './widgetInputSource'

vi.mock(import('@/scripts/app'))
vi.mock(import('vue-router'))
vi.mock(import('@vueuse/router'), async () => {
  const { ref } = await import('vue')
  return { useRouteHash: () => ref('') }
})

function addConnectedHost(subgraph: Subgraph) {
  const host = createTestSubgraphNode(subgraph)
  app.rootGraph.add(host)
  const source = new LGraphNode('LoadImage')
  source.addOutput('IMAGE', 'IMAGE')
  app.rootGraph.add(source)
  source.connect(0, host, 0)
  return { host, source }
}

function hostedConsumer() {
  const subgraph = createTestSubgraph({
    rootGraph: app.rootGraph,
    inputs: [{ name: 'image', type: 'IMAGE' }]
  })
  app.rootGraph.subgraphs.set(subgraph.id, subgraph)
  const { host, source } = addConnectedHost(subgraph)

  const consumer = new LGraphNode('Consumer')
  consumer.id = toNodeId(99)
  const input = consumer.addInput('image', 'IMAGE')
  subgraph.add(consumer)
  subgraph.inputNode.slots[0].connect(input, consumer)

  return { subgraph, host, source, consumer }
}

describe('resolveWidgetInputSource', () => {
  it('follows the input out through the subgraph node the widget is promoted to', () => {
    const { host, source, consumer } = hostedConsumer()

    expect(resolveWidgetInputSource(consumer, 0, host.id)).toBe(source)
  })

  it('follows the input out through the only instance of the opened subgraph', () => {
    const { subgraph, source, consumer } = hostedConsumer()
    useCanvasStore().currentGraph = subgraph

    expect(resolveWidgetInputSource(consumer, 0, consumer.id)).toBe(source)
  })

  it('stops at the subgraph boundary when the opened subgraph has several instances', () => {
    const { subgraph, consumer } = hostedConsumer()
    app.rootGraph.add(createTestSubgraphNode(subgraph))
    useCanvasStore().currentGraph = subgraph

    expect(resolveWidgetInputSource(consumer, 0, consumer.id)).toBeUndefined()
  })

  it('follows the input out through the instance the subgraph was opened from', async () => {
    const { subgraph, consumer } = hostedConsumer()
    const opened = addConnectedHost(subgraph)
    stubCanvasGetContext()
    const canvas = new LGraphCanvas(
      document.createElement('canvas'),
      app.rootGraph,
      { skip_render: true, skip_events: true }
    )
    useCanvasStore().canvas = canvas
    await nextTick()
    useSubgraphNavigationStore()

    canvas.openSubgraph(subgraph, opened.host)

    expect(resolveWidgetInputSource(consumer, 0, consumer.id)).toBe(
      opened.source
    )
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
  it('follows the subgraph node input the widget is promoted to', () => {
    const { host, consumer } = hostedConsumer()
    expect(isWidgetInputConnected(consumer, 0, host.id)).toBe(true)

    host.disconnectInput(0)

    expect(isWidgetInputConnected(consumer, 0, host.id)).toBe(false)
  })

  it('treats a subgraph input as connected when the instance cannot be identified', () => {
    const { subgraph, host, consumer } = hostedConsumer()
    app.rootGraph.add(createTestSubgraphNode(subgraph))
    useCanvasStore().currentGraph = subgraph
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
