import {
  canTransferReplacementOwnership,
  transferReplacementOwnership
} from '@/core/graph/nodeShell/nodeShellState'
import { growAutogrowInput } from '@/core/graph/widgets/dynamicWidgets'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  inputLink,
  inputLinkId,
  outputLinks
} from '@/lib/litegraph/src/node/slotLinks'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'
import type { TWidgetValue } from '@comfyorg/graph-model/widgets'
import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
import { reportError } from '@comfyorg/telemetry/reportError'
import { t } from '@/i18n'
import { useDeprecatedNodesStore } from '@/platform/workflowErrors/nodeReplacement/deprecatedNodesStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type {
  MissingNodeType,
  NodeReplacement
} from '@/platform/workflowErrors/nodeReplacement/types'
import { useToast } from '@/components/ui/toast/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useApp } from '@/scripts/appInstance'
import { clearNodeOwnedStoreState } from '@/stores/clearNodeOwnedStoreState'
import { useWidgetComponents } from '@/stores/widgetComponents'
import type { EndpointPatch, EndpointUpdate } from '@/stores/linkStore'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

interface WidgetAssignment {
  name: string
  value: TWidgetValue
}

interface ReplacementGroup {
  type: string
  nodeTypes: MissingNodeType[]
}

function originalTypeOf(node: LGraphNode): string | undefined {
  if (node.last_serialization) return node.last_serialization.type
  return node.constructor.nodeData?.deprecated ? node.type : undefined
}

interface ReplacementTopologyPlan {
  error?: string
  updates: EndpointUpdate[]
  removals: {
    link: LLink
    topology: LinkTopology
    connection: Pick<
      ReturnType<LLink['resolve']>,
      'input' | 'inputNode' | 'output' | 'outputNode'
    >
  }[]
}

function planReplacementTopology(
  oldNode: LGraphNode,
  newNode: LGraphNode,
  replacement: NodeReplacement,
  graph: LGraph
): ReplacementTopologyPlan {
  const linkStore = useLinkStore()
  const scope = graphScopeOf(graph)
  const oldNodeId = String(oldNode.id)
  const updates = new Map<LinkId, EndpointUpdate>()
  const addUpdate = (link: LLink, patch: EndpointPatch) => {
    const topology = linkStore.getTopology(scope.rootGraphId, link.id)
    if (!topology) return
    const existing = updates.get(link.id)
    updates.set(link.id, {
      topology,
      patch: { ...existing?.patch, ...patch }
    })
  }

  for (const inputMap of replacement.input_mapping ?? []) {
    if (!('old_id' in inputMap)) continue
    const oldSlot = oldNode.inputs.findIndex(
      (input) => input.name === inputMap.old_id
    )
    const newSlot = newNode.inputs.findIndex(
      (input) => input.name === inputMap.new_id
    )
    if (oldSlot === -1 || newSlot === -1) continue
    const linkId = inputLinkId(graph, oldNode.id, oldSlot)
    const link = linkId == null ? undefined : graph.links.get(linkId)
    if (link) addUpdate(link, { targetSlot: newSlot })
  }

  for (const outputMap of replacement.output_mapping ?? []) {
    if (!newNode.outputs[outputMap.new_idx]) continue
    for (const link of outputLinks(graph, oldNode.id, outputMap.old_idx)) {
      addUpdate(link, { originSlot: outputMap.new_idx })
    }
  }

  let error: string | undefined
  const removals = [...graph.links.values()].flatMap((link) => {
    if (
      link.origin_id === oldNodeId &&
      replacement.output_mapping == null &&
      !newNode.outputs[link.origin_slot]
    ) {
      error ??= `output slot ${link.origin_slot} cannot preserve link ${link.id}`
    }
    if (
      link.target_id === oldNodeId &&
      replacement.input_mapping == null &&
      !newNode.inputs[link.target_slot]
    ) {
      error ??= `input slot ${link.target_slot} cannot preserve link ${link.id}`
    }
    const update = updates.get(link.id)
    const removesOrigin =
      link.origin_id === oldNodeId &&
      replacement.output_mapping != null &&
      update?.patch.originSlot == null
    const removesTarget =
      link.target_id === oldNodeId &&
      replacement.input_mapping != null &&
      update?.patch.targetSlot == null
    if (!removesOrigin && !removesTarget) return []
    const topology = linkStore.getTopology(scope.rootGraphId, link.id)
    const outputNode = graph.getNodeById(link.origin_id) ?? undefined
    const inputNode = graph.getNodeById(link.target_id) ?? undefined
    return topology
      ? [
          {
            link,
            topology,
            connection: {
              inputNode,
              outputNode,
              input: inputNode?.inputs[link.target_slot],
              output: outputNode?.outputs[link.origin_slot]
            }
          }
        ]
      : []
  })
  return { error, updates: [...updates.values()], removals }
}

