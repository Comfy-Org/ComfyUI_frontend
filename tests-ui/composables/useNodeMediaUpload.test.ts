import type { LGraphNode } from '@comfyorg/litegraph'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeMediaUpload } from '@/composables/node/useNodeMediaUpload'

// Mock dependencies
vi.mock('@/composables/widgets/useMediaLoaderWidget', () => ({
  useMediaLoaderWidget: vi.fn(() =>
    vi.fn(() => ({
      name: '$$node-media-loader',
      options: {
        onFilesSelected: null
      }
    }))
  )
}))

vi.mock('@/composables/node/useNodeImageUpload', () => ({
  useNodeImageUpload: vi.fn(() => ({
    handleUpload: vi.fn()
  }))
}))

describe('useNodeMediaUpload', () => {
  let mockNode: LGraphNode

  beforeEach(() => {
    mockNode = {
      id: 1,
      widgets: [],
      setDirtyCanvas: vi.fn()
    } as unknown as LGraphNode
  })

  it('creates composable with required methods', () => {
    const { showMediaLoader, removeMediaLoader, addMediaLoaderWidget } =
      useNodeMediaUpload()

    expect(showMediaLoader).toBeInstanceOf(Function)
    expect(removeMediaLoader).toBeInstanceOf(Function)
    expect(addMediaLoaderWidget).toBeInstanceOf(Function)
  })

  it('shows media loader widget with options', () => {
    const { showMediaLoader } = useNodeMediaUpload()
    const options = {
      fileFilter: (file: File) => file.type.startsWith('image/'),
      onUploadComplete: vi.fn(),
      allow_batch: true,
      accept: 'image/*'
    }

    const widget = showMediaLoader(mockNode, options)

    expect(widget).toBeDefined()
    expect(widget.name).toBe('$$node-media-loader')
    expect(mockNode.setDirtyCanvas).toHaveBeenCalledWith(true)
  })

  it('removes media loader widget from node', () => {
    const { showMediaLoader, removeMediaLoader } = useNodeMediaUpload()
    const options = {
      fileFilter: () => true,
      onUploadComplete: vi.fn()
    }

    // Add widget
    showMediaLoader(mockNode, options)
    mockNode.widgets = [
      {
        name: '$$node-media-loader',
        onRemove: vi.fn()
      }
    ] as any

    // Remove widget
    removeMediaLoader(mockNode)

    expect(mockNode.widgets).toHaveLength(0)
  })

  it('handles node without widgets gracefully', () => {
    const { removeMediaLoader } = useNodeMediaUpload()
    const nodeWithoutWidgets = { id: 1 } as LGraphNode

    expect(() => removeMediaLoader(nodeWithoutWidgets)).not.toThrow()
  })

  it('does not remove non-matching widgets', () => {
    const { removeMediaLoader } = useNodeMediaUpload()
    const otherWidget = { name: 'other-widget' }
    mockNode.widgets! = [otherWidget] as any

    removeMediaLoader(mockNode)

    expect(mockNode.widgets).toHaveLength(1)
    expect(mockNode.widgets![0]).toBe(otherWidget)
  })

  it('calls widget onRemove when removing', () => {
    const { removeMediaLoader } = useNodeMediaUpload()
    const onRemove = vi.fn()
    mockNode.widgets! = [
      {
        name: '$$node-media-loader',
        onRemove
      }
    ] as any

    removeMediaLoader(mockNode)

    expect(onRemove).toHaveBeenCalled()
  })
})
