import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useRuntimeWidgetReflow } from '@/renderer/extensions/vueNodes/layout/useRuntimeWidgetReflow'
import { toNodeId } from '@/types/nodeId'

let rafCallbacks: FrameRequestCallback[] = []

function flushFrame() {
  const callbacks = rafCallbacks
  rafCallbacks = []
  for (const callback of callbacks) callback(0)
}

function mountReflow(getNode: () => LGraphNode | null, nodeId = getNode()!.id) {
  return render(
    defineComponent({
      setup() {
        useRuntimeWidgetReflow(nodeId, getNode)
        return () => null
      }
    })
  )
}

describe('useRuntimeWidgetReflow', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.initializeFromLiteGraph([])
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    cleanup()
    flushFrame()
    rafCallbacks = []
    vi.unstubAllGlobals()
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

  it('reflows the node when a runtime widget grows it (widget-count idiom)', () => {
    const { node } = setup()
    const layoutRef = layoutStore.getNodeLayoutRef(node.id)
    expect(layoutRef.value?.size.height).toBe(100)

    mountReflow(() => node)

    // rgthree "Add Lora": push a custom widget, then set the height directly,
    // bypassing the `set size` setter exactly as the extension does.
    node.addCustomWidget({ type: 'custom', name: 'lora_1', value: 0 } as never)
    node.size[1] = 124
    flushFrame()

    expect(layoutRef.value?.size.height).toBe(124)
    expect(layoutRef.value?.size.width).toBe(210)
  })

  it('reflows the node when an image preview grows it (no widget-count change)', () => {
    const { node } = setup()
    const layoutRef = layoutStore.getNodeLayoutRef(node.id)
    const initialWidgetCount = node.widgets?.length ?? 0

    mountReflow(() => node)

    // Impact-Pack `img.onload`: grow height directly, no widget added.
    node.size[1] = 300
    flushFrame()

    expect(node.widgets?.length ?? 0).toBe(initialWidgetCount)
    expect(layoutRef.value?.size.height).toBe(300)
    expect(layoutRef.value?.size.width).toBe(210)
  })

  it('does not emit a resize when the node has not grown', () => {
    const { node } = setup()
    const layoutRef = layoutStore.getNodeLayoutRef(node.id)

    let changes = 0
    const unsubscribe = layoutStore.onNodeChange(node.id, () => {
      changes++
    })

    mountReflow(() => node)

    node.addCustomWidget({ type: 'custom', name: 'noop', value: 0 } as never)
    flushFrame()

    unsubscribe()
    expect(changes).toBe(0)
    expect(layoutRef.value?.size.height).toBe(100)
  })

  it('does not clobber a pending resize when layout is larger than the node', () => {
    const { node } = setup()
    const { setSource, resizeNode } = useLayoutMutations()

    // Simulate a programmatic grow that reached layoutStore first while
    // node.size still trails (layout leads, node.size is smaller).
    setSource(LayoutSource.External)
    resizeNode(node.id, { width: 210, height: 400 })
    const layoutRef = layoutStore.getNodeLayoutRef(node.id)
    expect(layoutRef.value?.size.height).toBe(400)

    mountReflow(() => node)
    flushFrame()

    // Growth-only guard: the smaller node.size must not shrink the layout.
    expect(layoutRef.value?.size.height).toBe(400)
  })

  it('does not reflow when the node has gone away', () => {
    const { node } = setup()

    let changes = 0
    const unsubscribe = layoutStore.onNodeChange(node.id, () => {
      changes++
    })

    mountReflow(() => null, node.id)
    node.size[1] = 300
    flushFrame()

    unsubscribe()
    expect(changes).toBe(0)
  })

  it('exits safely when the node has no layout entry', () => {
    setup()
    const orphan = new LGraphNode('orphan')
    orphan.id = toNodeId('orphan-999')
    orphan.size[0] = 180
    orphan.size[1] = 90
    expect(layoutStore.getNodeLayoutRef(orphan.id).value).toBeNull()

    mountReflow(() => orphan)
    orphan.size[1] = 300
    flushFrame()

    expect(layoutStore.getNodeLayoutRef(orphan.id).value).toBeNull()
  })
})
