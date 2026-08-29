import type {
  ClipboardItems,
  ExportedSubgraph,
  ISerialisedGraph,
  SerialisableGraph,
  SerialisableLLink,
  SerialisableReroute
} from '@/lib/litegraph/src/types/serialisation'

type WorkflowGraph = ISerialisedGraph | SerialisableGraph

export function workflowToClipboardItems(
  workflow: WorkflowGraph
): ClipboardItems {
  const graph = structuredClone(workflow)

  return {
    nodes: graph.nodes ?? [],
    groups: (graph.groups ?? []).map((group) => ({
      ...group,
      id: group.id ?? -1
    })),
    reroutes: getReroutes(graph),
    links: getLinks(graph),
    subgraphs: flattenSubgraphs(graph.definitions?.subgraphs ?? [])
  }
}

function getLinks(graph: WorkflowGraph): SerialisableLLink[] {
  if (graph.version !== 0.4) return graph.links ?? []

  const presentation = graph.extra?.linkPresentation
  const parentIds = new Map<number, number | undefined>(
    graph.extra?.linkExtensions?.map(({ id, parentId }) => [
      Number(id),
      parentId
    ])
  )
  return (graph.links ?? []).map(
    ([
      id,
      origin_id,
      origin_slot,
      target_id,
      target_slot,
      type
    ]): SerialisableLLink => ({
      id,
      origin_id,
      origin_slot,
      target_id,
      target_slot,
      type,
      parentId: parentIds.get(id),
      ...(presentation?.[String(id)]?.hidden && { hidden: true }),
      ...(presentation?.[String(id)]?.label !== undefined && {
        label: presentation[String(id)].label
      })
    })
  )
}

function getReroutes(graph: WorkflowGraph): SerialisableReroute[] {
  const reroutes =
    graph.version === 0.4 ? graph.extra?.reroutes : graph.reroutes

  return (reroutes ?? []).map((reroute) => ({
    ...reroute,
    linkIds: reroute.linkIds ?? []
  }))
}

function flattenSubgraphs(definitions: ExportedSubgraph[]): ExportedSubgraph[] {
  const result: ExportedSubgraph[] = []
  const visited = new Set<string>()

  function visit(subgraph: ExportedSubgraph): void {
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
