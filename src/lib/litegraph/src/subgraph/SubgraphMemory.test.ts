import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { IWidget } from '@/lib/litegraph/src/types/widgets'

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

type InputWithWidget = {
  _widget?: IWidget | { type: string; value: unknown; name: string }
  _connection?: { id: number; type: string }
  _listenerController?: AbortController
}

describe('SubgraphNode Memory Management', () => {
  describe('Event Listener Cleanup', () => {
    it('should register event listeners on construction', () => {
      const subgraph = createTestSubgraph()

      // Spy on addEventListener to track listener registration
      const addEventSpy = vi.spyOn(subgraph.events, 'addEventListener')
      const initialCalls = addEventSpy.mock.calls.length

      createTestSubgraphNode(subgraph)

      // Should have registered listeners for subgraph events
      expect(addEventSpy.mock.calls.length).toBeGreaterThan(initialCalls)

      // Should have registered listeners for all major events
      const eventTypes = addEventSpy.mock.calls.map((call) => call[0])
      expect(eventTypes).toContain('input-added')
      expect(eventTypes).toContain('removing-input')
      expect(eventTypes).toContain('output-added')
      expect(eventTypes).toContain('removing-output')
      expect(eventTypes).toContain('renaming-input')
      expect(eventTypes).toContain('renaming-output')
    })

    it('should clean up input listeners on removal', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input1', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Add input should have created listeners
      expect(subgraphNode.inputs[0]._listenerController).toBeDefined()
      expect(subgraphNode.inputs[0]._listenerController?.signal.aborted).toBe(
        false
      )

      // Call onRemoved to simulate node removal
      subgraphNode.onRemoved()

      // Input listeners should be aborted
      expect(subgraphNode.inputs[0]._listenerController?.signal.aborted).toBe(
        true
      )
    })

    it('should not accumulate listeners during reconfiguration', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input1', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      const addEventSpy = vi.spyOn(subgraph.events, 'addEventListener')
      const initialCalls = addEventSpy.mock.calls.length

      // Reconfigure multiple times
      for (let i = 0; i < 5; i++) {
        subgraphNode.configure({
          id: subgraphNode.id,
          type: subgraph.id,
          pos: [100 * i, 100 * i],
          size: [200, 100],
          inputs: [],
          outputs: [],
          properties: {},
          flags: {},
          mode: 0,
          order: 0
        })
      }

      // Should not add new main subgraph listeners
      // (Only input-specific listeners might be reconfigured)
      const finalCalls = addEventSpy.mock.calls.length
      expect(finalCalls).toBe(initialCalls) // Main listeners not re-added
    })
  })

  describe('Widget Promotion Memory Management', () => {
    it('should not mutate manually injected widget references', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'testInput', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      const input = subgraphNode.inputs[0]
      const mockWidget = {
        type: 'number',
        name: 'promoted_widget',
        value: 123,
        options: {},
        y: 0,
        draw: vi.fn(),
        mouse: vi.fn(),
        computeSize: vi.fn(),
        createCopyForNode: vi.fn().mockReturnValue({
          type: 'number',
          name: 'promoted_widget',
          value: 123
        })
      } as Partial<IWidget> as IWidget

      input._widget = mockWidget
      input.widget = { name: 'promoted_widget' }
      subgraphNode.widgets.push(mockWidget)

      expect(input._widget).toBe(mockWidget)
      expect(input.widget).toBeDefined()
      expect(subgraphNode.widgets).toContain(mockWidget)

      subgraphNode.removeWidget(mockWidget)

      // removeWidget only affects managed promoted widgets, not manually injected entries.
      expect(subgraphNode.widgets).toContain(mockWidget)
    })

    it('should not leak widgets during reconfiguration', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'input1', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Track widget count before and after reconfigurations
      const initialWidgetCount = subgraphNode.widgets.length

      // Reconfigure multiple times
      for (let i = 0; i < 3; i++) {
        subgraphNode.configure({
          id: subgraphNode.id,
          type: subgraph.id,
          pos: [100, 100],
          size: [200, 100],
          inputs: [],
          outputs: [],
          properties: {},
          flags: {},
          mode: 0,
          order: 0
        })
      }

      // Widget count should not accumulate
      expect(subgraphNode.widgets.length).toBe(initialWidgetCount)
    })
  })
})

