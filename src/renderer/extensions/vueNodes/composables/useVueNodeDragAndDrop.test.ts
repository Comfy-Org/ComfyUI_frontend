import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { isDropEventHandled } from '@/utils/eventUtils'

import { useVueNodeDragAndDrop } from './useVueNodeDragAndDrop'

vi.mock<unknown>(import('@/scripts/app'), () => ({
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
    await handleDrop(createDragEvent('drop', dataTransfer))

    expect(onDragOver).toHaveBeenCalledTimes(2)
    expect(onDragDrop).not.toHaveBeenCalled()
  })

  it('keeps URI-only transfers on the document fallback path', async () => {
    const onDragDrop = vi.fn().mockResolvedValue(true)
    const node = {
      id: 1,
      onDragOver: vi.fn().mockReturnValue(true),
      onDragDrop
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/uri-list', 'https://example.com/image.png')

    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      vi.fn()
    )
    handleDragOver(createDragEvent('dragover', dataTransfer))
    const event = createDragEvent('drop', dataTransfer)
    await handleDrop(event)

    expect(onDragDrop).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    expect(isDropEventHandled(event)).toBe(false)
  })

  it('treats a zero-byte BMP placeholder with URI data as URI-only', async () => {
    const onDragDrop = vi.fn().mockResolvedValue(true)
    const node = {
      id: 1,
      onDragOver: vi.fn().mockReturnValue(true),
      onDragDrop
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(
      new File([], 'placeholder.bmp', { type: 'image/bmp' })
    )
    dataTransfer.setData('text/uri-list', 'https://example.com/image.png')

    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      vi.fn()
    )
    handleDragOver(createDragEvent('dragover', dataTransfer))
    const event = createDragEvent('drop', dataTransfer)
    await handleDrop(event)

    expect(onDragDrop).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    expect(isDropEventHandled(event)).toBe(false)
  })

  it('keeps a non-empty BMP on the local node drop path', async () => {
    const onDragDrop = vi.fn().mockResolvedValue(true)
    const node = {
      id: 1,
      onDragOver: vi.fn().mockReturnValue(true),
      onDragDrop
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(
      new File([new Uint8Array([0x42, 0x4d])], 'image.bmp', {
        type: 'image/bmp'
      })
    )

    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      vi.fn()
    )
    handleDragOver(createDragEvent('dragover', dataTransfer))
    const event = createDragEvent('drop', dataTransfer)
    await handleDrop(event)

    expect(onDragDrop).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
    expect(isDropEventHandled(event)).toBe(true)
  })

  it('clears drag ownership only when the active node owns it', () => {
    const node = {
      id: 1,
      onDragOver: vi.fn().mockReturnValue(true),
      onDragDrop: vi.fn()
    } as unknown as LGraphNode
    const otherNode = {
      id: 2,
      onDragDrop: vi.fn()
    } as unknown as LGraphNode
    const nodeRef = shallowRef<LGraphNode | null>(node)
    const { handleDragLeave } = useVueNodeDragAndDrop(nodeRef, vi.fn())

    app.dragOverNode = otherNode
    handleDragLeave()
    expect(app.dragOverNode).toBe(otherNode)

    app.dragOverNode = node
    handleDragLeave()
    expect(app.dragOverNode).toBeNull()
  })

  it('reports rejected async drops and clears owned drag state', async () => {
    const error = new Error('drop failed')
    const onError = vi.fn()
    const node = {
      id: 1,
      onDragOver: vi.fn().mockReturnValue(true),
      onDragDrop: vi.fn().mockRejectedValue(error)
    } as unknown as LGraphNode
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(['x'], 'image.png', { type: 'image/png' }))
    const { handleDragOver, handleDrop } = useVueNodeDragAndDrop(
      shallowRef<LGraphNode | null>(node),
      onError
    )

    handleDragOver(createDragEvent('dragover', dataTransfer))
    expect(app.dragOverNode).toBe(node)

    const event = createDragEvent('drop', dataTransfer)
    await handleDrop(event)

    expect(onError).toHaveBeenCalledWith(error)
    expect(app.dragOverNode).toBeNull()
    expect(event.defaultPrevented).toBe(true)
    expect(isDropEventHandled(event)).toBe(true)
  })

  it('falls back to app file handling when a node accepts hover but declines drop', async () => {
    const node = {
      id: 1,
      onDragOver: vi.fn().mockReturnValue(true),
      onDragDrop: vi.fn().mockReturnValue(false)
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
    const event = createDragEvent('drop', dataTransfer)
    await handleDrop(event)

    expect(app.handleFileDrop).toHaveBeenCalledWith(event, {
      skipNodeRouting: true
    })
    expect(event.defaultPrevented).toBe(true)
    expect(isDropEventHandled(event)).toBe(true)
  })
})
