import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, shallowReactive, shallowRef } from 'vue'
import type { EffectScope } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

const shouldRenderVueNodes = shallowRef(false)
const canvas = shallowReactive({ graph: null as LGraph | null })

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
  let scope: EffectScope | undefined

  // The shared composable only tears down once every owning scope stops.
  function mountLifecycle() {
    scope = effectScope()
    const lifecycle = scope.run(() => useVueNodeLifecycle())
    if (!lifecycle) {
      throw new Error('Failed to mount useVueNodeLifecycle')
    }
    return lifecycle
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    shouldRenderVueNodes.value = false
    canvas.graph = null
    layoutStore.initializeFromLiteGraph([])
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  it('leaves layoutStore untouched while the Vue renderer is off', () => {
    const graph = new LGraph()
    canvas.graph = graph
    mountLifecycle()

    graph.add(new LGraphNode('test'))

    // The minimap picks its data source by asking whether layoutStore has
    // nodes, so an unpopulated store is what keeps it on the litegraph source.
    expect(layoutStore.getAllNodes().value.size).toBe(0)
  })

  it('seeds and drops entries for the graph being viewed', () => {
    const graph = new LGraph()
    canvas.graph = graph
    shouldRenderVueNodes.value = true

    mountLifecycle()

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

    const lifecycle = mountLifecycle()

    const seeded = new LGraphNode('seeded')
    graph.add(seeded)
    expect(layoutStore.getNodeLayoutRef(seeded.id).value).not.toBeNull()

    lifecycle.disposeVueNodeLayout()

    const node = new LGraphNode('test')
    graph.add(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value).toBeNull()
  })

  it('ignores adds to a graph that is not being viewed', () => {
    const viewed = new LGraph()
    canvas.graph = viewed
    shouldRenderVueNodes.value = true

    mountLifecycle()

    const offscreen = new LGraph()
    const node = new LGraphNode('interior')
    offscreen.add(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value).toBeNull()
  })
})
