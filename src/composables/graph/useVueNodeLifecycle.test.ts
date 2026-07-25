import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

const shouldRenderVueNodes = vi.hoisted(() => ({ value: false }))
const canvas = vi.hoisted(() => ({ graph: null as LGraph | null }))

vi.mock('@/composables/useVueFeatureFlags', () => ({
  useVueFeatureFlags: () => ({ shouldRenderVueNodes })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get canvas() {
      return canvas.graph ? canvas : null
    },
    setDirty: vi.fn()
  }
}))

vi.mock('@/renderer/core/layout/sync/useLayoutSync', () => ({
  useLayoutSync: () => ({ startSync: vi.fn(), stopSync: vi.fn() })
}))

const { useVueNodeLifecycle } =
  await import('@/composables/graph/useVueNodeLifecycle')

describe('useVueNodeLifecycle layout seeding', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    shouldRenderVueNodes.value = false
    canvas.graph = null
    layoutStore.initializeFromLiteGraph([])
  })

  it('leaves layoutStore untouched while the Vue renderer is off', () => {
    const graph = new LGraph()
    canvas.graph = graph

    graph.add(new LGraphNode('test'))

    // The minimap picks its data source by asking whether layoutStore has
    // nodes, so an unpopulated store is what keeps it on the litegraph source.
    expect(layoutStore.getAllNodes().value.size).toBe(0)
  })

  it('seeds and drops entries for the graph being viewed', () => {
    const graph = new LGraph()
    canvas.graph = graph
    shouldRenderVueNodes.value = true

    const lifecycle = useVueNodeLifecycle()
    lifecycle.initializeVueNodeLayout()

    const node = new LGraphNode('test')
    node.pos = [120, 340]
    graph.add(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value?.position).toEqual({
      x: 120,
      y: 340
    })

    graph.remove(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value).toBeNull()
  })

  it('stops seeding once disposed', () => {
    const graph = new LGraph()
    canvas.graph = graph
    shouldRenderVueNodes.value = true

    const lifecycle = useVueNodeLifecycle()
    lifecycle.initializeVueNodeLayout()
    lifecycle.disposeVueNodeLayout()

    const node = new LGraphNode('test')
    graph.add(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value).toBeNull()
  })

  it('ignores adds to a graph that is not being viewed', () => {
    const viewed = new LGraph()
    canvas.graph = viewed
    shouldRenderVueNodes.value = true

    const lifecycle = useVueNodeLifecycle()
    lifecycle.initializeVueNodeLayout()

    const offscreen = new LGraph()
    const node = new LGraphNode('interior')
    offscreen.add(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value).toBeNull()
  })
})
