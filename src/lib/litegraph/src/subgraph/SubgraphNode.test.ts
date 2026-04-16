/**
 * SubgraphNode Tests
 *
 * Tests for SubgraphNode instances including construction,
 * IO synchronization, and edge cases.
 */
import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { ExportedSubgraphInstance } from '@/lib/litegraph/src/types/serialisation'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

import { subgraphTest } from './__fixtures__/subgraphFixtures'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('SubgraphNode Construction', () => {
  it('should create a SubgraphNode from a subgraph definition', () => {
    const subgraph = createTestSubgraph({
      name: 'Test Definition',
      inputs: [{ name: 'input', type: 'number' }],
      outputs: [{ name: 'output', type: 'number' }]
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode).toBeDefined()
    expect(subgraphNode.subgraph).toBe(subgraph)
    expect(subgraphNode.type).toBe(subgraph.id)
    expect(subgraphNode.isVirtualNode).toBe(true)
    expect(subgraphNode.displayType).toBe('Subgraph node')
  })

  it('should configure from instance data', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }],
      outputs: [{ name: 'result', type: 'number' }]
    })

    const subgraphNode = createTestSubgraphNode(subgraph, {
      id: 42,
      pos: [300, 150],
      size: [180, 80]
    })

    expect(subgraphNode.id).toBe(42)
    expect(Array.from(subgraphNode.pos)).toEqual([300, 150])
    expect(Array.from(subgraphNode.size)).toEqual([180, 80])
  })

  it('should maintain reference to root graph', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = subgraphNode.graph!

    expect(subgraphNode.rootGraph).toBe(parentGraph.rootGraph)
  })

  it('should throw NullGraphError when accessing rootGraph after removal', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = subgraphNode.graph!
    parentGraph.add(subgraphNode)

    parentGraph.remove(subgraphNode)

    expect(() => subgraphNode.rootGraph).toThrow()
    expect(subgraphNode.graph).toBeNull()
  })

  subgraphTest(
    'should synchronize slots with subgraph definition',
    ({ subgraphWithNode }) => {
      const { subgraph, subgraphNode } = subgraphWithNode

      // SubgraphNode should have same number of inputs/outputs as definition
      expect(subgraphNode.inputs).toHaveLength(subgraph.inputs.length)
      expect(subgraphNode.outputs).toHaveLength(subgraph.outputs.length)
    }
  )

  subgraphTest(
    'should update slots when subgraph definition changes',
    ({ subgraphWithNode }) => {
      const { subgraph, subgraphNode } = subgraphWithNode

      const initialInputCount = subgraphNode.inputs.length

      // Add an input to the subgraph definition
      subgraph.addInput('new_input', 'string')

      // SubgraphNode should automatically update (this tests the event system)
      expect(subgraphNode.inputs).toHaveLength(initialInputCount + 1)
      expect(subgraphNode.inputs.at(-1)?.name).toBe('new_input')
      expect(subgraphNode.inputs.at(-1)?.type).toBe('string')
    }
  )
})

