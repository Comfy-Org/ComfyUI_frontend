import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { promotedInputWidget } from '@/core/graph/subgraph/promotedInputWidget'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useLinkStore } from '@/stores/linkStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

function promotedInputNames(host: {
  inputs: Array<{ widgetId?: unknown; name: string }>
}) {
  return host.inputs
    .filter((input) => input.widgetId)
    .map((input) => input.name)
}

function promotedHostWidgetNames(host: { widgets?: IBaseWidget[] }) {
  return host.widgets?.map((widget) => widget.name) ?? []
}

function writePromotedInputValue(
  host: { inputs: Array<{ widgetId?: WidgetId; name: string }> },
  name: string,
  value: IBaseWidget['value']
) {
  const input = host.inputs.find((input) => input.name === name)
  if (!input?.widgetId) throw new Error(`Missing promoted input ${name}`)
  useWidgetValueStore().setValue(input.widgetId, value)
}

function promotedWidgetRef(host: SubgraphNode, name: string): IBaseWidget {
  const input = host.inputs.find((input) => input.name === name)
  if (!input?.widgetId) throw new Error(`Missing promoted input ${name}`)
  const widget = promotedInputWidget(input)
  if (!widget) throw new Error(`Missing promoted input ${name}`)
  return widget
}

const updatePreviewsMock = vi.hoisted(() => vi.fn())
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: updatePreviewsMock })
}))