function savedWidgetValues(
  serialized: ISerialisedNode,
  replacement: NodeReplacement
): Record<string, TWidgetValue> {
  if (serialized.widgets_values_named) return serialized.widgets_values_named
  const values = serialized.widgets_values ?? []
  const names =
    replacement.old_widget_ids ??
    soleMappedWidgetName(serialized, replacement, values.length)
  return Object.fromEntries(
    names.flatMap((name, idx) =>
      values[idx] === undefined ? [] : [[name, values[idx]]]
    )
  )
}

function soleMappedWidgetName(
  serialized: ISerialisedNode,
  replacement: NodeReplacement,
  valueCount: number
): string[] {
  if (valueCount !== 1) return []
  const socketOnlyInputs = new Set(
    serialized.inputs?.flatMap((input) => (input.widget ? [] : [input.name]))
  )
  const widgetIds = (replacement.input_mapping ?? []).flatMap((inputMap) =>
    'old_id' in inputMap && !socketOnlyInputs.has(inputMap.old_id)
      ? [inputMap.old_id]
      : []
  )
  return widgetIds.length === 1 ? widgetIds : []
}

function mappingDepth(inputMap: { new_id: string }): number {
  return inputMap.new_id.split('.').length
}

function assignMappedInputs(
  newNode: LGraphNode,
  replacement: NodeReplacement,
  savedValues: Record<string, TWidgetValue>
): WidgetAssignment[] {
  const assigned: WidgetAssignment[] = []
  function assign(name: string, value: unknown) {
    const widget = newNode.widgets?.find((w) => w.name === name)
    if (!widget) return
    try {
      widget.value = value as TWidgetValue
      assigned.push({ name, value: widget.value })
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'failure_assigning_replacement_widget_value',
        tags: { node_type: replacement.new_node_id, widget_name: name }
      })
    }
  }
  const inputMaps = [...(replacement.input_mapping ?? [])].sort(
    (a, b) => mappingDepth(a) - mappingDepth(b)
  )
  for (const inputMap of inputMaps) {
    if ('set_value' in inputMap) {
      assign(inputMap.new_id, inputMap.set_value)
      continue
    }
    growAutogrowInput(newNode, inputMap.new_id)
    if (Object.hasOwn(savedValues, inputMap.old_id))
      assign(inputMap.new_id, savedValues[inputMap.old_id])
  }
  return assigned
}

/** Auto-generates identity mapping by name for same-structure replacements without backend mapping. */
function generateDefaultMapping(
  serialized: ISerialisedNode,
  newNode: LGraphNode
): Pick<
  NodeReplacement,
  'input_mapping' | 'output_mapping' | 'old_widget_ids'
> {
  const oldInputNames = new Set(serialized.inputs?.map((i) => i.name) ?? [])

  const inputMapping: { old_id: string; new_id: string }[] = []
  for (const newInput of newNode.inputs) {
    if (oldInputNames.has(newInput.name)) {
      inputMapping.push({ old_id: newInput.name, new_id: newInput.name })
    }
  }

  const oldWidgetIds = (newNode.widgets ?? []).map((w) => w.name)
  for (const widget of newNode.widgets ?? []) {
    if (!oldInputNames.has(widget.name)) {
      inputMapping.push({ old_id: widget.name, new_id: widget.name })
    }
  }

  const outputMapping: { old_idx: number; new_idx: number }[] = []
  for (const [oldIdx, oldOutput] of (serialized.outputs ?? []).entries()) {
    const newIdx = newNode.outputs.findIndex((o) => o.name === oldOutput.name)
    if (newIdx !== -1) {
      outputMapping.push({ old_idx: oldIdx, new_idx: newIdx })
    }
  }

  return {
    input_mapping: inputMapping.length > 0 ? inputMapping : null,
    output_mapping: outputMapping.length > 0 ? outputMapping : null,
    old_widget_ids: oldWidgetIds.length > 0 ? oldWidgetIds : null
  }
}

