import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { t } from '@/i18n'
import type { NodeReplacement } from '@/platform/nodeReplacement/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app, sanitizeNodeName } from '@/scripts/app'
import type { MissingNodeType } from '@/types/comfy'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

/**
 * Match a placeholder node to a selected missing node type.
 * Placeholder nodes have sanitized type strings, so we compare
 * against the sanitized version of the original type.
 */
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

/**
 * Transfer an input connection from an old node slot to a new node slot.
 * Updates the link's target to point at the new node's input.
 */
function transferInputConnection(
  oldNode: LGraphNode,
  oldInputName: string,
  newNode: LGraphNode,
  newInputName: string,
  graph: LGraph
): void {
  const oldSlotIdx = oldNode.inputs?.findIndex((i) => i.name === oldInputName)
  const newSlotIdx = newNode.inputs?.findIndex((i) => i.name === newInputName)
  if (oldSlotIdx == null || oldSlotIdx === -1) return
  if (newSlotIdx == null || newSlotIdx === -1) return

  const linkId = oldNode.inputs[oldSlotIdx].link
  if (linkId == null) return

  const link = graph.links.get(linkId)
  if (!link) return

  link.target_id = newNode.id
  link.target_slot = newSlotIdx
  newNode.inputs[newSlotIdx].link = linkId
}

/**
 * Transfer all output connections from an old node's output slot
 * to a new node's output slot.
 */
function transferOutputConnections(
  oldNode: LGraphNode,
  oldOutputIdx: number,
  newNode: LGraphNode,
  newOutputIdx: number,
  graph: LGraph
): void {
  const oldLinks = oldNode.outputs?.[oldOutputIdx]?.links
  if (!oldLinks?.length) return
  if (!newNode.outputs?.[newOutputIdx]) return

  for (const linkId of oldLinks) {
    const link = graph.links.get(linkId)
    if (!link) continue
    link.origin_id = newNode.id
    link.origin_slot = newOutputIdx
  }
  newNode.outputs[newOutputIdx].links = [...oldLinks]
}

/**
 * Transfer a widget value from old serialized data to a new node's widget
 * using old_widget_ids as the name→index lookup for positional widget values.
 */
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
    newWidget.value = oldValue
    newWidget.callback?.(oldValue)
  }
}

/**
 * Set a fixed value on a new node's widget.
 */
function applySetValue(
  newNode: LGraphNode,
  inputName: string,
  value: unknown
): void {
  const widget = newNode.widgets?.find((w) => w.name === inputName)
  if (widget) {
    widget.value = value as TWidgetValue
    widget.callback?.(widget.value)
  }
}

/**
 * Check if a new_id uses dot-notation (e.g. "images.image0", "resize_type.multiplier").
 * These represent Autogrow or DynamicCombo sub-inputs that require special handling.
 */
function isDotNotation(id: string): boolean {
  return id.includes('.')
}

/**
 * Replace a node using configure+copy (for simple replacements with no mapping).
 */
function replaceSimple(
  node: LGraphNode,
  newNode: LGraphNode,
  newType: string,
  nodeGraph: LGraph,
  idx: number
): void {
  nodeGraph._nodes[idx] = newNode
  newNode.configure(node.serialize())
  newNode.type = newType
  newNode.has_errors = false
  delete newNode.last_serialization
  newNode.graph = nodeGraph
  nodeGraph._nodes_by_id[newNode.id] = newNode
  if (node.inputs) newNode.inputs = [...node.inputs]
  if (node.outputs) newNode.outputs = [...node.outputs]
}

/**
 * Replace a node using input/output mapping for accurate connection remapping.
 */
function replaceWithMapping(
  node: LGraphNode,
  newNode: LGraphNode,
  replacement: NodeReplacement,
  nodeGraph: LGraph,
  idx: number
): void {
  // Copy identity and layout from old node
  newNode.id = node.id
  newNode.pos = [...node.pos]
  newNode.size = [...node.size]
  newNode.order = node.order
  newNode.mode = node.mode
  if (node.flags) newNode.flags = { ...node.flags }

  // Register in graph
  nodeGraph._nodes[idx] = newNode
  newNode.graph = nodeGraph
  nodeGraph._nodes_by_id[newNode.id] = newNode

  const serialized = node.last_serialization ?? node.serialize()

  // Preserve user-defined title and properties
  if (serialized.title != null) newNode.title = serialized.title
  if (serialized.properties) {
    newNode.properties = { ...serialized.properties }
  }

  // Apply input mapping
  if (replacement.input_mapping) {
    for (const inputMap of replacement.input_mapping) {
      if ('old_id' in inputMap) {
        // Skip dot-notation inputs (Autogrow/DynamicCombo) - backend handles these
        if (isDotNotation(inputMap.new_id)) {
          transferWidgetValue(
            serialized,
            replacement.old_widget_ids,
            inputMap.old_id,
            newNode,
            inputMap.new_id
          )
          continue
        }
        transferInputConnection(
          node,
          inputMap.old_id,
          newNode,
          inputMap.new_id,
          nodeGraph
        )
        transferWidgetValue(
          serialized,
          replacement.old_widget_ids,
          inputMap.old_id,
          newNode,
          inputMap.new_id
        )
      } else {
        if (!isDotNotation(inputMap.new_id)) {
          applySetValue(newNode, inputMap.new_id, inputMap.set_value)
        }
      }
    }
  }

  // Apply output mapping
  if (replacement.output_mapping) {
    for (const outMap of replacement.output_mapping) {
      transferOutputConnections(
        node,
        outMap.old_idx,
        newNode,
        outMap.new_idx,
        nodeGraph
      )
    }
  }

  newNode.has_errors = false
}

export function useNodeReplacement() {
  const toastStore = useToastStore()

  /**
   * Replace selected missing nodes in-place on the graph.
   * For nodes with input/output mapping, connections and widget values
   * are remapped accurately. For simple replacements (no mapping),
   * the existing configure+copy approach is used.
   *
   * @param selectedTypes Missing node types selected for replacement
   * @returns Array of original type names that were successfully replaced
   */
  function replaceNodesInPlace(selectedTypes: MissingNodeType[]): string[] {
    const replacedTypes: string[] = []
    const graph = app.rootGraph

    // Track change for undo support
    const changeTracker =
      useWorkflowStore().activeWorkflow?.changeTracker ?? null
    changeTracker?.beforeChange()

    try {
      const placeholders = collectAllNodes(
        graph,
        (n) => !!n.has_errors && !!n.last_serialization
      )

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

        if (hasMapping) {
          replaceWithMapping(node, newNode, replacement, nodeGraph, idx)
        } else {
          replaceSimple(node, newNode, replacement.new_node_id, nodeGraph, idx)
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
    } finally {
      changeTracker?.afterChange()
    }

    return replacedTypes
  }

  return {
    replaceNodesInPlace
  }
}