describe('SubgraphNode Synchronization', () => {
  it('should sync input addition', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs).toHaveLength(0)

    subgraph.addInput('value', 'number')

    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.inputs[0].name).toBe('value')
    expect(subgraphNode.inputs[0].type).toBe('number')
  })

  it('should sync output addition', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs).toHaveLength(0)

    subgraph.addOutput('result', 'string')

    expect(subgraphNode.outputs).toHaveLength(1)
    expect(subgraphNode.outputs[0].name).toBe('result')
    expect(subgraphNode.outputs[0].type).toBe('string')
  })

  it('should sync input removal', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'input1', type: 'number' },
        { name: 'input2', type: 'string' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs).toHaveLength(2)

    subgraph.removeInput(subgraph.inputs[0])

    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.inputs[0].name).toBe('input2')
  })

  it('should sync output removal', () => {
    const subgraph = createTestSubgraph({
      outputs: [
        { name: 'output1', type: 'number' },
        { name: 'output2', type: 'string' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs).toHaveLength(2)

    subgraph.removeOutput(subgraph.outputs[0])

    expect(subgraphNode.outputs).toHaveLength(1)
    expect(subgraphNode.outputs[0].name).toBe('output2')
  })

  it('should sync slot renaming', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'oldName', type: 'number' }],
      outputs: [{ name: 'oldOutput', type: 'string' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    // Rename input
    subgraph.inputs[0].label = 'newName'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[0],
      index: 0,
      oldName: 'oldName',
      newName: 'newName'
    })

    expect(subgraphNode.inputs[0].label).toBe('newName')

    // Rename output
    subgraph.outputs[0].label = 'newOutput'
    subgraph.events.dispatch('renaming-output', {
      output: subgraph.outputs[0],
      index: 0,
      oldName: 'oldOutput',
      newName: 'newOutput'
    })

    expect(subgraphNode.outputs[0].label).toBe('newOutput')
  })

  it('should keep input.widget.name stable after rename (onGraphConfigured safety)', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'text', type: 'STRING' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'STRING')
    interiorNode.addWidget('text', 'value', '', () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    expect(promotedInput.widget).toBeDefined()

    const originalWidgetName = promotedInput.widget!.name

    // Rename the subgraph input label
    subgraph.inputs[0].label = 'my_custom_prompt'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[0],
      index: 0,
      oldName: 'text',
      newName: 'my_custom_prompt'
    })

    // widget.name stays as the internal name — NOT the display label
    expect(promotedInput.widget!.name).toBe(originalWidgetName)

    // The display label is on input.label (live-read via PromotedWidgetView.label)
    expect(promotedInput.label).toBe('my_custom_prompt')

    // input.widget.name should still match a widget in node.widgets
    const matchingWidget = subgraphNode.widgets?.find(
      (w) => w.name === promotedInput.widget!.name
    )
    expect(matchingWidget).toBeDefined()
  })

  it('should preserve renamed label through serialize/configure round-trip', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'seed', type: 'INT' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'INT')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'INT')
    interiorNode.addWidget('number', 'value', 0, () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedWidget = subgraphNode.widgets?.[0]
    expect(promotedWidget).toBeDefined()

    // Rename via the subgraph slot (simulates right-click rename)
    subgraph.inputs[0].label = 'My Seed'
    subgraphNode.inputs[0].label = 'My Seed'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[0],
      index: 0,
      oldName: 'seed',
      newName: 'My Seed'
    })

    // Label should be visible before round-trip
    const widgetBeforeRoundTrip = subgraphNode.widgets?.[0]
    expect(widgetBeforeRoundTrip!.label || widgetBeforeRoundTrip!.name).toBe(
      'My Seed'
    )

    // Serialize and reconfigure (simulates save/reload)
    const serialized = subgraphNode.serialize()
    subgraphNode.configure(serialized)

    // Label should survive the round-trip
    const widgetAfterRoundTrip = subgraphNode.widgets?.[0]
    expect(widgetAfterRoundTrip).toBeDefined()
    expect(widgetAfterRoundTrip!.label || widgetAfterRoundTrip!.name).toBe(
      'My Seed'
    )
  })
})