function replaceWithMapping(
  node: LGraphNode,
  newNode: LGraphNode,
  replacement: NodeReplacement,
  nodeGraph: LGraph,
  idx: number
): boolean {
  const order = node.order
  newNode.id = node.id
  newNode.order = order
  newNode.mode = node.mode
  newNode.flags = { ...node.flags }

  if (
    nodeGraph._nodes[idx] !== node ||
    nodeGraph._nodes_by_id[node.id] !== node ||
    !canTransferReplacementOwnership(node, newNode)
  ) {
    console.error(`Cannot replace node ${node.id}: ownership is invalid`)
    return false
  }

  const serialized = node.last_serialization ?? node.serialize()
  if (serialized.title != null) newNode.title = serialized.title
  if (serialized.properties) {
    newNode.properties = { ...newNode.properties, ...serialized.properties }
    if ('Node name for S&R' in newNode.properties) {
      newNode.properties['Node name for S&R'] = replacement.new_node_id
    }
  }
  const assignedWidgets = assignMappedInputs(
    newNode,
    replacement,
    savedWidgetValues(serialized, replacement)
  )

  const topologyPlan = planReplacementTopology(
    node,
    newNode,
    replacement,
    nodeGraph
  )
  newNode.has_errors = false

  if (topologyPlan.error) {
    console.error(`Cannot replace node ${node.id}: ${topologyPlan.error}`)
    return false
  }

  const linkStore = useLinkStore()
  const scope = graphScopeOf(nodeGraph)
  const removalTopologies = topologyPlan.removals.map(
    ({ topology }) => topology
  )
  const endpointError = linkStore.validateEndpointUpdates(
    scope,
    topologyPlan.updates,
    removalTopologies
  )
  if (endpointError) {
    console.error(`Cannot replace node ${node.id}: ${endpointError.message}`)
    return false
  }

  if (
    nodeGraph._nodes[idx] !== node ||
    nodeGraph._nodes_by_id[node.id] !== node ||
    !canTransferReplacementOwnership(node, newNode) ||
    !transferReplacementOwnership(node, newNode)
  ) {
    console.error(
      `Cannot replace node ${node.id}: ownership changed during removal`
    )
    return false
  }

  const topologyResult = linkStore.updateEndpoints(
    scope,
    topologyPlan.updates,
    removalTopologies
  )
  if (!topologyResult.ok) {
    transferReplacementOwnership(newNode, node)
    console.error(
      `Cannot replace node ${node.id}: ${topologyResult.error.message}`
    )
    return false
  }

  for (const { connection, link, topology } of topologyPlan.removals) {
    link.disconnect(nodeGraph)
    nodeGraph.incrementVersion()
    if (connection.inputNode && connection.input) {
      try {
        connection.inputNode.onConnectionsChange?.(
          NodeSlotType.INPUT,
          topology.targetSlot,
          false,
          link,
          connection.input
        )
      } catch (error) {
        console.error(`Failed to notify disconnected link ${link.id}`, error)
      }
    }
    if (connection.outputNode && connection.output) {
      try {
        connection.outputNode.onConnectionsChange?.(
          NodeSlotType.OUTPUT,
          topology.originSlot,
          false,
          link,
          connection.output
        )
      } catch (error) {
        console.error(`Failed to notify disconnected link ${link.id}`, error)
      }
    }
  }

  try {
    node.onRemoved?.()
  } catch (error) {
    console.error(`Failed to remove replaced node ${node.id}`, error)
  }
  const components = useWidgetComponents()
  components.writeNode(scope.rootGraphId, node.id, newNode.properties)
  clearNodeOwnedStoreState(node)

  nodeGraph._nodes[idx] = newNode
  newNode.graph = nodeGraph
  node.graph = null
  nodeGraph._nodes_by_id[newNode.id] = newNode
  nodeGraph.incrementVersion()
  components.adoptNode(scope.rootGraphId, newNode.id, newNode.properties)

  for (const { name, value } of assignedWidgets) {
    const widget = newNode.widgets?.find((w) => w.name === name)
    if (!widget) continue
    try {
      if (widget.value !== value) widget.value = value
      widget.callback?.(value)
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'failure_invoking_replacement_widget_callback',
        tags: { node_type: replacement.new_node_id, widget_name: name }
      })
    }
  }
  for (const widget of newNode.widgets ?? []) {
    if (!isNodeBindable(widget)) continue
    try {
      widget.setNodeId(newNode.id)
    } catch (error) {
      console.error(`Failed to bind replacement widget ${widget.name}`, error)
    }
  }
  const connectedInputs = newNode.inputs.flatMap((input, slot) => {
    const link = inputLink(nodeGraph, newNode.id, slot)
    return link ? [{ input, link }] : []
  })
  for (const { input, link } of connectedInputs) {
    try {
      newNode.onConnectionsChange?.(
        NodeSlotType.INPUT,
        newNode.inputs.indexOf(input),
        true,
        link,
        input
      )
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'failure_notifying_replacement_input_connection',
        tags: { node_type: replacement.new_node_id, input_name: input.name }
      })
    }
  }

  try {
    nodeGraph.onNodeAdded?.(newNode)
  } catch (error) {
    console.error(`Failed to notify replacement node ${newNode.id}`, error)
  }
  try {
    nodeGraph.events.dispatch('node:added', { node: newNode })
  } catch (error) {
    console.error(`Failed to dispatch replacement node ${newNode.id}`, error)
  }
  return true
}

