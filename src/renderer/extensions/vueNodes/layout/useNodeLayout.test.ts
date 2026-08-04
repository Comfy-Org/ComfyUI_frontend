import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { useNodeLayout } from './useNodeLayout'

const FIRST_WORKFLOW = 'first-workflow' as UUID
const SECOND_WORKFLOW = 'second-workflow' as UUID
const NODE = toNodeId('7')

const canvasStore = vi.hoisted(() => ({
  rootGraphId: undefined as UUID | undefined
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

  it('releases the ref from the graph it was created in', () => {
    const { unmount } = render(NodeLayoutHost)
    const cleanupNodeRef = vi.spyOn(layoutStore, 'cleanupNodeRef')

    // Loading a workflow flips rootGraphId before the outgoing graph unmounts.
    canvasStore.rootGraphId = SECOND_WORKFLOW
    unmount()

    expect(cleanupNodeRef).toHaveBeenCalledWith(FIRST_WORKFLOW, NODE)
  })
})
