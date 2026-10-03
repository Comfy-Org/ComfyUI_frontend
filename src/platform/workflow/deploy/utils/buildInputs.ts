import { z } from 'zod'

import { isModelFileName } from '@/platform/missingModel/missingModelScan'
import { getCnrIdFromProperties } from '@/platform/nodeReplacement/cnrIdUtil'
import {
  collectReachableSubgraphDefinitions,
  parseFlattenableSubgraphDefinitions
} from '@/platform/workflow/core/utils/workflowFlattening'
import type {
  FlattenableSubgraphDefinition,
  FlattenableWorkflowNode
} from '@/platform/workflow/core/utils/workflowFlattening'

export interface NodePack {
  readonly id: string
  readonly versions: readonly string[]
}

export interface BuildInputs {
  readonly workflowName: string
  readonly workflowFileName: string
  readonly nodeClasses: readonly string[]
  readonly nodePacks: readonly NodePack[]
  readonly models: readonly string[]
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

function recordedPack(
  properties: Record<string, unknown> | undefined
): { id: string; version?: string } | undefined {
  const id = getCnrIdFromProperties(properties)
  if (!id || id === CORE_PACK_ID) return undefined
  const version = properties?.ver
  return typeof version === 'string' && version ? { id, version } : { id }
}

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

function workflowParts(graph: unknown): {
  roots: FlattenableWorkflowNode[]
  subgraphs: FlattenableSubgraphDefinition[]
} {
  const parsed = zWorkflowShape.safeParse(graph)
  if (!parsed.success) return { roots: [], subgraphs: [] }
  return {
    roots: parseNodes(parsed.data.nodes),
    subgraphs: parseFlattenableSubgraphDefinitions(
      parsed.data.definitions.subgraphs,
      parseNodes
    )
  }
}

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

function modelNames(
  node: FlattenableWorkflowNode,
  modelInputsFor: ModelInputLookup
): string[] {
  const embedded = embeddedModelNames(node.properties)
  const inputs = modelInputsFor(node.type)
  if (!inputs.length) return embedded
  return [...embedded, ...loaderModelValues(node.widgets_values, inputs)]
}

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
  const packVersions = new Map<string, Set<string>>()
  const models = new Set<string>()

  for (const node of nodes) {
    if (!subgraphIds.has(node.type)) nodeClasses.add(node.type)

    const pack = recordedPack(node.properties)
    if (pack) {
      const versions = packVersions.get(pack.id) ?? new Set<string>()
      if (pack.version) versions.add(pack.version)
      packVersions.set(pack.id, versions)
    }

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
    nodePacks: [...packVersions]
      .map(([id, versions]) => ({ id, versions: sorted(versions) }))
      .sort((a, b) => collator.compare(a.id, b.id)),
    models: sorted(models)
  }
}
