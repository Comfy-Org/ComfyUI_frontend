import { createApp, defineComponent, h, nextTick, onBeforeUnmount } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { toGroupId } from '@comfyorg/graph-model/groupId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { toSelectableKey } from '@/core/selection/selectionState'
import { useSelectionStore } from '@/core/selection/selectionStore'

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

  it('leaves out a group that shares an id with a node', () => {
    const { graph, first, comfy } = graphWithNodes()

    useSelectionStore().apply(graphScopeOf(graph), {
      type: 'selection.replace',
      keys: [toSelectableKey('group', toGroupId(Number(first.id)))]
    })

    expect(comfy.graph.selection()).toEqual([])
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

  it('says nothing when only a selected group changes', async () => {
    const { graph, first, comfy, select } = graphWithNodes()
    select(first.id)
    const changed = vi.fn()
    comfy.onSelectionChanged(changed)

    useSelectionStore().apply(graphScopeOf(graph), {
      type: 'selection.replace',
      keys: [
        toSelectableKey('node', first.id),
        toSelectableKey('group', toGroupId(7))
      ]
    })
    await nextTick()

    expect(changed).not.toHaveBeenCalled()
    expect(comfy.graph.selection()).toEqual([comfy.graph.node(first.id)])
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

  it('keeps telling another pack after the component that subscribed first unmounts', async () => {
    const { first, comfy, select } = graphWithNodes()
    const PackPanel = defineComponent({
      setup() {
        onBeforeUnmount(comfy.onSelectionChanged(vi.fn()))
        return () => h('div')
      }
    })
    const panel = createApp(PackPanel)
    panel.mount(document.createElement('div'))
    const otherPack = vi.fn()
    comfy.onSelectionChanged(otherPack)

    panel.unmount()
    select(first.id)
    await nextTick()

    expect(otherPack).toHaveBeenCalledExactlyOnceWith([
      comfy.graph.node(first.id)
    ])
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
