import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { useNodeCanvasImagePreview } from './useNodeCanvasImagePreview'

const imagePreviewWidget = vi.hoisted(() => vi.fn())

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useImagePreviewWidget',
  () => ({
    useImagePreviewWidget: () => imagePreviewWidget
  })
)

describe('useNodeCanvasImagePreview', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('does not add preview widget when node has no images', () => {
    const node = new LGraphNode('test')

    useNodeCanvasImagePreview().showCanvasImagePreview(node)

    expect(imagePreviewWidget).not.toHaveBeenCalled()
  })

  it('adds preview widget for regular nodes with images', () => {
    const node = new LGraphNode('test')
    node.imgs = [new Image()]

    useNodeCanvasImagePreview().showCanvasImagePreview(node)

    expect(imagePreviewWidget).toHaveBeenCalledTimes(1)
    expect(imagePreviewWidget).toHaveBeenCalledWith(node, {
      type: 'IMAGE_PREVIEW',
      name: '$$canvas-image-preview'
    })
  })

  it('does not add duplicate preview widget when already present', () => {
    const node = new LGraphNode('test')
    node.imgs = [new Image()]
    node.addWidget('text', '$$canvas-image-preview', '', () => undefined, {})

    useNodeCanvasImagePreview().showCanvasImagePreview(node)

    expect(imagePreviewWidget).not.toHaveBeenCalled()
  })

  it('does not add preview widget directly on SubgraphNode', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode.imgs = [new Image()]

    useNodeCanvasImagePreview().showCanvasImagePreview(subgraphNode)

    expect(imagePreviewWidget).not.toHaveBeenCalled()
  })

  it('does nothing when removing from a node without widgets', () => {
    const node = Object.assign(new LGraphNode('test'), { widgets: undefined })

    useNodeCanvasImagePreview().removeCanvasImagePreview(node)

    expect(imagePreviewWidget).not.toHaveBeenCalled()
  })

  it('removes an existing preview widget and calls its cleanup', () => {
    const node = new LGraphNode('test')
    const widget = node.addWidget(
      'text',
      '$$canvas-image-preview',
      '',
      () => undefined,
      {}
    )
    widget.onRemove = vi.fn()

    useNodeCanvasImagePreview().removeCanvasImagePreview(node)

    expect(widget.onRemove).toHaveBeenCalledOnce()
    expect(node.widgets).toHaveLength(0)
  })
})
