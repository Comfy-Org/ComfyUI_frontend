import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { useNodeDragAndDrop } from './useNodeDragAndDrop'

class FakeDragEvent extends DragEvent {
  override dataTransfer: DataTransfer | null

  constructor(type: string, dataTransfer: DataTransfer | null) {
    super(type)
    this.dataTransfer = dataTransfer
  }
}

function createItemsOnlyDataTransfer(file: File): DataTransfer {
  const source = new DataTransfer()
  source.items.add(file)

  return {
    items: source.items,
    files: [] as unknown as FileList,
    types: [],
    getData: () => '',
    setData: () => {},
    clearData: () => {},
    dropEffect: 'none',
    effectAllowed: 'all',
    setDragImage: () => {}
  } as unknown as DataTransfer
}

function createUriTransferWithBmpPlaceholder(): DataTransfer {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(
    new File([''], 'placeholder.bmp', { type: 'image/bmp' })
  )
  dataTransfer.setData('text/uri-list', 'https://example.com/image.png')
  return dataTransfer
}

describe('useNodeDragAndDrop', () => {
  it('drops files from dataTransfer.items when dataTransfer.files is empty', async () => {
    const node = {} as LGraphNode
    const onDrop = vi.fn().mockResolvedValue([])

    useNodeDragAndDrop(node, {
      onDrop,
      fileFilter: (file) => file.name.endsWith('.png')
    })

    const file = new File([''], 'image.png', { type: '' })
    const event = new FakeDragEvent('drop', createItemsOnlyDataTransfer(file))

    await expect(node.onDragDrop?.(event)).resolves.toBe(true)
    expect(onDrop).toHaveBeenCalledWith([file])
  })

  it('ignores bmp placeholders so URI drags are not treated as file-backed', async () => {
    const node = {} as LGraphNode
    const onDrop = vi.fn().mockResolvedValue([])

    useNodeDragAndDrop(node, {
      onDrop
    })

    const event = new FakeDragEvent('drop', createUriTransferWithBmpPlaceholder())

    await expect(node.onDragDrop?.(event)).resolves.toBe(false)
    expect(onDrop).not.toHaveBeenCalled()
  })
})
