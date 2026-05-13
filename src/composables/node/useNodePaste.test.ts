import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodePaste } from './useNodePaste'

function createNode(overrides: Record<string, unknown> = {}): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    ...overrides
  })
}

function createFile(name: string, type = 'image/png'): File {
  return new File(['data'], name, { type })
}

describe('useNodePaste', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('pasteFiles calls onPaste with filtered files', () => {
    const onPaste = vi.fn().mockResolvedValue('ok')
    const node = createNode()
    const keep = createFile('keep.png')
    const skip = createFile('skip.jpg', 'image/jpeg')

    useNodePaste(node, {
      onPaste,
      fileFilter: (file) => file.type === 'image/png',
      allow_batch: true
    })

    const result = node.pasteFiles?.([keep, skip])

    expect(result).toBe(true)
    expect(onPaste).toHaveBeenCalledWith([keep])
  })

  it('pasteFiles returns false when no files match filter', () => {
    const onPaste = vi.fn().mockResolvedValue('ok')
    const node = createNode()

    useNodePaste(node, {
      onPaste,
      fileFilter: () => false
    })

    const result = node.pasteFiles?.([createFile('ignored.png')])

    expect(result).toBe(false)
    expect(onPaste).not.toHaveBeenCalled()
  })

  it('pasteFiles limits to first file when allow_batch is false', () => {
    const onPaste = vi.fn().mockResolvedValue('ok')
    const node = createNode()
    const first = createFile('first.png')
    const second = createFile('second.png')

    useNodePaste(node, { onPaste, allow_batch: false })

    const result = node.pasteFiles?.([first, second])

    expect(result).toBe(true)
    expect(onPaste).toHaveBeenCalledWith([first])
  })

  it('pasteFiles passes all files when allow_batch is true', () => {
    const onPaste = vi.fn().mockResolvedValue('ok')
    const node = createNode()
    const first = createFile('first.png')
    const second = createFile('second.png')

    useNodePaste(node, { onPaste, allow_batch: true })

    const result = node.pasteFiles?.([first, second])

    expect(result).toBe(true)
    expect(onPaste).toHaveBeenCalledWith([first, second])
  })

  it('onRemoved clears pasteFiles and chains existing onRemoved', () => {
    const previousOnRemoved = vi.fn()
    const node = createNode({ onRemoved: previousOnRemoved })

    useNodePaste(node, { onPaste: vi.fn().mockResolvedValue('ok') })
    expect(node.pasteFiles).toBeTypeOf('function')

    node.onRemoved?.call(node)

    expect(previousOnRemoved).toHaveBeenCalledTimes(1)
    expect(node.pasteFiles).toBeUndefined()
  })

  it('onRemoved preserves pasteFiles replaced by another extension', () => {
    const node = createNode()
    useNodePaste(node, { onPaste: vi.fn().mockResolvedValue('ok') })

    const replacementPasteFiles = vi.fn()
    node.pasteFiles = replacementPasteFiles

    node.onRemoved?.call(node)

    expect(node.pasteFiles).toBe(replacementPasteFiles)
  })
})
