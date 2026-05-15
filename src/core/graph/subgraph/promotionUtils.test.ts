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
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'

function widgetSourceNodeId(w: IBaseWidget): string | undefined {
  return isPromotedWidgetView(w) ? w.sourceNodeId : undefined
}

type TestPromotedWidget = IBaseWidget & {
  sourceNodeId: string
  sourceWidgetName: string
}

const updatePreviewsMock = vi.hoisted(() => vi.fn())
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: updatePreviewsMock })
}))

import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  demoteWidget,
  getPromotableWidgets,
  hasUnpromotedWidgets,
  isLinkedPromotion,
  isPreviewPseudoWidget,
  promoteValueWidgetViaSubgraphInput,
  promoteRecommendedWidgets,
  pruneDisconnected,
  reorderSubgraphInputAtIndex,
  reorderSubgraphInputsByName,
  reorderSubgraphInputsByWidgetOrder
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

describe('pruneDisconnected', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.restoreAllMocks()
  })

  it('removes disconnected linked inputs and emits a dev warning', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('TestNode')
    subgraphNode.subgraph.add(interiorNode)
    const keptInput = interiorNode.addInput('kept', 'STRING')
    const keptWidget = interiorNode.addWidget('text', 'kept', 'value', () => {})
    keptInput.widget = { name: keptWidget.name }
    promoteValueWidgetViaSubgraphInput(subgraphNode, interiorNode, keptWidget)

    const missingWidgetInput = subgraph.addInput('missing-widget', 'STRING')
    missingWidgetInput._widget = fromPartial<TestPromotedWidget>({
      sourceNodeId: String(interiorNode.id),
      sourceWidgetName: 'missing-widget'
    })
    const missingNodeInput = subgraph.addInput('missing-node', 'STRING')
    missingNodeInput._widget = fromPartial<TestPromotedWidget>({
      sourceNodeId: '9999',
      sourceWidgetName: 'missing-node'
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    pruneDisconnected(subgraphNode)

    expect(subgraph.inputs.map((input) => input.name)).toEqual(['kept'])
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('does not prune preview exposures for PreviewImage nodes', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('PreviewImage')
    interiorNode.type = 'PreviewImage'
    subgraphNode.subgraph.add(interiorNode)

    const hostLocator = String(subgraphNode.id)
    usePreviewExposureStore().addExposure(
      subgraphNode.rootGraph.id,
      hostLocator,
      {
        sourceNodeId: String(interiorNode.id),
        sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
      }
    )

    pruneDisconnected(subgraphNode)

    expect(
      usePreviewExposureStore().getExposures(
        subgraphNode.rootGraph.id,
        hostLocator
      )
    ).toEqual([
      {
        name: CANVAS_IMAGE_PREVIEW_WIDGET,
        sourceNodeId: String(interiorNode.id),
        sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
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

  it('promotes recommended value widgets through linked subgraph inputs', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('Sampler')
    const input = interiorNode.addInput('seed', 'INT')
    const seedWidget = interiorNode.addWidget('number', 'seed', 123, () => {})
    input.widget = { name: seedWidget.name }
    subgraph.add(interiorNode)

    promoteRecommendedWidgets(subgraphNode)

    const linkedInput = subgraph.inputs.find((slot) => slot.name === 'seed')
    expect(linkedInput).toBeDefined()
    expect(input.link).not.toBeNull()
    expect(linkedInput?.linkIds).toContain(input.link)
    expect(subgraphNode.serialize().properties?.proxyWidgets).toBeUndefined()
  })

  it('promotes virtual previews through preview exposures', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const glslNode = new LGraphNode('GLSLShader')
    glslNode.type = 'GLSLShader'
    subgraph.add(glslNode)

    promoteRecommendedWidgets(subgraphNode)

    const hostLocator = String(subgraphNode.id)
    expect(
      usePreviewExposureStore().getExposures(
        subgraphNode.rootGraph.id,
        hostLocator
      )
    ).toEqual([
      {
        name: CANVAS_IMAGE_PREVIEW_WIDGET,
        sourceNodeId: String(glslNode.id),
        sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
      }
    ])
    expect(subgraph.inputs).toHaveLength(0)
    expect(subgraphNode.serialize().properties?.proxyWidgets).toBeUndefined()
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

  it('eagerly exposes virtual preview widget for CANVAS_IMAGE_PREVIEW nodes', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const glslNode = new LGraphNode('GLSLShader')
    glslNode.type = 'GLSLShader'
    subgraph.add(glslNode)

    promoteRecommendedWidgets(subgraphNode)

    const hostLocator = String(subgraphNode.id)
    expect(
      usePreviewExposureStore().getExposures(
        subgraphNode.rootGraph.id,
        hostLocator
      )
    ).toContainEqual({
      name: CANVAS_IMAGE_PREVIEW_WIDGET,
      sourceNodeId: String(glslNode.id),
      sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
    })
    expect(updatePreviewsMock).not.toHaveBeenCalled()
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
    const input = interiorNode.addInput('seed', 'STRING')
    const widget = interiorNode.addWidget('text', 'seed', '123', () => {})
    input.widget = { name: widget.name }

    subgraph.addInput('seed', 'STRING').connect(input, interiorNode)

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

describe('reorderSubgraphInputsByName', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('reorders subgraph inputs and host inputs by subgraph input name', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'first', type: 'number' },
        { name: 'second', type: 'number' },
        { name: 'third', type: 'number' }
      ]
    })
    const host = createTestSubgraphNode(subgraph)

    reorderSubgraphInputsByName(host, ['third', 'first', 'second'])

    expect(host.subgraph.inputs.map((input) => input.name)).toEqual([
      'third',
      'first',
      'second'
    ])
    expect(host.inputs.map((input) => input.name)).toEqual([
      'third',
      'first',
      'second'
    ])
  })

  it('reorders promoted widgets on the host node from subgraph input order', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('First')
    const secondNode = new LGraphNode('Second')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('first', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'first', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('second', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'second', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)

    expect(host.widgets.map((widget) => widget.name)).toEqual([
      'first',
      'second'
    ])

    reorderSubgraphInputsByName(host, ['second', 'first'])

    expect(host.widgets.map((widget) => widget.name)).toEqual([
      'second',
      'first'
    ])
  })

  it('keeps promoted widget values aligned when a plain input is reordered before them', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('First')
    const secondNode = new LGraphNode('Second')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('first', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'first', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('second', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'second', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    subgraph.addInput('plain', 'STRING')
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)
    host.widgets[0].value = 'first value'
    host.widgets[1].value = 'second value'

    reorderSubgraphInputsByName(host, ['plain', 'second', 'first'])

    expect(host.widgets.map((widget) => widget.name)).toEqual([
      'second',
      'first'
    ])
    expect(host.serialize().widgets_values).toEqual([
      'second value',
      'first value'
    ])
  })

  it('updates subgraph input link slot indices after reordering', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('First')
    const secondNode = new LGraphNode('Second')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('first', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'first', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('second', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'second', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)

    reorderSubgraphInputsByName(host, ['second', 'first'])

    const [secondSlot, firstSlot] = subgraph.inputs
    const secondLink = subgraph.getLink(secondSlot.linkIds[0])
    const firstLink = subgraph.getLink(firstSlot.linkIds[0])

    expect(secondLink?.origin_slot).toBe(0)
    expect(firstLink?.origin_slot).toBe(1)
  })
})

describe('reorderSubgraphInputAtIndex', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.restoreAllMocks()
  })

  it('moves host widget values with dragged input rows', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('First')
    const secondNode = new LGraphNode('Second')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('text', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'text', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('text', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'text', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)
    host.widgets[0].value = 'first value'
    host.widgets[1].value = 'second value'

    reorderSubgraphInputAtIndex(host, 0, 1)

    expect(host.widgets.map((widget) => widgetSourceNodeId(widget))).toEqual([
      String(secondNode.id),
      String(firstNode.id)
    ])
    expect(host.widgets.map((widget) => widget.value)).toEqual([
      'second value',
      'first value'
    ])
  })

  it('updates subgraph link slot indices after moving a row', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('First')
    const secondNode = new LGraphNode('Second')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('first', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'first', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('second', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'second', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)

    reorderSubgraphInputAtIndex(host, 0, 1)

    const [secondSlot, firstSlot] = subgraph.inputs
    const secondLink = subgraph.getLink(secondSlot.linkIds[0])
    const firstLink = subgraph.getLink(firstSlot.linkIds[0])

    expect(secondLink?.origin_slot).toBe(0)
    expect(firstLink?.origin_slot).toBe(1)
  })
})

