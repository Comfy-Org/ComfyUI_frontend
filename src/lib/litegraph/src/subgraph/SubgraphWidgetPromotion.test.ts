import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ISlotType,
  Subgraph,
  TWidgetType
} from '@/lib/litegraph/src/litegraph'
import { BaseWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import {
  appendQuarantine,
  flushProxyWidgetMigration,
  makeQuarantineEntry
} from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { reorderSubgraphInputsByName } from '@/core/graph/subgraph/promotionUtils'
import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { IS_CONTROL_WIDGET } from '@/scripts/controlWidgetMarker'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { graphToPrompt } from '@/utils/executionUtil'

import {
  createEventCapture,
  createTestRootGraph,
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

function createNodeWithWidget(
  title: string,
  widgetType: TWidgetType = 'number',
  widgetValue: unknown = 42,
  slotType: ISlotType = 'number',
  tooltip?: string
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
    node,
    tooltip
  })
  node.widgets = [widget]
  input.widget = { name: widget.name }

  return { node, widget, input }
}

function setupPromotedWidget(
  subgraph: Subgraph,
  node: LGraphNode,
  slotIndex = 0
) {
  subgraph.add(node)
  subgraph.inputNode.slots[slotIndex].connect(node.inputs[slotIndex], node)
  return createTestSubgraphNode(subgraph)
}

