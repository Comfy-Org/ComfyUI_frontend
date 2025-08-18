/**
 * Test Helper Functions for Subgraph Testing
 *
 * This file contains the core utilities that all subgraph developers will use.
 * These functions provide consistent ways to create test subgraphs, nodes, and
 * verify their behavior.
 */
import { expect } from 'vitest'

import type { ISlotType, NodeId } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, Subgraph } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type {
  ExportedSubgraph,
  ExportedSubgraphInstance
} from '@/lib/litegraph/src/types/serialisation'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { createUuidv4 } from '@/lib/litegraph/src/utils/uuid'

export interface TestSubgraphOptions {
  id?: UUID
  name?: string
  nodeCount?: number
  inputCount?: number
  outputCount?: number
  inputs?: Array<{ name: string; type: ISlotType }>
  outputs?: Array<{ name: string; type: ISlotType }>
}

export interface TestSubgraphNodeOptions {
  id?: NodeId
  pos?: [number, number]
  size?: [number, number]
}

export interface NestedSubgraphOptions {
  depth?: number
  nodesPerLevel?: number
  inputsPerSubgraph?: number
  outputsPerSubgraph?: number
}

export interface SubgraphStructureExpectation {
  inputCount?: number
  outputCount?: number
  nodeCount?: number
  name?: string
  hasInputNode?: boolean
  hasOutputNode?: boolean
}

export interface CapturedEvent<T = unknown> {
  type: string
  detail: T
  timestamp: number
}

/**
 * Creates a test subgraph with specified inputs, outputs, and nodes.
 * This is the primary function for creating subgraphs in tests.
 * @param options Configuration options for the subgraph
 * @returns A configured Subgraph instance
 * @example
 * ```typescript
 * // Create empty subgraph
 * const subgraph = createTestSubgraph()
 *
 * // Create subgraph with specific I/O
 * const subgraph = createTestSubgraph({
 *   inputs: [{ name: "value", type: "number" }],
 *   outputs: [{ name: "result", type: "string" }],
 *   nodeCount: 3
 * })
 * ```
 */
export function createTestSubgraph(
  options: TestSubgraphOptions = {}
): Subgraph {
  // Validate options - cannot specify both inputs array and inputCount
  if (options.inputs && options.inputCount) {
    throw new Error(
      `Cannot specify both 'inputs' array and 'inputCount'. Choose one approach. Received options: ${JSON.stringify(options)}`
    )
  }

  // Validate options - cannot specify both outputs array and outputCount
  if (options.outputs && options.outputCount) {
    throw new Error(
      `Cannot specify both 'outputs' array and 'outputCount'. Choose one approach. Received options: ${JSON.stringify(options)}`
    )
  }
  const rootGraph = new LGraph()

  // Create the base subgraph data
  const subgraphData: ExportedSubgraph = {
    // Basic graph properties
    version: 1,
    nodes: [],
    // @ts-expect-error TODO: Fix after merge - links type mismatch
    links: {},
    groups: [],
    config: {},
    definitions: { subgraphs: [] },

    // Subgraph-specific properties
    id: options.id || createUuidv4(),
    name: options.name || 'Test Subgraph',

    // IO Nodes (required for subgraph functionality)
    inputNode: {
      id: -10, // SUBGRAPH_INPUT_ID
      bounding: [10, 100, 150, 126], // [x, y, width, height]
      pinned: false
    },
    outputNode: {
      id: -20, // SUBGRAPH_OUTPUT_ID
      bounding: [400, 100, 140, 126], // [x, y, width, height]
      pinned: false
    },

    // IO definitions - will be populated by addInput/addOutput calls
    inputs: [],
    outputs: [],
    widgets: []
  }

  // Create the subgraph
  const subgraph = new Subgraph(rootGraph, subgraphData)

  // Add requested inputs
  if (options.inputs) {
    for (const input of options.inputs) {
      // @ts-expect-error TODO: Fix after merge - addInput parameter types
      subgraph.addInput(input.name, input.type)
    }
  } else if (options.inputCount) {
    for (let i = 0; i < options.inputCount; i++) {
      subgraph.addInput(`input_${i}`, '*')
    }
  }

  // Add requested outputs
  if (options.outputs) {
    for (const output of options.outputs) {
      // @ts-expect-error TODO: Fix after merge - addOutput parameter types
      subgraph.addOutput(output.name, output.type)
    }
  } else if (options.outputCount) {
    for (let i = 0; i < options.outputCount; i++) {
      subgraph.addOutput(`output_${i}`, '*')
    }
  }

  // Add test nodes if requested
  if (options.nodeCount) {
    for (let i = 0; i < options.nodeCount; i++) {
      const node = new LGraphNode(`Test Node ${i}`)
      node.addInput('in', '*')
      node.addOutput('out', '*')
      subgraph.add(node)
    }
  }

  return subgraph
}