describe('reorderSubgraphInputsByWidgetOrder', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.restoreAllMocks()
  })

  it('reorders duplicate-named promoted inputs by widget identity', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const firstNode = new LGraphNode('First')
    const secondNode = new LGraphNode('Second')
    subgraph.add(firstNode)
    subgraph.add(secondNode)

    const firstInput = firstNode.addInput('text', 'STRING')
    const firstWidget = firstNode.addWidget('text', 'text', '', () => {})
    firstInput.widget = { name: firstWidget.name }
    const secondInput = secondNode.addInput('text', 'STRING')
    const secondWidget = secondNode.addWidget('text', 'text', '', () => {})
    secondInput.widget = { name: secondWidget.name }
    promoteValueWidgetViaSubgraphInput(host, firstNode, firstWidget)
    promoteValueWidgetViaSubgraphInput(host, secondNode, secondWidget)
    host.widgets[0].value = 'first value'
    host.widgets[1].value = 'second value'

    reorderSubgraphInputsByWidgetOrder(host, [host.widgets[1], host.widgets[0]])

    expect(host.widgets.map((widget) => widgetSourceNodeId(widget))).toEqual([
      String(secondNode.id),
      String(firstNode.id)
    ])
    expect(host.serialize().widgets_values).toEqual([
      'second value',
      'first value'
    ])
  })
})

