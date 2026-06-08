import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeFileInput } from './useNodeFileInput'

function createNode(overrides: Record<string, unknown> = {}): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    ...overrides
  })
}

function createFile(name: string, type = 'image/png'): File {
  return new File(['data'], name, { type })
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: fromAny<FileList, unknown>(files)
  })
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.defineProperty(input, 'value', {
    configurable: true,
    writable: true,
    value
  })
}

describe('useNodeFileInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a file input with configured attributes and defaults', () => {
    const fileInput = document.createElement('input')
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(fileInput)

    const node = createNode()
    useNodeFileInput(node, { onSelect: vi.fn() })

    expect(createElementSpy).toHaveBeenCalledWith('input')
    expect(fileInput.type).toBe('file')
    expect(fileInput.accept).toBe('*')
    expect(fileInput.multiple).toBe(false)
  })

  it('uses provided accept and allow_batch options', () => {
    const fileInput = document.createElement('input')
    vi.spyOn(document, 'createElement').mockReturnValue(fileInput)

    const node = createNode()
    useNodeFileInput(node, {
      onSelect: vi.fn(),
      accept: 'image/*',
      allow_batch: true
    })

    expect(fileInput.accept).toBe('image/*')
    expect(fileInput.multiple).toBe(true)
  })

  it('calls onSelect with filtered files and resets value on change', () => {
    const fileInput = document.createElement('input')
    vi.spyOn(document, 'createElement').mockReturnValue(fileInput)

    const onSelect = vi.fn()
    const node = createNode()
    const keep = createFile('keep.png')
    const skip = createFile('skip.jpg', 'image/jpeg')

    useNodeFileInput(node, {
      onSelect,
      fileFilter: (file) => file.type === 'image/png'
    })

    setInputFiles(fileInput, [keep, skip])
    setInputValue(fileInput, 'C:\\fakepath\\keep.png')

    fileInput.onchange?.(new Event('change'))

    expect(onSelect).toHaveBeenCalledWith([keep])
    expect(fileInput.value).toBe('')
  })

  it('does not call onSelect for empty file list and still resets value', () => {
    const fileInput = document.createElement('input')
    vi.spyOn(document, 'createElement').mockReturnValue(fileInput)

    const onSelect = vi.fn()
    const node = createNode()

    useNodeFileInput(node, { onSelect })

    setInputFiles(fileInput, [])
    setInputValue(fileInput, 'C:\\fakepath\\empty.png')
    fileInput.onchange?.(new Event('change'))

    expect(onSelect).not.toHaveBeenCalled()
    expect(fileInput.value).toBe('')
  })

  it('resets value before invoking onSelect so it is cleared even on throw', () => {
    const fileInput = document.createElement('input')
    vi.spyOn(document, 'createElement').mockReturnValue(fileInput)

    const node = createNode()
    const onSelect = vi.fn(() => {
      throw new Error('boom')
    })

    useNodeFileInput(node, { onSelect })

    setInputFiles(fileInput, [createFile('test.png')])
    setInputValue(fileInput, 'C:\\fakepath\\test.png')

    expect(() => fileInput.onchange?.(new Event('change'))).toThrow('boom')
    expect(fileInput.value).toBe('')
  })

  it('does not call onSelect when all files are filtered out', () => {
    const fileInput = document.createElement('input')
    vi.spyOn(document, 'createElement').mockReturnValue(fileInput)

    const onSelect = vi.fn()
    const node = createNode()

    useNodeFileInput(node, {
      onSelect,
      fileFilter: () => false
    })

    setInputFiles(fileInput, [createFile('ignored.png')])
    fileInput.onchange?.(new Event('change'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('openFileSelection clicks the generated input', () => {
    const fileInput = document.createElement('input')
    const clickSpy = vi.spyOn(fileInput, 'click')
    vi.spyOn(document, 'createElement').mockReturnValue(fileInput)

    const node = createNode()
    const { openFileSelection } = useNodeFileInput(node, { onSelect: vi.fn() })

    openFileSelection()

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('cleans up on removal, chains existing callback, and no-ops after removal', () => {
    const fileInput = document.createElement('input')
    const clickSpy = vi.spyOn(fileInput, 'click')
    vi.spyOn(document, 'createElement').mockReturnValue(fileInput)

    const previousOnRemoved = vi.fn()
    const node = createNode({ onRemoved: previousOnRemoved })
    const { openFileSelection } = useNodeFileInput(node, { onSelect: vi.fn() })

    expect(fileInput.onchange).toBeTypeOf('function')

    node.onRemoved?.call(node)

    expect(previousOnRemoved).toHaveBeenCalledTimes(1)
    expect(fileInput.onchange).toBeNull()

    openFileSelection()
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
