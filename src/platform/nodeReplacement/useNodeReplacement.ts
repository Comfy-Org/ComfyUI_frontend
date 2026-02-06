import { clone } from 'es-toolkit/compat'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import type { MissingNodeType } from '@/types/comfy'

import { useNodeReplacementStore } from './nodeReplacementStore'

/**
 * Modify workflow data to replace missing node types with their replacements
 * @param graphData The workflow JSON data
 * @param replacements Map of old node type to new node type
 * @returns Modified workflow data with node types replaced
 */
function applyNodeReplacements(
  graphData: ComfyWorkflowJSON,
  replacements: Map<string, string>
): ComfyWorkflowJSON {
  const modifiedData = clone(graphData)

  // Helper function to process nodes array
  function processNodes(nodes: ComfyWorkflowJSON['nodes']) {
    if (!Array.isArray(nodes)) return

    for (const node of nodes) {
      const replacement = replacements.get(node.type)
      if (replacement) {
        node.type = replacement
      }
    }
  }

  // Process top-level nodes
  processNodes(modifiedData.nodes)

  // Process nodes in subgraphs
  if (modifiedData.definitions?.subgraphs) {
    for (const subgraph of modifiedData.definitions.subgraphs) {
      if (subgraph && 'nodes' in subgraph) {
        processNodes(subgraph.nodes as ComfyWorkflowJSON['nodes'])
      }
    }
  }

  return modifiedData
}

export function useNodeReplacement() {
  const nodeReplacementStore = useNodeReplacementStore()
  const workflowStore = useWorkflowStore()
  const toastStore = useToastStore()

  /**
   * Build a map of replacements from missing node types
   */
  function buildReplacementMap(
    missingNodeTypes: MissingNodeType[]
  ): Map<string, string> {
    const replacements = new Map<string, string>()

    for (const nodeType of missingNodeTypes) {
      if (typeof nodeType === 'object' && nodeType.isReplaceable) {
        const replacement = nodeType.replacement
        if (replacement) {
          replacements.set(nodeType.type, replacement.new_node_id)
        }
      }
    }

    return replacements
  }

  /**
   * Replace a single node type with its replacement
   * This reloads the entire workflow with the replacement applied
   * @param nodeType The type of the missing node to replace
   * @returns true if replacement was successful
   */
  async function replaceNode(nodeType: string): Promise<boolean> {
    const replacement = nodeReplacementStore.getReplacementFor(nodeType)
    if (!replacement) {
      console.warn(`No replacement found for node type: ${nodeType}`)
      return false
    }

    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow?.isLoaded) {
      console.error('No active workflow or workflow not loaded')
      return false
    }

    try {
      // Use current graph state, not originalContent, to preserve prior replacements
      const currentData =
        app.rootGraph.serialize() as unknown as ComfyWorkflowJSON

      // Create replacement map for single node
      const replacements = new Map<string, string>()
      replacements.set(nodeType, replacement.new_node_id)

      // Apply replacements
      const modifiedData = applyNodeReplacements(currentData, replacements)

      // Reload the workflow with modified data
      await app.loadGraphData(modifiedData, true, false, activeWorkflow, {
        showMissingNodesDialog: true,
        showMissingModelsDialog: true
      })

      toastStore.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('nodeReplacement.replacedNode', { nodeType }),
        life: 3000
      })

      return true
    } catch (error) {
      console.error('Failed to replace node:', error)
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('nodeReplacement.replaceFailed'),
        life: 5000
      })
      return false
    }
  }

  /**
   * Replace all replaceable missing nodes
   * This reloads the entire workflow with all replacements applied
   * @param missingNodeTypes Array of missing node types (from dialog props)
   * @returns Number of node types that were replaced
   */
  async function replaceAllNodes(
    missingNodeTypes: MissingNodeType[]
  ): Promise<number> {
    const replacements = buildReplacementMap(missingNodeTypes)

    if (replacements.size === 0) {
      console.warn('No replaceable nodes found')
      return 0
    }

    const activeWorkflow = workflowStore.activeWorkflow
    if (!activeWorkflow?.isLoaded) {
      console.error('No active workflow or workflow not loaded')
      return 0
    }

    try {
      // Use current graph state, not originalContent, to preserve any prior changes
      const currentData =
        app.rootGraph.serialize() as unknown as ComfyWorkflowJSON

      // Apply all replacements
      const modifiedData = applyNodeReplacements(currentData, replacements)

      // Reload the workflow with modified data
      await app.loadGraphData(modifiedData, true, false, activeWorkflow, {
        showMissingNodesDialog: true,
        showMissingModelsDialog: true
      })

      toastStore.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('nodeReplacement.replacedAllNodes', {
          count: replacements.size
        }),
        life: 3000
      })

      return replacements.size
    } catch (error) {
      console.error('Failed to replace nodes:', error)
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('nodeReplacement.replaceFailed'),
        life: 5000
      })
      return 0
    }
  }

  return {
    replaceNode,
    replaceAllNodes
  }
}