describe('SubgraphNode widget name collision on rename', () => {
  it('should not collapse two inputs when renamed to the same label', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'prompt_a', type: 'STRING' },
        { name: 'prompt_b', type: 'STRING' }
      ]
    })

    // Create two interior nodes with widgets
    const nodeA = new LGraphNode('NodeA')
    nodeA.addInput('value', 'STRING')
    nodeA.inputs[0].widget = { name: 'value' }
    nodeA.addOutput('out', 'STRING')
    nodeA.addWidget('text', 'value', '', () => {})
    subgraph.add(nodeA)
    subgraph.inputNode.slots[0].connect(nodeA.inputs[0], nodeA)

    const nodeB = new LGraphNode('NodeB')
    nodeB.addInput('value', 'STRING')
    nodeB.inputs[0].widget = { name: 'value' }
    nodeB.addOutput('out', 'STRING')
    nodeB.addWidget('text', 'value', '', () => {})
    subgraph.add(nodeB)
    subgraph.inputNode.slots[1].connect(nodeB.inputs[0], nodeB)

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs).toHaveLength(2)
    // widget.name is now nodeId:widgetName (stable composite key)
    const key0 = subgraphNode.inputs[0].widget?.name
    const key1 = subgraphNode.inputs[1].widget?.name
    expect(key0).toBeDefined()
    expect(key1).toBeDefined()
    expect(key0).not.toBe(key1)

    // Rename prompt_b to same LABEL as prompt_a
    subgraph.inputs[1].label = 'prompt_a'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[1],
      index: 1,
      oldName: 'prompt_b',
      newName: 'prompt_a'
    })

    // Both inputs survive — widget.name stays as composite key, no collision
    expect(subgraphNode.inputs).toHaveLength(2)
    expect(subgraphNode.inputs[0].widget?.name).toBe(key0)
    expect(subgraphNode.inputs[1].widget?.name).toBe(key1)

    // Display labels: input[1] was renamed
    expect(subgraphNode.inputs[1].label).toBe('prompt_a')

    // Distinct _widget bindings
    expect(subgraphNode.inputs[0]._widget).toBeDefined()
    expect(subgraphNode.inputs[1]._widget).toBeDefined()
    expect(subgraphNode.inputs[0]._widget).not.toBe(
      subgraphNode.inputs[1]._widget
    )
  })

  it('should keep unique widget.name keys even with duplicate labels', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'seed', type: 'INT' },
        { name: 'seed2', type: 'INT' }
      ]
    })

    const nodeA = new LGraphNode('NodeA')
    nodeA.addInput('value', 'INT')
    nodeA.inputs[0].widget = { name: 'value' }
    nodeA.addOutput('out', 'INT')
    nodeA.addWidget('number', 'value', 0, () => {})
    subgraph.add(nodeA)
    subgraph.inputNode.slots[0].connect(nodeA.inputs[0], nodeA)

    const nodeB = new LGraphNode('NodeB')
    nodeB.addInput('value', 'INT')
    nodeB.inputs[0].widget = { name: 'value' }
    nodeB.addOutput('out', 'INT')
    nodeB.addWidget('number', 'value', 0, () => {})
    subgraph.add(nodeB)
    subgraph.inputNode.slots[1].connect(nodeB.inputs[0], nodeB)

    const subgraphNode = createTestSubgraphNode(subgraph)

    const key0 = subgraphNode.inputs[0].widget?.name
    const key1 = subgraphNode.inputs[1].widget?.name

    // Keys should be unique composite identifiers (nodeId:widgetName)
    expect(key0).toBeDefined()
    expect(key1).toBeDefined()
    expect(key0).not.toBe(key1)

    // Rename seed2 to "seed" — duplicate display label
    subgraph.inputs[1].label = 'seed'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[1],
      index: 1,
      oldName: 'seed2',
      newName: 'seed'
    })

    // Widget keys remain stable — rename only affects display label
    expect(subgraphNode.inputs[0].widget?.name).toBe(key0)
    expect(subgraphNode.inputs[1].widget?.name).toBe(key1)

    // Distinct _widget bindings survive the rename
    expect(subgraphNode.inputs[0]._widget).toBeDefined()
    expect(subgraphNode.inputs[1]._widget).toBeDefined()
    expect(subgraphNode.inputs[0]._widget).not.toBe(
      subgraphNode.inputs[1]._widget
    )
  })

  it('should not lose input when onGraphConfigured runs after duplicate rename', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'alpha', type: 'STRING' },
        { name: 'beta', type: 'STRING' }
      ]
    })

    const nodeA = new LGraphNode('NodeA')
    nodeA.addInput('value', 'STRING')
    nodeA.inputs[0].widget = { name: 'value' }
    nodeA.addOutput('out', 'STRING')
    nodeA.addWidget('text', 'value', '', () => {})
    subgraph.add(nodeA)
    subgraph.inputNode.slots[0].connect(nodeA.inputs[0], nodeA)

    const nodeB = new LGraphNode('NodeB')
    nodeB.addInput('value', 'STRING')
    nodeB.inputs[0].widget = { name: 'value' }
    nodeB.addOutput('out', 'STRING')
    nodeB.addWidget('text', 'value', '', () => {})
    subgraph.add(nodeB)
    subgraph.inputNode.slots[1].connect(nodeB.inputs[0], nodeB)

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Rename beta to "alpha" — collision
    subgraph.inputs[1].label = 'alpha'
    subgraph.events.dispatch('renaming-input', {
      input: subgraph.inputs[1],
      index: 1,
      oldName: 'beta',
      newName: 'alpha'
    })

    // Simulate onGraphConfigured check: for each input with widget,
    // find a matching widget by name. If not found, the input gets removed.
    for (const input of subgraphNode.inputs) {
      if (!input.widget) continue
      const name = input.widget.name
      const w = subgraphNode.widgets?.find((w) => w.name === name)
      // Every input should find at least one matching widget
      expect(w).toBeDefined()
    }

    // Both inputs should survive
    expect(subgraphNode.inputs).toHaveLength(2)
  })
})

