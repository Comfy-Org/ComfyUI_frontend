/**
 * Vitest Fixtures for Subgraph Testing
 *
 * This file provides reusable Vitest fixtures that other developers can use
 * in their test files. Each fixture provides a clean, pre-configured subgraph
 * setup for different testing scenarios.
 */
import { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

import { test } from '../../core/fixtures/testExtensions'
import {
  createEventCapture,
  createNestedSubgraphs,
  createTestSubgraph,
  createTestSubgraphNode
} from './subgraphHelpers'

export interface SubgraphFixtures {
  /** A minimal subgraph with no inputs, outputs, or nodes */
  emptySubgraph: Subgraph

  /** A simple subgraph with 1 input and 1 output */
  simpleSubgraph: Subgraph

  /** A complex subgraph with multiple inputs, outputs, and internal nodes */
  complexSubgraph: Subgraph

  /** A nested subgraph structure (3 levels deep) */
  nestedSubgraph: ReturnType<typeof createNestedSubgraphs>

  /** A subgraph with its corresponding SubgraphNode instance */
  subgraphWithNode: {
    subgraph: Subgraph
    subgraphNode: SubgraphNode
    parentGraph: LGraph
  }

  /** Event capture system for testing subgraph events */
  eventCapture: {
    subgraph: Subgraph
    capture: ReturnType<typeof createEventCapture>
  }
}

/**
 * Extended test with subgraph fixtures.
 * Use this instead of the base `test` for subgraph testing.
 * @example
 * ```typescript
 * import { subgraphTest } from "./fixtures/subgraphFixtures"
 *
 * subgraphTest("should handle simple operations", ({ simpleSubgraph }) => {
 *   expect(simpleSubgraph.inputs.length).toBe(1)
 *   expect(simpleSubgraph.outputs.length).toBe(1)
 * })
 * ```
 */
export const subgraphTest = test.extend<SubgraphFixtures>({
  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  emptySubgraph: async ({}, use: (value: unknown) => Promise<void>) => {
    const subgraph = createTestSubgraph({
      name: 'Empty Test Subgraph',
      inputCount: 0,
      outputCount: 0,
      nodeCount: 0
    })

    await use(subgraph)
  },

  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  simpleSubgraph: async ({}, use: (value: unknown) => Promise<void>) => {
    const subgraph = createTestSubgraph({
      name: 'Simple Test Subgraph',
      inputs: [{ name: 'input', type: 'number' }],
      outputs: [{ name: 'output', type: 'number' }],
      nodeCount: 2
    })

    await use(subgraph)
  },

  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  complexSubgraph: async ({}, use: (value: unknown) => Promise<void>) => {
    const subgraph = createTestSubgraph({
      name: 'Complex Test Subgraph',
      inputs: [
        { name: 'data', type: 'number' },
        { name: 'control', type: 'boolean' },
        { name: 'text', type: 'string' }
      ],
      outputs: [
        { name: 'result', type: 'number' },
        { name: 'status', type: 'boolean' }
      ],
      nodeCount: 5
    })

    await use(subgraph)
  },

  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  nestedSubgraph: async ({}, use: (value: unknown) => Promise<void>) => {
    const nested = createNestedSubgraphs({
      depth: 3,
      nodesPerLevel: 2,
      inputsPerSubgraph: 1,
      outputsPerSubgraph: 1
    })

    await use(nested)
  },

  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  subgraphWithNode: async ({}, use: (value: unknown) => Promise<void>) => {
    // Create the subgraph definition
    const subgraph = createTestSubgraph({
      name: 'Subgraph With Node',
      inputs: [{ name: 'input', type: '*' }],
      outputs: [{ name: 'output', type: '*' }],
      nodeCount: 1
    })

    // Create the parent graph and subgraph node instance
    const parentGraph = new LGraph()
    const subgraphNode = createTestSubgraphNode(subgraph, {
      pos: [200, 200],
      size: [180, 80]
    })

    // Add the subgraph node to the parent graph
    parentGraph.add(subgraphNode)

    await use({
      subgraph,
      subgraphNode,
      parentGraph
    })
  },

  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  eventCapture: async ({}, use: (value: unknown) => Promise<void>) => {
    const subgraph = createTestSubgraph({
      name: 'Event Test Subgraph'
    })

    // Set up event capture for all subgraph events
    const capture = createEventCapture(subgraph.events, [
      'adding-input',
      'input-added',
      'removing-input',
      'renaming-input',
      'adding-output',
      'output-added',
      'removing-output',
      'renaming-output'
    ])

    await use({ subgraph, capture })

    // Cleanup event listeners
    capture.cleanup()
  }
})

/**
 * Fixtures that test edge cases and error conditions.
 * These may leave the system in an invalid state and should be used carefully.
 */
export interface EdgeCaseFixtures {
  /** Subgraph with circular references (for testing recursion detection) */
  circularSubgraph: {
    rootGraph: LGraph
    subgraphA: Subgraph
    subgraphB: Subgraph
    nodeA: SubgraphNode
    nodeB: SubgraphNode
  }

  /** Deeply nested subgraphs approaching the theoretical limit */
  deeplyNestedSubgraph: ReturnType<typeof createNestedSubgraphs>

  /** Subgraph with maximum inputs and outputs */
  maxIOSubgraph: Subgraph
}

/**
 * Test with edge case fixtures. Use sparingly and with caution.
 * These tests may intentionally create invalid states.
 */
export const edgeCaseTest = subgraphTest.extend<EdgeCaseFixtures>({
  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  circularSubgraph: async ({}, use: (value: unknown) => Promise<void>) => {
    const rootGraph = new LGraph()

    // Create two subgraphs that will reference each other
    const subgraphA = createTestSubgraph({
      name: 'Subgraph A',
      inputs: [{ name: 'input', type: '*' }],
      outputs: [{ name: 'output', type: '*' }]
    })

    const subgraphB = createTestSubgraph({
      name: 'Subgraph B',
      inputs: [{ name: 'input', type: '*' }],
      outputs: [{ name: 'output', type: '*' }]
    })

    // Create instances (this doesn't create circular refs by itself)
    const nodeA = createTestSubgraphNode(subgraphA, { pos: [100, 100] })
    const nodeB = createTestSubgraphNode(subgraphB, { pos: [300, 100] })

    // Add nodes to root graph
    rootGraph.add(nodeA)
    rootGraph.add(nodeB)

    await use({
      rootGraph,
      subgraphA,
      subgraphB,
      nodeA,
      nodeB
    })
  },

  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  deeplyNestedSubgraph: async ({}, use: (value: unknown) => Promise<void>) => {
    // Create a very deep nesting structure (but not exceeding MAX_NESTED_SUBGRAPHS)
    const nested = createNestedSubgraphs({
      depth: 50, // Deep but reasonable
      nodesPerLevel: 1,
      inputsPerSubgraph: 1,
      outputsPerSubgraph: 1
    })

    await use(nested)
  },

  // @ts-expect-error TODO: Fix after merge - fixture use parameter type
  // eslint-disable-next-line no-empty-pattern
  maxIOSubgraph: async ({}, use: (value: unknown) => Promise<void>) => {
    // Create a subgraph with many inputs and outputs
    const inputs = Array.from({ length: 20 }, (_, i) => ({
      name: `input_${i}`,
      type: i % 2 === 0 ? 'number' : ('string' as const)
    }))

    const outputs = Array.from({ length: 20 }, (_, i) => ({
      name: `output_${i}`,
      type: i % 2 === 0 ? 'number' : ('string' as const)
    }))

    const subgraph = createTestSubgraph({
      name: 'Max IO Subgraph',
      inputs,
      outputs,
      nodeCount: 10
    })

    await use(subgraph)
  }
})

/**
 * Helper to verify fixture integrity.
 * Use this in tests to ensure fixtures are properly set up.
 */
export function verifyFixtureIntegrity<T extends Record<string, unknown>>(
  fixture: T,
  expectedProperties: (keyof T)[]
): void {
  for (const prop of expectedProperties) {
    if (!(prop in fixture)) {
      throw new Error(`Fixture missing required property: ${String(prop)}`)
    }
    if (fixture[prop] === undefined || fixture[prop] === null) {
      throw new Error(`Fixture property ${String(prop)} is null or undefined`)
    }
  }
}

/**
 * Creates a snapshot-friendly representation of a subgraph for testing.
 * Useful for serialization tests and regression detection.
 */
export function createSubgraphSnapshot(subgraph: Subgraph) {
  return {
    id: subgraph.id,
    name: subgraph.name,
    inputCount: subgraph.inputs.length,
    outputCount: subgraph.outputs.length,
    nodeCount: subgraph.nodes.length,
    linkCount: subgraph.links.size,
    inputs: subgraph.inputs.map((i) => ({ name: i.name, type: i.type })),
    outputs: subgraph.outputs.map((o) => ({ name: o.name, type: o.type })),
    hasInputNode: !!subgraph.inputNode,
    hasOutputNode: !!subgraph.outputNode
  }
}
