import { getCnrIdFromProperties } from '@/platform/nodeReplacement/cnrIdUtil'
import { isModelFileName } from '@/platform/missingModel/missingModelScan'
import {
  collectSubgraphDefinitions,
  flattenWorkflowNodes
} from '@/platform/workflow/core/utils/workflowFlattening'
import type { FlattenableWorkflowGraph } from '@/platform/workflow/core/utils/workflowFlattening'

/**
 * What the open workflow contributes to a Build, as far as the frontend can
 * see it. `nodePacks` holds only the ids the workflow itself records; a class
 * with none is core ComfyUI or is left for the platform to resolve.
 */
export interface BuildInputs {
  workflowName: string
  workflowFileName: string
  nodeClasses: string[]
  nodePacks: string[]
  models: string[]
}

function widgetStrings(
  values: readonly unknown[] | Record<string, unknown> | undefined
): string[] {
  if (!values) return []
  const list = Array.isArray(values) ? values : Object.values(values)
  return list.filter((value): value is string => typeof value === 'string')
}

/**
 * What the frontend can see of a Build's contents, read straight off the
 * serialized workflow. Node packs come from the `cnr_id`/`aux_id` each node
 * carries, so a class with no pack recorded is core ComfyUI or is left for the
 * platform to resolve — nothing here guesses.
 */
export function deriveBuildInputs(
  graph: FlattenableWorkflowGraph,
  workflow: { name: string; fileName: string }
): BuildInputs {
  const nodes = flattenWorkflowNodes(graph)
  // A subgraph container node's `type` is the definition's id, not a class.
  const subgraphIds = new Set(
    collectSubgraphDefinitions(graph.definitions?.subgraphs ?? []).map(
      (definition) => definition.id
    )
  )
  const nodeClasses = new Set<string>()
  const nodePacks = new Set<string>()
  const models = new Set<string>()

  for (const node of nodes) {
    if (!subgraphIds.has(node.type)) nodeClasses.add(node.type)

    const packId = getCnrIdFromProperties(node.properties)
    if (packId) nodePacks.add(packId)

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
    nodePacks: sorted(nodePacks),
    models: sorted(models)
  }
}