/**
 * Creates a SubgraphNode instance from a subgraph definition.
 * The node is automatically added to a test parent graph.
 * @param subgraph The subgraph definition to create a node from
 * @param options Configuration options for the subgraph node
 * @returns A configured SubgraphNode instance
 * @example
 * ```typescript
 * const subgraph = createTestSubgraph({ inputs: [{ name: "value", type: "number" }] })
 * const subgraphNode = createTestSubgraphNode(subgraph, {
 *   id: 42,
 *   pos: [100, 200],
 *   size: [180, 100]
 * })
 * ```
 */
export function createTestSubgraphNode(
  subgraph: Subgraph,
  options: TestSubgraphNodeOptions = {}
): SubgraphNode {
  const parentGraph = new LGraph()

  const instanceData: ExportedSubgraphInstance = {
    id: options.id || 1,
    type: subgraph.id,
    pos: options.pos || [100, 100],
    size: options.size || [200, 100],
    inputs: [],
    outputs: [],
    // @ts-expect-error TODO: Fix after merge - properties type mismatch
    properties: {},
    flags: {},
    mode: 0
  }

  return new SubgraphNode(parentGraph, subgraph, instanceData)
}

/**
 * Creates a nested hierarchy of subgraphs for testing deep nesting scenarios.
 * @param options Configuration for the nested structure
 * @returns Object containing the root graph and all created subgraphs
 * @example
 * ```typescript
 * const nested = createNestedSubgraphs({ depth: 3, nodesPerLevel: 2 })
 * // Creates: Root -> Subgraph1 -> Subgraph2 -> Subgraph3
 * ```
 */
export function createNestedSubgraphs(options: NestedSubgraphOptions = {}) {
  const {
    depth = 2,
    nodesPerLevel = 2,
    inputsPerSubgraph = 1,
    outputsPerSubgraph = 1
  } = options

  const rootGraph = new LGraph()
  const subgraphs: Subgraph[] = []
  const subgraphNodes: SubgraphNode[] = []

  let currentParent = rootGraph

  for (let level = 0; level < depth; level++) {
    // Create subgraph for this level
    const subgraph = createTestSubgraph({
      name: `Level ${level} Subgraph`,
      nodeCount: nodesPerLevel,
      inputCount: inputsPerSubgraph,
      outputCount: outputsPerSubgraph
    })

    subgraphs.push(subgraph)

    // Create instance in parent
    const subgraphNode = createTestSubgraphNode(subgraph, {
      pos: [100 + level * 200, 100]
    })

    if (currentParent instanceof LGraph) {
      currentParent.add(subgraphNode)
    } else {
      // @ts-expect-error TODO: Fix after merge - add method parameter types
      currentParent.add(subgraphNode)
    }

    subgraphNodes.push(subgraphNode)

    // Next level will be nested inside this subgraph
    currentParent = subgraph
  }

  return {
    rootGraph,
    subgraphs,
    subgraphNodes,
    depth,
    leafSubgraph: subgraphs.at(-1)
  }
}

/**
 * Asserts that a subgraph has the expected structure.
 * This provides consistent validation across all tests.
 * @param subgraph The subgraph to validate
 * @param expected The expected structure
 * @example
 * ```typescript
 * assertSubgraphStructure(subgraph, {
 *   inputCount: 2,
 *   outputCount: 1,
 *   name: "Expected Name"
 * })
 * ```
 */
export function assertSubgraphStructure(
  subgraph: Subgraph,
  expected: SubgraphStructureExpectation
): void {
  if (expected.inputCount !== undefined) {
    expect(subgraph.inputs.length).toBe(expected.inputCount)
  }

  if (expected.outputCount !== undefined) {
    expect(subgraph.outputs.length).toBe(expected.outputCount)
  }

  if (expected.nodeCount !== undefined) {
    expect(subgraph.nodes.length).toBe(expected.nodeCount)
  }

  if (expected.name !== undefined) {
    expect(subgraph.name).toBe(expected.name)
  }

  if (expected.hasInputNode !== false) {
    expect(subgraph.inputNode).toBeDefined()
    expect(subgraph.inputNode.id).toBe(-10)
  }

  if (expected.hasOutputNode !== false) {
    expect(subgraph.outputNode).toBeDefined()
    expect(subgraph.outputNode.id).toBe(-20)
  }
}

/**
 * Verifies that events were fired in the expected sequence.
 * Useful for testing event-driven behavior.
 * @param capturedEvents Array of captured events
 * @param expectedSequence Expected sequence of event types
 * @example
 * ```typescript
 * verifyEventSequence(events, [
 *   "adding-input",
 *   "input-added",
 *   "adding-output",
 *   "output-added"
 * ])
 * ```
 */
export function verifyEventSequence<T = unknown>(
  capturedEvents: CapturedEvent<T>[],
  expectedSequence: string[]
): void {
  expect(capturedEvents.length).toBe(expectedSequence.length)

  for (const [i, element] of expectedSequence.entries()) {
    expect(capturedEvents[i].type).toBe(element)
  }

  // Verify timestamps are in order
  for (let i = 1; i < capturedEvents.length; i++) {
    expect(capturedEvents[i].timestamp).toBeGreaterThanOrEqual(
      capturedEvents[i - 1].timestamp
    )
  }
}

