import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useCanvasDrop } from '@/composables/useCanvasDrop'
import { usePragmaticDroppable } from '@/composables/usePragmaticDragAndDrop'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'

const insertWorkflow = vi.hoisted(() => vi.fn())

vi.mock(import('@/composables/usePragmaticDragAndDrop'), () => ({
  usePragmaticDraggable: vi.fn(),
  usePragmaticDroppable: vi.fn()
}))

vi.mock<unknown>(
  import('@/composables/element/useCanvasPositionConversion'),
  () => ({
    useSharedCanvasPositionConversion: () => ({
      clientPosToCanvasPos: (pos: [number, number]) => pos
    })
  })
)

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({ useWorkflowService: () => ({ insertWorkflow }) })
)

vi.mock<unknown>(import('@/services/litegraphService'), () => ({
  useLitegraphService: () => ({ addNodeOnGraph: vi.fn() })
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { canvas: { selectOnly: false } }
}))

function registerDrop() {
  const scope = effectScope()
  scope.run(() => useCanvasDrop(ref(document.createElement('canvas'))))
  const onDrop = vi.mocked(usePragmaticDroppable).mock.lastCall?.[1].onDrop
  if (!onDrop) throw new Error('canvas drop target was not registered')
  return onDrop
}

describe('useCanvasDrop', () => {
  it.for([
    { selectOnly: false, inserts: 1 },
    { selectOnly: true, inserts: 0 }
  ])(
    'a sidebar workflow dropped with selectOnly=$selectOnly is inserted $inserts times',
    async ({ selectOnly, inserts }) => {
      app.canvas.selectOnly = selectOnly
      const onDrop = registerDrop()

      await onDrop(
        fromPartial({
          location: { current: { input: { clientX: 10, clientY: 20 } } },
          source: {
            data: {
              type: 'tree-explorer-node',
              data: {
                data: new ComfyWorkflow({
                  path: 'workflows/dropped.json',
                  modified: 0,
                  size: 0
                })
              }
            }
          }
        })
      )

      expect(insertWorkflow).toHaveBeenCalledTimes(inserts)
    }
  )
})
