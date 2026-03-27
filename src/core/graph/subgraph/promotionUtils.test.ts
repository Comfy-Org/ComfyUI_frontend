import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { usePromotionStore } from '@/stores/promotionStore'

const updatePreviewsMock = vi.hoisted(() => vi.fn())
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: updatePreviewsMock })
}))

import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  getPromotableWidgets,
  hasUnpromotedWidgets,
  isPreviewPseudoWidget,
  promoteRecommendedWidgets,
  pruneDisconnected
} from './promotionUtils'

function widget(
  overrides: Partial<
    Pick<IBaseWidget, 'name' | 'serialize' | 'type' | 'options'>
  >
): IBaseWidget {
  return { name: 'widget', ...overrides } as unknown as IBaseWidget
}

describe('isPreviewPseudoWidget', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.restoreAllMocks()
  })

  it('returns true for $$-prefixed widget names', () => {
    expect(
      isPreviewPseudoWidget(widget({ name: '$$canvas-image-preview' }))
    ).toBe(true)
    expect(isPreviewPseudoWidget(widget({ name: '$$anything' }))).toBe(true)
  })

  it('returns true for serialize:false with type "preview"', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'videopreview', serialize: false, type: 'preview' })
      )
    ).toBe(true)
  })

  it('returns true for options.serialize:false with type "preview" (VHS pattern)', () => {
    expect(
      isPreviewPseudoWidget(
        widget({
          name: 'videopreview',
          type: 'preview',
          options: { serialize: false }
        })
      )
    ).toBe(true)
  })

  it('returns true for serialize:false with type "video"', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'vid', serialize: false, type: 'video' })
      )
    ).toBe(true)
  })

  it('returns true for serialize:false with type "audioUI"', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'audio', serialize: false, type: 'audioUI' })
      )
    ).toBe(true)
  })

  it('returns false for type "preview" when serialize is not false', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'videopreview', serialize: true, type: 'preview' })
      )
    ).toBe(false)
  })

  it('returns false for regular widgets', () => {
    expect(
      isPreviewPseudoWidget(widget({ name: 'seed', type: 'number' }))
    ).toBe(false)
  })

  it('returns false for serialize:false with unknown type', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'text', serialize: false, type: 'customtext' })
      )
    ).toBe(false)
  })
})

describe('pruneDisconnected', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.restoreAllMocks()
  })

  it('removes disconnected entries and emits a dev warning', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('TestNode')
    subgraphNode.subgraph.add(interiorNode)
    interiorNode.addWidget('text', 'kept', 'value', () => {})

    const store = usePromotionStore()
    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      { sourceNodeId: String(interiorNode.id), sourceWidgetName: 'kept' },
      {
        sourceNodeId: String(interiorNode.id),
        sourceWidgetName: 'missing-widget'
      },
      { sourceNodeId: '9999', sourceWidgetName: 'missing-node' }
    ])

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    pruneDisconnected(subgraphNode)

    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toEqual([
      { sourceNodeId: String(interiorNode.id), sourceWidgetName: 'kept' }
    ])
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('keeps virtual canvas preview promotions for canvas_image_preview nodes', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)

    class PreviewImageNode extends LGraphNode {
      static override nodeData = { canvas_image_preview: true }
    }
    const interiorNode = new PreviewImageNode('PreviewImage')
    interiorNode.type = 'PreviewImage'
    subgraphNode.subgraph.add(interiorNode)

    const store = usePromotionStore()
    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      {
        sourceNodeId: String(interiorNode.id),
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET
      }
    ])

    pruneDisconnected(subgraphNode)

    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toEqual([
      {
        sourceNodeId: String(interiorNode.id),
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET
      }
    ])
  })
})

