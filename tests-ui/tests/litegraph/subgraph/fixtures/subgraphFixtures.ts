/**
 * Vitest Fixtures for Subgraph Testing
 *
 * This file provides reusable Vitest fixtures that other developers can use
 * in their test files. Each fixture provides a clean, pre-configured subgraph
 * setup for different testing scenarios.
 */
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

import { test } from '../../core/fixtures/testExtensions'
import {
  createEventCapture,
  createNestedSubgraphs,
  createTestSubgraph,
  createTestSubgraphNode
} from './subgraphHelpers'

interface SubgraphFixtures {
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
