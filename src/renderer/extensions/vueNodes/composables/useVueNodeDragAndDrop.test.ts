import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { isDropEventHandled } from '@/utils/eventUtils'

import { useVueNodeDragAndDrop } from './useVueNodeDragAndDrop'

vi.mock('@/scripts/app', () => ({
  app: {
    dragOverNode: null,
    canvas: { setDirty: vi.fn() },
    handleFileDrop: vi.fn().mockResolvedValue(undefined)
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
    app.dragOverNode = null
    vi.mocked(app.handleFileDrop).mockClear()
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

  it('lets URI-only drops bubble without invoking the node drop handler', async () => {
    const onDragOver = vi.fn(() => true)
    const onDragDrop = vi.fn().mockResolvedValue(true)
    const node = {
      id: 1,
      onDragOver,
      onDragDrop
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/uri-list', 'https://example.com/image.png')

    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      vi.fn()
    )
    handleDragOver(createDragEvent('dragover', dataTransfer))

    const dropEvent = createDragEvent('drop', dataTransfer)
    await handleDrop(dropEvent)

    expect(onDragDrop).not.toHaveBeenCalled()
    expect(dropEvent.defaultPrevented).toBe(false)
    expect(isDropEventHandled(dropEvent)).toBe(false)
    expect(app.dragOverNode).toBeNull()
  })

  it('marks accepted drops handled and invokes the node drop handler', async () => {
    const onDragOver = vi.fn(() => true)
    const onDragDrop = vi.fn().mockResolvedValue(true)
    const node = {
      id: 1,
      onDragOver,
      onDragDrop
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(
      new File(['image'], 'image.png', { type: 'image/png' })
    )

    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      vi.fn()
    )
    handleDragOver(createDragEvent('dragover', dataTransfer))

    const dropEvent = createDragEvent('drop', dataTransfer)
    await handleDrop(dropEvent)

    expect(onDragDrop).toHaveBeenCalledWith(dropEvent)
    expect(dropEvent.defaultPrevented).toBe(true)
    expect(isDropEventHandled(dropEvent)).toBe(true)
    expect(app.dragOverNode).toBeNull()
  })

  it('delegates declined node drops to the document file fallback once', async () => {
    const onDragOver = vi.fn(() => true)
    const onDragDrop = vi.fn().mockResolvedValue(false)
    const node = {
      id: 1,
      onDragOver,
      onDragDrop
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(
      new File(['image'], 'image.png', { type: 'image/png' })
    )

    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      vi.fn()
    )
    handleDragOver(createDragEvent('dragover', dataTransfer))

    const dropEvent = createDragEvent('drop', dataTransfer)
    await handleDrop(dropEvent)

    expect(onDragDrop).toHaveBeenCalledOnce()
    expect(app.handleFileDrop).toHaveBeenCalledWith(dropEvent, {
      skipNodeRouting: true
    })
    expect(isDropEventHandled(dropEvent)).toBe(true)
    expect(app.dragOverNode).toBeNull()
  })

  it('reports rejected node drops and clears drag-over ownership', async () => {
    const error = new Error('Upload failed')
    const onError = vi.fn()
    const onDragOver = vi.fn(() => true)
    const onDragDrop = vi.fn().mockRejectedValue(error)
    const node = {
      id: 1,
      onDragOver,
      onDragDrop
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(
      new File(['image'], 'image.png', { type: 'image/png' })
    )

    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      onError
    )
    handleDragOver(createDragEvent('dragover', dataTransfer))

    const dropEvent = createDragEvent('drop', dataTransfer)
    await handleDrop(dropEvent)

    expect(onError).toHaveBeenCalledWith(error)
    expect(app.handleFileDrop).not.toHaveBeenCalled()
    expect(isDropEventHandled(dropEvent)).toBe(true)
    expect(app.dragOverNode).toBeNull()
  })
})
