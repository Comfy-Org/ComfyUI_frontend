import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type { WidgetItem } from './widgetClassification'
import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  getPromotableWidgets,
  isPreviewPseudoWidget,
  isRecommendedWidget
} from './widgetClassification'

function widget(
  overrides: Partial<
    Pick<IBaseWidget, 'name' | 'serialize' | 'type' | 'options'>
  >
): IBaseWidget {
  return fromPartial<IBaseWidget>({ name: 'widget', ...overrides })
}

function widgetItem(
  nodeType: string,
  widgetName: string,
  overrides: Partial<IBaseWidget> = {}
): WidgetItem {
  const node = { title: nodeType, id: 1, type: nodeType }
  const w = fromPartial<IBaseWidget>({
    name: widgetName,
    computedDisabled: false,
    ...overrides
  })
  return [node, w]
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

describe('isRecommendedWidget', () => {
  it('returns true for widgets on recommended node types', () => {
    expect(isRecommendedWidget(widgetItem('CLIPTextEncode', 'text'))).toBe(true)
    expect(isRecommendedWidget(widgetItem('LoadImage', 'image'))).toBe(true)
    expect(isRecommendedWidget(widgetItem('SaveImage', 'filename'))).toBe(true)
    expect(isRecommendedWidget(widgetItem('PreviewImage', 'anything'))).toBe(
      true
    )
  })

  it('returns true for seed widgets regardless of node type', () => {
    expect(isRecommendedWidget(widgetItem('KSampler', 'seed'))).toBe(true)
    expect(isRecommendedWidget(widgetItem('KSamplerAdvanced', 'seed'))).toBe(
      true
    )
  })

  it('returns false for non-recommended node and widget combinations', () => {
    expect(isRecommendedWidget(widgetItem('KSampler', 'steps'))).toBe(false)
    expect(isRecommendedWidget(widgetItem('VAEDecode', 'samples'))).toBe(false)
  })

  it('returns false when widget is computedDisabled', () => {
    expect(
      isRecommendedWidget(
        widgetItem('CLIPTextEncode', 'text', { computedDisabled: true })
      )
    ).toBe(false)
    expect(
      isRecommendedWidget(
        widgetItem('KSampler', 'seed', { computedDisabled: true })
      )
    ).toBe(false)
  })
})