function expectPromotedWidgetView(
  widget: unknown
): asserts widget is PromotedWidgetView {
  expect(widget).toMatchObject({
    sourceNodeId: expect.any(String),
    sourceWidgetName: expect.any(String)
  })
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('SubgraphWidgetPromotion', () => {
  describe('Widget Promotion Functionality', () => {
    it('should promote widgets when connecting node to subgraph input', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node } = createNodeWithWidget('Test Node')
      const subgraphNode = setupPromotedWidget(subgraph, node)

      // The widget should be promoted to the subgraph node
      expect(subgraphNode.widgets).toHaveLength(1)
      expect(subgraphNode.widgets[0].name).toBe('value') // Uses subgraph input name
      expect(subgraphNode.widgets[0].type).toBe('number')
      expect(subgraphNode.widgets[0].value).toBe(42)
    })

    it('should promote all widget types', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'numberInput', type: 'number' },
          { name: 'stringInput', type: 'string' },
          { name: 'toggleInput', type: 'boolean' }
        ]
      })

      // Create nodes with different widget types
      const { node: numberNode } = createNodeWithWidget(
        'Number Node',
        'number',
        100
      )
      const { node: stringNode } = createNodeWithWidget(
        'String Node',
        'string',
        'test',
        'string'
      )
      const { node: toggleNode } = createNodeWithWidget(
        'Toggle Node',
        'toggle',
        true,
        'boolean'
      )

      // Setup all nodes
      subgraph.add(numberNode)
      subgraph.add(stringNode)
      subgraph.add(toggleNode)

      subgraph.inputNode.slots[0].connect(numberNode.inputs[0], numberNode)
      subgraph.inputNode.slots[1].connect(stringNode.inputs[0], stringNode)
      subgraph.inputNode.slots[2].connect(toggleNode.inputs[0], toggleNode)

      const subgraphNode = createTestSubgraphNode(subgraph)

      // All widgets should be promoted
      expect(subgraphNode.widgets).toHaveLength(3)

      // Check specific widget values
      expect(subgraphNode.widgets[0].value).toBe(100)
      expect(subgraphNode.widgets[1].value).toBe('test')
      expect(subgraphNode.widgets[2].value).toBe(true)
    })

    it('should fire widget-promoted event when widget is promoted', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input', type: 'number' }]
      })

      const eventCapture = createEventCapture(subgraph.events, [
        'widget-promoted',
        'widget-demoted'
      ])

      const { node } = createNodeWithWidget('Test Node')
      const subgraphNode = setupPromotedWidget(subgraph, node)

      // Check event was fired
      const promotedEvents = eventCapture.getEventsByType('widget-promoted')
      expect(promotedEvents).toHaveLength(1)
      expect(promotedEvents[0].detail.widget).toBeDefined()
      expect(promotedEvents[0].detail.subgraphNode).toBe(subgraphNode)

      eventCapture.cleanup()
    })

    it('should handle multiple widgets on same node', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'input1', type: 'number' },
          { name: 'input2', type: 'string' }
        ]
      })

      // Create node with multiple widgets
      const multiWidgetNode = new LGraphNode('Multi Widget Node')
      const numInput = multiWidgetNode.addInput('num', 'number')
      const strInput = multiWidgetNode.addInput('str', 'string')

      // @ts-expect-error Abstract class instantiation
      const widget1 = new BaseWidget({
        name: 'widget1',
        type: 'number',
        value: 10,
        y: 0,
        options: {},
        node: multiWidgetNode
      })

      // @ts-expect-error Abstract class instantiation
      const widget2 = new BaseWidget({
        name: 'widget2',
        type: 'string',
        value: 'hello',
        y: 40,
        options: {},
        node: multiWidgetNode
      })

      multiWidgetNode.widgets = [widget1, widget2]
      numInput.widget = { name: widget1.name }
      strInput.widget = { name: widget2.name }
      subgraph.add(multiWidgetNode)

      // Connect both inputs
      subgraph.inputNode.slots[0].connect(
        multiWidgetNode.inputs[0],
        multiWidgetNode
      )
      subgraph.inputNode.slots[1].connect(
        multiWidgetNode.inputs[1],
        multiWidgetNode
      )

      // Create SubgraphNode
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Both widgets should be promoted
      expect(subgraphNode.widgets).toHaveLength(2)
      expect(subgraphNode.widgets[0].name).toBe('input1')
      expect(subgraphNode.widgets[0].value).toBe(10)

      expect(subgraphNode.widgets[1].name).toBe('input2')
      expect(subgraphNode.widgets[1].value).toBe('hello')
    })

    it('should fire widget-demoted events when node is removed', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input', type: 'number' }]
      })

      const { node } = createNodeWithWidget('Test Node')
      const subgraphNode = setupPromotedWidget(subgraph, node)

      expect(subgraphNode.widgets).toHaveLength(1)

      const eventCapture = createEventCapture(subgraph.events, [
        'widget-demoted'
      ])

      // Remove the subgraph node
      subgraphNode.onRemoved()

      // Should fire demoted events for all widgets
      const demotedEvents = eventCapture.getEventsByType('widget-demoted')
      expect(demotedEvents).toHaveLength(1)

      eventCapture.cleanup()
    })

    it('should not promote widget if input is not connected', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input', type: 'number' }]
      })

      const { node } = createNodeWithWidget('Test Node')
      subgraph.add(node)

      // Don't connect - just create SubgraphNode
      const subgraphNode = createTestSubgraphNode(subgraph)

      // No widgets should be promoted
      expect(subgraphNode.widgets).toHaveLength(0)
    })

    it('should handle disconnection of promoted widget', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input', type: 'number' }]
      })

      const { node } = createNodeWithWidget('Test Node')
      const subgraphNode = setupPromotedWidget(subgraph, node)
      expect(subgraphNode.widgets).toHaveLength(1)

      // Disconnect the link
      subgraph.inputNode.slots[0].disconnect()

      // Widget should be removed (through event listeners)
      expect(subgraphNode.widgets).toHaveLength(0)
    })
  })

  describe('Nested Subgraph Widget Promotion', () => {
    it('should hydrate legacy -1 proxyWidgets to a concrete promoted widget with preserved options', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'batch_size', type: 'INT' }]
      })

      const interiorNode = new LGraphNode('EmptyLatentImage')
      const interiorInput = interiorNode.addInput('batch_size', 'INT')
      interiorNode.addOutput('LATENT', 'LATENT')
      interiorNode.addWidget('number', 'batch_size', 1, () => {}, {
        step: 10,
        min: 1
      })
      interiorInput.widget = { name: 'batch_size' }
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const hostNode = createTestSubgraphNode(subgraph)
      const serializedHostNode = hostNode.serialize()
      serializedHostNode.properties = {
        ...serializedHostNode.properties,
        proxyWidgets: [['-1', 'batch_size']]
      }

      hostNode.configure(serializedHostNode)

      expect(hostNode.widgets).toHaveLength(1)
      expect(hostNode.widgets[0].name).toBe('batch_size')
      expect(hostNode.widgets[0].value).toBe(1)
      expect(hostNode.widgets[0].options.step).toBe(10)
    })

    it('should prune proxyWidgets referencing nodes not in subgraph on configure', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'clip', type: 'CLIP' },
          { name: 'model', type: 'MODEL' },
          { name: 'vae', type: 'VAE' }
        ]
      })

      const { node: samplerNode } = createNodeWithWidget(
        'Sampler',
        'number',
        42,
        'number'
      )
      subgraph.add(samplerNode)
      subgraph.inputNode.slots[1].connect(samplerNode.inputs[0], samplerNode)

      // Add nodes without widget-connected inputs for the other slots
      const modelNode = new LGraphNode('ModelNode')
      modelNode.addInput('model', 'MODEL')
      subgraph.add(modelNode)

      const vaeNode = new LGraphNode('VAENode')
      vaeNode.addInput('vae', 'VAE')
      subgraph.add(vaeNode)

      const outerNode = createTestSubgraphNode(subgraph)
      const keptSamplerNodeId = String(samplerNode.id)

      outerNode.properties.proxyWidgets = [
        ['999', 'text'],
        ['998', 'text'],
        [keptSamplerNodeId, 'widget']
      ]

      outerNode.configure(outerNode.serialize())

      // Check widgets getter — stale entries should not produce views
      const widgetSourceIds = outerNode.widgets
        .filter(isPromotedWidgetView)
        .filter((w) => !w.name.startsWith('$$'))
        .map((w) => w.sourceNodeId)

      expect(widgetSourceIds).not.toContain('999')
      expect(widgetSourceIds).not.toContain('998')
      expect(widgetSourceIds).toContain(keptSamplerNodeId)
    })

    it('resolves legacy prefixed proxyWidgets via the immediate child PromotedWidgetView identity', () => {
      const rootGraph = createTestRootGraph()

      const innerSubgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'seed', type: 'number' }]
      })

      const samplerNode = new LGraphNode('Sampler')
      const samplerInput = samplerNode.addInput('seed', 'number')
      samplerNode.addWidget('number', 'noise_seed', 123, () => {})
      samplerInput.widget = { name: 'noise_seed' }
      innerSubgraph.add(samplerNode)
      innerSubgraph.inputNode.slots[0].connect(
        samplerNode.inputs[0],
        samplerNode
      )

      const outerSubgraph = createTestSubgraph({ rootGraph })
      const nestedNode = createTestSubgraphNode(innerSubgraph, {
        parentGraph: outerSubgraph
      })
      outerSubgraph.add(nestedNode)

      const hostNode = createTestSubgraphNode(outerSubgraph, {
        parentGraph: rootGraph
      })

      const serializedHostNode = hostNode.serialize()
      serializedHostNode.properties = {
        ...serializedHostNode.properties,
        proxyWidgets: [
          [
            String(nestedNode.id),
            `${nestedNode.id}: ${samplerNode.id}: noise_seed`
          ]
        ]
      }

      hostNode.configure(serializedHostNode)
      flushProxyWidgetMigration({ hostNode })

      const promotedWidgets = hostNode.widgets
        .filter(isPromotedWidgetView)
        .filter((widget) => !widget.name.startsWith('$$'))

      expect(promotedWidgets).toHaveLength(1)
      expect(promotedWidgets[0]?.sourceNodeId).toBe(String(nestedNode.id))
      expect(hostNode.properties.proxyWidgets).toBeUndefined()
      expect(hostNode.properties.proxyWidgetErrorQuarantine).toBeUndefined()
    })

    it('should preserve promoted widget entries after cloning', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'text', type: 'STRING' }]
      })

      const interiorNode = new LGraphNode('CLIPTextEncode')
      const interiorInput = interiorNode.addInput('text', 'STRING')
      interiorNode.addOutput('CONDITIONING', 'CONDITIONING')
      interiorNode.addWidget('text', 'text', '', () => {})
      interiorInput.widget = { name: 'text' }
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const hostNode = createTestSubgraphNode(subgraph)
      const serialized = hostNode.serialize()

      const cloneNode = createTestSubgraphNode(subgraph)
      cloneNode.configure(serialized)

      const promotedNames = cloneNode.widgets
        .filter(isPromotedWidgetView)
        .filter((widget) => !widget.name.startsWith('$$'))
        .map((widget) => widget.sourceWidgetName)

      expect(promotedNames).toContain('text')
    })
  })

  describe('Tooltip Promotion', () => {
    it('should preserve widget tooltip when promoting', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const originalTooltip = 'This is a test tooltip'
      const { node } = createNodeWithWidget(
        'Test Node',
        'number',
        42,
        'number',
        originalTooltip
      )
      const subgraphNode = setupPromotedWidget(subgraph, node)

      // The promoted widget should preserve the original tooltip
      expect(subgraphNode.widgets).toHaveLength(1)
      expect(subgraphNode.widgets[0].tooltip).toBe(originalTooltip)
    })

    it('should handle widgets with no tooltip', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node } = createNodeWithWidget('Test Node', 'number', 42, 'number')
      const subgraphNode = setupPromotedWidget(subgraph, node)

      // The promoted widget should have undefined tooltip
      expect(subgraphNode.widgets).toHaveLength(1)
      expect(subgraphNode.widgets[0].tooltip).toBeUndefined()
    })

    it('should preserve tooltips for multiple promoted widgets', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'input1', type: 'number' },
          { name: 'input2', type: 'string' }
        ]
      })

      // Create node with multiple widgets with different tooltips
      const multiWidgetNode = new LGraphNode('Multi Widget Node')
      const numInput = multiWidgetNode.addInput('num', 'number')
      const strInput = multiWidgetNode.addInput('str', 'string')

      // @ts-expect-error Abstract class instantiation
      const widget1 = new BaseWidget({
        name: 'widget1',
        type: 'number',
        value: 10,
        y: 0,
        options: {},
        node: multiWidgetNode,
        tooltip: 'Number widget tooltip'
      })

      // @ts-expect-error Abstract class instantiation
      const widget2 = new BaseWidget({
        name: 'widget2',
        type: 'string',
        value: 'hello',
        y: 40,
        options: {},
        node: multiWidgetNode,
        tooltip: 'String widget tooltip'
      })

      multiWidgetNode.widgets = [widget1, widget2]
      numInput.widget = { name: widget1.name }
      strInput.widget = { name: widget2.name }
      subgraph.add(multiWidgetNode)

      // Connect both inputs
      subgraph.inputNode.slots[0].connect(
        multiWidgetNode.inputs[0],
        multiWidgetNode
      )
      subgraph.inputNode.slots[1].connect(
        multiWidgetNode.inputs[1],
        multiWidgetNode
      )

      // Create SubgraphNode
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Both widgets should preserve their tooltips
      expect(subgraphNode.widgets).toHaveLength(2)
      expect(subgraphNode.widgets[0].tooltip).toBe('Number widget tooltip')
      expect(subgraphNode.widgets[1].tooltip).toBe('String widget tooltip')
    })

    it('should preserve original tooltip after promotion', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const originalTooltip = 'Original tooltip'
      const { node } = createNodeWithWidget(
        'Test Node',
        'number',
        42,
        'number',
        originalTooltip
      )
      const subgraphNode = setupPromotedWidget(subgraph, node)

      const promotedWidget = subgraphNode.widgets[0]

      // The promoted widget should preserve the original tooltip
      expect(promotedWidget.tooltip).toBe(originalTooltip)

      // The promoted widget should still function normally
      expect(promotedWidget.name).toBe('value') // Uses subgraph input name
      expect(promotedWidget.type).toBe('number')
      expect(promotedWidget.value).toBe(42)
    })
  })

  describe('SubgraphNode.serialize', () => {
    it('does not mutate interior widget values when serializing the host', () => {
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
        name: hostWidget.name,
        type: hostWidget.type,
        value: 99,
        options: {}
      })
      hostNode.serialize()

      expect(interiorWidget.value).toBe(42)
    })

    describe('host widget values', () => {
      type SourceSpec = {
        inputName: string
        title: string
        widgetType: TWidgetType
        slotType: ISlotType
        initialValue: unknown
        withComfyClass?: boolean
        hugeMaxSeed?: boolean
      }
      type EditValue = string | number | boolean
      type EditSpec = {
        via: 'viewKey' | 'vue'
        index: number
        value: EditValue
      }
      type ReorderSpec = { kind: 'none' } | { kind: 'byName'; order: string[] }

      const text = (inputName: string, title: string): SourceSpec => ({
        inputName,
        title,
        widgetType: 'text',
        slotType: 'STRING',
        initialValue: '',
        withComfyClass: true
      })
      const num = (
        inputName: string,
        title: string,
        initialValue = 0
      ): SourceSpec => ({
        inputName,
        title,
        widgetType: 'number',
        slotType: 'number',
        initialValue
      })
      const seed = (): SourceSpec => ({
        inputName: 'seed',
        title: 'Sampler',
        widgetType: 'number',
        slotType: 'INT',
        initialValue: 0,
        withComfyClass: true
      })

      const TEXT_PAIR: SourceSpec[] = [
        text('first', 'First'),
        text('second', 'Second')
      ]
      const NUMBER_PAIR: SourceSpec[] = [
        num('first', 'First', 1),
        num('second', 'Second', 2)
      ]
      const TEXT_TEXT_SEED: SourceSpec[] = [
        text('text_1', 'Positive'),
        text('text', 'Negative'),
        seed()
      ]

      function buildSources(
        subgraph: ReturnType<typeof createTestSubgraph>,
        specs: SourceSpec[]
      ) {
        const built = specs.map((s) => {
          const created = createNodeWithWidget(
            s.title,
            s.widgetType,
            s.initialValue,
            s.slotType
          )
          if (s.withComfyClass) created.node.comfyClass = s.title
          if (s.hugeMaxSeed) created.widget.options.max = 1125899906842624
          subgraph.add(created.node)
          return created
        })
        for (const [i, s] of specs.entries()) {
          subgraph
            .addInput(s.inputName, String(s.slotType))
            .connect(built[i].input, built[i].node)
        }
        return built
      }

      function vueEdit(
        host: ReturnType<typeof createTestSubgraphNode>,
        index: number,
        value: EditValue
      ) {
        const widgets = computeProcessedWidgets({
          nodeData: extractVueNodeData(host),
          graphId: host.rootGraph.id,
          showAdvanced: false,
          isGraphReady: false,
          rootGraph: null,
          ui: { getTooltipConfig: () => ({}), handleNodeRightClick: () => {} }
        })
        widgets[index].updateHandler(value)
      }

      function applyEdit(
        host: ReturnType<typeof createTestSubgraphNode>,
        edit: EditSpec
      ) {
        if (edit.via === 'viewKey') host.widgets[edit.index].value = edit.value
        else vueEdit(host, edit.index, edit.value)
      }

      function applyReorder(
        host: ReturnType<typeof createTestSubgraphNode>,
        r: ReorderSpec
      ) {
        if (r.kind === 'byName') reorderSubgraphInputsByName(host, r.order)
      }

      function makeControlWidget(
        value: 'increment' | 'fixed',
        marker: boolean
      ) {
        const base = {
          name: 'control_after_generate',
          value,
          serialize: false,
          beforeQueued: () => {},
          afterQueued: () => {}
        }
        return marker ? { ...base, [IS_CONTROL_WIDGET]: true } : base
      }

      type ReorderCase = {
        name: string
        sources: SourceSpec[]
        edits: EditSpec[]
        reorder: ReorderSpec
        expectedNames?: string[]
        expectedWidgetsValues?: unknown[]
        promptByIndex?: Record<number, unknown>
      }

      const reorderCases: ReorderCase[] = [
        {
          name: 'plain numbers via ViewKey, swap by name',
          sources: NUMBER_PAIR,
          edits: [
            { via: 'viewKey', index: 0, value: 111 },
            { via: 'viewKey', index: 1, value: 222 }
          ],
          reorder: { kind: 'byName', order: ['second', 'first'] },
          expectedNames: ['second', 'first'],
          expectedWidgetsValues: [222, 111]
        },
        {
          name: 'plain text via Vue, swap by name (widgets_values + prompt)',
          sources: TEXT_PAIR,
          edits: [
            { via: 'vue', index: 0, value: 'first value' },
            { via: 'vue', index: 1, value: 'second value' }
          ],
          reorder: { kind: 'byName', order: ['second', 'first'] },
          expectedWidgetsValues: ['second value', 'first value'],
          promptByIndex: { 0: 'first value', 1: 'second value' }
        },
        {
          name: 'mixed text/text/seed via ViewKey, swap seed up by name',
          sources: TEXT_TEXT_SEED,
          edits: [
            { via: 'viewKey', index: 0, value: 'positive prompt' },
            { via: 'viewKey', index: 1, value: 'negative prompt' },
            { via: 'viewKey', index: 2, value: 123456 }
          ],
          reorder: { kind: 'byName', order: ['text_1', 'seed', 'text'] },
          expectedWidgetsValues: ['positive prompt', 123456, 'negative prompt'],
          promptByIndex: {
            0: 'positive prompt',
            1: 'negative prompt',
            2: 123456
          }
        },
        {
          name: 'mixed text/text/seed via Vue, swap seed up by name',
          sources: TEXT_TEXT_SEED,
          edits: [
            { via: 'vue', index: 0, value: 'positive prompt' },
            { via: 'vue', index: 1, value: 'negative prompt' },
            { via: 'vue', index: 2, value: 123456 }
          ],
          reorder: { kind: 'byName', order: ['text_1', 'seed', 'text'] },
          expectedWidgetsValues: ['positive prompt', 123456, 'negative prompt'],
          promptByIndex: {
            0: 'positive prompt',
            1: 'negative prompt',
            2: 123456
          }
        }
      ]

      it.for(reorderCases)('$name', async (c) => {
        const subgraph = createTestSubgraph()
        const sources = buildSources(subgraph, c.sources)
        const host = createTestSubgraphNode(subgraph)
        if (c.promptByIndex) {
          host.comfyClass = 'Subgraph'
          host.graph?.add(host)
        }
        for (const edit of c.edits) applyEdit(host, edit)
        applyReorder(host, c.reorder)

        if (c.expectedNames) {
          expect(host.widgets.map((w) => w.name)).toEqual(c.expectedNames)
        }
        if (c.expectedWidgetsValues !== undefined) {
          expect(host.serialize().widgets_values).toEqual(
            c.expectedWidgetsValues
          )
        }
        if (c.promptByIndex) {
          const { output } = await graphToPrompt(host.rootGraph)
          for (const [iStr, value] of Object.entries(c.promptByIndex)) {
            const i = Number(iStr)
            expect(
              output[`${host.id}:${sources[i].node.id}`].inputs.value
            ).toBe(value)
          }
        }
      })

      type ControlCase = {
        name: string
        editVia: 'viewKey' | 'vue'
        controlMode: 'increment' | 'fixed'
        controlMarker: boolean
        seedHostValue: number
        mutateSourceSeedAfterReorder?: number
        callAfterQueued?: boolean
        expect: {
          promptSeed?: number
          sourceSeed?: number
          processedSeedValue?: number
          hostSeedValue?: number
          storeSeedValue?: number
        }
      }

      const controlCases: ControlCase[] = [
        {
          name: 'ViewKey + increment: source seed mutation after reorder is ignored in prompt',
          editVia: 'viewKey',
          controlMode: 'increment',
          controlMarker: false,
          seedHostValue: 123456,
          mutateSourceSeedAfterReorder: 789,
          expect: { promptSeed: 123456 }
        },
        {
          name: 'Vue + fixed: host-wins — does not push Vue value into source seed',
          editVia: 'vue',
          controlMode: 'fixed',
          controlMarker: false,
          seedHostValue: 123456,
          expect: { sourceSeed: 0 }
        },
        {
          name: 'Vue + increment + afterQueued: processed widgets reflect increment',
          editVia: 'vue',
          controlMode: 'increment',
          controlMarker: true,
          seedHostValue: 123456,
          callAfterQueued: true,
          expect: { processedSeedValue: 123457 }
        },
        {
          name: 'ViewKey + increment + afterQueued: host seed increments without source value',
          editVia: 'viewKey',
          controlMode: 'increment',
          controlMarker: true,
          seedHostValue: 2,
          mutateSourceSeedAfterReorder: 8,
          callAfterQueued: true,
          expect: { hostSeedValue: 3, storeSeedValue: 3 }
        }
      ]

      it.for(controlCases)('$name', async (c) => {
        const subgraph = createTestSubgraph()
        const sources = buildSources(
          subgraph,
          TEXT_TEXT_SEED.map((s) =>
            s.title === 'Sampler' ? { ...s, hugeMaxSeed: true } : s
          )
        )
        const seed = sources[2]
        const host = createTestSubgraphNode(subgraph)
        if (c.expect.promptSeed !== undefined) {
          host.comfyClass = 'Subgraph'
          host.graph?.add(host)
        }

        if (c.editVia === 'viewKey') {
          host.widgets[0].value = 'positive prompt'
          host.widgets[1].value = 'negative prompt'
          host.widgets[2].value = c.seedHostValue
          seed.widget.linkedWidgets = [
            makeControlWidget(c.controlMode, c.controlMarker) as never
          ]
        } else {
          seed.widget.linkedWidgets = [
            makeControlWidget(c.controlMode, c.controlMarker) as never
          ]
          vueEdit(host, 2, c.seedHostValue)
        }

        reorderSubgraphInputsByName(host, ['text_1', 'seed', 'text'])

        if (c.mutateSourceSeedAfterReorder !== undefined) {
          seed.widget.value = c.mutateSourceSeedAfterReorder
        }
        if (c.callAfterQueued) host.widgets[1].afterQueued?.()

        if (c.expect.promptSeed !== undefined) {
          const { output } = await graphToPrompt(host.rootGraph)
          expect(output[`${host.id}:${seed.node.id}`].inputs.value).toBe(
            c.expect.promptSeed
          )
        }
        if (c.expect.sourceSeed !== undefined) {
          expect(seed.widget.value).toBe(c.expect.sourceSeed)
        }
        if (c.expect.processedSeedValue !== undefined) {
          const updated = computeProcessedWidgets({
            nodeData: extractVueNodeData(host),
            graphId: host.rootGraph.id,
            showAdvanced: false,
            isGraphReady: false,
            rootGraph: null,
            ui: { getTooltipConfig: () => ({}), handleNodeRightClick: () => {} }
          })
          expect(updated[1].value).toBe(c.expect.processedSeedValue)
        }
        if (c.expect.hostSeedValue !== undefined) {
          expect(host.widgets[1].value).toBe(c.expect.hostSeedValue)
        }
        if (c.expect.storeSeedValue !== undefined) {
          expect(
            useWidgetValueStore()
              .getNodeWidgets(host.rootGraph.id, host.id)
              .find((entry) => entry.name === 'seed')?.value
          ).toBe(c.expect.storeSeedValue)
        }
      })

      it('afterQueued does not run value-control when the host input is externally linked', () => {
        const subgraph = createTestSubgraph()
        const sources = buildSources(
          subgraph,
          TEXT_TEXT_SEED.map((s) =>
            s.title === 'Sampler' ? { ...s, hugeMaxSeed: true } : s
          )
        )
        const seed = sources[2]
        const host = createTestSubgraphNode(subgraph)

        seed.widget.linkedWidgets = [
          makeControlWidget('increment', true) as never
        ]
        host.widgets[2].value = 2
        reorderSubgraphInputsByName(host, ['text_1', 'seed', 'text'])

        const seedSlot = host.getSlotFromWidget(host.widgets[1])
        expect(seedSlot).toBeDefined()
        seedSlot!.link = -1

        host.widgets[1].afterQueued?.()

        expect(host.widgets[1].value).toBe(2)
      })

      it('serializes promoted values from each host independently', () => {
        const subgraph = createTestSubgraph({
          inputs: [{ name: 'value', type: 'number' }]
        })

        const { node: interiorNode } = createNodeWithWidget('Interior')
        subgraph.add(interiorNode)
        subgraph.inputNode.slots[0].connect(
          interiorNode.inputs[0],
          interiorNode
        )

        const firstHost = createTestSubgraphNode(subgraph, { id: 101 })
        const secondHost = createTestSubgraphNode(subgraph, { id: 102 })
        subgraph.rootGraph.add(firstHost)
        subgraph.rootGraph.add(secondHost)

        firstHost.widgets[0].value = 111
        secondHost.widgets[0].value = 222

        expect(firstHost.serialize().widgets_values).toEqual([111])
        expect(secondHost.serialize().widgets_values).toEqual([222])
      })

      it('does not persist source widget store fallback values after reordering', () => {
        const subgraph = createTestSubgraph()
        const sources = buildSources(subgraph, TEXT_PAIR)
        const host = createTestSubgraphNode(subgraph)
        const widgetStore = useWidgetValueStore()
        for (const { node, widget } of sources) {
          widgetStore.registerWidget(host.rootGraph.id, {
            nodeId: node.id,
            name: widget.name,
            type: widget.type,
            value: `${node.title} value`,
            options: {}
          })
        }
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
        subgraph.inputNode.slots[0].connect(
          interiorNode.inputs[0],
          interiorNode
        )

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
        buildSources(subgraph, TEXT_PAIR)

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

        const [first, second] = reloaded.widgets
        expectPromotedWidgetView(first)
        expectPromotedWidgetView(second)
        expect(
          widgetStore.getWidget(reloaded.rootGraph.id, reloaded.id, first.name)
        ).toBeUndefined()
        expect(
          widgetStore.getWidget(reloaded.rootGraph.id, reloaded.id, second.name)
            ?.value
        ).toBe('second host value')
        expect(
          widgetStore.getNodeWidgets(reloaded.rootGraph.id, reloaded.id)
        ).toHaveLength(1)
        expect(reloaded.serialize().widgets_values).toEqual([
          undefined,
          'second host value'
        ])
      })
    })

    describe('proxyWidgets is no longer re-emitted', () => {
      it('does not write properties.proxyWidgets after serialize', () => {
        const subgraph = createTestSubgraph({
          inputs: [{ name: 'value', type: 'number' }]
        })

        const { node: interiorNode } = createNodeWithWidget('Interior')
        subgraph.add(interiorNode)
        subgraph.inputNode.slots[0].connect(
          interiorNode.inputs[0],
          interiorNode
        )

        const hostNode = createTestSubgraphNode(subgraph)
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

        expect(serialized.properties?.proxyWidgets).toStrictEqual(legacy)
      })
    })

    describe('previewExposures round-trip', () => {
      const CANVAS = '$$canvas-image-preview'
      const exposure12 = { sourceNodeId: '12', sourcePreviewName: CANVAS }
      const exposure14 = {
        sourceNodeId: '14',
        sourcePreviewName: 'videopreview'
      }
      const named12 = { name: CANVAS, ...exposure12 }
      const named14 = { name: 'videopreview', ...exposure14 }

      it('hydrates previewExposures into the store during configure', () => {
        const hostNode = createTestSubgraphNode(createTestSubgraph())
        hostNode.properties.previewExposures = [
          { name: 'preview', ...exposure12 }
        ]
        hostNode._internalConfigureAfterSlots()

        expect(
          usePreviewExposureStore().getExposures(
            hostNode.rootGraph.id,
            String(hostNode.id)
          )
        ).toEqual([{ name: 'preview', ...exposure12 }])
      })

      type SerializeCase = {
        name: string
        addExposures: (typeof exposure12)[]
        staleProperty?: {
          name: string
          sourceNodeId: string
          sourcePreviewName: string
        }[]
        expected: (typeof named12)[] | undefined
        expectLiveUnchanged?: boolean
      }

      const serializeCases: SerializeCase[] = [
        {
          name: 'writes previewExposures from the store on serialize',
          addExposures: [exposure12, exposure14],
          expected: [named12, named14]
        },
        {
          name: 'writes empty previewExposures when the store has no entries for the host',
          addExposures: [],
          staleProperty: [
            { name: 'stale', sourceNodeId: '0', sourcePreviewName: CANVAS }
          ],
          expected: [],
          expectLiveUnchanged: true
        }
      ]

      it.for(serializeCases)('$name', (c) => {
        const hostNode = createTestSubgraphNode(createTestSubgraph())
        if (c.staleProperty)
          hostNode.properties.previewExposures = c.staleProperty
        const store = usePreviewExposureStore()
        for (const e of c.addExposures) {
          store.addExposure(hostNode.rootGraph.id, String(hostNode.id), e)
        }

        const serialized = hostNode.serialize()
        expect(serialized.properties?.previewExposures).toEqual(c.expected)
        if (c.expectLiveUnchanged) {
          expect(hostNode.properties.previewExposures).toEqual(c.staleProperty)
        }
      })

      it('preserves an explicit empty previewExposures across reload, ignoring legacy locator entries', () => {
        const hostNode = createTestSubgraphNode(createTestSubgraph())
        const rootGraphId = hostNode.rootGraph.id
        const hostLocator = String(hostNode.id)
        const store = usePreviewExposureStore()

        const serialized = hostNode.serialize()
        expect(serialized.properties?.previewExposures).toEqual([])

        const legacyKey = createNodeLocatorId(rootGraphId, hostNode.id)
        store.setExposures(rootGraphId, legacyKey, [
          { name: 'legacy', ...exposure12 }
        ])
        store.setExposures(rootGraphId, hostLocator, [])

        hostNode.properties.previewExposures =
          serialized.properties?.previewExposures
        hostNode._internalConfigureAfterSlots()

        expect(store.getExposures(rootGraphId, hostLocator)).toEqual([])
      })

      it('serializes preview exposures per host instance', () => {
        const subgraph = createTestSubgraph()
        const firstHost = createTestSubgraphNode(subgraph, { id: 101 })
        const secondHost = createTestSubgraphNode(subgraph, { id: 102 })
        subgraph.rootGraph.add(firstHost)
        subgraph.rootGraph.add(secondHost)

        const store = usePreviewExposureStore()
        store.addExposure(
          firstHost.rootGraph.id,
          String(firstHost.id),
          exposure12
        )
        store.addExposure(
          firstHost.rootGraph.id,
          String(secondHost.id),
          exposure14
        )

        const firstExposures =
          firstHost.serialize().properties?.previewExposures
        const secondExposures =
          secondHost.serialize().properties?.previewExposures
        if (!Array.isArray(firstExposures) || !Array.isArray(secondExposures)) {
          throw new Error('Expected serialized previewExposures arrays')
        }

        expect(firstExposures).toEqual([named12])
        expect(secondExposures).toEqual([named14])
        for (const exposed of [firstExposures[0], secondExposures[0]]) {
          expect(exposed).not.toHaveProperty('hostInstanceId')
          expect(exposed).not.toHaveProperty('hostNodeLocator')
          expect(exposed).not.toHaveProperty('rootGraphId')
        }
      })
    })

    describe('proxyWidgetErrorQuarantine', () => {
      it('preserves quarantine entries through serialize and is inert at runtime', () => {
        const subgraph = createTestSubgraph()
        const hostNode = createTestSubgraphNode(subgraph)

        appendQuarantine(hostNode, [
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

        expect(
          serialized.properties?.proxyWidgetErrorQuarantine
        ).toBeUndefined()
        expect(hostNode.properties.proxyWidgetErrorQuarantine).toEqual([])
      })

      it('restores host values by input name when widgets_values is out of order', () => {
        const subgraph = createTestSubgraph({
          inputs: [
            { name: 'unet_name', type: 'COMBO' },
            { name: 'clip_name', type: 'COMBO' },
            { name: 'steps', type: 'INT' }
          ]
        })

        const unetNode = new LGraphNode('UNETLoader')
        const unetInput = unetNode.addInput('unet_name', 'COMBO')
        unetNode.addWidget(
          'combo',
          'unet_name',
          'z_image_turbo_bf16.safetensors',
          () => {},
          { values: ['z_image_turbo_bf16.safetensors'] }
        )
        unetInput.widget = { name: 'unet_name' }
        subgraph.add(unetNode)
        subgraph.inputNode.slots[0].connect(unetNode.inputs[0], unetNode)

        const clipNode = new LGraphNode('CLIPLoader')
        const clipInput = clipNode.addInput('clip_name', 'COMBO')
        clipNode.addWidget(
          'combo',
          'clip_name',
          'qwen_3_4b.safetensors',
          () => {},
          { values: ['qwen_3_4b.safetensors'] }
        )
        clipInput.widget = { name: 'clip_name' }
        subgraph.add(clipNode)
        subgraph.inputNode.slots[1].connect(clipNode.inputs[0], clipNode)

        const samplerNode = new LGraphNode('KSampler')
        const stepsInput = samplerNode.addInput('steps', 'INT')
        samplerNode.addWidget('number', 'steps', 8, () => {})
        stepsInput.widget = { name: 'steps' }
        subgraph.add(samplerNode)
        subgraph.inputNode.slots[2].connect(samplerNode.inputs[0], samplerNode)

        const hostNode = createTestSubgraphNode(subgraph)
        const serialized = hostNode.serialize()

        serialized.widgets_values = [
          8,
          'qwen_3_4b.safetensors',
          'z_image_turbo_bf16.safetensors'
        ]
        serialized.properties = {
          ...serialized.properties,
          proxyWidgetErrorQuarantine: [
            {
              originalEntry: ['-1', 'steps'] as SerializedProxyWidgetTuple,
              reason: 'missingSourceNode',
              hostValue: 8,
              attemptedAtVersion: 1
            },
            {
              originalEntry: ['-1', 'clip_name'] as SerializedProxyWidgetTuple,
              reason: 'missingSourceNode',
              hostValue: 'qwen_3_4b.safetensors',
              attemptedAtVersion: 1
            },
            {
              originalEntry: ['-1', 'unet_name'] as SerializedProxyWidgetTuple,
              reason: 'missingSourceNode',
              hostValue: 'z_image_turbo_bf16.safetensors',
              attemptedAtVersion: 1
            }
          ]
        }

        const reloaded = createTestSubgraphNode(subgraph)
        reloaded.configure(serialized)

        const byName = new Map(
          reloaded.inputs.map((input) => [input.name, input._widget?.value])
        )
        expect(byName.get('unet_name')).toBe('z_image_turbo_bf16.safetensors')
        expect(byName.get('clip_name')).toBe('qwen_3_4b.safetensors')
        expect(byName.get('steps')).toBe(8)
      })
    })
  })
})
