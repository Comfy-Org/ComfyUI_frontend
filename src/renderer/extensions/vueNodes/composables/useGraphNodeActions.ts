import { ref } from 'vue'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useTelemetry } from '@comfyorg/telemetry'
import { LayoutSource } from '@/renderer/core/layout/types'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { app } from '@/scripts/app'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { resizeNodeLayout } from '@/renderer/core/layout/operations/graphLayoutAttachment'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { useNodeResize } from '@/renderer/extensions/vueNodes/interactions/resize/useNodeResize'
import type { Ref } from 'vue'
import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'

interface GraphNodeActions {
  node: Readonly<Ref<LGraphNode | null>>
  collapsed: Readonly<Ref<boolean>>
  imagePreviewGrowth: Readonly<Ref<number>>
  interactive: Readonly<Ref<boolean>>
}

export function useGraphNodeActions(
  nodeData: Readonly<Ref<NodeState>>,
  {
    node: lgraphNode,
    collapsed: isCollapsed,
    imagePreviewGrowth,
    interactive: shouldHandleNodePointerEvents
  }: GraphNodeActions
) {
  const { handleNodeCollapse, handleNodeTitleUpdate, handleNodeRightClick } =
    useNodeEventHandlers()

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    handleNodeRightClick(event, nodeData.value.id)
    showNodeOptions(event, { nodeId: nodeData.value.id })
  }

  const { startResize } = useNodeResize((result) => {
    if (isCollapsed.value) return
    const node = lgraphNode.value
    if (!node) return

    resizeNodeLayout(
      node,
      {
        width: Math.max(result.size.width, MIN_NODE_WIDTH),
        height:
          removeNodeTitleHeight(result.size.height) - imagePreviewGrowth.value
      },
      {
        position: result.position,
        source: LayoutSource.Vue
      }
    )
  })

  const handleResizePointerDown = (
    event: PointerEvent,
    corner: CompassCorners
  ) => {
    if (event.button !== 0) return
    if (!shouldHandleNodePointerEvents.value) return
    if (nodeData.value.flags.pinned) return
    if (nodeData.value.resizable === false) return
    startResize(event, corner)
  }

  const handleCollapse = () => {
    handleNodeCollapse(nodeData.value.id, !isCollapsed.value)
  }

  const handleHeaderTitleUpdate = (newTitle: string) => {
    handleNodeTitleUpdate(nodeData.value.id, newTitle)
  }

  const rightSidePanelStore = useRightSidePanelStore()

  const handleOpenErrors = () => {
    rightSidePanelStore.openPanel('errors')
  }

  const handleToggleAdvanced = () => {
    const node = lgraphNode.value
    if (!node) return
    if (node instanceof SubgraphNode) {
      if (rightSidePanelStore.isOpen) rightSidePanelStore.closePanel()
      else rightSidePanelStore.focusSection('advanced-inputs')
      return
    }
    node.showAdvanced = !node.showAdvanced
  }

  const handleEnterSubgraph = () => {
    useTelemetry()?.trackUiButtonClicked({
      button_id: 'graph_node_open_subgraph_clicked',
      element_group: 'graph_node'
    })

    const litegraphNode = lgraphNode.value

    if (!litegraphNode?.isSubgraphNode() || !('subgraph' in litegraphNode)) {
      console.warn(
        'LGraphNode: Node is not a valid subgraph node',
        litegraphNode
      )
      return
    }

    const canvas = app.canvas

    canvas.openSubgraph(litegraphNode.subgraph, litegraphNode)
  }

  const isDraggingOver = ref(false)

  function handleDragOver(event: DragEvent) {
    const node = lgraphNode.value
    if (!node || !node.onDragOver) {
      isDraggingOver.value = false
      return
    }
    const canDrop = node.onDragOver(event)
    isDraggingOver.value = canDrop
  }

  function handleDragLeave() {
    isDraggingOver.value = false
  }

  function handleDrop(event: DragEvent) {
    isDraggingOver.value = false
    app.dragOverNode = event.defaultPrevented ? null : lgraphNode.value
  }
  return {
    isDraggingOver,
    handleResizePointerDown,
    handleContextMenu,
    handleCollapse,
    handleHeaderTitleUpdate,
    handleOpenErrors,
    handleToggleAdvanced,
    handleEnterSubgraph,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
