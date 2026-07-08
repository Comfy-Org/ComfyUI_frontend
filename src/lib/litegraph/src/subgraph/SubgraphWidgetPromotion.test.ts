import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ISlotType,
  LGraphCanvas,
  Subgraph,
  TWidgetType
} from '@/lib/litegraph/src/litegraph'
import { BaseWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NumberWidget } from '@/lib/litegraph/src/widgets/NumberWidget'
import {
  appendQuarantine,
  flushProxyWidgetMigration,
  makeQuarantineEntry
} from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import { reorderSubgraphInputsByName } from '@/core/graph/subgraph/promotionUtils'
import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'
import { IS_CONTROL_WIDGET } from '@/scripts/controlWidgetMarker'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'
import { widgetId } from '@/types/widgetId'
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

function promotedInputs(node: {
  inputs: Array<{ widgetId?: WidgetId; name: string }>
}) {
  return node.inputs.filter(
    (input): input is { widgetId: WidgetId; name: string } =>
      Boolean(input.widgetId)
  )
}

function promotedWidgetStates(node: {
  inputs: Array<{ widgetId?: WidgetId; name: string }>
}) {
  return promotedInputs(node).map((input) => {
    const state = useWidgetValueStore().getWidget(input.widgetId)
    if (!state) throw new Error(`Missing widget state ${input.widgetId}`)
    return state
  })
}

function promotedWidgetStateByName(
  node: { inputs: Array<{ widgetId?: WidgetId; name: string }> },
  name: string
) {
  const input = node.inputs.find((input) => input.name === name)
  if (!input?.widgetId) throw new Error(`Missing promoted input ${name}`)
  const state = useWidgetValueStore().getWidget(input.widgetId)
  if (!state) throw new Error(`Missing widget state ${input.widgetId}`)
  return state
}

