import { assert, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { addDynamicCombo } from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { detachNodeFromStores } from '@/core/graph/nodeShell/nodeShellLifecycle'
import { useWidgetValueStore } from './widgetValueStore'

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

  it('ignores invalid saved widget names without losing valid siblings or poisoning other graphs', () => {
    const graph = new LGraph()
    const node = new LGraphNode('component owner')
    node.configure({
      ...node.serialize(),
      properties: {
        [sample.wireKey]: {
          '': sample.wire,
          '\ud800': sample.wire,
          'model:日本語': sample.wire
        }
      }
    })
    graph.add(node)

    expect(graph.nodes).toContain(node)
    expect(node.serialize().properties?.[sample.wireKey]).toEqual({
      'model:日本語': sample.wire
    })

    const other = new LGraph()
    const sibling = new LGraphNode('other component owner')
    other.add(sibling)
    configure(sibling)
    expect(sibling.serialize().properties?.[sample.wireKey]).toEqual({
      model: sample.wire
    })
    graph.clear()
    expect(useStore().get(widgetId(other.id, sibling.id, 'model'))).toEqual(
      sample.component
    )
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

  it('updates reactive consumers when a node gains, loses and restores components', () => {
    const graph = new LGraph()
    const node = new LGraphNode('owner')
    graph.add(node)
    const sibling = new LGraphNode('sibling')
    graph.add(sibling)
    configure(sibling)
    const store = useStore()
    const id = widgetId(graph.id, node.id, 'model')
    const current = computed(() => store.get(id))
    expect(current.value).toBeUndefined()

    configure(node)
    expect(current.value).toEqual(sample.component)

    node.configure({ ...node.serialize(), properties: {} })
    expect(current.value).toBeUndefined()

    configure(node)
    expect(current.value).toEqual(sample.component)

    graph.clear()
    expect(current.value).toBeUndefined()
  })

  it('preserves components for the same widget type but discards them when its id is recycled for another type', () => {
    const graph = new LGraph()
    const node = new LGraphNode('owner')
    node.addWidget('text', 'model', 'value', () => {})
    graph.add(node)
    configure(node)
    const id = widgetId(graph.id, node.id, 'model')
    const widgets = useWidgetValueStore()

    widgets.registerWidget(id, { type: 'text', value: 'next', options: {} })
    expect(useStore().get(id)).toEqual(sample.component)

    widgets.registerWidget(id, { type: 'number', value: 17, options: {} })

    expect(node.serialize().properties).not.toHaveProperty(sample.wireKey)
  })

  it('discards node components even when no widget order is registered', () => {
    const graph = new LGraph()
    const node = new LGraphNode('owner')
    const sibling = new LGraphNode('sibling')
    graph.add(node)
    graph.add(sibling)
    configure(node)
    configure(sibling)

    useWidgetValueStore().releaseNodeWidgets(graph.id, node.id, {
      discardValues: true
    })

    expect(node.serialize().properties).not.toHaveProperty(sample.wireKey)
    expect(sibling.serialize().properties?.[sample.wireKey]).toEqual({
      model: sample.wire
    })
  })

  it('copies component metadata before the shell discards its stores', () => {
    const graph = new LGraph()
    const node = new LGraphNode('owner')
    graph.add(node)
    configure(node)

    detachNodeFromStores(graph, node, 'discard-values')

    expect(node.properties[sample.wireKey]).toEqual({ model: sample.wire })
    expect(useStore().get(widgetId(graph.id, node.id, 'model'))).toBeUndefined()
  })

  it("does not serialize another node's components while a copy awaits identity resolution", () => {
    const graph = new LGraph()
    const original = new LGraphNode('owner')
    graph.add(original)
    configure(original)
    const copy = new LGraphNode('copy')
    copy.graph = graph
    copy.id = original.id
    copy.properties = { extensionData: 'keep' }

    expect(copy.serialize().properties).toEqual({ extensionData: 'keep' })
    expect(original.serialize().properties?.[sample.wireKey]).toEqual({
      model: sample.wire
    })
  })

  it('clears only the destroyed graph, including components without live widgets or nodes', () => {
    const graph = new LGraph()
    const otherGraph = new LGraph()
    const node = new LGraphNode('owner')
    const otherNode = new LGraphNode('other owner')
    graph.add(node)
    otherGraph.add(otherNode)
    configure(node)
    configure(otherNode)
    const orphanId = toNodeId(791)
    const graphId = graph.id
    useStore().adoptNode(graphId, orphanId, {
      [sample.wireKey]: { model: sample.wire }
    })

    graph.clear()

    expect(useStore().get(widgetId(graphId, orphanId, 'model'))).toBeUndefined()
    expect(useStore().get(widgetId(graphId, node.id, 'model'))).toBeUndefined()
    expect(
      useStore().get(widgetId(otherGraph.id, otherNode.id, 'model'))
    ).toEqual(sample.component)
  })
})