describe('getPromotableWidgets', () => {
  class CanvasPreviewNode extends LGraphNode {
    static override nodeData = { canvas_image_preview: true }
  }

  it('adds virtual canvas preview widget when canvas_image_preview is true', () => {
    const node = new CanvasPreviewNode('PreviewImage')
    node.type = 'PreviewImage'

    const widgets = getPromotableWidgets(node)

    expect(
      widgets.some((widget) => widget.name === CANVAS_IMAGE_PREVIEW_WIDGET)
    ).toBe(true)
  })

  it('does not add virtual canvas preview widget for non-canvas_image_preview nodes', () => {
    const node = new LGraphNode('TextNode')
    node.addOutput('TEXT', 'STRING')

    const widgets = getPromotableWidgets(node)

    expect(
      widgets.some((widget) => widget.name === CANVAS_IMAGE_PREVIEW_WIDGET)
    ).toBe(false)
  })
})

describe('promoteRecommendedWidgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    updatePreviewsMock.mockReset()
  })

  it('skips deferred updatePreviews when a preview widget already exists', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('TestNode')
    subgraph.add(interiorNode)

    const previewWidget = interiorNode.addWidget(
      'custom',
      'videopreview',
      'value',
      () => {}
    )
    previewWidget.type = 'preview'
    previewWidget.serialize = false

    promoteRecommendedWidgets(subgraphNode)

    expect(updatePreviewsMock).not.toHaveBeenCalled()
  })

  it('eagerly promotes virtual preview widget for canvas_image_preview nodes', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)

    class GLSLShaderNode extends LGraphNode {
      static override nodeData = { canvas_image_preview: true }
    }
    const glslNode = new GLSLShaderNode('GLSLShader')
    glslNode.type = 'GLSLShader'
    subgraph.add(glslNode)

    promoteRecommendedWidgets(subgraphNode)

    const store = usePromotionStore()
    expect(
      store.isPromoted(subgraphNode.rootGraph.id, subgraphNode.id, {
        sourceNodeId: String(glslNode.id),
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET
      })
    ).toBe(true)
    expect(updatePreviewsMock).not.toHaveBeenCalled()
  })

  it('registers $$canvas-image-preview on configure for canvas_image_preview node in saved workflow', () => {
    // Simulate loading a saved workflow where proxyWidgets does NOT contain
    // the $$canvas-image-preview entry (e.g. blueprint authored before the
    // promotion system, or old workflow save).
    const subgraph = createTestSubgraph()

    class GLSLShaderNode extends LGraphNode {
      static override nodeData = { canvas_image_preview: true }
    }
    const glslNode = new GLSLShaderNode('GLSLShader')
    glslNode.type = 'GLSLShader'
    subgraph.add(glslNode)

    // Create subgraphNode — constructor calls configure → _internalConfigureAfterSlots
    // which eagerly registers $$canvas-image-preview for supported node types
    const subgraphNode = createTestSubgraphNode(subgraph)

    const store = usePromotionStore()
    expect(
      store.isPromoted(subgraphNode.rootGraph.id, subgraphNode.id, {
        sourceNodeId: String(glslNode.id),
        sourceWidgetName: CANVAS_IMAGE_PREVIEW_WIDGET
      })
    ).toBe(true)
  })
})

describe('hasUnpromotedWidgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('returns true when subgraph has at least one enabled unpromoted widget', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('InnerNode')
    subgraph.add(interiorNode)
    interiorNode.addWidget('text', 'seed', '123', () => {})

    expect(hasUnpromotedWidgets(subgraphNode)).toBe(true)
  })

  it('returns false when all enabled widgets are already promoted', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('InnerNode')
    subgraph.add(interiorNode)
    interiorNode.addWidget('text', 'seed', '123', () => {})

    usePromotionStore().promote(subgraphNode.rootGraph.id, subgraphNode.id, {
      sourceNodeId: String(interiorNode.id),
      sourceWidgetName: 'seed'
    })

    expect(hasUnpromotedWidgets(subgraphNode)).toBe(false)
  })

  it('ignores computed-disabled widgets', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('InnerNode')
    subgraph.add(interiorNode)
    const widget = interiorNode.addWidget('text', 'seed', '123', () => {})
    widget.computedDisabled = true

    expect(hasUnpromotedWidgets(subgraphNode)).toBe(false)
  })
})
