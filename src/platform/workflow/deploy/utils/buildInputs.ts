import { isModelFileName } from '@/platform/missingModel/missingModelScan'
import { getCnrIdFromProperties } from '@/platform/nodeReplacement/cnrIdUtil'
import { collectSubgraphDefinitions } from '@/platform/workflow/core/utils/workflowFlattening'
import type {
  FlattenableWorkflowGraph,
  FlattenableWorkflowNode
} from '@/platform/workflow/core/utils/workflowFlattening'

export interface NodePack {
  id: string
  version?: string
}

/**
 * What the open workflow contributes to a Build, as far as the frontend can
 * see it. `nodePacks` holds only the ids the workflow itself records; a class
 * with none is core ComfyUI or is left for the platform to resolve.
 */
export interface BuildInputs {
  workflowName: string
  workflowFileName: string
  nodeClasses: string[]
  nodePacks: NodePack[]
  models: string[]
}

function widgetStrings(
  values: readonly unknown[] | Record<string, unknown> | undefined
): string[] {
  if (!values) return []
  const list = Array.isArray(values) ? values : Object.values(values)
  return list.filter((value): value is string => typeof value === 'string')
}

function embeddedModelNames(
  properties: Record<string, unknown> | undefined
): string[] {
  const models = properties?.models
  if (!Array.isArray(models)) return []
  return models.flatMap((model: unknown) =>
    typeof model === 'object' &&
    model !== null &&
    'name' in model &&
    typeof model.name === 'string'
      ? [model.name]
      : []
  )
}

const CORE_PACK_ID = 'comfy-core'

function nodePack(
  properties: Record<string, unknown> | undefined
): NodePack | undefined {
  const id = getCnrIdFromProperties(properties)
  if (!id || id === CORE_PACK_ID) return undefined
  const version = properties?.ver
  return typeof version === 'string' && version ? { id, version } : { id }
}

/**
 * What the frontend can see of a Build's contents, read straight off the
 * serialized workflow. Node packs come from the `cnr_id`/`aux_id` each node
 * carries, so a class with no pack recorded is core ComfyUI or is left for the
 * platform to resolve — nothing here guesses. Each subgraph definition is read
 * once, however many times the graph instantiates it.
 */
export function deriveBuildInputs(
  graph: FlattenableWorkflowGraph,
  workflow: { name: string; fileName: string }
): BuildInputs {
  const definitions = collectSubgraphDefinitions(
    graph.definitions?.subgraphs ?? []
  )
  // A subgraph container node's `type` is the definition's id, not a class.
  const subgraphIds = new Set(definitions.map((definition) => definition.id))
  const nodes: readonly FlattenableWorkflowNode[] = [
    ...(graph.nodes ?? []),
    ...definitions.flatMap((definition) => definition.nodes)
  ]
  const nodeClasses = new Set<string>()
  const nodePacks = new Map<string, NodePack>()
  const models = new Set<string>()

  for (const node of nodes) {
    if (!subgraphIds.has(node.type)) nodeClasses.add(node.type)

    const pack = nodePack(node.properties)
    if (pack && !nodePacks.has(pack.id)) nodePacks.set(pack.id, pack)

    for (const name of embeddedModelNames(node.properties)) models.add(name)
    for (const value of widgetStrings(node.widgets_values)) {
      if (isModelFileName(value)) models.add(value)
    }
  }

  const collator = new Intl.Collator('en')
  const sorted = (values: Set<string>) =>
    [...values].sort((a, b) => collator.compare(a, b))

  return {
    workflowName: workflow.name,
    workflowFileName: workflow.fileName,
    nodeClasses: sorted(nodeClasses),
    nodePacks: [...nodePacks.values()].sort((a, b) =>
      collator.compare(a.id, b.id)
    ),
    models: sorted(models)
  }
}
