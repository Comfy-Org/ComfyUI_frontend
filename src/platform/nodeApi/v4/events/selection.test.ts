import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

import { apiOnTestCanvas } from './__tests__/testCanvasSource'

function graphWithNodes() {
  const graph = new LGraph()
  const first = new LGraphNode('First')
  const second = new LGraphNode('Second')
  graph.add(first)
  graph.add(second)
  return { graph, first, second, ...apiOnTestCanvas(graph) }
}

describe('onSelectionChanged', () => {
  it('passes the selected nodes of the graph on screen in the graph order, frozen', async () => {
    const { first, second, comfy, select } = graphWithNodes()
    const selections: (readonly unknown[])[] = []
    comfy.onSelectionChanged((nodes) => selections.push(nodes))

    select(second.id, first.id)
    await nextTick()

    expect(selections).toEqual([comfy.graph.nodes()])
    expect(Object.isFrozen(selections[0])).toBe(true)
  })

  it('says nothing when the same nodes are selected again', async () => {
    const { first, comfy, select } = graphWithNodes()
    select(first.id)
    const changed = vi.fn()
    comfy.onSelectionChanged(changed)

    select(first.id)
    await nextTick()

    expect(changed).not.toHaveBeenCalled()

    select()
    await nextTick()

    expect(changed).toHaveBeenCalledExactlyOnceWith([])
  })

  it('reads the selection in the graph the user moves to', async () => {
    const { first, comfy, select, show } = graphWithNodes()
    const other = new LGraph()
    const elsewhere = new LGraphNode('Elsewhere')
    other.add(elsewhere)
    select(first.id)
    await nextTick()
    const changed = vi.fn()
    comfy.onSelectionChanged(changed)

    show(other)
    select(elsewhere.id)
    await nextTick()

    expect(changed).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ graphId: other.id })
    ])
  })

  it('passes a frozen empty list when the graph leaves the screen', async () => {
    const { first, comfy, select, show } = graphWithNodes()
    select(first.id)
    const selections: (readonly unknown[])[] = []
    comfy.onSelectionChanged((nodes) => selections.push(nodes))

    show(null)
    await nextTick()

    expect(selections).toEqual([[]])
    expect(Object.isFrozen(selections[0])).toBe(true)
  })

  it('is empty while there is no graph on screen', async () => {
    const { comfy, select } = apiOnTestCanvas(null)
    const changed = vi.fn()
    comfy.onSelectionChanged(changed)

    select(toNodeId(1))
    await nextTick()

    expect(changed).not.toHaveBeenCalled()
  })

  it('stops following the selection when its last listener leaves', async () => {
    const { first, comfy, select } = graphWithNodes()
    const changed = vi.fn()
    const stop = comfy.onSelectionChanged(changed)

    stop()
    stop()
    select(first.id)
    await nextTick()

    expect(changed).not.toHaveBeenCalled()
  })

  it('hears nothing before the renderer supplies a canvas', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(() => comfy.onSelectionChanged(vi.fn())()).not.toThrow()
  })

  it('refuses a listener that is not a function', () => {
    const { comfy } = graphWithNodes()

    expect(() =>
      Reflect.apply(comfy.onSelectionChanged, comfy, [undefined])
    ).toThrow(TypeError)
  })
})
