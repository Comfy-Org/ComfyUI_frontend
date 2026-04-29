import type { NodeId } from '@/lib/litegraph/src/litegraph'

export interface FlattenableWorkflowNode {
  id: NodeId
  type: string
  mode?: number
  widgets_values?: readonly unknown[] | Record<string, unknown>
  properties?: Record<string, unknown>
}

export interface FlattenableWorkflowGraph {
  nodes?: readonly FlattenableWorkflowNode[]
  definitions?: {
    subgraphs?: readonly unknown[]
  }
}

interface FlattenableSubgraphDefinition {
  id: string
  name: string
  nodes: FlattenableWorkflowNode[]
  definitions?: {
    subgraphs?: readonly unknown[]
  }
  inputNode: unknown
  outputNode: unknown
}

/**
 * Type guard to check if an object is a subgraph definition.
 * This helps TypeScript understand the type when recursive definitions are unknown.
 */
export function isSubgraphDefinition(
  obj: unknown
): obj is FlattenableSubgraphDefinition {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'name' in obj &&
    'nodes' in obj &&
    Array.isArray((obj as FlattenableSubgraphDefinition).nodes) &&
    'inputNode' in obj &&
    'outputNode' in obj
  )
}

/**
 * Builds a map from subgraph definition ID to all execution path prefixes
 * where that definition is instantiated in the workflow.
 *
 * "def-A" -> ["5", "10"] for each container node instantiating that subgraph definition.
 */
export function buildSubgraphExecutionPaths(
  rootNodes: readonly FlattenableWorkflowNode[],
  allSubgraphDefs: readonly unknown[]
): Map<string, string[]> {
  const subgraphDefMap = new Map(
    allSubgraphDefs.filter(isSubgraphDefinition).map((s) => [s.id, s])
  )
  const pathMap = new Map<string, string[]>()
  const visited = new Set<string>()

  const build = (
    nodes: readonly FlattenableWorkflowNode[],
    parentPrefix: string
  ) => {
    for (const n of nodes ?? []) {
      if (typeof n.type !== 'string' || !subgraphDefMap.has(n.type)) continue
      if (visited.has(n.type)) continue

      const path = parentPrefix ? `${parentPrefix}:${n.id}` : String(n.id)
      const existing = pathMap.get(n.type)
      if (existing) {
        existing.push(path)
      } else {
        pathMap.set(n.type, [path])
      }

      visited.add(n.type)

      const innerDef = subgraphDefMap.get(n.type)
      if (innerDef) {
        build(innerDef.nodes, path)
      }

      visited.delete(n.type)
    }
  }

  build(rootNodes, '')
  return pathMap
}

/**
 * Recursively collect all subgraph definitions from root and nested levels.
 */
export function collectSubgraphDefinitions(
  rootDefs: readonly unknown[]
): FlattenableSubgraphDefinition[] {
  const result: FlattenableSubgraphDefinition[] = []
  const seen = new Set<string>()

  function collect(defs: readonly unknown[]) {
    for (const def of defs) {
      if (!isSubgraphDefinition(def)) continue
      if (seen.has(def.id)) continue
      seen.add(def.id)
      result.push(def)
      if (def.definitions?.subgraphs?.length) {
        collect(def.definitions.subgraphs)
      }
    }
  }

  collect(rootDefs)
  return result
}

/**
 * Flatten all workflow nodes (root + subgraphs) into a single array.
 * Each node's `id` is prefixed with its execution path (e.g. node "3" inside container "11" -> "11:3").
 */
export function flattenWorkflowNodes(
  graphData: FlattenableWorkflowGraph
): Readonly<FlattenableWorkflowNode>[] {
  const rootNodes = graphData.nodes ?? []
  const allDefs = collectSubgraphDefinitions(
    graphData.definitions?.subgraphs ?? []
  )
  const pathMap = buildSubgraphExecutionPaths(rootNodes, allDefs)

  const allNodes: FlattenableWorkflowNode[] = [...rootNodes]

  const subgraphDefMap = new Map(allDefs.map((s) => [s.id, s]))
  for (const [defId, paths] of pathMap.entries()) {
    const def = subgraphDefMap.get(defId)
    if (!def?.nodes) continue
    for (const prefix of paths) {
      for (const node of def.nodes) {
        allNodes.push({
          ...node,
          id: `${prefix}:${node.id}`
        })
      }
    }
  }

  return allNodes
}