import {
  CANVAS_IMAGE_PREVIEW_WIDGET,
  autoExposeKnownPreviewNodes,
  demoteWidget,
  getPromotableWidgets,
  hasUnpromotedWidgets,
  isPreviewPseudoWidget,
  promoteValueWidgetViaSubgraphInput,
  promoteRecommendedWidgets,
  pruneDisconnected,
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

/**
 * Builds a host SubgraphNode whose subgraph contains two source nodes that
 * share a widget name (`text`), then promotes both — forcing the second
 * promotion to be disambiguated to `text_1`.
 */
function buildDuplicateNamePromotion() {
  const subgraph = createTestSubgraph()
  const host = createTestSubgraphNode(subgraph)

  const nodeA = new LGraphNode('SourceA')
  subgraph.add(nodeA)
  const inputA = nodeA.addInput('text', 'STRING')
  const widgetA = nodeA.addWidget('text', 'text', 'a', () => {})
  inputA.widget = { name: widgetA.name }

  const nodeB = new LGraphNode('SourceB')
  subgraph.add(nodeB)
  const inputB = nodeB.addInput('text', 'STRING')
  const widgetB = nodeB.addWidget('text', 'text', 'b', () => {})
  inputB.widget = { name: widgetB.name }

  expect(promoteValueWidgetViaSubgraphInput(host, nodeA, widgetA).ok).toBe(true)
  expect(promoteValueWidgetViaSubgraphInput(host, nodeB, widgetB).ok).toBe(true)
  expect(host.subgraph.inputs.map((i) => i.name)).toEqual(['text', 'text_1'])

  return { subgraph, host, nodeA, widgetA, nodeB, widgetB }
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
    const missingNodeInput = subgraph.addInput('missing-node', 'STRING')
    const keptWidgetId = subgraphNode.inputs.find(
      (input) => input.name === 'kept'
    )?.widgetId
    if (!keptWidgetId) throw new Error('Missing kept widgetId')
    for (const input of [missingWidgetInput, missingNodeInput]) {
      const hostInput = subgraphNode.inputs.find(
        (entry) => entry._subgraphSlot === input
      )
      if (!hostInput) throw new Error(`Missing host input ${input.name}`)
      hostInput.widgetId = keptWidgetId
    }

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

  it('preserves the source slot label when promoting a value widget', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const interiorNode = new LGraphNode('Prompt')
    const input = interiorNode.addInput('text', 'STRING')
    input.label = 'renamed_from_sidepanel'
    const textWidget = interiorNode.addWidget('text', 'text', '', () => {})
    input.widget = { name: textWidget.name }
    subgraph.add(interiorNode)

    promoteValueWidgetViaSubgraphInput(subgraphNode, interiorNode, textWidget)

    const hostInput = subgraphNode.inputs.find((input) => input.name === 'text')
    expect(hostInput?.label).toBe('renamed_from_sidepanel')
    expect(promotedWidgetRef(subgraphNode, 'text').label).toBe(
      'renamed_from_sidepanel'
    )
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

describe('autoExposeKnownPreviewNodes', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    updatePreviewsMock.mockReset()
  })

  it('auto-exposes previews when host has no persisted previewExposures property', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const glslNode = new LGraphNode('GLSLShader')
    glslNode.type = 'GLSLShader'
    subgraph.add(glslNode)

    autoExposeKnownPreviewNodes(subgraphNode)

    expect(
      usePreviewExposureStore().getExposures(
        subgraphNode.rootGraph.id,
        String(subgraphNode.id)
      )
    ).toHaveLength(1)
  })

  it('does not auto-expose when host has empty persisted previewExposures (user cleared)', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode.properties.previewExposures = []
    const glslNode = new LGraphNode('GLSLShader')
    glslNode.type = 'GLSLShader'
    subgraph.add(glslNode)

    autoExposeKnownPreviewNodes(subgraphNode)

    expect(
      usePreviewExposureStore().getExposures(
        subgraphNode.rootGraph.id,
        String(subgraphNode.id)
      )
    ).toEqual([])
  })

  it('does not auto-expose when host has non-empty persisted previewExposures', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const glslNode = new LGraphNode('GLSLShader')
    glslNode.type = 'GLSLShader'
    subgraph.add(glslNode)
    const otherNode = new LGraphNode('OtherShader')
    otherNode.type = 'GLSLShader'
    subgraph.add(otherNode)
    subgraphNode.properties.previewExposures = [
      {
        name: CANVAS_IMAGE_PREVIEW_WIDGET,
        sourceNodeId: String(otherNode.id),
        sourcePreviewName: CANVAS_IMAGE_PREVIEW_WIDGET
      }
    ]

    autoExposeKnownPreviewNodes(subgraphNode)

    expect(
      usePreviewExposureStore()
        .getExposures(subgraphNode.rootGraph.id, String(subgraphNode.id))
        .map((e) => e.sourceNodeId)
    ).not.toContain(String(glslNode.id))
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

  it('returns false (does not throw) when SubgraphNode is detached', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = subgraphNode.graph!
    parentGraph.add(subgraphNode)
    const interiorNode = new LGraphNode('InnerNode')
    subgraph.add(interiorNode)
    interiorNode.addWidget('text', 'seed', '123', () => {})

    parentGraph.remove(subgraphNode)

    expect(subgraphNode.graph).toBeNull()
    expect(() => hasUnpromotedWidgets(subgraphNode)).not.toThrow()
    expect(hasUnpromotedWidgets(subgraphNode)).toBe(false)
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

    expect(promotedInputNames(host)).toEqual(['first', 'second'])
    expect(promotedHostWidgetNames(host)).toEqual(['first', 'second'])

    reorderSubgraphInputsByName(host, ['second', 'first'])

    expect(promotedInputNames(host)).toEqual(['second', 'first'])
    expect(promotedHostWidgetNames(host)).toEqual(['second', 'first'])
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
    writePromotedInputValue(host, 'first', 'first value')
    writePromotedInputValue(host, 'second', 'second value')

    reorderSubgraphInputsByName(host, ['plain', 'second', 'first'])

    expect(promotedInputNames(host)).toEqual(['second', 'first'])
    expect(promotedHostWidgetNames(host)).toEqual(['second', 'first'])
    expect(host.serialize().widgets_values).toEqual([
      'second value',
      'first value'
    ])
  })

  it('preserves null promoted widget values across reordering', () => {
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
    writePromotedInputValue(host, 'first', null)
    writePromotedInputValue(host, 'second', 'second value')

    reorderSubgraphInputsByName(host, ['second', 'first'])

    expect(promotedInputNames(host)).toEqual(['second', 'first'])
    const valueByName = (name: string) => {
      const input = host.inputs.find((input) => input.name === name)
      if (!input?.widgetId) throw new Error(`Missing promoted input ${name}`)
      return useWidgetValueStore().getWidget(input.widgetId)?.value
    }
    expect(valueByName('first')).toBeNull()
    expect(valueByName('second')).toBe('second value')
    expect(host.serialize().widgets_values).toEqual(['second value', null])
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

  it('updates outer link target_slot when host inputs are reordered', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'first', type: 'STRING' },
        { name: 'second', type: 'STRING' }
      ]
    })
    const host = createTestSubgraphNode(subgraph)
    subgraph.rootGraph.add(host)

    const source = new LGraphNode('Source')
    source.addOutput('out', 'STRING')
    subgraph.rootGraph.add(source)

    const firstLink = source.connect(0, host, 0)
    const secondLink = source.connect(0, host, 1)
    expect(firstLink?.target_slot).toBe(0)
    expect(secondLink?.target_slot).toBe(1)

    reorderSubgraphInputsByName(host, ['second', 'first'])

    expect(firstLink?.target_slot).toBe(1)
    expect(secondLink?.target_slot).toBe(0)

    const store = useLinkStore()
    const rootId = subgraph.rootGraph.id
    expect(host.isInputConnected(0)).toBe(true)
    expect(host.isInputConnected(1)).toBe(true)
    expect(store.getInputSlotLink(rootId, host.id, 0)?.id).toBe(secondLink?.id)
    expect(store.getInputSlotLink(rootId, host.id, 1)?.id).toBe(firstLink?.id)
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
    writePromotedInputValue(host, 'text', 'first value')
    writePromotedInputValue(host, 'text_1', 'second value')

    const firstPromotedWidget = promotedWidgetRef(host, 'text')
    const secondPromotedWidget = promotedWidgetRef(host, 'text_1')
    reorderSubgraphInputsByWidgetOrder(host, [
      secondPromotedWidget,
      firstPromotedWidget
    ])

    expect(host.subgraph.inputs.map((input) => input.name)).toEqual([
      'text_1',
      'text'
    ])
    expect(promotedHostWidgetNames(host)).toEqual(['text_1', 'text'])
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
    const source = new LGraphNode('External Source')
    source.addOutput('out', 'STRING')
    host.graph!.add(source)
    const externalLink = source.connect(0, host, 0)!
    const promotedInputId = hostInput.widgetId

    expect(host.subgraph.inputs).toHaveLength(1)
    expect(promotedInputId).toBeDefined()

    demoteWidget(interiorNode, interiorWidget, [host])

    expect(host.subgraph.inputs).toHaveLength(1)
    expect(host.inputs[0]?.link).toBe(externalLink.id)
    expect(host.inputs[0]?._widget).toBeUndefined()
    expect(interiorNode.inputs[0]?.link).toBeNull()
    expect(host.widgets).toHaveLength(0)
    if (!promotedInputId) throw new Error('Missing promoted input widgetId')
    expect(useWidgetValueStore().getWidget(promotedInputId)).toBeUndefined()
  })

  it('removes the slot entirely when host slot has no external link', () => {
    const { host, interiorNode, interiorWidget } = setupPromotedWidget()

    expect(host.subgraph.inputs).toHaveLength(1)

    demoteWidget(interiorNode, interiorWidget, [host])

    expect(host.subgraph.inputs).toHaveLength(0)
    expect(host.inputs).toHaveLength(0)
  })

  it('demotes the second of two promoted widgets sharing a source widget name', () => {
    const { host, nodeA, nodeB, widgetB } = buildDuplicateNamePromotion()

    demoteWidget(nodeB, widgetB, [host])

    expect(host.subgraph.inputs.map((i) => i.name)).toEqual(['text'])
    expect(nodeB.inputs[0]?.link).toBeNull()
    expect(nodeA.inputs[0]?.link).not.toBeNull()
  })

  it('demotes the correct slot when widget lives on a nested SubgraphNode with same-named deep sources', () => {
    const { host: innerHost } = buildDuplicateNamePromotion()

    const outerSubgraph = createTestSubgraph()
    outerSubgraph.add(innerHost)
    const outerHost = createTestSubgraphNode(outerSubgraph)

    for (const input of innerHost.inputs) {
      expect(
        promoteValueWidgetViaSubgraphInput(
          outerHost,
          innerHost,
          promotedWidgetRef(innerHost, input.name)
        ).ok
      ).toBe(true)
    }
    expect(outerHost.subgraph.inputs.map((i) => i.name)).toEqual([
      'text',
      'text_1'
    ])

    demoteWidget(innerHost, promotedWidgetRef(innerHost, 'text_1'), [outerHost])

    expect(outerHost.subgraph.inputs.map((i) => i.name)).toEqual(['text'])
    expect(innerHost.inputs.find((i) => i.name === 'text_1')?.link).toBeNull()
    expect(innerHost.inputs.find((i) => i.name === 'text')?.link).not.toBeNull()
  })
})

