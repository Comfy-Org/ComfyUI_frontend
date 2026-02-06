import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
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

export function useNodeReplacement() {
  const toastStore = useToastStore()

  /**
   * Replace selected missing nodes in-place on the graph.
   * Uses the checkNodeTypes() pattern: create new node, configure with
   * old serialization, copy inputs/outputs to preserve connections.
   *
   * @param selectedTypes Missing node types selected for replacement
   * @returns Array of original type names that were successfully replaced
   */
  function replaceNodesInPlace(selectedTypes: MissingNodeType[]): string[] {
    const replacedTypes: string[] = []
    const graph = app.rootGraph

    const placeholders = collectAllNodes(
      graph,
      (n) => !!n.has_errors && !!n.last_serialization
    )

    for (const node of placeholders) {
      const match = findMatchingType(node, selectedTypes)
      if (!match?.replacement) continue

      const newNode = LiteGraph.createNode(match.replacement.new_node_id)
      if (!newNode) continue

      const nodeGraph = node.graph
      if (!nodeGraph) continue

      const idx = nodeGraph._nodes.indexOf(node)
      if (idx === -1) continue

      // checkNodeTypes() pattern: swap in array, configure, copy connections
      const newType = match.replacement.new_node_id
      nodeGraph._nodes[idx] = newNode
      newNode.configure(node.serialize())
      // configure() overwrites type with old serialization; restore the new type
      newNode.type = newType
      newNode.has_errors = false
      delete newNode.last_serialization
      newNode.graph = nodeGraph
      nodeGraph._nodes_by_id[newNode.id] = newNode
      if (node.inputs) newNode.inputs = [...node.inputs]
      if (node.outputs) newNode.outputs = [...node.outputs]

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

    return replacedTypes
  }

  return {
    replaceNodesInPlace
  }
}
