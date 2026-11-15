import { describe, expect, it } from 'vitest'

import type { ISerialisedNode } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetHeightStore } from '@/stores/widgetHeightStore'
import { widgetId } from '@comfyorg/graph-model/widgetId'

function savedNode(widgetHeights: Record<string, number | string>) {
  return {
    ...new LGraphNode('Prompt').serialize(),
    properties: { widgetHeights }
  } satisfies ISerialisedNode
}

describe('LGraphNode widget heights', () => {
  it('serves saved heights by widget id and writes them back on serialize', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Prompt')
    graph.add(node)
    node.configure(savedNode({ text: 120, image: 'tall' }))
    const store = useWidgetHeightStore()

    expect(store.getHeight(widgetId(graph.id, node.id, 'text'))).toBe(120)
    expect(store.getHeight(widgetId(graph.id, node.id, 'image'))).toBe(
      undefined
    )

    store.setHeight(widgetId(graph.id, node.id, 'image'), 80.4)

    expect(node.serialize().properties?.widgetHeights).toEqual({
      text: 120,
      image: 80
    })
  })

  it('forgets heights when the node is reconfigured without saved heights', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Prompt')
    graph.add(node)
    node.configure(savedNode({ text: 120 }))
    node.configure(new LGraphNode('Prompt').serialize())

    expect(
      useWidgetHeightStore().getHeight(widgetId(graph.id, node.id, 'text'))
    ).toBe(undefined)
    expect(node.serialize().properties?.widgetHeights).toBe(undefined)
  })

  it('keeps the heights of a node configured before it joins a graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Prompt')
    node.configure(savedNode({ text: 120 }))
    graph.add(node)

    expect(
      useWidgetHeightStore().getHeight(widgetId(graph.id, node.id, 'text'))
    ).toBe(120)
    expect(node.serialize().properties?.widgetHeights).toEqual({ text: 120 })
  })

  it('drops a reset height and forgets the rest when the node is removed', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Prompt')
    graph.add(node)
    node.configure(savedNode({ text: 120, image: 90 }))
    const store = useWidgetHeightStore()

    store.setHeight(widgetId(graph.id, node.id, 'text'), undefined)
    expect(node.serialize().properties?.widgetHeights).toEqual({ image: 90 })
    graph.remove(node)

    expect(store.getHeight(widgetId(graph.id, node.id, 'image'))).toBe(
      undefined
    )
  })
})