function writePromotedWidgetValue(
  node: { inputs: Array<{ widgetId?: WidgetId; name: string }> },
  index: number,
  value: WidgetState['value']
) {
  const input = promotedInputs(node)[index]
  if (!input) throw new Error(`Missing promoted input ${index}`)
  useWidgetValueStore().setValue(input.widgetId, value)
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

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(promotedWidgetStateByName(subgraphNode, 'value')).toMatchObject({
        type: 'number',
        value: 42
      })
    })

    it('resolves nested promoted widgets before the inner host input is hydrated', () => {
      const innerSubgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })
      const { node: leaf } = createNodeWithWidget('Leaf')
      innerSubgraph.add(leaf)
      innerSubgraph.inputNode.slots[0].connect(leaf.inputs[0], leaf)
      const innerNode = createTestSubgraphNode(innerSubgraph)
      innerNode._internalConfigureAfterSlots()
      innerNode.inputs[0].widgetId = undefined

      const outerSubgraph = createTestSubgraph({
        inputs: [{ name: 'outer_value', type: 'number' }]
      })
      outerSubgraph.add(innerNode)
      outerSubgraph.inputNode.slots[0].connect(innerNode.inputs[0], innerNode)

      const outerNode = createTestSubgraphNode(outerSubgraph)
      outerNode._internalConfigureAfterSlots()

      expect(promotedWidgetStateByName(outerNode, 'outer_value')).toMatchObject(
        {
          type: 'number',
          value: 42
        }
      )
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

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(
        promotedWidgetStates(subgraphNode).map((state) => state.value)
      ).toEqual([100, 'test', true])
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

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(promotedWidgetStateByName(subgraphNode, 'input1').value).toBe(10)
      expect(promotedWidgetStateByName(subgraphNode, 'input2').value).toBe(
        'hello'
      )
    })

    it('should fire widget-demoted events when node is removed', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input', type: 'number' }]
      })

      const { node } = createNodeWithWidget('Test Node')
      const subgraphNode = setupPromotedWidget(subgraph, node)

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(promotedInputs(subgraphNode)).toHaveLength(1)

      const eventCapture = createEventCapture(subgraph.events, [
        'widget-demoted'
      ])

      // Remove the subgraph node
      subgraphNode.onRemoved()

      const demotedEvents = eventCapture.getEventsByType('widget-demoted')
      expect(demotedEvents).toHaveLength(0)
      expect(promotedInputs(subgraphNode)).toHaveLength(1)

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
      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
    })

    it('should handle disconnection of promoted widget', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input', type: 'number' }]
      })

      const { node } = createNodeWithWidget('Test Node')
      const subgraphNode = setupPromotedWidget(subgraph, node)
      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(promotedInputs(subgraphNode)).toHaveLength(1)

      subgraph.inputNode.slots[0].disconnect()

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(promotedInputs(subgraphNode)).toHaveLength(0)
    })

    it('writes canvas edits back to the host widget store', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const { node } = createNodeWithWidget('Test Node')
      const subgraphNode = setupPromotedWidget(subgraph, node)

      // Canvas interaction wraps the projected widget in a transient concrete
      // widget (toConcreteWidget), so the edit only reaches the store through
      // the widget callback, not the projected widget's value setter.
      const hostWidget = subgraphNode.widgets[0]
      const concrete = new NumberWidget(fromAny(hostWidget), subgraphNode)
      const canvas = fromAny<LGraphCanvas, unknown>({ graph_mouse: [0, 0] })
      concrete.setValue(99, { e: fromAny({}), node: subgraphNode, canvas })

      expect(promotedWidgetStateByName(subgraphNode, 'value').value).toBe(99)
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

      expect(hostNode.widgets).toHaveLength(promotedInputs(hostNode).length)
      expect(promotedWidgetStateByName(hostNode, 'batch_size')).toMatchObject({
        name: 'batch_size',
        value: 1,
        options: expect.objectContaining({ step: 10 })
      })
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

      expect(outerNode.widgets).toHaveLength(promotedInputs(outerNode).length)
      expect(promotedWidgetStateByName(outerNode, 'model').value).toBe(42)
      expect(outerNode.properties.proxyWidgets).toEqual([
        ['999', 'text'],
        ['998', 'text'],
        [keptSamplerNodeId, 'widget']
      ])
      expect(keptSamplerNodeId).toBe(String(samplerNode.id))
    })

    it('resolves legacy prefixed proxyWidgets via the immediate child promoted-widget identity', () => {
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

      expect(hostNode.widgets).toHaveLength(promotedInputs(hostNode).length)
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

      expect(cloneNode.widgets).toHaveLength(promotedInputs(cloneNode).length)
      expect(promotedWidgetStateByName(cloneNode, 'text').value).toBe('')
    })
  })

  describe('Tooltip Promotion', () => {
    it('should preserve widget tooltip when promoting', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const originalTooltip = 'This is a test tooltip'
      const eventCapture = createEventCapture(subgraph.events, [
        'widget-promoted'
      ])
      const { node } = createNodeWithWidget(
        'Test Node',
        'number',
        42,
        'number',
        originalTooltip
      )
      const subgraphNode = setupPromotedWidget(subgraph, node)

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(
        eventCapture.getEventsByType('widget-promoted')[0].detail.widget.tooltip
      ).toBe(originalTooltip)
      eventCapture.cleanup()
    })

    it('should handle widgets with no tooltip', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const eventCapture = createEventCapture(subgraph.events, [
        'widget-promoted'
      ])
      const { node } = createNodeWithWidget('Test Node', 'number', 42, 'number')
      const subgraphNode = setupPromotedWidget(subgraph, node)

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(
        eventCapture.getEventsByType('widget-promoted')[0].detail.widget.tooltip
      ).toBeUndefined()
      eventCapture.cleanup()
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

      const eventCapture = createEventCapture(subgraph.events, [
        'widget-promoted'
      ])
      const subgraphNode = createTestSubgraphNode(subgraph)

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(
        eventCapture
          .getEventsByType('widget-promoted')
          .map((event) => event.detail.widget.tooltip)
      ).toEqual(['Number widget tooltip', 'String widget tooltip'])
      eventCapture.cleanup()
    })

    it('should preserve original tooltip after promotion', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })

      const originalTooltip = 'Original tooltip'
      const eventCapture = createEventCapture(subgraph.events, [
        'widget-promoted'
      ])
      const { node } = createNodeWithWidget(
        'Test Node',
        'number',
        42,
        'number',
        originalTooltip
      )
      const subgraphNode = setupPromotedWidget(subgraph, node)
      const state = promotedWidgetStateByName(subgraphNode, 'value')

      expect(subgraphNode.widgets).toHaveLength(
        promotedInputs(subgraphNode).length
      )
      expect(
        eventCapture.getEventsByType('widget-promoted')[0].detail.widget.tooltip
      ).toBe(originalTooltip)
      expect(state).toMatchObject({ name: 'value', type: 'number', value: 42 })
      eventCapture.cleanup()
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
      writePromotedWidgetValue(hostNode, 0, 99)
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

      function applyEdit(
        host: ReturnType<typeof createTestSubgraphNode>,
        edit: EditSpec
      ) {
        writePromotedWidgetValue(host, edit.index, edit.value)
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
          expect(promotedInputs(host).map((input) => input.name)).toEqual(
            c.expectedNames
          )
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
        expect: {
          promptSeed?: number
          sourceSeed?: number
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

        writePromotedWidgetValue(host, 0, 'positive prompt')
        writePromotedWidgetValue(host, 1, 'negative prompt')
        writePromotedWidgetValue(host, 2, c.seedHostValue)
        seed.widget.linkedWidgets = [
          makeControlWidget(c.controlMode, c.controlMarker) as never
        ]

        reorderSubgraphInputsByName(host, ['text_1', 'seed', 'text'])

        if (c.mutateSourceSeedAfterReorder !== undefined) {
          seed.widget.value = c.mutateSourceSeedAfterReorder
        }

        if (c.expect.promptSeed !== undefined) {
          const { output } = await graphToPrompt(host.rootGraph)
          expect(output[`${host.id}:${seed.node.id}`].inputs.value).toBe(
            c.expect.promptSeed
          )
        }
        if (c.expect.sourceSeed !== undefined) {
          expect(seed.widget.value).toBe(c.expect.sourceSeed)
        }
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

        writePromotedWidgetValue(firstHost, 0, 111)
        writePromotedWidgetValue(secondHost, 0, 222)

        expect(firstHost.serialize().widgets_values).toEqual([111])
        expect(secondHost.serialize().widgets_values).toEqual([222])
      })

      it('does not persist source widget store fallback values after reordering', () => {
        const subgraph = createTestSubgraph()
        const sources = buildSources(subgraph, TEXT_PAIR)
        const host = createTestSubgraphNode(subgraph)
        const widgetStore = useWidgetValueStore()
        for (const { node, widget } of sources) {
          widgetStore.registerWidget(
            widgetId(host.rootGraph.id, node.id, widget.name),
            {
              type: widget.type,
              value: `${node.title} value`,
              options: {}
            }
          )
        }
        reorderSubgraphInputsByName(host, ['second', 'first'])
        expect(host.serialize().widgets_values).toEqual(['', ''])
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
        widgetStore.registerWidget(
          widgetId(host.rootGraph.id, interiorNode.id, interiorWidget.name),
          {
            type: interiorWidget.type,
            value: 'source fallback',
            options: {}
          }
        )
        const serialized = host.serialize()
        expect(serialized.widgets_values).toEqual([''])

        widgetStore.clearGraph(host.rootGraph.id)
        const reloaded = createTestSubgraphNode(subgraph, { id: 101 })
        reloaded.configure(serialized)

        expect(
          widgetStore.getNodeWidgets(reloaded.rootGraph.id, reloaded.id)
        ).toHaveLength(1)
        expect(reloaded.serialize().widgets_values).toEqual([''])
      })

      it('does not hydrate missing widgets_values entries as explicit host overlays', () => {
        const subgraph = createTestSubgraph()
        buildSources(subgraph, TEXT_PAIR)

        const host = createTestSubgraphNode(subgraph, { id: 101 })
        writePromotedWidgetValue(host, 1, 'second host value')
        const serialized = host.serialize()
        expect(serialized.widgets_values).toEqual(['', 'second host value'])

        const widgetStore = useWidgetValueStore()
        widgetStore.clearGraph(host.rootGraph.id)
        const reloaded = createTestSubgraphNode(subgraph, { id: 101 })
        reloaded.configure(serialized)

        expect(reloaded.widgets).toHaveLength(promotedInputs(reloaded).length)
        expect(
          widgetStore.getWidget(
            widgetId(reloaded.rootGraph.id, reloaded.id, 'first')
          )?.value
        ).toBe('')
        expect(
          widgetStore.getWidget(
            widgetId(reloaded.rootGraph.id, reloaded.id, 'second')
          )?.value
        ).toBe('second host value')
        expect(
          widgetStore.getNodeWidgets(reloaded.rootGraph.id, reloaded.id)
        ).toHaveLength(2)
        expect(reloaded.serialize().widgets_values).toEqual([
          '',
          'second host value'
        ])
      })

      it('preserves null promoted values through serialize and reload', () => {
        const subgraph = createTestSubgraph()
        buildSources(subgraph, TEXT_PAIR)

        const host = createTestSubgraphNode(subgraph, { id: 101 })
        writePromotedWidgetValue(host, 0, null)
        writePromotedWidgetValue(host, 1, null)

        const serialized = host.serialize()
        expect(serialized.widgets_values).toEqual([null, null])

        const widgetStore = useWidgetValueStore()
        widgetStore.clearGraph(host.rootGraph.id)
        const reloaded = createTestSubgraphNode(subgraph, { id: 101 })
        reloaded.configure(serialized)

        expect(
          promotedWidgetStates(reloaded).map((state) => state.value)
        ).toEqual([null, null])
      })

      it('reads a null store value back through the projected widget', () => {
        const subgraph = createTestSubgraph()
        buildSources(subgraph, TEXT_PAIR)
        const host = createTestSubgraphNode(subgraph)

        writePromotedWidgetValue(host, 0, null)

        expect(host.widgets[0]?.value).toBeNull()
      })

      it('preserves a null promoted value across reorder', () => {
        const subgraph = createTestSubgraph()
        buildSources(subgraph, TEXT_PAIR)
        const host = createTestSubgraphNode(subgraph)
        writePromotedWidgetValue(host, 0, null)
        writePromotedWidgetValue(host, 1, 'second value')

        reorderSubgraphInputsByName(host, ['second', 'first'])

        expect(host.serialize().widgets_values).toEqual(['second value', null])
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
      const exposure12 = {
        sourceNodeId: toNodeId('12'),
        sourcePreviewName: CANVAS
      }
      const exposure14 = {
        sourceNodeId: toNodeId('14'),
        sourcePreviewName: 'videopreview'
      }
      const serializedExposure12 = {
        sourceNodeId: '12',
        sourcePreviewName: CANVAS
      }
      const serializedExposure14 = {
        sourceNodeId: '14',
        sourcePreviewName: 'videopreview'
      }
      const named12 = { name: CANVAS, ...serializedExposure12 }
      const named14 = { name: 'videopreview', ...serializedExposure14 }

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
          reloaded.inputs.map((input) => [
            input.name,
            input.widgetId
              ? useWidgetValueStore().getWidget(input.widgetId)?.value
              : undefined
          ])
        )
        expect(byName.get('unet_name')).toBe('z_image_turbo_bf16.safetensors')
        expect(byName.get('clip_name')).toBe('qwen_3_4b.safetensors')
        expect(byName.get('steps')).toBe(8)
      })

      it('applies a null quarantined host value instead of falling through to widgets_values', () => {
        const subgraph = createTestSubgraph({
          inputs: [{ name: 'value', type: 'STRING' }]
        })
        const { node: interiorNode } = createNodeWithWidget(
          'Interior',
          'text',
          'interior default',
          'STRING'
        )
        subgraph.add(interiorNode)
        subgraph.inputNode.slots[0].connect(
          interiorNode.inputs[0],
          interiorNode
        )

        const hostNode = createTestSubgraphNode(subgraph)
        const serialized = hostNode.serialize()
        serialized.widgets_values = ['stale value']
        serialized.properties = {
          ...serialized.properties,
          proxyWidgetErrorQuarantine: [
            {
              originalEntry: ['-1', 'value'] as SerializedProxyWidgetTuple,
              reason: 'missingSourceNode',
              hostValue: null,
              attemptedAtVersion: 1
            }
          ]
        }

        const reloaded = createTestSubgraphNode(subgraph)
        reloaded.configure(serialized)

        expect(promotedWidgetStateByName(reloaded, 'value').value).toBeNull()
      })
    })
  })
})
