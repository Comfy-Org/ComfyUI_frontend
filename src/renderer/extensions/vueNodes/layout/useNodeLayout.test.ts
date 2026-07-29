import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { useNodeLayout } from './useNodeLayout'

const FIRST_WORKFLOW: UUID = 'first-workflow'
const SECOND_WORKFLOW: UUID = 'second-workflow'
const NODE = toNodeId('7')

const canvasStore = vi.hoisted<{ rootGraphId: UUID | undefined }>(() => ({
  rootGraphId: undefined
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasStore
}))

const NodeLayoutHost = defineComponent({
  setup() {
    useNodeLayout(NODE)
    return () => null
  }
})

describe('useNodeLayout', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
    canvasStore.rootGraphId = FIRST_WORKFLOW
  })

  it('releases the original graph ref when workflow changes before unmount', () => {
    const { unmount } = render(NodeLayoutHost)
    const cleanupNodeRef = vi.spyOn(layoutStore, 'cleanupNodeRef')

    canvasStore.rootGraphId = SECOND_WORKFLOW
    unmount()

    expect(cleanupNodeRef).toHaveBeenCalledWith(FIRST_WORKFLOW, NODE)
  })
})
