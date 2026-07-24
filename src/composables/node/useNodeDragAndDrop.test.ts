import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDragAndDrop } from './useNodeDragAndDrop'

function createNode(overrides: Record<string, unknown> = {}): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    ...overrides
  })
}

class FakeDragEvent extends DragEvent {
  override dataTransfer: DataTransfer | null

  constructor(type: string, dataTransfer: DataTransfer | null) {
    super(type)
    this.dataTransfer = dataTransfer
  }
}

function createFile(name: string, type = 'image/png'): File {
  return new File(['data'], name, { type })
}

function createItemsOnlyDataTransfer(file: File): DataTransfer {
  const source = new DataTransfer()
  source.items.add(file)

  Object.defineProperty(source, 'files', {
    configurable: true,
    value: new DataTransfer().files
  })

  return source
}

function createUriTransferWithBmpPlaceholder(): DataTransfer {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(
    new File([''], 'placeholder.bmp', { type: 'image/bmp' })
  )
  dataTransfer.setData('text/uri-list', 'https://example.com/image.png')
  return dataTransfer
}

function createDragEvent(options: {
  items?: Array<{ kind: string; file?: File | null }>
  files?: File[]
  types?: string[]
  uri?: string
}): DragEvent {
  const { items = [], files = [], types = [], uri = '' } = options
  return fromAny<DragEvent, unknown>({
    dataTransfer: {
      items: fromAny<DataTransferItemList, unknown>(
        items.map((item) => ({
          kind: item.kind,
          getAsFile: vi.fn(() => item.file ?? null)
        }))
      ),
      files: fromAny<FileList, unknown>(files),
      types,
      getData: vi.fn((format: string) =>
        format === 'text/uri-list' ? uri : ''
      )
    }
  })
}

