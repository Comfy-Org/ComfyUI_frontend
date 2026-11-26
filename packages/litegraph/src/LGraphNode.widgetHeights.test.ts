import { describe, expect, it } from 'vitest'

import type { ISerialisedNode } from './litegraph'
import { LGraph, LGraphNode } from './litegraph'
import { useWidgetHeightStore } from '@comfyorg/graph-state/widgetHeightStore'
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

    expect(store.get(widgetId(graph.id, node.id, 'text'))).toEqual({
      height: 120
    })
    expect(store.get(widgetId(graph.id, node.id, 'image'))).toBe(undefined)

    store.set(widgetId(graph.id, node.id, 'image'), { height: 80.4 })

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
      useWidgetHeightStore().get(widgetId(graph.id, node.id, 'text'))
    ).toBe(undefined)
    expect(node.serialize().properties?.widgetHeights).toBe(undefined)
  })

  it('keeps the heights of a node configured before it joins a graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Prompt')
    node.configure(savedNode({ text: 120 }))
    graph.add(node)

    expect(
      useWidgetHeightStore().get(widgetId(graph.id, node.id, 'text'))
    ).toEqual({ height: 120 })
    expect(node.serialize().properties?.widgetHeights).toEqual({ text: 120 })
  })

  it('keeps the heights of a node configured against its graph before it is added under a reminted id', () => {
    const graph = new LGraph()
    const original = new LGraphNode('Prompt')
    graph.add(original)
    original.configure(savedNode({ text: 120 }))
    const pasted = new LGraphNode('Prompt')
    pasted.graph = graph
    pasted.configure({ ...savedNode({ text: 240 }), id: original.id })

    expect(pasted.serialize().properties?.widgetHeights).toEqual({ text: 240 })

    graph.add(pasted)
    const store = useWidgetHeightStore()

    expect(pasted.id).not.toBe(original.id)
    expect(store.get(widgetId(graph.id, original.id, 'text'))).toEqual({
      height: 120
    })
    expect(store.get(widgetId(graph.id, pasted.id, 'text'))).toEqual({
      height: 240
    })
  })

  it('drops a reset height and forgets the rest when the node is removed', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Prompt')
    graph.add(node)
    node.configure(savedNode({ text: 120, image: 90 }))
    const store = useWidgetHeightStore()

    store.set(widgetId(graph.id, node.id, 'text'), undefined)
    expect(node.serialize().properties?.widgetHeights).toEqual({ image: 90 })
    graph.remove(node)

    expect(store.get(widgetId(graph.id, node.id, 'image'))).toBe(undefined)
  })
})
