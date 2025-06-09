import type { LGraphNode } from '@comfyorg/litegraph'
import { describe, expect, it, vi } from 'vitest'

import { useNodeImagePreview } from '@/composables/node/useNodeImagePreview'

// Mock dependencies
vi.mock('@/composables/widgets/useImagePreviewWidget', () => ({
  useImagePreviewWidget: vi.fn(() =>
    vi.fn(() => ({
      name: '$$node-image-preview',
      value: '',
      onRemove: vi.fn()
    }))
  )
}))

describe('useNodeImagePreview', () => {
  const mockNode = {
    id: 'test-node',
    widgets: [],
    setDirtyCanvas: vi.fn()
  } as unknown as LGraphNode

  it('provides showImagePreview and removeImagePreview functions', () => {
    const { showImagePreview, removeImagePreview } = useNodeImagePreview()

    expect(showImagePreview).toBeDefined()
    expect(removeImagePreview).toBeDefined()
    expect(typeof showImagePreview).toBe('function')
    expect(typeof removeImagePreview).toBe('function')
  })

  it('shows image preview for single image', () => {
    const { showImagePreview } = useNodeImagePreview()

    showImagePreview(mockNode, 'test-image.png')

    expect(mockNode.setDirtyCanvas).toHaveBeenCalledWith(true)
  })

  it('shows image preview for multiple images', () => {
    const { showImagePreview } = useNodeImagePreview()

    showImagePreview(mockNode, ['image1.png', 'image2.png'], {
      allow_batch: true
    })

    expect(mockNode.setDirtyCanvas).toHaveBeenCalledWith(true)
  })

  it('removes image preview widget', () => {
    const mockWidget = {
      name: '$$node-image-preview',
      onRemove: vi.fn()
    }

    const nodeWithWidget = {
      ...mockNode,
      widgets: [mockWidget]
    } as unknown as LGraphNode

    const { removeImagePreview } = useNodeImagePreview()

    removeImagePreview(nodeWithWidget)

    expect(mockWidget.onRemove).toHaveBeenCalled()
    expect(nodeWithWidget.widgets).toHaveLength(0)
  })
})