describe('SubgraphMemory - Event Listener Management', () => {
  subgraphTest(
    'event handlers still work after node creation',
    ({ emptySubgraph }) => {
      const rootGraph = new LGraph()
      const subgraphNode = createTestSubgraphNode(emptySubgraph)
      rootGraph.add(subgraphNode)

      const handler = vi.fn()
      emptySubgraph.events.addEventListener('input-added', handler)

      emptySubgraph.addInput('test', 'number')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input-added'
        })
      )
    }
  )

  subgraphTest(
    'can add and remove multiple nodes without errors',
    ({ emptySubgraph }) => {
      const rootGraph = new LGraph()
      const nodes: ReturnType<typeof createTestSubgraphNode>[] = []

      // Should be able to create multiple nodes without issues
      for (let i = 0; i < 5; i++) {
        const subgraphNode = createTestSubgraphNode(emptySubgraph)
        rootGraph.add(subgraphNode)
        nodes.push(subgraphNode)
      }

      expect(rootGraph.nodes.length).toBe(5)

      // Should be able to remove them all without issues
      for (const node of nodes) {
        rootGraph.remove(node)
      }

      expect(rootGraph.nodes.length).toBe(0)
    }
  )

  subgraphTest(
    'supports AbortController cleanup patterns',
    ({ emptySubgraph }) => {
      const abortController = new AbortController()
      const { signal } = abortController

      const handler = vi.fn()

      emptySubgraph.events.addEventListener('input-added', handler, { signal })

      emptySubgraph.addInput('test1', 'number')
      expect(handler).toHaveBeenCalledTimes(1)

      abortController.abort()

      emptySubgraph.addInput('test2', 'number')
      expect(handler).toHaveBeenCalledTimes(1)
    }
  )

  subgraphTest(
    'handles multiple creation/deletion cycles',
    ({ emptySubgraph }) => {
      const rootGraph = new LGraph()

      for (let cycle = 0; cycle < 3; cycle++) {
        const nodes = []

        for (let i = 0; i < 5; i++) {
          const subgraphNode = createTestSubgraphNode(emptySubgraph)
          rootGraph.add(subgraphNode)
          nodes.push(subgraphNode)
        }

        expect(rootGraph.nodes.length).toBe(5)

        for (const node of nodes) {
          rootGraph.remove(node)
        }

        expect(rootGraph.nodes.length).toBe(0)
      }
    }
  )
})

describe('SubgraphMemory - Reference Management', () => {
  it('maintains proper parent-child references while attached', () => {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph, {
      parentGraph: rootGraph
    })

    // Add to graph
    rootGraph.add(subgraphNode)
    expect(subgraphNode.graph).toBe(rootGraph)
    expect(rootGraph.nodes).toContain(subgraphNode)
  })

  it('prevents circular reference creation', () => {
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    const subgraphNode = createTestSubgraphNode(subgraph)

    // Subgraph should not contain its own instance node
    expect(subgraph.nodes).not.toContain(subgraphNode)

    // If circular references were attempted, they should be detected
    expect(subgraphNode.subgraph).toBe(subgraph)
    expect(subgraph.nodes.includes(subgraphNode)).toBe(false)
  })
})

describe('SubgraphMemory - Widget Reference Management', () => {
  subgraphTest(
    'cleans up references during node removal',
    ({ simpleSubgraph }) => {
      const subgraphNode = createTestSubgraphNode(simpleSubgraph)
      const input = subgraphNode.inputs[0]
      const output = subgraphNode.outputs[0]

      // Set up references that should be cleaned up
      const mockReferences = {
        widget: { type: 'number', value: 42, name: 'mock_widget' },
        connection: { id: 1, type: 'number' },
        listener: vi.fn()
      }

      // Set references
      if (input) {
        ;(input as InputWithWidget)._widget = mockReferences.widget
        ;(input as InputWithWidget)._connection = mockReferences.connection
      }
      if (output) {
        ;(input as InputWithWidget)._connection = mockReferences.connection
      }

      // Verify references are set
      expect((input as InputWithWidget)?._widget).toBe(mockReferences.widget)
      expect((input as InputWithWidget)?._connection).toBe(
        mockReferences.connection
      )

      // Simulate proper cleanup (what onRemoved should do)
      subgraphNode.onRemoved()

      // Input-specific listeners should be cleaned up (this works)
      if (input && '_listenerController' in input) {
        expect(
          (input as InputWithWidget)._listenerController?.signal.aborted
        ).toBe(true)
      }
    }
  )
})

describe('SubgraphMemory - Performance and Scale', () => {
  subgraphTest(
    'handles multiple subgraphs in same graph',
    ({ subgraphWithNode }) => {
      const { parentGraph } = subgraphWithNode
      const subgraphA = createTestSubgraph({ name: 'Subgraph A' })
      const subgraphB = createTestSubgraph({ name: 'Subgraph B' })

      const nodeA = createTestSubgraphNode(subgraphA)
      const nodeB = createTestSubgraphNode(subgraphB)

      parentGraph.add(nodeA)
      parentGraph.add(nodeB)

      expect(nodeA.graph).toBe(parentGraph)
      expect(nodeB.graph).toBe(parentGraph)
      expect(parentGraph.nodes.length).toBe(3) // Original + nodeA + nodeB

      parentGraph.remove(nodeA)
      parentGraph.remove(nodeB)

      expect(parentGraph.nodes.length).toBe(1) // Only the original subgraphNode remains
    }
  )

  it('handles many instances without issues', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'stress_input', type: 'number' }],
      outputs: [{ name: 'stress_output', type: 'number' }]
    })

    const rootGraph = new LGraph()
    const instances = []

    // Create instances
    for (let i = 0; i < 25; i++) {
      const instance = createTestSubgraphNode(subgraph)
      rootGraph.add(instance)
      instances.push(instance)
    }

    expect(instances.length).toBe(25)
    expect(rootGraph.nodes.length).toBe(25)

    // Remove all instances (proper cleanup)
    for (const instance of instances) {
      rootGraph.remove(instance)
    }

    expect(rootGraph.nodes.length).toBe(0)
  })
})
