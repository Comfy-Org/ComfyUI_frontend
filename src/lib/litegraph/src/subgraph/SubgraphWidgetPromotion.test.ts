import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type {
  ISlotType,
  Subgraph,
  TWidgetType
} from '@/lib/litegraph/src/litegraph'
import { BaseWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'

import {
  createEventCapture,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

// Helper to create a node with a widget
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

// Helper to connect subgraph input to node and create SubgraphNode
function setupPromotedWidget(
  subgraph: Subgraph,
  node: LGraphNode,
  slotIndex = 0
) {
  subgraph.add(node)
  subgraph.inputNode.slots[slotIndex].connect(node.inputs[slotIndex], node)
  return createTestSubgraphNode(subgraph)
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

      expect(hostNode.properties.proxyWidgets).toStrictEqual([
        [String(interiorNode.id), 'batch_size']
      ])
      expect(hostNode.widgets).toHaveLength(1)
      expect(hostNode.widgets[0].name).toBe('batch_size')
      expect(hostNode.widgets[0].value).toBe(1)
      expect(hostNode.widgets[0].options.step).toBe(10)
    })

    it('should prune proxyWidgets referencing nodes not in subgraph on configure', () => {
      // Reproduces the bug where packing nodes into a nested subgraph leaves
      // stale proxyWidgets on the outer subgraph node referencing grandchild
      // node IDs that no longer exist directly in the outer subgraph.
      // Uses 3 inputs with only 1 having a linked widget entry, matching the
      // real workflow structure where model/vae inputs don't resolve widgets.
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

      // Inject stale proxyWidgets referencing nodes that don't exist in
      // this subgraph (they were packed into a nested subgraph)
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

    it('should normalize legacy prefixed proxyWidgets on configure', () => {
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

      const promotedWidgets = hostNode.widgets
        .filter(isPromotedWidgetView)
        .filter((widget) => !widget.name.startsWith('$$'))

      expect(promotedWidgets).toHaveLength(1)
      expect(promotedWidgets[0].type).toBe('number')
      expect(promotedWidgets[0].value).toBe(123)
      expect(promotedWidgets[0].sourceWidgetName).toBe('noise_seed')
      expect(promotedWidgets[0].disambiguatingSourceNodeId).toBe(
        String(samplerNode.id)
      )
      expect(hostNode.properties.proxyWidgets).toStrictEqual([
        [String(nestedNode.id), 'noise_seed', String(samplerNode.id)]
      ])
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

      // serialize() syncs the promotion store into properties.proxyWidgets
      const serialized = hostNode.serialize()
      const originalProxyWidgets = serialized.properties!
        .proxyWidgets as string[][]

      expect(originalProxyWidgets.length).toBeGreaterThan(0)
      expect(
        originalProxyWidgets.some(([, widgetName]) => widgetName === 'text')
      ).toBe(true)

      // Simulate clone: create a second SubgraphNode configured from serialized data
      const cloneNode = createTestSubgraphNode(subgraph)
      cloneNode.configure(serialized)
      const cloneProxyWidgets = cloneNode.properties.proxyWidgets as string[][]

      expect(cloneProxyWidgets.length).toBeGreaterThan(0)
      expect(
        cloneProxyWidgets.some(([, widgetName]) => widgetName === 'text')
      ).toBe(true)

      // Clone's proxyWidgets should reference the same interior node
      const originalNodeIds = originalProxyWidgets.map(([nodeId]) => nodeId)
      const cloneNodeIds = cloneProxyWidgets.map(([nodeId]) => nodeId)
      expect(cloneNodeIds).toStrictEqual(originalNodeIds)
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
})