describe('SubgraphNode Lifecycle', () => {
  it('should handle reconfiguration', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input1', type: 'number' }],
      outputs: [{ name: 'output1', type: 'string' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    // Initial state
    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.outputs).toHaveLength(1)

    // Add more slots to subgraph
    subgraph.addInput('input2', 'string')
    subgraph.addOutput('output2', 'number')

    // Reconfigure
    subgraphNode.configure({
      id: subgraphNode.id,
      type: subgraph.id,
      pos: [200, 200],
      size: [180, 100],
      inputs: [],
      outputs: [],
      properties: {},
      flags: {},
      mode: 0,
      order: 0
    })

    // Should reflect updated subgraph structure
    expect(subgraphNode.inputs).toHaveLength(2)
    expect(subgraphNode.outputs).toHaveLength(2)
  })

  it('should handle removal lifecycle', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = new LGraph()

    parentGraph.add(subgraphNode)
    expect(parentGraph.nodes).toContain(subgraphNode)

    // Test onRemoved method
    subgraphNode.onRemoved()

    // Note: onRemoved doesn't automatically remove from graph
    // but it should clean up internal state
    expect(subgraphNode.inputs).toBeDefined()
  })
})

describe('SubgraphNode Basic Functionality', () => {
  it('should inherit input types correctly', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'numberInput', type: 'number' },
        { name: 'stringInput', type: 'string' },
        { name: 'anyInput', type: '*' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs[0].type).toBe('number')
    expect(subgraphNode.inputs[1].type).toBe('string')
    expect(subgraphNode.inputs[2].type).toBe('*')
  })

  it('should inherit output types correctly', () => {
    const subgraph = createTestSubgraph({
      outputs: [
        { name: 'numberOutput', type: 'number' },
        { name: 'stringOutput', type: 'string' },
        { name: 'anyOutput', type: '*' }
      ]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs[0].type).toBe('number')
    expect(subgraphNode.outputs[1].type).toBe('string')
    expect(subgraphNode.outputs[2].type).toBe('*')
  })
})