describe('demoteWidget — axiomatic projection retraction', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.restoreAllMocks()
  })

  function setupPromotedWidget() {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('TestNode')
    host.subgraph.add(interiorNode)
    const interiorInput = interiorNode.addInput('value', 'STRING')
    const interiorWidget = interiorNode.addWidget(
      'text',
      'value',
      'initial',
      () => {}
    )
    interiorInput.widget = { name: interiorWidget.name }
    const result = promoteValueWidgetViaSubgraphInput(
      host,
      interiorNode,
      interiorWidget
    )
    expect(result.ok).toBe(true)
    return { host, interiorNode, interiorWidget }
  }

  it('drops projection but keeps slot and external link when host slot is externally connected', () => {
    const { host, interiorNode, interiorWidget } = setupPromotedWidget()
    const hostInput = host.inputs[0]
    hostInput.link = 9999
    const promotedViewsBefore = host.widgets.length

    expect(host.subgraph.inputs).toHaveLength(1)
    expect(promotedViewsBefore).toBeGreaterThan(0)

    demoteWidget(interiorNode, interiorWidget, [host])

    expect(host.subgraph.inputs).toHaveLength(1)
    expect(host.inputs[0]?.link).toBe(9999)
    expect(host.inputs[0]?._widget).toBeUndefined()
    expect(
      isLinkedPromotion(host, String(interiorNode.id), interiorWidget.name)
    ).toBe(false)
    expect(
      host.widgets.some(
        (widget) =>
          widgetSourceNodeId(widget) === String(interiorNode.id) &&
          widget.name === interiorWidget.name
      )
    ).toBe(false)
  })

  it('removes the slot entirely when host slot has no external link', () => {
    const { host, interiorNode, interiorWidget } = setupPromotedWidget()

    expect(host.subgraph.inputs).toHaveLength(1)

    demoteWidget(interiorNode, interiorWidget, [host])

    expect(host.subgraph.inputs).toHaveLength(0)
    expect(host.inputs).toHaveLength(0)
  })
})
