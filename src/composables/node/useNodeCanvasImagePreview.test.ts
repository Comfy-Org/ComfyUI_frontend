import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import { useNodeCanvasImagePreview } from './useNodeCanvasImagePreview'

const imagePreviewWidget = vi.hoisted(() => vi.fn())

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useImagePreviewWidget',
  () => ({
    useImagePreviewWidget: () => imagePreviewWidget
  })
)

describe('useNodeCanvasImagePreview', () => {
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

  it('deletes the preview widget store entry on removal', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.addWidget('text', '$$canvas-image-preview', '', () => undefined, {})

    const store = useWidgetValueStore()
    const previewId = widgetId(graph.id, node.id, '$$canvas-image-preview')
    expect(store.getWidget(previewId)).toBeDefined()

    useNodeCanvasImagePreview().removeCanvasImagePreview(node)

    expect(node.widgets).toHaveLength(0)
    expect(store.getWidget(previewId)).toBeUndefined()
  })

  it('does not add preview widget directly on SubgraphNode', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode.imgs = [new Image()]

    useNodeCanvasImagePreview().showCanvasImagePreview(subgraphNode)

    expect(imagePreviewWidget).not.toHaveBeenCalled()
  })
})
