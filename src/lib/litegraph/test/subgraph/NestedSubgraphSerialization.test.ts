import { describe, expect, it } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from './fixtures/subgraphHelpers'

/**
 * Tests for the nested subgraph serialization bug fix.
 * This addresses issue #4930: Nested subgraphs nodes input are not being persisted on save.
 *
 * The bug was that SubgraphNode instances didn't set serialize_widgets=true when they had
 * promoted widgets, causing widget values to not be saved in the serialized workflow.
 */
describe('NestedSubgraphSerialization', () => {
  // Helper to create a node with a widget that can be promoted
  function createNodeWithNumberWidget(title: string, widgetValue: number = 42) {
    const node = new LGraphNode(title)
    const input = node.addInput('value', 'number')
    node.addOutput('out', 'number')

    // @ts-expect-error Abstract class instantiation for testing
    const widget = new BaseWidget({
      name: 'widget',
      type: 'number',
      value: widgetValue,
      y: 0,
      options: { min: 0, max: 100, step: 1 },
      node
    })
    node.widgets = [widget]
    input.widget = { name: widget.name }

    return { node, widget, input }
  }

  it('should enable widget serialization when widgets are promoted to subgraph node', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithNumberWidget('Test Node')
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const subgraphNode = createTestSubgraphNode(subgraph)

    // The subgraph node should have serialize_widgets enabled
    expect(subgraphNode.serialize_widgets).toBe(true)
    expect(subgraphNode.widgets).toHaveLength(1)
  })

  it('should serialize widget values when subgraph node has promoted widgets', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'seed', type: 'number' }]
    })

    const { node } = createNodeWithNumberWidget('KSampler', 12345)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Change the widget value
    subgraphNode.widgets[0].value = 67890

    // Serialize the subgraph node
    const serialized = subgraphNode.serialize()

    // The serialized data should include the widget values
    expect(serialized.widgets_values).toBeDefined()
    expect(serialized.widgets_values).toEqual([67890])
  })

  it('should preserve widget values in nested subgraph scenario', () => {
    // Create a nested subgraph structure like in the bug report

    // Inner subgraph (subgraph 3) - contains the actual KSampler
    const innerSubgraph = createTestSubgraph({
      inputs: [{ name: 'seed', type: 'number' }],
      outputs: [{ name: 'latent', type: 'LATENT' }]
    })

    const { node: kSamplerNode } = createNodeWithNumberWidget(
      'KSampler',
      32115495257102
    )
    innerSubgraph.add(kSamplerNode)
    innerSubgraph.inputNode.slots[0].connect(
      kSamplerNode.inputs[0],
      kSamplerNode
    )
    innerSubgraph.outputNode.slots[0].connect(
      kSamplerNode.outputs[0],
      kSamplerNode
    )

    // Outer subgraph (subgraph 2) - contains the inner subgraph
    const outerSubgraph = createTestSubgraph({
      inputs: [{ name: 'seed', type: 'number' }],
      outputs: [{ name: 'latent', type: 'LATENT' }]
    })

    const innerSubgraphNode = createTestSubgraphNode(innerSubgraph)
    outerSubgraph.add(innerSubgraphNode)
    outerSubgraph.inputNode.slots[0].connect(
      innerSubgraphNode.inputs[0],
      innerSubgraphNode
    )
    outerSubgraph.outputNode.slots[0].connect(
      innerSubgraphNode.outputs[0],
      innerSubgraphNode
    )

    // Main graph - contains the outer subgraph
    const mainGraph = new LGraph()
    const outerSubgraphNode = createTestSubgraphNode(outerSubgraph)
    mainGraph.add(outerSubgraphNode)

    // The outer subgraph node should have promoted the widget from the inner subgraph
    expect(outerSubgraphNode.widgets).toHaveLength(1)
    expect(outerSubgraphNode.serialize_widgets).toBe(true)

    // Change the value in the outer subgraph node
    const newSeedValue = 99999
    outerSubgraphNode.widgets[0].value = newSeedValue

    // Serialize the outer subgraph node
    const serialized = outerSubgraphNode.serialize()

    // The widget value should be preserved in serialization
    expect(serialized.widgets_values).toBeDefined()
    expect(serialized.widgets_values).toEqual([newSeedValue])
  })

  it('should disable widget serialization when all widgets are removed', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithNumberWidget('Test Node')
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Initially should have widgets and serialization enabled
    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.serialize_widgets).toBe(true)

    // Remove the widget
    subgraphNode.removeWidgetByName('value')

    // Should disable serialization when no widgets remain
    expect(subgraphNode.widgets).toHaveLength(0)
    expect(subgraphNode.serialize_widgets).toBe(false)
  })

  it('should handle reconfiguration correctly with widget serialization', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })

    const { node } = createNodeWithNumberWidget('Test Node', 123)
    subgraph.add(node)
    subgraph.inputNode.slots[0].connect(node.inputs[0], node)

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Set a value and serialize
    subgraphNode.widgets[0].value = 456
    const serialized = subgraphNode.serialize()

    // Create a new subgraph node and configure it with the serialized data
    const newSubgraphNode = createTestSubgraphNode(subgraph)
    newSubgraphNode.configure(serialized)

    // The widget value should be restored from serialization
    expect(newSubgraphNode.widgets).toHaveLength(1)
    expect(newSubgraphNode.widgets[0].value).toBe(456)
    expect(newSubgraphNode.serialize_widgets).toBe(true)
  })
})