/**
 * Creates test subgraph data with optional overrides.
 * Useful for serialization/deserialization tests.
 * @param overrides Properties to override in the default data
 * @returns ExportedSubgraph data structure
 */
export function createTestSubgraphData(
  overrides: Partial<ExportedSubgraph> = {}
): ExportedSubgraph {
  return {
    version: 1,
    nodes: [],
    // @ts-expect-error TODO: Fix after merge - links type mismatch
    links: {},
    groups: [],
    config: {},
    definitions: { subgraphs: [] },

    id: createUuidv4(),
    name: 'Test Data Subgraph',

    inputNode: {
      id: -10,
      bounding: [10, 100, 150, 126],
      pinned: false
    },
    outputNode: {
      id: -20,
      bounding: [400, 100, 140, 126],
      pinned: false
    },

    inputs: [],
    outputs: [],
    widgets: [],

    ...overrides
  }
}

/**
 * Creates a complex subgraph with multiple nodes and connections.
 * Useful for testing realistic scenarios.
 * @param nodeCount Number of internal nodes to create
 * @returns Complex subgraph data structure
 */
export function createComplexSubgraphData(
  nodeCount: number = 5
): ExportedSubgraph {
  const nodes = []
  const links: Record<
    string,
    {
      id: number
      origin_id: number
      origin_slot: number
      target_id: number
      target_slot: number
      type: string
    }
  > = {}

  // Create internal nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: i + 1, // Start from 1 to avoid conflicts with IO nodes
      type: 'basic/test',
      pos: [100 + i * 150, 200],
      size: [120, 60],
      inputs: [{ name: 'in', type: '*', link: null }],
      outputs: [{ name: 'out', type: '*', links: [] }],
      properties: { value: i },
      flags: {},
      mode: 0
    })
  }

  // Create some internal links
  for (let i = 0; i < nodeCount - 1; i++) {
    const linkId = i + 1
    links[linkId] = {
      id: linkId,
      origin_id: i + 1,
      origin_slot: 0,
      target_id: i + 2,
      target_slot: 0,
      type: '*'
    }
  }

  return createTestSubgraphData({
    // @ts-expect-error TODO: Fix after merge - nodes parameter type
    nodes,
    // @ts-expect-error TODO: Fix after merge - links parameter type
    links,
    inputs: [
      // @ts-expect-error TODO: Fix after merge - input object type
      { name: 'input1', type: 'number', pos: [0, 0] },
      // @ts-expect-error TODO: Fix after merge - input object type
      { name: 'input2', type: 'string', pos: [0, 1] }
    ],
    outputs: [
      // @ts-expect-error TODO: Fix after merge - output object type
      { name: 'output1', type: 'number', pos: [0, 0] },
      // @ts-expect-error TODO: Fix after merge - output object type
      { name: 'output2', type: 'string', pos: [0, 1] }
    ]
  })
}

/**
 * Creates an event capture system for testing event sequences.
 * @param eventTarget The event target to monitor
 * @param eventTypes Array of event types to capture
 * @returns Object with captured events and helper methods
 */
export function createEventCapture<T = unknown>(
  eventTarget: EventTarget,
  eventTypes: string[]
) {
  const capturedEvents: CapturedEvent<T>[] = []
  const listeners: Array<() => void> = []

  // Set up listeners for each event type
  for (const eventType of eventTypes) {
    const listener = (event: Event) => {
      capturedEvents.push({
        type: eventType,
        detail: (event as CustomEvent<T>).detail,
        timestamp: Date.now()
      })
    }

    eventTarget.addEventListener(eventType, listener)
    listeners.push(() => eventTarget.removeEventListener(eventType, listener))
  }

  return {
    events: capturedEvents,
    clear: () => {
      capturedEvents.length = 0
    },
    cleanup: () => {
      // Remove all event listeners to prevent memory leaks
      for (const cleanup of listeners) cleanup()
    },
    getEventsByType: (type: string) =>
      capturedEvents.filter((e) => e.type === type)
  }
}

/**
 * Utility to log subgraph structure for debugging tests.
 * @param subgraph The subgraph to inspect
 * @param label Optional label for the log output
 */
export function logSubgraphStructure(
  subgraph: Subgraph,
  label: string = 'Subgraph'
): void {
  console.log(`\n=== ${label} Structure ===`)
  console.log(`Name: ${subgraph.name}`)
  console.log(`ID: ${subgraph.id}`)
  console.log(`Inputs: ${subgraph.inputs.length}`)
  console.log(`Outputs: ${subgraph.outputs.length}`)
  console.log(`Nodes: ${subgraph.nodes.length}`)
  console.log(`Links: ${subgraph.links.size}`)

  if (subgraph.inputs.length > 0) {
    console.log(
      'Input details:',
      subgraph.inputs.map((i) => ({ name: i.name, type: i.type }))
    )
  }

  if (subgraph.outputs.length > 0) {
    console.log(
      'Output details:',
      subgraph.outputs.map((o) => ({ name: o.name, type: o.type }))
    )
  }

  console.log('========================\n')
}

// Re-export expect from vitest for convenience
export { expect } from 'vitest'