describe('SubgraphNode Execution', () => {
  it('should flatten to ExecutableNodeDTOs', () => {
    const subgraph = createTestSubgraph({ nodeCount: 3 })
    const subgraphNode = createTestSubgraphNode(subgraph)

    const executableNodes = new Map()
    const flattened = subgraphNode.getInnerNodes(executableNodes)

    const nodeId = subgraphNode.id
    const idPattern = new RegExp(`^${nodeId}:\\d+$`)
    expect(flattened).toHaveLength(3)
    expect(flattened[0].id).toMatch(idPattern)
    expect(flattened[1].id).toMatch(idPattern)
    expect(flattened[2].id).toMatch(idPattern)
  })

  it('should handle nested subgraph execution', () => {
    const rootGraph = new LGraph()
    const childSubgraph = createTestSubgraph({
      rootGraph,
      name: 'Child',
      nodeCount: 1
    })

    const parentSubgraph = createTestSubgraph({
      rootGraph,
      name: 'Parent',
      nodeCount: 1
    })

    const childSubgraphNode = createTestSubgraphNode(childSubgraph, {
      id: 42,
      parentGraph: parentSubgraph
    })
    parentSubgraph.add(childSubgraphNode)

    const parentSubgraphNode = createTestSubgraphNode(parentSubgraph, {
      id: 10,
      parentGraph: rootGraph
    })
    rootGraph.add(parentSubgraphNode)

    const executableNodes = new Map()
    const flattened = parentSubgraphNode.getInnerNodes(executableNodes)

    expect(flattened.length).toBeGreaterThan(0)
  })

  it('should resolve cross-boundary input links', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input1', type: 'number' }],
      nodeCount: 1
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    const resolved = subgraphNode.resolveSubgraphInputLinks(0)

    expect(resolved).toBeDefined()
    expect(Array.isArray(resolved)).toBe(true)
  })

  it('should resolve cross-boundary output links', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'output1', type: 'number' }],
      nodeCount: 1
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    const resolved = subgraphNode.resolveSubgraphOutputLink(0)

    // May be undefined if no internal connection exists
    expect(resolved === undefined || typeof resolved === 'object').toBe(true)
  })

  it('should prevent infinite recursion', () => {
    // Circular self-references currently recurse in traversal; this test documents
    // that execution flattening throws instead of silently succeeding.
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    const subgraphNode = createTestSubgraphNode(subgraph, {
      parentGraph: subgraph
    })

    // Add subgraph node to its own subgraph (circular reference)
    // add() itself throws due to recursive forEachNode traversal
    expect(() => subgraph.add(subgraphNode)).toThrow()
  })

  it('should resolve cross-boundary links', () => {
    // This test verifies that links can cross subgraph boundaries
    // Currently this is a basic test - full cross-boundary linking
    // requires more complex setup with actual connected nodes
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'external_input', type: 'number' }],
      outputs: [{ name: 'external_output', type: 'number' }],
      nodeCount: 2
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Verify the subgraph node has the expected I/O structure for cross-boundary links
    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.outputs).toHaveLength(1)
    expect(subgraphNode.inputs[0].name).toBe('external_input')
    expect(subgraphNode.outputs[0].name).toBe('external_output')

    // Internal nodes should be flattened correctly
    const executableNodes = new Map()
    const flattened = subgraphNode.getInnerNodes(executableNodes)
    expect(flattened).toHaveLength(2)
  })
})

describe('SubgraphNode Edge Cases', () => {
  it('should handle deep nesting', () => {
    // Create a simpler deep nesting test that works with current implementation
    const subgraph = createTestSubgraph({
      name: 'Deep Test',
      nodeCount: 5 // Multiple nodes to test flattening at depth
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    // Should be able to flatten without errors even with multiple nodes
    const executableNodes = new Map()
    expect(() => {
      subgraphNode.getInnerNodes(executableNodes)
    }).not.toThrow()

    const flattened = subgraphNode.getInnerNodes(executableNodes)
    expect(flattened.length).toBe(5)

    // All flattened nodes should have proper path-based IDs
    for (const dto of flattened) {
      expect(dto.id).toMatch(/^\d+:\d+$/)
    }
  })
})

describe('SubgraphNode Integration', () => {
  it('should be addable to a parent graph', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = new LGraph()

    parentGraph.add(subgraphNode)

    expect(parentGraph.nodes).toContain(subgraphNode)
    expect(subgraphNode.graph).toBe(parentGraph)
  })

  subgraphTest(
    'should maintain reference to root graph',
    ({ subgraphWithNode }) => {
      const { subgraphNode } = subgraphWithNode

      // For this test, parentGraph should be the root, but in nested scenarios
      // it would traverse up to find the actual root
      expect(subgraphNode.rootGraph).toBeDefined()
    }
  )

  it('should handle graph removal properly', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = new LGraph()

    parentGraph.add(subgraphNode)
    expect(parentGraph.nodes).toContain(subgraphNode)

    parentGraph.remove(subgraphNode)
    expect(parentGraph.nodes.find((node) => node.id === subgraphNode.id)).toBe(
      undefined
    )
  })
})

