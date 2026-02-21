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
  isPreviewPseudoWidget,
  promoteRecommendedWidgets,
  pruneDisconnected
} from './proxyWidgetUtils'

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
      { interiorNodeId: String(interiorNode.id), widgetName: 'kept' },
      { interiorNodeId: String(interiorNode.id), widgetName: 'missing-widget' },
      { interiorNodeId: '9999', widgetName: 'missing-node' }
    ])

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    pruneDisconnected(subgraphNode)

    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toEqual([{ interiorNodeId: String(interiorNode.id), widgetName: 'kept' }])
    expect(warnSpy).toHaveBeenCalledOnce()
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
})