function removeReplacedNodeWarnings(nodeIds: string[]): void {
  const missingNodesStore = useMissingNodesErrorStore()
  const deprecatedNodesStore = useDeprecatedNodesStore()
  for (const nodeId of nodeIds) {
    missingNodesStore.removeMissingNodesByNodeId(nodeId)
    deprecatedNodesStore.removeByNodeId(nodeId)
  }
}

function replacePlaceholder(
  node: LGraphNode,
  replacement: NodeReplacement
): boolean {
  const nodeGraph = node.graph
  if (!nodeGraph) return false

  const idx = nodeGraph._nodes.indexOf(node)
  if (idx === -1) return false

  const newNode = LiteGraph.createNode(replacement.new_node_id)
  if (!newNode) return false

  const hasMapping =
    replacement.input_mapping != null || replacement.output_mapping != null
  const effectiveReplacement = hasMapping
    ? replacement
    : {
        ...replacement,
        ...generateDefaultMapping(
          node.last_serialization ?? node.serialize(),
          newNode
        )
      }
  return replaceWithMapping(node, newNode, effectiveReplacement, nodeGraph, idx)
}

export function useNodeReplacement() {
  const toast = useToast()

  /** Replaces each selected node, found by its execution id, and returns the ids it replaced. */
  function replaceNodesInPlace(selectedTypes: MissingNodeType[]): string[] {
    const replacedNodeIds: string[] = []
    const replacedTypes = new Set<string>()
    let replacementFailed = false
    const graph = useApp().rootGraph

    const changeTracker =
      useWorkflowStore().activeWorkflow?.changeTracker ?? null
    changeTracker?.beforeChange()

    try {
      const targets = selectedTypes.flatMap((selected) => {
        if (
          typeof selected === 'string' ||
          !selected.replacement ||
          selected.nodeId == null
        )
          return []
        const nodeId = String(selected.nodeId)
        const node = getNodeByExecutionId(graph, nodeId)
        return node && originalTypeOf(node) === selected.type
          ? [
              {
                nodeId,
                node,
                type: selected.type,
                replacement: selected.replacement
              }
            ]
          : []
      })

      const outcomes = new Map<LGraphNode, boolean>()
      for (const { nodeId, node, type, replacement } of targets) {
        const replaced =
          outcomes.get(node) ?? replacePlaceholder(node, replacement)
        outcomes.set(node, replaced)
        if (!replaced) {
          replacementFailed = true
          continue
        }
        replacedNodeIds.push(nodeId)
        replacedTypes.add(type)
      }

      if (replacedTypes.size > 0) {
        toast.success(t('g.success'), {
          description: t('nodeReplacement.replacedAllNodes', {
            count: replacedTypes.size
          }),
          duration: 3000
        })
      }
      if (replacementFailed) {
        toast.error(t('g.error'), {
          description: t('nodeReplacement.replaceFailed')
        })
      }
    } catch (error) {
      console.error('Failed to replace nodes:', error)
      toast.error(t('g.error'), {
        description: t('nodeReplacement.replaceFailed')
      })
    } finally {
      if (replacedNodeIds.length > 0) {
        graph.updateExecutionOrder()
        graph.setDirtyCanvas(true, true)
      }
      changeTracker?.afterChange()
    }

    return replacedNodeIds
  }

  /** Replaces the nodes in one swap group and clears their warnings. */
  function replaceGroup(group: ReplacementGroup): void {
    removeReplacedNodeWarnings(replaceNodesInPlace(group.nodeTypes))
  }

  /** Replaces the nodes in every swap group and clears their warnings. */
  function replaceAllGroups(groups: ReplacementGroup[]): void {
    removeReplacedNodeWarnings(
      replaceNodesInPlace(groups.flatMap((group) => group.nodeTypes))
    )
  }

  return {
    replaceNodesInPlace,
    replaceGroup,
    replaceAllGroups
  }
}