describe('disambiguated nested promotion identity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('does not prune a promotion whose source is a nested SubgraphNode exposing a disambiguated widget', () => {
    const { host: innerHost } = buildDuplicateNamePromotion()
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)
    subgraph.add(innerHost)

    expect(
      promoteValueWidgetViaSubgraphInput(
        host,
        innerHost,
        promotedWidgetRef(innerHost, 'text_1')
      ).ok
    ).toBe(true)

    pruneDisconnected(host)

    expect(host.subgraph.inputs).toHaveLength(1)
    expect(host.subgraph.inputs[0]?.name).toBe('text_1')
  })

  it('marks a promoted interior widget as computedDisabled so the connection dot replaces its UI', () => {
    const subgraph = createTestSubgraph()
    const host = createTestSubgraphNode(subgraph)

    const interiorNode = new LGraphNode('Source')
    subgraph.add(interiorNode)
    const interiorInput = interiorNode.addInput('text', 'STRING')
    const interiorWidget = interiorNode.addWidget('text', 'text', '', () => {})
    interiorInput.widget = { name: interiorWidget.name }

    expect(
      promoteValueWidgetViaSubgraphInput(host, interiorNode, interiorWidget).ok
    ).toBe(true)

    interiorNode.updateComputedDisabled()

    expect(interiorWidget.computedDisabled).toBe(true)
  })

  it('preserves a real two-level promotion through the SubgraphEditor mount-time prune', () => {
    const { host: innerHost } = buildDuplicateNamePromotion()

    const outerSubgraph = createTestSubgraph()
    outerSubgraph.add(innerHost)
    const outerHost = createTestSubgraphNode(outerSubgraph)

    for (const input of innerHost.inputs) {
      expect(
        promoteValueWidgetViaSubgraphInput(
          outerHost,
          innerHost,
          promotedWidgetRef(innerHost, input.name)
        ).ok
      ).toBe(true)
    }

    const beforeCount = outerHost.subgraph.inputs.length
    expect(beforeCount).toBe(2)

    pruneDisconnected(outerHost)

    expect(outerHost.subgraph.inputs).toHaveLength(beforeCount)
  })
})
