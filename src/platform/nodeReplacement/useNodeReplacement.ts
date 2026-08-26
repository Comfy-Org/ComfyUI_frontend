import {
  canTransferReplacementOwnership,
  transferReplacementOwnership
} from '@/core/graph/nodeShell/nodeShellState'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { inputLinkId, outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
import { t } from '@/i18n'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import type { NodeReplacement } from '@/platform/nodeReplacement/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import {
  removePendingMissingNodeTypesByType,
  updatePendingWarnings
} from '@/platform/workflow/core/utils/pendingWarnings'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app, sanitizeNodeName } from '@/scripts/app'
import { clearNodeOwnedStoreState } from '@/stores/clearNodeOwnedStoreState'
import type { EndpointPatch, EndpointUpdate } from '@/stores/linkStore'
import { useLinkStore } from '@/stores/linkStore'
import type { MissingNodeType } from '@/types/comfy'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

interface ReplacementGroup {
  type: string
  nodeTypes: MissingNodeType[]
}

/** Compares sanitized type strings to match placeholder → missing node type. */
function findMatchingType(
  node: LGraphNode,
  selectedTypes: MissingNodeType[]
): Extract<MissingNodeType, { type: string }> | undefined {
  const nodeType = node.type
  for (const selected of selectedTypes) {
    if (typeof selected !== 'object' || !selected.isReplaceable) continue
    if (sanitizeNodeName(selected.type) === nodeType) return selected
  }
  return undefined
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
    if (!('old_id' in inputMap) || isDotNotation(inputMap.new_id)) continue
    const oldSlot = oldNode.inputs?.findIndex(
      (input) => input.name === inputMap.old_id
    )
    const newSlot = newNode.inputs?.findIndex(
      (input) => input.name === inputMap.new_id
    )
    if (oldSlot == null || oldSlot === -1 || newSlot == null || newSlot === -1)
      continue
    const linkId = inputLinkId(graph, oldNode.id, oldSlot)
    const link = linkId == null ? undefined : graph.links.get(linkId)
    if (link) addUpdate(link, { targetSlot: newSlot })
  }

  for (const outputMap of replacement.output_mapping ?? []) {
    if (!newNode.outputs?.[outputMap.new_idx]) continue
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

/** Uses old_widget_ids as name→index lookup into widgets_values. */
function transferWidgetValue(
  serialized: ISerialisedNode,
  oldWidgetIds: string[] | null,
  oldInputName: string,
  newNode: LGraphNode,
  newInputName: string
): void {
  if (!oldWidgetIds || !serialized.widgets_values) return

  const oldWidgetIdx = oldWidgetIds.indexOf(oldInputName)
  if (oldWidgetIdx === -1) return

  const oldValue = serialized.widgets_values[oldWidgetIdx]
  if (oldValue === undefined) return

  const newWidget = newNode.widgets?.find((w) => w.name === newInputName)
  if (newWidget) {
    try {
      newWidget.value = oldValue
      newWidget.callback?.(oldValue)
    } catch (error) {
      console.error(`Failed to transfer widget ${newInputName}`, error)
    }
  }
}

function applySetValue(
  newNode: LGraphNode,
  inputName: string,
  value: unknown
): void {
  const widget = newNode.widgets?.find((w) => w.name === inputName)
  if (widget) {
    try {
      widget.value = value as TWidgetValue
      widget.callback?.(widget.value)
    } catch (error) {
      console.error(`Failed to set widget ${inputName}`, error)
    }
  }
}

function isDotNotation(id: string): boolean {
  return id.includes('.')
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
  for (const newInput of newNode.inputs ?? []) {
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
    const newIdx = newNode.outputs?.findIndex((o) => o.name === oldOutput.name)
    if (newIdx != null && newIdx !== -1) {
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
  newNode.pos = [...node.pos]
  newNode.size = [...node.size]
  newNode.order = order
  newNode.mode = node.mode
  if (node.flags) newNode.flags = { ...node.flags }

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
    newNode.properties = { ...serialized.properties }
    if ('Node name for S&R' in newNode.properties) {
      newNode.properties['Node name for S&R'] = replacement.new_node_id
    }
  }

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
  clearNodeOwnedStoreState(node)

  nodeGraph._nodes[idx] = newNode
  newNode.graph = nodeGraph
  node.graph = null
  nodeGraph._nodes_by_id[newNode.id] = newNode

  if (replacement.input_mapping) {
    for (const inputMap of replacement.input_mapping) {
      if ('old_id' in inputMap) {
        if (isDotNotation(inputMap.new_id)) continue
        transferWidgetValue(
          serialized,
          replacement.old_widget_ids,
          inputMap.old_id,
          newNode,
          inputMap.new_id
        )
      } else if (!isDotNotation(inputMap.new_id)) {
        applySetValue(newNode, inputMap.new_id, inputMap.set_value)
      }
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

function removeReplacedMissingNodeTypes(types: string[]): void {
  // Remove from the rendered store directly rather than re-projecting the
  // cache into it: entries surfaced outside the load path (e.g. the
  // missing_node_type rescan) exist only in the store, and a projection from
  // a cache that never saw them would wipe them.
  useMissingNodesErrorStore().removeMissingNodesByType(types)

  const activeWorkflow = useWorkflowStore().activeWorkflow
  if (!activeWorkflow) return

  updatePendingWarnings(activeWorkflow, {
    missingNodeTypes: removePendingMissingNodeTypesByType(
      activeWorkflow.pendingWarnings?.missingNodeTypes,
      types
    )
  })
}

export function useNodeReplacement() {
  const toastStore = useToastStore()

  function replaceNodesInPlace(selectedTypes: MissingNodeType[]): string[] {
    const replacedTypes: string[] = []
    let replacementFailed = false
    const graph = app.rootGraph

    const changeTracker =
      useWorkflowStore().activeWorkflow?.changeTracker ?? null
    changeTracker?.beforeChange()

    // Target types come from node_replacements fetched at workflow load time
    // and the missing nodes detected at that point — not from the current
    // registered_node_types. This ensures replacement still works even if
    // the user has since installed the missing node pack.
    // Also include sanitized variants so that when the fallback path reads
    // n.type (which app.ts may have already run through sanitizeNodeName),
    // we can still match against the original type stored in selectedTypes.
    const targetTypes = new Set([
      ...selectedTypes.map((t) => (typeof t === 'string' ? t : t.type)),
      ...selectedTypes.map((t) =>
        sanitizeNodeName(typeof t === 'string' ? t : t.type)
      )
    ])

    try {
      const placeholders = collectAllNodes(graph, (n) => {
        if (!n.last_serialization) return false
        // Prefer the original serialized type; fall back to the live type
        // for nodes whose serialization predates the type field.
        // n.type may have been sanitized by app.ts (HTML special chars stripped);
        // the sanitized variants in targetTypes ensure we still match correctly.
        const originalType = n.last_serialization.type ?? n.type
        return !!originalType && targetTypes.has(originalType)
      })

      for (const node of placeholders) {
        const match = findMatchingType(node, selectedTypes)
        if (!match?.replacement) continue

        const replacement = match.replacement
        const nodeGraph = node.graph
        if (!nodeGraph) continue

        const idx = nodeGraph._nodes.indexOf(node)
        if (idx === -1) continue

        const newNode = LiteGraph.createNode(replacement.new_node_id)
        if (!newNode) continue

        const hasMapping =
          replacement.input_mapping != null ||
          replacement.output_mapping != null

        const effectiveReplacement = hasMapping
          ? replacement
          : {
              ...replacement,
              ...generateDefaultMapping(
                node.last_serialization ?? node.serialize(),
                newNode
              )
            }
        const replaced = replaceWithMapping(
          node,
          newNode,
          effectiveReplacement,
          nodeGraph,
          idx
        )
        if (!replaced) {
          replacementFailed = true
          continue
        }

        if (!replacedTypes.includes(match.type)) {
          replacedTypes.push(match.type)
        }
      }

      if (replacedTypes.length > 0) {
        graph.updateExecutionOrder()
        graph.setDirtyCanvas(true, true)

        toastStore.add({
          severity: 'success',
          summary: t('g.success'),
          detail: t('nodeReplacement.replacedAllNodes', {
            count: replacedTypes.length
          }),
          life: 3000
        })
      }
      if (replacementFailed) {
        toastStore.add({
          severity: 'error',
          summary: t('g.error', 'Error'),
          detail: t('nodeReplacement.replaceFailed', 'Failed to replace nodes')
        })
      }
    } catch (error) {
      console.error('Failed to replace nodes:', error)
      if (replacedTypes.length > 0) {
        graph.updateExecutionOrder()
        graph.setDirtyCanvas(true, true)
      }
      toastStore.add({
        severity: 'error',
        summary: t('g.error', 'Error'),
        detail: t('nodeReplacement.replaceFailed', 'Failed to replace nodes')
      })
      return replacedTypes
    } finally {
      changeTracker?.afterChange()
    }

    return replacedTypes
  }

  /**
   * Replaces all nodes in a single swap group and removes successfully
   * replaced types from pending warnings and rendered state.
   */
  function replaceGroup(group: ReplacementGroup): void {
    const replaced = replaceNodesInPlace(group.nodeTypes)
    if (replaced.length > 0) {
      removeReplacedMissingNodeTypes(replaced)
    }
  }

  /**
   * Replaces every available node across all swap groups and removes
   * the succeeded types from pending warnings and rendered state.
   */
  function replaceAllGroups(groups: ReplacementGroup[]): void {
    const allNodeTypes = groups.flatMap((g) => g.nodeTypes)
    const replaced = replaceNodesInPlace(allNodeTypes)
    if (replaced.length > 0) {
      removeReplacedMissingNodeTypes(replaced)
    }
  }

  return {
    replaceNodesInPlace,
    replaceGroup,
    replaceAllGroups
  }
}
