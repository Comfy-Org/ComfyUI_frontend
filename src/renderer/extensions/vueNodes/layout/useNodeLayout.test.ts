import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { useNodeLayout } from './useNodeLayout'

const FIRST_WORKFLOW: UUID = 'first-workflow'
const SECOND_WORKFLOW: UUID = 'second-workflow'
const NODE = toNodeId('7')

const state = vi.hoisted<{
  canvasStore: { rootGraphId: UUID | undefined } | null
}>(() => ({ canvasStore: null }))

vi.mock('@/renderer/core/canvas/canvasStore', async () => {
  const { reactive } = await import('vue')
  state.canvasStore = reactive({ rootGraphId: undefined })
  return { useCanvasStore: () => state.canvasStore }
})

const NodeLayoutHost = defineComponent({
  setup() {
    const { position } = useNodeLayout(NODE)
    return () => position.value.x
  }
})

describe('useNodeLayout', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
    state.canvasStore!.rootGraphId = FIRST_WORKFLOW
  })

  it('transfers its retained ref when the workflow changes', async () => {
    const { unmount } = render(NodeLayoutHost)
    const firstRef = layoutStore.getNodeLayoutRef(FIRST_WORKFLOW, NODE)
    const otherHolder = layoutStore.retainNodeLayoutRef(SECOND_WORKFLOW, NODE)

    state.canvasStore!.rootGraphId = SECOND_WORKFLOW
    await nextTick()
    otherHolder.release()

    expect(layoutStore.getNodeLayoutRef(FIRST_WORKFLOW, NODE)).not.toBe(
      firstRef
    )
    expect(layoutStore.getNodeLayoutRef(SECOND_WORKFLOW, NODE)).toBe(
      otherHolder.layout
    )

    unmount()
    expect(layoutStore.getNodeLayoutRef(SECOND_WORKFLOW, NODE)).not.toBe(
      otherHolder.layout
    )
  })
})
