import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { LGraphNode, Positionable } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isImageNode, isLGraphNode } from '@/utils/litegraphUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

/**
 * Centralized computed selection state + shared helper actions to avoid duplication
 * between selection toolbox, context menus, and other UI affordances.
 */
export function useSelectionState() {
  const canvasStore = useCanvasStore()
  const nodeDefStore = useNodeDefStore()
  const sidebarTabStore = useSidebarTabStore()
  const nodeHelpStore = useNodeHelpStore()
  const { id: nodeLibraryTabId } = useNodeLibrarySidebarTab()

  const { selectedItems } = storeToRefs(canvasStore)

  const selectedNodes = computed(() => {
    return selectedItems.value.filter((i) => isLGraphNode(i))
  })

  const nodeDef = computed(() => {
    if (selectedNodes.value.length !== 1) return null
    return nodeDefStore.fromLGraphNode(selectedNodes.value[0])
  })

  const hasAnySelection = computed(() => selectedItems.value.length > 0)
  const hasSingleSelection = computed(() => selectedItems.value.length === 1)
  const hasMultipleSelection = computed(() => selectedItems.value.length > 1)

  const isSingleNode = computed(
    () => hasSingleSelection.value && isLGraphNode(selectedItems.value[0])
  )
  const isSingleSubgraph = computed(
    () =>
      isSingleNode.value &&
      (selectedItems.value[0] as LGraphNode)?.isSubgraphNode?.()
  )
  const isSingleImageNode = computed(
    () =>
      isSingleNode.value && isImageNode(selectedItems.value[0] as LGraphNode)
  )

  const hasSubgraphs = computed(() =>
    selectedItems.value.some((i) => (i as LGraphNode)?.isSubgraphNode?.())
  )
  const hasImageNode = computed(() => isSingleImageNode.value)
  const hasOutputNodesSelected = computed(
    () => filterOutputNodes(selectedNodes.value).length > 0
  )
  /** Toggle node help sidebar/panel for the single selected node (if any). */
  const showNodeHelp = () => {
    const def = nodeDef.value
    if (!def) return

    const isSidebarActive =
      sidebarTabStore.activeSidebarTabId === nodeLibraryTabId
    const currentHelpNode: any = nodeHelpStore.currentHelpNode
    const isSameNodeHelpOpen =
      isSidebarActive &&
      nodeHelpStore.isHelpOpen &&
      currentHelpNode &&
      currentHelpNode.nodePath === def.nodePath

    if (isSameNodeHelpOpen) {
      nodeHelpStore.closeHelp()
      sidebarTabStore.toggleSidebarTab(nodeLibraryTabId)
      return
    }

    if (!isSidebarActive) sidebarTabStore.toggleSidebarTab(nodeLibraryTabId)
    nodeHelpStore.openHelp(def)
  }

  const isRemovableItem = (item: unknown): item is Positionable =>
    item != null && typeof item === 'object' && 'removable' in item

  const isDeletable = computed(() =>
    selectedItems.value
      .filter(isRemovableItem)
      .some((x) => x.removable !== false)
  )

  return {
    selectedItems,
    selectedNodes,
    nodeDef,
    showNodeHelp,
    hasAnySelection,
    hasSingleSelection,
    hasMultipleSelection,
    isSingleNode,
    isSingleSubgraph,
    isSingleImageNode,
    hasSubgraphs,
    hasImageNode,
    hasOutputNodesSelected,
    isDeletable
  }
}
