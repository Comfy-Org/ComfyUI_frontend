import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import { useVueNodeDragAndDrop } from './useVueNodeDragAndDrop'

vi.mock('@/scripts/app', () => ({
  app: {
    dragOverNode: null,
    canvas: { setDirty: vi.fn() }
  }
}))

function createDragEvent(type: string, dataTransfer: DataTransfer): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: dataTransfer
  })
  return event as DragEvent
}

describe('useVueNodeDragAndDrop', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    app.dragOverNode = null
  })

  it('revalidates drop acceptance instead of reusing hover acceptance', async () => {
    const onDragOver = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
    const onDragDrop = vi.fn().mockResolvedValue(true)
    const node = {
      id: 1,
      onDragOver,
      onDragDrop
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(
      new File(['{}'], 'workflow.json', { type: 'application/json' })
    )

    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      vi.fn()
    )
    handleDragOver(createDragEvent('dragover', dataTransfer))

    expect(app.dragOverNode).toBe(node)

    const dropEvent = createDragEvent('drop', dataTransfer)
    await handleDrop(dropEvent)

    expect(onDragOver).toHaveBeenCalledTimes(2)
    expect(onDragDrop).not.toHaveBeenCalled()
    expect(dropEvent.defaultPrevented).toBe(false)
    expect(app.dragOverNode).toBeNull()
  })
})
