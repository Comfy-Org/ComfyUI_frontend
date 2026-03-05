import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { fixLinkInputSlots } from '@/utils/litegraphUtil'
import { triggerCallbackOnAllNodes } from '@/utils/graphTraversalUtil'

import { addAfterConfigureHandler } from './graphConfigureUtil'

vi.mock('@/utils/litegraphUtil', () => ({
  fixLinkInputSlots: vi.fn()
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  triggerCallbackOnAllNodes: vi.fn()
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: { setPendingSlotSync: vi.fn() }
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotElementTracking',
  () => ({
    flushScheduledSlotLayoutSync: vi.fn()
  })
)

function createConfigureGraph(): LGraph {
  return {
    nodes: [],
    onConfigure: vi.fn()
  } satisfies Partial<LGraph> as unknown as LGraph
}

describe('addAfterConfigureHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs legacy slot repair on configure', () => {
    const graph = createConfigureGraph()

    addAfterConfigureHandler(graph, () => undefined)
    graph.onConfigure!.call(
      graph,
      {} as Parameters<NonNullable<LGraph['onConfigure']>>[0]
    )

    expect(fixLinkInputSlots).toHaveBeenCalledWith(graph)
  })

  it('runs onAfterGraphConfigured even if onConfigure throws', () => {
    const graph = createConfigureGraph()
    graph.onConfigure = vi.fn(() => {
      throw new Error('onConfigure failed')
    })

    addAfterConfigureHandler(graph, () => undefined)

    expect(() =>
      graph.onConfigure!.call(
        graph,
        {} as Parameters<NonNullable<LGraph['onConfigure']>>[0]
      )
    ).toThrow('onConfigure failed')

    expect(triggerCallbackOnAllNodes).toHaveBeenCalledWith(
      graph,
      'onAfterGraphConfigured'
    )
  })
})
