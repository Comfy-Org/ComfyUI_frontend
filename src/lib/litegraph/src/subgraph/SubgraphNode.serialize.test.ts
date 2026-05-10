/**
 * Tests for SubgraphNode.serialize() after ADR 0009.
 *
 * Covers:
 * - Removed copy-back loop: exterior promoted host value does NOT mutate
 *   the corresponding interior widget value.
 * - properties.proxyWidgets is no longer re-emitted on serialize.
 * - properties.previewExposures round-trip through the
 *   PreviewExposureStore.
 * - properties.proxyWidgetErrorQuarantine round-trips and is inert at
 *   runtime; an empty quarantine is omitted from the serialized payload.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  appendHostQuarantine,
  makeQuarantineEntry
} from '@/core/graph/subgraph/migration/quarantineEntry'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'
import type { ISlotType, TWidgetType } from '@/lib/litegraph/src/litegraph'
import { BaseWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import {
  reorderSubgraphInputAtIndex,
  reorderSubgraphInputsByName
} from '@/core/graph/subgraph/promotionUtils'
import { IS_CONTROL_WIDGET } from '@/scripts/controlWidgetMarker'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { graphToPrompt } from '@/utils/executionUtil'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

function createNodeWithWidget(
  title: string,
  widgetType: TWidgetType = 'number',
  widgetValue: unknown = 42,
  slotType: ISlotType = 'number'
) {
  const node = new LGraphNode(title)
  const input = node.addInput('value', slotType)
  node.addOutput('out', slotType)

  // @ts-expect-error Abstract class instantiation
  const widget = new BaseWidget({
    name: 'widget',
    type: widgetType,
    value: widgetValue,
    y: 0,
    options: widgetType === 'number' ? { min: 0, max: 100, step: 1 } : {},
    node
  })
  node.widgets = [widget]
  input.widget = { name: widget.name }

  return { node, widget, input }
}

function expectPromotedWidgetView(
  widget: unknown
): asserts widget is PromotedWidgetView {
  expect(widget).toMatchObject({
    sourceNodeId: expect.any(String),
    sourceWidgetName: expect.any(String)
  })
}

function getHostStateName(widget: PromotedWidgetView): string {
  return [widget.name, widget.sourceNodeId, widget.sourceWidgetName].join(':')
}

describe('SubgraphNode.serialize (ADR 0009)', () => {
  describe('removed copy-back loop', () => {
    it('does not mutate interior widget values during serialize', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node: interiorNode, widget: interiorWidget } =
        createNodeWithWidget('Interior')
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const hostNode = createTestSubgraphNode(subgraph)
      const hostWidget = hostNode.widgets[0]
      expectPromotedWidgetView(hostWidget)
      useWidgetValueStore().registerWidget(hostNode.rootGraph.id, {
        nodeId: hostNode.id,
        name: getHostStateName(hostWidget),
        type: hostWidget.type,
        value: 99,
        options: {}
      })

      hostNode.serialize()

      expect(interiorWidget.value).toBe(42)
    })

    it('does not mutate live properties while projecting store-owned serialization metadata', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)
      hostNode.properties.previewExposures = [
        {
          name: 'stale',
          sourceNodeId: '0',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ]
      hostNode.properties.proxyWidgetErrorQuarantine = []
      const livePropertiesBefore = structuredClone(hostNode.properties)

      usePreviewExposureStore().addExposure(
        hostNode.rootGraph.id,
        String(hostNode.id),
        {
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        }
      )

      const serialized = hostNode.serialize()

      expect(hostNode.properties).toEqual(livePropertiesBefore)
      expect(serialized.properties?.previewExposures).toEqual([
        {
          name: '$$canvas-image-preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ])
      expect(serialized.properties?.proxyWidgetErrorQuarantine).toBeUndefined()
    })
  })

  describe('host widget values', () => {
    it('serializes promoted values from each host independently', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node: interiorNode } = createNodeWithWidget('Interior')
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const firstHost = createTestSubgraphNode(subgraph, { id: 101 })
      const secondHost = createTestSubgraphNode(subgraph, { id: 102 })
      subgraph.rootGraph.add(firstHost)
      subgraph.rootGraph.add(secondHost)

      firstHost.widgets[0].value = 111
      secondHost.widgets[0].value = 222

      expect(firstHost.serialize().widgets_values).toEqual([111])
      expect(secondHost.serialize().widgets_values).toEqual([222])
    })

    it('keeps promoted values attached to their inputs after reordering', () => {
      const subgraph = createTestSubgraph()
      const first = createNodeWithWidget('First', 'number', 1)
      const second = createNodeWithWidget('Second', 'number', 2)
      subgraph.add(first.node)
      subgraph.add(second.node)

      const firstInput = subgraph.addInput('first', 'number')
      firstInput.connect(first.input, first.node)
      const secondInput = subgraph.addInput('second', 'number')
      secondInput.connect(second.input, second.node)

      const host = createTestSubgraphNode(subgraph)
      host.widgets[0].value = 111
      host.widgets[1].value = 222

      reorderSubgraphInputsByName(host, ['second', 'first'])

      expect(host.widgets.map((widget) => widget.name)).toEqual([
        'second',
        'first'
      ])
      expect(host.serialize().widgets_values).toEqual([222, 111])
    })

    it('does not persist source widget store fallback values after reordering', () => {
      const subgraph = createTestSubgraph()
      const first = createNodeWithWidget('First', 'text', '', 'STRING')
      const second = createNodeWithWidget('Second', 'text', '', 'STRING')
      subgraph.add(first.node)
      subgraph.add(second.node)

      const firstInput = subgraph.addInput('first', 'STRING')
      firstInput.connect(first.input, first.node)
      const secondInput = subgraph.addInput('second', 'STRING')
      secondInput.connect(second.input, second.node)

      const host = createTestSubgraphNode(subgraph)
      const widgetStore = useWidgetValueStore()
      widgetStore.registerWidget(host.rootGraph.id, {
        nodeId: first.node.id,
        name: first.widget.name,
        type: first.widget.type,
        value: 'first value',
        options: {}
      })
      widgetStore.registerWidget(host.rootGraph.id, {
        nodeId: second.node.id,
        name: second.widget.name,
        type: second.widget.type,
        value: 'second value',
        options: {}
      })

      reorderSubgraphInputsByName(host, ['second', 'first'])

      expect(host.serialize().widgets_values).toBeUndefined()
    })

    it('does not acquire a host overlay when a source fallback is saved and reloaded', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'STRING' }]
      })
      const { node: interiorNode, widget: interiorWidget } =
        createNodeWithWidget('Interior', 'text', '', 'STRING')
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const host = createTestSubgraphNode(subgraph, { id: 101 })
      const widgetStore = useWidgetValueStore()
      widgetStore.registerWidget(host.rootGraph.id, {
        nodeId: interiorNode.id,
        name: interiorWidget.name,
        type: interiorWidget.type,
        value: 'source fallback',
        options: {}
      })
      const serialized = host.serialize()
      expect(serialized.widgets_values).toBeUndefined()

      widgetStore.clearGraph(host.rootGraph.id)
      const reloaded = createTestSubgraphNode(subgraph, { id: 101 })
      reloaded.configure(serialized)

      expect(
        widgetStore.getNodeWidgets(reloaded.rootGraph.id, reloaded.id)
      ).toEqual([])
      expect(reloaded.serialize().widgets_values).toBeUndefined()
    })

    it('does not hydrate missing widgets_values entries as explicit host overlays', () => {
      const subgraph = createTestSubgraph()
      const first = createNodeWithWidget('First', 'text', '', 'STRING')
      const second = createNodeWithWidget('Second', 'text', '', 'STRING')
      subgraph.add(first.node)
      subgraph.add(second.node)

      const firstInput = subgraph.addInput('first', 'STRING')
      firstInput.connect(first.input, first.node)
      const secondInput = subgraph.addInput('second', 'STRING')
      secondInput.connect(second.input, second.node)

      const host = createTestSubgraphNode(subgraph, { id: 101 })
      host.widgets[1].value = 'second host value'
      const serialized = host.serialize()
      expect(serialized.widgets_values).toEqual([
        undefined,
        'second host value'
      ])

      const widgetStore = useWidgetValueStore()
      widgetStore.clearGraph(host.rootGraph.id)
      const reloaded = createTestSubgraphNode(subgraph, { id: 101 })
      reloaded.configure(serialized)

      const firstReloadedWidget = reloaded.widgets[0]
      const secondReloadedWidget = reloaded.widgets[1]
      expectPromotedWidgetView(firstReloadedWidget)
      expectPromotedWidgetView(secondReloadedWidget)
      expect(
        widgetStore.getWidget(
          reloaded.rootGraph.id,
          reloaded.id,
          getHostStateName(firstReloadedWidget)
        )
      ).toBeUndefined()
      expect(
        widgetStore.getWidget(
          reloaded.rootGraph.id,
          reloaded.id,
          getHostStateName(secondReloadedWidget)
        )?.value
      ).toBe('second host value')
      expect(
        widgetStore.getNodeWidgets(reloaded.rootGraph.id, reloaded.id)
      ).toHaveLength(1)
      expect(reloaded.serialize().widgets_values).toEqual([
        undefined,
        'second host value'
      ])
    })

    it('moves Vue-edited values with promoted widgets after reordering', () => {
      const subgraph = createTestSubgraph()
      const first = createNodeWithWidget('First', 'text', '', 'STRING')
      const second = createNodeWithWidget('Second', 'text', '', 'STRING')
      subgraph.add(first.node)
      subgraph.add(second.node)

      const firstInput = subgraph.addInput('first', 'STRING')
      firstInput.connect(first.input, first.node)
      const secondInput = subgraph.addInput('second', 'STRING')
      secondInput.connect(second.input, second.node)

      const host = createTestSubgraphNode(subgraph)
      const nodeData = extractVueNodeData(host)
      const widgets = computeProcessedWidgets({
        nodeData,
        graphId: host.rootGraph.id,
        showAdvanced: false,
        isGraphReady: false,
        rootGraph: null,
        ui: {
          getTooltipConfig: () => ({}),
          handleNodeRightClick: () => {}
        }
      })
      widgets[0].updateHandler('first value')
      widgets[1].updateHandler('second value')

      reorderSubgraphInputsByName(host, ['second', 'first'])

      expect(host.serialize().widgets_values).toEqual([
        'second value',
        'first value'
      ])
    })

    it('sends Vue-edited values to dragged promoted widget targets', async () => {
      const subgraph = createTestSubgraph()
      const first = createNodeWithWidget('First', 'text', '', 'STRING')
      const second = createNodeWithWidget('Second', 'text', '', 'STRING')
      first.node.comfyClass = 'First'
      second.node.comfyClass = 'Second'
      subgraph.add(first.node)
      subgraph.add(second.node)

      const firstInput = subgraph.addInput('first', 'STRING')
      firstInput.connect(first.input, first.node)
      const secondInput = subgraph.addInput('second', 'STRING')
      secondInput.connect(second.input, second.node)

      const host = createTestSubgraphNode(subgraph)
      host.comfyClass = 'Subgraph'
      host.graph?.add(host)
      const nodeData = extractVueNodeData(host)
      const widgets = computeProcessedWidgets({
        nodeData,
        graphId: host.rootGraph.id,
        showAdvanced: false,
        isGraphReady: false,
        rootGraph: null,
        ui: {
          getTooltipConfig: () => ({}),
          handleNodeRightClick: () => {}
        }
      })
      widgets[0].updateHandler('first value')
      widgets[1].updateHandler('second value')

      reorderSubgraphInputsByName(host, ['second', 'first'])

      const { output } = await graphToPrompt(host.rootGraph)

      expect(output[`${host.id}:${first.node.id}`].inputs.value).toBe(
        'first value'
      )
      expect(output[`${host.id}:${second.node.id}`].inputs.value).toBe(
        'second value'
      )
    })

    it('keeps text and seed values on their targets when the seed input moves up', async () => {
      const subgraph = createTestSubgraph()
      const positive = createNodeWithWidget('Positive', 'text', '', 'STRING')
      const seed = createNodeWithWidget('Sampler', 'number', 0, 'INT')
      const negative = createNodeWithWidget('Negative', 'text', '', 'STRING')
      positive.node.comfyClass = 'Positive'
      seed.node.comfyClass = 'Sampler'
      negative.node.comfyClass = 'Negative'
      subgraph.add(positive.node)
      subgraph.add(seed.node)
      subgraph.add(negative.node)

      const positiveInput = subgraph.addInput('text_1', 'STRING')
      positiveInput.connect(positive.input, positive.node)
      const negativeInput = subgraph.addInput('text', 'STRING')
      negativeInput.connect(negative.input, negative.node)
      const seedInput = subgraph.addInput('seed', 'INT')
      seedInput.connect(seed.input, seed.node)

      const host = createTestSubgraphNode(subgraph)
      host.comfyClass = 'Subgraph'
      host.graph?.add(host)
      host.widgets[0].value = 'positive prompt'
      host.widgets[1].value = 'negative prompt'
      host.widgets[2].value = 123456

      reorderSubgraphInputAtIndex(host, 2, 1)

      const { output } = await graphToPrompt(host.rootGraph)

      expect(host.serialize().widgets_values).toEqual([
        'positive prompt',
        123456,
        'negative prompt'
      ])
      expect(output[`${host.id}:${positive.node.id}`].inputs.value).toBe(
        'positive prompt'
      )
      expect(output[`${host.id}:${seed.node.id}`].inputs.value).toBe(123456)
      expect(output[`${host.id}:${negative.node.id}`].inputs.value).toBe(
        'negative prompt'
      )
    })

    it('keeps Vue-edited text and seed values on their targets when the seed input moves up', async () => {
      const subgraph = createTestSubgraph()
      const positive = createNodeWithWidget('Positive', 'text', '', 'STRING')
      const negative = createNodeWithWidget('Negative', 'text', '', 'STRING')
      const seed = createNodeWithWidget('Sampler', 'number', 0, 'INT')
      positive.node.comfyClass = 'Positive'
      negative.node.comfyClass = 'Negative'
      seed.node.comfyClass = 'Sampler'
      subgraph.add(positive.node)
      subgraph.add(negative.node)
      subgraph.add(seed.node)

      const positiveInput = subgraph.addInput('text_1', 'STRING')
      positiveInput.connect(positive.input, positive.node)
      const negativeInput = subgraph.addInput('text', 'STRING')
      negativeInput.connect(negative.input, negative.node)
      const seedInput = subgraph.addInput('seed', 'INT')
      seedInput.connect(seed.input, seed.node)

      const host = createTestSubgraphNode(subgraph)
      host.comfyClass = 'Subgraph'
      host.graph?.add(host)
      const nodeData = extractVueNodeData(host)
      const widgets = computeProcessedWidgets({
        nodeData,
        graphId: host.rootGraph.id,
        showAdvanced: false,
        isGraphReady: false,
        rootGraph: null,
        ui: {
          getTooltipConfig: () => ({}),
          handleNodeRightClick: () => {}
        }
      })
      widgets[0].updateHandler('positive prompt')
      widgets[1].updateHandler('negative prompt')
      widgets[2].updateHandler(123456)

      reorderSubgraphInputAtIndex(host, 2, 1)

      const { output } = await graphToPrompt(host.rootGraph)

      expect(host.serialize().widgets_values).toEqual([
        'positive prompt',
        123456,
        'negative prompt'
      ])
      expect(output[`${host.id}:${positive.node.id}`].inputs.value).toBe(
        'positive prompt'
      )
      expect(output[`${host.id}:${seed.node.id}`].inputs.value).toBe(123456)
      expect(output[`${host.id}:${negative.node.id}`].inputs.value).toBe(
        'negative prompt'
      )
    })

    it('ignores direct source seed changes after the seed input moves up', async () => {
      const subgraph = createTestSubgraph()
      const positive = createNodeWithWidget('Positive', 'text', '', 'STRING')
      const negative = createNodeWithWidget('Negative', 'text', '', 'STRING')
      const seed = createNodeWithWidget('Sampler', 'number', 0, 'INT')
      positive.node.comfyClass = 'Positive'
      negative.node.comfyClass = 'Negative'
      seed.node.comfyClass = 'Sampler'
      subgraph.add(positive.node)
      subgraph.add(negative.node)
      subgraph.add(seed.node)

      const positiveInput = subgraph.addInput('text_1', 'STRING')
      positiveInput.connect(positive.input, positive.node)
      const negativeInput = subgraph.addInput('text', 'STRING')
      negativeInput.connect(negative.input, negative.node)
      const seedInput = subgraph.addInput('seed', 'INT')
      seedInput.connect(seed.input, seed.node)

      const host = createTestSubgraphNode(subgraph)
      host.comfyClass = 'Subgraph'
      host.graph?.add(host)
      host.widgets[0].value = 'positive prompt'
      host.widgets[1].value = 'negative prompt'
      host.widgets[2].value = 123456
      reorderSubgraphInputAtIndex(host, 2, 1)

      seed.widget.linkedWidgets = [
        {
          name: 'control_after_generate',
          value: 'increment',
          serialize: false,
          beforeQueued: () => {},
          afterQueued: () => {}
        } as never
      ]
      seed.widget.value = 789

      const { output } = await graphToPrompt(host.rootGraph)

      expect(output[`${host.id}:${seed.node.id}`].inputs.value).toBe(123456)
    })

    it('syncs Vue-edited promoted seed values to the controlled source widget after moving seed up', async () => {
      const subgraph = createTestSubgraph()
      const positive = createNodeWithWidget('Positive', 'text', '', 'STRING')
      const negative = createNodeWithWidget('Negative', 'text', '', 'STRING')
      const seed = createNodeWithWidget('Sampler', 'number', 0, 'INT')
      seed.widget.options.max = 1125899906842624
      subgraph.add(positive.node)
      subgraph.add(negative.node)
      subgraph.add(seed.node)

      const positiveInput = subgraph.addInput('text_1', 'STRING')
      positiveInput.connect(positive.input, positive.node)
      const negativeInput = subgraph.addInput('text', 'STRING')
      negativeInput.connect(negative.input, negative.node)
      const seedInput = subgraph.addInput('seed', 'INT')
      seedInput.connect(seed.input, seed.node)

      const host = createTestSubgraphNode(subgraph)
      seed.widget.linkedWidgets = [
        {
          name: 'control_after_generate',
          value: 'fixed',
          serialize: false,
          beforeQueued: () => {},
          afterQueued: () => {}
        } as never
      ]
      const nodeData = extractVueNodeData(host)
      const widgets = computeProcessedWidgets({
        nodeData,
        graphId: host.rootGraph.id,
        showAdvanced: false,
        isGraphReady: false,
        rootGraph: null,
        ui: {
          getTooltipConfig: () => ({}),
          handleNodeRightClick: () => {}
        }
      })
      widgets[2].updateHandler(123456)

      reorderSubgraphInputAtIndex(host, 2, 1)

      expect(seed.widget.value).toBe(123456)
    })

    it('shows a control-updated promoted seed value in processed widgets after moving seed up', () => {
      const subgraph = createTestSubgraph()
      const positive = createNodeWithWidget('Positive', 'text', '', 'STRING')
      const negative = createNodeWithWidget('Negative', 'text', '', 'STRING')
      const seed = createNodeWithWidget('Sampler', 'number', 0, 'INT')
      seed.widget.options.max = 1125899906842624
      subgraph.add(positive.node)
      subgraph.add(negative.node)
      subgraph.add(seed.node)

      const positiveInput = subgraph.addInput('text_1', 'STRING')
      positiveInput.connect(positive.input, positive.node)
      const negativeInput = subgraph.addInput('text', 'STRING')
      negativeInput.connect(negative.input, negative.node)
      const seedInput = subgraph.addInput('seed', 'INT')
      seedInput.connect(seed.input, seed.node)

      const host = createTestSubgraphNode(subgraph)
      const nodeData = extractVueNodeData(host)
      const widgets = computeProcessedWidgets({
        nodeData,
        graphId: host.rootGraph.id,
        showAdvanced: false,
        isGraphReady: false,
        rootGraph: null,
        ui: {
          getTooltipConfig: () => ({}),
          handleNodeRightClick: () => {}
        }
      })
      widgets[2].updateHandler(123456)
      seed.widget.linkedWidgets = [
        {
          name: 'control_after_generate',
          value: 'increment',
          serialize: false,
          beforeQueued: () => {},
          afterQueued: () => {},
          [IS_CONTROL_WIDGET]: true
        } as never
      ]
      reorderSubgraphInputAtIndex(host, 2, 1)
      host.widgets[1].afterQueued?.()

      const updatedNodeData = extractVueNodeData(host)
      const updatedWidgets = computeProcessedWidgets({
        nodeData: updatedNodeData,
        graphId: host.rootGraph.id,
        showAdvanced: false,
        isGraphReady: false,
        rootGraph: null,
        ui: {
          getTooltipConfig: () => ({}),
          handleNodeRightClick: () => {}
        }
      })

      expect(updatedWidgets[1].value).toBe(123457)
    })

    it('increments the promoted host seed without using the source seed value', () => {
      const subgraph = createTestSubgraph()
      const positive = createNodeWithWidget('Positive', 'text', '', 'STRING')
      const negative = createNodeWithWidget('Negative', 'text', '', 'STRING')
      const seed = createNodeWithWidget('Sampler', 'number', 0, 'INT')
      seed.widget.options.max = 1125899906842624
      subgraph.add(positive.node)
      subgraph.add(negative.node)
      subgraph.add(seed.node)

      const positiveInput = subgraph.addInput('text_1', 'STRING')
      positiveInput.connect(positive.input, positive.node)
      const negativeInput = subgraph.addInput('text', 'STRING')
      negativeInput.connect(negative.input, negative.node)
      const seedInput = subgraph.addInput('seed', 'INT')
      seedInput.connect(seed.input, seed.node)

      const host = createTestSubgraphNode(subgraph)
      seed.widget.linkedWidgets = [
        {
          name: 'control_after_generate',
          value: 'increment',
          serialize: false,
          beforeQueued: () => {},
          afterQueued: () => {},
          [IS_CONTROL_WIDGET]: true
        } as never
      ]
      host.widgets[2].value = 2
      reorderSubgraphInputAtIndex(host, 2, 1)
      seed.widget.value = 8
      host.widgets[1].afterQueued?.()

      expect(host.widgets[1].value).toBe(3)
      expect(
        useWidgetValueStore()
          .getNodeWidgets(host.rootGraph.id, host.id)
          .find((entry) => entry.name.startsWith('seed:'))?.value
      ).toBe(3)
    })
  })

  describe('proxyWidgets is no longer re-emitted', () => {
    it('does not write properties.proxyWidgets after serialize', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node: interiorNode } = createNodeWithWidget('Interior')
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const hostNode = createTestSubgraphNode(subgraph)
      // Ensure no pre-existing proxyWidgets property leaks through.
      delete hostNode.properties.proxyWidgets

      const serialized = hostNode.serialize()

      expect(serialized.properties?.proxyWidgets).toBeUndefined()
      expect(hostNode.properties.proxyWidgets).toBeUndefined()
    })

    it('preserves a pre-existing legacy proxyWidgets property without re-deriving it', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)

      const legacy: SerializedProxyWidgetTuple[] = [['7', 'seed']]
      hostNode.properties.proxyWidgets = legacy

      const serialized = hostNode.serialize()

      // Still serialized as-is — not deleted, not rewritten.
      expect(serialized.properties?.proxyWidgets).toStrictEqual(legacy)
    })
  })

  describe('previewExposures round-trip', () => {
    it('hydrates previewExposures into the store during configure', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)
      const rootGraphId = hostNode.rootGraph.id
      const hostLocator = String(hostNode.id)

      hostNode.properties.previewExposures = [
        {
          name: 'preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ]

      hostNode._internalConfigureAfterSlots()

      expect(
        usePreviewExposureStore().getExposures(rootGraphId, hostLocator)
      ).toEqual([
        {
          name: 'preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ])
    })

    it('writes previewExposures from the store on serialize', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)

      const store = usePreviewExposureStore()
      const rootGraphId = hostNode.rootGraph.id
      const hostLocator = String(hostNode.id)

      store.addExposure(rootGraphId, hostLocator, {
        sourceNodeId: '12',
        sourcePreviewName: '$$canvas-image-preview'
      })
      store.addExposure(rootGraphId, hostLocator, {
        sourceNodeId: '14',
        sourcePreviewName: 'videopreview'
      })

      const serialized = hostNode.serialize()

      expect(serialized.properties?.previewExposures).toEqual([
        {
          name: '$$canvas-image-preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        },
        {
          name: 'videopreview',
          sourceNodeId: '14',
          sourcePreviewName: 'videopreview'
        }
      ])
    })

    it('serializes preview exposures per host instance', () => {
      const subgraph = createTestSubgraph()
      const firstHost = createTestSubgraphNode(subgraph, { id: 101 })
      const secondHost = createTestSubgraphNode(subgraph, { id: 102 })
      subgraph.rootGraph.add(firstHost)
      subgraph.rootGraph.add(secondHost)

      const store = usePreviewExposureStore()
      const rootGraphId = firstHost.rootGraph.id

      store.addExposure(rootGraphId, String(firstHost.id), {
        sourceNodeId: '12',
        sourcePreviewName: '$$canvas-image-preview'
      })
      store.addExposure(rootGraphId, String(secondHost.id), {
        sourceNodeId: '14',
        sourcePreviewName: 'videopreview'
      })

      const firstExposures = firstHost.serialize().properties?.previewExposures
      const secondExposures =
        secondHost.serialize().properties?.previewExposures

      expect(Array.isArray(firstExposures)).toBe(true)
      expect(Array.isArray(secondExposures)).toBe(true)
      if (!Array.isArray(firstExposures) || !Array.isArray(secondExposures))
        throw new Error('Expected serialized previewExposures arrays')

      expect(firstExposures).toEqual([
        {
          name: '$$canvas-image-preview',
          sourceNodeId: '12',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ])
      expect(secondExposures).toEqual([
        {
          name: 'videopreview',
          sourceNodeId: '14',
          sourcePreviewName: 'videopreview'
        }
      ])
      expect(firstExposures?.[0]).not.toHaveProperty('hostInstanceId')
      expect(firstExposures?.[0]).not.toHaveProperty('hostNodeLocator')
      expect(firstExposures?.[0]).not.toHaveProperty('rootGraphId')
      expect(secondExposures?.[0]).not.toHaveProperty('hostInstanceId')
      expect(secondExposures?.[0]).not.toHaveProperty('hostNodeLocator')
      expect(secondExposures?.[0]).not.toHaveProperty('rootGraphId')
    })

    it('omits previewExposures when the store has no entries for the host', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)
      hostNode.properties.previewExposures = [
        {
          name: 'stale',
          sourceNodeId: '0',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ]

      const serialized = hostNode.serialize()

      expect(serialized.properties?.previewExposures).toBeUndefined()
      expect(hostNode.properties.previewExposures).toEqual([
        {
          name: 'stale',
          sourceNodeId: '0',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ])
    })
  })

  describe('proxyWidgetErrorQuarantine', () => {
    it('preserves quarantine entries through serialize and is inert at runtime', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)

      appendHostQuarantine(hostNode, [
        makeQuarantineEntry({
          originalEntry: ['7', 'seed'],
          reason: 'missingSourceNode',
          hostValue: 42
        })
      ])

      const serialized = hostNode.serialize()
      const quarantine = serialized.properties?.proxyWidgetErrorQuarantine
      expect(Array.isArray(quarantine)).toBe(true)
      expect(quarantine).toHaveLength(1)

      // Inertness: quarantine entries do not produce widgets.
      expect(
        hostNode.widgets.some(
          (w) => 'sourceNodeId' in w && w.sourceNodeId === '7'
        )
      ).toBe(false)
    })

    it('removes the property entirely when quarantine is empty', () => {
      const subgraph = createTestSubgraph()
      const hostNode = createTestSubgraphNode(subgraph)
      hostNode.properties.proxyWidgetErrorQuarantine = []

      const serialized = hostNode.serialize()

      expect(serialized.properties?.proxyWidgetErrorQuarantine).toBeUndefined()
      expect(hostNode.properties.proxyWidgetErrorQuarantine).toEqual([])
    })
  })
})
