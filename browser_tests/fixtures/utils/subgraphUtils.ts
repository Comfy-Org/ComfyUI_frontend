/**
 * Represents a subgraph's graph object with inputs and outputs slots.
 */
export interface SubgraphGraph {
  inputs: SubgraphSlot[]
  outputs: SubgraphSlot[]
}

export interface SubgraphSlot {
  label?: string
  name?: string
  displayName?: string
  labelPos?: [number, number]
}

export interface SubgraphInputNode {
  onPointerDown?: (e: unknown, pointer: unknown, linkConnector: unknown) => void
}

export interface SubgraphGraphWithNodes extends SubgraphGraph {
  inputNode?: SubgraphInputNode
}

/**
 * Type guard to check if a graph object is a subgraph.
 */
export function isSubgraph(graph: unknown): graph is SubgraphGraph {
  return (
    graph !== null &&
    typeof graph === 'object' &&
    'inputs' in graph &&
    'outputs' in graph &&
    Array.isArray((graph as SubgraphGraph).inputs) &&
    Array.isArray((graph as SubgraphGraph).outputs)
  )
}

/**
 * Assertion function that throws if the graph is not a subgraph.
 */
export function assertSubgraph(
  graph: unknown,
  message = 'Not in subgraph'
): asserts graph is SubgraphGraph {
  if (!isSubgraph(graph)) {
    throw new Error(message)
  }
}

/**
 * Inline assertion for use inside page.evaluate() browser context.
 * Returns a string that can be used with Function constructor or eval.
 */
export const SUBGRAPH_ASSERT_INLINE = `
  const assertSubgraph = (graph) => {
    if (
      graph === null ||
      typeof graph !== 'object' ||
      !('inputs' in graph) ||
      !('outputs' in graph) ||
      !Array.isArray(graph.inputs) ||
      !Array.isArray(graph.outputs)
    ) {
      throw new Error('Not in subgraph');
    }
  };
`
