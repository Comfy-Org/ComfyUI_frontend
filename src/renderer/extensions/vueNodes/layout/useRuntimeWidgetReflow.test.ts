import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useRuntimeWidgetReflow } from '@/renderer/extensions/vueNodes/layout/useRuntimeWidgetReflow'
import { toNodeId } from '@/types/nodeId'

function mountReflow(node: LGraphNode) {
  return render(
    defineComponent({
      setup() {
        useRuntimeWidgetReflow(
          node.id,
          () => node,
          () => node.widgets?.length ?? 0
        )
        return () => null
      }
    })
  )
}

describe('useRuntimeWidgetReflow', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.initializeFromLiteGraph([])
  })

  function setup() {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.size[0] = 210
    node.size[1] = 100
    graph.add(node)

    // Registers the node in layoutStore with its current size.
    useGraphNodeManager(graph)

    return { graph, node }
  }

  it('commits height to layoutStore when a widget is added at runtime', async () => {
    const { node } = setup()
    const layoutRef = layoutStore.getNodeLayoutRef(node.id)
    expect(layoutRef.value?.size.height).toBe(100)

    mountReflow(node)

    // Emulate rgthree "Add Lora": push a custom widget, then set the height
    // directly (bypassing the `set size` setter, exactly as the extension does).
    node.addCustomWidget({ type: 'custom', name: 'lora_1', value: 0 } as never)
    node.size[1] = 124
    await nextTick()

    expect(layoutRef.value?.size.height).toBe(124)
    expect(layoutRef.value?.size.width).toBe(210)
  })

  it('does not emit a resize when the node size is unchanged', async () => {
    const { node } = setup()
    const layoutRef = layoutStore.getNodeLayoutRef(node.id)
    await nextTick()

    let changes = 0
    const unsubscribe = layoutStore.onNodeChange(node.id, () => {
      changes++
    })

    mountReflow(node)

    // Widget added but the extension left node.size untouched.
    node.addCustomWidget({ type: 'custom', name: 'noop', value: 0 } as never)
    await nextTick()

    unsubscribe()
    expect(changes).toBe(0)
    expect(layoutRef.value?.size.height).toBe(100)
  })

  it('does not reflow when the node has gone away', async () => {
    const { node } = setup()
    const widgetCount = ref(0)

    let changes = 0
    const unsubscribe = layoutStore.onNodeChange(node.id, () => {
      changes++
    })

    render(
      defineComponent({
        setup() {
          useRuntimeWidgetReflow(
            node.id,
            () => null,
            () => widgetCount.value
          )
          return () => null
        }
      })
    )

    widgetCount.value = 1
    await nextTick()

    unsubscribe()
    expect(changes).toBe(0)
  })

  it('exits safely when the node has no layout entry', async () => {
    setup()
    const orphan = new LGraphNode('orphan')
    orphan.id = toNodeId('orphan-999')
    orphan.size[0] = 180
    orphan.size[1] = 90
    const widgetCount = ref(0)

    expect(layoutStore.getNodeLayoutRef(orphan.id).value).toBeNull()

    render(
      defineComponent({
        setup() {
          useRuntimeWidgetReflow(
            orphan.id,
            () => orphan,
            () => widgetCount.value
          )
          return () => null
        }
      })
    )

    widgetCount.value = 1
    await nextTick()

    expect(layoutStore.getNodeLayoutRef(orphan.id).value).toBeNull()
  })
})
