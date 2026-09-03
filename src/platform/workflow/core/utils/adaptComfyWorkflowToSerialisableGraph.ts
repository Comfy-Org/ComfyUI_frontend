import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import type { LGraphExtra } from '@/lib/litegraph/src/LGraph'
import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type {
  ExportedSubgraph,
  ExportedSubgraphInstance,
  ISerialisedGraph,
  ISerialisedGroup,
  ISerialisedNode,
  SerialisableGraph,
  SerialisableLLink,
  SerialisableReroute
} from '@/lib/litegraph/src/types/serialisation'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'
import type {
  ComfyLinkObject,
  ComfyNode,
  ComfyWorkflowJSON,
  WorkflowJSON04
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { toLinkId } from '@/types/linkId'
import type { NodeProperty } from '@/types/nodeState'
import { toRerouteId } from '@/types/rerouteId'
import { zeroUuid } from '@/utils/uuid'

export type WorkflowGraph = ISerialisedGraph | SerialisableGraph
type WorkflowJSON1 = Exclude<ComfyWorkflowJSON, WorkflowJSON04>
type WorkflowGroup = NonNullable<ComfyWorkflowJSON['groups']>[number]
type WorkflowSubgraphMetadata = NonNullable<
  NonNullable<WorkflowJSON1['definitions']>['subgraphs']
>[number]
type WorkflowSubgraph = WorkflowJSON1 & WorkflowSubgraphMetadata
type WorkflowSubgraphInstance = NonNullable<WorkflowJSON1['subgraphs']>[number]
type WorkflowExtra =
  | WorkflowJSON04['extra']
  | WorkflowJSON1['extra']
  | WorkflowSubgraph['extra']
type WorkflowReroute = NonNullable<
  NonNullable<WorkflowExtra>['reroutes']
>[number]

export function adaptComfyWorkflowToSerialisableGraph(
  workflow: ComfyWorkflowJSON
): WorkflowGraph {
  const clone = structuredClone(workflow)
  return isLegacyWorkflow(clone)
    ? adaptLegacyWorkflow(clone)
    : adaptCurrentWorkflow(clone)
}

function isLegacyWorkflow(
  workflow: ComfyWorkflowJSON
): workflow is WorkflowJSON04 {
  return workflow.version !== 1
}

function adaptLegacyWorkflow(workflow: WorkflowJSON04): ISerialisedGraph {
  return {
    ...workflow,
    id: workflow.id ?? zeroUuid,
    revision: workflow.revision ?? 0,
    last_node_id: workflow.last_node_id,
    last_link_id: workflow.last_link_id,
    nodes: workflow.nodes.map(adaptNode),
    links: workflow.links.map(adaptLegacyLink),
    floatingLinks: workflow.floatingLinks?.map(adaptLink),
    groups: (workflow.groups ?? []).map(adaptGroup),
    config: workflow.config ?? undefined,
    extra: adaptExtra(workflow.extra),
    subgraphs: workflow.subgraphs?.map(adaptSubgraphInstance),
    definitions: adaptDefinitions(workflow.definitions),
    version: 0.4
  }
}

function adaptCurrentWorkflow(workflow: WorkflowJSON1): SerialisableGraph {
  return {
    ...workflow,
    id: workflow.id ?? zeroUuid,
    revision: workflow.revision ?? 0,
    version: 1,
    state: workflow.state,
    groups: workflow.groups?.map(adaptGroup),
    nodes: workflow.nodes.map(adaptNode),
    links: workflow.links?.map(adaptLink),
    floatingLinks: workflow.floatingLinks?.map(adaptLink),
    reroutes: workflow.reroutes?.map(adaptReroute),
    config: workflow.config ?? undefined,
    extra: adaptExtra(workflow.extra),
    subgraphs: workflow.subgraphs?.map(adaptSubgraphInstance),
    definitions: adaptDefinitions(workflow.definitions)
  }
}

function adaptDefinitions(
  definitions: { subgraphs?: readonly unknown[] } | undefined
): SerialisableGraph['definitions'] {
  if (!definitions?.subgraphs) return undefined
  return { subgraphs: definitions.subgraphs.map(adaptSubgraph) }
}

function adaptSubgraph(value: unknown): ExportedSubgraph {
  if (!isWorkflowSubgraph(value)) {
    throw new TypeError('Invalid version 1 workflow subgraph')
  }
  const subgraph = value
  return {
    ...subgraph,
    id: subgraph.id,
    revision: subgraph.revision,
    name: subgraph.name,
    description: subgraph.description,
    category: subgraph.category,
    version: 1,
    state: subgraph.state,
    inputNode: subgraph.inputNode,
    outputNode: subgraph.outputNode,
    inputs: subgraph.inputs,
    outputs: subgraph.outputs,
    widgets: subgraph.widgets,
    config: subgraph.config ?? undefined,
    extra: adaptExtra(subgraph.extra),
    groups: subgraph.groups?.map(adaptGroup),
    nodes: subgraph.nodes.map(adaptNode),
    links: subgraph.links?.map(adaptLink),
    floatingLinks: subgraph.floatingLinks?.map(adaptLink),
    reroutes: subgraph.reroutes?.map(adaptReroute),
    subgraphs: subgraph.subgraphs?.map(adaptSubgraphInstance),
    definitions: adaptDefinitions(subgraph.definitions)
  }
}

function isWorkflowSubgraph(value: unknown): value is WorkflowSubgraph {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === 1 &&
    'id' in value &&
    typeof value.id === 'string' &&
    'revision' in value &&
    typeof value.revision === 'number' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'state' in value &&
    typeof value.state === 'object' &&
    value.state !== null &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'inputNode' in value &&
    typeof value.inputNode === 'object' &&
    value.inputNode !== null &&
    'outputNode' in value &&
    typeof value.outputNode === 'object' &&
    value.outputNode !== null
  )
}

