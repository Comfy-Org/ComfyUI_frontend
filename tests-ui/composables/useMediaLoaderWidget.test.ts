import type { LGraphNode } from '@comfyorg/litegraph'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaLoaderWidget } from '@/composables/widgets/useMediaLoaderWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Mock dependencies
vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: class MockComponentWidgetImpl {
    node: any
    name: string
    component: any
    inputSpec: any
    props: any
    options: any

    constructor(config: any) {
      this.node = config.node
      this.name = config.name
      this.component = config.component
      this.inputSpec = config.inputSpec
      this.props = config.props
      this.options = config.options
    }
  },
  addWidget: vi.fn()
}))

vi.mock('@/components/graph/widgets/MediaLoaderWidget.vue', () => ({
  default: {}
}))

describe('useMediaLoaderWidget', () => {
  let mockNode: LGraphNode
  let mockInputSpec: InputSpec

  beforeEach(() => {
    mockNode = {
      id: 1,
      widgets: []
    } as unknown as LGraphNode

    mockInputSpec = {
      name: 'test_media_loader',
      type: 'MEDIA_LOADER'
    }
  })

  it('creates widget constructor with default options', () => {
    const constructor = useMediaLoaderWidget()
    expect(constructor).toBeInstanceOf(Function)
  })

  it('creates widget with custom options', () => {
    const onFilesSelected = vi.fn()
    const constructor = useMediaLoaderWidget({
      defaultValue: ['test.jpg'],
      minHeight: 120,
      accept: 'image/*',
      onFilesSelected
    })

    const widget = constructor(mockNode, mockInputSpec)

    expect(widget).toBeDefined()
    expect(widget.name).toBe('test_media_loader')
    expect((widget.options as any)?.getValue()).toEqual(['test.jpg'])
    expect((widget.options as any)?.getMinHeight()).toBe(128) // 120 + 8 padding
    expect((widget.options as any)?.onFilesSelected).toBe(onFilesSelected)
  })

  it('handles value setting with validation', () => {
    const constructor = useMediaLoaderWidget()
    const widget = constructor(mockNode, mockInputSpec)

    // Test valid array
    ;(widget.options as any)?.setValue(['file1.jpg', 'file2.png'])
    expect((widget.options as any)?.getValue()).toEqual([
      'file1.jpg',
      'file2.png'
    ])

    // Test invalid value conversion
    ;(widget.options as any)?.setValue('invalid' as any)
    expect((widget.options as any)?.getValue()).toEqual([])
  })

  it('sets correct minimum height with padding', () => {
    const constructor = useMediaLoaderWidget({ minHeight: 150 })
    const widget = constructor(mockNode, mockInputSpec)

    expect((widget.options as any)?.getMinHeight()).toBe(158) // 150 + 8 padding
  })

  it('uses default minimum height when not specified', () => {
    const constructor = useMediaLoaderWidget()
    const widget = constructor(mockNode, mockInputSpec)

    expect((widget.options as any)?.getMinHeight()).toBe(108) // 100 + 8 padding
  })

  it('passes accept prop to widget', () => {
    const constructor = useMediaLoaderWidget({ accept: 'video/*' })
    const widget = constructor(mockNode, mockInputSpec)

    expect((widget as any).props?.accept).toBe('video/*')
  })
})
