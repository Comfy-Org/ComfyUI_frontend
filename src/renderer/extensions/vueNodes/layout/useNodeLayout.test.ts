import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { useNodeLayout } from './useNodeLayout'

const FIRST_WORKFLOW: UUID = 'first-workflow'
const SECOND_WORKFLOW: UUID = 'second-workflow'
const NODE = toNodeId('7')

function createNode(graphId: UUID, x: number): void {
  layoutStore.applyOperation({
    type: 'createNode',
    graphId,
    nodeId: NODE,
    layout: {
      id: NODE,
      position: { x, y: 0 },
      size: { width: 200, height: 100 },
      zIndex: 0,
      visible: true,
      bounds: { x, y: 0, width: 200, height: 100 }
    },
    timestamp: 1,
    source: LayoutSource.Canvas,
    actor: 'test'
  })
}

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
    createNode(FIRST_WORKFLOW, 100)
    createNode(SECOND_WORKFLOW, 200)
    state.canvasStore!.rootGraphId = FIRST_WORKFLOW
  })

  it('follows layout changes when the workflow changes', async () => {
    const { container } = render(NodeLayoutHost)
    expect(container.textContent).toBe('100')

    state.canvasStore!.rootGraphId = SECOND_WORKFLOW
    await nextTick()
    expect(container.textContent).toBe('200')

    layoutStore.applyOperation({
      type: 'moveNode',
      graphId: SECOND_WORKFLOW,
      nodeId: NODE,
      position: { x: 300, y: 0 },
      timestamp: 2,
      source: LayoutSource.Canvas,
      actor: 'test'
    })
    await nextTick()
    expect(container.textContent).toBe('300')
  })
})
