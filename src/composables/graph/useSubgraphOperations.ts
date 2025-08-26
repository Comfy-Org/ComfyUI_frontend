import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { t } from '@/i18n'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
// import { app } from '@/scripts/app' // Will be used in future implementations
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useToastStore } from '@/stores/toastStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

/**
 * Composable for handling subgraph-related operations
 */
export function useSubgraphOperations() {
  const { getSelectedNodes } = useSelectedLiteGraphItems()
  const canvasStore = useCanvasStore()
  const toastStore = useToastStore()
  const workflowStore = useWorkflowStore()
  const nodeOutputStore = useNodeOutputStore()
  const nodeDefStore = useNodeDefStore()
  const nodeBookmarkStore = useNodeBookmarkStore()

  const convertToSubgraph = () => {
    const canvas = canvasStore.getCanvas()
    const graph = canvas.subgraph ?? canvas.graph

    if (!graph) {
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.noGraphAvailable'),
        life: 3000
      })
      return
    }

    if (!canvas.selectedItems || canvas.selectedItems.size === 0) {
      toastStore.add({
        severity: 'warn',
        summary: t('toastMessages.cannotCreateSubgraph'),
        detail: t('toastMessages.pleaseSelectNodesToConvert'),
        life: 3000
      })
      return
    }

    const res = graph.convertToSubgraph(canvas.selectedItems)
    if (!res) {
      toastStore.add({
        severity: 'error',
        summary: t('toastMessages.cannotCreateSubgraph'),
        detail: t('toastMessages.failedToConvertToSubgraph'),
        life: 3000
      })
      return
    }

    const { node } = res
    canvas.select(node)
    canvasStore.updateSelectedItems()

    toastStore.add({
      severity: 'success',
      summary: t('g.success'),
      detail: t('g.subgraphCreated'),
      life: 3000
    })

    // Trigger change tracking
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  const unpackSubgraph = () => {
    const canvas = canvasStore.getCanvas()
    const graph = canvas.subgraph ?? canvas.graph

    if (!graph) {
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.noGraphAvailable'),
        life: 3000
      })
      return
    }

    const selectedItems = Array.from(canvas.selectedItems)
    const subgraphNodes = selectedItems.filter(
      (item): item is SubgraphNode => item instanceof SubgraphNode
    )

    if (subgraphNodes.length === 0) {
      toastStore.add({
        severity: 'warn',
        summary: t('g.noSubgraphSelected'),
        detail: t('g.pleaseSelectSubgraphToUnpack'),
        life: 3000
      })
      return
    }

    subgraphNodes.forEach((subgraphNode) => {
      // Revoke any image previews for the subgraph
      nodeOutputStore.revokeSubgraphPreviews(subgraphNode)

      // Unpack the subgraph
      graph.unpackSubgraph(subgraphNode)
    })

    toastStore.add({
      severity: 'success',
      summary: t('g.success'),
      detail: t('g.subgraphUnpacked'),
      life: 3000
    })

    // Trigger change tracking
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  const addSubgraphToLibrary = async () => {
    const selectedItems = Array.from(canvasStore.selectedItems)

    // Handle single node selection like BookmarkButton.vue
    if (selectedItems.length === 1) {
      const item = selectedItems[0]
      if (isLGraphNode(item)) {
        const nodeDef = nodeDefStore.fromLGraphNode(item)
        if (nodeDef) {
          await nodeBookmarkStore.addBookmark(nodeDef.nodePath)
          toastStore.add({
            severity: 'success',
            summary: t('g.success'),
            detail: t('sideToolbar.addToBookmarks'),
            life: 3000
          })
          return
        }
      }
    }

    // Handle multiple nodes - convert to subgraph first then bookmark
    const selectedNodes = getSelectedNodes()

    if (selectedNodes.length === 0) {
      toastStore.add({
        severity: 'warn',
        summary: t('g.nothingSelected'),
        detail: t('g.pleaseSelectNodesToSave'),
        life: 3000
      })
      return
    }

    // Check if selection contains subgraph nodes
    const hasSubgraphs = selectedNodes.some(
      (node) => node instanceof SubgraphNode
    )

    if (!hasSubgraphs) {
      // Convert regular nodes to subgraph first
      convertToSubgraph()
      // Note: After conversion, the user can manually bookmark the resulting subgraph
      toastStore.add({
        severity: 'info',
        summary: t('g.info'),
        detail: `${t('g.subgraphCreated')}. You can now bookmark it using the bookmark button.`,
        life: 4000
      })
      return
    }

    // For subgraph nodes, bookmark them
    let bookmarkedCount = 0
    for (const node of selectedNodes) {
      if (node instanceof SubgraphNode) {
        const nodeDef = nodeDefStore.fromLGraphNode(node)
        if (nodeDef) {
          await nodeBookmarkStore.addBookmark(nodeDef.nodePath)
          bookmarkedCount++
        }
      }
    }

    if (bookmarkedCount > 0) {
      toastStore.add({
        severity: 'success',
        summary: t('g.success'),
        detail: `${bookmarkedCount} ${bookmarkedCount === 1 ? 'subgraph' : 'subgraphs'} bookmarked`,
        life: 3000
      })
    }
  }

  const isSubgraphSelected = (): boolean => {
    const selectedItems = Array.from(canvasStore.selectedItems)
    return selectedItems.some((item) => item instanceof SubgraphNode)
  }

  const hasSelectableNodes = (): boolean => {
    return getSelectedNodes().length > 0
  }

  return {
    convertToSubgraph,
    unpackSubgraph,
    addSubgraphToLibrary,
    isSubgraphSelected,
    hasSelectableNodes
  }
}
