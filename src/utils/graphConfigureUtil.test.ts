import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  fixLinkInputSlots,
  hasLegacyLinkInputSlotMismatch
} from '@/utils/litegraphUtil'

import { addAfterConfigureHandler } from './graphConfigureUtil'

vi.mock('@/utils/litegraphUtil', () => ({
  fixLinkInputSlots: vi.fn(),
  hasLegacyLinkInputSlotMismatch: vi.fn()
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
  } as Partial<LGraph> as LGraph
}

describe('addAfterConfigureHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs legacy slot repair when mismatch is detected', () => {
    vi.mocked(hasLegacyLinkInputSlotMismatch).mockReturnValue(true)
    const graph = createConfigureGraph()

    addAfterConfigureHandler(graph, () => undefined)
    graph.onConfigure!.call(
      graph,
      {} as Parameters<NonNullable<LGraph['onConfigure']>>[0]
    )

    expect(hasLegacyLinkInputSlotMismatch).toHaveBeenCalledWith(graph)
    expect(fixLinkInputSlots).toHaveBeenCalledWith(graph)
  })

  it('skips legacy slot repair when no mismatch is present', () => {
    vi.mocked(hasLegacyLinkInputSlotMismatch).mockReturnValue(false)
    const graph = createConfigureGraph()

    addAfterConfigureHandler(graph, () => undefined)
    graph.onConfigure!.call(
      graph,
      {} as Parameters<NonNullable<LGraph['onConfigure']>>[0]
    )

    expect(hasLegacyLinkInputSlotMismatch).toHaveBeenCalledWith(graph)
    expect(fixLinkInputSlots).not.toHaveBeenCalled()
  })
})