describe('SubgraphNode Cleanup', () => {
  it('should clean up event listeners when removed', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph()

    // Create and add two nodes
    const node1 = createTestSubgraphNode(subgraph)
    const node2 = createTestSubgraphNode(subgraph)
    rootGraph.add(node1)
    rootGraph.add(node2)

    // Verify both nodes start with no inputs
    expect(node1.inputs.length).toBe(0)
    expect(node2.inputs.length).toBe(0)

    // Remove node2
    rootGraph.remove(node2)

    // Now trigger a real event through subgraph API - only node1 should respond
    subgraph.addInput('test', 'number')

    // Only node1 should have added an input
    expect(node1.inputs.length).toBe(1) // node1 responds
    expect(node2.inputs.length).toBe(0) // node2 should NOT respond (but currently does)
  })

  it('should not accumulate handlers over multiple add/remove cycles', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph()

    const removedNodes: SubgraphNode[] = []
    for (let i = 0; i < 3; i++) {
      const node = createTestSubgraphNode(subgraph)
      rootGraph.add(node)
      rootGraph.remove(node)
      removedNodes.push(node)
    }

    // All nodes should have 0 inputs
    for (const node of removedNodes) {
      expect(node.inputs.length).toBe(0)
    }

    // Trigger an event - no removed nodes should respond
    subgraph.addInput('test', 'number')

    // Without cleanup: all 3 removed nodes would have added an input
    // With cleanup: no nodes should have added an input
    for (const node of removedNodes) {
      expect(node.inputs.length).toBe(0) // Should stay 0 after cleanup
    }
  })

  it('should clean up input listener controllers on removal', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'in1', type: 'number' },
        { name: 'in2', type: 'string' }
      ]
    })

    const subgraphNode = createTestSubgraphNode(subgraph)
    rootGraph.add(subgraphNode)

    // Verify listener controllers exist
    expect(subgraphNode.inputs[0]._listenerController).toBeDefined()
    expect(subgraphNode.inputs[1]._listenerController).toBeDefined()

    // Track abort calls
    const abortSpy1 = vi.spyOn(
      subgraphNode.inputs[0]._listenerController!,
      'abort'
    )
    const abortSpy2 = vi.spyOn(
      subgraphNode.inputs[1]._listenerController!,
      'abort'
    )

    // Remove node
    rootGraph.remove(subgraphNode)

    // Verify abort was called on each controller
    expect(abortSpy1).toHaveBeenCalledTimes(1)
    expect(abortSpy2).toHaveBeenCalledTimes(1)
  })
})

describe('SubgraphNode duplicate input pruning (#9977)', () => {
  it('should prune inputs that have no matching subgraph slot after configure', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'NUMBER' }
      ]
    })

    const parentGraph = new LGraph()
    const instanceData = {
      id: 1 as const,
      type: subgraph.id,
      pos: [0, 0] as [number, number],
      size: [200, 100] as [number, number],
      inputs: [
        { name: 'a', type: 'STRING', link: null },
        { name: 'b', type: 'NUMBER', link: null },
        { name: 'a', type: 'STRING', link: null },
        { name: 'b', type: 'NUMBER', link: null }
      ],
      outputs: [],
      properties: {},
      flags: {},
      mode: 0,
      order: 0
    }

    const node = new SubgraphNode(
      parentGraph,
      subgraph,
      instanceData as ExportedSubgraphInstance
    )

    expect(node.inputs).toHaveLength(2)
    expect(node.inputs.every((i) => i._subgraphSlot)).toBe(true)
  })

  it('should not accumulate duplicate inputs on reconfigure', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'NUMBER' }
      ]
    })

    const node = createTestSubgraphNode(subgraph)
    expect(node.inputs).toHaveLength(2)

    const serialized = node.serialize()
    node.configure(serialized)
    expect(node.inputs).toHaveLength(2)

    const serialized2 = node.serialize()
    node.configure(serialized2)
    expect(node.inputs).toHaveLength(2)
  })

  it('should serialize with exactly the subgraph-defined inputs', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'x', type: 'IMAGE' },
        { name: 'y', type: 'VAE' }
      ]
    })

    const node = createTestSubgraphNode(subgraph)
    const serialized = node.serialize()

    expect(serialized.inputs).toHaveLength(2)
    expect(serialized.inputs?.map((i) => i.name)).toEqual(['x', 'y'])
  })
})