describe('useNodeDragAndDrop', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('onDragOver detects file items by default', () => {
    const node = createNode()
    useNodeDragAndDrop(node, { onDrop: vi.fn().mockResolvedValue([]) })

    const isDragging = node.onDragOver?.(
      createDragEvent({
        items: [{ kind: 'file', file: createFile('image.png') }]
      })
    )

    expect(isDragging).toBe(true)
  })

  it('onDragOver delegates to custom handler result', () => {
    const node = createNode()
    const onDragOver = vi.fn().mockReturnValue(false)

    useNodeDragAndDrop(node, {
      onDrop: vi.fn().mockResolvedValue([]),
      onDragOver
    })

    const isDragging = node.onDragOver?.(
      createDragEvent({
        items: [{ kind: 'file', file: createFile('image.png') }]
      })
    )

    expect(onDragOver).toHaveBeenCalledTimes(1)
    expect(isDragging).toBe(false)
  })

  it('onDragOver returns false when file items do not pass the file filter', () => {
    const node = createNode()
    useNodeDragAndDrop(node, {
      onDrop: vi.fn().mockResolvedValue([]),
      fileFilter: (file) => file.type === 'image/png'
    })

    const isDragging = node.onDragOver?.(
      createDragEvent({
        items: [
          {
            kind: 'file',
            file: createFile('workflow.json', 'application/json')
          }
        ]
      })
    )

    expect(isDragging).toBe(false)
  })

  it('onDragOver accepts opaque native file items before files are available', () => {
    const node = createNode()
    useNodeDragAndDrop(node, { onDrop: vi.fn().mockResolvedValue([]) })

    const isDragging = node.onDragOver?.(
      createDragEvent({
        items: [{ kind: 'file', file: null }],
        types: ['Files']
      })
    )

    expect(isDragging).toBe(true)
  })

  it('onDragOver returns true for uri list drops without file items', () => {
    const node = createNode()
    useNodeDragAndDrop(node, { onDrop: vi.fn().mockResolvedValue([]) })

    const isDragging = node.onDragOver?.(
      createDragEvent({ items: [{ kind: 'string' }], types: ['text/uri-list'] })
    )

    expect(isDragging).toBe(true)
  })

  it('onDragOver returns false when drag event has no items', () => {
    const node = createNode()
    useNodeDragAndDrop(node, { onDrop: vi.fn().mockResolvedValue([]) })

    const isDragging = node.onDragOver?.(fromAny<DragEvent, unknown>({}))

    expect(isDragging).toBe(false)
  })

  it('onDragDrop calls onDrop with filtered files', async () => {
    const onDrop = vi.fn().mockResolvedValue([])
    const node = createNode()
    const keep = createFile('keep.png')
    const skip = createFile('skip.jpg', 'image/jpeg')

    useNodeDragAndDrop(node, {
      onDrop,
      fileFilter: (file) => file.type === 'image/png'
    })

    const result = await node.onDragDrop?.(
      createDragEvent({ files: [keep, skip], items: [{ kind: 'file' }] })
    )

    expect(result).toBe(true)
    expect(onDrop).toHaveBeenCalledWith([keep])
  })

  it('onDragDrop calls onDrop with files from dataTransfer.items when files is empty', async () => {
    const onDrop = vi.fn().mockResolvedValue([])
    const node = createNode()

    useNodeDragAndDrop(node, {
      onDrop,
      fileFilter: (file) => file.name.endsWith('.png')
    })

    const file = new File([''], 'image.png', { type: '' })
    const event = new FakeDragEvent('drop', createItemsOnlyDataTransfer(file))

    await expect(node.onDragDrop?.(event)).resolves.toBe(true)
    expect(onDrop).toHaveBeenCalledWith([file])
  })

  it('onDragDrop ignores bmp placeholders so uri drags are not treated as file-backed', async () => {
    const node = createNode()
    const onDrop = vi.fn().mockResolvedValue([])

    useNodeDragAndDrop(node, { onDrop })

    const event = new FakeDragEvent(
      'drop',
      createUriTransferWithBmpPlaceholder()
    )

    await expect(node.onDragDrop?.(event)).resolves.toBe(false)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('onDragDrop accepts real bmp files', async () => {
    const node = createNode()
    const onDrop = vi.fn().mockResolvedValue([])
    const file = createFile('image.bmp', 'image/bmp')

    useNodeDragAndDrop(node, { onDrop })

    const result = await node.onDragDrop?.(
      createDragEvent({
        files: [file],
        items: [{ kind: 'file', file }]
      })
    )

    expect(result).toBe(true)
    expect(onDrop).toHaveBeenCalledWith([file])
  })

  it('onDragDrop returns false for invalid drops', async () => {
    const onDrop = vi.fn().mockResolvedValue([])
    const node = createNode()
    useNodeDragAndDrop(node, { onDrop })

    const result = await node.onDragDrop?.(createDragEvent({}))

    expect(result).toBe(false)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('onDragDrop handles same-origin uri drops', async () => {
    const onDrop = vi.fn().mockResolvedValue([])
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fromAny<Response, unknown>({
        ok: true,
        blob: vi
          .fn()
          .mockResolvedValue(new Blob(['uri'], { type: 'image/png' }))
      })
    )
    const uri = `${location.origin}/api/file?filename=uri.png`

    const node = createNode()
    useNodeDragAndDrop(node, { onDrop })

    const result = await node.onDragDrop?.(
      createDragEvent({ uri, types: ['text/uri-list'] })
    )

    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(new URL(uri))
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop.mock.calls[0][0][0]).toBeInstanceOf(File)
    expect(onDrop.mock.calls[0][0][0].name).toBe('uri.png')
  })

  it('onDragDrop returns false for cross-origin uri drops', async () => {
    const node = createNode()
    const onDrop = vi.fn().mockResolvedValue([])
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    useNodeDragAndDrop(node, { onDrop })

    const result = await node.onDragDrop?.(
      createDragEvent({
        uri: 'https://example.com/api/file?filename=uri.png',
        types: ['text/uri-list']
      })
    )

    expect(result).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('onDragDrop returns false when uri fetch throws', async () => {
    const onDrop = vi.fn().mockResolvedValue([])
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    const uri = `${location.origin}/api/file?filename=uri.png`

    const node = createNode()
    useNodeDragAndDrop(node, { onDrop })

    const result = await node.onDragDrop?.(
      createDragEvent({ uri, types: ['text/uri-list'] })
    )

    expect(result).toBe(false)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('onDragDrop returns false when uri response is invalid or filtered out', async () => {
    const onDrop = vi.fn().mockResolvedValue([])
    const uri = `${location.origin}/api/file?filename=uri.jpg`

    const nodeA = createNode()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      fromAny<Response, unknown>({ ok: false })
    )
    useNodeDragAndDrop(nodeA, { onDrop })
    const badResponseResult = await nodeA.onDragDrop?.(
      createDragEvent({ uri, types: ['text/uri-list'] })
    )
    expect(badResponseResult).toBe(false)

    const nodeB = createNode()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      fromAny<Response, unknown>({
        ok: true,
        blob: vi
          .fn()
          .mockResolvedValue(new Blob(['uri'], { type: 'image/jpeg' }))
      })
    )
    useNodeDragAndDrop(nodeB, {
      onDrop,
      fileFilter: (file) => file.type === 'image/png'
    })
    const filteredOutResult = await nodeB.onDragDrop?.(
      createDragEvent({ uri, types: ['text/uri-list'] })
    )

    expect(filteredOutResult).toBe(false)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('onRemoved clears handlers and chains existing onRemoved', () => {
    const previousOnRemoved = vi.fn()
    const node = createNode({ onRemoved: previousOnRemoved })

    useNodeDragAndDrop(node, { onDrop: vi.fn().mockResolvedValue([]) })
    expect(node.onDragOver).toBeTypeOf('function')
    expect(node.onDragDrop).toBeTypeOf('function')

    node.onRemoved?.call(node)

    expect(previousOnRemoved).toHaveBeenCalledTimes(1)
    expect(node.onDragOver).toBeUndefined()
    expect(node.onDragDrop).toBeUndefined()
  })

  it('onRemoved preserves handlers replaced by another extension', () => {
    const node = createNode()
    useNodeDragAndDrop(node, { onDrop: vi.fn().mockResolvedValue([]) })

    const replacementDragOver = vi.fn()
    const replacementDragDrop = vi.fn()
    node.onDragOver = replacementDragOver
    node.onDragDrop = replacementDragDrop

    node.onRemoved?.call(node)

    expect(node.onDragOver).toBe(replacementDragOver)
    expect(node.onDragDrop).toBe(replacementDragDrop)
  })
})
