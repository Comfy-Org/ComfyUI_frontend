import type {
  ClipboardItems,
  ISerialisedGraph,
  SerialisableGraph
} from '@comfyorg/graph-model/serialisation'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { zClipboardItems } from '@comfyorg/graph-model/workflowSchema'

type LegacyWorkflowGraph = Omit<ISerialisedGraph, 'links'> & {
  links?: ISerialisedGraph['links']
}

type WorkflowGraph = LegacyWorkflowGraph | SerialisableGraph | ComfyWorkflowJSON

export function workflowToClipboardItems(
  workflow: WorkflowGraph
): ClipboardItems {
  const graph = structuredClone(workflow)

  return zClipboardItems.parse({
    nodes: graph.nodes ?? [],
    groups: graph.groups ?? [],
    reroutes:
      graph.version === 0.4
        ? (graph.extra?.reroutes ?? [])
        : 'reroutes' in graph
          ? (graph.reroutes ?? [])
          : [],
    links: getLinks(graph),
    subgraphs: flattenSubgraphs(graph.definitions?.subgraphs ?? [])
  })
}

function getLinks(graph: WorkflowGraph) {
  const presentation = graph.extra?.linkPresentation
  const parentIds = new Map<number, number | undefined>(
    graph.extra?.linkExtensions?.map(({ id: extensionId, parentId }) => [
      Number(extensionId),
      parentId
    ])
  )
  return (graph.links ?? []).map((entry) => {
    if (!Array.isArray(entry)) return entry
    const [id, origin_id, origin_slot, target_id, target_slot, type] = entry
    const link = {
      id,
      origin_id,
      origin_slot,
      target_id,
      target_slot,
      type,
      parentId: parentIds.get(id)
    }
    return { ...link, ...presentation?.[id] }
  })
}

interface NestedSubgraph {
  id: string
  definitions?: { subgraphs?: NestedSubgraph[] }
}

function flattenSubgraphs(definitions: NestedSubgraph[]): NestedSubgraph[] {
  const result: NestedSubgraph[] = []
  const visited = new Set<string>()

  function visit(subgraph: NestedSubgraph): void {
    if (visited.has(subgraph.id)) return
    visited.add(subgraph.id)

    const nested = subgraph.definitions?.subgraphs ?? []
    delete subgraph.definitions
    result.push(subgraph)
    nested.forEach(visit)
  }

  definitions.forEach(visit)
  return result
}