function adaptSubgraphInstance(
  instance: WorkflowSubgraphInstance
): ExportedSubgraphInstance {
  const { inputs, outputs, widgets_values, ...rest } = instance
  return {
    ...rest,
    inputs,
    outputs,
    widgets_values: adaptWidgetValues(widgets_values)
  }
}

function adaptNode(node: ComfyNode): ISerialisedNode {
  const { inputs, outputs, properties, widgets_values, ...rest } = node
  return {
    ...rest,
    inputs: inputs?.map(({ type, ...input }) => ({
      ...input,
      type: adaptSlotType(type)
    })),
    outputs: outputs?.map(({ type, ...output }) => ({
      ...output,
      type: adaptSlotType(type)
    })),
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        adaptNodeProperty(value)
      ])
    ),
    widgets_values: adaptWidgetValues(widgets_values)
  }
}

function adaptNodeProperty(value: unknown): NodeProperty | undefined {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'object'
  ) {
    return value
  }
  throw new TypeError('Workflow node properties must be JSON values')
}

function adaptWidgetValues(
  values: ComfyNode['widgets_values']
): TWidgetValue[] | undefined {
  if (values === undefined || Array.isArray(values)) return values
  if (typeof values.length !== 'number') return Object.values(values)
  const length = values.length
  const keys = Object.keys(values)
  const hasIndexedEntry = keys.some((key) => {
    const index = Number(key)
    return String(index) === key && index >= 0 && index < length
  })
  if (!hasIndexedEntry && keys.some((key) => key !== 'length')) {
    return Object.values(values)
  }
  return Array.from({ length }, (_, index) => values[index])
}

function adaptGroup(group: WorkflowGroup): ISerialisedGroup {
  return { ...group, id: group.id ?? -1 }
}

function adaptLegacyLink(
  link: WorkflowJSON04['links'][number]
): SerialisedLLinkArray {
  const [id, originId, originSlot, targetId, targetSlot, type] = link
  return [id, originId, originSlot, targetId, targetSlot, adaptSlotType(type)]
}

function adaptLink(link: ComfyLinkObject): SerialisableLLink {
  return { ...link, type: adaptSlotType(link.type) }
}

function adaptReroute(reroute: WorkflowReroute): SerialisableReroute {
  return { ...reroute, linkIds: reroute.linkIds ?? [] }
}

function adaptExtra(extra: WorkflowExtra): LGraphExtra | undefined {
  if (!extra) return undefined
  return {
    ...extra,
    reroutes: extra.reroutes?.map(adaptReroute),
    linkExtensions: extra.linkExtensions?.map(({ id, parentId }) => ({
      id: toLinkId(id),
      parentId: toRerouteId(parentId)
    }))
  }
}

function adaptSlotType(type: ComfyLinkObject['type']): ISlotType {
  return Array.isArray(type) ? type.join(',') : type
}
