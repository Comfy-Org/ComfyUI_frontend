import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import {
  isImageNode,
  isLGraphGroup,
  isLGraphNode,
  isLoad3dNode
} from '@/utils/litegraphUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

export interface NodeSelectionState {
  collapsed: boolean
  pinned: boolean
}

/**
 * Centralized computed selection state + shared helper actions to avoid duplication
 * between selection toolbox, context menus, and other UI affordances.
 */
export function useSelectionState() {
  const canvasStore = useCanvasStore()
  const nodeDefStore = useNodeDefStore()
  const settingStore = useSettingStore()
  const rightSidePanelStore = useRightSidePanelStore()

  const { selectedItems } = storeToRefs(canvasStore)

  const selectedNodes = computed(() => {
    return selectedItems.value.filter((i: unknown) =>
      isLGraphNode(i)
    ) as LGraphNode[]
  })

  const nodeDef = computed(() => {
    if (selectedNodes.value.length !== 1) return null
    return nodeDefStore.fromLGraphNode(selectedNodes.value[0])
  })

  const hasAnySelection = computed(() => selectedItems.value.length > 0)
  const hasSingleSelection = computed(() => selectedItems.value.length === 1)
  const hasMultipleSelection = computed(() => selectedItems.value.length > 1)
  const hasGroupedNodesSelection = computed(() =>
    selectedItems.value.some(
      (item) => isLGraphGroup(item) && [...item.children].some(isLGraphNode)
    )
  )

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
    selectedItems.value.some((i: unknown) => i instanceof SubgraphNode)
  )

  const hasAny3DNodeSelected = computed(() => {
    const enable3DViewer = settingStore.get('Comfy.Load3D.3DViewerEnable')
    return (
      selectedNodes.value.length === 1 &&
      selectedNodes.value.some(isLoad3dNode) &&
      enable3DViewer
    )
  })

  const hasImageNode = computed(() => isSingleImageNode.value)
  const hasOutputNodesSelected = computed(
    () => filterOutputNodes(selectedNodes.value).length > 0
  )

  // Helper function to compute selection flags (reused by both computed and function)
  const computeSelectionStatesFromNodes = (
    nodes: LGraphNode[]
  ): NodeSelectionState => {
    if (!nodes.length) return { collapsed: false, pinned: false }
    return {
      collapsed: nodes.some((n) => n.flags?.collapsed),
      pinned: nodes.some((n) => n.pinned)
    }
  }

  const selectedNodesStates = computed<NodeSelectionState>(() =>
    computeSelectionStatesFromNodes(selectedNodes.value)
  )

  // On-demand computation (non-reactive) so callers can fetch fresh flags
  const computeSelectionFlags = (): NodeSelectionState =>
    computeSelectionStatesFromNodes(selectedNodes.value)

  const canOpenNodeInfo = computed(
    () =>
      Boolean(nodeDef.value) &&
      settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
  )

  const openNodeInfo = () => {
    if (!canOpenNodeInfo.value) return false
    rightSidePanelStore.openPanel('info')
    return true
  }

  return {
    selectedItems,
    selectedNodes,
    nodeDef,
    canOpenNodeInfo,
    openNodeInfo,
    hasAny3DNodeSelected,
    hasAnySelection,
    hasGroupedNodesSelection,
    hasSingleSelection,
    hasMultipleSelection,
    isSingleNode,
    isSingleSubgraph,
    isSingleImageNode,
    hasSubgraphs,
    hasImageNode,
    hasOutputNodesSelected,
    selectedNodesStates,
    computeSelectionFlags
  }
}
