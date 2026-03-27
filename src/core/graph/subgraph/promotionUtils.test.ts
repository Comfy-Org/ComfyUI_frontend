import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { usePromotionStore } from '@/stores/promotionStore'

const updatePreviewsMock = vi.hoisted(() => vi.fn())
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: updatePreviewsMock })
}))

import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  getPromotableWidgets,
  getSourceNodeId,
  hasUnpromotedWidgets,
  isLinkedPromotion,
  isPreviewPseudoWidget,
  promoteRecommendedWidgets,
  pruneDisconnected
} from './promotionUtils'

function widget(
  overrides: Partial<
    Pick<IBaseWidget, 'name' | 'serialize' | 'type' | 'options'>
  >
): IBaseWidget {
  return fromPartial<IBaseWidget>({ name: 'widget', ...overrides })
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

describe('getSourceNodeId', () => {
  it('returns undefined for a regular widget', () => {
    expect(getSourceNodeId(widget({ name: 'seed' }))).toBeUndefined()
  })

  it('returns undefined for a promoted widget without disambiguatingSourceNodeId', () => {
    const promoted = {
      ...widget({ name: 'seed' }),
      sourceNodeId: '3',
      sourceWidgetName: 'seed'
    } as IBaseWidget
    expect(getSourceNodeId(promoted)).toBeUndefined()
  })

  it('returns disambiguatingSourceNodeId when present', () => {
    const promoted = {
      ...widget({ name: 'seed' }),
      sourceNodeId: '3',
      sourceWidgetName: 'seed',
      disambiguatingSourceNodeId: '99'
    } as IBaseWidget
    expect(getSourceNodeId(promoted)).toBe('99')
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

  it('keeps virtual canvas preview promotions for PreviewImage nodes', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('PreviewImage')
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
  it('adds virtual canvas preview widget for PreviewImage nodes', () => {
    const node = new LGraphNode('PreviewImage')
    node.type = 'PreviewImage'

    const widgets = getPromotableWidgets(node)

    expect(
      widgets.some((widget) => widget.name === CANVAS_IMAGE_PREVIEW_WIDGET)
    ).toBe(true)
  })

  it('adds virtual canvas preview widget for SaveImage nodes', () => {
    const node = new LGraphNode('SaveImage')
    node.type = 'SaveImage'

    const widgets = getPromotableWidgets(node)

    expect(
      widgets.some((widget) => widget.name === CANVAS_IMAGE_PREVIEW_WIDGET)
    ).toBe(true)
  })

  it('adds virtual canvas preview widget for GLSLShader nodes', () => {
    const node = new LGraphNode('GLSLShader')
    node.type = 'GLSLShader'

    const widgets = getPromotableWidgets(node)

    expect(
      widgets.some((widget) => widget.name === CANVAS_IMAGE_PREVIEW_WIDGET)
    ).toBe(true)
  })

  it('does not add virtual canvas preview widget for non-image nodes', () => {
    const node = new LGraphNode('TextNode')
    node.addOutput('TEXT', 'STRING')

    const widgets = getPromotableWidgets(node)

    expect(
      widgets.some((widget) => widget.name === CANVAS_IMAGE_PREVIEW_WIDGET)
    ).toBe(false)
  })

  it('does not add virtual canvas preview widget for ImageInvert nodes', () => {
    const node = new LGraphNode('ImageInvert')
    node.type = 'ImageInvert'

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

  it('eagerly promotes virtual preview widget for CANVAS_IMAGE_PREVIEW nodes', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const glslNode = new LGraphNode('GLSLShader')
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

  it('registers $$canvas-image-preview on configure for GLSLShader in saved workflow', () => {
    // Simulate loading a saved workflow where proxyWidgets does NOT contain
    // the $$canvas-image-preview entry (e.g. blueprint authored before the
    // promotion system, or old workflow save).
    const subgraph = createTestSubgraph()
    const glslNode = new LGraphNode('GLSLShader')
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

describe('isLinkedPromotion', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function linkedWidget(
    sourceNodeId: string,
    sourceWidgetName: string,
    extra: Record<string, unknown> = {}
  ): IBaseWidget {
    return {
      sourceNodeId,
      sourceWidgetName,
      name: 'value',
      type: 'text',
      value: '',
      options: {},
      y: 0,
      ...extra
    } as unknown as IBaseWidget
  }

  function createSubgraphWithInputs(count = 1) {
    const subgraph = createTestSubgraph({
      inputs: Array.from({ length: count }, (_, i) => ({
        name: `input_${i}`,
        type: 'STRING' as const
      }))
    })
    return createTestSubgraphNode(subgraph)
  }

  it('returns true when an input has a matching _widget', () => {
    const subgraphNode = createSubgraphWithInputs()
    subgraphNode.inputs[0]._widget = linkedWidget('3', 'text')

    expect(isLinkedPromotion(subgraphNode, '3', 'text')).toBe(true)
  })

  it('returns false when no inputs exist or none match', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(isLinkedPromotion(subgraphNode, '999', 'nonexistent')).toBe(false)
  })

  it('returns false when sourceNodeId matches but sourceWidgetName does not', () => {
    const subgraphNode = createSubgraphWithInputs()
    subgraphNode.inputs[0]._widget = linkedWidget('3', 'text')

    expect(isLinkedPromotion(subgraphNode, '3', 'wrong_name')).toBe(false)
  })

  it('returns false when _widget is undefined on input', () => {
    const subgraphNode = createSubgraphWithInputs()

    expect(isLinkedPromotion(subgraphNode, '3', 'text')).toBe(false)
  })

  it('matches by sourceNodeId even when disambiguatingSourceNodeId is present', () => {
    const subgraphNode = createSubgraphWithInputs()
    subgraphNode.inputs[0]._widget = linkedWidget('6', 'text', {
      disambiguatingSourceNodeId: '1'
    })

    expect(isLinkedPromotion(subgraphNode, '6', 'text')).toBe(true)
    expect(isLinkedPromotion(subgraphNode, '1', 'text')).toBe(false)
  })

  it('identifies multiple linked widgets across different inputs', () => {
    const subgraphNode = createSubgraphWithInputs(2)
    subgraphNode.inputs[0]._widget = linkedWidget('3', 'string_a')
    subgraphNode.inputs[1]._widget = linkedWidget('4', 'value')

    expect(isLinkedPromotion(subgraphNode, '3', 'string_a')).toBe(true)
    expect(isLinkedPromotion(subgraphNode, '4', 'value')).toBe(true)
    expect(isLinkedPromotion(subgraphNode, '3', 'value')).toBe(false)
    expect(isLinkedPromotion(subgraphNode, '5', 'string_a')).toBe(false)
  })
})
