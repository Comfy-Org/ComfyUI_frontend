import { assert, describe, expect, it } from 'vitest'

import { addDynamicCombo } from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import { widgetId } from '@comfyorg/graph-model/widgetId'

import { widgetComponentStores } from './widgetComponents'

const samples = {
  widgetFolderLock: {
    wireKey: 'widget_folder_locks',
    wire: ['MOSS', 'image'],
    component: { directory: ['MOSS', 'image'] }
  },
  widgetHeight: {
    wireKey: 'widgetHeights',
    wire: 137,
    component: { height: 137 }
  }
} satisfies Record<
  ReturnType<(typeof widgetComponentStores)[number]>['$id'],
  { wireKey: string; wire: NodeProperty; component: object }
>

describe.for(
  widgetComponentStores.map((useStore) => ({ name: useStore.$id, useStore }))
)('$name widget component contract', ({ name, useStore }) => {
  const sample = samples[name]

  function configure(node: LGraphNode) {
    node.configure({
      ...node.serialize(),
      properties: { [sample.wireKey]: { model: sample.wire, broken: false } }
    })
  }

  it('round-trips valid entries even while widgets are absent, and replaces a restored snapshot', () => {
    const graph = new LGraph()
    const node = new LGraphNode('component owner')
    graph.add(node)
    configure(node)
    const id = widgetId(graph.id, node.id, 'model')
    const store = useStore()

    expect(store.get(id)).toEqual(sample.component)
    expect(node.properties).not.toHaveProperty(sample.wireKey)
    expect(node.serialize().properties?.[sample.wireKey]).toEqual({
      model: sample.wire
    })

    node.configure({ ...node.serialize(), properties: {} })

    expect(store.get(id)).toBeUndefined()
    expect(node.serialize().properties).not.toHaveProperty(sample.wireKey)
  })

  it('does not restore cleared components from a missing-node serialization cache', () => {
    const graph = new LGraph()
    const node = new LGraphNode(
      'missing component owner',
      'MissingComponentOwner'
    )
    graph.add(node)
    const cached = {
      ...node.serialize(),
      properties: {
        extensionData: 'keep',
        [sample.wireKey]: { model: sample.wire }
      }
    }
    node.last_serialization = cached
    node.configure(cached)
    node.configure({
      ...node.serialize(),
      properties: { extensionData: 'keep' }
    })
    node.pos = [31, 79]
    node.mode = LGraphEventMode.BYPASS

    const saved = graph.serialize()
    const serialized = saved.nodes[0]
    assert(serialized)

    expect(serialized.properties).toEqual({ extensionData: 'keep' })
    expect(serialized.pos).toEqual([31, 79])
    expect(serialized.mode).toBe(LGraphEventMode.BYPASS)
    expect(cached.properties[sample.wireKey]).toEqual({ model: sample.wire })

    const restored = new LGraph()
    restored.configure(saved)
    const reloaded = restored.getNodeById(node.id)
    assert(reloaded)
    expect(reloaded.serialize().properties).toEqual({ extensionData: 'keep' })
    expect(
      useStore().get(widgetId(restored.id, reloaded.id, 'model'))
    ).toBeUndefined()
  })

  it('preserves components when configure omits properties', () => {
    const graph = new LGraph()
    const node = new LGraphNode('component owner')
    graph.add(node)
    configure(node)
    const { properties, ...withoutProperties } = node.serialize()
    expect(properties?.[sample.wireKey]).toEqual({ model: sample.wire })

    node.configure(withoutProperties)

    expect(useStore().get(widgetId(graph.id, node.id, 'model'))).toEqual(
      sample.component
    )
  })

  it('preserves components while a dynamic option temporarily removes its widgets', () => {
    const graph = new LGraph()
    const node = new LGraphNode('component owner')
    graph.add(node)
    addDynamicCombo(node, [['STRING'], ['IMAGE']])
    const selector = node.widgets?.[0]
    const child = node.widgets?.[1]
    assert(selector)
    assert(child)
    node.configure({
      ...node.serialize(),
      properties: { [sample.wireKey]: { [child.name]: sample.wire } }
    })

    selector.value = '1'
    selector.value = '0'

    expect(node.widgets?.[1]?.name).toBe(child.name)
    expect(useStore().get(widgetId(graph.id, node.id, child.name))).toEqual(
      sample.component
    )
    expect(node.serialize().properties?.[sample.wireKey]).toEqual({
      [child.name]: sample.wire
    })
  })

  it('moves components with a widget rename and deletes them with the widget', () => {
    const graph = new LGraph()
    const node = new LGraphNode('component owner')
    const widget = node.addWidget('text', 'model', 'value', () => {})
    graph.add(node)
    configure(node)
    const original = widgetId(graph.id, node.id, 'model')
    const renamed = widgetId(graph.id, node.id, 'renamed')

    widget.name = 'renamed'

    expect(useStore().get(original)).toBeUndefined()
    expect(useStore().get(renamed)).toEqual(sample.component)
    expect(node.serialize().properties?.[sample.wireKey]).toEqual({
      renamed: sample.wire
    })

    node.removeWidget(widget)

    expect(useStore().get(renamed)).toBeUndefined()
    expect(node.serialize().properties).not.toHaveProperty(sample.wireKey)
  })

  it('preserves components across node removal and reattachment under a new identity', () => {
    const graph = new LGraph()
    const node = new LGraphNode('component owner')
    graph.add(node)
    configure(node)
    const original = widgetId(graph.id, node.id, 'model')

    graph.remove(node)

    expect(useStore().get(original)).toBeUndefined()
    expect(node.serialize().properties?.[sample.wireKey]).toEqual({
      model: sample.wire
    })

    const destination = new LGraph()
    destination.add(node)

    expect(useStore().get(widgetId(destination.id, node.id, 'model'))).toEqual(
      sample.component
    )
    expect(useStore().get(original)).toBeUndefined()
    expect(node.properties).not.toHaveProperty(sample.wireKey)
  })

  it('does not resurrect detached components when an override is omitted from a restored snapshot', () => {
    const graph = new LGraph()
    const node = new LGraphNode('component owner')
    graph.add(node)
    const empty = node.serialize()
    configure(node)
    graph.remove(node)

    node.configure(empty)
    graph.add(node)

    expect(useStore().get(widgetId(graph.id, node.id, 'model'))).toBeUndefined()
    expect(node.serialize().properties).not.toHaveProperty(sample.wireKey)
  })

  it('adopts copied components after node identity collision resolution', () => {
    const graph = new LGraph()
    const original = new LGraphNode('original')
    graph.add(original)
    configure(original)
    const copy = new LGraphNode('copy')
    copy.graph = graph
    copy.configure(original.serialize())
    graph.add(copy)

    expect(copy.id).not.toBe(original.id)
    expect(useStore().get(widgetId(graph.id, original.id, 'model'))).toEqual(
      sample.component
    )
    expect(useStore().get(widgetId(graph.id, copy.id, 'model'))).toEqual(
      sample.component
    )
  })

  it('clears only the destroyed graph, including components without live widgets', () => {
    const graph = new LGraph()
    const otherGraph = new LGraph()
    const node = new LGraphNode('owner')
    const otherNode = new LGraphNode('other owner')
    graph.add(node)
    otherGraph.add(otherNode)
    configure(node)
    configure(otherNode)

    graph.clear()

    expect(useStore().get(widgetId(graph.id, node.id, 'model'))).toBeUndefined()
    expect(
      useStore().get(widgetId(otherGraph.id, otherNode.id, 'model'))
    ).toEqual(sample.component)
  })
})
