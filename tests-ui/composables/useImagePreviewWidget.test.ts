import type { LGraphNode } from '@comfyorg/litegraph'
import { describe, expect, it, vi } from 'vitest'

import { useImagePreviewWidget } from '@/composables/widgets/useImagePreviewWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Mock dependencies
vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: vi.fn().mockImplementation(() => ({
    name: 'test-widget',
    value: ''
  })),
  addWidget: vi.fn()
}))

describe('useImagePreviewWidget', () => {
  const mockNode = {
    id: 'test-node',
    widgets: []
  } as unknown as LGraphNode

  const mockInputSpec: InputSpec = {
    name: 'image_preview',
    type: 'IMAGEPREVIEW',
    allow_batch: true,
    image_folder: 'input'
  }

  it('creates widget constructor with default options', () => {
    const constructor = useImagePreviewWidget()
    expect(constructor).toBeDefined()
    expect(typeof constructor).toBe('function')
  })

  it('creates widget with custom default value', () => {
    const constructor = useImagePreviewWidget({
      defaultValue: 'test-image.png'
    })
    expect(constructor).toBeDefined()
  })

  it('creates widget with array default value for batch mode', () => {
    const constructor = useImagePreviewWidget({
      defaultValue: ['image1.png', 'image2.png']
    })
    expect(constructor).toBeDefined()
  })

  it('calls constructor with node and inputSpec', () => {
    const constructor = useImagePreviewWidget()
    const widget = constructor(mockNode, mockInputSpec)

    expect(widget).toBeDefined()
  })
})
