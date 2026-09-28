import { z } from 'zod'

import { isModelFileName } from '@/platform/missingModel/missingModelScan'
import { getCnrIdFromProperties } from '@/platform/nodeReplacement/cnrIdUtil'
import { collectReachableSubgraphDefinitions } from '@/platform/workflow/core/utils/workflowFlattening'
import type { FlattenableWorkflowNode } from '@/platform/workflow/core/utils/workflowFlattening'

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
 * A node as a workflow file carries it. `id` and `type` are required; an
 * optional field of the wrong shape is dropped rather than trusted, so a
 * node with `properties: 'bad'` still counts as a node with no properties.
 */
const zNode = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string(),
  widgets_values: z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .optional()
    .catch(undefined),
  properties: z.record(z.string(), z.unknown()).optional().catch(undefined)
})

function parseNodes(nodes: readonly unknown[]): FlattenableWorkflowNode[] {
  return nodes.flatMap((node) => {
    const parsed = zNode.safeParse(node)
    return parsed.success ? [parsed.data] : []
  })
}

const zWorkflowShape = z.object({
  nodes: z.array(z.unknown()).catch([]),
  definitions: z
    .object({ subgraphs: z.array(z.unknown()).catch([]) })
    .catch({ subgraphs: [] })
})

/**
 * The root nodes and subgraph definitions of a workflow read off a file, which
 * may be malformed or from an older format: anything that is not a list is
 * empty, and only well-formed nodes are kept.
 */
function workflowParts(graph: unknown): {
  roots: FlattenableWorkflowNode[]
  subgraphs: unknown[]
} {
  const parsed = zWorkflowShape.safeParse(graph)
  if (!parsed.success) return { roots: [], subgraphs: [] }
  return {
    roots: parseNodes(parsed.data.nodes),
    subgraphs: parsed.data.definitions.subgraphs
  }
}

/**
 * The model inputs of a known loader, by node class, as the model-folder
 * registry records them. Empty means the class is not a known loader.
 */
export type ModelInputLookup = (nodeType: string) => readonly string[]

function loaderModelValues(
  values: FlattenableWorkflowNode['widgets_values'],
  inputs: readonly string[]
): string[] {
  if (!values) return []
  if (Array.isArray(values))
    return widgetStrings(values).filter(isModelFileName)
  return Object.entries(values).flatMap(([name, value]) =>
    inputs.includes(name) && typeof value === 'string' && value ? [value] : []
  )
}

/**
 * The models a node names: those it records in `properties.models`, plus, for
 * a known loader, the value of each of its model inputs. A serialized array
 * carries no input names, so there the legacy suffix heuristic applies: every
 * string on the loader that ends in a model extension counts, which can also
 * catch a preset or prompt on that loader. Any other node contributes only
 * what it records, so prompt text ending in `.pt` and a dropdown on an
 * unrelated node are not models.
 */
function modelNames(
  node: FlattenableWorkflowNode,
  modelInputsFor: ModelInputLookup
): string[] {
  const embedded = embeddedModelNames(node.properties)
  const inputs = modelInputsFor(node.type)
  if (!inputs.length) return embedded
  return [...embedded, ...loaderModelValues(node.widgets_values, inputs)]
}

/**
 * What the frontend can see of a Build's contents, read straight off the
 * serialized workflow, which may be malformed or from an older format: only
 * well-formed nodes and subgraph definitions are read. Node packs come from
 * the `cnr_id`/`aux_id` each node carries. Only subgraph definitions the graph
 * actually instantiates count, each read once however often it is used.
 */
export function deriveBuildInputs(
  graph: unknown,
  workflow: { name: string; fileName: string },
  modelInputsFor: ModelInputLookup = () => []
): BuildInputs {
  const { roots, subgraphs } = workflowParts(graph)
  const definitions = collectReachableSubgraphDefinitions(roots, subgraphs)
  const subgraphIds = new Set(definitions.map((definition) => definition.id))
  const nodes = [
    ...roots,
    ...definitions.flatMap((definition) => parseNodes(definition.nodes))
  ]
  const nodeClasses = new Set<string>()
  const nodePacks = new Map<string, NodePack>()
  const models = new Set<string>()

  for (const node of nodes) {
    // A subgraph container node's `type` is the definition's id, not a class.
    if (!subgraphIds.has(node.type)) nodeClasses.add(node.type)

    const pack = nodePack(node.properties)
    if (pack && !nodePacks.has(pack.id)) nodePacks.set(pack.id, pack)

    for (const name of modelNames(node, modelInputsFor)) models.add(name)
  }

  const collator = new Intl.Collator('en')
  function sorted(values: Set<string>): string[] {
    return [...values].sort((a, b) => collator.compare(a, b))
  }

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
