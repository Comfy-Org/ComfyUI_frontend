import type { SerializedNodeId } from '@/types/nodeId'

export interface FlattenableWorkflowNode {
  id: SerializedNodeId
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

export interface FlattenableSubgraphDefinition {
  id: string
  name: string
  nodes: readonly FlattenableWorkflowNode[]
  definitions?: {
    subgraphs?: readonly FlattenableSubgraphDefinition[]
  }
}

function isFlattenableWorkflowNode(
  value: unknown
): value is FlattenableWorkflowNode {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    (typeof candidate.id === 'string' || typeof candidate.id === 'number') &&
    typeof candidate.type === 'string'
  )
}

function parseWorkflowNodes(
  nodes: readonly unknown[]
): readonly FlattenableWorkflowNode[] | undefined {
  return nodes.every(isFlattenableWorkflowNode) ? nodes : undefined
}

function subgraphDefinitionSource(definition: unknown):
  | {
      id: string
      name: string
      nodes: unknown[]
      source: Record<string, unknown>
    }
  | undefined {
  if (definition === null || typeof definition !== 'object') return
  const candidate = definition as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.nodes) ||
    !('inputNode' in candidate) ||
    !('outputNode' in candidate)
  )
    return
  return {
    id: candidate.id,
    name: candidate.name,
    nodes: candidate.nodes,
    source: candidate
  }
}

export function parseFlattenableSubgraphDefinitions(
  definitions: readonly unknown[],
  parseNodes: (
    nodes: readonly unknown[]
  ) => readonly FlattenableWorkflowNode[] | undefined = parseWorkflowNodes
): FlattenableSubgraphDefinition[] {
  const copies = new Map<object, FlattenableSubgraphDefinition>()
  const pending: Array<{
    clone: FlattenableSubgraphDefinition
    source: Record<string, unknown>
  }> = []

  function parse(
    definition: unknown
  ): FlattenableSubgraphDefinition | undefined {
    const candidate = subgraphDefinitionSource(definition)
    if (!candidate) return
    const existing = copies.get(candidate.source)
    if (existing) return existing
    const nodes = parseNodes(candidate.nodes)
    if (!nodes) return
    const clone: FlattenableSubgraphDefinition = {
      id: candidate.id,
      name: candidate.name,
      nodes
    }
    copies.set(candidate.source, clone)
    pending.push({ clone, source: candidate.source })
    return clone
  }

  const result = definitions.flatMap((definition) => {
    const parsed = parse(definition)
    return parsed ? [parsed] : []
  })
  for (let entry = pending.pop(); entry; entry = pending.pop()) {
    const definitions = entry.source.definitions
    if (
      definitions !== null &&
      typeof definitions === 'object' &&
      'subgraphs' in definitions &&
      Array.isArray(definitions.subgraphs)
    )
      entry.clone.definitions = {
        subgraphs: definitions.subgraphs.flatMap((definition) => {
          const parsed = parse(definition)
          return parsed ? [parsed] : []
        })
      }
  }
  return result
}

/**
 * Builds a map from subgraph definition ID to all execution path prefixes
 * where that definition is instantiated in the workflow.
 *
 * "def-A" -> ["5", "10"] for each container node instantiating that subgraph definition.
 */
export function buildSubgraphExecutionPaths(
  rootNodes: readonly FlattenableWorkflowNode[],
  allSubgraphDefs: readonly FlattenableSubgraphDefinition[]
): Map<string, string[]> {
  const subgraphDefMap = new Map(allSubgraphDefs.map((s) => [s.id, s]))
  const pathMap = new Map<string, string[]>()
  const visited = new Set<string>()

  function build(
    nodes: readonly FlattenableWorkflowNode[],
    parentPrefix: string
  ) {
    for (const n of nodes) {
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
  rootDefs: readonly FlattenableSubgraphDefinition[]
): FlattenableSubgraphDefinition[] {
  const result: FlattenableSubgraphDefinition[] = []
  const seen = new Set<string>()
  const levels = [rootDefs[Symbol.iterator]()]

  while (levels.length) {
    const next = levels[levels.length - 1].next()
    if (next.done) {
      levels.pop()
      continue
    }
    const def = next.value
    if (seen.has(def.id)) continue
    seen.add(def.id)
    result.push(def)

    const nestedSubgraphs = def.definitions?.subgraphs
    if (nestedSubgraphs?.length) levels.push(nestedSubgraphs[Symbol.iterator]())
  }

  return result
}

export function collectReachableSubgraphDefinitions(
  rootNodes: readonly FlattenableWorkflowNode[],
  allSubgraphDefs: readonly FlattenableSubgraphDefinition[]
): FlattenableSubgraphDefinition[] {
  const byId = new Map(
    collectSubgraphDefinitions(allSubgraphDefs).map((def) => [def.id, def])
  )
  const reached = new Map<string, FlattenableSubgraphDefinition>()
  const pending = [...rootNodes]
  for (let node = pending.pop(); node; node = pending.pop()) {
    const def = byId.get(node.type)
    if (!def || reached.has(def.id)) continue
    reached.set(def.id, def)
    pending.push(...def.nodes)
  }
  return [...reached.values()]
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
    parseFlattenableSubgraphDefinitions(graphData.definitions?.subgraphs ?? [])
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