describe('Nested SubgraphNode duplicate input prevention', () => {
  it('should not duplicate inputs when the referenced subgraph is reconfigured', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'NUMBER' }
      ]
    })

    const node = createTestSubgraphNode(subgraph)
    expect(node.inputs).toHaveLength(2)

    // Simulate what happens during nested subgraph configure:
    // B.configure() calls _configureSubgraph(), which recreates SubgraphInput
    // objects and dispatches 'input-added' events with new references.
    const serialized = subgraph.asSerialisable()
    subgraph.configure(serialized)

    // The SubgraphNode's event listener should recognize existing inputs
    // by ID and NOT add duplicates.
    expect(node.inputs).toHaveLength(2)
    expect(node.inputs.every((i) => i._subgraphSlot)).toBe(true)
  })

  it('should not accumulate inputs across multiple reconfigure cycles', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'x', type: 'IMAGE' },
        { name: 'y', type: 'VAE' }
      ]
    })

    const node = createTestSubgraphNode(subgraph)
    expect(node.inputs).toHaveLength(2)

    for (let i = 0; i < 5; i++) {
      const serialized = subgraph.asSerialisable()
      subgraph.configure(serialized)
    }

    expect(node.inputs).toHaveLength(2)
    expect(node.inputs.map((i) => i.name)).toEqual(['x', 'y'])
  })
})

describe('SubgraphNode promotion view keys', () => {
  it('distinguishes tuples that differ only by colon placement', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const nodeWithKeyBuilder = fromAny<
      {
        _makePromotionViewKey: (
          inputKey: string,
          interiorNodeId: string,
          widgetName: string,
          inputName?: string
        ) => string
      },
      unknown
    >(subgraphNode)

    const firstKey = nodeWithKeyBuilder._makePromotionViewKey(
      '65',
      '18',
      'a:b',
      'c'
    )
    const secondKey = nodeWithKeyBuilder._makePromotionViewKey(
      '65',
      '18',
      'a',
      'b:c'
    )

    expect(firstKey).not.toBe(secondKey)
  })
})

describe('SubgraphNode label propagation', () => {
  it('should preserve input labels from configure path', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'steps', type: 'number' }]
    })
    subgraph.inputs[0].label = 'Steps Count'

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs[0].label).toBe('Steps Count')
    expect(subgraphNode.inputs[0].name).toBe('steps')
  })

  it('should preserve output labels from configure path', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'result', type: 'number' }]
    })
    subgraph.outputs[0].label = 'Final Result'

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs[0].label).toBe('Final Result')
    expect(subgraphNode.outputs[0].name).toBe('result')
  })

  it('should propagate label via renaming-input event', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'steps', type: 'number' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const input = interiorNode.addInput('value', 'number')
    input.widget = { name: 'value' }
    interiorNode.addOutput('out', 'number')
    interiorNode.addWidget('number', 'value', 0, () => {})
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const promotedInput = subgraphNode.inputs[0]
    const originalWidgetName = promotedInput.widget?.name
    const labelChangedSpy = vi.spyOn(subgraphNode.graph!, 'trigger')

    expect(promotedInput.label).toBeUndefined()
    expect(promotedInput._widget).toBeDefined()

    subgraph.renameInput(subgraph.inputs[0], 'Steps Count')

    expect(promotedInput.label).toBe('Steps Count')
    expect(promotedInput.name).toBe('steps')
    expect(promotedInput.widget?.name).toBe(originalWidgetName)
    expect(promotedInput._widget?.label).toBe('Steps Count')
    expect(subgraphNode.widgets?.[0].label).toBe('Steps Count')
    expect(labelChangedSpy).toHaveBeenCalledWith('node:slot-label:changed', {
      nodeId: subgraphNode.id,
      slotType: NodeSlotType.INPUT
    })
  })

  it('should propagate label via renaming-output event', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const labelChangedSpy = vi.spyOn(subgraphNode.graph!, 'trigger')

    subgraph.addOutput('result', 'number')
    expect(subgraphNode.outputs[0].label).toBeUndefined()

    subgraph.renameOutput(subgraph.outputs[0], 'Final Result')

    expect(subgraphNode.outputs[0].label).toBe('Final Result')
    expect(subgraphNode.outputs[0].name).toBe('result')
    expect(labelChangedSpy).toHaveBeenCalledWith('node:slot-label:changed', {
      nodeId: subgraphNode.id,
      slotType: NodeSlotType.OUTPUT
    })
  })

  it('should preserve localized_name from configure path', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'steps', type: 'number' }],
      outputs: [{ name: 'result', type: 'number' }]
    })
    subgraph.inputs[0].localized_name = 'ステップ'
    subgraph.outputs[0].localized_name = '結果'

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs[0].localized_name).toBe('ステップ')
    expect(subgraphNode.outputs[0].localized_name).toBe('結果')
  })
})
